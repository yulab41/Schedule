import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const miniRoot = process.cwd();
const sourceRoot = path.join(miniRoot, 'src');
const pageRoot = path.join(sourceRoot, 'subpackages', 'scheduling', 'pages', 'backfill');

function readPageFile(extension) {
  const filePath = path.join(pageRoot, `index.${extension}`);
  expect(existsSync(filePath), `missing native P5 backfill page ${filePath}`).toBe(true);
  return readFileSync(filePath, 'utf8');
}

describe('native P5 past-schedule backfill page', () => {
  it('registers the real backfill route beside manual scheduling', () => {
    const appJson = JSON.parse(readFileSync(path.join(sourceRoot, 'app.json'), 'utf8'));
    expect(appJson.subpackages).toContainEqual({
      pages: ['pages/manual/index', 'pages/backfill/index'],
      root: 'subpackages/scheduling',
    });
    const manifest = readFileSync(
      path.join(miniRoot, 'docs', 'design', 'page-golden-manifest.md'),
      'utf8',
    );
    expect(manifest).toContain('`--backfill-390`');
  });

  it('mirrors the accepted Web mobile structure and native state surfaces', () => {
    const wxml = readPageFile('wxml');
    for (const expected of [
      '仅管理员与群主可进入',
      '排班岗位',
      '补录说明（选填，作用于本次确认）',
      '当前配班',
      '待确认补录（{{pendingCount}}）',
      '确认补录',
      '清空草稿',
      '点击整格加入或取消待确认补录',
      '最近补录记录',
    ]) {
      expect(wxml).toContain(expected);
    }
    expect(wxml).toContain('bindtap="handleDateTap"');
    expect(wxml).toContain('bindtap="handleRemovePending"');
    expect(wxml).not.toContain('撤销');
    expect(wxml).not.toContain('undo');
  });

  it('uses the shared batch client and a single idempotent confirm boundary', () => {
    const source = readPageFile('ts');
    expect(source).toContain('createRuntimePastScheduleClient');
    expect(source).toContain('submitBackfillBatch');
    expect(source).toContain('operationId');
    expect(source).toContain('MAX_PAST_SCHEDULE_BACKFILL_BATCH_ITEMS');
    expect(source).not.toContain('createPastScheduleAssignment');
    expect(source).not.toMatch(/for\s*\([^)]*\)\s*\{\s*await\s+[^;]*backfill/isu);
  });

  it('keeps seven full-width columns and Web-sized touch targets at 390 and 320', () => {
    const wxss = readPageFile('wxss');
    expect(wxss).toContain('width: 14.285714%');
    expect(wxss).toContain('min-height: 44px');
    expect(wxss).toContain('.backfill-page.is-compact');
    expect(wxss).not.toContain('display: grid');
    expect(wxss).not.toContain('clamp(');
    expect(readPageFile('ts')).toContain("windowInfo.windowWidth <= 340 ? 'is-compact' : ''");
    const pageJson = JSON.parse(readPageFile('json'));
    expect(pageJson.disableScroll).toBe(true);
    expect(pageJson.renderer).toBe('skyline');
  });
});
