import { describe, expect, it } from 'vitest';

import { userProfileSchema } from './users.js';

describe('user profile contract', () => {
  it('accepts an optional independent avatar version', () => {
    expect(
      userProfileSchema.safeParse({
        avatarVersion: 3,
        id: 'user-1',
        realName: '示例用户',
        version: 2,
      }).success,
    ).toBe(true);
  });

  it('rejects invalid avatar versions and unknown fields', () => {
    expect(
      userProfileSchema.safeParse({
        avatarVersion: 0,
        id: 'user-1',
        realName: '示例用户',
        version: 2,
      }).success,
    ).toBe(false);
    expect(
      userProfileSchema.safeParse({
        avatarUrl: 'https://example.invalid/avatar.png',
        id: 'user-1',
        realName: '示例用户',
        version: 2,
      }).success,
    ).toBe(false);
  });
});
