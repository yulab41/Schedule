import { describe, expect, it } from 'vitest';

import {
  createWechatAdminBindingLinkRequestSchema,
  createWechatAdminBindingLinkResponseSchema,
  passwordIdentityAssignmentRequestSchema,
  passwordIdentityAssignmentResponseSchema,
} from './index.js';

const operationId = '11111111-1111-4111-8111-111111111111';

describe('P8 platform identity mutation contracts', () => {
  it('requires target auth version and operation id for username assignment', () => {
    expect(
      passwordIdentityAssignmentRequestSchema.safeParse({
        expectedAuthVersion: 3,
        operationId,
        username: 'doctor.admin',
      }).success,
    ).toBe(true);
    expect(
      passwordIdentityAssignmentRequestSchema.safeParse({ username: 'doctor.admin' }).success,
    ).toBe(false);
    expect(
      passwordIdentityAssignmentResponseSchema.safeParse({
        authVersion: 4,
        passwordConfigured: false,
        username: 'doctor.admin',
      }).success,
    ).toBe(true);
  });

  it('requires target auth version and operation id for binding-link creation', () => {
    expect(
      createWechatAdminBindingLinkRequestSchema.safeParse({
        expectedAuthVersion: 3,
        operationId,
      }).success,
    ).toBe(true);
    expect(createWechatAdminBindingLinkRequestSchema.safeParse({}).success).toBe(false);
    expect(
      createWechatAdminBindingLinkResponseSchema.safeParse({
        authVersion: 3,
        expiresAt: '2026-08-25T12:00:00.000Z',
        urlLink: 'https://wxaurl.cn/example',
      }).success,
    ).toBe(true);
  });
});
