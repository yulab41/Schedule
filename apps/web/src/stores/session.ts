import type { UserProfile } from '@schedule/contracts';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import {
  cloudbaseAuth,
  getAuthenticatedSession,
  type CloudbaseAuthClient,
  type CloudbaseSession,
} from '../auth/cloudbase.js';
import { ApiClientError, createApiClient } from '../api/client.js';

export type SessionStatus = 'anonymous' | 'authenticated' | 'error' | 'loading' | 'needs-profile';

export interface UserProfileApi {
  createCurrentProfile(input: { readonly realName: string }): Promise<UserProfile>;
  getCurrentProfile(): Promise<UserProfile>;
}

export interface SessionDependencies {
  readonly api: UserProfileApi;
  readonly auth: CloudbaseAuthClient;
}

export function createSessionManager(dependencies: SessionDependencies) {
  const errorMessage = ref<string | undefined>();
  const profile = ref<UserProfile | undefined>();
  const status = ref<SessionStatus>('loading');
  let restorePromise: Promise<void> | undefined;

  const isAuthenticated = computed(() => status.value === 'authenticated');
  const needsProfile = computed(() => status.value === 'needs-profile');

  async function restore(): Promise<void> {
    if (restorePromise !== undefined) {
      return restorePromise;
    }

    restorePromise = restoreSession().finally(() => {
      restorePromise = undefined;
    });
    return restorePromise;
  }

  async function signIn(input: {
    readonly password: string;
    readonly username: string;
  }): Promise<void> {
    clearError();
    const username = normalizeLoginAccount(input.username);
    if (username.length === 0) {
      throw new SessionError('请输入登录账号。');
    }

    if (input.password.length === 0) {
      throw new SessionError('请输入密码。');
    }

    try {
      const result = await dependencies.auth.signInWithPassword({
        password: input.password,
        username,
      });
      const session = getAuthenticatedSession(result);
      if (session === undefined) {
        clearSession();
        throw new SessionError('登录状态未能建立，请重试。');
      }
    } catch (error) {
      if (isMissingSessionError(error)) {
        throw new SessionError('账号或密码不正确，请重试。');
      }
      throw error;
    }

    await loadProfile();
  }

  async function signInDev(uid: string): Promise<void> {
    clearError();
    dependencies.auth.setDevIdentity(uid);
    await loadProfile();
  }

  async function completeProfile(realName: string): Promise<void> {
    clearError();
    let session: CloudbaseSession | undefined;
    try {
      session = getAuthenticatedSession(await dependencies.auth.getSession());
    } catch (error) {
      if (isMissingSessionError(error)) {
        clearSession();
        throw new SessionError('登录状态已失效，请重新登录。');
      }
      handleSessionError(error, 'needs-profile');
      throw error;
    }

    if (session === undefined) {
      clearSession();
      throw new SessionError('登录状态已失效，请重新登录。');
    }

    await createProfile(realName);
  }

  async function signOut(): Promise<void> {
    try {
      await dependencies.auth.signOut();
    } finally {
      clearSession();
    }
  }

  async function restoreSession(): Promise<void> {
    status.value = 'loading';
    clearError();

    try {
      const session = getAuthenticatedSession(await dependencies.auth.getSession());
      if (session === undefined) {
        clearSession();
        return;
      }

      await loadProfile();
    } catch (error) {
      if (isMissingSessionError(error)) {
        clearSession();
        return;
      }
      handleSessionError(error);
    }
  }

  async function loadProfile(): Promise<void> {
    try {
      profile.value = await dependencies.api.getCurrentProfile();
      status.value = 'authenticated';
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 404) {
        profile.value = undefined;
        status.value = 'needs-profile';
        return;
      }

      handleSessionError(error);
      throw error;
    }
  }

  async function createProfile(realName: string): Promise<void> {
    try {
      profile.value = await dependencies.api.createCurrentProfile({ realName });
      status.value = 'authenticated';
    } catch (error) {
      handleSessionError(error, 'needs-profile');
      throw error;
    }
  }

  function handleSessionError(
    error: unknown,
    fallbackStatus: Exclude<SessionStatus, 'anonymous'> = 'error',
  ): void {
    if (error instanceof ApiClientError && error.status === 401) {
      clearSession();
      errorMessage.value = error.message;
      return;
    }

    status.value = fallbackStatus;
    errorMessage.value = getErrorMessage(error);
  }

  function clearSession(): void {
    profile.value = undefined;
    status.value = 'anonymous';
  }

  function clearError(): void {
    errorMessage.value = undefined;
  }

  return {
    completeProfile,
    errorMessage,
    isAuthenticated,
    needsProfile,
    profile,
    restore,
    signInDev,
    signIn,
    signOut,
    status,
  };
}

export function normalizeLoginAccount(username: string): string {
  return username.trim().toLowerCase();
}

export const useSessionStore = defineStore('session', () =>
  createSessionManager({
    api: createApiClient({ auth: cloudbaseAuth }),
    auth: cloudbaseAuth,
  }),
);

export class SessionError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'SessionError';
  }
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return '操作未完成，请稍后重试。';
}

function isMissingSessionError(error: unknown): boolean {
  return (
    error instanceof Error &&
    /credentials?\s+not\s+found|credential\s*not\s*found/iu.test(error.message)
  );
}
