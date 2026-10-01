import { writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { calendarApiGoldenResponse, holidayApiGoldenResponse } from '@schedule/client-core/testing';

let definition;
const pages = [];
beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-21T03:00:00Z'));
  vi.stubGlobal('Page', (value) => {
    definition = value;
  });
  vi.stubGlobal('__MINIPROGRAM_API_BASE_URL__', 'https://example.test/api');
  vi.stubGlobal('__MINIPROGRAM_BUILD_COMMIT__', 'test');
  vi.stubGlobal('__MINIPROGRAM_BUILD_PROFILE__', 'production');
  vi.stubGlobal('__MINIPROGRAM_BUILD_VERSION__', 'test');
  vi.stubGlobal('wx', {
    getStorageSync: () => undefined,
    setStorageSync: vi.fn(),
    removeStorageSync: vi.fn(),
    getWindowInfo: () => ({ windowHeight: 844, windowWidth: 390 }),
    getAppBaseInfo: () => ({ fontSizeSetting: 16 }),
    createIntersectionObserver: () => {
      const observer = {
        disconnect: vi.fn(),
        relativeToViewport: () => observer,
        observe: vi.fn(),
      };
      return observer;
    },
    request: vi.fn(),
  });
});
afterEach(() => {
  for (const page of pages.splice(0)) page.onHide.call(page);
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function calendar(month, count) {
  const source = calendarApiGoldenResponse.assignments[0];
  const members = Array.from({ length: count }, (_, i) => ({
    ...calendarApiGoldenResponse.members[0],
    membershipId: `synthetic-${i}`,
    realName: `测试人员${i}`,
    mobilePhone: '000',
  }));
  return {
    ...calendarApiGoldenResponse,
    businessMonth: month,
    members,
    assignments: Array.from({ length: 30 }, (_, day) =>
      members.map((member, i) => ({
        ...source,
        id: `${month}-${day}-${i}`,
        businessDate: `${month}-${String(day + 1).padStart(2, '0')}`,
        plannedMembershipId: member.membershipId,
        actualMembershipId: member.membershipId,
        plannedMemberName: member.realName,
        actualMemberName: member.realName,
        slotPosition: i,
        shiftTypeName: count === 20 ? 'A班' : '早班',
        shiftTypeAbbreviation: count === 20 ? 'A' : '早',
      })),
    ).flat(),
  };
}

async function page(route, count = 20) {
  vi.resetModules();
  if (route === 'guest/guest') await import('../src/pages/guest/guest.ts');
  else await import('../src/pages/workbench/index.ts');
  const months = ['2026-07', '2026-08', '2026-09', '2026-10', '2026-11'].map((month) =>
    calendar(month, count),
  );
  const instance = {
    ...definition,
    data: structuredClone(definition.data),
    visible: true,
    isVisible: true,
    monthResources: new Map(months.map((month) => [month.businessMonth, month])),
    monthReads: new Map(),
    holidayResources: new Map([[2026, holidayApiGoldenResponse]]),
    holidayReads: new Map(),
    groupMonthShiftTypeId: calendarApiGoldenResponse.assignments[0].shiftTypeId,
    _groupMonthShiftTypeId: calendarApiGoldenResponse.assignments[0].shiftTypeId,
    calendar: { ...months[2], assignments: months.flatMap((month) => month.assignments) },
    holidays: holidayApiGoldenResponse,
    selectComponent: () => undefined,
    patches: [],
    blankViews: [],
    setData(patch, callback) {
      this.patches.push(structuredClone(patch));
      for (const [key, value] of Object.entries(patch)) {
        const segments = key.replace(/\[(\d+)\]/gu, '.$1').split('.');
        let target = this.data;
        for (const segment of segments.slice(0, -1)) target = target[segment];
        target[segments.at(-1)] = value;
      }
      if (
        this.data.state === 'ready' &&
        this.data.viewMode === 'list' &&
        this.data.listPanels.length === 0
      )
        this.blankViews.push(this.data.viewMode);
      callback?.();
    },
  };
  Object.assign(instance.data, {
    businessMonth: '2026-09',
    selectedDate: '2026-09-21',
    weekStart: '2026-09-21',
    currentGroupId: calendarApiGoldenResponse.groupId,
    currentGroupName: count === 20 ? '头颈外科护士' : '测试医生群',
    state: 'ready',
    viewMode: 'month',
  });
  pages.push(instance);
  return instance;
}
function switchView(instance, view) {
  instance.patches = [];
  const start = performance.now();
  instance.handleViewChange.call(instance, { currentTarget: { dataset: { view } } });
  return {
    handlerMs: performance.now() - start,
    patches: instance.patches.length,
    bridgeBytes: Buffer.byteLength(JSON.stringify(instance.patches)),
    blankViews: instance.blankViews.length,
  };
}

it('never exposes an empty populated guest list between bridge patches', async () => {
  const instance = await page('guest/guest');
  for (const view of ['list', 'month', 'list', 'week', 'list']) switchView(instance, view);
  expect(instance.data.listPanels[1].dutyCount).toBe(600);
  expect(instance.blankViews).toEqual([]);
  expect(globalThis.wx.request).not.toHaveBeenCalled();
});

it.each(['guest/guest', 'workbench/index'])(
  '%s reopens the same list without retransmitting its rows',
  async (route) => {
    const instance = await page(route);
    switchView(instance, 'list');
    switchView(instance, 'month');
    const repeated = switchView(instance, 'list');
    expect(repeated.bridgeBytes).toBeLessThan(5000);
    expect(instance.data.listPanels[1].dutyCount).toBe(600);
  },
);

it('records comparable synthetic switch costs without a wall-clock pass threshold', async () => {
  const results = [];
  for (const route of ['guest/guest', 'workbench/index']) {
    for (const count of [3, 20]) {
      const instance = await page(route, count);
      const first = switchView(instance, 'list');
      const samples = [];
      for (let i = 0; i < 12; i++) {
        switchView(instance, 'month');
        samples.push(switchView(instance, 'list'));
      }
      const sorted = samples.map((sample) => sample.handlerMs).sort((a, b) => a - b);
      results.push({
        route,
        count,
        first,
        repeated: { ...samples[0], medianMs: sorted[6], p95Ms: sorted[11] },
      });
    }
  }
  if (process.env.SCHEDULE_CALENDAR_AUDIT_OUTPUT)
    writeFileSync(process.env.SCHEDULE_CALENDAR_AUDIT_OUTPUT, JSON.stringify(results, null, 2));
  expect(results).toHaveLength(4);
});
