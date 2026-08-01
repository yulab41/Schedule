import type { UserProfile } from '@schedule/contracts';
import { describe, expect, it, vi } from 'vitest';

import type { ApiClient } from '../api/client.js';
import { ApiClientError } from '../api/client.js';
import type { CloudbaseAuthClient, CloudbaseSession } from '../auth/cloudbase.js';
import { createSessionManager } from './session.js';

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
});

function createApiClient(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    createCurrentProfile: vi.fn().mockResolvedValue(profile),
    getCurrentProfile: vi.fn().mockResolvedValue(profile),
    ...overrides,
  };
}

function createAuthClient(overrides: Partial<CloudbaseAuthClient> = {}): CloudbaseAuthClient {
  return {
    getSession: vi.fn().mockResolvedValue({ data: { session: authenticatedSession } }),
    signInWithPassword: vi.fn().mockResolvedValue({ data: { session: authenticatedSession } }),
    signOut: vi.fn().mockResolvedValue({ data: {} }),
    ...overrides,
  };
}
