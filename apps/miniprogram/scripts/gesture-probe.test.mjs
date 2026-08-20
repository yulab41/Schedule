import { readFileSync } from 'node:fs';
import vm from 'node:vm';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { findWorkletIssues } from './build-tools.mjs';

function readSource(relativePath) {
  return readFileSync(new URL(`../src/${relativePath}`, import.meta.url), 'utf8');
}

describe('P1 Android gesture capability probe', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('registers an isolated diagnostic route and links it from the manual test entry', () => {
    const appConfig = JSON.parse(readSource('app.json'));
    const pageConfig = JSON.parse(readSource('pages/gesture-probe/index.json'));
    const entryTemplate = readSource('pages/index/index.wxml');

    expect(appConfig.pages).toContain('pages/gesture-probe/index');
    expect(pageConfig).toMatchObject({ disableScroll: false, navigationStyle: 'custom' });
    expect(entryTemplate).toContain('url="/pages/gesture-probe/index"');
    expect(entryTemplate).toContain('Android 手势能力探针');
  });

  it('uses the official minimal plain-view Pan pattern beside an ordinary touch-event probe', () => {
    const template = readSource('pages/gesture-probe/index.wxml');
    const styles = readSource('pages/gesture-probe/index.wxss');
    const source = readSource('pages/gesture-probe/index.ts');
    const worklets = findWorkletIssues(source, 'pages/gesture-probe/index.ts');

    expect(template).toMatch(
      /<pan-gesture-handler[\s\S]*?class="worklet-probe-handler"[\s\S]*?style="width:\s*280px;\s*height:\s*220px"[\s\S]*?worklet:ongesture="handleProbePan"[\s\S]*?id="gesture-probe-dot"/u,
    );
    expect(template).not.toContain('native-view');
    expect(template).not.toContain('<scroll-view');
    expect(template).toContain('bindtouchstart="handleTouchStart"');
    expect(template).toContain('bindtouchmove="handleTouchMove"');
    expect(template).toContain('bindtouchend="handleTouchEnd"');
    expect(template).toContain('{{sdkVersion}}');
    expect(template).toContain('{{platform}}');
    expect(template).toContain('{{model}}');
    expect(styles).toMatch(/\.worklet-probe-handler\s*\{[^}]*display:\s*block;/su);
    expect(source).toMatch(/this\.applyAnimatedStyle\(\s*['"]#gesture-probe-dot['"]/u);
    expect(source).toContain('wx.getAppBaseInfo');
    expect(source).toContain('wx.getDeviceInfo');
    expect(worklets.issues).toEqual([]);
    expect(worklets.count).toBe(2);
  });

  it('moves the shared dot on ACTIVE while ordinary touch events update only diagnostic state', async () => {
    let definition;
    vi.stubGlobal('wx', {
      getAppBaseInfo: () => ({ SDKVersion: '3.17.1', version: '8.0.60' }),
      getDeviceInfo: () => ({ model: 'Android probe', platform: 'android' }),
      worklet: { shared: (value) => ({ value }) },
    });
    vi.stubGlobal('Page', (value) => {
      definition = value;
    });
    await import('../src/pages/gesture-probe/index.ts');

    const setData = vi.fn();
    const instance = { applyAnimatedStyle: vi.fn(), setData };
    definition.onLoad.call(instance);
    setData.mockClear();

    definition.handleProbePan.call(instance, { deltaX: 24, deltaY: -18, state: 2 });
    expect(instance._probeX.value).toBe(24);
    expect(instance._probeY.value).toBe(-18);
    expect(setData).not.toHaveBeenCalled();

    definition.handleTouchStart.call(instance);
    definition.handleTouchMove.call(instance);
    definition.handleTouchEnd.call(instance);
    expect(setData).toHaveBeenCalledWith(expect.objectContaining({ touchMoveCount: 1 }));
    expect(setData).toHaveBeenCalledWith(
      expect.objectContaining({ touchStatus: '普通触摸已结束' }),
    );
  });

  it('adds an isolated WXS view-layer drag probe without changing the matrix input engine', () => {
    const template = readSource('pages/gesture-probe/index.wxml');
    const styles = readSource('pages/gesture-probe/index.wxss');
    const wxsSource = readSource('pages/gesture-probe/drag-probe.wxs');
    const matrixTemplate = readSource('pages/manual-matrix-poc/index.wxml');

    expect(template).toContain('<wxs module="wxsProbe" src="./drag-probe.wxs"></wxs>');
    expect(template).toContain('bindtouchstart="{{wxsProbe.touchStart}}"');
    expect(template).toContain('bindtouchmove="{{wxsProbe.touchMove}}"');
    expect(template).toContain('bindtouchend="{{wxsProbe.touchEnd}}"');
    expect(template).toContain('bindtouchcancel="{{wxsProbe.touchEnd}}"');
    expect(template).toContain('id="wxs-probe-dot"');
    expect(styles).toMatch(/\.wxs-probe-surface\s*\{[^}]*touch-action:\s*none;/su);
    expect(wxsSource).toContain("selectComponent('#wxs-probe-dot')");
    expect(wxsSource).toContain('setStyle');
    expect(wxsSource).toContain('module.exports');
    expect(matrixTemplate).not.toContain('drag-probe.wxs');
    expect(matrixTemplate).toContain('worklet:ongesture="handleMatrixPan"');
  });

  it('keeps WXS drag coordinates bounded and updates the dot without setData', () => {
    const moduleRecord = { exports: {} };
    vm.runInNewContext(readSource('pages/gesture-probe/drag-probe.wxs'), {
      module: moduleRecord,
    });
    const handlers = moduleRecord.exports;
    const setStyle = vi.fn();
    const ownerInstance = {
      selectComponent: vi.fn(() => ({ setStyle })),
    };

    handlers.touchStart({ touches: [{ clientX: 100, clientY: 120 }] });
    handlers.touchMove({ touches: [{ clientX: 136, clientY: 98 }] }, ownerInstance);
    expect(setStyle).toHaveBeenLastCalledWith({ transform: 'translate(36px, -22px)' });

    handlers.touchMove({ touches: [{ clientX: 999, clientY: -999 }] }, ownerInstance);
    expect(setStyle).toHaveBeenLastCalledWith({ transform: 'translate(96px, -70px)' });

    handlers.touchEnd();
    handlers.touchMove({ touches: [{ clientX: 120, clientY: 120 }] }, ownerInstance);
    expect(setStyle).toHaveBeenCalledTimes(2);
  });
});
