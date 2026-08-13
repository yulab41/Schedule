import { describe, expect, it } from 'vitest';

import {
  buildCalendarCacheNotice,
  buildCalendarSurfaceFilters,
  getCalendarFilterSummary,
  parseCalendarMonthPickerValue,
} from './calendar-page-ui.js';

describe('calendar page UI model', () => {
  it('summarizes zero, one, and many selected filter options without losing labels', () => {
    const options = [
      { id: 'role-1', label: '一线' },
      { id: 'role-2', label: '二线' },
      { id: 'role-3', label: '门诊' },
    ] as const;

    expect(getCalendarFilterSummary('岗位', options, [])).toBe('全部岗位');
    expect(getCalendarFilterSummary('岗位', options, ['role-2'])).toBe('二线');
    expect(getCalendarFilterSummary('岗位', options, ['role-1', 'role-3'])).toBe('岗位 2');
    expect(getCalendarFilterSummary('岗位', options, ['missing'])).toBe('岗位 1');
    expect(getCalendarFilterSummary('岗位', options, ['missing', 'also-missing'])).toBe('岗位 2');
  });

  it('accepts native month picker values with or without a day suffix', () => {
    expect(parseCalendarMonthPickerValue('2026-08')).toBe('2026-08');
    expect(parseCalendarMonthPickerValue('2026-08-13')).toBe('2026-08');
    expect(parseCalendarMonthPickerValue('2026-08-99')).toBeUndefined();
    expect(parseCalendarMonthPickerValue('2026-13')).toBeUndefined();
    expect(parseCalendarMonthPickerValue(202608)).toBeUndefined();
  });

  it('aggregates cache provenance from every month used by the active surface', () => {
    const slots = [
      {
        businessMonth: '2026-08',
        viewModel: {
          assignmentCount: 0,
          businessMonth: '2026-08',
          cacheSavedAt: '2026-08-13T06:00:00.000Z',
          filters: {
            members: [],
            onlyChanges: false,
            roles: [],
            selectedMembershipIds: [],
            selectedRoleIds: [],
            selectedShiftTypeIds: [],
            shiftTypes: [],
          },
          isMonthEmpty: true,
          isStale: false,
          monthLabel: '2026年8月',
          status: 'refreshing',
          weekdayLabels: ['一', '二', '三', '四', '五', '六', '日'],
          weeks: [],
        },
      },
      {
        businessMonth: '2026-09',
        viewModel: {
          assignmentCount: 0,
          businessMonth: '2026-09',
          cacheSavedAt: '2026-08-13T05:00:00.000Z',
          filters: {
            members: [],
            onlyChanges: false,
            roles: [],
            selectedMembershipIds: [],
            selectedRoleIds: [],
            selectedShiftTypeIds: [],
            shiftTypes: [],
          },
          isMonthEmpty: true,
          isStale: true,
          monthLabel: '2026年9月',
          status: 'cached',
          weekdayLabels: ['一', '二', '三', '四', '五', '六', '日'],
          weeks: [],
        },
      },
    ] as const;

    expect(buildCalendarCacheNotice(slots, ['2026-08', '2026-09'])).toEqual({
      savedAtText: '2026-08-13 13:00',
      stale: true,
    });
    expect(buildCalendarCacheNotice(slots, ['2026-08'])).toEqual({
      savedAtText: '2026-08-13 14:00',
      stale: false,
    });
    expect(buildCalendarCacheNotice(slots, ['2026-10'])).toBeUndefined();
  });

  it('unions filter options and selections from every loaded month used by a cross-month week', () => {
    const makeSlot = (
      businessMonth: string,
      filters: {
        readonly members: readonly { readonly id: string; readonly label: string }[];
        readonly roles: readonly { readonly id: string; readonly label: string }[];
        readonly selectedMembershipIds: readonly string[];
        readonly selectedRoleIds: readonly string[];
        readonly selectedShiftTypeIds: readonly string[];
        readonly shiftTypes: readonly { readonly id: string; readonly label: string }[];
      },
    ) => ({
      businessMonth,
      viewModel: {
        assignmentCount: 0,
        businessMonth,
        filters: { ...filters, onlyChanges: false },
        isMonthEmpty: true,
        monthLabel: businessMonth,
        status: 'ready' as const,
        weekdayLabels: ['一', '二', '三', '四', '五', '六', '日'] as const,
        weeks: [],
      },
    });
    const slots = [
      makeSlot('2026-08', {
        members: [{ id: 'member-a', label: '甲医生' }],
        roles: [{ id: 'role-a', label: '一线' }],
        selectedMembershipIds: ['member-a'],
        selectedRoleIds: [],
        selectedShiftTypeIds: ['shift-a'],
        shiftTypes: [{ id: 'shift-a', label: '全天班（全天）' }],
      }),
      makeSlot('2026-09', {
        members: [{ id: 'member-b', label: '乙医生' }],
        roles: [{ id: 'role-b', label: '二线' }],
        selectedMembershipIds: ['member-b'],
        selectedRoleIds: ['role-b'],
        selectedShiftTypeIds: [],
        shiftTypes: [{ id: 'shift-b', label: '夜班（夜）' }],
      }),
    ] as const;

    expect(buildCalendarSurfaceFilters(slots, ['2026-08', '2026-09'])).toEqual({
      members: [
        { id: 'member-a', label: '甲医生' },
        { id: 'member-b', label: '乙医生' },
      ],
      onlyChanges: false,
      roles: [
        { id: 'role-a', label: '一线' },
        { id: 'role-b', label: '二线' },
      ],
      selectedMembershipIds: ['member-a', 'member-b'],
      selectedRoleIds: ['role-b'],
      selectedShiftTypeIds: ['shift-a'],
      shiftTypes: [
        { id: 'shift-a', label: '全天班（全天）' },
        { id: 'shift-b', label: '夜班（夜）' },
      ],
    });
    expect(buildCalendarSurfaceFilters(slots, ['2026-08', '2026-10'])).toBeUndefined();
  });
});
