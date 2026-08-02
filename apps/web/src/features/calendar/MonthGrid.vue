<script setup lang="ts">
import type { CalendarDutyAssignment, CalendarDutyMember } from '@schedule/contracts';
import { computed } from 'vue';

import { buildMonthGrid, getDutyMembershipId, type CalendarGridWeek } from './calendar-logic.js';
import { groupAssignmentsByDate } from './calendar-views.js';
import DutyCell from './DutyCell.vue';

const props = defineProps<{
  readonly assignments: readonly CalendarDutyAssignment[];
  readonly businessMonth: string;
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
        :class="{ 'is-today': cell?.businessDate === today }"
        :data-today="cell?.businessDate === today ? 'true' : undefined"
        :aria-current="cell?.businessDate === today ? 'date' : undefined"
      >
        <template v-if="cell !== null">
          <span class="day-number">{{ cell.businessDate.slice(8) }}</span>
          <ul class="duty-list">
            <li
              v-for="assignment in assignmentsFor(cell.businessDate)"
              :key="`${assignment.schedulePeriodId}:${assignment.businessDate}:${assignment.slotPosition}`"
            >
              <DutyCell
                :assignment="assignment"
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

.day-number {
  display: inline-block;
  margin-bottom: 4px;
  color: #374151;
  font-size: 12px;
  font-weight: 600;
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

.duty-list {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}
</style>
