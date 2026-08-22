import { createHash, randomUUID } from 'node:crypto';

import type {
  PlatformAdminWechatMiniProgramUnbindRequest,
  WechatMiniProgramUnbindRequest,
  WechatMiniProgramUnbindResponse,
} from '@schedule/contracts';
import {
  type DatabaseClient,
  type DatabaseTransaction,
  userAuthIdentities,
  userPasswordCredentials,
  users,
  wechatIdentityDetachments,
  wechatUnionAccounts,
  withTransaction,
} from '@schedule/database';
import { and, eq, isNull, sql } from 'drizzle-orm';

import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import { isDuplicateKeyError } from '../../database-error.js';
import { ApiError } from '../../plugins/error-handler.js';
import { withIdempotentOperation } from '../../plugins/idempotency.js';
import { AuditWriter } from '../audit/audit-writer.js';
import { requirePlatformAdmin } from '../platform-admin/platform-admin.js';
import {
  WechatGatewayError,
  type WechatExchangeCodeResult,
  type WechatGateway,
} from './wechat-gateway.js';
import { toWechatGatewayApiError } from './wechat-errors.js';
import { hashWechatIdentitySubject } from './wechat-identity-hash.js';

interface WechatIdentityUnbindServiceOptions {
  readonly allowedPlatformAdminUids: ReadonlySet<string>;
  readonly databaseClient: DatabaseClient;
  readonly gateway: WechatGateway;
}

interface LockedPasswordUser {
  readonly id: string;
  readonly passwordHash: string | null;
  readonly status: string;
  readonly wechatOpenid: string | null;
}

interface MiniIdentityRow {
  readonly id: string;
  readonly subject: string;
  readonly unionId: string | null;
  readonly userId: string;
}

export class WechatIdentityUnbindService {
  private readonly allowedPlatformAdminUids: ReadonlySet<string>;
  private readonly auditWriter = new AuditWriter();
  private readonly databaseClient: DatabaseClient;
  private readonly gateway: WechatGateway;

  public constructor(options: WechatIdentityUnbindServiceOptions) {
    this.allowedPlatformAdminUids = options.allowedPlatformAdminUids;
    this.databaseClient = options.databaseClient;
    this.gateway = options.gateway;
  }

  public async unbindSelf(
    identity: AuthenticatedIdentity,
    input: WechatMiniProgramUnbindRequest,
    operationId: string,
    requestId?: string,
  ): Promise<WechatMiniProgramUnbindResponse> {
    const appId = this.getAppId();
    const actor = await this.findActor(identity);
    return withTransaction(this.databaseClient, async (transaction) =>
      withIdempotentOperation(
        transaction,
        {
          actorUserId: actor,
          operationId,
          requestFingerprint: fingerprint('self', actor, appId, input.code),
          scope: 'wechat_miniprogram_unbind',
        },
        async () => {
          const exchanged = await this.exchangeCode(input.code);
          const detachment = await this.findDetachmentBySubject(
            transaction,
            appId,
            exchanged.openid,
          );
          const miniIdentity = await this.findMiniIdentityBySubject(
            transaction,
            appId,
            exchanged.openid,
          );
          if (miniIdentity !== undefined && miniIdentity.userId !== actor) {
            throw identityConflictError();
          }

          const user = await this.lockPasswordUser(transaction, actor, true);
          await this.assertUnionMatchesUser(transaction, actor, exchanged.unionid);
          if (miniIdentity === undefined) {
            if (detachment?.userId === actor) return { unbound: true };
            throw identityNotFoundError();
          }

          await this.detachIdentity(transaction, {
            appId,
            auditAction: 'wechat_miniprogram_unbound',
            actorUserId: actor,
            identity: miniIdentity,
            operationId,
            reason: undefined,
            requestId,
            user,
          });
          return { unbound: true };
        },
      ),
    );
  }

  public async unbindAsPlatformAdmin(
    identity: AuthenticatedIdentity,
    targetUserId: string,
    input: PlatformAdminWechatMiniProgramUnbindRequest,
    operationId: string,
    requestId?: string,
  ): Promise<WechatMiniProgramUnbindResponse> {
    const appId = this.getAppId();
    return withTransaction(this.databaseClient, async (transaction) => {
      const actorUserId = await requirePlatformAdmin(
        transaction,
        identity,
        this.allowedPlatformAdminUids,
      );
      return withIdempotentOperation(
        transaction,
        {
          actorUserId,
          operationId,
          requestFingerprint: fingerprint('admin', targetUserId, appId, input.reason),
          scope: 'wechat_miniprogram_admin_unbind',
        },
        async () => {
          const detachment = await this.findDetachmentByUser(transaction, appId, targetUserId);
          const identities = await this.findMiniIdentitiesByUser(transaction, appId, targetUserId);
          const user = await this.lockPasswordUser(transaction, targetUserId, false);
          if (identities.length === 0) {
            if (detachment !== undefined) return { unbound: true };
            throw identityNotFoundError();
          }
          if (identities.length !== 1) throw identityConflictError();
          const [miniIdentity] = identities;
          if (miniIdentity === undefined) throw identityNotFoundError();

          await this.detachIdentity(transaction, {
            appId,
            auditAction: 'wechat_miniprogram_admin_unbound',
            actorUserId,
            identity: miniIdentity,
            operationId,
            reason: input.reason,
            requestId,
            user,
          });
          return { unbound: true };
        },
      );
    });
  }

  private async detachIdentity(
    transaction: DatabaseTransaction,
    input: {
      readonly appId: string;
      readonly actorUserId: string;
      readonly auditAction: 'wechat_miniprogram_admin_unbound' | 'wechat_miniprogram_unbound';
      readonly identity: MiniIdentityRow;
      readonly operationId: string;
      readonly reason: string | undefined;
      readonly requestId: string | undefined;
      readonly user: LockedPasswordUser;
    },
  ): Promise<void> {
    const subjectHash = hashWechatIdentitySubject(input.identity.subject);
    const [existingByScope] = await transaction
      .select({ id: wechatIdentityDetachments.id, userId: wechatIdentityDetachments.userId })
      .from(wechatIdentityDetachments)
      .where(
        and(
          eq(wechatIdentityDetachments.provider, 'wechat_mini_program'),
          eq(wechatIdentityDetachments.appId, input.appId),
          eq(wechatIdentityDetachments.subjectHash, subjectHash),
        ),
      )
      .limit(1)
      .for('update');
    const [existingByUser] = await transaction
      .select({
        id: wechatIdentityDetachments.id,
        subjectHash: wechatIdentityDetachments.subjectHash,
      })
      .from(wechatIdentityDetachments)
      .where(
        and(
          eq(wechatIdentityDetachments.provider, 'wechat_mini_program'),
          eq(wechatIdentityDetachments.appId, input.appId),
          eq(wechatIdentityDetachments.userId, input.user.id),
        ),
      )
      .limit(1)
      .for('update');
    if (
      (existingByScope !== undefined && existingByScope.userId !== input.user.id) ||
      (existingByUser !== undefined && existingByUser.subjectHash !== subjectHash)
    ) {
      throw identityConflictError();
    }
    if (existingByScope === undefined) {
      try {
        await transaction.insert(wechatIdentityDetachments).values({
          appId: input.appId,
          id: randomUUID(),
          provider: 'wechat_mini_program',
          subjectHash,
          userId: input.user.id,
        });
      } catch (error) {
        if (isDuplicateKeyError(error)) throw identityConflictError();
        throw error;
      }
    }

    if (input.user.wechatOpenid !== null && input.user.wechatOpenid !== input.identity.subject) {
      throw identityConflictError();
    }

    await transaction
      .delete(userAuthIdentities)
      .where(eq(userAuthIdentities.id, input.identity.id));
    await transaction
      .update(users)
      .set({
        authVersion: sql`${users.authVersion} + 1`,
        version: sql`${users.version} + 1`,
        wechatOpenid:
          input.user.wechatOpenid === input.identity.subject ? null : input.user.wechatOpenid,
      })
      .where(eq(users.id, input.user.id));
    await this.auditWriter.append(transaction, {
      action: input.auditAction,
      actorUserId: input.actorUserId,
      metadata:
        input.reason === undefined
          ? { initiatedBy: 'self' }
          : { initiatedBy: 'platform_admin', reason: input.reason },
      operationId: input.operationId,
      outcome: 'completed',
      ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
      targetId: input.user.id,
      targetType: 'user',
    });
  }

  private async assertUnionMatchesUser(
    transaction: DatabaseTransaction,
    userId: string,
    unionId: string | undefined,
  ): Promise<void> {
    if (unionId === undefined) return;
    const [byUnion] = await transaction
      .select({ userId: wechatUnionAccounts.userId })
      .from(wechatUnionAccounts)
      .where(eq(wechatUnionAccounts.unionId, unionId))
      .limit(1)
      .for('update');
    if (byUnion !== undefined && byUnion.userId !== userId) throw identityConflictError();
    const [byUser] = await transaction
      .select({ unionId: wechatUnionAccounts.unionId })
      .from(wechatUnionAccounts)
      .where(eq(wechatUnionAccounts.userId, userId))
      .limit(1)
      .for('update');
    if (byUser !== undefined && byUser.unionId !== unionId) throw identityConflictError();
  }

  private async exchangeCode(code: string): Promise<WechatExchangeCodeResult> {
    try {
      return await this.gateway.exchangeCode(code);
    } catch (error) {
      if (error instanceof WechatGatewayError) throw toWechatGatewayApiError(error);
      throw error;
    }
  }

  private async findActor(identity: AuthenticatedIdentity): Promise<string> {
    const [user] = await this.databaseClient.database
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.cloudbaseUid, identity.cloudbaseUid),
          eq(users.status, 'active'),
          isNull(users.deletedAt),
        ),
      )
      .limit(1);
    if (user === undefined)
      throw new ApiError({
        code: 'AUTHENTICATION_REQUIRED',
        statusCode: 401,
        userMessage: '需要先登录后才能继续。',
      });
    return user.id;
  }

  private async findDetachmentBySubject(
    transaction: DatabaseTransaction,
    appId: string,
    subject: string,
  ) {
    const [detachment] = await transaction
      .select({ userId: wechatIdentityDetachments.userId })
      .from(wechatIdentityDetachments)
      .where(
        and(
          eq(wechatIdentityDetachments.provider, 'wechat_mini_program'),
          eq(wechatIdentityDetachments.appId, appId),
          eq(wechatIdentityDetachments.subjectHash, hashWechatIdentitySubject(subject)),
        ),
      )
      .limit(1)
      .for('update');
    return detachment;
  }

  private async findDetachmentByUser(
    transaction: DatabaseTransaction,
    appId: string,
    userId: string,
  ) {
    const [detachment] = await transaction
      .select({ userId: wechatIdentityDetachments.userId })
      .from(wechatIdentityDetachments)
      .where(
        and(
          eq(wechatIdentityDetachments.provider, 'wechat_mini_program'),
          eq(wechatIdentityDetachments.appId, appId),
          eq(wechatIdentityDetachments.userId, userId),
        ),
      )
      .limit(1)
      .for('update');
    return detachment;
  }

  private async findMiniIdentitiesByUser(
    transaction: DatabaseTransaction,
    appId: string,
    userId: string,
  ): Promise<MiniIdentityRow[]> {
    return transaction
      .select({
        id: userAuthIdentities.id,
        subject: userAuthIdentities.subject,
        unionId: userAuthIdentities.unionId,
        userId: userAuthIdentities.userId,
      })
      .from(userAuthIdentities)
      .where(
        and(
          eq(userAuthIdentities.provider, 'wechat_mini_program'),
          eq(userAuthIdentities.appId, appId),
          eq(userAuthIdentities.userId, userId),
        ),
      )
      .limit(2)
      .for('update');
  }

  private async findMiniIdentityBySubject(
    transaction: DatabaseTransaction,
    appId: string,
    subject: string,
  ): Promise<MiniIdentityRow | undefined> {
    const [identity] = await transaction
      .select({
        id: userAuthIdentities.id,
        subject: userAuthIdentities.subject,
        unionId: userAuthIdentities.unionId,
        userId: userAuthIdentities.userId,
      })
      .from(userAuthIdentities)
      .where(
        and(
          eq(userAuthIdentities.provider, 'wechat_mini_program'),
          eq(userAuthIdentities.appId, appId),
          eq(userAuthIdentities.subject, subject),
        ),
      )
      .limit(1)
      .for('update');
    return identity;
  }

  private async lockPasswordUser(
    transaction: DatabaseTransaction,
    userId: string,
    requireActive: boolean,
  ): Promise<LockedPasswordUser> {
    const [user] = await transaction
      .select({
        id: users.id,
        passwordHash: userPasswordCredentials.passwordHash,
        status: users.status,
        wechatOpenid: users.wechatOpenid,
      })
      .from(users)
      .innerJoin(userPasswordCredentials, eq(userPasswordCredentials.userId, users.id))
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .limit(1)
      .for('update');
    if (
      user === undefined ||
      user.passwordHash === null ||
      (requireActive && user.status !== 'active') ||
      (!requireActive && !['active', 'suspended'].includes(user.status))
    ) {
      throw passwordUnbindUnavailableError();
    }
    return user;
  }

  private getAppId(): string {
    const appId = this.gateway.appId;
    if (appId === undefined || appId.length === 0) {
      throw new ApiError({
        code: 'SERVICE_UNAVAILABLE',
        statusCode: 503,
        userMessage: '微信登录暂未配置，请稍后重试。',
      });
    }
    return appId;
  }
}

function fingerprint(kind: string, userId: string, appId: string, value: string): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        appId,
        kind,
        userId,
        value: createHash('sha256').update(value).digest('hex'),
      }),
    )
    .digest('hex');
}

function identityConflictError(): ApiError {
  return new ApiError({
    code: 'CONFLICT',
    statusCode: 409,
    userMessage: '微信身份状态冲突，请联系管理员处理。',
  });
}

function identityNotFoundError(): ApiError {
  return new ApiError({
    code: 'NOT_FOUND',
    statusCode: 404,
    userMessage: '当前小程序身份不存在或已解除。',
  });
}

function passwordUnbindUnavailableError(): ApiError {
  return new ApiError({
    code: 'FORBIDDEN',
    statusCode: 403,
    userMessage: '解除小程序身份前必须先设置可用的 Web 密码。',
  });
}
