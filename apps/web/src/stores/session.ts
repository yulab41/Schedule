import type { UserProfile } from '@schedule/contracts';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import {
  CloudbaseAuthenticationError,
  cloudbaseAuth,
  getAuthenticatedSession,
  type CloudbaseAuthClient,
  type CloudbaseAuthResult,
  type CloudbaseSession,
} from '../auth/cloudbase.js';
import { ApiClientError, createApiClient, type ApiClient } from '../api/client.js';

export type SessionStatus = 'anonymous' | 'authenticated' | 'error' | 'loading' | 'needs-profile';

export interface SessionDependencies {
  readonly api: ApiClient;
  readonly auth: CloudbaseAuthClient;
}

export interface RegisterInput {
  readonly email: string;
  readonly password: string;
  readonly realName: string;
  readonly username: string;
}

type VerifyEmailCode = (input: {
  readonly token: string;
}) => Promise<CloudbaseAuthResult<{ readonly session?: CloudbaseSession }>>;

interface PendingRegistration {
  readonly realName: string;
  readonly verifyEmailCode: VerifyEmailCode;
}

export function createSessionManager(dependencies: SessionDependencies) {
  const errorMessage = ref<string | undefined>();
  const pendingRegistration = ref<PendingRegistration | undefined>();
  const profile = ref<UserProfile | undefined>();
  const status = ref<SessionStatus>('loading');
  let restorePromise: Promise<void> | undefined;

  const isAuthenticated = computed(() => status.value === 'authenticated');
  const needsProfile = computed(() => status.value === 'needs-profile');
  const hasPendingRegistration = computed(() => pendingRegistration.value !== undefined);

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
    const result = await dependencies.auth.signInWithPassword(input);
    const session = getAuthenticatedSession(result);
    if (session === undefined) {
      clearSession();
      throw new SessionError('登录状态未能建立，请重试。');
    }

    await loadProfile();
  }

  async function beginRegistration(input: RegisterInput): Promise<void> {
    clearError();
    const result = await dependencies.auth.signUp({
      email: input.email,
      password: input.password,
      username: input.username,
    });

    if (result.error !== null && result.error !== undefined) {
      throw new CloudbaseAuthenticationError(result.error.message ?? '无法发送邮箱验证码。');
    }

    const verifyEmailCode = result.data?.verifyOtp;
    if (verifyEmailCode === undefined) {
      throw new CloudbaseAuthenticationError('认证服务未返回邮箱验证码确认步骤。');
    }

    pendingRegistration.value = {
      realName: input.realName,
      verifyEmailCode,
    };
  }

  async function completeRegistration(code: string): Promise<void> {
    const pending = pendingRegistration.value;
    if (pending === undefined) {
      throw new SessionError('请先提交注册资料。');
    }

    const result = await pending.verifyEmailCode({ token: code });
    const session = getAuthenticatedSession(result);
    if (session === undefined) {
      throw new SessionError('邮箱验证未能建立登录状态，请重试。');
    }

    pendingRegistration.value = undefined;
    await createProfile(pending.realName);
  }

  async function completeProfile(realName: string): Promise<void> {
    clearError();
    let session: CloudbaseSession | undefined;
    try {
      session = getAuthenticatedSession(await dependencies.auth.getSession());
    } catch (error) {
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

  function discardPendingRegistration(): void {
    pendingRegistration.value = undefined;
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
    pendingRegistration.value = undefined;
    profile.value = undefined;
    status.value = 'anonymous';
  }

  function clearError(): void {
    errorMessage.value = undefined;
  }

  return {
    beginRegistration,
    completeProfile,
    completeRegistration,
    discardPendingRegistration,
    errorMessage,
    hasPendingRegistration,
    isAuthenticated,
    needsProfile,
    profile,
    restore,
    signIn,
    signOut,
    status,
  };
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
