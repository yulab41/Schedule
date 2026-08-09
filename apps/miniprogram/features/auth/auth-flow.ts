export const loginRoute = '/pages/auth/login/index';
export const profileSetupRoute = '/pages/auth/profile-setup/index';
export const inviteRoute = '/pages/invite/invite';
export const workbenchRoute = '/pages/workbench/index';

export type AuthLandingStatus =
  'anonymous' | 'authenticated' | 'error' | 'loading' | 'needs-profile';

export type SessionLandingTarget =
  | { readonly kind: 'none' }
  | { readonly kind: 'reLaunch'; readonly url: string }
  | { readonly kind: 'switchTab'; readonly url: string };

export interface WechatLoginPort {
  login(options: {
    readonly fail: (error: { readonly errMsg: string }) => void;
    readonly success: (result: { readonly code: string }) => void;
  }): void;
}

export class WechatLoginError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'WechatLoginError';
  }
}

export function requestWechatLoginCode(port: WechatLoginPort): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    port.login({
      fail: () => reject(new WechatLoginError('微信登录失败，请重试。')),
      success: (result) => {
        if (result.code.length === 0) {
          reject(new WechatLoginError('微信未返回登录凭证，请重试。'));
          return;
        }
        resolve(result.code);
      },
    });
  });
}

export function readInviteToken(
  query: Readonly<Record<string, string | undefined>>,
): string | undefined {
  const token = query.t;
  return token === undefined || token.length === 0 ? undefined : token;
}

export function getSessionLandingTarget(
  status: AuthLandingStatus,
  hasPendingInvite: boolean,
): SessionLandingTarget {
  if (status === 'anonymous') {
    return { kind: 'reLaunch', url: loginRoute };
  }
  if (status === 'needs-profile') {
    return { kind: 'reLaunch', url: profileSetupRoute };
  }
  if (status === 'authenticated') {
    return hasPendingInvite
      ? { kind: 'reLaunch', url: inviteRoute }
      : { kind: 'switchTab', url: workbenchRoute };
  }
  return { kind: 'none' };
}

export interface ReLaunchPort {
  getCurrentRoute(): string | undefined;
  reLaunch(options: {
    readonly fail?: () => void;
    readonly success?: () => void;
    readonly url: string;
  }): void;
}

export interface UnauthorizedNavigator {
  readonly redirectToLogin: () => void;
  readonly reset: () => void;
}

export function createUnauthorizedNavigator(port: ReLaunchPort): UnauthorizedNavigator {
  let redirecting = false;

  return {
    redirectToLogin: () => {
      if (redirecting || port.getCurrentRoute() === loginRoute.slice(1)) {
        return;
      }
      redirecting = true;
      try {
        port.reLaunch({
          fail: () => {
            redirecting = false;
          },
          url: loginRoute,
        });
      } catch (error) {
        redirecting = false;
        throw error;
      }
    },
    reset: () => {
      redirecting = false;
    },
  };
}
