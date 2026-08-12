import type { GroupRole, GroupSummary } from '@schedule/contracts';

import type { SessionState } from '../../store/session.js';

export type MiniprogramRoute =
  | '/pages/auth/login/index'
  | '/pages/auth/profile-setup/index'
  | '/pages/calendar/index'
  | '/pages/guest/guest'
  | '/pages/invite/invite'
  | '/pages/notifications/index'
  | '/pages/profile/index'
  | '/pages/workbench/index'
  | `/subpackages/${string}`;

export interface RouteGuardNavigation {
  hideTabBar(): void;
  reLaunch(options: { readonly url: string }): void;
  showTabBar(): void;
  switchTab(options: { readonly url: '/pages/workbench/index' }): void;
}

export interface MiniprogramRouteAccess {
  readonly allowed: boolean;
  readonly hideTabBar: boolean;
  readonly redirect?:
    '/pages/auth/login/index' | '/pages/auth/profile-setup/index' | '/pages/workbench/index';
}

function groupFor(
  state: Pick<SessionState, 'activeGroupId' | 'groups'>,
  groupId: string | undefined,
): GroupSummary | undefined {
  const target = groupId ?? state.activeGroupId;
  return target === undefined ? undefined : state.groups.find((group) => group.id === target);
}

function isGuestGroup(
  state: Pick<SessionState, 'activeGroupId' | 'groups'>,
  groupId: string | undefined,
): boolean {
  return groupFor(state, groupId)?.role === 'guest';
}

function isAnonymousAllowed(path: MiniprogramRoute): boolean {
  return (
    path === '/pages/auth/login/index' ||
    path === '/pages/auth/profile-setup/index' ||
    path === '/pages/invite/invite' ||
    path === '/pages/guest/guest'
  );
}

function isGuestAllowed(path: MiniprogramRoute): boolean {
  return (
    path === '/pages/workbench/index' ||
    path === '/pages/calendar/index' ||
    path === '/pages/profile/index' ||
    path === '/pages/guest/guest'
  );
}

function requiresMembership(path: MiniprogramRoute): boolean {
  return path === '/pages/notifications/index' || path.startsWith('/subpackages/');
}

export function resolveMiniprogramRouteAccess(
  state: Pick<SessionState, 'activeGroupId' | 'groups' | 'status'>,
  path: MiniprogramRoute,
  groupId?: string,
): MiniprogramRouteAccess {
  if (state.status !== 'authenticated') {
    if (isAnonymousAllowed(path))
      return { allowed: true, hideTabBar: path === '/pages/guest/guest' };
    return {
      allowed: false,
      hideTabBar: false,
      redirect:
        state.status === 'needs-profile'
          ? '/pages/auth/profile-setup/index'
          : '/pages/auth/login/index',
    };
  }

  if (isGuestGroup(state, groupId)) {
    if (isGuestAllowed(path)) return { allowed: true, hideTabBar: true };
    return { allowed: false, hideTabBar: true, redirect: '/pages/workbench/index' };
  }

  if (requiresMembership(path) && groupId !== undefined && groupFor(state, groupId) === undefined)
    return { allowed: false, hideTabBar: false, redirect: '/pages/workbench/index' };

  return { allowed: true, hideTabBar: false };
}

export function guardMiniprogramRoute(
  state: Pick<SessionState, 'activeGroupId' | 'groups' | 'status'>,
  path: MiniprogramRoute,
  navigation: RouteGuardNavigation,
  groupId?: string,
): boolean {
  const access = resolveMiniprogramRouteAccess(state, path, groupId);
  if (access.hideTabBar) navigation.hideTabBar();
  else navigation.showTabBar();
  if (access.allowed) return true;
  if (access.redirect === '/pages/workbench/index') navigation.switchTab({ url: access.redirect });
  else navigation.reLaunch({ url: access.redirect ?? '/pages/auth/login/index' });
  return false;
}

export function isMembershipRouteRole(role: GroupRole | undefined): boolean {
  return role === 'administrator' || role === 'member' || role === 'owner';
}
