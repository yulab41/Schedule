<script setup lang="ts">
import type { NotificationRecord } from '@schedule/contracts';
import { onMounted, ref } from 'vue';

import { createApiClient } from '../../api/client.js';
import { toUserMessage } from '../../utils/user-message.js';
import { localAuth } from '../../auth/local-auth.js';
import { formatNotificationTime, getNotificationLabel } from './notification-logic.js';

const api = createApiClient({ auth: localAuth });
const emit = defineEmits<{
  (event: 'unread-changed', unreadCount: number): void;
}>();
const notifications = ref<NotificationRecord[]>([]);
const nextCursor = ref<string>();
const isLoading = ref(false);
const errorMessage = ref<string>();

onMounted(() => {
  void loadMore();
});

async function loadMore(): Promise<void> {
  if (isLoading.value) {
    return;
  }
  isLoading.value = true;
  errorMessage.value = undefined;
  try {
    const page = await api.listNotifications({
      ...(nextCursor.value === undefined ? {} : { cursor: nextCursor.value }),
      pageSize: 30,
    });
    notifications.value = [...notifications.value, ...page.notifications];
    nextCursor.value = page.nextCursor;
    emitUnreadChanged();
  } catch (error) {
    errorMessage.value = toUserMessage(error, '通知数据暂时无法加载，请稍后重试。');
  } finally {
    isLoading.value = false;
  }
}

async function markRead(notification: NotificationRecord): Promise<void> {
  if (notification.isRead) {
    return;
  }
  try {
    const updated = await api.markNotificationRead(notification.id);
    notifications.value = notifications.value.map((entry) =>
      entry.id === updated.id ? updated : entry,
    );
    emitUnreadChanged();
  } catch {
    // The unread badge refreshes on the next poll.
  }
}

async function markAllRead(): Promise<void> {
  try {
    await api.markAllNotificationsRead();
    notifications.value = notifications.value.map((entry) => ({ ...entry, isRead: true }));
    emitUnreadChanged();
  } catch {
    // The unread badge refreshes on the next poll.
  }
}

function emitUnreadChanged(): void {
  const unreadCount = notifications.value.filter((entry) => !entry.isRead).length;
  emit('unread-changed', unreadCount);
}
</script>

<template>
  <section class="notification-center">
    <div class="notification-center-actions">
      <t-button variant="outline" size="small" @click="markAllRead">全部已读</t-button>
    </div>
    <t-alert
      v-if="errorMessage !== undefined"
      theme="error"
      :message="errorMessage"
      class="notification-center-error"
    />
    <t-empty v-if="notifications.length === 0 && !isLoading" description="暂无通知" />
    <ul v-else class="notification-list">
      <li
        v-for="notification in notifications"
        :key="notification.id"
        :class="{ 'notification-item-unread': !notification.isRead }"
        class="notification-item"
        role="button"
        tabindex="0"
        @click="markRead(notification)"
        @keydown.enter="markRead(notification)"
      >
        <div class="notification-item-header">
          <t-tag :theme="notification.isRead ? 'default' : 'primary'" variant="light">
            {{ getNotificationLabel(notification.notificationType) }}
          </t-tag>
          <span class="notification-item-time">
            {{ formatNotificationTime(notification.createdAt, new Date()) }}
          </span>
        </div>
        <div class="notification-item-title">{{ notification.title }}</div>
        <div class="notification-item-body">{{ notification.body }}</div>
      </li>
    </ul>
    <div class="notification-center-more">
      <t-button
        v-if="nextCursor !== undefined"
        variant="text"
        :loading="isLoading"
        @click="loadMore"
      >
        加载更多
      </t-button>
    </div>
  </section>
</template>
