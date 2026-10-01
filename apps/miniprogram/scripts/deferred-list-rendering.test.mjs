import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  prepareDeferredListPanels,
  stopDeferredListRendering,
  syncDeferredListRendering,
} from '../src/features/workbench/deferred-list-rendering.ts';
let callback, observer;
beforeEach(() => {
  observer = {
    disconnect: vi.fn(),
    relativeToViewport: vi.fn(() => observer),
    observe: vi.fn((selector, fn) => {
      callback = fn;
    }),
  };
  vi.stubGlobal('wx', {
    createIntersectionObserver: vi.fn(() => observer),
    getWindowInfo: () => ({ windowHeight: 844, windowWidth: 390 }),
  });
});
afterEach(() => vi.unstubAllGlobals());
const panels = () => [
  {
    key: '2026-09',
    relative: 0,
    days: Array.from({ length: 30 }, (_, i) => ({
      businessDate: `2026-09-${String(i + 1).padStart(2, '0')}`,
      duties: [{ key: `duty-${i}`, phone: i % 2 ? '000' : '', name: '测试人员' }],
    })),
  },
];
function page() {
  const value = {
    data: {
      viewMode: 'list',
      state: 'ready',
      currentGroupId: 'synthetic',
      listPanels: prepareDeferredListPanels(panels(), []),
    },
    visible: true,
    setData: vi.fn(),
  };
  return value;
}
const intersection = (date = '2026-09-21', ratio = 1) => ({
  intersectionRatio: ratio,
  dataset: { panelKey: '2026-09', businessDate: date },
});
it('keeps every date, row, phone and order without mutating the input', () => {
  const input = panels();
  const before = structuredClone(input);
  const prepared = prepareDeferredListPanels(input, [], 'list-day-2026-09-21');
  expect(input).toEqual(before);
  expect(prepared[0].days.filter((x) => x.renderDuties).map((x) => x.businessDate)).toEqual([
    '2026-09-01',
    '2026-09-02',
    '2026-09-03',
    '2026-09-04',
    '2026-09-05',
    '2026-09-06',
    '2026-09-07',
    '2026-09-08',
    '2026-09-21',
  ]);
  expect(prepared[0].days.map((x) => x.duties)).toEqual(input[0].days.map((x) => x.duties));
  expect(prepareDeferredListPanels(input, prepared)[0].days[20].renderDuties).toBe(true);
});
it('reveals by stable panel/date with only a boolean bridge patch', async () => {
  const p = page();
  syncDeferredListRendering(p);
  callback(intersection(undefined, 0));
  expect(p.setData).not.toHaveBeenCalled();
  callback(intersection());
  await Promise.resolve();
  expect(p.setData).toHaveBeenCalledWith({ 'listPanels[0].days[20].renderDuties': true });
  p.data.listPanels[0].days[20].renderDuties = true;
  callback(intersection());
  await Promise.resolve();
  expect(p.setData).toHaveBeenCalledTimes(1);
  syncDeferredListRendering(p);
  expect(globalThis.wx.createIntersectionObserver).toHaveBeenCalledTimes(1);
  stopDeferredListRendering(p);
  expect(observer.disconnect).toHaveBeenCalledTimes(1);
});
it.each(['month', 'error', 'hidden', 'stopped', 'new-context'])(
  'rejects late observer callbacks after %s',
  (transition) => {
    const p = page();
    syncDeferredListRendering(p);
    const old = callback;
    if (transition === 'month') p.data.viewMode = 'month';
    else if (transition === 'error') p.data.state = 'error';
    else if (transition === 'hidden') p.visible = false;
    else if (transition === 'stopped') stopDeferredListRendering(p);
    else {
      p.data.currentGroupId = 'new';
      syncDeferredListRendering(p);
    }
    old(intersection());
    expect(p.setData).not.toHaveBeenCalled();
    stopDeferredListRendering(p);
  },
);
it('renders all content when the observer is absent or fails', () => {
  const p = page();
  globalThis.wx.createIntersectionObserver = undefined;
  expect(prepareDeferredListPanels(panels(), [])[0].days.every((x) => x.renderDuties)).toBe(true);
  globalThis.wx.createIntersectionObserver = () => {
    throw new Error('platform failure');
  };
  syncDeferredListRendering(p);
  expect(Object.keys(p.setData.mock.calls[0][0])).toHaveLength(22);
});

it('does not reveal a replacement group before its render callback settles', () => {
  const p = page();
  syncDeferredListRendering(p);
  p.data.currentGroupId = 'replacement';
  callback(intersection());
  expect(p.setData).not.toHaveBeenCalled();
  stopDeferredListRendering(p);
});

it('keeps natural full rows for large text instead of assuming phone-height placeholders', () => {
  globalThis.wx.getAppBaseInfo = () => ({ fontSizeSetting: 20 });
  expect(prepareDeferredListPanels(panels(), [])[0].days.every((x) => x.renderDuties)).toBe(true);
});

it('sends only row keys and phone-height flags for offscreen data, then restores full contacts atomically', async () => {
  const p = page();
  const input = panels();
  const before = structuredClone(input);
  p.data.listPanels = prepareDeferredListPanels(input, [], '', p);
  const offscreen = p.data.listPanels[0].days[20];
  expect(offscreen.duties).toEqual([{ key: 'duty-20', phone: false }]);
  expect(input).toEqual(before);
  syncDeferredListRendering(p);
  callback(intersection());
  await Promise.resolve();
  expect(p.setData).toHaveBeenCalledWith({
    'listPanels[0].days[20].duties': input[0].days[20].duties,
    'listPanels[0].days[20].renderDuties': true,
  });
  stopDeferredListRendering(p);
});

it('fills the initial active viewport and batches duplicate visibility callbacks', async () => {
  const p = page();
  p.data.listPanels = prepareDeferredListPanels(panels(), [], '', p);
  expect(p.data.listPanels[0].days.slice(0, 8).every((day) => day.renderDuties)).toBe(true);
  syncDeferredListRendering(p);
  expect(observer.relativeToViewport).toHaveBeenCalledWith({
    top: 844,
    bottom: 844,
    left: 0,
    right: 0,
  });
  callback(intersection('2026-09-20'));
  callback(intersection('2026-09-21'));
  callback(intersection('2026-09-21'));
  expect(p.setData).not.toHaveBeenCalled();
  await Promise.resolve();
  expect(p.setData).toHaveBeenCalledTimes(1);
  expect(p.setData.mock.calls[0][0]['listPanels[0].days[19].duties']).toEqual(
    panels()[0].days[19].duties,
  );
  stopDeferredListRendering(p);
});

it.each(['hide', 'stop', 'group', 'view', 'workspace'])(
  'rejects queued hydration after %s before the bridge flush',
  async (change) => {
    const p = page();
    p.data.listPanels = prepareDeferredListPanels(panels(), [], '', p);
    syncDeferredListRendering(p);
    callback(intersection());
    if (change === 'hide') p.visible = false;
    else if (change === 'stop') stopDeferredListRendering(p);
    else if (change === 'group') p.data.currentGroupId = 'replacement';
    else if (change === 'view') p.data.viewMode = 'month';
    else p.data.activeWorkspace = 'profile';
    await Promise.resolve();
    expect(p.setData).not.toHaveBeenCalled();
    stopDeferredListRendering(p);
  },
);

it('uses the latest filtered source when an old visibility notification is queued', async () => {
  const p = page();
  p.data.listPanels = prepareDeferredListPanels(panels(), [], '', p);
  syncDeferredListRendering(p);
  callback(intersection());
  const updated = panels();
  updated[0].days[20].duties = [{ key: 'filtered', name: '更新测试', phone: '000' }];
  p.data.listPanels = prepareDeferredListPanels(updated, [], '', p);
  await Promise.resolve();
  expect(p.setData.mock.calls[0][0]['listPanels[0].days[20].duties']).toEqual(
    updated[0].days[20].duties,
  );
  stopDeferredListRendering(p);
});

it('restores every deferred field when observer initialization fails', () => {
  const p = page();
  const input = panels();
  p.data.listPanels = prepareDeferredListPanels(input, [], '', p);
  globalThis.wx.createIntersectionObserver = () => {
    throw new Error('platform failure');
  };
  syncDeferredListRendering(p);
  expect(p.setData.mock.calls[0][0]['listPanels[0].days[20].duties']).toEqual(
    input[0].days[20].duties,
  );
  expect(p.setData.mock.calls[0][0]['listPanels[0].days[20].renderDuties']).toBe(true);
});
