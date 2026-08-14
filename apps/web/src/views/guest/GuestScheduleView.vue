<script setup lang="ts">
import type { ConfirmedHolidayDate, GuestCalendarReadModel } from '@schedule/contracts';
import { ChevronLeftIcon, ChevronRightIcon } from 'tdesign-icons-vue-next';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { createApiClient } from '../../api/client.js';
import { toUserMessage } from '../../utils/user-message.js';
import { localAuth } from '../../auth/local-auth.js';
import AppStatePanel from '../../components/AppStatePanel.vue';
import {
  addBusinessMonths,
  createLatestRequestTracker,
  getBusinessMonthLabel,
  getCurrentBusinessMonth,
} from '../../features/calendar/calendar-logic.js';
import { getBusinessDate } from '../../features/calendar/calendar-views.js';
import MonthGrid from '../../features/calendar/MonthGrid.vue';
import { getAppStatePresentation } from '../../pwa/app-state.js';

const api = createApiClient({ auth: localAuth });
const route = useRoute();
const router = useRouter();
const businessMonth = ref(getCurrentBusinessMonth());
const calendarResult = ref<GuestCalendarReadModel>();
const errorMessage = ref<string>();
const holidays = ref<ReadonlyMap<string, ConfirmedHolidayDate>>(new Map());
const isLoading = ref(false);
const resolvedGroup = ref<{ readonly groupId: string; readonly groupName: string }>();
const requestTracker = createLatestRequestTracker();
const missingGuestLinkState = getAppStatePresentation('guest-link-missing');
const invalidGuestLinkState = getAppStatePresentation('guest-link-invalid');

const visitorKey = computed(() =>
  typeof route.query.vkey === 'string' && route.query.vkey.length > 0
    ? route.query.vkey
    : undefined,
);
const guestErrorDescription = computed(() =>
  errorMessage.value === undefined
    ? invalidGuestLinkState.description
    : `${errorMessage.value} ${invalidGuestLinkState.description}`,
);
const assignmentCount = computed(() => calendarResult.value?.calendar.assignments.length ?? 0);

watch(visitorKey, () => {
  void load();
});

onMounted(() => void load());

async function load(): Promise<void> {
  calendarResult.value = undefined;
  errorMessage.value = undefined;
  resolvedGroup.value = undefined;

  if (visitorKey.value === undefined) {
    return;
  }

  try {
    resolvedGroup.value = await api.resolveGuestGroup(visitorKey.value);
    businessMonth.value = getCurrentBusinessMonth();
    await loadCalendar();
  } catch (error) {
    errorMessage.value = toUserMessage(error, '访客链接无效或群组不可用。');
  }
}

async function loadCalendar(): Promise<void> {
  if (resolvedGroup.value === undefined || visitorKey.value === undefined) {
    return;
  }

  const request = requestTracker.begin();
  errorMessage.value = undefined;
  isLoading.value = true;
  try {
    const nextCalendar = await api.getGuestGroupCalendarByVisitorKey(
      resolvedGroup.value.groupId,
      visitorKey.value,
      businessMonth.value,
    );
    if (requestTracker.isCurrent(request)) {
      calendarResult.value = nextCalendar;
      await loadHolidays(request);
    }
  } catch (error) {
    if (requestTracker.isCurrent(request)) {
      calendarResult.value = undefined;
      errorMessage.value = toUserMessage(error, '排班暂时无法加载，请稍后重试。');
    }
  } finally {
    if (requestTracker.isCurrent(request)) {
      isLoading.value = false;
    }
  }
}

async function loadHolidays(request: number): Promise<void> {
  const year = Number(businessMonth.value.slice(0, 4));
  try {
    const nextHolidays = await api.getGuestHolidays(year);
    if (requestTracker.isCurrent(request)) {
      holidays.value = new Map(nextHolidays.dates.map((date) => [date.date, date] as const));
    }
  } catch {
    if (requestTracker.isCurrent(request)) {
      holidays.value = new Map();
    }
  }
}

async function changeMonth(delta: number): Promise<void> {
  businessMonth.value = addBusinessMonths(businessMonth.value, delta);
  await loadCalendar();
}
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

    <section v-if="calendarResult === undefined" class="guest-access-panel">
      <AppStatePanel
        v-if="errorMessage !== undefined"
        v-bind="invalidGuestLinkState"
        :description="guestErrorDescription"
      >
        <template #actions>
          <t-button theme="primary" @click="load">重新验证</t-button>
          <t-button variant="outline" @click="router.push({ name: 'login' })">返回登录</t-button>
        </template>
      </AppStatePanel>
      <AppStatePanel v-else-if="visitorKey === undefined" v-bind="missingGuestLinkState">
        <template #actions>
          <t-button variant="outline" @click="router.push({ name: 'login' })">返回登录</t-button>
        </template>
      </AppStatePanel>
      <section v-else class="guest-access-loading" aria-live="polite">
        <span>访客排班</span>
        <h1>正在验证访问权限</h1>
        <t-loading text="正在验证访客链接" />
      </section>
    </section>

    <section v-else class="guest-calendar" :aria-busy="isLoading">
      <div class="guest-calendar-title">
        <div>
          <span class="guest-label">访客排班 · 只读</span>
          <h1>{{ calendarResult.groupName }}</h1>
        </div>
        <span class="guest-access-badge">共享视图</span>
      </div>

      <t-alert v-if="errorMessage !== undefined" theme="error" :message="errorMessage" />
      <div class="guest-calendar-toolbar">
        <t-button variant="outline" @click="changeMonth(-1)">
          <template #icon><ChevronLeftIcon /></template>
          上一月
        </t-button>
        <strong>{{ getBusinessMonthLabel(businessMonth) }}</strong>
        <t-button variant="outline" @click="changeMonth(1)">
          下一月
          <template #icon><ChevronRightIcon /></template>
        </t-button>
      </div>

      <t-loading v-if="isLoading" text="正在加载排班" />
      <template v-else>
        <div class="guest-month-summary" :class="{ 'is-empty': assignmentCount === 0 }">
          <span>{{ assignmentCount === 0 ? '本月暂无已发布排班' : '本月已发布班次' }}</span>
          <strong>{{ assignmentCount }} 个班次</strong>
        </div>
        <MonthGrid
          :assignments="calendarResult.calendar.assignments"
          :business-month="calendarResult.calendar.businessMonth"
          :holidays="holidays"
          :members="calendarResult.calendar.members"
          :today="getBusinessDate()"
        />
      </template>
    </section>
  </main>
</template>

<style scoped>
.guest-schedule-page {
  min-height: 100vh;
  min-height: 100dvh;
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
