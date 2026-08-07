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
const errorMessage = ref<string>();
const infoMessage = ref<string>();
const isSaving = ref(false);

watch(
  () => props.contact,
  (contact) => {
    mobilePhone.value = contact?.mobilePhone ?? '';
    shortPhone.value = contact?.shortPhone ?? '';
  },
  { immediate: true },
);

async function saveContact(): Promise<void> {
  errorMessage.value = undefined;
  infoMessage.value = undefined;
  isSaving.value = true;

  try {
    await api.updateGroupMemberContact(props.groupId, props.membershipId, {
      ...(props.canConfirm ? { confirm: true as const } : {}),
      mobilePhone: emptyToNull(mobilePhone.value),
      shortPhone: emptyToNull(shortPhone.value),
    });
    infoMessage.value = props.canConfirm
      ? '联系方式已保存并确认。'
      : '联系方式已保存，等待成员确认。';
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
    <t-alert v-if="errorMessage !== undefined" theme="error" :message="errorMessage" />
    <t-alert v-if="infoMessage !== undefined" theme="success" :message="infoMessage" />
    <t-button theme="primary" type="submit" :loading="isSaving">
      {{ canConfirm ? '保存并确认' : '预填联系方式' }}
    </t-button>
  </form>
</template>
