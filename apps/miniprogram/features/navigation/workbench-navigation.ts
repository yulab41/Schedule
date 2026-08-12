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
  readonly label: string;
  readonly role?: GroupRole;
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
