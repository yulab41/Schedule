import type { GroupSummary } from '@schedule/contracts';
import { describe, expect, it, vi } from 'vitest';

import {
  guardMiniprogramRoute,
  resolveMiniprogramRouteAccess,
  type RouteGuardNavigation,
} from './route-guard.js';

const guestGroup: GroupSummary = { id: 'guest-group', name: '访客群', role: 'guest', version: 1 };
const memberGroup: GroupSummary = {
  id: 'member-group',
  name: '成员群',
  role: 'member',
  version: 1,
};

function stateFor(groups: readonly GroupSummary[], activeGroupId = groups[0]?.id) {
  return {
    activeGroupId,
    groups,
    profile: { id: 'user-1', realName: '张医生', version: 1 },
    status: 'authenticated' as const,
    token: 'token',
  };
}

function navigation(): RouteGuardNavigation {
  return {
    hideTabBar: vi.fn(),
    reLaunch: vi.fn(),
    showTabBar: vi.fn(),
    switchTab: vi.fn(),
  };
}

describe('miniprogram route guard', () => {
  it('allows anonymous users only through auth, invite, and QR visitor paths', () => {
    expect(
      resolveMiniprogramRouteAccess({ groups: [], status: 'anonymous' }, '/pages/guest/guest'),
    ).toMatchObject({ allowed: true });
    expect(
      resolveMiniprogramRouteAccess(
        { groups: [], status: 'anonymous' },
        '/pages/notifications/index',
      ),
    ).toMatchObject({ allowed: false, redirect: '/pages/auth/login/index' });
  });

  it('blocks a guest before notification and workflow routes while keeping only its safe shell', () => {
    const guestState = stateFor([guestGroup]);
    expect(resolveMiniprogramRouteAccess(guestState, '/pages/calendar/index')).toMatchObject({
      allowed: true,
      hideTabBar: true,
    });
    expect(resolveMiniprogramRouteAccess(guestState, '/pages/profile/index')).toMatchObject({
      allowed: true,
      hideTabBar: true,
    });
    expect(resolveMiniprogramRouteAccess(guestState, '/pages/notifications/index')).toMatchObject({
      allowed: false,
      redirect: '/pages/workbench/index',
    });
    expect(
      resolveMiniprogramRouteAccess(
        guestState,
        '/subpackages/workflows/pages/requests/index',
        'guest-group',
      ),
    ).toMatchObject({ allowed: false, redirect: '/pages/workbench/index' });
  });

  it('does not elevate a guest through the platform-admin flag and redirects before data work', () => {
    const nav = navigation();
    const allowed = guardMiniprogramRoute(
      stateFor([guestGroup]),
      '/pages/notifications/index',
      nav,
    );

    expect(allowed).toBe(false);
    expect(nav.switchTab).toHaveBeenCalledWith({ url: '/pages/workbench/index' });
    expect(nav.reLaunch).not.toHaveBeenCalled();
  });

  it('uses the requested group context and returns the native tab bar for members', () => {
    const nav = navigation();
    expect(
      guardMiniprogramRoute(
        stateFor([guestGroup, memberGroup], 'guest-group'),
        '/pages/calendar/index',
        nav,
        'member-group',
      ),
    ).toBe(true);
    expect(nav.showTabBar).toHaveBeenCalledTimes(1);
    expect(nav.hideTabBar).not.toHaveBeenCalled();
  });
});
