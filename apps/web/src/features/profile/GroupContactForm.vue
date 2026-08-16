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
    <t-form-item label="长号" name="mobilePhone">
      <t-input v-model="mobilePhone" maxlength="32" inputmode="tel" />
    </t-form-item>
    <t-form-item label="短号" name="shortPhone">
      <t-input v-model="shortPhone" maxlength="32" inputmode="tel" />
    </t-form-item>
    <t-checkbox v-if="canConfirm" v-model="isConfirmed">确认联系方式</t-checkbox>
    <t-alert v-if="errorMessage !== undefined" theme="error" :message="errorMessage" />
    <t-alert v-if="infoMessage !== undefined" theme="success" :message="infoMessage" />
    <t-button theme="primary" type="submit" :loading="isSaving"> 保存联系方式 </t-button>
  </form>
</template>

<style scoped>
.group-contact-form {
  display: grid;
  gap: var(--ui-spacing-sm);
}

.group-contact-form :deep(.t-input),
.group-contact-form :deep(.t-button) {
  min-height: 44px;
}

.group-contact-form :deep(.t-input__inner) {
  min-height: 42px;
}

.group-contact-form :deep(.t-checkbox) {
  min-height: 44px;
}
</style>
