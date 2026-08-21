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

interface ManualMatrixCellSelectEvent {
  readonly detail: ManualMatrixLocation & { readonly key: string };
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

interface ManualMatrixUndoEntry {
  readonly after: ManualMatrixCellAssignment;
  readonly before: ManualMatrixCellAssignment;
  readonly key: string;
}

interface SelectorRect {
  readonly width: number;
}

interface ManualMatrixPageInstance {
  _matrixGestureRevision: number;
  _selectedLocation: ManualMatrixLocation;
  _undoStack: ManualMatrixUndoEntry[];
  readonly data: ManualMatrixPocViewModel & {
    readonly matrixGestureConfig: ManualMatrixGestureConfig;
  };
  commitScrollProgress(progress: number): void;
  createSelectorQuery(): {
    select(selector: string): {
      boundingClientRect(callback: (rect: SelectorRect) => void): unknown;
    };
    exec(): void;
  };
  handleMatrixGestureSettled(result: ManualMatrixGestureSettled): void;
  setData(patch: Record<string, unknown>): void;
  updateMatrixViewport(): void;
}

const defaultViewModel = createManualMatrixPocViewModel('daily');
const defaultMatrixGestureConfig = createMatrixGestureConfig(defaultViewModel, 0);

Page({
  data: {
    ...defaultViewModel,
    buildLabel: buildInfo.buildLabel,
    matrixGestureConfig: defaultMatrixGestureConfig,
  },
  onLoad(this: ManualMatrixPageInstance, options: { readonly mode?: string } = {}): void {
    const mode = options.mode === 'maximum' ? 'maximum' : 'daily';
    const viewModel = createManualMatrixPocViewModel(mode);
    this._matrixGestureRevision = 0;
    this._selectedLocation = viewModel.selectedLocation;
    this._undoStack = [];
    if (mode !== defaultViewModel.mode) {
      this.setData({
        ...viewModel,
        matrixGestureConfig: createMatrixGestureConfig(viewModel, 0),
      });
    }
  },
  onReady(this: ManualMatrixPageInstance): void {
    this.updateMatrixViewport();
  },
  onResize(this: ManualMatrixPageInstance): void {
    this.updateMatrixViewport();
  },
  updateMatrixViewport(this: ManualMatrixPageInstance): void {
    const query = this.createSelectorQuery();
    query.select('.matrix-pan-surface').boundingClientRect((rect) => {
      const maximumHorizontalOffset = Math.max(0, this.data.contentWidth - Math.max(1, rect.width));
      const config = createMatrixGestureConfig(
        this.data,
        maximumHorizontalOffset,
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
    });
    query.exec();
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
    const patch: Record<string, unknown> = { canUndo: true };
    const previousLocation = this._selectedLocation;
    if (previousLocation.rowIndex !== rowIndex || previousLocation.columnIndex !== columnIndex) {
      const previousCell =
        this.data.rows[previousLocation.rowIndex]?.cells[previousLocation.columnIndex];
      if (previousCell !== undefined) {
        patch[cellPath(previousLocation)] = { ...previousCell, isSelected: false };
      }
    }
    patch[cellPath({ columnIndex, rowIndex })] = updateManualMatrixCell(currentCell, after, true);
    this._undoStack.push({ after, before, key });
    this._selectedLocation = { columnIndex, rowIndex };
    this.setData(patch);
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
