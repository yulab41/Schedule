import { getChinaStandardTimeBusinessDate } from '@schedule/scheduling-domain';
import { breakpointTokens } from '@schedule/ui-tokens';

export {
  addWeeks,
  buildDayList,
  getBusinessMonthOf,
  getCalendarPanelMonths,
  getCalendarPanelWeeks,
  getDefaultSelectedDate,
  getMultiDayHolidayDates,
  getPreferredViewMode,
  getVisibleWeekForMonth,
  getWeekBusinessMonths,
  getWeekDays,
  getWeekIndexForToday,
  getWeekLabel,
  getWeekOfMonthLabel,
  getWeekStartDate,
  getWeekdayLabel,
  groupAssignmentsByDate,
  isWeekend,
  parseBusinessDate,
  retargetSelectedDateToMonth,
  truncateCalendarBadgeLabel,
  type CalendarGridWeek,
  type CalendarViewMode,
  type DayListEntry,
  type DefaultSelectedDateInput,
} from '@schedule/presentation-core';

export type PointerPreference = 'coarse' | 'fine';

export interface SwipeDelta {
  readonly deltaX: number;
  readonly deltaY: number;
}

export interface SwipeRelease extends SwipeDelta {
  readonly elapsedMs: number;
  readonly viewportWidth: number;
}

export interface SwipeSettleInput {
  readonly deltaX: number;
  readonly direction: SwipeMonthIntent;
  readonly elapsedMs: number;
  readonly reducedMotion: boolean;
  readonly viewportWidth: number;
}

export type SwipeMonthIntent = -1 | 0 | 1;

export function getBusinessDate(date: Date = new Date()): string {
  return getChinaStandardTimeBusinessDate(date);
}

export function getSwipeMonthIntent({ deltaX, deltaY }: SwipeDelta): SwipeMonthIntent {
  const horizontalDistance = Math.abs(deltaX);
  const verticalDistance = Math.abs(deltaY);
  if (horizontalDistance < 56 || horizontalDistance < verticalDistance * 1.2) return 0;
  return deltaX < 0 ? 1 : -1;
}

export function getSwipeNavigationIntent({
  deltaX,
  deltaY,
  elapsedMs,
  viewportWidth,
}: SwipeRelease): SwipeMonthIntent {
  const horizontalDistance = Math.abs(deltaX);
  const verticalDistance = Math.abs(deltaY);
  if (horizontalDistance < 18 || horizontalDistance < verticalDistance * 1.15) return 0;

  const distanceThreshold = Math.min(88, Math.max(56, viewportWidth * 0.2));
  const velocity = horizontalDistance / Math.max(elapsedMs, 16);
  const isFlick = horizontalDistance >= 20 && velocity >= 0.55;
  if (horizontalDistance < distanceThreshold && !isFlick) return 0;
  return deltaX < 0 ? 1 : -1;
}

export function getSwipeSettleDuration({
  deltaX,
  direction,
  elapsedMs,
  reducedMotion,
  viewportWidth,
}: SwipeSettleInput): number {
  if (reducedMotion) return 0;

  const distance = Math.min(Math.abs(deltaX), viewportWidth);
  const velocity = distance / Math.max(elapsedMs, 16);
  if (direction === 0) {
    return Math.round(Math.min(380, Math.max(280, 300 + distance * 0.25 - velocity * 60)));
  }

  const remainingDistance = Math.max(0, viewportWidth - distance);
  return Math.round(
    Math.min(380, Math.max(180, remainingDistance / Math.max(1.2, velocity * 1.5))),
  );
}

export function getViewportTier(viewportWidth: number): 'desktop' | 'mobile' | 'tablet' {
  if (viewportWidth >= breakpointTokens.desktop) return 'desktop';
  return viewportWidth >= breakpointTokens.mobile ? 'tablet' : 'mobile';
}

export function getListDateScrollTop(input: {
  readonly currentScrollY: number;
  readonly elementTop: number;
  readonly stickyOffset: number;
  readonly viewportHeight: number;
}): number {
  const availableHeight = Math.max(0, input.viewportHeight - input.stickyOffset);
  return Math.max(
    0,
    input.currentScrollY + input.elementTop - input.stickyOffset - availableHeight / 3,
  );
}
