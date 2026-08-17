<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import ManualGrid from '../../features/manual-schedule/ManualGrid.vue';
import ShiftPalette from '../../features/manual-schedule/ShiftPalette.vue';
import {
  applyShiftToCell,
  type ManualGridSelection,
  type TemplateCellMap,
} from '../../features/manual-schedule/manual-schedule-logic.js';
import {
  createMiniprogramMatrixFixture,
  type MiniprogramMatrixMode,
} from './miniprogram-parity-fixtures.js';

const props = withDefaults(
  defineProps<{
    readonly mode?: MiniprogramMatrixMode;
  }>(),
  { mode: 'daily' },
);

const fixture = computed(() => createMiniprogramMatrixFixture(props.mode));
const activeShiftTypeId = ref('shift-a');
const cells = ref<TemplateCellMap>(new Map(fixture.value.cells));
const selectedCell = ref<ManualGridSelection | undefined>(fixture.value.selectedCell);
const undoStack = ref<readonly TemplateCellMap[]>([]);

watch(
  () => props.mode,
  () => {
    cells.value = new Map(fixture.value.cells);
    selectedCell.value = fixture.value.selectedCell;
    undoStack.value = [];
  },
);

function selectCell(selection: ManualGridSelection): void {
  selectedCell.value = selection;
  undoStack.value = [...undoStack.value, new Map(cells.value)];
  cells.value = applyShiftToCell(
    cells.value,
    selection.cycleDay,
    selection.membershipId,
    activeShiftTypeId.value,
  );
}

function undo(): void {
  const previous = undoStack.value.at(-1);
  if (previous === undefined) return;
  cells.value = new Map(previous);
  undoStack.value = undoStack.value.slice(0, -1);
}
</script>

<template>
  <main class="matrix-preview">
    <header class="matrix-heading">
      <div>
        <span>P1 · 原生矩阵风险基线</span>
        <h1>{{ mode === 'daily' ? '日常手工排班' : '最大手工排班' }}</h1>
        <p>
          {{ fixture.rows.length }} 人 × {{ fixture.columns.length }} 天 =
          {{ fixture.logicalCellCount }} 个逻辑格
        </p>
      </div>
      <span class="mode-chip">{{ mode === 'daily' ? '常用' : '上限' }}</span>
    </header>

    <ShiftPalette
      :active-shift-type-id="activeShiftTypeId"
      :shift-types="fixture.shiftTypes"
      @select="activeShiftTypeId = $event"
    />

    <div class="matrix-toolbar">
      <div>
        <strong>选择格子即可排入当前班种</strong>
        <span>表头与人员列冻结；主体横纵滚动。</span>
      </div>
      <button type="button" :disabled="undoStack.length === 0" @click="undo">撤销</button>
    </div>

    <ManualGrid
      :cells="cells"
      :columns="fixture.columns"
      :holidays="fixture.holidays"
      :rows="fixture.rows"
      :selected-cell="selectedCell"
      :shift-types="fixture.shiftTypes"
      :stale-cell-keys="fixture.staleCellKeys"
      @select-cell="selectCell"
    />

    <p class="matrix-note">
      原生版本保持这套视觉状态，但用 Skyline 双轴滚动、Worklet 冻结同步与成员行虚拟化重写。
    </p>
  </main>
</template>

<style scoped>
:global(body) {
  min-width: 0;
}

.matrix-preview {
  min-height: 100vh;
  box-sizing: border-box;
  padding: 20px 14px 34px;
  color: var(--ui-color-text-primary);
  background: var(--ui-color-background);
  font-family: var(--ui-font-family-system);
}

.matrix-heading {
  display: flex;
  margin-bottom: 13px;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.matrix-heading span:first-child {
  color: var(--ui-color-primary);
  font-size: var(--ui-font-size-xs);
  font-weight: var(--ui-font-weight-strong);
  letter-spacing: 0.04em;
}

.matrix-heading h1,
.matrix-heading p {
  margin: 0;
}

.matrix-heading h1 {
  margin-top: 3px;
  font-size: var(--ui-font-size-xl);
  line-height: var(--ui-line-height-title);
}

.matrix-heading p {
  margin-top: 5px;
  color: var(--ui-color-text-secondary);
  font-size: var(--ui-font-size-sm);
  font-variant-numeric: tabular-nums;
}

.mode-chip {
  flex: none;
  padding: 5px 9px;
  color: var(--ui-color-primary-dark);
  background: var(--ui-color-primary-light);
  border-radius: var(--ui-radius-pill);
  font-size: var(--ui-font-size-xs);
  font-weight: var(--ui-font-weight-semibold);
}

.matrix-toolbar {
  display: flex;
  min-height: 60px;
  margin: 12px 0 8px;
  padding: 8px 10px;
  box-sizing: border-box;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  background: var(--ui-color-surface);
  border: 1px solid var(--ui-color-border);
  border-radius: var(--ui-radius-small);
}

.matrix-toolbar > div {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.matrix-toolbar strong {
  font-size: var(--ui-font-size-sm);
}

.matrix-toolbar span {
  color: var(--ui-color-text-muted);
  font-size: var(--ui-font-size-xs);
}

.matrix-toolbar button {
  min-width: 64px;
  min-height: var(--ui-touch-target-minimum);
  flex: none;
  color: var(--ui-color-primary-dark);
  background: var(--ui-color-primary-light);
  border: 1px solid var(--ui-color-primary-border);
  border-radius: var(--ui-radius-small);
  cursor: pointer;
  font: inherit;
  font-size: var(--ui-font-size-sm);
  font-weight: var(--ui-font-weight-semibold);
}

.matrix-toolbar button:disabled {
  color: var(--ui-color-text-muted);
  background: var(--ui-color-surface-muted);
  border-color: var(--ui-color-border);
  cursor: not-allowed;
}

.matrix-toolbar button:focus-visible {
  outline: 3px solid var(--ui-color-focus-ring);
  outline-offset: 2px;
}

.matrix-note {
  margin: 10px 2px 0;
  color: var(--ui-color-text-muted);
  font-size: var(--ui-font-size-xs);
  line-height: var(--ui-line-height-normal);
}
</style>
