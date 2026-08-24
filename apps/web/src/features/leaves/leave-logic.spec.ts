import type { LeaveStatisticsDelta } from '@schedule/contracts';
import { describe, expect, it } from 'vitest';

import {
  buildLeaveFormInterval,
  formatAffectedAssignment,
  formatLeaveRange,
  getLeaveDayCount,
  getLeaveRejectionConfirmation,
  getLeaveStatusTone,
  getLeaveTypeLabel,
  getReflowStrategyLabel,
  getTodayCalendarDate,
  summarizeStatisticsDelta,
} from './leave-logic.js';

describe('leave form logic', () => {
  it('uses the China Standard Time natural date before the 08:00 duty handover', () => {
    expect(getTodayCalendarDate(new Date('2026-08-23T18:00:00.000Z'))).toBe('2026-08-24');
  });

  it('builds an all-day interval from 08:00 China Standard Time', () => {
    const interval = buildLeaveFormInterval({
      allDay: true,
      endDate: '2026-08-02',
      startDate: '2026-08-01',
    });

    expect(interval.startsAt).toBe('2026-07-31T16:00:00.000Z');
    expect(interval.endsAt).toBe('2026-08-02T16:00:00.000Z');
  });

  it('rejects calendar-invalid all-day dates instead of rolling them over', () => {
    expect(() =>
      buildLeaveFormInterval({
        allDay: true,
        endDate: '2026-03-01',
        startDate: '2026-02-30',
      }),
    ).toThrow('请假日期格式无效。');
  });

  it('builds a typed interval from local date and time inputs', () => {
    const interval = buildLeaveFormInterval({
      allDay: false,
      endDate: '2026-08-01',
      endTime: '20:00',
      startDate: '2026-08-01',
      startTime: '09:00',
    });

    expect(new Date(interval.startsAt).valueOf()).toBeLessThan(new Date(interval.endsAt).valueOf());
  });

  it('rejects reversed dates, empty times, and non-increasing typed intervals', () => {
    expect(() =>
      buildLeaveFormInterval({
        allDay: true,
        endDate: '2026-08-01',
        startDate: '2026-08-02',
      }),
    ).toThrow('结束日期');
    expect(() =>
      buildLeaveFormInterval({
        allDay: false,
        endDate: '2026-08-01',
        endTime: '',
        startDate: '2026-08-01',
        startTime: '09:00',
      }),
    ).toThrow('时间');
    expect(() =>
      buildLeaveFormInterval({
        allDay: false,
        endDate: '2026-08-01',
        endTime: '08:00',
        startDate: '2026-08-01',
        startTime: '09:00',
      }),
    ).toThrow('晚于');
  });

  it('formats ranges, assignment changes, and statistics deltas', () => {
    expect(formatLeaveRange('2026-08-01T00:00:00.000Z', '2026-08-03T00:00:00.000Z')).toBe(
      '08-01 至 08-02（共 2 天）',
    );
    expect(formatLeaveRange('2026-08-01T00:00:00.000Z', '2026-08-02T00:00:00.000Z', false)).toBe(
      '08-01 08:00 至 08-02 08:00',
    );
    expect(getLeaveDayCount('2026-08-03', '2026-08-03')).toBe(1);
    expect(getLeaveDayCount('2026-08-03', '2026-08-04')).toBe(2);
    expect(getLeaveDayCount('2026-08-04', '2026-08-03')).toBe(0);
    expect(
      formatAffectedAssignment({
        assignmentId: 'assignment-1',
        businessDate: '2026-08-01',
        endsAt: '2026-08-02T00:00:00.000Z',
        nextMemberId: 'membership-b',
        nextMemberName: 'B Doctor',
        previousMemberId: 'membership-a',
        previousMemberName: 'A Doctor',
        shiftTypeAbbreviation: '全',
        shiftTypeColor: '#1F5AA6',
        shiftTypeId: 'shift-1',
        shiftTypeName: '全天班',
        shiftTypeTextColor: '#FFFFFF',
        slotPosition: 1,
        startsAt: '2026-08-01T00:00:00.000Z',
      }),
    ).toBe('8月1日 全天班（全）：A Doctor → B Doctor');
  });

  it('summarizes per-member statistics deltas', () => {
    const delta: LeaveStatisticsDelta = {
      byMember: [
        {
          assignmentDelta: -1,
          countedDelta: -1,
          membershipId: 'membership-a',
          realName: 'A Doctor',
          weekendDelta: -1,
        },
        {
          assignmentDelta: 1,
          countedDelta: 1,
          membershipId: 'membership-b',
          realName: 'B Doctor',
          weekendDelta: 1,
        },
      ],
      totalAssignmentDelta: 0,
      totalCountedDelta: 0,
      totalWeekendDelta: 0,
    };

    expect(summarizeStatisticsDelta(delta)).toBe('A Doctor -1 班、B Doctor +1 班');
    expect(
      summarizeStatisticsDelta({
        byMember: [],
        totalAssignmentDelta: 0,
        totalCountedDelta: 0,
        totalWeekendDelta: 0,
      }),
    ).toBe('无值班统计变化');
  });

  it('maps leave types and reflow strategies to Chinese labels', () => {
    expect(getLeaveTypeLabel('sick')).toBe('病假');
    expect(getLeaveTypeLabel('training')).toBe('进修');
    expect(getReflowStrategyLabel('shift-forward')).toBe('整体顺延');
  });

  it('maps leave workflow states to accessible card tones and explicit rejection copy', () => {
    expect(getLeaveStatusTone('pending')).toBe('warning');
    expect(getLeaveStatusTone('approved')).toBe('success');
    expect(getLeaveStatusTone('rejected')).toBe('danger');
    expect(getLeaveRejectionConfirmation('陈护士')).toBe('确定驳回陈护士的请假申请吗？');
    expect(getLeaveRejectionConfirmation()).toBe('确定驳回该成员的请假申请吗？');
  });
});
