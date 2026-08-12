import type { UserProfile } from '@schedule/contracts';
import { describe, expect, it, vi } from 'vitest';

import { ApiClientError } from '../../api/client.js';
import { createProfileController } from './profile-controller.js';

const profile: UserProfile = { id: 'user-1', realName: '原姓名', version: 3 };

describe('profile controller', () => {
  it('saves against the current version and synchronizes the returned profile to session', async () => {
    const replaceSessionProfile = vi.fn();
    const updateProfile = vi.fn(() =>
      Promise.resolve({ ...profile, realName: '新姓名', version: 4 }),
    );
    const controller = createProfileController({
      clearSession: vi.fn(),
      getCurrentProfile: vi.fn(() => Promise.resolve(profile)),
      navigateToLogin: vi.fn(),
      replaceSessionProfile,
      updateProfile,
    });

    controller.activate(profile);
    controller.setDraftRealName(' 新姓名 ');
    await controller.saveProfile();

    expect(updateProfile).toHaveBeenCalledWith({ realName: '新姓名', version: 3 });
    expect(replaceSessionProfile).toHaveBeenCalledWith({
      ...profile,
      realName: '新姓名',
      version: 4,
    });
    expect(controller.state.profile).toEqual({ ...profile, realName: '新姓名', version: 4 });
  });

  it('refreshes the latest profile after a conflict, surfaces the original message, and does not replay', async () => {
    const conflict = new ApiClientError(
      'CONFLICT',
      '资料已被更新，请刷新后重试。',
      'request-1',
      undefined,
      409,
    );
    const latest = { ...profile, realName: '其他设备姓名', version: 4 };
    const updateProfile = vi.fn(() => Promise.reject(conflict));
    const controller = createProfileController({
      clearSession: vi.fn(),
      getCurrentProfile: vi.fn(() => Promise.resolve(latest)),
      navigateToLogin: vi.fn(),
      replaceSessionProfile: vi.fn(),
      updateProfile,
    });

    controller.activate(profile);
    controller.setDraftRealName('本机姓名');
    await expect(controller.saveProfile()).rejects.toBe(conflict);

    expect(controller.state.errorMessage).toBe('资料已被更新，请刷新后重试。');
    expect(controller.state.profile).toEqual(latest);
    expect(controller.state.draftRealName).toBe('其他设备姓名');
    expect(updateProfile).toHaveBeenCalledTimes(1);
    expect(controller.state.isSaving).toBe(false);
  });

  it('single-flights logout and always navigates to login even when local cleanup throws', () => {
    const clearSession = vi.fn(() => {
      throw new Error('storage unavailable');
    });
    const navigateToLogin = vi.fn();
    const controller = createProfileController({
      clearSession,
      getCurrentProfile: vi.fn(() => Promise.resolve(profile)),
      navigateToLogin,
      replaceSessionProfile: vi.fn(),
      updateProfile: vi.fn(() => Promise.resolve(profile)),
    });

    controller.activate(profile);
    controller.logout();
    controller.logout();

    expect(clearSession).toHaveBeenCalledTimes(1);
    expect(navigateToLogin).toHaveBeenCalledTimes(1);
    expect(controller.state.isLoggingOut).toBe(true);
  });
});
