import { describe, expect, it } from 'vitest';

import { platformAdminUserAccountListSchema, platformAdminUserAccountSchema } from './platform.js';

describe('platform account status contracts', () => {
  it('returns only redacted account state needed for assignment', () => {
    const account = {
      authVersion: 2,
      hasPassword: false,
      id: 'user-1',
      status: 'active' as const,
      username: 'doctor.one',
    };
    expect(platformAdminUserAccountSchema.safeParse(account).success).toBe(true);
    expect(platformAdminUserAccountListSchema.safeParse({ users: [account] }).success).toBe(true);
    expect(
      platformAdminUserAccountSchema.safeParse({ ...account, realName: 'should-not-leak' }).success,
    ).toBe(false);
  });
});
