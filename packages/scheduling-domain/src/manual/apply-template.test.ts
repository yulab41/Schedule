import { describe, expect, it } from 'vitest';

import {
  applyManualTemplate,
  type ManualApplyCell,
  type ManualApplyMember,
  type ManualApplyShiftType,
  type ManualApplyTemplateInput,
} from './apply-template.js';

const allDayShift: ManualApplyShiftType = {
  abbreviation: '全',
  color: '#1F5AA6',
  countsTowardStatistics: true,
  crossesMidnight: true,
  endTime: '08:00',
  id: 'shift-all-day',
  isAllDay: true,
  isEnabled: true,
  name: '全天班',
  startTime: '08:00',
  textColor: '#FFFFFF',
};

const dayShift: ManualApplyShiftType = {
  abbreviation: '白',
  color: '#0F766E',
  countsTowardStatistics: true,
  crossesMidnight: false,
  endTime: '18:00',
  id: 'shift-day',
  isAllDay: false,
  isEnabled: true,
  name: '白班',
  startTime: '09:00',
  textColor: '#FFFFFF',
};

const disabledShift: ManualApplyShiftType = {
  ...allDayShift,
  id: 'shift-disabled',
  isEnabled: false,
  name: '停用班',
};

const owner: ManualApplyMember = {
  currentMemberScheduleRoleVersion: 1,
  isActive: true,
  membershipId: 'membership-owner',
  realName: '张医生',
};

const candidate: ManualApplyMember = {
  currentMemberScheduleRoleVersion: 1,
  isActive: true,
  membershipId: 'membership-candidate',
  realName: '李医生',
};

function baseInput(overrides: Partial<ManualApplyTemplateInput> = {}): ManualApplyTemplateInput {
  return {
    cells: [
      { cycleDay: 1, membershipId: owner.membershipId, shiftTypeId: allDayShift.id },
      { cycleDay: 2, membershipId: candidate.membershipId, shiftTypeId: allDayShift.id },
    ],
    cycleDays: 7,
    members: [owner, candidate],
    scheduleRoleId: 'role-1',
    shiftTypes: [allDayShift, dayShift],
    startDate: '2026-08-01',
    ...overrides,
  };
}

function cell(cycleDay: number, membershipId: string, shiftTypeId: string): ManualApplyCell {
  return { cycleDay, membershipId, shiftTypeId };
}

function fullCycleCells(
  cycleDays: number,
  members: readonly ManualApplyMember[] = [owner, candidate],
): ManualApplyCell[] {
  return Array.from({ length: cycleDays }, (_, index) => ({
    cycleDay: index + 1,
    membershipId: members[index % members.length]?.membershipId ?? owner.membershipId,
    shiftTypeId: allDayShift.id,
  }));
}

describe('applyManualTemplate', () => {
  it('applies one cycle from the template start date when no end date is given', () => {
    const result = applyManualTemplate(baseInput({ cells: fullCycleCells(7), cycleDays: 7 }));

    expect(result.assignments).toHaveLength(7);
    expect(result.assignments.map((assignment) => assignment.businessDate)).toEqual([
      '2026-08-01',
      '2026-08-02',
      '2026-08-03',
      '2026-08-04',
      '2026-08-05',
      '2026-08-06',
      '2026-08-07',
    ]);
    expect(result.assignments[0]).toMatchObject({
      businessKey: 'manual:role-1:2026-08-01:1',
      plannedMembershipId: owner.membershipId,
      scheduleRoleId: 'role-1',
      shiftTypeId: allDayShift.id,
      slotPosition: 1,
    });
    expect(result.assignments[1]).toMatchObject({
      plannedMembershipId: candidate.membershipId,
    });
    expect(result.assignments[6]).toMatchObject({
      businessDate: '2026-08-07',
      plannedMembershipId: owner.membershipId,
    });
    expect(result.vacancies).toEqual([]);
    expect(result.conflicts).toEqual([]);
    expect(result.continuousDutyWarnings).toEqual([]);
  });

  it('repeats the cycle until the specified end date', () => {
    const result = applyManualTemplate(
      baseInput({ cells: fullCycleCells(7), endDate: '2026-08-30' }),
    );

    expect(result.assignments).toHaveLength(30);
    expect(result.assignments[0]?.businessDate).toBe('2026-08-01');
    expect(result.assignments[6]?.businessDate).toBe('2026-08-07');
    expect(result.assignments[7]?.businessDate).toBe('2026-08-08');
    expect(result.assignments[7]?.plannedMembershipId).toBe(owner.membershipId);
    expect(result.assignments[29]?.businessDate).toBe('2026-08-30');
    expect(new Set(result.assignments.map((assignment) => assignment.slotPosition))).toEqual(
      new Set([1]),
    );
  });

  it('truncates correctly when the end date falls inside a cycle', () => {
    const result = applyManualTemplate(
      baseInput({
        cells: fullCycleCells(7),
        endDate: '2026-08-10',
      }),
    );

    expect(result.assignments.map((assignment) => assignment.businessDate)).toEqual([
      '2026-08-01',
      '2026-08-02',
      '2026-08-03',
      '2026-08-04',
      '2026-08-05',
      '2026-08-06',
      '2026-08-07',
      '2026-08-08',
      '2026-08-09',
      '2026-08-10',
    ]);
    expect(result.assignments[0]?.plannedMembershipId).toBe(owner.membershipId);
    expect(result.assignments[1]?.plannedMembershipId).toBe(candidate.membershipId);
    expect(result.assignments[7]?.businessDate).toBe('2026-08-08');
    expect(result.assignments[7]?.plannedMembershipId).toBe(owner.membershipId);
    expect(result.assignments[8]?.businessDate).toBe('2026-08-09');
    expect(result.assignments[8]?.plannedMembershipId).toBe(candidate.membershipId);
    expect(result.assignments[9]?.businessDate).toBe('2026-08-10');
    expect(result.assignments[9]?.plannedMembershipId).toBe(owner.membershipId);
  });

  it('turns cells of members who left the role into explicit vacancies', () => {
    const leftMember: ManualApplyMember = { ...candidate, isActive: false };
    const result = applyManualTemplate(
      baseInput({
        cells: [
          cell(1, owner.membershipId, allDayShift.id),
          cell(2, leftMember.membershipId, allDayShift.id),
        ],
        endDate: '2026-08-15',
        members: [owner, leftMember],
      }),
    );

    const candidateAssignments = result.assignments.filter(
      (assignment) =>
        assignment.businessDate === '2026-08-02' || assignment.businessDate === '2026-08-09',
    );
    expect(candidateAssignments).toHaveLength(2);
    expect(
      candidateAssignments.every((assignment) => assignment.plannedMembershipId === null),
    ).toBe(true);
    expect(result.vacancies).toEqual([
      {
        assignmentBusinessKey: 'manual:role-1:2026-08-02:1',
        businessDate: '2026-08-02',
        code: 'NO_ELIGIBLE_MEMBER',
        scheduleRoleId: 'role-1',
        slotPosition: 1,
      },
      {
        assignmentBusinessKey: 'manual:role-1:2026-08-09:1',
        businessDate: '2026-08-09',
        code: 'NO_ELIGIBLE_MEMBER',
        scheduleRoleId: 'role-1',
        slotPosition: 1,
      },
    ]);
  });

  it('honors member effective date ranges by leaving out-of-range dates vacant', () => {
    const effectiveMember: ManualApplyMember = {
      ...candidate,
      effectiveFrom: '2026-08-03',
    };
    const result = applyManualTemplate(
      baseInput({
        cells: [cell(1, effectiveMember.membershipId, allDayShift.id)],
        cycleDays: 1,
        endDate: '2026-08-04',
        members: [effectiveMember],
      }),
    );

    expect(result.assignments.map((assignment) => assignment.plannedMembershipId)).toEqual([
      null,
      null,
      effectiveMember.membershipId,
      effectiveMember.membershipId,
    ]);
    expect(result.vacancies.map((vacancy) => vacancy.businessDate)).toEqual([
      '2026-08-01',
      '2026-08-02',
    ]);
  });

  it('blocks disabled or unknown shift type references instead of generating silently', () => {
    expect(() =>
      applyManualTemplate(
        baseInput({
          cells: [cell(1, owner.membershipId, disabledShift.id)],
          shiftTypes: [allDayShift, dayShift, disabledShift],
        }),
      ),
    ).toThrow(/disabled shift type/u);

    expect(() =>
      applyManualTemplate(baseInput({ cells: [cell(1, owner.membershipId, 'shift-unknown')] })),
    ).toThrow(/outside the template/u);
  });

  it('reports leave overlaps as hard conflicts', () => {
    const result = applyManualTemplate(
      baseInput({
        cells: [cell(1, owner.membershipId, allDayShift.id)],
        endDate: '2026-08-02',
        leaveIntervals: [
          {
            endsAt: new Date('2026-08-01T23:59:59.000Z'),
            membershipId: owner.membershipId,
            startsAt: new Date('2026-07-31T16:00:00.000Z'),
          },
        ],
      }),
    );

    expect(result.conflicts).toEqual([
      {
        assignmentBusinessKeys: ['manual:role-1:2026-08-01:1'],
        code: 'MEMBER_LEAVE_OVERLAP',
        membershipId: owner.membershipId,
      },
    ]);
  });

  it('ignores leave that does not overlap the assigned shift', () => {
    const result = applyManualTemplate(
      baseInput({
        cells: [cell(1, owner.membershipId, dayShift.id)],
        endDate: '2026-08-01',
        leaveIntervals: [
          {
            endsAt: new Date('2026-07-31T08:00:00.000Z'),
            membershipId: owner.membershipId,
            startsAt: new Date('2026-07-30T08:00:00.000Z'),
          },
        ],
      }),
    );

    expect(result.conflicts).toEqual([]);
  });

  it('reports the same member overlapping across days as a time conflict', () => {
    const nightShift: ManualApplyShiftType = {
      abbreviation: '夜',
      color: '#7C3AED',
      countsTowardStatistics: true,
      crossesMidnight: true,
      endTime: '08:00',
      id: 'shift-night',
      isAllDay: false,
      isEnabled: true,
      name: '夜班',
      startTime: '20:00',
      textColor: '#FFFFFF',
    };
    const morningShift: ManualApplyShiftType = {
      abbreviation: '早',
      color: '#B45309',
      countsTowardStatistics: true,
      crossesMidnight: false,
      endTime: '12:00',
      id: 'shift-morning',
      isAllDay: false,
      isEnabled: true,
      name: '早班',
      startTime: '04:00',
      textColor: '#FFFFFF',
    };
    const result = applyManualTemplate(
      baseInput({
        cells: [
          cell(1, owner.membershipId, nightShift.id),
          cell(2, owner.membershipId, morningShift.id),
        ],
        cycleDays: 2,
        endDate: '2026-08-02',
        shiftTypes: [allDayShift, dayShift, nightShift, morningShift],
      }),
    );

    expect(result.conflicts).toEqual([
      {
        assignmentBusinessKeys: ['manual:role-1:2026-08-01:1', 'manual:role-1:2026-08-02:1'],
        code: 'MEMBER_TIME_OVERLAP',
        membershipId: owner.membershipId,
      },
    ]);
  });

  it('warns about continuous duty of at least 24 hours', () => {
    const result = applyManualTemplate(
      baseInput({
        cells: [cell(1, owner.membershipId, allDayShift.id)],
        cycleDays: 1,
        endDate: '2026-08-02',
      }),
    );

    expect(result.continuousDutyWarnings).toHaveLength(1);
    expect(result.continuousDutyWarnings[0]).toMatchObject({
      assignmentBusinessKeys: ['manual:role-1:2026-08-01:1', 'manual:role-1:2026-08-02:1'],
      code: 'CONTINUOUS_DUTY_24_HOURS',
      membershipId: owner.membershipId,
    });
  });

  it('assigns stable slot positions when multiple members share a day', () => {
    const result = applyManualTemplate(
      baseInput({
        cells: [
          cell(1, candidate.membershipId, dayShift.id),
          cell(1, owner.membershipId, dayShift.id),
        ],
        endDate: '2026-08-01',
      }),
    );

    expect(result.assignments.map((assignment) => assignment.slotPosition)).toEqual([1, 2]);
    expect(result.assignments[0]?.plannedMembershipId).toBe(candidate.membershipId);
    expect(result.assignments[1]?.plannedMembershipId).toBe(owner.membershipId);
  });

  it('keeps different members on the same day free of member conflicts', () => {
    const result = applyManualTemplate(
      baseInput({
        cells: [
          cell(1, owner.membershipId, allDayShift.id),
          cell(1, candidate.membershipId, allDayShift.id),
        ],
        endDate: '2026-08-01',
      }),
    );

    expect(result.assignments).toHaveLength(2);
    expect(result.conflicts).toEqual([]);
  });

  it('crosses month and leap-year boundaries without dropping dates', () => {
    const crossMonth = applyManualTemplate(
      baseInput({
        cells: fullCycleCells(3),
        cycleDays: 3,
        endDate: '2026-03-01',
        startDate: '2026-02-27',
      }),
    );
    expect(crossMonth.assignments.map((assignment) => assignment.businessDate)).toEqual([
      '2026-02-27',
      '2026-02-28',
      '2026-03-01',
    ]);

    const leapYear = applyManualTemplate(
      baseInput({
        cells: fullCycleCells(3),
        cycleDays: 3,
        endDate: '2028-03-01',
        startDate: '2028-02-27',
      }),
    );
    expect(leapYear.assignments.map((assignment) => assignment.businessDate)).toEqual([
      '2028-02-27',
      '2028-02-28',
      '2028-02-29',
      '2028-03-01',
    ]);
  });

  it('rejects invalid cycles, dates, and duplicate cells', () => {
    expect(() => applyManualTemplate(baseInput({ cycleDays: 0 }))).toThrow(/cycle days/u);
    expect(() => applyManualTemplate(baseInput({ cycleDays: 32 }))).toThrow(/cycle days/u);
    expect(() =>
      applyManualTemplate(baseInput({ endDate: '2026-07-31', startDate: '2026-08-01' })),
    ).toThrow(/end date/u);
    expect(() =>
      applyManualTemplate(
        baseInput({
          cells: [
            cell(1, owner.membershipId, allDayShift.id),
            cell(1, owner.membershipId, dayShift.id),
          ],
        }),
      ),
    ).toThrow(/same member twice/u);
  });
});
