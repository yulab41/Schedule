import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const miniprogramRoot = path.join(root, 'apps', 'miniprogram');

function read(relativePath) {
  return readFileSync(path.join(miniprogramRoot, relativePath), 'utf8');
}

describe('Task 10 guest route boundary', () => {
  it('runs the shared route guard before protected tab or workflow pages load data', () => {
    for (const relativePath of [
      'pages/calendar/index.ts',
      'pages/profile/index.ts',
      'pages/workbench/index.ts',
      'subpackages/workflows/pages/requests/index.ts',
      'subpackages/workflows/pages/leave/index.ts',
      'subpackages/workflows/pages/operations/index.ts',
    ]) {
      const source = read(relativePath);
      expect(source).toContain('guardMiniprogramRoute');
      expect(source).toContain('features/navigation/route-guard.js');
    }
    const notificationPage = read('pages/notifications/index.ts');
    const notificationRuntime = read('features/notifications/notification-page-runtime.ts');
    expect(notificationPage).toContain('activateNotificationsPage');
    expect(notificationRuntime).toContain('guardMiniprogramRoute');
    expect(notificationRuntime).toContain('navigation/route-guard.js');
    expect(notificationRuntime.indexOf('guardMiniprogramRoute')).toBeLessThan(
      notificationRuntime.indexOf('onAllowed({'),
    );
    const profile = read('pages/profile/index.ts');
    expect(profile.lastIndexOf('guardMiniprogramRoute')).toBeLessThan(
      profile.lastIndexOf('listGroupContacts'),
    );
    const calendar = read('pages/calendar/index.ts');
    expect(calendar).toMatch(/onShow\(\): void \{[\s\S]*guardMiniprogramRoute/gu);
  });

  it('renders selected group context and actionable group-less choices through the shared workbench runtime', () => {
    const source = read('pages/workbench/index.ts');
    const wxml = read('pages/workbench/index.wxml');
    expect(source).toContain('activateWorkbenchEntry');
    expect(source).toContain('activateGlobalWorkbenchAction');
    expect(source).toContain('buildWorkbenchPageModel');
    expect(wxml).toContain("section.isActive ? 'workbench-section--active' : ''");
    expect(wxml).toContain('{{section.roleLabel}}');
    expect(wxml).toContain('群组与账号');
    expect(wxml).toContain('bindtap="handleGlobalAction"');
    expect(wxml).not.toContain('data-route=');
  });
});
