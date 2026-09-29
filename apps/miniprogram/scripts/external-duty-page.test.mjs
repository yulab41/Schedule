import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const request = vi.hoisted(() => vi.fn());
vi.mock('../src/platform/external-duty-client.js', () => ({ externalDutyRequest: request }));
const dates = ['2026-10-12', '2026-10-13'];
const rows = dates.map((businessDate, i) => ({
  businessDate,
  remoteName: i ? '甲医生' : '乙医生',
  localName: i ? '乙医生' : '甲医生',
  baselineName: i ? '乙医生' : '甲医生',
  fingerprint: `${i}`.repeat(64),
  status: 'pending',
  changeSource: 'remote',
  blockReason: null,
  suggestion: {
    kind: 'swap',
    detail: '1 步换班',
    steps: [{ date: dates[0], targetDate: dates[1], targetAssignmentId: 'second' }],
  },
}));
let definition;
let page;
const tap = (date) => ({ currentTarget: { dataset: { date } } });

beforeEach(async () => {
  vi.resetModules();
  request.mockReset().mockImplementation(async (path) => {
    if (path === '') return structuredClone(rows);
    if (path === '/history') return [];
    if (path === '/status')
      return { status: 'completed', checkedAt: '2026-09-28T15:00:00Z', coverageEnded: false };
    if (path === '/preview') return { conflicts: [], nextStatus: 'pending_target' };
    return {};
  });
  vi.stubGlobal('Page', (value) => {
    definition = value;
  });
  vi.stubGlobal('wx', {
    navigateBack: vi.fn(),
    getWindowInfo: () => ({ statusBarHeight: 24, windowWidth: 390 }),
    getAppBaseInfo: () => ({ fontSizeSetting: 20 }),
    getMenuButtonBoundingClientRect: () => ({ left: 285 }),
    showModal: vi.fn(({ success }) => success({ confirm: false })),
  });
  await import('../src/subpackages/insights/pages/external-duty/index.ts');
  page = {
    data: structuredClone(definition.data),
    setData(patch) {
      Object.assign(this.data, patch);
    },
  };
  for (const [name, method] of Object.entries(definition))
    if (typeof method === 'function') page[name] = method.bind(page);
  await page.load();
});
afterEach(() => vi.unstubAllGlobals());

describe('external duty reviewed interactions', () => {
  it('honors the WeChat font setting and reserves space for the system capsule', () => {
    page.onLoad();
    expect(page.data.largeText).toBe(true);
    expect(page.data.headerStyle).toContain('padding-right:113px');
  });
  it('previews both affected days in a sheet without executing a mutation', async () => {
    await page.applySuggestion(tap(dates[0]));
    expect(page.data.confirmation).toMatchObject({
      title: '换班预览',
      confirmLabel: '确认方案',
      conflicts: [],
    });
    expect(page.data.confirmation.changes.map((change) => change.date)).toEqual(dates);
    expect(request.mock.calls.some(([path]) => path === '/apply')).toBe(false);
    expect(globalThis.wx.showModal).not.toHaveBeenCalled();
  });
  it('opens the same complete plan from its second date', async () => {
    await page.applySuggestion(tap(dates[1]));
    expect(request).toHaveBeenCalledWith(
      '/preview',
      expect.objectContaining({ date: dates[0], targetAssignmentId: 'second' }),
    );
    expect(page.data.confirmation.changes).toHaveLength(2);
  });
  it('cancels without writing and prevents duplicate confirm clicks', async () => {
    await page.applySuggestion(tap(dates[0]));
    page.closeConfirmation();
    expect(page.data.confirmation).toBeNull();
    expect(request.mock.calls.some(([path]) => path === '/apply')).toBe(false);
    await page.applySuggestion(tap(dates[0]));
    let resolve;
    request.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const first = page.confirmAction();
    await page.confirmAction();
    expect(request.mock.calls.filter(([path]) => path === '/apply')).toHaveLength(1);
    resolve({});
    await first;
    expect(page.data.confirmation).toBeNull();
  });
  it('shows conflicts and does not allow confirmation', async () => {
    request.mockResolvedValueOnce({
      conflicts: [{ message: '同一时间有其他班次' }],
      nextStatus: 'pending_target',
    });
    await page.applySuggestion(tap(dates[0]));
    expect(page.data.confirmation.conflicts).toEqual(['同一时间有其他班次']);
    await page.confirmAction();
    expect(request.mock.calls.some(([path]) => path === '/apply')).toBe(false);
  });
  it('keeps the captured preview fingerprint when confirming a website write', async () => {
    page.push(tap(dates[0]));
    expect(request.mock.calls.some(([path]) => path === '/push')).toBe(false);
    const fingerprint = rows[0].fingerprint;
    page.data.rows[0].fingerprint = 'newer-scan';
    request.mockRejectedValueOnce(new Error('排班已变化，请重新确认'));
    await page.confirmAction();
    expect(request).toHaveBeenCalledWith('/push', {
      date: dates[0],
      expectedFingerprint: fingerprint,
    });
    expect(page.data.confirmation).toBeNull();
    expect(page.data.error).toBe('排班已变化，请重新确认');
  });
  it('shows the latest baseline from undo preview and requires a separate confirmation', async () => {
    request.mockResolvedValueOnce({
      side: 'local',
      date: dates[0],
      currentName: '乙医生',
      baselineName: '丙医生',
      expectedFingerprint: 'undo-preview',
    });
    await page.undo({ currentTarget: { dataset: { id: 'action-one' } } });
    expect(page.data.confirmation.changes).toEqual([
      { date: dates[0], before: '乙医生', after: '丙医生' },
    ]);
    expect(request.mock.calls.some(([path]) => path === '/undo')).toBe(false);
    await page.confirmAction();
    expect(request).toHaveBeenCalledWith('/undo', {
      actionId: 'action-one',
      expectedFingerprint: 'undo-preview',
    });
  });
  it('keeps a failed load out of the successful empty state', async () => {
    request.mockRejectedValueOnce(new Error('网络暂时不可用'));
    await page.load();
    expect(page.data.error).toBe('网络暂时不可用');
    expect(page.data.busy).toBe(false);
  });
});
