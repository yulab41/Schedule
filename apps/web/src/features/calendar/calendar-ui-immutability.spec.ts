import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

describe('calendar surface immutability', () => {
  it('keeps the approved MonthGrid and WeekGrid sources byte-for-byte unchanged', () => {
    expect(sourceHash('./MonthGrid.vue')).toBe(
      '72c3bc9ac83d2718e2a52e458abc9bd702732e7efb5bc0c933bbb942cce98405',
    );
    expect(sourceHash('./WeekGrid.vue')).toBe(
      '32d50cdc5dca2c6b3e21147768047972246c813b83054b1906d81286ac866a60',
    );
  });
});

function sourceHash(relativePath: string): string {
  return createHash('sha256')
    .update(readFileSync(fileURLToPath(new URL(relativePath, import.meta.url))))
    .digest('hex');
}
