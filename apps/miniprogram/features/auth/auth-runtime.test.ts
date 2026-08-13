import { describe, expect, it, vi } from 'vitest';

import type { AuthLandingStatus } from './auth-flow.js';
import { createAuthRuntime, type AuthRuntimeDependencies } from './auth-runtime.js';

function createHarness() {
  let currentRoute = 'pages/calendar/index';
  let pendingInviteToken: string | undefined;
  let restoreError: unknown;
  let status: AuthLandingStatus = 'authenticated';
  let unauthorizedHandler: (() => void) | undefined;
  const markUnauthorized = vi.fn(() => {
    status = 'anonymous';
  });
  const reportBootstrapError = vi.fn();
  const reLaunch = vi.fn();
  const switchTab = vi.fn();
  const dependencies = {
    getCurrentRoute: () => currentRoute,
    reLaunch,
    session: {
      get state() {
        return { status };
      },
      getPendingInviteToken: () => pendingInviteToken,
      markUnauthorized,
      restore: vi.fn(() =>
        restoreError === undefined ? Promise.resolve() : Promise.reject(restoreError),
      ),
    },
    reportBootstrapError,
    setUnauthorizedHandler: vi.fn((handler: () => void) => {
      unauthorizedHandler = handler;
    }),
    switchTab,
  } satisfies AuthRuntimeDependencies;
  return {
    dependencies,
    markUnauthorized,
    reLaunch,
    reportBootstrapError,
    runtime: createAuthRuntime(dependencies),
    switchTab,
    handler: () => unauthorizedHandler,
    setCurrentRoute: (route: string) => {
      currentRoute = route;
    },
    setPendingInviteToken: (token: string | undefined) => {
      pendingInviteToken = token;
    },
    setRestoreError: (error: unknown) => {
      restoreError = error;
    },
    setStatus: (next: AuthLandingStatus) => {
      status = next;
    },
  };
}

describe('auth runtime', () => {
  it('marks memory state and coalesces repeated protected-401 login navigation', () => {
    const harness = createHarness();
    harness.runtime.initialize();
    const handler = harness.handler();
    if (handler === undefined) throw new Error('unauthorized handler was not registered');
    handler();
    handler();
    harness.runtime.navigateForCurrentSession();
    expect(harness.markUnauthorized).toHaveBeenCalledTimes(2);
    expect(harness.reLaunch).toHaveBeenCalledTimes(1);
    expect(harness.reLaunch).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/pages/auth/login/index' }),
    );
  });

  it('resets the navigation latch after sign-in and switches to workbench once', () => {
    const harness = createHarness();
    harness.runtime.initialize();
    const handler = harness.handler();
    if (handler === undefined) throw new Error('unauthorized handler was not registered');
    handler();
    harness.setStatus('authenticated');
    harness.setCurrentRoute('pages/auth/login/index');
    harness.setPendingInviteToken(undefined);
    harness.runtime.resetUnauthorizedNavigation();
    harness.runtime.navigateForCurrentSession();
    expect(harness.switchTab).toHaveBeenCalledWith({ url: '/pages/workbench/index' });
  });

  it('returns a committed invite with no pending token to its recovery page', () => {
    const harness = createHarness();
    harness.setStatus('invite-refresh-required');
    harness.setPendingInviteToken(undefined);

    harness.runtime.navigateForCurrentSession();

    expect(harness.reLaunch).toHaveBeenCalledWith({ url: '/pages/invite/invite' });
    expect(harness.switchTab).not.toHaveBeenCalled();
  });

  it('terminates a launch restore rejection through the injected reporter', async () => {
    const harness = createHarness();
    const error = new Error('navigation unavailable');
    harness.setRestoreError(error);
    harness.runtime.restoreAndNavigate();
    await vi.waitFor(() => expect(harness.reportBootstrapError).toHaveBeenCalledWith(error));
  });
});
