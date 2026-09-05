import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const miniRoot = process.cwd();

function read(relativePath) {
  return readFileSync(path.join(miniRoot, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

async function loadPickerDefinition() {
  let definition;
  vi.stubGlobal('Component', (value) => {
    definition = value;
  });
  await import('../src/subpackages/workflows/components/workflow-picker/index.ts');
  return definition;
}

function createPickerInstance(definition, properties = {}) {
  const instance = {
    data: structuredClone(definition.data),
    properties: {
      disabled: false,
      mode: 'selector',
      options: [],
      selectedIndex: -1,
      value: '',
      ...properties,
    },
    setData(patch, callback) {
      Object.assign(this.data, patch);
      callback?.();
    },
    triggerEvent: vi.fn(),
  };
  return instance;
}

describe('EXP-UX-001 experience feedback contracts', () => {
  beforeEach(() => vi.resetModules());

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe('workflow picker', () => {
    it('toggles an open selector closed when its own trigger is clicked again', async () => {
      const definition = await loadPickerDefinition();
      const instance = createPickerInstance(definition, {
        options: [{ label: '我的班次', value: 'assignment-1' }],
      });

      definition.methods.handleOpen.call(instance);
      expect(instance.data.open).toBe(true);
      const openEvents = instance.triggerEvent.mock.calls.length;

      definition.methods.handleOpen.call(instance);

      expect(instance.data.open).toBe(false);
      expect(instance.triggerEvent).toHaveBeenCalledTimes(openEvents);
    });

    it('keeps workflow dropdown callers on one shared implementation', () => {
      for (const workflow of ['leave', 'swap', 'duty']) {
        const componentRoot = `src/subpackages/workflows/components/workflow-${workflow}-panel`;
        const template = read(`${componentRoot}/index.wxml`);
        const config = readJson(`${componentRoot}/index.json`);
        expect(template).toContain('<workflow-picker');
        expect(template).not.toMatch(/<picker(?:\s|>)/u);
        expect(config.usingComponents['workflow-picker']).toBe(
          '/subpackages/workflows/components/workflow-picker/index',
        );
      }
    });

    it('allows an empty selector to close through the same trigger', async () => {
      const definition = await loadPickerDefinition();
      const instance = createPickerInstance(definition, { options: [] });

      definition.methods.handleOpen.call(instance);
      expect(instance.data.open).toBe(true);
      definition.methods.handleOpen.call(instance);

      expect(instance.data.open).toBe(false);
      expect(instance.triggerEvent).toHaveBeenCalledTimes(1);
    });

    it('closes A before opening B and closes B on a repeated click', async () => {
      const definition = await loadPickerDefinition();
      const options = [{ label: '成员 A', value: 'member-a' }];
      const first = createPickerInstance(definition, { options });
      const second = createPickerInstance(definition, { options });
      definition.lifetimes.attached.call(first);
      definition.lifetimes.attached.call(second);

      definition.methods.handleOpen.call(first);
      definition.methods.handleOpen.call(second);
      expect(first.data.open).toBe(false);
      expect(second.data.open).toBe(true);

      definition.methods.handleOpen.call(second);
      expect(second.data.open).toBe(false);

      definition.lifetimes.detached.call(first);
      definition.lifetimes.detached.call(second);
    });

    it('clears a picker during direct Page unload through the shared workflow host', async () => {
      vi.stubGlobal('Component', () => {});
      const { createWorkflowPageDefinition } =
        await import('../src/subpackages/workflows/components/controller-host.ts');
      const page = createWorkflowPageDefinition(() => ({
        data: { embedded: false, infoMessage: '' },
        onLoad() {},
      }));
      const closeFromParent = vi.fn();
      const instance = {
        data: { embedded: false, infoMessage: '' },
        properties: { embedded: false, groupId: '' },
        selectAllComponents: vi.fn(() => [{ closeFromParent }]),
        setData(patch, callback) {
          Object.assign(this.data, patch);
          callback?.();
        },
      };

      page.onLoad.call(instance, {});
      closeFromParent.mockClear();
      page.onUnload.call(instance);

      expect(closeFromParent).toHaveBeenCalledTimes(1);
    });
  });

  describe('shared swap sheet', () => {
    it('uses the shared fixed sheet with a separate scroll region and footer', () => {
      const config = readJson(
        'src/subpackages/workflows/components/workflow-swap-panel/index.json',
      );
      const template = read('src/subpackages/workflows/components/workflow-swap-panel/index.wxml');
      const workflowSheetStyles = read(
        'src/subpackages/workflows/components/workflow-leave-panel/index.wxss',
      );
      const sharedTemplate = read('src/components/ui/ui-sheet/index.wxml');
      const sharedStyles = read('src/components/ui/ui-sheet/index.wxss');
      const workbenchStyles = read('src/pages/workbench/index.wxss');

      expect(config.usingComponents['ui-sheet']).toBe('/components/ui/ui-sheet/index');
      expect(template.match(/<ui-sheet\b/gu)).toHaveLength(3);
      expect(template).not.toContain('class="sheet-layer"');
      expect(template).not.toContain('class="native-sheet');
      for (const title of ['发起换班', '管理员直接换班', '撤销换班']) {
        const start = template.indexOf(`title="${title}"`);
        const end = template.indexOf('</ui-sheet>', start);
        expect(start, `missing shared sheet ${title}`).toBeGreaterThanOrEqual(0);
        expect(end, `unterminated shared sheet ${title}`).toBeGreaterThan(start);
        const sheet = template.slice(start, end);
        expect(sheet).toContain('bind:close=');
        expect(sheet).toContain('swipe-dismiss=');
      }

      for (const title of ['发起换班', '管理员直接换班']) {
        const start = template.indexOf(`title="${title}"`);
        const end = template.indexOf('</ui-sheet>', start);
        const sheet = template.slice(start, end);
        expect(sheet.indexOf('</scroll-view>')).toBeLessThan(
          sheet.indexOf('class="workflow-sheet-footer"'),
        );
      }
      expect(workflowSheetStyles).toMatch(
        /\.workflow-sheet-scroll\s*\{[^}]*min-height:\s*0;[^}]*flex:\s*1;/su,
      );
      expect(workflowSheetStyles).toMatch(/\.workflow-sheet-footer\s*\{[^}]*flex:\s*none;/su);
      expect(sharedTemplate).toContain('class="ui-sheet__drag-region"');
      expect(sharedTemplate).not.toMatch(/class="ui-sheet__content"[^>]*bindtouch/iu);
      expect(sharedStyles).toMatch(
        /\.ui-sheet__layer\s*\{[^}]*position:\s*fixed;[^}]*z-index:\s*400;/su,
      );
      expect(sharedStyles).toMatch(
        /\.ui-sheet__panel\s*\{[^}]*height:\s*78vh;[^}]*max-height:\s*660px;/su,
      );
      expect(sharedStyles).toContain('env(safe-area-inset-bottom)');
      expect(workbenchStyles).toMatch(
        /\.bottom-nav\s*\{[^}]*z-index:\s*var\(--ui-z-index-navigation\);/su,
      );
    });

    it('keeps sheet drag ownership at the handle, rebounds below threshold, and dismisses once', () => {
      const moduleRecord = { exports: {} };
      vm.runInNewContext(read('src/components/ui/ui-sheet/drag-dismiss.wxs'), {
        module: moduleRecord,
      });
      const handlers = moduleRecord.exports;
      const panelSetStyle = vi.fn();
      const scrimSetStyle = vi.fn();
      const callMethod = vi.fn();
      const animationFrames = [];
      const owner = {
        callMethod,
        requestAnimationFrame(callback) {
          animationFrames.push(callback);
        },
        selectComponent(selector) {
          if (selector === '#ui-sheet-panel') return { setStyle: panelSetStyle };
          if (selector === '#ui-sheet-scrim') return { setStyle: scrimSetStyle };
          return undefined;
        },
      };
      const enabled = { currentTarget: { dataset: { swipeDismiss: true } } };

      handlers.touchStart(touchEvent(0, 100, 100, enabled), owner);
      handlers.touchMove(touchEvent(100, 140, 100, enabled), owner);
      handlers.touchEnd(touchEndEvent(120, 140, 100, enabled), owner);
      expect(panelSetStyle).toHaveBeenLastCalledWith(
        expect.objectContaining({ transform: 'translateY(0px)' }),
      );
      expect(callMethod).not.toHaveBeenCalled();

      handlers.touchStart(touchEvent(200, 100, 100, enabled), owner);
      handlers.touchMove(touchEvent(360, 202, 100, enabled), owner);
      handlers.touchEnd(touchEndEvent(380, 202, 100, enabled), owner);
      flushAnimationFrames(animationFrames);

      expect(callMethod).toHaveBeenCalledTimes(1);
      expect(callMethod).toHaveBeenCalledWith('handleSwipeDismiss');
      expect(scrimSetStyle).toHaveBeenCalledWith(expect.objectContaining({ opacity: '0' }));

      callMethod.mockClear();
      handlers.touchStart(touchEvent(400, 100, 100, enabled), owner);
      handlers.touchMove(touchEvent(420, 132, 160, enabled), owner);
      handlers.touchEnd(touchEndEvent(424, 132, 160, enabled), owner);
      expect(callMethod).not.toHaveBeenCalled();

      handlers.touchStart(touchEvent(500, 100, 100, enabled), owner);
      handlers.touchMove(touchEvent(540, 150, 100, enabled), owner);
      handlers.touchCancel(touchEndEvent(544, 150, 100, enabled), owner);
      expect(panelSetStyle).toHaveBeenLastCalledWith(
        expect.objectContaining({ transform: 'translateY(0px)' }),
      );
      expect(callMethod).not.toHaveBeenCalled();
    });
  });

  describe('non-Tab workflow pages', () => {
    const workflows = ['leave', 'swap', 'duty'];
    const directPageConfig = {
      'ui-sheet': '/components/ui/ui-sheet/index',
      'ui-toast': '/components/ui/ui-toast/index',
      'workflow-picker': '/subpackages/workflows/components/workflow-picker/index',
    };
    const legacyHandlers = {
      duty: ['handleLeaveNav', 'handleSwapNav', 'handleUnavailable'],
      leave: ['handleSwapNav', 'handleDutyNav', 'handleUnavailable'],
      swap: ['handleLeaveNav', 'handleDutyNav', 'handleUnavailable'],
    };

    it('removes the copied bottom navigation and its reserved space from every workflow Page', () => {
      for (const workflow of workflows) {
        const template = read(
          `src/subpackages/workflows/components/workflow-${workflow}-panel/index.wxml`,
        );
        const styles = read(
          `src/subpackages/workflows/components/workflow-${workflow}-panel/index.wxss`,
        );
        const controller = read(
          `src/subpackages/workflows/components/workflow-${workflow}-panel/controller.ts`,
        );
        const pageConfig = readJson(`src/subpackages/workflows/pages/${workflow}/index.json`);
        const pageTemplate = read(`src/subpackages/workflows/pages/${workflow}/index.wxml`);
        const pageSource = read(`src/subpackages/workflows/pages/${workflow}/index.ts`);

        expect(template).not.toContain('class="bottom-nav"');
        expect(styles).not.toMatch(/\.bottom-nav(?:-item)?(?:\s|\.)/u);
        expect(styles).not.toContain('padding-bottom: calc(64px + env(safe-area-inset-bottom))');
        expect(styles).toContain('padding-bottom: calc(16px + env(safe-area-inset-bottom))');
        for (const handler of legacyHandlers[workflow]) {
          expect(controller).not.toContain(handler);
        }
        expect(pageConfig.usingComponents).toEqual(directPageConfig);
        expect(pageTemplate.trim()).toBe(
          `<include src="../../components/workflow-${workflow}-panel/index.wxml" />`,
        );
        expect(pageSource).toContain('createWorkflowPageDefinition');
      }
    });
  });

  describe('right-header phase tags', () => {
    const phaseRoots = [
      'src/subpackages/scheduling/pages/backfill',
      'src/subpackages/scheduling/pages/manual',
      'src/subpackages/workflows/components/workflow-duty-panel',
      'src/subpackages/workflows/components/workflow-leave-panel',
      'src/subpackages/workflows/components/workflow-swap-panel',
      'src/subpackages/organization/components/group-settings-panel',
      'src/subpackages/organization/components/invite-visitor-panel',
      'src/subpackages/organization/components/platform-accounts-panel',
      'src/subpackages/organization/components/scheduling-config-panel',
      'src/subpackages/insights/components/exports-panel',
      'src/subpackages/insights/components/insights-dashboard-panel',
      'src/subpackages/insights/components/notifications-panel',
      'src/subpackages/insights/components/visitor-access-panel',
    ];

    it('removes every visible P phase chip and its style while preserving build identity', () => {
      for (const root of phaseRoots) {
        expect(read(`${root}/index.wxml`)).not.toMatch(
          /<text[^>]*class="phase-chip"[^>]*>\s*P[0-9A-Z.-]+\s*<\/text>/iu,
        );
        expect(read(`${root}/index.wxss`)).not.toContain('.phase-chip');
      }

      const exportsTemplate = read('src/subpackages/insights/components/exports-panel/index.wxml');
      const exportsStyles = read('src/subpackages/insights/components/exports-panel/index.wxss');
      expect(exportsTemplate).toContain('class="format-chip">CSV');
      expect(exportsStyles).toContain('.format-chip');
      expect(read('src/platform/build-info.ts')).toContain('buildLabel');
      expect(read('src/subpackages/diagnostics/pages/test-tools/index.wxml')).toContain(
        '{{buildRows[0].value}}',
      );
      expect(read('src/pages/index/index.wxml')).toContain('P1 · 原生复刻基线');
    });
  });
});

function touchEvent(timeStamp, clientY, clientX, base) {
  return {
    ...base,
    timeStamp,
    touches: [{ clientX, clientY }],
  };
}

function touchEndEvent(timeStamp, clientY, clientX, base) {
  return {
    ...base,
    changedTouches: [{ clientX, clientY }],
    timeStamp,
  };
}

function flushAnimationFrames(queue) {
  for (let index = 0; index < 24 && queue.length > 0; index += 1) queue.shift()();
}
