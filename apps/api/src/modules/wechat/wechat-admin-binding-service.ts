import { createHash, randomBytes, randomUUID } from 'node:crypto';

import type {
  CreateWechatAdminBindingLinkResponse,
  WechatAdminBindingConfirmRequest,
  WechatAdminBindingConfirmResponse,
  WechatAdminBindingPreviewResponse,
} from '@schedule/contracts';
import {
  type DatabaseClient,
  type DatabaseTransaction,
  userPasswordCredentials,
  userProfiles,
  users,
  wechatAdminBindingTickets,
  withTransaction,
} from '@schedule/database';
import { and, eq, isNull } from 'drizzle-orm';

import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import { ApiError } from '../../plugins/error-handler.js';
import { AuditWriter } from '../audit/audit-writer.js';
import { requirePlatformAdmin } from '../platform-admin/platform-admin.js';
import { WechatGatewayError, type WechatGateway } from './wechat-gateway.js';
import { toWechatGatewayApiError } from './wechat-errors.js';
import { WechatIdentityResolver } from './wechat-identity-resolver.js';
import {
  createWechatSessionToken,
  WECHAT_SESSION_TTL_SECONDS,
} from '../../adapters/auth/wechat-auth.js';

const ADMIN_BINDING_TTL_MS = 10 * 60 * 1000;

export class WechatAdminBindingService {
  private readonly allowedPlatformAdminUids: ReadonlySet<string>;
  private readonly auditWriter = new AuditWriter();
  private readonly databaseClient: DatabaseClient;
  private readonly gateway: WechatGateway;
  private readonly identityResolver: WechatIdentityResolver;
  private readonly sessionSecret: string | undefined;

  public constructor(options: {
    readonly allowedPlatformAdminUids: ReadonlySet<string>;
    readonly databaseClient: DatabaseClient;
    readonly gateway: WechatGateway;
    readonly sessionSecret: string | undefined;
  }) {
    this.allowedPlatformAdminUids = options.allowedPlatformAdminUids;
    this.databaseClient = options.databaseClient;
    this.gateway = options.gateway;
    this.identityResolver = new WechatIdentityResolver(options.databaseClient);
    this.sessionSecret = options.sessionSecret;
  }

  public async createLink(
    identity: AuthenticatedIdentity,
    targetUserId: string,
    requestId?: string,
  ): Promise<CreateWechatAdminBindingLinkResponse> {
    const appId = this.getAppId();
    const generateUrlLink = this.gateway.generateUrlLink?.bind(this.gateway);
    if (generateUrlLink === undefined) throw serviceUnavailableError();
    return withTransaction(this.databaseClient, async (transaction) => {
      const actorUserId = await requirePlatformAdmin(
        transaction,
        identity,
        this.allowedPlatformAdminUids,
      );
      const target = await this.getTarget(transaction, targetUserId);
      const ticket = randomBytes(32).toString('base64url');
      const expiresAt = new Date(Date.now() + ADMIN_BINDING_TTL_MS);
      await transaction.insert(wechatAdminBindingTickets).values({
        appId,
        expiresAt,
        id: randomUUID(),
        status: 'pending',
        targetUserId,
        ticketHash: hashTicket(ticket),
      });
      const urlLink = await generateUrlLink(
        'pages/admin-bind/preview',
        `ticket=${encodeURIComponent(ticket)}`,
        'release',
      );
      await this.auditWriter.append(transaction, {
        action: 'wechat_admin_binding_ticket_created',
        actorUserId,
        metadata: { expiresAt: expiresAt.toISOString() },
        operationId: randomUUID(),
        outcome: 'completed',
        ...(requestId === undefined ? {} : { requestId }),
        targetId: target.userId,
        targetType: 'user',
      });
      return { expiresAt: expiresAt.toISOString(), urlLink };
    });
  }

  public async preview(ticket: string): Promise<WechatAdminBindingPreviewResponse> {
    const appId = this.getAppId();
    const [row] = await this.databaseClient.database
      .select({
        expiresAt: wechatAdminBindingTickets.expiresAt,
        realName: userProfiles.realName,
        status: wechatAdminBindingTickets.status,
        username: userPasswordCredentials.username,
      })
      .from(wechatAdminBindingTickets)
      .innerJoin(users, eq(users.id, wechatAdminBindingTickets.targetUserId))
      .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
      .innerJoin(userPasswordCredentials, eq(userPasswordCredentials.userId, users.id))
      .where(
        and(
          eq(wechatAdminBindingTickets.appId, appId),
          eq(wechatAdminBindingTickets.ticketHash, hashTicket(ticket)),
          isNull(users.deletedAt),
          isNull(userProfiles.deletedAt),
        ),
      )
      .limit(1);
    this.assertTicket(row);
    if (row.status !== 'pending') throw usedTicketError();
    if (row.expiresAt.valueOf() <= Date.now()) throw expiredTicketError();
    return {
      expiresAt: row.expiresAt.toISOString(),
      realNameMasked: maskRealName(row.realName),
      usernameMasked: maskUsername(row.username),
    };
  }

  public async confirm(
    input: WechatAdminBindingConfirmRequest,
    requestId?: string,
  ): Promise<WechatAdminBindingConfirmResponse> {
    const appId = this.getAppId();
    return withTransaction(this.databaseClient, async (transaction) => {
      const [ticket] = await transaction
        .select({
          expiresAt: wechatAdminBindingTickets.expiresAt,
          id: wechatAdminBindingTickets.id,
          status: wechatAdminBindingTickets.status,
          targetUserId: wechatAdminBindingTickets.targetUserId,
        })
        .from(wechatAdminBindingTickets)
        .where(
          and(
            eq(wechatAdminBindingTickets.appId, appId),
            eq(wechatAdminBindingTickets.ticketHash, hashTicket(input.ticket)),
          ),
        )
        .limit(1)
        .for('update');
      this.assertTicket(ticket);
      if (ticket.status !== 'pending') throw usedTicketError();
      if (ticket.expiresAt.valueOf() <= Date.now()) throw expiredTicketError();
      if (this.gateway === undefined) throw serviceUnavailableError();
      const target = await this.getTarget(transaction, ticket.targetUserId);
      let exchanged;
      try {
        exchanged = await this.gateway.exchangeCode(input.code);
      } catch (error) {
        if (error instanceof WechatGatewayError) throw toWechatGatewayApiError(error);
        throw error;
      }
      const resolved = await this.identityResolver.resolveInTransaction(transaction, {
        allowDetachedIdentity: true,
        appId,
        createUser: async () => ({ authVersion: target.authVersion, userId: target.userId }),
        onResolved: async (currentTransaction, userId) => {
          if (userId !== target.userId) throw identityConflictError();
          await currentTransaction
            .update(users)
            .set({ wechatOpenid: exchanged.openid })
            .where(and(eq(users.id, userId), isNull(users.wechatOpenid)));
        },
        provider: 'wechat_mini_program',
        subject: exchanged.openid,
        unionId: exchanged.unionid,
      });
      if (resolved === undefined || resolved.userId !== target.userId) {
        throw identityConflictError();
      }
      const profile = {
        id: target.userId,
        realName: target.realName,
        version: target.profileVersion,
      };
      const response: WechatAdminBindingConfirmResponse = {
        expiresAt: new Date(Date.now() + WECHAT_SESSION_TTL_SECONDS * 1000).toISOString(),
        profile,
        status: 'authenticated',
        token: createWechatSessionToken(
          {
            appId,
            authVersion: target.authVersion,
            openid: exchanged.openid,
            provider: 'wechat_mini_program',
            sub: target.userId,
          },
          this.sessionSecret,
        ),
      };
      await transaction
        .update(wechatAdminBindingTickets)
        .set({ consumedAt: new Date(), status: 'consumed' })
        .where(eq(wechatAdminBindingTickets.id, ticket.id));
      await this.auditWriter.append(transaction, {
        action: 'wechat_admin_binding_confirmed',
        actorUserId: target.userId,
        metadata: { initiatedBy: 'platform_admin' },
        operationId: randomUUID(),
        outcome: 'completed',
        ...(requestId === undefined ? {} : { requestId }),
        targetId: target.userId,
        targetType: 'user',
      });
      return response;
    });
  }

  private async getTarget(transaction: DatabaseTransaction, userId: string) {
    const [target] = await transaction
      .select({
        authVersion: users.authVersion,
        passwordHash: userPasswordCredentials.passwordHash,
        profileVersion: userProfiles.version,
        realName: userProfiles.realName,
        status: users.status,
        userId: users.id,
        username: userPasswordCredentials.username,
      })
      .from(users)
      .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
      .innerJoin(userPasswordCredentials, eq(userPasswordCredentials.userId, users.id))
      .where(and(eq(users.id, userId), isNull(users.deletedAt), isNull(userProfiles.deletedAt)))
      .limit(1)
      .for('update');
    if (
      target === undefined ||
      target.status !== 'active' ||
      target.passwordHash === null ||
      target.username.length === 0
    ) {
      throw targetUnavailableError();
    }
    return target;
  }

  private getAppId(): string {
    if (this.gateway.appId === undefined || this.gateway.appId.length === 0) {
      throw serviceUnavailableError();
    }
    return this.gateway.appId;
  }

  private assertTicket<T extends { readonly expiresAt: Date; readonly status: string }>(
    row: T | undefined,
  ): asserts row is T {
    if (row === undefined) throw invalidTicketError();
  }
}

function hashTicket(ticket: string): string {
  return createHash('sha256').update(ticket).digest('hex');
}

function maskRealName(value: string): string {
  return value.length <= 1 ? `${value}*` : `${value.slice(0, 1)}*`;
}

function maskUsername(value: string): string {
  return value.length <= 2 ? `${value.slice(0, 1)}***` : `${value.slice(0, 2)}***`;
}

function invalidTicketError(): ApiError {
  return new ApiError({
    code: 'WECHAT_LINK_TOKEN_INVALID',
    statusCode: 401,
    userMessage: '管理员绑定链接无效，请重新获取。',
  });
}
function usedTicketError(): ApiError {
  return new ApiError({
    code: 'WECHAT_LINK_TOKEN_USED',
    statusCode: 409,
    userMessage: '管理员绑定链接已使用，请重新获取。',
  });
}
function expiredTicketError(): ApiError {
  return new ApiError({
    code: 'WECHAT_LINK_TOKEN_EXPIRED',
    statusCode: 410,
    userMessage: '管理员绑定链接已过期，请重新获取。',
  });
}
function identityConflictError(): ApiError {
  return new ApiError({
    code: 'CONFLICT',
    statusCode: 409,
    userMessage: '微信身份状态冲突，请联系管理员处理。',
  });
}
function serviceUnavailableError(): ApiError {
  return new ApiError({
    code: 'SERVICE_UNAVAILABLE',
    statusCode: 503,
    userMessage: '微信服务暂时不可用，请稍后重试。',
  });
}
function targetUnavailableError(): ApiError {
  return new ApiError({
    code: 'FORBIDDEN',
    statusCode: 403,
    userMessage: '目标账号当前不具备管理员绑定条件。',
  });
}
