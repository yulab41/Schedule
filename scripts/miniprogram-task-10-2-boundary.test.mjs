import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const miniprogramRoot = path.join(root, 'apps', 'miniprogram');

function read(relativePath) {
  return readFileSync(path.join(miniprogramRoot, relativePath), 'utf8');
}

describe('Task 10.2 notifications and profile boundaries', () => {
  it('activates notification endpoints only through the shared guard runtime and never creates a generic deep link', () => {
    const source = read('pages/notifications/index.ts');
    expect(source).toContain('activateNotificationsPage');
    expect(source).toContain('notificationController.activate');
    expect(source.indexOf('activateNotificationsPage')).toBeLessThan(
      source.indexOf('notificationController.activate'),
    );
    expect(source).toContain('requestDutyReminderSubscription');
    expect(source).not.toContain('navigateTo({ url:');
  });

  it('keeps profile editing, self-contact confirmation, runtime info, and exact logout in the profile page', () => {
    const source = read('pages/profile/index.ts');
    const wxml = read('pages/profile/index.wxml');
    expect(source).toContain('createProfileController');
    expect(source).toContain('getOwnContactTarget');
    expect(source).toContain('updateGroupMemberContact');
    expect(source).toContain('getMiniProgramRuntimeInfo');
    expect(source).toContain('profileController.logout');
    expect(source).toContain('isMemberProfile');
    expect(source.indexOf('const version = ++requestVersion;')).toBeLessThan(
      source.indexOf('if (!isMemberProfile) return;'),
    );
    expect(wxml).toContain('wx:if="{{isMemberProfile}}"');
    expect(wxml).toContain('bindtap="handleSaveProfile"');
    expect(wxml).toContain('bindtap="handleSaveContact"');
    expect(wxml).toContain('bindtap="handleLogout"');
  });
});
