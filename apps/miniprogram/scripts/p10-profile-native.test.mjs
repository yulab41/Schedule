import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(path.join(appRoot, relativePath), 'utf8');
}

describe('P10 native profile parity', () => {
  it('registers a profile page and routes the workbench avatar to it', () => {
    const app = JSON.parse(read('src/app.json'));
    const page = read('src/pages/profile/index.wxml');
    const workbench = read('src/pages/workbench/index.ts');

    expect(app.pages).toContain('pages/profile/index');
    expect(page).toContain('个人中心');
    expect(page).toContain('账号与安全');
    expect(workbench).toContain('/pages/profile/index');
  });

  it('keeps profile data in the existing identity session and exposes safe exits', () => {
    const controller = read('src/pages/profile/index.ts');
    const page = read('src/pages/profile/index.wxml');

    expect(controller).toContain('getStoredWechatProfile');
    expect(controller).toContain('getStoredWechatAuthMethod');
    expect(controller).toContain('clearWechatSession');
    expect(controller).not.toContain('wx.setStorageSync');
    expect(controller).not.toContain('wx.request');
    expect(page).toContain('解除当前微信绑定');
    expect(page).toContain('切换登录方式');
  });

  it('covers authenticated, missing-session and large-text-safe layout copy', () => {
    const controller = read('src/pages/profile/index.ts');
    const styles = read('src/pages/profile/index.wxss');
    expect(controller).toContain("mode: 'ready'");
    expect(controller).toContain("mode: 'missing'");
    expect(styles).toContain('min-height: 44px');
    expect(styles).toContain('.is-large-text');
  });
});
