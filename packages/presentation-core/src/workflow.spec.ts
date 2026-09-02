import { describe, expect, it } from 'vitest';

import {
  buildDutyAdjustmentCandidates,
  buildLeaveFormInterval,
  buildSwapCandidates,
  filterOperableAssignments,
  formatAssignmentSummaryOption,
  formatLeaveRange,
  formatWorkflowShiftTime,
  getCurrentWorkflowBusinessMonth,
  getDutyAdjustmentNextStatusDescription,
  getDutyAdjustmentStatusLabel,
  getLeaveDayCount,
  getLeaveStatusLabel,
  getLeaveStatusTone,
  getSwapNextStatusDescription,
  getSwapStatusLabel,
  getTodayBusinessDate,
  getWorkflowStatusTone,
  isSwapRequestStillFuture,
  resolveNextWorkflowStatus,
} from './workflow.js';

const assignments = [
  {
    actualMemberName: '张医生',
    actualMembershipId: 'member-a',
    businessDate: '2026-08-26',
    id: 'assignment-a',
    plannedMemberName: '张医生',
    plannedMembershipId: 'member-a',
    shiftTypeName: '全天班',
  },
  {
    businessDate: '2026-08-27',
    id: 'assignment-b',
    plannedMemberName: '李医生',
    plannedMembershipId: 'member-b',
    shiftTypeName: '早班',
  },
  {
    businessDate: '2026-08-25',
    id: 'assignment-past',
    plannedMemberName: '陈医生',
    plannedMembershipId: 'member-c',
    shiftTypeName: '夜班',
  },
] as const;

const calendar = {
  assignments,
  members: [
    { membershipId: 'member-a', realName: '张医生' },
    { membershipId: 'member-b', realName: '李医生' },
    { membershipId: 'member-c', realName: '陈医生' },
  ],
};

describe('shared workflow presentation', () => {
  it('uses the Web status labels, tones and next-state descriptions', () => {
    expect(getSwapStatusLabel('pending_target')).toBe('待对方接受');
    expect(getDutyAdjustmentStatusLabel('pending_target')).toBe('待加班成员接受');
    expect(getWorkflowStatusTone('pending_approval')).toBe('warning');
    expect(getWorkflowStatusTone('completed')).toBe('success');
    expect(resolveNextWorkflowStatus(true, true)).toBe('pending_approval');
    expect(resolveNextWorkflowStatus(false, true)).toBe('completed');
    expect(getSwapNextStatusDescription('completed')).toBe(
      '目标成员已开启自动接受且群组无需审批，提交后将立即生效。',
    );
    expect(getDutyAdjustmentNextStatusDescription('pending_target')).toBe(
      '提交后将等待加班成员接受。',
    );
  });

  it('uses one future-assignment rule for candidate selection', () => {
    const now = new Date('2026-08-26T00:00:00.000Z');
    expect(filterOperableAssignments(assignments, now).map((item) => item.id)).toEqual([
      'assignment-a',
      'assignment-b',
    ]);
    expect(buildSwapCandidates(calendar, 'member-a', now).targetOptions).toEqual([
      { membershipId: 'member-b', realName: '李医生' },
    ]);
    expect(buildDutyAdjustmentCandidates(calendar, 'member-a', now).overtimeOptions).toEqual([
      { membershipId: 'member-b', realName: '李医生' },
      { membershipId: 'member-c', realName: '陈医生' },
    ]);
  });

  it('uses the Web 08:00 China-time business-day handover across month and year boundaries', () => {
    expect(getTodayBusinessDate(new Date('2026-08-26T23:59:00.000Z'))).toBe('2026-08-26');
    expect(getTodayBusinessDate(new Date('2026-08-27T00:00:00.000Z'))).toBe('2026-08-27');
    expect(getTodayBusinessDate(new Date('2026-08-31T23:59:59.999Z'))).toBe('2026-08-31');
    expect(getTodayBusinessDate(new Date('2026-09-01T00:00:00.000Z'))).toBe('2026-09-01');
    expect(getCurrentWorkflowBusinessMonth(new Date('2026-08-31T23:59:59.999Z'))).toBe('2026-08');
    expect(getCurrentWorkflowBusinessMonth(new Date('2026-09-01T00:00:00.000Z'))).toBe('2026-09');
    expect(getTodayBusinessDate(new Date('2026-12-31T23:59:59.999Z'))).toBe('2026-12-31');
    expect(getTodayBusinessDate(new Date('2027-01-01T00:00:00.000Z'))).toBe('2027-01-01');
    expect(getCurrentWorkflowBusinessMonth(new Date('2026-12-31T23:59:59.999Z'))).toBe('2026-12');
    expect(getCurrentWorkflowBusinessMonth(new Date('2027-01-01T00:00:00.000Z'))).toBe('2027-01');
  });

  it('formats assignment and shift summaries exactly like Web', () => {
    expect(formatAssignmentSummaryOption(assignments[0])).toBe('2026-08-26 全天班（周三）· 张医生');
    expect(formatWorkflowShiftTime('2026-08-26T00:00:00.000Z', '2026-08-27T00:00:00.000Z')).toBe(
      '08-26  08:00– 08:00',
    );
  });

  it('shares Web leave interval, range and status semantics', () => {
    expect(buildLeaveFormInterval({ startDate: '2026-08-26', endDate: '2026-08-27' })).toEqual({
      startsAt: '2026-08-25T16:00:00.000Z',
      endsAt: '2026-08-27T16:00:00.000Z',
    });
    expect(getLeaveDayCount('2026-08-26', '2026-08-27')).toBe(2);
    expect(formatLeaveRange('2026-08-25T16:00:00.000Z', '2026-08-27T16:00:00.000Z')).toBe(
      '08-26 至 08-27（共 2 天）',
    );
    expect(getLeaveStatusLabel('approved')).toBe('已批准');
    expect(getLeaveStatusTone('rejected')).toBe('danger');
    expect(() => buildLeaveFormInterval({ startDate: '', endDate: '2026-08-27' })).toThrow(
      '请选择请假开始和结束日期。',
    );
  });

  it('keeps completed swaps actionable only while both assignments are not past', () => {
    const now = new Date('2026-08-26T00:00:00.000Z');
    expect(
      isSwapRequestStillFuture(
        {
          initiatorAssignment: assignments[0],
          targetAssignment: assignments[1],
        },
        now,
      ),
    ).toBe(true);
    expect(
      isSwapRequestStillFuture(
        {
          initiatorAssignment: assignments[0],
          targetAssignment: assignments[2],
        },
        now,
      ),
    ).toBe(false);
  });
});
