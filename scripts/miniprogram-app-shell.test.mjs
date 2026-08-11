import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { listRegisteredPages } from './miniprogram-manifest.mjs';
import { generateTabIcons, tabIconNames } from './miniprogram-tab-icons.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const miniprogramRoot = path.join(root, 'apps', 'miniprogram');
const temporaryDirectories = [];

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(miniprogramRoot, relativePath), 'utf8'));
}

function readText(relativePath) {
  return readFileSync(path.join(miniprogramRoot, relativePath), 'utf8');
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe('V3 app shell', () => {
  it('generates eight deterministic 81px PNG tab icons below the platform size limit', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'schedule-tab-icons-'));
    temporaryDirectories.push(directory);

    const generated = generateTabIcons(directory);

    expect(generated.map((file) => path.basename(file))).toEqual(
      tabIconNames.flatMap((name) => [`${name}.png`, `${name}-active.png`]),
    );
    for (const file of generated) {
      const png = readFileSync(file);
      expect(png.subarray(0, 8)).toEqual(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      );
      expect(png.readUInt32BE(16)).toBe(81);
      expect(png.readUInt32BE(20)).toBe(81);
      expect(png.byteLength).toBeLessThan(40 * 1024);
      const idatOffset = png.indexOf(Buffer.from('IDAT')) + 4;
      expect(png.subarray(idatOffset, idatOffset + 2)).toEqual(Buffer.from([0x78, 0x9c]));
    }
  });

  it('keeps the V3 main-package order and registers the workflows subpackage', () => {
    const appJson = readJson('app.json');
    expect(listRegisteredPages(appJson)).toEqual([
      'pages/auth/login/index',
      'pages/auth/profile-setup/index',
      'pages/invite/invite',
      'pages/workbench/index',
      'pages/calendar/index',
      'pages/notifications/index',
      'pages/profile/index',
      'subpackages/workflows/pages/requests/index',
      'subpackages/workflows/pages/leave/index',
      'subpackages/workflows/pages/operations/index',
    ]);
    expect(appJson.tabBar?.custom).not.toBe(true);
    expect(appJson.pages).toContain('pages/invite/invite');
    expect(appJson.tabBar?.list.some(({ pagePath }) => pagePath === 'pages/invite/invite')).toBe(
      false,
    );
    expect(appJson.tabBar?.list).toEqual([
      {
        iconPath: 'assets/tab-bar/workbench.png',
        pagePath: 'pages/workbench/index',
        selectedIconPath: 'assets/tab-bar/workbench-active.png',
        text: '工作台',
      },
      {
        iconPath: 'assets/tab-bar/calendar.png',
        pagePath: 'pages/calendar/index',
        selectedIconPath: 'assets/tab-bar/calendar-active.png',
        text: '日历',
      },
      {
        iconPath: 'assets/tab-bar/notifications.png',
        pagePath: 'pages/notifications/index',
        selectedIconPath: 'assets/tab-bar/notifications-active.png',
        text: '通知',
      },
      {
        iconPath: 'assets/tab-bar/profile.png',
        pagePath: 'pages/profile/index',
        selectedIconPath: 'assets/tab-bar/profile-active.png',
        text: '我的',
      },
    ]);
    expect(appJson.lazyCodeLoading).toBe('requiredComponents');
    expect(appJson.rendererOptions).toBeUndefined();
  });

  it('keeps Skyline page-level and leaves every non-calendar page on WebView', () => {
    const routes = listRegisteredPages(readJson('app.json'));
    for (const route of routes) {
      const pageJson = readJson(`${route}.json`);
      expect(pageJson.disableScroll).toBe(true);
      expect(pageJson.navigationStyle).toBe('custom');
      expect(pageJson.usingComponents?.['page-shell']).toBe('/components/page-shell/index');
      expect(pageJson.usingComponents?.['shell-state']).toBe('/components/shell-state/index');
      if (route === 'pages/calendar/index') {
        expect(pageJson.renderer).toBe('skyline');
        expect(pageJson.componentFramework).toBe('glass-easel');
      } else {
        expect(pageJson.renderer).toBeUndefined();
        expect(pageJson.componentFramework).toBeUndefined();
      }
    }
  });

  it('uses one definite-height local scroll container and no page-level scrolling', () => {
    const shellWxml = readText('components/page-shell/index.wxml');
    const shellWxss = readText('components/page-shell/index.wxss');
    expect(shellWxml.match(/<scroll-view\b/gu)).toHaveLength(1);
    expect(shellWxml).toContain('scroll-y="{{true}}"');
    expect(shellWxml).not.toContain('enhanced=');
    expect(shellWxml).not.toContain('show-scrollbar=');
    expect(shellWxss).toMatch(/height:\s*calc\(100vh/gu);
    expect(shellWxss).toMatch(/\.page-shell\s*\{[^}]*display:\s*flex/su);
    expect(shellWxss).toMatch(/flex-direction:\s*column/gu);
    expect(shellWxss).not.toMatch(/constant\(|display:\s*grid|place-items/gu);

    for (const route of listRegisteredPages(readJson('app.json'))) {
      expect(readText(`${route}.wxml`)).toContain('<page-shell');
    }
  });

  it('keeps global page tokens out of component WXSS', () => {
    for (const componentStyle of [
      'components/page-shell/index.wxss',
      'components/shell-state/index.wxss',
    ]) {
      expect(readText(componentStyle)).not.toMatch(
        /@import\s+['"]\.\.\/\.\.\/tokens\/index\.wxss['"]/u,
      );
    }
  });

  it('contains no custom tab bar, V1/V2 route, or speculative renderer option', () => {
    const appJsonText = readText('app.json');
    expect(appJsonText).not.toContain('custom-tab-bar');
    expect(appJsonText).not.toContain('rendererOptions');
    expect(appJsonText).not.toContain('pages/login/login');
    expect(appJsonText).not.toContain('pages/test');
  });
});
