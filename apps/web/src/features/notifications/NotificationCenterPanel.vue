<script setup lang="ts">
import type { NotificationRecord } from '@schedule/contracts';
import { computed, onMounted, ref } from 'vue';

import { createApiClient } from '../../api/client.js';
import { toUserMessage } from '../../utils/user-message.js';
import { localAuth } from '../../auth/local-auth.js';
import {
  formatNotificationTime,
  getNotificationLabel,
  getNotificationTone,
} from './notification-logic.js';

const api = createApiClient({ auth: localAuth });
const emit = defineEmits<{
  (event: 'unread-changed', unreadCount: number): void;
}>();
const notifications = ref<NotificationRecord[]>([]);
const nextCursor = ref<string>();
const isLoading = ref(false);
const errorMessage = ref<string>();
const unreadCount = computed(() => notifications.value.filter((entry) => !entry.isRead).length);

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
    <header class="notification-center-heading">
      <div>
        <strong>{{ unreadCount }} 条未读</strong>
        <span>点按一条通知即可标记为已读</span>
      </div>
      <t-button variant="outline" size="small" @click="markAllRead">全部已读</t-button>
    </header>
    <t-alert
      v-if="errorMessage !== undefined"
      theme="error"
      :message="errorMessage"
      class="notification-center-error"
    />
    <t-loading v-if="isLoading && notifications.length === 0" text="正在加载通知" />
    <t-empty v-if="notifications.length === 0 && !isLoading" description="暂无通知" />
    <ul v-else class="notification-list">
      <li v-for="notification in notifications" :key="notification.id">
        <button
          type="button"
          :class="{ 'notification-item-unread': !notification.isRead }"
          class="notification-item"
          :aria-label="`${notification.isRead ? '已读' : '未读'}：${notification.title}`"
          @click="markRead(notification)"
        >
          <span class="notification-item-header">
            <t-tag :theme="getNotificationTone(notification.notificationType)" variant="light">
              {{ getNotificationLabel(notification.notificationType) }}
            </t-tag>
            <span class="notification-item-time">
              {{ formatNotificationTime(notification.createdAt, new Date()) }}
            </span>
          </span>
          <strong class="notification-item-title">{{ notification.title }}</strong>
          <span class="notification-item-body">{{ notification.body }}</span>
        </button>
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

<style scoped>
.notification-center {
  display: grid;
  min-width: 0;
  gap: var(--ui-spacing-sm);
}

.notification-center-heading {
  display: flex;
  min-height: var(--ui-touch-target-minimum);
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-spacing-sm);
}

.notification-center-heading > div {
  display: grid;
  gap: 2px;
}

.notification-center-heading strong {
  color: var(--ui-color-text-primary);
  font-size: var(--ui-font-size-md);
  font-weight: var(--ui-font-weight-semibold);
}

.notification-center-heading span {
  color: var(--ui-color-text-muted);
  font-size: var(--ui-font-size-sm);
}

.notification-center-heading :deep(.t-button),
.notification-center-more :deep(.t-button) {
  min-height: var(--ui-touch-target-minimum);
}

.notification-list {
  display: grid;
  gap: var(--ui-spacing-xs);
  margin: 0;
  padding: 0;
  list-style: none;
}

.notification-item {
  position: relative;
  display: grid;
  width: 100%;
  min-height: var(--ui-touch-target-comfortable);
  gap: var(--ui-spacing-xs);
  padding: var(--ui-spacing-sm);
  overflow: hidden;
  color: var(--ui-color-text-primary);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-medium);
  cursor: pointer;
  font: inherit;
  text-align: left;
  transition:
    background var(--ui-duration-fast) ease,
    transform var(--ui-duration-fast) ease;
}

.notification-item::before {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 3px;
  background: transparent;
  content: '';
}

.notification-item-unread {
  background: var(--ui-color-primary-light);
  border-color: var(--ui-color-primary-border);
}

.notification-item-unread::before {
  background: var(--ui-color-primary);
}

.notification-item:active {
  transform: scale(0.985);
}

.notification-item:focus-visible {
  outline: 3px solid var(--ui-color-focus-ring);
  outline-offset: 2px;
}

.notification-item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-spacing-xs);
}

.notification-item-time {
  color: var(--ui-color-text-muted);
  font-size: var(--ui-font-size-xs);
}

.notification-item-title {
  color: var(--ui-color-text-primary);
  font-size: var(--ui-font-size-md);
  font-weight: var(--ui-font-weight-semibold);
  line-height: var(--ui-line-height-tight);
}

.notification-item-body {
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-sm);
  line-height: var(--ui-line-height-body);
  overflow-wrap: anywhere;
}

.notification-center-more {
  display: flex;
  justify-content: center;
}

@media (max-width: 640px) {
  .notification-center-heading {
    align-items: flex-start;
  }

  .notification-item {
    padding: var(--ui-spacing-sm) var(--ui-spacing-md);
  }
}

@media (prefers-reduced-motion: reduce) {
  .notification-item {
    transition: none;
  }
}
</style>
