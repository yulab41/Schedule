import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';

const source = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
const manual = 'subpackages/scheduling/pages/manual/index';
afterEach(() => vi.unstubAllGlobals());

describe('feedback7 manual scheduling', () => {
  it('preserves the editor across draft/history navigation and never publishes from the rail', async () => {
    vi.resetModules();
    let definition;
    vi.stubGlobal('Page', (value) => {
      definition = value;
    });
    for (const key of ['API_BASE_URL', 'BUILD_COMMIT', 'BUILD_PROFILE', 'BUILD_VERSION'])
      vi.stubGlobal(
        `__MINIPROGRAM_${key}__`,
        key === 'API_BASE_URL' ? 'https://example.test/api' : 'test',
      );
    vi.stubGlobal('wx', {
      getStorageSync: () => undefined,
      getStorageInfoSync: () => ({ keys: [] }),
      request: vi.fn(),
    });
    await import('../src/subpackages/scheduling/pages/manual/index.ts');
    const page = {
      ...definition,
      data: structuredClone(definition.data),
      _history: [],
      _releaseArchivedExpanded: new Set(),
      _cellValues: new Map([['1:m', 'shift']]),
      _isDirty: true,
      setData(patch) {
        Object.assign(this.data, patch);
      },
    };
    for (const [index, state] of [
      [2, 'release'],
      [3, 'history'],
      [0, 'editor'],
    ]) {
      definition.handleStageSelect.call(page, { currentTarget: { dataset: { index } } });
      expect(page.data.state).toBe(state);
      expect(page.data.stageIndex).toBe(index);
      expect(page._cellValues.get('1:m')).toBe('shift');
    }
    expect(globalThis.wx.request).not.toHaveBeenCalled();
    definition.handleOpenCyclePicker.call(page);
    definition.handleCycleWheel.call(page, {
      detail: {
        runtimeKey: 'manual-cycle-days',
        generation: page.data.cycleWheelGeneration - 1,
        sequence: 99,
        index: 29,
      },
    });
    expect(page.data.cycleDraftIndex).toBe(page.data.cycleDayIndex);
    definition.handleCycleWheel.call(page, {
      detail: {
        runtimeKey: 'manual-cycle-days',
        generation: page.data.cycleWheelGeneration,
        sequence: 1,
        index: 15,
      },
    });
    expect(page.data.cycleDraftIndex).toBe(15);
    definition.handleCloseCyclePicker.call(page);
    expect(page.data.cycleDays).toBe(7);
    page.data.previewWarningCount = 0;
    definition.handleRiskToggle.call(page, { detail: { checked: false } });
    expect(page.data.canApplyDraft).toBe(true);
    page.data.previewWarningCount = 1;
    definition.handleRiskToggle.call(page, { detail: { checked: false } });
    expect(page.data.canApplyDraft).toBe(false);
    definition.handleRiskToggle.call(page, { detail: { checked: true } });
    expect(page.data.canApplyDraft).toBe(true);
  });
  it('maps cross-month previews and actual published members to the same calendar', async () => {
    const { previewCalendarModel } =
      await import('../src/subpackages/scheduling/components/schedule-calendar-preview/model.ts');
    const assignments = [
      {
        businessDate: '2026-11-30',
        plannedMemberName: '甲',
        shiftTypeAbbreviation: '全',
        shiftTypeName: '全天班',
        slotPosition: 1,
      },
      {
        businessDate: '2026-12-01',
        plannedMemberName: '乙',
        actualMemberName: '丙',
        shiftTypeAbbreviation: '夜',
        shiftTypeName: '夜班',
        slotPosition: 1,
      },
    ];
    const november = previewCalendarModel(assignments, '2026-11', '', 1);
    expect(
      november.panels[1].cells.find((cell) => cell.businessDate === '2026-11-30').duties[0].name,
    ).toBe('甲');
    const december = previewCalendarModel(assignments, '2026-12', '2026-12-01', 2);
    expect(
      december.panels[2].cells.find((cell) => cell.businessDate === '2026-12-01').duties[0].name,
    ).toBe('丙');
    expect(december.details[0].label).toBe('丙 · 夜班');
    expect(
      december.panels[2].cells.find((cell) => cell.businessDate === '2026-12-02').duties,
    ).toEqual([]);
  });
  it('starts blank and only loads saved cells from an explicit template selection', () => {
    const ts = source(`${manual}.ts`);
    expect(ts).not.toContain('openTemplate(page, templates[0])');
    expect(ts).toContain('if (template !== undefined) openTemplate(this, template)');
  });
  it('exposes four navigable stages, compact fields and conditional risk acknowledgement', () => {
    const wxml = source(`${manual}.wxml`);
    expect(wxml).toContain('bindtap="handleStageSelect"');
    expect(wxml).not.toContain('点格排班');
    expect(wxml).toContain('multiple="{{true}}"');
    expect(wxml).toMatch(/<ui-checkbox\s+wx:if="\{\{previewWarningCount > 0\}\}"/u);
    expect(wxml).toContain('handlePreviewDraftBatch');
    expect(wxml).toContain('<schedule-calendar-preview');
    expect(wxml).toContain('<ui-toast');
  });
  it('keeps multiselect open, reports checked state and respects disabled options', async () => {
    vi.resetModules();
    let definition;
    vi.stubGlobal('Component', (value) => {
      definition = value;
    });
    await import('../src/components/ui/ui-selector/index.ts');
    const instance = {
      properties: {
        multiple: true,
        disabled: false,
        selectedIndex: -1,
        options: [
          { value: 'a', label: '甲', checked: false },
          { value: 'b', label: '乙', checked: false, disabled: true },
        ],
      },
      data: structuredClone(definition.data),
      setData(patch) {
        Object.assign(this.data, patch);
      },
      triggerEvent: vi.fn(),
    };
    definition.methods.handleOpen.call(instance);
    instance.triggerEvent.mockClear();
    definition.methods.handleOptionTap.call(instance, { currentTarget: { dataset: { index: 0 } } });
    expect(instance.data.open).toBe(true);
    expect(instance.triggerEvent).toHaveBeenCalledWith(
      'change',
      expect.objectContaining({ checked: true, option: instance.properties.options[0] }),
    );
    definition.methods.handleOptionTap.call(instance, { currentTarget: { dataset: { index: 1 } } });
    expect(instance.triggerEvent).toHaveBeenCalledTimes(1);
  });
});
