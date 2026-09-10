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
  it('strikes only replaced slots, appends proposed names and disables dates outside this proposal', () => {
    const base = {
      businessDate: '2026-11-01',
      plannedMemberName: '原人员',
      shiftTypeAbbreviation: '全',
      shiftTypeName: '全天班',
      slotPosition: 1,
    };
    const assignments = mergePreviewAssignments(
      [{ ...base, plannedMemberName: '新人员' }],
      [base, { ...base, businessDate: '2026-11-02' }],
    );
    const result = previewCalendarModel(assignments, '2026-11', '', 1, true);
    const cells = result.panels[1].cells;
    expect(
      cells
        .find((cell) => cell.businessDate === '2026-11-01')
        .duties.map(({ name, state }) => [name, state]),
    ).toEqual([
      ['原人员', 'removed'],
      ['新人员', 'added'],
    ]);
    expect(cells.find((cell) => cell.businessDate === '2026-11-02')).toMatchObject({
      disabled: true,
      duties: [{ name: '原人员', state: 'normal' }],
    });
  });
  it('resizes a six-row month to five rows and preserves the viewed month when data arrives', async () => {
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
});
