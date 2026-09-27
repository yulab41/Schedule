import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (file) => new URL(`../src/${file}`, import.meta.url);
const read = (file) => readFileSync(source(file), 'utf8');
const entries = [
  'components/calendar/calendar-cell/index',
  'components/calendar/calendar-week-panel/index',
  'pages/workbench/index',
  'pages/guest/guest',
];

describe('calendar fixed three-character name contract', () => {
  it('has no per-name measuring component, cache, observer or scale binding', () => {
    expect(existsSync(source('components/calendar/calendar-fit-line/index.ts'))).toBe(false);
    for (const entry of entries) {
      expect(read(`${entry}.wxml`)).not.toMatch(
        /calendar-fit-line|fitScale|content-key|reference-name/u,
      );
      expect(read(`${entry}.json`)).not.toContain('calendar-fit-line');
    }
  });

  it('uses one CSS-only three-em limit and preserves full names in text bindings', () => {
    const style = read('styles/calendar-name-line.wxss');
    expect(style).toMatch(/max-width:\s*3em/u);
    expect(style).toMatch(/text-overflow:\s*ellipsis/u);
    expect(style).toMatch(/white-space:\s*nowrap/u);
    expect(style).not.toMatch(/transform|scale\(|font-size|transition/u);
    for (const entry of entries) {
      expect(read(`${entry}.wxml`)).toContain('calendar-name-text');
      expect(read(`${entry}.wxml`)).not.toMatch(/\.slice\(|\.substring\(/u);
    }
  });

  it('keeps month/list badges beside the name and week badges on the next row', () => {
    const month = read('components/calendar/calendar-cell/index.wxml');
    expect(month).toMatch(
      /class="month-person calendar-name-text"[\s\S]*class="duty-abbreviation"/u,
    );
    expect(month).toMatch(/class="month-person calendar-name-text"[\s\S]*class="change-mark"/u);
    for (const entry of entries.slice(1)) {
      const view = read(`${entry}.wxml`);
      expect(view).toMatch(
        /<text class="week-duty-name calendar-name-text"\s*>\{\{duty.name\}\}<\/text\s*>\s*<\/view\s*>\s*<view[\s\S]{0,150}class="week-duty-badges"/u,
      );
      expect(view).toContain('class="week-group-title"');
      if (entry.startsWith('pages/'))
        expect(view).toContain('class="list-duty-name calendar-name-text"');
    }
  });

  it('left-aligns every combination while using three characters plus a badge only for sizing', () => {
    const style = read('styles/calendar-name-line.wxss');
    expect(style).toMatch(/justify-content:\s*flex-start/u);
    expect(style).not.toContain('is-centered');
    for (const entry of entries)
      expect(read(`${entry}.wxml`)).not.toMatch(/calendar-name-line[^"]*is-centered/u);
  });

  it('retains the immediate viewMode-driven indicator and reduced-motion rule', () => {
    for (const entry of entries.slice(2)) {
      expect(read(`${entry}.wxml`)).toContain('class="view-switch is-{{viewMode}}"');
      expect(read(`${entry}.wxml`)).toContain('class="view-switch-indicator" aria-hidden="true"');
    }
    const css = read('pages/workbench/index.wxss');
    expect(css).toContain('transform 240ms cubic-bezier(0.2, 0.8, 0.2, 1)');
    expect(css).toContain('color 180ms ease');
    expect(css).toMatch(/prefers-reduced-motion:[\s\S]*\.view-switch-indicator/u);
  });

  it('applies a container-level value and gives preview dialogs their own layout', () => {
    expect(read('components/calendar/calendar-month/index.wxml')).toContain(
      'style="{{calendarNameStyle}}"',
    );
    expect(
      read('subpackages/scheduling/components/schedule-calendar-preview/index.wxml'),
    ).toContain("name-layout=\"{{compact ? 'dialog' : 'preview'}}\"");
    expect(read('subpackages/scheduling/pages/backfill/index.wxml')).toContain(
      'name-layout="backfill"',
    );
    for (const entry of entries.slice(2))
      expect(read(`${entry}.wxml`)).toContain(
        'class="week-calendar" style="{{calendarNameStyle}}"',
      );
  });
});
