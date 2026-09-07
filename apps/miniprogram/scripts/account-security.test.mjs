import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';
import { fileURLToPath } from 'node:url';

let createController, resetLaunch, storage, dependencies;
beforeEach(async () => {
  vi.resetModules();
  storage = new Map();
  vi.stubGlobal('wx', {
    getStorageSync: (key) => storage.get(key),
    setStorageSync: (key, value) => storage.set(key, value),
  });
  ({ createAccountSecurityController: createController, resetPasswordReminderLaunch: resetLaunch } =
    await import('../src/components/account-security/controller.ts'));
  dependencies = {
    getProfile: vi.fn(() => ({ id: 'user-a' })),
    getAuthMethod: () => 'password',
    getPasswordStatus: vi.fn().mockResolvedValue({ hasPassword: true, mustChangePassword: true }),
    changePassword: vi.fn().mockResolvedValue({ passwordChanged: true }),
    finishSensitiveSessionChange: vi.fn(),
  };
});
afterEach(() => vi.unstubAllGlobals());
function mount() {
  const controller = createController(dependencies);
  const panel = {
    data: { ...controller.data },
    setData(patch) {
      Object.assign(this.data, patch);
    },
  };
  controller.initialize.call(panel);
  return { controller, panel };
}
it('checks once per account per cold launch, including automatic login and no group', async () => {
  const { controller, panel } = mount();
  await controller.checkReminder.call(panel);
  expect(panel.data.defaultPasswordReminderOpen).toBe(true);
  controller.methods.handleDefaultPasswordReminderClose.call(panel);
  await controller.checkReminder.call(panel);
  expect(panel.data.defaultPasswordReminderOpen).toBe(false);
  const resumed = mount();
  await resumed.controller.checkReminder.call(resumed.panel);
  expect(resumed.panel.data.defaultPasswordReminderOpen).toBe(false);
  expect(dependencies.getPasswordStatus).toHaveBeenCalledTimes(1);
  resetLaunch();
  await resumed.controller.checkReminder.call(resumed.panel);
  expect(resumed.panel.data.defaultPasswordReminderOpen).toBe(true);
});
it('waits for an in-flight automatic login before checking the launch reminder', async () => {
  let recover;
  dependencies.getProfile.mockReturnValue(undefined);
  dependencies.waitForSession = () =>
    new Promise((resolve) => {
      recover = resolve;
    });
  const { controller, panel } = mount();
  const pending = controller.checkReminder.call(panel);
  expect(dependencies.getPasswordStatus).not.toHaveBeenCalled();
  dependencies.getProfile.mockReturnValue({ id: 'user-a' });
  recover();
  await pending;
  expect(panel.data.defaultPasswordReminderOpen).toBe(true);
});
it('does not check or display a reminder after disposal while recovery is pending', async () => {
  let recover;
  dependencies.waitForSession = () =>
    new Promise((resolve) => {
      recover = resolve;
    });
  const { controller, panel } = mount();
  const pending = controller.checkReminder.call(panel);
  controller.dispose.call(panel);
  recover();
  await pending;
  expect(dependencies.getPasswordStatus).not.toHaveBeenCalled();
  expect(panel.data.defaultPasswordReminderOpen).toBe(false);
});
it('persists never-remind per account across launches and reports storage failure', async () => {
  const { controller, panel } = mount();
  await controller.checkReminder.call(panel);
  globalThis.wx.setStorageSync = () => {
    throw new Error('quota');
  };
  controller.methods.handleDefaultPasswordReminderDismiss.call(panel);
  expect(panel.data.defaultPasswordReminderOpen).toBe(true);
  expect(panel.data.passwordError).toContain('保存');
  globalThis.wx.setStorageSync = (key, value) => storage.set(key, value);
  controller.methods.handleDefaultPasswordReminderDismiss.call(panel);
  resetLaunch();
  const next = mount();
  await next.controller.checkReminder.call(next.panel);
  expect(next.panel.data.defaultPasswordReminderOpen).toBe(false);
  dependencies.getProfile.mockReturnValue({ id: 'user-b' });
  await next.controller.checkReminder.call(next.panel);
  expect(next.panel.data.defaultPasswordReminderOpen).toBe(true);
});
it('discards stale status and password responses after detach or account change', async () => {
  let resolve;
  dependencies.getPasswordStatus.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const { controller, panel } = mount();
  const pending = controller.checkReminder.call(panel);
  controller.dispose.call(panel);
  resolve({ hasPassword: true, mustChangePassword: true });
  await pending;
  expect(panel.data.defaultPasswordReminderOpen).toBe(false);
  controller.initialize.call(panel);
  controller.methods.handlePasswordOpen.call(panel);
  Object.assign(panel.data, { currentPassword: 'old', newPassword: 'new', passwordConfirm: 'new' });
  dependencies.changePassword.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  controller.methods.handlePasswordSubmit.call(panel);
  dependencies.getProfile.mockReturnValue({ id: 'user-b' });
  resolve({ passwordChanged: true });
  await Promise.resolve();
  await Promise.resolve();
  expect(dependencies.finishSensitiveSessionChange).not.toHaveBeenCalled();
});

it('does not overlay a pending launch reminder on the profile password editor', async () => {
  let resolve;
  dependencies.getPasswordStatus.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const launch = mount();
  const pending = launch.controller.checkReminder.call(launch.panel);
  const profile = mount();
  profile.controller.methods.handlePasswordOpen.call(profile.panel);
  resolve({ hasPassword: true, mustChangePassword: true });
  await pending;
  expect(launch.panel.data.defaultPasswordReminderOpen).toBe(false);
  expect(profile.panel.data.passwordSheetOpen).toBe(true);
});

it('shares launch and editor state across independently bundled native entries', async () => {
  const output = await build({
    entryPoints: [
      fileURLToPath(new URL('../src/components/account-security/controller.ts', import.meta.url)),
    ],
    bundle: true,
    format: 'cjs',
    platform: 'neutral',
    write: false,
  });
  const app = { globalData: {} };
  const loadEntry = () => {
    const module = { exports: {} };
    runInNewContext(output.outputFiles[0].text, {
      module,
      exports: module.exports,
      getApp: () => app,
      wx: globalThis.wx,
    });
    const definition = module.exports.createAccountSecurityController(dependencies);
    const panel = {
      data: { ...definition.data },
      setData(patch) {
        Object.assign(this.data, patch);
      },
    };
    definition.initialize.call(panel);
    return { definition, panel };
  };
  const launch = loadEntry();
  const profile = loadEntry();
  profile.definition.methods.handlePasswordOpen.call(profile.panel);
  await launch.definition.checkReminder.call(launch.panel);
  expect(launch.panel.data.defaultPasswordReminderOpen).toBe(false);
  const restoredPage = loadEntry();
  await restoredPage.definition.checkReminder.call(restoredPage.panel);
  expect(dependencies.getPasswordStatus).toHaveBeenCalledTimes(1);
});
