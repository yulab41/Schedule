import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(path.join(appRoot, relativePath), 'utf8');
}

describe('P9 native notification settings', () => {
  it('registers a member-accessible settings page and workbench entry', () => {
    const app = JSON.parse(read('src/app.json'));
    const page = read('src/subpackages/insights/components/notifications-panel/index.wxml');
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
    expect(page).toContain('微信值班提醒');
    expect(page).toContain('订阅授权只在点击开启时请求');
    expect(workbench).toContain('handleOpenNotificationSettings');
    expect(read('src/pages/workbench/index.ts')).toContain('allowMembers: true');
  });

  it('uses externalMessages runtime clients and no persistence or automatic request', () => {
    const runtime = read('src/platform/client-core-calendar.ts');
    const adapter = read('src/platform/wechat-subscription.ts');
    const controller = read(
      'src/subpackages/insights/components/notifications-panel/controller.ts',
    );

    expect(runtime).toContain('createRuntimeNotificationPreferencesClient');
    expect(adapter).toContain("requireClientCapability('externalMessages')");
    expect(controller).toContain('getMine');
    expect(controller).toContain('requestWechatSubscriptions');
    expect(controller).not.toContain('wx.setStorageSync');
    expect(controller).not.toContain('onLoad');
    expect(controller).toContain("requireClientCapability('externalMessages')");
  });

  it('covers loading, disabled, rejected and configured states', () => {
    const template = read('src/subpackages/insights/components/notifications-panel/index.wxml');
    const controller = read(
      'src/subpackages/insights/components/notifications-panel/controller.ts',
    );

    expect(template).toContain('正在读取通知设置');
    expect(template).toContain('通知提醒暂未开放');
    expect(template).toContain('未获得微信订阅授权');
    expect(template).toContain('模板尚未配置');
    expect(controller).toContain("status === 'accepted'");
    expect(controller).toContain("status === 'blocked'");
  });
});
