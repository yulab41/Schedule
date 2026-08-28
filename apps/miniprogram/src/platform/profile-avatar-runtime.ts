import {
  getStoredWechatProfile,
  getStoredWechatToken,
  getWechatRequestAuthentication,
  updateStoredWechatAvatarVersion,
} from './wechat-identity.js';
import { createProfileMediaClient, type ProfileAvatarFlushResult } from './profile-media.js';

const profileMediaClient = createProfileMediaClient(
  getStoredWechatToken,
  getWechatRequestAuthentication(),
);

export async function flushPendingProfileAvatarForStoredSession(): Promise<ProfileAvatarFlushResult> {
  const profile = getStoredWechatProfile();
  if (profile === undefined) return { status: 'empty' };
  const result = await profileMediaClient.flushPending(profile.id);
  if (result.status === 'uploaded') {
    updateStoredWechatAvatarVersion(profile.id, result.avatarVersion);
  } else if (result.status === 'failed') {
    showAvatarUploadFailure();
  }
  return result;
}

export async function resolveStoredProfileAvatar(): Promise<string | undefined> {
  const profile = getStoredWechatProfile();
  if (profile === undefined) return undefined;
  return profileMediaClient.resolve(profile.id, profile.avatarVersion);
}

export async function removeStoredProfileAvatar(
  ownerId: string,
): Promise<{ readonly removed: boolean }> {
  const profile = getStoredWechatProfile();
  if (profile === undefined || profile.id !== ownerId) return { removed: false };
  const result = await profileMediaClient.remove(ownerId);
  updateStoredWechatAvatarVersion(ownerId, undefined);
  return result;
}

function showAvatarUploadFailure(): void {
  try {
    (
      wx as unknown as {
        showToast(options: {
          readonly duration: number;
          readonly icon: 'none';
          readonly title: string;
        }): unknown;
      }
    ).showToast({ duration: 2_000, icon: 'none', title: '本次头像未更新' });
  } catch {
    // The failed upload remains non-blocking even if the feedback bridge is unavailable.
  }
}
