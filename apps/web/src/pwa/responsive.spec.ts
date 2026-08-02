import { breakpointTokens, layoutTokens, spacingTokens } from '@schedule/ui-tokens';
import { describe, expect, it } from 'vitest';

import { getViewportTier } from '../features/calendar/calendar-views.js';
import { maxScheduleCacheEntries } from './cache-logic.js';
import { offlineSubmitMessage } from './offline-guard.js';

describe('Responsive experience', () => {
  it('maps viewport widths to mobile, tablet, and desktop tiers', () => {
    expect(getViewportTier(320)).toBe('mobile');
    expect(getViewportTier(breakpointTokens.mobile)).toBe('tablet');
    expect(getViewportTier(breakpointTokens.tablet)).toBe('tablet');
    expect(getViewportTier(breakpointTokens.desktop)).toBe('desktop');
  });

  it('defines a fixed bottom navigation height for the mobile first screen', () => {
    expect(layoutTokens.bottomNavHeight).toBe('64px');
    expect(spacingTokens.lg).toBe('24px');
  });

  it('caches at most twelve recent schedule months for offline reading', () => {
    expect(maxScheduleCacheEntries).toBe(12);
  });

  it('explains offline submission instead of silently queueing', () => {
    expect(offlineSubmitMessage).toContain('提交已暂停');
    expect(offlineSubmitMessage).toContain('恢复网络');
  });
});
