import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(path.join(appRoot, relativePath), 'utf8');
}

describe('P10 native profile parity', () => {
  it('registers a direct profile page and embeds the same content in the workbench', () => {
    const app = JSON.parse(read('src/app.json'));
    const page = read('src/pages/profile/index.wxml');
    const pageConfig = JSON.parse(read('src/pages/profile/index.json'));
    const pageStyles = read('src/pages/profile/index.wxss');
    const panel = read('src/components/profile-panel/index.wxml');
    const panelComponent = read('src/components/profile-panel/index.ts');
    const workbench = read('src/pages/workbench/index.ts');

    expect(app.pages).toContain('pages/profile/index');
    expect(page.trim()).toBe('<include src="../../components/profile-panel/index.wxml" />');
    expect(panel).toContain('个人中心');
    expect(panel).toContain('账号与安全');
    expect(panel).toContain('wx:if="{{!embedded}}"');
    expect(workbench).toContain('handleProfileNav');
    expect(workbench).toContain("activeWorkspace: 'profile'");
    expect(pageConfig).toMatchObject({
      disableScroll: true,
      navigationStyle: 'custom',
      renderer: 'skyline',
      usingComponents: {
        'ui-sheet': '/components/ui/ui-sheet/index',
      },
    });
    expect(pageStyles).toMatch(/page\s*{[^}]*height:\s*100%;/s);
    expect(panelComponent).toContain("triggerEvent?.('panelready')");
  });

  it('keeps profile data in the existing identity session and exposes safe exits', () => {
    const controller = read('src/components/profile-panel/controller.ts');
    const page = read('src/components/profile-panel/index.wxml');
    const identity = read('src/platform/wechat-identity.ts');

    expect(controller).toContain('getStoredWechatProfile');
    expect(controller).toContain('getStoredWechatAuthMethod');
    expect(controller).toContain('clearWechatSession');
    expect(controller).not.toContain('wx.setStorageSync');
    expect(controller).not.toContain('wx.request');
    expect(page).toContain('微信小程序身份');
    expect(page).toContain('解除绑定');
    expect(controller).toContain('canUnbindWechat');
    expect(page).toContain('canUnbindWechat');
    expect(page).toContain('微信头像');
    expect(page).toContain('修改登录密码');
    expect(page).not.toContain('账号密码登录无需解除微信绑定');
    expect(page).not.toContain('切换登录方式');
    expect(identity).not.toContain('账号密码登录无需解除微信绑定');
  });

  it('covers authenticated, missing-session and large-text-safe layout copy', () => {
    const controller = read('src/components/profile-panel/controller.ts');
    const template = read('src/components/profile-panel/index.wxml');
    const styles = read('src/components/profile-panel/index.wxss');
    expect(controller).toContain("mode: 'ready'");
    expect(controller).toContain("mode: 'missing'");
    expect(styles).toContain('min-height: 44px');
    expect(styles).toContain('.is-large-text');
    expect(styles).toContain('.is-large-text .profile-name');
    expect(styles).toContain('white-space: normal');
    expect(styles).not.toContain('display: grid');
    for (const scrollView of template.matchAll(/<scroll-view\b[\s\S]*?>/gu)) {
      expect(scrollView[0]).toContain('type="list"');
    }
  });
});
