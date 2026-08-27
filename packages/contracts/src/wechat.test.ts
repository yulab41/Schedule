import { describe, expect, it } from 'vitest';

import {
  acceptInviteResponseSchema,
  createWechatAdminBindingLinkResponseSchema,
  createInviteLinkRequestSchema,
  groupQrResponseSchema,
  visitorKeyChangedResponseSchema,
  visitorAccessLogPageSchema,
  visitorAccessAggregatePageSchema,
  visitorResolveRequestSchema,
  platformAdminWechatMiniProgramUnbindRequestSchema,
  wechatLinkPasswordRequestSchema,
  wechatLinkPasswordResponseSchema,
  wechatLoginResponseSchema,
  wechatMiniProgramBindingStatusSchema,
  wechatMiniProgramUnbindRequestSchema,
  wechatMiniProgramUnbindResponseSchema,
  wechatAdminBindingConfirmRequestSchema,
  wechatAdminBindingConfirmResponseSchema,
  wechatAdminBindingPreviewRequestSchema,
  wechatAdminBindingPreviewResponseSchema,
  wechatRegisterRequestSchema,
  wechatRegisterResponseSchema,
} from './wechat.js';

describe('wechat mini program contracts', () => {
  it('accepts an authenticated result only with expiry and a complete profile', () => {
    const result = wechatLoginResponseSchema.safeParse({
      expiresAt: '2026-09-21T00:00:00.000Z',
      profile: { id: 'u1', realName: '张三', version: 1 },
      status: 'authenticated',
      token: 'signed-token',
    });
    expect(result.success).toBe(true);
    expect(
      wechatLoginResponseSchema.safeParse({
        expiresAt: '2026-09-21T00:00:00.000Z',
        status: 'authenticated',
        token: 'signed-token',
      }).success,
    ).toBe(false);
  });

  it('accepts link_required without issuing a session and rejects the legacy shape', () => {
    expect(
      wechatLoginResponseSchema.safeParse({
        expiresAt: '2026-08-22T10:10:00.000Z',
        linkToken: 'one-time-link-token',
        status: 'link_required',
      }).success,
    ).toBe(true);
    expect(
      wechatLoginResponseSchema.safeParse({
        isNewUser: true,
        token: 'signed-token',
      }).success,
    ).toBe(false);
  });

  it('defines strict password-link and real-name registration contracts', () => {
    const linked = {
      expiresAt: '2026-09-21T00:00:00.000Z',
      profile: { id: 'u1', realName: '张三', version: 1 },
      status: 'authenticated' as const,
      token: 'signed-token',
    };

    expect(
      wechatLinkPasswordRequestSchema.parse({
        linkToken: 'one-time-link-token',
        password: 'secret',
        username: '  Doctor.One  ',
      }),
    ).toEqual({
      linkToken: 'one-time-link-token',
      password: 'secret',
      username: 'Doctor.One',
    });
    expect(wechatLinkPasswordResponseSchema.safeParse(linked).success).toBe(true);
    expect(
      wechatLinkPasswordRequestSchema.safeParse({
        extra: true,
        linkToken: 'one-time-link-token',
        password: 'secret',
        username: 'doctor.one',
      }).success,
    ).toBe(false);

    expect(
      wechatRegisterRequestSchema.parse({
        linkToken: 'one-time-link-token',
        realName: '  张三  ',
      }),
    ).toEqual({ linkToken: 'one-time-link-token', realName: '张三' });
    expect(wechatRegisterResponseSchema.safeParse(linked).success).toBe(true);
    expect(
      wechatRegisterRequestSchema.safeParse({
        linkToken: 'one-time-link-token',
        realName: '   ',
      }).success,
    ).toBe(false);
  });

  it('defines strict self/admin Mini identity unbind contracts without delete semantics', () => {
    expect(wechatMiniProgramUnbindRequestSchema.safeParse({ code: 'fresh-code' }).success).toBe(
      true,
    );
    expect(
      wechatMiniProgramUnbindRequestSchema.safeParse({ code: 'fresh-code', deleteUser: true })
        .success,
    ).toBe(false);
    expect(
      platformAdminWechatMiniProgramUnbindRequestSchema.parse({ reason: '  用户申请解绑  ' }),
    ).toEqual({ reason: '用户申请解绑' });
    expect(
      platformAdminWechatMiniProgramUnbindRequestSchema.safeParse({ reason: '   ' }).success,
    ).toBe(false);
    expect(wechatMiniProgramUnbindResponseSchema.safeParse({ unbound: true }).success).toBe(true);
    expect(wechatMiniProgramUnbindResponseSchema.safeParse({ deleted: true }).success).toBe(false);
  });

  it('exposes only the current Mini binding and unbind eligibility', () => {
    expect(
      wechatMiniProgramBindingStatusSchema.safeParse({ bound: true, canUnbind: true }).success,
    ).toBe(true);
    expect(
      wechatMiniProgramBindingStatusSchema.safeParse({
        bound: true,
        canUnbind: true,
        openid: 'must-not-leak',
      }).success,
    ).toBe(false);
  });

  it('defines a masked preview and authenticated admin-binding confirmation', () => {
    expect(
      createWechatAdminBindingLinkResponseSchema.safeParse({
        authVersion: 1,
        expiresAt: '2026-09-21T00:00:00.000Z',
        urlLink: 'https://w.example.test/link',
      }).success,
    ).toBe(true);
    expect(wechatAdminBindingPreviewRequestSchema.parse({ ticket: 'ticket-value' })).toEqual({
      ticket: 'ticket-value',
    });
    expect(
      wechatAdminBindingPreviewResponseSchema.safeParse({
        expiresAt: '2026-09-21T00:00:00.000Z',
        realNameMasked: '张*',
        usernameMasked: 'doc***',
      }).success,
    ).toBe(true);
    expect(
      wechatAdminBindingConfirmRequestSchema.safeParse({
        code: 'fresh-code',
        ticket: 'ticket-value',
      }).success,
    ).toBe(true);
    expect(
      wechatAdminBindingConfirmResponseSchema.safeParse({
        expiresAt: '2026-09-21T00:00:00.000Z',
        profile: { id: 'u1', realName: '张三', version: 1 },
        status: 'authenticated',
        token: 'token',
      }).success,
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

  it('accepts only anonymous decimal visitor aggregates', () => {
    expect(
      visitorAccessAggregatePageSchema.safeParse({
        aggregates: [{ accessCount: '42', accessMonth: '2026-08', businessMonth: '2026-09' }],
        nextCursor: '2026-08|2026-09',
      }).success,
    ).toBe(true);
    expect(
      visitorAccessAggregatePageSchema.safeParse({
        aggregates: [
          {
            accessCount: '42',
            accessMonth: '2026-08',
            businessMonth: '2026-09',
            clientIp: '127.0.0.1',
          },
        ],
      }).success,
    ).toBe(false);
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
    const mutation = {
      expectedTargetVersion: 1,
      operationId: '11111111-1111-4111-8111-111111111111',
    };
    expect(
      createInviteLinkRequestSchema.safeParse({ ...mutation, targetMembershipId: 'm1' }).success,
    ).toBe(true);
    expect(
      createInviteLinkRequestSchema.safeParse({ ...mutation, targetRosterEntryId: 'r1' }).success,
    ).toBe(true);
    expect(createInviteLinkRequestSchema.safeParse({}).success).toBe(false);
    expect(
      createInviteLinkRequestSchema.safeParse({
        ...mutation,
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
