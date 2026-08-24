import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('workflow dangerous-write contracts', () => {
  it('requires an operation id when a leave request is created', () => {
    const source = readFileSync(new URL('./leaves.ts', import.meta.url), 'utf8');
    expect(source).toMatch(
      /export interface CreateLeaveRequestInput\s*\{[^}]*readonly operationId: string;[^}]*\}/u,
    );
  });
});
