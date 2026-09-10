import { readFileSync } from 'node:fs';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({
  token: undefined,
  generation: 1,
  resolve: vi.fn(),
  accept: vi.fn(),
  refresh: vi.fn(),
  selectGroup: vi.fn(),
}));
vi.mock('../src/platform/client-core-calendar.js', () => ({
  createRuntimeOrganizationReadClient: () => ({ resolveInvite: mock.resolve }),
  createRuntimeInviteVisitorWriteClient: () => ({ acceptInvite: mock.accept }),
}));
vi.mock('../src/platform/wechat-identity.js', () => ({
  awaitWechatSessionRecovery: async () => {},
  getStoredWechatToken: () => mock.token,
  getWechatSessionGeneration: () => mock.generation,
  refreshWechatSessionAfterInvite: (...args) => mock.refresh(...args),
  finalizeWechatUnauthorized: () => {
    mock.token = undefined;
    mock.generation++;
  },
}));
vi.mock('../src/platform/workbench-read.js', () => ({
  writeStoredWorkbenchGroupId: (...args) => mock.selectGroup(...args),
}));
const preview = {
  groupId: 'group',
  groupName: '测试群组',
  inviteeRealName: '受邀成员',
  permissionRole: 'member',
  version: 3,
};
let definition;
const createPage = () => {
  const page = {
    ...definition,
    data: structuredClone(definition.data),
    setData(patch) {
      Object.assign(this.data, patch);
    },
  };
  page.onLoad({ t: 'invite-token-fixture' });
  return page;
};
beforeEach(async () => {
  vi.resetModules();
  mock.token = 'old-session';
  mock.generation = 1;
  for (const key of ['resolve', 'accept', 'refresh', 'selectGroup']) mock[key].mockReset();
  mock.resolve.mockResolvedValue(preview);
  mock.accept.mockResolvedValue({ group: { id: 'group' }, token: 'new-session' });
  mock.refresh.mockImplementation(async () => {
    mock.generation++;
    return { profile: { id: 'merged-user' }, generation: mock.generation };
  });
  vi.stubGlobal('Page', (value) => {
    definition = value;
  });
  vi.stubGlobal('wx', { navigateTo: vi.fn(), reLaunch: vi.fn(), setStorageSync: vi.fn() });
  await import('../src/subpackages/organization/pages/invite-accept/index.ts');
});
afterEach(() => vi.unstubAllGlobals());

describe('feedback8 invitation receiver', () => {
  it('does not let an old 401 clear a newer login or leave the page busy', async () => {
    let reject;
    mock.resolve.mockImplementation(
      () =>
        new Promise((_, fail) => {
          reject = fail;
        }),
    );
    const page = createPage();
    page.onShow();
    await vi.waitFor(() => expect(mock.resolve).toHaveBeenCalled());
    mock.token = 'newer-account';
    mock.generation = 2;
    reject(
      Object.assign(new Error('old unauthorized'), {
        code: 'AUTHENTICATION_REQUIRED',
        status: 401,
      }),
    );
    await vi.waitFor(() => expect(page.data.busy).toBe(false));
    expect(mock.token).toBe('newer-account');
  });
  it('retries navigation without refreshing the successfully replaced session again', async () => {
    mock.refresh.mockImplementation(async () => {
      mock.generation++;
      return { profile: { id: 'merged-user' }, generation: mock.generation };
    });
    globalThis.wx.reLaunch.mockImplementationOnce(({ fail }) => fail());
    const page = createPage();
    page.onShow();
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));
    page.handleNameInput({ detail: { value: '受邀成员' } });
    page.handleAccept();
    await vi.waitFor(() => expect(page.data.busy).toBe(false));
    page.handleRetry();
    await vi.waitFor(() => expect(globalThis.wx.reLaunch).toHaveBeenCalledTimes(2));
    expect(mock.refresh).toHaveBeenCalledTimes(1);
  });
  it('offers login after the accepted invitation session is rejected without accepting again', async () => {
    mock.refresh.mockRejectedValue(
      Object.assign(new Error('login required'), { code: 'INVITE_SESSION_REFRESH_UNAUTHORIZED' }),
    );
    const page = createPage();
    page.onShow();
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));
    page.handleNameInput({ detail: { value: '受邀成员' } });
    page.handleAccept();
    await vi.waitFor(() => expect(page.data.busy).toBe(false));
    expect(page.data.state).toBe('login');
    expect(mock.accept).toHaveBeenCalledTimes(1);
  });
  it('keeps the invite credential only in page memory across login', async () => {
    mock.token = undefined;
    const page = createPage();
    page.onShow();
    await vi.waitFor(() => expect(page.data.state).toBe('login'));
    expect(mock.resolve).not.toHaveBeenCalled();
    page.handleLogin();
    expect(globalThis.wx.navigateTo).toHaveBeenCalledWith({
      url: '/pages/identity/index?returnTo=invite',
    });
    expect(JSON.stringify(page.data)).not.toContain('invite-token-fixture');
    expect(globalThis.wx.setStorageSync).not.toHaveBeenCalled();
    mock.token = 'logged-in';
    page.onShow();
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));
    expect(mock.resolve).toHaveBeenCalledWith('invite-token-fixture');
    page.onUnload();
    expect(page._token).toBe('');
  });
  it('requires the confirmed name, accepts once, and only retries profile refresh after success', async () => {
    mock.refresh.mockRejectedValueOnce(new Error('refresh temporarily failed'));
    const page = createPage();
    page.onShow();
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));
    page.handleAccept();
    expect(mock.accept).not.toHaveBeenCalled();
    page.handleNameInput({ detail: { value: '受邀成员' } });
    page.handleAccept();
    page.handleAccept();
    await vi.waitFor(() => expect(page.data.busy).toBe(false));
    expect(mock.accept).toHaveBeenCalledTimes(1);
    expect(mock.accept.mock.calls[0][0]).toMatchObject({
      token: 'invite-token-fixture',
      confirmRealName: '受邀成员',
      expectedVersion: 3,
    });
    expect(page.data.state).toBe('accepted');
    expect(page._token).toBe('');
    page.handleRetry();
    await vi.waitFor(() => expect(globalThis.wx.reLaunch).toHaveBeenCalled());
    expect(mock.accept).toHaveBeenCalledTimes(1);
    expect(mock.refresh.mock.calls[0][0]).toBe('new-session');
    expect(mock.selectGroup).toHaveBeenCalledWith('merged-user', 'group');
  });
  it('reuses the exact acceptance request after an uncertain network failure', async () => {
    mock.accept.mockRejectedValueOnce(new Error('network unavailable'));
    const page = createPage();
    page.onShow();
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));
    page.handleNameInput({ detail: { value: '受邀成员' } });
    page.handleAccept();
    await vi.waitFor(() => expect(page.data.state).toBe('error'));
    page.handleRetry();
    await vi.waitFor(() => expect(mock.accept).toHaveBeenCalledTimes(2));
    expect(mock.accept.mock.calls[0][0]).toBe(mock.accept.mock.calls[1][0]);
  });
  it('does not persist a result received after the page was destroyed', async () => {
    let complete;
    mock.accept.mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    const page = createPage();
    page.onShow();
    await vi.waitFor(() => expect(page.data.state).toBe('ready'));
    page.handleNameInput({ detail: { value: '受邀成员' } });
    page.handleAccept();
    page.onUnload();
    complete({ group: { id: 'group' }, token: 'new-session' });
    await Promise.resolve();
    await Promise.resolve();
    expect(mock.refresh).not.toHaveBeenCalled();
  });
  it('registers the server-provided route and exposes a native share button', () => {
    const read = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
    expect(JSON.parse(read('app.json')).pages).toContain('pages/invite/invite');
    expect(read('subpackages/organization/components/invite-visitor-panel/index.wxml')).toContain(
      'open-type="share"',
    );
    expect(read('subpackages/organization/pages/invite-visitor/index.ts')).toContain(
      'onShareAppMessage',
    );
    expect(read('subpackages/organization/pages/invite-accept/index.wxml')).toContain(
      'bindpress="handleAccept"',
    );
  });
});
