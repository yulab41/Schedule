<script setup lang="ts">
import type { GroupMobilePhoneConsent } from '@schedule/contracts';
import {
  createGroupMobilePhoneConsentDraft,
  createGroupMobilePhoneConsentViewModel,
  resolveGroupMobilePhoneConsentSubmission,
  setGroupMobilePhoneConsentDesired,
  type GroupMobilePhoneConsentDraft,
} from '@schedule/presentation-core';
import { computed, ref, watch } from 'vue';

import { ApiClientError, createApiClient } from '../../api/client.js';
import { localAuth } from '../../auth/local-auth.js';
import { useSessionStore } from '../../stores/session.js';
import { toUserMessage } from '../../utils/user-message.js';

const props = defineProps<{
  readonly groupId: string;
}>();

const api = createApiClient({ auth: localAuth });
const session = useSessionStore();
const status = ref<GroupMobilePhoneConsent>();
const draft = ref<GroupMobilePhoneConsentDraft>();
const errorMessage = ref<string>();
const infoMessage = ref<string>();
const isLoading = ref(false);
const isSaving = ref(false);
let requestSerial = 0;

const memberName = computed(() => session.profile?.realName ?? '当前成员');
const memberInitial = computed(() => memberName.value.slice(0, 1));
const viewModel = computed(() =>
  status.value === undefined || draft.value === undefined
    ? undefined
    : createGroupMobilePhoneConsentViewModel(status.value, draft.value),
);
const phoneLine = computed(() => {
  if (status.value?.state === 'missing-phone') return '尚未填写手机号';
  const maskedMobilePhone = viewModel.value?.maskedMobilePhone ?? '';
  return maskedMobilePhone === '' ? '手机号已填写' : `手机号 ${maskedMobilePhone}`;
});
const statusDetail = computed(() => {
  const current = status.value;
  if (current === undefined) return '';
  if (current.state === 'missing-phone')
    return `说明版本 ${current.noticeVersion} · 请先在成员通讯录填写手机号`;
  if (current.state === 'stale') {
    return `说明版本 ${current.noticeVersion} · 号码或说明已变化，需重新同意`;
  }
  if (current.state === 'consented' && current.consentedAt !== undefined) {
    return `说明版本 ${current.noticeVersion} · ${formatConsentTime(current.consentedAt)} 已同意`;
  }
  return `说明版本 ${current.noticeVersion} · 号码变更后需重新同意`;
});

watch(
  () => props.groupId,
  () => {
    requestSerial += 1;
    status.value = undefined;
    draft.value = undefined;
    errorMessage.value = undefined;
    infoMessage.value = undefined;
    isLoading.value = false;
    isSaving.value = false;
    void loadStatus();
  },
  { immediate: true },
);

async function loadStatus(): Promise<void> {
  const groupId = props.groupId;
  const currentRequest = ++requestSerial;
  errorMessage.value = undefined;
  infoMessage.value = undefined;
  isLoading.value = true;
  try {
    const result = await api.getGroupMobilePhoneConsent(groupId);
    if (currentRequest !== requestSerial || props.groupId !== groupId) return;
    if (result.groupId !== groupId) throw new Error('手机号公开设置返回了错误的群组。');
    applyStatus(result);
  } catch (error) {
    if (currentRequest !== requestSerial || props.groupId !== groupId) return;
    status.value = undefined;
    draft.value = undefined;
    errorMessage.value = toUserMessage(error, '手机号公开设置暂时无法加载，请稍后重试。');
  } finally {
    if (currentRequest === requestSerial && props.groupId === groupId) {
      isLoading.value = false;
    }
  }
}

function setDesiredConsent(event: Event): void {
  if (draft.value === undefined || isSaving.value) return;
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  draft.value = setGroupMobilePhoneConsentDesired(draft.value, target.checked);
  errorMessage.value = undefined;
  infoMessage.value = undefined;
}

async function saveConsent(): Promise<void> {
  const currentStatus = status.value;
  const currentDraft = draft.value;
  const currentViewModel = viewModel.value;
  if (
    currentStatus === undefined ||
    currentDraft === undefined ||
    currentViewModel?.canSave !== true ||
    isSaving.value
  ) {
    return;
  }

  const groupId = props.groupId;
  const saveRequestSerial = requestSerial;
  const submission = resolveGroupMobilePhoneConsentSubmission(currentStatus, currentDraft, () =>
    crypto.randomUUID(),
  );
  draft.value = submission.draft;
  errorMessage.value = undefined;
  infoMessage.value = undefined;
  isSaving.value = true;
  try {
    const result = await api.updateGroupMobilePhoneConsent(groupId, {
      ...submission.snapshot,
      noticeVersion: currentStatus.noticeVersion,
    });
    if (props.groupId !== groupId || requestSerial !== saveRequestSerial) return;
    if (result.groupId !== groupId) throw new Error('手机号公开设置返回了错误的群组。');
    applyStatus(result);
    infoMessage.value =
      result.state === 'consented' ? '手机号同意已保存。' : '手机号同意已撤回，完整号码已隐藏。';
  } catch (error) {
    if (props.groupId !== groupId || requestSerial !== saveRequestSerial) return;
    if (error instanceof ApiClientError && error.status === 409) {
      await loadStatus();
      if (props.groupId === groupId) {
        errorMessage.value = '手机号或说明状态已变化，请核对最新状态后重新操作。';
      }
      return;
    }
    errorMessage.value = toUserMessage(error, '手机号公开设置暂时无法保存，请稍后重试。');
    infoMessage.value = '未能确认本次设置结果；重试凭据已保留，可直接重试。';
  } finally {
    if (props.groupId === groupId) isSaving.value = false;
  }
}

function applyStatus(nextStatus: GroupMobilePhoneConsent): void {
  status.value = nextStatus;
  draft.value = createGroupMobilePhoneConsentDraft(nextStatus);
}

function formatConsentTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString('zh-CN', { hour12: false });
}
</script>

<template>
  <t-card title="联系方式公开" class="group-card contact-consent-card">
    <div v-if="isLoading" class="consent-state" aria-live="polite">正在读取手机号公开设置…</div>
    <div
      v-else-if="errorMessage !== undefined && status === undefined"
      class="consent-state is-error"
    >
      <span role="alert">{{ errorMessage }}</span>
      <button type="button" @click="loadStatus">重新加载</button>
    </div>
    <section
      v-else-if="status !== undefined && viewModel !== undefined"
      class="contact-consent-section"
    >
      <header>
        <div>
          <strong>我的手机号公开设置</strong>
          <span>仅决定当前群组成员能否查看您的完整手机号。</span>
        </div>
        <span class="preference-scope is-personal">仅自己</span>
      </header>

      <div class="contact-member-row">
        <div class="phone-avatar" aria-hidden="true">{{ memberInitial }}</div>
        <div>
          <strong>{{ memberName }}</strong>
          <span>{{ phoneLine }}</span>
          <small>{{ statusDetail }}</small>
        </div>
      </div>

      <label class="phone-consent-control">
        <input
          type="checkbox"
          role="switch"
          :checked="viewModel.desiredConsent"
          :disabled="isSaving || status.state === 'missing-phone'"
          @change="setDesiredConsent"
        />
        <span>
          <strong>允许本群组显示完整手机号</strong>
          <small>此选择可随时撤回，不影响账号、资料或排班。</small>
        </span>
      </label>

      <p v-if="viewModel.requiresRenewal" class="consent-renewal" role="status">
        号码或说明已变化，需重新同意；当前完整号码保持隐藏。
      </p>
      <p class="privacy-boundary">
        管理员不能代替成员授权，也不能把同意复制到其他群组；撤回后完整号码立即隐藏。
      </p>
      <p v-if="errorMessage !== undefined" class="consent-feedback is-error" role="alert">
        {{ errorMessage }}
      </p>
      <p v-if="infoMessage !== undefined" class="consent-feedback is-info" role="status">
        {{ infoMessage }}
      </p>
      <button
        type="button"
        class="consent-save"
        :class="{ 'is-revoke': viewModel.actionLabel === '撤回同意' }"
        :disabled="isSaving || !viewModel.canSave"
        @click="saveConsent"
      >
        {{ isSaving ? '保存中…' : viewModel.actionLabel }}
      </button>
    </section>
  </t-card>
</template>

<style scoped>
.contact-consent-card {
  min-width: 0;
  grid-column: 1 / -1;
  border-color: var(--ui-color-border);
  border-radius: var(--ui-radius-medium);
  box-shadow: var(--ui-shadow-card);
}

.contact-consent-card :deep(.t-card__header) {
  min-height: var(--ui-touch-target-comfortable);
  padding: var(--ui-spacing-sm) var(--ui-spacing-md);
  border-bottom: 1px solid var(--ui-color-border);
}

.contact-consent-card :deep(.t-card__body) {
  padding: var(--ui-spacing-sm);
}

.contact-consent-section {
  display: grid;
  padding: var(--ui-spacing-md);
  gap: var(--ui-spacing-sm);
  background: var(--ui-color-surface-muted);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-medium);
}

.contact-consent-section > header {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--ui-spacing-sm);
}

.contact-consent-section > header > div,
.phone-consent-control span,
.contact-member-row > div:last-child {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.contact-consent-section > header div > span,
.phone-consent-control small,
.contact-member-row span,
.contact-member-row small {
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-sm);
  line-height: var(--ui-line-height-body);
}

.preference-scope {
  padding: 3px 8px;
  flex: 0 0 auto;
  border-radius: var(--ui-radius-pill);
  font-size: var(--ui-font-size-xs);
  font-weight: var(--ui-font-weight-semibold);
}

.preference-scope.is-personal {
  color: var(--ui-color-text-primary);
  background: var(--ui-color-success-light);
}

.contact-member-row {
  display: grid;
  padding: var(--ui-spacing-sm);
  grid-template-columns: 48px minmax(0, 1fr);
  align-items: center;
  gap: var(--ui-spacing-sm);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-small);
}

.phone-avatar {
  display: grid;
  width: 48px;
  height: 48px;
  place-items: center;
  color: var(--ui-color-white);
  background: var(--ui-color-primary);
  border-radius: 50%;
  font-size: 19px;
  font-weight: var(--ui-font-weight-bold);
}

.phone-consent-control {
  display: flex;
  min-height: 58px;
  padding: 9px 11px;
  box-sizing: border-box;
  align-items: center;
  gap: 10px;
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-medium);
}

.phone-consent-control input {
  width: 22px;
  height: 22px;
  margin: 0;
  flex: none;
  accent-color: var(--ui-color-primary);
}

.privacy-boundary,
.consent-renewal,
.consent-feedback {
  margin: 0;
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-sm);
  line-height: var(--ui-line-height-body);
}

.consent-renewal,
.consent-feedback {
  padding: 9px 10px;
  border-radius: var(--ui-radius-small);
}

.consent-renewal {
  color: var(--ui-color-warning);
  background: var(--ui-color-warning-light);
}

.consent-feedback.is-error,
.consent-state.is-error {
  color: var(--ui-color-danger);
  background: var(--ui-color-danger-light);
}

.consent-feedback.is-info {
  color: var(--ui-color-primary-dark);
  background: var(--ui-color-primary-light);
}

.consent-save,
.consent-state button {
  min-height: var(--ui-touch-target-minimum);
  padding: 0 var(--ui-spacing-md);
  color: var(--ui-color-white);
  background: var(--ui-color-primary);
  border: 1px solid var(--ui-color-primary);
  border-radius: var(--ui-radius-small);
  cursor: pointer;
  font: inherit;
  font-size: var(--ui-font-size-sm);
  font-weight: var(--ui-font-weight-semibold);
}

.consent-save {
  width: 100%;
}

.consent-save.is-revoke {
  color: var(--ui-color-danger);
  background: var(--ui-color-surface);
  border-color: var(--ui-color-danger);
}

.consent-save:disabled {
  color: var(--ui-color-text-muted);
  background: var(--ui-color-surface-muted);
  border-color: var(--ui-color-border);
  cursor: not-allowed;
}

.consent-save:focus-visible,
.consent-state button:focus-visible,
.phone-consent-control input:focus-visible {
  outline: 3px solid var(--ui-color-focus-ring);
  outline-offset: 2px;
}

.consent-state {
  display: grid;
  min-height: 96px;
  padding: var(--ui-spacing-md);
  place-items: center;
  gap: var(--ui-spacing-sm);
  color: var(--ui-color-text-secondary);
  background: var(--ui-color-surface-muted);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-medium);
  font-size: var(--ui-font-size-sm);
  text-align: center;
}

@media (max-width: 760px) {
  .contact-consent-card {
    grid-column: auto;
  }

  .contact-consent-section {
    padding: var(--ui-spacing-sm);
  }
}
</style>
