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

interface ManualMatrixScrollEvent {
  readonly detail: {
    readonly scrollLeft: number;
    readonly scrollTop: number;
    readonly scrollWidth?: number;
  };
}

interface ManualMatrixCellSelectEvent {
  readonly detail: ManualMatrixLocation & { readonly key: string };
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

interface SelectorReference {
  readonly ref: unknown;
}

interface ManualMatrixPageInstance {
  _commitScrollProgress: (progress: number) => void;
  _dateScrollRef: MiniProgramSharedValue<unknown | null>;
  _memberScrollRef: MiniProgramSharedValue<unknown | null>;
  _scrollProgress: MiniProgramSharedValue<number>;
  _selectedLocation: ManualMatrixLocation;
  _undoStack: ManualMatrixUndoEntry[];
  _viewportWidth: MiniProgramSharedValue<number>;
  readonly data: ManualMatrixPocViewModel;
  applyAnimatedStyle(
    selector: string,
    updater: () => Record<string, string>,
    userConfig?: { readonly flush?: 'async' | 'sync'; readonly immediate?: boolean },
  ): void;
  commitScrollProgress(progress: number): void;
  createSelectorQuery(): {
    select(selector: string): {
      boundingClientRect(callback: (rect: SelectorRect) => void): unknown;
      ref(callback: (reference: SelectorReference) => void): unknown;
    };
    exec(): void;
  };
  setData(patch: Record<string, unknown>): void;
}

const { runOnJS, scrollViewContext, shared } = wx.worklet;
const defaultViewModel = createManualMatrixPocViewModel('daily');

Page({
  data: defaultViewModel,
  onLoad(this: ManualMatrixPageInstance, options: { readonly mode?: string } = {}): void {
    const mode = options.mode === 'maximum' ? 'maximum' : 'daily';
    const viewModel = createManualMatrixPocViewModel(mode);
    this._commitScrollProgress = this.commitScrollProgress.bind(this);
    this._dateScrollRef = shared<unknown | null>(null);
    this._memberScrollRef = shared<unknown | null>(null);
    this._scrollProgress = shared(0);
    this._selectedLocation = viewModel.selectedLocation;
    this._undoStack = [];
    this._viewportWidth = shared(1);
    this.applyAnimatedStyle('#matrix-scroll-thumb', () => {
      'worklet';
      return { transform: `translateX(${this._scrollProgress.value * 36}px)` };
    });
    if (mode !== defaultViewModel.mode) this.setData({ ...viewModel });
  },
  onReady(this: ManualMatrixPageInstance): void {
    const query = this.createSelectorQuery();
    query.select('#matrix-date-scroll').ref((reference) => {
      this._dateScrollRef.value = reference.ref;
    });
    query.select('#matrix-member-scroll').ref((reference) => {
      this._memberScrollRef.value = reference.ref;
    });
    query.select('.matrix-scroll').boundingClientRect((rect) => {
      this._viewportWidth.value = Math.max(1, rect.width);
    });
    query.exec();
  },
  handleGridScroll(this: ManualMatrixPageInstance, event: ManualMatrixScrollEvent): void {
    'worklet';
    const scrollLeft = Math.max(0, event.detail.scrollLeft);
    const scrollTop = Math.max(0, event.detail.scrollTop);
    if (this._dateScrollRef.value !== null) {
      scrollViewContext.scrollTo(this._dateScrollRef.value, {
        left: scrollLeft,
        duration: 0,
        animated: false,
      });
    }
    if (this._memberScrollRef.value !== null) {
      scrollViewContext.scrollTo(this._memberScrollRef.value, {
        top: scrollTop,
        duration: 0,
        animated: false,
      });
    }
    const scrollWidth = event.detail.scrollWidth ?? this._viewportWidth.value;
    const maximumScroll = Math.max(1, scrollWidth - this._viewportWidth.value);
    this._scrollProgress.value = Math.max(0, Math.min(1, scrollLeft / maximumScroll));
  },
  handleGridScrollEnd(this: ManualMatrixPageInstance, event: ManualMatrixScrollEvent): void {
    'worklet';
    const scrollWidth = event.detail.scrollWidth ?? this._viewportWidth.value;
    const maximumScroll = Math.max(1, scrollWidth - this._viewportWidth.value);
    const progress = Math.max(0, Math.min(1, event.detail.scrollLeft / maximumScroll));
    runOnJS(this._commitScrollProgress)(progress);
  },
  commitScrollProgress(this: ManualMatrixPageInstance, progress: number): void {
    const scrollHint =
      progress <= 0.02
        ? '向左滑动查看其余日期，人员列保持固定'
        : progress >= 0.98
          ? '向右滑动返回较早日期，人员列保持固定'
          : `左右滑动查看全部 ${this.data.columns.length} 天，人员列保持固定`;
    this.setData({ scrollHint, scrollProgressPercent: Math.round(progress * 100) });
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
