<script setup lang="ts">
import type {
  CalendarDutyAssignment,
  CalendarDutyMember,
  ConfirmedHolidayDate,
} from '@schedule/contracts';
import { computed, ref } from 'vue';

import { getDutyMembershipId, getHolidayShortLabel } from './calendar-logic.js';
import { buildDayList, getListDateScrollTop, isWeekend } from './calendar-views.js';
import DutyCell from './DutyCell.vue';

const props = defineProps<{
  readonly assignments: readonly CalendarDutyAssignment[];
  readonly holidays: ReadonlyMap<string, ConfirmedHolidayDate>;
  readonly members: readonly CalendarDutyMember[];
  readonly today: string;
}>();
const emit = defineEmits<{
  (event: 'open-events', assignment: CalendarDutyAssignment): void;
}>();

const membersById = computed(
  () => new Map(props.members.map((member) => [member.membershipId, member])),
);
const days = computed(() => buildDayList(props.assignments, props.today));
const listGridElement = ref<HTMLElement>();

function memberFor(assignment: CalendarDutyAssignment): CalendarDutyMember | undefined {
  const membershipId = getDutyMembershipId(assignment);
  return membershipId === undefined ? undefined : membersById.value.get(membershipId);
}

function holidayFor(date: string): ConfirmedHolidayDate | undefined {
  return props.holidays.get(date);
}

function holidayTitle(date: string): string | undefined {
  const holiday = holidayFor(date);
  if (holiday === undefined) {
    return undefined;
  }
  return holiday.isOffDay ? holiday.holidayName : `${holiday.holidayName}（调休上班）`;
}

function scrollToDate(businessDate: string, stickyOffset = 0): boolean {
  const target = listGridElement.value?.querySelector<HTMLElement>(
    `[data-business-date="${businessDate}"]`,
  );
  if (target === undefined || target === null) {
    return false;
  }

  window.scrollTo({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    top: getListDateScrollTop({
      currentScrollY: window.scrollY,
      elementTop: target.getBoundingClientRect().top,
      stickyOffset,
      viewportHeight: window.innerHeight,
    }),
  });
  return true;
}

defineExpose({ scrollToDate });
</script>

<template>
  <section ref="listGridElement" class="list-grid" aria-label="列表排班">
    <article
      v-for="day in days"
      :key="day.businessDate"
      :data-business-date="day.businessDate"
      class="day-row"
      :class="{
        'is-today': day.isToday,
        'is-weekend': isWeekend(day.businessDate),
      }"
      :aria-current="day.isToday ? 'date' : undefined"
    >
      <header class="day-header">
        <strong>{{ day.businessDate.slice(5) }}</strong>
        <span>{{ day.weekdayLabel }}</span>
        <span
          v-if="holidayFor(day.businessDate) !== undefined"
          class="holiday-tag"
          :class="{
            'is-off-day': holidayFor(day.businessDate)?.isOffDay === true,
            'is-workday': holidayFor(day.businessDate)?.isWorkday === true,
          }"
          :title="holidayTitle(day.businessDate)"
        >
          {{
            holidayFor(day.businessDate)?.isOffDay === true
              ? getHolidayShortLabel(holidayFor(day.businessDate)?.holidayName ?? '')
              : '班'
          }}
        </span>
        <span v-if="day.isToday" class="today-badge">今天</span>
        <b class="duty-count">{{ day.assignments.length }} 班</b>
      </header>
      <ul class="duty-list">
        <li v-for="assignment in day.assignments" :key="assignment.id">
          <DutyCell
            :assignment="assignment"
            contact-mode="button"
            hide-shift-badge
            marker-mode="button"
            :member="memberFor(assignment)"
            show-details
            @open-events="emit('open-events', $event)"
          />
        </li>
      </ul>
    </article>
  </section>
</template>

<style scoped>
.list-grid {
  display: grid;
  gap: 8px;
}

.day-row {
  padding: 11px;
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-medium);
}

.day-row.is-today {
  padding: 10px;
  background: var(--ui-color-primary-light);
  border: 2px solid var(--ui-color-primary);
}

.day-header {
  display: flex;
  align-items: center;
  gap: 7px;
  padding-bottom: 8px;
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-sm);
}

.day-row.is-weekend .day-header strong,
.day-row.is-weekend .day-header span:not(.today-badge):not(.holiday-tag) {
  color: var(--ui-color-weekend);
}

.day-header strong {
  color: var(--ui-color-text-primary);
  font-size: var(--ui-font-size-md);
  font-variant-numeric: tabular-nums;
}

.today-badge {
  padding: 1px 6px;
  color: var(--ui-color-near-black);
  background: var(--ui-color-today-marker);
  border-radius: 10px;
  font-size: var(--ui-font-size-xs);
  font-weight: 600;
}

.duty-count {
  margin-left: auto;
  padding: 4px 7px;
  color: var(--ui-color-primary);
  background: var(--ui-color-primary-light);
  border-radius: var(--ui-radius-pill);
  font-size: 9px;
  font-weight: 600;
  white-space: nowrap;
}

.holiday-tag {
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
}

.holiday-tag.is-off-day {
  color: #b42318;
  background: #fee4e2;
}

.holiday-tag.is-workday {
  color: #1f5aa6;
  background: #e8f1fb;
}

.duty-list {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.duty-list li {
  min-width: 0;
  padding: 8px 0;
  border-top: 1px solid #edf1f5;
}

.duty-list :deep(.duty-cell.contact-button) {
  min-width: 0;
}

.duty-list :deep(.duty-name) {
  min-width: 0;
  font-size: 12px;
}

.duty-list :deep(.duty-details) {
  font-size: 9px;
}

.duty-list :deep(.duty-phone-button) {
  color: var(--ui-color-success);
  background: var(--ui-color-success-light);
  border-radius: 10px;
}

.duty-list :deep(.change-marker-list) {
  gap: 4px;
}
</style>
