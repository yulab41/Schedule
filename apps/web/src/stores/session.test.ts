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

  it('creates the business profile only after email verification creates a session', async () => {
    const verifyOtp = vi.fn().mockResolvedValue({ data: { session: authenticatedSession } });
    const api = createApiClient();
    const auth = createAuthClient({
      signUp: vi.fn().mockResolvedValue({ data: { verifyOtp } }),
    });
    const manager = createSessionManager({ api, auth });

    await manager.beginRegistration({
      email: 'doctor@example.com',
      password: 'not-retained-after-submission',
      realName: profile.realName,
      username: 'doctor-zhang',
    });

    expect(api.createCurrentProfile).not.toHaveBeenCalled();

    await manager.completeRegistration('123456');

    expect(verifyOtp).toHaveBeenCalledWith({ token: '123456' });
    expect(api.createCurrentProfile).toHaveBeenCalledWith({ realName: profile.realName });
    expect(manager.status.value).toBe('authenticated');
  });

  it('keeps a verified account ready to complete its profile after a profile-creation failure', async () => {
    const verifyOtp = vi.fn().mockResolvedValue({ data: { session: authenticatedSession } });
    const api = createApiClient({
      createCurrentProfile: vi
        .fn()
        .mockRejectedValue(new ApiClientError({ code: 'NETWORK_ERROR', message: '网络不可用。' })),
    });
    const auth = createAuthClient({
      signUp: vi.fn().mockResolvedValue({ data: { verifyOtp } }),
    });
    const manager = createSessionManager({ api, auth });

    await manager.beginRegistration({
      email: 'doctor@example.com',
      password: 'not-retained-after-submission',
      realName: profile.realName,
      username: 'doctor-zhang',
    });

    await expect(manager.completeRegistration('123456')).rejects.toThrow('网络不可用。');

    expect(manager.hasPendingRegistration.value).toBe(false);
    expect(manager.needsProfile.value).toBe(true);
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
    signUp: vi.fn(),
    ...overrides,
  };
}
