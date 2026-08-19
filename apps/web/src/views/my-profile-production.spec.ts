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
    expect(view).toContain('session.profile?.realName');
    expect(view).toContain('group.name');
    expect(view).toContain('roleLabel');
    expect(view).not.toContain('林恩宇');
    expect(view).not.toContain('d0796');
    expect(view).not.toContain('8 天');
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
});
