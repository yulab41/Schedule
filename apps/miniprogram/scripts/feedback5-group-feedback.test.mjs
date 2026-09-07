import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
let definition;
beforeEach(async () => {
  vi.resetModules();
  vi.stubGlobal('__MINIPROGRAM_API_BASE_URL__', 'https://example.test/api');
  vi.stubGlobal('__MINIPROGRAM_BUILD_COMMIT__', 'test');
  vi.stubGlobal('__MINIPROGRAM_BUILD_PROFILE__', 'production');
  vi.stubGlobal('__MINIPROGRAM_BUILD_VERSION__', 'test');
  vi.stubGlobal('wx', {
    getStorageSync: () => undefined,
    getWindowInfo: () => ({ statusBarHeight: 24, windowHeight: 844, windowWidth: 390 }),
  });
  const { createGroupSettingsPanelControllerDefinition } =
    await import('../src/subpackages/organization/components/group-settings-panel/controller.ts');
  definition = createGroupSettingsPanelControllerDefinition();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const preferences = {
  groupId: 'g',
  canManageGroupDefaults: true,
  groupDefaultView: 'month',
  groupDefaultMonthShiftTypeId: null,
  memberDefaultView: null,
  memberDefaultMonthShiftTypeId: null,
};
function host() {
  return {
    ...definition,
    data: {
      ...definition.data,
      calendarPreferencesState: 'ready',
      canManageGroupCalendarDefaults: true,
    },
    _currentGroupId: 'g',
    _calendarPreferencesClient: {
      updateMine: vi.fn(async () => preferences),
      updateGroupDefaults: vi.fn(async () => preferences),
    },
    setData(patch) {
      Object.assign(this.data, patch);
    },
  };
}
for (const method of ['handleSaveMemberCalendarPreferences', 'handleSaveGroupCalendarDefaults']) {
  it(`${method} uses the same replaceable two second toast for success and failure`, async () => {
    const page = host();
    definition[method].call(page);
    await vi.advanceTimersByTimeAsync(0);
    expect(page.data.infoMessage).toContain('已保存');
    await vi.advanceTimersByTimeAsync(1500);
    page._calendarPreferencesClient.updateMine.mockRejectedValue(new Error('保存失败'));
    page._calendarPreferencesClient.updateGroupDefaults.mockRejectedValue(new Error('保存失败'));
    definition[method].call(page);
    await vi.advanceTimersByTimeAsync(0);
    expect(page.data.infoMessage).toBe('保存失败');
    expect(page.data.feedbackTone).toBe('error');
    await vi.advanceTimersByTimeAsync(500);
    expect(page.data.infoMessage).toBe('保存失败');
    await vi.advanceTimersByTimeAsync(1500);
    expect(page.data.infoMessage).toBe('');
    expect(page.data.calendarPreferencesError).toBe('');
  });
}
for (const lifecycle of ['onHide', 'onUnload'])
  it(`${lifecycle} ignores late calendar save responses`, async () => {
    const page = host();
    let finish;
    page._calendarPreferencesClient.updateMine.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    definition.handleSaveMemberCalendarPreferences.call(page);
    definition[lifecycle].call(page);
    finish(preferences);
    await vi.advanceTimersByTimeAsync(0);
    expect(page.data.infoMessage).toBe('');
    expect(vi.getTimerCount()).toBe(0);
  });

it('clears an already visible capsule when the page hides', async () => {
  const page = host();
  definition.handleSaveMemberCalendarPreferences.call(page);
  await vi.advanceTimersByTimeAsync(0);
  expect(vi.getTimerCount()).toBe(1);
  definition.onHide.call(page);
  expect(page.data.infoMessage).toBe('');
  expect(vi.getTimerCount()).toBe(0);
});
it('registers the shared capsule on direct Page and delegates component hide/unload', () => {
  const root = '../src/subpackages/organization/';
  const page = JSON.parse(
    readFileSync(new URL(root + 'pages/group-settings/index.json', import.meta.url)),
  );
  expect(page.usingComponents['ui-toast']).toBe('/components/ui/ui-toast/index');
  const component = readFileSync(
    new URL(root + 'components/group-settings-panel/index.ts', import.meta.url),
    'utf8',
  );
  expect(component).toContain("['onHide']");
  expect(component).toContain("['onUnload']");
});

it('wires runtime lifecycle methods for the direct Page and embedded component', async () => {
  const registerPage = vi.fn();
  const registerComponent = vi.fn();
  vi.stubGlobal('Page', registerPage);
  vi.stubGlobal('Component', registerComponent);
  await import('../src/subpackages/organization/pages/group-settings/index.ts');
  await import('../src/subpackages/organization/components/group-settings-panel/index.ts');
  const pageDefinition = registerPage.mock.calls[0][0];
  expect(typeof pageDefinition.onHide).toBe('function');
  expect(typeof pageDefinition.onUnload).toBe('function');
  const componentDefinition = registerComponent.mock.calls[0][0];
  const onHide = vi.fn();
  const onUnload = vi.fn();
  const component = { __controller: { onHide, onUnload } };
  componentDefinition.pageLifetimes.hide.call(component);
  componentDefinition.lifetimes.detached.call(component);
  expect(onHide).toHaveBeenCalledOnce();
  expect(onUnload).toHaveBeenCalledOnce();
  expect(component.__controller).toBeUndefined();
});

it('passes save failures through the actual capsule error presentation', async () => {
  const page = host();
  page._calendarPreferencesClient.updateMine.mockRejectedValue(new Error('保存失败'));
  definition.handleSaveMemberCalendarPreferences.call(page);
  await vi.advanceTimersByTimeAsync(0);
  const register = vi.fn();
  vi.stubGlobal('Component', register);
  await import('../src/components/ui/ui-toast/index.ts');
  const toastDefinition = register.mock.calls[0][0];
  const toast = {
    properties: {
      visible: true,
      title: '操作未完成',
      message: page.data.infoMessage,
      tone: page.data.feedbackTone,
      topOffset: 112,
    },
    data: {},
    setData(patch) {
      Object.assign(this.data, patch);
    },
  };
  toastDefinition.lifetimes.attached.call(toast);
  expect(toast.data.displayTone).toBe('error');
  expect(toast.data.displayMessage).toBe('保存失败');
});

it('keeps request serials monotonic across component A to B to A replacement', async () => {
  const register = vi.fn();
  vi.stubGlobal('Component', register);
  await import('../src/subpackages/organization/components/group-settings-panel/index.ts');
  const componentDefinition = register.mock.calls[0][0];
  const page = host();
  let finish;
  page._calendarPreferencesClient.updateMine.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  page.__attached = true;
  page.__controller = definition;
  page.__loadedGroupId = 'g';
  page.properties = { embedded: true, groupId: 'b' };
  definition.handleSaveMemberCalendarPreferences.call(page);
  const initial = page._calendarPreferencesSerial;
  componentDefinition.observers.groupId.call(page);
  const intermediate = page._calendarPreferencesSerial;
  page.properties.groupId = 'g';
  componentDefinition.observers.groupId.call(page);
  expect(intermediate).toBeGreaterThan(initial);
  expect(page._calendarPreferencesSerial).toBeGreaterThan(intermediate);
  finish(preferences);
  await vi.advanceTimersByTimeAsync(0);
  expect(page.data.infoMessage).toBe('');
});

it('discards feedback from the previous group and retains persistent load errors', async () => {
  const page = host();
  let finish;
  page._calendarPreferencesClient.updateMine.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  definition.handleSaveMemberCalendarPreferences.call(page);
  page._currentGroupId = 'another';
  finish(preferences);
  await vi.advanceTimersByTimeAsync(0);
  expect(page.data.infoMessage).toBe('');
  page._calendarPreferencesClient.get = vi.fn().mockRejectedValue(new Error('读取失败'));
  page._organizationReadClient = { getSchedulingConfig: vi.fn(async () => ({})) };
  definition.handleCalendarPreferencesRetry.call(page);
  await vi.advanceTimersByTimeAsync(0);
  await vi.advanceTimersByTimeAsync(2500);
  expect(page.data.calendarPreferencesState).toBe('error');
  expect(page.data.calendarPreferencesError).toBe('读取失败');
});

it('ignores both feedback and busy cleanup after the same account signs in again', async () => {
  let token = 'first';
  wx.getStorageSync = () => ({
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    profile: { id: 'same', realName: '示例', version: 1 },
    token,
  });
  const page = host();
  let finish;
  page._calendarPreferencesClient.updateMine.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  definition.handleSaveMemberCalendarPreferences.call(page);
  token = 'second';
  const update = vi.spyOn(page, 'setData');
  finish(preferences);
  await vi.advanceTimersByTimeAsync(0);
  expect(update).not.toHaveBeenCalled();
  expect(page.data.infoMessage).toBe('');
});
