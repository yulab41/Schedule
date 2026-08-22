import type { CalendarDutyAssignment, ConfirmedHolidayDate } from '@schedule/contracts';
import {
  addBusinessMonths as addSharedBusinessMonths,
  addWeeks as addSharedWeeks,
  buildDayList as buildSharedDayList,
  buildMonthDisplayGrid as buildSharedMonthDisplayGrid,
  filterCalendarAssignments as filterSharedCalendarAssignments,
  getBusinessMonthLabel as getSharedBusinessMonthLabel,
  getBusinessMonthOf as getSharedBusinessMonthOf,
  getCalendarPanelMonths as getSharedCalendarPanelMonths,
  getCalendarPanelWeeks as getSharedCalendarPanelWeeks,
  getDefaultSelectedDate as getSharedDefaultSelectedDate,
  getDutyMemberName as getSharedDutyMemberName,
  getDutyMembershipId as getSharedDutyMembershipId,
  getMultiDayHolidayDates as getSharedMultiDayHolidayDates,
  getPreferredViewMode as getSharedPreferredViewMode,
  getVisibleWeekForMonth as getSharedVisibleWeekForMonth,
  getWeekBusinessMonths as getSharedWeekBusinessMonths,
  getWeekDays as getSharedWeekDays,
  getWeekIndexForToday as getSharedWeekIndexForToday,
  getWeekLabel as getSharedWeekLabel,
  getWeekOfMonthLabel as getSharedWeekOfMonthLabel,
  getWeekStartDate as getSharedWeekStartDate,
  getWeekdayLabel as getSharedWeekdayLabel,
  groupAssignmentsByDate as groupSharedAssignmentsByDate,
  isPastBusinessDate as isSharedPastBusinessDate,
  isWeekend as isSharedWeekend,
  parseBusinessDate as parseSharedBusinessDate,
  retargetSelectedDateToMonth as retargetSharedSelectedDateToMonth,
  truncateCalendarBadgeLabel as truncateSharedCalendarBadgeLabel,
} from '@schedule/presentation-core';
import {
  calendarGoldenAssignments,
  calendarGoldenHolidays,
  calendarGoldenMonths,
} from '@schedule/presentation-core/testing';
import { describe, expect, it } from 'vitest';

import {
  addBusinessMonths as addLegacyBusinessMonths,
  filterCalendarAssignments as filterLegacyCalendarAssignments,
  getBusinessMonthLabel as getLegacyBusinessMonthLabel,
  getDutyMemberName as getLegacyDutyMemberName,
  getDutyMembershipId as getLegacyDutyMembershipId,
  isPastBusinessDate as isLegacyPastBusinessDate,
} from './calendar-logic.js';
import {
  addWeeks as addLegacyWeeks,
  buildDayList as buildLegacyDayList,
  getBusinessMonthOf as getLegacyBusinessMonthOf,
  getCalendarPanelMonths as getLegacyCalendarPanelMonths,
  getCalendarPanelWeeks as getLegacyCalendarPanelWeeks,
  getDefaultSelectedDate as getLegacyDefaultSelectedDate,
  getMultiDayHolidayDates as getLegacyMultiDayHolidayDates,
  getPreferredViewMode as getLegacyPreferredViewMode,
  getVisibleWeekForMonth as getLegacyVisibleWeekForMonth,
  getWeekBusinessMonths as getLegacyWeekBusinessMonths,
  getWeekDays as getLegacyWeekDays,
  getWeekIndexForToday as getLegacyWeekIndexForToday,
  getWeekLabel as getLegacyWeekLabel,
  getWeekOfMonthLabel as getLegacyWeekOfMonthLabel,
  getWeekStartDate as getLegacyWeekStartDate,
  getWeekdayLabel as getLegacyWeekdayLabel,
  groupAssignmentsByDate as groupLegacyAssignmentsByDate,
  isWeekend as isLegacyWeekend,
  parseBusinessDate as parseLegacyBusinessDate,
  retargetSelectedDateToMonth as retargetLegacySelectedDateToMonth,
  truncateCalendarBadgeLabel as truncateLegacyCalendarBadgeLabel,
} from './calendar-views.js';
import { buildMonthDisplayGrid as buildLegacyMonthDisplayGrid } from './month-grid-presentation.js';

const assignments: readonly CalendarDutyAssignment[] = calendarGoldenAssignments;
const holidays: ReadonlyMap<string, ConfirmedHolidayDate> = new Map(calendarGoldenHolidays);

function entries<Value>(value: ReadonlyMap<string, readonly Value[]>): readonly unknown[] {
  return [...value.entries()];
}

function outcome(run: () => unknown): unknown {
  try {
    return { ok: true, value: run() };
  } catch (error) {
    return { message: error instanceof Error ? error.message : String(error), ok: false };
  }
}

describe('presentation-core calendar equivalence', () => {
  it('matches the production five/six-week and leap-month display grids', () => {
    for (const businessMonth of calendarGoldenMonths) {
      expect(buildSharedMonthDisplayGrid(businessMonth)).toEqual(
        buildLegacyMonthDisplayGrid(businessMonth),
      );
    }

    for (const invalidMonth of ['2026-8', '2026-13', 'not-a-month']) {
      expect(outcome(() => buildSharedMonthDisplayGrid(invalidMonth))).toEqual(
        outcome(() => buildLegacyMonthDisplayGrid(invalidMonth)),
      );
    }
    expect(outcome(() => addSharedBusinessMonths('2026-8', 1))).toEqual(
      outcome(() => addLegacyBusinessMonths('2026-8', 1)),
    );
  });

  it('preserves month/date validation, labels, clamping, and panel selection', () => {
    const monthDeltas = [
      ['2026-01', -1],
      ['2026-08', 3],
      ['2026-12', 1],
    ] as const;
    for (const [businessMonth, delta] of monthDeltas) {
      expect(addSharedBusinessMonths(businessMonth, delta)).toBe(
        addLegacyBusinessMonths(businessMonth, delta),
      );
      expect(getSharedBusinessMonthLabel(businessMonth)).toBe(
        getLegacyBusinessMonthLabel(businessMonth),
      );
      expect(getSharedCalendarPanelMonths(businessMonth)).toEqual(
        getLegacyCalendarPanelMonths(businessMonth),
      );
    }

    for (const selectedDate of ['2026-08-14', '2026-01-31', '2028-01-31']) {
      const targetMonth = selectedDate.startsWith('2026-08') ? '2026-09' : '2028-02';
      expect(retargetSharedSelectedDateToMonth(selectedDate, targetMonth)).toBe(
        retargetLegacySelectedDateToMonth(selectedDate, targetMonth),
      );
    }

    for (const value of ['2026-08-14', '2028-02-29', '2026-02-29', '2026-8-1']) {
      expect(outcome(() => parseSharedBusinessDate(value))).toEqual(
        outcome(() => parseLegacyBusinessDate(value)),
      );
    }
  });

  it('matches default selection and actual-before-planned member semantics', () => {
    const defaultInputs = [
      { businessMonth: '2026-08', today: '2026-08-14' },
      { businessMonth: '2026-09', today: '2026-08-14' },
      { businessMonth: '2026-11', today: '2026-08-14' },
    ] as const;
    for (const input of defaultInputs) {
      expect(getSharedDefaultSelectedDate({ assignments, ...input })).toBe(
        getLegacyDefaultSelectedDate({ assignments, ...input }),
      );
    }

    for (const assignment of assignments) {
      expect(getSharedDutyMembershipId(assignment)).toBe(getLegacyDutyMembershipId(assignment));
      expect(getSharedDutyMemberName(assignment)).toBe(getLegacyDutyMemberName(assignment));
    }
    const explicitEmptyActual = {
      actualMemberName: '',
      actualMembershipId: '',
      plannedMemberName: '计划人员',
      plannedMembershipId: 'planned-member',
    };
    expect(getSharedDutyMembershipId(explicitEmptyActual)).toBe(
      getLegacyDutyMembershipId(explicitEmptyActual),
    );
    expect(getSharedDutyMemberName(explicitEmptyActual)).toBe(
      getLegacyDutyMemberName(explicitEmptyActual),
    );
  });

  it('matches filtering, CST shift ordering, and list grouping without cloning assignments', () => {
    const filters = [
      {},
      { membershipIds: ['member-actual'] },
      { onlyChanges: true },
      { roleIds: ['role-a'] },
      { shiftTypeIds: ['shift-p'] },
      { membershipIds: ['member-planned'], onlyChanges: true, roleIds: ['role-a'] },
    ] as const;
    for (const filter of filters) {
      const shared = filterSharedCalendarAssignments(assignments, filter);
      const legacy = filterLegacyCalendarAssignments(assignments, filter);
      expect(shared).toEqual(legacy);
      if (shared[0] !== undefined) expect(assignments).toContain(shared[0]);
    }

    const originalAssignmentOrder = assignments.map((assignment) => assignment.id);
    const sharedGroups = groupSharedAssignmentsByDate(assignments);
    expect(entries(sharedGroups)).toEqual(entries(groupLegacyAssignmentsByDate(assignments)));
    expect(assignments.map((assignment) => assignment.id)).toEqual(originalAssignmentOrder);
    expect(sharedGroups.get('2026-08-01')?.[0]).toBe(assignments[0]);
    expect(buildSharedDayList(assignments, '2026-08-01')).toEqual(
      buildLegacyDayList(assignments, '2026-08-01'),
    );
  });

  it('matches continuous weeks, labels, weekends, holidays, and compact badges', () => {
    for (const businessDate of ['2026-07-30', '2026-08-10', '2026-08-31']) {
      expect(getSharedBusinessMonthOf(businessDate)).toBe(getLegacyBusinessMonthOf(businessDate));
      expect(getSharedWeekStartDate(businessDate)).toBe(getLegacyWeekStartDate(businessDate));
      expect(getSharedWeekDays(businessDate)).toEqual(getLegacyWeekDays(businessDate));
      expect(getSharedCalendarPanelWeeks(businessDate)).toEqual(
        getLegacyCalendarPanelWeeks(businessDate),
      );
      expect(getSharedWeekBusinessMonths(businessDate)).toEqual(
        getLegacyWeekBusinessMonths(businessDate),
      );
      expect(getSharedWeekLabel(businessDate)).toBe(getLegacyWeekLabel(businessDate));
      expect(getSharedWeekOfMonthLabel(businessDate)).toBe(getLegacyWeekOfMonthLabel(businessDate));
      expect(getSharedWeekdayLabel(businessDate)).toBe(getLegacyWeekdayLabel(businessDate));
      expect(isSharedWeekend(businessDate)).toBe(isLegacyWeekend(businessDate));
    }

    expect([...getSharedMultiDayHolidayDates(holidays)]).toEqual([
      ...getLegacyMultiDayHolidayDates(holidays),
    ]);
    for (const label of ['全天班', 'AM', 'DAY']) {
      expect(truncateSharedCalendarBadgeLabel(label)).toBe(truncateLegacyCalendarBadgeLabel(label));
    }
  });

  it('matches week navigation, today location, and pure presentation defaults', () => {
    expect(addSharedWeeks('2026-08-03', -1)).toBe(addLegacyWeeks('2026-08-03', -1));
    expect(addSharedWeeks('2026-08-05', 1)).toBe(addLegacyWeeks('2026-08-05', 1));
    expect(outcome(() => addSharedWeeks('2026-08-05', 0.5))).toEqual(
      outcome(() => addLegacyWeeks('2026-08-05', 0.5)),
    );
    expect(getSharedVisibleWeekForMonth('2026-08', '2026-08-14')).toBe(
      getLegacyVisibleWeekForMonth('2026-08', '2026-08-14'),
    );
    const weeks = buildLegacyMonthDisplayGrid('2026-08').map((week) =>
      week.map((cell) => ({ businessDate: cell.businessDate })),
    );
    expect(getSharedWeekIndexForToday(weeks, '2026-08-14')).toBe(
      getLegacyWeekIndexForToday(weeks, '2026-08-14'),
    );
    expect(getSharedPreferredViewMode()).toBe(getLegacyPreferredViewMode());
    expect(isSharedPastBusinessDate('2026-08-03', '2026-08-04')).toBe(
      isLegacyPastBusinessDate('2026-08-03', '2026-08-04'),
    );
  });
});
