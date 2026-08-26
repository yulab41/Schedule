import { describe, expect, it } from 'vitest';

import * as sharedEvent from '../../../packages/presentation-core/src/event.ts';
import * as sharedStatistics from '../../../packages/presentation-core/src/statistics.ts';
import * as webEvent from '../../web/src/features/events/event-timeline.ts';
import * as webStatistics from '../../web/src/features/statistics/statistics-logic.ts';

const events = [
  event({
    afterData: { actualMemberName: 'B 医生', status: 'completed' },
    beforeData: { actualMemberName: 'A 医生', status: 'pending_approval' },
    eventType: 'assignment_manually_updated',
    id: 'event-2',
    occurredAt: '2026-08-26T01:00:00.000Z',
  }),
  event(),
];

const summary = {
  actualCount: 9,
  byRole: [],
  byShiftType: [],
  countedActualCount: 8,
  countedPlannedCount: 8,
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

describe('Mini insights rules mirror the immutable Web golden', () => {
  it('keeps event labels, time, grouping, changes, narratives and marker order equivalent', () => {
    expect(sharedEvent.eventTypeLabels).toEqual(webEvent.eventTypeLabels);
    for (const eventType of [...Object.keys(webEvent.eventTypeLabels), 'unknown']) {
      expect(sharedEvent.getEventTypeLabel(eventType)).toBe(webEvent.getEventTypeLabel(eventType));
    }
    expect(sharedEvent.formatEventTime(events[0].occurredAt)).toBe(
      webEvent.formatEventTime(events[0].occurredAt),
    );
    expect(sharedEvent.buildEventDateGroups(events)).toEqual(webEvent.buildEventDateGroups(events));
    expect(sharedEvent.extractEventChanges(events[0])).toEqual(
      webEvent.extractEventChanges(events[0]),
    );
    expect(sharedEvent.buildEventNarrative(events[0])).toBe(
      webEvent.buildEventNarrative(events[0]),
    );
    expect(sharedEvent.buildEventTimelineItems(events)).toEqual(
      webEvent.buildEventTimelineItems(events),
    );
    expect(sharedEvent.buildEventTypeOptions()).toEqual(webEvent.buildEventTypeOptions());
  });

  it('keeps every statistics formatter, ledger item, ordering and scroll rule equivalent', () => {
    expect(sharedStatistics.formatStatisticsMonthLabel('2026-08')).toBe(
      webStatistics.formatStatisticsMonthLabel('2026-08'),
    );
    expect(sharedStatistics.formatNetDutyAdjustment(2)).toBe(
      webStatistics.formatNetDutyAdjustment(2),
    );
    expect(sharedStatistics.getStatisticsSummaryItems(summary)).toEqual(
      webStatistics.getStatisticsSummaryItems(summary),
    );
    const members = [
      { actualCount: 2, actualVsPlanned: [], membershipId: 'b', realName: 'B 医生' },
      { actualCount: 5, actualVsPlanned: [], membershipId: 'a', realName: 'A 医生' },
    ];
    expect(sharedStatistics.sortMembersByActualCount(members)).toEqual(
      webStatistics.sortMembersByActualCount(members),
    );
    const metrics = { clientWidth: 320, scrollLeft: 240, scrollWidth: 960 };
    expect(sharedStatistics.getStatisticsTableScrollState(metrics)).toEqual(
      webStatistics.getStatisticsTableScrollState(metrics),
    );
    expect(sharedStatistics.getStatisticsTableScrollHint(metrics)).toBe(
      webStatistics.getStatisticsTableScrollHint(metrics),
    );
    expect(sharedStatistics.summarizeRecalculateMismatches(['a', 'b'])).toBe(
      webStatistics.summarizeRecalculateMismatches(['a', 'b']),
    );
  });
});

function event(overrides = {}) {
  return {
    affectedMembershipIds: ['member-1'],
    affectedShiftIds: ['shift-1'],
    eventStatus: 'completed',
    eventType: 'schedule_period_published',
    groupId: 'group-1',
    id: 'event-1',
    objectType: 'schedule_period',
    occurredAt: '2026-08-25T16:30:00.000Z',
    operationId: 'operation-1',
    ...overrides,
  };
}
