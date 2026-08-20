import { readFileSync } from 'node:fs';

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

  it('uses one native scroll proxy so Android vertical movement does not depend on parent handoff', () => {
    const template = readSource('pages/manual-matrix-poc/index.wxml');
    const styles = readSource('pages/manual-matrix-poc/index.wxss');
    const source = readSource('pages/manual-matrix-poc/index.ts');
    const worklets = findWorkletIssues(source, 'pages/manual-matrix-poc/index.ts');

    expect(template.match(/<scroll-view/gu)).toHaveLength(1);
    expect(template).toMatch(
      /<pan-gesture-handler[\s\S]*?native-view="scroll-view"[\s\S]*?worklet:ongesture="handleMatrixPan"/u,
    );
    expect(template).not.toContain('vertical-drag-gesture-handler');
    expect(template).not.toContain('horizontal-drag-gesture-handler');
    expect(template).not.toContain('simultaneous-handlers');
    const panHandlerStart = template.indexOf('<pan-gesture-handler');
    const panHandlerEnd = template.indexOf('</pan-gesture-handler>', panHandlerStart);
    const memberOverlay = template.indexOf('class="matrix-member-overlay"');
    expect(panHandlerStart).toBeGreaterThanOrEqual(0);
    expect(memberOverlay).toBeGreaterThan(panHandlerStart);
    expect(memberOverlay).toBeLessThan(panHandlerEnd);
    expect(template).toMatch(
      /<scroll-view[\s\S]*?type="list"[\s\S]*?scroll-x[\s\S]*?worklet:onscrollupdate="handleGridScroll"/u,
    );
    expect(template.match(/class="matrix-scroll-content"/gu)).toHaveLength(1);
    expect(template).toMatch(
      /<scroll-view[\s\S]*?<view[\s\S]*?class="matrix-scroll-content"[\s\S]*?class="matrix-date-content"[\s\S]*?class="matrix-body-viewport"[\s\S]*?<\/view>[\s\S]*?<\/scroll-view>/u,
    );
    expect(template).toContain('bindscroll="handleGridScrollFallback"');
    expect(template).not.toContain('scroll-y');
    expect(template).not.toContain('<wxs');
    expect(template).toContain('wx:for="{{rows}}"');
    expect(template).toContain('class="matrix-date-content"');
    expect(template).toContain('height:{{matrixBodyViewportHeight}}px');
    expect(template).toContain('id="matrix-body-track"');
    expect(template).toContain('class="matrix-member-overlay"');
    expect(template).toContain('<manual-schedule-cell');
    expect(template).not.toMatch(/<canvas/iu);
    expect(styles).toMatch(/\.matrix-corner\s*\{[^}]*position:\s*absolute;/su);
    expect(styles).toMatch(/\.matrix-member-overlay\s*\{[^}]*position:\s*absolute;/su);
    expect(source).toContain('this._scrollProgress.value');
    expect(source).not.toContain('scrollViewContext.scrollTo');
    expect(source).not.toContain('_dateScrollRef');
    expect(source).not.toContain('_memberScrollRef');
    expect(source).toMatch(/this\.applyAnimatedStyle\(\s*['"]#matrix-scroll-thumb['"]/u);
    expect(source).toMatch(/this\.applyAnimatedStyle\(\s*['"]#matrix-body-track['"]/u);
    expect(source).toMatch(/this\.applyAnimatedStyle\(\s*['"]#matrix-member-track['"]/u);
    expect(source).not.toContain('calculateAdaptiveMatrixViewportHeight');
    expect(source).not.toContain('wx.getWindowInfo');
    expect(source).toContain('handleMatrixPan');
    expect(source).not.toContain('shouldMatrixNativeScrollRespond');
    expect(source).not.toContain('shouldHorizontalScrollRespond');
    expect(source).not.toContain('shouldVerticalDragRespond');
    expect(source).not.toContain('handleMatrixVerticalDrag');
    expect(source).not.toContain('handleMatrixHorizontalGesture');
    expect(source).toContain('this._maxVerticalOffset.value');
    expect(source).toContain('cancelAnimation(this._verticalOffset)');
    expect(source).toContain('decay({');
    expect(source).toContain('_gestureAxis');
    expect(source).not.toContain('_gestureDistanceX');
    expect(source).not.toContain('_gestureDistanceY');
    expect(worklets.issues).toEqual([]);
    expect(worklets.count).toBeGreaterThanOrEqual(5);
  });

  it('keeps ambiguous Android movement still and locks the first dominant axis until end', async () => {
    let definition;
    vi.stubGlobal('wx', {
      worklet: {
        cancelAnimation: vi.fn(),
        decay: vi.fn(),
        runOnJS: (callback) => callback,
        shared: (value) => ({ value }),
      },
    });
    vi.stubGlobal('Page', (value) => {
      definition = value;
    });
    vi.stubGlobal('Component', vi.fn());
    await import('../src/pages/manual-matrix-poc/index.ts');
    const instance = {
      applyAnimatedStyle: vi.fn(),
      commitScrollProgress: definition.commitScrollProgress,
      data: structuredClone(definition.data),
      setData: vi.fn(),
    };
    definition.onLoad.call(instance, { mode: 'maximum' });

    instance._maxVerticalOffset.value = 300;
    const active = (deltaX, deltaY) => ({ deltaX, deltaY, state: 2 });

    definition.handleMatrixPan.call(instance, { deltaX: 0, deltaY: 0, state: 0 });
    definition.handleMatrixPan.call(instance, active(0, 0));
    definition.handleMatrixPan.call(instance, active(12, 12));
    definition.handleMatrixPan.call(instance, active(12, 10));
    expect(instance._gestureAxis.value).toBe(0);
    expect(instance._verticalOffset.value).toBe(0);

    definition.handleMatrixPan.call(instance, active(18, 4));
    expect(instance._gestureAxis.value).toBe(1);
    definition.handleMatrixPan.call(instance, active(4, -18));
    expect(instance._gestureAxis.value).toBe(1);
    expect(instance._verticalOffset.value).toBe(0);

    definition.handleMatrixPan.call(instance, { deltaX: 0, deltaY: 0, state: 3 });
    definition.handleMatrixPan.call(instance, { deltaX: 0, deltaY: 0, state: 0 });
    definition.handleMatrixPan.call(instance, active(4, -18));
    expect(instance._gestureAxis.value).toBe(2);
    expect(instance._verticalOffset.value).toBe(-18);
    definition.handleMatrixPan.call(instance, active(18, 4));
    expect(instance._gestureAxis.value).toBe(2);
    expect(instance._verticalOffset.value).toBe(-14);
  });

  it('moves both vertical tracks from the single native proxy and one shared offset', async () => {
    let definition;
    const cancelAnimation = vi.fn();
    const decay = vi.fn(({ clamp, velocity }) => Math.max(clamp[0], Math.min(clamp[1], velocity)));
    vi.stubGlobal('wx', {
      worklet: {
        cancelAnimation,
        decay,
        runOnJS: (callback) => callback,
        shared: (value) => ({ value }),
      },
    });
    vi.stubGlobal('Page', (value) => {
      definition = value;
    });
    vi.stubGlobal('Component', vi.fn());
    await import('../src/pages/manual-matrix-poc/index.ts');
    const instance = {
      applyAnimatedStyle: vi.fn(),
      commitScrollProgress: definition.commitScrollProgress,
      data: structuredClone(definition.data),
      setData: vi.fn(),
    };
    definition.onLoad.call(instance, { mode: 'maximum' });
    instance._maxVerticalOffset.value = 300;

    definition.handleMatrixPan.call(instance, { state: 0, deltaX: 0, deltaY: 0 });
    definition.handleMatrixPan.call(instance, { state: 2, deltaX: 2, deltaY: -12 });

    expect(instance._verticalOffset.value).toBe(-12);

    definition.handleMatrixPan.call(instance, {
      state: 3,
      deltaX: 0,
      deltaY: 0,
      velocityY: -180,
    });
    expect(decay).toHaveBeenCalledWith(
      expect.objectContaining({ clamp: [-300, 0], velocity: -180 }),
    );

    definition.handleMatrixPan.call(instance, { state: 0, deltaX: 0, deltaY: 0 });
    definition.handleMatrixPan.call(instance, { state: 4, deltaX: 0, deltaY: 0 });

    expect(cancelAnimation).toHaveBeenCalledTimes(2);
    expect(instance.applyAnimatedStyle).toHaveBeenCalledWith(
      '#matrix-body-track',
      expect.any(Function),
      { flush: 'sync' },
    );
    expect(instance.applyAnimatedStyle).toHaveBeenCalledWith(
      '#matrix-member-track',
      expect.any(Function),
      { flush: 'sync' },
    );
  });

  it('keeps a logical-thread fallback for progress when UI callbacks are unavailable', async () => {
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

    const setData = vi.fn();
    const instance = {
      commitScrollProgress: definition.commitScrollProgress,
      data: structuredClone(definition.data),
      _lastScrollProgressPercent: -1,
      _viewportWidthValue: 360,
      setData,
    };

    definition.handleGridScrollFallback.call(instance, {
      detail: { scrollLeft: 216, scrollTop: 132, scrollWidth: 2264 },
    });

    expect(setData).toHaveBeenCalledWith(
      expect.objectContaining({
        scrollProgressOffset: expect.any(Number),
        scrollProgressPercent: expect.any(Number),
      }),
    );
  });

  it('updates the shared progress on the UI thread without setData', async () => {
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
    const setData = vi.fn();
    const instance = {
      commitScrollProgress: definition.commitScrollProgress,
      data: structuredClone(definition.data),
      applyAnimatedStyle: vi.fn(),
      setData,
    };
    definition.onLoad.call(instance, { mode: 'daily' });
    definition.handleGridScroll.call(instance, {
      detail: { scrollLeft: 216, scrollTop: 132, scrollWidth: 2264 },
    });

    expect(instance._scrollProgress.value).toBeGreaterThan(0);
    expect(setData).not.toHaveBeenCalled();
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
