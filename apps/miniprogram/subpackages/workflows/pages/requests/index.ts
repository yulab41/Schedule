import { navigateForCurrentSession } from '../../../../features/auth/auth-runtime.js';
import {
  resolveWorkflowRouteContext,
  type WorkflowRouteContext,
} from '../../../../features/navigation/workbench-navigation.js';
import { guardMiniprogramRoute } from '../../../../features/navigation/route-guard.js';
import { sessionStore } from '../../../../store/session.js';

interface WorkflowRequestPageData {
  readonly groupName: string;
  readonly hasWorkflowAccess: boolean;
}

interface WorkflowRequestPageMethods {
  context?: WorkflowRouteContext;
  navigateToLeave(): void;
  navigateToOperations(): void;
  selectedGroupId?: string;
  refresh(): void;
}

Page<WorkflowRequestPageData, WorkflowRequestPageMethods>({
  data: { groupName: '', hasWorkflowAccess: false },
  onLoad(options): void {
    this.selectedGroupId = typeof options.groupId === 'string' ? options.groupId : undefined;
  },
  onShow(): void {
    this.refresh();
  },
  navigateToLeave(): void {
    if (this.context === undefined) return;
    wx.navigateTo({
      url: `/subpackages/workflows/pages/leave/index?groupId=${encodeURIComponent(this.context.groupId)}`,
    });
  },
  navigateToOperations(): void {
    if (this.context === undefined) return;
    wx.navigateTo({
      url: `/subpackages/workflows/pages/operations/index?groupId=${encodeURIComponent(this.context.groupId)}`,
    });
  },
  refresh(): void {
    const state = sessionStore.state;
    if (state.status !== 'authenticated') {
      navigateForCurrentSession();
      return;
    }
    const groupId = this.selectedGroupId;
    if (
      !guardMiniprogramRoute(
        state,
        '/subpackages/workflows/pages/requests/index',
        {
          hideTabBar: () => wx.hideTabBar({}),
          reLaunch: (options) => wx.reLaunch(options),
          showTabBar: () => wx.showTabBar({}),
          switchTab: (options) => wx.switchTab(options),
        },
        groupId,
      )
    )
      return;
    const context =
      groupId === undefined ? undefined : resolveWorkflowRouteContext(state.groups, groupId);
    const group =
      context === undefined ? undefined : state.groups.find(({ id }) => id === context.groupId);
    this.context = context;
    this.setData({ groupName: group?.name ?? '', hasWorkflowAccess: context !== undefined });
  },
});
