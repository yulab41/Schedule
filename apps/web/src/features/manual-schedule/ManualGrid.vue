<script setup lang="ts">
import type { ConfirmedHolidayDate, ShiftType } from '@schedule/contracts';
import { computed } from 'vue';

import { isWeekend } from '../calendar/calendar-views.js';
import {
  getTemplateCellShiftTypeId,
  type ManualGridRow,
  type ManualGridSelection,
  type TemplateCellMap,
  type TemplateDateColumn,
} from './manual-schedule-logic.js';

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
</script>

<template>
  <div class="manual-grid-scroll">
    <table class="manual-grid">
      <thead>
        <tr class="date-header-row">
          <th class="member-header" scope="col">值班人员 ↓</th>
          <th
            v-for="column in columns"
            :key="column.cycleDay"
            class="date-header"
            :class="{ 'is-weekend': isWeekend(column.date) }"
          >
            <span class="date-value">{{ column.date.slice(5) }}</span>
            <span class="weekday-value">周{{ column.weekday }}</span>
          </th>
        </tr>
        <tr v-if="hasHolidayDates" class="holiday-header-row" aria-label="节假日摘要">
          <th class="member-header">节假日</th>
          <th v-for="column in columns" :key="column.cycleDay" class="holiday-summary">
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
            @click="
              emit('selectCell', { cycleDay: column.cycleDay, membershipId: row.membershipId })
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
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.manual-grid-scroll {
  overflow-x: auto;
  border: 1px solid #dbe3ea;
  border-radius: 6px;
  background: #ffffff;
}

.manual-grid {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  table-layout: auto;
  min-width: 640px;
  font-size: 13px;
}

.manual-grid th,
.manual-grid td {
  border-right: 1px solid #e5e7eb;
  border-bottom: 1px solid #e5e7eb;
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
  min-width: 120px;
  padding: 8px;
  text-align: left;
  background: #f8fafc;
}

.date-header {
  min-width: 84px;
  padding: 6px;
  text-align: center;
  background: #f8fafc;
  white-space: nowrap;
}

.date-header span {
  display: block;
}

.date-value {
  color: #111827;
  font-weight: 600;
}

.weekday-value {
  color: #6b7280;
  font-size: 11px;
}

.date-header.is-weekend .date-value,
.date-header.is-weekend .weekday-value {
  color: var(--ui-color-weekend);
}

.holiday-header-row .holiday-summary {
  min-width: 84px;
  height: 22px;
  padding: 0;
  background: #f0fdf4;
  text-align: center;
  white-space: nowrap;
}

.holiday-name {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  color: #b42318;
  font-size: 10px;
  font-weight: 600;
  text-overflow: ellipsis;
  vertical-align: middle;
}

.workday-badge {
  display: inline-block;
  padding: 0 4px;
  color: #1f5aa6;
  background: #e8f1fb;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
}

.member-name {
  color: #111827;
  font-weight: 600;
}

.template-cell {
  height: 44px;
  padding: 4px;
  text-align: center;
  cursor: pointer;
}

.template-cell:hover {
  background: #eff6ff;
}

.template-cell.is-selected {
  outline: 2px solid #1f5aa6;
  outline-offset: -2px;
  background: #eff6ff;
}

.template-cell.is-stale {
  background: #fffbeb;
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
  color: #cbd5e1;
}

.stale-badge {
  display: inline-block;
  margin-left: 4px;
  padding: 1px 4px;
  color: #92400e;
  background: #fef3c7;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
}
</style>
