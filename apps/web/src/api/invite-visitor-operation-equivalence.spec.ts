import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('P8 Web invite and visitor mutation delegation', () => {
  it('delegates all four writes through the shared client', () => {
    const source = readFileSync(new URL('./client.ts', import.meta.url), 'utf8');
    expect(source).toContain('createInviteVisitorWriteClient');
    expect(source).toContain(
      'const inviteVisitorWriteClient = createInviteVisitorWriteClient(sharedClientTransport)',
    );
    for (const method of [
      'createInviteLink',
      'acceptInvite',
      'revokeInvite',
      'regenerateVisitorKey',
    ]) {
      expect(source).toContain(`return inviteVisitorWriteClient.${method}(`);
    }
  });
});
