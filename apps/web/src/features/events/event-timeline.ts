import type { CalendarChangeMarker, JsonObject, ScheduleEvent } from '@schedule/contracts';

const chinaStandardTimeOffsetMilliseconds = 8 * 60 * 60 * 1000;

export interface EventChangeItem {
  readonly after?: string;
  readonly before?: string;
  readonly label: string;
}

export interface EventTimelineItem {
  readonly event: ScheduleEvent;
  readonly isCorrection: boolean;
  readonly marker?: CalendarChangeMarker;
}

export const eventTypeLabels: Readonly<Record<string, string>> = {
  assignment_manually_updated: '人工调整班次',
  duty_adjustment_completed: '加扣班生效',
  duty_adjustment_request_accepted: '加扣班申请已接受',
  duty_adjustment_request_approved: '加扣班申请已批准',
  duty_adjustment_request_cancelled: '加扣班申请已取消',
  duty_adjustment_request_created: '加扣班申请已提交',
  duty_adjustment_request_rejected: '加扣班申请已驳回',
  duty_adjustment_revoked: '加扣班已撤销',
  leave_cover_completed: '请假替班完成',
  leave_request_approved: '请假已批准',
  leave_request_rejected: '请假已驳回',
  leave_request_submitted: '请假已提交',
  manual_schedule_template_applied: '手动模板已应用',
  manual_schedule_template_created: '手动模板已创建',
  manual_schedule_template_updated: '手动模板已更新',
  rotation_order_changed: '轮值顺序已调整',
  schedule_generation_completed: '自动排班已生成',
  schedule_period_created: '排班版本已创建',
  schedule_period_published: '排班已发布',
  schedule_period_replaced: '排班版本已替换',
  schedule_period_withdrawn: '排班版本已撤回',
  schedule_role_changed: '排班角色已调整',
  schedule_role_corrected: '排班角色已更正',
  shift_type_changed: '班种已调整',
  swap_completed: '换班已生效',
  swap_request_accepted: '换班申请已接受',
  swap_request_approved: '换班申请已批准',
  swap_request_cancelled: '换班申请已取消',
  swap_request_created: '换班申请已提交',
  swap_request_rejected: '换班申请已驳回',
};

const changeLabels: Readonly<Record<string, string>> = {
  actualMemberId: '实际人员',
  actualMemberName: '实际人员',
  plannedMemberId: '计划人员',
  plannedMemberName: '计划人员',
  reason: '原因',
  scheduleRoleId: '排班角色',
  scheduleRoleName: '排班角色',
  shiftTypeAbbreviation: '班种',
  shiftTypeId: '班种',
  shiftTypeName: '班种',
  status: '状态',
};

const skippedChangeKeys = new Set([
  'affectedMembershipIds',
  'affectedShiftIds',
  'approverUserId',
  'groupId',
  'initiatedByUserId',
  'objectId',
  'objectType',
  'operationId',
  'operatorUserId',
  'parentEventId',
  'schedulePeriodId',
]);

export function getEventTypeLabel(eventType: string): string {
  return eventTypeLabels[eventType] ?? eventType.replaceAll('_', ' ');
}

export function getEventMarker(eventType: string): CalendarChangeMarker | undefined {
  switch (eventType) {
    case 'swap_completed':
      return 'swap';
    case 'leave_cover_completed':
      return 'leave-cover';
    case 'assignment_manually_updated':
      return 'manual-adjustment';
    case 'duty_adjustment_completed':
      return 'overtime';
    default:
      return undefined;
  }
}

export function formatEventTime(occurredAt: string): string {
  const shifted = new Date(new Date(occurredAt).valueOf() + chinaStandardTimeOffsetMilliseconds)
    .toISOString()
    .replace('T', ' ')
    .slice(0, 16);
  return `${shifted.slice(0, 10)} ${shifted.slice(11)}`;
}

export function getEventRelationLabel(event: ScheduleEvent): string {
  return event.parentEventId === undefined ? '原始事件' : '更正/撤销';
}

export function extractEventChanges(event: ScheduleEvent): readonly EventChangeItem[] {
  const keys = new Set([
    ...Object.keys(event.beforeData ?? {}),
    ...Object.keys(event.afterData ?? {}),
  ]);
  const changes: EventChangeItem[] = [];

  for (const key of keys) {
    if (isSkippedChangeKey(key)) {
      continue;
    }
    const before = event.beforeData?.[key];
    const after = event.afterData?.[key];
    if (!isPrimitive(before) || !isPrimitive(after)) {
      continue;
    }
    if (before === after) {
      continue;
    }
    changes.push({
      ...(before === undefined ? {} : { before: formatPrimitive(before) }),
      ...(after === undefined ? {} : { after: formatPrimitive(after) }),
      label: changeLabels[key] ?? key,
    });
  }

  return changes;
}

export function buildEventTimelineItems(
  events: readonly ScheduleEvent[],
): readonly EventTimelineItem[] {
  return [...events]
    .sort(
      (first, second) =>
        first.occurredAt.localeCompare(second.occurredAt) || first.id.localeCompare(second.id),
    )
    .map((event) => ({
      event,
      isCorrection: event.parentEventId !== undefined,
      ...(getEventMarker(event.eventType) === undefined
        ? {}
        : { marker: getEventMarker(event.eventType) as CalendarChangeMarker }),
    }));
}

export function buildEventTypeOptions(): readonly {
  readonly label: string;
  readonly value: string;
}[] {
  return Object.entries(eventTypeLabels).map(([value, label]) => ({ label, value }));
}

export function formatJsonValue(value: JsonObject | undefined): string {
  return value === undefined ? '' : JSON.stringify(value, null, 2);
}

function isSkippedChangeKey(key: string): boolean {
  return skippedChangeKeys.has(key) || /id(s)?$/iu.test(key);
}

function isPrimitive(value: unknown): value is string | number | boolean | null | undefined {
  return (
    value === null ||
    value === undefined ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

function formatPrimitive(value: string | number | boolean | null | undefined): string {
  if (value === null) {
    return '—';
  }
  if (value === undefined) {
    return '未设置';
  }
  return String(value);
}
