import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

function readSource(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

describe('P3 identity security preview', () => {
  it('keeps Web login closed to public registration', () => {
    const source = readSource('./P3IdentitySecurityPreview.vue');

    expect(source).toContain("screen === 'web-login'");
    expect(source).toContain('没有“注册”入口');
    expect(source).not.toContain('登录或注册');
  });

  it('shows the platform account safety boundary without exposing secrets', () => {
    const source = readSource('./P3IdentitySecurityPreview.vue');

    expect(source).toContain('只显示必要状态，不显示密码或联系方式');
    expect(source).toContain('这里只分配用户名，不设置或显示密码');
    expect(source).not.toContain('passwordHash');
  });

  it('covers the Mini identity states and the masked ten-minute admin ticket', () => {
    const source = readSource('./P3IdentitySecurityPreview.vue');

    expect(source).toContain("'mini-login'");
    expect(source).toContain("'mini-link'");
    expect(source).toContain("'mini-register'");
    expect(source).toContain("'mini-admin-preview'");
    expect(source).toContain("'mini-unbind'");
    expect(source).toContain('还剩约 10 分钟');
    expect(source).toContain('账号 d0***');
    expect(source).toContain('不会删除 Web 账号或排班资料');
  });

  it('keeps the Mini login golden aligned with Web password login plus WeChat quick login', () => {
    const source = readSource('./P3IdentitySecurityPreview.vue');
    const miniLogin = source.slice(
      source.indexOf(`<div v-if="screen === 'mini-login'" class="mini-login-intro">`),
      source.indexOf(`<template v-else-if="screen === 'mini-link'">`),
    );

    expect(miniLogin).toContain('清楚掌握每一次值班');
    expect(miniLogin).toContain('进入工作台');
    expect(miniLogin).toContain('微信快捷登录');
    expect(miniLogin).toContain('autocomplete="username"');
    expect(miniLogin).toContain('autocomplete="current-password"');
    expect(source).toContain('账号只用于排班身份识别。联系信息仅对有权限的群组成员可见。');
    expect(miniLogin).not.toContain('访客查看排班');
    expect(miniLogin).not.toContain('使用账号密码登录后台，或用微信快速进入已绑定的成员账号。');
    expect(miniLogin).not.toContain('账号由平台管理员预置，密码只用于建立当前登录会话。');
  });

  it('keeps the 44px touch target and reduced-motion guard', () => {
    const source = readSource('./P3IdentitySecurityPreview.vue');

    expect(source).toContain('.mini-primary,');
    expect(source).toContain('min-height: var(--ui-touch-target-comfortable)');
    expect(source).toContain('@media (prefers-reduced-motion: reduce)');
    expect(source).toContain('min-height: 844px');
  });
});
