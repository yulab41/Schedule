import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

function readSource(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

describe('my profile Storybook preview', () => {
  it('contains personal duty metrics and account settings', () => {
    const preview = readSource('./MyProfilePreview.vue');

    expect(preview).toContain('本月值班');
    expect(preview).toContain('年度累计');
    expect(preview).toContain('近 30 日完成率');
    expect(preview).toContain('值班节奏');
    expect(preview).toContain('手机号');
    expect(preview).toContain('登录密码');
  });

  it('exposes the requested default-password actions and a safe preview form', () => {
    const preview = readSource('./MyProfilePreview.vue');
    const stories = readSource('./MyProfilePreview.stories.ts');

    expect(preview).toContain('取消');
    expect(preview).toContain('修改密码');
    expect(preview).toContain('不再提示');
    expect(preview).toContain('当前密码为系统默认密码');
    expect(preview).toContain('预览状态：密码修改已提交');
    expect(preview).not.toContain('fetch(');
    expect(stories).toContain('DefaultPasswordModal');
    expect(stories).toContain('DefaultPasswordModalMobile');
  });

  it('includes mobile navigation, keyboard focus and reduced-motion support', () => {
    const preview = readSource('./MyProfilePreview.vue');

    expect(preview).toContain('class="mobile-tabbar"');
    expect(preview).toMatch(/:focus-visible[^}]*outline:/s);
    expect(preview).toContain('@media (prefers-reduced-motion: reduce)');
    expect(preview).toContain('role="dialog"');
  });
});
