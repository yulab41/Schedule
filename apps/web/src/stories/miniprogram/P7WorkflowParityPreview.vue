<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { localAuth } from '../../auth/local-auth.js';
import HomeView from '../../views/HomeView.vue';
import {
  createP7WorkflowFixtureFetch,
  type P7WorkflowKind,
  type P7WorkflowRole,
  type P7WorkflowSurface,
} from './p7-workflow-parity-fixtures.js';

const props = withDefaults(
  defineProps<{
    readonly role?: P7WorkflowRole;
    readonly surface?: P7WorkflowSurface;
    readonly workflow?: P7WorkflowKind;
  }>(),
  { role: 'member', surface: 'list', workflow: 'leave' },
);

const originalFetch = globalThis.fetch;
const fixtureFetch = ref<typeof globalThis.fetch>();
const homeKey = ref(0);
const isStaged = ref(false);
const stageError = ref<string>();

function installFixture(): void {
  const nextFixtureFetch = createP7WorkflowFixtureFetch({
    role: props.role,
    surface: props.surface,
    workflow: props.workflow,
  });
  fixtureFetch.value = nextFixtureFetch;
  globalThis.fetch = nextFixtureFetch;
  localAuth.setSession('p7-storybook-session');
}

async function stageStory(): Promise<void> {
  isStaged.value = false;
  stageError.value = undefined;
  try {
    await navigateToWorkflow(props.workflow);
    const panel = await waitForElement(panelSelector(props.workflow));
    if (props.surface === 'loading') {
      isStaged.value = true;
      return;
    }
    await waitFor(() => panel.getAttribute('aria-busy') === 'false');

    if (props.surface === 'create') {
      await openCreateSurface(props.workflow);
    } else if (props.surface === 'approval') {
      await openLeaveApproval();
    } else if (props.surface === 'direct') {
      await openDirectSurface(props.workflow);
    } else if (props.surface === 'preview' || props.surface === 'conflict') {
      await openPreviewSurface(props.workflow);
    }
    isStaged.value = true;
  } catch (error) {
    stageError.value = error instanceof Error ? error.message : 'P7 Storybook 状态装配失败。';
  }
}

async function navigateToWorkflow(workflow: P7WorkflowKind): Promise<void> {
  if (workflow !== 'swap') {
    await waitForVisibleButton('更多').then(click);
    await waitForElement('dialog.responsive-sheet[open][aria-label="更多功能"]');
    await waitForVisibleButton(workflowLabel(workflow), true).then(click);
    return;
  }
  await waitForVisibleButton(workflowLabel(workflow)).then(click);
}

async function openCreateSurface(workflow: P7WorkflowKind): Promise<void> {
  await waitForElement(createButtonSelector(workflow)).then(click);
  await waitForElement(`dialog.responsive-sheet[open][aria-label="${createSheetTitle(workflow)}"]`);
}

async function openLeaveApproval(): Promise<void> {
  await waitForVisibleButton('待我审批', true).then(click);
  await waitForVisibleButton('预览并审批').then(click);
  await waitForElement('dialog.responsive-sheet[open][aria-label^="请假审批"]');
  await waitForElement('.approval-dialog[aria-busy="false"]');
}

async function openDirectSurface(workflow: P7WorkflowKind): Promise<void> {
  const selector = workflow === 'swap' ? '#swap-admin-create-button' : '#duty-admin-create-button';
  await waitForElement(selector).then(click);
  await waitForElement(`dialog.responsive-sheet[open][aria-label="${directSheetTitle(workflow)}"]`);
}

async function openPreviewSurface(workflow: P7WorkflowKind): Promise<void> {
  if (workflow === 'leave') {
    await openLeaveApproval();
    return;
  }
  await openCreateSurface(workflow);
  const dialog = await waitForElement<HTMLDialogElement>(
    `dialog.responsive-sheet[open][aria-label="${createSheetTitle(workflow)}"]`,
  );
  const selectCount = workflow === 'swap' ? 3 : 2;
  for (let index = 0; index < selectCount; index += 1) {
    await selectFirstOption(dialog, index);
  }
  await findVisibleButtonIn(dialog, '生成预览').then(click);
  await waitForElement(`${panelSelector(workflow)} .workflow-preview`);
}

async function selectFirstOption(dialog: HTMLDialogElement, index: number): Promise<void> {
  const select = await waitFor(() =>
    dialog.querySelectorAll<HTMLElement>('.t-select-input').item(index),
  );
  const input = select.querySelector<HTMLInputElement>('input');
  const trigger = input ?? select.querySelector<HTMLElement>('.t-input') ?? select;
  await waitFor(() => visibleSelectOptions().length === 0);
  const previousValue = input?.value ?? '';
  click(trigger);
  const option = await waitFor(() => visibleSelectOptions()[0]);
  click(option);
  await waitFor(() => (input?.value ?? '') !== previousValue && (input?.value ?? '') !== '');
  await waitFor(() => visibleSelectOptions().length === 0);
}

function visibleSelectOptions(): readonly HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('.t-select-option')].filter(isVisible);
}

function findVisibleButtonIn(
  root: Document | HTMLDialogElement,
  label: string,
  startsWith = false,
): Promise<HTMLElement> {
  return waitFor(() =>
    [...root.querySelectorAll<HTMLElement>('button')].find((button) => {
      if (!isVisible(button)) return false;
      const text = normalizeText(button.textContent);
      return startsWith ? text.startsWith(label) : text === label;
    }),
  );
}

function waitForVisibleButton(label: string, startsWith = false): Promise<HTMLElement> {
  return findVisibleButtonIn(document, label, startsWith);
}

function waitForElement<ElementType extends HTMLElement = HTMLElement>(
  selector: string,
): Promise<ElementType> {
  return waitFor(() => {
    const element = document.querySelector<ElementType>(selector);
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
  throw new Error('P7 Storybook 状态装配超时。');
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

function workflowLabel(workflow: P7WorkflowKind): string {
  if (workflow === 'leave') return '请假';
  if (workflow === 'swap') return '换班';
  return '加扣班';
}

function panelSelector(workflow: P7WorkflowKind): string {
  if (workflow === 'leave') return '.leave-panel';
  if (workflow === 'swap') return '.swap-panel';
  return '.duty-adjustment-panel';
}

function createButtonSelector(workflow: P7WorkflowKind): string {
  if (workflow === 'leave') return '#leave-create-button';
  if (workflow === 'swap') return '#swap-create-button';
  return '#duty-create-button';
}

function createSheetTitle(workflow: P7WorkflowKind): string {
  if (workflow === 'leave') return '新建请假';
  if (workflow === 'swap') return '发起换班';
  return '发起加扣班';
}

function directSheetTitle(workflow: P7WorkflowKind): string {
  return workflow === 'swap' ? '管理员直接换班' : '管理员直接代值';
}

watch(
  () => [props.role, props.surface, props.workflow] as const,
  async () => {
    installFixture();
    homeKey.value += 1;
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
    class="p7-workflow-preview"
    :data-p7-story-ready="isStaged ? 'true' : 'false'"
    :data-p7-workflow="workflow"
    :data-p7-surface="surface"
  >
    <HomeView :key="homeKey" />
    <p v-if="stageError !== undefined" class="p7-stage-error" role="alert">{{ stageError }}</p>
  </div>
</template>

<style scoped>
.p7-workflow-preview {
  min-height: 100dvh;
  color: var(--ui-color-text-primary);
  background: var(--ui-color-background);
}

.p7-workflow-preview :deep(.home-view) {
  min-height: 100dvh;
}

.p7-stage-error {
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
</style>
