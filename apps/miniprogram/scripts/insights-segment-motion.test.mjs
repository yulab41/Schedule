import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path) =>
  readFileSync(new URL(`../src/subpackages/insights/components/${path}`, import.meta.url), 'utf8');

describe('insights segmented control motion', () => {
  it('keeps one persistent moving background in each statistics and settings control', () => {
    const dashboard = read('insights-dashboard-panel/index.wxml');
    const settings = read('notifications-panel/index.wxml');
    expect(dashboard).toContain('tab-switch is-{{activeTab}}');
    expect(dashboard).toContain('class="tab-indicator"');
    expect(dashboard).toContain('statistics-mode is-{{statisticsMode}}');
    expect(dashboard).toContain('class="statistics-mode-indicator"');
    expect(settings).toContain('reminder-mode is-{{myHoursMode}}');
    expect(settings).toContain('class="reminder-mode-indicator"');
  });

  it('uses the calendar/directory timing and supports reduced motion and vertical large text', () => {
    for (const panel of ['insights-dashboard-panel', 'notifications-panel']) {
      const css = read(`${panel}/index.wxss`);
      expect(css).toContain('transform 240ms cubic-bezier(0.2, 0.8, 0.2, 1)');
      expect(css).toContain('color 180ms ease');
      expect(css).toContain('prefers-reduced-motion: reduce');
    }
    expect(read('notifications-panel/index.wxss')).toContain('translateY(calc(200% + 6px))');
  });
});
