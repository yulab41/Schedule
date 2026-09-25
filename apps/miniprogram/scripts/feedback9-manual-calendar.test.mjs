import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { previewCalendarModel } from '../src/subpackages/scheduling/components/schedule-calendar-preview/model.ts';

const mocks = vi.hoisted(() => ({
  calendar: vi.fn(),
  draft: vi.fn(),
  holidays: vi.fn(),
  next: vi.fn(),
}));
vi.mock('../src/platform/client-core-calendar.ts', () => ({
  createRuntimeCalendarPreferencesClient: () => ({}),
  createRuntimeManualScheduleClient: () => ({ getNextStartDate: mocks.next }),
  createRuntimeSchedulePublicationClient: () => ({ getDraftPreview: mocks.draft }),
}));
vi.mock('../src/platform/workbench-read.ts', () => ({
  createWorkbenchReadClient: () => ({
    getCalendar: mocks.calendar,
    getHolidays: mocks.holidays,
  }),
  readStoredWorkbenchGroupId: vi.fn(),
  writeStoredWorkbenchGroupId: vi.fn(),
}));
vi.mock('../src/platform/wechat-identity.ts', () => ({
  getStoredWechatProfile: () => ({ id: 'u' }),
  getStoredWechatToken: () => 'test',
  getWechatRequestAuthentication: () => undefined,
}));
const source = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
let definition;
beforeEach(async () => {
  vi.resetModules();
  mocks.next.mockReset();
  mocks.calendar.mockReset();
  mocks.draft.mockReset();
  mocks.holidays.mockReset().mockResolvedValue({ dates: [] });
  vi.stubGlobal('Page', (value) => {
    definition = value;
  });
  for (const key of ['API_BASE_URL', 'BUILD_COMMIT', 'BUILD_PROFILE', 'BUILD_VERSION'])
    vi.stubGlobal(
      `__MINIPROGRAM_${key}__`,
      key === 'API_BASE_URL' ? 'https://example.test/api' : 'test',
    );
  vi.stubGlobal('wx', { getWindowInfo: () => ({ windowWidth: 390 }) });
  await import('../src/subpackages/scheduling/pages/manual/index.ts');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllTimers();
});
function page(count = 6) {
  const members = Array.from({ length: count }, (_, i) => ({
    membershipId: `m${i}`,
    realName: `成员${i}`,
  }));
  return {
    ...definition,
    data: {
      ...structuredClone(definition.data),
      state: 'editor',
      isBusy: false,
      startDate: '2026-11-01',
      endDate: '2026-11-30',
      startDateState: 'ready',
    },
    _currentGroupId: 'g',
    _memberIds: members.map((m) => m.membershipId),
    _memberNames: new Map(members.map((m) => [m.membershipId, m.realName])),
    _holidays: new Map(),
    _cellValues: new Map(),
    _staleCellKeys: new Set(),
    _staleMemberIds: new Set(),
    _templates: [],
    _feedbackVisible: false,
    _config: {
      roles: [{ id: 'r', name: '一线', members, version: 1 }],
      shiftTypes: [
        {
          id: 's',
          name: '全天班',
          abbreviation: '全',
          color: '#123456',
          textColor: '#ffffff',
          isEnabled: true,
        },
      ],
      groupMembers: members,
    },
    setData(patch, callback) {
      Object.assign(this.data, patch);
      callback?.();
    },
  };
}
describe('feedback9 manual geometry and dates', () => {
  it.each([1, 6, 7, 20])('expands to exactly %i member rows', (count) => {
    const p = page(count);
    p.handleCycleDaysChange({ detail: { value: 29 } });
    expect(p.data.matrixViewportHeight).toBe(82 + count * 44);
    expect(p.data.matrixBodyViewportHeight).toBe(count * 44);
    expect(p.data.matrixGestureConfig.maxVerticalOffset).toBe(0);
  });
  it('uses measured matrix width rather than screen width for its last column', () => {
    const p = page();
    const query = {
      select: vi.fn(() => query),
      boundingClientRect: vi.fn(() => query),
      exec: (callback) => callback([{ width: 318 }]),
    };
    p.createSelectorQuery = () => query;
    p.handleCycleDaysChange({ detail: { value: 29 } });
    p.updateMatrixViewport();
    expect(p.data.matrixGestureConfig.maxHorizontalOffset).toBe(104 + 30 * 72 - 318);
  });
  it('never exposes today while awaiting a suggestion, and ignores it after manual selection', async () => {
    let resolve;
    mocks.next.mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    const p = page();
    p.data.roleOptions = [{ value: 'r', label: '一线' }];
    p.handleRoleChange({ detail: { value: 0 } });
    expect(p.data.startDateState).toBe('loading');
    expect(p.data.startDate).toBe('');
    expect(p.data.columns).toEqual([]);
    p.handleStartDateChange({ detail: { value: '2027-01-02' } });
    resolve({ startDate: '2026-12-01' });
    await Promise.resolve();
    await Promise.resolve();
    expect(p.data.startDate).toBe('2027-01-02');
    expect(p.data.startDateState).toBe('ready');
  });
  it('offers retry on suggestion failure and commits the retried date', async () => {
    mocks.next
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ startDate: '2026-12-01' });
    const p = page();
    p.data.roleOptions = [{ value: 'r', label: '一线' }];
    p.handleRoleChange({ detail: { value: 0 } });
    await vi.waitFor(() => expect(p.data.startDateState).toBe('error'));
    expect(p.data.canSave).toBe(false);
    p.handleRetryStartDate();
    await vi.waitFor(() => expect(p.data.startDate).toBe('2026-12-01'));
    expect(p.data.startDateState).toBe('ready');
  });
  it('uses the selected end date and rejects reversed or over-366-day ranges', () => {
    const p = page();
    p.handleEndDateChange({ detail: { value: '2026-11-20' } });
    expect(p.data.endDate).toBe('2026-11-20');
    expect(p.data.limitNotice).toBe('');
    p.handleEndDateChange({ detail: { value: '2026-10-31' } });
    expect(p.data.canSave).toBe(false);
    expect(p.data.limitNotice).toContain('最多 366 天');
    p.handleEndDateChange({ detail: { value: '2027-11-01' } });
    expect(p.data.limitNotice).toBe('');
    p.handleEndDateChange({ detail: { value: '2027-11-02' } });
    expect(p.data.canSave).toBe(false);
  });
  it('does not clear a save lock or reset scroll when date holidays arrive', async () => {
    let resolve;
    mocks.holidays.mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    const p = page();
    p.handleStartDateChange({ detail: { value: '2026-11-01' } });
    p.data.isBusy = true;
    p.data.matrixGestureConfig.horizontalOffset = -100;
    resolve({ dates: [{ date: '2026-11-01', holidayName: '测试节', isOffDay: true }] });
    await vi.waitFor(() => expect(p.data.columns[0].holidayLabel).toBe('测试节'));
    expect(p.data.isBusy).toBe(true);
    expect(p.data.matrixGestureConfig.horizontalOffset).toBe(-100);
  });
  it('passes vertical swipes through when the matrix has no vertical scroll range', () => {
    const module = { exports: {} };
    vm.runInNewContext(source('subpackages/scheduling/pages/manual/matrix-gesture.wxs'), {
      module,
    });
    const handlers = module.exports;
    const owner = {
      getState: () => ({}),
      selectComponent: () => ({ setStyle() {} }),
      callMethod: vi.fn(),
      requestAnimationFrame: vi.fn(),
    };
    handlers.configure(
      { maxHorizontalOffset: 500, maxVerticalOffset: 0, resetToken: 'expanded' },
      null,
      owner,
    );
    handlers.touchStart({ timeStamp: 0, touches: [{ clientX: 100, clientY: 100 }] }, owner);
    expect(
      handlers.touchMove({ timeStamp: 20, touches: [{ clientX: 100, clientY: 170 }] }, owner),
    ).not.toBe(false);
    expect(handlers.touchEnd({}, owner)).not.toBe(false);
    expect(owner.requestAnimationFrame).not.toHaveBeenCalled();
  });
  it('rejects late date responses after another role or page unload', async () => {
    const pending = [];
    mocks.next.mockImplementation(() => new Promise((resolve) => pending.push(resolve)));
    const p = page();
    p._config.roles.push({ ...p._config.roles[0], id: 'r2', name: '二线' });
    p.data.roleOptions = [
      { value: 'r', label: '一线' },
      { value: 'r2', label: '二线' },
    ];
    p.handleRoleChange({ detail: { value: 0 } });
    p.handleRoleChange({ detail: { value: 1 } });
    pending[1]({ startDate: '2027-02-01' });
    await vi.waitFor(() => expect(p.data.startDate).toBe('2027-02-01'));
    pending[0]({ startDate: '2026-12-01' });
    await Promise.resolve();
    expect(p.data.startDate).toBe('2027-02-01');
    p.handleRoleChange({ detail: { value: 0 } });
    p.onUnload();
    pending[2]({ startDate: '2027-03-01' });
    await Promise.resolve();
    expect(p.data.startDate).toBe('');
  });
  it('loads and reuses both holiday years for release previews and drops unloaded responses', async () => {
    const p = page();
    mocks.holidays.mockImplementation(async (year) => ({
      dates: [{ date: `${year}-01-01`, holidayName: '元旦', isOffDay: true }],
    }));
    p.handleReleaseMonthBrowse({ detail: { month: '2026-12' } });
    await vi.waitFor(() => expect(p.data.previewHolidays).toHaveLength(2));
    expect(mocks.holidays.mock.calls.map(([year]) => year)).toEqual([2026, 2027]);
    p.handleReleaseMonthBrowse({ detail: { month: '2027-01' } });
    await Promise.resolve();
    expect(mocks.holidays).toHaveBeenCalledTimes(2);
    let resolve;
    mocks.holidays.mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    p.handleReleaseMonthBrowse({ detail: { month: '2028-06' } });
    p.onUnload();
    resolve({ dates: [{ date: '2028-01-01', holidayName: '元旦', isOffDay: true }] });
    await Promise.resolve();
    await Promise.resolve();
    expect(p.data.previewHolidays).toHaveLength(2);
  });
  it('lazily merges same-role existing schedules into a draft batch preview', async () => {
    const p = page();
    p._history = [
      {
        applyEndDate: '2026-11-30',
        applyStartDate: '2026-11-01',
        businessMonth: '2026-11',
        createdAt: '2026-09-23T00:00:00.000Z',
        id: 'draft-period-1',
        operationId: 'draft-batch-1',
        revision: 1,
        scheduleRoleId: 'r',
        scheduleRoleName: '一线',
        status: 'draft',
        version: 1,
      },
    ];
    mocks.draft.mockResolvedValue({
      assignments: [
        {
          businessDate: '2026-11-01',
          plannedMemberName: '本次草稿',
          scheduleRoleId: 'r',
          shiftTypeAbbreviation: '全',
          shiftTypeId: 's',
          shiftTypeName: '全天班',
          slotPosition: 1,
        },
      ],
      scheduleRoleId: 'r',
    });
    mocks.calendar.mockImplementation(async (_groupId, month) => ({
      assignments:
        month === '2026-11'
          ? [
              {
                businessDate: '2026-11-01',
                id: 'existing-r',
                plannedMemberName: '已有排班',
                scheduleRoleId: 'r',
                shiftTypeAbbreviation: '夜',
                shiftTypeId: 'night',
                shiftTypeName: '夜班',
                slotPosition: 1,
              },
              {
                businessDate: '2026-11-01',
                id: 'existing-other-role',
                plannedMemberName: '其他岗位',
                scheduleRoleId: 'other-role',
                shiftTypeAbbreviation: '备',
                shiftTypeId: 'backup',
                shiftTypeName: '备班',
                slotPosition: 2,
              },
            ]
          : [],
      businessMonth: month,
    }));

    p.handlePreviewDraftBatch({ currentTarget: { dataset: { batchKey: 'draft-batch-1' } } });
    await vi.waitFor(() => expect(mocks.calendar).toHaveBeenCalledTimes(3));
    await vi.waitFor(() => expect(p.data.releasePreviewAssignments).toHaveLength(2));
    expect(mocks.calendar.mock.calls.map(([, month]) => month)).toEqual([
      '2026-10',
      '2026-11',
      '2026-12',
    ]);
    expect(
      p.data.releasePreviewAssignments.map(({ plannedMemberName, state }) => [
        plannedMemberName,
        state,
      ]),
    ).toEqual([
      ['已有排班', 'removed'],
      ['本次草稿', 'added'],
    ]);

    p.handleReleaseMonthBrowse({ detail: { month: '2027-01' } });
    await vi.waitFor(() => expect(mocks.calendar).toHaveBeenCalledTimes(5));
    expect(mocks.calendar.mock.calls.map(([, month]) => month)).toEqual([
      '2026-10',
      '2026-11',
      '2026-12',
      '2027-01',
      '2027-02',
    ]);
  });
  it('keeps the draft visible when existing schedules fail to load', async () => {
    const p = page();
    p._history = [
      {
        applyEndDate: '2026-11-30',
        applyStartDate: '2026-11-01',
        businessMonth: '2026-11',
        createdAt: '2026-09-23T00:00:00.000Z',
        id: 'draft-period-1',
        operationId: 'draft-batch-1',
        revision: 1,
        scheduleRoleId: 'r',
        scheduleRoleName: '一线',
        status: 'draft',
        version: 1,
      },
    ];
    mocks.draft.mockResolvedValue({
      assignments: [
        {
          businessDate: '2026-11-01',
          plannedMemberName: '本次草稿',
          scheduleRoleId: 'r',
          shiftTypeAbbreviation: '全',
          shiftTypeId: 's',
          shiftTypeName: '全天班',
          slotPosition: 1,
        },
      ],
      scheduleRoleId: 'r',
    });
    mocks.calendar.mockRejectedValue({});

    p.handlePreviewDraftBatch({ currentTarget: { dataset: { batchKey: 'draft-batch-1' } } });
    await vi.waitFor(() => expect(p.data.errorMessage).toContain('已有排班读取失败'));
    expect(
      p.data.releasePreviewAssignments.map(({ plannedMemberName }) => plannedMemberName),
    ).toEqual(['本次草稿']);
  });
  it('drops existing-schedule responses that arrive after the preview closes', async () => {
    const pending = [];
    const p = page();
    p._history = [
      {
        applyEndDate: '2026-11-30',
        applyStartDate: '2026-11-01',
        businessMonth: '2026-11',
        createdAt: '2026-09-23T00:00:00.000Z',
        id: 'draft-period-1',
        operationId: 'draft-batch-1',
        revision: 1,
        scheduleRoleId: 'r',
        scheduleRoleName: '一线',
        status: 'draft',
        version: 1,
      },
    ];
    mocks.draft.mockResolvedValue({
      assignments: [
        {
          businessDate: '2026-11-01',
          plannedMemberName: '本次草稿',
          scheduleRoleId: 'r',
          shiftTypeAbbreviation: '全',
          shiftTypeId: 's',
          shiftTypeName: '全天班',
          slotPosition: 1,
        },
      ],
      scheduleRoleId: 'r',
    });
    mocks.calendar.mockImplementation(() => new Promise((resolve) => pending.push(resolve)));

    p.handlePreviewDraftBatch({ currentTarget: { dataset: { batchKey: 'draft-batch-1' } } });
    await vi.waitFor(() => expect(mocks.calendar).toHaveBeenCalledTimes(3));
    p.handleCloseReleaseDialog();
    pending.forEach((resolve, index) =>
      resolve({
        assignments: [
          {
            businessDate: '2026-11-01',
            id: `existing-${index}`,
            plannedMemberName: '迟到已有排班',
            scheduleRoleId: 'r',
            shiftTypeAbbreviation: '夜',
            shiftTypeId: 'night',
            shiftTypeName: '夜班',
            slotPosition: 1,
          },
        ],
        businessMonth: '2026-11',
      }),
    );
    await Promise.resolve();
    await Promise.resolve();
    expect(p.data.releaseDialogKind).toBe('');
    expect(
      p.data.releasePreviewAssignments.map(({ plannedMemberName }) => plannedMemberName),
    ).toEqual(['本次草稿']);
  });
});
describe('feedback9 calendar display', () => {
  it('carries confirmed holidays through cross-year preview panels', () => {
    const model = previewCalendarModel([], '2026-12', 1, false, [
      { date: '2027-01-01', holidayName: '元旦', isOffDay: true, isWorkday: false },
    ]);
    const cell = model.panels
      .find((p) => p.month === '2027-01')
      .cells.find((c) => c.businessDate === '2027-01-01');
    expect(cell.holiday).toBe('元旦');
    expect(cell.isHoliday).toBe(true);
  });
  it('keeps a two-character shift badge visible without a duplicate preview border', () => {
    const css =
      source('components/calendar/calendar-cell/index.wxss') +
      source('subpackages/scheduling/pages/manual/index.wxss');
    const dom = new JSDOM(
      `<style>${css.replace(/@import[^;]+;/gu, '')}</style><span class="duty-abbreviation">NP</span><div class="preview-calendar-card"></div>`,
    );
    const badge = dom.window.getComputedStyle(dom.window.document.querySelector('span'));
    expect(badge.minWidth).toBe(badge.height);
    expect(badge.flexShrink).toBe('0');
    expect(badge.whiteSpace).toBe('nowrap');
    const card = dom.window.getComputedStyle(dom.window.document.querySelector('div'));
    expect(card.borderTopWidth === '' || card.borderTopWidth === '0px').toBe(true);
    dom.window.close();
  });
  it('keeps the ordinary holiday badge while shrinking only compact preview badges', () => {
    const css = source('components/calendar/calendar-cell/index.wxss').replace(
      /@import[^;]+;/gu,
      '',
    );
    const dom = new JSDOM(
      `<style>${css}</style><div class="calendar-cell"><span id="ordinary" class="holiday-chip">国庆</span></div><div class="calendar-cell is-compact"><span id="compact" class="holiday-chip">国庆</span></div>`,
    );
    const ordinary = dom.window.getComputedStyle(dom.window.document.querySelector('#ordinary'));
    const compact = dom.window.getComputedStyle(dom.window.document.querySelector('#compact'));
    expect(ordinary.maxWidth).toBe('28px');
    expect(ordinary.minHeight).toBe('16px');
    expect(compact.maxWidth).toBe('20px');
    expect(compact.minHeight).toBe('12px');
    expect(compact.fontSize).toBe('7px');
    dom.window.close();
  });
});
