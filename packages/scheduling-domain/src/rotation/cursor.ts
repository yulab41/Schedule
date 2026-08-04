import { toChinaStandardTimeShiftRange } from '../time.js';

import type { RotationCursor, RotationCursorInput, RotationMember, RotationRule } from './types.js';

const millisecondsPerDay = 24 * 60 * 60 * 1000;

export function assertRotationRule(rule: RotationRule): void {
  assertIdentifier(rule.scheduleRoleId, 'The schedule role ID');
  assertIdentifier(rule.defaultShiftType.id, 'The shift type ID');
  if (!rule.defaultShiftType.isEnabled) {
    throw new Error('A disabled shift type cannot be used for rotation generation.');
  }
  if (!Number.isSafeInteger(rule.requiredMembersPerDay) || rule.requiredMembersPerDay < 1) {
    throw new Error('The required members per day must be a positive integer.');
  }

  assertBusinessDate(rule.rotationStartDate, 'The rotation start date');
  toChinaStandardTimeShiftRange({
    businessDate: rule.rotationStartDate,
    crossesMidnight: rule.defaultShiftType.crossesMidnight,
    endTime: rule.defaultShiftType.endTime,
    startTime: rule.defaultShiftType.startTime,
  });

  const orderedMembers = getOrderedRotationMembers(rule);
  if (orderedMembers.length === 0) {
    if (rule.startingMembershipId !== undefined) {
      throw new Error('An empty rotation cannot specify a starting member.');
    }
    return;
  }

  if (rule.startingMembershipId === undefined) {
    throw new Error('A non-empty rotation must specify a starting member.');
  }
  assertIdentifier(rule.startingMembershipId, 'The starting membership ID');
  if (!orderedMembers.some((member) => member.membershipId === rule.startingMembershipId)) {
    throw new Error('The starting member must belong to the rotation.');
  }
}

export function getRotationCursor(input: RotationCursorInput): RotationCursor | undefined {
  assertRotationRule(input.rule);
  assertBusinessDate(input.businessDate, 'The business date');
  if (!Number.isSafeInteger(input.slotPosition) || input.slotPosition < 1) {
    throw new Error('The rotation slot position must be a positive integer.');
  }
  if (input.slotPosition > input.rule.requiredMembersPerDay) {
    throw new Error('The rotation slot position exceeds the required members per day.');
  }

  const orderedMembers = getOrderedRotationMembers(input.rule);
  if (orderedMembers.length === 0) {
    return undefined;
  }

  const rotationStartTimestamp = toBusinessDateTimestamp(input.rule.rotationStartDate);
  const businessTimestamp = toBusinessDateTimestamp(input.businessDate);
  if (businessTimestamp < rotationStartTimestamp) {
    throw new Error('The business date cannot precede the rotation start date.');
  }

  const startingMembershipId = input.rule.startingMembershipId;
  if (startingMembershipId === undefined) {
    throw new Error('A non-empty rotation must specify a starting member.');
  }
  const startingIndex = orderedMembers.findIndex(
    (member) => member.membershipId === startingMembershipId,
  );
  if (startingIndex < 0) {
    throw new Error('The starting member must belong to the rotation.');
  }

  const elapsedDays = (businessTimestamp - rotationStartTimestamp) / millisecondsPerDay;
  const offset = elapsedDays * input.rule.requiredMembersPerDay + input.slotPosition - 1;
  const member = orderedMembers[(startingIndex + offset) % orderedMembers.length];
  if (member === undefined) {
    throw new Error('The rotation cursor could not resolve a member.');
  }

  return { member, slotPosition: input.slotPosition };
}

export function findEligibleRotationMember(input: RotationCursorInput): RotationMember | undefined {
  const cursor = getRotationCursor(input);
  if (cursor === undefined) {
    return undefined;
  }

  const orderedMembers = getOrderedRotationMembers(input.rule);
  const cursorIndex = cursor.member.position - 1;
  const leaveMembershipIds = new Set(
    (input.leaveIntervals ?? [])
      .filter((leave) => leave.businessDate === input.businessDate)
      .map((leave) => leave.membershipId),
  );
  for (let offset = 0; offset < orderedMembers.length; offset += 1) {
    const member = orderedMembers[(cursorIndex + offset) % orderedMembers.length];
    if (
      member !== undefined &&
      isRotationMemberEligible(member, input.businessDate) &&
      !leaveMembershipIds.has(member.membershipId)
    ) {
      return member;
    }
  }

  return undefined;
}

export function isRotationMemberEligible(member: RotationMember, businessDate: string): boolean {
  assertBusinessDate(businessDate, 'The business date');
  if (!member.isActive) {
    return false;
  }

  if (member.effectiveFrom !== undefined) {
    assertBusinessDate(member.effectiveFrom, 'The member effective-from date');
    if (businessDate < member.effectiveFrom) {
      return false;
    }
  }
  if (member.effectiveTo !== undefined) {
    assertBusinessDate(member.effectiveTo, 'The member effective-to date');
    if (businessDate > member.effectiveTo) {
      return false;
    }
  }
  if (
    member.effectiveFrom !== undefined &&
    member.effectiveTo !== undefined &&
    member.effectiveFrom > member.effectiveTo
  ) {
    throw new Error('The member effective date range is invalid.');
  }

  return true;
}

export function assertBusinessDate(value: string, fieldName: string): void {
  toBusinessDateTimestamp(value, fieldName);
}

export function getBusinessDates(startDate: string, endDate: string): readonly string[] {
  const startTimestamp = toBusinessDateTimestamp(startDate, 'The generation start date');
  const endTimestamp = toBusinessDateTimestamp(endDate, 'The generation end date');
  if (endTimestamp < startTimestamp) {
    throw new Error('The generation end date cannot precede the start date.');
  }

  const businessDates: string[] = [];
  for (let timestamp = startTimestamp; timestamp <= endTimestamp; timestamp += millisecondsPerDay) {
    businessDates.push(new Date(timestamp).toISOString().slice(0, 10));
  }

  return businessDates;
}

function getOrderedRotationMembers(rule: RotationRule): readonly RotationMember[] {
  const members = [...rule.members].sort((left, right) => left.position - right.position);
  const membershipIds = new Set<string>();
  for (const [index, member] of members.entries()) {
    assertIdentifier(member.membershipId, 'The rotation membership ID');
    if (membershipIds.has(member.membershipId)) {
      throw new Error('A rotation member cannot appear more than once.');
    }
    membershipIds.add(member.membershipId);
    if (!Number.isSafeInteger(member.position) || member.position !== index + 1) {
      throw new Error('Rotation member positions must be contiguous positive integers.');
    }
  }

  return members;
}

function assertIdentifier(value: string, fieldName: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${fieldName} must not be empty.`);
  }
}

function toBusinessDateTimestamp(value: string, fieldName = 'The business date'): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (match === null) {
    throw new Error(`${fieldName} must use a valid YYYY-MM-DD format.`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const candidate = new Date(timestamp);
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    throw new Error(`${fieldName} must use a valid YYYY-MM-DD format.`);
  }

  return timestamp;
}
