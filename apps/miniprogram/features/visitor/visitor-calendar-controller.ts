import type {
  GuestCalendarReadModel,
  HolidayReadModel,
  VisitorResolveResponse,
} from '@schedule/contracts';

import { ApiClientError } from '../../api/client.js';
import { addBusinessMonths, parseBusinessDate } from '../calendar/calendar-logic.js';
import {
  buildCalendarMonthViewModel,
  type CalendarMonthDataViewModel,
} from '../calendar/calendar-view-model.js';

export type VisitorCalendarStatus = 'error' | 'loading' | 'ready';

export interface VisitorCalendarState {
  readonly businessMonth: string;
  readonly errorMessage?: string;
  readonly groupName?: string;
  readonly status: VisitorCalendarStatus;
  readonly viewModel?: CalendarMonthDataViewModel;
}

export interface VisitorCalendarControllerDependencies {
  getGuestCalendar(
    groupId: string,
    visitorKey: string,
    businessMonth: string,
  ): Promise<GuestCalendarReadModel>;
  getGuestHolidays(year: number): Promise<HolidayReadModel>;
  getToday(): string;
  publish?(state: VisitorCalendarState): void;
  resolveGuestGroup(visitorKey: string): Promise<VisitorResolveResponse>;
}

export interface VisitorCalendarController {
  readonly state: VisitorCalendarState;
  activate(scene: unknown): Promise<void>;
  changeMonth(delta: number): Promise<void>;
  dispose(): void;
}

interface VisitorContext {
  readonly groupId: string;
  readonly groupName: string;
  readonly visitorKey: string;
}

const visitorKeyPattern = /^[\da-f]{32}$/iu;

export function parseVisitorScene(scene: unknown): string | undefined {
  if (typeof scene !== 'string' || scene.length === 0) return undefined;
  try {
    const decoded = decodeURIComponent(scene);
    return visitorKeyPattern.test(decoded) ? decoded : undefined;
  } catch {
    return undefined;
  }
}

function initialMonth(getToday: () => string): string {
  const today = getToday();
  return /^\d{4}-\d{2}-\d{2}$/u.test(today) ? today.slice(0, 7) : '1970-01';
}

function errorMessageFor(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.status === 404 || error.code === 'NOT_FOUND') return '访客链接已失效或群组不可用。';
    if (error.status === 429 || error.code === 'RATE_LIMITED') return '访问过于频繁，请稍后重试。';
  }
  return '访客日历暂时无法加载，请稍后重试。';
}

function toPublicCalendar(response: GuestCalendarReadModel): GuestCalendarReadModel['calendar'] {
  return {
    ...response.calendar,
    assignments: response.calendar.assignments.map((assignment) => ({
      ...assignment,
      changeMarkers: [],
    })),
  };
}

function createUnavailableHolidays(year: number): HolidayReadModel {
  return { confirmed: false, dates: [], year };
}

function isHolidayResultForYear(value: HolidayReadModel, year: number): boolean {
  if (value.year !== year) return false;
  try {
    return value.dates.every(({ date }) => parseBusinessDate(date).year === year);
  } catch {
    return false;
  }
}

export function createVisitorCalendarController(
  dependencies: VisitorCalendarControllerDependencies,
): VisitorCalendarController {
  let generation = 0;
  let context: VisitorContext | undefined;
  let state: VisitorCalendarState = {
    businessMonth: initialMonth(dependencies.getToday),
    status: 'loading',
  };

  const isCurrent = (operationGeneration: number, targetContext?: VisitorContext): boolean =>
    generation === operationGeneration &&
    (targetContext === undefined || targetContext === context);
  const publish = (next: VisitorCalendarState): void => {
    state = next;
    dependencies.publish?.(next);
  };
  const loadMonth = async (
    operationGeneration: number,
    targetContext: VisitorContext,
    businessMonth: string,
  ): Promise<void> => {
    publish({ businessMonth, groupName: targetContext.groupName, status: 'loading' });
    try {
      const response = await dependencies.getGuestCalendar(
        targetContext.groupId,
        targetContext.visitorKey,
        businessMonth,
      );
      if (!isCurrent(operationGeneration, targetContext)) return;
      const calendar = toPublicCalendar(response);
      if (calendar.groupId !== targetContext.groupId || calendar.businessMonth !== businessMonth) {
        publish({
          businessMonth,
          errorMessage: '访客链接已失效或群组不可用。',
          status: 'error',
        });
        return;
      }
      const year = Number(businessMonth.slice(0, 4));
      const publishReady = (holidays: HolidayReadModel): void => {
        publish({
          businessMonth,
          groupName: response.groupName,
          status: 'ready',
          viewModel: buildCalendarMonthViewModel({
            calendar,
            filters: {},
            holidays,
            status: 'ready',
            today: dependencies.getToday(),
          }),
        });
      };
      publishReady(createUnavailableHolidays(year));

      let holidayResponse: Promise<HolidayReadModel>;
      try {
        holidayResponse = dependencies.getGuestHolidays(year);
      } catch {
        return;
      }
      void Promise.resolve(holidayResponse)
        .then((holidays) => {
          if (
            !isCurrent(operationGeneration, targetContext) ||
            state.businessMonth !== businessMonth ||
            state.status !== 'ready' ||
            !isHolidayResultForYear(holidays, year)
          ) {
            return;
          }
          publishReady(holidays);
        })
        .catch(() => undefined);
    } catch (error) {
      if (!isCurrent(operationGeneration, targetContext)) return;
      publish({ businessMonth, errorMessage: errorMessageFor(error), status: 'error' });
    }
  };

  return {
    get state() {
      return state;
    },
    activate: async (scene) => {
      const operationGeneration = ++generation;
      context = undefined;
      const businessMonth = initialMonth(dependencies.getToday);
      const visitorKey = parseVisitorScene(scene);
      if (visitorKey === undefined) {
        publish({
          businessMonth,
          errorMessage: '请扫描群主或管理员分享的群组小程序码。',
          status: 'error',
        });
        return;
      }
      publish({ businessMonth, status: 'loading' });
      try {
        const resolved = await dependencies.resolveGuestGroup(visitorKey);
        if (!isCurrent(operationGeneration)) return;
        const nextContext: VisitorContext = {
          groupId: resolved.groupId,
          groupName: resolved.groupName,
          visitorKey,
        };
        context = nextContext;
        await loadMonth(operationGeneration, nextContext, businessMonth);
      } catch (error) {
        if (!isCurrent(operationGeneration)) return;
        publish({ businessMonth, errorMessage: errorMessageFor(error), status: 'error' });
      }
    },
    changeMonth: (delta) => {
      if (!Number.isInteger(delta) || delta === 0 || context === undefined)
        return Promise.resolve();
      const operationGeneration = ++generation;
      const targetContext = context;
      return loadMonth(
        operationGeneration,
        targetContext,
        addBusinessMonths(state.businessMonth, delta),
      );
    },
    dispose: () => {
      generation += 1;
      context = undefined;
    },
  };
}
