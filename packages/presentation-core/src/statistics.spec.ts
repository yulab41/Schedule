import { describe, expect, it } from 'vitest';

import {
  formatNetDutyAdjustment,
  formatStatisticsPeriodLabel,
  getCompletionPercentage,
  getCurrentStatisticsMonth,
  getStatisticsSummaryItems,
  sortMembersByActualCount,
} from './statistics.js';

const summary = {
  actualCount: 9,
  byRole: [],
  byShiftType: [],
  countedActualCount: 8,
  countedPlannedCount: 7,
  deductionCount: 1,
  holidayCount: 3,
  leaveCoverCount: 2,
  manualAdjustmentCount: 4,
  members: [],
  netDutyAdjustment: 2,
  overtimeCount: 3,
  plannedCount: 10,
  swapCount: 5,
  weekendCount: 6,
};

describe('shared statistics presentation', () => {
  it('keeps every Web summary item and period label', () => {
    expect(formatStatisticsPeriodLabel('month', '2026-08', 2026)).toBe('2026年8月');
    expect(formatStatisticsPeriodLabel('year', '2026-08', 2026)).toBe('2026年');
    expect(getStatisticsSummaryItems(summary).map((item) => [item.label, item.value])).toEqual([
      ['计划班次', '10'],
      ['实际值班', '9'],
      ['计值班次', '8'],
      ['周末值班', '6'],
      ['法定节假日', '3'],
      ['换班', '5'],
      ['加班 / 扣班', '3 / 1'],
      ['加扣班净值', '+2'],
      ['请假补位', '2'],
      ['人工调整', '4'],
    ]);
  });

  it('shares ordering and bounded completion calculations', () => {
    expect(formatNetDutyAdjustment(2)).toBe('+2');
    expect(getCompletionPercentage(12, 10)).toBe(100);
    expect(getCompletionPercentage(0, 0)).toBe(0);
    expect(
      sortMembersByActualCount([
        { actualCount: 2, actualVsPlanned: [], membershipId: 'b', realName: 'B 医生' },
        { actualCount: 5, actualVsPlanned: [], membershipId: 'a', realName: 'A 医生' },
      ]).map((member) => member.membershipId),
    ).toEqual(['a', 'b']);
    expect(getCurrentStatisticsMonth(new Date('2025-12-31T16:30:00.000Z'))).toBe('2025-12');
    expect(getCurrentStatisticsMonth(new Date('2026-01-01T00:00:00.000Z'))).toBe('2026-01');
  });
});
