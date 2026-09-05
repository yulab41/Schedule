import { readFileSync } from 'node:fs';
import vm from 'node:vm';

import { afterEach, describe, expect, it, vi } from 'vitest';

const read = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
const panelPath = 'subpackages/organization/components/directory-panel';
const cardPath = 'subpackages/organization/components/directory-entry-card';
const sheetPath = 'components/ui/ui-sheet';

async function loadSheet(properties = {}) {
  vi.resetModules();
  let definition;
  vi.stubGlobal('Component', (value) => {
    definition = value;
  });
  await import('../src/components/ui/ui-sheet/index.ts');
  const instance = {
    data: structuredClone(definition.data ?? {}),
    properties: {
      ...Object.fromEntries(
        Object.entries(definition.properties).map(([key, value]) => [key, value.value]),
      ),
      ...properties,
    },
    setData: vi.fn(function (patch) {
      Object.assign(this.data, patch);
    }),
    triggerEvent: vi.fn(),
  };
  return { definition, instance };
}

afterEach(() => vi.unstubAllGlobals());

describe('task A directory presentation', () => {
  it('uses full Web search copy once per mode and keeps accessible copy and search events', () => {
    const controller = read(`${panelPath}/controller.ts`);
    const template = read(`${panelPath}/index.wxml`);
    const web = readFileSync(
      new URL('../../web/src/views/directory/InternalDirectoryView.vue', import.meta.url),
      'utf8',
    );
    for (const copy of ['搜索科室、姓名、拼音或号码', '搜索姓名、级别、工号、拼音、首字母或号码']) {
      expect(web).toContain(copy);
      expect(controller.split(copy)).toHaveLength(2);
    }
    expect(controller).toMatch(
      /searchPlaceholder:\s*kind === 'employee'\s*\? '搜索姓名、级别、工号、拼音、首字母或号码'\s*: '搜索科室、姓名、拼音或号码'/u,
    );
    expect(template).toContain('placeholder="{{pane.searchPlaceholder}}"');
    expect(template).toContain('aria-label="{{pane.searchPlaceholder}}"');
    expect(template).not.toContain('可自动搜索；');
    expect(template).toContain('bindinput="handleSearchInput"');
    expect(template).toContain('bindconfirm="handleSearch"');
  });

  it('allocates the normal 16px text width at 390/414 and confines 320 text without hiding controls', () => {
    const styles = read(`${panelPath}/index.wxss`);
    const search = styles.match(/\.directory-search\s*\{([^}]+)\}/u)[1];
    const input = styles.match(/\.search-input\s*\{([^}]+)\}/u)[1];
    const placeholder = styles.match(/\.search-placeholder\s*\{([^}]+)\}/u)[1];
    const inlinePadding = Number(search.match(/padding:\s*\d+px (\d+)px;/u)[1]);
    const gap = Number(search.match(/gap:\s*(\d+)px;/u)[1]);
    const iconWidth = Number(styles.match(/\.search-icon\s*\{[^}]*width:\s*(\d+)px;/u)[1]);
    const fontSize = Number(input.match(/font-size:\s*(\d+)px;/u)[1]);
    const textWidth = [...'搜索姓名、级别、工号、拼音、首字母或号码'].length * fontSize;
    for (const width of [320, 390, 414, 393]) {
      const pagePadding = width <= 340 ? 10 : 14;
      const available = width - 2 * pagePadding - 2 - 2 * inlinePadding - iconWidth - gap;
      expect(available).toBeGreaterThan(0);
      if (width >= 390) expect(available).toBeGreaterThanOrEqual(textWidth);
      else expect(available).toBeLessThan(textWidth);
    }
    expect(fontSize).toBe(16);
    expect(input).toContain('min-width: 0');
    expect(input).toContain('text-overflow: ellipsis');
    expect(input).not.toContain('transform');
    expect(placeholder).toContain('text-overflow: ellipsis');
    expect(placeholder).toContain('white-space: nowrap');
    expect(styles).toMatch(/\.search-clear\s*\{[^}]*width:\s*44px;/u);
    expect(read(`${panelPath}/index.wxml`)).toContain('wx:if="{{pane.searchQuery.length > 0}}"');
  });

  it('uses the existing success phone for both number kinds and retains touch and accessible semantics', () => {
    const template = read(`${cardPath}/index.wxml`);
    expect(template).toContain('wx:for="{{contact.numbers}}"');
    expect(template).toContain('src="/assets/icons/ui-phone-success.svg"');
    expect(template).not.toMatch(/web-(?:directory-)?phone\.svg/u);
    expect(template).toContain(
      'aria-label="拨打{{entry.title}}的{{contact.label}} {{number.number}}"',
    );
    expect(template).toContain('bindtap="handleCall"');
    expect(read(`${cardPath}/index.wxss`)).toMatch(
      /\.directory-number\s*\{[^}]*min-height:\s*44px;/u,
    );
  });

  it('compresses measured hierarchy widths without reversing or changing Chinese punctuation', async () => {
    const { createDirectoryPathCandidates, selectDirectoryTailPath } =
      await import('../src/subpackages/organization/components/directory-entry-card/tail-path/path-layout.ts');
    const full = '本部（东区） > 一级组织 > 三级组织（A） > 最终科室';
    const candidates = createDirectoryPathCandidates(full);
    expect(candidates).toEqual([
      full,
      '… > 一级组织 > 三级组织（A） > 最终科室',
      '… > 三级组织（A） > 最终科室',
      '… > 最终科室',
      '最终科室',
    ]);
    const widths = [480, 390, 265, 115, 80];
    expect(selectDirectoryTailPath(candidates, widths, 500)).toBe(full);
    expect(selectDirectoryTailPath(candidates, widths, 280)).toBe('… > 三级组织（A） > 最终科室');
    expect(selectDirectoryTailPath(candidates, widths, 140)).toBe('… > 最终科室');
    expect(selectDirectoryTailPath(candidates, widths, 60)).toBe('最终科室');
    expect(selectDirectoryTailPath(candidates, [], 0)).toBe(full);
    expect(candidates[0]).toBe(full);
    expect(createDirectoryPathCandidates('门诊（一区）')).toEqual(['门诊（一区）']);
    expect(createDirectoryPathCandidates('院区 › 科室 · 东楼（2F）')).toEqual([
      '院区 › 科室 · 东楼（2F）',
      '… › 科室 · 东楼（2F）',
      '… · 东楼（2F）',
      '东楼（2F）',
    ]);
  });

  it('renders one accessible native-measured helper and preserves raw contexts', () => {
    const template = read(`${cardPath}/index.wxml`);
    const helper = read(`${cardPath}/tail-path/index.wxml`);
    const styles = read(`${cardPath}/tail-path/index.wxss`);
    expect(template).toContain('wx:for="{{entry.contexts}}"');
    expect(template).toContain('value="{{context}}"');
    expect(helper).toContain('aria-label="{{value}}"');
    expect(helper).toContain('aria-hidden="true"');
    expect(styles).toContain('direction: ltr');
    expect(styles).not.toMatch(/rtl|bidi-override/u);
    expect(read(`${cardPath}/tail-path/index.ts`)).toContain('boundingClientRect');
  });

  it('uses one three-quarter handle-only sheet, fixed reset and one scroll region with background lock', () => {
    const template = read(`${panelPath}/index.wxml`);
    const filter = template.slice(
      template.indexOf('<template name="directory-filter-sheet">'),
      template.indexOf('</template>', template.indexOf('<template name="directory-filter-sheet">')),
    );
    expect(filter).toContain('<ui-sheet');
    expect(filter).toContain('size="three-quarter"');
    expect(filter).toContain('swipe-area="handle"');
    expect(filter).toContain('swipe-dismiss="{{true}}"');
    expect(filter).toContain('bindclose="handleCloseFilters"');
    expect(filter.match(/<scroll-view\b/gu)).toHaveLength(1);
    expect(filter.indexOf('sheet-reset-action')).toBeLessThan(filter.indexOf('<scroll-view'));
    expect(filter).toContain('scroll-top="{{sheet.scrollTop}}"');
    expect(filter).toContain('scroll-into-view="{{sheet.scrollTarget}}"');
    expect(template).toContain('scroll-y="{{!filterSheetOpen}}"');
    expect(template).not.toContain('directorySheetGesture');
    expect(read(`${panelPath}/controller.ts`)).not.toContain('createFilterSheetStyle');
    for (const configPath of [
      `${panelPath}/index.json`,
      'subpackages/organization/pages/directory/index.json',
    ]) {
      expect(JSON.parse(read(configPath)).usingComponents['ui-sheet']).toBe(
        '/components/ui/ui-sheet/index',
      );
    }
  });
});

describe('task A UiSheet window and gesture lifecycle', () => {
  it('cancels queued swipe dismissal on reset/reopen and after the panel is detached', async () => {
    const record = { exports: {} };
    vm.runInNewContext(read(`${sheetPath}/drag-dismiss.wxs`), { module: record });
    const frames = [];
    let mounted = true;
    const owner = {
      callMethod: vi.fn(),
      selectComponent: () => (mounted ? { setStyle: vi.fn() } : null),
      requestAnimationFrame: (callback) => frames.push(callback),
    };
    const event = (timeStamp, clientY) => ({
      timeStamp,
      touches: [{ clientX: 80, clientY }],
      currentTarget: { dataset: { swipeDismiss: true, swipeArea: 'header' } },
    });
    const startDismiss = () => {
      record.exports.touchStart(event(0, 100), owner);
      record.exports.touchMove(event(160, 205), owner);
      record.exports.touchEnd(event(180, 205), owner);
    };
    startDismiss();
    record.exports.reset(2, 1, owner);
    while (frames.length) frames.shift()();
    expect(owner.callMethod).not.toHaveBeenCalled();
    startDismiss();
    mounted = false;
    while (frames.length) frames.shift()();
    expect(owner.callMethod).not.toHaveBeenCalled();
    const { definition, instance } = await loadSheet({ visible: false, swipeDismiss: true });
    instance._attached = true;
    definition.methods.handleSwipeDismiss.call(instance);
    instance._attached = false;
    instance.properties.visible = true;
    definition.methods.handleSwipeDismiss.call(instance);
    expect(instance.triggerEvent).not.toHaveBeenCalled();
  });

  it('keeps default height and makes half/three-quarter border boxes follow the current window', async () => {
    let windowInfo = {
      windowHeight: 820,
      screenHeight: 844,
      statusBarHeight: 24,
      safeArea: { bottom: 810 },
    };
    let resize;
    vi.stubGlobal('wx', {
      getWindowInfo: () => windowInfo,
      onWindowResize: vi.fn((handler) => {
        resize = handler;
      }),
      offWindowResize: vi.fn(),
    });
    const { definition, instance } = await loadSheet({ visible: true });
    expect(instance.properties.size).toBe('default');
    expect(instance.properties.swipeArea).toBe('header');
    definition.lifetimes.attached.call(instance);
    expect(instance.data.panelStyle).toBe('');
    instance.properties.size = 'half';
    definition.observers['size, visible'].call(instance);
    expect(instance.data.panelStyle).toBe('height:410px;max-height:none;');
    instance.properties.size = 'three-quarter';
    definition.observers['size, visible'].call(instance);
    expect(instance.data.panelStyle).toBe('height:615px;max-height:none;');
    windowInfo = {
      windowHeight: 390,
      screenHeight: 414,
      statusBarHeight: 24,
      safeArea: { bottom: 400 },
    };
    resize();
    expect(instance.data.panelStyle).toBe('height:293px;max-height:none;');
    windowInfo = { ...windowInfo, windowHeight: 1100 };
    resize();
    expect(instance.data.panelStyle).toBe('height:825px;max-height:none;');
    const styles = read(`${sheetPath}/index.wxss`);
    expect(styles).toMatch(
      /\.ui-sheet__panel\s*\{[^}]*height:\s*78vh;[^}]*max-height:\s*660px;[^}]*box-sizing:\s*border-box;/u,
    );
    expect(styles).toMatch(
      /\.ui-sheet__content\s*\{[^}]*padding:[^;]*env\(safe-area-inset-bottom\)/u,
    );
    expect(globalThis.wx.onWindowResize).toHaveBeenCalledTimes(1);
    definition.lifetimes.detached.call(instance);
    expect(globalThis.wx.offWindowResize).toHaveBeenCalledWith(resize);
    instance.setData.mockClear();
    resize();
    definition.observers['size, visible'].call(instance);
    expect(instance.setData).not.toHaveBeenCalled();
  });

  it('requires a paired resize API and never registers another listener on reopen', async () => {
    vi.stubGlobal('wx', { getWindowInfo: () => ({ windowHeight: 844 }), onWindowResize: vi.fn() });
    const { definition, instance } = await loadSheet({ size: 'half' });
    definition.observers['size, visible'].call(instance);
    expect(instance.setData).not.toHaveBeenCalled();
    definition.lifetimes.attached.call(instance);
    expect(globalThis.wx.onWindowResize).not.toHaveBeenCalled();
    for (const visible of [true, false, true]) {
      instance.properties.visible = visible;
      definition.observers['size, visible'].call(instance);
    }
    expect(instance.data.panelStyle).toBe('height:422px;max-height:none;');
    definition.lifetimes.detached.call(instance);
  });

  it('binds drag start only to header/handle and keeps content outside that region', () => {
    const template = read(`${sheetPath}/index.wxml`);
    expect(template).toContain('data-swipe-area="{{swipeArea}}"');
    expect(template).toContain('data-swipe-origin="handle"');
    expect(template).toContain('change:gesture-session="{{sheetGesture.reset}}"');
    const content = template.slice(template.indexOf('class="ui-sheet__content"'));
    expect(content).not.toMatch(/sheetGesture\.touch/u);
    expect(template).toMatch(/class="ui-sheet__layer"[^>]*catchtouchmove="preventTouchMove"/u);
  });

  it.each([
    ['header', 'header', true],
    ['header', 'handle', true],
    ['handle', 'handle', true],
    ['handle', 'header', false],
    ['handle', 'content', false],
  ])('accepts only a %s gesture beginning at %s', (area, origin, accepted) => {
    const record = { exports: {} };
    vm.runInNewContext(read(`${sheetPath}/drag-dismiss.wxs`), { module: record });
    const frames = [];
    const owner = {
      callMethod: vi.fn(),
      selectComponent: () => ({ setStyle: vi.fn() }),
      requestAnimationFrame: (callback) => frames.push(callback),
    };
    const event = (timeStamp, clientY, ending = false) => ({
      timeStamp,
      currentTarget: { dataset: { swipeDismiss: true, swipeArea: area } },
      target: { dataset: { swipeOrigin: origin } },
      [ending ? 'changedTouches' : 'touches']: [{ clientX: 80, clientY }],
    });
    record.exports.touchStart(event(0, 100), owner);
    record.exports.touchMove(event(160, 205), owner);
    record.exports.touchEnd(event(180, 205, true), owner);
    while (frames.length) frames.shift()();
    expect(owner.callMethod).toHaveBeenCalledTimes(accepted ? 1 : 0);
  });
});

describe('task A measured path lifecycle', () => {
  it('propagates workspace and mode visibility so initially hidden cards can remeasure', () => {
    const panel = read(`${panelPath}/index.wxml`);
    expect(panel).toContain("layoutActive: (!embedded || active) && directoryKind === 'internal'");
    expect(panel).toContain("layoutActive: (!embedded || active) && directoryKind === 'employee'");
    expect(panel.split('layout-active="{{layoutActive}}"')).toHaveLength(3);
    expect(read(`${cardPath}/index.wxml`)).toContain('layout-active="{{layoutActive}}"');
    expect(read(`${cardPath}/tail-path/index.ts`)).toContain("'value, largeText, layoutActive'");
  });
  it('recalculates for font/window changes and discards old measurements after replacement or detach', async () => {
    vi.resetModules();
    let definition;
    let resize;
    const ticks = [];
    const measurements = [];
    vi.stubGlobal('Component', (value) => {
      definition = value;
    });
    vi.stubGlobal('wx', {
      nextTick(callback) {
        expect(this).toBe(globalThis.wx);
        ticks.push(callback);
      },
      onWindowResize: vi.fn((handler) => {
        resize = handler;
      }),
      offWindowResize: vi.fn(),
    });
    await import('../src/subpackages/organization/components/directory-entry-card/tail-path/index.ts');
    const query = {
      select: vi.fn(() => query),
      selectAll: vi.fn(() => query),
      boundingClientRect: () => query,
      exec: (callback) => measurements.push(callback),
    };
    const full = '院区 › 一级 › 最终（东）';
    const instance = {
      properties: { value: full, largeText: false, layoutActive: true },
      data: structuredClone(definition.data),
      createSelectorQuery: () => query,
      setData: vi.fn(function (patch, callback) {
        Object.assign(this.data, patch);
        callback?.();
      }),
    };
    definition.observers['value, largeText, layoutActive'].call(instance);
    expect(instance.setData).not.toHaveBeenCalled();
    definition.lifetimes.attached.call(instance);
    definition.lifetimes.ready.call(instance);
    while (ticks.length) ticks.shift()();
    expect(measurements).toHaveLength(1);
    measurements.shift()([{ width: 160 }, [300, 220, 140, 100].map((width) => ({ width }))]);
    expect(instance.data.displayText).toBe('… › 最终（东）');
    expect(instance.properties.value).toBe(full);
    instance.properties.layoutActive = false;
    definition.observers['value, largeText, layoutActive'].call(instance);
    resize();
    expect(ticks).toHaveLength(0);
    expect(measurements).toHaveLength(0);
    instance.properties.layoutActive = true;
    definition.observers['value, largeText, layoutActive'].call(instance);
    while (ticks.length) ticks.shift()();
    measurements.shift()([{ width: 160 }, [300, 220, 140, 100].map((width) => ({ width }))]);
    expect(instance.data.displayText).toBe('… › 最终（东）');
    resize();
    while (ticks.length) ticks.shift()();
    measurements.shift()([{ width: 340 }, [300, 220, 140, 100].map((width) => ({ width }))]);
    expect(instance.data.displayText).toBe(full);
    instance.properties.largeText = true;
    definition.observers['value, largeText, layoutActive'].call(instance);
    while (ticks.length) ticks.shift()();
    measurements.shift()([{ width: 160 }, [500, 360, 230, 165].map((width) => ({ width }))]);
    expect(instance.data.displayText).toBe('最终（东）');
    resize();
    while (ticks.length) ticks.shift()();
    const stale = measurements.shift();
    instance.properties.value = '新院区 › 新科室';
    definition.observers['value, largeText, layoutActive'].call(instance);
    stale([{ width: 100 }, [300, 220, 140, 100].map((width) => ({ width }))]);
    expect(instance.data.displayText).toBe('新院区 › 新科室');
    while (ticks.length) ticks.shift()();
    const afterDetach = measurements.shift();
    definition.lifetimes.detached.call(instance);
    expect(globalThis.wx.onWindowResize).toHaveBeenCalledTimes(1);
    expect(globalThis.wx.offWindowResize).toHaveBeenCalledWith(resize);
    instance.setData.mockClear();
    afterDetach([{ width: 100 }, [300, 150, 80].map((width) => ({ width }))]);
    resize();
    definition.pageLifetimes.show.call(instance);
    expect(instance.setData).not.toHaveBeenCalled();
  });
});
