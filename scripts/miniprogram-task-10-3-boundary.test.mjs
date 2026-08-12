import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const miniprogramRoot = path.join(root, 'apps', 'miniprogram');

function read(relativePath) {
  return readFileSync(path.join(miniprogramRoot, relativePath), 'utf8');
}

describe('Task 10.3 group and anonymous visitor boundaries', () => {
  it('registers the public visitor page and group subpackage while keeping the visitor page outside the tab bar', () => {
    const appJson = JSON.parse(read('app.json'));
    expect(appJson.pages).toContain('pages/guest/guest');
    expect(appJson.subPackages).toContainEqual({
      root: 'subpackages/groups',
      pages: ['pages/index'],
    });
    expect(appJson.tabBar.list.map(({ pagePath }) => pagePath)).not.toContain('pages/guest/guest');
  });

  it('does not restore a session on a QR visitor launch and confines visitor imports to public calendar reads', () => {
    const app = read('app.ts');
    const visitor = read('pages/guest/guest.ts');
    const controller = read('features/visitor/visitor-calendar-controller.ts');
    expect(app).toContain('isVisitorGuestLaunch(options.path)');
    expect(app.indexOf('isVisitorGuestLaunch(options.path)')).toBeLessThan(
      app.indexOf('restoreAndNavigate()'),
    );
    expect(visitor).not.toMatch(
      /store\/session|auth-runtime|route-guard|calendar-page-controller/u,
    );
    expect(controller).not.toMatch(
      /calendar-cache|store\/session|wechatLogin|setStorageSync|removeStorageSync/u,
    );
    expect(controller).toContain('resolveGuestGroup');
    expect(controller).toContain('getGuestCalendar');
  });

  it('renders anonymous visitor data as a calendar grid without phone actions, detail routes, notifications, or writes', () => {
    const wxml = read('pages/guest/guest.wxml');
    expect(wxml).toContain('<calendar-grid');
    expect(wxml).not.toMatch(/bind:route|phone-sheet|notification|event|marker|copy|dial/iu);
  });

  it('guards the group subpackage before it loads membership APIs and keeps left members invite-only', () => {
    const source = read('subpackages/groups/pages/index.ts');
    const wxml = read('subpackages/groups/pages/index.wxml');
    expect(source).toContain('guardMiniprogramRoute');
    expect(source.indexOf('guardMiniprogramRoute')).toBeLessThan(source.indexOf('controller.load'));
    expect(wxml).toContain("item.action === 'invite-only'");
    expect(wxml).not.toMatch(/claim|配置|排班配置/u);
  });
});
