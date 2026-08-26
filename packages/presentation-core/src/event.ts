const chinaStandardTimeOffsetMilliseconds = 8 * 60 * 60 * 1000;

export type EventChangeMarker = 'leave-cover' | 'overtime' | 'swap';
export type EventTone = 'adjustment' | 'leave' | 'neutral' | 'schedule' | 'swap';
export type JsonObjectLike = Readonly<Record<string, unknown>>;

export interface EventTimestampLike {
  readonly id: string;
  readonly occurredAt: string;
}

export interface ScheduleEventLike {
  readonly affectedMembershipIds: readonly string[];
  readonly affectedShiftIds: readonly string[];
  readonly afterData?: JsonObjectLike | undefined;
  readonly beforeData?: JsonObjectLike | undefined;
  readonly eventStatus: string;
  readonly eventType: string;
  readonly id: string;
  readonly objectId?: string | undefined;
  readonly objectType: string;
  readonly occurredAt: string;
  readonly reason?: string | undefined;
}

export interface EventAssignmentLike {
  readonly actualMemberName?: string | undefined;
  readonly id: string;
  readonly plannedMemberName?: string | undefined;
  readonly scheduleRoleName: string;
}

export interface EventChangeItem {
  readonly after?: string;
  readonly before?: string;
  readonly label: string;
}

export interface EventTimelineItem<Event extends ScheduleEventLike = ScheduleEventLike> {
  readonly event: Event;
  readonly marker?: EventChangeMarker;
}

export interface EventDateGroup<Event extends EventTimestampLike = ScheduleEventLike> {
  readonly businessDate: string;
  readonly events: readonly Event[];
  readonly label: string;
}

export interface EventNarrativeContext {
  readonly initiatedAt?: string;
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
  leave_request_cancelled: '请假申请已取消',
  leave_request_approved: '请假已批准',
  leave_request_rejected: '请假已驳回',
  leave_request_revoked: '请假已撤销',
  leave_request_submitted: '请假已提交',
  manual_schedule_template_applied: '手动模板已应用',
  manual_schedule_template_created: '手动模板已创建',
  manual_schedule_template_deleted: '手动模板已删除',
  manual_schedule_template_updated: '手动模板已更新',
  rotation_order_changed: '轮值顺序已调整',
  schedule_generation_completed: '自动排班已生成',
  schedule_period_created: '排班版本已创建',
  schedule_period_deleted: '排班草稿已删除',
  schedule_period_published: '排班已发布',
  schedule_period_replaced: '排班版本已替换',
  schedule_period_withdrawn: '排班版本已撤回',
  schedule_backfill_completed: '排班补录',
  schedule_role_changed: '排班岗位已调整',
  schedule_role_corrected: '排班岗位已更正',
  shift_type_changed: '班种已调整',
  swap_completed: '换班已生效',
  swap_request_accepted: '换班申请已接受',
  swap_request_approved: '换班申请已批准',
  swap_request_cancelled: '换班申请已取消',
  swap_request_created: '换班申请已提交',
  swap_request_rejected: '换班申请已驳回',
  swap_revoked: '换班已撤销',
};

const changeLabels: Readonly<Record<string, string>> = {
  actualMemberId: '实际人员',
  actualMemberName: '实际人员',
  businessMonth: '排班月份',
  plannedMemberId: '计划人员',
  plannedMemberName: '计划人员',
  reason: '原因',
  revision: '版本号',
  rulesVersion: '规则版本',
  scheduleRoleId: '排班岗位',
  scheduleRoleName: '排班岗位',
  shiftTypeAbbreviation: '班种',
  shiftTypeId: '班种',
  shiftTypeName: '班种',
  status: '状态',
  strategy: '重排策略',
};

const skippedChangeKeys = new Set([
  'affectedMembershipIds',
  'affectedShiftIds',
  'approverUserId',
  'createdAt',
  'decidedAt',
  'deletedAt',
  'groupId',
  'initiatedByUserId',
  'occurredAt',
  'objectId',
  'objectType',
  'operationId',
  'operatorUserId',
  'parentEventId',
  'schedulePeriodId',
  'updatedAt',
  'version',
]);

const eventStatusLabels: Readonly<Record<string, string>> = {
  cancelled: '已取消',
  completed: '已完成',
  pending: '处理中',
  rejected: '已拒绝',
};

const primitiveStatusLabels: Readonly<Record<string, string>> = {
  active: '生效中',
  approved: '已批准',
  cancelled: '已取消',
  completed: '已完成',
  inactive: '已停用',
  pending: '待审批',
  pending_approval: '待管理员审批',
  pending_target: '待对方接受',
  rejected: '已拒绝',
  revoked: '已撤销',
};

export function getEventTypeLabel(eventType: string): string {
  return eventTypeLabels[eventType] ?? '排班变更';
}

export function getEventStatusLabel(eventStatus: string): string {
  return eventStatusLabels[eventStatus] ?? eventStatus;
}

export function getEventTone(eventType: string): EventTone {
  if (eventType.includes('swap')) return 'swap';
  if (eventType.includes('leave')) return 'leave';
  if (eventType.includes('adjustment')) return 'adjustment';
  if (eventType.includes('schedule')) return 'schedule';
  return 'neutral';
}

export function getEventImpactCount(
  event: Pick<ScheduleEventLike, 'affectedMembershipIds' | 'affectedShiftIds'>,
): number {
  return event.affectedMembershipIds.length + event.affectedShiftIds.length;
}

function getEventMarker(eventType: string): EventChangeMarker | undefined {
  switch (eventType) {
    case 'swap_completed':
      return 'swap';
    case 'leave_cover_completed':
      return 'leave-cover';
    case 'duty_adjustment_completed':
      return 'overtime';
    default:
      return undefined;
  }
}

export function formatEventTime(occurredAt: string): string {
  const timestamp = new Date(occurredAt);
  if (Number.isNaN(timestamp.valueOf())) throw new Error('The timestamp must be valid.');
  const shifted = new Date(timestamp.valueOf() + chinaStandardTimeOffsetMilliseconds).toISOString();
  return `${shifted.slice(0, 10)} ${shifted.slice(11, 16)}`;
}

export function buildEventDateGroups<Event extends EventTimestampLike>(
  events: readonly Event[],
): readonly EventDateGroup<Event>[] {
  const groups = new Map<string, Event[]>();
  const sorted = [...events].sort(
    (first, second) =>
      second.occurredAt.localeCompare(first.occurredAt) || second.id.localeCompare(first.id),
  );

  for (const event of sorted) {
    const businessDate = formatEventTime(event.occurredAt).slice(0, 10);
    const group = groups.get(businessDate) ?? [];
    group.push(event);
    groups.set(businessDate, group);
  }

  return [...groups.entries()].map(([businessDate, groupEvents]) => ({
    businessDate,
    events: groupEvents,
    label: formatEventDateLabel(businessDate),
  }));
}

function formatEventDateLabel(businessDate: string): string {
  const [year = '0', month = '0', day = '0'] = businessDate.split('-');
  const weekday = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))).getUTCDay();
  return `${Number(month)}月${Number(day)}日 周${['日', '一', '二', '三', '四', '五', '六'][weekday]}`;
}

export function extractEventChanges(event: ScheduleEventLike): readonly EventChangeItem[] {
  const keys = new Set([
    ...Object.keys(event.beforeData ?? {}),
    ...Object.keys(event.afterData ?? {}),
  ]);
  const changes: EventChangeItem[] = [];

  for (const key of keys) {
    if (isSkippedChangeKey(key)) continue;
    const before = event.beforeData?.[key];
    const after = event.afterData?.[key];
    if (!isPrimitive(before) || !isPrimitive(after) || before === after) continue;
    changes.push({
      ...(before === undefined ? {} : { before: formatPrimitive(before) }),
      ...(after === undefined ? {} : { after: formatPrimitive(after) }),
      label: changeLabels[key] ?? key,
    });
  }

  return changes;
}

export function buildEventNarrative<Assignment extends EventAssignmentLike>(
  event: ScheduleEventLike,
  assignment?: Assignment,
  context: EventNarrativeContext = {},
): string | undefined {
  const before = event.beforeData ?? {};
  const after = event.afterData ?? {};

  switch (event.eventType) {
    case 'swap_completed': {
      const beforeInitiator = readNestedMemberName(before.initiatorAssignment);
      const beforeTarget = readNestedMemberName(before.targetAssignment);
      const afterInitiator = readNestedMemberName(after.initiatorAssignment);
      const afterTarget = readNestedMemberName(after.targetAssignment);
      let beforeName = beforeInitiator ?? beforeTarget;
      let afterName = afterInitiator ?? afterTarget;
      if (assignment !== undefined) {
        const assignmentIsInitiator =
          before.initiatorAssignmentId === assignment.id ||
          after.initiatorAssignmentId === assignment.id;
        const assignmentIsTarget =
          before.targetAssignmentId === assignment.id || after.targetAssignmentId === assignment.id;
        if (assignmentIsInitiator) {
          beforeName = beforeInitiator;
          afterName = afterInitiator;
        } else if (assignmentIsTarget) {
          beforeName = beforeTarget;
          afterName = afterTarget;
        }
      }
      beforeName ??= assignment?.plannedMemberName;
      afterName ??= assignment?.actualMemberName;
      if (beforeName !== undefined && afterName !== undefined) {
        const details: string[] = [];
        const initiatorName =
          readString(before.initiatorMemberName) ??
          readString(after.initiatorMemberName) ??
          readNestedMemberName(before.initiatorAssignment);
        if (initiatorName !== undefined) details.push(`由 ${initiatorName} 发起`);
        if (context.initiatedAt !== undefined) {
          details.push(`发起时间 ${formatEventTime(context.initiatedAt)}`);
        }
        const detailText = details.length === 0 ? '' : `（${details.join('，')}）`;
        return `${beforeName} → ${afterName}${detailText}`;
      }
      break;
    }
    case 'swap_request_created':
      return '换班申请已提交。';
    case 'swap_request_accepted':
      return '对方已接受换班申请。';
    case 'swap_request_approved':
      return '管理员已批准换班申请。';
    case 'swap_request_rejected':
      return '换班申请已被拒绝。';
    case 'swap_request_cancelled':
      return '换班申请已取消。';
    case 'swap_revoked':
      return '换班已因排班变更撤销，值班人员已恢复为当前排班版本。';
    case 'leave_cover_completed': {
      const strategy =
        after.strategy === 'shift-forward'
          ? '整体顺延'
          : after.strategy === 'keep-original-order'
            ? '保持原顺序'
            : '';
      const dutyName = getDutyMemberName(assignment);
      return dutyName === undefined
        ? `请假替班完成${strategy === '' ? '' : `（${strategy}）`}。`
        : `请假替班完成${strategy === '' ? '' : `（${strategy}）`}，该班次现由 ${dutyName} 值班。`;
    }
    case 'leave_request_submitted':
      return '请假申请已提交。';
    case 'leave_request_approved':
      return '请假已批准。';
    case 'leave_request_rejected':
      return '请假申请已被拒绝。';
    case 'leave_request_cancelled':
      return '请假申请已取消。';
    case 'leave_request_revoked':
      return '请假已撤销；如需恢复原排班，请重新生成或发布排班。';
    case 'duty_adjustment_completed': {
      const beforeName =
        readTopLevelMemberName(before) ??
        readString(before.deductedMemberName) ??
        readString(after.deductedMemberName) ??
        assignment?.plannedMemberName;
      const afterName = readTopLevelMemberName(after) ?? readString(after.overtimeMemberName);
      const initiatorName = readString(after.initiatorMemberName);
      if (afterName !== undefined) {
        return `${beforeName ?? '原值班人员'} 的班次由 ${afterName} 代值${
          initiatorName === undefined ? '' : `（由 ${initiatorName} 发起）`
        }。`;
      }
      break;
    }
    case 'duty_adjustment_request_created':
      return '加扣班申请已提交。';
    case 'duty_adjustment_request_accepted':
      return '加班成员已接受加扣班申请。';
    case 'duty_adjustment_request_approved':
      return '管理员已批准加扣班申请。';
    case 'duty_adjustment_request_rejected':
      return '加扣班申请已被拒绝。';
    case 'duty_adjustment_request_cancelled':
      return '加扣班申请已取消。';
    case 'duty_adjustment_revoked': {
      const restoredName = readTopLevelMemberName(after);
      return restoredName === undefined
        ? '加扣班已因排班变更撤销，值班人员已恢复为当前排班版本。'
        : `加扣班已撤销：值班恢复为 ${restoredName}。`;
    }
    case 'assignment_manually_updated': {
      const beforeName = readTopLevelMemberName(before);
      const afterName = readTopLevelMemberName(after);
      if (beforeName !== undefined || afterName !== undefined) {
        return `人工调整班次：值班人员由 ${beforeName ?? '未设置'} 改为 ${afterName ?? '未设置'}。`;
      }
      break;
    }
    case 'schedule_backfill_completed': {
      const beforeName = readTopLevelMemberName(before);
      const afterName = readTopLevelMemberName(after);
      const reason = readString(after.reason);
      if (beforeName !== undefined || afterName !== undefined) {
        return `排班补录：值班人员由 ${beforeName ?? '未设置'} 改为 ${afterName ?? '未设置'}${
          reason === undefined ? '' : `（${reason}）`
        }。`;
      }
      break;
    }
    case 'schedule_period_published':
      return assignment === undefined
        ? '排班已发布。'
        : `${assignment.scheduleRoleName} 排班已发布。`;
    case 'schedule_period_created':
      return '排班版本已创建。';
    case 'schedule_period_deleted':
      return '排班草稿已删除。';
    case 'schedule_period_replaced':
      return '排班版本已被新版本替代。';
    case 'schedule_period_withdrawn':
      return '该排班版本已撤回。';
    case 'schedule_generation_completed':
      return '自动排班已生成。';
    case 'manual_schedule_template_applied':
      return '手动模板已应用并生成该班次。';
    case 'manual_schedule_template_created':
      return '手动排班模板已创建。';
    case 'manual_schedule_template_updated':
      return '手动排班模板已更新。';
    case 'manual_schedule_template_deleted':
      return '手动排班模板已删除。';
    case 'schedule_role_changed':
      return '排班岗位已调整。';
    case 'schedule_role_corrected':
      return '排班岗位已更正。';
    case 'shift_type_changed':
      return '班种已调整。';
    case 'rotation_order_changed':
      return '轮值顺序已调整。';
    default:
      return buildChangeFallbackNarrative(event);
  }

  return buildChangeFallbackNarrative(event);
}

export interface ChangeChainStep {
  readonly after: string;
  readonly before: string;
  readonly detail: string;
  readonly eventId: string;
  readonly occurredAt: string;
  readonly type: '换班' | '加扣班';
}

export function buildChangeChainSummary(
  events: readonly ScheduleEventLike[],
  assignmentId: string,
): string | undefined {
  const steps: ChangeChainStep[] = [];
  for (const event of events) {
    if (event.eventType === 'swap_completed') {
      const step = extractSwapSideChange(event, assignmentId);
      if (step !== undefined) {
        steps.push({ ...step, detail: `${step.before} → ${step.after}`, type: '换班' });
      }
    } else if (
      event.eventType === 'duty_adjustment_completed' &&
      event.affectedShiftIds.includes(assignmentId)
    ) {
      const step = extractDutyAdjustmentStep(event);
      if (step !== undefined) {
        steps.push({
          ...step,
          detail: `${step.deducted}-1 → ${step.overtime}+1`,
          type: '加扣班',
        });
      }
    }
  }
  if (steps.length === 0) return undefined;
  steps.sort(
    (first, second) =>
      first.occurredAt.localeCompare(second.occurredAt) ||
      first.eventId.localeCompare(second.eventId),
  );

  const names: string[] = [];
  for (const step of steps) {
    if (names.length === 0) names.push(step.before);
    if (names[names.length - 1] !== step.after) names.push(step.after);
  }
  const detail = steps
    .map((step) => `${formatEventTime(step.occurredAt)} ${step.type} ${step.detail}`)
    .join('；');
  return `人员变更链：${names.join(' → ')}（${steps.length} 次变更；${detail}）`;
}

function buildChangeFallbackNarrative(event: ScheduleEventLike): string | undefined {
  const changes = extractEventChanges(event);
  if (changes.length === 0) return `${getEventTypeLabel(event.eventType)}。`;
  return `班次变动：${changes
    .map(
      (change) =>
        `${change.label} 由 ${change.before ?? '未设置'} 改为 ${change.after ?? '未设置'}`,
    )
    .join('；')}。`;
}

export function buildEventTimelineItems<Event extends ScheduleEventLike>(
  events: readonly Event[],
): readonly EventTimelineItem<Event>[] {
  return [...events]
    .sort(
      (first, second) =>
        first.occurredAt.localeCompare(second.occurredAt) || first.id.localeCompare(second.id),
    )
    .map((event) => {
      const marker = getEventMarker(event.eventType);
      return { event, ...(marker === undefined ? {} : { marker }) };
    });
}

export function buildEventTypeOptions(): { label: string; value: string }[] {
  return Object.entries(eventTypeLabels).map(([value, label]) => ({ label, value }));
}

export function formatJsonValue(value: JsonObjectLike | undefined): string {
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
  if (value === null) return '—';
  if (value === undefined) return '未设置';
  if (typeof value === 'string') {
    const statusLabel = primitiveStatusLabels[value];
    if (statusLabel !== undefined) return statusLabel;
  }
  return String(value);
}

function readNestedMemberName(value: unknown): string | undefined {
  return value === null || typeof value !== 'object' ? undefined : readMemberNameFromObject(value);
}

function readTopLevelMemberName(value: JsonObjectLike): string | undefined {
  return readMemberNameFromObject(value);
}

function readMemberNameFromObject(value: object): string | undefined {
  const record = value as { actualMemberName?: unknown; plannedMemberName?: unknown };
  if (typeof record.actualMemberName === 'string' && record.actualMemberName.length > 0) {
    return record.actualMemberName;
  }
  if (typeof record.plannedMemberName === 'string' && record.plannedMemberName.length > 0) {
    return record.plannedMemberName;
  }
  return undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function getDutyMemberName(assignment: EventAssignmentLike | undefined): string | undefined {
  return assignment?.actualMemberName ?? assignment?.plannedMemberName;
}

interface SwapChainStep {
  readonly after: string;
  readonly before: string;
  readonly eventId: string;
  readonly occurredAt: string;
}

interface DutyAdjustmentChainStep {
  readonly after: string;
  readonly before: string;
  readonly deducted: string;
  readonly eventId: string;
  readonly occurredAt: string;
  readonly overtime: string;
}

function extractDutyAdjustmentStep(event: ScheduleEventLike): DutyAdjustmentChainStep | undefined {
  const before = event.beforeData ?? {};
  const after = event.afterData ?? {};
  const deducted = readString(after.deductedMemberName) ?? readString(before.deductedMemberName);
  const overtime = readString(after.overtimeMemberName) ?? readString(before.overtimeMemberName);
  const beforeName = readTopLevelMemberName(before) ?? deducted;
  const afterName = readTopLevelMemberName(after) ?? overtime;
  if (
    deducted === undefined ||
    overtime === undefined ||
    beforeName === undefined ||
    afterName === undefined
  ) {
    return undefined;
  }
  return {
    after: afterName,
    before: beforeName,
    deducted,
    eventId: event.id,
    occurredAt: event.occurredAt,
    overtime,
  };
}

function extractSwapSideChange(
  event: ScheduleEventLike,
  assignmentId: string,
): SwapChainStep | undefined {
  const before = event.beforeData ?? {};
  const after = event.afterData ?? {};
  const beforeInitiator = readNestedMemberName(before.initiatorAssignment);
  const afterInitiator = readNestedMemberName(after.initiatorAssignment);
  const beforeTarget = readNestedMemberName(before.targetAssignment);
  const afterTarget = readNestedMemberName(after.targetAssignment);
  if (
    after.initiatorAssignmentId === assignmentId &&
    beforeInitiator !== undefined &&
    afterInitiator !== undefined
  ) {
    return {
      after: afterInitiator,
      before: beforeInitiator,
      eventId: event.id,
      occurredAt: event.occurredAt,
    };
  }
  if (
    after.targetAssignmentId === assignmentId &&
    beforeTarget !== undefined &&
    afterTarget !== undefined
  ) {
    return {
      after: afterTarget,
      before: beforeTarget,
      eventId: event.id,
      occurredAt: event.occurredAt,
    };
  }
  return undefined;
}
