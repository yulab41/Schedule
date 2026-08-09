import { setUnauthorizedHandler } from '../../api/client.js';
import { sessionStore } from '../../store/session.js';
import {
  createUnauthorizedNavigator,
  getSessionLandingTarget,
  loginRoute,
  type AuthLandingStatus,
  type ReLaunchPort,
} from './auth-flow.js';

export interface AuthRuntimeDependencies extends ReLaunchPort {
  readonly session: {
    readonly state: { readonly status: AuthLandingStatus };
    getPendingInviteToken(): string | undefined;
    markUnauthorized(): void;
    restore(): Promise<void>;
  };
  reportBootstrapError(error: unknown): void;
  setUnauthorizedHandler(handler: () => void): void;
  switchTab(options: { readonly url: string }): void;
}
export interface AuthRuntime {
  initialize(): void;
  navigateForCurrentSession(): void;
  resetUnauthorizedNavigation(): void;
  restoreAndNavigate(): void;
}

export function createAuthRuntime(dependencies: AuthRuntimeDependencies): AuthRuntime {
  const unauthorizedNavigator = createUnauthorizedNavigator(dependencies);
  const navigateForCurrentSession = (): void => {
    const target = getSessionLandingTarget(
      dependencies.session.state.status,
      dependencies.session.getPendingInviteToken() !== undefined,
    );
    if (target.kind === 'reLaunch' && target.url === loginRoute)
      unauthorizedNavigator.redirectToLogin();
    else if (target.kind === 'reLaunch') dependencies.reLaunch({ url: target.url });
    else if (target.kind === 'switchTab') dependencies.switchTab({ url: target.url });
  };
  return {
    initialize: () =>
      dependencies.setUnauthorizedHandler(() => {
        dependencies.session.markUnauthorized();
        unauthorizedNavigator.redirectToLogin();
      }),
    navigateForCurrentSession,
    resetUnauthorizedNavigation: unauthorizedNavigator.reset,
    restoreAndNavigate: () => {
      void dependencies.session
        .restore()
        .then(navigateForCurrentSession)
        .catch((error: unknown) => {
          try {
            dependencies.reportBootstrapError(error);
          } catch {
            return;
          }
        });
    },
  };
}

const authRuntime = createAuthRuntime({
  getCurrentRoute: () => {
    const pages = getCurrentPages();
    return pages[pages.length - 1]?.route;
  },
  reLaunch: (options) => wx.reLaunch(options),
  reportBootstrapError: (error) =>
    wx.showToast({
      icon: 'none',
      title: error instanceof Error ? error.message : '会话恢复失败，请重试。',
    }),
  session: sessionStore,
  setUnauthorizedHandler: (handler) => setUnauthorizedHandler(handler),
  switchTab: (options) => wx.switchTab(options),
});
export function initializeAuthRuntime(): void {
  authRuntime.initialize();
}
export function navigateForCurrentSession(): void {
  authRuntime.navigateForCurrentSession();
}
export function restoreAndNavigate(): void {
  authRuntime.restoreAndNavigate();
}
export function resetUnauthorizedNavigation(): void {
  authRuntime.resetUnauthorizedNavigation();
}
