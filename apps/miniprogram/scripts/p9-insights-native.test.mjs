import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(path.join(appRoot, relativePath), 'utf8');
}

describe('P9 native insights events and statistics', () => {
  it('registers an insights dashboard page and More entry', () => {
    const app = JSON.parse(read('src/app.json'));
    const page = read('src/subpackages/insights/components/insights-dashboard-panel/index.wxml');
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
    expect(page).toContain('事件时间线');
    expect(page).toContain('排班统计');
    expect(page).toContain('insights-disabled');
    expect(workbench).toContain('handleOpenInsights');
  });

  it('uses the shared events/statistics client and one insights capability gate', () => {
    const runtime = read('src/platform/client-core-calendar.ts');
    const controller = read(
      'src/subpackages/insights/components/insights-dashboard-panel/controller.ts',
    );

    expect(runtime).toContain('createRuntimeInsightsReadClient');
    expect(controller).toContain('listEvents');
    expect(controller).toContain('getMonthStatistics');
    expect(controller).toContain("requireClientCapability('insights')");
  });

  it('keeps the read-only page in memory and exposes loading, empty, and error guidance', () => {
    const controller = read(
      'src/subpackages/insights/components/insights-dashboard-panel/controller.ts',
    );
    const template = read(
      'src/subpackages/insights/components/insights-dashboard-panel/index.wxml',
    );

    expect(controller).not.toContain('wx.setStorageSync');
    expect(controller).not.toContain('console.log');
    expect(controller).toContain("from '@schedule/presentation-core'");
    expect(controller).not.toContain('function eventTypeLabel');
    expect(template).toContain('正在读取事件与统计');
    expect(template).toContain('没有符合筛选条件的事件');
    expect(template).toContain('重新加载');
  });
});
