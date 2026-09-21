import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ read: {}, write: {}, capability: vi.fn() }));
vi.mock('../src/platform/client-core-calendar.js', () => ({
  createRuntimeOrganizationReadClient: () => mocks.read,
  createRuntimeQrVisitorWriteClient: () => mocks.write,
}));
vi.mock('../src/platform/wechat-identity.js', () => ({
  getStoredWechatToken: vi.fn(),
  getWechatRequestAuthentication: vi.fn(),
}));
vi.mock('../src/platform/telemetry.js', () => ({ recordMiniTelemetryBoundary: vi.fn() }));
vi.mock('../src/app/client-capability-store.js', () => ({
  getClientCapabilitySnapshot: () => ({ organization: true, guest: true }),
  requireClientCapability: mocks.capability,
}));

const deferred = () => {
  let resolve;
  const promise = new Promise((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
};
const flush = async () => {
  for (let index = 0; index < 24; index += 1) await Promise.resolve();
};

describe('visitor QR image and lifecycle', () => {
  let definition;
  let page;

  beforeEach(async () => {
    vi.useFakeTimers();
    mocks.capability.mockReset().mockResolvedValue(undefined);
    mocks.read.listGroups = vi.fn().mockResolvedValue([
      { id: 'a', name: 'A', role: 'owner', version: 1 },
      { id: 'b', name: 'B', role: 'administrator', version: 2 },
    ]);
    mocks.read.listGroupMembers = vi
      .fn()
      .mockResolvedValue([{ id: 'member', realName: '测试', version: 1 }]);
    mocks.read.getSchedulingConfig = vi.fn().mockResolvedValue({ roles: [] });
    mocks.read.getVisitorQr = vi
      .fn()
      .mockResolvedValue({ environment: 'trial', imageBase64: 'iVBORw0KGgo=' });
    mocks.write.regenerateVisitorKey = vi.fn().mockResolvedValue({ visitorKeyChanged: true });
    vi.stubGlobal('wx', {
      getAccountInfoSync: () => ({ miniProgram: { envVersion: 'trial', version: 'test' } }),
      getWindowInfo: () => ({ windowWidth: 390, statusBarHeight: 24 }),
      showModal: vi.fn((options) => options.success({ confirm: true })),
    });
    const module =
      await import('../src/subpackages/organization/components/qr-visitor-panel/controller.ts');
    definition = module.createQrVisitorPanelControllerDefinition();
    page = {
      properties: { groupId: 'a' },
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

  async function loadQr() {
    definition.handleLoadQr.call(page);
    await flush();
  }

  it.each([
    ['iVBORw0KGgo=', 'data:image/png;base64,iVBORw0KGgo='],
    ['/9j/4AAQSkZJRgABAQAAAQABAAD/2Q==', 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2Q=='],
  ])('detects original QR image bytes without rewriting them', async (imageBase64, expected) => {
    mocks.read.getVisitorQr.mockResolvedValue({ environment: 'trial', imageBase64 });
    await loadQr();
    expect(page.data.qrImageSrc).toBe(expected);
    expect(page.data.visitorMessage).toContain('长按二维码保存或转发');
  });

  it.each(['AAAA', 'iVBORw0KGgo===', '/9j/@@', ''])(
    'rejects invalid QR image bytes %s',
    async (imageBase64) => {
      mocks.read.getVisitorQr.mockResolvedValue({ environment: 'trial', imageBase64 });
      await loadQr();
      expect(page.data.qrVisible).toBe(false);
      expect(page.data.qrImageSrc).toBe('');
      expect(page.data.visitorState).toBe('error');
    },
  );

  it('deduplicates reads and discards a late QR after the group changes', async () => {
    const pending = deferred();
    mocks.read.getVisitorQr.mockReturnValue(pending.promise);
    definition.handleLoadQr.call(page);
    definition.handleLoadQr.call(page);
    await flush();
    expect(mocks.read.getVisitorQr).toHaveBeenCalledTimes(1);
    page.properties = { groupId: 'b' };
    definition.observers.groupId.call(page);
    await flush();
    pending.resolve({ environment: 'trial', imageBase64: 'iVBORw0KGgo=' });
    await flush();
    expect(page.data.qrImageSrc).toBe('');
  });

  it('keeps manager QR reads but limits visitor-key rotation to the owner', async () => {
    page.properties = { groupId: 'b' };
    definition.observers.groupId.call(page);
    await flush();
    await loadQr();
    expect(page.data.qrVisible).toBe(true);
    definition.handleRegenerateVisitorKey.call(page);
    await flush();
    expect(mocks.write.regenerateVisitorKey).not.toHaveBeenCalled();
  });
});
