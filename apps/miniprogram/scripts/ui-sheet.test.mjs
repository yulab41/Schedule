import { readFileSync } from 'node:fs';
import vm from 'node:vm';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function readSource(relativePath) {
  return readFileSync(new URL(`../src/${relativePath}`, import.meta.url), 'utf8');
}

describe('native UiSheet', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('exposes a controlled accessible sheet with a slot and title-only swipe region', () => {
    const config = JSON.parse(readSource('components/ui/ui-sheet/index.json'));
    const template = readSource('components/ui/ui-sheet/index.wxml');
    const styles = readSource('components/ui/ui-sheet/index.wxss');
    const gesture = readSource('components/ui/ui-sheet/drag-dismiss.wxs');

    expect(config).toMatchObject({ component: true, styleIsolation: 'shared' });
    expect(template).toContain('<wxs module="sheetGesture" src="./drag-dismiss.wxs"></wxs>');
    expect(template).toContain('wx:if="{{visible}}"');
    expect(template).toContain('id="ui-sheet-scrim"');
    expect(template).toContain('id="ui-sheet-panel"');
    expect(template).toContain('aria-role="dialog"');
    expect(template).toContain('aria-label="{{title}}"');
    expect(template).toContain('<slot></slot>');
    expect(template).toContain('class="ui-sheet__drag-region"');
    expect(template).toContain('bindtouchstart="{{sheetGesture.touchStart}}"');
    expect(template).toContain('bindtouchmove="{{sheetGesture.touchMove}}"');
    expect(template).not.toMatch(/class="ui-sheet__content"[^>]*bindtouchmove/u);
    expect(styles).toMatch(/\.ui-sheet__panel\s*\{[^}]*height:\s*78vh;[^}]*max-height:\s*660px;/su);
    expect(styles).toMatch(
      /\.ui-sheet__close\s*\{[^}]*min-width:\s*44px;[^}]*min-height:\s*44px;/su,
    );
    expect(styles).toContain('env(safe-area-inset-bottom)');
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
    expect(gesture).toContain('var DISMISS_DISTANCE = 96;');
    expect(gesture).toContain('var FLICK_DISTANCE = 28;');
    expect(gesture).toContain('var FLICK_VELOCITY = 0.65;');
    expect(gesture).not.toContain('setData');
  });

  it('emits one semantic close request for button, backdrop, and swipe sources', async () => {
    let definition;
    vi.stubGlobal('Component', (value) => {
      definition = value;
    });
    await import('../src/components/ui/ui-sheet/index.ts');
    const triggerEvent = vi.fn();
    const instance = { triggerEvent };

    definition.methods.handleButtonClose.call(instance);
    definition.methods.handleBackdropClose.call(instance);
    definition.methods.handleSwipeDismiss.call(instance);

    expect(triggerEvent.mock.calls).toEqual([
      ['close', { source: 'button' }],
      ['close', { source: 'backdrop' }],
      ['close', { source: 'swipe' }],
    ]);
  });

  it('tracks downward motion in WXS, rebounds short drags, and dismisses thresholds once', () => {
    const moduleRecord = { exports: {} };
    vm.runInNewContext(readSource('components/ui/ui-sheet/drag-dismiss.wxs'), {
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

    handlers.touchStart(touchEvent(0, 100, enabled), owner);
    handlers.touchMove(touchEvent(100, 140, enabled), owner);
    expect(panelSetStyle).toHaveBeenLastCalledWith(
      expect.objectContaining({ transform: 'translateY(40px)' }),
    );
    handlers.touchEnd(touchEndEvent(120, 140, enabled), owner);
    expect(panelSetStyle).toHaveBeenLastCalledWith(
      expect.objectContaining({ transform: 'translateY(0px)' }),
    );
    expect(callMethod).not.toHaveBeenCalled();

    handlers.touchStart(touchEvent(200, 100, enabled), owner);
    handlers.touchMove(touchEvent(360, 202, enabled), owner);
    handlers.touchEnd(touchEndEvent(380, 202, enabled), owner);
    flushAnimationFrames(animationFrames);
    expect(callMethod).toHaveBeenCalledTimes(1);
    expect(callMethod).toHaveBeenCalledWith('handleSwipeDismiss');
    expect(scrimSetStyle).toHaveBeenCalledWith(expect.objectContaining({ opacity: '0' }));
  });

  it('ignores horizontal/upward motion and supports fast-flick dismissal and cancellation', () => {
    const moduleRecord = { exports: {} };
    vm.runInNewContext(readSource('components/ui/ui-sheet/drag-dismiss.wxs'), {
      module: moduleRecord,
    });
    const handlers = moduleRecord.exports;
    const panelSetStyle = vi.fn();
    const callMethod = vi.fn();
    const animationFrames = [];
    const owner = {
      callMethod,
      requestAnimationFrame(callback) {
        animationFrames.push(callback);
      },
      selectComponent(selector) {
        return selector === '#ui-sheet-panel' ? { setStyle: panelSetStyle } : { setStyle: vi.fn() };
      },
    };
    const enabled = { currentTarget: { dataset: { swipeDismiss: true } } };

    handlers.touchStart(touchEvent(0, 100, enabled, 100), owner);
    handlers.touchMove(touchEvent(20, 104, enabled, 145), owner);
    handlers.touchEnd(touchEndEvent(30, 104, enabled, 145), owner);
    expect(callMethod).not.toHaveBeenCalled();

    handlers.touchStart(touchEvent(40, 100, enabled), owner);
    handlers.touchMove(touchEvent(60, 132, enabled), owner);
    handlers.touchEnd(touchEndEvent(64, 132, enabled), owner);
    flushAnimationFrames(animationFrames);
    expect(callMethod).toHaveBeenCalledTimes(1);

    callMethod.mockClear();
    handlers.touchStart(touchEvent(80, 100, enabled), owner);
    handlers.touchMove(touchEvent(120, 150, enabled), owner);
    handlers.touchCancel(touchEndEvent(124, 150, enabled), owner);
    expect(panelSetStyle).toHaveBeenLastCalledWith(
      expect.objectContaining({ transform: 'translateY(0px)' }),
    );
    expect(callMethod).not.toHaveBeenCalled();
  });
});

function touchEvent(timeStamp, clientY, base, clientX = 100) {
  return {
    ...base,
    timeStamp,
    touches: [{ clientX, clientY }],
  };
}

function touchEndEvent(timeStamp, clientY, base, clientX = 100) {
  return {
    ...base,
    changedTouches: [{ clientX, clientY }],
    timeStamp,
  };
}

function flushAnimationFrames(queue) {
  for (let index = 0; index < 24 && queue.length > 0; index += 1) {
    queue.shift()();
  }
}
