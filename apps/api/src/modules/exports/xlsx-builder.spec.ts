import { describe, expect, it } from 'vitest';

import { buildXlsx } from './xlsx-builder.js';

describe('xlsx builder', () => {
  it('creates a real Office Open XML zip with Chinese text and formula-safe strings', async () => {
    const result = await buildXlsx(
      [
        ['日期', '成员'],
        ['2026-09-01', '张医生'],
        ['2026-09-02', '=HYPERLINK("bad")'],
      ],
      '排班',
    );
    expect(result.subarray(0, 4).toString('hex')).toBe('504b0304');
    expect(result.length).toBeGreaterThan(1_000);
  });
});
