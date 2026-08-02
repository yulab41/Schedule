import { describe, expect, it } from 'vitest';

import type { StatisticsSummary } from '@schedule/contracts';

import { buildScheduleCsv, buildStatisticsCsv, toCsv } from './csv-builder.js';

const emptySummary: StatisticsSummary = {
  actualCount: 0,
  byRole: [],
  byShiftType: [],
  countedActualCount: 0,
  countedPlannedCount: 0,
  deductionCount: 0,
  holidayCount: 0,
  leaveCoverCount: 0,
  manualAdjustmentCount: 0,
  members: [],
  netDutyAdjustment: 0,
  overtimeCount: 0,
  plannedCount: 0,
  swapCount: 0,
  weekendCount: 0,
};

describe('csv builder', () => {
  it('builds schedule CSV without phone or audit columns and escapes cells', () => {
    const csv = buildScheduleCsv([
      {
        actualMemberName: null,
        businessDate: '2026-10-01',
        crossesMidnight: false,
        plannedMemberName: 'A, Doctor',
        scheduleRoleName: 'Primary',
        shiftEndTime: '20:00',
        shiftStartTime: '08:00',
        shiftTypeAbbreviation: '白',
        shiftTypeName: '白班',
        slotPosition: 1,
      },
    ]);

    expect(csv).toContain('日期,星期,角色,班种');
    expect(csv).not.toMatch(/电话|手机|短号|audit|审计/u);
    expect(csv).toContain('"A, Doctor"');
    expect(csv).toContain('周四');
    expect(csv).toContain('"A, Doctor","A, Doctor",否');
  });

  it('builds statistics CSV with per-member rows and totals', () => {
    const summary: StatisticsSummary = {
      ...emptySummary,
      actualCount: 2,
      countedActualCount: 2,
      countedPlannedCount: 2,
      members: [
        {
          actualCount: 2,
          actualVsPlanned: [],
          byRole: [],
          byShiftType: [],
          countedActualCount: 2,
          countedPlannedCount: 2,
          deductionCount: 0,
          deltaCount: 0,
          holidayCount: 1,
          leaveCoverCount: 0,
          manualAdjustmentCount: 0,
          membershipId: 'member-1',
          netDutyAdjustment: 0,
          overtimeCount: 0,
          plannedCount: 2,
          realName: 'A Doctor',
          swapCount: 0,
          weekendCount: 1,
        },
      ],
      plannedCount: 2,
      weekendCount: 1,
      holidayCount: 1,
    };

    const csv = buildStatisticsCsv(summary);
    expect(csv).toContain('成员,计划班次,实际值班');
    expect(csv).toContain('A Doctor,2,2,2,1,1');
    expect(csv).toContain('合计,2,2,2,1,1');
    expect(csv).not.toMatch(/电话|手机|短号/u);
  });

  it('escapes quotes and newlines in CSV cells', () => {
    expect(toCsv([['a"b', 'c\nd']])).toBe('"a""b","c\nd"\r\n');
  });
});
