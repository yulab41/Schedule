import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(path.join(appRoot, relativePath), 'utf8');
}

describe('P9 native notifications', () => {
  it('registers the notification page and More entry', () => {
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
    expect(page).toContain('通知中心');
    expect(page).toContain('unreadCountLabel');
    expect(page).toContain('insights-disabled');
    expect(workbench).toContain('handleOpenNotifications');
  });

  it('uses shared notification actions with capability gating and no persistence', () => {
    const runtime = read('src/platform/client-core-calendar.ts');
    const controller = read(
      'src/subpackages/insights/components/notifications-panel/controller.ts',
    );

    expect(runtime).toContain('createRuntimeP9InsightsActionsClient');
    expect(controller).toContain('listNotifications');
    expect(controller).toContain('markNotificationRead');
    expect(controller).toContain('markAllNotificationsRead');
    expect(controller).toContain("requireClientCapability('insights')");
    expect(controller).toContain('detached(this: NotificationsPageInstance)');
    expect(controller).toContain('fontSizeSetting');
    expect(controller).not.toContain('wx.setStorageSync');
    expect(controller).not.toContain('console.log');
  });

  it('covers loading, empty, error, and disabled state copy', () => {
    const template = read('src/subpackages/insights/components/notifications-panel/index.wxml');
    expect(template).toContain('正在读取通知');
    expect(template).toContain('暂无通知');
    expect(template).toContain('重新加载');
    expect(template).toContain('通知中心暂未开放');
    expect(template).toContain("largeText ? 'is-large-text' : ''");
  });

  it('offers the Web notification-card hierarchy as an embedded workbench surface', () => {
    const template = read('src/subpackages/insights/components/notifications-panel/index.wxml');
    const styles = read('src/subpackages/insights/components/notifications-panel/index.wxss');
    const controller = read(
      'src/subpackages/insights/components/notifications-panel/controller.ts',
    );

    expect(template).toContain('wx:if="{{embedded && mode === \'notifications\'}}"');
    expect(template).toContain('class="notification-sheet-content');
    expect(template).toContain('{{unreadCount}} 条未读');
    expect(template).toContain('点按一条通知即可标记为已读');
    expect(template).toContain('>全部已读</view');
    expect(template).toContain('bindtap="handleMarkRead"');
    expect(styles).toContain('.notification-sheet-item.is-unread');
    expect(styles).toMatch(/\.notification-sheet-item\.is-unread::before\s*\{/u);
    expect(controller).toContain("triggerEvent?.('unreadchanged'");
  });
});
