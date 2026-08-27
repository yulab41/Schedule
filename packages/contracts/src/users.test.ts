import { describe, expect, it } from 'vitest';

import {
  userProfileAvatarDeleteResponseSchema,
  userProfileAvatarMutationResponseSchema,
  userProfileSchema,
} from './users.js';

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

  it('defines strict avatar mutation and deletion responses', () => {
    expect(userProfileAvatarMutationResponseSchema.safeParse({ avatarVersion: 4 }).success).toBe(
      true,
    );
    expect(userProfileAvatarMutationResponseSchema.safeParse({ avatarVersion: 0 }).success).toBe(
      false,
    );
    expect(
      userProfileAvatarMutationResponseSchema.safeParse({ avatarUrl: 'https://example.invalid' })
        .success,
    ).toBe(false);
    expect(userProfileAvatarDeleteResponseSchema.safeParse({ removed: true }).success).toBe(true);
    expect(
      userProfileAvatarDeleteResponseSchema.safeParse({ removed: false, userId: 'user-1' }).success,
    ).toBe(false);
  });
});
