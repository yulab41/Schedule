import { describe, expect, it } from 'vitest';

import { toUserProfile } from './user-profile.js';

describe('user profile row mapping', () => {
  it('includes an avatar version only when a stored avatar exists', () => {
    expect(
      toUserProfile({ avatarVersion: 4, id: 'user-1', realName: '示例用户', version: 2 }),
    ).toEqual({ avatarVersion: 4, id: 'user-1', realName: '示例用户', version: 2 });
    expect(
      toUserProfile({ avatarVersion: null, id: 'user-1', realName: '示例用户', version: 2 }),
    ).toEqual({ id: 'user-1', realName: '示例用户', version: 2 });
  });
});
