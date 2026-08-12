import type { GroupSummary } from '@schedule/contracts';
import { describe, expect, it } from 'vitest';

import {
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
