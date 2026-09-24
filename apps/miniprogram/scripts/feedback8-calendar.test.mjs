import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { describe, expect, it, vi } from 'vitest';
import {
  mergePreviewAssignments,
  previewCalendarModel,
} from '../src/subpackages/scheduling/components/schedule-calendar-preview/model.ts';

describe('feedback8 preview calendar', () => {
  it('keeps long non-calendar confirmations vertically scrollable', () => {
    const css = readFileSync(
      new URL('../src/subpackages/scheduling/pages/manual/index.wxss', import.meta.url),
      'utf8',
    ).replace(/@import[^;]+;/gu, '');
    const dom = new JSDOM(
      `<style>${css}</style><view class="release-dialog"><view class="workflow-impact-list">${'<text>受影响事件</text>'.repeat(
        30,
      )}</view><ui-checkbox>确认影响</ui-checkbox><view class="release-dialog-actions">继续</view></view>`,
    );
    try {
      const style = dom.window.getComputedStyle(
        dom.window.document.querySelector('.release-dialog'),
      );
      expect(style.overflowY || style.overflow).toBe('auto');
    } finally {
      dom.window.close();
    }
  });
  it('strikes every old shift on an overlapping date and leaves other dates alone', () => {
    const base = {
      businessDate: '2026-11-01',
      plannedMemberName: '原人员',
      shiftTypeAbbreviation: '全',
      shiftTypeName: '全天班',
      slotPosition: 1,
    };
    const assignments = mergePreviewAssignments(
      [{ ...base, plannedMemberName: '新人员' }],
      [base, { ...base, slotPosition: 2 }, { ...base, businessDate: '2026-11-02' }],
    );
    const result = previewCalendarModel(assignments, '2026-11', '', 1, true);
    const cells = result.panels[1].cells;
    const changed = cells
      .find((cell) => cell.businessDate === '2026-11-01')
      .duties.map(({ name, state }) => [name, state]);
    expect(changed).toHaveLength(3);
    expect(changed.filter(([, state]) => state === 'removed')).toHaveLength(2);
    expect(changed).toEqual(expect.arrayContaining([['新人员', 'added']]));
    expect(cells.find((cell) => cell.businessDate === '2026-11-02')).toMatchObject({
      disabled: true,
      duties: [{ name: '原人员', state: 'normal' }],
    });
  });
  it('locates a distant month with one swiper transition', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-24T04:00:00.000Z'));
    vi.resetModules();
    let definition;
    vi.stubGlobal('Component', (value) => {
      definition = value;
    });
    await import('../src/subpackages/scheduling/components/schedule-calendar-preview/index.ts');
    const shift = vi.fn();
    const instance = {
      ...definition.methods,
      properties: {
        assignments: [],
        startDate: '2026-01-01',
        compact: true,
        restrictToProposed: false,
        holidays: [],
      },
      data: structuredClone(definition.data),
      setData(patch, callback) {
        Object.assign(this.data, patch);
        callback?.();
      },
      triggerEvent: vi.fn(),
      selectComponent: () => ({
        finishPeriodShift() {},
        continueQueuedShift() {},
        startProgrammaticShift: shift,
      }),
    };
    try {
      definition.lifetimes.attached.call(instance);
      instance.handleLocate();
      expect(shift).toHaveBeenCalledTimes(1);
      instance.handleMonthChange({ detail: { delta: 1, current: 2 } });
      instance.handleMonthSettled();
      expect(instance.data.month).toBe('2026-09');
      expect(shift).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });
  it('resizes a six-row month to five rows and preserves the viewed month when data arrives', async () => {
    vi.resetModules();
    let definition;
    vi.stubGlobal('Component', (value) => {
      definition = value;
    });
    await import('../src/subpackages/scheduling/components/schedule-calendar-preview/index.ts');
    const instance = {
      ...definition.methods,
      properties: {
        assignments: [],
        startDate: '2026-11-01',
        compact: true,
        restrictToProposed: false,
      },
      data: structuredClone(definition.data),
      setData(patch, callback) {
        Object.assign(this.data, patch);
        callback?.();
      },
      triggerEvent: vi.fn(),
      selectComponent: () => ({ finishPeriodShift() {} }),
    };
    definition.lifetimes.attached.call(instance);
    const sixRows = instance.data.gridHeight;
    instance.handleMonthChange({ detail: { delta: 1, current: 2 } });
    expect(instance.data.gridHeight).toBeLessThan(sixRows);
    const height = instance.triggerEvent.mock.calls
      .filter(([event]) => event === 'heightchange')
      .at(-1)[1].height;
    expect(height).toBeGreaterThan(instance.data.gridHeight);
    definition.observers['assignments,restrictToProposed'].call(instance);
    expect(instance.data.month).toBe('2026-12');
    vi.unstubAllGlobals();
  });
  it('preserves proposed colors and uses a single-character colored shift badge', () => {
    const result = previewCalendarModel(
      [
        {
          businessDate: '2026-11-01',
          plannedMemberName: '测试成员',
          shiftTypeAbbreviation: '全天',
          shiftTypeName: '全天班',
          shiftTypeColor: '#267d70',
          shiftTypeTextColor: '#ffffff',
          slotPosition: 1,
          state: 'added',
        },
      ],
      '2026-11',
      '',
      1,
    );
    const cells = result.panels[1].cells;
    const duty = cells.find((cell) => cell.businessDate === '2026-11-01').duties[0];
    expect(duty).toMatchObject({ abbreviation: '全', state: 'added' });
    expect(duty.badgeStyle).toContain('#267d70');
    expect(cells.find((cell) => cell.businessDate === '2026-11-02').disabled).toBe(true);
  });
  it('renders existing comparison duties in tender gray while keeping the draft colored', () => {
    const assignments = mergePreviewAssignments(
      [
        {
          businessDate: '2026-11-01',
          plannedMemberName: '本次草稿',
          shiftTypeAbbreviation: '夜',
          shiftTypeName: '夜班',
          shiftTypeColor: '#267d70',
          shiftTypeTextColor: '#ffffff',
          slotPosition: 1,
        },
      ],
      [
        {
          businessDate: '2026-11-01',
          plannedMemberName: '已有排班',
          shiftTypeAbbreviation: '全',
          shiftTypeName: '全天班',
          shiftTypeColor: '#d12d45',
          shiftTypeTextColor: '#ffffff',
          slotPosition: 1,
        },
      ],
    );
    const duties = previewCalendarModel(assignments, '2026-11', '', 1).panels[1].cells.find(
      (cell) => cell.businessDate === '2026-11-01',
    ).duties;

    expect(duties[0]).toMatchObject({
      comparisonClass: 'is-existing-comparison',
      name: '已有排班',
      state: 'removed',
    });
    expect(duties[0].badgeStyle).toContain('background-color:#eef1f4');
    expect(duties[1]).toMatchObject({
      comparisonClass: 'is-current-draft',
      name: '本次草稿',
      state: 'added',
    });
    expect(duties[1].badgeStyle).toContain('#267d70');

    const template = readFileSync(
      new URL('../src/components/calendar/calendar-cell/index.wxml', import.meta.url),
      'utf8',
    );
    expect(template).toContain('{{item.comparisonClass}}');
    expect(template).not.toContain('已有 / 本次草稿');
  });
});
