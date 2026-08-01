import { gzipSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import { createCloudbaseAuthPort, createCloudbaseHttpAuthPort } from './cloudbase-auth.js';

describe('CloudBase authentication adapter', () => {
  it('uses the CloudBase runtime UID instead of caller-supplied HTTP values', async () => {
    const authPort = createCloudbaseAuthPort(() => ({
      isAnonymous: false,
      uid: 'cloudbase-trusted-uid',
    }));

    await expect(
      authPort.authenticate({
        authorization: 'Bearer forged-token',
        trustedCloudbaseContext: encodeCloudbaseContext({ uid: 'forged-uid' }),
      }),
    ).resolves.toEqual({ cloudbaseUid: 'cloudbase-trusted-uid' });
  });

  it('rejects anonymous and missing CloudBase identities', async () => {
    const anonymousPort = createCloudbaseAuthPort(() => ({
      isAnonymous: true,
      uid: 'anonymous-uid',
    }));
    const missingIdentityPort = createCloudbaseAuthPort(() => ({
      isAnonymous: false,
      uid: '',
    }));

    await expect(anonymousPort.authenticate({ authorization: undefined })).resolves.toBeUndefined();
    await expect(
      missingIdentityPort.authenticate({ authorization: undefined }),
    ).resolves.toBeUndefined();
  });

  it('maps the trusted CloudBase HTTP context user ID to the business UID', async () => {
    const authPort = createCloudbaseHttpAuthPort();

    await expect(
      authPort.authenticate({
        authorization: 'Bearer forged-token',
        trustedCloudbaseContext: encodeCloudbaseHttpContext({ userId: 'cloudbase-http-uid' }),
      }),
    ).resolves.toEqual({ cloudbaseUid: 'cloudbase-http-uid' });
  });

  it('rejects missing, unauthenticated, malformed, and oversized CloudBase HTTP contexts', async () => {
    const authPort = createCloudbaseHttpAuthPort();

    for (const trustedCloudbaseContext of [
      undefined,
      encodeCloudbaseHttpContext({ authMethod: 'UNAUTHORIZED', userId: 'unauthenticated-user' }),
      encodeCloudbaseHttpContext({ userId: '' }),
      'not-base64-json',
      'a'.repeat(4097),
    ]) {
      await expect(
        authPort.authenticate({ authorization: 'Bearer forged-token', trustedCloudbaseContext }),
      ).resolves.toBeUndefined();
    }
  });
});

function encodeCloudbaseContext(context: object): string {
  return Buffer.from(JSON.stringify(context), 'utf8').toString('base64');
}

function encodeCloudbaseHttpContext(context: object): string {
  return gzipSync(Buffer.from(JSON.stringify(context), 'utf8')).toString('base64');
}
