import type { ScheduleEvent } from '@schedule/contracts';
import { describe, expect, it } from 'vitest';

import {
  buildEventNarrative,
  buildEventTimelineItems,
  buildSwapChainSummary,
  extractEventChanges,
  formatEventTime,
  getEventMarker,
  getEventRelationLabel,
  getEventTypeLabel,
} from './event-timeline.js';

function event(overrides: Partial<ScheduleEvent> = {}): ScheduleEvent {
  return {
    affectedMembershipIds: ['membership-a'],
    affectedShiftIds: ['assignment-1'],
    eventStatus: 'completed',
    eventType: 'swap_completed',
    groupId: 'group-1',
    id: 'event-1',
    objectType: 'swap_request',
    occurredAt: '2026-08-02T00:00:00.000Z',
    operationId: 'operation-1',
    ...overrides,
  };
}

describe('event timeline logic', () => {
  it('labels known and unknown event types and maps calendar markers', () => {
    expect(getEventTypeLabel('swap_completed')).toBe('换班已生效');
    expect(getEventTypeLabel('unknown_type')).toBe('排班变更');
    expect(getEventMarker('duty_adjustment_completed')).toBe('overtime');
    expect(getEventMarker('leave_cover_completed')).toBe('leave-cover');
    expect(getEventMarker('swap_request_created')).toBeUndefined();
  });

  it('formats event times in China Standard Time and relation labels', () => {
    expect(formatEventTime('2026-08-01T16:30:00.000Z')).toBe('2026-08-02 00:30');
    expect(getEventRelationLabel(event())).toBe('原始事件');
    expect(getEventRelationLabel(event({ parentEventId: 'event-0' }))).toBe('更正/撤销');
  });

  it('extracts before/after person, status, and reason changes while skipping ids and nested data', () => {
    const changes = extractEventChanges(
      event({
        afterData: {
          actualMemberId: 'membership-b',
          actualMemberName: 'B Doctor',
          status: 'completed',
          summary: { nested: true },
        },
        beforeData: {
          actualMemberId: 'membership-a',
          actualMemberName: 'A Doctor',
          status: 'pending_approval',
        },
      }),
    );

    expect(changes).toEqual([
      { after: 'B Doctor', before: 'A Doctor', label: '实际人员' },
      { after: '已完成', before: '待管理员审批', label: '状态' },
    ]);
  });

  it('skips internal timestamps and version fields in change extraction', () => {
    const changes = extractEventChanges(
      event({
        afterData: {
          decidedAt: '2026-08-02T01:00:00.000Z',
          status: 'approved',
          version: 2,
        },
        beforeData: {
          status: 'pending',
          version: 1,
        },
      }),
    );

    expect(changes).toEqual([{ after: '已批准', before: '待审批', label: '状态' }]);
  });

  it('builds a chronologically ordered timeline with correction and marker flags', () => {
    const correction = event({
      eventType: 'duty_adjustment_revoked',
      id: 'event-2',
      occurredAt: '2026-08-02T01:00:00.000Z',
      parentEventId: 'event-1',
    });
    const items = buildEventTimelineItems([correction, event()]);

    expect(items.map((item) => item.event.id)).toEqual(['event-1', 'event-2']);
    expect(items[0]).toMatchObject({ isCorrection: false, marker: 'swap' });
    expect(items[1]).toMatchObject({ isCorrection: true });
  });

  it('writes human-readable swap and duty adjustment narratives', () => {
    expect(
      buildEventNarrative(
        event({
          afterData: {
            initiatorAssignment: { actualMemberName: 'B Doctor' },
            targetAssignment: { actualMemberName: 'A Doctor' },
          },
          beforeData: {
            initiatorAssignment: { actualMemberName: 'A Doctor' },
            targetAssignment: { actualMemberName: 'B Doctor' },
          },
        }),
      ),
    ).toBe('A Doctor 与 B Doctor 互换班次（由 A Doctor 发起）。');

    expect(
      buildEventNarrative(
        event({
          afterData: { actualMemberName: 'B Doctor' },
          beforeData: { actualMemberName: 'A Doctor' },
          eventType: 'duty_adjustment_completed',
        }),
      ),
    ).toBe('加扣班完成：原值班 A Doctor 的班次现由 B Doctor 代值。');
  });

  it('includes the initiator and request time in swap narratives', () => {
    expect(
      buildEventNarrative(
        event({
          afterData: {
            initiatorAssignment: { actualMemberName: 'B Doctor' },
            targetAssignment: { actualMemberName: 'A Doctor' },
          },
          beforeData: {
            initiatorAssignment: { actualMemberName: 'A Doctor' },
            targetAssignment: { actualMemberName: 'B Doctor' },
          },
        }),
        undefined,
        { initiatedAt: '2026-08-03T01:00:00.000Z' },
      ),
    ).toBe('A Doctor 与 B Doctor 互换班次（由 A Doctor 发起，发起时间 2026-08-03 09:00）。');
  });

  it('builds a full swap chain for one shift across multiple swaps', () => {
    const events = [
      event({
        afterData: {
          initiatorAssignment: { actualMemberName: 'Feng Qin' },
          initiatorAssignmentId: 'assignment-1',
          targetAssignment: { actualMemberName: 'Lin Enyu' },
          targetAssignmentId: 'assignment-2',
        },
        beforeData: {
          initiatorAssignment: { actualMemberName: 'Lin Enyu' },
          targetAssignment: { actualMemberName: 'Feng Qin' },
        },
        occurredAt: '2026-08-08T01:00:00.000Z',
      }),
      event({
        afterData: {
          initiatorAssignment: { actualMemberName: 'Hong Chenshan' },
          initiatorAssignmentId: 'assignment-1',
          targetAssignment: { actualMemberName: 'Feng Qin' },
          targetAssignmentId: 'assignment-3',
        },
        beforeData: {
          initiatorAssignment: { actualMemberName: 'Feng Qin' },
          targetAssignment: { actualMemberName: 'Hong Chenshan' },
        },
        occurredAt: '2026-08-08T03:00:00.000Z',
      }),
    ];

    expect(buildSwapChainSummary(events, 'assignment-1')).toContain(
      '人员变更链：Lin Enyu → Feng Qin → Hong Chenshan（2 次换班',
    );
  });

  it('names the current duty member in leave cover narratives', () => {
    expect(
      buildEventNarrative(
        event({
          afterData: { reflowedShiftIds: ['assignment-1'], strategy: 'shift-forward' },
          eventType: 'leave_cover_completed',
        }),
        {
          businessDate: '2026-08-05',
          changeMarkers: ['leave-cover'],
          endsAt: '2026-08-05T16:00:00.000Z',
          id: 'assignment-1',
          plannedMemberName: 'C Doctor',
          schedulePeriodId: 'period-1',
          scheduleRoleId: 'role-1',
          scheduleRoleName: '一线',
          shiftTypeAbbreviation: '全',
          shiftTypeColor: '#1F5AA6',
          shiftTypeId: 'shift-1',
          shiftTypeName: '全天班',
          shiftTypeTextColor: '#FFFFFF',
          slotPosition: 1,
          startsAt: '2026-08-05T00:00:00.000Z',
        },
      ),
    ).toBe('请假替班完成（整体顺延），该班次现由 C Doctor 值班。');
  });

  it('writes human-readable narratives for swap and leave workflow events', () => {
    expect(buildEventNarrative(event({ eventType: 'swap_request_created' }))).toBe(
      '换班申请已提交。',
    );
    expect(buildEventNarrative(event({ eventType: 'leave_request_revoked' }))).toBe(
      '请假已撤销；如需恢复原排班，请重新生成或发布排班。',
    );
    expect(buildEventNarrative(event({ eventType: 'leave_request_cancelled' }))).toBe(
      '请假申请已取消。',
    );
    expect(
      buildEventNarrative(
        event({
          eventType: 'some_unknown_event',
        }),
      ),
    ).toBe('排班变更。');
  });

  it('falls back to a readable sentence for event types without a dedicated template', () => {
    expect(
      buildEventNarrative(
        event({
          afterData: { actualMemberName: 'B Doctor' },
          beforeData: { actualMemberName: 'A Doctor' },
          eventType: 'unknown_change',
        }),
      ),
    ).toBe('班次变动：实际人员 由 A Doctor 改为 B Doctor。');
  });
});
