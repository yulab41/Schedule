import type { UserProfile } from '@schedule/contracts';
import { describe, expect, it, vi } from 'vitest';

import { ApiClientError } from '../api/client.js';
import type { CloudbaseAuthClient, CloudbaseSession } from '../auth/cloudbase.js';
import { createSessionManager, type UserProfileApi } from './session.js';

vi.mock('@cloudbase/js-sdk', () => ({
  default: { init: vi.fn() },
}));

const profile: UserProfile = {
  id: 'profile-1',
  realName: '张医生',
  version: 1,
};

const authenticatedSession: CloudbaseSession = {
  access_token: 'signed-in-token',
  user: { is_anonymous: false },
};

describe('session manager', () => {
  it('recovers a verified CloudBase session before exposing protected data', async () => {
    const api = createApiClient();
    const auth = createAuthClient();
    const manager = createSessionManager({ api, auth });

    await manager.restore();

    expect(api.getCurrentProfile).toHaveBeenCalledOnce();
    expect(manager.profile.value).toEqual(profile);
    expect(manager.status.value).toBe('authenticated');
  });

  it('remains anonymous without a confirmed CloudBase session', async () => {
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

  it('clears protected state even when CloudBase sign-out fails', async () => {
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

  it('treats a missing CloudBase credential as anonymous instead of an error', async () => {
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

function createAuthClient(overrides: Partial<CloudbaseAuthClient> = {}): CloudbaseAuthClient {
  return {
    clearDevIdentity: vi.fn(),
    getSession: vi.fn().mockResolvedValue({ data: { session: authenticatedSession } }),
    setDevIdentity: vi.fn(),
    signInWithPassword: vi.fn().mockResolvedValue({ data: { session: authenticatedSession } }),
    signOut: vi.fn().mockResolvedValue({ data: {} }),
    ...overrides,
  };
}
