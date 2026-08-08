<script setup lang="ts">
import type { ConfirmedHolidayDate, GroupSummary, GuestCalendarReadModel } from '@schedule/contracts';
import { ref, watch } from 'vue';

import { createApiClient } from '../../api/client.js';
import { toUserMessage } from '../../utils/user-message.js';
import { localAuth } from '../../auth/local-auth.js';
import {
  addBusinessMonths,
  getBusinessMonthLabel,
  getCurrentBusinessMonth,
} from '../calendar/calendar-logic.js';
import { getBusinessDate } from '../calendar/calendar-views.js';
import MonthGrid from '../calendar/MonthGrid.vue';

const props = defineProps<{
  readonly group: GroupSummary;
}>();

const api = createApiClient({ auth: localAuth });
const businessMonth = ref(getCurrentBusinessMonth());
const calendar = ref<GuestCalendarReadModel>();
const holidays = ref<ReadonlyMap<string, ConfirmedHolidayDate>>(new Map());
const errorMessage = ref<string>();
const isLoading = ref(false);

watch(
  () => props.group.id,
  () => {
    businessMonth.value = getCurrentBusinessMonth();
    void loadCalendar();
  },
  { immediate: true },
);

async function loadCalendar(): Promise<void> {
  isLoading.value = true;
  errorMessage.value = undefined;
  try {
    calendar.value = await api.getGroupGuestCalendar(props.group.id, businessMonth.value);
    await loadHolidays();
  } catch (error) {
    calendar.value = undefined;
    errorMessage.value = toUserMessage(error, '排班暂时无法加载，请稍后重试。');
  } finally {
    isLoading.value = false;
  }
}

async function loadHolidays(): Promise<void> {
  const year = Number(businessMonth.value.slice(0, 4));
  try {
    const nextHolidays = await api.getGuestHolidays(year);
    holidays.value = new Map(nextHolidays.dates.map((date) => [date.date, date] as const));
  } catch {
    holidays.value = new Map();
  }
}

function changeMonth(delta: number): void {
  businessMonth.value = addBusinessMonths(businessMonth.value, delta);
  void loadCalendar();
}
</script>

<template>
  <section class="guest-calendar-panel" :aria-busy="isLoading">
    <h2>排班日历（访客）</h2>
    <t-alert v-if="errorMessage !== undefined" theme="error" :message="errorMessage" />
    <div class="guest-calendar-toolbar">
      <t-button variant="outline" @click="changeMonth(-1)">上一月</t-button>
      <strong>{{ getBusinessMonthLabel(businessMonth) }}</strong>
      <t-button variant="outline" @click="changeMonth(1)">下一月</t-button>
    </div>
    <t-loading v-if="isLoading" text="正在加载排班" />
    <MonthGrid
      v-else-if="calendar !== undefined"
      :assignments="calendar.calendar.assignments"
      :business-month="calendar.calendar.businessMonth"
      :holidays="holidays"
      :members="calendar.calendar.members"
      :today="getBusinessDate()"
    />
  </section>
</template>

<style scoped>
.guest-calendar-panel {
  display: grid;
  gap: 12px;
}

.guest-calendar-panel h2 {
  margin: 0;
  font-size: var(--ui-font-size-xl);
  font-weight: 600;
}

.guest-calendar-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.guest-calendar-toolbar strong {
  min-width: 96px;
  font-size: var(--ui-font-size-lg);
  text-align: center;
}
</style>
