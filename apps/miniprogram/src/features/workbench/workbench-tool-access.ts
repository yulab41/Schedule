import type { ClientCapabilityResponse, GroupSummary } from '@schedule/contracts';

export const workbenchToolIds = [
  'groupSettings',
  'manualSchedule',
  'backfill',
  'leave',
  'duty',
  'schedulingConfig',
  'insights',
  'notificationSettings',
  'notifications',
  'exports',
  'inviteVisitor',
  'visitorAccess',
  'platformAccounts',
] as const;

export type WorkbenchToolId = (typeof workbenchToolIds)[number];

export type WorkbenchToolAccess = Readonly<
  Record<WorkbenchToolId, boolean> & {
    readonly accessSection: boolean;
    readonly groupSection: boolean;
    readonly hasAny: boolean;
    readonly informationSection: boolean;
  }
>;

export function createWorkbenchToolAccess(
  group: GroupSummary | undefined,
  capability: ClientCapabilityResponse,
): WorkbenchToolAccess {
  const coreEnabled = capability.global && capability.core;
  const hasGroup = coreEnabled && group !== undefined;
  const isDeveloperAdmin = hasGroup && group.isDeveloperAdmin === true;
  const nonGuest = hasGroup && group.role !== 'guest';
  const canUseGroupTools = nonGuest || isDeveloperAdmin;
  const canManage =
    isDeveloperAdmin || (nonGuest && (group.role === 'owner' || group.role === 'administrator'));

  const tools: Record<WorkbenchToolId, boolean> = {
    backfill: canManage,
    duty: canUseGroupTools && capability.workflows,
    exports: canManage && capability.insights,
    groupSettings: canUseGroupTools,
    insights: canUseGroupTools && capability.insights,
    inviteVisitor: canManage && capability.organization,
    leave: canUseGroupTools && capability.workflows,
    manualSchedule: canManage,
    notificationSettings: canUseGroupTools && capability.externalMessages,
    notifications: canUseGroupTools && capability.insights,
    platformAccounts: isDeveloperAdmin && capability.organization,
    schedulingConfig: canManage,
    visitorAccess: canManage && capability.insights,
  };
  const groupSection = [
    tools.groupSettings,
    tools.manualSchedule,
    tools.backfill,
    tools.leave,
    tools.duty,
    tools.schedulingConfig,
  ].some(Boolean);
  const informationSection = [
    tools.insights,
    tools.notificationSettings,
    tools.notifications,
    tools.exports,
  ].some(Boolean);
  const accessSection = [tools.inviteVisitor, tools.visitorAccess, tools.platformAccounts].some(
    Boolean,
  );

  return Object.freeze({
    ...tools,
    accessSection,
    groupSection,
    hasAny: groupSection || informationSection || accessSection,
    informationSection,
  });
}
