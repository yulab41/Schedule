import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { describe, expect, it, vi } from 'vitest';
import { calendarShiftBadge } from '../src/components/calendar/calendar-duty-view.ts';
import {
  mergePreviewAssignments,
  previewCalendarModel,
  previewWeekModel,
  previewWeekPanels,
} from '../src/subpackages/scheduling/components/schedule-calendar-preview/model.ts';

describe('feedback8 preview calendar', () => {
  it('uses the home-calendar abbreviations for nurse shifts in backfill and preview', () => {
    for (const abbreviation of ['N', 'NP', 'A', 'D', '电脑']) {
      expect(calendarShiftBadge(abbreviation, `${abbreviation}班`).abbreviation).toBe(abbreviation);
    }
  });
  it('uses the same calendar pager and cells for month and week previews', () => {
    const wxml = readFileSync(
      new URL(
        '../src/subpackages/scheduling/components/schedule-calendar-preview/index.wxml',
        import.meta.url,
      ),
      'utf8',
    );
    expect(wxml).toContain('<calendar-month');
    expect(
      readFileSync(
        new URL('../src/components/calendar/calendar-month/index.wxml', import.meta.url),
        'utf8',
      ),
    ).toContain('<calendar-week-panel');
    expect(
      readFileSync(new URL('../src/pages/workbench/index.wxml', import.meta.url), 'utf8'),
    ).toContain('<view class="week-day-grid">');
    expect(wxml).not.toContain('preview-week-grid');
  });
  it('groups and orders nurse duties in the shared weekly renderer', () => {
    const assignments = ['NP', 'N', 'A', '电脑', 'D', 'P'].map((code, index) => ({
      businessDate: '2026-10-01',
      plannedMemberName: `长姓名测试${index}`,
      shiftTypeId: code,
      shiftTypeAbbreviation: code,
      shiftTypeName: `${code}班`,
      shiftTypeColor: '#2368aa',
      slotPosition: index,
    }));
    const week = previewWeekPanels(assignments, '2026-09-28', '', 1, false, [], {
      nursePreset: true,
      shiftTypeOrder: ['NP', 'N', 'A', '电脑', 'D', 'P'],
    });
    const day = week.panels[1].days.find((item) => item.businessDate === '2026-10-01');
    expect(day.shiftGroups.map((group) => group.abbreviation)).toEqual([
      '电脑',
      'D',
      'A',
      'P',
      'N',
      'NP',
    ]);
    expect(day.shiftGroups[0].tint).toMatch(/^rgba\(/u);
    expect(week.gridHeight).toBeGreaterThan(250);
  });
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
    definition.observers['assignments,restrictToProposed,viewMode,groupName,shiftTypes'].call(
      instance,
    );
    expect(instance.data.month).toBe('2026-12');
    vi.unstubAllGlobals();
  });
  it('shows the starting week across months and retains day details while browsing', async () => {
    const assignments = [
      {
        businessDate: '2026-12-01',
        plannedMemberName: '周班人员',
        shiftTypeAbbreviation: '全',
        shiftTypeName: '全天班',
        slotPosition: 1,
      },
    ];
    const week = previewWeekModel(assignments, '2026-11-30', '2026-12-01');
    expect(week.days).toHaveLength(7);
    expect(week.days.map((day) => day.businessDate)).toEqual([
      '2026-11-30',
      '2026-12-01',
      '2026-12-02',
      '2026-12-03',
      '2026-12-04',
      '2026-12-05',
      '2026-12-06',
    ]);
    expect(week.days[1].duties[0].name).toBe('周班人员');
    expect(week.details[0].label).toContain('周班人员');
    let definition;
    vi.stubGlobal('Component', (value) => {
      definition = value;
    });
    vi.resetModules();
    await import('../src/subpackages/scheduling/components/schedule-calendar-preview/index.ts');
    const instance = {
      ...definition.methods,
      properties: {
        assignments,
        startDate: '2026-12-01',
        compact: true,
        restrictToProposed: false,
        holidays: [],
        viewMode: 'week',
      },
      data: structuredClone(definition.data),
      setData(patch, callback) {
        Object.assign(this.data, patch);
        callback?.();
      },
      triggerEvent: vi.fn(),
      selectComponent: () => ({ finishPeriodShift() {}, continueQueuedShift() {} }),
    };
    definition.lifetimes.attached.call(instance);
    expect(instance.data.weekStart).toBe('2026-11-30');
    expect(instance.data.panels[1].cells).toHaveLength(7);
    instance.handleSelect({ detail: { businessDate: '2026-12-01' } });
    expect(instance.data.details[0].label).toContain('周班人员');
    instance.handleMonthChange({ detail: { delta: 1, current: 2 } });
    expect(instance.data.weekStart).toBe('2026-12-07');
    expect(instance.triggerEvent).toHaveBeenCalledWith('monthbrowse', { month: '2026-12' });
    vi.unstubAllGlobals();
  });
  it('preserves proposed colors and the same two-character shift label as the home calendar', () => {
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
    expect(duty).toMatchObject({ abbreviation: '全天', state: 'added' });
    expect(duty.badgeStyle).toContain('#267d70');
    expect(cells.find((cell) => cell.businessDate === '2026-11-02').disabled).toBe(true);
  });
  it('keeps cross-month holidays and gray existing duties in the shared week panels', () => {
    const assignments = mergePreviewAssignments(
      [
        {
          businessDate: '2026-10-01',
          plannedMemberName: '新成员',
          shiftTypeAbbreviation: 'NP',
          shiftTypeName: 'NP班',
          slotPosition: 1,
        },
      ],
      [
        {
          businessDate: '2026-09-30',
          plannedMemberName: '原成员',
          shiftTypeAbbreviation: '电脑',
          shiftTypeName: '电脑班',
          slotPosition: 1,
        },
      ],
    );
    const result = previewWeekPanels(assignments, '2026-09-28', '', 1, false, [
      { date: '2026-10-01', holidayName: '国庆节', isOffDay: true },
    ]);
    expect(result.panels[1].cells).toHaveLength(7);
    expect(result.panels[1].cells.find((cell) => cell.businessDate === '2026-10-01')).toMatchObject(
      { holiday: '国庆', duties: [{ abbreviation: 'NP', state: 'added' }] },
    );
    expect(
      result.panels[1].cells.find((cell) => cell.businessDate === '2026-09-30').duties[0],
    ).toMatchObject({ abbreviation: '电脑', state: 'normal' });
    expect(
      result.panels[1].cells.find((cell) => cell.businessDate === '2026-09-30').duties[0]
        .badgeStyle,
    ).toContain('#eef1f4');
    const existingGroup = result.panels[1].days.find((day) => day.businessDate === '2026-09-30')
      .shiftGroups[0];
    expect(existingGroup).toMatchObject({ color: '#94a3b8' });
    expect(existingGroup.duties[0].comparisonClass).toBe('is-existing-comparison');
  });
  it('sizes a dense week from its busiest day so the release dialog can scroll', () => {
    const assignments = Array.from({ length: 20 }, (_, index) => ({
      businessDate: '2026-10-01',
      plannedMemberName: `成员${index}`,
      shiftTypeAbbreviation: 'N',
      shiftTypeName: 'N班',
      slotPosition: index + 1,
    }));
    const week = previewWeekPanels(assignments, '2026-09-28', '');
    expect(week.panels[1].cells[3].duties).toHaveLength(20);
    expect(week.gridHeight).toBeGreaterThan(20 * 17);
    const css = readFileSync(
      new URL('../src/subpackages/scheduling/pages/manual/index.wxss', import.meta.url),
      'utf8',
    );
    expect(css).toMatch(/\.release-calendar-scroll\s*\{[^}]*max-height:\s*65vh/su);
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
