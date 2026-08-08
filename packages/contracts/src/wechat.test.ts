import { describe, expect, it } from 'vitest';

import {
  acceptInviteResponseSchema,
  createInviteLinkRequestSchema,
  groupQrResponseSchema,
  visitorKeyChangedResponseSchema,
  visitorAccessLogPageSchema,
  visitorResolveRequestSchema,
  wechatLoginResponseSchema,
} from './wechat.js';

describe('wechat mini program contracts', () => {
  it('accepts a login response for a returning user without a profile override', () => {
    const result = wechatLoginResponseSchema.safeParse({
      isNewUser: false,
      profile: { id: 'u1', realName: '张三', version: 1 },
      token: 'signed-token',
    });
    expect(result.success).toBe(true);
  });

  it('allows a new user login response without a profile', () => {
    expect(
      wechatLoginResponseSchema.safeParse({ isNewUser: true, token: 'signed-token' }).success,
    ).toBe(true);
  });

  it('requires a 32-character hexadecimal visitor key', () => {
    expect(visitorResolveRequestSchema.safeParse({ visitorKey: 'a'.repeat(32) }).success).toBe(
      true,
    );
    expect(visitorResolveRequestSchema.safeParse({ visitorKey: 'short' }).success).toBe(false);
    expect(visitorResolveRequestSchema.safeParse({ visitorKey: 'z'.repeat(32) }).success).toBe(
      false,
    );
  });

  it('accepts an access log page with an optional next cursor', () => {
    expect(
      visitorAccessLogPageSchema.safeParse({
        logs: [
          {
            businessMonth: '2026-08',
            clientIp: '127.0.0.1',
            createdAt: '2026-08-08T00:00:00.000Z',
            groupId: 'g1',
            id: 'log-1',
            requestId: 'req-1',
          },
        ],
        nextCursor: 'log-1',
      }).success,
    ).toBe(true);
  });

  it('requires a non-empty group QR image payload', () => {
    expect(groupQrResponseSchema.safeParse({ imageBase64: 'iVBORw0KGgo=' }).success).toBe(true);
    expect(groupQrResponseSchema.safeParse({ imageBase64: '' }).success).toBe(false);
  });

  it('accepts only a true visitor key changed response', () => {
    expect(visitorKeyChangedResponseSchema.safeParse({ visitorKeyChanged: true }).success).toBe(
      true,
    );
    expect(visitorKeyChangedResponseSchema.safeParse({ visitorKeyChanged: false }).success).toBe(
      false,
    );
  });

  it('requires exactly one invite target', () => {
    expect(createInviteLinkRequestSchema.safeParse({ targetMembershipId: 'm1' }).success).toBe(
      true,
    );
    expect(createInviteLinkRequestSchema.safeParse({ targetRosterEntryId: 'r1' }).success).toBe(
      true,
    );
    expect(createInviteLinkRequestSchema.safeParse({}).success).toBe(false);
    expect(
      createInviteLinkRequestSchema.safeParse({
        targetMembershipId: 'm1',
        targetRosterEntryId: 'r1',
      }).success,
    ).toBe(false);
  });

  it('accepts an invite accept response with an optional reissued token', () => {
    const group = { groupCode: '1234', id: 'g1', name: '内科', role: 'member', version: 1 };
    expect(acceptInviteResponseSchema.safeParse({ group }).success).toBe(true);
    expect(acceptInviteResponseSchema.safeParse({ group, token: 'reissued-token' }).success).toBe(
      true,
    );
  });
});
