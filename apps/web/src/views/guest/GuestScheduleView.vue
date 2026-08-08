<script setup lang="ts">
import type { ConfirmedHolidayDate, GuestCalendarReadModel } from '@schedule/contracts';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { createApiClient } from '../../api/client.js';
import { toUserMessage } from '../../utils/user-message.js';
import { localAuth } from '../../auth/local-auth.js';
import {
  addBusinessMonths,
  createLatestRequestTracker,
  getBusinessMonthLabel,
  getCurrentBusinessMonth,
} from '../../features/calendar/calendar-logic.js';
import { getBusinessDate } from '../../features/calendar/calendar-views.js';
import MonthGrid from '../../features/calendar/MonthGrid.vue';

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

const visitorKey = computed(() =>
  typeof route.query.vkey === 'string' && route.query.vkey.length > 0
    ? route.query.vkey
    : undefined,
);

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
      <strong class="product-name">排班查看</strong>
      <t-button variant="text" @click="router.push({ name: 'login' })">返回登录</t-button>
    </header>

    <section v-if="calendarResult === undefined" class="guest-access-panel">
      <h1>访客查看</h1>
      <t-alert v-if="errorMessage !== undefined" theme="error" :message="errorMessage" />
      <p v-else-if="visitorKey === undefined" class="guest-hint">
        请扫描群主或管理员分享的群组小程序码查看排班。
      </p>
      <t-loading v-else text="正在验证访客链接" />
    </section>

    <section v-else class="guest-calendar" :aria-busy="isLoading">
      <div class="guest-calendar-title">
        <div>
          <span class="guest-label">访客查看</span>
          <h1>{{ calendarResult.groupName }}</h1>
        </div>
      </div>

      <t-alert v-if="errorMessage !== undefined" theme="error" :message="errorMessage" />
      <div class="guest-calendar-toolbar">
        <t-button variant="outline" @click="changeMonth(-1)">上一月</t-button>
        <strong>{{ getBusinessMonthLabel(businessMonth) }}</strong>
        <t-button variant="outline" @click="changeMonth(1)">下一月</t-button>
      </div>

      <t-loading v-if="isLoading" text="正在加载排班" />
      <MonthGrid
        v-else
        :assignments="calendarResult.calendar.assignments"
        :business-month="calendarResult.calendar.businessMonth"
        :holidays="holidays"
        :members="calendarResult.calendar.members"
        :today="getBusinessDate()"
      />
    </section>
  </main>
</template>

<style scoped>
.guest-schedule-page {
  min-height: 100vh;
  background: var(--ui-color-background);
}

.guest-header {
  display: flex;
  min-height: 56px;
  padding: 0 24px;
  align-items: center;
  justify-content: space-between;
  background: var(--ui-color-surface);
  border-bottom: 1px solid var(--ui-color-border);
}

.guest-access-panel {
  display: grid;
  width: min(100% - 32px, 440px);
  margin: 72px auto;
  gap: 20px;
  padding: 24px;
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: 8px;
}

.guest-access-panel h1,
.guest-calendar h1 {
  margin: 0;
  font-size: var(--ui-font-size-xl);
}

.guest-hint {
  margin: 0;
  color: var(--ui-color-text-muted);
}

.guest-calendar {
  display: grid;
  width: min(100% - 32px, 1280px);
  margin: 24px auto;
  gap: 16px;
}

.guest-calendar-title,
.guest-calendar-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.guest-label {
  display: block;
  margin-bottom: 4px;
  color: var(--ui-color-text-muted);
  font-size: var(--ui-font-size-sm);
}

.guest-calendar-toolbar {
  justify-content: flex-start;
  padding: 12px;
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: 6px;
}

.guest-calendar-toolbar strong {
  min-width: 88px;
  text-align: center;
}

@media (max-width: 640px) {
  .guest-header {
    padding: 0 16px;
  }

  .guest-calendar {
    width: 100%;
    margin: 16px 0;
    padding: 0 12px 20px;
    overflow-x: auto;
  }

  .guest-calendar :deep(.month-grid) {
    min-width: 760px;
  }
}
</style>
