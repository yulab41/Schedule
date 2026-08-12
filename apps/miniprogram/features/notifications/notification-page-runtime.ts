import type { SessionState } from '../../store/session.js';
import { guardMiniprogramRoute, type RouteGuardNavigation } from '../navigation/route-guard.js';

export interface NotificationsPageContext {
  readonly groupId: string | undefined;
  readonly userId: string;
}

export function activateNotificationsPage(
  state: Pick<
    SessionState,
    'activeGroupId' | 'groups' | 'isPlatformAdmin' | 'profile' | 'status' | 'token'
  >,
  navigation: RouteGuardNavigation,
  onAllowed: (context: NotificationsPageContext) => void,
): boolean {
  if (!guardMiniprogramRoute(state, '/pages/notifications/index', navigation)) return false;
  const profile = state.profile;
  if (state.status !== 'authenticated' || profile === undefined) return false;
  const activeGroup = state.groups.find((group) => group.id === state.activeGroupId);
  onAllowed({
    groupId: activeGroup?.role === 'guest' ? undefined : activeGroup?.id,
    userId: profile.id,
  });
  return true;
}
