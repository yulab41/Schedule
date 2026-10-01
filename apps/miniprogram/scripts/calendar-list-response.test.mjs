import { readFileSync, writeFileSync } from 'node:fs';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { calendarApiGoldenResponse, holidayApiGoldenResponse } from '@schedule/client-core/testing';
import { prepareDeferredListPanels } from '../src/features/workbench/deferred-list-rendering.ts';
import { createWorkbenchViewModel } from '../src/features/workbench/workbench-model.ts';
import * as nurse from '../src/features/workbench/nurse-duty-state.ts';
import { renderWxmlStructure } from './performance-budget.mjs';

beforeEach(() => {
  vi.stubGlobal('wx', {
    getWindowInfo: () => ({ windowHeight: 844, windowWidth: 390 }),
    getAppBaseInfo: () => ({ fontSizeSetting: 16 }),
    createIntersectionObserver: vi.fn(),
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function model(count = 20) {
  const member = calendarApiGoldenResponse.members[0];
  const source = calendarApiGoldenResponse.assignments[0];
  const calendar = {
    ...calendarApiGoldenResponse,
    members: [{ ...member, mobilePhone: '000' }],
    assignments: ['2026-08', '2026-09', '2026-10'].flatMap((month) =>
      Array.from({ length: 30 }, (_, day) =>
        Array.from({ length: count }, (_, slot) => ({
          ...source,
          id: `${month}-${day}-${slot}`,
          businessDate: `${month}-${String(day + 1).padStart(2, '0')}`,
          actualMembershipId: member.membershipId,
          shiftTypeName: 'A班',
          shiftTypeAbbreviation: 'A',
          slotPosition: slot,
        })),
      ).flat(),
    ),
  };
  return createWorkbenchViewModel(
    calendar,
    holidayApiGoldenResponse,
    '2026-09-21',
    '2026-09',
    '2026-09-21',
    undefined,
    '2026-09-21',
    { view: 'list', nursePreset: count === 20, now: new Date('2026-09-21T03:00:00Z') },
  );
}

function prepared(view) {
  const page = { data: { currentGroupId: 'synthetic' } };
  return prepareDeferredListPanels(view.listPanels, [], '', page);
}

it('does not transfer offscreen personnel just to preserve their height', () => {
  const view = model();
  const original = structuredClone(view.listPanels);
  const panels = prepared(view);
  for (const panel of panels) {
    const offscreen = panel.days.at(-1);
    expect(offscreen.renderDuties).toBe(false);
    expect(offscreen.duties).toEqual([]);
    expect(offscreen.placeholderHeight).toBe(62 + 20 * 61);
  }
  expect(view.listPanels).toEqual(original);
});

it('preserves mixed phone and no-phone row heights in a single day placeholder', () => {
  const view = model();
  view.listPanels[1].days.at(-1).duties[0].phone = '';
  const panels = prepared(view);
  expect(panels[1].days.at(-1).placeholderHeight).toBe(62 + 19 * 61 + 52);
});

it('prepares the whole first screen in each adjacent month without surplus nurse days', () => {
  const panels = prepared(model());
  for (const panel of panels) {
    expect(panel.days[0].renderDuties).toBe(true);
    expect(panel.days[0].duties.every((duty) => duty.phone === '000')).toBe(true);
    expect(panel.days[1].renderDuties).toBe(false);
  }
});

it('shares identical nurse state calculation across a day without changing duty output', () => {
  const state = vi.spyOn(nurse, 'getNurseDutyState');
  const view = model();
  expect(state).toHaveBeenCalledTimes(90);
  expect(view.listPanels[1].days[20].duties.every((duty) => duty.dutyState === 'working')).toBe(
    true,
  );
  expect(view.listPanels[1].days[0].duties.every((duty) => duty.dutyState === 'done')).toBe(true);
});

it.each(['workbench/index', 'guest/guest'])(
  '%s keeps the initial nurse tree below 1000 nodes and paints phones with their buttons',
  (route) => {
    const source = readFileSync(new URL(`../src/pages/${route}.wxml`, import.meta.url), 'utf8');
    const list =
      '<view class="list-calendar"' +
      source.split('<view class="list-calendar"')[1].split('</swiper>')[0] +
      '</swiper></view>';
    const measurements = [3, 20].map((count) => {
      const listPanels = prepared(model(count));
      const result = renderWxmlStructure(list, { listPanels });
      const bytes = Buffer.byteLength(JSON.stringify(listPanels));
      return { count, ...result, bytes };
    });
    if (process.env.SCHEDULE_LIST_STRUCTURE_OUTPUT)
      writeFileSync(
        `${process.env.SCHEDULE_LIST_STRUCTURE_OUTPUT}-${route.split('/')[0]}.json`,
        JSON.stringify(measurements, null, 2),
      );
    expect(measurements.find((value) => value.count === 20).nodeCount).toBeLessThan(1000);
    const action = list.split('class="list-call-action"')[1].split('</view>')[0];
    expect(action).not.toContain('<image');
    const css = readFileSync(new URL('../src/pages/workbench/index.wxss', import.meta.url), 'utf8');
    expect(css).toMatch(/\.list-call-action::before\s*\{[^}]*ui-phone-success\.svg/su);
  },
);
