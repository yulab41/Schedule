import { describe, expect, it } from 'vitest';

import type { StatisticsMemberRow } from '@schedule/contracts';

import {
  formatNetDutyAdjustment,
  formatStatisticsMonthLabel,
  getMemberActualVsPlannedCount,
  sortMembersByActualCount,
  summarizeRecalculateMismatches,
} from './statistics-logic.js';

function member(overrides: Partial<StatisticsMemberRow> = {}): StatisticsMemberRow {
  return {
    actualCount: 0,
    actualVsPlanned: [],
    byRole: [],
    byShiftType: [],
    countedActualCount: 0,
    countedPlannedCount: 0,
    deductionCount: 0,
    deltaCount: 0,
    holidayCount: 0,
    leaveCoverCount: 0,
    manualAdjustmentCount: 0,
    membershipId: 'member-1',
    netDutyAdjustment: 0,
    overtimeCount: 0,
    plannedCount: 0,
    realName: 'A Doctor',
    swapCount: 0,
    weekendCount: 0,
    ...overrides,
  };
}

describe('statistics logic', () => {
  it('formats month labels and net duty adjustment', () => {
    expect(formatStatisticsMonthLabel('2026-10')).toBe('2026年10月');
    expect(formatStatisticsMonthLabel('2026-01')).toBe('2026年1月');
    expect(formatNetDutyAdjustment(2)).toBe('+2');
    expect(formatNetDutyAdjustment(-1)).toBe('-1');
    expect(formatNetDutyAdjustment(0)).toBe('0');
  });

  it('sorts members by actual count and counts actual-vs-planned entries', () => {
    const members = [
      member({ actualCount: 2, membershipId: 'member-b', realName: 'B Doctor' }),
      member({ actualCount: 5, membershipId: 'member-a', realName: 'A Doctor' }),
    ];
    expect(sortMembersByActualCount(members).map((entry) => entry.membershipId)).toEqual([
      'member-a',
      'member-b',
    ]);
    expect(
      getMemberActualVsPlannedCount(
        member({ actualVsPlanned: [{ businessDate: '2026-10-01', shiftTypeName: 'All Day' }] }),
      ),
    ).toBe(1);
  });

  it('summarizes recalculate mismatches', () => {
    expect(summarizeRecalculateMismatches([])).toBe('重算结果与快照一致。');
    expect(summarizeRecalculateMismatches(['plannedCount 1 != 2'])).toBe(
      '发现 1 处不一致：plannedCount 1 != 2',
    );
  });
});
