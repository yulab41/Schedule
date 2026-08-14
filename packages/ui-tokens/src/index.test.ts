import { describe, expect, it } from 'vitest';

import {
  breakpointTokens,
  calculateContrastRatio,
  colorTokens,
  fontFamilyTokens,
  fontSizeTokens,
  getBestContrastRatio,
  isTextReadable,
  parseHexColor,
  pickReadableTextColor,
  radiusTokens,
  shadowTokens,
  spacingTokens,
  touchTargetTokens,
} from './index.js';

describe('UI design tokens', () => {
  it('exposes the approved Apple Health-style semantic palette', () => {
    expect(colorTokens.primary).toBe('#0A66D5');
    expect(colorTokens.primaryLight).toBe('#EAF3FF');
    expect(colorTokens.successLight).toBe('#EAF8EF');
    expect(colorTokens.surface).toBe('#FFFFFF');
    expect(colorTokens.background).toBe('#F4F7FB');
    expect(colorTokens.textPrimary).toBe('#16202A');
    expect(colorTokens.textSecondary).toBe('#5E6A78');
    expect(colorTokens.border).toBe('#DCE3EB');
  });

  it('keeps body text, titles, spacing, and touch targets on the approved scale', () => {
    expect(fontSizeTokens.md).toBe('15px');
    expect(fontSizeTokens.sm).toBe('13px');
    expect(fontSizeTokens.xl).toBe('20px');
    expect(fontSizeTokens.xxl).toBe('28px');
    expect(spacingTokens.lg).toBe('20px');
    expect(spacingTokens.xl).toBe('24px');
    expect(spacingTokens.xxl).toBe('32px');
    expect(touchTargetTokens.minimum).toBe('44px');
    expect(breakpointTokens.mobile).toBeLessThan(breakpointTokens.desktop);
  });

  it('exports reusable type, radius, and elevation foundations', () => {
    expect(fontFamilyTokens.system).toContain('-apple-system');
    expect(fontFamilyTokens.system).toContain('PingFang SC');
    expect(radiusTokens).toMatchObject({ large: '18px', medium: '14px', small: '10px' });
    expect(shadowTokens.card).toContain('22 32 42');
  });

  it('parses only normalized six-digit hex colors', () => {
    expect(parseHexColor('#0A66D5')).toEqual({ b: 213, g: 102, r: 10 });
    expect(parseHexColor('not-a-color')).toBeUndefined();
    expect(parseHexColor('#FFF')).toBeUndefined();
  });

  it('calculates WCAG contrast ratios and readability', () => {
    expect(calculateContrastRatio('#FFFFFF', '#FFFFFF')).toBe(1);
    expect(calculateContrastRatio('#FFFFFF', '#111827')).toBeGreaterThan(15);
    expect(isTextReadable('#FFFFFF', '#0A66D5')).toBe(true);
    expect(isTextReadable('#5E6A78', '#FFFFFF')).toBe(true);
    expect(isTextReadable('#808080', '#FFFFFF')).toBe(false);
  });

  it('picks the more readable text color for a background', () => {
    expect(pickReadableTextColor('#0A66D5')).toBe('#FFFFFF');
    expect(pickReadableTextColor('#FFFFFF')).toBe('#16202A');
    expect(getBestContrastRatio('#0A66D5')).toBeGreaterThanOrEqual(4.5);
  });
});
