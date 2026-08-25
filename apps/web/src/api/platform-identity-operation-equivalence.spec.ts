import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('P8 Web platform identity mutation delegation', () => {
  it('delegates both writes and freezes ambiguous retries', () => {
    const client = readFileSync(new URL('./client.ts', import.meta.url), 'utf8');
    const view = readFileSync(
      new URL('../views/platform/PlatformAdminUsersView.vue', import.meta.url),
      'utf8',
    );

    expect(client).toContain('createPlatformIdentityWriteClient');
    expect(client).toContain(
      'const platformIdentityWriteClient = createPlatformIdentityWriteClient(sharedClientTransport)',
    );
    expect(client).toContain(
      'return platformIdentityWriteClient.assignPasswordIdentity(userId, input)',
    );
    expect(client).toContain(
      'return platformIdentityWriteClient.createWechatBindingLink(userId, input)',
    );
    expect(view).toContain('resolveWorkflowOperationAttempt');
    expect(view).toContain('operationAttempts');
    expect(view).toContain('expectedAuthVersion: account.authVersion');
    expect(view).toContain('crypto.randomUUID');
  });
});
