<script setup lang="ts">
import type {
  ConfirmedHolidayDate,
  GuestCalendarReadModel,
  GuestGroupSummary,
} from '@schedule/contracts';
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

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
const router = useRouter();
const businessMonth = ref(getCurrentBusinessMonth());
const calendarResult = ref<GuestCalendarReadModel>();
const errorMessage = ref<string>();
const guestGroups = ref<readonly GuestGroupSummary[]>([]);
const isLoading = ref(false);
const isLoadingGroups = ref(false);
const selectedGroup = ref<GuestGroupSummary>();
const holidays = ref<ReadonlyMap<string, ConfirmedHolidayDate>>(new Map());
const requestTracker = createLatestRequestTracker();

async function loadGuestGroups(): Promise<void> {
  errorMessage.value = undefined;
  isLoadingGroups.value = true;
  try {
    guestGroups.value = await api.listGuestGroups();
  } catch (error) {
    errorMessage.value = toUserMessage(error, '群组暂时无法加载，请稍后重试。');
  } finally {
    isLoadingGroups.value = false;
  }
}

async function loadCalendar(): Promise<void> {
  if (selectedGroup.value === undefined) {
    return;
  }

  const request = requestTracker.begin();
  errorMessage.value = undefined;
  isLoading.value = true;
  try {
    const nextCalendar = await api.getGuestGroupCalendar(
      selectedGroup.value.id,
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

async function selectGroup(group: GuestGroupSummary): Promise<void> {
  selectedGroup.value = group;
  businessMonth.value = getCurrentBusinessMonth();
  await loadCalendar();
}

async function changeMonth(delta: number): Promise<void> {
  businessMonth.value = addBusinessMonths(businessMonth.value, delta);
  await loadCalendar();
}

function returnToGroupList(): void {
  calendarResult.value = undefined;
  errorMessage.value = undefined;
  selectedGroup.value = undefined;
}

onMounted(() => void loadGuestGroups());
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
      <t-loading v-if="isLoadingGroups" text="正在加载群组" />
      <div v-else class="guest-group-list">
        <t-button
          v-for="group in guestGroups"
          :key="group.id"
          block
          :loading="isLoading && selectedGroup?.id === group.id"
          variant="outline"
          @click="selectGroup(group)"
        >
          {{ group.name }}
        </t-button>
        <t-button
          v-if="errorMessage !== undefined"
          block
          variant="outline"
          @click="loadGuestGroups"
        >
          重新加载
        </t-button>
        <t-empty v-else-if="guestGroups.length === 0" description="暂无可查看的群组" />
      </div>
    </section>

    <section v-else class="guest-calendar" :aria-busy="isLoading">
      <div class="guest-calendar-title">
        <div>
          <span class="guest-label">访客查看</span>
          <h1>{{ calendarResult.groupName }}</h1>
        </div>
        <t-button variant="outline" @click="returnToGroupList"> 更换群组 </t-button>
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

.guest-group-list {
  display: grid;
  gap: 8px;
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
