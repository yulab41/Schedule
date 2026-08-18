import type { CalendarDutyAssignment } from '@schedule/contracts';
import { describe, expect, it } from 'vitest';

import { getFixedShiftDutyDisplay } from './fixed-shift-duty-display.js';

describe('fixed shift duty display', () => {
  it('describes D shift split work periods and marks the lunch break without hiding the assignee', () => {
    const duty = assignment({
      endsAt: '2026-08-18T09:30:00.000Z',
      shiftTypeAbbreviation: 'D',
      shiftTypeName: 'D 班',
      startsAt: '2026-08-18T00:00:00.000Z',
    });

    expect(getFixedShiftDutyDisplay(duty, new Date('2026-08-18T03:59:00.000Z'))).toEqual({
      currentPhase: { label: '在岗中', tone: 'active' },
      description: '工作 08:00–12:00、14:30–17:30｜12:00–14:30 午间间休',
    });
    expect(getFixedShiftDutyDisplay(duty, new Date('2026-08-18T04:00:00.000Z'))).toEqual({
      currentPhase: { label: '午间间休', tone: 'break' },
      description: '工作 08:00–12:00、14:30–17:30｜12:00–14:30 午间间休',
    });
    expect(getFixedShiftDutyDisplay(duty, new Date('2026-08-18T06:30:00.000Z'))).toEqual({
      currentPhase: { label: '在岗中', tone: 'active' },
      description: '工作 08:00–12:00、14:30–17:30｜12:00–14:30 午间间休',
    });
  });

  it('describes NP shift work periods and marks the overnight on-call interval', () => {
    const duty = assignment({
      endsAt: '2026-08-19T03:00:00.000Z',
      shiftTypeAbbreviation: 'NP',
      shiftTypeName: 'NP 班',
      startsAt: '2026-08-18T09:30:00.000Z',
    });

    expect(getFixedShiftDutyDisplay(duty, new Date('2026-08-18T13:59:00.000Z'))).toMatchObject({
      currentPhase: { label: '在岗中', tone: 'active' },
    });
    expect(getFixedShiftDutyDisplay(duty, new Date('2026-08-18T14:00:00.000Z'))).toEqual({
      currentPhase: { label: '值班房听班中', tone: 'on-call' },
      description: '工作 17:30–22:00、次日07:00–11:00｜22:00–次日07:00 值班房听班',
    });
    expect(getFixedShiftDutyDisplay(duty, new Date('2026-08-18T23:00:00.000Z'))).toMatchObject({
      currentPhase: { label: '在岗中', tone: 'active' },
    });
  });

  it('shows the static explanation outside the live assignment and ignores edited lookalike shifts', () => {
    const duty = assignment({
      endsAt: '2026-08-18T09:30:00.000Z',
      shiftTypeAbbreviation: 'D',
      shiftTypeName: 'D 班',
      startsAt: '2026-08-18T00:00:00.000Z',
    });

    expect(getFixedShiftDutyDisplay(duty, new Date('2026-08-17T04:00:00.000Z'))).toEqual({
      description: '工作 08:00–12:00、14:30–17:30｜12:00–14:30 午间间休',
    });
    expect(
      getFixedShiftDutyDisplay(
        { ...duty, endsAt: '2026-08-18T10:00:00.000Z' },
        new Date('2026-08-18T04:00:00.000Z'),
      ),
    ).toBeUndefined();
    expect(
      getFixedShiftDutyDisplay(
        { ...duty, shiftTypeAbbreviation: 'A', shiftTypeName: 'A 班' },
        new Date('2026-08-18T04:00:00.000Z'),
      ),
    ).toBeUndefined();
  });
});

function assignment(overrides: Partial<CalendarDutyAssignment> = {}): CalendarDutyAssignment {
  return {
    businessDate: '2026-08-18',
    changeMarkers: [],
    endsAt: '2026-08-18T09:30:00.000Z',
    id: 'assignment-1',
    plannedMembershipId: 'membership-1',
    plannedMemberName: '张医生',
    schedulePeriodId: 'period-1',
    scheduleRoleId: 'role-1',
    scheduleRoleName: '一线',
    shiftTypeAbbreviation: 'D',
    shiftTypeColor: '#1F5AA6',
    shiftTypeId: 'shift-d',
    shiftTypeName: 'D 班',
    shiftTypeTextColor: '#FFFFFF',
    slotPosition: 1,
    startsAt: '2026-08-18T00:00:00.000Z',
    ...overrides,
  };
}
