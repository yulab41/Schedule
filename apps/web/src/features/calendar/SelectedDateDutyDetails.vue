<script setup lang="ts">
import type { CalendarDutyAssignment, CalendarDutyMember } from '@schedule/contracts';
import { CallIcon, ChevronRightIcon, HistoryIcon } from 'tdesign-icons-vue-next';
import { computed, onMounted, onUnmounted, ref } from 'vue';

import {
  buildDialLink,
  formatShiftTimeRange,
  getCalendarMarkerDescription,
} from './calendar-logic.js';
import ChangeBadge from './ChangeBadge.vue';
import { getFixedShiftDutyDisplay } from './fixed-shift-duty-display.js';
import { buildGroupedDutyDetails, type GroupedDutyDetail } from './grouped-duty-details.js';
import { formatSelectedDateLabel } from './selected-date-duty.js';

const props = withDefaults(
  defineProps<{
    readonly assignments: readonly CalendarDutyAssignment[];
    readonly members: readonly CalendarDutyMember[];
    readonly selectedDate: string;
    readonly shiftTypeOrder?: readonly string[];
  }>(),
  { shiftTypeOrder: () => [] },
);

const emit = defineEmits<{
  (event: 'open-events', assignment: CalendarDutyAssignment): void;
}>();

const currentTime = ref(new Date());
const expandedAssignmentId = ref<string>();
const displayGroups = computed(() =>
  buildGroupedDutyDetails(
    props.selectedDate,
    props.assignments,
    props.members,
    props.shiftTypeOrder,
  ).map((group) => ({
    ...group,
    fixedShiftDisplay:
      group.rows[0] === undefined
        ? undefined
        : getFixedShiftDutyDisplay(group.rows[0].assignment, currentTime.value),
  })),
);
let clockTimer: ReturnType<typeof globalThis.setInterval> | undefined;

onMounted(() => {
  clockTimer = globalThis.setInterval(() => {
    currentTime.value = new Date();
  }, 60_000);
});

onUnmounted(() => {
  if (clockTimer !== undefined) globalThis.clearInterval(clockTimer);
});

function getGroupTimeRange(group: GroupedDutyDetail): string {
  const first = group.rows[0];
  return first === undefined ? '' : formatShiftTimeRange(first.assignment);
}

function togglePhone(assignmentId: string): void {
  expandedAssignmentId.value =
    expandedAssignmentId.value === assignmentId ? undefined : assignmentId;
}

function phoneLabel(label: string): string {
  return label === '长号' ? '手机' : label;
}

function orderedPhoneOptions<T extends { readonly label: string }>(
  options: readonly T[],
): readonly T[] {
  return [...options].sort(
    (left, right) => Number(right.label === '短号') - Number(left.label === '短号'),
  );
}
</script>

<template>
  <section class="selected-date-details" aria-labelledby="selected-date-heading">
    <header class="detail-heading">
      <div>
        <p>选中日期</p>
        <h3 id="selected-date-heading">{{ formatSelectedDateLabel(selectedDate) }}</h3>
      </div>
      <span class="duty-count">{{ displayGroups.length }} 个班种</span>
    </header>

    <div v-if="displayGroups.length > 0" class="duty-group-grid">
      <article
        v-for="group in displayGroups"
        :key="group.shiftTypeId"
        class="shift-detail-card"
        :style="{ '--shift-color': group.shiftTypeColor }"
      >
        <header class="shift-card-heading">
          <span
            class="shift-code"
            :style="{
              backgroundColor: `${group.shiftTypeColor}18`,
              color: group.shiftTypeColor,
            }"
          >
            {{ group.shiftTypeAbbreviation }}
          </span>
          <div>
            <strong>{{ group.shiftTypeName }}</strong>
            <span>{{ getGroupTimeRange(group) }}</span>
          </div>
        </header>

        <div v-if="group.fixedShiftDisplay !== undefined" class="group-shift-context">
          <span
            v-if="group.fixedShiftDisplay.currentPhase !== undefined"
            class="duty-phase"
            :class="`is-${group.fixedShiftDisplay.currentPhase.tone}`"
            aria-live="polite"
          >
            {{ group.fixedShiftDisplay.currentPhase.label }}
          </span>
          <p>{{ group.fixedShiftDisplay.description }}</p>
        </div>

        <div class="grouped-staff-list">
          <section
            v-for="row in group.rows"
            :key="row.assignment.id"
            class="staff-duty-row"
            :data-assignment-id="row.assignment.id"
          >
            <div class="staff-duty-heading">
              <button
                v-if="row.phoneOptions.length > 0"
                type="button"
                class="staff-name-button"
                :aria-expanded="expandedAssignmentId === row.assignment.id"
                :aria-label="`${row.dutyName}，展开电话`"
                @click="togglePhone(row.assignment.id)"
              >
                <span>
                  <strong>{{ row.dutyName }}</strong>
                  <small>{{ row.assignment.scheduleRoleName }}</small>
                </span>
                <CallIcon aria-hidden="true" />
                <ChevronRightIcon class="disclosure-icon" aria-hidden="true" />
              </button>
              <div v-else class="staff-name-static">
                <strong>{{ row.dutyName }}</strong>
                <small>{{ row.assignment.scheduleRoleName }}</small>
              </div>
              <span class="duty-status" :class="`is-${row.status}`">{{ row.statusLabel }}</span>
            </div>

            <div
              v-if="expandedAssignmentId === row.assignment.id && row.phoneOptions.length > 0"
              class="phone-split-actions"
            >
              <a
                v-for="option in orderedPhoneOptions(row.phoneOptions)"
                :key="`${option.label}:${option.number}`"
                :href="buildDialLink(option.number)"
              >
                <CallIcon aria-hidden="true" />
                {{ phoneLabel(option.label) }} {{ option.number }}
              </a>
            </div>

            <div v-if="row.assignment.changeMarkers.length > 0" class="staff-duty-meta">
              <span
                v-for="marker in row.assignment.changeMarkers"
                :key="marker"
                class="change-summary-item"
              >
                <ChangeBadge :marker="marker" />
                {{ getCalendarMarkerDescription(marker) }}
              </span>
            </div>

            <button type="button" class="event-action" @click="emit('open-events', row.assignment)">
              <HistoryIcon aria-hidden="true" />
              事件记录
            </button>
          </section>
        </div>
      </article>
    </div>

    <p v-else class="selected-date-empty">当日暂无符合当前筛选条件的排班。</p>
  </section>
</template>

<style scoped>
.selected-date-details {
  margin-top: var(--ui-spacing-lg);
  padding: var(--ui-spacing-lg);
  background: linear-gradient(145deg, var(--ui-color-surface), #f7fbff);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-large);
  box-shadow: var(--ui-shadow-card);
}

.detail-heading {
  display: flex;
  margin-bottom: var(--ui-spacing-lg);
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--ui-spacing-md);
}

.detail-heading p,
.detail-heading h3 {
  margin: 0;
}

.detail-heading p {
  color: var(--ui-color-primary);
  font-size: var(--ui-font-size-sm);
  font-weight: var(--ui-font-weight-semibold);
}

.detail-heading h3 {
  margin-top: 4px;
  font-size: var(--ui-font-size-xl);
  line-height: var(--ui-line-height-tight);
}

.duty-count,
.duty-status,
.duty-phase {
  display: inline-flex;
  min-height: 22px;
  padding: 2px 8px;
  align-items: center;
  border-radius: var(--ui-radius-pill);
  font-size: var(--ui-font-size-xs);
  font-weight: var(--ui-font-weight-semibold);
  line-height: 1.25;
  white-space: nowrap;
}

.duty-count,
.duty-status.is-scheduled {
  color: var(--ui-color-primary);
  background: var(--ui-color-primary-light);
}

.duty-status.is-changed {
  color: var(--ui-color-warning);
  background: var(--ui-color-warning-light);
}

.duty-status.is-pending {
  color: var(--ui-color-danger);
  background: var(--ui-color-danger-light);
}

.duty-group-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--ui-spacing-md);
}

.shift-detail-card {
  --shift-color: var(--ui-color-primary);
  position: relative;
  min-width: 0;
  padding: var(--ui-spacing-md);
  overflow: hidden;
  align-self: start;
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-large);
}

.shift-detail-card::before {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 3px;
  content: '';
  background: var(--shift-color);
}

.shift-card-heading {
  display: grid;
  min-width: 0;
  grid-template-columns: 38px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
}

.shift-code {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border-radius: var(--ui-radius-medium);
  font-size: var(--ui-font-size-xs);
  font-weight: 700;
}

.shift-card-heading > div {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.shift-card-heading strong {
  font-size: var(--ui-font-size-md);
}

.shift-card-heading div > span {
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-xs);
  font-variant-numeric: tabular-nums;
}

.grouped-staff-list {
  display: grid;
  margin-top: var(--ui-spacing-sm);
  gap: 6px;
}

.group-shift-context {
  display: flex;
  margin-top: var(--ui-spacing-sm);
  padding: 8px 10px;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  color: var(--ui-color-text-secondary);
  background: var(--ui-color-surface-muted);
  border-radius: var(--ui-radius-medium);
}

.group-shift-context p {
  min-width: 0;
  margin: 0;
  flex: 1 1 180px;
  font-size: var(--ui-font-size-xs);
  line-height: var(--ui-line-height-normal);
}

.staff-duty-row {
  min-width: 0;
  padding: 6px;
  background: var(--ui-color-surface-muted);
  border-radius: var(--ui-radius-medium);
}

.staff-duty-heading {
  display: grid;
  min-width: 0;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 6px;
}

.staff-name-button,
.staff-name-static {
  display: grid;
  min-width: 0;
  min-height: var(--ui-touch-target-minimum);
  padding: 6px 8px;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 6px;
  text-align: left;
}

.staff-name-button {
  background: transparent;
  border: 0;
  border-radius: var(--ui-radius-small);
  cursor: pointer;
}

.staff-name-static {
  grid-template-columns: minmax(0, 1fr);
}

.staff-name-button > span,
.staff-name-static {
  min-width: 0;
}

.staff-name-button strong,
.staff-name-static strong,
.staff-name-button small,
.staff-name-static small {
  display: block;
}

.staff-name-button strong,
.staff-name-static strong {
  overflow: hidden;
  color: var(--ui-color-text-primary);
  font-size: var(--ui-font-size-sm);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.staff-name-button small,
.staff-name-static small {
  margin-top: 2px;
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-xs);
}

.staff-name-button svg {
  width: 16px;
  height: 16px;
  color: var(--ui-color-primary);
}

.staff-name-button .disclosure-icon {
  transition: transform var(--ui-duration-fast) ease;
}

.staff-name-button[aria-expanded='true'] .disclosure-icon {
  transform: rotate(90deg);
}

.phone-split-actions {
  display: grid;
  margin: 2px 0 6px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  overflow: hidden;
  background: var(--ui-color-primary-light);
  border: 1px solid var(--ui-color-primary-border);
  border-radius: var(--ui-radius-medium);
}

.phone-split-actions a {
  display: inline-flex;
  min-width: 0;
  min-height: var(--ui-touch-target-minimum);
  padding: 8px;
  align-items: center;
  justify-content: center;
  gap: 5px;
  color: var(--ui-color-primary-dark);
  font-size: var(--ui-font-size-xs);
  font-weight: var(--ui-font-weight-semibold);
  text-decoration: none;
}

.phone-split-actions a + a {
  border-left: 1px solid var(--ui-color-primary-border);
}

.phone-split-actions svg,
.event-action svg {
  width: 16px;
  height: 16px;
}

.staff-duty-meta {
  display: flex;
  padding: 0 8px 4px;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}

.duty-phase.is-active {
  color: var(--ui-color-success);
  background: var(--ui-color-success-light);
}

.duty-phase.is-break,
.duty-phase.is-on-call {
  color: var(--ui-color-warning);
  background: var(--ui-color-warning-light);
}

.change-summary-item {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: var(--ui-color-warning);
  font-size: var(--ui-font-size-xs);
}

.event-action {
  display: inline-flex;
  min-height: var(--ui-touch-target-minimum);
  margin-left: 8px;
  padding: 7px 0;
  align-items: center;
  gap: 5px;
  color: var(--ui-color-text-secondary);
  background: transparent;
  border: 0;
  cursor: pointer;
  font-size: var(--ui-font-size-xs);
}

.staff-name-button:focus-visible,
.event-action:focus-visible,
.phone-split-actions a:focus-visible {
  outline: 3px solid var(--ui-color-focus-ring);
  outline-offset: 1px;
}

.selected-date-empty {
  margin: 0;
  padding: var(--ui-spacing-lg);
  color: var(--ui-color-text-secondary);
  background: var(--ui-color-surface);
  border: 1px dashed var(--ui-color-border-strong);
  border-radius: var(--ui-radius-medium);
  text-align: center;
}

@media (max-width: 640px) {
  .selected-date-details {
    margin-top: 12px;
    padding: 14px 12px;
  }

  .detail-heading {
    margin-bottom: 14px;
  }

  .duty-group-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 10px;
  }

  .shift-detail-card {
    padding: 12px 10px 10px 13px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .staff-name-button .disclosure-icon {
    transition: none;
  }
}
</style>
