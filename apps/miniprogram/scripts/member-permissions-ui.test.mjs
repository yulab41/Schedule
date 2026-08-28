import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const miniRoot = process.cwd();

function read(relativePath) {
  return readFileSync(path.join(miniRoot, relativePath), 'utf8');
}

describe('Mini ordinary-member permission UI', () => {
  it('removes unavailable More tools from the render and accessibility trees', () => {
    const template = read('src/pages/workbench/index.wxml');
    const more = template.slice(
      template.indexOf('class="more-workspace"'),
      template.indexOf("activeWorkspace === 'calendar' && filterOpen"),
    );

    for (const flag of [
      'toolAccess.groupSection',
      'toolAccess.groupSettings',
      'toolAccess.manualSchedule',
      'toolAccess.backfill',
      'toolAccess.leave',
      'toolAccess.duty',
      'toolAccess.schedulingConfig',
      'toolAccess.informationSection',
      'toolAccess.insights',
      'toolAccess.notificationSettings',
      'toolAccess.notifications',
      'toolAccess.exports',
      'toolAccess.accessSection',
      'toolAccess.inviteVisitor',
      'toolAccess.visitorAccess',
      'toolAccess.platformAccounts',
      '!toolAccess.hasAny',
    ]) {
      expect(more).toContain(flag);
    }
    expect(more).not.toContain('aria-disabled');
    expect(more).not.toContain('is-disabled');
    expect(more).toContain('当前身份暂无可用的更多工具');
  });

  it('renders personal preferences but hides every ordinary-member mutation control', () => {
    const template = read(
      'src/subpackages/organization/components/group-settings-panel/index.wxml',
    );
    const source = read(
      'src/subpackages/organization/components/group-settings-panel/controller.ts',
    );

    expect(template).toContain('class="group-card calendar-preferences-card"');
    expect(template).toContain('我的日历偏好');
    expect(template).toContain('群组日历默认设置');
    expect(template).toContain('bindtap="handleSaveMemberCalendarPreferences"');
    expect(template).toContain('bindtap="handleSaveGroupCalendarDefaults"');
    expect(template).toContain('wx:if="{{canManageGroupLifecycle}}"');
    expect(template).toContain('wx:if="{{member.canManage}}"');
    expect(template).not.toContain(
      'member.canManage || (member.isUnclaimed && !member.isCurrentUser)',
    );
    expect(source).toContain('createRuntimeCalendarPreferencesClient');
    expect(source).toContain('if (!page.data.canManageGroupLifecycle');
    expect(source).toContain('if (!this.data.canManageMembers) return;');
  });
});
