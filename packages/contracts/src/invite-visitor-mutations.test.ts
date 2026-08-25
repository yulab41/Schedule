import { describe, expect, it } from 'vitest';

import {
  acceptInviteRequestSchema,
  createInviteLinkRequestSchema,
  createInviteLinkResponseSchema,
  resolveInviteResponseSchema,
  revokeInviteRequestSchema,
} from './wechat.js';

const operationId = '11111111-1111-4111-8111-111111111111';

describe('P8 invite and visitor mutation contracts', () => {
  it('requires operation and target versions when creating an invite', () => {
    expect(
      createInviteLinkRequestSchema.safeParse({
        expectedTargetVersion: 2,
        operationId,
        targetMembershipId: 'member-1',
      }).success,
    ).toBe(true);
    expect(
      createInviteLinkRequestSchema.safeParse({ targetMembershipId: 'member-1' }).success,
    ).toBe(false);
    expect(
      createInviteLinkRequestSchema.safeParse({
        expectedScheduleRoleVersion: 3,
        expectedTargetVersion: 2,
        operationId,
        targetMembershipId: 'member-1',
      }).success,
    ).toBe(false);
    expect(
      createInviteLinkRequestSchema.safeParse({
        expectedTargetVersion: 2,
        operationId,
        scheduleRoleId: 'role-1',
        targetMembershipId: 'member-1',
      }).success,
    ).toBe(false);
  });

  it('exposes invite versions and requires them for accept and revoke', () => {
    const invite = {
      expiresAt: '2026-09-01T00:00:00.000Z',
      groupName: '急诊科',
      permissionRole: 'member',
      realName: '林医生',
      sharePath: 'pages/invite/invite?t=token',
      token: 'token',
      version: 1,
    };
    expect(createInviteLinkResponseSchema.safeParse(invite).success).toBe(true);
    expect(
      createInviteLinkResponseSchema.safeParse({ ...invite, version: undefined }).success,
    ).toBe(false);
    expect(
      resolveInviteResponseSchema.safeParse({
        groupId: 'group-1',
        groupName: '急诊科',
        inviteeRealName: '林医生',
        permissionRole: 'member',
        version: 1,
      }).success,
    ).toBe(true);
    expect(
      acceptInviteRequestSchema.safeParse({
        confirmRealName: '林医生',
        expectedVersion: 1,
        operationId,
        token: 'token',
      }).success,
    ).toBe(true);
    expect(revokeInviteRequestSchema.safeParse({ expectedVersion: 1, operationId }).success).toBe(
      true,
    );
    expect(revokeInviteRequestSchema.safeParse({ expectedVersion: 1 }).success).toBe(false);
  });
});
