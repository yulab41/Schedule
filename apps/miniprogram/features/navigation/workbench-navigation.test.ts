import type { GroupSummary } from '@schedule/contracts';
import { describe, expect, it, vi } from 'vitest';

import {
  activateGlobalWorkbenchAction,
  activateWorkbenchEntry,
  buildWorkbenchPageModel,
  buildWorkbenchSections,
  buildManualScheduleEditorRoute,
  getVisibleWorkbenchEntries,
  resolveManualScheduleRouteContext,
  resolveWorkflowRouteContext,
} from './workbench-navigation.js';

const groups: readonly GroupSummary[] = [
  { id: 'owner', name: '业主组', role: 'owner', version: 1 },
  { id: 'member', name: '成员组', role: 'member', version: 1 },
  { id: 'guest', name: '访客组', role: 'guest', version: 1 },
];

describe('workbench navigation', () => {
  it('uses the existing role entry matrix and order', () => {
    expect(getVisibleWorkbenchEntries('owner').map(({ id }) => id)).toEqual([
      'calendar',
      'groups',
      'manual',
      'backfill',
      'leave',
      'swap',
      'duty',
      'events',
      'notifications',
      'statistics',
      'members',
      'config',
    ]);
    expect(getVisibleWorkbenchEntries('administrator').map(({ id }) => id)).toEqual(
      getVisibleWorkbenchEntries('owner').map(({ id }) => id),
    );
    expect(getVisibleWorkbenchEntries('member').map(({ id }) => id)).toEqual([
      'calendar',
      'groups',
      'leave',
      'swap',
      'duty',
      'notifications',
      'statistics',
      'members',
    ]);
    expect(getVisibleWorkbenchEntries('guest').map(({ id }) => id)).toEqual(['calendar', 'groups']);
    expect(getVisibleWorkbenchEntries('guest').find(({ id }) => id === 'groups')).toMatchObject({
      route: '/subpackages/groups/pages/index',
    });
  });

  it('adds the platform signal only for platform administrators', () => {
    expect(buildWorkbenchSections(groups, false).some(({ id }) => id === 'platform')).toBe(false);
    expect(buildWorkbenchSections(groups, true).at(-1)).toMatchObject({ id: 'platform' });
    expect(buildWorkbenchSections([], true)).toEqual([
      { entries: [], id: 'platform', label: '平台管理' },
    ]);
  });

  it('marks the current group with its role and exposes actionable group/account choices when group-less', () => {
    const memberModel = buildWorkbenchPageModel(groups, false, 'member');
    expect(memberModel.globalActions).toEqual([]);
    expect(memberModel.sections.find(({ groupId }) => groupId === 'owner')).toMatchObject({
      isActive: false,
      roleLabel: '群主',
    });
    expect(memberModel.sections.find(({ groupId }) => groupId === 'member')).toMatchObject({
      isActive: true,
      roleLabel: '成员',
    });

    const groupLess = buildWorkbenchPageModel([], false, undefined);
    expect(groupLess.sections).toEqual([]);
    expect(groupLess.globalActions).toEqual([
      {
        description: '查看可加入的群组和邀请说明',
        id: 'groups',
        label: '群组中心',
      },
      {
        description: '查看并编辑你的账号资料',
        id: 'profile',
        label: '账号资料',
      },
    ]);

    const platformOnly = buildWorkbenchPageModel([], true, undefined);
    expect(platformOnly.globalActions).toEqual(groupLess.globalActions);
    expect(platformOnly.sections).toContainEqual(
      expect.objectContaining({ id: 'platform', label: '平台管理' }),
    );
  });

  it.each([
    ['calendar', '/pages/calendar/index'],
    ['notifications', '/pages/notifications/index'],
  ] as const)('selects group B before opening its %s tab', (entryId, route) => {
    const calls: string[] = [];
    const navigation = {
      navigateTo: vi.fn(({ url }: { readonly url: string }) => calls.push(`navigate:${url}`)),
      setActiveGroupId: vi.fn((groupId: string) => {
        calls.push(`select:${groupId}`);
        return true;
      }),
      showUnavailable: vi.fn(() => calls.push('unavailable')),
      switchTab: vi.fn(({ url }: { readonly url: string }) => calls.push(`tab:${url}`)),
    };

    expect(activateWorkbenchEntry(groups, { entryId, groupId: 'member' }, navigation)).toBe(true);
    expect(calls).toEqual(['select:member', `tab:${route}`]);
  });

  it('routes every visible group entry through selection and rejects unavailable context without navigation', () => {
    for (const entry of getVisibleWorkbenchEntries('owner')) {
      const calls: string[] = [];
      const navigation = {
        navigateTo: vi.fn(({ url }: { readonly url: string }) => calls.push(`navigate:${url}`)),
        setActiveGroupId: vi.fn((groupId: string) => {
          calls.push(`select:${groupId}`);
          return true;
        }),
        showUnavailable: vi.fn(() => calls.push('unavailable')),
        switchTab: vi.fn(({ url }: { readonly url: string }) => calls.push(`tab:${url}`)),
      };
      expect(
        activateWorkbenchEntry(groups, { entryId: entry.id, groupId: 'owner' }, navigation),
      ).toBe(true);
      expect(calls[0]).toBe('select:owner');
      expect(calls).toHaveLength(2);
    }

    const invalidNavigation = {
      navigateTo: vi.fn(),
      setActiveGroupId: vi.fn(() => true),
      showUnavailable: vi.fn(),
      switchTab: vi.fn(),
    };
    expect(
      activateWorkbenchEntry(
        groups,
        { entryId: 'calendar', groupId: 'unknown' },
        invalidNavigation,
      ),
    ).toBe(false);
    expect(invalidNavigation.setActiveGroupId).not.toHaveBeenCalled();
    expect(invalidNavigation.navigateTo).not.toHaveBeenCalled();
    expect(invalidNavigation.switchTab).not.toHaveBeenCalled();

    expect(
      activateWorkbenchEntry(
        groups,
        { entryId: 'notifications', groupId: 'guest' },
        invalidNavigation,
      ),
    ).toBe(false);
    expect(invalidNavigation.setActiveGroupId).not.toHaveBeenCalled();
  });

  it('does not navigate when the selected group becomes unavailable and keeps global actions group-free', () => {
    const calls: string[] = [];
    const navigation = {
      navigateTo: vi.fn(({ url }: { readonly url: string }) => calls.push(`navigate:${url}`)),
      setActiveGroupId: vi.fn((groupId: string) => {
        calls.push(`select:${groupId}`);
        return false;
      }),
      showUnavailable: vi.fn(() => calls.push('unavailable')),
      switchTab: vi.fn(({ url }: { readonly url: string }) => calls.push(`tab:${url}`)),
    };
    expect(
      activateWorkbenchEntry(groups, { entryId: 'calendar', groupId: 'member' }, navigation),
    ).toBe(false);
    expect(calls).toEqual(['select:member']);

    calls.length = 0;
    expect(activateGlobalWorkbenchAction('groups', navigation)).toBe(true);
    expect(calls).toEqual(['navigate:/subpackages/groups/pages/index']);
    expect(navigation.setActiveGroupId).toHaveBeenCalledTimes(1);

    calls.length = 0;
    expect(activateGlobalWorkbenchAction('profile', navigation)).toBe(true);
    expect(calls).toEqual(['tab:/pages/profile/index']);
    expect(activateGlobalWorkbenchAction('unknown', navigation)).toBe(false);
  });

  it('exposes the workflows route only to a real non-guest group context', () => {
    expect(resolveWorkflowRouteContext(groups, 'member')).toEqual({
      groupId: 'member',
      groupRole: 'member',
      groupVersion: 1,
    });
    expect(resolveWorkflowRouteContext(groups, 'guest')).toBeUndefined();
    expect(resolveWorkflowRouteContext([], 'platform-only')).toBeUndefined();
    expect(getVisibleWorkbenchEntries('member').find(({ id }) => id === 'leave')).toMatchObject({
      route: '/subpackages/workflows/pages/requests/index',
    });
  });

  it('only builds the manual editor route for an owner or administrator group', () => {
    expect(resolveManualScheduleRouteContext(groups, 'owner')).toMatchObject({
      groupRole: 'owner',
    });
    expect(resolveManualScheduleRouteContext(groups, 'member')).toBeUndefined();
    expect(resolveManualScheduleRouteContext(groups, 'guest')).toBeUndefined();
    expect(
      buildManualScheduleEditorRoute(resolveManualScheduleRouteContext(groups, 'owner')!),
    ).toContain('groupId=owner');
  });
});
