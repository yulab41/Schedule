<script setup lang="ts">
import type { CalendarDutyAssignment, CalendarDutyMember } from '@schedule/contracts';
import { CallIcon, HistoryIcon } from 'tdesign-icons-vue-next';
import { computed, onMounted, onUnmounted, ref } from 'vue';

import {
  buildDialLink,
  formatShiftTimeRange,
  getCalendarMarkerDescription,
} from './calendar-logic.js';
import ChangeBadge from './ChangeBadge.vue';
import { getFixedShiftDutyDisplay } from './fixed-shift-duty-display.js';
import { buildSelectedDateDutyRows, formatSelectedDateLabel } from './selected-date-duty.js';

const props = defineProps<{
  readonly assignments: readonly CalendarDutyAssignment[];
  readonly members: readonly CalendarDutyMember[];
  readonly selectedDate: string;
}>();

const emit = defineEmits<{
  (event: 'open-events', assignment: CalendarDutyAssignment): void;
}>();

const rows = computed(() =>
  buildSelectedDateDutyRows(props.selectedDate, props.assignments, props.members),
);
const currentTime = ref(new Date());
const displayRows = computed(() =>
  rows.value.map((row) => ({
    ...row,
    fixedShiftDisplay: getFixedShiftDutyDisplay(row.assignment, currentTime.value),
  })),
);
let clockTimer: ReturnType<typeof globalThis.setInterval> | undefined;

onMounted(() => {
  clockTimer = globalThis.setInterval(() => {
    currentTime.value = new Date();
  }, 60_000);
});

onUnmounted(() => {
  if (clockTimer !== undefined) {
    globalThis.clearInterval(clockTimer);
  }
});

function getShiftStartTime(assignment: CalendarDutyAssignment): string {
  return formatShiftTimeRange(assignment).split('–')[0] ?? '';
}
</script>

<template>
  <section class="selected-date-details" aria-labelledby="selected-date-heading">
    <header class="detail-heading">
      <div>
        <p>选中日期</p>
        <h3 id="selected-date-heading">{{ formatSelectedDateLabel(selectedDate) }}</h3>
      </div>
      <span class="duty-count">{{ displayRows.length }} 个班次</span>
    </header>

    <div v-if="displayRows.length > 0" class="duty-track">
      <article
        v-for="row in displayRows"
        :key="row.assignment.id"
        class="track-event"
        :data-assignment-id="row.assignment.id"
      >
        <time>{{ getShiftStartTime(row.assignment) }}</time>
        <span class="track-node" aria-hidden="true" />
        <div class="duty-card">
          <header>
            <div class="shift-identity">
              <span
                class="shift-dot"
                :style="{ backgroundColor: row.assignment.shiftTypeColor }"
                aria-hidden="true"
              />
              <strong>{{ row.assignment.shiftTypeName }}</strong>
            </div>
            <span class="duty-status" :class="`is-${row.status}`">{{ row.statusLabel }}</span>
          </header>

          <div class="duty-person">
            <div class="duty-person-heading">
              <strong>{{ row.dutyName }}</strong>
              <span
                v-if="row.fixedShiftDisplay?.currentPhase !== undefined"
                class="duty-phase"
                :class="`is-${row.fixedShiftDisplay.currentPhase.tone}`"
                aria-live="polite"
              >
                {{ row.fixedShiftDisplay.currentPhase.label }}
              </span>
            </div>
            <span>
              {{ row.assignment.scheduleRoleName }} · {{ formatShiftTimeRange(row.assignment) }}
            </span>
          </div>

          <p v-if="row.fixedShiftDisplay !== undefined" class="fixed-shift-description">
            {{ row.fixedShiftDisplay.description }}
          </p>

          <div v-if="row.assignment.changeMarkers.length > 0" class="change-summary">
            <span
              v-for="marker in row.assignment.changeMarkers"
              :key="marker"
              class="change-summary-item"
            >
              <ChangeBadge :marker="marker" />
              {{ getCalendarMarkerDescription(marker) }}
            </span>
          </div>

          <div class="duty-actions">
            <a
              v-for="option in row.phoneOptions"
              :key="`${option.label}:${option.number}`"
              class="phone-action"
              :href="buildDialLink(option.number)"
            >
              <CallIcon aria-hidden="true" />
              拨打{{ option.label }}{{ option.isConfirmed ? '' : '（未确认）' }} {{ option.number }}
            </a>
            <button type="button" class="event-action" @click="emit('open-events', row.assignment)">
              <HistoryIcon aria-hidden="true" />
              事件记录
            </button>
          </div>
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

.detail-heading p {
  margin: 0;
  color: var(--ui-color-primary);
  font-size: var(--ui-font-size-sm);
  font-weight: var(--ui-font-weight-semibold);
}

.detail-heading h3 {
  margin: 4px 0 0;
  font-size: var(--ui-font-size-xl);
  line-height: var(--ui-line-height-tight);
}

.duty-count,
.duty-status {
  display: inline-flex;
  min-height: 24px;
  padding: 3px 9px;
  align-items: center;
  border-radius: var(--ui-radius-pill);
  font-size: var(--ui-font-size-xs);
  font-weight: var(--ui-font-weight-semibold);
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

.duty-track {
  position: relative;
  display: grid;
  gap: var(--ui-spacing-md);
}

.duty-track::before {
  position: absolute;
  top: 18px;
  bottom: 18px;
  left: 62px;
  width: 3px;
  content: '';
  background: linear-gradient(var(--ui-color-primary), #8bbdf5);
  border-radius: var(--ui-radius-pill);
}

.track-event {
  position: relative;
  display: grid;
  grid-template-columns: 82px minmax(0, 1fr);
  align-items: start;
}

.track-event > time {
  padding-top: 15px;
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-xs);
  font-variant-numeric: tabular-nums;
}

.track-node {
  position: absolute;
  z-index: 1;
  top: 17px;
  left: 57px;
  width: 13px;
  height: 13px;
  background: var(--ui-color-surface);
  border: 3px solid var(--ui-color-primary);
  border-radius: 50%;
}

.duty-card {
  display: grid;
  gap: 10px;
  padding: var(--ui-spacing-md);
  background: var(--ui-color-surface);
  border: 1px solid #bfdcff;
  border-radius: var(--ui-radius-large);
  box-shadow: var(--ui-shadow-card);
}

.duty-card > header,
.shift-identity,
.duty-person,
.change-summary-item {
  display: flex;
  align-items: center;
}

.duty-card > header {
  justify-content: space-between;
  gap: var(--ui-spacing-sm);
}

.shift-identity {
  min-width: 0;
  gap: 8px;
}

.shift-dot {
  width: 10px;
  height: 10px;
  flex: 0 0 auto;
  border-radius: 50%;
}

.shift-identity strong {
  font-size: var(--ui-font-size-lg);
}

.duty-person {
  display: grid;
  align-items: start;
  flex-wrap: wrap;
  gap: 4px 10px;
}

.duty-person-heading {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 8px;
}

.duty-person strong {
  overflow-wrap: anywhere;
  font-size: 17px;
}

.duty-person span {
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-sm);
}

.duty-person .duty-phase {
  display: inline-flex;
  min-height: 22px;
  padding: 2px 8px;
  align-items: center;
  border-radius: var(--ui-radius-pill);
  font-size: var(--ui-font-size-xs);
  font-weight: var(--ui-font-weight-semibold);
  line-height: 1.25;
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

.fixed-shift-description {
  margin: 0;
  padding: 8px 10px;
  color: var(--ui-color-text-secondary);
  background: var(--ui-color-surface-muted);
  border-radius: var(--ui-radius-medium);
  font-size: var(--ui-font-size-sm);
  line-height: var(--ui-line-height-normal);
}

.change-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.change-summary-item {
  gap: 4px;
  color: var(--ui-color-warning);
  font-size: var(--ui-font-size-sm);
}

.duty-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ui-spacing-sm);
}

.phone-action,
.event-action {
  display: inline-flex;
  min-height: var(--ui-touch-target-minimum);
  padding: 8px 12px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-radius: var(--ui-radius-medium);
  cursor: pointer;
  font-size: var(--ui-font-size-sm);
  font-weight: var(--ui-font-weight-semibold);
  text-decoration: none;
}

.phone-action {
  color: var(--ui-color-primary);
  background: var(--ui-color-primary-light);
  border: 0;
}

.event-action {
  color: var(--ui-color-text-primary);
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
}

.phone-action svg,
.event-action svg {
  width: 18px;
  height: 18px;
}

.phone-action:active,
.event-action:active {
  transform: scale(0.98);
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
    margin-bottom: 16px;
  }

  .duty-track::before {
    left: 36px;
  }

  .track-event {
    grid-template-columns: 54px minmax(0, 1fr);
  }

  .track-event > time {
    padding-top: 13px;
    font-size: 10px;
  }

  .track-node {
    top: 15px;
    left: 31px;
  }

  .duty-card {
    padding: 14px;
  }

  .duty-actions {
    display: grid;
    grid-template-columns: 1fr;
  }

  .phone-action,
  .event-action {
    width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .phone-action:active,
  .event-action:active {
    transform: none;
  }
}
</style>
