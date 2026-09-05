import { readFileSync } from 'node:fs';
import vm from 'node:vm';

import { describe, expect, it, vi } from 'vitest';

function readGesture() {
  return readFileSync(
    new URL('../src/components/ui/ui-sheet/drag-dismiss.wxs', import.meta.url),
    'utf8',
  );
}

describe('P10 directory filter-sheet drag dismissal', () => {
  it('tracks only a clear downward gesture, rebounds small motion and dismisses once', () => {
    const moduleRecord = { exports: {} };
    vm.runInNewContext(readGesture(), { module: moduleRecord });
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

    handlers.touchStart(touchEvent(0, 100), owner);
    handlers.touchMove(touchEvent(120, 130), owner);
    handlers.touchEnd(touchEndEvent(180, 130), owner);
    expect(panelSetStyle).toHaveBeenLastCalledWith(
      expect.objectContaining({ transform: 'translateY(0px)' }),
    );
    expect(callMethod).not.toHaveBeenCalled();

    handlers.touchStart(touchEvent(200, 100), owner);
    handlers.touchMove(touchEvent(360, 205), owner);
    handlers.touchEnd(touchEndEvent(380, 205), owner);
    flushAnimationFrames(animationFrames);
    expect(callMethod).toHaveBeenCalledTimes(1);
    expect(callMethod).toHaveBeenCalledWith('handleSwipeDismiss');
    expect(scrimSetStyle).toHaveBeenCalledWith(expect.objectContaining({ opacity: '0' }));
  });

  it('rejects horizontal and upward movement while keeping all motion out of setData', () => {
    const source = readGesture();
    const moduleRecord = { exports: {} };
    vm.runInNewContext(source, { module: moduleRecord });
    const handlers = moduleRecord.exports;
    const panelSetStyle = vi.fn();
    const callMethod = vi.fn();
    const owner = {
      callMethod,
      requestAnimationFrame: vi.fn(),
      selectComponent(selector) {
        return selector === '#ui-sheet-panel' ? { setStyle: panelSetStyle } : { setStyle: vi.fn() };
      },
    };

    handlers.touchStart(touchEvent(0, 100, 100), owner);
    handlers.touchMove(touchEvent(30, 104, 150), owner);
    handlers.touchEnd(touchEndEvent(40, 104, 150), owner);
    expect(callMethod).not.toHaveBeenCalled();

    handlers.touchStart(touchEvent(50, 120), owner);
    handlers.touchMove(touchEvent(90, 90), owner);
    handlers.touchEnd(touchEndEvent(100, 90), owner);
    expect(callMethod).not.toHaveBeenCalled();
    expect(source).toContain('var START_THRESHOLD = 8;');
    expect(source).toContain('var AXIS_RATIO = 1.2;');
    expect(source).toContain('var DISMISS_DISTANCE = 96;');
    expect(source).toContain('var FLICK_DISTANCE = 28;');
    expect(source).toContain('var FLICK_VELOCITY = 0.65;');
    expect(source).not.toContain('setData');
  });
});

function touchEvent(timeStamp, clientY, clientX = 100) {
  return {
    timeStamp,
    touches: [{ clientX, clientY }],
    currentTarget: { dataset: { swipeDismiss: true, swipeArea: 'handle' } },
    target: { dataset: { swipeOrigin: 'handle' } },
  };
}

function touchEndEvent(timeStamp, clientY, clientX = 100) {
  return { changedTouches: [{ clientX, clientY }], timeStamp };
}

function flushAnimationFrames(queue) {
  for (let index = 0; index < 24 && queue.length > 0; index += 1) queue.shift()();
}
