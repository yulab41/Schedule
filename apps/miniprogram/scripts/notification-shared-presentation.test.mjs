import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(path.join(appRoot, relativePath), 'utf8');
}

describe('notification shared presentation parity', () => {
  it('uses presentation-core instead of private label and time algorithms', () => {
    const controller = read(
      'src/subpackages/insights/components/notifications-panel/controller.ts',
    );

    expect(controller).toContain("from '@schedule/presentation-core'");
    expect(controller).toContain('getNotificationLabel');
    expect(controller).toContain('getNotificationTone');
    expect(controller).toContain('formatNotificationTime');
    expect(controller).not.toContain('function notificationTypeLabel');
    expect(controller).not.toContain('function formatDateTime');
  });

  it('renders Web-equivalent personal and group reminder settings', () => {
    const controller = read(
      'src/subpackages/insights/components/notifications-panel/controller.ts',
    );
    const template = read('src/subpackages/insights/components/notifications-panel/index.wxml');

    expect(controller).toContain('getGroup');
    expect(controller).toContain('updateGroup');
    expect(controller).toContain('resolveReminderHours');
    expect(template).toContain('groupHoursInput');
    expect(template).toContain('myHoursMode');
    expect(template).toContain('handleSaveGroupSettings');
    expect(template).toContain('handleSaveMyPreferences');
    expect(template).toContain('item.typeTone');
    // 设置页按用户要求去掉小标题与底部说明段落，只保留标题、字段与开关。
    expect(template).not.toContain('提醒节奏');
    expect(template).not.toContain('audit-note');
    expect(template).toContain('使用群组默认');
    expect(template).toContain('关闭值班提醒');
  });
});
