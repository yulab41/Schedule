import { describe, expect, it } from 'vitest';

import {
  breakpointTokens,
  calculateContrastRatio,
  colorTokens,
  fontSizeTokens,
  getBestContrastRatio,
  isTextReadable,
  parseHexColor,
  pickReadableTextColor,
} from './index.js';

describe('UI design tokens', () => {
  it('exposes the light blue, light green, and white palette from the design', () => {
    expect(colorTokens.primary).toBe('#1F5AA6');
    expect(colorTokens.successLight).toBe('#F0FDF4');
    expect(colorTokens.surface).toBe('#FFFFFF');
    expect(colorTokens.background).toBe('#F5F7FA');
  });

  it('keeps body text at the readable 14px scale', () => {
    expect(fontSizeTokens.md).toBe('14px');
    expect(fontSizeTokens.sm).toBe('13px');
    expect(breakpointTokens.mobile).toBeLessThan(breakpointTokens.desktop);
  });

  it('parses only normalized six-digit hex colors', () => {
    expect(parseHexColor('#1F5AA6')).toEqual({ b: 166, g: 90, r: 31 });
    expect(parseHexColor('not-a-color')).toBeUndefined();
    expect(parseHexColor('#FFF')).toBeUndefined();
  });

  it('calculates WCAG contrast ratios and readability', () => {
    expect(calculateContrastRatio('#FFFFFF', '#FFFFFF')).toBe(1);
    expect(calculateContrastRatio('#FFFFFF', '#111827')).toBeGreaterThan(15);
    expect(isTextReadable('#FFFFFF', '#1F5AA6')).toBe(true);
    expect(isTextReadable('#6B7280', '#FFFFFF')).toBe(true);
    expect(isTextReadable('#808080', '#FFFFFF')).toBe(false);
  });

  it('picks the more readable text color for a background', () => {
    expect(pickReadableTextColor('#1F5AA6')).toBe('#FFFFFF');
    expect(pickReadableTextColor('#FFFFFF')).toBe('#111827');
    expect(getBestContrastRatio('#1F5AA6')).toBeGreaterThanOrEqual(4.5);
  });
});
