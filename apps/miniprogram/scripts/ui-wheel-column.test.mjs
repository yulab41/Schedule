import { readFileSync } from 'node:fs';
import vm from 'node:vm';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function readSource(relativePath) {
  return readFileSync(new URL(`../src/${relativePath}`, import.meta.url), 'utf8');
}

function loadWheelHandlers() {
  const moduleRecord = { exports: {} };
  vm.runInNewContext(readSource('components/ui/ui-wheel-column/wheel-gesture.wxs'), {
    module: moduleRecord,
  });
  return moduleRecord.exports;
}

function createOwner(itemCount = 11) {
  const frames = [];
  const elements = new Map();
  elements.set('#ui-wheel-track', { setStyle: vi.fn() });
  for (let index = 0; index < itemCount; index += 1) {
    elements.set(`#ui-wheel-item-${index}`, { setStyle: vi.fn() });
    elements.set(`#ui-wheel-number-${index}`, { setStyle: vi.fn() });
  }
  return {
    callMethod: vi.fn(),
    elements,
    frames,
    requestAnimationFrame(callback) {
      frames.push(callback);
    },
    selectComponent(selector) {
      return elements.get(selector);
    },
  };
}

function wheelConfig(overrides = {}) {
  return {
    animateCommand: false,
    commandRevision: 1,
    generation: 1,
    itemCount: 11,
    runtimeKey: 'probe-year',
    selectedIndex: 5,
    ...overrides,
  };
}

function touchEvent({
  changed = false,
  clientX = 100,
  clientY,
  generation = 1,
  baseIndex,
  itemCount,
  runtimeKey = 'probe-year',
  timeStamp,
}) {
  const touch = { clientX, clientY };
  return {
    changedTouches: changed ? [touch] : [],
    currentTarget: { dataset: { baseIndex, generation, itemCount, runtimeKey } },
    timeStamp,
    touches: changed ? [] : [touch],
  };
}

function flushFrames(owner, maximum = 40) {
  let count = 0;
  while (owner.frames.length > 0 && count < maximum) {
    owner.frames.shift()();
    count += 1;
  }
  if (owner.frames.length > 0) throw new Error('wheel animation did not settle');
}

function lastTransform(node) {
  const call = node.setStyle.mock.calls.at(-1)?.[0];
  return call?.transform;
}

describe('native UiWheelColumn WXS candidate', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses one plain-view WXS owner with accessible 44px rows and transform-only motion', () => {
    const config = JSON.parse(readSource('components/ui/ui-wheel-column/index.json'));
    const template = readSource('components/ui/ui-wheel-column/index.wxml');
    const styles = readSource('components/ui/ui-wheel-column/index.wxss');
    const source = readSource('components/ui/ui-wheel-column/index.ts');
    const gesture = readSource('components/ui/ui-wheel-column/wheel-gesture.wxs');

    expect(config).toMatchObject({ component: true, styleIsolation: 'shared' });
    expect(template).toContain('<wxs module="wheelGesture" src="./wheel-gesture.wxs"></wxs>');
    expect(template).toContain('change:wheel-config="{{wheelGesture.configure}}"');
    // The affected runtime ignores `touch-action` for pan arbitration, so the
    // wheel claims start/move instead of letting an ancestor take the gesture.
    expect(template).toContain('catchtouchstart="{{wheelGesture.touchStart}}"');
    expect(template).toContain('catchtouchmove="{{wheelGesture.touchMove}}"');
    expect(template).toContain('bindtouchend="{{wheelGesture.touchEnd}}"');
    expect(template).toContain('bindtouchcancel="{{wheelGesture.touchCancel}}"');
    expect(template).toContain('id="ui-wheel-track"');
    // The WXS owns the pixel offset: no inline style may be re-applied on render.
    expect(template).not.toContain('wheelInitialOffset');
    expect(template).toContain('data-item-count="{{wheelConfig.itemCount}}"');
    expect(template).toContain('{{item.unit || unit}}');
    expect(template).toContain('data-base-index="{{wheelLayoutIndex}}"');
    expect(template).toContain('style="margin-top:{{wheelLayoutOffset}}px"');
    expect(gesture).toContain('seedStateFromDataset');
    expect(template).toContain('id="ui-wheel-item-{{index}}"');
    expect(template).toContain('id="ui-wheel-number-{{index}}"');
    expect(template).toContain('aria-role="listbox"');
    expect(template).toContain('aria-role="option"');
    expect(template).toContain('aria-selected="{{index === internalSelectedIndex}}"');
    expect(template).toContain('bindtap="handleItemTap"');
    expect(template).not.toContain('<scroll-view');
    expect(template).not.toContain('worklet:');
    expect(styles).toMatch(
      /\.ui-wheel-column\s*\{[^}]*height:\s*188px;[^}]*touch-action:\s*none;/su,
    );
    expect(styles).toMatch(/\.ui-wheel-spacer\s*\{[^}]*height:\s*72px;/su);
    expect(styles).toMatch(/\.ui-wheel-item\s*\{[^}]*height:\s*44px;[^}]*opacity:\s*0\.58;/su);
    expect(styles).toMatch(/\.ui-wheel-number\s*\{[^}]*font-size:\s*24px;/su);
    expect(source).not.toContain('wx.worklet');
    expect(source).not.toContain('setTimeout');
    expect(gesture).toContain('requestAnimationFrame');
    expect(gesture).toContain("callMethod('handleWheelPreview'");
    expect(gesture).toContain("callMethod('handleWheelSettled'");
    expect(gesture).toContain('setStyle');
    expect(gesture).not.toContain('setData');
    expect(gesture).not.toContain('setTimeout');
    expect(gesture).not.toContain('Math.pow');
    expect(gesture).not.toContain('.getState()');
  });

  it('validates generation and sequence before emitting preview and settle semantics', async () => {
    let definition;
    vi.stubGlobal('Component', (value) => {
      definition = value;
    });
    await import('../src/components/ui/ui-wheel-column/index.ts');

    const instance = {
      data: structuredClone(definition.data),
      properties: {
        animateCommand: false,
        ariaLabel: '年份滚轮',
        commandRevision: 1,
        generation: 4,
        items: Array.from({ length: 11 }, (_, index) => ({ label: String(2021 + index) })),
        runtimeKey: 'probe-year',
        selectedIndex: 5,
        unit: '年',
      },
      setData(patch) {
        Object.assign(this.data, patch);
      },
      triggerEvent: vi.fn(),
    };
    definition.lifetimes.attached.call(instance);
    expect(instance.data.wheelConfig).toMatchObject({
      generation: 4,
      itemCount: 11,
      runtimeKey: 'probe-year',
      selectedIndex: 5,
    });

    definition.methods.handleWheelPreview.call(instance, {
      generation: 4,
      index: 6,
      offset: -264,
      runtimeKey: 'probe-year',
      sequence: 1,
    });
    definition.methods.handleWheelPreview.call(instance, {
      generation: 4,
      index: 7,
      offset: -308,
      runtimeKey: 'probe-year',
      sequence: 1,
    });
    definition.methods.handleWheelPreview.call(instance, {
      generation: 3,
      index: 8,
      offset: -352,
      runtimeKey: 'probe-year',
      sequence: 2,
    });
    expect(instance.data.internalSelectedIndex).toBe(6);
    expect(instance.triggerEvent).toHaveBeenCalledTimes(1);
    expect(instance.triggerEvent).toHaveBeenCalledWith(
      'previewchange',
      expect.objectContaining({ generation: 4, index: 6, sequence: 1 }),
    );

    definition.methods.handleWheelSettled.call(instance, {
      generation: 4,
      index: 6,
      offset: -264,
      runtimeKey: 'probe-year',
      sequence: 2,
    });
    expect(instance.triggerEvent).toHaveBeenLastCalledWith(
      'settle',
      expect.objectContaining({ generation: 4, index: 6, sequence: 2 }),
    );

    definition.methods.handleItemTap.call(instance, { currentTarget: { dataset: { index: 7 } } });
    expect(instance.data.wheelConfig).toMatchObject({
      animateCommand: true,
      selectedIndex: 7,
    });
    expect(instance.data.wheelConfig.commandRevision).toBeGreaterThan(1);
    const localRevision = instance.data.wheelConfig.commandRevision;
    instance.properties.selectedIndex = 7;
    definition.observers[
      'items,selectedIndex,runtimeKey,generation,commandRevision,animateCommand'
    ].call(instance);
    expect(instance.data.wheelConfig.commandRevision).toBe(localRevision);
  });

  it('seeds its own baseline when the config observer never reaches the wheel', () => {
    const handlers = loadWheelHandlers();
    const owner = createOwner();
    const track = owner.elements.get('#ui-wheel-track');
    const dataset = { baseIndex: 6, itemCount: 11 };

    // No configure() call at all: the runtime dropped the config observer, so
    // the gesture has to derive its own base offset and item count. The template
    // places the base position, so the gesture paints only its delta.
    handlers.touchStart(touchEvent({ ...dataset, clientY: 400, timeStamp: 0 }), owner);
    expect(lastTransform(track)).toBe('translateY(0px)');

    handlers.touchMove(touchEvent({ ...dataset, clientY: 356, timeStamp: 16 }), owner);
    expect(lastTransform(track)).toBe('translateY(-44px)');
    expect(owner.callMethod).toHaveBeenCalledWith(
      'handleWheelPreview',
      expect.objectContaining({ index: 7, offset: -308 }),
    );
  });

  it('does not let a transient count shrink the wheel range', () => {
    const handlers = loadWheelHandlers();
    const owner = createOwner();
    const track = owner.elements.get('#ui-wheel-track');
    let timeStamp = 0;

    handlers.touchStart(
      touchEvent({ baseIndex: 5, clientY: 400, itemCount: 11, timeStamp }),
      owner,
    );
    // Slow drags keep the projected target on the row the finger reached.
    timeStamp += 200;
    // The host re-renders with a stale, much shorter list while the drag is live.
    handlers.touchMove(touchEvent({ baseIndex: 5, clientY: 356, itemCount: 3, timeStamp }), owner);
    timeStamp += 200;
    handlers.touchEnd(
      touchEvent({ baseIndex: 5, changed: true, clientY: 356, itemCount: 3, timeStamp }),
      owner,
    );
    flushFrames(owner);
    expect(owner.callMethod).toHaveBeenLastCalledWith(
      'handleWheelSettled',
      expect.objectContaining({ index: 6 }),
    );

    for (let step = 0; step < 6; step += 1) {
      handlers.touchStart(
        touchEvent({ baseIndex: 5, clientY: 400, itemCount: 3, timeStamp }),
        owner,
      );
      timeStamp += 200;
      handlers.touchMove(
        touchEvent({ baseIndex: 5, clientY: 356, itemCount: 3, timeStamp }),
        owner,
      );
      timeStamp += 200;
      handlers.touchEnd(
        touchEvent({ baseIndex: 5, changed: true, clientY: 356, itemCount: 3, timeStamp }),
        owner,
      );
      timeStamp += 200;
      flushFrames(owner);
    }

    // The full eleven-item range survives the stale render.
    expect(owner.callMethod).toHaveBeenLastCalledWith(
      'handleWheelSettled',
      expect.objectContaining({ index: 10, offset: -440 }),
    );
    expect(lastTransform(track)).toBe('translateY(-220px)');
  });

  it('keeps the whole range reachable from a dataset-seeded baseline', () => {
    const handlers = loadWheelHandlers();
    const owner = createOwner();
    const dataset = { baseIndex: 5, itemCount: 11 };
    let timeStamp = 0;

    const dragOneRow = () => {
      handlers.touchStart(touchEvent({ ...dataset, clientY: 400, timeStamp }), owner);
      timeStamp += 16;
      handlers.touchMove(touchEvent({ ...dataset, clientY: 356, timeStamp }), owner);
      timeStamp += 16;
      handlers.touchEnd(touchEvent({ ...dataset, changed: true, clientY: 356, timeStamp }), owner);
      timeStamp += 16;
      flushFrames(owner);
    };

    // Repeated drags must reach the last entry (index 10) instead of stopping early.
    for (let step = 0; step < 12; step += 1) dragOneRow();
    expect(owner.callMethod).toHaveBeenLastCalledWith(
      'handleWheelSettled',
      expect.objectContaining({ index: 10, offset: -440 }),
    );
    expect(lastTransform(owner.elements.get('#ui-wheel-track'))).toBe('translateY(-220px)');
  });

  it('re-seeds from the dataset when the host re-opens the wheel without the observer', () => {
    const handlers = loadWheelHandlers();
    const owner = createOwner();
    const track = owner.elements.get('#ui-wheel-track');

    handlers.touchStart(
      touchEvent({ baseIndex: 6, clientY: 400, itemCount: 11, timeStamp: 0 }),
      owner,
    );
    handlers.touchMove(
      touchEvent({ baseIndex: 6, clientY: 356, itemCount: 11, timeStamp: 16 }),
      owner,
    );
    expect(lastTransform(track)).toBe('translateY(-44px)');

    // Re-open: same runtime key, newer generation, still no config observer.
    handlers.touchStart(
      touchEvent({ baseIndex: 8, clientY: 400, generation: 2, itemCount: 11, timeStamp: 40 }),
      owner,
    );
    expect(lastTransform(track)).toBe('translateY(0px)');
    handlers.touchMove(
      touchEvent({ baseIndex: 8, clientY: 356, generation: 2, itemCount: 11, timeStamp: 56 }),
      owner,
    );
    expect(lastTransform(track)).toBe('translateY(-44px)');
    expect(owner.callMethod).toHaveBeenCalledWith(
      'handleWheelPreview',
      expect.objectContaining({ generation: 2, index: 9 }),
    );
  });

  it('tracks slow one-row down/up gestures and keeps exact visual endpoints', () => {
    const handlers = loadWheelHandlers();
    const owner = createOwner();
    handlers.configure(wheelConfig(), undefined, owner);

    // The template lays out the base position, so the gesture transform starts at 0.
    expect(lastTransform(owner.elements.get('#ui-wheel-track'))).toBe('translateY(0px)');
    expect(owner.elements.get('#ui-wheel-item-5').setStyle).toHaveBeenLastCalledWith(
      expect.objectContaining({ opacity: '1', transform: 'scale(1)' }),
    );
    expect(lastTransform(owner.elements.get('#ui-wheel-number-5'))).toBe('scale(1)');

    handlers.touchStart(touchEvent({ clientY: 100, timeStamp: 0 }), owner);
    handlers.touchMove(touchEvent({ clientY: 56, timeStamp: 100 }), owner);
    handlers.touchEnd(touchEvent({ changed: true, clientY: 56, timeStamp: 200 }), owner);
    flushFrames(owner);
    expect(owner.callMethod).toHaveBeenCalledWith(
      'handleWheelSettled',
      expect.objectContaining({ index: 6, offset: -264 }),
    );

    handlers.touchStart(touchEvent({ clientY: 56, timeStamp: 300 }), owner);
    handlers.touchMove(touchEvent({ clientY: 100, timeStamp: 400 }), owner);
    handlers.touchEnd(touchEvent({ changed: true, clientY: 100, timeStamp: 500 }), owner);
    flushFrames(owner);
    expect(owner.callMethod).toHaveBeenLastCalledWith(
      'handleWheelSettled',
      expect.objectContaining({ index: 5, offset: -220 }),
    );
    expect(lastTransform(owner.elements.get('#ui-wheel-track'))).toBe('translateY(0px)');
  });

  it('interpolates midpoint typography and keeps same-row pixel updates inside WXS', () => {
    const handlers = loadWheelHandlers();
    const owner = createOwner();
    handlers.configure(wheelConfig(), undefined, owner);
    owner.callMethod.mockClear();

    handlers.touchStart(touchEvent({ clientY: 100, timeStamp: 0 }), owner);
    for (let step = 1; step <= 100; step += 1) {
      handlers.touchMove(touchEvent({ clientY: 100 - step * 0.2, timeStamp: step }), owner);
    }
    expect(owner.callMethod).not.toHaveBeenCalled();

    handlers.touchMove(touchEvent({ clientY: 78, timeStamp: 120 }), owner);
    const currentStyle = owner.elements.get('#ui-wheel-item-5').setStyle.mock.calls.at(-1)[0];
    const nextStyle = owner.elements.get('#ui-wheel-item-6').setStyle.mock.calls.at(-1)[0];
    const currentNumberScale = Number(
      /scale\(([^)]+)\)/u.exec(lastTransform(owner.elements.get('#ui-wheel-number-5')))?.[1],
    );
    expect(Number(currentStyle.opacity)).toBeCloseTo(0.79);
    expect(Number(nextStyle.opacity)).toBeCloseTo(0.79);
    expect(currentStyle.transform).toBe('scale(0.97)');
    expect(nextStyle.transform).toBe('scale(0.97)');
    expect(currentNumberScale).toBeCloseTo(21.5 / 24);
  });

  it('resets stale inline row styles on generation changes and never accepts an older command', () => {
    const handlers = loadWheelHandlers();
    const owner = createOwner();
    handlers.configure(wheelConfig({ commandRevision: 2, selectedIndex: 5 }), undefined, owner);
    expect(lastTransform(owner.elements.get('#ui-wheel-item-5'))).toBe('scale(1)');

    handlers.configure(wheelConfig({ commandRevision: 1, selectedIndex: 0 }), undefined, owner);
    // An older command is ignored, so the wheel stays on its generation base.
    expect(lastTransform(owner.elements.get('#ui-wheel-track'))).toBe('translateY(0px)');

    handlers.configure(
      wheelConfig({ commandRevision: 1, generation: 2, selectedIndex: 2 }),
      undefined,
      owner,
    );
    expect(lastTransform(owner.elements.get('#ui-wheel-track'))).toBe('translateY(0px)');
    expect(owner.elements.get('#ui-wheel-item-5').setStyle).toHaveBeenLastCalledWith({
      opacity: '0.58',
      transform: 'scale(0.94)',
    });
    expect(lastTransform(owner.elements.get('#ui-wheel-number-5'))).toBe('scale(0.7916666667)');
  });

  it('projects a fast flick once and lets a reverse touch cancel the in-flight snap', () => {
    const handlers = loadWheelHandlers();
    const owner = createOwner();
    handlers.configure(wheelConfig(), undefined, owner);
    owner.callMethod.mockClear();

    handlers.touchStart(touchEvent({ clientY: 120, timeStamp: 0 }), owner);
    handlers.touchMove(touchEvent({ clientY: 40, timeStamp: 20 }), owner);
    handlers.touchEnd(touchEvent({ changed: true, clientY: 40, timeStamp: 21 }), owner);
    expect(owner.callMethod).toHaveBeenCalledWith(
      'handleWheelPreview',
      expect.objectContaining({ index: 10 }),
    );
    expect(owner.frames.length).toBeGreaterThan(0);
    owner.frames.shift()();
    const interruptedOffset = lastTransform(owner.elements.get('#ui-wheel-track'));

    handlers.touchStart(touchEvent({ clientY: 40, timeStamp: 30 }), owner);
    handlers.touchEnd(touchEvent({ changed: true, clientY: 40, timeStamp: 31 }), owner);
    flushFrames(owner);
    expect(owner.callMethod).toHaveBeenLastCalledWith(
      'handleWheelSettled',
      expect.objectContaining({ offset: expect.any(Number) }),
    );

    handlers.touchStart(touchEvent({ clientY: 40, timeStamp: 40 }), owner);
    handlers.touchMove(touchEvent({ clientY: 84, timeStamp: 130 }), owner);
    const reverseOffset = lastTransform(owner.elements.get('#ui-wheel-track'));
    expect(reverseOffset).not.toBe(interruptedOffset);
    const writeCount = owner.elements.get('#ui-wheel-track').setStyle.mock.calls.length;
    flushFrames(owner);
    expect(owner.elements.get('#ui-wheel-track').setStyle).toHaveBeenCalledTimes(writeCount);

    handlers.touchEnd(touchEvent({ changed: true, clientY: 84, timeStamp: 230 }), owner);
    flushFrames(owner);
    expect(owner.callMethod).toHaveBeenLastCalledWith(
      'handleWheelSettled',
      expect.objectContaining({ index: expect.any(Number) }),
    );
  });

  it('isolates runtime keys, ignores stale generations, and survives a render config during touch', () => {
    const handlers = loadWheelHandlers();
    const owner = createOwner();
    handlers.configure(wheelConfig({ runtimeKey: 'wheel-a', selectedIndex: 2 }), undefined, owner);
    handlers.configure(wheelConfig({ runtimeKey: 'wheel-b', selectedIndex: 8 }), undefined, owner);

    handlers.touchStart(touchEvent({ clientY: 100, runtimeKey: 'wheel-a', timeStamp: 0 }), owner);
    handlers.touchMove(touchEvent({ clientY: 144, runtimeKey: 'wheel-a', timeStamp: 100 }), owner);
    const activeOffset = lastTransform(owner.elements.get('#ui-wheel-track'));
    handlers.configure(wheelConfig({ runtimeKey: 'wheel-a', selectedIndex: 0 }), undefined, owner);
    expect(lastTransform(owner.elements.get('#ui-wheel-track'))).toBe(activeOffset);
    handlers.touchEnd(
      touchEvent({ changed: true, clientY: 144, runtimeKey: 'wheel-a', timeStamp: 200 }),
      owner,
    );
    flushFrames(owner);

    handlers.touchStart(touchEvent({ clientY: 100, runtimeKey: 'wheel-b', timeStamp: 300 }), owner);
    handlers.touchMove(touchEvent({ clientY: 144, runtimeKey: 'wheel-b', timeStamp: 400 }), owner);
    // wheel-b is based at index 8, so one row up is a +44px delta from that base.
    expect(lastTransform(owner.elements.get('#ui-wheel-track'))).toBe('translateY(44px)');

    const writes = owner.elements.get('#ui-wheel-track').setStyle.mock.calls.length;
    handlers.touchMove(
      touchEvent({ clientY: 188, generation: 0, runtimeKey: 'wheel-b', timeStamp: 500 }),
      owner,
    );
    expect(owner.elements.get('#ui-wheel-track').setStyle).toHaveBeenCalledTimes(writes);
  });
});
