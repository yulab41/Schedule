import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { compileUploadScript, requireUploadHelper } from './upload-script-compatibility.mjs';

const pagePath = 'subpackages/insights/pages/exports/index';
let code;
beforeAll(async () => {
  code = await compileUploadScript(
    readFileSync('dist/' + pagePath + '.js', 'utf8'),
    pagePath + '.js',
  );
});
afterEach(() => vi.useRealTimers());

function openPage(query = {}) {
  let definition;
  const diagnostics = { performance: [] };
  const wx = {
    getStorageSync: () => undefined,
    getWindowInfo: () => ({ statusBarHeight: 48, windowWidth: 412, windowHeight: 915 }),
    navigateBack: vi.fn(),
    request: vi.fn(),
  };
  vm.runInNewContext(code, {
    Page: (value) => {
      definition = value;
    },
    getApp: () => ({ globalData: { runtimeDiagnostics: diagnostics } }),
    wx,
    setTimeout,
    clearTimeout,
    require: requireUploadHelper,
  });
  expect(definition).toBeDefined();
  const page = {
    ...definition,
    data: JSON.parse(JSON.stringify(definition.data)),
    setData(patch) {
      Object.assign(this.data, patch);
    },
  };
  Object.defineProperty(page, 'properties', { value: Object.freeze({}), writable: false });
  page.onLoad(query);
  page.onShow();
  return { page, wx, stages: () => diagnostics.performance.map((row) => row.metric) };
}

it('rejects the regression-triggering closure after the real upload transform', async () => {
  const source =
    'async function poll(){while(true){const remaining=100;await new Promise(resolve=>setTimeout(resolve,remaining));}}';
  await expect(compileUploadScript(source, 'regression.js')).rejects.toThrow('regeneratorValues');
});

it('runs the uploaded Page through registration and initialization without reserved-property writes', async () => {
  const { page, stages } = openPage({ groupId: 'group-1' });
  try {
    await vi.waitFor(() => expect(page.data.state).toBe('disabled'));
    expect(page.data.groupId).toBe('group-1');
    expect(stages()).toEqual([]);
    expect(page.data).not.toHaveProperty('panelReady');
  } finally {
    page.onUnload();
  }
});

it.each([{}, { groupId: '%invalid' }])(
  'keeps a missing-group entry visible on retry: %j',
  (query) => {
    vi.useFakeTimers();
    const { page, wx } = openPage(query);
    try {
      expect(page.data.state).toBe('error');
      page.handleRetry();
      expect(page.data.errorMessage).toContain('群组信息缺失');
      expect(vi.getTimerCount()).toBe(0);
      expect(wx.request).not.toHaveBeenCalled();
      page.handleBack();
      expect(wx.navigateBack).toHaveBeenCalledWith({ delta: 1 });
    } finally {
      page.onUnload();
    }
  },
);

it('cancels initialization on unload before pending capability checks resolve', async () => {
  vi.useFakeTimers();
  const { page } = openPage({ groupId: 'group-1' });
  page.onHide();
  page.onUnload();
  const state = JSON.stringify(page.data);
  await vi.runAllTimersAsync();
  expect(JSON.stringify(page.data)).toBe(state);
  expect(vi.getTimerCount()).toBe(0);
});
