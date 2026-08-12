import {
  joinGroupAsGuest,
  leaveGroup,
  listDissolvedGroups,
  listGroupCatalog,
  restoreGroup,
} from '../../../api/endpoints.js';
import {
  createGroupPageController,
  type GroupPageState,
} from '../../../features/groups/group-page-controller.js';
import { guardMiniprogramRoute } from '../../../features/navigation/route-guard.js';
import { sessionStore } from '../../../store/session.js';

const controller = createGroupPageController({
  getSessionGroups: () => sessionStore.state.groups,
  joinGroupAsGuest,
  leaveGroup,
  listDissolvedGroups,
  listGroupCatalog,
  publish: () => undefined,
  refreshGroupContext: (options) => sessionStore.refreshGroupContext(options),
  removeCalendarCacheForGroup: (groupId) => sessionStore.removeCalendarCacheForGroup(groupId),
  restoreGroup,
  setActiveGroupId: (groupId) => sessionStore.setActiveGroupId(groupId),
});

interface GroupPageData {
  readonly activeGroupId: string;
  readonly catalog: GroupPageState['catalog'];
  readonly dissolvedGroups: GroupPageState['dissolvedGroups'];
  readonly errorMessage: string;
  readonly groups: GroupPageState['groups'];
  readonly isMutating: boolean;
  readonly status: GroupPageState['status'];
}

function pageData(): GroupPageData {
  const state = controller.state;
  return {
    activeGroupId: sessionStore.state.activeGroupId ?? '',
    catalog: state.catalog,
    dissolvedGroups: state.dissolvedGroups,
    errorMessage: state.errorMessage ?? '',
    groups: state.groups,
    isMutating: state.isMutating,
    status: state.status,
  };
}

function readGroupId(event: {
  readonly currentTarget: { readonly dataset: { readonly groupId?: unknown } };
}): string | undefined {
  const groupId = event.currentTarget.dataset.groupId;
  return typeof groupId === 'string' && groupId.length > 0 ? groupId : undefined;
}

Page({
  data: pageData(),
  onShow(): void {
    if (
      !guardMiniprogramRoute(sessionStore.state, '/subpackages/groups/pages/index', {
        hideTabBar: () => wx.hideTabBar({}),
        reLaunch: (options) => wx.reLaunch(options),
        showTabBar: () => wx.showTabBar({}),
        switchTab: (options) => wx.switchTab(options),
      })
    )
      return;
    this.sync();
    void controller.load().finally(() => this.sync());
  },
  handleJoin(event: {
    readonly currentTarget: { readonly dataset: { readonly groupId?: unknown } };
  }): void {
    const groupId = readGroupId(event);
    if (groupId === undefined) return;
    const operation = controller.joinAsGuest(groupId);
    this.sync();
    void operation.finally(() => this.sync());
  },
  handleLeave(event: {
    readonly currentTarget: { readonly dataset: { readonly groupId?: unknown } };
  }): void {
    const groupId = readGroupId(event);
    if (groupId === undefined) return;
    const operation = controller.leave(groupId);
    this.sync();
    void operation.finally(() => this.sync());
  },
  handleRestore(event: {
    readonly currentTarget: { readonly dataset: { readonly groupId?: unknown } };
  }): void {
    const groupId = readGroupId(event);
    if (groupId === undefined) return;
    const operation = controller.restore(groupId);
    this.sync();
    void operation.finally(() => this.sync());
  },
  handleSelectGroup(event: {
    readonly currentTarget: { readonly dataset: { readonly groupId?: unknown } };
  }): void {
    const groupId = readGroupId(event);
    if (groupId !== undefined && controller.selectGroup(groupId)) this.sync();
  },
  handleRetry(): void {
    void controller.load().finally(() => this.sync());
  },
  sync(): void {
    this.setData(pageData());
  },
});
