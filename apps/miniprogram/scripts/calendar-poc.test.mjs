import { readFileSync } from 'node:fs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { findWorkletIssues } from './build-tools.mjs';

function readSource(relativePath) {
  return readFileSync(new URL(`../src/${relativePath}`, import.meta.url), 'utf8');
}

describe('P1 native 42-cell calendar PoC', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds three deterministic 42-cell panels with independent visual states', async () => {
    const { createCalendarPocViewModel } = await import('../src/testing/fixtures/calendar-poc.ts');
    const viewModel = createCalendarPocViewModel(0);
    const currentPanel = viewModel.panels.find((panel) => panel.relative === 0);

    expect(viewModel.monthLabel).toBe('2026年10月');
    expect(viewModel.selectedLabel).toBe('10月14日 · 周三');
    expect(viewModel.panels).toHaveLength(3);
    expect(viewModel.panels.map((panel) => panel.cells.length)).toEqual([42, 42, 42]);
    expect(currentPanel?.cells.at(0)?.businessDate).toBe('2026-09-28');
    expect(currentPanel?.cells.at(-1)?.businessDate).toBe('2026-11-08');
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

  it('keeps square cells inside one 18px clipping frame and a separate 12px detail surface', () => {
    const monthTemplate = readSource('components/calendar/calendar-month/index.wxml');
    const monthStyles = readSource('components/calendar/calendar-month/index.wxss');
    const cellStyles = readSource('components/calendar/calendar-cell/index.wxss');
    const pageTemplate = readSource('pages/calendar-poc/index.wxml');
    const pageStyles = readSource('pages/calendar-poc/index.wxss');

    expect(monthTemplate).toContain('wx:for="{{panels}}"');
    expect(monthTemplate).toContain('wx:for="{{item.cells}}"');
    expect(monthTemplate).toContain('<calendar-cell');
    expect(monthStyles).toMatch(
      /\.month-card\s*\{[^}]*overflow:\s*hidden;[^}]*border-radius:\s*18px;/su,
    );
    expect(cellStyles).not.toMatch(/\.calendar-cell\s*\{[^}]*border-radius:/su);
    expect(pageTemplate).toContain('class="selected-summary month-selected-summary"');
    expect(pageStyles).toMatch(/\.month-selected-summary\s*\{[^}]*margin-top:\s*12px;/su);
  });

  it('wires the three-panel track to UI-thread gesture worklets', () => {
    const template = readSource('components/calendar/calendar-month/index.wxml');
    const source = readSource('components/calendar/calendar-month/index.ts');
    const worklets = findWorkletIssues(source, 'calendar-month/index.ts');

    expect(template).toContain('<pan-gesture-handler');
    expect(template).toContain('worklet:ongesture="handleMonthPan"');
    expect(template).toContain('worklet:should-response-on-move="shouldRespondToMonthPan"');
    expect(source).toContain('applyAnimatedStyle');
    expect(source).toContain('runOnJS');
    expect(source).toContain('timing');
    expect(worklets.issues).toEqual([]);
    expect(worklets.count).toBeGreaterThanOrEqual(3);
  });

  it('locks vertical movement out and settles horizontal distance or velocity once', async () => {
    let definition;
    vi.stubGlobal('wx', {
      worklet: {
        Easing: { bezier: vi.fn(() => 'easing') },
        runOnJS: (callback) => callback,
        shared: (value) => ({ value }),
        timing: (target, _config, callback) => {
          callback?.(true);
          return target;
        },
      },
    });
    vi.stubGlobal('Component', (value) => {
      definition = value;
    });
    await import('../src/components/calendar/calendar-month/index.ts');
    const settleMonthPan = vi.fn();
    const instance = {
      _gestureX: { value: 0 },
      _translateX: { value: 0 },
      _viewportWidth: { value: 360 },
      settleMonthPan,
    };

    expect(definition.methods.shouldRespondToMonthPan({ deltaX: 12, deltaY: 3 })).toBe(true);
    expect(definition.methods.shouldRespondToMonthPan({ deltaX: 3, deltaY: 12 })).toBe(false);

    definition.methods.handleMonthPan.call(instance, {
      deltaX: 0,
      deltaY: 0,
      state: 1,
      velocityX: 0,
    });
    definition.methods.handleMonthPan.call(instance, {
      deltaX: -64,
      deltaY: 2,
      state: 2,
      velocityX: 0,
    });
    definition.methods.handleMonthPan.call(instance, {
      deltaX: 0,
      deltaY: 0,
      state: 3,
      velocityX: 0,
    });

    expect(instance._translateX.value).toBe(-64);
    expect(settleMonthPan).toHaveBeenCalledOnce();
    expect(settleMonthPan).toHaveBeenCalledWith(1);
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
});
