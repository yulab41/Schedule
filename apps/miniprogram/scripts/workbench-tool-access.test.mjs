import { describe, expect, it } from 'vitest';

import {
  createWorkbenchToolAccess,
  workbenchToolIds,
} from '../src/features/workbench/workbench-tool-access.ts';

describe('Mini workbench tool access matrix', () => {
  it('shows ordinary members exactly the six approved More tools', () => {
    const access = createWorkbenchToolAccess(group('member'), capability());

    expect(visibleTools(access)).toEqual([
      'groupSettings',
      'leave',
      'duty',
      'insights',
      'notificationSettings',
      'notifications',
    ]);
    expect(access).toMatchObject({
      accessSection: false,
      groupSection: true,
      hasAny: true,
      informationSection: true,
    });
  });

  it('keeps group administrators on management tools but never exposes platform accounts', () => {
    for (const role of ['owner', 'administrator']) {
      const access = createWorkbenchToolAccess(group(role), capability());
      expect(access.platformAccounts).toBe(false);
      expect(visibleTools(access)).toEqual(
        workbenchToolIds.filter((id) => id !== 'platformAccounts'),
      );
    }
  });

  it('lets developer administrators use every tool regardless of their group role', () => {
    const access = createWorkbenchToolAccess(
      group('guest', { isDeveloperAdmin: true }),
      capability(),
    );
    expect(visibleTools(access)).toEqual(workbenchToolIds);
  });

  it('hides every More tool from guests and exposes a real empty state', () => {
    expect(createWorkbenchToolAccess(group('guest'), capability())).toMatchObject({
      accessSection: false,
      groupSection: false,
      hasAny: false,
      informationSection: false,
    });
    expect(visibleTools(createWorkbenchToolAccess(group('guest'), capability()))).toEqual([]);
  });

  it('fails closed by capability without changing unrelated member tools', () => {
    const noInsights = createWorkbenchToolAccess(group('member'), capability({ insights: false }));
    expect(visibleTools(noInsights)).toEqual([
      'groupSettings',
      'leave',
      'duty',
      'notificationSettings',
    ]);
    expect(noInsights.informationSection).toBe(true);

    const noMessages = createWorkbenchToolAccess(
      group('member'),
      capability({ externalMessages: false, insights: false }),
    );
    expect(noMessages.informationSection).toBe(false);
    expect(visibleTools(noMessages)).toEqual(['groupSettings', 'leave', 'duty']);

    const noOrganization = createWorkbenchToolAccess(
      group('owner'),
      capability({ organization: false }),
    );
    expect(noOrganization.schedulingConfig).toBe(true);
    expect(noOrganization.inviteVisitor).toBe(false);
    expect(noOrganization.manualSchedule).toBe(true);

    const noCore = createWorkbenchToolAccess(group('owner'), capability({ core: false }));
    expect(noCore.hasAny).toBe(false);
    expect(visibleTools(noCore)).toEqual([]);
  });
});

function visibleTools(access) {
  return workbenchToolIds.filter((id) => access[id]);
}

function group(role, overrides = {}) {
  return { id: 'group-1', name: '急诊科', role, version: 1, ...overrides };
}

function capability(overrides = {}) {
  return {
    core: true,
    externalMessages: true,
    global: true,
    guest: true,
    insights: true,
    organization: true,
    platform: 'miniprogram',
    version: 'test',
    workflows: true,
    ...overrides,
  };
}
