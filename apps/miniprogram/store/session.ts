import { getStoredToken, storeToken } from '../api/client.js';

export interface SessionState {
  readonly isAuthenticated: boolean;
  readonly token: string | undefined;
}

class SessionStore {
  private token: string | undefined = getStoredToken();

  public get state(): SessionState {
    return { isAuthenticated: this.token !== undefined, token: this.token };
  }

  public setSession(token: string): void {
    this.token = token;
    storeToken(token);
  }

  public clear(): void {
    this.token = undefined;
    storeToken(undefined);
  }
}

export const sessionStore = new SessionStore();
