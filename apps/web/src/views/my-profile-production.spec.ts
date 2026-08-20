import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

describe('production my profile page', () => {
  it('exposes a real profile workbench tab and renders the production view', () => {
    const home = source('./HomeView.vue');
    const navigation = source('../features/layout/workbench-nav.ts');

    expect(navigation).toContain("id: 'profile'");
    expect(navigation).toContain("label: '我的'");
    expect(home).toContain("activeTab === 'profile'");
    expect(home).toContain("import MyProfileView from './my-profile/MyProfileView.vue'");
    expect(home).toContain('<MyProfileView');
  });

  it('uses session and group data instead of copied Storybook demo values', () => {
    const view = source('./my-profile/MyProfileView.vue');

    expect(view).toContain('useSessionStore');
    expect(view).toContain('session?.profile?.realName');
    expect(view).toContain('group.name');
    expect(view).toContain('roleLabel');
    expect(view).not.toContain('林恩宇');
    expect(view).not.toContain('d0796');
    expect(view).not.toContain('8 天');
  });

  it('loads the personal duty overview that exists in the approved Storybook design', () => {
    const view = source('./my-profile/MyProfileView.vue');

    expect(view).toContain('api.listGroupMembers');
    expect(view).toContain('api.listGroupContacts');
    expect(view).toContain('api.getMonthStatistics');
    expect(view).toContain('api.getYearStatistics');
    expect(view).toContain('api.getCalendar');
    expect(view).toContain('值班概览');
    expect(view).toContain('值班节奏');
    expect(view).toContain('下一班');
    expect(view).toContain('buildMyProfileOverview');
    expect(view).toContain('<small>次</small>');
    expect(view).not.toContain('<small>天</small>');
    expect(view).not.toContain('maskPhone');
  });

  it('keeps mobile entry points and safe account actions explicit', () => {
    const home = source('./HomeView.vue');
    const navigation = source('../features/layout/workbench-nav.ts');
    const nav = source('../features/layout/WorkbenchNav.vue');

    expect(navigation).toContain("'profile'");
    expect(home).toContain('aria-label="打开我的"');
    expect(nav).toContain('退出登录');
    expect(nav).toContain('item.id === activeTab');
  });

  it('removes quick-entry cards and exposes password change from account settings', () => {
    const view = source('./my-profile/MyProfileView.vue');
    const home = source('./HomeView.vue');

    expect(view).not.toContain('profile-shortcuts');
    expect(view).not.toContain('工作入口');
    expect(view).toContain("emit('change-password')");
    expect(view).toContain('修改登录密码');
    expect(home).toContain("(event: 'change-password')");
  });
});
