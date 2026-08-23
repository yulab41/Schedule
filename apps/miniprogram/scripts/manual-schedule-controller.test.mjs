import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
    });
    await import('../src/subpackages/scheduling/pages/manual/index.ts');
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

  it('marks cell edits dirty and never saves implicitly when preview is requested', () => {
    const instance = createPageInstance(definition);
    instance._config = {
      groupMembers: [],
      roles: [{ id: 'role-1', members: [], name: '一线', rotationRule: {}, version: 1 }],
      rulesVersion: 7,
      shiftTypes: [],
    };
    instance._currentGroupId = 'group-1';
    instance._templates = [{ id: 'template-1', version: 1 }];
    instance.data.canPreview = true;
    instance.data.canSave = true;
    instance.data.selectedTemplateId = 'template-1';

    definition.handleCellTap.call(instance, {
      currentTarget: { dataset: { columnIndex: 0, key: '1:member-1', rowIndex: 0 } },
    });
    definition.handlePreview.call(instance);

    expect(instance._isDirty).toBe(true);
    expect(instance.data.canPreview).toBe(false);
    expect(globalThis.wx.request).not.toHaveBeenCalled();
    expect(instance.data.errorMessage).toContain('先保存模板');
  });

  it('keeps stale cells inert and exposes no undo handler', () => {
    const instance = createPageInstance(definition);
    instance.data.rows[0].cells[0].isStale = true;
    definition.handleCellTap.call(instance, {
      currentTarget: { dataset: { columnIndex: 0, key: '1:member-1', rowIndex: 0 } },
    });

    expect(instance._cellValues.get('1:member-1')).toBe('shift-p');
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

  it('reuses one operation id after an ambiguous apply failure', async () => {
    const requests = [];
    globalThis.wx.request.mockImplementation((options) => {
      requests.push(options);
      options.fail(new Error('network lost'));
    });
    const instance = createPageInstance(definition);
    instance._applyOperationId = 'operation-fixed';
    instance._config = { rulesVersion: 7 };
    instance.data.canApplyDraft = true;
    instance.data.selectedTemplateId = 'template-1';

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
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    profile: { id: 'user-1', realName: '林医生', version: 1 },
    token: 'test-token',
  };
}
