import type { CalendarDutyAssignment } from '@schedule/contracts';
import { describe, expect, it } from 'vitest';

import {
  buildAllDayLeaveInterval,
  buildWorkflowCandidates,
  getChinaBusinessDate,
  isWorkflowCandidateAssignment,
} from './workflow-time.js';

function assignment(
  id: string,
  businessDate: string,
  membershipId: string | undefined,
  overrides: Partial<CalendarDutyAssignment> = {},
): CalendarDutyAssignment {
  return {
    businessDate,
    changeMarkers: [],
    endsAt: `${businessDate}T16:00:00.000+08:00`,
    id,
    plannedMemberName: membershipId === 'member-1' ? '张医生' : '李医生',
    plannedMembershipId: membershipId,
    schedulePeriodId: 'period-1',
    scheduleRoleId: 'role-1',
    scheduleRoleName: '一线',
    shiftTypeAbbreviation: '全',
    shiftTypeColor: '#1F5AA6',
    shiftTypeId: 'shift-1',
    shiftTypeName: '全天班',
    shiftTypeTextColor: '#FFFFFF',
    slotPosition: 1,
    startsAt: `${businessDate}T08:00:00.000+08:00`,
    ...overrides,
  };
}

describe('workflow CST date and candidate helpers', () => {
  it('builds an inclusive all-day range as a CST half-open interval', () => {
    expect(buildAllDayLeaveInterval('2026-08-24', '2026-08-27')).toEqual({
      dayCount: 4,
      endsAt: '2026-08-28T00:00:00.000+08:00',
      startsAt: '2026-08-24T00:00:00.000+08:00',
    });
    expect(() => buildAllDayLeaveInterval('2026-08-28', '2026-08-27')).toThrow();
  });

  it('uses China business dates rather than UTC or local machine dates', () => {
    expect(getChinaBusinessDate(new Date('2026-08-10T15:59:59.000Z'))).toBe('2026-08-10');
    expect(getChinaBusinessDate(new Date('2026-08-10T16:00:00.000Z'))).toBe('2026-08-11');
  });

  it('keeps today including already-started shifts, excludes yesterday, and follows the start business date', () => {
    const now = new Date('2026-08-10T16:30:00.000Z');
    expect(isWorkflowCandidateAssignment(assignment('today', '2026-08-11', 'member-1'), now)).toBe(
      true,
    );
    expect(
      isWorkflowCandidateAssignment(assignment('yesterday', '2026-08-10', 'member-1'), now),
    ).toBe(false);
    expect(
      isWorkflowCandidateAssignment(
        assignment('cross-day', '2026-08-11', 'member-1', {
          endsAt: '2026-08-12T08:00:00.000+08:00',
        }),
        now,
      ),
    ).toBe(true);
  });

  it('uses actual membership first and emits the complete weekday candidate label', () => {
    const now = new Date('2026-08-10T16:30:00.000Z');
    const candidates = buildWorkflowCandidates(
      [
        assignment('past', '2026-08-10', 'member-1'),
        assignment('actual', '2026-08-15', 'member-1', {
          actualMemberName: '王医生',
          actualMembershipId: 'member-2',
        }),
        assignment('mine', '2026-08-16', 'member-1'),
      ],
      'member-1',
      now,
    );

    expect(candidates.operable.map(({ assignment }) => assignment.id)).toEqual(['actual', 'mine']);
    expect(candidates.mine.map(({ assignment }) => assignment.id)).toEqual(['mine']);
    expect(candidates.operable[0]).toMatchObject({
      isWeekend: true,
      label: '2026-08-15 全天班（周六）· 王医生',
      weekday: '周六',
    });
  });
});
