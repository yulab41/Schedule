import type { ScheduleEvent } from '@schedule/contracts';
import { describe, expect, it } from 'vitest';

import {
  buildEventTimelineDisplay,
  formatJsonValue,
  getEventTypeLabel,
} from './event-description.js';
import type { CalendarAssignmentViewModel } from '../calendar/calendar-view-model.js';

const assignment = {
  actualMemberName: '李思远',
  assignmentId: 'golden-a2',
  backgroundColor: '#0CA678',
  borderToken: 'color-border-strong',
  compactShiftLabel: '白',
  foregroundColor: '#FFFFFF',
  markers: [],
  memberName: '李思远',
  phoneActions: [],
  plannedMemberName: '计划医生甲',
  roleId: 'golden-role-2',
  roleName: '急诊',
  routeActionId: 'assignment:golden-a2',
  schedulePeriodId: 'golden-period-2',
  shiftTypeAbbreviation: 'B',
  shiftTypeId: 'golden-shift-b',
  shiftTypeName: '白班',
  slotPosition: 1,
  timeRange: '08:00–16:00',
} satisfies CalendarAssignmentViewModel;

function makeEvent(overrides: Partial<ScheduleEvent>): ScheduleEvent {
  return {
    affectedMembershipIds: [],
    affectedShiftIds: [assignment.assignmentId],
    eventStatus: 'completed',
    eventType: 'schedule_period_published',
    groupId: 'golden-group',
    id: 'event-default',
    objectType: 'schedule_period',
    occurredAt: '2026-08-15T08:00:00+08:00',
    operationId: 'operation-default',
    ...overrides,
  };
}

describe('event description', () => {
  it('ports event display fields, chronological ordering, narratives, and change chains', () => {
    const display = buildEventTimelineDisplay(
      [
        makeEvent({
          afterData: {
            initiatorAssignment: { actualMemberName: '李思远' },
            initiatorAssignmentId: assignment.assignmentId,
            initiatorMemberName: '李思远',
            targetAssignment: { actualMemberName: '王芳' },
            targetAssignmentId: 'golden-a4',
          },
          beforeData: {
            initiatorAssignment: { actualMemberName: '计划医生甲' },
            initiatorAssignmentId: assignment.assignmentId,
            targetAssignment: { actualMemberName: '王芳' },
            targetAssignmentId: 'golden-a4',
          },
          eventType: 'swap_completed',
          id: 'golden-event-1',
          objectId: 'golden-swap-1',
          objectType: 'swap_request',
          occurredAt: '2026-08-15T09:00:00+08:00',
        }),
        makeEvent({
          afterData: { strategy: 'shift-forward' },
          eventType: 'leave_cover_completed',
          id: 'golden-event-2',
          occurredAt: '2026-08-15T10:00:00+08:00',
        }),
        makeEvent({
          afterData: {
            deductedMemberName: '欧阳修远',
            initiatorMemberName: '张伟',
            overtimeMemberName: '李思远',
          },
          affectedShiftIds: ['golden-a3'],
          eventType: 'duty_adjustment_completed',
          id: 'golden-event-3',
          occurredAt: '2026-08-15T11:00:00+08:00',
        }),
        makeEvent({
          id: 'golden-event-4',
          occurredAt: '2026-08-14T18:00:00+08:00',
        }),
        makeEvent({
          afterData: { shiftTypeName: '新班种', status: 'approved' },
          beforeData: { shiftTypeName: '旧班种', status: 'pending' },
          eventType: 'shift_type_changed',
          id: 'golden-event-5',
          occurredAt: '2026-08-13T15:00:00+08:00',
        }),
      ],
      assignment,
    );

    expect(display.items.map(({ id }) => id)).toEqual([
      'golden-event-5',
      'golden-event-4',
      'golden-event-1',
      'golden-event-2',
      'golden-event-3',
    ]);
    expect(display.items.map(({ marker }) => marker)).toEqual([
      undefined,
      undefined,
      'swap',
      'leave-cover',
      'overtime',
    ]);
    expect(display.items[2]?.narrative).toBe('计划医生甲 → 李思远（由 李思远 发起）');
    expect(display.items[2]?.narrative).not.toContain('发起时间');
    expect(display.items[3]?.narrative).toContain('整体顺延');
    expect(display.items[4]?.narrative).toBe('欧阳修远 的班次由 李思远 代值（由 张伟 发起）。');
    expect(display.items[0]?.changes).toEqual([
      { after: '新班种', before: '旧班种', label: '班种' },
      { after: '已批准', before: '待审批', label: '状态' },
    ]);
    expect(display.changeChainSummary).toBe(
      '人员变更链：计划医生甲 → 李思远（1 次变更；2026-08-15 09:00 换班 计划医生甲 → 李思远）',
    );
  });

  it('keeps fallback labels and JSON formatting explicit', () => {
    expect(getEventTypeLabel('swap_completed')).toBe('换班已生效');
    expect(getEventTypeLabel('unknown')).toBe('排班变更');
    expect(formatJsonValue(undefined)).toBe('');
  });
});
