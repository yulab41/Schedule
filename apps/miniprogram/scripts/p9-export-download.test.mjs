import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(path.join(appRoot, relativePath), 'utf8');
}

describe('P9 native export download boundary', () => {
  it('registers a secure export page and More entry', () => {
    const app = JSON.parse(read('src/app.json'));
    const page = read('src/subpackages/insights/components/exports-panel/index.wxml');
    const workbench = read('src/pages/workbench/index.wxml');

    expect(app.subpackages).toContainEqual({
      root: 'subpackages/insights',
      pages: [
        'pages/visitor-access/index',
        'pages/insights/index',
        'pages/notifications/index',
        'pages/exports/index',
        'pages/notification-settings/index',
      ],
    });
    expect(page).toContain('导出排班与统计');
    expect(page).toContain('下载文件');
    expect(workbench).toContain('handleOpenExports');
  });

  it('keeps download auth in headers and avoids persistent file/token state', () => {
    const adapter = read('src/platform/secure-download.ts');
    const controller = read('src/subpackages/insights/components/exports-panel/controller.ts');

    expect(adapter).toContain('downloadScheduleExport');
    expect(adapter).toContain('Authorization');
    expect(adapter).toContain("requireClientCapability('insights')");
    expect(adapter).not.toContain('visitorKey');
    expect(adapter).not.toContain('token=');
    expect(controller).not.toContain('wx.setStorageSync');
    expect(controller).not.toContain('wx.saveImageToPhotosAlbum');
  });

  it('covers idle, waiting, ready, failed, and capability-disabled copy', () => {
    const template = read('src/subpackages/insights/components/exports-panel/index.wxml');
    const controller = read('src/subpackages/insights/components/exports-panel/controller.ts');
    expect(template).toContain('导出任务');
    expect(template).toContain('正在创建导出任务');
    expect(template).toContain('继续检查');
    expect(template).toContain('下载 CSV');
    expect(template).toContain('insights');
    expect(template).toContain('重新开始');
    expect(controller).toContain("from '@schedule/presentation-core/export'");
    expect(controller).not.toContain('function pollJob');
    expect(controller).not.toContain('function currentBusinessMonth');
  });

  it('reflows the export page for system large text without clipping actions or labels', () => {
    const controller = read('src/subpackages/insights/components/exports-panel/controller.ts');
    const template = read('src/subpackages/insights/components/exports-panel/index.wxml');
    const styles = read('src/subpackages/insights/components/exports-panel/index.wxss');

    expect(controller).toContain('largeText');
    expect(controller).toContain('fontSizeSetting');
    expect(template).toContain("largeText ? 'is-large-text' : ''");
    expect(styles).toContain('.is-large-text .header-title-main');
    expect(styles).toContain('.is-large-text .export-actions');
    expect(styles).toContain('white-space: normal');
  });
});
