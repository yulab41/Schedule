<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { createApiClient } from '../../api/client.js';
import { localAuth } from '../../auth/local-auth.js';
import { toUserMessage } from '../../utils/user-message.js';
import CalendarView from '../calendar/CalendarView.vue';
import AppStatePanel from '../../components/AppStatePanel.vue';
import { getAppStatePresentation } from '../../pwa/app-state.js';
const missingGuestLinkState = getAppStatePresentation('guest-link-missing');
const invalidGuestLinkState = getAppStatePresentation('guest-link-invalid');
const route = useRoute();
const router = useRouter();
const api = createApiClient({ auth: localAuth });
const visitorKey = computed(() => (typeof route.query.vkey === 'string' ? route.query.vkey : ''));
const group = ref<{ groupId: string; groupName: string }>();
const error = ref('');
let serial = 0;
async function load() {
  const request = ++serial;
  const key = visitorKey.value;
  group.value = undefined;
  error.value = '';
  if (!/^[0-9a-f]{32}$/i.test(key)) {
    error.value = '访客链接无效，请向群管理员重新获取。';
    return;
  }
  try {
    const result = await api.resolveGuestGroup(key);
    if (serial === request) group.value = result;
  } catch (reason) {
    if (serial === request) error.value = toUserMessage(reason, '访客链接已失效或群组不可用。');
  }
}
watch(visitorKey, () => void load(), { immediate: true });
onBeforeUnmount(() => {
  serial++;
  group.value = undefined;
});
</script>
<template>
  <main class="guest-schedule-page">
    <header class="guest-header">
      <div class="guest-product">
        <span class="guest-product-mark" aria-hidden="true"><span /><span /></span>
        <span><strong>医护排班</strong><small>访客只读</small></span>
      </div>
      <t-button variant="text" @click="router.push({ name: 'login' })">返回登录</t-button>
    </header>
    <section v-if="group" class="guest-calendar">
      <span class="guest-label">访客排班 · 只读</span>
      <h1>{{ group.groupName }}</h1>
      <CalendarView :group="{ id: group.groupId, role: 'guest' }" :visitor-key="visitorKey" />
    </section>
    <section v-else class="guest-access-panel">
      <AppStatePanel v-if="!visitorKey" v-bind="missingGuestLinkState"
        ><template #actions
          ><t-button variant="outline" @click="router.push({ name: 'login' })"
            >返回登录</t-button
          ></template
        ></AppStatePanel
      >
      <AppStatePanel v-else-if="error" v-bind="invalidGuestLinkState" :description="error"
        ><template #actions
          ><t-button theme="primary" @click="load">重新验证</t-button
          ><t-button variant="outline" @click="router.push({ name: 'login' })"
            >返回登录</t-button
          ></template
        ></AppStatePanel
      >
      <t-loading v-else text="正在验证访客链接" />
    </section>
  </main>
</template>
<style scoped>
.guest-schedule-page {
  display: flex;
  min-height: 100vh;
  min-height: 100dvh;
  flex-direction: column;
  color: var(--ui-color-text-primary);
  background: var(--ui-color-background);
}

.guest-header {
  position: sticky;
  z-index: var(--ui-z-index-navigation);
  top: 0;
  display: flex;
  min-height: var(--ui-layout-header-height);
  padding: 0 var(--ui-spacing-xl);
  align-items: center;
  justify-content: space-between;
  background: var(--ui-color-surface);
  border-bottom: 1px solid var(--ui-color-border);
  backdrop-filter: blur(20px);
}

.guest-product {
  display: inline-flex;
  min-height: var(--ui-touch-target-minimum);
  align-items: center;
  gap: var(--ui-spacing-xs);
}

.guest-product > span:last-child {
  display: grid;
  line-height: 1.1;
}

.guest-product strong {
  font-size: var(--ui-font-size-lg);
  font-weight: var(--ui-font-weight-semibold);
}

.guest-product small {
  margin-top: 3px;
  color: var(--ui-color-text-muted);
  font-size: 10px;
  letter-spacing: 0.3px;
}

.guest-product-mark {
  position: relative;
  display: block;
  width: 36px;
  height: 36px;
  background: var(--ui-color-primary);
  border-radius: 12px;
  box-shadow: var(--ui-shadow-primary);
}

.guest-product-mark span {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 18px;
  height: 5px;
  background: var(--ui-color-white);
  border-radius: var(--ui-radius-pill);
  transform: translate(-50%, -50%);
}

.guest-product-mark span:last-child {
  transform: translate(-50%, -50%) rotate(90deg);
}

.guest-header :deep(.t-button) {
  min-height: var(--ui-touch-target-minimum);
}

.guest-access-panel {
  width: min(calc(100% - var(--ui-spacing-xl) * 2), 720px);
  margin: 12vh auto var(--ui-spacing-xl);
}

.guest-access-loading {
  display: grid;
  gap: var(--ui-spacing-sm);
  padding: var(--ui-spacing-xl);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-large);
  box-shadow: var(--ui-shadow-card);
}

.guest-access-loading > span {
  color: var(--ui-color-primary);
  font-size: var(--ui-font-size-sm);
  font-weight: var(--ui-font-weight-semibold);
}

.guest-access-loading h1,
.guest-calendar h1 {
  margin: 0;
  font-size: var(--ui-font-size-xl);
  font-weight: var(--ui-font-weight-semibold);
  line-height: var(--ui-line-height-tight);
}

.guest-calendar {
  display: grid;
  width: min(calc(100% - var(--ui-spacing-xl) * 2), 1280px);
  margin: var(--ui-spacing-lg) auto;
  gap: var(--ui-spacing-md);
}

.guest-calendar-title,
.guest-calendar-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.guest-label,
.guest-access-badge {
  display: block;
  color: var(--ui-color-text-muted);
  font-size: var(--ui-font-size-sm);
}

.guest-label {
  margin-bottom: var(--ui-spacing-xxs);
  color: var(--ui-color-primary);
  font-weight: var(--ui-font-weight-semibold);
}

.guest-access-badge {
  padding: var(--ui-spacing-xxs) var(--ui-spacing-xs);
  color: var(--ui-color-primary-dark);
  background: var(--ui-color-primary-light);
  border: 1px solid var(--ui-color-primary-border);
  border-radius: var(--ui-radius-pill);
  font-weight: var(--ui-font-weight-semibold);
}

.guest-calendar-toolbar {
  display: grid;
  grid-template-columns: auto minmax(96px, 1fr) auto;
  padding: var(--ui-spacing-xs);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-medium);
  box-shadow: var(--ui-shadow-card);
}

.guest-calendar-toolbar strong {
  align-self: center;
  color: var(--ui-color-text-primary);
  font-size: var(--ui-font-size-md);
  font-weight: var(--ui-font-weight-semibold);
  text-align: center;
}

.guest-calendar-toolbar :deep(.t-button) {
  min-height: var(--ui-touch-target-minimum);
}

.guest-month-summary {
  display: flex;
  min-height: var(--ui-touch-target-minimum);
  padding: var(--ui-spacing-xs) var(--ui-spacing-sm);
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-spacing-sm);
  color: var(--ui-color-text-secondary);
  background: var(--ui-color-primary-light);
  border: 1px solid var(--ui-color-primary-border);
  border-radius: var(--ui-radius-small);
  font-size: var(--ui-font-size-sm);
}

.guest-month-summary.is-empty {
  background: var(--ui-color-surface-muted);
  border-color: var(--ui-color-border);
}

.guest-month-summary strong {
  flex: none;
  color: var(--ui-color-primary-dark);
  font-size: var(--ui-font-size-md);
  font-weight: var(--ui-font-weight-semibold);
}

@media (max-width: 640px) {
  .guest-header {
    min-height: calc(var(--ui-layout-header-height) + env(safe-area-inset-top));
    padding: env(safe-area-inset-top) var(--ui-spacing-sm) 0;
  }

  .guest-product small {
    display: none;
  }

  .guest-access-panel {
    width: calc(100% - var(--ui-spacing-md) * 2);
    margin-top: var(--ui-spacing-xl);
  }

  .guest-calendar {
    width: 100%;
    margin: var(--ui-spacing-md) 0 0;
    padding: 0 var(--ui-spacing-xs) calc(var(--ui-spacing-xl) + env(safe-area-inset-bottom));
    overflow: visible;
  }

  .guest-calendar :deep(.month-grid) {
    min-width: 0;
  }

  .guest-calendar-toolbar {
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  }

  .guest-calendar-toolbar :deep(.t-button) {
    width: 100%;
  }

  .guest-calendar-toolbar :deep(.t-button:first-child) {
    justify-content: flex-start;
  }

  .guest-calendar-toolbar :deep(.t-button:last-child) {
    justify-content: flex-end;
  }
}

@media (max-width: 360px) {
  .guest-calendar-toolbar :deep(.t-button) {
    padding-inline: var(--ui-spacing-xxs);
  }
}
</style>
