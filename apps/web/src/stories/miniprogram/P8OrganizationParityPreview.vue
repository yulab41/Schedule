<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { localAuth } from '../../auth/local-auth.js';
import AppStatePanel from '../../components/AppStatePanel.vue';
import GroupSetupPanel from '../../features/groups/GroupSetupPanel.vue';
import MemberManager from '../../features/members/MemberManager.vue';
import SchedulingConfigPanel from '../../features/scheduling-config/SchedulingConfigPanel.vue';
import PlatformAdminUsersView from '../../views/platform/PlatformAdminUsersView.vue';
import P8InviteVisitorGolden from './P8InviteVisitorGolden.vue';
import {
  createP8OrganizationFixtureFetch,
  getP8OrganizationGroup,
  type P8OrganizationArea,
  type P8OrganizationRole,
  type P8OrganizationSurface,
} from './p8-organization-parity-fixtures.js';

const props = withDefaults(
  defineProps<{
    readonly area?: P8OrganizationArea;
    readonly largeText?: boolean;
    readonly role?: P8OrganizationRole;
    readonly surface?: P8OrganizationSurface;
  }>(),
  { area: 'group', largeText: false, role: 'owner', surface: 'ready' },
);

const originalFetch = globalThis.fetch;
const fixtureFetch = ref<typeof globalThis.fetch>();
const previewKey = ref(0);
const isStaged = ref(false);
const stageError = ref<string>();
const group = computed(() => getP8OrganizationGroup(props.role));
const isPermissionDisabled = computed(
  () =>
    props.surface === 'disabled' ||
    (props.area === 'config' && props.role === 'member') ||
    (props.area === 'platform' && props.role !== 'platform-admin'),
);

function installFixture(): void {
  const nextFixtureFetch = createP8OrganizationFixtureFetch({
    area: props.area,
    role: props.role,
    surface: props.surface,
  });
  fixtureFetch.value = nextFixtureFetch;
  globalThis.fetch = nextFixtureFetch;
  localAuth.setSession('p8-organization-storybook-session');
}

async function stageStory(): Promise<void> {
  isStaged.value = false;
  stageError.value = undefined;
  try {
    await waitForElement(areaSelector(props.area));
    if (props.surface === 'loading' || props.surface === 'disabled') {
      isStaged.value = true;
      return;
    }
    if (props.surface === 'error') {
      await waitFor(() => document.body.textContent?.includes('组织管理资料暂时无法加载'));
      isStaged.value = true;
      return;
    }
    await waitForAreaSettled(props.area);
    if (props.surface === 'confirm') await openConfirmationSurface(props.area);
    if (props.surface === 'success' || props.surface === 'conflict') {
      await submitMutationSurface(props.area);
    }
    isStaged.value = true;
  } catch (error) {
    stageError.value = error instanceof Error ? error.message : 'P8 Storybook 状态装配失败。';
  }
}

async function waitForAreaSettled(area: P8OrganizationArea): Promise<void> {
  if (area === 'members') {
    await waitFor(
      () => document.querySelector('.member-manager')?.getAttribute('aria-busy') === 'false',
    );
  } else if (area === 'config') {
    await waitFor(
      () =>
        document.querySelector('.scheduling-config-panel')?.getAttribute('aria-busy') === 'false',
    );
  } else if (area === 'platform') {
    await waitFor(() => !document.body.textContent?.includes('正在加载账号状态'));
  } else if (area === 'group') {
    await waitFor(() => document.body.textContent?.includes('当前工作群组'));
  }
}

async function openConfirmationSurface(area: P8OrganizationArea): Promise<void> {
  if (area === 'group') {
    click(await waitForVisibleButton('解散群组'));
    await waitForElement('dialog.responsive-sheet[open][aria-label="解散群组"]');
  } else if (area === 'members') {
    click(await waitForExistingElement<HTMLButtonElement>('.member-manage-button'));
    await waitForElement('dialog.responsive-sheet[open][aria-label^="管理成员"]');
  } else if (area === 'config') {
    click(await waitForVisibleButton('＋ 新增班种'));
    await waitForElement('.new-shift-editor');
  } else if (area === 'platform') {
    click(await waitForElement<HTMLButtonElement>('.platform-primary-button'));
    await waitForElement('.platform-modal[role="dialog"]');
  }
}

async function submitMutationSurface(area: P8OrganizationArea): Promise<void> {
  if (area === 'group') {
    setControlValue(
      await waitForElement<HTMLInputElement>('.current-group-card input'),
      '急诊医学中心夜班组',
    );
    click(await waitForVisibleButton('保存名称'));
    await waitForMutationFeedback(
      props.surface === 'success' ? '群组名称已更新' : '资料已被其他操作更新',
    );
  } else if (area === 'members') {
    click(await waitForVisibleButton('添加成员'));
    const dialog = await waitForElement<HTMLDialogElement>(
      'dialog.responsive-sheet[open][aria-label="添加预设成员"]',
    );
    setControlValue(
      await waitForElement<HTMLTextAreaElement>('textarea', dialog),
      '赵医生\n孙医生',
    );
    click(await findVisibleButton(dialog, '添加预设成员'));
    await waitForMutationFeedback(
      props.surface === 'success' ? '已添加 2 位预设成员' : '资料已被其他操作更新',
    );
  } else if (area === 'config') {
    setControlValue(await waitForElement<HTMLInputElement>('.new-role-form input'), '机动备班');
    click(await waitForVisibleButton('新增岗位'));
    await waitForMutationFeedback(
      props.surface === 'success' ? '机动备班' : '资料已被其他操作更新',
    );
  } else if (area === 'platform') {
    click(await waitForElement<HTMLButtonElement>('.platform-primary-button'));
    const modal = await waitForElement<HTMLElement>('.platform-modal[role="dialog"]');
    if (props.surface === 'success') {
      click(await findVisibleButton(modal, '生成 10 分钟绑定链接'));
      await waitForElement('.platform-link-result');
    } else {
      setControlValue(
        await waitForElement<HTMLInputElement>('.platform-field input'),
        'doctor.chen',
      );
      click(await findVisibleButton(modal, '保存用户名'));
      await waitForMutationFeedback('账号身份状态已更新');
    }
  }
}

function waitForMutationFeedback(expectedText: string): Promise<unknown> {
  return waitFor(() =>
    [...document.querySelectorAll<HTMLElement>('[role="alert"], [role="status"], .t-alert')].find(
      (element) => isVisible(element) && normalizeText(element.textContent).includes(expectedText),
    ),
  );
}

function findVisibleButton(root: Document | HTMLElement, label: string): Promise<HTMLElement> {
  return waitFor(() =>
    [...root.querySelectorAll<HTMLElement>('button')].find(
      (button) => isVisible(button) && normalizeText(button.textContent) === label,
    ),
  );
}

function waitForVisibleButton(label: string): Promise<HTMLElement> {
  return findVisibleButton(document, label);
}

function waitForExistingElement<ElementType extends HTMLElement = HTMLElement>(
  selector: string,
  root: Document | HTMLElement = document,
): Promise<ElementType> {
  return waitFor(() => root.querySelector<ElementType>(selector) ?? undefined);
}

function waitForElement<ElementType extends HTMLElement = HTMLElement>(
  selector: string,
  root: Document | HTMLElement = document,
): Promise<ElementType> {
  return waitFor(() => {
    const element = root.querySelector<ElementType>(selector);
    return element !== null && isVisible(element) ? element : undefined;
  });
}

async function waitFor<Value>(
  read: () => Value | undefined | false | null,
  timeoutMs = 8_000,
): Promise<Value> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = read();
    if (value !== undefined && value !== false && value !== null) return value;
    await new Promise<void>((resolve) => window.setTimeout(resolve, 40));
  }
  throw new Error('P8 Storybook 状态装配超时。');
}

function setControlValue(control: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const prototype =
    control instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  setter?.call(control, value);
  control.dispatchEvent(new Event('input', { bubbles: true }));
  control.dispatchEvent(new Event('change', { bubbles: true }));
}

function click(element: HTMLElement): void {
  element.click();
}

function isVisible(element: HTMLElement): boolean {
  const style = getComputedStyle(element);
  return (
    element.getClientRects().length > 0 &&
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    Number.parseFloat(style.opacity) > 0
  );
}

function normalizeText(value: string | null): string {
  return (value ?? '').replace(/\s+/gu, ' ').trim();
}

function areaSelector(area: P8OrganizationArea): string {
  if (area === 'group') return '.group-setup-panel';
  if (area === 'members') return '.member-manager';
  if (area === 'config') return '.scheduling-config-panel, .p8-permission-boundary';
  if (area === 'platform') return '.platform-admin-users, .p8-permission-boundary';
  return '.p8-invite-visitor';
}

function roleLabel(role: P8OrganizationRole): string {
  if (role === 'owner') return '群主';
  if (role === 'administrator') return '群管理员';
  if (role === 'member') return '普通成员';
  if (role === 'developer') return '后台管理员';
  return '平台管理员';
}

function areaLabel(area: P8OrganizationArea): string {
  if (area === 'group') return '群组与偏好';
  if (area === 'members') return '成员与预设';
  if (area === 'config') return '班种与岗位';
  if (area === 'platform') return '平台账号';
  return '邀请与访客';
}

watch(
  () => [props.area, props.role, props.surface] as const,
  async () => {
    installFixture();
    previewKey.value += 1;
    await nextTick();
    void stageStory();
  },
);

installFixture();
onMounted(() => void stageStory());
onBeforeUnmount(() => {
  if (globalThis.fetch === fixtureFetch.value) globalThis.fetch = originalFetch;
  localAuth.clearDevIdentity();
});
</script>

<template>
  <div
    class="p8-organization-preview"
    :class="{ 'is-large-text': largeText }"
    :data-p8-area="area"
    :data-p8-role="role"
    :data-p8-story-ready="isStaged ? 'true' : 'false'"
    :data-p8-surface="surface"
  >
    <header class="p8-permission-wristband">
      <div>
        <span>P8-B · 组织管理黄金</span>
        <strong>{{ areaLabel(area) }}</strong>
      </div>
      <dl>
        <div>
          <dt>当前身份</dt>
          <dd>{{ roleLabel(role) }}</dd>
        </div>
        <div>
          <dt>状态</dt>
          <dd>{{ surface }}</dd>
        </div>
      </dl>
    </header>

    <div class="p8-production-surface">
      <AppStatePanel
        v-if="isPermissionDisabled && area !== 'invite-visitor'"
        class="p8-permission-boundary"
        eyebrow="权限边界"
        title="当前身份不可进入此管理页面"
        description="页面入口会在业务请求前关闭；切换到有权限的身份后再继续。"
        tone="empty"
      />
      <GroupSetupPanel v-else-if="area === 'group'" :key="previewKey" :group="group" />
      <MemberManager v-else-if="area === 'members'" :key="previewKey" :group="group" />
      <SchedulingConfigPanel v-else-if="area === 'config'" :key="previewKey" :group="group" />
      <PlatformAdminUsersView v-else-if="area === 'platform'" :key="previewKey" />
      <P8InviteVisitorGolden v-else :key="previewKey" :role="role" :surface="surface" />
    </div>

    <p v-if="stageError !== undefined" class="p8-stage-error" role="alert">{{ stageError }}</p>
  </div>
</template>

<style scoped>
.p8-organization-preview {
  min-height: 100dvh;
  padding: 12px;
  color: var(--ui-color-text-primary);
  background: var(--ui-color-background);
  box-sizing: border-box;
}

.p8-permission-wristband {
  display: flex;
  max-width: 1120px;
  min-height: 68px;
  margin: 0 auto 12px;
  padding: 12px 14px;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  overflow: hidden;
  background:
    linear-gradient(90deg, var(--ui-color-primary) 0 6px, transparent 6px), var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-medium);
  box-shadow: var(--ui-shadow-card);
  box-sizing: border-box;
}

.p8-permission-wristband > div {
  display: grid;
  gap: 3px;
}

.p8-permission-wristband span,
.p8-permission-wristband dt {
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-xs);
}

.p8-permission-wristband strong {
  font-size: var(--ui-font-size-lg);
}

.p8-permission-wristband dl {
  display: flex;
  margin: 0;
  gap: 8px;
}

.p8-permission-wristband dl div {
  min-width: 92px;
  padding: 7px 9px;
  background: var(--ui-color-primary-light);
  border: 1px solid var(--ui-color-primary-border);
  border-radius: var(--ui-radius-small);
}

.p8-permission-wristband dt,
.p8-permission-wristband dd {
  margin: 0;
}

.p8-permission-wristband dd {
  margin-top: 2px;
  color: var(--ui-color-primary-dark);
  font-size: var(--ui-font-size-sm);
  font-weight: var(--ui-font-weight-semibold);
}

.p8-production-surface {
  max-width: 1120px;
  margin: 0 auto;
}

.p8-production-surface :deep(.platform-admin-users) {
  min-height: auto;
  padding: 20px 0 48px;
}

.p8-production-surface :deep(.platform-admin-header) {
  display: none;
}

.p8-production-surface :deep(.platform-admin-body) {
  padding-top: 0;
}

.p8-permission-boundary {
  min-height: 260px;
}

.is-large-text {
  --ui-font-size-xs: 14px;
  --ui-font-size-sm: 16px;
  --ui-font-size-md: 18px;
  --ui-font-size-lg: 21px;
  --ui-font-size-xl: 25px;
  --ui-font-size-xxl: 32px;
}

.p8-stage-error {
  position: fixed;
  z-index: 9999;
  right: 12px;
  bottom: 12px;
  left: 12px;
  padding: 12px;
  color: var(--ui-color-danger);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-danger);
  border-radius: var(--ui-radius-medium);
  box-shadow: var(--ui-shadow-elevated);
  font-size: var(--ui-font-size-sm);
}

@media (max-width: 640px) {
  .p8-organization-preview {
    padding: 8px;
  }

  .p8-permission-wristband {
    align-items: stretch;
    flex-direction: column;
  }

  .p8-permission-wristband dl {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .p8-permission-wristband dl div {
    min-width: 0;
  }

  .p8-production-surface :deep(.platform-admin-users) {
    padding-bottom: 24px;
  }
}
</style>
