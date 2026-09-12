import { describe, expect, it } from 'vitest';
import { calendarApiGoldenResponse, holidayApiGoldenResponse } from '@schedule/client-core/testing';
import {
  createWorkbenchViewModel,
  emptyWorkbenchFilters,
} from '../src/features/workbench/workbench-model.ts';
import {
  reconcileShiftCardExpansion,
  toggleShiftCardExpansion,
} from '../src/features/workbench/shift-card-expansion.ts';
import { isNurseCalendarGroup } from '../src/features/workbench/nurse-duty-state.ts';

const codes = ['A', '电脑', 'NP', 'P', 'D', 'N'];
const clock = {
  A: ['08:00', '15:30'],
  电脑: ['08:00', '17:30'],
  D: ['08:00', '17:30'],
  P: ['15:30', '22:00'],
  N: ['22:00', '08:00'],
  NP: ['17:30', '11:00'],
};
function fixture() {
  const base = calendarApiGoldenResponse.assignments[0];
  return {
    ...calendarApiGoldenResponse,
    assignments: codes.flatMap((code) =>
      [2, 1].map((slotPosition) => ({
        ...base,
        id: `${code}-${slotPosition}`,
        businessDate: '2026-09-12',
        slotPosition,
        shiftTypeId: code,
        shiftTypeName: `${code}班`,
        shiftTypeAbbreviation: code,
        startsAt: `2026-09-12T${clock[code][0]}:00+08:00`,
        endsAt: `2026-09-${code === 'N' || code === 'NP' ? '13' : '12'}T${clock[code][1]}:00+08:00`,
        actualMemberName: `人员${slotPosition}`,
        actualMembershipId: `member-${slotPosition}`,
      })),
    ),
    shiftTypes: codes.map((code) => ({
      ...calendarApiGoldenResponse.shiftTypes[0],
      id: code,
      name: `${code}班`,
      abbreviation: code,
      isAllDay: false,
    })),
  };
}
function view(calendar = fixture(), overrides = {}, filters = emptyWorkbenchFilters) {
  return createWorkbenchViewModel(
    calendar,
    holidayApiGoldenResponse,
    '2026-09-12',
    '2026-09',
    '2026-09-07',
    filters,
    '2026-09-12',
    { nursePreset: true, now: new Date('2026-09-12T12:30:00+08:00'), ...overrides },
  );
}
describe('feedback12 nurse calendar', () => {
  it('scopes nurse presets to the approved group rather than matching generic shift names', () => {
    expect(isNurseCalendarGroup('头颈外科护士')).toBe(true);
    expect(isNurseCalendarGroup('头颈外科医生')).toBe(false);
    expect(isNurseCalendarGroup('其他护士群')).toBe(false);
  });
  it('keeps manual expansion within a context and resets it on navigation', () => {
    const groups = view().selectedDetails;
    let state = reconcileShiftCardExpansion(undefined, ['group', '2026-09-12', 'month'], groups);
    expect(state.expanded.D).toBe(false);
    state = toggleShiftCardExpansion(state, 'D');
    expect(
      reconcileShiftCardExpansion(state, ['group', '2026-09-12', 'month'], groups).expanded.D,
    ).toBe(true);
    expect(
      reconcileShiftCardExpansion(state, ['group', '2026-09-12', 'week'], groups).expanded.D,
    ).toBe(false);
    expect(
      reconcileShiftCardExpansion(state, ['other', '2026-09-12', 'month'], groups).expanded.D,
    ).toBe(false);
    expect(
      reconcileShiftCardExpansion(undefined, ['group', '2026-09-12', 'month'], groups).expanded.D,
    ).toBe(false);
  });
  it('changes defaults at the next work boundary without erasing a manual choice', () => {
    const groups = view().selectedDetails;
    let state = reconcileShiftCardExpansion(undefined, ['same'], groups);
    const later = view(fixture(), { now: new Date('2026-09-12T14:30:00+08:00') }).selectedDetails;
    expect(reconcileShiftCardExpansion(state, ['same'], later).expanded.D).toBe(true);
    state = toggleShiftCardExpansion(toggleShiftCardExpansion(state, 'D'), 'D');
    expect(reconcileShiftCardExpansion(state, ['same'], later).expanded.D).toBe(false);
    expect(view().nextDutyBoundary).toBe(Date.parse('2026-09-12T14:30:00+08:00'));
  });
  it('uses the saved default, sorts slots, groups names and exposes month badges', () => {
    const result = view(fixture(), { effectiveMonthShiftTypeId: '电脑' });
    expect(result.monthPanels[1].cells.find((c) => c.businessDate === '2026-09-12')).toMatchObject({
      person: '人员1',
      extraPersonCount: 1,
      shiftAbbreviation: '电脑',
    });
    expect(result.selectedDetails.map((g) => g.key)).toEqual(['电脑', 'D', 'A', 'P', 'N', 'NP']);
    expect(result.selectedDetails[0].rows.map((r) => r.key)).toEqual(['电脑-1', '电脑-2']);
    expect(result.weekPanels[1].days[5].shiftGroups.map((g) => g.key)).toEqual([
      '电脑',
      'D',
      'A',
      'P',
      'N',
      'NP',
    ]);
    expect(result.listPanels[1].days[0].duties.map((d) => d.key)).toEqual([
      '电脑-1',
      '电脑-2',
      'D-1',
      'D-2',
      'A-1',
      'A-2',
      'P-1',
      'P-2',
      'N-1',
      'N-2',
      'NP-1',
      'NP-2',
    ]);
    expect(result.weekPanels[1].height).toBeGreaterThan(112);
  });
  it('falls back within the active filters when the preferred shift is absent', () => {
    const calendar = fixture();
    calendar.assignments = calendar.assignments.filter((a) => a.shiftTypeId !== '电脑');
    expect(
      view(calendar, { effectiveMonthShiftTypeId: '电脑' }).monthPanels[1].cells.find(
        (c) => c.businessDate === '2026-09-12',
      ).shiftAbbreviation,
    ).toBe('D');
    expect(
      view(
        calendar,
        { effectiveMonthShiftTypeId: '电脑' },
        { ...emptyWorkbenchFilters, shiftTypeIds: ['P'] },
      ).monthPanels[1].cells.find((c) => c.businessDate === '2026-09-12').shiftAbbreviation,
    ).toBe('P');
  });
  it.each([
    ['D', '2026-09-12T07:59:59', 'before'],
    ['D', '2026-09-12T08:00:00', 'working'],
    ['D', '2026-09-12T12:00:00', 'rest'],
    ['电脑', '2026-09-12T14:29:59', 'rest'],
    ['电脑', '2026-09-12T14:30:00', 'working'],
    ['D', '2026-09-12T17:30:00', 'done'],
    ['A', '2026-09-12T15:30:00', 'done'],
    ['P', '2026-09-12T15:30:00', 'working'],
    ['P', '2026-09-12T22:00:00', 'done'],
    ['N', '2026-09-12T22:00:00', 'working'],
    ['N', '2026-09-13T07:59:59', 'working'],
    ['N', '2026-09-13T08:00:00', 'done'],
    ['NP', '2026-09-12T17:29:59', 'before'],
    ['NP', '2026-09-12T17:30:00', 'working'],
    ['NP', '2026-09-12T22:00:00', 'rest'],
    ['NP', '2026-09-13T06:59:59', 'rest'],
    ['NP', '2026-09-13T07:00:00', 'working'],
    ['NP', '2026-09-13T11:00:00', 'done'],
  ])('%s at %s has exclusive state %s', (code, time, state) => {
    const result = view(fixture(), { now: new Date(time + '+08:00') });
    const group = result.selectedDetails.find((g) => g.key === code);
    expect(group.dutyState).toBe(state);
    expect(group.defaultCollapsed).toBe(state !== 'working');
    expect(result.listPanels[1].days[0].duties.find((d) => d.key === code + '-1').dutyState).toBe(
      state,
    );
  });
  it('does not apply nurse break presets to an unrelated group', () => {
    const group = view(fixture(), { nursePreset: false }).selectedDetails.find(
      (g) => g.key === 'D',
    );
    expect(group.dutyState).toBe('');
    expect(group.defaultCollapsed).toBe(false);
  });
  it('carries statutory working days through month, week and list even on a Sunday', () => {
    const calendar = fixture();
    calendar.assignments = calendar.assignments.map((a) => ({ ...a, businessDate: '2026-09-20' }));
    const result = createWorkbenchViewModel(
      calendar,
      {
        year: 2026,
        confirmed: true,
        dates: [{ date: '2026-09-20', holidayName: '国庆补班', isOffDay: false, isWorkday: true }],
      },
      '2026-09-20',
      '2026-09',
      '2026-09-14',
      emptyWorkbenchFilters,
      '2026-09-20',
    );
    expect(result.monthPanels[1].cells.find((c) => c.businessDate === '2026-09-20')).toMatchObject({
      isWorkday: true,
      isHoliday: false,
    });
    expect(result.weekPanels[1].days[6]).toMatchObject({ isWorkday: true, isHoliday: false });
    expect(result.listPanels[1].days[0]).toMatchObject({ isWorkday: true, isHoliday: false });
  });
});
