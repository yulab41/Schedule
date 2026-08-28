import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

function readSource(relativePath) {
  return readFileSync(path.join(process.cwd(), 'src', relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(readSource(relativePath));
}

describe('P3 native identity pages', () => {
  it('opens the identity page by default while preserving the approved P1 routes', () => {
    const app = readJson('app.json');

    const approvedRoutes = [
      'pages/identity/index',
      'pages/workbench/index',
      'pages/index/index',
      'pages/calendar-poc/index',
      'pages/manual-matrix-poc/index',
      'pages/gesture-probe/index',
      'pages/identity/unbind',
      'pages/admin-bind/preview',
    ];

    expect(app.pages[0]).toBe('pages/identity/index');
    expect(app.pages).toEqual(expect.arrayContaining(approvedRoutes));
    expect(new Set(app.pages).size).toBe(app.pages.length);
  });

  it('keeps the login page in the link-required state machine', () => {
    const template = readSource('pages/identity/index.wxml');
    const source = readSource('pages/identity/index.ts');

    expect(template).toContain("mode === 'login'");
    expect(template).toContain("mode === 'choice'");
    expect(template).toContain("mode === 'password'");
    expect(template).toContain("mode === 'register'");
    expect(source).toContain('linkToken: result.linkToken');
    expect(source).toContain('handleChoosePassword');
    expect(source).toContain('handleChooseRegister');
    expect(template).not.toContain('公开注册');
    expect(template).not.toContain('身份已确认');
    expect(source).not.toContain("mode: 'authenticated'");
  });

  it('uses the approved Web login structure with WeChat below the divider', () => {
    const template = readSource('pages/identity/index.wxml');
    const source = readSource('pages/identity/index.ts');
    const client = readSource('platform/wechat-identity.ts');

    expect(template).toContain('清楚掌握每一次值班');
    expect(template).toContain('进入工作台');
    expect(template).toContain('微信快捷登录');
    expect(template).toContain('/assets/icons/web-profile.svg');
    expect(template).toContain('/assets/icons/web-lock.svg');
    expect(template).toContain('aria-label="账号"');
    expect(template).toContain('aria-label="密码"');
    expect(template).toContain('bindconfirm="handlePasswordLogin"');
    expect(template).toContain('请输入密码');
    expect(template).not.toContain('访客查看排班');
    expect(template).not.toContain('账号由平台管理员预置，密码只用于建立当前登录会话。');
    expect(template).not.toContain('使用账号密码登录后台，或用微信快速进入已绑定的成员账号。');
    expect(source).toContain('handlePasswordLogin');
    expect(source).not.toContain('handleSwitchLogin');
    expect(source).toContain('loginWithPassword');
    expect(source).toContain('wx.reLaunch');
    expect(client).toContain("'/auth/password/login'");
    expect(client).toContain('persistPasswordSession');
  });

  it('keeps the admin URL Link path preview-first and confirm-code based', () => {
    const template = readSource('pages/admin-bind/preview.wxml');
    const source = readSource('pages/admin-bind/preview.ts');
    const client = readSource('platform/wechat-identity.ts');

    expect(template).toContain('handleContinue');
    expect(template).toContain('handleConfirm');
    expect(source).toContain('previewAdminBinding(ticket)');
    expect(source).toContain('confirmAdminBinding(ticket)');
    expect(client).toContain("'/auth/wechat/admin-bind/preview'");
    expect(client).toContain("'/auth/wechat/admin-bind/confirm'");
    expect(client).toContain('getWechatCode()');
  });

  it('keeps unbind scoped to the current Mini AppID and idempotent', () => {
    const template = readSource('pages/identity/unbind.wxml');
    const source = readSource('pages/identity/unbind.ts');
    const client = readSource('platform/wechat-identity.ts');

    expect(template).toContain('不删除 Web 账号或排班资料');
    expect(source).toContain('createIdempotencyKey');
    expect(source).toContain('unbindWechatIdentity(this._idempotencyKey)');
    expect(client).toContain('/me/wechat/miniprogram/unbind');
    expect(client).toContain('idempotencyKey,');
    expect(client).toContain('clearWechatSession(true)');
  });

  it('keeps the identity client native-only and free of shared runtime violations', () => {
    const client = readSource('platform/wechat-identity.ts');

    expect(client).toContain("method: 'POST'");
    expect(client).toContain('wx.request');
    expect(client).toContain('wx.login');
    expect(client).not.toMatch(/\bfetch\s*\(/u);
    expect(client).not.toContain('@schedule/database');
    expect(client).not.toContain('zod');
    expect(client).not.toMatch(/from ['"]node:/u);
  });

  it('preserves shared touch targets and build traceability on both identity pages', () => {
    const identityStyles = readSource('styles/identity.wxss');
    const buttonStyles = readSource('components/ui/ui-button/index.wxss');
    const identityTemplate = readSource('pages/identity/index.wxml');
    const adminTemplate = readSource('pages/admin-bind/preview.wxml');

    expect(buttonStyles).toContain('var(--ui-touch-target-minimum)');
    expect(identityStyles).toContain('var(--ui-font-family-system)');
    expect(identityTemplate).toContain('{{buildLabel}}');
    expect(adminTemplate).toContain('{{buildLabel}}');
  });
});
