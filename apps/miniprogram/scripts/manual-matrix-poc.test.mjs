import { readFileSync } from 'node:fs';
import vm from 'node:vm';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { findWorkletIssues } from './build-tools.mjs';

function readSource(relativePath) {
  return readFileSync(new URL(`../src/${relativePath}`, import.meta.url), 'utf8');
}

function applySetDataPatch(target, patch) {
  for (const [path, value] of Object.entries(patch)) {
    const match = /^rows\[(\d+)\]\.cells\[(\d+)\]$/u.exec(path);
    if (match === null) {
      target[path] = value;
      continue;
    }
    target.rows[Number(match[1])].cells[Number(match[2])] = value;
  }
}

function loadMatrixGestureHandlers() {
  const moduleRecord = { exports: {} };
  vm.runInNewContext(readSource('pages/manual-matrix-poc/matrix-gesture.wxs'), {
    module: moduleRecord,
  });
  return moduleRecord.exports;
}

function createWxsOwner() {
  const state = {};
  const frames = [];
  const createElements = () =>
    new Map(
      [
        '#matrix-scroll-thumb',
        '#matrix-date-track',
        '#matrix-body-track',
        '#matrix-member-track',
      ].map((selector) => [selector, { setStyle: vi.fn() }]),
    );
  let elements = createElements();
  return {
    callMethod: vi.fn(),
    get elements() {
      return elements;
    },
    frames,
    getState: () => state,
    replaceElements() {
      elements = createElements();
    },
    requestAnimationFrame(callback) {
      frames.push(callback);
    },
    selectComponent: (selector) => elements.get(selector),
  };
}

describe('P1 native manual scheduling matrix PoC', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds the approved 7 by 7 and 20 by 30 deterministic fixtures', async () => {
    const {
      createManualMatrixPocViewModel,
      MANUAL_MATRIX_HEADER_HEIGHT,
      MANUAL_MATRIX_ROW_HEIGHT,
      MANUAL_MATRIX_VISIBLE_ROWS,
    } = await import('../src/testing/fixtures/manual-matrix-poc.ts');
    const daily = createManualMatrixPocViewModel('daily');
    const maximum = createManualMatrixPocViewModel('maximum');

    expect(daily.rows).toHaveLength(7);
    expect(daily.columns).toHaveLength(7);
    expect(daily.logicalCellCount).toBe(49);
    expect(daily.matrixViewportHeight).toBe(390);
    expect(daily.matrixContentHeight).toBe(390);
    expect(daily.rows.flatMap((row) => row.cells)).toHaveLength(49);
    expect(maximum.rows).toHaveLength(20);
    expect(maximum.columns).toHaveLength(30);
    expect(maximum.logicalCellCount).toBe(600);
    expect(maximum.matrixContentHeight).toBe(962);
    expect(maximum.matrixViewportHeight).toBe(390);
    expect(maximum.rows.flatMap((row) => row.cells)).toHaveLength(600);
    expect(maximum.rows.at(-1)).toMatchObject({ isStale: true, realName: '宋护士' });
    expect(maximum.rows.at(-1)?.cells[7]).toMatchObject({ isStale: true });
    expect(daily.columns.slice(0, 2).map((column) => column.holidayLabel)).toEqual([
      '国庆节',
      '国庆节',
    ]);
    expect(MANUAL_MATRIX_VISIBLE_ROWS).toBe(7);
    expect(maximum.matrixViewportHeight).toBe(
      MANUAL_MATRIX_HEADER_HEIGHT + MANUAL_MATRIX_VISIBLE_ROWS * MANUAL_MATRIX_ROW_HEIGHT,
    );
  });

  it('registers a dedicated route and the hand-drawn schedule cell', () => {
    const appConfig = JSON.parse(readSource('app.json'));
    const pageConfig = JSON.parse(readSource('pages/manual-matrix-poc/index.json'));
    const cellConfig = JSON.parse(
      readSource('components/manual-schedule/manual-schedule-cell/index.json'),
    );

    expect(appConfig.pages).toContain('pages/manual-matrix-poc/index');
    expect(appConfig.rendererOptions.skyline.sdkVersionBegin).toBe('3.3.0');
    expect(pageConfig.disableScroll).toBe(true);
    expect(pageConfig.usingComponents).toEqual({
      'manual-schedule-cell': '/components/manual-schedule/manual-schedule-cell/index',
    });
    expect(cellConfig).toMatchObject({ component: true });
  });

  it('uses one plain-view WXS surface and four synchronized layers without native scrolling', () => {
    const template = readSource('pages/manual-matrix-poc/index.wxml');
    const styles = readSource('pages/manual-matrix-poc/index.wxss');
    const source = readSource('pages/manual-matrix-poc/index.ts');
    const wxsSource = readSource('pages/manual-matrix-poc/matrix-gesture.wxs');
    const worklets = findWorkletIssues(source, 'pages/manual-matrix-poc/index.ts');

    expect(template).not.toContain('<scroll-view');
    expect(template).toContain('<wxs module="matrixGesture" src="./matrix-gesture.wxs"></wxs>');
    expect(template).not.toContain('<pan-gesture-handler');
    expect(template).not.toContain('worklet:ongesture');
    expect(template).toMatch(/id="matrix-touch-surface"[\s\S]*?class="matrix-pan-surface"/u);
    expect(template).toContain('change:matrix-config="{{matrixGesture.configure}}"');
    expect(template).toContain('bindtouchstart="{{matrixGesture.touchStart}}"');
    expect(template).toContain('bindtouchmove="{{matrixGesture.touchMove}}"');
    expect(template).toContain('bindtouchend="{{matrixGesture.touchEnd}}"');
    expect(template).toContain('bindtouchcancel="{{matrixGesture.touchCancel}}"');
    expect(template).not.toContain('native-view=');
    expect(template).not.toContain('vertical-drag-gesture-handler');
    expect(template).not.toContain('horizontal-drag-gesture-handler');
    expect(template).not.toContain('simultaneous-handlers');
    expect(template).toContain('id="matrix-date-track"');
    expect(template).toContain('id="matrix-body-track"');
    expect(template).toContain('id="matrix-member-track"');
    expect(template).not.toContain('scroll-y');
    expect(template).toContain('wx:for="{{rows}}"');
    expect(template).toContain('class="matrix-date-content"');
    expect(template).toContain('height:{{matrixBodyViewportHeight}}px');
    expect(template).toContain('id="matrix-body-track"');
    expect(template).toContain('class="matrix-member-overlay"');
    expect(template).toContain('<manual-schedule-cell');
    expect(template).not.toMatch(/<canvas/iu);
    expect(styles).toMatch(/\.matrix-corner\s*\{[^}]*position:\s*absolute;/su);
    expect(styles).toMatch(/\.matrix-member-overlay\s*\{[^}]*position:\s*absolute;/su);
    expect(styles).toMatch(/\.matrix-pan-surface\s*\{[^}]*touch-action:\s*none;/su);
    expect(source).not.toContain('scrollViewContext.scrollTo');
    expect(source).not.toContain('applyAnimatedStyle');
    expect(source).not.toContain('wx.worklet');
    expect(source).not.toContain('handleMatrixPan');
    expect(source).toContain('handleMatrixGestureSettled');
    expect(source).toContain('matrixGestureConfig');
    expect(source).toContain('horizontalOffset');
    expect(source).toContain('syncRevision');
    expect(source).toContain('verticalOffset');
    expect(source).not.toContain('calculateAdaptiveMatrixViewportHeight');
    expect(source).not.toContain('wx.getWindowInfo');
    expect(wxsSource).toContain("selectComponent('#matrix-date-track')");
    expect(wxsSource).toContain("selectComponent('#matrix-body-track')");
    expect(wxsSource).toContain("selectComponent('#matrix-member-track')");
    expect(wxsSource).toContain("selectComponent('#matrix-scroll-thumb')");
    expect(wxsSource).toContain('requestAnimationFrame');
    expect(wxsSource).toContain("callMethod('handleMatrixGestureSettled'");
    expect(wxsSource).not.toContain('setData');
    expect(wxsSource).not.toMatch(/\b(?:Number|String)\s*\(/u);
    expect(wxsSource).not.toContain('.getState()');
    expect(wxsSource).not.toMatch(/state\.(?:bodyTrack|dateTrack|memberTrack|scrollThumb)\s*=/u);
    expect(worklets.issues).toEqual([]);
    expect(worklets.count).toBe(0);
  });

  it('keeps ambiguous movement still and moves each frozen layer on only its locked axis', () => {
    const handlers = loadMatrixGestureHandlers();
    const owner = createWxsOwner();
    handlers.configure(
      { maxHorizontalOffset: 300, maxVerticalOffset: 572, resetToken: 'maximum' },
      undefined,
      owner,
    );
    for (const element of owner.elements.values()) element.setStyle.mockClear();
    owner.callMethod.mockClear();

    handlers.touchStart({ timeStamp: 0, touches: [{ clientX: 180, clientY: 180 }] }, owner);
    expect(
      handlers.touchMove({ timeStamp: 16, touches: [{ clientX: 168, clientY: 168 }] }, owner),
    ).toBeUndefined();
    expect(owner.elements.get('#matrix-body-track').setStyle).not.toHaveBeenCalled();

    expect(
      handlers.touchMove({ timeStamp: 32, touches: [{ clientX: 140, clientY: 174 }] }, owner),
    ).toBe(false);
    expect(owner.elements.get('#matrix-date-track').setStyle).toHaveBeenLastCalledWith({
      transform: 'translateX(-40px)',
    });
    expect(owner.elements.get('#matrix-member-track').setStyle).toHaveBeenLastCalledWith({
      transform: 'translateY(0px)',
    });
    expect(owner.elements.get('#matrix-body-track').setStyle).toHaveBeenLastCalledWith({
      transform: 'translate(-40px, 0px)',
    });
    expect(owner.elements.get('#matrix-scroll-thumb').setStyle).toHaveBeenLastCalledWith({
      transform: 'translateX(4.8px)',
    });

    handlers.touchMove({ timeStamp: 48, touches: [{ clientX: 176, clientY: 110 }] }, owner);
    expect(owner.elements.get('#matrix-member-track').setStyle).toHaveBeenLastCalledWith({
      transform: 'translateY(0px)',
    });

    handlers.touchCancel({ timeStamp: 50 }, owner);
    handlers.touchStart({ timeStamp: 64, touches: [{ clientX: 180, clientY: 180 }] }, owner);
    handlers.touchMove({ timeStamp: 80, touches: [{ clientX: 182, clientY: 130 }] }, owner);
    expect(owner.elements.get('#matrix-date-track').setStyle).toHaveBeenLastCalledWith({
      transform: 'translateX(-4px)',
    });
    expect(owner.elements.get('#matrix-member-track').setStyle).toHaveBeenLastCalledWith({
      transform: 'translateY(-50px)',
    });
    expect(owner.elements.get('#matrix-body-track').setStyle).toHaveBeenLastCalledWith({
      transform: 'translate(-4px, -50px)',
    });
  });

  it('preserves taps and performs bounded view-layer inertia before reporting final progress', () => {
    const handlers = loadMatrixGestureHandlers();
    const owner = createWxsOwner();
    handlers.configure(
      { maxHorizontalOffset: 300, maxVerticalOffset: 572, resetToken: 'maximum' },
      undefined,
      owner,
    );
    owner.callMethod.mockClear();

    handlers.touchStart({ timeStamp: 0, touches: [{ clientX: 180, clientY: 180 }] }, owner);
    expect(
      handlers.touchEnd({ timeStamp: 20, changedTouches: [{ clientX: 180, clientY: 180 }] }, owner),
    ).toBeUndefined();
    expect(owner.callMethod).not.toHaveBeenCalled();

    handlers.touchStart({ timeStamp: 40, touches: [{ clientX: 180, clientY: 180 }] }, owner);
    handlers.touchMove({ timeStamp: 56, touches: [{ clientX: 140, clientY: 178 }] }, owner);
    handlers.touchMove({ timeStamp: 72, touches: [{ clientX: 100, clientY: 176 }] }, owner);
    expect(
      handlers.touchEnd({ timeStamp: 76, changedTouches: [{ clientX: 100, clientY: 176 }] }, owner),
    ).toBe(false);
    expect(owner.frames).toHaveLength(1);
    expect(owner.callMethod).not.toHaveBeenCalled();

    let frameTime = 88;
    for (let frame = 0; frame < 120 && owner.frames.length > 0; frame += 1) {
      owner.frames.shift()(frameTime);
      frameTime += 16;
    }
    expect(owner.frames).toHaveLength(0);
    expect(owner.callMethod).toHaveBeenLastCalledWith(
      'handleMatrixGestureSettled',
      expect.objectContaining({
        horizontalOffset: -300,
        progress: 1,
        verticalOffset: 0,
      }),
    );
  });

  it('cancels an in-flight WXS inertia frame when the next touch starts', () => {
    const handlers = loadMatrixGestureHandlers();
    const owner = createWxsOwner();
    handlers.configure(
      { maxHorizontalOffset: 300, maxVerticalOffset: 572, resetToken: 'maximum' },
      undefined,
      owner,
    );
    owner.callMethod.mockClear();

    handlers.touchStart({ timeStamp: 0, touches: [{ clientX: 180, clientY: 180 }] }, owner);
    handlers.touchMove({ timeStamp: 16, touches: [{ clientX: 100, clientY: 178 }] }, owner);
    handlers.touchEnd({ timeStamp: 20, changedTouches: [{ clientX: 100, clientY: 178 }] }, owner);
    const staleFrame = owner.frames.shift();
    expect(staleFrame).toEqual(expect.any(Function));

    handlers.touchStart({ timeStamp: 24, touches: [{ clientX: 100, clientY: 178 }] }, owner);
    staleFrame(36);

    expect(owner.frames).toHaveLength(0);
    expect(owner.callMethod).not.toHaveBeenCalled();
  });

  it('restores settled coordinates onto fresh render descriptors and supports another gesture', () => {
    const handlers = loadMatrixGestureHandlers();
    const owner = createWxsOwner();
    const initialConfig = {
      horizontalOffset: 0,
      maxHorizontalOffset: 300,
      maxVerticalOffset: 572,
      resetToken: 'maximum',
      syncRevision: 0,
      verticalOffset: 0,
    };
    handlers.configure(initialConfig, undefined, owner);
    owner.callMethod.mockClear();

    handlers.touchStart({ timeStamp: 0, touches: [{ clientX: 180, clientY: 180 }] }, owner);
    handlers.touchMove({ timeStamp: 16, touches: [{ clientX: 140, clientY: 178 }] }, owner);
    handlers.touchCancel({ timeStamp: 20 }, owner);
    expect(owner.callMethod).toHaveBeenLastCalledWith('handleMatrixGestureSettled', {
      horizontalOffset: -40,
      progress: 40 / 300,
      verticalOffset: 0,
    });

    owner.replaceElements();
    const settledConfig = {
      ...initialConfig,
      horizontalOffset: -40,
      syncRevision: 1,
    };
    handlers.configure(settledConfig, initialConfig, owner);
    expect(owner.elements.get('#matrix-date-track').setStyle).toHaveBeenLastCalledWith({
      transform: 'translateX(-40px)',
    });
    expect(owner.elements.get('#matrix-body-track').setStyle).toHaveBeenLastCalledWith({
      transform: 'translate(-40px, 0px)',
    });

    handlers.touchStart({ timeStamp: 24, touches: [{ clientX: 140, clientY: 178 }] }, owner);
    handlers.touchMove({ timeStamp: 40, touches: [{ clientX: 110, clientY: 176 }] }, owner);
    expect(owner.elements.get('#matrix-date-track').setStyle).toHaveBeenLastCalledWith({
      transform: 'translateX(-70px)',
    });
    expect(owner.elements.get('#matrix-body-track').setStyle).toHaveBeenLastCalledWith({
      transform: 'translate(-70px, 0px)',
    });
  });

  it('does not let a delayed render sync cancel a newer active touch', () => {
    const handlers = loadMatrixGestureHandlers();
    const owner = createWxsOwner();
    const initialConfig = {
      horizontalOffset: 0,
      maxHorizontalOffset: 300,
      maxVerticalOffset: 572,
      resetToken: 'maximum',
      syncRevision: 0,
      verticalOffset: 0,
    };
    handlers.configure(initialConfig, undefined, owner);
    handlers.touchStart({ timeStamp: 0, touches: [{ clientX: 180, clientY: 180 }] }, owner);
    handlers.touchMove({ timeStamp: 16, touches: [{ clientX: 140, clientY: 178 }] }, owner);

    handlers.configure(
      { ...initialConfig, horizontalOffset: -10, syncRevision: 1 },
      initialConfig,
      owner,
    );
    handlers.touchMove({ timeStamp: 32, touches: [{ clientX: 120, clientY: 176 }] }, owner);

    expect(owner.elements.get('#matrix-date-track').setStyle).toHaveBeenLastCalledWith({
      transform: 'translateX(-60px)',
    });
    expect(owner.elements.get('#matrix-body-track').setStyle).toHaveBeenLastCalledWith({
      transform: 'translate(-60px, 0px)',
    });
  });

  it('updates the accessible progress summary only after WXS reports a settled position', async () => {
    let definition;
    vi.stubGlobal('Page', (value) => {
      definition = value;
    });
    vi.stubGlobal('Component', vi.fn());
    await import('../src/pages/manual-matrix-poc/index.ts');
    const { createManualMatrixPocViewModel } =
      await import('../src/testing/fixtures/manual-matrix-poc.ts');
    const setData = vi.fn();
    const data = {
      ...createManualMatrixPocViewModel('maximum'),
      matrixGestureConfig: {
        horizontalOffset: 0,
        maxHorizontalOffset: 300,
        maxVerticalOffset: 572,
        resetToken: 'maximum',
        syncRevision: 0,
        verticalOffset: 0,
      },
    };
    const instance = {
      _matrixGestureRevision: 0,
      commitScrollProgress: definition.commitScrollProgress,
      data,
      setData,
    };

    definition.handleMatrixGestureSettled.call(instance, {
      horizontalOffset: -150,
      progress: 0.5,
      verticalOffset: -88,
    });

    expect(setData).toHaveBeenCalledOnce();
    expect(setData).toHaveBeenCalledWith({
      matrixGestureConfig: {
        horizontalOffset: -150,
        maxHorizontalOffset: 300,
        maxVerticalOffset: 572,
        resetToken: 'maximum',
        syncRevision: 1,
        verticalOffset: -88,
      },
      scrollHint: '左右滑动查看全部 30 天，人员列保持固定',
      scrollProgressOffset: 18,
      scrollProgressPercent: 50,
    });
  });

  it('loads the maximum fixture from an explicit route mode without a runtime environment switch', async () => {
    let definition;
    vi.stubGlobal('wx', {
      worklet: {
        runOnJS: (callback) => callback,
        shared: (value) => ({ value }),
      },
    });
    vi.stubGlobal('Page', (value) => {
      definition = value;
    });
    vi.stubGlobal('Component', vi.fn());
    await import('../src/pages/manual-matrix-poc/index.ts');
    const data = structuredClone(definition.data);
    const instance = {
      applyAnimatedStyle: vi.fn(),
      data,
      commitScrollProgress: definition.commitScrollProgress,
      setData(patch) {
        Object.assign(this.data, patch);
      },
    };

    definition.onLoad.call(instance, { mode: 'maximum' });

    expect(instance.data.mode).toBe('maximum');
    expect(instance.data.rows).toHaveLength(20);
    expect(instance.data.columns).toHaveLength(30);
    expect(instance.data.logicalCellCount).toBe(600);
    expect(instance._selectedLocation).toEqual({ columnIndex: 2, rowIndex: 1 });
    expect(instance._undoStack).toEqual([]);
  });

  it('updates only the selected cell paths and stores incremental key/before/after undo', async () => {
    let definition;
    vi.stubGlobal('wx', {
      worklet: {
        shared: (value) => ({ value }),
      },
    });
    vi.stubGlobal('Page', (value) => {
      definition = value;
    });
    vi.stubGlobal('Component', vi.fn());
    await import('../src/pages/manual-matrix-poc/index.ts');
    const data = structuredClone(definition.data);
    const patches = [];
    const instance = {
      _selectedLocation: { columnIndex: 2, rowIndex: 1 },
      _undoStack: [],
      data,
      setData(patch) {
        patches.push(patch);
        applySetDataPatch(this.data, patch);
      },
    };
    const target = data.rows[2].cells[4];

    definition.handleCellSelect.call(instance, {
      detail: {
        columnIndex: 4,
        key: target.key,
        rowIndex: 2,
      },
    });

    expect(Object.keys(patches[0]).sort()).toEqual([
      'canUndo',
      'rows[1].cells[2]',
      'rows[2].cells[4]',
    ]);
    expect(instance._undoStack).toHaveLength(1);
    expect(Object.keys(instance._undoStack[0]).sort()).toEqual(['after', 'before', 'key']);
    expect(instance._undoStack[0]).toMatchObject({
      after: { shiftTypeId: 'shift-a' },
      key: target.key,
    });
    expect(patches[0]['rows[2].cells[4]']).toMatchObject({
      isSelected: true,
      shiftTypeId: 'shift-a',
    });

    const undoEntry = instance._undoStack[0];
    patches.length = 0;
    definition.handleUndo.call(instance);
    expect(Object.keys(patches[0]).sort()).toEqual(['canUndo', 'rows[2].cells[4]']);
    expect(patches[0]['rows[2].cells[4]'].shiftTypeId).toBe(undoEntry.before.shiftTypeId);
    expect(instance._undoStack).toHaveLength(0);
  });
});
