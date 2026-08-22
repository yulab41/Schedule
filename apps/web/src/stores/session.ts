import type { UserProfile } from '@schedule/contracts';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import {
  localAuth,
  getAuthenticatedSession,
  type AuthClient,
  type AuthSession,
} from '../auth/local-auth.js';
import { ApiClientError, createApiClient } from '../api/client.js';
import { toUserMessage } from '../utils/user-message.js';
import { passwordAuth, type PasswordAuthClient } from '../auth/password-auth.js';

export type SessionStatus = 'anonymous' | 'authenticated' | 'error' | 'loading' | 'needs-profile';

export interface UserProfileApi {
  createCurrentProfile(input: { readonly realName: string }): Promise<UserProfile>;
  getCurrentProfile(): Promise<UserProfile>;
}

export interface SessionDependencies {
  readonly api: UserProfileApi;
  readonly auth: AuthClient;
  readonly passwordAuth?: PasswordAuthClient;
}

const passwordReminderDismissedStorageKeyPrefix = 'schedule.password-reminder.dismissed.';

function getBrowserStorage(): Storage | undefined {
  return typeof globalThis.localStorage === 'undefined' ? undefined : globalThis.localStorage;
}

function passwordReminderDismissedStorageKey(profileId: string): string {
  return `${passwordReminderDismissedStorageKeyPrefix}${profileId}`;
}

function hasDismissedPasswordReminder(profileId: string | undefined): boolean {
  if (profileId === undefined || profileId.length === 0) return false;
  try {
    return getBrowserStorage()?.getItem(passwordReminderDismissedStorageKey(profileId)) === 'true';
  } catch {
    return false;
  }
}

function persistPasswordReminderDismissal(profileId: string | undefined): void {
  if (profileId === undefined || profileId.length === 0) return;
  try {
    getBrowserStorage()?.setItem(passwordReminderDismissedStorageKey(profileId), 'true');
  } catch {
    // A storage restriction should not block the current session from continuing.
  }
}

export function createSessionManager(dependencies: SessionDependencies) {
  const errorMessage = ref<string | undefined>();
  const mustChangePassword = ref(false);
  const passwordReminderDismissed = ref(false);
  const profile = ref<UserProfile | undefined>();
  const status = ref<SessionStatus>('loading');
  let restorePromise: Promise<void> | undefined;

  const isAuthenticated = computed(() => status.value === 'authenticated');
  const needsProfile = computed(() => status.value === 'needs-profile');
  const passwordReminderVisible = computed(
    () => mustChangePassword.value && !passwordReminderDismissed.value,
  );

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
      const result = await (
        dependencies.passwordAuth ?? createLegacyPasswordAuth(dependencies.auth)
      ).login({
        password: input.password,
        username,
      });
      if (result.token.length === 0) {
        clearSession();
        throw new SessionError('登录状态未能建立，请重试。');
      }
      dependencies.auth.setSession(result.token);
      mustChangePassword.value = result.mustChangePassword;
      passwordReminderDismissed.value = false;
    } catch (error) {
      if (isMissingSessionError(error)) {
        throw new SessionError('账号或密码不正确，请重试。');
      }
      throw error;
    }

    await loadProfile();
    syncPasswordReminderPreference();
  }

  async function register(input: {
    readonly password: string;
    readonly username: string;
  }): Promise<void> {
    clearError();
    const username = normalizeLoginAccount(input.username);
    if (username.length === 0) {
      throw new SessionError('请输入注册账号。');
    }
    if (input.password.length === 0) {
      throw new SessionError('请输入密码。');
    }

    const result = await (
      dependencies.passwordAuth ?? createLegacyPasswordAuth(dependencies.auth)
    ).register({ password: input.password, username });
    if (result.token.length === 0) {
      clearSession();
      throw new SessionError('登录状态未能建立，请重试。');
    }
    dependencies.auth.setSession(result.token);
    mustChangePassword.value = result.mustChangePassword;
    passwordReminderDismissed.value = false;
    await loadProfile();
    syncPasswordReminderPreference();
  }

  async function signInDev(uid: string): Promise<void> {
    clearError();
    dependencies.auth.setDevIdentity(uid);
    await loadProfile();
  }

  async function signInToken(accessToken: string): Promise<void> {
    clearError();
    if (accessToken.trim().length === 0) {
      throw new SessionError('登录状态无效，请重新扫码登录。');
    }
    dependencies.auth.setSession(accessToken);
    await loadProfile();
    await refreshPasswordStatus();
  }

  async function changePassword(input: {
    readonly currentPassword: string;
    readonly newPassword: string;
  }): Promise<void> {
    clearError();
    const client = dependencies.passwordAuth;
    if (client === undefined) {
      throw new SessionError('当前登录方式不支持修改密码。');
    }
    await client.changePassword(input);
    mustChangePassword.value = false;
    passwordReminderDismissed.value = true;
  }

  function dismissPasswordReminder(): void {
    passwordReminderDismissed.value = true;
    persistPasswordReminderDismissal(profile.value?.id);
  }

  function closePasswordReminder(): void {
    passwordReminderDismissed.value = true;
  }

  async function completeProfile(realName: string): Promise<void> {
    clearError();
    let session: AuthSession | undefined;
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
      await refreshPasswordStatus();
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

  async function refreshPasswordStatus(): Promise<void> {
    const getStatus = dependencies.passwordAuth?.getStatus;
    if (getStatus === undefined) {
      mustChangePassword.value = false;
      return;
    }
    try {
      const passwordStatus = await getStatus.call(dependencies.passwordAuth);
      mustChangePassword.value = passwordStatus.mustChangePassword;
      syncPasswordReminderPreference();
    } catch {
      mustChangePassword.value = false;
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
    errorMessage.value = toUserMessage(error, '操作未完成，请稍后重试。');
  }

  function clearSession(): void {
    mustChangePassword.value = false;
    passwordReminderDismissed.value = false;
    profile.value = undefined;
    status.value = 'anonymous';
  }

  function clearError(): void {
    errorMessage.value = undefined;
  }

  function syncPasswordReminderPreference(): void {
    passwordReminderDismissed.value = hasDismissedPasswordReminder(profile.value?.id);
  }

  return {
    changePassword,
    closePasswordReminder,
    completeProfile,
    dismissPasswordReminder,
    errorMessage,
    isAuthenticated,
    mustChangePassword,
    needsProfile,
    profile,
    passwordReminderVisible,
    restore,
    signInDev,
    signInToken,
    signIn,
    register,
    signOut,
    status,
  };
}

export function normalizeLoginAccount(username: string): string {
  return username.trim().toLowerCase();
}

export const useSessionStore = defineStore('session', () =>
  createSessionManager({
    api: createApiClient({ auth: localAuth }),
    auth: localAuth,
    passwordAuth,
  }),
);

export class SessionError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'SessionError';
  }
}

function isMissingSessionError(error: unknown): boolean {
  return (
    error instanceof Error &&
    /credentials?\s+not\s+found|credential\s*not\s*found/iu.test(error.message)
  );
}

function createLegacyPasswordAuth(auth: AuthClient): PasswordAuthClient {
  return {
    changePassword() {
      return Promise.reject(new SessionError('当前登录方式不支持修改密码。'));
    },
    getStatus() {
      return Promise.resolve({ hasPassword: false, mustChangePassword: false });
    },
    login(input) {
      return auth.signInWithPassword(input).then((result) => ({
        isNewUser: false,
        mustChangePassword: false,
        profile: undefined,
        token: result.data?.session?.access_token ?? '',
      }));
    },
    register() {
      return Promise.reject(new SessionError('注册服务暂时不可用，请稍后重试。'));
    },
  };
}
