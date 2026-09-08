import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
const read = (file) => readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
it('places statistics before events and uses yellow for the selected today ring', () => {
  const tabs = read('subpackages/insights/components/insights-dashboard-panel/index.wxml');
  expect(tabs.indexOf('data-tab="statistics"')).toBeLessThan(tabs.indexOf('data-tab="events"'));
  const css = read('components/ui/ui-date-picker/index.wxss');
  expect(
    css.match(/\.workflow-picker-date-cell\.is-today\.is-selected > text\s*\{([^}]+)\}/u)[1],
  ).toContain('inset 0 0 0 2px var(--ui-color-today-marker)');
});
