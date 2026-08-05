<script setup lang="ts">
import type {
  CalendarDutyAssignment,
  CalendarDutyMember,
  ConfirmedHolidayDate,
} from '@schedule/contracts';
import { computed } from 'vue';

import {
  buildMonthGrid,
  getDutyMembershipId,
  getHolidayShortLabel,
  isPastBusinessDate,
  type CalendarGridWeek,
} from './calendar-logic.js';
import { groupAssignmentsByDate } from './calendar-views.js';
import DutyCell from './DutyCell.vue';

const props = defineProps<{
  readonly assignments: readonly CalendarDutyAssignment[];
  readonly businessMonth: string;
  readonly holidays: ReadonlyMap<string, ConfirmedHolidayDate>;
  readonly members: readonly CalendarDutyMember[];
  readonly today?: string;
}>();
const emit = defineEmits<{
  (event: 'open-events', assignment: CalendarDutyAssignment): void;
}>();

const membersById = computed(
  () => new Map(props.members.map((member) => [member.membershipId, member])),
);
const assignmentsByDate = computed(() => groupAssignmentsByDate(props.assignments));

const [yearText = '', monthText = ''] = props.businessMonth.split('-');
const year = Number(yearText);
const month = Number(monthText);
const weeks = computed<readonly CalendarGridWeek[]>(() => buildMonthGrid(year, month));

function memberFor(assignment: CalendarDutyAssignment): CalendarDutyMember | undefined {
  const membershipId = getDutyMembershipId(assignment);
  return membershipId === undefined ? undefined : membersById.value.get(membershipId);
}

function assignmentsFor(date: string | undefined): readonly CalendarDutyAssignment[] {
  return date === undefined ? [] : (assignmentsByDate.value.get(date) ?? []);
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
</script>

<template>
  <section class="month-grid" aria-label="排班日历">
    <div class="weekday-row" aria-hidden="true">
      <span v-for="weekday in ['一', '二', '三', '四', '五', '六', '日']" :key="weekday">
        {{ weekday }}
      </span>
    </div>
    <div v-for="(week, weekIndex) in weeks" :key="weekIndex" class="week-row">
      <div
        v-for="(cell, cellIndex) in week"
        :key="cellIndex"
        class="day-cell"
        :class="{
          'is-past': cell !== null && isPastBusinessDate(cell.businessDate, today ?? ''),
          'is-today': cell?.businessDate === today,
        }"
        :data-today="cell?.businessDate === today ? 'true' : undefined"
        :aria-current="cell?.businessDate === today ? 'date' : undefined"
      >
        <template v-if="cell !== null">
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
          <ul class="duty-list">
            <li
              v-for="assignment in assignmentsFor(cell.businessDate)"
              :key="`${assignment.schedulePeriodId}:${assignment.businessDate}:${assignment.slotPosition}`"
            >
              <DutyCell
                :assignment="assignment"
                :hide-shift-badge="isSoleDuty(cell.businessDate)"
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

.day-cell {
  min-height: 96px;
  padding: 6px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
}

.day-cell.is-today {
  border: 2px solid #1f5aa6;
}

.day-cell.is-past {
  background: #f3f4f6;
}

.day-cell.is-off-day {
  background: #fdf7f0;
}

.day-cell.is-past.is-off-day {
  background: #f1ece6;
}

.day-number {
  display: inline-block;
  margin-bottom: 4px;
  color: #374151;
  font-size: 12px;
  font-weight: 600;
}

.day-cell.is-past .day-number {
  color: #4b5563;
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
  color: #ffffff;
  background: #1f5aa6;
  border-radius: 50%;
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
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}
</style>
