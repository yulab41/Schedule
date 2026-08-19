<script setup lang="ts">
import type { GroupSummary, UserProfile } from '@schedule/contracts';
import {
  CalendarIcon,
  LogoutIcon,
  NotificationIcon,
  SwapIcon,
  TaskTimeIcon,
} from 'tdesign-icons-vue-next';
import { computed } from 'vue';

import { useSessionStore } from '../../stores/session.js';
import type { WorkbenchTabId } from '../../features/layout/workbench-nav.js';

const props = defineProps<{
  readonly group: GroupSummary;
  readonly profile?: UserProfile;
}>();

const emit = defineEmits<{
  (event: 'navigate', tabId: WorkbenchTabId): void;
  (event: 'sign-out'): void;
}>();

const session = useSessionStore();
const profileName = computed(
  () => props.profile?.realName ?? session.profile?.realName ?? '未完善资料',
);
const profileInitial = computed(() => profileName.value.slice(0, 1));
const roleLabel = computed(() => {
  if (props.group.isDeveloperAdmin) return '平台管理员';
  if (props.group.role === 'owner') return '群主';
  if (props.group.role === 'administrator') return '管理员';
  if (props.group.role === 'guest') return '访客';
  return '成员';
});

function navigate(tabId: WorkbenchTabId): void {
  emit('navigate', tabId);
}
</script>

<template>
  <main class="my-profile-view" aria-labelledby="my-profile-title">
    <header class="profile-heading">
      <div>
        <p class="profile-eyebrow">个人中心</p>
        <h2 id="my-profile-title">我的</h2>
        <p class="profile-heading-copy">账户、群组与常用工作入口</p>
      </div>
      <div class="profile-heading-avatar" aria-hidden="true">{{ profileInitial }}</div>
    </header>

    <section class="profile-identity-card" aria-labelledby="profile-identity-title">
      <div class="profile-avatar" aria-hidden="true">{{ profileInitial }}</div>
      <div class="profile-identity-copy">
        <div class="profile-name-row">
          <h3 id="profile-identity-title">{{ profileName }}</h3>
          <span class="profile-verified"><span aria-hidden="true">✓</span> 已验证</span>
        </div>
        <p>{{ roleLabel }} <span aria-hidden="true">·</span> {{ props.group.name }}</p>
        <small>当前登录状态正常</small>
      </div>
      <span class="profile-status"><i aria-hidden="true" />正常</span>
    </section>

    <div class="profile-grid">
      <section
        v-if="props.group.role !== 'guest'"
        class="profile-card"
        aria-labelledby="profile-shortcuts-title"
      >
        <div class="profile-card-heading">
          <div>
            <p class="profile-eyebrow">快速进入</p>
            <h3 id="profile-shortcuts-title">工作入口</h3>
          </div>
        </div>
        <div class="profile-shortcuts">
          <button type="button" class="profile-shortcut" @click="navigate('calendar')">
            <CalendarIcon aria-hidden="true" />
            <span><strong>排班日历</strong><small>查看我的排班</small></span>
            <b aria-hidden="true">›</b>
          </button>
          <button type="button" class="profile-shortcut" @click="navigate('leave')">
            <TaskTimeIcon aria-hidden="true" />
            <span><strong>请假与审批</strong><small>管理我的申请</small></span>
            <b aria-hidden="true">›</b>
          </button>
          <button type="button" class="profile-shortcut" @click="navigate('swap')">
            <SwapIcon aria-hidden="true" />
            <span><strong>换班</strong><small>查看我的申请</small></span>
            <b aria-hidden="true">›</b>
          </button>
          <button type="button" class="profile-shortcut" @click="navigate('notifications')">
            <NotificationIcon aria-hidden="true" />
            <span><strong>通知设置</strong><small>管理个人提醒</small></span>
            <b aria-hidden="true">›</b>
          </button>
        </div>
      </section>

      <section class="profile-card" aria-labelledby="profile-account-title">
        <div class="profile-card-heading">
          <div>
            <p class="profile-eyebrow">账号与群组</p>
            <h3 id="profile-account-title">账户信息</h3>
          </div>
          <span class="profile-private-note">仅自己可见</span>
        </div>
        <dl class="profile-details">
          <div>
            <dt>姓名</dt>
            <dd>{{ profileName }}</dd>
          </div>
          <div>
            <dt>当前群组</dt>
            <dd>{{ props.group.name }}</dd>
          </div>
          <div>
            <dt>群组身份</dt>
            <dd>{{ roleLabel }}</dd>
          </div>
          <div>
            <dt>登录状态</dt>
            <dd class="profile-detail-status"><i aria-hidden="true" />已验证</dd>
          </div>
        </dl>
      </section>
    </div>

    <div class="profile-actions">
      <button type="button" class="profile-sign-out" @click="emit('sign-out')">
        <LogoutIcon aria-hidden="true" />
        退出登录
      </button>
      <p>登录状态只保存在当前设备，退出后需要重新验证。</p>
    </div>
  </main>
</template>

<style scoped>
.my-profile-view {
  display: grid;
  min-width: 0;
  gap: var(--ui-spacing-lg);
  color: var(--ui-color-text-primary);
}

.profile-heading,
.profile-identity-card,
.profile-card-heading,
.profile-name-row,
.profile-status,
.profile-shortcut,
.profile-actions {
  display: flex;
  align-items: center;
}

.profile-heading {
  justify-content: space-between;
  gap: var(--ui-spacing-md);
}

.profile-eyebrow {
  margin: 0 0 4px;
  color: var(--ui-color-primary);
  font-size: var(--ui-font-size-xs);
  font-weight: var(--ui-font-weight-bold);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.profile-heading h2,
.profile-card h3,
.profile-identity-copy h3 {
  margin: 0;
  color: var(--ui-color-text-primary);
  font-weight: var(--ui-font-weight-semibold);
  letter-spacing: -0.02em;
}

.profile-heading h2 {
  font-size: clamp(28px, 4vw, 36px);
  line-height: 1.1;
}

.profile-heading-copy {
  margin: 7px 0 0;
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-sm);
}

.profile-heading-avatar,
.profile-avatar {
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  color: var(--ui-color-white);
  background: linear-gradient(145deg, #2d88e4, #0a66d5);
  font-weight: var(--ui-font-weight-bold);
}

.profile-heading-avatar {
  width: 46px;
  height: 46px;
  border: 4px solid var(--ui-color-primary-light);
  border-radius: 50%;
  box-shadow: 0 6px 18px rgb(10 102 213 / 18%);
}

.profile-identity-card,
.profile-card {
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-large);
  box-shadow: var(--ui-shadow-card);
}

.profile-identity-card {
  padding: clamp(18px, 3vw, 26px);
  gap: 14px;
}

.profile-avatar {
  width: 58px;
  height: 58px;
  border-radius: 18px;
  font-size: 24px;
}

.profile-identity-copy {
  min-width: 0;
  flex: 1;
}

.profile-name-row {
  flex-wrap: wrap;
  gap: 8px;
}

.profile-identity-copy h3 {
  font-size: 20px;
}

.profile-identity-copy p,
.profile-identity-copy small {
  display: block;
  margin: 4px 0 0;
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-sm);
}

.profile-identity-copy small {
  color: var(--ui-color-text-muted);
  font-size: var(--ui-font-size-xs);
}

.profile-verified,
.profile-status,
.profile-private-note {
  color: var(--ui-color-primary);
  font-size: var(--ui-font-size-xs);
  font-weight: var(--ui-font-weight-semibold);
}

.profile-verified {
  padding: 4px 8px;
  background: var(--ui-color-primary-light);
  border-radius: 999px;
}

.profile-status {
  flex: 0 0 auto;
  align-self: flex-start;
  gap: 5px;
}

.profile-status i,
.profile-detail-status i {
  display: inline-block;
  width: 7px;
  height: 7px;
  background: #2a9d68;
  border-radius: 50%;
}

.profile-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(280px, 0.85fr);
  gap: var(--ui-spacing-lg);
}

.profile-card {
  min-width: 0;
  padding: 20px;
}

.profile-card-heading {
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.profile-card h3 {
  font-size: 18px;
}

.profile-private-note {
  color: var(--ui-color-text-muted);
  font-weight: var(--ui-font-weight-regular);
}

.profile-shortcuts {
  display: grid;
  gap: 2px;
}

.profile-shortcut {
  width: 100%;
  min-height: 56px;
  padding: 8px 4px;
  gap: 12px;
  color: var(--ui-color-text-primary);
  background: transparent;
  border: 0;
  border-bottom: 1px solid var(--ui-color-border);
  cursor: pointer;
  font: inherit;
  text-align: left;
  transition: background var(--ui-duration-fast) ease;
}

.profile-shortcut:last-child {
  border-bottom: 0;
}

.profile-shortcut:hover,
.profile-shortcut:focus-visible {
  background: var(--ui-color-primary-light);
}

.profile-shortcut:focus-visible,
.profile-sign-out:focus-visible {
  outline: 3px solid var(--ui-color-primary-light);
  outline-offset: 2px;
}

.profile-shortcut > svg {
  width: 22px;
  height: 22px;
  padding: 6px;
  box-sizing: content-box;
  color: var(--ui-color-primary);
  background: var(--ui-color-primary-light);
  border-radius: 10px;
}

.profile-shortcut > span {
  min-width: 0;
  flex: 1;
}

.profile-shortcut strong,
.profile-shortcut small {
  display: block;
}

.profile-shortcut strong {
  font-size: var(--ui-font-size-sm);
}

.profile-shortcut small {
  margin-top: 3px;
  overflow: hidden;
  color: var(--ui-color-text-muted);
  font-size: var(--ui-font-size-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-shortcut b {
  color: var(--ui-color-text-muted);
  font-size: 24px;
  font-weight: var(--ui-font-weight-regular);
}

.profile-details {
  display: grid;
  margin: 0;
  gap: 0;
}

.profile-details > div {
  display: flex;
  min-height: 48px;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  border-bottom: 1px solid var(--ui-color-border);
}

.profile-details > div:last-child {
  border-bottom: 0;
}

.profile-details dt {
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-sm);
}

.profile-details dd {
  margin: 0;
  color: var(--ui-color-text-primary);
  font-size: var(--ui-font-size-sm);
  font-weight: var(--ui-font-weight-semibold);
  text-align: right;
}

.profile-detail-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #2a9d68 !important;
}

.profile-actions {
  flex-direction: column;
  gap: 8px;
}

.profile-sign-out {
  display: inline-flex;
  min-height: var(--ui-touch-target-minimum);
  padding: 0 18px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--ui-color-danger);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-medium);
  cursor: pointer;
  font: inherit;
  font-weight: var(--ui-font-weight-semibold);
}

.profile-sign-out svg {
  width: 18px;
  height: 18px;
}

.profile-actions p {
  margin: 0;
  color: var(--ui-color-text-muted);
  font-size: var(--ui-font-size-xs);
  text-align: center;
}

@media (max-width: 760px) {
  .profile-grid {
    grid-template-columns: 1fr;
    gap: var(--ui-spacing-md);
  }

  .profile-card {
    padding: 16px;
  }
}

@media (max-width: 420px) {
  .profile-identity-card {
    align-items: flex-start;
  }

  .profile-status {
    font-size: 0;
  }

  .profile-status i {
    width: 9px;
    height: 9px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .profile-shortcut {
    transition: none;
  }
}
</style>
