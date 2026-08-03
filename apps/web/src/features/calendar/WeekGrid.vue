<script setup lang="ts">
import type {
  CalendarDutyAssignment,
  CalendarDutyMember,
  ConfirmedHolidayDate,
} from '@schedule/contracts';
import { computed } from 'vue';

import { getWeekDays, getWeekdayLabel, groupAssignmentsByDate } from './calendar-views.js';
import DutyCell from './DutyCell.vue';
import { getDutyMembershipId, getHolidayShortLabel } from './calendar-logic.js';

const props = defineProps<{
  readonly assignments: readonly CalendarDutyAssignment[];
  readonly holidays: ReadonlyMap<string, ConfirmedHolidayDate>;
  readonly members: readonly CalendarDutyMember[];
  readonly today: string;
  readonly weekStart: string;
}>();
const emit = defineEmits<{
  (event: 'open-events', assignment: CalendarDutyAssignment): void;
}>();

const membersById = computed(
  () => new Map(props.members.map((member) => [member.membershipId, member])),
);
const days = computed(() => getWeekDays(props.weekStart));
const assignmentsByDate = computed(() => groupAssignmentsByDate(props.assignments));

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

function isSoleDuty(date: string): boolean {
  return assignmentsFor(date).length === 1;
}
</script>

<template>
  <section class="week-grid" aria-label="周排班">
    <div class="week-row">
      <article
        v-for="date in days"
        :key="date"
        class="day-cell"
        :class="{ 'is-today': date === today }"
        :data-today="date === today ? 'true' : undefined"
        :aria-current="date === today ? 'date' : undefined"
      >
        <header class="day-header">
          <span class="day-number">{{ date.slice(8) }}</span>
          <span class="weekday">{{ getWeekdayLabel(date) }}</span>
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
              :hide-shift-badge="isSoleDuty(date)"
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
}

.day-cell {
  min-height: 120px;
  padding: 6px;
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: 6px;
}

.day-cell.is-today {
  border: 2px solid var(--ui-color-primary);
}

.day-header {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-bottom: 6px;
}

.day-number {
  display: inline-grid;
  min-width: 24px;
  height: 24px;
  place-items: center;
  color: var(--ui-color-text-primary);
  background: var(--ui-color-background);
  border-radius: 50%;
  font-size: var(--ui-font-size-sm);
  font-weight: 600;
}

.is-today .day-number {
  color: var(--ui-color-white);
  background: var(--ui-color-primary);
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

@media (max-width: 640px) {
  .week-row {
    grid-template-columns: 1fr;
  }

  .day-cell {
    min-height: auto;
  }
}
</style>
