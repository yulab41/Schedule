import type { CalendarDutyAssignment, CalendarReadModel } from '@schedule/contracts';
import { describe, expect, it } from 'vitest';

import {
  buildDutyAdjustmentCandidates,
  formatDutyAdjustmentAssignmentOption,
  formatDutyAdjustmentAssignmentSummaryOption,
  getDutyAdjustmentConflictMessage,
  getDutyAdjustmentNextStatusDescription,
  getDutyAdjustmentStatusLabel,
  resolveNextDutyAdjustmentStatus,
} from './duty-adjustment-logic.js';

function assignment(
  id: string,
  businessDate: string,
  membershipId: string,
): CalendarDutyAssignment {
  return {
    businessDate,
    changeMarkers: [],
    endsAt: `${businessDate}T16:00:00.000Z`,
    id,
    plannedMembershipId: membershipId,
    plannedMemberName: membershipId === 'me' ? '张医生' : '李医生',
    schedulePeriodId: 'period-1',
    scheduleRoleId: 'role-1',
    scheduleRoleName: '一线',
    shiftTypeAbbreviation: '全',
    shiftTypeColor: '#1F5AA6',
    shiftTypeId: 'shift-1',
    shiftTypeName: '全天班',
    shiftTypeTextColor: '#FFFFFF',
    slotPosition: 1,
    startsAt: `${businessDate}T00:00:00.000Z`,
  };
}

const calendar: CalendarReadModel = {
  assignments: [
    assignment('assignment-1', '2026-09-01', 'me'),
    assignment('assignment-2', '2026-09-02', 'target'),
  ],
  businessMonth: '2026-09',
  groupId: 'group-1',
  members: [
    { isConfirmed: false, membershipId: 'me', realName: '张医生' },
    { isConfirmed: false, membershipId: 'target', realName: '李医生' },
  ],
  roles: [{ id: 'role-1', name: '一线' }],
  shiftTypes: [],
};

describe('duty adjustment flow logic', () => {
  it('builds my shifts, admin shift options, and overtime member options', () => {
    const candidates = buildDutyAdjustmentCandidates(calendar, 'me');

    expect(candidates.myAssignments.map((shift) => shift.id)).toEqual(['assignment-1']);
    expect(candidates.adminShiftOptions.map((shift) => shift.id)).toEqual([
      'assignment-1',
      'assignment-2',
    ]);
    expect(candidates.overtimeOptions.map((member) => member.membershipId)).toEqual(['target']);
  });

  it('excludes past assignments from my shifts and admin shift options', () => {
    const pastCalendar: CalendarReadModel = {
      ...calendar,
      assignments: [
        assignment('past-me', '2026-07-01', 'me'),
        assignment('past-target', '2026-07-02', 'target'),
        assignment('future-me', '2026-09-04', 'me'),
      ],
    };

    const candidates = buildDutyAdjustmentCandidates(pastCalendar, 'me');
    expect(candidates.myAssignments.map((shift) => shift.id)).toEqual(['future-me']);
    expect(candidates.adminShiftOptions.map((shift) => shift.id)).toEqual(['future-me']);
    expect(candidates.overtimeOptions.map((member) => member.membershipId)).toEqual(['target']);
  });

  it('resolves the next status from group and overtime member settings', () => {
    expect(resolveNextDutyAdjustmentStatus(true, false)).toBe('pending_target');
    expect(resolveNextDutyAdjustmentStatus(true, true)).toBe('pending_approval');
    expect(resolveNextDutyAdjustmentStatus(false, true)).toBe('completed');
  });

  it('labels statuses and conflicts and formats options', () => {
    expect(getDutyAdjustmentStatusLabel('pending_approval')).toBe('待管理员审批');
    expect(getDutyAdjustmentStatusLabel('pending_target')).toBe('待加班成员接受');
    expect(getDutyAdjustmentStatusLabel('revoked')).toBe('已撤销');
    expect(
      getDutyAdjustmentConflictMessage({
        code: 'MEMBER_LEAVE_OVERLAP',
        membershipId: 'target',
        message: '该成员在班次时间内有已批准请假。',
      }),
    ).toBe('该成员在班次时间内有已批准请假。');
    expect(formatDutyAdjustmentAssignmentOption(calendar.assignments[1]!)).toBe(
      '2026-09-02 全天班（全）· 李医生',
    );
    expect(
      formatDutyAdjustmentAssignmentSummaryOption({
        assignmentId: 'assignment-2',
        businessDate: '2026-09-02',
        endsAt: '2026-09-02T16:00:00.000Z',
        plannedMemberId: 'target',
        plannedMemberName: '李医生',
        scheduleRoleId: 'role-1',
        scheduleRoleName: '一线',
        shiftTypeAbbreviation: '全',
        shiftTypeColor: '#1F5AA6',
        shiftTypeId: 'shift-1',
        shiftTypeName: '全天班',
        shiftTypeTextColor: '#FFFFFF',
        slotPosition: 1,
        startsAt: '2026-09-02T00:00:00.000Z',
        version: 1,
      }),
    ).toBe('2026-09-02 全天班（全）· 李医生');
    expect(getDutyAdjustmentNextStatusDescription('pending_target')).toBe(
      '提交后将等待加班成员接受。',
    );
    expect(getDutyAdjustmentNextStatusDescription('pending_approval')).toContain('管理员审批');
    expect(getDutyAdjustmentNextStatusDescription('completed')).toContain('立即生效');
  });
});
