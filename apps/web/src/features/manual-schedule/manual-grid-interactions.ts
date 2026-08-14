export interface HorizontalScrollMetrics {
  readonly clientWidth: number;
  readonly scrollLeft: number;
  readonly scrollWidth: number;
}

export interface HorizontalScrollState {
  readonly canScrollLeft: boolean;
  readonly canScrollRight: boolean;
  readonly isOverflowing: boolean;
  readonly progress: number;
}

const boundaryTolerance = 1;

export function getHorizontalScrollState(metrics: HorizontalScrollMetrics): HorizontalScrollState {
  const maximumScroll = Math.max(0, metrics.scrollWidth - metrics.clientWidth);
  if (maximumScroll <= boundaryTolerance) {
    return {
      canScrollLeft: false,
      canScrollRight: false,
      isOverflowing: false,
      progress: 0,
    };
  }

  const scrollLeft = Math.min(maximumScroll, Math.max(0, metrics.scrollLeft));
  const canScrollLeft = scrollLeft > boundaryTolerance;
  const canScrollRight = maximumScroll - scrollLeft > boundaryTolerance;

  return {
    canScrollLeft,
    canScrollRight,
    isOverflowing: true,
    progress: canScrollLeft ? (canScrollRight ? scrollLeft / maximumScroll : 1) : 0,
  };
}

export function getManualGridScrollHint(state: HorizontalScrollState, columnCount: number): string {
  if (!state.isOverflowing) {
    return `${columnCount} 天排班均已显示`;
  }
  if (!state.canScrollLeft) {
    return '向左滑动查看其余日期，人员列保持固定';
  }
  if (!state.canScrollRight) {
    return '向右滑动返回较早日期，人员列保持固定';
  }
  return `左右滑动查看全部 ${columnCount} 天，人员列保持固定`;
}
