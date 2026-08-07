<script setup lang="ts">
import type { GroupSummary } from '@schedule/contracts';
import { computed, onMounted, ref } from 'vue';

import { createApiClient } from '../../api/client.js';
import { toUserMessage } from '../../utils/user-message.js';
import { cloudbaseAuth } from '../../auth/cloudbase.js';
import { registerServiceWorker, subscribeToPush } from '../../register-service-worker.js';
import { formatReminderHours, parseReminderHoursInput } from './notification-logic.js';

const props = defineProps<{
  group: GroupSummary;
}>();

const api = createApiClient({ auth: cloudbaseAuth });
const canManageSettings = computed(() => props.group.role !== 'member');

const groupHoursInput = ref('');
const myHoursMode = ref<'custom' | 'default' | 'off'>('default');
const myHoursInput = ref('');
const browserNotificationsEnabled = ref(false);
const pushAvailable = ref(false);
const isLoading = ref(true);
const isSaving = ref(false);
const errorMessage = ref<string>();
const successMessage = ref<string>();
const browserStatusMessage = ref<string>();

onMounted(() => {
  void load();
});

async function load(): Promise<void> {
  isLoading.value = true;
  errorMessage.value = undefined;
  try {
    const [preferences, pushConfig, groupSettings] = await Promise.all([
      api.getMyNotificationPreferences(props.group.id),
      api.getPushConfiguration(),
      canManageSettings.value
        ? api.getGroupNotificationSettings(props.group.id)
        : Promise.resolve(undefined),
    ]);
    browserNotificationsEnabled.value = preferences.browserNotificationsEnabled;
    myHoursMode.value =
      preferences.dutyReminderHours === null
        ? 'default'
        : preferences.dutyReminderHours.length === 0
          ? 'off'
          : 'custom';
    myHoursInput.value = formatReminderHours(preferences.dutyReminderHours);
    pushAvailable.value = pushConfig.vapidPublicKey !== null;
    if (groupSettings !== undefined) {
      groupHoursInput.value = formatReminderHours(groupSettings.dutyReminderHours);
    }
  } catch (error) {
    errorMessage.value = toUserMessage(error, '通知设置暂时无法保存，请稍后重试。');
  } finally {
    isLoading.value = false;
  }
}

async function saveGroupSettings(): Promise<void> {
  try {
    const dutyReminderHours = parseReminderHoursInput(groupHoursInput.value);
    await api.updateGroupNotificationSettings(props.group.id, { dutyReminderHours });
    showSuccess('群组提醒时间已保存。');
  } catch (error) {
    errorMessage.value = toUserMessage(error, '通知设置暂时无法保存，请稍后重试。');
  }
}

async function saveMyPreferences(): Promise<void> {
  try {
    const dutyReminderHours =
      myHoursMode.value === 'default'
        ? null
        : myHoursMode.value === 'off'
          ? []
          : parseReminderHoursInput(myHoursInput.value);
    await api.updateMyNotificationPreferences(props.group.id, {
      browserNotificationsEnabled: browserNotificationsEnabled.value,
      dutyReminderHours,
    });
    showSuccess('个人提醒设置已保存。');
  } catch (error) {
    errorMessage.value = toUserMessage(error, '通知设置暂时无法保存，请稍后重试。');
  }
}

async function toggleBrowserNotifications(value: boolean): Promise<void> {
  browserStatusMessage.value = undefined;
  if (!value) {
    browserNotificationsEnabled.value = false;
    try {
      await api.deletePushSubscription();
    } catch {
      // Local state already reflects the disabled preference.
    }
    await saveMyPreferences();
    return;
  }

  if (!('Notification' in window)) {
    browserStatusMessage.value = '当前浏览器不支持通知。';
    return;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    browserStatusMessage.value = '浏览器通知权限被拒绝，您仍可在应用内收到通知。';
    browserNotificationsEnabled.value = false;
    return;
  }

  const pushConfig = await api.getPushConfiguration();
  const subscriptionSaved =
    pushConfig.vapidPublicKey === null
      ? true
      : await saveBrowserSubscription(pushConfig.vapidPublicKey);
  if (subscriptionSaved) {
    browserNotificationsEnabled.value = true;
    await saveMyPreferences();
    browserStatusMessage.value =
      pushConfig.vapidPublicKey === null
        ? '已开启，推送服务配置完成后将自动生效。'
        : '浏览器通知已开启。';
  } else {
    browserStatusMessage.value = '订阅浏览器推送失败，请稍后重试；应用内通知不受影响。';
    browserNotificationsEnabled.value = false;
  }
}

async function saveBrowserSubscription(vapidPublicKey: string): Promise<boolean> {
  try {
    const registration = await registerServiceWorker();
    if (registration === undefined) {
      return false;
    }
    const subscription = await subscribeToPush(registration, vapidPublicKey);
    if (subscription === undefined) {
      return false;
    }
    await api.savePushSubscription({
      endpoint: subscription.endpoint,
      keys: {
        auth: subscription.toJSON().keys?.auth ?? '',
        p256dh: subscription.toJSON().keys?.p256dh ?? '',
      },
    });
    return true;
  } catch {
    return false;
  }
}

function showSuccess(message: string): void {
  successMessage.value = message;
  errorMessage.value = undefined;
  window.setTimeout(() => {
    successMessage.value = undefined;
  }, 3000);
}
</script>

<template>
  <section class="notification-settings">
    <t-loading v-if="isLoading" text="正在加载通知设置" />
    <template v-else>
      <t-alert v-if="errorMessage !== undefined" theme="error" :message="errorMessage" />
      <t-alert v-if="successMessage !== undefined" theme="success" :message="successMessage" />
      <t-card v-if="canManageSettings" title="群组默认提醒时间" class="settings-card">
        <t-form-item label="值班提醒提前小时数" name="groupHours">
          <t-input v-model="groupHoursInput" placeholder="例如：24, 2" :disabled="isSaving" />
        </t-form-item>
        <t-form-item>
          <t-button theme="primary" :loading="isSaving" @click="saveGroupSettings">
            保存群组设置
          </t-button>
        </t-form-item>
      </t-card>
      <t-card title="我的提醒" class="settings-card">
        <t-form-item label="值班提醒时间" name="myHoursMode">
          <t-radio-group v-model="myHoursMode">
            <t-radio-button value="default">使用群组默认</t-radio-button>
            <t-radio-button value="custom">自定义</t-radio-button>
            <t-radio-button value="off">关闭值班提醒</t-radio-button>
          </t-radio-group>
        </t-form-item>
        <t-form-item v-if="myHoursMode === 'custom'" label="自定义提前小时数" name="myHours">
          <t-input v-model="myHoursInput" placeholder="例如：48, 12" :disabled="isSaving" />
        </t-form-item>
        <t-form-item>
          <t-button theme="primary" :loading="isSaving" @click="saveMyPreferences">
            保存我的设置
          </t-button>
        </t-form-item>
      </t-card>
      <t-card title="浏览器通知" class="settings-card">
        <t-form-item label="接收浏览器通知" name="browser">
          <t-switch
            :model-value="browserNotificationsEnabled"
            @change="toggleBrowserNotifications"
          />
        </t-form-item>
        <p class="settings-hint">浏览器权限只在您主动开启时申请。拒绝后站内通知仍可正常使用。</p>
        <t-alert
          v-if="browserStatusMessage !== undefined"
          theme="info"
          :message="browserStatusMessage"
        />
        <t-alert
          v-if="!pushAvailable"
          theme="warning"
          message="推送服务尚未配置，当前仅提供应用内提醒。"
          class="settings-hint"
        />
      </t-card>
    </template>
  </section>
</template>
