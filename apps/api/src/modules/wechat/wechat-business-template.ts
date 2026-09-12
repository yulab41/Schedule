import { WechatGatewayError, type WechatSubscribeMessageData } from './wechat-gateway.js';

export const businessNotificationTypes = new Set([
  'schedule_published',
  'schedule_generated',
  'schedule_changed',
  'approval_pending',
  'swap_request_created',
  'swap_request_accepted',
  'swap_request_rejected',
  'swap_request_cancelled',
  'swap_revoked',
  'duty_adjustment_request_created',
  'duty_adjustment_request_accepted',
  'duty_adjustment_request_rejected',
  'duty_adjustment_request_cancelled',
  'duty_adjustment_revoked',
  'leave_request_approved',
  'leave_request_rejected',
  'leave_request_cancelled',
  'leave_request_revoked',
]);

const fieldPatterns = {
  title: /^thing\d+$/u,
  summary: /^thing\d+$/u,
  groupName: /^thing\d+$/u,
  memberName: /^(?:thing|name)\d+$/u,
  status: /^(?:thing|phrase)\d+$/u,
  occurredAt: /^time\d+$/u,
};
type Source = keyof typeof fieldPatterns;
export interface BusinessTemplateConfiguration {
  readonly id: string;
  readonly fields: Readonly<Partial<Record<Source, string>>>;
}

/** Only an explicitly configured second template is eligible; never reuse duty fields. */
export function readBusinessTemplateConfiguration(
  environment: NodeJS.ProcessEnv = process.env,
): BusinessTemplateConfiguration | undefined {
  const id = environment.WECHAT_BUSINESS_TEMPLATE_ID?.trim();
  if (
    !id ||
    !/^[A-Za-z0-9_-]{1,128}$/u.test(id) ||
    id === environment.WECHAT_DUTY_REMINDER_TEMPLATE_ID?.trim()
  )
    return undefined;
  try {
    const raw: unknown = JSON.parse(environment.WECHAT_BUSINESS_TEMPLATE_FIELDS ?? 'null');
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined;
    const entries = Object.entries(raw);
    if (!entries.length || entries.length > Object.keys(fieldPatterns).length) return undefined;
    if (!Object.hasOwn(raw, 'title') && !Object.hasOwn(raw, 'summary')) return undefined;
    const used = new Set<string>();
    const fields: Partial<Record<Source, string>> = {};
    for (const [source, field] of entries) {
      if (
        !Object.hasOwn(fieldPatterns, source) ||
        typeof field !== 'string' ||
        !fieldPatterns[source as Source].test(field) ||
        used.has(field)
      )
        return undefined;
      used.add(field);
      fields[source as Source] = field;
    }
    return { id, fields };
  } catch {
    return undefined;
  }
}

export function automaticWechatTargetVersion(
  groupId: string | null | undefined,
): 'trial' | 'formal' {
  const ids = (process.env.WECHAT_TRIAL_GROUP_IDS ?? '')
    .split(',')
    .map((id) => id.trim().toLowerCase())
    .filter(Boolean);
  if (
    !ids.every((id) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(id),
    )
  )
    throw new WechatGatewayError(
      null,
      null,
      'VALIDATION_FAILED',
      'Automatic WeChat target group configuration invalid.',
    );
  return groupId && ids.includes(groupId.toLowerCase()) ? 'trial' : 'formal';
}

export function buildBusinessTemplateData(
  configuration: BusinessTemplateConfiguration,
  input: {
    readonly title: string;
    readonly notificationType: string;
    readonly groupName: string;
    readonly memberName: string;
    readonly createdAt: Date;
    readonly payload?: Readonly<Record<string, unknown>> | null;
  },
): WechatSubscribeMessageData {
  const status = input.notificationType.endsWith('_rejected')
    ? '已驳回'
    : input.notificationType.endsWith('_cancelled')
      ? '已取消'
      : input.notificationType.endsWith('_revoked')
        ? '已撤销'
        : input.notificationType === 'approval_pending'
          ? '待审批'
          : input.notificationType.endsWith('_created')
            ? '待处理'
            : input.notificationType.endsWith('_accepted')
              ? '已接受'
              : input.notificationType.endsWith('_approved')
                ? '已批准'
                : '已更新';
  const month = input.payload?.businessMonth;
  const start = input.payload?.startDate;
  const end = input.payload?.endDate;
  const summary =
    typeof start === 'string' && typeof end === 'string'
      ? `${start.slice(5)}至${end.slice(5)}排班已更新`
      : typeof month === 'string'
        ? `${month.slice(0, 7)}排班已发布`
        : input.title;
  const values = {
    title: input.title,
    summary,
    status,
    groupName: input.groupName,
    memberName: input.memberName,
    occurredAt: new Date(input.createdAt.valueOf() + 8 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 16)
      .replace('T', ' '),
  };
  const data: Record<string, { value: string }> = {};
  for (const [source, field] of Object.entries(configuration.fields)) {
    const value = values[source as Source].trim();
    if (!value)
      throw new WechatGatewayError(
        null,
        null,
        'VALIDATION_FAILED',
        'Business notification template data invalid.',
      );
    const limit = field.startsWith('phrase') ? 5 : field.startsWith('name') ? 10 : 20;
    data[field] = {
      value: field.startsWith('time') ? value : Array.from(value).slice(0, limit).join(''),
    };
  }
  return data;
}
