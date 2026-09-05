import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ARTIFACT_ROOT, buildMiniProgram } from './build-tools.mjs';

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal('__MINIPROGRAM_API_BASE_URL__', 'https://example.test/api');
  vi.stubGlobal('__MINIPROGRAM_BUILD_COMMIT__', 'test');
  vi.stubGlobal('__MINIPROGRAM_BUILD_DESCRIPTION__', 'diagnostics-correction-test');
  vi.stubGlobal('__MINIPROGRAM_BUILD_DIRTY__', false);
  vi.stubGlobal('__MINIPROGRAM_BUILD_PROFILE__', 'production');
  vi.stubGlobal('__MINIPROGRAM_BUILD_TIME__', '2026-09-01T00:00:00.000Z');
  vi.stubGlobal('__MINIPROGRAM_BUILD_VERSION__', '0.1.0-test');
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('directory diagnostics pre-upload correction', () => {
  it('keeps App as a plain bounded data slot and removes the two old heavy bridges', () => {
    const app = readSource('app.ts');
    const transport = readSource('platform/client-core-calendar.ts');
    const controller = readSource(
      'subpackages/organization/components/directory-panel/controller.ts',
    );

    expect(app).not.toContain('createRuntimeDiagnosticsStore');
    expect(app).toContain('directorySearches: []');
    expect(app).toContain('appLaunchAt: 0');
    expect(app).toContain('consumeRuntimeDirectoryLaunchMarker');
    expect(transport).toContain('diagnosticObserver');
    expect(transport).not.toContain('isRuntimeDirectorySearchRecording');
    expect(transport).not.toContain('isDirectoryListPath');
    expect(controller).toContain("from './directory-diagnostics-bridge.js'");
    expect(
      existsSync(
        new URL('../src/platform/runtime-directory-diagnostics-bridge.ts', import.meta.url),
      ),
    ).toBe(false);
    expect(
      existsSync(
        new URL(
          '../src/subpackages/organization/components/directory-panel/search-diagnostics.ts',
          import.meta.url,
        ),
      ),
    ).toBe(false);
  });

  it('consumes one safe next-launch marker once and clears it in release', async () => {
    const marker = {
      armedAt: Date.now(),
      expiresAt: Date.now() + 60_000,
      schemaVersion: 1,
    };
    const storage = new Map([['schedule.diagnostics.directory-next-launch.v1', marker]]);
    const removeStorageSync = vi.fn((key) => storage.delete(key));
    const runtime = {
      getAccountInfoSync: () => ({ miniProgram: { envVersion: 'trial', version: '1.2.3' } }),
      getStorageSync: (key) => storage.get(key),
      removeStorageSync,
    };
    vi.stubGlobal('wx', runtime);
    const launch = await import('../src/platform/runtime-diagnostics-launch.ts');

    expect(launch.consumeRuntimeDirectoryLaunchMarker(true, runtime)).toBe(true);
    expect(removeStorageSync).toHaveBeenCalledTimes(1);
    expect(launch.consumeRuntimeDirectoryLaunchMarker(true, runtime)).toBe(false);

    storage.set('schedule.diagnostics.directory-next-launch.v1', marker);
    expect(launch.consumeRuntimeDirectoryLaunchMarker(false, runtime)).toBe(false);
    expect(storage.size).toBe(0);
  });

  it('defines fixed record, copy, and request-id bounds', async () => {
    const limits = await import('../src/platform/runtime-diagnostics-limits.ts');

    expect(limits.RUNTIME_DIRECTORY_SEARCH_LIMIT).toBe(20);
    expect(limits.RUNTIME_DIRECTORY_RECORD_MAX_BYTES).toBe(4096);
    expect(limits.RUNTIME_DIAGNOSTIC_COPY_MAX_BYTES).toBe(24 * 1024);
    expect(limits.RUNTIME_DIAGNOSTIC_HEADER_VALUE_MAX_LENGTH).toBe(4 * 1024);
    expect(limits.RUNTIME_DIAGNOSTIC_REQUEST_ID_MAX_LENGTH).toBe(64);
    expect(limits.RUNTIME_DIAGNOSTIC_REQUEST_ID_PATTERN.test('request_SAFE-1:part.2')).toBe(true);
    expect(limits.RUNTIME_DIAGNOSTIC_REQUEST_ID_PATTERN.test('request id/unsafe?query')).toBe(
      false,
    );
  });

  it('keeps report formatting and truncation copy exclusively in diagnostics', () => {
    const page = readSource('subpackages/diagnostics/pages/test-tools/index.ts');
    const template = readSource('subpackages/diagnostics/pages/test-tools/index.wxml');
    const organizationBridge = readSource(
      'subpackages/organization/components/directory-panel/directory-diagnostics-bridge.ts',
    );

    for (const expected of [
      'profileEnabled',
      'diagnosticSerializationMs',
      'responseBytesEstimated',
      'setDataBytesEstimated',
      'truncated',
      '下次 App 启动首次搜索诊断',
      '下一渲染周期完成',
      '记录总耗时包含诊断附加开销',
    ]) {
      expect(`${page}\n${template}`).toContain(expected);
    }
    expect(`${page}\n${template}`).not.toContain('下一渲染可见');
    expect(page).toContain('RUNTIME_DIAGNOSTIC_COPY_MAX_BYTES');
    expect(organizationBridge).not.toMatch(/复制|安全说明|诊断报告|setClipboardData/u);
  });

  it('keeps shared three-quarter height, safe-area padding, drag, and scroll boundaries explicit', () => {
    const controller = readSource(
      'subpackages/organization/components/directory-panel/controller.ts',
    );
    const template = readSource('subpackages/organization/components/directory-panel/index.wxml');
    const styles = readSource('subpackages/organization/components/directory-panel/index.wxss');
    const drag = readSource('components/ui/ui-sheet/drag-dismiss.wxs');
    const sheet = readSource('components/ui/ui-sheet/index.ts');
    const sheetStyles = readSource('components/ui/ui-sheet/index.wxss');

    expect(template).toContain('size="three-quarter"');
    expect(sheet).toContain('Math.round(height * ratio)');
    expect(sheet).toContain('offWindowResize?.(handler)');
    expect(controller).not.toContain('filterSheetStyle');
    expect(controller).not.toContain('height:92vh');
    expect(sheetStyles).toMatch(/\.ui-sheet__panel[\s\S]*box-sizing: border-box;/u);
    expect(styles).toMatch(/\.sheet-scroll[\s\S]*min-height: 0;[\s\S]*flex: 1;/u);
    expect(sheetStyles).toContain('env(safe-area-inset-bottom)');
    expect(template).toContain('swipe-area="handle"');
    expect(template).toMatch(/<scroll-view[\s\S]*class="sheet-scroll"[\s\S]*scroll-y/u);
    expect(drag).toContain('var DISMISS_DISTANCE = 96;');
    expect(drag).toContain('var FLICK_DISTANCE = 28;');
    expect(drag).toContain('var FLICK_VELOCITY = 0.65;');
    expect(drag).toContain('else rebound(ownerInstance);');
    expect(`${appSource()}\n${controller}`).not.toMatch(/monkey|Page\s*=|Component\s*=/u);
  });

  it('keeps heavy report symbols out of App and organization hot outputs', async () => {
    mkdirSync(ARTIFACT_ROOT, { recursive: true });
    const artifactRoot = mkdtempSync(path.join(ARTIFACT_ROOT, 'diagnostics-boundary-'));
    const outdir = path.join(artifactRoot, 'out');
    try {
      const build = await buildMiniProgram({
        buildCommit: 'audit123',
        buildDescription: 'diagnostics-boundary-test',
        buildDirty: false,
        buildTime: '2026-09-01T00:00:00.000Z',
        buildVersion: '0.1.0-boundary',
        outdir,
        profile: 'production',
      });
      const app = compiled(outdir, 'app.js');
      const component = compiled(
        outdir,
        'subpackages/organization/components/directory-panel/index.js',
      );
      const page = compiled(outdir, 'subpackages/organization/pages/directory/index.js');
      const controller = compiled(
        outdir,
        'subpackages/organization/components/directory-panel/directory-panel-controller.js',
      );
      const bridge = compiled(
        outdir,
        'subpackages/organization/components/directory-panel/directory-diagnostics-bridge.js',
      );
      const diagnostics = compiled(outdir, 'subpackages/diagnostics/pages/test-tools/index.js');

      expect(component).toContain('require("./directory-panel-controller.js")');
      expect(page).toContain(
        'require("../../components/directory-panel/directory-panel-controller.js")',
      );
      expect(component).toContain('require("./directory-diagnostics-bridge.js")');
      expect(page).toContain(
        'require("../../components/directory-panel/directory-diagnostics-bridge.js")',
      );
      expect(component.length).toBeLessThan(controller.length / 10);
      expect(page.length).toBeLessThan(controller.length / 10);
      for (const hotOutput of [app, component, page, controller]) {
        expect(hotOutput).not.toMatch(/通讯录性能诊断|已安全截断|复制最近|下一渲染周期完成/u);
      }
      expect(bridge).toContain('server-timing');
      expect(bridge).toContain('X-Schedule-Directory-Diagnostics');
      expect(bridge).not.toMatch(/通讯录性能诊断|已安全截断|setClipboardData/u);
      expect(diagnostics).toMatch(/通讯录性能诊断|已安全截断|下一渲染周期完成/u);
      expect(
        existsSync(path.join(outdir, 'platform', 'runtime-directory-diagnostics-bridge.js')),
      ).toBe(false);
      expect(
        existsSync(
          path.join(
            outdir,
            'subpackages',
            'organization',
            'components',
            'directory-panel',
            'search-diagnostics.js',
          ),
        ),
      ).toBe(false);
      expect(
        Object.keys(build.metafile.outputs).filter((output) =>
          output.replaceAll('\\', '/').endsWith('/directory-panel-controller.js'),
        ),
      ).toHaveLength(1);
    } finally {
      rmSync(artifactRoot, { force: true, recursive: true });
    }
  });
});

function readSource(relativePath) {
  return readFileSync(new URL(`../src/${relativePath}`, import.meta.url), 'utf8');
}

function compiled(outdir, relativePath) {
  return readFileSync(path.join(outdir, ...relativePath.split('/')), 'utf8');
}

function appSource() {
  return readSource('app.ts');
}
