import type {
  AcceptInviteResponse,
  GroupSummary,
  UserProfile,
  WechatLoginResponse,
} from '@schedule/contracts';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../api/client.js', async () => {
  const actual = await vi.importActual<typeof import('../api/client.js')>('../api/client.js');
  return {
    ...actual,
    getStoredToken: () => undefined,
    storeToken: vi.fn(),
  };
});

import { ApiClientError } from '../api/client.js';
import { createSessionStore, type SessionDependencies } from './session.js';

const profile: UserProfile = { id: 'user-1', realName: '张医生', version: 1 };
const group: GroupSummary = { id: 'group-1', name: '内科', role: 'owner', version: 1 };
const joinedProfile: UserProfile = { id: 'user-2', realName: '张医生', version: 2 };
const joinedGroup: GroupSummary = {
  id: 'group-2',
  name: '外科',
  role: 'member',
  version: 1,
};

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function createDependencies(overrides: Partial<SessionDependencies> = {}) {
  return {
    acceptInvite: vi.fn<SessionDependencies['acceptInvite']>(() => Promise.resolve({ group })),
    createUserProfile: vi.fn<SessionDependencies['createUserProfile']>(() =>
      Promise.resolve(profile),
    ),
    getCurrentProfile: vi.fn<SessionDependencies['getCurrentProfile']>(() =>
      Promise.resolve(profile),
    ),
    getPlatformMe: vi.fn<SessionDependencies['getPlatformMe']>(() =>
      Promise.resolve({ isPlatformAdmin: false }),
    ),
    listGroups: vi.fn<SessionDependencies['listGroups']>(() => Promise.resolve([group])),
    readPendingInviteToken: vi.fn<SessionDependencies['readPendingInviteToken']>(() => undefined),
    readStoredToken: vi.fn<SessionDependencies['readStoredToken']>(() => undefined),
    requestLoginCode: vi.fn<SessionDependencies['requestLoginCode']>(() =>
      Promise.resolve('wx-code'),
    ),
    removeCalendarCacheForUser: vi.fn<SessionDependencies['removeCalendarCacheForUser']>(),
    removeCalendarCacheForUserGroup:
      vi.fn<SessionDependencies['removeCalendarCacheForUserGroup']>(),
    sessionStorage: {
      readLastGroupId: vi.fn(),
      removeLastGroupId: vi.fn(),
      writeLastGroupId: vi.fn(),
    },
    wechatLogin: vi.fn<SessionDependencies['wechatLogin']>(() =>
      Promise.resolve({ isNewUser: false, profile, token: 'login-token' }),
    ),
    writePendingInviteToken: vi.fn<SessionDependencies['writePendingInviteToken']>(),
    writeStoredToken: vi.fn<SessionDependencies['writeStoredToken']>(),
    ...overrides,
  } satisfies SessionDependencies;
}

describe('session store', () => {
  it('restores no-token state without making a request', async () => {
    const dependencies = createDependencies({ readStoredToken: () => undefined });
    const store = createSessionStore(dependencies);
    await store.restore();
    expect(store.state.status).toBe('anonymous');
    expect(dependencies.getCurrentProfile).not.toHaveBeenCalled();
  });

  it('coalesces duplicate restore calls and loads profile, groups, and platform status once', async () => {
    const deferred = createDeferred<UserProfile>();
    const dependencies = createDependencies({
      getCurrentProfile: vi.fn(() => deferred.promise),
      readStoredToken: () => 'stored-token',
    });
    const store = createSessionStore(dependencies);
    const first = store.restore();
    expect(store.restore()).toBe(first);
    deferred.resolve(profile);
    await first;
    expect(dependencies.getCurrentProfile).toHaveBeenCalledTimes(1);
    expect(dependencies.listGroups).toHaveBeenCalledTimes(1);
    expect(dependencies.getPlatformMe).toHaveBeenCalledTimes(1);
    expect(store.state).toMatchObject({ status: 'authenticated', token: 'stored-token' });
  });

  it('keeps a profile-and-groups session authenticated when the auxiliary platform lookup fails', async () => {
    const dependencies = createDependencies({
      getPlatformMe: vi.fn(() => Promise.reject(new Error('platform unavailable'))),
      readStoredToken: () => 'stored-token',
    });
    const store = createSessionStore(dependencies);

    await store.restore();

    expect(store.state).toMatchObject({
      groups: [group],
      isPlatformAdmin: false,
      profile,
      status: 'authenticated',
      token: 'stored-token',
    });
    expect(dependencies.getPlatformMe).toHaveBeenCalledOnce();
  });

  it('preserves protected-401 cleanup when the auxiliary platform lookup rejects authentication', async () => {
    const dependencies = createDependencies({
      getPlatformMe: vi.fn(() =>
        Promise.reject(
          new ApiClientError('AUTHENTICATION_REQUIRED', 'expired', undefined, undefined, 401),
        ),
      ),
      readStoredToken: () => 'stored-token',
    });
    const store = createSessionStore(dependencies);

    await store.restore();

    expect(store.state.status).toBe('anonymous');
    expect(dependencies.writeStoredToken).toHaveBeenCalledWith(undefined);
  });

  it('prioritizes auxiliary platform 401 cleanup even when groups also fail', async () => {
    const dependencies = createDependencies({
      getPlatformMe: vi.fn(() =>
        Promise.reject(
          new ApiClientError('AUTHENTICATION_REQUIRED', 'expired', undefined, undefined, 401),
        ),
      ),
      listGroups: vi.fn(() => Promise.reject(new Error('groups unavailable'))),
      readStoredToken: () => 'stored-token',
    });
    const store = createSessionStore(dependencies);

    await store.restore();

    expect(store.state.status).toBe('anonymous');
    expect(dependencies.writeStoredToken).toHaveBeenCalledWith(undefined);
  });

  it('waits for a late platform result so an earlier groups failure cannot hide a protected 401', async () => {
    const platform = createDeferred<{ readonly isPlatformAdmin: boolean }>();
    const dependencies = createDependencies({
      getPlatformMe: vi.fn(() => platform.promise),
      listGroups: vi.fn(() => Promise.reject(new Error('groups unavailable'))),
      readStoredToken: () => 'stored-token',
    });
    const store = createSessionStore(dependencies);

    const restoring = store.restore();
    let restoreSettled = false;
    void restoring.then(() => {
      restoreSettled = true;
    });
    await vi.waitFor(() => expect(dependencies.listGroups).toHaveBeenCalledOnce());
    await Promise.resolve();
    await Promise.resolve();
    expect(restoreSettled).toBe(false);
    platform.reject(
      new ApiClientError('AUTHENTICATION_REQUIRED', 'expired', undefined, undefined, 401),
    );
    await restoring;

    expect(store.state.status).toBe('anonymous');
    expect(dependencies.writeStoredToken).toHaveBeenCalledWith(undefined);
  });

  it('treats profile NOT_FOUND as needs-profile and protected 401 as anonymous', async () => {
    const missing = createDependencies({
      getCurrentProfile: vi.fn(() =>
        Promise.reject(new ApiClientError('NOT_FOUND', 'missing', undefined, undefined, 404)),
      ),
      readStoredToken: () => 'stored-token',
    });
    const missingStore = createSessionStore(missing);
    await missingStore.restore();
    expect(missingStore.state).toMatchObject({ status: 'needs-profile', token: 'stored-token' });
    const expired = createDependencies({
      getCurrentProfile: vi.fn(() =>
        Promise.reject(
          new ApiClientError('AUTHENTICATION_REQUIRED', 'expired', undefined, undefined, 401),
        ),
      ),
      readStoredToken: () => 'stored-token',
    });
    const expiredStore = createSessionStore(expired);
    await expiredStore.restore();
    expect(expiredStore.state.status).toBe('anonymous');
    expect(expired.writeStoredToken).toHaveBeenCalledWith(undefined);
  });

  it('uses profile presence rather than isNewUser and single-flights repeated sign-in', async () => {
    const deferred = createDeferred<WechatLoginResponse>();
    const dependencies = createDependencies({ wechatLogin: vi.fn(() => deferred.promise) });
    const store = createSessionStore(dependencies);
    const first = store.signInWithWechat();
    expect(store.signInWithWechat()).toBe(first);
    deferred.resolve({ isNewUser: false, token: 'new-token' });
    await first;
    expect(dependencies.requestLoginCode).toHaveBeenCalledTimes(1);
    expect(dependencies.wechatLogin).toHaveBeenCalledWith('wx-code');
    expect(store.state.status).toBe('needs-profile');
  });

  it('authenticates when a profile exists even if isNewUser is true', async () => {
    const dependencies = createDependencies({
      wechatLogin: vi.fn(() => Promise.resolve({ isNewUser: true, profile, token: 'token' })),
    });
    const store = createSessionStore(dependencies);
    await store.signInWithWechat();
    expect(store.state).toMatchObject({ profile, status: 'authenticated' });
  });

  it('trims and creates a missing profile once, then loads role context', async () => {
    const dependencies = createDependencies({
      getCurrentProfile: vi.fn(() =>
        Promise.reject(new ApiClientError('NOT_FOUND', 'missing', undefined, undefined, 404)),
      ),
      readStoredToken: () => 'stored-token',
    });
    const store = createSessionStore(dependencies);
    await store.restore();
    const first = store.completeProfile('  张医生 ');
    expect(store.completeProfile('  张医生 ')).toBe(first);
    await first;
    expect(dependencies.createUserProfile).toHaveBeenCalledWith('张医生');
    expect(store.state.status).toBe('authenticated');
  });

  it('does not POST a second profile when role context fails after creation', async () => {
    const listGroups = vi
      .fn<SessionDependencies['listGroups']>()
      .mockRejectedValueOnce(new Error('groups unavailable'))
      .mockResolvedValueOnce([group]);
    const dependencies = createDependencies({
      getCurrentProfile: vi.fn(() =>
        Promise.reject(new ApiClientError('NOT_FOUND', 'missing', undefined, undefined, 404)),
      ),
      listGroups,
      readStoredToken: () => 'stored-token',
    });
    const store = createSessionStore(dependencies);
    await store.restore();
    await expect(store.completeProfile('张医生')).rejects.toThrow('groups unavailable');
    await store.completeProfile('张医生');
    expect(dependencies.createUserProfile).toHaveBeenCalledTimes(1);
  });

  it('marks protected unauthorized state after safely purging the current session', async () => {
    const dependencies = createDependencies({ readStoredToken: () => 'stored-token' });
    const store = createSessionStore(dependencies);
    await store.restore();
    store.markUnauthorized();
    expect(store.state.status).toBe('anonymous');
    expect(dependencies.writeStoredToken).toHaveBeenCalledWith(undefined);
  });

  it('does not resurrect a late sign-in after an unauthorized transition', async () => {
    const deferred = createDeferred<WechatLoginResponse>();
    const dependencies = createDependencies({ wechatLogin: vi.fn(() => deferred.promise) });
    const store = createSessionStore(dependencies);
    const pending = store.signInWithWechat();
    await vi.waitFor(() => expect(dependencies.wechatLogin).toHaveBeenCalledOnce());
    store.markUnauthorized();
    deferred.resolve({ isNewUser: false, profile, token: 'late' });
    await pending;
    expect(store.state.status).toBe('anonymous');
  });

  it('lets a new sign-in supersede a deferred stored-token restore', async () => {
    const deferred = createDeferred<UserProfile>();
    const dependencies = createDependencies({
      getCurrentProfile: vi.fn(() => deferred.promise),
      readStoredToken: () => 'stored-token',
      wechatLogin: vi.fn(() => Promise.resolve({ isNewUser: false, profile, token: 'new-token' })),
    });
    const store = createSessionStore(dependencies);
    const restoring = store.restore();
    await vi.waitFor(() => expect(dependencies.getCurrentProfile).toHaveBeenCalledOnce());
    await store.signInWithWechat();
    deferred.resolve(profile);
    await restoring;
    expect(store.state).toMatchObject({ profile, status: 'authenticated', token: 'new-token' });
  });

  it('does not publish late profile context after clear invalidates the operation', async () => {
    const deferred = createDeferred<GroupSummary[]>();
    const dependencies = createDependencies({
      getCurrentProfile: vi.fn(() =>
        Promise.reject(new ApiClientError('NOT_FOUND', 'missing', undefined, undefined, 404)),
      ),
      listGroups: vi.fn(() => deferred.promise),
      readStoredToken: () => 'stored-token',
    });
    const store = createSessionStore(dependencies);
    await store.restore();
    const pending = store.completeProfile('张医生');
    await vi.waitFor(() => expect(dependencies.listGroups).toHaveBeenCalledOnce());
    store.clear();
    deferred.resolve([group]);
    await pending;
    expect(store.state.status).toBe('anonymous');
  });

  it('persists an invite token override before clearing pending state and never clears on failure', async () => {
    const calls: string[] = [];
    const dependencies = createDependencies({
      acceptInvite: vi.fn(async () => {
        calls.push('accept');
        return { group, token: 'merged-token' };
      }),
      readPendingInviteToken: () => 'invite-token',
      readStoredToken: () => 'stored-token',
      writePendingInviteToken: vi.fn((token) => calls.push(`pending:${String(token)}`)),
      writeStoredToken: vi.fn((token) => calls.push(`session:${String(token)}`)),
    });
    const store = createSessionStore(dependencies);
    await store.restore();
    await store.consumePendingInvite();
    expect(calls).toEqual(['accept', 'session:merged-token', 'pending:undefined']);
  });

  it('commits an accepted invite once, removes stale authority, and retries only context refresh', async () => {
    const calls: string[] = [];
    let pendingInviteToken: string | undefined = 'invite-token';
    const listGroups = vi
      .fn<SessionDependencies['listGroups']>()
      .mockResolvedValueOnce([group])
      .mockRejectedValueOnce(new Error('groups unavailable'))
      .mockResolvedValueOnce([joinedGroup]);
    const dependencies = createDependencies({
      acceptInvite: vi.fn(async () => {
        calls.push('accept');
        return { group: joinedGroup, token: 'merged-token' };
      }),
      getCurrentProfile: vi
        .fn<SessionDependencies['getCurrentProfile']>()
        .mockResolvedValueOnce(profile)
        .mockResolvedValue(joinedProfile),
      listGroups,
      readPendingInviteToken: () => pendingInviteToken,
      readStoredToken: () => 'stored-token',
      writePendingInviteToken: vi.fn((token) => {
        calls.push(`pending:${String(token)}`);
        pendingInviteToken = token;
      }),
      writeStoredToken: vi.fn((token) => calls.push(`session:${String(token)}`)),
    });
    const store = createSessionStore(dependencies);
    await store.restore();

    await expect(store.consumePendingInvite()).resolves.toEqual({
      errorMessage: 'groups unavailable',
      status: 'committed-refresh-failed',
    });

    expect(calls).toEqual(['accept', 'session:merged-token', 'pending:undefined']);
    expect(dependencies.acceptInvite).toHaveBeenCalledOnce();
    expect(pendingInviteToken).toBeUndefined();
    expect(store.state).toEqual({
      groups: [],
      isPlatformAdmin: false,
      errorMessage: 'groups unavailable',
      status: 'invite-refresh-required',
      token: 'merged-token',
    });
    expect(store.setActiveGroupId(group.id)).toBe(false);
    await expect(store.refreshGroupContext()).rejects.toThrow('请先刷新已加入群组的资料。');
    store.setPendingInviteToken('replacement-invite');
    expect(pendingInviteToken).toBeUndefined();

    await expect(store.consumePendingInvite()).resolves.toMatchObject({
      status: 'committed-refresh-failed',
    });
    await expect(store.retryInviteContextRefresh()).resolves.toEqual({ status: 'reconciled' });

    expect(dependencies.acceptInvite).toHaveBeenCalledOnce();
    expect(store.state).toMatchObject({
      activeGroupId: joinedGroup.id,
      groups: [joinedGroup],
      profile: joinedProfile,
      status: 'authenticated',
      token: 'merged-token',
    });
  });

  it('does not let a group refresh started during invite acceptance restore stale authority', async () => {
    let pendingInviteToken: string | undefined = 'invite-token';
    const accept = createDeferred<AcceptInviteResponse>();
    const lateGroups = createDeferred<GroupSummary[]>();
    const dependencies = createDependencies({
      acceptInvite: vi.fn(() => accept.promise),
      getCurrentProfile: vi
        .fn<SessionDependencies['getCurrentProfile']>()
        .mockResolvedValueOnce(profile)
        .mockRejectedValueOnce(new Error('profile refresh failed')),
      listGroups: vi
        .fn<SessionDependencies['listGroups']>()
        .mockResolvedValueOnce([group])
        .mockImplementationOnce(() => lateGroups.promise),
      readPendingInviteToken: () => pendingInviteToken,
      readStoredToken: () => 'old-token',
      writePendingInviteToken: (token) => {
        pendingInviteToken = token;
      },
    });
    const store = createSessionStore(dependencies);
    await store.restore();

    const accepting = store.consumePendingInvite();
    await vi.waitFor(() => expect(dependencies.acceptInvite).toHaveBeenCalledOnce());
    const refreshOutcome = store.refreshGroupContext().then(
      () => ({ status: 'fulfilled' }) as const,
      (error: unknown) =>
        ({ message: error instanceof Error ? error.message : '', status: 'rejected' }) as const,
    );

    accept.resolve({ group: joinedGroup, token: 'merged-token' });
    await expect(accepting).resolves.toEqual({
      errorMessage: 'profile refresh failed',
      status: 'committed-refresh-failed',
    });
    lateGroups.resolve([group]);

    await expect(refreshOutcome).resolves.toEqual({
      message: '邀请正在处理中，请稍候。',
      status: 'rejected',
    });
    expect(dependencies.listGroups).toHaveBeenCalledOnce();
    expect(store.state).toMatchObject({
      groups: [],
      status: 'invite-refresh-required',
      token: 'merged-token',
    });
  });

  it('single-flights refresh retries after commit and never accepts the invite again', async () => {
    let pendingInviteToken: string | undefined = 'invite-token';
    const refreshedProfile = createDeferred<UserProfile>();
    const dependencies = createDependencies({
      acceptInvite: vi.fn(() => Promise.resolve({ group: joinedGroup })),
      getCurrentProfile: vi
        .fn<SessionDependencies['getCurrentProfile']>()
        .mockResolvedValueOnce(profile)
        .mockRejectedValueOnce(new Error('profile unavailable'))
        .mockImplementationOnce(() => refreshedProfile.promise),
      readPendingInviteToken: () => pendingInviteToken,
      readStoredToken: () => 'stored-token',
      writePendingInviteToken: (token) => {
        pendingInviteToken = token;
      },
    });
    const store = createSessionStore(dependencies);
    await store.restore();
    await store.consumePendingInvite();

    const first = store.retryInviteContextRefresh();
    expect(store.retryInviteContextRefresh()).toBe(first);
    refreshedProfile.resolve(joinedProfile);
    await expect(first).resolves.toEqual({ status: 'reconciled' });

    expect(dependencies.acceptInvite).toHaveBeenCalledOnce();
    expect(dependencies.getCurrentProfile).toHaveBeenCalledTimes(3);
  });

  it('performs exact session cleanup when committed invite reconciliation receives a 401', async () => {
    let pendingInviteToken: string | undefined = 'invite-token';
    const dependencies = createDependencies({
      acceptInvite: vi.fn(() => Promise.resolve({ group: joinedGroup, token: 'merged-token' })),
      getCurrentProfile: vi
        .fn<SessionDependencies['getCurrentProfile']>()
        .mockResolvedValueOnce(profile)
        .mockRejectedValueOnce(
          new ApiClientError('AUTHENTICATION_REQUIRED', 'expired', undefined, undefined, 401),
        ),
      readPendingInviteToken: () => pendingInviteToken,
      readStoredToken: () => 'stored-token',
      writePendingInviteToken: (token) => {
        pendingInviteToken = token;
      },
    });
    const store = createSessionStore(dependencies);
    await store.restore();

    await expect(store.consumePendingInvite()).resolves.toEqual({ status: 'session-expired' });

    expect(dependencies.acceptInvite).toHaveBeenCalledOnce();
    expect(pendingInviteToken).toBeUndefined();
    expect(store.state.status).toBe('anonymous');
    expect(dependencies.writeStoredToken).toHaveBeenNthCalledWith(1, 'merged-token');
    expect(dependencies.writeStoredToken).toHaveBeenLastCalledWith(undefined);
    expect(dependencies.sessionStorage.removeLastGroupId).toHaveBeenCalledWith(profile.id);
    expect(dependencies.removeCalendarCacheForUser).toHaveBeenCalledWith(profile.id);
  });

  it('abandons only the pending invite without mutating authenticated authority', async () => {
    let pendingInviteToken: string | undefined = 'invite-token';
    const dependencies = createDependencies({
      readPendingInviteToken: () => pendingInviteToken,
      readStoredToken: () => 'stored-token',
      writePendingInviteToken: vi.fn((token) => {
        pendingInviteToken = token;
      }),
    });
    const store = createSessionStore(dependencies);
    await store.restore();
    const authenticatedState = store.state;

    store.setPendingInviteToken(undefined);

    expect(pendingInviteToken).toBeUndefined();
    expect(store.state).toBe(authenticatedState);
    expect(dependencies.writeStoredToken).not.toHaveBeenCalled();
    expect(dependencies.removeCalendarCacheForUser).not.toHaveBeenCalled();
  });

  it('single-flights duplicate pending-invite consumption', async () => {
    const deferred = createDeferred<AcceptInviteResponse>();
    const dependencies = createDependencies({
      acceptInvite: vi.fn(() => deferred.promise),
      readPendingInviteToken: () => 'invite-token',
      readStoredToken: () => 'stored-token',
    });
    const store = createSessionStore(dependencies);
    await store.restore();
    const first = store.consumePendingInvite();
    expect(store.consumePendingInvite()).toBe(first);
    deferred.resolve({ group });
    await first;
  });

  it('changes active group only to an existing group and logout preserves the pending invite', async () => {
    const dependencies = createDependencies({ readStoredToken: () => 'stored-token' });
    const store = createSessionStore(dependencies);
    await store.restore();
    expect(store.setActiveGroupId(group.id)).toBe(true);
    expect(store.setActiveGroupId('unknown')).toBe(false);
    store.clear();
    expect(dependencies.writePendingInviteToken).not.toHaveBeenCalled();
  });

  it('removes only the authenticated user cache for a group that remains in session context', async () => {
    const dependencies = createDependencies({ readStoredToken: () => 'stored-token' });
    const store = createSessionStore(dependencies);
    await store.restore();

    expect(store.removeCalendarCacheForGroup(group.id)).toBe(true);
    expect(dependencies.removeCalendarCacheForUserGroup).toHaveBeenCalledWith('user-1', group.id);
    expect(store.removeCalendarCacheForGroup('missing-group')).toBe(false);
  });

  it('writes the same pending invite token only once across capture sites', () => {
    let pending: string | undefined;
    const dependencies = createDependencies({
      readPendingInviteToken: () => pending,
      writePendingInviteToken: vi.fn((token) => {
        pending = token;
      }),
    });
    const store = createSessionStore(dependencies);
    store.setPendingInviteToken('invite-token');
    store.setPendingInviteToken('invite-token');
    expect(dependencies.writePendingInviteToken).toHaveBeenCalledTimes(1);
  });

  it('restores a saved group only for the authenticated user and removes a stale saved group', async () => {
    const saved = new Map<string, string | undefined>([
      ['user-1', 'group-2'],
      ['user-2', 'other-group'],
    ]);
    const groupTwo: GroupSummary = { id: 'group-2', name: '外科', role: 'member', version: 3 };
    const dependencies = createDependencies({
      listGroups: vi.fn(() => Promise.resolve([group, groupTwo])),
      readStoredToken: () => 'stored-token',
      sessionStorage: {
        readLastGroupId: (userId: string) => saved.get(userId),
        removeLastGroupId: (userId: string) => saved.delete(userId),
        writeLastGroupId: (userId: string, groupId: string) => saved.set(userId, groupId),
      },
    });
    const store = createSessionStore(dependencies);

    await store.restore();
    expect(store.state.activeGroupId).toBe('group-2');

    saved.set('user-1', 'stale-group');
    await store.refreshGroupContext();
    expect(store.state.activeGroupId).toBe('group-1');
    expect(saved.get('user-1')).toBe('group-1');
    expect(saved.get('user-2')).toBe('other-group');
  });

  it('purges only the current user cache and metadata before publishing anonymous state', async () => {
    const calls: string[] = [];
    const dependencies = createDependencies({
      readStoredToken: () => 'stored-token',
      removeCalendarCacheForUser: (userId: string) => calls.push(`cache:${userId}`),
      sessionStorage: {
        readLastGroupId: () => undefined,
        removeLastGroupId: (userId: string) => calls.push(`last-group:${userId}`),
        writeLastGroupId: () => undefined,
      },
      writeStoredToken: () => calls.push('token'),
    });
    const store = createSessionStore(dependencies);
    await store.restore();

    store.clear();

    expect(calls).toEqual(['token', 'last-group:user-1', 'cache:user-1']);
    expect(store.state.status).toBe('anonymous');
  });

  it('accepts a profile replacement only for the currently authenticated user', async () => {
    const dependencies = createDependencies({ readStoredToken: () => 'stored-token' });
    const store = createSessionStore(dependencies);
    await store.restore();

    expect(store.replaceProfile({ ...profile, realName: '新姓名', version: 2 })).toBe(true);
    expect(store.state.profile).toEqual({ ...profile, realName: '新姓名', version: 2 });
    expect(store.replaceProfile({ id: 'another-user', realName: '不应写入', version: 1 })).toBe(
      false,
    );
  });
});
