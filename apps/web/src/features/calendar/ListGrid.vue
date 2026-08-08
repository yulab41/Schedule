<script setup lang="ts">
import type {
  CalendarDutyAssignment,
  CalendarDutyMember,
  ConfirmedHolidayDate,
} from '@schedule/contracts';
import { computed } from 'vue';

import { getDutyMembershipId, getHolidayShortLabel, isPastBusinessDate } from './calendar-logic.js';
import { buildDayList, isWeekend } from './calendar-views.js';
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

function isSoleDuty(assignments: readonly CalendarDutyAssignment[]): boolean {
  return assignments.length === 1;
}
</script>

<template>
  <section class="list-grid" aria-label="列表排班">
    <article
      v-for="day in days"
      :key="day.businessDate"
      class="day-row"
      :class="{
        'is-past': isPastBusinessDate(day.businessDate, props.today),
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
      </header>
      <ul class="duty-list">
        <li v-for="assignment in day.assignments" :key="assignment.id">
          <DutyCell
            :assignment="assignment"
            :hide-shift-badge="isSoleDuty(day.assignments)"
            :member="memberFor(assignment)"
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
  padding: 10px 12px;
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: 6px;
}

.day-row.is-today {
  border: 2px solid var(--ui-color-primary);
}

.day-row.is-past {
  background: #f3f4f6;
}

.day-header {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 6px;
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-sm);
}

.day-row.is-past .day-header,
.day-row.is-past .day-header strong {
  color: #4b5563;
}

.day-row.is-weekend .day-header strong,
.day-row.is-weekend .day-header span:not(.today-badge):not(.holiday-tag) {
  color: var(--ui-color-weekend);
}

.day-row.is-past :deep(.duty-name),
.day-row.is-past :deep(.duty-name.is-callable) {
  color: #4b5563;
}

.day-row.is-past :deep(.duty-name.is-callable:hover) {
  color: #1f5aa6;
  text-decoration: underline;
}

.day-header strong {
  color: var(--ui-color-text-primary);
  font-size: var(--ui-font-size-md);
}

.today-badge {
  padding: 1px 6px;
  color: var(--ui-color-near-black);
  background: var(--ui-color-today-marker);
  border-radius: 10px;
  font-size: var(--ui-font-size-xs);
  font-weight: 600;
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
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}
</style>
