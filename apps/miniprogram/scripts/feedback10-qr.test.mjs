import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ read: {}, write: {}, capability: vi.fn() }));
vi.mock('../src/platform/client-core-calendar.js', () => ({
  createRuntimeOrganizationReadClient: () => mocks.read,
  createRuntimeInviteVisitorWriteClient: () => mocks.write,
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

const png = 'data:image/png;base64,iVBORw0KGgo=';
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const flush = async () => {
  for (let i = 0; i < 24; i++) await Promise.resolve();
};
let fs, runtime, definition, page;

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
  mocks.read.getGroupQr = vi.fn().mockResolvedValue({ imageBase64: 'iVBORw0KGgo=' });
  mocks.write.regenerateVisitorKey = vi.fn().mockResolvedValue({ visitorKeyChanged: true });
  mocks.write.createInviteLink = vi.fn().mockResolvedValue({
    token: 'fixture',
    version: 1,
    expiresAt: '2099-01-01',
    sharePath: '/fixture',
    groupName: 'A',
    realName: '测试',
  });
  mocks.write.revokeInvite = vi.fn().mockResolvedValue(undefined);
  fs = { writeFile: vi.fn((o) => o.success()), unlink: vi.fn((o) => o.success()) };
  runtime = {
    env: { USER_DATA_PATH: '/synthetic-user-data' },
    getFileSystemManager: vi.fn(() => fs),
    saveImageToPhotosAlbum: vi.fn((o) => o.success()),
    openSetting: vi.fn(),
    getWindowInfo: () => ({ windowWidth: 390, statusBarHeight: 24 }),
    showModal: vi.fn((o) => o.success({ confirm: true })),
  };
  vi.stubGlobal('wx', runtime);
  const module =
    await import('../src/subpackages/organization/components/invite-visitor-panel/controller.ts');
  definition = module.createInviteVisitorPanelControllerDefinition();
  // Native hosts do not copy underscore factory fields.
  page = {
    properties: { groupId: 'a' },
    data: { ...definition.data },
    setData: vi.fn(function (patch) {
      Object.assign(this.data, patch);
    }),
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
async function switchGroup(groupId = 'b') {
  page.properties = { groupId };
  definition.observers.groupId.call(page);
  await flush();
}

describe('feedback10 QR image adapter', () => {
  async function save(isCurrent = () => true, image = png) {
    const { saveVisitorQrImage } = await import('../src/platform/visitor-qr-image.ts');
    return saveVisitorQrImage(image, isCurrent);
  }
  it.each(['image/jpeg', 'image/png'])(
    'saves original JPEG bytes even when the legacy data URI claims %s',
    async (mime) => {
      const bytes = '/9j/4AAQSkZJRgABAQAAAQABAAD/2Q==';
      expect(await save(() => true, `data:${mime};base64,${bytes}`)).toBe('saved');
      expect(fs.writeFile.mock.calls[0][0]).toMatchObject({ data: bytes, encoding: 'base64' });
      expect(fs.writeFile.mock.calls[0][0].filePath).toMatch(/\.jpg$/);
    },
  );
  it.each(['AAAA', 'iVBORw0KGgo===', '/9j/@@', ''])(
    'rejects invalid image bytes %s',
    async (bytes) => {
      expect(await save(() => true, `data:image/png;base64,${bytes}`)).toBe('invalid-image');
      expect(fs.writeFile).not.toHaveBeenCalled();
    },
  );
  it('displays JPEG with its detected MIME before saving the same bytes', async () => {
    mocks.read.getGroupQr.mockResolvedValue({ imageBase64: '/9j/4AAQSkZJRgABAQAAAQABAAD/2Q==' });
    await loadQr();
    expect(page.data.qrImageSrc).toBe('data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2Q==');
  });
  it('does not display an unsupported response as a ready QR', async () => {
    mocks.read.getGroupQr.mockResolvedValue({ imageBase64: 'AAAA' });
    await loadQr();
    expect(page.data.qrVisible).toBe(false);
    expect(page.data.qrImageSrc).toBe('');
    expect(page.data.visitorState).toBe('error');
    expect(page.data.infoMessage).toBe('二维码图片无效，请重新读取。');
  });
  it('saves the original displayed PNG bytes and removes its unique file', async () => {
    expect(await save()).toBe('saved');
    const file = fs.writeFile.mock.calls[0][0];
    expect(file).toMatchObject({ data: 'iVBORw0KGgo=', encoding: 'base64' });
    expect(file.filePath).toMatch(/^\/synthetic-user-data\/visitor-qr-[a-z0-9-]+\.png$/);
    expect(runtime.saveImageToPhotosAlbum).toHaveBeenCalledWith(
      expect.objectContaining({ filePath: file.filePath }),
    );
    expect(fs.unlink).toHaveBeenCalledWith(expect.objectContaining({ filePath: file.filePath }));
    await save();
    expect(fs.writeFile.mock.calls[1][0].filePath).not.toBe(file.filePath);
  });
  it.each([
    ['cancel', 'cancelled'],
    ['auth deny', 'permission-denied'],
    ['authorize no response', 'permission-denied'],
    ['system denied', 'permission-denied'],
    ['disk error', 'save-failed'],
  ])('cleans up album failure %s without settings or automatic retries', async (errMsg, result) => {
    runtime.saveImageToPhotosAlbum.mockImplementation((o) => o.fail({ errMsg }));
    expect(await save()).toBe(result);
    expect(fs.unlink).toHaveBeenCalledTimes(1);
    expect(runtime.saveImageToPhotosAlbum).toHaveBeenCalledTimes(1);
    expect(runtime.openSetting).not.toHaveBeenCalled();
  });
  it.each(['callback', 'throw'])(
    'cleans a potentially partial write on %s failure',
    async (mode) => {
      fs.writeFile.mockImplementation((o) => {
        if (mode === 'throw') throw new Error('sensitive');
        o.fail({ errMsg: 'sensitive' });
      });
      expect(await save()).toBe('write-failed');
      expect(fs.unlink).toHaveBeenCalledTimes(1);
      expect(runtime.saveImageToPhotosAlbum).not.toHaveBeenCalled();
    },
  );
  it('cleans synchronous save failures and reports cleanup failure without leaking paths', async () => {
    runtime.saveImageToPhotosAlbum.mockImplementation(() => {
      throw new Error('sensitive');
    });
    expect(await save()).toBe('save-failed');
    fs.unlink.mockImplementation((o) => o.fail({ errMsg: 'sensitive' }));
    expect(await save()).toBe('save-failed');
  });
  it('keeps confirmed album success separate from cleanup failure', async () => {
    fs.unlink.mockImplementation((o) => o.fail({ errMsg: 'sensitive path' }));
    expect(await save()).toBe('saved-cleanup-failed');
  });
  it('classifies privacy rejection without exposing native text or paths', async () => {
    const slot = { errors: [], performance: [] };
    vi.stubGlobal('getApp', () => ({ globalData: { runtimeDiagnostics: slot } }));
    runtime.saveImageToPhotosAlbum.mockImplementation((o) =>
      o.fail({
        errMsg: 'saveImageToPhotosAlbum:fail privacy permission is not authorized /secret',
      }),
    );
    expect(await save()).toBe('privacy-denied');
    expect(slot.errors).toContainEqual(expect.objectContaining({ code: 'QR_PRIVACY_DENIED' }));
    expect(JSON.stringify(slot)).not.toContain('/secret');
  });
  it('retains both primary failure and cleanup diagnosis', async () => {
    const slot = { errors: [], performance: [] };
    vi.stubGlobal('getApp', () => ({ globalData: { runtimeDiagnostics: slot } }));
    runtime.saveImageToPhotosAlbum.mockImplementation((o) =>
      o.fail({ errMsg: 'unknown /private' }),
    );
    fs.unlink.mockImplementation((o) => o.fail({ errMsg: 'cleanup /private' }));
    expect(await save()).toBe('save-failed');
    expect(slot.errors.map((error) => error.code)).toEqual(['QR_SAVE_FAILED', 'QR_CLEANUP_FAILED']);
    expect(slot.performance.map((entry) => entry.metric)).toEqual([
      'qr:write-start',
      'qr:write-finished',
      'qr:album-start',
    ]);
    expect(JSON.stringify(slot)).not.toContain('/private');
  });
  it('shows confirmed save with cleanup warning instead of asking to save again', async () => {
    await loadQr();
    fs.unlink.mockImplementation((o) => o.fail({ errMsg: 'fixture' }));
    definition.handleSaveQr.call(page);
    await flush();
    expect(page.data.infoMessage).toBe('二维码已保存到相册，但临时文件清理失败，请联系管理员。');
    expect(runtime.saveImageToPhotosAlbum).toHaveBeenCalledTimes(1);
  });
  it('does not write stale or unsupported image material', async () => {
    expect(await save(() => false)).toBe('stale');
    expect(await save(() => true, 'https://example.test/qr.png')).toBe('invalid-image');
    expect(fs.writeFile).not.toHaveBeenCalled();
  });
  it('cleans completed writes if the context became stale before the album call', async () => {
    let current = true;
    fs.writeFile.mockImplementation((o) => {
      current = false;
      o.success();
    });
    expect(await save(() => current)).toBe('stale');
    expect(runtime.saveImageToPhotosAlbum).not.toHaveBeenCalled();
    expect(fs.unlink).toHaveBeenCalledTimes(1);
  });
});

describe('feedback10 invitation visitor lifecycle', () => {
  it('keeps the newest QR after an old read completes across rotation', async () => {
    const old = deferred();
    mocks.read.getGroupQr.mockReturnValueOnce(old.promise);
    await loadQr();
    definition.handleRegenerateVisitorKey.call(page);
    await flush();
    mocks.read.getGroupQr.mockResolvedValue({ imageBase64: 'iVBORw0KGgoAAA==' });
    await loadQr();
    old.resolve({ imageBase64: 'iVBORw0KGgo=' });
    await flush();
    expect(page.data.qrImageSrc).toBe('data:image/png;base64,iVBORw0KGgoAAA==');
    definition.handleSaveQr.call(page);
    await flush();
    expect(fs.writeFile).toHaveBeenCalledWith(
      expect.objectContaining({ data: 'iVBORw0KGgoAAA==' }),
    );
  });
  it('does not write on read; saves only on click and prevents overlapping saves', async () => {
    await loadQr();
    expect(fs.writeFile).not.toHaveBeenCalled();
    let complete;
    runtime.saveImageToPhotosAlbum.mockImplementation((o) => {
      complete = o.success;
    });
    definition.handleSaveQr.call(page);
    definition.handleSaveQr.call(page);
    await flush();
    expect(runtime.saveImageToPhotosAlbum).toHaveBeenCalledTimes(1);
    expect(page.data.qrSaving).toBe(true);
    complete();
    await flush();
    expect(page.data.qrSaving).toBe(false);
    expect(page.data.infoMessage).toContain('已保存');
    vi.advanceTimersByTime(2000);
    expect(page.data.infoMessage).toBe('');
  });
  it.each(['switch', 'empty', 'detach'])('rejects a late QR read after %s', async (action) => {
    const pending = deferred();
    mocks.read.getGroupQr.mockReturnValue(pending.promise);
    await loadQr();
    if (action === 'detach') definition.lifetimes.detached.call(page);
    else await switchGroup(action === 'empty' ? '' : 'b');
    const calls = page.setData.mock.calls.length;
    pending.resolve({ imageBase64: 'iVBORw0KGgo=' });
    await flush();
    expect(page.data.qrImageSrc).toBe('');
    expect(page.setData.mock.calls.length).toBe(calls);
  });
  it('rotation immediately clears displayed QR and defeats earlier reads', async () => {
    await loadQr();
    const pending = deferred();
    mocks.read.getGroupQr.mockReturnValue(pending.promise);
    await loadQr();
    definition.handleRegenerateVisitorKey.call(page);
    await flush();
    expect(page.data.qrImageSrc).toBe('');
    expect(page.data.qrVisible).toBe(false);
    pending.resolve({ imageBase64: 'iVBORw0KGgo=' });
    await flush();
    expect(page.data.qrImageSrc).toBe('');
    expect(page.data.infoMessage).toContain('已轮换');
    definition.handleSaveQr.call(page);
    await flush();
    expect(fs.writeFile).not.toHaveBeenCalled();
  });
  it.each(['switch', 'rotate', 'hide', 'detach'])(
    'cancels pending save before album write after %s',
    async (action) => {
      await loadQr();
      let write;
      fs.writeFile.mockImplementation((o) => {
        write = o;
      });
      definition.handleSaveQr.call(page);
      await flush();
      expect(write).toBeDefined();
      if (action === 'switch') await switchGroup();
      if (action === 'rotate') {
        definition.handleRegenerateVisitorKey.call(page);
        await flush();
      }
      if (action === 'hide') definition.handleHideQr.call(page);
      if (action === 'detach') definition.lifetimes.detached.call(page);
      write.success();
      await flush();
      expect(runtime.saveImageToPhotosAlbum).not.toHaveBeenCalled();
      expect(fs.unlink).toHaveBeenCalledTimes(1);
    },
  );
  it('suppresses late rotation results and late capability errors after switching', async () => {
    const pending = deferred();
    mocks.write.regenerateVisitorKey.mockReturnValue(pending.promise);
    definition.handleRegenerateVisitorKey.call(page);
    await flush();
    await switchGroup();
    pending.resolve({ visitorKeyChanged: true });
    await flush();
    expect(page.data.infoMessage).toBe('');
    const capability = deferred();
    mocks.capability.mockReturnValue(capability.promise);
    definition.handleLoadQr.call(page);
    await flush();
    await switchGroup('a');
    capability.reject(new Error('old error'));
    await flush();
    expect(page.data.infoMessage).toBe('');
  });
  it('keeps permission recovery user-initiated and never repeats a save after settings', async () => {
    await loadQr();
    runtime.saveImageToPhotosAlbum.mockImplementation((o) => o.fail({ errMsg: 'auth deny' }));
    definition.handleSaveQr.call(page);
    await flush();
    expect(page.data.albumPermissionDenied).toBe(true);
    expect(runtime.openSetting).not.toHaveBeenCalled();
    definition.handleAlbumSettings.call(page, {
      detail: { authSetting: { 'scope.writePhotosAlbum': true } },
    });
    await flush();
    expect(runtime.saveImageToPhotosAlbum).toHaveBeenCalledTimes(1);
    expect(page.data.albumPermissionDenied).toBe(false);
    expect(page.data.infoMessage).toContain('再次点击');
  });
  it('preserves manager reads and owner-only rotation and blocks unauthorized saving', async () => {
    await switchGroup();
    await loadQr();
    expect(page.data.qrVisible).toBe(true);
    definition.handleRegenerateVisitorKey.call(page);
    await flush();
    expect(mocks.write.regenerateVisitorKey).not.toHaveBeenCalled();
    page.data.canManage = false;
    definition.handleSaveQr.call(page);
    await flush();
    expect(fs.writeFile).not.toHaveBeenCalled();
  });
  it('keeps the save lock until cleanup completes even after switching groups', async () => {
    await loadQr();
    let completeSave, completeCleanup;
    runtime.saveImageToPhotosAlbum.mockImplementation((o) => {
      completeSave = o.success;
    });
    fs.unlink.mockImplementation((o) => {
      completeCleanup = o.success;
    });
    definition.handleSaveQr.call(page);
    await flush();
    await switchGroup();
    await loadQr();
    definition.handleSaveQr.call(page);
    await flush();
    expect(runtime.saveImageToPhotosAlbum).toHaveBeenCalledTimes(1);
    completeSave();
    await flush();
    definition.handleSaveQr.call(page);
    await flush();
    expect(runtime.saveImageToPhotosAlbum).toHaveBeenCalledTimes(1);
    completeCleanup();
    await flush();
    expect(page.data.qrSaving).toBe(false);
    expect(page.data.infoMessage).not.toContain('已保存');
  });
  it('does not write late album results or permission prompts to a detached page', async () => {
    await loadQr();
    let fail;
    runtime.saveImageToPhotosAlbum.mockImplementation((o) => {
      fail = o.fail;
    });
    definition.handleSaveQr.call(page);
    await flush();
    definition.lifetimes.detached.call(page);
    const calls = page.setData.mock.calls.length;
    fail({ errMsg: 'auth deny' });
    await flush();
    expect(fs.unlink).toHaveBeenCalledTimes(1);
    expect(page.setData.mock.calls.length).toBe(calls);
    expect(runtime.openSetting).not.toHaveBeenCalled();
  });
  it.each(['handleCreateInvite', 'handleRevokeInvite', 'handleRegenerateVisitorKey'])(
    'expires %s errors without a static alert',
    async (handler) => {
      definition.handleCreateInvite.call(page);
      await flush();
      mocks.write.createInviteLink.mockRejectedValue(new Error('操作失败'));
      mocks.write.revokeInvite.mockRejectedValue(new Error('操作失败'));
      mocks.write.regenerateVisitorKey.mockRejectedValue(new Error('操作失败'));
      definition[handler].call(page);
      await flush();
      expect(page.data.infoTone).toBe('error');
      expect(page.data.infoMessage).toContain('操作失败');
      vi.advanceTimersByTime(2000);
      expect(page.data.infoMessage).toBe('');
    },
  );
  it('deduplicates QR reads and rotations and prevents reading during a rotation', async () => {
    const read = deferred();
    mocks.read.getGroupQr.mockReturnValue(read.promise);
    definition.handleLoadQr.call(page);
    definition.handleLoadQr.call(page);
    await flush();
    expect(mocks.read.getGroupQr).toHaveBeenCalledTimes(1);
    const rotate = deferred();
    mocks.write.regenerateVisitorKey.mockReturnValue(rotate.promise);
    definition.handleRegenerateVisitorKey.call(page);
    definition.handleRegenerateVisitorKey.call(page);
    await flush();
    definition.handleLoadQr.call(page);
    await flush();
    expect(mocks.read.getGroupQr).toHaveBeenCalledTimes(1);
    expect(mocks.write.regenerateVisitorKey).toHaveBeenCalledTimes(1);
    read.reject(new Error('old read'));
    rotate.resolve({ visitorKeyChanged: true });
    await flush();
    expect(page.data.qrImageSrc).toBe('');
    expect(page.data.infoMessage).toContain('已轮换');
  });
  it('shows create, revoke, read, rotate and failure feedback for two seconds, replacing old expiry', async () => {
    for (const [handler, text] of [
      ['handleCreateInvite', '邀请已生成'],
      ['handleRevokeInvite', '已撤销'],
      ['handleLoadQr', '二维码'],
      ['handleRegenerateVisitorKey', '已轮换'],
    ]) {
      definition[handler].call(page);
      await flush();
      expect(page.data.infoMessage).toContain(text);
      vi.advanceTimersByTime(1999);
      expect(page.data.infoMessage).not.toBe('');
      vi.advanceTimersByTime(1);
      expect(page.data.infoMessage).toBe('');
    }
    mocks.read.getGroupQr.mockRejectedValue(new Error('读取失败'));
    await loadQr();
    expect(page.data.infoTone).toBe('error');
    vi.advanceTimersByTime(1000);
    definition.handleCreateInvite.call(page);
    await flush();
    vi.advanceTimersByTime(1000);
    expect(page.data.infoMessage).toContain('邀请已生成');
    vi.advanceTimersByTime(1000);
    expect(page.data.infoMessage).toBe('');
    await loadQr();
    definition.lifetimes.detached.call(page);
    const calls = page.setData.mock.calls.length;
    vi.advanceTimersByTime(2000);
    expect(page.setData.mock.calls.length).toBe(calls);
  });
  it('uses one toast, retains page retry, and declares the leaf component on both hosts', () => {
    const root = 'src/subpackages/organization/';
    const template = readFileSync(root + 'components/invite-visitor-panel/index.wxml', 'utf8');
    expect(template.match(/<ui-toast\b/g)).toHaveLength(1);
    expect(template).not.toContain('message="{{managementInfo}}"');
    expect(template).not.toContain('message="{{visitorMessage}}"');
    expect(template).toContain('bindpress="handleRetry"');
    expect(template).toContain('bindpress="handleSaveQr"');
    expect(template).toContain('open-type="openSetting"');
    expect(template).not.toContain('二维码不会写入缓存、相册或日志');
    for (const host of ['components/invite-visitor-panel', 'pages/invite-visitor']) {
      expect(
        JSON.parse(readFileSync(root + host + '/index.json', 'utf8')).usingComponents['ui-toast'],
      ).toBe('/components/ui/ui-toast/index');
    }
  });
});
