import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { expect, it } from 'vitest';

it('does not render stray text inside the three-line calendar filter icon', () => {
  const document = new JSDOM(
    readFileSync(new URL('../src/pages/workbench/index.wxml', import.meta.url), 'utf8'),
  ).window.document;
  expect(document.querySelector('.filter-icon').textContent.trim()).toBe('');
});

it('uses a compact special-date description and explicit one-year period', () => {
  const template = readFileSync(
    new URL('../src/components/profile-panel/index.wxml', import.meta.url),
    'utf8',
  );
  expect(template).toContain('本月周末/节假');
  expect(template).toContain('近一年');
});
