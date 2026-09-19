import { readFileSync } from 'node:fs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function readSource(relativePath) {
  return readFileSync(new URL(`../src/${relativePath}`, import.meta.url), 'utf8');
}

describe('P1 native dynamic month calendar PoC', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('matches the Web month grid by rendering only the required five or six weeks', async () => {
    const { createCalendarPocViewModel } = await import('../src/testing/fixtures/calendar-poc.ts');
    const viewModel = createCalendarPocViewModel(0);
    const currentPanel = viewModel.panels.find((panel) => panel.relative === 0);

    expect(viewModel.monthLabel).toBe('2026年10月');
    expect(viewModel.selectedLabel).toBe('10月14日 · 周三');
    expect(viewModel.panels).toHaveLength(3);
    expect(viewModel.panels.map((panel) => panel.cells.length)).toEqual([35, 35, 42]);
    expect(viewModel.gridHeight).toBe(270);
    expect(currentPanel?.cells.at(0)?.businessDate).toBe('2026-09-28');
    expect(currentPanel?.cells.at(-1)?.businessDate).toBe('2026-11-01');
    expect(currentPanel?.cells[28]).toMatchObject({ isBottomLeft: true });
    expect(currentPanel?.cells.at(-1)).toMatchObject({ isBottomRight: true });
    expect(currentPanel?.cells.find((cell) => cell.businessDate === '2026-10-14')).toMatchObject({
      isCurrentMonth: true,
      isSelected: true,
      isToday: true,
    });
    expect(currentPanel?.cells.find((cell) => cell.businessDate === '2026-10-01')).toMatchObject({
      holiday: '国庆',
      isHoliday: true,
    });
    expect(currentPanel?.cells.some((cell) => cell.marker === '加')).toBe(true);
    expect(currentPanel?.cells.some((cell) => cell.marker === '换')).toBe(true);
    expect(currentPanel?.cells.some((cell) => !cell.isCurrentMonth)).toBe(true);
  });

  it('registers a dedicated calendar route and calendar components', () => {
    const appConfig = JSON.parse(readSource('app.json'));
    const pageConfig = JSON.parse(readSource('pages/calendar-poc/index.json'));
    const monthConfig = JSON.parse(readSource('components/calendar/calendar-month/index.json'));
    const cellConfig = JSON.parse(readSource('components/calendar/calendar-cell/index.json'));

    expect(appConfig.pages).toContain('pages/calendar-poc/index');
    expect(pageConfig.usingComponents).toEqual({
      'calendar-month': '/components/calendar/calendar-month/index',
    });
    expect(monthConfig).toMatchObject({
      component: true,
      usingComponents: {
        'calendar-cell': '/components/calendar/calendar-cell/index',
      },
    });
    expect(cellConfig.component).toBe(true);
  });

  it('keeps the Web bottom-corner selection treatment inside one 18px clipping frame', () => {
    const monthTemplate = readSource('components/calendar/calendar-month/index.wxml');
    const monthStyles = readSource('components/calendar/calendar-month/index.wxss');
    const cellStyles = readSource('components/calendar/calendar-cell/index.wxss');
    const pageTemplate = readSource('pages/calendar-poc/index.wxml');
    const pageStyles = readSource('pages/calendar-poc/index.wxss');

    expect(monthTemplate).toContain('wx:for="{{panels}}"');
    expect(monthTemplate).toContain('wx:for="{{panel.cells}}"');
    expect(monthTemplate).toContain('<calendar-cell');
    expect(monthStyles).toMatch(
      /\.month-card\s*\{[^}]*overflow:\s*hidden;[^}]*border-radius:\s*18px;/su,
    );
    expect(cellStyles).not.toMatch(/\.calendar-cell\s*\{[^}]*border-radius:/su);
    expect(cellStyles).toMatch(
      /\.calendar-cell\.is-bottom-left\s*\{[^}]*border-bottom-left-radius:\s*17px;/su,
    );
    expect(cellStyles).toMatch(
      /\.calendar-cell\.is-bottom-right\s*\{[^}]*border-bottom-right-radius:\s*17px;/su,
    );
    expect(monthTemplate).toContain("{{cell.isSelected ? 'is-selected' : ''}}");
    expect(monthStyles).toMatch(
      /\.weekday-row\s*\{[^}]*height:\s*28px;[^}]*box-sizing:\s*border-box;[^}]*border-bottom:\s*1px solid var\(--ui-color-border\);/su,
    );
    expect(monthStyles).toMatch(/\.month-grid\s*\{[^}]*overflow:\s*visible;/su);
    expect(monthStyles).not.toMatch(/\.month-grid\s*\{[^}]*border-top:/su);
    expect(monthStyles).toMatch(
      /\.calendar-cell-slot\.is-selected::after\s*\{[^}]*right:\s*-1px;[^}]*bottom:\s*-1px;[^}]*border:\s*2px solid var\(--ui-color-primary\);/su,
    );
    expect(monthStyles).not.toMatch(
      /\.calendar-cell-slot\.is-bottom-(?:left|right)\s*\{[^}]*overflow:\s*hidden;/su,
    );
    expect(cellStyles).not.toContain('.calendar-cell.is-selected::after');
    expect(pageTemplate).toContain('class="selected-summary month-selected-summary"');
    expect(pageStyles).toMatch(/\.month-selected-summary\s*\{[^}]*margin-top:\s*12px;/su);
  });

  it('starts one locked height transition when the native swiper commits its target', () => {
    const template = readSource('components/calendar/calendar-month/index.wxml');
    const source = readSource('components/calendar/calendar-month/index.ts');

    expect(template).toContain('<swiper');
    expect(template).toContain('current="{{swiperCurrent}}"');
    expect(template).toContain('style="height:{{viewportHeight}}px"');
    expect(template).toContain('bindchange="handleMonthChangeStart"');
    expect(template).toContain('bindanimationfinish="handleMonthSwipe"');
    expect(template).not.toContain('bindtransition=');
    expect(template).toContain('circular="{{true}}"');
    expect(template).toContain('<swiper-item');
    expect(template).toContain('wx:key="slot"');
    expect(template).not.toContain('<pan-gesture-handler');
    expect(template).toContain('/assets/icons/ui-chevron-left.svg');
    expect(template).toContain('/assets/icons/ui-chevron-right.svg');
    expect(template).toContain('/assets/icons/ui-locate.svg');
    const styles = readSource('components/calendar/calendar-month/index.wxss');
    expect(styles).toMatch(/transition:\s*height 240ms cubic-bezier\(0\.33, 1, 0\.68, 1\);/u);
    expect(styles).not.toContain('locate-crosshair::before');
    expect(source).not.toContain('handleMonthTransition');
    expect(source).toContain('panelHeights');
    expect(source).toContain('viewportHeight');
  });

  it('locks the committed swipe direction before animating height and only tracks later reports', async () => {
    let definition;
    vi.stubGlobal('Component', (value) => {
      definition = value;
    });
    await import('../src/components/calendar/calendar-month/index.ts');
    const instance = {
      _monthActiveSlot: 1,
      _monthPendingDelta: 0,
      _monthSwiperSlot: 1,
      _monthHeightTargetIndex: undefined,
      _monthShiftPending: false,
      data: {
        panelHeights: [324, 270, 324],
        swiperCurrent: 1,
        swiperDuration: 240,
        viewportHeight: 270,
      },
      setData: vi.fn((patch) => Object.assign(instance.data, patch)),
    };

    definition.methods.handleMonthChangeStart.call(instance, { detail: { current: 2 } });
    definition.methods.handleMonthChangeStart.call(instance, { detail: { current: 2 } });

    expect(instance._monthHeightTargetIndex).toBe(2);
    expect(instance.setData).toHaveBeenCalledOnce();
    expect(instance.setData).toHaveBeenCalledWith({ viewportHeight: 324 });

    // A different native report is tracked so its animation finish can still
    // commit, but it does not start a second height transition.
    definition.methods.handleMonthChangeStart.call(instance, { detail: { current: 0 } });
    expect(instance._monthHeightTargetIndex).toBe(0);
    expect(instance.setData).toHaveBeenCalledOnce();
  });

  it('commits one native circular swipe without ever moving back to the center slot', async () => {
    let definition;
    vi.stubGlobal('Component', (value) => {
      definition = value;
    });
    await import('../src/components/calendar/calendar-month/index.ts');
    const triggerEvent = vi.fn();
    const recenterPendingStates = [];
    const durationRestorePendingStates = [];
    const instance = {
      _monthActiveSlot: 1,
      _monthHeightTargetIndex: 2,
      _monthShiftPending: false,
      _queuedMonthDelta: 0,
      data: {
        panelHeights: [270, 324, 270],
        swiperCurrent: 1,
        swiperDuration: 240,
        viewportHeight: 270,
      },
      setData: vi.fn((patch, callback) => {
        Object.assign(instance.data, patch);
        if (patch.swiperCurrent === 1 && instance._monthActiveSlot !== 1) {
          recenterPendingStates.push(instance._monthShiftPending);
        }
        if (patch.swiperDuration === 0) {
          durationRestorePendingStates.push(instance._monthShiftPending);
        }
        callback?.();
      }),
      triggerEvent,
    };

    definition.methods.handleMonthSwipe.call(instance, { detail: { current: 2 } });
    definition.methods.handleMonthSwipe.call(instance, { detail: { current: 2 } });
    expect(triggerEvent).toHaveBeenCalledOnce();
    expect(triggerEvent).toHaveBeenCalledWith('monthchange', { current: 2, delta: 1 });

    expect(definition.observers.panels).toBeUndefined();
    definition.methods.finishPeriodShift.call(instance);
    expect(instance.data.swiperCurrent).toBe(2);
    expect(instance._monthActiveSlot).toBe(2);
    expect(recenterPendingStates).toEqual([]);
    expect(durationRestorePendingStates).toEqual([]);
    expect(instance._monthShiftPending).toBe(false);
    expect(instance._monthHeightTargetIndex).toBeUndefined();
    expect(triggerEvent).toHaveBeenLastCalledWith('monthsettled', { continues: false });
  });

  it('starts programmatic horizontal and height motion together and queues rapid taps', async () => {
    let definition;
    vi.stubGlobal('Component', (value) => {
      definition = value;
    });
    await import('../src/components/calendar/calendar-month/index.ts');
    const instance = {
      _monthActiveSlot: 1,
      _monthHeightTargetIndex: undefined,
      _monthShiftPending: false,
      _queuedMonthDelta: 0,
      data: {
        panelHeights: [324, 270, 324],
        swiperCurrent: 1,
        swiperDuration: 240,
        viewportHeight: 270,
      },
      setData: vi.fn((patch, callback) => {
        Object.assign(instance.data, patch);
        callback?.();
      }),
      triggerEvent: vi.fn(),
    };
    instance.startProgrammaticShift = (...args) =>
      definition.methods.startProgrammaticShift.call(instance, ...args);

    definition.methods.startProgrammaticShift.call(instance, 1, 306);
    definition.methods.startProgrammaticShift.call(instance, 1);

    expect(instance.setData).toHaveBeenNthCalledWith(1, { stepMotion: '' }, expect.any(Function));
    expect(instance.setData.mock.calls[1]?.[0]).toEqual({
      stepMotion: 'next',
      swiperCurrent: 2,
      swiperDuration: 240,
      viewportHeight: 306,
    });
    expect(instance.setData).toHaveBeenCalledTimes(2);
    expect(instance._monthHeightTargetIndex).toBe(2);
    expect(instance._queuedMonthDelta).toBe(1);

    definition.methods.handleMonthSwipe.call(instance, { detail: { current: 2 } });
    definition.methods.finishPeriodShift.call(instance);

    expect(instance._queuedMonthDelta).toBe(1);
    expect(instance._monthHeightTargetIndex).toBeUndefined();
    expect(instance.data.swiperCurrent).toBe(2);
    expect(instance.triggerEvent).toHaveBeenLastCalledWith('monthsettled', {
      continues: true,
    });

    definition.methods.continueQueuedShift.call(instance);
    expect(instance._queuedMonthDelta).toBe(0);
    expect(instance._monthHeightTargetIndex).toBe(0);
    expect(instance.data.swiperCurrent).toBe(0);
  });

  it('reads the rapid-tap queue when the circular slot settles', async () => {
    let definition;
    vi.stubGlobal('Component', (value) => {
      definition = value;
    });
    await import('../src/components/calendar/calendar-month/index.ts');
    const instance = {
      _monthActiveSlot: 2,
      _monthPendingDelta: 0,
      _monthSwiperSlot: 2,
      _monthHeightTargetIndex: 2,
      _monthShiftPending: true,
      _queuedMonthDelta: 0,
      data: {
        panelHeights: [270, 324, 270],
        swiperCurrent: 2,
        swiperDuration: 240,
        viewportHeight: 270,
      },
      setData: vi.fn((patch, callback) => {
        Object.assign(instance.data, patch);
        callback?.();
      }),
      triggerEvent: vi.fn(),
    };

    instance._queuedMonthDelta = 1;
    definition.methods.finishPeriodShift.call(instance);

    expect(instance.triggerEvent).toHaveBeenLastCalledWith('monthsettled', {
      continues: true,
    });
    expect(instance.setData).not.toHaveBeenCalled();
  });

  it('keeps adjacent cells inert and emits one semantic current-date selection', async () => {
    let definition;
    vi.stubGlobal('Component', (value) => {
      definition = value;
    });
    await import('../src/components/calendar/calendar-cell/index.ts');
    const triggerEvent = vi.fn();
    const instance = {
      properties: { businessDate: '2026-10-14', isCurrentMonth: true },
      triggerEvent,
    };

    definition.methods.handleSelect.call(instance);
    expect(triggerEvent).toHaveBeenCalledOnce();
    expect(triggerEvent).toHaveBeenCalledWith('select', { businessDate: '2026-10-14' });

    triggerEvent.mockClear();
    instance.properties.isCurrentMonth = false;
    definition.methods.handleSelect.call(instance);
    expect(triggerEvent).not.toHaveBeenCalled();
  });

  it('keeps every fast forward swipe moving forward while the previous month is still applying', async () => {
    let definition;
    vi.stubGlobal('Component', (value) => {
      definition = value;
    });
    await import('../src/components/calendar/calendar-month/index.ts');
    const events = [];
    const instance = {
      _monthActiveSlot: 1,
      _monthPendingDelta: 0,
      _monthSwiperSlot: 1,
      _monthHeightTargetIndex: undefined,
      _monthShiftPending: false,
      _queuedMonthDelta: 0,
      data: {
        panelHeights: [270, 270, 270],
        swiperCurrent: 1,
        swiperDuration: 240,
        viewportHeight: 270,
      },
      setData: vi.fn((patch, callback) => {
        Object.assign(instance.data, patch);
        callback?.();
      }),
      triggerEvent: vi.fn((name, detail) => events.push([name, detail])),
    };

    // Swipe 1 commits the next month; the page patch is still in flight.
    definition.methods.handleMonthChangeStart.call(instance, { detail: { current: 2 } });
    definition.methods.handleMonthSwipe.call(instance, { detail: { current: 2 } });
    expect(events).toEqual([['monthchange', { current: 2, delta: 1 }]]);
    expect(instance._monthShiftPending).toBe(true);

    // The user keeps swiping forward before that patch lands. Those gestures must
    // be queued, not dropped: dropping them left the ring anchor behind the
    // visible slot so the next commit reported a backward month.
    definition.methods.handleMonthChangeStart.call(instance, { detail: { current: 0 } });
    definition.methods.handleMonthSwipe.call(instance, { detail: { current: 0 } });
    definition.methods.handleMonthChangeStart.call(instance, { detail: { current: 1 } });
    definition.methods.handleMonthSwipe.call(instance, { detail: { current: 1 } });
    expect(events).toEqual([['monthchange', { current: 2, delta: 1 }]]);
    expect(instance._monthSwiperSlot).toBe(1);
    expect(instance._monthPendingDelta).toBe(2);
    expect(instance.data.swiperCurrent).toBe(1);

    // The first patch lands and the queued steps are adopted without animating
    // the swiper back to an already left slot.
    definition.methods.finishPeriodShift.call(instance);
    expect(events.at(-1)).toEqual(['monthchange', { current: 1, delta: 2 }]);
    expect(instance._monthActiveSlot).toBe(1);
    expect(instance._monthPendingDelta).toBe(0);

    definition.methods.finishPeriodShift.call(instance);
    expect(events.at(-1)).toEqual(['monthsettled', { continues: false }]);
    expect(instance._monthShiftPending).toBe(false);
    expect(events.filter(([, detail]) => detail?.delta !== undefined && detail.delta < 0)).toEqual(
      [],
    );
  });
});
