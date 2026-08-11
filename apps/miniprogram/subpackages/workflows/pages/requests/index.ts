import { navigateForCurrentSession } from '../../../../features/auth/auth-runtime.js';
import {
  resolveWorkflowRouteContext,
  type WorkflowRouteContext,
} from '../../../../features/navigation/workbench-navigation.js';
import { sessionStore } from '../../../../store/session.js';

interface WorkflowRequestPageData {
  readonly groupName: string;
  readonly hasWorkflowAccess: boolean;
}

interface WorkflowRequestPageMethods {
  context?: WorkflowRouteContext;
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
  refresh(): void {
    const state = sessionStore.state;
    if (state.status !== 'authenticated') {
      navigateForCurrentSession();
      return;
    }
    const groupId = this.selectedGroupId;
    const context =
      groupId === undefined ? undefined : resolveWorkflowRouteContext(state.groups, groupId);
    const group =
      context === undefined ? undefined : state.groups.find(({ id }) => id === context.groupId);
    this.context = context;
    this.setData({ groupName: group?.name ?? '', hasWorkflowAccess: context !== undefined });
  },
});
