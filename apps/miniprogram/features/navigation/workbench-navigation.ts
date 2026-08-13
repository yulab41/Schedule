import type { GroupRole, GroupSummary } from '@schedule/contracts';

export type WorkbenchEntryId =
  | 'backfill'
  | 'calendar'
  | 'config'
  | 'duty'
  | 'events'
  | 'groups'
  | 'leave'
  | 'manual'
  | 'members'
  | 'notifications'
  | 'statistics'
  | 'swap';

export interface WorkbenchEntry {
  readonly id: WorkbenchEntryId;
  readonly label: string;
  readonly requiresAdministrator: boolean;
  readonly route?: string;
  readonly tabRoute?: '/pages/calendar/index' | '/pages/notifications/index';
}

export interface WorkbenchSection {
  readonly entries: readonly WorkbenchEntry[];
  readonly groupId?: string;
  readonly id: string;
  readonly isActive?: boolean;
  readonly label: string;
  readonly role?: GroupRole;
  readonly roleLabel?: string;
}

export type GlobalWorkbenchActionId = 'groups' | 'profile';

export interface GlobalWorkbenchAction {
  readonly description: string;
  readonly id: GlobalWorkbenchActionId;
  readonly label: string;
}

export interface WorkbenchPageModel {
  readonly globalActions: readonly GlobalWorkbenchAction[];
  readonly sections: readonly WorkbenchSection[];
}

export interface WorkbenchNavigationPort {
  navigateTo(options: { readonly url: string }): void;
  setActiveGroupId(groupId: string): boolean;
  showUnavailable(): void;
  switchTab(options: { readonly url: string }): void;
}

export interface WorkbenchEntrySelection {
  readonly entryId: WorkbenchEntryId;
  readonly groupId: string;
}

export interface WorkflowRouteContext {
  readonly groupId: string;
  readonly groupRole: Exclude<GroupRole, 'guest'>;
  readonly groupVersion: number;
}

export interface ManualScheduleRouteContext {
  readonly groupId: string;
  readonly groupRole: 'administrator' | 'owner';
  readonly groupVersion: number;
}

export const workflowRequestsRoute = '/subpackages/workflows/pages/requests/index';
export const groupsRoute = '/subpackages/groups/pages/index';
export const manualScheduleEditorRoute = '/subpackages/manual-schedule/pages/editor/index';

const globalWorkbenchActions: readonly GlobalWorkbenchAction[] = [
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
];

export const workbenchEntries: readonly WorkbenchEntry[] = [
  {
    id: 'calendar',
    label: '排班日历',
    requiresAdministrator: false,
    tabRoute: '/pages/calendar/index',
  },
  { id: 'groups', label: '群组管理', requiresAdministrator: false, route: groupsRoute },
  {
    id: 'manual',
    label: '手动排班',
    requiresAdministrator: true,
    route: manualScheduleEditorRoute,
  },
  { id: 'backfill', label: '排班补录', requiresAdministrator: true },
  { id: 'leave', label: '请假', requiresAdministrator: false, route: workflowRequestsRoute },
  { id: 'swap', label: '换班', requiresAdministrator: false, route: workflowRequestsRoute },
  { id: 'duty', label: '加扣班', requiresAdministrator: false, route: workflowRequestsRoute },
  { id: 'events', label: '事件', requiresAdministrator: true },
  {
    id: 'notifications',
    label: '通知',
    requiresAdministrator: false,
    tabRoute: '/pages/notifications/index',
  },
  { id: 'statistics', label: '统计', requiresAdministrator: false },
  { id: 'members', label: '成员', requiresAdministrator: false },
  { id: 'config', label: '排班配置', requiresAdministrator: true },
];

export function getVisibleWorkbenchEntries(role: GroupRole): readonly WorkbenchEntry[] {
  if (role === 'guest')
    return workbenchEntries.filter(({ id }) => id === 'calendar' || id === 'groups');
  if (role === 'member')
    return workbenchEntries.filter(({ requiresAdministrator }) => !requiresAdministrator);
  return workbenchEntries;
}

export function resolveWorkflowRouteContext(
  groups: readonly GroupSummary[],
  groupId: string,
): WorkflowRouteContext | undefined {
  const group = groups.find((candidate) => candidate.id === groupId);
  if (group === undefined || group.role === 'guest') return undefined;
  return { groupId: group.id, groupRole: group.role, groupVersion: group.version };
}

export function buildWorkflowRequestRoute(context: WorkflowRouteContext): string {
  return `${workflowRequestsRoute}?groupId=${encodeURIComponent(context.groupId)}&groupRole=${context.groupRole}&groupVersion=${context.groupVersion}`;
}

export function resolveManualScheduleRouteContext(
  groups: readonly GroupSummary[],
  groupId: string,
): ManualScheduleRouteContext | undefined {
  const group = groups.find((candidate) => candidate.id === groupId);
  if (group === undefined || (group.role !== 'administrator' && group.role !== 'owner'))
    return undefined;
  return { groupId: group.id, groupRole: group.role, groupVersion: group.version };
}

export function buildManualScheduleEditorRoute(context: ManualScheduleRouteContext): string {
  return `${manualScheduleEditorRoute}?groupId=${encodeURIComponent(context.groupId)}&groupRole=${context.groupRole}&groupVersion=${context.groupVersion}`;
}

export function buildWorkbenchSections(
  groups: readonly GroupSummary[],
  isPlatformAdmin: boolean,
): readonly WorkbenchSection[] {
  const sections = groups.map((group) => ({
    entries: getVisibleWorkbenchEntries(group.role),
    groupId: group.id,
    id: `group:${group.id}`,
    label: group.name,
    role: group.role,
  }));
  return isPlatformAdmin
    ? [...sections, { entries: [], id: 'platform', label: '平台管理' }]
    : sections;
}

function getGroupRoleLabel(role: GroupRole): string {
  if (role === 'owner') return '群主';
  if (role === 'administrator') return '管理员';
  return role === 'guest' ? '访客' : '成员';
}

export function buildWorkbenchPageModel(
  groups: readonly GroupSummary[],
  isPlatformAdmin: boolean,
  activeGroupId: string | undefined,
): WorkbenchPageModel {
  return {
    globalActions: groups.length === 0 ? globalWorkbenchActions : [],
    sections: buildWorkbenchSections(groups, isPlatformAdmin).map((section) =>
      section.groupId === undefined || section.role === undefined
        ? section
        : {
            ...section,
            isActive: section.groupId === activeGroupId,
            roleLabel: getGroupRoleLabel(section.role),
          },
    ),
  };
}

type WorkbenchDestination =
  | { readonly kind: 'navigate'; readonly url: string }
  | { readonly kind: 'switch-tab'; readonly url: string }
  | { readonly kind: 'unavailable' };

function resolveWorkbenchDestination(
  groups: readonly GroupSummary[],
  selection: WorkbenchEntrySelection,
): WorkbenchDestination | undefined {
  const group = groups.find(({ id }) => id === selection.groupId);
  if (group === undefined) return undefined;
  const entry = getVisibleWorkbenchEntries(group.role).find(({ id }) => id === selection.entryId);
  if (entry === undefined) return undefined;
  if (entry.tabRoute !== undefined) return { kind: 'switch-tab', url: entry.tabRoute };
  if (entry.id === 'manual') {
    const context = resolveManualScheduleRouteContext(groups, group.id);
    return context === undefined
      ? undefined
      : { kind: 'navigate', url: buildManualScheduleEditorRoute(context) };
  }
  if (entry.id === 'leave' || entry.id === 'swap' || entry.id === 'duty') {
    const context = resolveWorkflowRouteContext(groups, group.id);
    return context === undefined
      ? undefined
      : { kind: 'navigate', url: buildWorkflowRequestRoute(context) };
  }
  if (entry.route !== undefined) return { kind: 'navigate', url: entry.route };
  return { kind: 'unavailable' };
}

export function activateWorkbenchEntry(
  groups: readonly GroupSummary[],
  selection: WorkbenchEntrySelection,
  navigation: WorkbenchNavigationPort,
): boolean {
  const destination = resolveWorkbenchDestination(groups, selection);
  if (destination === undefined || !navigation.setActiveGroupId(selection.groupId)) return false;
  if (destination.kind === 'switch-tab') navigation.switchTab({ url: destination.url });
  else if (destination.kind === 'navigate') navigation.navigateTo({ url: destination.url });
  else navigation.showUnavailable();
  return true;
}

export function activateGlobalWorkbenchAction(
  actionId: unknown,
  navigation: Pick<WorkbenchNavigationPort, 'navigateTo' | 'switchTab'>,
): boolean {
  if (actionId === 'groups') {
    navigation.navigateTo({ url: groupsRoute });
    return true;
  }
  if (actionId === 'profile') {
    navigation.switchTab({ url: '/pages/profile/index' });
    return true;
  }
  return false;
}
