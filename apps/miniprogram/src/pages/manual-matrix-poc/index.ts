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

interface ManualMatrixGestureEvent {
  readonly deltaX: number;
  readonly deltaY: number;
  readonly state: number;
  readonly velocityY?: number;
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
  _commitScrollProgress: (progress: number) => void;
  _gestureAxis: MiniProgramSharedValue<number>;
  _lastScrollProgressPercent: number;
  _maxVerticalOffset: MiniProgramSharedValue<number>;
  _scrollProgress: MiniProgramSharedValue<number>;
  _selectedLocation: ManualMatrixLocation;
  _undoStack: ManualMatrixUndoEntry[];
  _verticalOffset: MiniProgramSharedValue<number>;
  _viewportWidth: MiniProgramSharedValue<number>;
  _viewportWidthValue: number;
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
    };
    exec(): void;
  };
  setData(patch: Record<string, unknown>): void;
  updateMatrixViewport(): void;
}

const { cancelAnimation, decay, runOnJS, shared } = wx.worklet;
const defaultViewModel = createManualMatrixPocViewModel('daily');
const MATRIX_GESTURE_AXIS_UNDECIDED = 0;
const MATRIX_GESTURE_AXIS_HORIZONTAL = 1;
const MATRIX_GESTURE_AXIS_VERTICAL = 2;
const MATRIX_GESTURE_DIRECTION_RATIO = 1.2;
const MATRIX_GESTURE_MINIMUM_DELTA = 2;

Page({
  data: defaultViewModel,
  onLoad(this: ManualMatrixPageInstance, options: { readonly mode?: string } = {}): void {
    const mode = options.mode === 'maximum' ? 'maximum' : 'daily';
    const viewModel = createManualMatrixPocViewModel(mode);
    this._commitScrollProgress = this.commitScrollProgress.bind(this);
    this._gestureAxis = shared(MATRIX_GESTURE_AXIS_UNDECIDED);
    this._lastScrollProgressPercent = -1;
    this._maxVerticalOffset = shared(
      Math.max(0, viewModel.matrixContentHeight - viewModel.matrixViewportHeight),
    );
    this._scrollProgress = shared(0);
    const scrollProgress = this._scrollProgress;
    this.applyAnimatedStyle(
      '#matrix-scroll-thumb',
      () => {
        'worklet';
        return { transform: `translateX(${scrollProgress.value * 36}px)` };
      },
      { flush: 'sync' },
    );
    this._verticalOffset = shared(0);
    const verticalOffset = this._verticalOffset;
    this.applyAnimatedStyle(
      '#matrix-body-track',
      () => {
        'worklet';
        return { transform: `translateY(${verticalOffset.value}px)` };
      },
      { flush: 'sync' },
    );
    this.applyAnimatedStyle(
      '#matrix-member-track',
      () => {
        'worklet';
        return { transform: `translateY(${verticalOffset.value}px)` };
      },
      { flush: 'sync' },
    );
    this._selectedLocation = viewModel.selectedLocation;
    this._undoStack = [];
    this._viewportWidth = shared(1);
    this._viewportWidthValue = 1;
    if (mode !== defaultViewModel.mode) this.setData({ ...viewModel });
  },
  onReady(this: ManualMatrixPageInstance): void {
    this.updateMatrixViewport();
  },
  onResize(this: ManualMatrixPageInstance): void {
    this.updateMatrixViewport();
  },
  updateMatrixViewport(this: ManualMatrixPageInstance): void {
    const query = this.createSelectorQuery();
    query.select('.matrix-scroll').boundingClientRect((rect) => {
      this._viewportWidth.value = Math.max(1, rect.width);
      this._viewportWidthValue = Math.max(1, rect.width);
    });
    query.exec();
  },
  shouldHorizontalScrollRespond(
    this: ManualMatrixPageInstance,
    event: ManualMatrixGestureEvent,
  ): boolean {
    'worklet';
    if (this._gestureAxis.value === MATRIX_GESTURE_AXIS_HORIZONTAL) return true;
    if (this._gestureAxis.value === MATRIX_GESTURE_AXIS_VERTICAL) return false;
    const horizontalDistance = Math.abs(event.deltaX);
    const verticalDistance = Math.abs(event.deltaY);
    if (Math.max(horizontalDistance, verticalDistance) < MATRIX_GESTURE_MINIMUM_DELTA) {
      return false;
    }
    if (horizontalDistance > verticalDistance * MATRIX_GESTURE_DIRECTION_RATIO) {
      this._gestureAxis.value = MATRIX_GESTURE_AXIS_HORIZONTAL;
      return true;
    }
    if (verticalDistance > horizontalDistance * MATRIX_GESTURE_DIRECTION_RATIO) {
      this._gestureAxis.value = MATRIX_GESTURE_AXIS_VERTICAL;
    }
    return false;
  },
  shouldVerticalDragRespond(
    this: ManualMatrixPageInstance,
    event: ManualMatrixGestureEvent,
  ): boolean {
    'worklet';
    if (this._gestureAxis.value === MATRIX_GESTURE_AXIS_VERTICAL) return true;
    if (this._gestureAxis.value === MATRIX_GESTURE_AXIS_HORIZONTAL) return false;
    const horizontalDistance = Math.abs(event.deltaX);
    const verticalDistance = Math.abs(event.deltaY);
    if (Math.max(horizontalDistance, verticalDistance) < MATRIX_GESTURE_MINIMUM_DELTA) {
      return false;
    }
    if (verticalDistance > horizontalDistance * MATRIX_GESTURE_DIRECTION_RATIO) {
      this._gestureAxis.value = MATRIX_GESTURE_AXIS_VERTICAL;
      return true;
    }
    if (horizontalDistance > verticalDistance * MATRIX_GESTURE_DIRECTION_RATIO) {
      this._gestureAxis.value = MATRIX_GESTURE_AXIS_HORIZONTAL;
    }
    return false;
  },
  handleMatrixHorizontalGesture(
    this: ManualMatrixPageInstance,
    event: ManualMatrixGestureEvent,
  ): void {
    'worklet';
    if (event.state === 0 || event.state === 1) {
      this._gestureAxis.value = MATRIX_GESTURE_AXIS_UNDECIDED;
      return;
    }
    if (
      (event.state === 3 || event.state === 4) &&
      this._gestureAxis.value === MATRIX_GESTURE_AXIS_HORIZONTAL
    ) {
      this._gestureAxis.value = MATRIX_GESTURE_AXIS_UNDECIDED;
    }
  },
  handleMatrixVerticalDrag(this: ManualMatrixPageInstance, event: ManualMatrixGestureEvent): void {
    'worklet';
    if (event.state === 0 || event.state === 1) {
      cancelAnimation(this._verticalOffset);
      this._gestureAxis.value = MATRIX_GESTURE_AXIS_UNDECIDED;
      return;
    }

    if (event.state === 2) {
      if (this._gestureAxis.value === MATRIX_GESTURE_AXIS_UNDECIDED) {
        const horizontalDistance = Math.abs(event.deltaX);
        const verticalDistance = Math.abs(event.deltaY);
        if (verticalDistance <= horizontalDistance * MATRIX_GESTURE_DIRECTION_RATIO) return;
        this._gestureAxis.value = MATRIX_GESTURE_AXIS_VERTICAL;
      }
      if (this._gestureAxis.value !== MATRIX_GESTURE_AXIS_VERTICAL) return;
      const nextOffset = this._verticalOffset.value + event.deltaY;
      this._verticalOffset.value = Math.max(
        -this._maxVerticalOffset.value,
        Math.min(0, nextOffset),
      );
      return;
    }

    if (event.state === 3 && this._maxVerticalOffset.value > 0) {
      if (this._gestureAxis.value === MATRIX_GESTURE_AXIS_VERTICAL) {
        this._verticalOffset.value = decay({
          clamp: [-this._maxVerticalOffset.value, 0],
          deceleration: 0.997,
          velocity: event.velocityY ?? 0,
        });
      }
    }
    if (event.state === 3 || event.state === 4) {
      this._gestureAxis.value = MATRIX_GESTURE_AXIS_UNDECIDED;
    }
  },
  handleGridScroll(this: ManualMatrixPageInstance, event: ManualMatrixScrollEvent): void {
    'worklet';
    const scrollLeft = Math.max(0, event.detail.scrollLeft);
    const scrollWidth = event.detail.scrollWidth ?? this._viewportWidth.value;
    const maximumScroll = Math.max(1, scrollWidth - this._viewportWidth.value);
    this._scrollProgress.value = Math.max(0, Math.min(1, scrollLeft / maximumScroll));
  },
  handleGridScrollFallback(this: ManualMatrixPageInstance, event: ManualMatrixScrollEvent): void {
    const scrollLeft = Math.max(0, event.detail.scrollLeft);

    const scrollWidth = event.detail.scrollWidth ?? this.data.contentWidth;
    const maximumScroll = Math.max(1, scrollWidth - Math.max(1, this._viewportWidthValue));
    const progress = Math.max(0, Math.min(1, scrollLeft / maximumScroll));
    const scrollProgressPercent = Math.round(progress * 100);
    if (scrollProgressPercent === this._lastScrollProgressPercent) return;
    this._lastScrollProgressPercent = scrollProgressPercent;
    this.commitScrollProgress(progress);
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
    this.setData({
      scrollHint,
      scrollProgressOffset: Math.round(progress * 36),
      scrollProgressPercent: Math.round(progress * 100),
    });
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
