import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const sourceRoot = fileURLToPath(new URL('../', import.meta.url));
const componentPath = join(sourceRoot, 'components', 'TemporalPicker.vue');
const statisticsViewPath = join(sourceRoot, 'views', 'statistics', 'StatisticsView.vue');

function vueSources(directory: string): readonly string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return vueSources(path);
    return extname(entry.name) === '.vue' ? [readFileSync(path, 'utf8')] : [];
  });
}

describe('production temporal picker', () => {
  it('uses the approved accessible year, month, date, and time interaction language', () => {
    expect(existsSync(componentPath)).toBe(true);
    const component = readFileSync(componentPath, 'utf8');

    expect(component).toContain("type TemporalPickerKind = 'year' | 'month' | 'date' | 'time'");
    expect(component).toContain('role="dialog"');
    expect(component).toContain('role="listbox"');
    expect(component).toContain('class="month-wheel"');
    expect(component).toContain('class="date-grid"');
    expect(component).toContain('class="time-wheel"');
    expect(component).toContain('prefers-reduced-motion: reduce');
    expect(component).toContain("emit('change', value)");
  });

  it('keeps the mobile date marker circular and uses touch-first frameless numeric wheels', () => {
    const component = readFileSync(componentPath, 'utf8');

    expect(component).toContain('ref="hourWheel"');
    expect(component).toContain('ref="minuteWheel"');
    expect(component).toContain('class="wheel-rails"');
    expect(component).toMatch(/\.wheel-column\s*{[^}]*overflow-y:\s*auto;/s);
    expect(component).toMatch(/\.wheel-column\s*{[^}]*touch-action:\s*pan-y;/s);
    expect(component).toMatch(/\.wheel-column\s*{[^}]*-webkit-overflow-scrolling:\s*touch;/s);
    expect(component).toMatch(
      /\.wheel-column button\.is-selected\s*{[^}]*background:\s*transparent;[^}]*box-shadow:\s*none;/s,
    );
    expect(component).toMatch(
      /\.date-grid button::before\s*{[^}]*width:\s*36px;[^}]*height:\s*36px;[^}]*border-radius:\s*50%;/s,
    );
    expect(component).toMatch(
      /\.date-grid button\.is-selected\s*{[^}]*background:\s*transparent;/s,
    );
  });

  it('keeps the trigger text-first and updates wheel selection without delayed settling', () => {
    const component = readFileSync(componentPath, 'utf8');

    expect(component).not.toContain('class="temporal-picker-icon"');
    expect(component).toContain(
      '`${parsed.year}-${pad(parsed.month)}-${pad(parsed.day)} 周${weekday}`',
    );
    expect(component).toMatch(
      /\.temporal-picker-trigger\s*{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) 14px;/s,
    );
    expect(component).toContain('requestAnimationFrame');
    expect(component).toContain('@scrollend="finishWheelScroll');
    expect(component).not.toContain('wheelSettleTimers');
    expect(component).not.toContain('scroll-snap-stop: always');
  });

  it('uses the unified single-wheel year picker for annual statistics', () => {
    const component = readFileSync(componentPath, 'utf8');
    const statisticsView = readFileSync(statisticsViewPath, 'utf8');

    expect(component).toContain("type TemporalPickerKind = 'year' | 'month' | 'date' | 'time'");
    expect(component).toContain('class="year-wheel"');
    expect(component).toMatch(/props\.kind === 'year'\s*\?\s*\['year'\]/);
    expect(statisticsView).toContain('v-model="statisticsYear"');
    expect(statisticsView).toContain('kind="year"');
    expect(statisticsView).toContain('label="统计年份"');
    expect(statisticsView).not.toContain('<select v-else');
  });

  it('does not pass a transient null table ref to ResizeObserver when statistics rerenders', () => {
    const statisticsView = readFileSync(statisticsViewPath, 'utf8');

    expect(statisticsView).toContain('if (!(element instanceof HTMLElement)) return;');
    expect(statisticsView).not.toContain('if (element !== undefined && typeof ResizeObserver');
  });

  it('closes a modal picker from a pointer outside its visible bounds', () => {
    const component = readFileSync(componentPath, 'utf8');

    expect(component).toContain("document.addEventListener('pointerdown', closeFromOutside, true)");
    expect(component).toContain(
      "document.removeEventListener('pointerdown', closeFromOutside, true)",
    );
    expect(component).toContain('isPointOutsideRectangle(');
    expect(component).not.toContain('@click="closeFromBackdrop"');
  });

  it('replaces production native month, date, and time controls without touching datetime-local', () => {
    const productionSources = [
      ...vueSources(join(sourceRoot, 'features')),
      ...vueSources(join(sourceRoot, 'views')),
    ].join('\n');

    expect(productionSources).not.toMatch(/type=["'](?:month|date|time)["']/);
    expect(productionSources).toContain('type="datetime-local"');
    expect(productionSources).toContain('<TemporalPicker');
  });
});
