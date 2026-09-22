import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { enableTestClientCapabilities } from './test-client-capabilities.mjs';

describe('P5 native manual schedule controller', () => {
  let definition;

  beforeEach(async () => {
    vi.resetModules();
    vi.stubGlobal('Page', (value) => {
      definition = value;
    });
    vi.stubGlobal('__MINIPROGRAM_API_BASE_URL__', 'https://example.test/api');
    vi.stubGlobal('__MINIPROGRAM_BUILD_COMMIT__', 'test');
    vi.stubGlobal('__MINIPROGRAM_BUILD_PROFILE__', 'production');
    vi.stubGlobal('__MINIPROGRAM_BUILD_VERSION__', 'test');
    vi.stubGlobal('wx', {
      getStorageInfoSync: vi.fn(() => ({ keys: [] })),
      getStorageSync: vi.fn((key) =>
        key === 'schedule.wechat.session' ? validSession() : undefined,
      ),
      getWindowInfo: () => ({ statusBarHeight: 24, windowWidth: 390 }),
      request: vi.fn(),
      showModal: vi.fn(),
    });
    await import('../src/subpackages/scheduling/pages/manual/index.ts');
    await enableTestClientCapabilities();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('writes the active shift on first tap and clears it on the second tap', () => {
    const instance = createPageInstance(definition);
    const event = {
      currentTarget: { dataset: { columnIndex: 0, key: '1:member-1', rowIndex: 0 } },
    };

    definition.handleCellTap.call(instance, event);
    expect(instance._cellValues.get('1:member-1')).toBe('shift-a');
    expect(instance.data.rows[0].cells[0]).toMatchObject({
      abbreviation: 'A',
      isSelected: true,
      shiftTypeId: 'shift-a',
    });

    definition.handleCellTap.call(instance, event);
    expect(instance._cellValues.has('1:member-1')).toBe(false);
    expect(instance.data.rows[0].cells[0]).toMatchObject({
      abbreviation: '',
      isSelected: false,
      shiftTypeId: '',
    });
  });

  it('previews the current dirty editor snapshot without saving a template implicitly', async () => {
    const instance = createPageInstance(definition);
    instance._config = {
      groupMembers: [],
      roles: [
        {
          id: 'role-1',
          members: [{ membershipId: 'member-1', realName: '林医生' }],
          name: '一线',
          version: 1,
        },
      ],
      rulesVersion: 7,
      shiftTypes: [{ ...instance.data.shiftTypes[0], isEnabled: true }],
    };
    instance._currentGroupId = 'group-1';
    instance._templates = [{ id: 'template-1', version: 1 }];
    instance.data.canPreview = true;
    instance.data.canSave = true;
    instance.data.endDate = '2026-08-30';
    instance.data.roleIndex = 0;
    instance.data.selectedTemplateId = 'template-1';
    instance.data.startDate = '2026-08-23';
    instance.data.startDateState = 'ready';

    definition.handleCellTap.call(instance, {
      currentTarget: { dataset: { columnIndex: 0, key: '1:member-1', rowIndex: 0 } },
    });
    definition.handlePreview.call(instance);

    expect(instance._isDirty).toBe(true);
    await vi.waitFor(() => expect(globalThis.wx.request).toHaveBeenCalledTimes(1));
    const request = globalThis.wx.request.mock.calls[0][0];
    expect(request.url).toContain('/groups/group-1/manual-schedules/preview');
    expect(request.url).not.toContain('manual-schedule-templates');
    expect(request.data).toMatchObject({
      endDate: '2026-08-30',
      expectedRulesVersion: 7,
      snapshot: {
        cycleDays: 1,
        membershipIds: ['member-1'],
        scheduleRoleId: 'role-1',
      },
      startDate: '2026-08-23',
    });
  });

  it('allows replacing stale cells with an available shift and exposes no undo handler', () => {
    const instance = createPageInstance(definition);
    instance.data.rows[0].cells[0].isStale = true;
    definition.handleCellTap.call(instance, {
      currentTarget: { dataset: { columnIndex: 0, key: '1:member-1', rowIndex: 0 } },
    });

    expect(instance._cellValues.get('1:member-1')).toBe('shift-a');
    expect(instance._staleCellKeys.has('1:member-1')).toBe(false);
    expect(definition.handleUndo).toBeUndefined();
  });

  it('keeps matrix edits inert while a save or preview request is pending', () => {
    const instance = createPageInstance(definition);
    instance.data.isBusy = true;

    definition.handleCellTap.call(instance, {
      currentTarget: { dataset: { columnIndex: 0, key: '1:member-1', rowIndex: 0 } },
    });

    expect(instance._cellValues.get('1:member-1')).toBe('shift-p');
    expect(instance.data.rows[0].cells[0].shiftTypeId).toBe('shift-p');
  });

  it('confirms template deletion without selecting the option', async () => {
    const instance = createPageInstance(definition);
    const template = {
      cycleDays: 7,
      id: 'template-1',
      scheduleRoleName: '一线',
      startDate: '2026-09-01',
    };
    instance._currentGroupId = 'group-1';
    instance._templates = [template];
    instance.data.selectedTemplateId = '';

    definition.handleTemplateOptionAction.call(instance, {
      detail: {
        option: { actionLabel: '删除', label: '一线', value: template.id },
        value: template.id,
      },
    });
    expect(globalThis.wx.showModal).toHaveBeenCalledTimes(1);
    const modal = globalThis.wx.showModal.mock.calls[0][0];
    expect(modal.content).toContain('一线 · 2026-09-01 · 7天');
    modal.success({ cancel: true, confirm: false });
    expect(globalThis.wx.request).not.toHaveBeenCalled();

    definition.handleTemplateOptionAction.call(instance, {
      detail: {
        option: { actionLabel: '删除', label: '一线', value: template.id },
        value: template.id,
      },
    });
    globalThis.wx.showModal.mock.calls[1][0].success({ cancel: false, confirm: true });
    await vi.waitFor(() => expect(globalThis.wx.request).toHaveBeenCalledTimes(1));
    expect(globalThis.wx.request.mock.calls[0][0]).toMatchObject({
      method: 'DELETE',
      url: expect.stringContaining('/manual-schedule-templates/template-1'),
    });
    expect(instance.data.selectedTemplateId).toBe('');
  });

  it('reuses one operation id after an ambiguous apply failure', async () => {
    const requests = [];
    globalThis.wx.request.mockImplementation((options) => {
      requests.push(options);
      options.fail(new Error('network lost'));
    });
    const instance = createPageInstance(definition);
    instance._applyOperationId = 'operation-fixed';
    instance._config = { rulesVersion: 7 };
    instance._previewRequest = {
      endDate: '2026-08-30',
      expectedRulesVersion: 7,
      snapshot: {
        cells: [],
        cycleDays: 1,
        membershipIds: ['member-1'],
        scheduleRoleId: 'role-1',
      },
      startDate: '2026-08-23',
    };
    instance.data.canApplyDraft = true;

    definition.handleApplyDraft.call(instance);
    await vi.waitFor(() => expect(instance.data.isBusy).toBe(false));
    definition.handleApplyDraft.call(instance);
    await vi.waitFor(() => expect(requests).toHaveLength(6));

    expect(requests.map((request) => request.header['Idempotency-Key'])).toEqual(
      Array.from({ length: 6 }, () => 'operation-fixed'),
    );
    expect(requests.map((request) => request.data.operationId)).toEqual(
      Array.from({ length: 6 }, () => 'operation-fixed'),
    );
    expect(requests.every((request) => request.url.includes('/manual-schedules/drafts'))).toBe(
      true,
    );
  });
});

function createPageInstance(definition) {
  const data = structuredClone(definition.data);
  data.activeShiftTypeId = 'shift-a';
  data.cycleDays = 1;
  data.logicalCellCount = 1;
  data.rows = [
    {
      cells: [
        {
          abbreviation: 'P',
          ariaLabel: '2026-08-23，林医生，已排夜班',
          businessDate: '2026-08-23',
          color: '#EAF8EF',
          columnIndex: 0,
          isSelected: false,
          isStale: false,
          key: '1:member-1',
          membershipId: 'member-1',
          rowIndex: 0,
          shiftTypeId: 'shift-p',
          textColor: '#17672C',
        },
      ],
      isStale: false,
      membershipId: 'member-1',
      realName: '林医生',
      rowIndex: 0,
    },
  ];
  data.shiftTypes = [
    {
      abbreviation: 'A',
      color: '#DCEEFF',
      id: 'shift-a',
      name: '白班',
      textColor: '#084FA6',
    },
    {
      abbreviation: 'P',
      color: '#EAF8EF',
      id: 'shift-p',
      name: '夜班',
      textColor: '#17672C',
    },
  ];
  const instance = {
    ...definition,
    _applyOperationId: 'operation-initial',
    _cellValues: new Map([['1:member-1', 'shift-p']]),
    _isDirty: false,
    _memberIds: ['member-1'],
    _memberNames: new Map([['member-1', '林医生']]),
    _selectedLocation: undefined,
    data,
    setData(patch) {
      for (const [key, value] of Object.entries(patch)) {
        const match = /^rows\[(\d+)\]\.cells\[(\d+)\]$/u.exec(key);
        if (match !== null) {
          data.rows[Number(match[1])].cells[Number(match[2])] = value;
        } else {
          data[key] = value;
        }
      }
    },
  };
  return instance;
}

function validSession() {
  return {
    clientVersion: 'test',
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    profile: { id: 'user-1', realName: '林医生', version: 1 },
    token: 'test-token',
  };
}
