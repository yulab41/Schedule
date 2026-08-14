import type { CalendarDutyAssignment, CalendarDutyMember } from '@schedule/contracts';
import { describe, expect, it } from 'vitest';

import { buildSelectedDateDutyRows, formatSelectedDateLabel } from './selected-date-duty.js';

describe('selected date duty details', () => {
  it('builds sorted duty rows with full actual names, phones, and explainable status', () => {
    const assignments = [
      assignment({
        actualMemberName: '林恩宇医生',
        actualMembershipId: 'membership-2',
        changeMarkers: ['swap'],
        id: 'afternoon',
        startsAt: '2026-08-14T05:00:00.000Z',
      }),
      assignment({ id: 'morning', startsAt: '2026-08-14T00:00:00.000Z' }),
      assignment({
        id: 'pending',
        plannedMemberName: undefined,
        plannedMembershipId: undefined,
        slotPosition: 2,
        startsAt: '2026-08-14T00:00:00.000Z',
      }),
      assignment({ businessDate: '2026-08-15', id: 'other-date' }),
    ];
    const members: CalendarDutyMember[] = [
      {
        isConfirmed: false,
        membershipId: 'membership-2',
        mobilePhone: '13800138000',
        realName: '林恩宇医生',
      },
    ];

    const rows = buildSelectedDateDutyRows('2026-08-14', assignments, members);

    expect(rows.map((row) => row.assignment.id)).toEqual(['morning', 'pending', 'afternoon']);
    expect(rows[0]).toMatchObject({ dutyName: '张医生', status: 'scheduled' });
    expect(rows[1]).toMatchObject({ dutyName: '待安排', status: 'pending' });
    expect(rows[2]).toMatchObject({
      dutyName: '林恩宇医生',
      phoneOptions: [{ isConfirmed: false, label: '长号', number: '13800138000' }],
      status: 'changed',
    });
  });

  it('formats the selected date as a readable Chinese date and weekday', () => {
    expect(formatSelectedDateLabel('2026-08-14')).toBe('8月14日 周五');
  });
});

function assignment(overrides: Partial<CalendarDutyAssignment> = {}): CalendarDutyAssignment {
  return {
    businessDate: '2026-08-14',
    changeMarkers: [],
    endsAt: '2026-08-14T08:00:00.000Z',
    id: 'assignment-1',
    plannedMembershipId: 'membership-1',
    plannedMemberName: '张医生',
    schedulePeriodId: 'period-1',
    scheduleRoleId: 'role-1',
    scheduleRoleName: '一线',
    shiftTypeAbbreviation: '全',
    shiftTypeColor: '#1F5AA6',
    shiftTypeId: 'shift-1',
    shiftTypeName: '全天班',
    shiftTypeTextColor: '#FFFFFF',
    slotPosition: 1,
    startsAt: '2026-08-14T00:00:00.000Z',
    ...overrides,
  };
}
