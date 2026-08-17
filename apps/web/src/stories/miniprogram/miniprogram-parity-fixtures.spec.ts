import { describe, expect, it } from 'vitest';

import { createMiniprogramMatrixFixture } from './miniprogram-parity-fixtures.js';

describe('miniprogram parity fixtures', () => {
  it('keeps the daily matrix at the observed 7 by 7 size', () => {
    const fixture = createMiniprogramMatrixFixture('daily');

    expect(fixture.rows).toHaveLength(7);
    expect(fixture.columns).toHaveLength(7);
    expect(fixture.logicalCellCount).toBe(49);
  });

  it('keeps the maximum matrix at the approved 20 by 30 boundary', () => {
    const fixture = createMiniprogramMatrixFixture('maximum');

    expect(fixture.rows).toHaveLength(20);
    expect(fixture.columns).toHaveLength(30);
    expect(fixture.logicalCellCount).toBe(600);
  });
});
