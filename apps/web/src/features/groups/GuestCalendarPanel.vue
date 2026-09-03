<script setup lang="ts">
import type {
  ConfirmedHolidayDate,
  GroupSummary,
  GuestCalendarReadModel,
} from '@schedule/contracts';
import { computed, ref, watch } from 'vue';

import { createApiClient } from '../../api/client.js';
import { toUserMessage } from '../../utils/user-message.js';
import { localAuth } from '../../auth/local-auth.js';
import AppStatePanel from '../../components/AppStatePanel.vue';
import SharedIcon from '../../components/SharedIcon.vue';
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
const assignmentCount = computed(() => calendar.value?.calendar.assignments.length ?? 0);

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
    <header class="guest-panel-heading">
      <div>
        <p>共享视图 · 只读</p>
        <h2>访客排班</h2>
      </div>
      <span>查看群组已发布排班，不提供业务写入操作。</span>
    </header>
    <AppStatePanel
      v-if="errorMessage !== undefined"
      eyebrow="访客排班"
      title="排班没有加载完成"
      :description="errorMessage"
      tone="error"
    >
      <template #actions>
        <t-button theme="primary" @click="loadCalendar">重新加载</t-button>
      </template>
    </AppStatePanel>
    <div class="guest-calendar-toolbar">
      <t-button variant="outline" @click="changeMonth(-1)">
        <template #icon><SharedIcon name="chevron-left" /></template>
        上一月
      </t-button>
      <strong>{{ getBusinessMonthLabel(businessMonth) }}</strong>
      <t-button variant="outline" @click="changeMonth(1)">
        下一月
        <template #icon><SharedIcon name="chevron-right" /></template>
      </t-button>
    </div>
    <t-loading v-if="isLoading" text="正在加载排班" />
    <template v-else-if="calendar !== undefined">
      <div class="guest-month-summary" :class="{ 'is-empty': assignmentCount === 0 }">
        <span>{{ assignmentCount === 0 ? '本月暂无已发布排班' : '本月已发布班次' }}</span>
        <strong>{{ assignmentCount }} 个班次</strong>
      </div>
      <MonthGrid
        :assignments="calendar.calendar.assignments"
        :business-month="calendar.calendar.businessMonth"
        :holidays="holidays"
        :members="calendar.calendar.members"
        :today="getBusinessDate()"
      />
    </template>
  </section>
</template>

<style scoped>
.guest-calendar-panel {
  display: grid;
  min-width: 0;
  gap: var(--ui-spacing-md);
}

.guest-panel-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: var(--ui-spacing-md);
}

.guest-panel-heading p,
.guest-panel-heading h2 {
  margin: 0;
}

.guest-panel-heading p {
  color: var(--ui-color-primary);
  font-size: var(--ui-font-size-sm);
  font-weight: var(--ui-font-weight-semibold);
}

.guest-panel-heading h2 {
  margin-top: var(--ui-spacing-xxs);
  font-size: var(--ui-font-size-xl);
  font-weight: var(--ui-font-weight-semibold);
  line-height: var(--ui-line-height-tight);
}

.guest-panel-heading > span {
  color: var(--ui-color-text-muted);
  font-size: var(--ui-font-size-sm);
  text-align: right;
}

.guest-calendar-toolbar {
  display: grid;
  grid-template-columns: auto minmax(96px, 1fr) auto;
  gap: var(--ui-spacing-xs);
  padding: var(--ui-spacing-xs);
  align-items: center;
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-medium);
  box-shadow: var(--ui-shadow-card);
}

.guest-calendar-toolbar strong {
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
  .guest-panel-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .guest-panel-heading > span {
    text-align: left;
  }

  .guest-calendar-toolbar {
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  }

  .guest-calendar-toolbar :deep(.t-button) {
    width: 100%;
  }
}
</style>
