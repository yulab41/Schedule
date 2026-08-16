<script setup lang="ts">
import type { GroupMemberContact } from '@schedule/contracts';
import { ref, watch } from 'vue';

import { createApiClient } from '../../api/client.js';
import { toUserMessage } from '../../utils/user-message.js';
import { localAuth } from '../../auth/local-auth.js';

const props = defineProps<{
  readonly canConfirm: boolean;
  readonly contact: GroupMemberContact | undefined;
  readonly groupId: string;
  readonly membershipId: string;
}>();

const emit = defineEmits<{
  cancelled: [];
  saved: [];
}>();

const api = createApiClient({ auth: localAuth });
const mobilePhone = ref('');
const shortPhone = ref('');
const isConfirmed = ref(false);
const errorMessage = ref<string>();
const infoMessage = ref<string>();
const isSaving = ref(false);

watch(
  () => props.contact,
  (contact) => {
    mobilePhone.value = contact?.mobilePhone ?? '';
    shortPhone.value = contact?.shortPhone ?? '';
    isConfirmed.value = contact?.isConfirmed ?? false;
  },
  { immediate: true },
);

async function saveContact(): Promise<void> {
  errorMessage.value = undefined;
  infoMessage.value = undefined;
  isSaving.value = true;

  try {
    await api.updateGroupMemberContact(props.groupId, props.membershipId, {
      ...(props.canConfirm ? { isConfirmed: isConfirmed.value } : {}),
      mobilePhone: emptyToNull(mobilePhone.value),
      shortPhone: emptyToNull(shortPhone.value),
    });
    infoMessage.value = '联系方式已保存。';
    emit('saved');
  } catch (error) {
    errorMessage.value = toUserMessage(error, '联系方式暂时无法保存，请稍后重试。');
  } finally {
    isSaving.value = false;
  }
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}
</script>

<template>
  <form class="group-contact-form" @submit.prevent="saveContact">
    <p class="contact-editor-intro">修改后将立即更新成员列表中的联系方式。</p>
    <label class="contact-field">
      <span>长号</span>
      <input
        v-model="mobilePhone"
        type="tel"
        name="mobilePhone"
        maxlength="32"
        inputmode="tel"
        autocomplete="tel"
        placeholder="请输入手机或座机号码"
      />
    </label>
    <label class="contact-field">
      <span>短号</span>
      <input
        v-model="shortPhone"
        type="text"
        name="shortPhone"
        maxlength="32"
        inputmode="numeric"
        placeholder="选填"
      />
    </label>
    <label v-if="canConfirm" class="confirmation-row">
      <input v-model="isConfirmed" type="checkbox" />
      <span>
        <strong>确认联系方式</strong>
        <small>我已与该成员核对以上号码</small>
      </span>
    </label>
    <p v-if="errorMessage !== undefined" class="contact-feedback is-error" role="alert">
      {{ errorMessage }}
    </p>
    <p v-if="infoMessage !== undefined" class="contact-feedback is-success" role="status">
      {{ infoMessage }}
    </p>
    <div class="contact-editor-actions">
      <button type="button" class="contact-cancel-button" @click="emit('cancelled')">取消</button>
      <button type="submit" class="contact-save-button" :disabled="isSaving">
        {{ isSaving ? '保存中…' : '保存' }}
      </button>
    </div>
  </form>
</template>

<style scoped>
.group-contact-form {
  display: grid;
  gap: var(--ui-spacing-md);
}

.contact-editor-intro,
.contact-feedback {
  margin: 0;
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-sm);
  line-height: var(--ui-line-height-body);
}

.contact-field {
  display: grid;
  gap: 7px;
  color: var(--ui-color-text-primary);
  font-size: var(--ui-font-size-sm);
  font-weight: var(--ui-font-weight-semibold);
}

.contact-field input {
  box-sizing: border-box;
  width: 100%;
  min-height: 48px;
  padding: 0 13px;
  color: var(--ui-color-text-primary);
  background: #fbfcfe;
  border: 1px solid var(--ui-color-border-strong);
  border-radius: 12px;
  font: inherit;
  font-variant-numeric: tabular-nums;
}

.confirmation-row {
  display: flex;
  min-height: 56px;
  padding: 10px 12px;
  align-items: center;
  gap: 10px;
  background: var(--ui-color-primary-light);
  border-radius: 12px;
  cursor: pointer;
}

.confirmation-row > input {
  width: 20px;
  height: 20px;
  flex: none;
  accent-color: var(--ui-color-primary);
}

.confirmation-row > span {
  display: grid;
  gap: 2px;
}

.confirmation-row strong {
  color: var(--ui-color-text-primary);
  font-size: var(--ui-font-size-sm);
}

.confirmation-row small {
  color: var(--ui-color-text-muted);
  font-size: var(--ui-font-size-xs);
}

.contact-feedback {
  padding: 10px 12px;
  border-radius: 10px;
}

.contact-feedback.is-error {
  color: var(--ui-color-danger);
  background: var(--ui-color-danger-light);
}

.contact-feedback.is-success {
  color: var(--ui-color-success);
  background: var(--ui-color-success-light);
}

.contact-editor-actions {
  display: grid;
  grid-template-columns: 1fr 1.5fr;
  gap: 10px;
}

.contact-cancel-button,
.contact-save-button {
  min-height: 46px;
  padding: 0 14px;
  border-radius: 12px;
  cursor: pointer;
  font: inherit;
  font-size: var(--ui-font-size-sm);
  font-weight: var(--ui-font-weight-semibold);
}

.contact-cancel-button {
  color: var(--ui-color-text-secondary);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border-strong);
}

.contact-save-button {
  color: var(--ui-color-surface);
  background: var(--ui-color-primary);
  border: 1px solid var(--ui-color-primary);
}

.contact-save-button:disabled {
  cursor: wait;
  opacity: 0.65;
}

.contact-field input:focus-visible,
.confirmation-row > input:focus-visible,
.contact-cancel-button:focus-visible,
.contact-save-button:focus-visible {
  outline: 3px solid var(--ui-color-focus-ring);
  outline-offset: 2px;
}
</style>
