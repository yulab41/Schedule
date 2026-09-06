import { describe, expect, it } from 'vitest';
import { toUserProfile } from './user-profile.js';
describe('user profile row mapping', () => {
  it('does not expose legacy photo metadata', () => {
    const legacy = { avatarVersion: 4, id: 'user-1', realName: '示例用户', version: 2 };
    expect(toUserProfile(legacy)).toEqual({ id: 'user-1', realName: '示例用户', version: 2 });
  });
});
