import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('Web notification preference shared client boundary', () => {
  it('delegates personal and group reads and writes to client-core', () => {
    const source = readFileSync(new URL('./client.ts', import.meta.url), 'utf8');

    expect(source).toContain('createNotificationPreferencesClient(sharedClientTransport)');
    expect(source).toContain('return notificationPreferencesClient.getGroup(groupId)');
    expect(source).toContain('return notificationPreferencesClient.getMine(groupId)');
    expect(source).toContain('return notificationPreferencesClient.updateGroup(groupId, input)');
    expect(source).toContain('return notificationPreferencesClient.updateMine(groupId, input)');
  });
});
