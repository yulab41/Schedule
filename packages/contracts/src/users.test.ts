import { describe, expect, it } from 'vitest';
import { userProfileSchema } from './users.js';
describe('user profile contract', () => {
  it('only exposes identity fields', () => {
    const profile = { id: 'user-1', realName: '示例用户', version: 2 };
    expect(userProfileSchema.parse(profile)).toEqual(profile);
    expect(
      userProfileSchema.safeParse({ ...profile, avatarUrl: 'https://example.invalid/photo' })
        .success,
    ).toBe(false);
  });
});
