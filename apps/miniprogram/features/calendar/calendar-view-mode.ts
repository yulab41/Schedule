import { addBusinessMonths } from './calendar-logic.js';
import {
  addWeeks,
  getBusinessMonthOf,
  getBusinessMonthsForWeek,
  getVisibleWeekForMonth,
  getWeekStartDate,
} from './calendar-views.js';

export type CalendarViewMode = 'list' | 'month' | 'week';

export interface CalendarViewModeState {
  readonly businessMonth: string;
  readonly mode: CalendarViewMode;
  readonly weekStart: string;
}

export type CalendarMonthSlots = readonly [string, string, string];

export function createCalendarViewModeState(today: string): CalendarViewModeState {
  return {
    businessMonth: getBusinessMonthOf(today),
    mode: 'month',
    weekStart: getWeekStartDate(today),
  };
}

export function switchCalendarViewMode(
  state: CalendarViewModeState,
  mode: CalendarViewMode,
  today: string,
): CalendarViewModeState {
  if (mode === 'week') {
    let weekStart = state.weekStart;
    try {
      weekStart =
        getWeekStartDate(state.weekStart) === state.weekStart &&
        getBusinessMonthsForWeek(state.weekStart).includes(state.businessMonth)
          ? state.weekStart
          : getVisibleWeekForMonth(state.businessMonth, today);
    } catch {
      weekStart = getVisibleWeekForMonth(state.businessMonth, today);
    }
    return {
      ...state,
      mode,
      weekStart,
    };
  }
  return { ...state, mode };
}

export function stepCalendarMonth(
  state: CalendarViewModeState,
  delta: number,
  today: string,
): CalendarViewModeState {
  if (state.mode === 'week') {
    throw new Error('Month stepping is not available in week mode.');
  }
  const businessMonth = addBusinessMonths(state.businessMonth, delta);
  return {
    ...state,
    businessMonth,
    weekStart: getVisibleWeekForMonth(businessMonth, today),
  };
}

export function stepCalendarWeek(
  state: CalendarViewModeState,
  delta: number,
): CalendarViewModeState {
  if (state.mode !== 'week') {
    throw new Error('Week stepping requires week mode.');
  }
  const weekStart = addWeeks(state.weekStart, delta);
  return { ...state, businessMonth: getBusinessMonthOf(weekStart), weekStart };
}

export function recenterMonthSlots(businessMonth: string): CalendarMonthSlots {
  return [addBusinessMonths(businessMonth, -1), businessMonth, addBusinessMonths(businessMonth, 1)];
}

export function rotateMonthSlots(
  slots: CalendarMonthSlots,
  swiperIndex: 0 | 2,
): CalendarMonthSlots {
  if (swiperIndex !== 0 && swiperIndex !== 2) {
    throw new Error('Swiper index must be 0 or 2.');
  }
  if (swiperIndex === 0) {
    return [addBusinessMonths(slots[0], -1), slots[0], slots[1]];
  }
  return [slots[1], slots[2], addBusinessMonths(slots[2], 1)];
}
