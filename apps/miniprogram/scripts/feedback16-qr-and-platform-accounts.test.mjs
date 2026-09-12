import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const qrMocks = vi.hoisted(() => ({ read: {}, write: {}, capability: vi.fn() }));
const accountMocks = vi.hoisted(() => ({
  read: {},
  account: {},
  identity: {},
  capability: vi.fn(),
}));

vi.mock('../src/platform/client-core-calendar.js', () => ({
  createRuntimeOrganizationReadClient: () => qrMocks.read,
  createRuntimeInviteVisitorWriteClient: () => qrMocks.write,
  createRuntimePlatformAccountClient: () => accountMocks.account,
  createRuntimePlatformIdentityWriteClient: () => accountMocks.identity,
}));
vi.mock('../src/platform/wechat-identity.js', () => ({
  getStoredWechatToken: vi.fn(),
  getStoredWechatProfile: vi.fn(),
  getWechatRequestAuthentication: vi.fn(),
  clearWechatSession: vi.fn(),
}));
vi.mock('../src/platform/telemetry.js', () => ({ recordMiniTelemetryBoundary: vi.fn() }));
vi.mock('../src/app/client-capability-store.js', () => ({
  getClientCapabilitySnapshot: () => ({ organization: true, guest: true }),
  requireClientCapability: vi.fn().mockResolvedValue(undefined),
}));

const flush = async () => {
  for (let i = 0; i < 24; i++) await Promise.resolve();
};

describe('Feedback16 QR interactions', () => {
  let definition;
  let page;
  let runtime;

  beforeEach(async () => {
    vi.resetModules();
    vi.resetAllMocks();
    vi.useFakeTimers();
    qrMocks.read.listGroups = vi
      .fn()
      .mockResolvedValue([{ id: 'group-1', name: '测试群', role: 'owner', version: 1 }]);
    qrMocks.read.listGroupMembers = vi.fn().mockResolvedValue([]);
    qrMocks.read.getSchedulingConfig = vi.fn().mockResolvedValue({ roles: [] });
    qrMocks.read.getGroupQr = vi.fn().mockResolvedValue({ imageBase64: 'iVBORw0KGgo=' });
    qrMocks.write.regenerateVisitorKey = vi.fn().mockResolvedValue({ visitorKeyChanged: true });
    runtime = {
      getWindowInfo: () => ({ windowWidth: 390, statusBarHeight: 24 }),
      previewImage: vi.fn((options) => options.success?.()),
      getFileSystemManager: vi.fn(() => ({ writeFile: vi.fn(), unlink: vi.fn() })),
    };
    vi.stubGlobal('wx', runtime);
    const module =
      await import('../src/subpackages/organization/components/invite-visitor-panel/controller.ts');
    definition = module.createInviteVisitorPanelControllerDefinition();
    page = {
      properties: { groupId: 'group-1' },
      data: { ...definition.data },
      setData(patch) {
        Object.assign(this.data, patch);
      },
    };
    definition.lifetimes.attached.call(page);
    await flush();
  });

  afterEach(() => {
    definition.lifetimes.detached.call(page);
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('previews the currently displayed QR and keeps save as fallback', async () => {
    definition.handleLoadQr.call(page);
    await flush();
    definition.handlePreviewQr.call(page);
    expect(runtime.previewImage).toHaveBeenCalledWith(
      expect.objectContaining({
        current: 'data:image/png;base64,iVBORw0KGgo=',
        urls: ['data:image/png;base64,iVBORw0KGgo='],
      }),
    );
  });

  it('shows the new QR automatically after rotation completes', async () => {
    qrMocks.read.getGroupQr
      .mockResolvedValueOnce({ imageBase64: 'iVBORw0KGgo=' })
      .mockResolvedValueOnce({ imageBase64: 'iVBORw0KGgoAAA==' });
    definition.handleLoadQr.call(page);
    await flush();
    definition.handleRegenerateVisitorKey.call(page);
    await flush();
    expect(qrMocks.write.regenerateVisitorKey).toHaveBeenCalledTimes(1);
    expect(qrMocks.read.getGroupQr).toHaveBeenCalledTimes(2);
    expect(page.data.qrImageSrc).toBe('data:image/png;base64,iVBORw0KGgoAAA==');
    expect(page.data.qrVisible).toBe(true);
  });

  it('falls back to the explicit save action when native preview fails', async () => {
    runtime.previewImage.mockImplementation((options) => options.fail?.({ errMsg: 'unsupported' }));
    definition.handleLoadQr.call(page);
    await flush();
    definition.handlePreviewQr.call(page);
    expect(page.data.infoTone).toBe('error');
    expect(page.data.infoMessage).toContain('保存到相册');
  });
});

describe('Feedback16 platform accounts', () => {
  let definition;
  let page;
  let windowWidth = 390;
  let fontSizeSetting = 16;

  beforeEach(async () => {
    vi.resetModules();
    vi.resetAllMocks();
    vi.useFakeTimers();
    accountMocks.read.listGroups = vi.fn();
    accountMocks.account.listDetails = vi.fn().mockResolvedValue([
      {
        id: 'account-1',
        accountKind: 'password',
        status: 'active',
        realName: '测试管理员',
        mobilePhone: '13800000000',
        username: 'admin',
        hasPassword: true,
        authVersion: 1,
        accountVersion: 1,
        profileVersion: 1,
      },
    ]);
    accountMocks.account.updateProfile = vi.fn().mockResolvedValue(undefined);
    accountMocks.identity.assignPasswordIdentity = vi.fn();
    accountMocks.identity.createWechatBindingLink = vi.fn();
    accountMocks.account.resetPassword = vi.fn();
    vi.stubGlobal('wx', {
      getWindowInfo: () => ({ windowWidth, fontSizeSetting, statusBarHeight: 24 }),
      navigateBack: vi.fn(),
    });
    const module =
      await import('../src/subpackages/organization/components/platform-accounts-panel/controller.ts');
    definition = module.createPlatformAccountsPanelControllerDefinition();
    page = {
      data: { ...definition.data },
      setData(patch) {
        Object.assign(this.data, patch);
      },
    };
    definition.lifetimes.attached.call(page);
    await flush();
    definition.handleOpenEditor.call(page, {
      currentTarget: { dataset: { accountId: 'account-1' } },
    });
  });

  afterEach(() => {
    definition.handleDispose.call(page);
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('uses a transient toast for successful account operations', async () => {
    definition.handleSaveProfile.call(page);
    await flush();
    expect(page.data.infoMessage).toContain('姓名与手机号已保存');
    vi.advanceTimersByTime(1999);
    expect(page.data.infoMessage).not.toBe('');
    vi.advanceTimersByTime(1);
    expect(page.data.infoMessage).toBe('');
  });

  it('uses the same transient host for operation failures', async () => {
    accountMocks.account.updateProfile.mockRejectedValueOnce(new Error('保存失败'));
    definition.handleSaveProfile.call(page);
    await flush();
    expect(page.data.infoTone).toBe('error');
    expect(page.data.infoMessage).toContain('保存失败');
    vi.advanceTimersByTime(2000);
    expect(page.data.infoMessage).toBe('');
  });

  it('keeps compact and large-text layout flags deterministic at 320px and 390px', async () => {
    expect(page.data.viewportClass).toBe('');
    expect(page.data.largeText).toBe(false);
    windowWidth = 320;
    fontSizeSetting = 20;
    const compact = {
      data: { ...definition.data },
      setData(patch) {
        Object.assign(this.data, patch);
      },
    };
    definition.lifetimes.attached.call(compact);
    await flush();
    expect(compact.data.viewportClass).toBe('is-compact');
    expect(compact.data.largeText).toBe(true);
  });

  it('declares one toast, keeps retry for page-load errors, and separates modal fields', () => {
    const root = 'src/subpackages/organization/';
    const template = readFileSync(`${root}components/platform-accounts-panel/index.wxml`, 'utf8');
    const pageConfig = JSON.parse(
      readFileSync(`${root}pages/platform-accounts/index.json`, 'utf8'),
    );
    const styles = readFileSync(`${root}components/platform-accounts-panel/index.wxss`, 'utf8');
    expect(template).toContain('<ui-toast');
    expect(template).toContain('message="{{infoMessage}}"');
    expect(template).toContain('bindpress="handleRetry"');
    expect(pageConfig.usingComponents['ui-toast']).toBe('/components/ui/ui-toast/index');
    expect(styles).toContain('padding-bottom: calc(24px + env(safe-area-inset-bottom));');
    expect(styles).toContain('.profile-save-button');
    expect(styles).toContain('.field-block + .field-block');
    expect(styles).toContain('.sheet-actions');
  });
});
