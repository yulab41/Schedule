<script setup lang="ts">
import type { CalendarDutyAssignment, CalendarDutyMember } from '@schedule/contracts';
import { computed } from 'vue';

import { getDutyMembershipId } from './calendar-logic.js';
import { buildDayList } from './calendar-views.js';
import DutyCell from './DutyCell.vue';

const props = defineProps<{
  readonly assignments: readonly CalendarDutyAssignment[];
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
</script>

<template>
  <section class="list-grid" aria-label="列表排班">
    <article
      v-for="day in days"
      :key="day.businessDate"
      class="day-row"
      :class="{ 'is-today': day.isToday }"
      :aria-current="day.isToday ? 'date' : undefined"
    >
      <header class="day-header">
        <strong>{{ day.businessDate.slice(5) }}</strong>
        <span>{{ day.weekdayLabel }}</span>
        <span v-if="day.isToday" class="today-badge">今天</span>
      </header>
      <ul class="duty-list">
        <li v-for="assignment in day.assignments" :key="assignment.id">
          <DutyCell
            :assignment="assignment"
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

.day-header {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 6px;
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-sm);
}

.day-header strong {
  color: var(--ui-color-text-primary);
  font-size: var(--ui-font-size-md);
}

.today-badge {
  padding: 1px 6px;
  color: var(--ui-color-white);
  background: var(--ui-color-primary);
  border-radius: 10px;
  font-size: var(--ui-font-size-xs);
  font-weight: 600;
}

.duty-list {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}
</style>
