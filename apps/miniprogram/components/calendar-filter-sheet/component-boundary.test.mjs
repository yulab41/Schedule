import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const componentDirectory = dirname(fileURLToPath(import.meta.url));

function readComponentFile(name) {
  return readFile(join(componentDirectory, name), 'utf8');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function readDeclarationBlock(styles, selector) {
  const match = styles.match(
    new RegExp(`${escapeRegExp(`.calendar-filter-sheet${selector}`)}\\s*\\{([^}]*)\\}`, 'u'),
  );
  expect(match).not.toBeNull();
  return match[1];
}

describe('calendar filter sheet component boundary', () => {
  it('is a framework-free component built on the existing bottom-sheet shell', async () => {
    const [manifest, source, template] = await Promise.all([
      readComponentFile('index.json'),
      readComponentFile('index.ts'),
      readComponentFile('index.wxml'),
    ]);
    const parsed = JSON.parse(manifest);

    expect(parsed).toEqual({
      component: true,
      usingComponents: { 'bottom-sheet': '/components/bottom-sheet/index' },
    });
    expect(template).toContain('<bottom-sheet');
    expect(`${source}\n${template}\n${manifest}`).not.toMatch(
      /tdesign|t-(?:button|checkbox|input)|vant|weui/iu,
    );
  });

  it('exposes a controlled reusable contract and explicit apply/cancel lifecycle', async () => {
    const source = await readComponentFile('index.ts');

    for (const property of [
      'filterKey',
      'options',
      'optionsReady',
      'searchPlaceholder',
      'selectedIds',
      'sheetKey',
      'title',
      'visible',
    ]) {
      expect(source).toContain(`${property}: {`);
    }
    expect(source).toContain("this.triggerEvent('apply'");
    expect(source).toContain("this.triggerEvent('request-close'");
    expect(source).toContain("this.triggerEvent('closed'");
    expect(source).toContain('selectedIds: [...selectedIds]');
    expect(source).toContain('getCalendarFilterApplySelection');
  });

  it('renders search, selected summary, all/clear actions, accessible checks, and explicit footer actions', async () => {
    const template = await readComponentFile('index.wxml');

    expect(template).toContain('bindinput="handleSearchInput"');
    expect(template).toContain('adjust-position="{{true}}"');
    expect(template).toContain('cursor-spacing="24"');
    expect(template).toContain('{{selectionSummary}}');
    expect(template).toContain('bindtap="handleSelectAll"');
    expect(template).toContain('disabled="{{!optionsReady || allSelected || totalCount === 0}}"');
    expect(template).toMatch(/>\s*全选\s*<\/button\s*>/u);
    expect(template).toContain('bindtap="handleClearSelection"');
    expect(template).toContain('disabled="{{selectionIntentCount === 0}}"');
    expect(template).toMatch(/>\s*清空\s*<\/button\s*>/u);
    expect(template).toContain('wx:key="id"');
    expect(template).toContain("{{item.isSelected ? '已选择' : '未选择'}}");
    expect(template).toMatch(/class="calendar-filter-sheet__check">✓<\/text>/u);
    expect(template).toContain('bindtap="handleCancel"');
    expect(template).toMatch(/>\s*取消\s*<\/button\s*>/u);
    expect(template).toContain('bindtap="handleApply"');
    expect(template).toContain('disabled="{{!optionsReady}}"');
    expect(template).toMatch(/>\s*应用\s*<\/button\s*>/u);
  });

  it('keeps every interactive target at least 88rpx and protects the footer safe area', async () => {
    const [styles, tokens] = await Promise.all([
      readComponentFile('index.wxss'),
      readFile(join(componentDirectory, '../../tokens/index.wxss'), 'utf8'),
    ]);

    for (const selector of [
      '__search-input',
      '__search-clear',
      '__bulk-action',
      '__option',
      '__footer-button',
    ]) {
      expect(readDeclarationBlock(styles, selector)).toMatch(
        /min-height:\s*var\(--v3-touch-min\)/u,
      );
    }
    const touchTarget = tokens.match(/--v3-touch-min:\s*(\d+)rpx/u);
    expect(touchTarget).not.toBeNull();
    expect(Number(touchTarget[1])).toBeGreaterThanOrEqual(88);
    expect(styles).toContain('env(safe-area-inset-bottom)');
    expect(styles).toContain('overflow-wrap: anywhere');
  });
});
