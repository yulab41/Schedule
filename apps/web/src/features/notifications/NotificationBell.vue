<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

import { createApiClient } from '../../api/client.js';
import { localAuth } from '../../auth/local-auth.js';
import LucideMinimalActionIcon from '../../components/LucideMinimalActionIcon.vue';
import ResponsiveSheet from '../../components/ResponsiveSheet.vue';
import { getGenericBrowserNotificationBody } from './notification-logic.js';
import NotificationCenterPanel from './NotificationCenterPanel.vue';

const api = createApiClient({ auth: localAuth });
const bellMotionKey = ref(0);
const isOpen = ref(false);
const unreadCount = ref(0);
let timer: number | undefined;

onMounted(() => {
  void refresh();
  timer = window.setInterval(() => void refresh(), 60_000);
});

onBeforeUnmount(() => {
  if (timer !== undefined) {
    window.clearInterval(timer);
  }
});

async function refresh(): Promise<void> {
  try {
    const previousCount = unreadCount.value;
    const result = await api.getUnreadNotificationCount();
    unreadCount.value = result.unreadCount;
    if (result.unreadCount > previousCount && canShowBrowserNotifications()) {
      showGenericBrowserNotification();
    }
  } catch {
    // The in-app badge keeps its last known value and retries on the next poll.
  }
}

function canShowBrowserNotifications(): boolean {
  return 'Notification' in window && Notification.permission === 'granted';
}

function showGenericBrowserNotification(): void {
  try {
    new Notification('排班信息有更新', {
      body: getGenericBrowserNotificationBody(),
      tag: 'schedule-update',
    });
  } catch {
    // The in-app badge remains the reliable channel.
  }
}

function onUnreadChanged(count: number): void {
  unreadCount.value = count;
}

function openNotificationCenter(): void {
  bellMotionKey.value += 1;
  isOpen.value = true;
}
</script>

<template>
  <div class="notification-bell">
    <button
      type="button"
      class="notification-trigger"
      :aria-label="unreadCount > 0 ? `通知中心，${unreadCount}条未读` : '通知中心'"
      @click="openNotificationCenter"
    >
      <LucideMinimalActionIcon class="notification-icon" name="bell" :motion-key="bellMotionKey" />
      <span v-if="unreadCount > 0" class="notification-dot" aria-hidden="true" />
    </button>
    <ResponsiveSheet id="notification-center-sheet" v-model:visible="isOpen" title="通知中心">
      <NotificationCenterPanel @unread-changed="onUnreadChanged" />
    </ResponsiveSheet>
  </div>
</template>

<style scoped>
.notification-trigger {
  position: relative;
  display: grid;
  width: 44px;
  height: 44px;
  padding: 0;
  place-items: center;
  color: var(--ui-color-text-primary);
  background: var(--ui-color-background);
  border: 0;
  border-radius: 15px;
  cursor: pointer;
}

.notification-dot {
  position: absolute;
  top: 9px;
  right: 9px;
  width: 8px;
  height: 8px;
  background: var(--ui-color-danger);
  border: 2px solid var(--ui-color-surface);
  border-radius: 50%;
}
</style>
