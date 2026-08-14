<script setup lang="ts">
import type {
  CalendarChangeMarker,
  CalendarDutyAssignment,
  CalendarDutyMember,
  ConfirmedHolidayDate,
} from '@schedule/contracts';
import { computed } from 'vue';

import {
  buildMonthGrid,
  getDutyMembershipId,
  getHolidayShortLabel,
  isCalendarGridCellSelected,
  isPastBusinessDate,
  type CalendarGridWeek,
} from './calendar-logic.js';
import { getMultiDayHolidayDates, groupAssignmentsByDate, isWeekend } from './calendar-views.js';
import DutyCell from './DutyCell.vue';

const props = defineProps<{
  readonly assignments: readonly CalendarDutyAssignment[];
  readonly businessMonth: string;
  readonly hideMarkerTypes?: readonly CalendarChangeMarker[];
  readonly highlightedDates?: ReadonlySet<string>;
  readonly holidays: ReadonlyMap<string, ConfirmedHolidayDate>;
  readonly invertPastColors?: boolean;
  readonly members: readonly CalendarDutyMember[];
  readonly selectedDate?: string | undefined;
  readonly today?: string;
}>();
const emit = defineEmits<{
  (event: 'open-events', assignment: CalendarDutyAssignment): void;
  (event: 'select-date', businessDate: string): void;
}>();

const membersById = computed(
  () => new Map(props.members.map((member) => [member.membershipId, member])),
);
const assignmentsByDate = computed(() => groupAssignmentsByDate(props.assignments));

const weeks = computed<readonly CalendarGridWeek[]>(() => {
  const [yearText = '', monthText = ''] = props.businessMonth.split('-');
  return buildMonthGrid(Number(yearText), Number(monthText));
});
const multiDayHolidayDates = computed(() => getMultiDayHolidayDates(props.holidays));

function memberFor(assignment: CalendarDutyAssignment): CalendarDutyMember | undefined {
  const membershipId = getDutyMembershipId(assignment);
  return membershipId === undefined ? undefined : membersById.value.get(membershipId);
}

function assignmentsFor(date: string | undefined): readonly CalendarDutyAssignment[] {
  return date === undefined ? [] : (assignmentsByDate.value.get(date) ?? []);
}

function visibleMarkers(assignment: CalendarDutyAssignment): readonly CalendarChangeMarker[] {
  const hidden = new Set(props.hideMarkerTypes ?? []);
  return assignment.changeMarkers.filter((marker) => !hidden.has(marker));
}

function holidayFor(date: string | undefined): ConfirmedHolidayDate | undefined {
  return date === undefined ? undefined : props.holidays.get(date);
}

function holidayTitle(date: string | undefined): string | undefined {
  const holiday = holidayFor(date);
  if (holiday === undefined) {
    return undefined;
  }
  return holiday.isOffDay ? holiday.holidayName : `${holiday.holidayName}（调休上班）`;
}

function isSoleDuty(date: string | undefined): boolean {
  return assignmentsFor(date).length === 1;
}

function selectDate(date: string | undefined): void {
  if (date !== undefined) emit('select-date', date);
}

function dateAriaLabel(date: string): string {
  const holiday = holidayFor(date);
  const assignments = assignmentsFor(date);
  const suffix = assignments.length > 0 ? `，${assignments.length}个班次` : '，暂无排班';
  return `${date}${holiday === undefined ? '' : `，${holidayTitle(date)}`}${suffix}`;
}
</script>

<template>
  <section
    class="month-grid"
    :class="{ 'invert-past-colors': invertPastColors === true }"
    aria-label="排班日历"
  >
    <div class="weekday-row" aria-hidden="true">
      <span
        v-for="weekday in ['一', '二', '三', '四', '五', '六', '日']"
        :key="weekday"
        :class="{ 'is-weekend': weekday === '六' || weekday === '日' }"
      >
        {{ weekday }}
      </span>
    </div>
    <div v-for="(week, weekIndex) in weeks" :key="weekIndex" class="week-row">
      <div
        v-for="(cell, cellIndex) in week"
        :key="cellIndex"
        class="day-cell"
        :data-date="cell?.businessDate"
        :data-selected="isCalendarGridCellSelected(cell, selectedDate) ? 'true' : undefined"
        :class="{
          'is-empty': cell === null,
          'is-multi-day-holiday': cell !== null && multiDayHolidayDates.has(cell.businessDate),
          'is-selected': isCalendarGridCellSelected(cell, selectedDate),
          'is-staged': cell !== null && highlightedDates?.has(cell.businessDate) === true,
          'is-past': cell !== null && isPastBusinessDate(cell.businessDate, today ?? ''),
          'is-today': cell?.businessDate === today,
          'is-weekend': cell !== null && isWeekend(cell.businessDate),
        }"
        :data-today="cell?.businessDate === today ? 'true' : undefined"
        :aria-current="cell?.businessDate === today ? 'date' : undefined"
        @click="selectDate(cell?.businessDate)"
      >
        <template v-if="cell !== null">
          <button
            type="button"
            class="day-select-button"
            :aria-label="dateAriaLabel(cell.businessDate)"
            :aria-pressed="cell.businessDate === selectedDate"
          />
          <div class="day-header">
            <span class="day-number">{{ cell.businessDate.slice(8) }}</span>
            <span
              v-if="holidayFor(cell.businessDate) !== undefined"
              class="holiday-tag"
              :class="{
                'is-off-day': holidayFor(cell.businessDate)?.isOffDay === true,
                'is-workday': holidayFor(cell.businessDate)?.isWorkday === true,
              }"
              :title="holidayTitle(cell.businessDate)"
            >
              {{
                holidayFor(cell.businessDate)?.isOffDay === true
                  ? getHolidayShortLabel(holidayFor(cell.businessDate)?.holidayName ?? '')
                  : '班'
              }}
            </span>
          </div>
          <ul class="duty-list">
            <li
              v-for="assignment in assignmentsFor(cell.businessDate)"
              :key="`${assignment.schedulePeriodId}:${assignment.businessDate}:${assignment.slotPosition}`"
            >
              <DutyCell
                :assignment="assignment"
                :hide-shift-badge="isSoleDuty(cell.businessDate)"
                :markers="visibleMarkers(assignment)"
                :member="memberFor(assignment)"
                @open-events="emit('open-events', $event)"
              />
            </li>
          </ul>
        </template>
      </div>
    </div>
  </section>
</template>

<style scoped>
.month-grid {
  display: grid;
  gap: 4px;
}

.weekday-row,
.week-row {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 4px;
}

.weekday-row span {
  padding: 6px 0;
  color: #6b7280;
  font-size: 13px;
  font-weight: 600;
  text-align: center;
}

.weekday-row span.is-weekend {
  color: var(--ui-color-weekend);
}

.day-cell {
  position: relative;
  min-height: 96px;
  padding: 6px;
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-small);
  transition:
    background var(--ui-duration-fast) ease,
    box-shadow var(--ui-duration-fast) ease;
}

.day-cell:not(.is-empty) {
  cursor: pointer;
}

.day-cell.is-selected {
  background: var(--ui-color-primary-light);
  box-shadow: inset 0 0 0 2px var(--ui-color-primary);
}

.day-cell.is-today {
  border-color: var(--ui-color-primary);
}

.day-cell.is-staged {
  outline: 2px solid #1f5aa6;
  outline-offset: -2px;
}

.day-cell.is-past {
  background: #f3f4f6;
}

.day-cell.is-multi-day-holiday {
  background: #fff5f5;
}

.day-cell.is-past.is-multi-day-holiday {
  background: #f9eded;
}

.day-cell.is-selected.is-multi-day-holiday {
  background: #fff0f2;
}

.month-grid.invert-past-colors .day-cell:not(.is-past) {
  background: #f3f4f6;
}

.month-grid.invert-past-colors .day-cell.is-past {
  background: #ffffff;
}

.month-grid.invert-past-colors .day-cell.is-past.is-multi-day-holiday {
  background: #fff5f5;
}

.month-grid.invert-past-colors .day-cell:not(.is-past) .day-number {
  color: #6b7280;
}

.month-grid.invert-past-colors .day-cell.is-past .day-number {
  color: #374151;
}

.month-grid.invert-past-colors .day-cell:not(.is-past) :deep(.duty-name),
.month-grid.invert-past-colors .day-cell:not(.is-past) :deep(.duty-name.is-callable) {
  color: #6b7280;
}

.month-grid.invert-past-colors .day-cell.is-past :deep(.duty-name),
.month-grid.invert-past-colors .day-cell.is-past :deep(.duty-name.is-callable) {
  color: #111827;
}

.day-number {
  display: inline-block;
  margin-bottom: 4px;
  color: #374151;
  font-size: 12px;
  font-weight: 600;
}

.day-header {
  position: relative;
  z-index: 1;
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 2px;
}

.day-select-button {
  position: absolute;
  z-index: 0;
  padding: 0;
  background: transparent;
  border: 0;
  border-radius: inherit;
  cursor: pointer;
  inset: 0;
}

.day-select-button:focus-visible {
  outline: 3px solid var(--ui-color-focus-ring);
  outline-offset: -3px;
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
  display: inline-grid;
  min-width: 22px;
  height: 22px;
  place-items: center;
  color: var(--ui-color-near-black);
  background: var(--ui-color-today-marker);
  border-radius: 50%;
}

.month-grid.invert-past-colors .day-cell.is-weekend .day-number {
  color: var(--ui-color-weekend);
}

.month-grid.invert-past-colors .day-cell.is-today .day-number {
  color: var(--ui-color-near-black);
  background: var(--ui-color-today-marker);
}

.holiday-tag {
  display: inline-block;
  max-width: 100%;
  margin: 0 0 4px 4px;
  padding: 1px 5px;
  overflow: hidden;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: middle;
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
  position: relative;
  z-index: 1;
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

@media (max-width: 640px) {
  .month-grid {
    gap: 1px;
    overflow: hidden;
    background: var(--ui-color-border);
    border: 1px solid var(--ui-color-border);
    border-radius: var(--ui-radius-medium);
    touch-action: pan-y;
  }

  .weekday-row,
  .week-row {
    gap: 1px;
  }

  .weekday-row {
    background: var(--ui-color-surface);
  }

  .weekday-row span {
    padding: 7px 0;
    font-size: clamp(10px, 2.8vw, 12px);
  }

  .day-cell {
    min-height: 68px;
    padding: 3px;
    border: 0;
    border-radius: 0;
  }

  .day-cell.is-selected {
    box-shadow: inset 0 0 0 2px var(--ui-color-primary);
  }

  .day-header {
    min-height: 18px;
    align-items: flex-start;
  }

  .day-number {
    margin: 0;
    font-size: clamp(10px, 2.8vw, 12px);
    line-height: 18px;
  }

  .is-today .day-number {
    min-width: 18px;
    height: 18px;
  }

  .holiday-tag {
    max-width: calc(100% - 18px);
    margin: 0;
    padding: 1px 3px;
    font-size: clamp(8px, 2.25vw, 10px);
    line-height: 16px;
  }

  .duty-list {
    gap: 2px;
  }

  .duty-list li {
    min-width: 0;
  }

  :deep(.duty-cell) {
    min-height: 0;
    align-items: flex-start;
    gap: 1px 2px;
    font-size: clamp(9px, 2.65vw, 11px);
    line-height: 1.18;
  }

  :deep(.duty-name) {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  :deep(.shift-badge),
  :deep(.change-marker) {
    min-width: 14px;
    min-height: 14px;
    padding: 0 2px;
    font-size: 9px;
    line-height: 14px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .day-cell {
    transition: none;
  }
}
</style>
