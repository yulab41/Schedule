<script setup lang="ts">
import type { GroupSummary } from '@schedule/contracts';
import { computed, onMounted, ref } from 'vue';

import { createApiClient } from '../../api/client.js';
import { toUserMessage } from '../../utils/user-message.js';
import { localAuth } from '../../auth/local-auth.js';
import {
  getPushSubscription,
  registerServiceWorker,
  resubscribeToPush,
  subscribeToPush,
} from '../../register-service-worker.js';
import { formatReminderHours, parseReminderHoursInput } from './notification-logic.js';

const props = defineProps<{
  group: GroupSummary;
}>();

const api = createApiClient({ auth: localAuth });
const canManageSettings = computed(() => props.group.role !== 'member');

const groupHoursInput = ref('');
const myHoursMode = ref<'custom' | 'default' | 'off'>('default');
const myHoursInput = ref('');
const browserNotificationsEnabled = ref(false);
const pushAvailable = ref(false);
const needsPushRegistration = ref(false);
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
    needsPushRegistration.value =
      pushConfig.vapidPublicKey !== null &&
      preferences.browserNotificationsEnabled &&
      !(await hasBrowserPushSubscription());
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
    needsPushRegistration.value = false;
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
      : await saveBrowserSubscription(pushConfig.vapidPublicKey, false);
  if (subscriptionSaved) {
    browserNotificationsEnabled.value = true;
    needsPushRegistration.value = false;
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

async function registerBrowserNotificationsAgain(): Promise<void> {
  browserStatusMessage.value = undefined;
  if (!pushAvailable.value) {
    browserStatusMessage.value = '推送服务尚未配置，暂时无法注册浏览器通知。';
    return;
  }
  if (!('Notification' in window)) {
    browserStatusMessage.value = '当前浏览器不支持通知。';
    return;
  }

  const permission =
    Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (permission !== 'granted') {
    browserStatusMessage.value = '浏览器通知权限被拒绝，您仍可在应用内收到通知。';
    return;
  }

  const pushConfig = await api.getPushConfiguration();
  const subscriptionSaved =
    pushConfig.vapidPublicKey !== null &&
    (await saveBrowserSubscription(pushConfig.vapidPublicKey, true));
  if (!subscriptionSaved) {
    browserStatusMessage.value = '重新注册浏览器推送失败，请稍后重试。';
    return;
  }

  needsPushRegistration.value = false;
  browserNotificationsEnabled.value = true;
  await saveMyPreferences();
  browserStatusMessage.value = '浏览器通知已重新注册。';
}

async function hasBrowserPushSubscription(): Promise<boolean> {
  const registration = await registerServiceWorker();
  if (registration === undefined) {
    return false;
  }
  return (await getPushSubscription(registration)) !== undefined;
}

async function saveBrowserSubscription(
  vapidPublicKey: string,
  forceResubscribe: boolean,
): Promise<boolean> {
  try {
    const registration = await registerServiceWorker();
    if (registration === undefined) {
      return false;
    }
    const subscription = forceResubscribe
      ? await resubscribeToPush(registration, vapidPublicKey)
      : await subscribeToPush(registration, vapidPublicKey);
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
    <header class="notification-settings-heading">
      <div>
        <p>提醒节奏</p>
        <h2>通知设置</h2>
      </div>
      <span>站内通知始终可用；浏览器权限只在主动开启时申请。</span>
    </header>
    <t-loading v-if="isLoading" text="正在加载通知设置" />
    <template v-else>
      <t-alert v-if="errorMessage !== undefined" theme="error" :message="errorMessage" />
      <t-alert v-if="successMessage !== undefined" theme="success" :message="successMessage" />
      <t-card v-if="canManageSettings" title="群组默认提醒时间" class="settings-card">
        <t-form-item label="值班提醒提前小时数" name="groupHours">
          <t-input v-model="groupHoursInput" placeholder="例如：24, 2" :disabled="isSaving" />
        </t-form-item>
        <p class="settings-hint">最多设置 5 个时间，使用逗号分隔。</p>
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
        <div class="browser-notification-row">
          <div class="browser-notification-copy">
            <div class="browser-notification-title">
              <strong>接收浏览器通知</strong>
              <span :class="{ 'is-enabled': browserNotificationsEnabled }">
                {{ browserNotificationsEnabled ? '已开启' : '已关闭' }}
              </span>
            </div>
            <p>即使没有打开排班系统，也能在当前设备及时收到提醒。</p>
            <small>浏览器权限只在您主动开启时申请；拒绝后站内通知仍可正常使用。</small>
          </div>
          <button
            type="button"
            class="browser-switch-hit-area"
            role="switch"
            :aria-checked="browserNotificationsEnabled"
            :aria-label="browserNotificationsEnabled ? '关闭浏览器通知' : '开启浏览器通知'"
            @click="toggleBrowserNotifications(!browserNotificationsEnabled)"
          >
            <span
              class="browser-notification-switch"
              :class="{ 'is-active': browserNotificationsEnabled }"
              aria-hidden="true"
            >
              <span class="browser-switch-thumb" />
            </span>
          </button>
        </div>
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
        <t-alert
          v-else-if="needsPushRegistration"
          theme="warning"
          message="浏览器通知偏好已开启，但当前设备尚未完成推送注册。"
          class="settings-hint"
        />
        <t-button
          v-if="pushAvailable && needsPushRegistration"
          theme="default"
          class="settings-hint"
          @click="registerBrowserNotificationsAgain"
        >
          重新注册浏览器通知
        </t-button>
      </t-card>
    </template>
  </section>
</template>

<style scoped>
.notification-settings {
  display: grid;
  min-width: 0;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--ui-spacing-md);
}

.notification-settings-heading,
.notification-settings > :deep(.t-loading),
.notification-settings > :deep(.t-alert) {
  grid-column: 1 / -1;
}

.notification-settings-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: var(--ui-spacing-md);
}

.notification-settings-heading p,
.notification-settings-heading h2 {
  margin: 0;
}

.notification-settings-heading p {
  color: var(--ui-color-primary);
  font-size: var(--ui-font-size-sm);
  font-weight: var(--ui-font-weight-semibold);
}

.notification-settings-heading h2 {
  margin-top: var(--ui-spacing-xxs);
  color: var(--ui-color-text-primary);
  font-size: var(--ui-font-size-xl);
  font-weight: var(--ui-font-weight-semibold);
  line-height: var(--ui-line-height-tight);
}

.notification-settings-heading > span {
  max-width: 420px;
  color: var(--ui-color-text-muted);
  font-size: var(--ui-font-size-sm);
  text-align: right;
}

.settings-card {
  min-width: 0;
  border-color: var(--ui-color-border);
  border-radius: var(--ui-radius-medium);
  box-shadow: var(--ui-shadow-card);
}

.settings-card:last-child {
  grid-column: 1 / -1;
}

.settings-card :deep(.t-card__header) {
  min-height: var(--ui-touch-target-comfortable);
  padding: var(--ui-spacing-sm) var(--ui-spacing-md);
  border-bottom: 1px solid var(--ui-color-border);
}

.settings-card :deep(.t-card__title) {
  color: var(--ui-color-text-primary);
  font-size: var(--ui-font-size-md);
  font-weight: var(--ui-font-weight-semibold);
}

.settings-card :deep(.t-card__body) {
  padding: var(--ui-spacing-md);
}

.settings-card :deep(.t-input),
.settings-card :deep(.t-input__wrap),
.settings-card :deep(.t-button),
.settings-card :deep(.t-radio-button) {
  min-height: var(--ui-touch-target-minimum);
}

.settings-card :deep(.t-form__item) {
  margin-bottom: var(--ui-spacing-sm);
}

.settings-card :deep(.t-form__item:last-child) {
  margin-bottom: 0;
}

.settings-card :deep(.t-radio-group) {
  display: flex;
  flex-wrap: wrap;
}

.settings-hint {
  margin: 0 0 var(--ui-spacing-sm);
  color: var(--ui-color-text-muted);
  font-size: var(--ui-font-size-sm);
  line-height: var(--ui-line-height-body);
}

.browser-notification-row {
  display: flex;
  min-height: 88px;
  margin-bottom: var(--ui-spacing-sm);
  padding: var(--ui-spacing-md);
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-spacing-lg);
  background: var(--ui-color-surface-muted);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-medium);
}

.browser-notification-copy,
.browser-notification-title {
  min-width: 0;
}

.browser-notification-title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--ui-spacing-xs);
}

.browser-notification-title strong {
  color: var(--ui-color-text-primary);
  font-size: var(--ui-font-size-md);
  font-weight: var(--ui-font-weight-semibold);
}

.browser-notification-title span {
  padding: 3px 8px;
  color: var(--ui-color-text-secondary);
  background: var(--ui-color-surface);
  border-radius: var(--ui-radius-pill);
  font-size: var(--ui-font-size-xs);
  font-weight: var(--ui-font-weight-semibold);
}

.browser-notification-title span.is-enabled {
  color: var(--ui-color-success);
  background: var(--ui-color-success-light);
}

.browser-notification-copy p,
.browser-notification-copy small {
  display: block;
  margin: var(--ui-spacing-xxs) 0 0;
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-sm);
  line-height: var(--ui-line-height-body);
}

.browser-notification-copy small {
  color: var(--ui-color-text-muted);
  font-size: var(--ui-font-size-xs);
}

.browser-switch-hit-area {
  display: grid;
  box-sizing: border-box;
  min-width: 60px;
  min-height: 44px;
  padding: 0;
  flex: none;
  place-items: center;
  color: inherit;
  background: transparent;
  border: 0;
  border-radius: var(--ui-radius-pill);
  cursor: pointer;
}

.browser-switch-hit-area:focus-visible {
  outline: 3px solid var(--ui-color-focus-ring);
  outline-offset: 1px;
}

.browser-notification-switch {
  display: block;
  position: relative;
  box-sizing: border-box;
  width: 52px;
  min-width: 52px;
  height: 30px;
  min-height: 30px;
  background: #c9ced6;
  border-radius: var(--ui-radius-pill);
  box-shadow: inset 0 0 0 1px rgb(22 32 42 / 5%);
  transition:
    background 160ms ease,
    box-shadow 160ms ease;
}

.browser-switch-thumb {
  display: block;
  position: absolute;
  width: 24px;
  height: 24px;
  top: 3px;
  left: 3px;
  background: var(--ui-color-surface);
  border-radius: 50%;
  box-shadow: 0 2px 7px rgb(22 32 42 / 22%);
  transition: transform 160ms ease;
}

.browser-notification-switch.is-active {
  background: var(--ui-color-primary);
  box-shadow: inset 0 0 0 1px rgb(5 68 145 / 8%);
}

.browser-notification-switch.is-active .browser-switch-thumb {
  transform: translateX(22px);
}

@media (max-width: 760px) {
  .notification-settings {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--ui-spacing-sm);
  }

  .notification-settings-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .notification-settings-heading > span {
    text-align: left;
  }

  .notification-settings-heading,
  .notification-settings > :deep(.t-loading),
  .notification-settings > :deep(.t-alert),
  .settings-card:last-child {
    grid-column: auto;
  }

  .settings-card :deep(.t-card__body) {
    padding: var(--ui-spacing-sm);
  }

  .settings-card :deep(.t-radio-group) {
    display: grid;
    width: 100%;
    grid-template-columns: minmax(0, 1fr);
  }

  .settings-card :deep(.t-radio-button) {
    width: 100%;
    justify-content: center;
  }

  .browser-notification-row {
    min-height: 124px;
    padding: var(--ui-spacing-sm);
    align-items: flex-start;
    gap: var(--ui-spacing-sm);
  }

  .browser-switch-hit-area {
    margin-top: -5px;
  }

  .settings-card :deep(.t-button) {
    width: 100%;
  }
}
</style>
