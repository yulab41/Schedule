import type {
  DissolvedGroup,
  GroupCatalogEntry,
  GroupCatalogRelation,
  GroupSummary,
} from '@schedule/contracts';

export type GroupCatalogAction = 'active' | 'invite-only' | 'join-guest';
export type GroupPageStatus = 'error' | 'loading' | 'ready';

export interface GroupCatalogViewModel {
  readonly action: GroupCatalogAction;
  readonly id: string;
  readonly name: string;
  readonly relation: GroupCatalogRelation;
}

export interface GroupPageState {
  readonly catalog: readonly GroupCatalogViewModel[];
  readonly dissolvedGroups: readonly DissolvedGroup[];
  readonly errorMessage?: string;
  readonly groups: readonly GroupSummary[];
  readonly isMutating: boolean;
  readonly status: GroupPageStatus;
}

export interface GroupPageControllerDependencies {
  getSessionGroups(): readonly GroupSummary[];
  joinGroupAsGuest(groupId: string): Promise<GroupSummary>;
  leaveGroup(groupId: string): Promise<void>;
  listDissolvedGroups(): Promise<DissolvedGroup[]>;
  listGroupCatalog(): Promise<GroupCatalogEntry[]>;
  publish(state: GroupPageState): void;
  refreshGroupContext(options?: { readonly preferredGroupId?: string }): Promise<void>;
  removeCalendarCacheForGroup(groupId: string): boolean;
  restoreGroup(groupId: string): Promise<void>;
  setActiveGroupId(groupId: string): boolean;
}

export interface GroupPageController {
  readonly state: GroupPageState;
  joinAsGuest(groupId: string): Promise<void>;
  leave(groupId: string): Promise<void>;
  load(): Promise<void>;
  restore(groupId: string): Promise<void>;
  selectGroup(groupId: string): boolean;
}

const safeRelations = new Set<GroupCatalogRelation>([
  'none',
  'active-member',
  'active-guest',
  'left-member',
]);

const initialState: GroupPageState = {
  catalog: [],
  dissolvedGroups: [],
  groups: [],
  isMutating: false,
  status: 'loading',
};

function relationAction(relation: GroupCatalogRelation): GroupCatalogAction {
  if (relation === 'none') return 'join-guest';
  if (relation === 'left-member') return 'invite-only';
  return 'active';
}

function toCatalogViewModel(entry: GroupCatalogEntry): GroupCatalogViewModel {
  const relation = safeRelations.has(entry.relation) ? entry.relation : 'none';
  return { action: relationAction(relation), id: entry.id, name: entry.name, relation };
}

function safeMessage(): string {
  return '群组信息暂时无法加载，请稍后重试。';
}

export function createGroupPageController(
  dependencies: GroupPageControllerDependencies,
): GroupPageController {
  let state = initialState;
  let generation = 0;

  const publish = (next: GroupPageState): void => {
    state = next;
    dependencies.publish(state);
  };
  const isCurrent = (operationGeneration: number): boolean => operationGeneration === generation;
  const begin = (): number => {
    generation += 1;
    return generation;
  };
  const publishLoading = (operationGeneration: number, isMutating: boolean): void => {
    if (!isCurrent(operationGeneration)) return;
    publish({ ...state, errorMessage: undefined, isMutating, status: 'loading' });
  };
  const refreshPageData = async (
    operationGeneration: number,
    isMutating: boolean,
  ): Promise<void> => {
    try {
      const [catalog, dissolvedGroups] = await Promise.all([
        dependencies.listGroupCatalog(),
        dependencies.listDissolvedGroups(),
      ]);
      if (!isCurrent(operationGeneration)) return;
      publish({
        catalog: catalog.map(toCatalogViewModel),
        dissolvedGroups,
        groups: dependencies.getSessionGroups(),
        isMutating,
        status: 'ready',
      });
    } catch {
      if (!isCurrent(operationGeneration)) return;
      publish({
        ...state,
        errorMessage: safeMessage(),
        groups: dependencies.getSessionGroups(),
        isMutating: false,
        status: 'error',
      });
    }
  };
  const runMembershipAction = async (
    action: () => Promise<void>,
    refreshOptions: { readonly preferredGroupId?: string },
  ): Promise<void> => {
    const operationGeneration = begin();
    publishLoading(operationGeneration, true);
    try {
      await action();
      if (!isCurrent(operationGeneration)) return;
      await dependencies.refreshGroupContext(refreshOptions);
      if (!isCurrent(operationGeneration)) return;
      await refreshPageData(operationGeneration, false);
    } catch {
      if (!isCurrent(operationGeneration)) return;
      publish({ ...state, errorMessage: safeMessage(), isMutating: false, status: 'error' });
    }
  };

  return {
    get state() {
      return state;
    },
    joinAsGuest: (groupId) => {
      if (
        groupId.length === 0 ||
        state.catalog.find((entry) => entry.id === groupId)?.action !== 'join-guest'
      )
        return Promise.resolve();
      return runMembershipAction(
        async () => {
          await dependencies.joinGroupAsGuest(groupId);
        },
        { preferredGroupId: groupId },
      );
    },
    leave: (groupId) => {
      if (groupId.length === 0) return Promise.resolve();
      return runMembershipAction(async () => {
        await dependencies.leaveGroup(groupId);
        dependencies.removeCalendarCacheForGroup(groupId);
      }, {});
    },
    load: () => {
      const operationGeneration = begin();
      publishLoading(operationGeneration, false);
      return refreshPageData(operationGeneration, false);
    },
    restore: (groupId) => {
      if (groupId.length === 0) return Promise.resolve();
      return runMembershipAction(() => dependencies.restoreGroup(groupId), {
        preferredGroupId: groupId,
      });
    },
    selectGroup: (groupId) => dependencies.setActiveGroupId(groupId),
  };
}
