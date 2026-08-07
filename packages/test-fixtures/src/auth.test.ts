import { describe, expect, it } from 'vitest';

import { createFakeAuthPort } from './auth.js';

describe('createFakeAuthPort', () => {
  it('maps bearer tokens to external uids and rejects unknown tokens', async () => {
    const port = createFakeAuthPort((token) =>
      token === 'member-token' ? 'uid-member' : undefined,
    );

    await expect(port.authenticate({ authorization: 'Bearer member-token' })).resolves.toEqual({
      cloudbaseUid: 'uid-member',
    });
    await expect(port.authenticate({ authorization: undefined })).resolves.toBeUndefined();
    await expect(
      port.authenticate({ authorization: 'Bearer unknown-token' }),
    ).resolves.toBeUndefined();
  });
});
