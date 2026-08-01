import { describe, expect, it } from 'vitest';

import { calculateReadableTextColor, calculateShiftEndDate } from './shift-time.js';

describe('shift time helpers', () => {
  it('moves cross-midnight shifts to the next calendar day', () => {
    expect(calculateShiftEndDate('2026-08-31', true)).toBe('2026-09-01');
    expect(calculateShiftEndDate('2026-08-31', false)).toBe('2026-08-31');
  });

  it('selects a readable text color from a shift background color', () => {
    expect(calculateReadableTextColor('#FFFFFF')).toBe('#111827');
    expect(calculateReadableTextColor('#1F5AA6')).toBe('#FFFFFF');
  });
});
