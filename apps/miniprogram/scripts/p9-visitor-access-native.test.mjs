import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(path.join(appRoot, relativePath), 'utf8');
}

describe('P9 native visitor access insights', () => {
  it('registers an insights subpackage page and a More entry', () => {
    const app = JSON.parse(read('src/app.json'));
    const page = read(
      'src/subpackages/insights/components/visitor-access-panel/index.wxml',
    );
    const workbench = read('src/pages/workbench/index.wxml');

    expect(app.subpackages).toContainEqual({
      root: 'subpackages/insights',
      pages: ['pages/visitor-access/index', 'pages/insights/index', 'pages/notifications/index', 'pages/exports/index'],
    });
    expect(page).toContain('访客访问');
    expect(page).toContain('访问记录');
    expect(page).toContain('insights-disabled');
    expect(workbench).toContain('handleOpenVisitorAccess');
  });

  it('uses the shared visitor access read client and the insights capability gate', () => {
    const runtime = read('src/platform/client-core-calendar.ts');
    const controller = read(
      'src/subpackages/insights/components/visitor-access-panel/controller.ts',
    );

    expect(runtime).toContain('createRuntimeVisitorAccessReadClient');
    expect(runtime).toContain('createVisitorAccessReadClient');
    expect(controller).toContain('listAggregates');
    expect(controller).toContain('listLogs');
    expect(controller).toContain("requireClientCapability('insights')");
    expect(read('src/subpackages/insights/components/visitor-access-panel/index.wxml')).toContain(
      'insights-disabled',
    );
  });

  it('masks visitor identifiers and keeps raw access data out of storage/logging', () => {
    const controller = read(
      'src/subpackages/insights/components/visitor-access-panel/controller.ts',
    );

    expect(controller).toContain('maskClientIp');
    expect(controller).toContain('maskRequestId');
    expect(controller).not.toContain('wx.setStorageSync');
    expect(controller).not.toContain('wx.getStorageSync');
    expect(controller).not.toContain('console.log');
    expect(read('src/subpackages/insights/components/visitor-access-panel/index.wxml')).toContain(
      '90 天',
    );
  });
});
