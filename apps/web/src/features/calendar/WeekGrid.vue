<script setup lang="ts">
import type {
  CalendarDutyAssignment,
  CalendarDutyMember,
  ConfirmedHolidayDate,
} from '@schedule/contracts';
import { computed } from 'vue';

import {
  getWeekDays,
  getWeekdayLabel,
  groupAssignmentsByDate,
  isWeekend,
} from './calendar-views.js';
import DutyCell from './DutyCell.vue';
import { getDutyMembershipId, getHolidayShortLabel, isPastBusinessDate } from './calendar-logic.js';

const props = defineProps<{
  readonly assignments: readonly CalendarDutyAssignment[];
  readonly holidays: ReadonlyMap<string, ConfirmedHolidayDate>;
  readonly members: readonly CalendarDutyMember[];
  readonly today: string;
  readonly weekStart: string;
  readonly selectedDate?: string | undefined;
}>();
const emit = defineEmits<{
  (event: 'open-events', assignment: CalendarDutyAssignment): void;
  (event: 'select-date', businessDate: string): void;
}>();

const membersById = computed(
  () => new Map(props.members.map((member) => [member.membershipId, member])),
);
const days = computed(() => getWeekDays(props.weekStart));
const assignmentsByDate = computed(() => groupAssignmentsByDate(props.assignments));
const weekCardHeight = computed(() => {
  const longestContent = Math.max(
    0,
    ...days.value.map((date) => {
      const assignmentUnits = assignmentsFor(date).reduce(
        (total, assignment) => total + 1 + assignment.changeMarkers.length * 0.25,
        0,
      );
      const holidayUnits = holidayFor(date) === undefined ? 0 : 0.5;
      return assignmentUnits + holidayUnits;
    }),
  );
  return 88 + longestContent * 44;
});

function memberFor(assignment: CalendarDutyAssignment): CalendarDutyMember | undefined {
  const membershipId = getDutyMembershipId(assignment);
  return membershipId === undefined ? undefined : membersById.value.get(membershipId);
}

function assignmentsFor(date: string): readonly CalendarDutyAssignment[] {
  return assignmentsByDate.value.get(date) ?? [];
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

function selectDate(date: string): void {
  emit('select-date', date);
}
</script>

<template>
  <section class="week-grid" aria-label="周排班">
    <div class="week-row">
      <article
        v-for="date in days"
        :key="date"
        class="day-cell"
        :style="{ minHeight: `${weekCardHeight}px` }"
        :class="{
          'is-past': isPastBusinessDate(date, today),
          'is-today': date === today,
          'is-weekend': isWeekend(date),
          'is-selected': date === selectedDate,
        }"
        :data-today="date === today ? 'true' : undefined"
        :aria-current="date === today ? 'date' : undefined"
        :aria-pressed="date === selectedDate"
        role="button"
        tabindex="0"
        @click="selectDate(date)"
        @keydown.enter.prevent="selectDate(date)"
        @keydown.space.prevent="selectDate(date)"
      >
        <header class="day-header">
          <span class="weekday">{{ getWeekdayLabel(date) }}</span>
          <span class="day-number">{{ date.slice(8) }}</span>
          <span
            v-if="holidayFor(date) !== undefined"
            class="holiday-tag"
            :class="{
              'is-off-day': holidayFor(date)?.isOffDay === true,
              'is-workday': holidayFor(date)?.isWorkday === true,
            }"
            :title="holidayTitle(date)"
          >
            {{
              holidayFor(date)?.isOffDay === true
                ? getHolidayShortLabel(holidayFor(date)?.holidayName ?? '')
                : '班'
            }}
          </span>
        </header>
        <ul class="duty-list">
          <li
            v-for="assignment in assignmentsFor(date)"
            :key="`${assignment.schedulePeriodId}:${assignment.businessDate}:${assignment.slotPosition}`"
          >
            <DutyCell
              :assignment="assignment"
              contact-mode="hidden"
              :member="memberFor(assignment)"
              @open-events="emit('open-events', $event)"
            />
          </li>
        </ul>
      </article>
    </div>
  </section>
</template>

<style scoped>
.week-grid {
  display: grid;
  gap: 4px;
}

.week-row {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 4px;
  align-items: stretch;
}

.day-cell {
  display: flex;
  min-width: 0;
  padding: 8px;
  flex-direction: column;
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: 6px;
  cursor: pointer;
  transition: box-shadow var(--ui-duration-fast) ease;
}

.day-cell.is-selected {
  box-shadow: inset 0 0 0 2px var(--ui-color-primary);
}

.day-cell:focus-visible {
  outline: 3px solid var(--ui-color-focus-ring);
  outline-offset: -3px;
}

.day-cell.is-today {
  border: 2px solid var(--ui-color-primary);
}

.day-cell.is-past {
  background: #f3f4f6;
}

.day-header {
  display: flex;
  min-height: 64px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  margin-bottom: 6px;
  border-bottom: 1px solid var(--ui-color-border);
}

.day-number {
  display: inline-grid;
  min-width: 22px;
  height: 22px;
  place-items: center;
  color: var(--ui-color-text-primary);
  background: transparent;
  border-radius: 50%;
  font-size: var(--ui-font-size-lg);
  font-weight: 600;
}

.day-cell.is-past .day-number,
.day-cell.is-past .weekday {
  color: #4b5563;
}

.day-cell.is-weekend .day-number,
.day-cell.is-weekend .weekday {
  color: var(--ui-color-weekend);
}

.day-cell.is-past :deep(.duty-name),
.day-cell.is-past :deep(.duty-name.is-callable) {
  color: #4b5563;
}

.day-cell.is-past :deep(.duty-name.is-callable:hover) {
  color: #1f5aa6;
  text-decoration: underline;
}

.is-today .day-number {
  color: var(--ui-color-near-black);
  background: var(--ui-color-today-marker);
}

.weekday {
  color: var(--ui-color-text-muted);
  font-size: var(--ui-font-size-sm);
  font-weight: 600;
}

.holiday-tag {
  max-width: 100%;
  padding: 1px 5px;
  overflow: hidden;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
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

.duty-list li {
  min-width: 0;
}

:deep(.duty-cell) {
  display: grid;
  min-width: 0;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 2px;
  align-items: center;
  font-size: 11px;
  line-height: 1.2;
}

:deep(.duty-name) {
  min-width: 0;
  overflow-wrap: anywhere;
  grid-column: 1 / -1;
  font-size: 11px;
  line-height: 1.2;
  white-space: normal;
}

:deep(.shift-badge),
:deep(.change-marker-button) {
  grid-row: 2;
}

:deep(.shift-badge),
:deep(.change-marker) {
  min-width: 14px;
  min-height: 14px;
  padding: 0 3px;
  font-size: 9px;
  line-height: 14px;
}

@media (max-width: 640px) {
  .week-row {
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 2px;
  }

  .day-cell {
    padding: 5px 3px;
    border-radius: 8px;
  }

  .day-header {
    min-height: 54px;
    gap: 2px;
  }

  .weekday {
    font-size: 9px;
  }

  .day-number {
    min-width: 18px;
    height: 18px;
    font-size: 15px;
    line-height: 1;
  }

  .holiday-tag {
    min-height: 14px;
    padding: 0 3px;
    font-size: 8px;
    line-height: 14px;
  }

  :deep(.duty-list) {
    gap: 2px;
  }

  :deep(.duty-cell) {
    gap: 1px;
    font-size: 9px;
  }

  :deep(.duty-name) {
    font-size: 10px;
  }
}
</style>
