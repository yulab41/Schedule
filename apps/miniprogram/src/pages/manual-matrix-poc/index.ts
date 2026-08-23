import {
  resolveManualCellMutation,
  resolveManualSelection,
  type ManualCellMutation,
} from '@schedule/presentation-core';

import {
  createManualMatrixPocViewModel,
  getManualMatrixCellAssignment,
  manualMatrixPocShiftTypes,
  updateManualMatrixCell,
  type ManualMatrixCell,
  type ManualMatrixCellAssignment,
  type ManualMatrixLocation,
  type ManualMatrixPocViewModel,
} from '../../testing/fixtures/manual-matrix-poc.js';
import { buildInfo } from '../../platform/build-info.js';
import {
  createNativePerformanceProbe,
  formatNativePerformanceEvidence,
  type NativePerformanceProbe,
} from '../../platform/performance-probe.js';

interface ManualMatrixCellSelectEvent {
  readonly detail: ManualMatrixLocation & { readonly key: string };
}

interface ManualMatrixCellTapEvent {
  readonly currentTarget: {
    readonly dataset: {
      readonly columnIndex?: number | string;
      readonly key?: string;
      readonly rowIndex?: number | string;
    };
  };
}

interface ManualMatrixGestureConfig {
  readonly horizontalOffset: number;
  readonly maxHorizontalOffset: number;
  readonly maxVerticalOffset: number;
  readonly resetToken: string;
  readonly syncRevision: number;
  readonly verticalOffset: number;
}

interface ManualMatrixGestureSettled {
  readonly horizontalOffset: number;
  readonly progress: number;
  readonly verticalOffset: number;
}

interface ManualMatrixShiftSelectEvent {
  readonly currentTarget: {
    readonly dataset: { readonly shiftTypeId?: string };
  };
}

type ManualMatrixUndoEntry = ManualCellMutation<ManualMatrixCellAssignment> & {
  readonly after: ManualMatrixCellAssignment;
  readonly before: ManualMatrixCellAssignment;
};

interface ManualMatrixPageInstance {
  _matrixGestureRevision: number;
  _performanceProbe: NativePerformanceProbe | undefined;
  _selectedLocation: ManualMatrixLocation;
  _undoStack: ManualMatrixUndoEntry[];
  readonly data: ManualMatrixPocViewModel & {
    readonly matrixGestureConfig: ManualMatrixGestureConfig;
    readonly performanceEvidence: string;
  };
  commitScrollProgress(progress: number): void;
  handleCellSelect(event: ManualMatrixCellSelectEvent): void;
  handleMatrixGestureSettled(result: ManualMatrixGestureSettled): void;
  setData(patch: Record<string, unknown>, callback?: () => void): void;
  updateMatrixViewport(): void;
}

const MATRIX_PAGE_HORIZONTAL_CHROME = 30;
const MATRIX_VIEWPORT_FALLBACK_WIDTH = 290;
const defaultViewModel = createManualMatrixPocViewModel('daily');
const defaultMatrixGestureConfig = createMatrixGestureConfig(
  defaultViewModel,
  resolveMaxHorizontalOffset(defaultViewModel),
);

Page({
  data: {
    ...defaultViewModel,
    buildLabel: buildInfo.buildLabel,
    matrixGestureConfig: defaultMatrixGestureConfig,
    performanceEvidence: '',
  },
  _performanceProbe: undefined,
  onLoad(
    this: ManualMatrixPageInstance,
    options: { readonly mode?: string; readonly performance?: string } = {},
  ): void {
    const mode = options.mode === 'maximum' ? 'maximum' : 'daily';
    const viewModel = createManualMatrixPocViewModel(mode);
    this._performanceProbe =
      mode === 'maximum' && options.performance === '1'
        ? createNativePerformanceProbe()
        : undefined;
    this._matrixGestureRevision = 0;
    this._selectedLocation = viewModel.selectedLocation;
    this._undoStack = [];
    if (mode !== defaultViewModel.mode) {
      const patch = {
        ...viewModel,
        matrixGestureConfig: createMatrixGestureConfig(
          viewModel,
          resolveMaxHorizontalOffset(viewModel),
        ),
      };
      if (this._performanceProbe === undefined) {
        this.setData(patch);
      } else {
        this._performanceProbe.start('maximum-matrix-render');
        this.setData(patch, () => completeMaximumMatrixRenderProbe(this));
      }
    }
  },
  onResize(this: ManualMatrixPageInstance): void {
    this.updateMatrixViewport();
  },
  updateMatrixViewport(this: ManualMatrixPageInstance): void {
    const config = createMatrixGestureConfig(
      this.data,
      resolveMaxHorizontalOffset(this.data),
      this.data.matrixGestureConfig.horizontalOffset,
      this.data.matrixGestureConfig.verticalOffset,
      this._matrixGestureRevision,
    );
    const progress =
      config.maxHorizontalOffset > 0 ? -config.horizontalOffset / config.maxHorizontalOffset : 0;
    this.setData({
      ...createScrollProgressPatch(this.data.columns.length, progress),
      matrixGestureConfig: config,
    });
  },
  handleMatrixGestureSettled(
    this: ManualMatrixPageInstance,
    result: ManualMatrixGestureSettled,
  ): void {
    if (
      !Number.isFinite(result.horizontalOffset) ||
      !Number.isFinite(result.progress) ||
      !Number.isFinite(result.verticalOffset)
    ) {
      return;
    }
    const progress = Math.max(0, Math.min(1, result.progress));
    this._matrixGestureRevision += 1;
    this.setData({
      ...createScrollProgressPatch(this.data.columns.length, progress),
      matrixGestureConfig: createMatrixGestureConfig(
        this.data,
        this.data.matrixGestureConfig.maxHorizontalOffset,
        result.horizontalOffset,
        result.verticalOffset,
        this._matrixGestureRevision,
      ),
    });
  },
  commitScrollProgress(this: ManualMatrixPageInstance, progress: number): void {
    this.setData(createScrollProgressPatch(this.data.columns.length, progress));
  },
  handleShiftSelect(this: ManualMatrixPageInstance, event: ManualMatrixShiftSelectEvent): void {
    const shiftTypeId = event.currentTarget.dataset.shiftTypeId;
    if (manualMatrixPocShiftTypes.some((shiftType) => shiftType.id === shiftTypeId)) {
      this.setData({ activeShiftTypeId: shiftTypeId });
    }
  },
  handleCellTap(this: ManualMatrixPageInstance, event: ManualMatrixCellTapEvent): void {
    const columnIndex = Number(event.currentTarget.dataset.columnIndex);
    const rowIndex = Number(event.currentTarget.dataset.rowIndex);
    const key = event.currentTarget.dataset.key;
    if (!Number.isInteger(columnIndex) || !Number.isInteger(rowIndex) || key === undefined) return;
    this._performanceProbe?.start('tap-feedback');
    this.handleCellSelect({ detail: { columnIndex, key, rowIndex } });
  },
  handleCellSelect(this: ManualMatrixPageInstance, event: ManualMatrixCellSelectEvent): void {
    const { columnIndex, key, rowIndex } = event.detail;
    const currentCell = this.data.rows[rowIndex]?.cells[columnIndex];
    const activeShift = manualMatrixPocShiftTypes.find(
      (shiftType) => shiftType.id === this.data.activeShiftTypeId,
    );
    if (currentCell === undefined || currentCell.key !== key || activeShift === undefined) return;

    const before = getManualMatrixCellAssignment(currentCell);
    const after = {
      abbreviation: activeShift.abbreviation,
      color: activeShift.color,
      shiftTypeId: activeShift.id,
      textColor: activeShift.textColor,
    } as const;
    const mutation: ManualMatrixUndoEntry = resolveManualCellMutation({
      active: after,
      before,
      key,
      mode: 'replace',
    });
    const patch: Record<string, unknown> = { canUndo: true };
    const previousLocation = this._selectedLocation;
    const nextLocation = resolveManualSelection(
      previousLocation,
      { columnIndex, rowIndex },
      { isSame: isSameManualMatrixLocation, mode: 'replace' },
    );
    if (previousLocation.rowIndex !== rowIndex || previousLocation.columnIndex !== columnIndex) {
      const previousCell =
        this.data.rows[previousLocation.rowIndex]?.cells[previousLocation.columnIndex];
      if (previousCell !== undefined) {
        patch[cellPath(previousLocation)] = { ...previousCell, isSelected: false };
      }
    }
    patch[cellPath(nextLocation)] = updateManualMatrixCell(currentCell, mutation.after, true);
    this._undoStack.push(mutation);
    this._selectedLocation = nextLocation;
    if (this._performanceProbe === undefined) {
      this.setData(patch);
    } else {
      this.setData(patch, () => completeTapFeedbackProbe(this));
    }
  },
  handleUndo(this: ManualMatrixPageInstance): void {
    const entry = this._undoStack.pop();
    if (entry === undefined) return;
    const location = findCellLocation(this.data.rows, entry.key);
    if (location === undefined) return;
    const cell = this.data.rows[location.rowIndex]?.cells[location.columnIndex];
    if (cell === undefined) return;
    const isSelected =
      this._selectedLocation.rowIndex === location.rowIndex &&
      this._selectedLocation.columnIndex === location.columnIndex;
    this.setData({
      canUndo: this._undoStack.length > 0,
      [cellPath(location)]: updateManualMatrixCell(cell, entry.before, isSelected),
    });
  },
});

function completeMaximumMatrixRenderProbe(page: ManualMatrixPageInstance): void {
  const measurement = page._performanceProbe?.complete('maximum-matrix-render');
  if (measurement === undefined) return;
  page.setData({
    performanceEvidence: formatNativePerformanceEvidence(measurement, {
      label: '20×30 渲染',
      requiredSamples: 5,
      thresholdMs: 1000,
    }),
  });
}

function completeTapFeedbackProbe(page: ManualMatrixPageInstance): void {
  const measurement = page._performanceProbe?.complete('tap-feedback');
  if (measurement === undefined) return;
  page.setData({
    performanceEvidence: formatNativePerformanceEvidence(measurement, {
      label: '点击反馈',
      requiredSamples: 10,
      thresholdMs: 100,
    }),
  });
}

function resolveMaxHorizontalOffset(viewModel: ManualMatrixPocViewModel): number {
  const viewportWidth = resolveMatrixViewportWidth();
  return Math.max(0, viewModel.contentWidth - viewportWidth);
}

function resolveMatrixViewportWidth(): number {
  if (typeof wx === 'undefined' || typeof wx.getWindowInfo !== 'function') {
    return MATRIX_VIEWPORT_FALLBACK_WIDTH;
  }
  const windowWidth = wx.getWindowInfo().windowWidth;
  if (!Number.isFinite(windowWidth)) return MATRIX_VIEWPORT_FALLBACK_WIDTH;
  return Math.max(1, windowWidth - MATRIX_PAGE_HORIZONTAL_CHROME);
}

function createMatrixGestureConfig(
  viewModel: ManualMatrixPocViewModel,
  maxHorizontalOffset: number,
  horizontalOffset = 0,
  verticalOffset = 0,
  syncRevision = 0,
): ManualMatrixGestureConfig {
  const normalizedMaxHorizontalOffset = Math.max(0, maxHorizontalOffset);
  const maxVerticalOffset = Math.max(
    0,
    viewModel.matrixContentHeight - viewModel.matrixViewportHeight,
  );
  return {
    horizontalOffset: Math.max(-normalizedMaxHorizontalOffset, Math.min(0, horizontalOffset)),
    maxHorizontalOffset: normalizedMaxHorizontalOffset,
    maxVerticalOffset,
    resetToken: viewModel.mode,
    syncRevision,
    verticalOffset: Math.max(-maxVerticalOffset, Math.min(0, verticalOffset)),
  };
}

function createScrollProgressPatch(columnCount: number, progress: number): Record<string, unknown> {
  const normalizedProgress = Math.max(0, Math.min(1, progress));
  const scrollHint =
    normalizedProgress <= 0.02
      ? '向左滑动查看其余日期，人员列保持固定'
      : normalizedProgress >= 0.98
        ? '向右滑动返回较早日期，人员列保持固定'
        : `左右滑动查看全部 ${columnCount} 天，人员列保持固定`;
  return {
    scrollHint,
    scrollProgressOffset: Math.round(normalizedProgress * 36),
    scrollProgressPercent: Math.round(normalizedProgress * 100),
  };
}

function cellPath(location: ManualMatrixLocation): string {
  return `rows[${location.rowIndex}].cells[${location.columnIndex}]`;
}

function isSameManualMatrixLocation(
  left: ManualMatrixLocation,
  right: ManualMatrixLocation,
): boolean {
  return left.rowIndex === right.rowIndex && left.columnIndex === right.columnIndex;
}

function findCellLocation(
  rows: ManualMatrixPocViewModel['rows'],
  key: string,
): ManualMatrixLocation | undefined {
  for (const [rowIndex, row] of rows.entries()) {
    const columnIndex = row.cells.findIndex((cell: ManualMatrixCell) => cell.key === key);
    if (columnIndex >= 0) return { columnIndex, rowIndex };
  }
  return undefined;
}
