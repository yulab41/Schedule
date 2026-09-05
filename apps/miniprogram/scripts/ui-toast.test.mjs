// @vitest-environment jsdom
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import simulate from 'miniprogram-simulate';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sourceRoot = path.resolve(process.cwd(), 'src');
const read = (name) => readFileSync(path.join(sourceRoot, name), 'utf8');
const toastPath = 'components/ui/ui-toast/';

describe('controlled root-layer workflow toast', () => {
  let definition;
  let component;
  let wrapper;
  let windowInfo;
  let capsule;
  let header;
  let resize;
  let offResize;

  beforeEach(async () => {
    vi.resetModules();
    windowInfo = { statusBarHeight: 47, windowWidth: 390, windowHeight: 844 };
    capsule = { top: 51, bottom: 83, height: 32, width: 87, left: 296, right: 383 };
    header = 111;
    resize = vi.fn();
    offResize = vi.fn();
    vi.stubGlobal('wx', {
      getWindowInfo() {
        return windowInfo;
      },
      getMenuButtonBoundingClientRect() {
        return capsule;
      },
      onWindowResize: resize,
      offWindowResize: offResize,
    });
    vi.stubGlobal('getCurrentPages', () => [{ data: { shellHeaderHeight: header } }]);
    vi.stubGlobal('Component', (value) => {
      definition = value;
    });
    await import('../src/components/ui/ui-toast/index.ts');
  });

  afterEach(() => {
    wrapper?.detach();
    wrapper = undefined;
    component = undefined;
    globalThis.document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  function render(properties = {}) {
    const id = simulate.load({ ...definition, template: read(`${toastPath}index.wxml`) });
    // simulate cannot detach a virtual-host root directly; use a real parent as native pages do.
    const wrapperId = simulate.load({
      usingComponents: { 'ui-toast': id },
      template: '<ui-toast id="toast" />',
    });
    wrapper = simulate.render(wrapperId);
    wrapper.attach(globalThis.document.body);
    component = wrapper.querySelector('#toast');
    component.setData({
      title: '操作完成',
      message: '已开启自动接受换班',
      visible: true,
      ...properties,
    });
    return component;
  }

  it.each(['success', 'info', 'warning', 'error'])(
    'renders %s tone and the full accessible title/message',
    (tone) => {
      render({ tone });
      expect(component.querySelector(`.ui-toast--${tone}`)).toBeDefined();
      expect(component.querySelector('.ui-toast__title').dom.textContent).toBe('操作完成');
      expect(component.querySelector('.ui-toast__message').dom.textContent).toBe(
        '已开启自动接受换班',
      );
      expect(component.instance.data.safeTopOffset).toBe(119);
    },
  );

  it('replaces visible text without remounting, and retains exit text after the parent clears it', () => {
    render();
    const card = component.querySelector('.ui-toast').dom;
    component.setData({ message: '第二次操作完成', tone: 'warning' });
    expect(component.querySelector('.ui-toast').dom).toBe(card);
    expect(component.querySelector('.ui-toast__message').dom.textContent).toBe('第二次操作完成');
    component.setData({ visible: false, message: '' });
    expect(component.instance.data.isVisible).toBe(false);
    expect(component.instance.data.displayMessage).toBe('第二次操作完成');
    expect(read(`${toastPath}index.wxml`)).toContain('aria-hidden="{{!isVisible}}"');
    component.setData({ visible: true, message: '新操作' });
    expect(component.instance.data.isVisible).toBe(true);
    expect(component.instance.data.displayMessage).toBe('新操作');
  });

  it('keeps empty or parent-hidden feedback invisible and normalizes an unknown tone', () => {
    render({ title: '', message: '', tone: 'unknown' });
    expect(component.instance.data.isVisible).toBe(false);
    component.setData({ title: '完成', message: '更新成功', visible: true });
    expect(component.instance.data.displayTone).toBe('info');
    component.setData({ visible: false });
    expect(component.instance.data.isVisible).toBe(false);
  });

  it('recomputes native and custom-navigation offsets on resize and removes the exact listener', () => {
    render();
    const listener = resize.mock.calls[0][0];
    windowInfo = { statusBarHeight: 24, windowWidth: 844, windowHeight: 390 };
    capsule = { top: 30, bottom: 62, height: 32, width: 87, left: 740, right: 827 };
    header = 76;
    listener();
    expect(component.instance.data.safeTopOffset).toBe(84);
    component.setData({ topOffset: 140 });
    expect(component.instance.data.safeTopOffset).toBe(148);
    const instance = component.instance;
    wrapper.detach();
    wrapper = undefined;
    component = undefined;
    expect(offResize).toHaveBeenCalledOnce();
    expect(offResize).toHaveBeenCalledWith(listener);
    const setData = vi.spyOn(instance, 'setData');
    listener();
    expect(setData).not.toHaveBeenCalled();
  });

  it('places the toast below a tall capsule and falls back safely for missing/invalid menu bounds', async () => {
    const { readTopOverlayOffset } = await import('../src/platform/top-overlay.ts');
    header = 0;
    capsule = { top: 70, bottom: 102, height: 32, width: 87, left: 296, right: 383 };
    expect(readTopOverlayOffset()).toBe(133);
    capsule = { top: NaN, bottom: NaN, height: 0, width: 0 };
    expect(readTopOverlayOffset()).toBe(55);
    windowInfo = { safeArea: { top: 48 }, windowWidth: 320 };
    globalThis.wx.getMenuButtonBoundingClientRect = () => {
      throw new Error('unavailable');
    };
    expect(readTopOverlayOffset(NaN)).toBe(56);
    vi.stubGlobal('getCurrentPages', undefined);
    expect(readTopOverlayOffset()).toBe(56);
  });

  it('declares a virtual root portal, pointer passthrough, two-line text, and CSS-only reduced motion', () => {
    const template = read(`${toastPath}index.wxml`);
    const styles = read(`${toastPath}index.wxss`);
    expect(definition.options.virtualHost).toBe(true);
    expect(template).toMatch(/^<root-portal enable="\{\{true\}\}">/u);
    expect(template).not.toMatch(/(?:bind|catch)(?:tap|touch)/u);
    expect(styles).toMatch(
      /\.ui-toast__layer\s*\{[^}]*position: fixed;[^}]*z-index: calc\(var\(--ui-z-index-dialog\) \+ 100\);[^}]*pointer-events: none;/su,
    );
    expect(styles).toContain('-webkit-line-clamp: 2;');
    expect(template).toContain('max-lines="2"');
    expect(styles).toContain('max-height: 3.1em;');
    expect(styles).toContain('word-break: normal;');
    expect(styles).toContain('overflow-wrap: anywhere;');
    expect(styles).toContain('min-width: 0;');
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
    expect(styles).toMatch(
      /prefers-reduced-motion: reduce[\s\S]*transition: none;[\s\S]*transform: none;/u,
    );
    expect(styles).not.toMatch(/#[0-9a-f]{3,8}\b/iu);
    expect(read(`${toastPath}index.ts`)).not.toMatch(/setTimeout|clearTimeout|setInterval/u);
    expect(read('platform/top-overlay.ts')).not.toMatch(/statusBar\s*\+\s*(52|64)/u);
    const sheetZ = Number(read('components/ui/ui-sheet/index.wxss').match(/z-index:\s*(\d+)/u)[1]);
    expect(sheetZ).toBeLessThan(1_100);
  });

  it.each(['swap', 'leave', 'duty'])(
    'migrates %s success at template root and preserves errors and business state',
    (kind) => {
      const root = `subpackages/workflows/components/workflow-${kind}-panel`;
      const template = read(`${root}/index.wxml`);
      expect(template.trimStart()).toMatch(/^<ui-toast\s/u);
      expect(template).toContain('visible="{{!!infoMessage && (!embedded || active)}}"');
      expect(template.match(/message="\{\{infoMessage\}\}"/gu)).toHaveLength(1);
      expect(template).not.toMatch(/<view[^>]*wx:if="\{\{infoMessage\}\}"/u);
      expect(template).toContain('class="native-alert is-danger"');
      expect(template).toContain('{{errorMessage}}');
      expect(read(`${root}/controller.ts`)).toContain('shellHeaderHeight: headerHeight');
      for (const configPath of [
        `${root}/index.json`,
        `subpackages/workflows/pages/${kind}/index.json`,
      ]) {
        expect(JSON.parse(read(configPath)).usingComponents['ui-toast']).toBe(
          '/components/ui/ui-toast/index',
        );
      }
    },
  );

  it('audits the entire Mini tree for inline success auto-clear and preserves all other categories', () => {
    const files = [];
    function walk(directory) {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) walk(file);
        else if (entry.name.endsWith('.ts')) files.push(file);
      }
    }
    walk(sourceRoot);
    const clearingSources = files
      .filter((file) => {
        const source = readFileSync(file, 'utf8');
        return /setTimeout\([\s\S]{0,900}setData\(\{\s*(?:infoMessage|successMessage|managementInfo):\s*''/u.test(
          source,
        );
      })
      .map((file) => file.replaceAll('\\', '/').split('/src/')[1]);
    expect(clearingSources).toEqual(['subpackages/workflows/components/controller-host.ts']);
    for (const [directory, field] of [
      ['subpackages/insights/components/notifications-panel', 'infoMessage'],
      ['subpackages/organization/components/group-settings-panel', 'infoMessage'],
      ['subpackages/organization/components/scheduling-config-panel', 'managementInfo'],
      ['subpackages/organization/components/invite-visitor-panel', 'managementInfo'],
      ['subpackages/organization/components/platform-accounts-panel', 'managementInfo'],
      ['subpackages/scheduling/pages/manual', 'infoMessage'],
      ['subpackages/scheduling/pages/backfill', 'infoMessage'],
    ]) {
      expect(read(`${directory}/index.wxml`)).toContain(`message="{{${field}}}"`);
      expect(read(`${directory}/index.wxml`)).not.toContain('<ui-toast');
    }
    expect(read('pages/workbench/index.wxml')).toContain('aria-live="polite"');
    expect(read('subpackages/diagnostics/pages/test-tools/index.ts')).toContain('wx.showToast');
    expect(read('platform/profile-avatar-runtime.ts')).toContain('本次头像未更新');
    expect(read('subpackages/workflows/components/workflow-swap-panel/controller.ts')).toContain(
      'wx.showModal',
    );
  });
});
