<script setup lang="ts">
import type {
  CalendarDutyAssignment,
  CalendarDutyMember,
  ConfirmedHolidayDate,
} from '@schedule/contracts';
import { computed } from 'vue';

import { getWeekDays, groupAssignmentsByDate, isWeekend } from './calendar-views.js';
import DutyCell from './DutyCell.vue';
import { getDutyMembershipId, getHolidayShortLabel, isPastBusinessDate } from './calendar-logic.js';

const props = withDefaults(
  defineProps<{
    readonly assignments: readonly CalendarDutyAssignment[];
    readonly holidays: ReadonlyMap<string, ConfirmedHolidayDate>;
    readonly members: readonly CalendarDutyMember[];
    readonly showWeekdayHeader?: boolean;
    readonly today: string;
    readonly weekStart: string;
    readonly selectedDate?: string | undefined;
  }>(),
  { selectedDate: undefined, showWeekdayHeader: true },
);
const emit = defineEmits<{
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
  return 48 + longestContent * 38;
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
    <div v-if="showWeekdayHeader !== false" class="weekday-row" aria-hidden="true">
      <span
        v-for="weekday in ['一', '二', '三', '四', '五', '六', '日']"
        :key="weekday"
        :class="{ 'is-weekend': weekday === '六' || weekday === '日' }"
      >
        {{ weekday }}
      </span>
    </div>
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
              compact-shift-badge
              contact-mode="hidden"
              marker-mode="static"
              :member="memberFor(assignment)"
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
  overflow: hidden;
  background: var(--ui-color-border);
}

.weekday-row,
.week-row {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 1px;
}

.weekday-row {
  min-height: 32px;
  align-items: center;
  background: #f8fafc;
}

.weekday-row span {
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-xs);
  font-weight: 600;
  text-align: center;
}

.weekday-row span.is-weekend {
  color: var(--ui-color-weekend);
}

.week-row {
  align-items: stretch;
}

.day-cell {
  display: flex;
  min-width: 0;
  padding: 8px;
  flex-direction: column;
  background: var(--ui-color-surface);
  border: 0;
  border-radius: 0;
  cursor: pointer;
  transition: box-shadow var(--ui-duration-fast) ease;
}

.week-row .day-cell:first-child {
  border-bottom-left-radius: calc(var(--ui-radius-large) - 1px);
}

.week-row .day-cell:last-child {
  border-bottom-right-radius: calc(var(--ui-radius-large) - 1px);
}

.day-cell.is-selected {
  box-shadow: inset 0 0 0 2px var(--ui-color-primary);
}

.day-cell:focus-visible {
  outline: 3px solid var(--ui-color-focus-ring);
  outline-offset: -3px;
}

.day-cell.is-past {
  background: #f3f4f6;
}

.day-header {
  display: flex;
  min-width: 0;
  min-height: 24px;
  margin-bottom: 5px;
  align-items: flex-start;
  justify-content: space-between;
  gap: 2px;
}

.day-number {
  display: inline-grid;
  min-width: 20px;
  height: 20px;
  place-items: center;
  color: var(--ui-color-text-primary);
  background: transparent;
  border-radius: 50%;
  font-size: var(--ui-font-size-sm);
  font-weight: 600;
}

.day-cell.is-past .day-number {
  color: #4b5563;
}

.day-cell.is-weekend .day-number {
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

.holiday-tag {
  max-width: calc(100% - 20px);
  min-height: 16px;
  padding: 0 3px;
  overflow: hidden;
  border-radius: 4px;
  font-size: 9px;
  font-weight: 600;
  line-height: 16px;
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
  gap: 5px;
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
  grid-template-columns: auto minmax(0, 1fr);
  gap: 2px;
  align-items: start;
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
:deep(.change-marker-list) {
  display: inline-flex;
  grid-row: 2;
  align-items: center;
  gap: 2px;
}

:deep(.shift-badge),
:deep(.change-marker) {
  min-width: 14px;
  min-height: 14px;
  padding: 0 2px;
  overflow: hidden;
  font-size: 9px;
  line-height: 14px;
  text-overflow: clip;
  white-space: nowrap;
}

@media (max-width: 640px) {
  .weekday-row,
  .week-row {
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 1px;
  }

  .weekday-row {
    min-height: 28px;
  }

  .weekday-row span {
    font-size: 11px;
  }

  .day-cell {
    padding: 4px 3px;
    border: 0;
    border-radius: 0;
  }

  .day-header {
    min-height: 20px;
    margin-bottom: 4px;
    gap: 2px;
  }

  .day-number {
    min-width: 18px;
    height: 18px;
    font-size: clamp(10px, 2.8vw, 12px);
    line-height: 1;
  }

  .holiday-tag {
    max-width: calc(100% - 18px);
    min-height: 14px;
    padding: 0 2px;
    font-size: 8px;
    line-height: 14px;
  }

  .duty-list {
    gap: 2px;
  }

  :deep(.duty-cell) {
    gap: 1px;
    font-size: 9px;
  }

  :deep(.duty-name) {
    font-size: clamp(9px, 2.65vw, 10px);
  }

  :deep(.shift-badge),
  :deep(.change-marker) {
    min-width: 12px;
    min-height: 14px;
    padding-inline: 2px;
    font-size: 8px;
    line-height: 14px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .day-cell {
    transition: none;
  }
}
</style>
