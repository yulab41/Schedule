import type {
  AcceptInviteResponse,
  GroupSummary,
  UserProfile,
  WechatLoginResponse,
} from '@schedule/contracts';

import { ApiClientError, getStoredToken, storeToken } from '../api/client.js';
import {
  acceptInvite,
  createUserProfile,
  getCurrentProfile,
  getPlatformMe,
  listGroups,
  wechatLogin,
} from '../api/endpoints.js';
import { requestWechatLoginCode } from '../features/auth/auth-flow.js';
import { getCalendarCacheRuntime } from './calendar-cache-runtime.js';
import { sessionStorage, type SessionStorage } from './session-storage.js';

const pendingInviteStorageKey = 'schedule.pendingInviteToken';

export type SessionStatus =
  'anonymous' | 'authenticated' | 'error' | 'invite-refresh-required' | 'loading' | 'needs-profile';

export type InviteAcceptanceResult =
  | { readonly status: 'cancelled' }
  | { readonly errorMessage: string; readonly status: 'committed-refresh-failed' }
  | { readonly status: 'reconciled' }
  | { readonly status: 'session-expired' };

export interface SessionState {
  readonly activeGroupId?: string;
  readonly errorMessage?: string;
  readonly groups: readonly GroupSummary[];
  readonly isPlatformAdmin: boolean;
  readonly profile?: UserProfile;
  readonly status: SessionStatus;
  readonly token?: string;
}

export interface SessionDependencies {
  readonly acceptInvite: (token: string, confirmRealName: string) => Promise<AcceptInviteResponse>;
  readonly createUserProfile: (realName: string) => Promise<UserProfile>;
  readonly getCurrentProfile: () => Promise<UserProfile>;
  readonly getPlatformMe: () => Promise<{ readonly isPlatformAdmin: boolean }>;
  readonly listGroups: () => Promise<GroupSummary[]>;
  readonly readPendingInviteToken: () => string | undefined;
  readonly readStoredToken: () => string | undefined;
  readonly requestLoginCode: () => Promise<string>;
  readonly removeCalendarCacheForUser: (userId: string) => void;
  readonly removeCalendarCacheForUserGroup: (userId: string, groupId: string) => void;
  readonly sessionStorage: SessionStorage;
  readonly wechatLogin: (code: string) => Promise<WechatLoginResponse>;
  readonly writePendingInviteToken: (token: string | undefined) => void;
  readonly writeStoredToken: (token: string | undefined) => void;
}

export interface SessionStore {
  readonly state: SessionState;
  clear(): void;
  completeProfile(realName: string): Promise<void>;
  consumePendingInvite(): Promise<InviteAcceptanceResult>;
  getPendingInviteToken(): string | undefined;
  markUnauthorized(): void;
  replaceProfile(profile: UserProfile): boolean;
  refreshGroupContext(options?: { readonly preferredGroupId?: string }): Promise<void>;
  removeCalendarCacheForGroup(groupId: string): boolean;
  restore(): Promise<void>;
  retryInviteContextRefresh(): Promise<InviteAcceptanceResult>;
  setActiveGroupId(groupId: string): boolean;
  setPendingInviteToken(token: string | undefined): void;
  signInWithWechat(): Promise<void>;
}

const emptyContext = { groups: [] as readonly GroupSummary[], isPlatformAdmin: false };

function messageFor(error: unknown): string {
  return error instanceof Error ? error.message : '会话操作失败，请重试。';
}

function isMissingProfile(error: unknown): boolean {
  return error instanceof ApiClientError && (error.status === 404 || error.code === 'NOT_FOUND');
}

function isUnauthorized(error: unknown): boolean {
  return (
    error instanceof ApiClientError &&
    (error.status === 401 || error.code === 'AUTHENTICATION_REQUIRED')
  );
}

interface AcceptedInviteReconciliation {
  readonly groupId: string;
  readonly nextToken: string;
  readonly previousUserId: string;
  readonly replacementToken?: string;
  pendingCleared: boolean;
  replacementTokenPersisted: boolean;
}

export function createSessionStore(dependencies: SessionDependencies): SessionStore {
  let state: SessionState = { ...emptyContext, status: 'anonymous' };
  let generation = 0;
  let restorePromise: Promise<void> | undefined;
  let signInPromise: Promise<void> | undefined;
  let profilePromise: Promise<void> | undefined;
  let invitePromise: Promise<InviteAcceptanceResult> | undefined;
  let inviteContextPromise: Promise<InviteAcceptanceResult> | undefined;
  let groupContextPromise: Promise<void> | undefined;
  let acceptedInvite: AcceptedInviteReconciliation | undefined;

  const isCurrent = (operationGeneration: number): boolean => operationGeneration === generation;
  const invalidateInFlight = (): void => {
    generation += 1;
    restorePromise = undefined;
    signInPromise = undefined;
    profilePromise = undefined;
    invitePromise = undefined;
    inviteContextPromise = undefined;
    groupContextPromise = undefined;
  };
  const beginSupersedingOperation = (): number => {
    invalidateInFlight();
    return generation;
  };
  const publish = (operationGeneration: number, next: SessionState): boolean => {
    if (!isCurrent(operationGeneration)) return false;
    state = next;
    return true;
  };
  const loadPlatformAdmin = async (): Promise<boolean> => {
    try {
      return (await dependencies.getPlatformMe()).isPlatformAdmin;
    } catch (error) {
      if (isUnauthorized(error)) throw error;
      return false;
    }
  };
  const loadRoleContext = async (): Promise<{
    readonly groups: readonly GroupSummary[];
    readonly isPlatformAdmin: boolean;
  }> => {
    const groupsResultPromise = dependencies.listGroups().then(
      (groups) => ({ groups, status: 'fulfilled' }) as const,
      (error: unknown) => ({ error, status: 'rejected' }) as const,
    );
    const isPlatformAdmin = await loadPlatformAdmin();
    const groupsResult = await groupsResultPromise;
    if (groupsResult.status === 'rejected') throw groupsResult.error;
    return { groups: groupsResult.groups, isPlatformAdmin };
  };
  const chooseActiveGroupId = (
    profile: UserProfile,
    groups: readonly GroupSummary[],
    preferredGroupId: string | undefined,
  ): string | undefined => {
    const savedGroupId = dependencies.sessionStorage.readLastGroupId(profile.id);
    const activeGroupId = [preferredGroupId, savedGroupId, groups[0]?.id].find(
      (candidate) => candidate !== undefined && groups.some((group) => group.id === candidate),
    );
    if (activeGroupId === undefined) dependencies.sessionStorage.removeLastGroupId(profile.id);
    else dependencies.sessionStorage.writeLastGroupId(profile.id, activeGroupId);
    return activeGroupId;
  };
  const becomeAuthenticated = async (
    profile: UserProfile,
    token: string,
    operationGeneration: number,
    preferredGroupId?: string,
  ): Promise<boolean> => {
    const context = await loadRoleContext();
    if (!isCurrent(operationGeneration)) return false;
    const activeGroupId = chooseActiveGroupId(profile, context.groups, preferredGroupId);
    state = { activeGroupId, ...context, profile, status: 'authenticated', token };
    return true;
  };
  const purgeCurrentUser = (userId: string | undefined): void => {
    try {
      dependencies.writeStoredToken(undefined);
    } catch {
      // A storage failure must not leave the in-memory session authenticated.
    }
    if (userId === undefined) return;
    try {
      dependencies.sessionStorage.removeLastGroupId(userId);
    } catch {
      // Per-user metadata cleanup is best-effort and must not widen scope.
    }
    try {
      dependencies.removeCalendarCacheForUser(userId);
    } catch {
      // Cache cleanup failures must not stop the anonymous transition.
    }
  };
  const publishInviteRefreshRequired = (
    record: AcceptedInviteReconciliation,
    operationGeneration: number,
    errorMessage?: string,
  ): void => {
    publish(operationGeneration, {
      ...emptyContext,
      ...(errorMessage === undefined ? {} : { errorMessage }),
      status: 'invite-refresh-required',
      token: record.nextToken,
    });
  };
  const reconcileAcceptedInvite = async (
    record: AcceptedInviteReconciliation,
    operationGeneration: number,
  ): Promise<InviteAcceptanceResult> => {
    try {
      if (record.replacementToken !== undefined && !record.replacementTokenPersisted) {
        dependencies.writeStoredToken(record.replacementToken);
        record.replacementTokenPersisted = true;
      }
      if (!isCurrent(operationGeneration) || acceptedInvite !== record)
        return { status: 'cancelled' };
      if (!record.pendingCleared) {
        dependencies.writePendingInviteToken(undefined);
        record.pendingCleared = true;
      }
      if (!isCurrent(operationGeneration) || acceptedInvite !== record)
        return { status: 'cancelled' };
      const refreshedProfile = await dependencies.getCurrentProfile();
      if (!isCurrent(operationGeneration) || acceptedInvite !== record)
        return { status: 'cancelled' };
      const authenticated = await becomeAuthenticated(
        refreshedProfile,
        record.nextToken,
        operationGeneration,
        record.groupId,
      );
      if (!authenticated || acceptedInvite !== record) return { status: 'cancelled' };
      acceptedInvite = undefined;
      return { status: 'reconciled' };
    } catch (error) {
      if (!isCurrent(operationGeneration) || acceptedInvite !== record)
        return { status: 'cancelled' };
      if (isUnauthorized(error)) {
        store.markUnauthorized();
        return { status: 'session-expired' };
      }
      const errorMessage = messageFor(error);
      publishInviteRefreshRequired(record, operationGeneration, errorMessage);
      return { errorMessage, status: 'committed-refresh-failed' };
    }
  };

  const store: SessionStore = {
    get state() {
      return state;
    },
    clear: () => {
      const userId = state.profile?.id ?? acceptedInvite?.previousUserId;
      invalidateInFlight();
      acceptedInvite = undefined;
      purgeCurrentUser(userId);
      state = { ...emptyContext, status: 'anonymous' };
    },
    completeProfile: (realName) => {
      if (profilePromise !== undefined) return profilePromise;
      if (acceptedInvite !== undefined)
        return Promise.reject(new Error('请先刷新已加入群组的资料。'));
      const token = state.token;
      const normalizedName = realName.trim();
      if (token === undefined) return Promise.reject(new Error('请先登录。'));
      if (normalizedName.length === 0) return Promise.reject(new Error('请输入真实姓名。'));
      const operationGeneration = beginSupersedingOperation();
      const operation = (async (): Promise<void> => {
        let profile = state.profile;
        try {
          if (profile === undefined) {
            publish(operationGeneration, { ...emptyContext, status: 'loading', token });
            profile = await dependencies.createUserProfile(normalizedName);
            if (!isCurrent(operationGeneration)) return;
            publish(operationGeneration, { ...emptyContext, profile, status: 'loading', token });
          }
          await becomeAuthenticated(profile, token, operationGeneration);
        } catch (error) {
          if (isCurrent(operationGeneration)) {
            publish(operationGeneration, {
              ...emptyContext,
              errorMessage: messageFor(error),
              profile,
              status: 'error',
              token,
            });
          }
          throw error;
        }
      })();
      profilePromise = operation;
      void operation.then(
        () => {
          if (profilePromise === operation) profilePromise = undefined;
        },
        () => {
          if (profilePromise === operation) profilePromise = undefined;
        },
      );
      return operation;
    },
    consumePendingInvite: () => {
      if (invitePromise !== undefined) return invitePromise;
      if (acceptedInvite !== undefined)
        return Promise.resolve({
          errorMessage: state.errorMessage ?? '群组资料尚未刷新，请重试。',
          status: 'committed-refresh-failed',
        });
      const pending = dependencies.readPendingInviteToken();
      const { profile, token } = state;
      if (pending === undefined || profile === undefined || token === undefined)
        return Promise.reject(new Error('邀请状态无效。'));
      const operationGeneration = beginSupersedingOperation();
      const operation = (async (): Promise<InviteAcceptanceResult> => {
        const result = await dependencies.acceptInvite(pending, profile.realName);
        if (!isCurrent(operationGeneration)) return { status: 'cancelled' };
        const nextToken = result.token ?? token;
        const record: AcceptedInviteReconciliation = {
          groupId: result.group.id,
          nextToken,
          pendingCleared: false,
          previousUserId: profile.id,
          replacementToken: result.token,
          replacementTokenPersisted: result.token === undefined,
        };
        acceptedInvite = record;
        publishInviteRefreshRequired(record, operationGeneration);
        return reconcileAcceptedInvite(record, operationGeneration);
      })();
      invitePromise = operation;
      void operation.then(
        () => {
          if (invitePromise === operation) invitePromise = undefined;
        },
        () => {
          if (invitePromise === operation) invitePromise = undefined;
        },
      );
      return operation;
    },
    getPendingInviteToken: () => dependencies.readPendingInviteToken(),
    markUnauthorized: () => {
      store.clear();
    },
    replaceProfile: (profile) => {
      if (
        state.status !== 'authenticated' ||
        state.profile === undefined ||
        state.profile.id !== profile.id
      )
        return false;
      state = { ...state, profile };
      return true;
    },
    refreshGroupContext: (options = {}) => {
      if (invitePromise !== undefined) return Promise.reject(new Error('邀请正在处理中，请稍候。'));
      if (groupContextPromise !== undefined) return groupContextPromise;
      if (acceptedInvite !== undefined)
        return Promise.reject(new Error('请先刷新已加入群组的资料。'));
      const { profile, token } = state;
      if (state.status !== 'authenticated' || profile === undefined || token === undefined)
        return Promise.reject(new Error('请先登录。'));
      const operationGeneration = generation;
      const operation = becomeAuthenticated(
        profile,
        token,
        operationGeneration,
        options.preferredGroupId,
      ).then(() => undefined);
      groupContextPromise = operation;
      void operation.then(
        () => {
          if (groupContextPromise === operation) groupContextPromise = undefined;
        },
        () => {
          if (groupContextPromise === operation) groupContextPromise = undefined;
        },
      );
      return operation;
    },
    removeCalendarCacheForGroup: (groupId) => {
      if (
        groupId.length === 0 ||
        state.status !== 'authenticated' ||
        state.profile === undefined ||
        !state.groups.some((group) => group.id === groupId)
      )
        return false;
      try {
        dependencies.removeCalendarCacheForUserGroup(state.profile.id, groupId);
      } catch {
        // Cache removal is best-effort and never changes membership state.
      }
      return true;
    },
    restore: () => {
      if (restorePromise !== undefined) return restorePromise;
      if (acceptedInvite !== undefined)
        return store.retryInviteContextRefresh().then(() => undefined);
      if (
        signInPromise !== undefined ||
        profilePromise !== undefined ||
        invitePromise !== undefined
      )
        return Promise.resolve();
      const operationGeneration = beginSupersedingOperation();
      const operation = (async (): Promise<void> => {
        const token = dependencies.readStoredToken();
        if (token === undefined) {
          publish(operationGeneration, { ...emptyContext, status: 'anonymous' });
          return;
        }
        publish(operationGeneration, { ...emptyContext, status: 'loading', token });
        try {
          const profile = await dependencies.getCurrentProfile();
          if (!isCurrent(operationGeneration)) return;
          await becomeAuthenticated(profile, token, operationGeneration);
        } catch (error) {
          if (!isCurrent(operationGeneration)) return;
          if (isMissingProfile(error))
            publish(operationGeneration, { ...emptyContext, status: 'needs-profile', token });
          else if (isUnauthorized(error)) store.markUnauthorized();
          else
            publish(operationGeneration, {
              ...emptyContext,
              errorMessage: messageFor(error),
              status: 'error',
              token,
            });
        }
      })();
      restorePromise = operation;
      void operation.then(
        () => {
          if (restorePromise === operation) restorePromise = undefined;
        },
        () => {
          if (restorePromise === operation) restorePromise = undefined;
        },
      );
      return operation;
    },
    retryInviteContextRefresh: () => {
      if (inviteContextPromise !== undefined) return inviteContextPromise;
      const record = acceptedInvite;
      if (record === undefined) return Promise.reject(new Error('没有需要刷新的邀请上下文。'));
      const operationGeneration = beginSupersedingOperation();
      publishInviteRefreshRequired(record, operationGeneration, state.errorMessage);
      const operation = reconcileAcceptedInvite(record, operationGeneration);
      inviteContextPromise = operation;
      void operation.then(
        () => {
          if (inviteContextPromise === operation) inviteContextPromise = undefined;
        },
        () => {
          if (inviteContextPromise === operation) inviteContextPromise = undefined;
        },
      );
      return operation;
    },
    setActiveGroupId: (groupId) => {
      if (!state.groups.some((group) => group.id === groupId)) return false;
      const userId = state.profile?.id;
      if (userId === undefined) return false;
      dependencies.sessionStorage.writeLastGroupId(userId, groupId);
      state = { ...state, activeGroupId: groupId };
      return true;
    },
    setPendingInviteToken: (token) => {
      const next = token === undefined || token.length === 0 ? undefined : token;
      if (acceptedInvite !== undefined && next !== undefined) return;
      if (dependencies.readPendingInviteToken() !== next)
        dependencies.writePendingInviteToken(next);
    },
    signInWithWechat: () => {
      if (signInPromise !== undefined) return signInPromise;
      if (acceptedInvite !== undefined)
        return Promise.reject(new Error('请先刷新已加入群组的资料。'));
      const operationGeneration = beginSupersedingOperation();
      const operation = (async (): Promise<void> => {
        try {
          const code = await dependencies.requestLoginCode();
          const response = await dependencies.wechatLogin(code);
          if (!isCurrent(operationGeneration)) return;
          dependencies.writeStoredToken(response.token);
          if (response.profile === undefined) {
            publish(operationGeneration, {
              ...emptyContext,
              status: 'needs-profile',
              token: response.token,
            });
            return;
          }
          await becomeAuthenticated(response.profile, response.token, operationGeneration);
        } catch (error) {
          if (isCurrent(operationGeneration))
            publish(operationGeneration, {
              ...emptyContext,
              errorMessage: messageFor(error),
              status: 'error',
            });
          throw error;
        }
      })();
      signInPromise = operation;
      void operation.then(
        () => {
          if (signInPromise === operation) signInPromise = undefined;
        },
        () => {
          if (signInPromise === operation) signInPromise = undefined;
        },
      );
      return operation;
    },
  };
  return store;
}

export const sessionStore = createSessionStore({
  acceptInvite,
  createUserProfile,
  getCurrentProfile,
  getPlatformMe,
  listGroups,
  readPendingInviteToken: () => {
    const value = wx.getStorageSync<string>(pendingInviteStorageKey);
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  },
  readStoredToken: getStoredToken,
  requestLoginCode: () => requestWechatLoginCode({ login: (options) => wx.login(options) }),
  removeCalendarCacheForUser: (userId) => getCalendarCacheRuntime().removeForUser(userId),
  removeCalendarCacheForUserGroup: (userId, groupId) =>
    getCalendarCacheRuntime().removeForUserGroup(userId, groupId),
  sessionStorage,
  wechatLogin,
  writePendingInviteToken: (token) => {
    if (token === undefined || token.length === 0) wx.removeStorageSync(pendingInviteStorageKey);
    else wx.setStorageSync(pendingInviteStorageKey, token);
  },
  writeStoredToken: storeToken,
});
