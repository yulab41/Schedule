import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

describe('unified temporal picker preview', () => {
  it('previews month, date, and time with one compact medical scheduling language', () => {
    const preview = source('./TemporalPickerPreview.vue');

    expect(preview).toContain("type PickerKind = 'month' | 'date' | 'time'");
    expect(preview).toContain('class="picker-trigger"');
    expect(preview).toContain('class="selection-summary"');
    expect(preview).toContain('class="month-wheel"');
    expect(preview).toContain('aria-label="年份"');
    expect(preview).toContain('aria-label="月份"');
    expect(preview).toContain('ref="hourWheel"');
    expect(preview).toContain('ref="minuteWheel"');
    expect(preview).toContain('const minuteWheelOptions = Array.from({ length: 9 }');
    expect(preview).toContain(':data-wheel-value="option.position"');
    expect(preview).toContain('@scroll.passive="settleWheel(\'hour\', $event)"');
    expect(preview).toContain('@scroll.passive="settleWheel(\'minute\', $event)"');
    expect(preview).toMatch(/\.wheel-column\s*{[^}]*overflow-y:\s*auto;/s);
    expect(preview).toMatch(/\.wheel-column\s*{[^}]*touch-action:\s*pan-y;/s);
    expect(preview).toMatch(/\.wheel-column\s*{[^}]*-webkit-overflow-scrolling:\s*touch;/s);
    expect(preview).toContain('scroll-snap-type: y mandatory');
    expect(preview).toContain('class="date-grid"');
    expect(preview).toMatch(
      /\.date-grid button::before\s*{[^}]*width:\s*36px;[^}]*height:\s*36px;[^}]*border-radius:\s*50%;/s,
    );
    expect(preview).toMatch(/\.date-grid button\.is-selected\s*{[^}]*background:\s*transparent;/s);
    expect(preview).toContain('class="time-wheel"');
    expect(preview).toContain('class="wheel-rails"');
    expect(preview).toMatch(
      /\.wheel-column button\.is-selected\s*{[^}]*background:\s*transparent;[^}]*box-shadow:\s*none;/s,
    );
    expect(preview).toContain('role="dialog"');
    expect(preview).toMatch(/\.picker-trigger\s*{[^}]*min-height:\s*44px;/s);
    expect(preview).toContain('#0a66d5');
    expect(preview).toContain('font-variant-numeric: tabular-nums');
  });

  it('provides mobile and desktop Storybook states for visual review', () => {
    const stories = source('./TemporalPickerPreview.stories.ts');

    expect(stories).toContain('MobileMonth390');
    expect(stories).toContain('MobileDate320');
    expect(stories).toContain('MobileTime390');
    expect(stories).toContain('Desktop1280');
    expect(stories).toContain("args: { initialKind: 'month', layout: 'desktop' }");
  });
});
