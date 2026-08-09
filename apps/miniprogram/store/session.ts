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

const pendingInviteStorageKey = 'schedule.pendingInviteToken';

export type SessionStatus = 'anonymous' | 'authenticated' | 'error' | 'loading' | 'needs-profile';

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
  readonly wechatLogin: (code: string) => Promise<WechatLoginResponse>;
  readonly writePendingInviteToken: (token: string | undefined) => void;
  readonly writeStoredToken: (token: string | undefined) => void;
}

export interface SessionStore {
  readonly state: SessionState;
  clear(): void;
  completeProfile(realName: string): Promise<void>;
  consumePendingInvite(): Promise<void>;
  getPendingInviteToken(): string | undefined;
  markUnauthorized(): void;
  restore(): Promise<void>;
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

export function createSessionStore(dependencies: SessionDependencies): SessionStore {
  let state: SessionState = { ...emptyContext, status: 'anonymous' };
  let generation = 0;
  let restorePromise: Promise<void> | undefined;
  let signInPromise: Promise<void> | undefined;
  let profilePromise: Promise<void> | undefined;
  let invitePromise: Promise<void> | undefined;

  const isCurrent = (operationGeneration: number): boolean => operationGeneration === generation;
  const invalidateInFlight = (): void => {
    generation += 1;
    restorePromise = undefined;
    signInPromise = undefined;
    profilePromise = undefined;
    invitePromise = undefined;
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
  const loadRoleContext = async (): Promise<{
    readonly groups: readonly GroupSummary[];
    readonly isPlatformAdmin: boolean;
  }> => {
    const [groups, platform] = await Promise.all([
      dependencies.listGroups(),
      dependencies.getPlatformMe(),
    ]);
    return { groups, isPlatformAdmin: platform.isPlatformAdmin };
  };
  const becomeAuthenticated = async (
    profile: UserProfile,
    token: string,
    operationGeneration: number,
  ): Promise<boolean> => {
    const context = await loadRoleContext();
    if (!isCurrent(operationGeneration)) return false;
    const activeGroupId = context.groups.some((group) => group.id === state.activeGroupId)
      ? state.activeGroupId
      : context.groups[0]?.id;
    state = { activeGroupId, ...context, profile, status: 'authenticated', token };
    return true;
  };

  const store: SessionStore = {
    get state() {
      return state;
    },
    clear: () => {
      invalidateInFlight();
      dependencies.writeStoredToken(undefined);
      state = { ...emptyContext, status: 'anonymous' };
    },
    completeProfile: (realName) => {
      if (profilePromise !== undefined) return profilePromise;
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
      const pending = dependencies.readPendingInviteToken();
      const { profile, token } = state;
      if (pending === undefined || profile === undefined || token === undefined)
        return Promise.reject(new Error('邀请状态无效。'));
      const operationGeneration = beginSupersedingOperation();
      const operation = (async (): Promise<void> => {
        const result = await dependencies.acceptInvite(pending, profile.realName);
        if (!isCurrent(operationGeneration)) return;
        const nextToken = result.token ?? token;
        if (result.token !== undefined) dependencies.writeStoredToken(result.token);
        if (!isCurrent(operationGeneration)) return;
        dependencies.writePendingInviteToken(undefined);
        const refreshedProfile = await dependencies.getCurrentProfile();
        if (!isCurrent(operationGeneration)) return;
        await becomeAuthenticated(refreshedProfile, nextToken, operationGeneration);
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
      invalidateInFlight();
      state = { ...emptyContext, status: 'anonymous' };
    },
    restore: () => {
      if (restorePromise !== undefined) return restorePromise;
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
    setActiveGroupId: (groupId) => {
      if (!state.groups.some((group) => group.id === groupId)) return false;
      state = { ...state, activeGroupId: groupId };
      return true;
    },
    setPendingInviteToken: (token) => {
      const next = token === undefined || token.length === 0 ? undefined : token;
      if (dependencies.readPendingInviteToken() !== next)
        dependencies.writePendingInviteToken(next);
    },
    signInWithWechat: () => {
      if (signInPromise !== undefined) return signInPromise;
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
  wechatLogin,
  writePendingInviteToken: (token) => {
    if (token === undefined || token.length === 0) wx.removeStorageSync(pendingInviteStorageKey);
    else wx.setStorageSync(pendingInviteStorageKey, token);
  },
  writeStoredToken: storeToken,
});
