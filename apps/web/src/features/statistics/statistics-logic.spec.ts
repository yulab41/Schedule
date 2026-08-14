import { describe, expect, it } from 'vitest';

import type { StatisticsMemberRow } from '@schedule/contracts';

import {
  formatNetDutyAdjustment,
  formatStatisticsMonthLabel,
  getMemberActualVsPlannedCount,
  getStatisticsSummaryItems,
  getStatisticsTableScrollHint,
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

  it('keeps every existing summary count in a mobile-readable ledger', () => {
    const items = getStatisticsSummaryItems({
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
    });

    expect(items.map((item) => [item.label, item.value])).toEqual([
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

  it('describes table scroll direction from its real boundaries', () => {
    expect(
      getStatisticsTableScrollHint({ clientWidth: 320, scrollLeft: 0, scrollWidth: 960 }),
    ).toBe('向左滑动查看其余指标，成员列保持固定');
    expect(
      getStatisticsTableScrollHint({ clientWidth: 320, scrollLeft: 240, scrollWidth: 960 }),
    ).toBe('左右滑动查看全部指标，成员列保持固定');
    expect(
      getStatisticsTableScrollHint({ clientWidth: 320, scrollLeft: 640, scrollWidth: 960 }),
    ).toBe('向右滑动返回成员姓名，成员列保持固定');
  });
});
