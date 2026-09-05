import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { enableTestClientCapabilities } from './test-client-capabilities.mjs';

let definition;
let page;
const input = (value, shiftId) => ({
  detail: { value },
  currentTarget: { dataset: { field: 'color', shiftId } },
});

beforeEach(async () => {
  vi.resetModules();
  vi.stubGlobal('__MINIPROGRAM_API_BASE_URL__', 'https://example.test/api');
  vi.stubGlobal('__MINIPROGRAM_BUILD_COMMIT__', 'test');
  vi.stubGlobal('__MINIPROGRAM_BUILD_PROFILE__', 'production');
  vi.stubGlobal('__MINIPROGRAM_BUILD_VERSION__', 'test');
  vi.stubGlobal('wx', { getStorageSync: vi.fn(), request: vi.fn(), setStorageSync: vi.fn() });
  const module =
    await import('../src/subpackages/organization/components/scheduling-config-panel/controller.ts');
  definition = module.createSchedulingConfigPanelControllerDefinition();
  page = {
    data: {
      ...structuredClone(definition.data),
      canManage: true,
      organizationEnabled: true,
      managementState: 'ready',
      shiftDrafts: [
        { id: 'one', name: '白班', color: '#0A66D5', textColor: '#FFFFFF', editing: true },
        { id: 'two', name: '夜班', color: '#287D70', textColor: '#FFFFFF', editing: false },
      ],
    },
    setData(patch) {
      for (const [key, value] of Object.entries(patch)) {
        const field = /^shiftDrafts\[(\d+)\]\.(\w+)$/u.exec(key);
        if (field) this.data.shiftDrafts[Number(field[1])][field[2]] = value;
        else this.data[key] = value;
      }
    },
  };
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('task C scheduling color drafts', () => {
  it('normalizes only the target draft, updates preview, and never writes or persists on picker change/collapse', () => {
    const other = page.data.shiftDrafts[1];
    definition.handleShiftColorInput.call(page, input(' ffffff ', 'one'));
    expect(page.data.shiftDrafts[0]).toMatchObject({
      color: '#FFFFFF',
      textColor: '#16202A',
      contrastWarning: false,
    });
    expect(page.data.shiftDrafts[1]).toBe(other);
    definition.handleShiftToggleEditor.call(page, input('', 'one'));
    expect(page.data.shiftDrafts[0].editing).toBe(false);
    expect(globalThis.wx.request).not.toHaveBeenCalled();
    expect(globalThis.wx.setStorageSync).not.toHaveBeenCalled();
  });

  it('does not allow invalid values through either new or existing color input paths', () => {
    definition.handleNewShiftInput.call(page, input('0f766e'));
    expect(page.data.newShiftColor).toBe('#0F766E');
    definition.handleNewShiftInput.call(page, input('#fff'));
    expect(page.data.newShiftColor).toBe('#0F766E');
    definition.handleShiftColorInput.call(page, input('not-a-color', 'one'));
    definition.handleShiftInput.call(page, input('#xyz', 'one'));
    expect(page.data.shiftDrafts[0].color).toBe('#0A66D5');
  });

  it.each(['canManage', 'organizationEnabled'])(
    'keeps the color draft read-only when %s is false',
    (flag) => {
      page.data[flag] = false;
      definition.handleShiftColorInput.call(page, input('#FFFFFF', 'one'));
      definition.handleNewShiftInput.call(page, input('#FFFFFF'));
      expect(page.data.shiftDrafts[0].color).toBe('#0A66D5');
      expect(page.data.newShiftColor).toBe('#1F5AA6');
    },
  );

  it('keeps the existing explicit save/version contract and retains drafts on a rejected save', async () => {
    await enableTestClientCapabilities();
    page._groupId = 'group-one';
    page._config = { rulesVersion: 4, shiftTypes: [{ id: 'one', version: 3 }] };
    page._operationIds = new Map();
    const updateShiftType = vi.fn().mockRejectedValue(new Error('offline fixture'));
    page._schedulingWriteClient = { updateShiftType };
    Object.assign(page.data.shiftDrafts[0], {
      abbreviation: '白',
      startTime: '08:00',
      endTime: '16:00',
    });
    definition.handleShiftColorInput.call(page, input('0f766e', 'one'));
    expect(updateShiftType).not.toHaveBeenCalled();
    definition.handleSaveShift.call(page, input('', 'one'));
    await vi.waitFor(() => expect(updateShiftType).toHaveBeenCalledOnce());
    expect(updateShiftType.mock.calls[0]).toEqual([
      'group-one',
      'one',
      expect.objectContaining({
        color: '#0F766E',
        expectedRulesVersion: 4,
        expectedVersion: 3,
        operationId: expect.any(String),
      }),
    ]);
    await vi.waitFor(() => expect(page.data.managementState).toBe('error'));
    expect(page.data.shiftDrafts[0].color).toBe('#0F766E');
    expect(page.data.shiftDrafts[1].color).toBe('#287D70');
  });

  it('creates a new shift only on the original explicit action with a normalized draft', async () => {
    await enableTestClientCapabilities();
    page._groupId = 'group-one';
    page._config = { rulesVersion: 4 };
    page._operationIds = new Map();
    page.data.newShiftName = '新班种';
    page.data.newShiftAbbreviation = '新';
    const createShiftType = vi.fn().mockRejectedValue(new Error('offline fixture'));
    page._schedulingWriteClient = { createShiftType };
    definition.handleNewShiftInput.call(page, input('abcdef'));
    definition.handleNewShiftToggle.call(page);
    definition.handleNewShiftToggle.call(page);
    expect(createShiftType).not.toHaveBeenCalled();
    definition.handleCreateShift.call(page);
    await vi.waitFor(() => expect(createShiftType).toHaveBeenCalledOnce());
    expect(createShiftType.mock.calls[0]).toEqual([
      'group-one',
      expect.objectContaining({
        color: '#ABCDEF',
        expectedRulesVersion: 4,
        operationId: expect.any(String),
      }),
    ]);
  });
});
