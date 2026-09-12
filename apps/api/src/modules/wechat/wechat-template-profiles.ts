import { WechatGatewayError, type WechatSubscribeMessageData } from './wechat-gateway.js';

export type BusinessTemplateKind = 'business' | 'swap' | 'dutyAdjustment' | 'leave';
export type NotificationSnapshot = Readonly<Record<string, string>>;
export interface ProfileTemplate {
  readonly kind: BusinessTemplateKind;
  readonly id: string;
  readonly fields: Readonly<Record<string, string>>;
}

const prefixes = {
  business: 'BUSINESS',
  swap: 'SWAP',
  dutyAdjustment: 'DUTY_ADJUSTMENT',
  leave: 'LEAVE',
} as const;
const text = /^thing\d+$/u;
const person = /^(?:name|thing|short_thing)\d+$/u;
const schemas = {
  business: { dateRange: /^date\d+$/u, status: text, summary: text, actorName: person },
  swap: {
    actorName: person,
    participantsHint: /^short_thing\d+$/u,
    dateRange: /^(?:time|date)\d+$/u,
    swapSummary: text,
    reason: text,
  },
  dutyAdjustment: {
    shiftName: text,
    dateRange: /^(?:time|date)\d+$/u,
    remarks: text,
    actorName: person,
  },
  leave: { subjectName: person, leaveType: text, reason: text, appliedAt: /^time\d+$/u, tip: text },
} satisfies Record<BusinessTemplateKind, Record<string, RegExp>>;

export function readProfileTemplate(
  kind: BusinessTemplateKind,
  env: NodeJS.ProcessEnv = process.env,
): ProfileTemplate | undefined {
  const prefix = `WECHAT_${prefixes[kind]}_TEMPLATE`;
  const id = env[`${prefix}_ID`]?.trim();
  if (!id || !/^[A-Za-z0-9_-]{1,128}$/u.test(id)) return undefined;
  const others = [
    'DUTY_REMINDER',
    ...Object.values(prefixes).filter((value) => value !== prefixes[kind]),
  ];
  if (others.some((value) => env[`WECHAT_${value}_TEMPLATE_ID`]?.trim() === id)) return undefined;
  try {
    const fields: unknown = JSON.parse(env[`${prefix}_FIELDS`] ?? 'null');
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return undefined;
    const expected: Record<string, RegExp> = schemas[kind];
    const entries = Object.entries(fields);
    if (
      entries.length !== Object.keys(expected).length ||
      new Set(entries.map(([, value]) => value)).size !== entries.length
    )
      return undefined;
    if (
      !entries.every(
        ([source, field]) => typeof field === 'string' && expected[source]?.test(field),
      )
    )
      return undefined;
    return { kind, id, fields: fields as Record<string, string> };
  } catch {
    return undefined;
  }
}

export function resolveBusinessKind(
  type: string,
  payload?: Readonly<Record<string, unknown>> | null,
  objectType?: string | null,
): BusinessTemplateKind {
  if (
    type.startsWith('swap_') ||
    objectType === 'swap_request' ||
    payload?.requestType === 'swap' ||
    typeof payload?.swapRequestId === 'string'
  )
    return 'swap';
  if (
    type.startsWith('duty_adjustment_') ||
    objectType === 'duty_adjustment' ||
    payload?.requestType === 'duty_adjustment' ||
    typeof payload?.dutyAdjustmentId === 'string'
  )
    return 'dutyAdjustment';
  if (
    type.startsWith('leave_') ||
    objectType === 'leave_request' ||
    payload?.requestType === 'leave' ||
    typeof payload?.leaveRequestId === 'string'
  )
    return 'leave';
  return 'business';
}

export function notificationStatus(
  type: string,
  payload?: Readonly<Record<string, unknown>> | null,
): string {
  if (type.endsWith('_rejected')) return '已驳回';
  if (type.endsWith('_cancelled')) return '已取消';
  if (type.endsWith('_revoked')) return '已撤销';
  if (type === 'approval_pending' || payload?.status === 'pending_approval') return '待审批';
  if (type.endsWith('_created')) return '待处理';
  if (type.endsWith('_accepted')) return '已接受';
  if (type.endsWith('_approved')) return '已批准';
  if (type === 'schedule_published' || type === 'schedule_generated') return '新增';
  return '已完成';
}

export function chinaDateTime(value: Date): string {
  return new Date(value.valueOf() + 8 * 3600000).toISOString().slice(0, 16).replace('T', ' ');
}

function dateRange(snapshot: NotificationSnapshot): string {
  const start = snapshot.startDate,
    end = snapshot.endDate;
  for (const value of [start, end]) {
    if (
      !value ||
      !/^\d{4}-\d{2}-\d{2}$/u.test(value) ||
      !Number.isFinite(Date.parse(value)) ||
      new Date(value).toISOString().slice(0, 10) !== value
    )
      throw invalidData();
  }
  if (start! > end!) throw invalidData();
  return start === end ? start! : `${start}~${end}`;
}

export function buildProfileTemplateData(
  config: ProfileTemplate,
  snapshot: NotificationSnapshot,
): WechatSubscribeMessageData {
  const values: Record<string, string | undefined> = { ...snapshot };
  if (config.kind !== 'leave') values.dateRange = dateRange(snapshot);
  if (config.kind === 'business')
    values.summary = `${snapshot.startDate!.slice(5)}~${snapshot.endDate!.slice(5)}排班已更新！`;
  if (config.kind === 'swap') {
    values.reason = `${snapshot.status}：${snapshot.reason || '未填写原因'}`;
    values.participantsHint = '见换班岗位';
    const keys = [
      'initiatorName',
      'targetName',
      'initiatorDate',
      'targetDate',
      'initiatorShift',
      'targetShift',
    ];
    if (keys.some((key) => !snapshot[key])) throw invalidData();
    const summary = `${snapshot.initiatorName}${snapshot.initiatorDate!.slice(5).replace('-', '')}${snapshot.initiatorShift}→${snapshot.targetName}${snapshot.targetDate!.slice(5).replace('-', '')}${snapshot.targetShift}`;
    values.swapSummary =
      Array.from(summary).length <= 20 ? summary : '人员姓名过长，点击查看换班详情';
  }
  if (config.kind === 'dutyAdjustment')
    values.remarks = `${snapshot.status}：${snapshot.reason || '加扣班'}`;
  if (config.kind === 'leave') values.tip = `${snapshot.status}，请进入小程序查看详情`;
  const data: Record<string, { value: string }> = {};
  for (const [source, field] of Object.entries(config.fields)) {
    const value = values[source]?.replace(/[\r\n\t]/gu, ' ').trim();
    if (!value || value.includes('undefined')) throw invalidData();
    if (/^(?:time|date)\d+$/u.test(field)) {
      data[field] = { value };
      continue;
    }
    const limit = field.startsWith('short_thing')
      ? 5
      : field.startsWith('name')
        ? /^[A-Za-z\s.-]+$/u.test(value)
          ? 20
          : 10
        : 20;
    const points = Array.from(value);
    // Identity and shift labels must never be silently shortened into a different person/shift.
    if (
      points.length > limit &&
      ['actorName', 'subjectName', 'participants', 'shiftName'].includes(source)
    )
      throw invalidData();
    data[field] = {
      value: points.length > limit ? `${points.slice(0, limit - 1).join('')}…` : value,
    };
  }
  return data;
}

function invalidData(): WechatGatewayError {
  return new WechatGatewayError(
    null,
    null,
    'VALIDATION_FAILED',
    'Business notification template data invalid.',
  );
}
