import {
  breakpointTokens,
  calculateContrastRatio,
  colorTokens,
  fontSizeTokens,
  isTextReadable,
} from '@schedule/ui-tokens';
import { describe, expect, it } from 'vitest';

import { getFocusOrder, workbenchNavItems } from '../features/layout/workbench-nav.js';

describe('Accessibility baseline', () => {
  it('keeps body and duty text at the readable 14px-plus scale', () => {
    expect(parseFloat(fontSizeTokens.md)).toBeGreaterThanOrEqual(14);
    expect(parseFloat(fontSizeTokens.sm)).toBeGreaterThanOrEqual(13);
    expect(parseFloat(fontSizeTokens.xl)).toBeGreaterThanOrEqual(18);
  });

  it('meets WCAG AA contrast for every primary text pair', () => {
    expect(isTextReadable(colorTokens.textPrimary, colorTokens.surface)).toBe(true);
    expect(isTextReadable(colorTokens.textSecondary, colorTokens.surface)).toBe(true);
    expect(isTextReadable(colorTokens.textMuted, colorTokens.surface)).toBe(true);
    expect(isTextReadable(colorTokens.white, colorTokens.primary)).toBe(true);
    expect(isTextReadable(colorTokens.primary, colorTokens.surface)).toBe(true);
  });

  it('keeps a visible focus ring against white surfaces', () => {
    expect(
      calculateContrastRatio(colorTokens.focusRing, colorTokens.surface),
    ).toBeGreaterThanOrEqual(3);
  });

  it('supports keyboard navigation in a logical focus order', () => {
    const order = getFocusOrder(workbenchNavItems);
    expect(order[0]).toBe('calendar');
    expect(order).toEqual(workbenchNavItems.map((item) => item.id));
  });

  it('keeps the mobile breakpoint below the desktop breakpoint', () => {
    expect(breakpointTokens.mobile).toBeLessThan(breakpointTokens.desktop);
  });
});
