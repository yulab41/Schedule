import type { CalendarDutyAssignment, CalendarReadModel } from '@schedule/contracts';
import { describe, expect, it } from 'vitest';

import {
  buildSwapCandidates,
  formatSwapShiftTime,
  getSwapConflictMessage,
  getSwapNextStatusDescription,
  getSwapStatusLabel,
  resolveNextSwapStatus,
} from './swap-logic.js';
import {
  formatAssignmentOption,
  formatAssignmentSummaryOption,
} from '../workflows/assignment-option.js';

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
    assignment('assignment-3', '2026-09-03', 'target'),
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

describe('swap flow logic', () => {
  it('formats shift time ranges in China Standard Time', () => {
    expect(formatSwapShiftTime('2026-08-01T16:00:00.000Z', '2026-08-02T00:00:00.000Z')).toBe(
      '08-02  00:00\u2013 08:00',
    );
  });

  it('builds my assignments, target options, and per-target assignment lists', () => {
    const candidates = buildSwapCandidates(calendar, 'me');

    expect(candidates.myAssignments.map((assignment) => assignment.id)).toEqual(['assignment-1']);
    expect(candidates.targetOptions.map((member) => member.membershipId)).toEqual(['target']);
    expect(
      candidates.assignmentsByTarget.get('target')?.map((assignment) => assignment.id),
    ).toEqual(['assignment-2', 'assignment-3']);
  });

  it('excludes past assignments from my assignments and target options', () => {
    const pastCalendar: CalendarReadModel = {
      ...calendar,
      assignments: [
        assignment('past-me', '2026-07-01', 'me'),
        assignment('past-target', '2026-07-02', 'target'),
        assignment('assignment-4', '2026-09-04', 'me'),
      ],
    };

    const candidates = buildSwapCandidates(pastCalendar, 'me');
    expect(candidates.myAssignments.map((item) => item.id)).toEqual(['assignment-4']);
    expect(candidates.targetOptions.map((member) => member.membershipId)).toEqual([]);
    expect(candidates.assignmentsByTarget.has('target')).toBe(false);
  });

  it('resolves the next status from group and member settings', () => {
    expect(resolveNextSwapStatus(true, false)).toBe('pending_target');
    expect(resolveNextSwapStatus(true, true)).toBe('pending_approval');
    expect(resolveNextSwapStatus(false, true)).toBe('completed');
  });

  it('labels statuses and conflicts and formats options', () => {
    expect(getSwapStatusLabel('pending_approval')).toBe('待管理员审批');
    expect(getSwapStatusLabel('pending_target')).toBe('待对方接受');
    expect(
      getSwapConflictMessage({
        code: 'MEMBER_LEAVE_OVERLAP',
        membershipId: 'target',
        message: '该成员在班次时间内有已批准请假。',
      }),
    ).toBe('该成员在班次时间内有已批准请假。');
    expect(formatAssignmentOption(calendar.assignments[1]!)).toBe(
      '2026-09-02 全天班（周三）· 李医生',
    );
    expect(
      formatAssignmentSummaryOption({
        actualMemberName: '李医生',
        businessDate: '2026-09-02',
        plannedMemberName: '李医生',
        shiftTypeName: '全天班',
      }),
    ).toBe('2026-09-02 全天班（周三）· 李医生');
    expect(getSwapNextStatusDescription('pending_target')).toBe('提交后将等待目标成员接受。');
    expect(getSwapNextStatusDescription('pending_approval')).toContain('管理员审批');
    expect(getSwapNextStatusDescription('completed')).toContain('立即生效');
  });
});
