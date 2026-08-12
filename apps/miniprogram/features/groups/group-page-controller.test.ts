import type { DissolvedGroup, GroupCatalogEntry, GroupSummary } from '@schedule/contracts';
import { describe, expect, it, vi } from 'vitest';

import {
  createGroupPageController,
  type GroupPageControllerDependencies,
} from './group-page-controller.js';

const ownerGroup: GroupSummary = {
  id: 'owner-group',
  name: '急诊排班组',
  role: 'owner',
  version: 3,
};
const guestGroup: GroupSummary = {
  id: 'guest-group',
  name: '访客排班组',
  role: 'guest',
  version: 2,
};
const dissolved: DissolvedGroup = {
  deletedAt: '2026-08-12T08:00:00.000Z',
  id: 'dissolved-group',
  name: '已解散排班组',
};

function createDependencies(overrides: Partial<GroupPageControllerDependencies> = {}) {
  let groups: readonly GroupSummary[] = [ownerGroup];
  return {
    getSessionGroups: () => groups,
    joinGroupAsGuest: vi.fn(async () => guestGroup),
    leaveGroup: vi.fn(async () => undefined),
    listDissolvedGroups: vi.fn(async () => [dissolved]),
    listGroupCatalog: vi.fn(async (): Promise<GroupCatalogEntry[]> => [
      { id: ownerGroup.id, name: ownerGroup.name, relation: 'active-member' },
      { id: guestGroup.id, name: guestGroup.name, relation: 'none' },
      { id: 'left-group', name: '历史成员组', relation: 'left-member' },
      { id: 'unknown-group', name: '异常关系组', relation: 'unsafe' as never },
    ]),
    publish: vi.fn(),
    refreshGroupContext: vi.fn(async () => undefined),
    removeCalendarCacheForGroup: vi.fn(),
    restoreGroup: vi.fn(async () => undefined),
    setActiveGroupId: vi.fn((groupId: string) => groups.some((group) => group.id === groupId)),
    setGroups: (next: readonly GroupSummary[]) => {
      groups = next;
    },
    ...overrides,
  } satisfies GroupPageControllerDependencies & { setGroups(next: readonly GroupSummary[]): void };
}

describe('group page controller', () => {
  it('maps catalog relations through the closed safe catalog and does not expose join or claim for left members', async () => {
    const dependencies = createDependencies();
    const controller = createGroupPageController(dependencies);

    await controller.load();

    const state = controller.state;
    expect(state.catalog).toEqual([
      expect.objectContaining({ id: ownerGroup.id, relation: 'active-member', action: 'active' }),
      expect.objectContaining({ id: guestGroup.id, relation: 'none', action: 'join-guest' }),
      expect.objectContaining({ id: 'left-group', relation: 'left-member', action: 'invite-only' }),
      expect.objectContaining({ id: 'unknown-group', relation: 'none', action: 'join-guest' }),
    ]);
    expect(state.catalog.find(({ id }) => id === 'left-group')).not.toHaveProperty('claim');
    await controller.joinAsGuest('left-group');
    expect(dependencies.joinGroupAsGuest).not.toHaveBeenCalled();
  });

  it('refreshes session context with preferred joined/restored groups and clears only the departed group cache', async () => {
    const dependencies = createDependencies();
    const controller = createGroupPageController(dependencies);
    await controller.load();

    await controller.joinAsGuest(guestGroup.id);
    expect(dependencies.refreshGroupContext).toHaveBeenLastCalledWith({
      preferredGroupId: guestGroup.id,
    });

    await controller.leave(ownerGroup.id);
    expect(dependencies.removeCalendarCacheForGroup).toHaveBeenCalledWith(ownerGroup.id);
    expect(dependencies.refreshGroupContext).toHaveBeenLastCalledWith({});

    await controller.restore(dissolved.id);
    expect(dependencies.refreshGroupContext).toHaveBeenLastCalledWith({
      preferredGroupId: dissolved.id,
    });
  });

  it('keeps late action completions from replacing newer page state', async () => {
    let resolveJoin!: () => void;
    const dependencies = createDependencies({
      joinGroupAsGuest: vi.fn(
        () =>
          new Promise<GroupSummary>((resolve) => {
            resolveJoin = () => resolve(guestGroup);
          }),
      ),
    });
    const controller = createGroupPageController(dependencies);
    await controller.load();

    const joining = controller.joinAsGuest(guestGroup.id);
    await controller.load();
    resolveJoin();
    await joining;

    expect(controller.state.status).toBe('ready');
    expect(dependencies.refreshGroupContext).not.toHaveBeenCalled();
  });
});
