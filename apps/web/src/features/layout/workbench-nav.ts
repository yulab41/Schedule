import type { GroupSummary } from '@schedule/contracts';

export type WorkbenchTabId =
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

export type GroupRole = GroupSummary['role'];

export interface WorkbenchNavItem {
  readonly id: WorkbenchTabId;
  readonly label: string;
  readonly requiresAdministrator: boolean;
}

export const workbenchNavItems: readonly WorkbenchNavItem[] = [
  { id: 'calendar', label: '排班日历', requiresAdministrator: false },
  { id: 'groups', label: '群组管理', requiresAdministrator: false },
  { id: 'manual', label: '手动排班', requiresAdministrator: true },
  { id: 'backfill', label: '排班补录', requiresAdministrator: true },
  { id: 'leave', label: '请假', requiresAdministrator: false },
  { id: 'swap', label: '换班', requiresAdministrator: false },
  { id: 'duty', label: '加扣班', requiresAdministrator: false },
  { id: 'events', label: '事件', requiresAdministrator: true },
  { id: 'notifications', label: '通知', requiresAdministrator: false },
  { id: 'statistics', label: '统计', requiresAdministrator: false },
  { id: 'members', label: '成员', requiresAdministrator: false },
  { id: 'config', label: '排班配置', requiresAdministrator: true },
];

const primaryMobileTabIds: readonly WorkbenchTabId[] = ['calendar', 'leave', 'swap', 'duty'];

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
  return getVisibleNavItems(role).filter((item) => primaryMobileTabIds.includes(item.id));
}

export function getSecondaryMobileNavItems(role: GroupRole): readonly WorkbenchNavItem[] {
  return getVisibleNavItems(role).filter((item) => !primaryMobileTabIds.includes(item.id));
}

export function getFocusOrder(items: readonly WorkbenchNavItem[]): readonly WorkbenchTabId[] {
  return items.map((item) => item.id);
}
