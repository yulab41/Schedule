<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

import { createApiClient } from '../../api/client.js';
import { cloudbaseAuth } from '../../auth/cloudbase.js';
import { getGenericBrowserNotificationBody } from './notification-logic.js';
import NotificationCenterPanel from './NotificationCenterPanel.vue';

const api = createApiClient({ auth: cloudbaseAuth });
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
</script>

<template>
  <div class="notification-bell">
    <t-badge :count="unreadCount" :hidden="unreadCount === 0">
      <t-button aria-label="通知中心" variant="text" @click="isOpen = true">
        <span aria-hidden="true">铃铛</span>
      </t-button>
    </t-badge>
    <t-drawer v-model:visible="isOpen" size="420px" header="通知中心">
      <NotificationCenterPanel @unread-changed="onUnreadChanged" />
    </t-drawer>
  </div>
</template>
