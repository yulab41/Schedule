import { createHash, randomUUID } from 'node:crypto';
import {
  type DatabaseClient,
  type DatabaseTransaction,
  withTransaction,
  users,
  userAuthIdentities,
  groups,
  groupMemberships,
  notificationPreferences,
  notificationDeliveries,
  notifications,
  idempotencyKeys,
} from '@schedule/database';
import { and, desc, eq, gte, isNull } from 'drizzle-orm';
import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import { ApiError } from '../../plugins/error-handler.js';
import { withIdempotentOperation } from '../../plugins/idempotency.js';
import {
  WechatGatewayError,
  WECHAT_MESSAGE_PAGE,
  type WechatGateway,
  type WechatMessageTargetVersion,
} from './wechat-gateway.js';
import {
  WechatPushDispatcher,
  readWechatTemplateIds,
  dutyReminderFieldKeys,
} from './wechat-push-dispatcher.js';

const scope = 'wechat-diagnostic-send';
const designatedAdmin = '00000000-0000-4000-8000-000000000001';
export interface WechatDiagnosticResult {
  readonly targetVersion?: WechatMessageTargetVersion;
  readonly page?: typeof WECHAT_MESSAGE_PAGE;
  readonly outcome: 'accepted' | 'rejected' | 'unknown';
  readonly category: string;
  readonly code?: number;
  readonly recordedAt?: string;
  readonly phase?: 'reserved' | 'preflight' | 'access-token' | 'send';
}
export function safeWechatDiagnosticError(error: unknown): WechatDiagnosticResult {
  if (
    error instanceof WechatGatewayError &&
    error.mappedCode === 'VALIDATION_FAILED' &&
    error.message === 'Duty reminder template data invalid.'
  )
    return { outcome: 'rejected', category: 'template-data-invalid' };
  if (!(error instanceof WechatGatewayError) || error.errcode === null)
    return { outcome: 'unknown', category: 'transport-unknown' };
  const code = error.errcode;
  const categories: Readonly<Record<number, string>> = {
    47003: 'template-fields',
    40037: 'template-unavailable',
    43101: 'subscription-unavailable',
    40003: 'recipient-invalid',
    40013: 'app-configuration',
    40125: 'credential-configuration',
    40001: 'access-token',
    42001: 'access-token',
    45009: 'rate-limited',
    45011: 'rate-limited',
  };
  return { outcome: 'rejected', code, category: categories[code] ?? 'wechat-rejected' };
}

export class WechatDiagnosticsService {
  constructor(
    private readonly client: DatabaseClient,
    private readonly gateway: WechatGateway | undefined,
  ) {}

  configuration() {
    const templates = readWechatTemplateIds();
    return {
      dutyReminderTemplateId: templates.dutyReminder?.trim() || null,
      ...(templates.business ? { businessTemplateId: templates.business } : {}),
    };
  }

  async inspect(identity: AuthenticatedIdentity, groupId: string) {
    const inspection = await withTransaction(this.client, async (tx) => {
      const user = await this.requireUser(tx, identity, false);
      const readiness = await this.readiness(tx, user, groupId);
      const deliveries = await tx
        .select({
          status: notificationDeliveries.status,
          attempts: notificationDeliveries.attempts,
          createdAt: notificationDeliveries.createdAt,
          sentAt: notificationDeliveries.sentAt,
          lastError: notificationDeliveries.lastError,
        })
        .from(notificationDeliveries)
        .innerJoin(notifications, eq(notifications.id, notificationDeliveries.notificationId))
        .where(
          and(
            eq(notifications.recipientUserId, user.id),
            eq(notifications.groupId, groupId),
            eq(notificationDeliveries.channel, 'wechat'),
          ),
        )
        .orderBy(desc(notificationDeliveries.createdAt))
        .limit(10);
      const tests = await tx
        .select({ result: idempotencyKeys.result, createdAt: idempotencyKeys.createdAt })
        .from(idempotencyKeys)
        .where(and(eq(idempotencyKeys.actorUserId, user.id), eq(idempotencyKeys.scope, scope)))
        .orderBy(desc(idempotencyKeys.createdAt))
        .limit(5);
      return {
        ...readiness,
        expectedFieldKeys: [...dutyReminderFieldKeys],
        platformFieldsVerified: false,
        deliveries: deliveries.map((row) => ({
          status: row.status,
          attempts: row.attempts,
          createdAt: row.createdAt.toISOString(),
          sentAt: row.sentAt?.toISOString() ?? null,
          errorCategory: safeStoredDeliveryError(row.lastError),
        })),
        tests: tests.map((row) => ({
          ...safeStoredResult(row.result),
          recordedAt: row.createdAt.toISOString(),
        })),
      };
    });
    // Authenticate first, and never hold database locks during the external read.
    const templateId = readWechatTemplateIds().dutyReminder;
    if (templateId && this.gateway?.getSubscribeTemplateFields && !this.gateway.isMock) {
      try {
        const fields = await this.gateway.getSubscribeTemplateFields(templateId);
        inspection.platformFieldsVerified =
          fields !== undefined &&
          fields.length === dutyReminderFieldKeys.length &&
          dutyReminderFieldKeys.every((key) => fields.includes(key));
      } catch {
        /* Failed reads retain an unverified result. */
      }
    }
    return inspection;
  }

  async sendTest(
    identity: AuthenticatedIdentity,
    groupId: string,
    operationId: string,
    issuedAt: number,
    targetVersion: WechatMessageTargetVersion = 'formal',
  ): Promise<WechatDiagnosticResult> {
    if (
      !Number.isSafeInteger(issuedAt) ||
      issuedAt > Date.now() + 30_000 ||
      issuedAt < Date.now() - 600_000
    )
      throw new ApiError({
        code: 'VALIDATION_FAILED',
        statusCode: 400,
        userMessage: '测试请求已过期，请重新开始一次测试。',
      });
    let claimed = false;
    let recipientUserId = '';
    const fingerprint = createHash('sha256')
      // Formal is the legacy canonical default; old request replays keep the same fingerprint.
      .update(
        JSON.stringify({
          groupId,
          issuedAt,
          ...(targetVersion === 'formal' ? {} : { targetVersion }),
        }),
      )
      .digest('hex');
    // Commit the reservation BEFORE the external call. A crash or unknown result must never resend.
    const reserved = await withTransaction(this.client, async (tx) => {
      const user = await this.requireUser(tx, identity, true);
      recipientUserId = user.id;
      const readiness = await this.readiness(tx, user, groupId);
      if (
        readiness.mockMode ||
        !readiness.gatewayConfigured ||
        !readiness.templateConfigured ||
        !readiness.identityMatches ||
        !readiness.receivingEnabled
      )
        throw new ApiError({
          code: 'VALIDATION_FAILED',
          statusCode: 400,
          userMessage: '请先完成微信绑定、模板配置并开启接收偏好。',
        });
      return withIdempotentOperation(
        tx,
        { actorUserId: user.id, scope, operationId, requestFingerprint: fingerprint },
        async () => {
          const [recent] = await tx
            .select({ id: idempotencyKeys.id })
            .from(idempotencyKeys)
            .where(
              and(
                eq(idempotencyKeys.actorUserId, user.id),
                eq(idempotencyKeys.scope, scope),
                eq(idempotencyKeys.status, 'completed'),
                gte(idempotencyKeys.createdAt, new Date(Date.now() - 60_000)),
              ),
            )
            .limit(1);
          if (recent)
            throw new ApiError({
              code: 'RATE_LIMITED',
              statusCode: 429,
              userMessage: '每分钟最多发送一次本人测试，请稍后再试。',
            });
          claimed = true;
          return {
            outcome: 'unknown' as const,
            category: 'reserved-no-retry',
            phase: 'reserved' as const,
            recordedAt: new Date().toISOString(),
            targetVersion,
            page: WECHAT_MESSAGE_PAGE,
          };
        },
      );
    });
    if (!claimed) return safeStoredResult(reserved);
    let result: WechatDiagnosticResult;
    let phase: 'preflight' | 'access-token' | 'send' = 'preflight';
    try {
      if (!this.gateway) throw new Error('unconfigured');
      await new WechatPushDispatcher(this.client, this.gateway).send(
        {
          id: randomUUID(),
          recipientUserId,
          notificationType: 'duty_reminder',
          title: '微信提醒测试',
          body: '这是一条仅发给本人的测试消息',
          dutyReminder: {
            businessDate: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10),
            memberName: '本人测试',
            shiftTypeName: '通知测试（非排班）',
            changed: false,
          },
        },
        undefined,
        (currentPhase) => {
          phase = currentPhase;
        },
        targetVersion,
      );
      result = { outcome: 'accepted', category: 'wechat-accepted' };
    } catch (error) {
      result = safeWechatDiagnosticError(error);
    }
    const completed = {
      ...result,
      phase,
      recordedAt: new Date().toISOString(),
      targetVersion,
      page: WECHAT_MESSAGE_PAGE,
    } satisfies WechatDiagnosticResult;
    // If this update fails, the durable unknown reservation still prevents repeat delivery.
    await this.client.database
      .update(idempotencyKeys)
      .set({ result: completed, completedAt: new Date() })
      .where(
        and(
          eq(idempotencyKeys.actorUserId, recipientUserId),
          eq(idempotencyKeys.scope, scope),
          eq(idempotencyKeys.operationKey, operationId),
        ),
      );
    return completed;
  }

  private async requireUser(
    tx: DatabaseTransaction,
    identity: AuthenticatedIdentity,
    lock: boolean,
  ) {
    const query = tx
      .select({ id: users.id, wechatOpenid: users.wechatOpenid })
      .from(users)
      .where(
        and(
          eq(users.id, designatedAdmin),
          eq(users.cloudbaseUid, identity.cloudbaseUid),
          eq(users.isDeveloperAdmin, 1),
          eq(users.status, 'active'),
          isNull(users.deletedAt),
        ),
      )
      .limit(1);
    const [user] = await (lock ? query.for('update') : query);
    if (!user)
      throw new ApiError({
        code: 'FORBIDDEN',
        statusCode: 403,
        userMessage: '当前账号无测试工具权限。',
      });
    return user;
  }

  private async readiness(
    tx: DatabaseTransaction,
    user: { id: string; wechatOpenid: string | null },
    groupId: string,
  ) {
    const [membership] = await tx
      .select({ id: groupMemberships.id })
      .from(groupMemberships)
      .innerJoin(groups, eq(groups.id, groupMemberships.groupId))
      .where(
        and(
          eq(groupMemberships.userId, user.id),
          eq(groupMemberships.groupId, groupId),
          eq(groupMemberships.status, 'active'),
          isNull(groupMemberships.deletedAt),
          isNull(groups.deletedAt),
        ),
      )
      .limit(1);
    if (!membership)
      throw new ApiError({
        code: 'FORBIDDEN',
        statusCode: 403,
        userMessage: '当前账号不是该群组的有效成员。',
      });
    const [preference] = await tx
      .select({ enabled: notificationPreferences.wechatNotificationsEnabled })
      .from(notificationPreferences)
      .where(eq(notificationPreferences.membershipId, membership.id))
      .limit(1);
    const [identity] = await tx
      .select({ subject: userAuthIdentities.subject })
      .from(userAuthIdentities)
      .where(
        and(
          eq(userAuthIdentities.userId, user.id),
          eq(userAuthIdentities.provider, 'wechat_mini_program'),
          eq(userAuthIdentities.appId, this.gateway?.appId ?? ''),
        ),
      )
      .limit(1);
    return {
      mockMode: this.gateway?.isMock === true || process.env.WECHAT_MOCK_MODE === 'true',
      gatewayConfigured: this.gateway?.isConfigured === true,
      templateConfigured: this.configuration().dutyReminderTemplateId !== null,
      currentAppIdentityExists: !!identity,
      legacyOpenidExists: !!user.wechatOpenid,
      identityMatches: !!identity && !!user.wechatOpenid && identity.subject === user.wechatOpenid,
      receivingEnabled: preference?.enabled !== 0,
      activeMember: true,
    };
  }
}

function safeStoredResult(value: unknown): WechatDiagnosticResult {
  const row = value as Partial<WechatDiagnosticResult> | null;
  const allowedCategories = [
    'transport-unknown',
    'template-fields',
    'template-data-invalid',
    'template-unavailable',
    'subscription-unavailable',
    'recipient-invalid',
    'app-configuration',
    'credential-configuration',
    'access-token',
    'rate-limited',
    'wechat-rejected',
    'wechat-accepted',
    'reserved-no-retry',
  ];
  return {
    ...(row?.targetVersion === 'trial' || row?.targetVersion === 'formal'
      ? { targetVersion: row.targetVersion }
      : {}),
    ...(row?.page === WECHAT_MESSAGE_PAGE ? { page: WECHAT_MESSAGE_PAGE } : {}),
    outcome: row?.outcome === 'accepted' || row?.outcome === 'rejected' ? row.outcome : 'unknown',
    category:
      typeof row?.category === 'string' && allowedCategories.includes(row.category)
        ? row.category
        : 'transport-unknown',
    ...(row?.phase === 'reserved' ||
    row?.phase === 'preflight' ||
    row?.phase === 'access-token' ||
    row?.phase === 'send'
      ? { phase: row.phase }
      : {}),
    ...(typeof row?.code === 'number' &&
    Number.isInteger(row.code) &&
    Math.abs(row.code) < 1_000_000
      ? { code: row.code }
      : {}),
  };
}
function safeStoredDeliveryError(value: string | null): string | null {
  if (value === null) return null;
  if (value === 'Duty reminder template data invalid.') return 'template-data-invalid';
  const code = /WeChat API error (\d{1,6}):/u.exec(value)?.[1];
  return code
    ? safeWechatDiagnosticError(new WechatGatewayError(Number(code), null, 'SERVICE_UNAVAILABLE'))
        .category
    : 'unclassified-server-error';
}
