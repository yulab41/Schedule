import { describe, expect, it } from 'vitest';

import {
  passwordAuthResponseSchema,
  passwordChangeRequestSchema,
  passwordRegisterRequestSchema,
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
});
