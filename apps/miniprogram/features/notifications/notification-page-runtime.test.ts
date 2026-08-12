import type { GroupSummary } from '@schedule/contracts';
import { describe, expect, it, vi } from 'vitest';

import { activateNotificationsPage } from './notification-page-runtime.js';

const guestGroup: GroupSummary = { id: 'group-guest', name: '访客组', role: 'guest', version: 1 };
const memberGroup: GroupSummary = {
  id: 'group-member',
  name: '成员组',
  role: 'member',
  version: 1,
};

function navigation() {
  return {
    hideTabBar: vi.fn(),
    reLaunch: vi.fn(),
    showTabBar: vi.fn(),
    switchTab: vi.fn(),
  };
}

describe('notifications page activation', () => {
  it('redirects a guest before any notification or preference endpoint work begins', () => {
    const onAllowed = vi.fn();
    const nav = navigation();

    const allowed = activateNotificationsPage(
      {
        activeGroupId: guestGroup.id,
        groups: [guestGroup],
        isPlatformAdmin: true,
        profile: { id: 'user-1', realName: '访客', version: 1 },
        status: 'authenticated',
        token: 'token',
      },
      nav,
      onAllowed,
    );

    expect(allowed).toBe(false);
    expect(onAllowed).not.toHaveBeenCalled();
    expect(nav.switchTab).toHaveBeenCalledWith({ url: '/pages/workbench/index' });
  });

  it('passes only member-scoped context after the guard allows the route', () => {
    const onAllowed = vi.fn();

    expect(
      activateNotificationsPage(
        {
          activeGroupId: memberGroup.id,
          groups: [memberGroup],
          isPlatformAdmin: false,
          profile: { id: 'user-1', realName: '成员', version: 1 },
          status: 'authenticated',
          token: 'token',
        },
        navigation(),
        onAllowed,
      ),
    ).toBe(true);
    expect(onAllowed).toHaveBeenCalledWith({ groupId: 'group-member', userId: 'user-1' });
  });
});
