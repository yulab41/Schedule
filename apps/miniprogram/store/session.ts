import { getStoredToken, storeToken } from '../api/client.js';

const pendingInviteStorageKey = 'schedule.pendingInviteToken';

export interface SessionState {
  readonly needsProfile: boolean;
  readonly isAuthenticated: boolean;
  readonly token: string | undefined;
  readonly userId: string | undefined;
}

class SessionStore {
  private token: string | undefined = getStoredToken();
  private needsProfile = false;
  private userId: string | undefined;

  public get state(): SessionState {
    return {
      isAuthenticated: this.token !== undefined,
      needsProfile: this.needsProfile,
      token: this.token,
      userId: this.userId,
    };
  }

  public get pendingInviteToken(): string | undefined {
    const raw = wx.getStorageSync<string>(pendingInviteStorageKey);
    return typeof raw === 'string' && raw.length > 0 ? raw : undefined;
  }

  public setPendingInviteToken(token: string | undefined): void {
    if (token === undefined) {
      wx.removeStorageSync(pendingInviteStorageKey);
    } else {
      wx.setStorageSync(pendingInviteStorageKey, token);
    }
  }

  public setSession(token: string, userId?: string): void {
    this.token = token;
    this.userId = userId;
    storeToken(token);
  }

  public setNeedsProfile(needsProfile: boolean): void {
    this.needsProfile = needsProfile;
  }

  public clear(): void {
    this.token = undefined;
    this.needsProfile = false;
    this.userId = undefined;
    storeToken(undefined);
  }
}

export const sessionStore = new SessionStore();
