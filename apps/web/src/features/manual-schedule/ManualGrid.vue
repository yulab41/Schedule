<script setup lang="ts">
import type { ConfirmedHolidayDate, ShiftType } from '@schedule/contracts';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { isWeekend } from '../calendar/calendar-views.js';
import {
  getTemplateCellShiftTypeId,
  type ManualGridRow,
  type ManualGridSelection,
  type TemplateCellMap,
  type TemplateDateColumn,
} from './manual-schedule-logic.js';
import {
  getHorizontalScrollState,
  getManualGridScrollHint,
  type HorizontalScrollState,
} from './manual-grid-interactions.js';

const props = defineProps<{
  readonly cells: TemplateCellMap;
  readonly columns: readonly TemplateDateColumn[];
  readonly holidays: ReadonlyMap<string, ConfirmedHolidayDate>;
  readonly rows: readonly ManualGridRow[];
  readonly selectedCell: ManualGridSelection | undefined;
  readonly shiftTypes: readonly ShiftType[];
  readonly staleCellKeys: ReadonlySet<string>;
}>();

const emit = defineEmits<{
  selectCell: [selection: ManualGridSelection];
}>();

const shiftTypesById = computed(
  () => new Map(props.shiftTypes.map((shiftType) => [shiftType.id, shiftType])),
);
const hasHolidayDates = computed(() =>
  props.columns.some((column) => props.holidays.has(column.date)),
);
const scrollContainer = ref<HTMLDivElement>();
const scrollState = ref<HorizontalScrollState>(
  getHorizontalScrollState({ clientWidth: 0, scrollLeft: 0, scrollWidth: 0 }),
);
const scrollHint = computed(() => getManualGridScrollHint(scrollState.value, props.columns.length));
const scrollThumbStyle = computed(() => ({
  transform: `translateX(${Math.round(scrollState.value.progress * 36)}px)`,
}));
let resizeObserver: ResizeObserver | undefined;

function isSelected(cycleDay: number, membershipId: string): boolean {
  return (
    props.selectedCell !== undefined &&
    props.selectedCell.cycleDay === cycleDay &&
    props.selectedCell.membershipId === membershipId
  );
}

function cellClass(cycleDay: number, membershipId: string): string[] {
  const classes = ['template-cell'];
  if (isSelected(cycleDay, membershipId)) {
    classes.push('is-selected');
  }
  if (props.staleCellKeys.has(`${cycleDay}:${membershipId}`)) {
    classes.push('is-stale');
  }

  return classes;
}

function shiftTypeFor(cycleDay: number, membershipId: string): ShiftType | undefined {
  const shiftTypeId = getTemplateCellShiftTypeId(props.cells, cycleDay, membershipId);
  return shiftTypeId === undefined ? undefined : shiftTypesById.value.get(shiftTypeId);
}

function holidayFor(date: string): ConfirmedHolidayDate | undefined {
  return props.holidays.get(date);
}

function cellAriaLabel(column: TemplateDateColumn, row: ManualGridRow): string {
  const shiftType = shiftTypeFor(column.cycleDay, row.membershipId);
  const state = shiftType === undefined ? '未排班' : `已排${shiftType.name}`;
  const stale = props.staleCellKeys.has(`${column.cycleDay}:${row.membershipId}`)
    ? '，配置失效'
    : '';
  return `${column.date}，${row.realName}，${state}${stale}`;
}

function updateScrollState(): void {
  const element = scrollContainer.value;
  if (element === undefined) {
    return;
  }
  scrollState.value = getHorizontalScrollState({
    clientWidth: element.clientWidth,
    scrollLeft: element.scrollLeft,
    scrollWidth: element.scrollWidth,
  });
}

function scheduleScrollStateUpdate(): void {
  void nextTick(updateScrollState);
}

watch(() => [props.columns.length, props.rows.length], scheduleScrollStateUpdate);

onMounted(() => {
  scheduleScrollStateUpdate();
  if (typeof ResizeObserver !== 'undefined' && scrollContainer.value !== undefined) {
    resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(scrollContainer.value);
  }
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
});
</script>

<template>
  <section
    class="manual-grid-frame"
    :class="{
      'can-scroll-left': scrollState.canScrollLeft,
      'can-scroll-right': scrollState.canScrollRight,
    }"
    aria-label="手动排班矩阵"
  >
    <div v-if="scrollState.isOverflowing" class="manual-grid-guide">
      <span>{{ scrollHint }}</span>
      <span
        class="scroll-progress"
        role="progressbar"
        aria-label="日期横向浏览进度"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-valuenow="Math.round(scrollState.progress * 100)"
      >
        <span class="scroll-progress-thumb" :style="scrollThumbStyle" />
      </span>
    </div>
    <div ref="scrollContainer" class="manual-grid-scroll" @scroll.passive="updateScrollState">
      <table class="manual-grid">
        <thead>
          <tr class="date-header-row">
            <th class="member-header" scope="col">值班人员 ↓</th>
            <th
              v-for="column in columns"
              :key="column.cycleDay"
              class="date-header"
              :class="{ 'is-weekend': isWeekend(column.date) }"
              scope="col"
            >
              <span class="date-value">{{ column.date.slice(5) }}</span>
              <span class="weekday-value">周{{ column.weekday }}</span>
            </th>
          </tr>
          <tr v-if="hasHolidayDates" class="holiday-header-row" aria-label="节假日摘要">
            <th class="member-header" scope="col">节假日</th>
            <th
              v-for="column in columns"
              :key="column.cycleDay"
              class="holiday-summary"
              scope="col"
            >
              <span
                v-if="holidayFor(column.date)?.isOffDay === true"
                class="holiday-name"
                :title="holidayFor(column.date)?.holidayName"
              >
                {{ holidayFor(column.date)?.holidayName }}
              </span>
              <span
                v-else-if="holidayFor(column.date)?.isWorkday === true"
                class="workday-badge"
                title="调休上班日"
              >
                班
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.membershipId">
            <th class="member-name" scope="row">
              {{ row.realName }}
              <span v-if="row.isStale" class="stale-badge" title="该成员已不在排班岗位或引用已变更">
                失效
              </span>
            </th>
            <td
              v-for="column in columns"
              :key="column.cycleDay"
              :class="cellClass(column.cycleDay, row.membershipId)"
            >
              <button
                type="button"
                class="template-cell-button"
                :aria-label="cellAriaLabel(column, row)"
                :aria-pressed="isSelected(column.cycleDay, row.membershipId)"
                @click="
                  emit('selectCell', {
                    cycleDay: column.cycleDay,
                    membershipId: row.membershipId,
                  })
                "
              >
                <span
                  v-if="shiftTypeFor(column.cycleDay, row.membershipId) !== undefined"
                  class="cell-shift"
                  :style="{
                    backgroundColor: shiftTypeFor(column.cycleDay, row.membershipId)?.color,
                    color: shiftTypeFor(column.cycleDay, row.membershipId)?.textColor,
                  }"
                  :title="shiftTypeFor(column.cycleDay, row.membershipId)?.name"
                >
                  {{ shiftTypeFor(column.cycleDay, row.membershipId)?.abbreviation }}
                </span>
                <span v-else class="cell-empty">—</span>
                <span
                  v-if="staleCellKeys.has(`${column.cycleDay}:${row.membershipId}`)"
                  class="stale-badge"
                  title="班种已停用或配置版本已变更"
                >
                  失效
                </span>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.manual-grid-frame {
  position: relative;
  display: grid;
  min-width: 0;
  gap: var(--ui-spacing-xs);
}

.manual-grid-guide {
  display: flex;
  min-height: var(--ui-touch-target-minimum);
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-spacing-sm);
  padding: var(--ui-spacing-xs) var(--ui-spacing-sm);
  color: var(--ui-color-primary-dark);
  background: var(--ui-color-primary-light);
  border: 1px solid var(--ui-color-primary-border);
  border-radius: var(--ui-radius-small);
  font-size: var(--ui-font-size-sm);
  font-weight: var(--ui-font-weight-medium);
}

.scroll-progress {
  position: relative;
  flex: 0 0 52px;
  height: 4px;
  overflow: hidden;
  background: rgb(10 102 213 / 16%);
  border-radius: var(--ui-radius-pill);
}

.scroll-progress-thumb {
  position: absolute;
  top: 0;
  left: 0;
  width: 16px;
  height: 4px;
  background: var(--ui-color-primary);
  border-radius: inherit;
  transition: transform var(--ui-duration-fast) ease;
}

.manual-grid-scroll {
  position: relative;
  max-height: min(58vh, 620px);
  overflow: auto;
  overscroll-behavior: contain;
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-medium);
  box-shadow: var(--ui-shadow-card);
  scrollbar-gutter: stable;
  -webkit-overflow-scrolling: touch;
}

.manual-grid {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  table-layout: auto;
  min-width: 640px;
  font-size: var(--ui-font-size-sm);
}

.manual-grid th,
.manual-grid td {
  border-right: 1px solid var(--ui-color-border);
  border-bottom: 1px solid var(--ui-color-border);
}

.manual-grid th:last-child,
.manual-grid td:last-child {
  border-right: 0;
}

.manual-grid tbody tr:last-child th,
.manual-grid tbody tr:last-child td {
  border-bottom: 0;
}

.member-header,
.member-name {
  position: sticky;
  z-index: 3;
  left: 0;
  min-width: 120px;
  max-width: 160px;
  padding: var(--ui-spacing-xs);
  text-align: left;
  background: var(--ui-color-surface-muted);
  box-shadow: 1px 0 0 var(--ui-color-border);
}

.date-header {
  min-width: 84px;
  height: 54px;
  padding: 6px;
  text-align: center;
  background: var(--ui-color-surface-muted);
  white-space: nowrap;
}

.date-header-row th {
  position: sticky;
  z-index: 2;
  top: 0;
}

.date-header-row .member-header,
.holiday-header-row .member-header {
  z-index: 4;
}

.date-header span {
  display: block;
}

.date-value {
  color: var(--ui-color-text-primary);
  font-weight: var(--ui-font-weight-semibold);
}

.weekday-value {
  color: var(--ui-color-text-muted);
  font-size: var(--ui-font-size-xs);
}

.date-header.is-weekend .date-value,
.date-header.is-weekend .weekday-value {
  color: var(--ui-color-weekend);
}

.holiday-header-row .holiday-summary {
  position: sticky;
  z-index: 2;
  top: 54px;
  min-width: 84px;
  height: 28px;
  padding: 0;
  background: var(--ui-color-surface);
  text-align: center;
  white-space: nowrap;
}

.holiday-header-row .member-header {
  top: 54px;
}

.holiday-name {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  padding: 1px 4px;
  color: #a42620;
  background: var(--ui-color-danger-light);
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  text-overflow: ellipsis;
  vertical-align: middle;
}

.workday-badge {
  display: inline-block;
  padding: 0 4px;
  color: var(--ui-color-primary-dark);
  background: var(--ui-color-primary-light);
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
}

.member-name {
  color: var(--ui-color-text-primary);
  font-weight: var(--ui-font-weight-semibold);
}

.template-cell {
  height: 44px;
  min-width: 84px;
  padding: 0;
  text-align: center;
}

.template-cell-button {
  display: flex;
  width: 100%;
  min-width: var(--ui-touch-target-minimum);
  min-height: var(--ui-touch-target-minimum);
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 4px;
  color: inherit;
  background: transparent;
  border: 0;
  border-radius: 0;
  cursor: pointer;
  transition:
    background var(--ui-duration-fast) ease,
    box-shadow var(--ui-duration-fast) ease,
    transform var(--ui-duration-fast) ease;
}

.template-cell-button:hover {
  background: var(--ui-color-primary-light);
}

.template-cell-button:active {
  background: var(--ui-color-primary-border);
  transform: scale(0.96);
}

.template-cell-button:focus-visible {
  position: relative;
  z-index: 1;
  outline: 3px solid var(--ui-color-focus-ring);
  outline-offset: -3px;
}

.template-cell.is-selected {
  background: var(--ui-color-primary-light);
  box-shadow: inset 0 0 0 2px var(--ui-color-primary);
}

.template-cell.is-stale {
  background: var(--ui-color-warning-light);
}

.cell-shift {
  display: inline-grid;
  min-width: 28px;
  min-height: 24px;
  padding: 2px 6px;
  place-items: center;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}

.cell-empty {
  color: var(--ui-color-border-strong);
}

.stale-badge {
  display: inline-block;
  margin-left: 4px;
  padding: 1px 4px;
  color: var(--ui-color-warning);
  background: var(--ui-color-warning-light);
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
}

@media (max-width: 640px) {
  .manual-grid-guide {
    align-items: flex-start;
  }

  .manual-grid-scroll {
    max-height: min(54vh, 520px);
    border-radius: var(--ui-radius-small);
    touch-action: pan-x pan-y;
  }

  .manual-grid {
    min-width: 600px;
  }

  .member-header,
  .member-name {
    min-width: 104px;
    max-width: 104px;
    overflow-wrap: anywhere;
  }

  .date-header,
  .holiday-header-row .holiday-summary,
  .template-cell {
    min-width: 72px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .scroll-progress-thumb,
  .template-cell-button {
    transition: none;
  }
}
</style>
