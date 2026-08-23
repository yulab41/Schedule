import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const miniRoot = process.cwd();
const sourceRoot = path.join(miniRoot, 'src');
const pageRoot = path.join(sourceRoot, 'subpackages', 'scheduling', 'pages', 'manual');

function readPageFile(extension) {
  const filePath = path.join(pageRoot, `index.${extension}`);
  expect(existsSync(filePath), `missing native P5 manual page ${filePath}`).toBe(true);
  return readFileSync(filePath, 'utf8');
}

describe('native P5 manual schedule page', () => {
  it('is registered in the scheduling subpackage and mapped to the approved golden', () => {
    const appJson = JSON.parse(readFileSync(path.join(sourceRoot, 'app.json'), 'utf8'));
    expect(appJson.subpackages).toContainEqual({
      pages: ['pages/manual/index'],
      root: 'subpackages/scheduling',
    });
    const manifest = readFileSync(
      path.join(miniRoot, 'docs', 'design', 'page-golden-manifest.md'),
      'utf8',
    );
    expect(manifest).toContain('miniprogram-parity-p5-scheduling-closure--editor-390');
    expect(manifest).toContain('`--editor-320`');
  });

  it('reuses the accepted four-layer WXS matrix without nested native scrollers', () => {
    const wxml = readPageFile('wxml');
    expect(wxml).toContain('module="matrixGesture"');
    expect(wxml).toContain('bindtap="handleCellTap"');
    for (const className of ['matrix-corner', 'matrix-dates', 'matrix-members', 'matrix-body']) {
      expect(wxml).toContain(className);
    }
    expect(wxml).toContain('<scroll-view class="manual-page-scroll"');
    expect(wxml.match(/<scroll-view\b/gu) ?? []).toHaveLength(1);
    expect(wxml).not.toMatch(/<(?:native-view|pan-gesture-handler)\b/u);
    expect(wxml).not.toContain('bindtap="handleUndo"');
    expect(wxml).not.toContain('label="撤销"');
  });

  it('uses shared limits, Web toggle semantics, and the real manual schedule client', () => {
    const source = readPageFile('ts');
    expect(source).toContain("from '@schedule/contracts/manual-schedule-limits'");
    expect(source).toContain('MAX_MANUAL_MEMBERS');
    expect(source).toContain('MAX_MANUAL_DAYS');
    expect(source).toContain('MAX_MANUAL_CELLS');
    expect(source).toContain('resolveManualCellMutation');
    expect(source).toContain("mode: 'toggle'");
    expect(source).toContain('createRuntimeManualScheduleClient');
    expect(source).toContain('handleCellTap');
    expect(source).toContain('handlePreview');
    expect(source).toContain('handleSaveTemplate');
    expect(source).not.toContain('handleUndo');
  });

  it('ignores a holiday response after the editor date has changed again', () => {
    const source = readPageFile('ts');
    expect(source).toContain('if (page.data.startDate !== startDate) return;');
  });

  it('preserves the saved start date and guards template writes while busy', () => {
    const source = readPageFile('ts');
    expect(source).toContain('openTemplate(page, saved, saved.startDate);');
    expect(source).toContain('if (page.data.isBusy) return undefined;');
  });

  it('keeps the fixed seven-row matrix viewport and disables page scrolling', () => {
    const pageJson = JSON.parse(readPageFile('json'));
    expect(pageJson.disableScroll).toBe(true);
    expect(pageJson.renderer).toBe('skyline');
    const wxss = readPageFile('wxss');
    expect(wxss).toContain('height: 390px');
    expect(wxss).toContain('height: 44px');
  });
});
