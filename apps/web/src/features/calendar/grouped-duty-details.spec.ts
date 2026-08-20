import type { CalendarDutyAssignment, CalendarDutyMember } from '@schedule/contracts';
import { describe, expect, it } from 'vitest';

import { buildGroupedDutyDetails } from './grouped-duty-details.js';

describe('grouped duty details', () => {
  it('groups same-shift staff into one detail card while retaining every named row', () => {
    const groups = buildGroupedDutyDetails(
      '2026-08-19',
      [
        assignment({ id: 'd-1', plannedMemberName: '林恩宇', plannedMembershipId: 'member-1' }),
        assignment({ id: 'd-2', plannedMemberName: '陈晓燕', plannedMembershipId: 'member-2' }),
        assignment({
          id: 'p-1',
          plannedMemberName: '周佩珊',
          plannedMembershipId: 'member-3',
          shiftTypeAbbreviation: 'P',
          shiftTypeId: 'shift-p',
          shiftTypeName: 'P 班',
          startsAt: '2026-08-19T06:00:00.000Z',
        }),
      ],
      members,
    );

    expect(groups.map((group) => group.shiftTypeId)).toEqual(['shift-d', 'shift-p']);
    expect(groups[0]?.rows.map((row) => row.dutyName)).toEqual(['林恩宇', '陈晓燕']);
    expect(groups[1]?.rows.map((row) => row.dutyName)).toEqual(['周佩珊']);
  });

  it('orders groups by actual start time, then configured shift display order', () => {
    const groups = buildGroupedDutyDetails(
      '2026-08-19',
      [
        assignment({
          id: 'later',
          shiftTypeId: 'shift-n',
          shiftTypeName: 'N 班',
          startsAt: '2026-08-19T09:00:00.000Z',
        }),
        assignment({
          id: 'first',
          shiftTypeId: 'shift-computer',
          shiftTypeName: '电脑班',
          startsAt: '2026-08-18T23:30:00.000Z',
        }),
      ],
      members,
      ['shift-computer', 'shift-n'],
    );

    expect(groups.map((group) => group.shiftTypeId)).toEqual(['shift-computer', 'shift-n']);
  });
});

const members: readonly CalendarDutyMember[] = [
  {
    isConfirmed: true,
    membershipId: 'member-1',
    mobilePhone: '13800138000',
    realName: '林恩宇',
    shortPhone: '6618',
  },
  {
    isConfirmed: true,
    membershipId: 'member-2',
    mobilePhone: '13800138001',
    realName: '陈晓燕',
    shortPhone: '6619',
  },
  {
    isConfirmed: true,
    membershipId: 'member-3',
    mobilePhone: '13800138002',
    realName: '周佩珊',
    shortPhone: '6620',
  },
];

function assignment(overrides: Partial<CalendarDutyAssignment>): CalendarDutyAssignment {
  return {
    businessDate: '2026-08-19',
    changeMarkers: [],
    endsAt: '2026-08-19T09:30:00.000Z',
    id: 'd-1',
    plannedMemberName: '林恩宇',
    plannedMembershipId: 'member-1',
    schedulePeriodId: 'period-1',
    scheduleRoleId: 'role-1',
    scheduleRoleName: '护理值班',
    shiftTypeAbbreviation: 'D',
    shiftTypeColor: '#0A66D5',
    shiftTypeId: 'shift-d',
    shiftTypeName: 'D 班',
    shiftTypeTextColor: '#FFFFFF',
    slotPosition: 1,
    startsAt: '2026-08-19T00:00:00.000Z',
    ...overrides,
  };
}
