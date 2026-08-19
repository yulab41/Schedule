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
    const { createManualMatrixPocViewModel } =
      await import('../src/testing/fixtures/manual-matrix-poc.ts');
    const daily = createManualMatrixPocViewModel('daily');
    const maximum = createManualMatrixPocViewModel('maximum');

    expect(daily.rows).toHaveLength(7);
    expect(daily.columns).toHaveLength(7);
    expect(daily.logicalCellCount).toBe(49);
    expect(daily.rows.flatMap((row) => row.cells)).toHaveLength(49);
    expect(maximum.rows).toHaveLength(20);
    expect(maximum.columns).toHaveLength(30);
    expect(maximum.logicalCellCount).toBe(600);
    expect(maximum.rows.flatMap((row) => row.cells)).toHaveLength(600);
    expect(maximum.rows.at(-1)).toMatchObject({ isStale: true, realName: '宋护士' });
    expect(maximum.rows.at(-1)?.cells[7]).toMatchObject({ isStale: true });
    expect(daily.columns.slice(0, 2).map((column) => column.holidayLabel)).toEqual([
      '国庆节',
      '国庆节',
    ]);
  });

  it('registers a dedicated route and the hand-drawn schedule cell', () => {
    const appConfig = JSON.parse(readSource('app.json'));
    const pageConfig = JSON.parse(readSource('pages/manual-matrix-poc/index.json'));
    const cellConfig = JSON.parse(
      readSource('components/manual-schedule/manual-schedule-cell/index.json'),
    );

    expect(appConfig.pages).toContain('pages/manual-matrix-poc/index');
    expect(appConfig.rendererOptions.skyline.sdkVersionBegin).toBe('3.3.0');
    expect(pageConfig.usingComponents).toEqual({
      'manual-schedule-cell': '/components/manual-schedule/manual-schedule-cell/index',
    });
    expect(cellConfig).toMatchObject({ component: true });
  });

  it('uses UI-thread ScrollViewContext to synchronize the body and two header viewports', () => {
    const template = readSource('pages/manual-matrix-poc/index.wxml');
    const styles = readSource('pages/manual-matrix-poc/index.wxss');
    const source = readSource('pages/manual-matrix-poc/index.ts');
    const worklets = findWorkletIssues(source, 'pages/manual-matrix-poc/index.ts');

    expect(template.match(/<scroll-view/gu)).toHaveLength(3);
    expect(template).toMatch(
      /<scroll-view[\s\S]*?type="list"[\s\S]*?scroll-x[\s\S]*?scroll-y[\s\S]*?worklet:onscrollupdate="handleGridScroll"/u,
    );
    expect(template).not.toContain('bindscroll=');
    expect(template).not.toContain('<wxs');
    expect(template).toContain('wx:for="{{rows}}"');
    expect(template).toMatch(
      /<scroll-view[\s\S]*?id="matrix-date-scroll"[\s\S]*?scroll-x[\s\S]*?>/u,
    );
    expect(template).toMatch(
      /<scroll-view[\s\S]*?id="matrix-member-scroll"[\s\S]*?scroll-y[\s\S]*?>/u,
    );
    expect(template).toContain('<manual-schedule-cell');
    expect(template).not.toMatch(/<canvas/iu);
    expect(styles).toMatch(/\.matrix-corner\s*\{[^}]*position:\s*absolute;/su);
    expect(styles).toMatch(/\.matrix-date-overlay\s*\{[^}]*position:\s*absolute;/su);
    expect(styles).toMatch(/\.matrix-member-overlay\s*\{[^}]*position:\s*absolute;/su);
    expect(source).toContain("select('#matrix-date-scroll').ref(");
    expect(source).toContain("select('#matrix-member-scroll').ref(");
    expect(source).toContain('scrollViewContext.scrollTo(this._dateScrollRef.value');
    expect(source).toContain('scrollViewContext.scrollTo(this._memberScrollRef.value');
    expect(source).toContain('left: scrollLeft');
    expect(source).toContain('top: scrollTop');
    expect(source).not.toContain("applyAnimatedStyle('#matrix-date-track'");
    expect(source).not.toContain("applyAnimatedStyle('#matrix-member-track'");
    expect(worklets.issues).toEqual([]);
    expect(worklets.count).toBeGreaterThanOrEqual(3);
  });

  it('synchronizes both header scroll views on the UI thread without setData', async () => {
    let definition;
    const scrollTo = vi.fn();
    vi.stubGlobal('wx', {
      worklet: {
        runOnJS: (callback) => callback,
        scrollViewContext: { scrollTo },
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
    instance._dateScrollRef.value = 'date-ref';
    instance._memberScrollRef.value = 'member-ref';
    definition.handleGridScroll.call(instance, {
      detail: { scrollLeft: 216, scrollTop: 132, scrollWidth: 2264 },
    });

    expect(scrollTo).toHaveBeenNthCalledWith(1, 'date-ref', {
      animated: false,
      duration: 0,
      left: 216,
    });
    expect(scrollTo).toHaveBeenNthCalledWith(2, 'member-ref', {
      animated: false,
      duration: 0,
      top: 132,
    });
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
