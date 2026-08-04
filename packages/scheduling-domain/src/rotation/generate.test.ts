import { describe, expect, it } from 'vitest';

import { getRotationCursor } from './cursor.js';
import { generateRotation } from './generate.js';
import type {
  RotationGenerationInput,
  RotationMember,
  RotationRule,
  RotationShiftType,
} from './types.js';

const allDayShift: RotationShiftType = {
  crossesMidnight: true,
  endTime: '08:00',
  id: 'all-day',
  isEnabled: true,
  startTime: '08:00',
};

const daytimeShift: RotationShiftType = {
  crossesMidnight: false,
  endTime: '16:00',
  id: 'daytime',
  isEnabled: true,
  startTime: '08:00',
};

function createMembers(...membershipIds: readonly string[]): readonly RotationMember[] {
  return membershipIds.map((membershipId, index) => ({
    isActive: true,
    membershipId,
    position: index + 1,
  }));
}

function createRule(
  scheduleRoleId: string,
  members: readonly RotationMember[],
  startingMembershipId: string | undefined,
  overrides: Partial<RotationRule> = {},
): RotationRule {
  return {
    defaultShiftType: allDayShift,
    members,
    requiredMembersPerDay: 1,
    rotationStartDate: '2027-12-29',
    scheduleRoleId,
    ...(startingMembershipId === undefined ? {} : { startingMembershipId }),
    ...overrides,
  };
}

describe('deterministic rotation generation', () => {
  it("uses each role's fixed order independently across a seven-day year boundary", () => {
    const input: RotationGenerationInput = {
      endDate: '2028-01-04',
      rules: [
        createRule('primary', createMembers('a', 'b', 'c'), 'b'),
        createRule('secondary', createMembers('d', 'e'), 'd', {
          defaultShiftType: daytimeShift,
        }),
      ],
      startDate: '2027-12-29',
    };

    const result = generateRotation(input);
    const primaryAssignments = result.assignments.filter(
      (assignment) => assignment.scheduleRoleId === 'primary',
    );
    const secondaryAssignments = result.assignments.filter(
      (assignment) => assignment.scheduleRoleId === 'secondary',
    );

    expect(primaryAssignments.map((assignment) => assignment.plannedMembershipId)).toEqual([
      'b',
      'c',
      'a',
      'b',
      'c',
      'a',
      'b',
    ]);
    expect(secondaryAssignments.map((assignment) => assignment.plannedMembershipId)).toEqual([
      'd',
      'e',
      'd',
      'e',
      'd',
      'e',
      'd',
    ]);
    expect(primaryAssignments[0]).toMatchObject({
      businessDate: '2027-12-29',
      businessKey: 'rotation:primary:2027-12-29:1',
      endsAt: new Date('2027-12-30T00:00:00.000Z'),
      startsAt: new Date('2027-12-29T00:00:00.000Z'),
    });
    expect(result.hardConflicts).toEqual([]);
    expect(result.vacancies).toEqual([]);
  });

  it('fills multiple daily positions in sequence over month-end and leap-day boundaries', () => {
    const result = generateRotation({
      endDate: '2028-03-01',
      rules: [
        createRule('primary', createMembers('a', 'b', 'c'), 'a', {
          requiredMembersPerDay: 2,
          rotationStartDate: '2028-02-28',
        }),
      ],
      startDate: '2028-02-28',
    });

    expect(result.assignments.map((assignment) => assignment.businessDate)).toEqual([
      '2028-02-28',
      '2028-02-28',
      '2028-02-29',
      '2028-02-29',
      '2028-03-01',
      '2028-03-01',
    ]);
    expect(result.assignments.map((assignment) => assignment.plannedMembershipId)).toEqual([
      'a',
      'b',
      'c',
      'a',
      'b',
      'c',
    ]);
    expect(result.assignments.map((assignment) => assignment.slotPosition)).toEqual([
      1, 2, 1, 2, 1, 2,
    ]);
  });

  it('skips inactive members without changing the base cursor and records vacancies', () => {
    const primaryRule = createRule(
      'primary',
      [
        { effectiveTo: '2028-01-01', isActive: true, membershipId: 'a', position: 1 },
        { isActive: false, membershipId: 'b', position: 2 },
        { effectiveFrom: '2028-01-02', isActive: true, membershipId: 'c', position: 3 },
      ],
      'a',
      { rotationStartDate: '2028-01-01' },
    );
    const vacantRule = createRule(
      'vacant',
      [{ isActive: false, membershipId: 'd', position: 1 }],
      'd',
      { rotationStartDate: '2028-01-01' },
    );

    const result = generateRotation({
      endDate: '2028-01-03',
      rules: [primaryRule, vacantRule],
      startDate: '2028-01-01',
    });

    expect(
      result.assignments
        .filter((assignment) => assignment.scheduleRoleId === 'primary')
        .map((assignment) => assignment.plannedMembershipId),
    ).toEqual(['a', 'c', 'c']);
    expect(result.vacancies).toEqual([
      {
        assignmentBusinessKey: 'rotation:vacant:2028-01-01:1',
        businessDate: '2028-01-01',
        code: 'NO_ELIGIBLE_MEMBER',
        scheduleRoleId: 'vacant',
        slotPosition: 1,
      },
      {
        assignmentBusinessKey: 'rotation:vacant:2028-01-02:1',
        businessDate: '2028-01-02',
        code: 'NO_ELIGIBLE_MEMBER',
        scheduleRoleId: 'vacant',
        slotPosition: 1,
      },
      {
        assignmentBusinessKey: 'rotation:vacant:2028-01-03:1',
        businessDate: '2028-01-03',
        code: 'NO_ELIGIBLE_MEMBER',
        scheduleRoleId: 'vacant',
        slotPosition: 1,
      },
    ]);
  });

  it('skips members on approved leave dates without changing the base cursor', () => {
    const rule = createRule('primary', createMembers('a', 'b'), 'a', {
      rotationStartDate: '2028-01-01',
    });

    const result = generateRotation({
      endDate: '2028-01-04',
      leaveIntervals: [
        { businessDate: '2028-01-02', membershipId: 'b' },
        { businessDate: '2028-01-03', membershipId: 'a' },
      ],
      rules: [rule],
      startDate: '2028-01-01',
    });

    expect(result.assignments.map((assignment) => assignment.plannedMembershipId)).toEqual([
      'a',
      'a',
      'b',
      'b',
    ]);
    expect(result.vacancies).toEqual([]);
  });

  it('reports time overlap as a hard cross-role conflict', () => {
    const result = generateRotation({
      endDate: '2028-01-01',
      rules: [
        createRule('primary', createMembers('a'), 'a', { rotationStartDate: '2028-01-01' }),
        createRule('secondary', createMembers('a'), 'a', {
          defaultShiftType: daytimeShift,
          rotationStartDate: '2028-01-01',
        }),
      ],
      startDate: '2028-01-01',
    });

    expect(result.hardConflicts).toEqual([
      {
        assignmentBusinessKeys: [
          'rotation:secondary:2028-01-01:1',
          'rotation:primary:2028-01-01:1',
        ],
        code: 'MEMBER_TIME_OVERLAP',
        membershipId: 'a',
      },
    ]);
  });

  it('warns when a member has a continuous duty chain of at least 24 hours', () => {
    const result = generateRotation({
      endDate: '2028-01-02',
      rules: [createRule('primary', createMembers('a'), 'a', { rotationStartDate: '2028-01-01' })],
      startDate: '2028-01-01',
    });

    expect(result.continuousDutyWarnings).toEqual([
      {
        assignmentBusinessKeys: ['rotation:primary:2028-01-01:1', 'rotation:primary:2028-01-02:1'],
        code: 'CONTINUOUS_DUTY_24_HOURS',
        endsAt: new Date('2028-01-03T00:00:00.000Z'),
        membershipId: 'a',
        startsAt: new Date('2028-01-01T00:00:00.000Z'),
      },
    ]);
  });

  it('returns identical output for identical input and stable business keys', () => {
    const input: RotationGenerationInput = {
      endDate: '2028-01-03',
      rules: [
        createRule('primary role', createMembers('a', 'b'), 'a', {
          rotationStartDate: '2028-01-01',
        }),
      ],
      startDate: '2028-01-01',
    };

    expect(generateRotation(input)).toEqual(generateRotation(input));
    expect(generateRotation(input).assignments.map((assignment) => assignment.businessKey)).toEqual(
      [
        'rotation:primary%20role:2028-01-01:1',
        'rotation:primary%20role:2028-01-02:1',
        'rotation:primary%20role:2028-01-03:1',
      ],
    );
  });

  it('resolves the cursor from the configured start member and validates incomplete rules', () => {
    const rule = createRule('primary', createMembers('a', 'b', 'c'), 'b', {
      rotationStartDate: '2028-01-01',
    });

    expect(
      getRotationCursor({ businessDate: '2028-01-02', rule, slotPosition: 1 })?.member.membershipId,
    ).toBe('c');
    expect(() =>
      generateRotation({
        endDate: '2028-01-01',
        rules: [
          createRule('disabled', createMembers('a'), 'a', {
            defaultShiftType: { ...allDayShift, isEnabled: false },
            rotationStartDate: '2028-01-01',
          }),
        ],
        startDate: '2028-01-01',
      }),
    ).toThrow('disabled shift type');
  });
});
