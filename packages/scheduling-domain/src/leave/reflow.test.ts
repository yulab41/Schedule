import { describe, expect, it } from 'vitest';

import type { LeaveReflowInput } from './reflow.js';
import {
  reflowLeaveAssignments,
  type ReflowAssignment,
  type ReflowMember,
  type ReflowRotationRule,
} from './reflow.js';

const roleId = 'role-1';
const shiftTypeId = 'shift-1';

describe('leave reflow', () => {
  it('treats a leave that covers only part of an all-day shift as affected', () => {
    const input = createInput({
      assignments: createDailyAssignments(['member-a', 'member-b'], 2),
      leave: {
        endsAt: new Date('2026-08-01T22:00:00.000Z'),
        membershipId: 'member-a',
        startsAt: new Date('2026-08-01T20:00:00.000Z'),
      },
      strategy: 'keep-original-order',
    });

    const result = reflowLeaveAssignments(input);

    expect(result.affectedBusinessKeys).toEqual([businessKey('2026-08-01', 1)]);
    expect(result.assignments[0]?.plannedMembershipId).toBe('member-b');
    expect(result.assignments[1]?.plannedMembershipId).toBe('member-b');
  });

  it('keeps the original order and replaces only the affected shifts', () => {
    const input = createInput({
      assignments: createDailyAssignments(['member-a', 'member-b', 'member-c'], 4),
      leave: leaveFor('member-a', '2026-08-01'),
      strategy: 'keep-original-order',
    });

    const result = reflowLeaveAssignments(input);

    expect(result.affectedBusinessKeys).toEqual([businessKey('2026-08-01', 1)]);
    expect(result.assignments.map((assignment) => assignment.plannedMembershipId)).toEqual([
      'member-b',
      'member-b',
      'member-c',
      'member-a',
    ]);
    expect(result.vacancies).toEqual([]);
    expect(result.conflicts).toEqual([]);
  });

  it('skips the member and advances the cursor until they rejoin in shift-forward', () => {
    const input = createInput({
      assignments: createDailyAssignments(['member-a', 'member-b', 'member-c'], 6),
      leave: leaveFor('member-a', '2026-08-01'),
      strategy: 'shift-forward',
    });

    const result = reflowLeaveAssignments(input);

    expect(result.assignments.map((assignment) => assignment.plannedMembershipId)).toEqual([
      'member-b',
      'member-c',
      'member-a',
      'member-b',
      'member-c',
      'member-a',
    ]);
    expect(result.affectedBusinessKeys).toEqual([
      businessKey('2026-08-01', 1),
      businessKey('2026-08-02', 1),
      businessKey('2026-08-03', 1),
      businessKey('2026-08-04', 1),
      businessKey('2026-08-05', 1),
      businessKey('2026-08-06', 1),
    ]);
    expect(result.nextCursorPositions.get(roleId)).toBe(1);
    expect(result.conflicts).toEqual([]);
    expect(result.vacancies).toEqual([]);
  });

  it('creates a pending vacancy when no cover member is available', () => {
    const input = createInput({
      assignments: createDailyAssignments(['member-a'], 3),
      leave: leaveFor('member-a', '2026-08-01'),
      rules: [createRule(['member-a'])],
      strategy: 'keep-original-order',
    });

    const result = reflowLeaveAssignments(input);

    expect(result.assignments[0]?.plannedMembershipId).toBeNull();
    expect(result.vacancies).toEqual([
      expect.objectContaining({
        assignmentBusinessKey: businessKey('2026-08-01', 1),
        businessDate: '2026-08-01',
        code: 'NO_ELIGIBLE_MEMBER',
        scheduleRoleId: roleId,
        slotPosition: 1,
      }),
    ]);
  });

  it('never double-assigns a member whose own shift overlaps the replacement slot', () => {
    const input = createInput({
      assignments: [
        createAssignment('2026-08-01', 1, 'member-a'),
        createAssignment('2026-08-01', 2, 'member-b'),
        createAssignment('2026-08-02', 1, 'member-a'),
        createAssignment('2026-08-02', 2, 'member-b'),
      ],
      leave: leaveFor('member-a', '2026-08-01'),
      rules: [createRule(['member-a', 'member-b'], 2)],
      strategy: 'keep-original-order',
    });

    const result = reflowLeaveAssignments(input);

    expect(result.assignments[0]?.plannedMembershipId).toBeNull();
    expect(result.assignments[1]?.plannedMembershipId).toBe('member-b');
    expect(result.vacancies).toHaveLength(1);
    expect(
      result.assignments.filter((assignment) => assignment.plannedMembershipId === 'member-b'),
    ).toHaveLength(2);
  });

  it('skips other members whose approved leave overlaps the slot', () => {
    const input = createInput({
      assignments: createDailyAssignments(['member-a', 'member-b', 'member-c', 'member-d'], 1),
      leave: leaveFor('member-a', '2026-08-01'),
      leaves: [leaveFor('member-b', '2026-08-01')],
      strategy: 'keep-original-order',
    });

    const result = reflowLeaveAssignments(input);

    expect(result.assignments[0]?.plannedMembershipId).toBe('member-c');
  });

  it('shifts every slot forward when multiple slots share one rotation order', () => {
    const input = createInput({
      assignments: [
        createAssignment('2026-08-01', 1, 'member-a'),
        createAssignment('2026-08-01', 2, 'member-b'),
        createAssignment('2026-08-02', 1, 'member-c'),
        createAssignment('2026-08-02', 2, 'member-d'),
        createAssignment('2026-08-03', 1, 'member-a'),
        createAssignment('2026-08-03', 2, 'member-b'),
      ],
      leave: leaveFor('member-a', '2026-08-01'),
      rules: [createRule(['member-a', 'member-b', 'member-c', 'member-d'], 2)],
      strategy: 'shift-forward',
    });

    const result = reflowLeaveAssignments(input);

    expect(result.assignments.map((assignment) => assignment.plannedMembershipId)).toEqual([
      'member-c',
      'member-d',
      'member-a',
      'member-b',
      'member-c',
      'member-d',
    ]);
    expect(result.nextCursorPositions.get(roleId)).toBe(4);
  });
});

function createInput(
  overrides: Partial<LeaveReflowInput> &
    Pick<LeaveReflowInput, 'assignments' | 'leave' | 'strategy'>,
): LeaveReflowInput {
  return {
    leaves: overrides.leaves ?? [overrides.leave],
    rules: overrides.rules ?? [createRule(['member-a', 'member-b', 'member-c'])],
    ...overrides,
  };
}

function createDailyAssignments(
  memberIds: readonly string[],
  dayCount: number,
): readonly ReflowAssignment[] {
  const assignments: ReflowAssignment[] = [];
  for (let day = 1; day <= dayCount; day += 1) {
    const businessDate = `2026-08-${String(day).padStart(2, '0')}`;
    const memberId = memberIds[(day - 1) % memberIds.length];
    if (memberId !== undefined) {
      assignments.push(createAssignment(businessDate, 1, memberId));
    }
  }
  return assignments;
}

function createAssignment(
  businessDate: string,
  slotPosition: number,
  plannedMembershipId: string | null,
): ReflowAssignment {
  const startsAt = new Date(`${businessDate}T00:00:00.000Z`);
  const endsAt = new Date(startsAt.valueOf() + 24 * 60 * 60 * 1000);
  return {
    businessDate,
    businessKey: businessKey(businessDate, slotPosition),
    endsAt,
    plannedMembershipId,
    scheduleRoleId: roleId,
    shiftTypeId,
    slotPosition,
    startsAt,
  };
}

function createRule(memberIds: readonly string[], requiredMembersPerDay = 1): ReflowRotationRule {
  return {
    members: memberIds.map((membershipId, index): ReflowMember => ({
      isActive: true,
      membershipId,
      position: index + 1,
    })),
    requiredMembersPerDay,
    rotationStartDate: '2026-08-01',
    scheduleRoleId: roleId,
    ...(memberIds[0] === undefined ? {} : { startingMembershipId: memberIds[0] }),
  };
}

function leaveFor(membershipId: string, businessDate: string) {
  const startsAt = new Date(`${businessDate}T00:00:00.000Z`);
  return {
    endsAt: new Date(startsAt.valueOf() + 24 * 60 * 60 * 1000),
    membershipId,
    startsAt,
  };
}

function businessKey(businessDate: string, slotPosition: number): string {
  return `${roleId}:${businessDate}:${slotPosition}`;
}
