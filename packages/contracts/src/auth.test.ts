import { describe, expect, it } from 'vitest';

import {
  passwordAuthResponseSchema,
  passwordChangeRequestSchema,
  passwordIdentityAssignmentRequestSchema,
  passwordRegisterRequestSchema,
  passwordProofChangeRequestSchema,
} from './auth.js';

describe('password authentication contracts', () => {
  it('accepts any non-empty password without a length limit', () => {
    expect(
      passwordRegisterRequestSchema.safeParse({ username: 'linenyu', password: '!' }).success,
    ).toBe(true);
    expect(
      passwordRegisterRequestSchema.safeParse({
        username: 'linenyu',
        password: '密码'.repeat(1000),
      }).success,
    ).toBe(true);
  });

  it('rejects an empty password', () => {
    expect(
      passwordRegisterRequestSchema.safeParse({ username: 'linenyu', password: '' }).success,
    ).toBe(false);
  });

  it('requires the password login response to report whether the default password remains', () => {
    expect(
      passwordAuthResponseSchema.safeParse({
        isNewUser: false,
        mustChangePassword: true,
        token: 'signed-token',
      }).success,
    ).toBe(true);
    expect(
      passwordAuthResponseSchema.safeParse({ isNewUser: false, token: 'signed-token' }).success,
    ).toBe(false);
  });

  it('accepts a non-empty password change and rejects a no-op change', () => {
    expect(
      passwordChangeRequestSchema.safeParse({ currentPassword: '123', newPassword: 'new' }).success,
    ).toBe(true);
    expect(
      passwordChangeRequestSchema.safeParse({ currentPassword: 'same', newPassword: 'same' })
        .success,
    ).toBe(false);
  });

  it('accepts exactly one current-password or WeChat-code proof', () => {
    expect(
      passwordProofChangeRequestSchema.parse({
        currentPassword: 'old-password',
        newPassword: 'new-password',
      }),
    ).toEqual({ currentPassword: 'old-password', newPassword: 'new-password' });
    expect(
      passwordProofChangeRequestSchema.parse({
        code: 'fresh-wechat-code',
        newPassword: 'new-password',
      }),
    ).toEqual({ code: 'fresh-wechat-code', newPassword: 'new-password' });
    expect(
      passwordProofChangeRequestSchema.safeParse({
        code: 'fresh-wechat-code',
        currentPassword: 'old-password',
        newPassword: 'new-password',
      }).success,
    ).toBe(false);
  });

  it('keeps admin password identity assignment username-only', () => {
    expect(passwordIdentityAssignmentRequestSchema.parse({ username: '  Doctor.One  ' })).toEqual({
      username: 'Doctor.One',
    });
  });
});
