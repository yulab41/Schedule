<script setup lang="ts">
import { computed, ref } from 'vue';

import {
  isWeekendColumn,
  shouldTintHolidayCell,
  type PreviewCalendarHoliday,
} from './preview-calendar.js';
import { getSwipeMonthIntent } from './preview-interactions.js';
import Ui2Icon from './Ui2Icon.vue';

export type Ui2CalendarScenario = 'august' | 'october-holiday';

interface CalendarCell {
  readonly day: number;
  readonly dimmed?: boolean;
  readonly holiday?: PreviewCalendarHoliday;
  readonly today?: boolean;
  readonly duties?: readonly {
    readonly event?: 'add' | 'swap';
    readonly name: string;
  }[];
}

const props = withDefaults(
  defineProps<{
    readonly scenario?: Ui2CalendarScenario;
    readonly selectedDay?: number;
  }>(),
  { scenario: 'august', selectedDay: 14 },
);

const emit = defineEmits<{
  (event: 'select', day: number): void;
  (event: 'month-change', offset: number): void;
}>();

const monthOffset = ref(0);
const pointerStart = ref<{ x: number; y: number } | null>(null);

const monthLabel = computed(() => {
  if (props.scenario === 'october-holiday') {
    if (monthOffset.value < 0) return '2026 年 9 月';
    if (monthOffset.value > 0) return '2026 年 11 月';
    return '2026 年 10 月';
  }

  if (monthOffset.value < 0) return '2026 年 7 月';
  if (monthOffset.value > 0) return '2026 年 9 月';
  return '2026 年 8 月';
});

const baseMonth = computed(() => (props.scenario === 'october-holiday' ? '10 月' : '8 月'));

const augustCells: readonly CalendarCell[] = [
  { day: 27, dimmed: true },
  { day: 28, dimmed: true },
  { day: 29, dimmed: true },
  { day: 30, dimmed: true },
  { day: 31, dimmed: true },
  { day: 1, duties: [{ name: '林恩宇' }] },
  { day: 2, duties: [{ name: '陈护士' }] },
  { day: 3, duties: [{ name: '王医生' }] },
  { day: 4 },
  { day: 5, duties: [{ event: 'add', name: '周医生' }] },
  { day: 6, duties: [{ name: '林恩宇' }] },
  {
    day: 7,
    holiday: { kind: 'observance', label: '立秋', spanDays: 1 },
    duties: [{ name: '陈护士' }],
  },
  { day: 8, duties: [{ event: 'swap', name: '王医生' }] },
  { day: 9 },
  { day: 10, duties: [{ name: '周医生' }] },
  { day: 11, duties: [{ name: '林恩宇' }] },
  { day: 12 },
  { day: 13, duties: [{ name: '陈护士' }] },
  {
    day: 14,
    today: true,
    duties: [{ name: '林恩宇' }, { event: 'swap', name: '陈护士' }],
  },
  { day: 15, duties: [{ name: '王医生' }] },
  { day: 16 },
  { day: 17, duties: [{ event: 'add', name: '周医生' }] },
  { day: 18, duties: [{ name: '林恩宇' }] },
  { day: 19 },
  { day: 20, duties: [{ name: '陈护士' }] },
  { day: 21, duties: [{ name: '王医生' }] },
  { day: 22 },
  {
    day: 23,
    holiday: { kind: 'observance', label: '处暑', spanDays: 1 },
    duties: [{ name: '周医生' }],
  },
  { day: 24, duties: [{ name: '林恩宇' }] },
  { day: 25 },
  { day: 26, duties: [{ event: 'swap', name: '陈护士' }] },
  { day: 27, duties: [{ name: '王医生' }] },
  { day: 28 },
  { day: 29, duties: [{ name: '周医生' }] },
  { day: 30 },
  { day: 31, duties: [{ name: '林恩宇' }] },
  { day: 1, dimmed: true },
  { day: 2, dimmed: true },
  { day: 3, dimmed: true },
  { day: 4, dimmed: true },
  { day: 5, dimmed: true },
  { day: 6, dimmed: true },
];

const nationalDayHoliday: PreviewCalendarHoliday = {
  kind: 'off-day',
  label: '国庆',
  spanDays: 7,
};

const octoberHolidayCells: readonly CalendarCell[] = [
  { day: 28, dimmed: true },
  { day: 29, dimmed: true },
  { day: 30, dimmed: true },
  { day: 1, duties: [{ name: '林恩宇' }], holiday: nationalDayHoliday },
  { day: 2, duties: [{ name: '陈护士' }], holiday: nationalDayHoliday },
  { day: 3, duties: [{ name: '王医生' }], holiday: nationalDayHoliday },
  { day: 4, holiday: nationalDayHoliday },
  { day: 5, duties: [{ event: 'add', name: '周医生' }], holiday: nationalDayHoliday },
  { day: 6, duties: [{ name: '林恩宇' }], holiday: nationalDayHoliday },
  { day: 7, duties: [{ name: '陈护士' }], holiday: nationalDayHoliday },
  { day: 8, duties: [{ event: 'swap', name: '王医生' }] },
  { day: 9 },
  {
    day: 10,
    duties: [{ name: '周医生' }],
    holiday: { kind: 'workday', label: '班', spanDays: 1 },
  },
  { day: 11, duties: [{ name: '林恩宇' }] },
  { day: 12 },
  { day: 13, duties: [{ name: '陈护士' }] },
  { day: 14, duties: [{ name: '林恩宇' }, { event: 'swap', name: '陈护士' }] },
  { day: 15, duties: [{ name: '王医生' }] },
  { day: 16 },
  { day: 17, duties: [{ event: 'add', name: '周医生' }] },
  { day: 18, duties: [{ name: '林恩宇' }] },
  { day: 19 },
  { day: 20, duties: [{ name: '陈护士' }] },
  { day: 21, duties: [{ name: '王医生' }] },
  { day: 22 },
  { day: 23, duties: [{ name: '周医生' }] },
  { day: 24, duties: [{ name: '林恩宇' }] },
  { day: 25 },
  { day: 26, duties: [{ event: 'swap', name: '陈护士' }] },
  { day: 27, duties: [{ name: '王医生' }] },
  { day: 28 },
  { day: 29, duties: [{ name: '周医生' }] },
  { day: 30 },
  { day: 31, duties: [{ name: '林恩宇' }] },
  { day: 1, dimmed: true },
  { day: 2, dimmed: true },
  { day: 3, dimmed: true },
  { day: 4, dimmed: true },
  { day: 5, dimmed: true },
  { day: 6, dimmed: true },
  { day: 7, dimmed: true },
  { day: 8, dimmed: true },
];

const cells = computed(() =>
  props.scenario === 'october-holiday' ? octoberHolidayCells : augustCells,
);

function changeMonth(offset: -1 | 1): void {
  monthOffset.value = Math.max(-1, Math.min(1, monthOffset.value + offset));
  emit('month-change', offset);
}

function onPointerDown(event: PointerEvent): void {
  pointerStart.value = { x: event.clientX, y: event.clientY };
}

function onPointerUp(event: PointerEvent): void {
  if (!pointerStart.value) return;

  const intent = getSwipeMonthIntent({
    deltaX: event.clientX - pointerStart.value.x,
    deltaY: event.clientY - pointerStart.value.y,
  });
  pointerStart.value = null;

  if (intent !== 0) changeMonth(intent);
}
</script>

<template>
  <section class="month-card" :aria-label="`${monthLabel}排班月历`">
    <header class="month-toolbar">
      <button class="icon-button" type="button" aria-label="上个月" @click="changeMonth(-1)">
        <Ui2Icon name="chevron-left" />
      </button>
      <div class="month-heading" aria-live="polite">
        <strong>{{ monthLabel }}</strong>
        <span>左右滑动切换月份</span>
      </div>
      <button class="icon-button" type="button" aria-label="下个月" @click="changeMonth(1)">
        <Ui2Icon name="chevron-right" />
      </button>
    </header>

    <div class="weekday-row" aria-hidden="true">
      <span
        v-for="(day, index) in ['一', '二', '三', '四', '五', '六', '日']"
        :key="day"
        :class="{ 'is-weekend': isWeekendColumn(index) }"
      >
        {{ day }}
      </span>
    </div>

    <div
      class="calendar-grid"
      @pointerdown="onPointerDown"
      @pointerup="onPointerUp"
      @pointercancel="pointerStart = null"
    >
      <button
        v-for="(cell, index) in cells"
        :key="`${cell.day}-${index}`"
        class="calendar-cell"
        :class="{
          'is-dimmed': cell.dimmed,
          'is-multi-day-holiday': shouldTintHolidayCell(cell.holiday),
          'is-selected': !cell.dimmed && cell.day === props.selectedDay,
          'is-today': cell.today,
          'is-weekend': isWeekendColumn(index),
        }"
        type="button"
        :disabled="cell.dimmed"
        :aria-label="`${cell.dimmed ? '相邻月份' : baseMonth} ${cell.day} 日${cell.holiday ? `，${cell.holiday.label}` : ''}`"
        :aria-pressed="!cell.dimmed && cell.day === props.selectedDay"
        @click="!cell.dimmed && emit('select', cell.day)"
      >
        <span class="date-line">
          <span class="date-number">{{ cell.day }}</span>
          <span
            v-if="cell.holiday"
            class="holiday"
            :class="{ 'is-workday': cell.holiday.kind === 'workday' }"
          >
            {{ cell.holiday.label }}
          </span>
        </span>
        <span v-for="duty in cell.duties" :key="`${cell.day}-${duty.name}`" class="duty-line">
          <span>{{ duty.name }}</span>
          <b v-if="duty.event" class="event-mark">{{ duty.event === 'swap' ? '换' : '加' }}</b>
        </span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.month-card {
  overflow: hidden;
  background: var(--ui2-surface);
  border: 1px solid var(--ui2-border);
  border-radius: var(--ui2-radius-lg);
  box-shadow: var(--ui2-shadow-card);
}

.month-toolbar {
  display: grid;
  grid-template-columns: 48px 1fr 48px;
  align-items: center;
  min-height: 60px;
  padding: 4px 6px;
  border-bottom: 1px solid var(--ui2-border);
}

.month-heading {
  display: grid;
  gap: 1px;
  text-align: center;
}

.month-heading strong {
  font-size: 15px;
  letter-spacing: -0.1px;
}

.month-heading span {
  color: var(--ui2-text-secondary);
  font-size: 11px;
}

.icon-button {
  display: grid;
  width: 44px;
  height: 44px;
  padding: 0;
  place-items: center;
  color: var(--ui2-primary);
  background: transparent;
  border: 0;
  border-radius: 14px;
  cursor: pointer;
}

.icon-button:active {
  background: var(--ui2-primary-tint);
  transform: scale(0.96);
}

.weekday-row,
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
}

.weekday-row {
  height: 28px;
  align-items: center;
  color: var(--ui2-text-secondary);
  background: #f8fafc;
  border-bottom: 1px solid var(--ui2-border);
  font-size: 11px;
  font-weight: 600;
  text-align: center;
}

.weekday-row .is-weekend {
  color: var(--ui2-danger);
}

.calendar-grid {
  touch-action: pan-y;
}

.calendar-cell {
  position: relative;
  display: flex;
  min-width: 0;
  min-height: 52px;
  padding: 4px 3px 5px;
  flex-direction: column;
  gap: 2px;
  color: var(--ui2-text-primary);
  background: var(--ui2-surface);
  border: 0;
  border-right: 1px solid var(--ui2-border);
  border-bottom: 1px solid var(--ui2-border);
  text-align: left;
  cursor: pointer;
}

.calendar-cell:nth-child(7n) {
  border-right: 0;
}

.calendar-cell:nth-last-child(-n + 7) {
  border-bottom: 0;
}

.calendar-cell.is-multi-day-holiday {
  background: #fff5f5;
}

.calendar-cell.is-selected {
  z-index: 1;
  background: var(--ui2-primary-tint);
  box-shadow: inset 0 0 0 2px var(--ui2-primary);
}

.calendar-cell.is-selected.is-multi-day-holiday {
  background: #fff5f5;
}

.calendar-cell.is-dimmed {
  color: #a7b0bb;
  background: #fafbfd;
  cursor: default;
}

.calendar-cell:not(:disabled):active {
  background: #dcecff;
}

.date-line {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 2px;
  font-size: clamp(9px, 2.6vw, 12px);
  font-weight: 650;
  line-height: 1.15;
}

.date-number {
  display: inline-grid;
  min-width: 16px;
  height: 16px;
  place-items: center;
  border-radius: 8px;
}

.is-today .date-number {
  color: #fff;
  background: var(--ui2-primary);
}

.is-weekend:not(.is-selected) .date-number {
  color: var(--ui2-danger);
}

.holiday {
  display: inline-grid;
  min-width: 16px;
  height: 14px;
  padding: 0 3px;
  overflow: hidden;
  place-items: center;
  color: #b42318;
  background: #fee4e2;
  border-radius: 4px;
  font-size: clamp(8px, 2.1vw, 9px);
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.holiday.is-workday {
  color: #1f5aa6;
  background: #e8f1fb;
}

.duty-line {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 1px;
  padding: 1px 0;
  overflow: hidden;
  color: var(--ui2-text-primary);
  background: transparent;
  font-size: clamp(9px, 2.5vw, 11px);
  font-weight: 600;
  line-height: 1.18;
  white-space: nowrap;
}

.duty-line > span {
  min-width: 0;
  overflow: hidden;
  text-overflow: clip;
}

.event-mark {
  display: inline-grid;
  width: 12px;
  height: 12px;
  flex: 0 0 12px;
  place-items: center;
  color: #92400e;
  background: #fef3c7;
  border-radius: 4px;
  font-size: 8px;
  line-height: 1;
}

@media (max-width: 340px) {
  .month-card {
    margin-inline: -12px;
    border-right: 0;
    border-left: 0;
    border-radius: 0;
  }

  .calendar-cell {
    min-height: 50px;
    padding-inline: 2px;
  }
}

@media (prefers-reduced-motion: no-preference) {
  .icon-button,
  .calendar-cell {
    transition:
      background 140ms ease,
      box-shadow 140ms ease,
      transform 140ms ease;
  }
}
</style>
