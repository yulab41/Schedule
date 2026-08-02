<script setup lang="ts">
import type { ShiftType } from '@schedule/contracts';
import { computed } from 'vue';

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
</script>

<template>
  <div class="manual-grid-scroll">
    <table class="manual-grid">
      <thead>
        <tr class="date-header-row">
          <th class="member-header">值班人员</th>
          <th v-for="column in columns" :key="column.cycleDay" class="date-header">
            <span class="date-value">{{ column.date.slice(5) }}</span>
            <span class="weekday-value">周{{ column.weekday }}</span>
          </th>
        </tr>
        <tr class="holiday-header-row" aria-label="节假日摘要">
          <th class="member-header">节假日</th>
          <th v-for="column in columns" :key="column.cycleDay" class="holiday-summary">
            <!-- 节假日名称由节假日数据任务填充 -->
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.membershipId">
          <th class="member-name" scope="row">
            {{ row.realName }}
            <span v-if="row.isStale" class="stale-badge" title="该成员已不在排班角色或引用已变更">
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
  table-layout: fixed;
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
  position: sticky;
  left: 0;
  z-index: 2;
  min-width: 120px;
  padding: 8px;
  text-align: left;
  background: #f8fafc;
}

.member-header {
  z-index: 4;
}

.date-header {
  display: grid;
  gap: 2px;
  min-width: 88px;
  padding: 6px;
  text-align: center;
  background: #f8fafc;
  position: sticky;
  top: 0;
  z-index: 3;
}

.date-value {
  color: #111827;
  font-weight: 600;
}

.weekday-value {
  color: #6b7280;
  font-size: 11px;
}

.holiday-header-row .holiday-summary {
  min-width: 88px;
  height: 22px;
  padding: 0;
  background: #f0fdf4;
  position: sticky;
  top: 48px;
  z-index: 3;
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
