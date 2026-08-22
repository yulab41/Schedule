import type { UserProfile } from '@schedule/contracts';
import { describe, expect, it, vi } from 'vitest';

import { ApiClientError } from '../api/client.js';
import type { AuthClient, AuthSession } from '../auth/local-auth.js';
import { createSessionManager, type UserProfileApi } from './session.js';

const profile: UserProfile = {
  id: 'profile-1',
  realName: '张医生',
  version: 1,
};

const authenticatedSession: AuthSession = {
  access_token: 'signed-in-token',
  user: { is_anonymous: false },
};

describe('session manager', () => {
  it('recovers a verified session before exposing protected data', async () => {
    const api = createApiClient();
    const auth = createAuthClient();
    const manager = createSessionManager({ api, auth });

    await manager.restore();

    expect(api.getCurrentProfile).toHaveBeenCalledOnce();
    expect(manager.profile.value).toEqual(profile);
    expect(manager.status.value).toBe('authenticated');
  });

  it('checks the default-password status when restoring an authenticated session', async () => {
    const passwordAuth = {
      changePassword: vi.fn(),
      getStatus: vi.fn().mockResolvedValue({ hasPassword: true, mustChangePassword: true }),
      login: vi.fn(),
      register: vi.fn(),
    };
    const manager = createSessionManager({
      api: createApiClient(),
      auth: createAuthClient(),
      passwordAuth,
    });

    await manager.restore();

    expect(passwordAuth.getStatus).toHaveBeenCalledOnce();
    expect(manager.passwordReminderVisible.value).toBe(true);
  });

  it('remains anonymous without a confirmed session', async () => {
    const api = createApiClient();
    const auth = createAuthClient({
      getSession: vi.fn().mockResolvedValue({ data: {} }),
    });
    const manager = createSessionManager({ api, auth });

    await manager.restore();

    expect(api.getCurrentProfile).not.toHaveBeenCalled();
    expect(manager.status.value).toBe('anonymous');
  });

  it('clears the session when the protected profile request is unauthorized', async () => {
    const api = createApiClient({
      getCurrentProfile: vi
        .fn()
        .mockRejectedValue(
          new ApiClientError({ message: '登录状态已失效，请重新登录。', status: 401 }),
        ),
    });
    const manager = createSessionManager({ api, auth: createAuthClient() });

    await manager.restore();

    expect(manager.profile.value).toBeUndefined();
    expect(manager.status.value).toBe('anonymous');
  });

  it('normalizes the login account without constraining the submitted password', async () => {
    const api = createApiClient();
    const auth = createAuthClient();
    const manager = createSessionManager({ api, auth });

    await manager.signIn({ password: '!', username: '  LinEnYu  ' });

    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      password: '!',
      username: 'linenyu',
    });
    expect(manager.status.value).toBe('authenticated');
    expect(manager).not.toHaveProperty('password');

    await expect(manager.signIn({ password: '', username: 'linenyu' })).rejects.toThrow(
      '请输入密码。',
    );
    expect(auth.signInWithPassword).toHaveBeenCalledTimes(1);
  });

  it('uses the production password auth client and stores its signed session', async () => {
    const api = createApiClient();
    const auth = createAuthClient();
    const passwordAuth = {
      changePassword: vi.fn(),
      getStatus: vi.fn(),
      login: vi.fn().mockResolvedValue({
        isNewUser: false,
        mustChangePassword: true,
        token: 'password-token',
      }),
      register: vi.fn(),
    };
    const manager = createSessionManager({ api, auth, passwordAuth });

    await manager.signIn({ password: 'password-1', username: '  LinEnYu  ' });

    expect(passwordAuth.login).toHaveBeenCalledWith({
      password: 'password-1',
      username: 'linenyu',
    });
    expect(auth.setSession).toHaveBeenCalledWith('password-token');
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
    expect(manager.mustChangePassword.value).toBe(true);
    expect(manager.passwordReminderVisible.value).toBe(true);
  });

  it('changes the current password and clears the default-password reminder', async () => {
    const passwordAuth = {
      changePassword: vi.fn().mockResolvedValue({ passwordChanged: true }),
      getStatus: vi.fn(),
      login: vi.fn().mockResolvedValue({
        isNewUser: false,
        mustChangePassword: true,
        token: 'password-token',
      }),
      register: vi.fn(),
    };
    const manager = createSessionManager({
      api: createApiClient(),
      auth: createAuthClient(),
      passwordAuth,
    });
    await manager.signIn({ password: '123', username: 'linenyu' });

    await manager.changePassword({
      currentPassword: '123',
      newPassword: 'changed-password',
    });

    expect(passwordAuth.changePassword).toHaveBeenCalledOnce();
    expect(manager.mustChangePassword.value).toBe(false);
    expect(manager.passwordReminderVisible.value).toBe(false);
  });

  it('persists opting out of the default-password reminder across restored sessions', async () => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    });

    try {
      const passwordAuth = {
        changePassword: vi.fn(),
        getStatus: vi.fn().mockResolvedValue({ hasPassword: true, mustChangePassword: true }),
        login: vi.fn().mockResolvedValue({
          isNewUser: false,
          mustChangePassword: true,
          token: 'password-token',
        }),
        register: vi.fn(),
      };
      const manager = createSessionManager({
        api: createApiClient(),
        auth: createAuthClient(),
        passwordAuth,
      });

      await manager.signIn({ password: '123', username: 'linenyu' });
      manager.dismissPasswordReminder();

      expect(manager.passwordReminderVisible.value).toBe(false);
      expect(values.get('schedule.password-reminder.dismissed.profile-1')).toBe('true');

      const restoredManager = createSessionManager({
        api: createApiClient(),
        auth: createAuthClient(),
        passwordAuth,
      });
      await restoredManager.restore();

      expect(restoredManager.passwordReminderVisible.value).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('closes the reminder for the current session without persisting an opt-out', async () => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    });

    try {
      const manager = createSessionManager({
        api: createApiClient(),
        auth: createAuthClient(),
        passwordAuth: {
          changePassword: vi.fn(),
          getStatus: vi.fn().mockResolvedValue({ hasPassword: true, mustChangePassword: true }),
          login: vi.fn().mockResolvedValue({
            isNewUser: false,
            mustChangePassword: true,
            token: 'password-token',
          }),
          register: vi.fn(),
        },
      });

      await manager.signIn({ password: '123', username: 'linenyu' });
      manager.closePasswordReminder();

      expect(manager.passwordReminderVisible.value).toBe(false);
      expect(values.get('schedule.password-reminder.dismissed.profile-1')).toBeUndefined();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('clears protected state even when sign-out fails', async () => {
    const manager = createSessionManager({
      api: createApiClient(),
      auth: createAuthClient({
        signOut: vi.fn().mockRejectedValue(new Error('sign-out unavailable')),
      }),
    });

    await manager.restore();
    await expect(manager.signOut()).rejects.toThrow('sign-out unavailable');

    expect(manager.profile.value).toBeUndefined();
    expect(manager.status.value).toBe('anonymous');
  });

  it('accepts a verified web login token and loads the current profile', async () => {
    const auth = createAuthClient();
    const manager = createSessionManager({ api: createApiClient(), auth });

    await manager.signInToken('web-session-token');

    expect(auth.setSession).toHaveBeenCalledWith('web-session-token');
    expect(manager.status.value).toBe('authenticated');
  });

  it('treats a missing credential as anonymous instead of an error', async () => {
    const api = createApiClient();
    const auth = createAuthClient({
      getSession: vi.fn().mockRejectedValue(new Error('credentials not found')),
    });
    const manager = createSessionManager({ api, auth });

    await manager.restore();

    expect(api.getCurrentProfile).not.toHaveBeenCalled();
    expect(manager.status.value).toBe('anonymous');
    expect(manager.errorMessage.value).toBeUndefined();
  });

  it('shows a friendly message when sign-in reports missing credentials', async () => {
    const manager = createSessionManager({
      api: createApiClient(),
      auth: createAuthClient({
        signInWithPassword: vi.fn().mockRejectedValue(new Error('Credentials Not Found')),
      }),
    });

    await expect(manager.signIn({ password: 'secret', username: 'linenyu' })).rejects.toThrow(
      '账号或密码不正确，请重试。',
    );
    expect(manager.status.value).toBe('loading');
  });
});

function createApiClient(overrides: Partial<UserProfileApi> = {}): UserProfileApi {
  return {
    createCurrentProfile: vi.fn().mockResolvedValue(profile),
    getCurrentProfile: vi.fn().mockResolvedValue(profile),
    ...overrides,
  };
}

function createAuthClient(overrides: Partial<AuthClient> = {}): AuthClient {
  return {
    clearDevIdentity: vi.fn(),
    getSession: vi.fn().mockResolvedValue({ data: { session: authenticatedSession } }),
    setSession: vi.fn(),
    setDevIdentity: vi.fn(),
    signInWithPassword: vi.fn().mockResolvedValue({ data: { session: authenticatedSession } }),
    signOut: vi.fn().mockResolvedValue({ data: {} }),
    ...overrides,
  };
}
