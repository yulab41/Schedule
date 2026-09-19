import { readFileSync } from 'node:fs';
import vm from 'node:vm';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function readSource(relativePath) {
  return readFileSync(new URL(`../src/${relativePath}`, import.meta.url), 'utf8');
}

function loadMatrixGestureHandlers() {
  const moduleRecord = { exports: {} };
  vm.runInNewContext(readSource('subpackages/scheduling/pages/manual/matrix-gesture.wxs'), {
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

describe('native manual scheduling matrix gesture', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds the approved 7 by 7 and 20 by 30 deterministic fixtures', async () => {
    const {
      createManualMatrixViewModel,
      MANUAL_MATRIX_HEADER_HEIGHT,
      MANUAL_MATRIX_ROW_HEIGHT,
      MANUAL_MATRIX_VISIBLE_ROWS,
    } = await import('./fixtures/manual-matrix.mjs');
    const daily = createManualMatrixViewModel('daily');
    const maximum = createManualMatrixViewModel('maximum');

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

    for (let frame = 0; frame < 120 && owner.frames.length > 0; frame += 1) {
      owner.frames.shift()();
    }
    expect(owner.frames).toHaveLength(0);
    for (const element of owner.elements.values()) {
      for (const [style] of element.setStyle.mock.calls) {
        expect(style.transform).not.toContain('NaN');
      }
    }
    expect(owner.callMethod).toHaveBeenLastCalledWith(
      'handleMatrixGestureSettled',
      expect.objectContaining({
        horizontalOffset: -300,
        progress: 1,
        verticalOffset: 0,
      }),
    );

    handlers.touchStart({ timeStamp: 100, touches: [{ clientX: 100, clientY: 180 }] }, owner);
    handlers.touchMove({ timeStamp: 116, touches: [{ clientX: 102, clientY: 130 }] }, owner);
    expect(owner.elements.get('#matrix-member-track').setStyle).toHaveBeenLastCalledWith({
      transform: 'translateY(-50px)',
    });
    expect(owner.elements.get('#matrix-body-track').setStyle).toHaveBeenLastCalledWith({
      transform: 'translate(-300px, -50px)',
    });
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
});
