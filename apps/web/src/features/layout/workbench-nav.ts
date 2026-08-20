import type { GroupSummary } from '@schedule/contracts';

export type WorkbenchTabId =
  | 'backfill'
  | 'calendar'
  | 'config'
  | 'directory'
  | 'duty'
  | 'events'
  | 'groups'
  | 'leave'
  | 'manual'
  | 'members'
  | 'notifications'
  | 'profile'
  | 'statistics'
  | 'swap';

export type GroupRole = GroupSummary['role'];

export type WorkbenchNavIconId =
  | 'backfill'
  | 'calendar'
  | 'config'
  | 'directory'
  | 'duty'
  | 'events'
  | 'groups'
  | 'leave'
  | 'manual'
  | 'members'
  | 'notifications'
  | 'profile'
  | 'statistics'
  | 'swap';

export interface WorkbenchNavItem {
  readonly icon: WorkbenchNavIconId;
  readonly id: WorkbenchTabId;
  readonly label: string;
  readonly requiresAdministrator: boolean;
}

export const workbenchNavItems: readonly WorkbenchNavItem[] = [
  { icon: 'calendar', id: 'calendar', label: '排班日历', requiresAdministrator: false },
  { icon: 'directory', id: 'directory', label: '通讯录', requiresAdministrator: false },
  { icon: 'profile', id: 'profile', label: '我的', requiresAdministrator: false },
  { icon: 'groups', id: 'groups', label: '群组管理', requiresAdministrator: false },
  { icon: 'manual', id: 'manual', label: '手动排班', requiresAdministrator: true },
  { icon: 'backfill', id: 'backfill', label: '排班补录', requiresAdministrator: true },
  { icon: 'leave', id: 'leave', label: '请假', requiresAdministrator: false },
  { icon: 'swap', id: 'swap', label: '换班', requiresAdministrator: false },
  { icon: 'duty', id: 'duty', label: '加扣班', requiresAdministrator: false },
  { icon: 'events', id: 'events', label: '事件', requiresAdministrator: true },
  {
    icon: 'notifications',
    id: 'notifications',
    label: '通知',
    requiresAdministrator: false,
  },
  { icon: 'statistics', id: 'statistics', label: '统计', requiresAdministrator: false },
  { icon: 'members', id: 'members', label: '成员', requiresAdministrator: false },
  { icon: 'config', id: 'config', label: '排班配置', requiresAdministrator: true },
];

const primaryMobileTabIds: readonly WorkbenchTabId[] = ['calendar', 'directory', 'swap', 'profile'];

export function getVisibleNavItems(role: GroupRole): readonly WorkbenchNavItem[] {
  const base = workbenchNavItems.filter((item) => !item.requiresAdministrator || role !== 'member');
  if (role === 'guest') {
    return base.filter((item) => item.id === 'calendar' || item.id === 'groups');
  }
  return base;
}

export function getDesktopNavItems(role: GroupRole): readonly WorkbenchNavItem[] {
  return getVisibleNavItems(role);
}

export function getPrimaryMobileNavItems(role: GroupRole): readonly WorkbenchNavItem[] {
  const visibleItems = new Map(getVisibleNavItems(role).map((item) => [item.id, item]));
  return primaryMobileTabIds.flatMap((id) => {
    const item = visibleItems.get(id);
    return item === undefined ? [] : [item];
  });
}

export function getSecondaryMobileNavItems(role: GroupRole): readonly WorkbenchNavItem[] {
  return getVisibleNavItems(role).filter((item) => !primaryMobileTabIds.includes(item.id));
}

export function getFocusOrder(items: readonly WorkbenchNavItem[]): readonly WorkbenchTabId[] {
  return items.map((item) => item.id);
}

export function getWorkbenchPageTitle(tabId: WorkbenchTabId): string {
  if (tabId === 'calendar') {
    return '工作台';
  }

  if (tabId === 'leave') {
    return '请假与审批';
  }

  return workbenchNavItems.find((item) => item.id === tabId)?.label ?? '工作台';
}
