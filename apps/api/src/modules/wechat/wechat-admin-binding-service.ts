import { createHash, createHmac, randomUUID } from 'node:crypto';

import {
  createMemberWechatBindingQrResponseSchema,
  createWechatAdminBindingLinkResponseSchema,
} from '@schedule/contracts';
import type {
  ClientVersion,
  CreateCurrentMemberWechatBindingQrRequest,
  CreateCurrentMemberWechatBindingQrResponse,
  CreateMemberWechatBindingQrRequest,
  CreateMemberWechatBindingQrResponse,
  CreateWechatAdminBindingLinkRequest,
  CreateWechatAdminBindingLinkResponse,
  WechatAdminBindingConfirmRequest,
  WechatAdminBindingConfirmResponse,
  WechatAdminBindingPreviewResponse,
} from '@schedule/contracts';
import {
  type DatabaseClient,
  type DatabaseTransaction,
  groupMemberships,
  groups,
  userAuthIdentities,
  userPasswordCredentials,
  userProfiles,
  users,
  wechatAdminBindingTickets,
} from '@schedule/database';
import { and, eq, isNull } from 'drizzle-orm';

import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import { ApiError } from '../../plugins/error-handler.js';
import { AuditWriter } from '../audit/audit-writer.js';
import { readMemberEmployeeCodes } from '../groups/group-member-directory-codes.js';
import {
  createOrganizationFingerprint,
  runOrganizationMutation,
} from '../groups/organization-operation.js';
import { GroupPermissionService } from '../groups/permission-service.js';
import { toUserProfile } from '../users/user-profile.js';
import {
  assertExpectedAuthVersion,
  createPlatformAdminFingerprint,
  runPlatformAdminMutation,
} from '../platform-admin/platform-admin-operation.js';
import { WechatGatewayError, type WechatGateway } from './wechat-gateway.js';
import { toWechatGatewayApiError } from './wechat-errors.js';
import {
  lockWechatBindingScope,
  withWechatBindingTransaction,
} from './wechat-binding-transaction.js';
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
  private readonly permissionService = new GroupPermissionService();
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
    input: CreateWechatAdminBindingLinkRequest,
    requestId?: string,
  ): Promise<CreateWechatAdminBindingLinkResponse> {
    const appId = this.getAppId();
    const generateUrlLink = this.gateway.generateUrlLink?.bind(this.gateway);
    if (generateUrlLink === undefined) throw serviceUnavailableError();
    return runPlatformAdminMutation({
      allowedCloudbaseUids: this.allowedPlatformAdminUids,
      databaseClient: this.databaseClient,
      identity,
      operationId: input.operationId,
      requestFingerprint: createPlatformAdminFingerprint({
        appId,
        expectedAuthVersion: input.expectedAuthVersion,
        targetUserId,
      }),
      resultCodec: {
        deserialize: async (stored, actorUserId, transaction) => {
          const safeResult = deserializeStoredBindingLinkResult(stored);
          if (safeResult.authVersion !== input.expectedAuthVersion) {
            throw invalidStoredOperationResult();
          }
          if (Date.parse(safeResult.expiresAt) <= Date.now()) throw expiredTicketError();
          await this.getTarget(transaction, targetUserId, safeResult.authVersion);
          const ticket = this.deriveBindingTicket(
            actorUserId,
            targetUserId,
            input.operationId,
            safeResult.authVersion,
          );
          const urlLink = await generateUrlLink(
            'pages/admin-bind/preview',
            `ticket=${encodeURIComponent(ticket)}`,
            'release',
          );
          return { ...safeResult, urlLink };
        },
        serialize: serializeBindingLinkResult,
      },
      run: async (transaction, actorUserId) => {
        const target = await this.getTarget(transaction, targetUserId, input.expectedAuthVersion);
        await this.assertUserUnbound(transaction, target.userId);
        const ticket = this.deriveBindingTicket(
          actorUserId,
          targetUserId,
          input.operationId,
          target.authVersion,
        );
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
          operationId: input.operationId,
          outcome: 'completed',
          ...(requestId === undefined ? {} : { requestId }),
          targetId: target.userId,
          targetType: 'user',
        });
        return {
          authVersion: target.authVersion,
          expiresAt: expiresAt.toISOString(),
          urlLink,
        };
      },
      scope: 'platform_wechat_binding_link_create',
    });
  }

  public async createMemberQr(
    identity: AuthenticatedIdentity,
    groupId: string,
    membershipId: string,
    input: CreateMemberWechatBindingQrRequest,
    requestId?: string,
  ): Promise<CreateMemberWechatBindingQrResponse> {
    const appId = this.getAppId();
    return runOrganizationMutation({
      databaseClient: this.databaseClient,
      identity,
      operationId: input.operationId,
      requestFingerprint: createOrganizationFingerprint({
        expectedMembershipVersion: input.expectedMembershipVersion,
        groupId,
        membershipId,
      }),
      resultCodec: {
        deserialize: async (stored, actor) => {
          const safeResult = createMemberWechatBindingQrResponseSchema.parse({
            ...stored,
            imageBase64: 'replayed',
          });
          if (Date.parse(safeResult.expiresAt) <= Date.now()) throw expiredTicketError();
          const ticket = this.deriveMemberQrTicket(actor.id, membershipId, input.operationId);
          const [formalQr, trialQr] = await Promise.all([
            this.gateway.getUnlimitedQr(`b=${ticket}`, 'pages/admin-bind/preview', 'release'),
            this.gateway
              .getUnlimitedQr(`b=${ticket}`, 'pages/admin-bind/preview', 'trial')
              .catch(() => undefined),
          ]);
          return {
            ...safeResult,
            imageBase64: Buffer.from(formalQr).toString('base64'),
            ...(trialQr === undefined
              ? {}
              : { trialImageBase64: Buffer.from(trialQr).toString('base64') }),
          };
        },
        serialize: (result) => ({
          ...(result.employeeCode === undefined ? {} : { employeeCode: result.employeeCode }),
          expiresAt: result.expiresAt,
          groupCode: result.groupCode,
          groupName: result.groupName,
          membershipId: result.membershipId,
          realName: result.realName,
        }),
      },
      run: async (transaction, actor) => {
        const initiatedBy = actor.isDeveloperAdmin ? 'platform_admin' : 'group_admin';
        const authorization = await this.permissionService.requirePermission(
          transaction,
          identity,
          groupId,
          'manageMembers',
        );
        const [target] = await transaction
          .select({
            authVersion: users.authVersion,
            groupCode: groups.groupCode,
            groupName: groups.name,
            membershipId: groupMemberships.id,
            membershipVersion: groupMemberships.version,
            mobilePhone: users.mobilePhone,
            realName: userProfiles.realName,
            userId: users.id,
          })
          .from(groupMemberships)
          .innerJoin(groups, eq(groups.id, groupMemberships.groupId))
          .innerJoin(users, eq(users.id, groupMemberships.userId))
          .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
          .where(
            and(
              eq(groupMemberships.id, membershipId),
              eq(groupMemberships.groupId, authorization.group.id),
              eq(groupMemberships.status, 'active'),
              eq(users.status, 'active'),
              isNull(groupMemberships.deletedAt),
              isNull(groups.deletedAt),
              isNull(users.deletedAt),
              isNull(userProfiles.deletedAt),
            ),
          )
          .limit(1)
          .for('update');
        if (target === undefined || target.membershipVersion !== input.expectedMembershipVersion)
          throw targetUnavailableError();
        const [bound] = await transaction
          .select({ id: userAuthIdentities.id })
          .from(userAuthIdentities)
          .where(
            and(
              eq(userAuthIdentities.userId, target.userId),
              eq(userAuthIdentities.provider, 'wechat_mini_program'),
            ),
          )
          .limit(1)
          .for('update');
        if (bound !== undefined) throw alreadyBoundError();
        await transaction
          .update(wechatAdminBindingTickets)
          .set({ status: 'revoked' })
          .where(
            and(
              eq(wechatAdminBindingTickets.targetUserId, target.userId),
              eq(wechatAdminBindingTickets.status, 'pending'),
            ),
          );
        const ticket = this.deriveMemberQrTicket(actor.id, membershipId, input.operationId);
        const expiresAt = new Date(Date.now() + ADMIN_BINDING_TTL_MS);
        await transaction.insert(wechatAdminBindingTickets).values({
          appId,
          createdByUserId: actor.id,
          expiresAt,
          groupId: authorization.group.id,
          id: randomUUID(),
          initiatedBy,
          status: 'pending',
          targetAuthVersion: target.authVersion,
          targetMembershipId: target.membershipId,
          targetUserId: target.userId,
          ticketHash: hashTicket(ticket),
        });
        const [formalQr, trialQr] = await Promise.all([
          this.gateway.getUnlimitedQr(`b=${ticket}`, 'pages/admin-bind/preview', 'release'),
          this.gateway
            .getUnlimitedQr(`b=${ticket}`, 'pages/admin-bind/preview', 'trial')
            .catch(() => undefined),
        ]);
        const employeeCodes = await readMemberEmployeeCodes(
          transaction,
          [
            {
              membershipId: target.membershipId,
              mobilePhone: target.mobilePhone ?? undefined,
              realName: target.realName,
            },
          ],
          true,
        );
        const employeeCode = employeeCodes.get(target.membershipId)?.values().next().value;
        await this.auditWriter.append(transaction, {
          action: 'wechat_member_binding_qr_created',
          actorUserId: actor.id,
          groupId: authorization.group.id,
          metadata: { expiresAt: expiresAt.toISOString(), initiatedBy },
          operationId: input.operationId,
          outcome: 'completed',
          ...(requestId === undefined ? {} : { requestId }),
          targetId: target.userId,
          targetType: 'user',
        });
        return {
          ...(employeeCode === undefined ? {} : { employeeCode }),
          expiresAt: expiresAt.toISOString(),
          groupCode: target.groupCode ?? '未设置',
          groupName: target.groupName,
          imageBase64: Buffer.from(formalQr).toString('base64'),
          membershipId: target.membershipId,
          realName: target.realName,
          ...(trialQr === undefined
            ? {}
            : { trialImageBase64: Buffer.from(trialQr).toString('base64') }),
        };
      },
      scope: `member_wechat_binding_qr:${groupId}`,
    });
  }

  public async createCurrentMemberQr(
    identity: AuthenticatedIdentity,
    groupId: string,
    membershipId: string,
    input: CreateCurrentMemberWechatBindingQrRequest,
    requestId?: string,
  ): Promise<CreateCurrentMemberWechatBindingQrResponse> {
    const legacy = await this.createMemberQr(
      identity,
      groupId,
      membershipId,
      {
        expectedMembershipVersion: input.expectedMembershipVersion,
        operationId: input.operationId,
      },
      requestId,
    );
    const imageBase64 =
      input.environment === 'release' ? legacy.imageBase64 : legacy.trialImageBase64;
    if (imageBase64 === undefined)
      throw new ApiError({
        code: 'SERVICE_UNAVAILABLE',
        statusCode: 503,
        userMessage: '当前版本的绑定二维码暂不可用，请稍后重试。',
      });
    return {
      ...(legacy.employeeCode === undefined ? {} : { employeeCode: legacy.employeeCode }),
      environment: input.environment,
      expiresAt: legacy.expiresAt,
      groupName: legacy.groupName,
      imageBase64,
      membershipId: legacy.membershipId,
      realName: legacy.realName,
    };
  }

  public async preview(ticket: string): Promise<WechatAdminBindingPreviewResponse> {
    const appId = this.getAppId();
    const [row] = await this.databaseClient.database
      .select({
        authVersion: users.authVersion,
        expiresAt: wechatAdminBindingTickets.expiresAt,
        realName: userProfiles.realName,
        status: wechatAdminBindingTickets.status,
        targetUserId: wechatAdminBindingTickets.targetUserId,
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
    const expectedAuthVersion = readTicketAuthVersion(ticket);
    if (expectedAuthVersion !== undefined) {
      assertExpectedAuthVersion({
        actualAuthVersion: row.authVersion,
        expectedAuthVersion,
        userId: row.targetUserId,
      });
    }
    return {
      expiresAt: row.expiresAt.toISOString(),
      realNameMasked: maskRealName(row.realName),
      usernameMasked: maskUsername(row.username),
    };
  }

  public async confirm(
    input: WechatAdminBindingConfirmRequest,
    requestId?: string,
    clientVersion?: ClientVersion,
  ): Promise<WechatAdminBindingConfirmResponse> {
    const appId = this.getAppId();
    // Reject invalid/expired/used tickets before spending the one-use WeChat code;
    // the locked transaction below repeats all authoritative ticket checks.
    await this.preview(input.ticket);
    let exchanged;
    try {
      exchanged = await this.gateway.exchangeCode(input.code);
    } catch (error) {
      if (error instanceof WechatGatewayError) throw toWechatGatewayApiError(error);
      throw error;
    }
    return withWechatBindingTransaction(this.databaseClient, async (transaction) => {
      await lockWechatBindingScope(transaction, appId, exchanged.openid);
      const [ticket] = await transaction
        .select({
          expiresAt: wechatAdminBindingTickets.expiresAt,
          groupId: wechatAdminBindingTickets.groupId,
          id: wechatAdminBindingTickets.id,
          initiatedBy: wechatAdminBindingTickets.initiatedBy,
          status: wechatAdminBindingTickets.status,
          targetAuthVersion: wechatAdminBindingTickets.targetAuthVersion,
          targetMembershipId: wechatAdminBindingTickets.targetMembershipId,
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
      if (ticket.groupId !== null && ticket.targetMembershipId !== null) {
        const [membership] = await transaction
          .select({ id: groupMemberships.id })
          .from(groupMemberships)
          .where(
            and(
              eq(groupMemberships.id, ticket.targetMembershipId),
              eq(groupMemberships.groupId, ticket.groupId),
              eq(groupMemberships.userId, ticket.targetUserId),
              eq(groupMemberships.status, 'active'),
              isNull(groupMemberships.deletedAt),
            ),
          )
          .limit(1)
          .for('update');
        if (membership === undefined) throw targetUnavailableError();
      }
      const target = await this.getTarget(
        transaction,
        ticket.targetUserId,
        ticket.targetAuthVersion ?? readTicketAuthVersion(input.ticket),
      );
      const resolved = await this.identityResolver.resolveInTransaction(transaction, {
        appId,
        targetUserId: target.userId,
        provider: 'wechat_mini_program',
        subject: exchanged.openid,
        unionId: exchanged.unionid,
      });
      if (resolved === undefined || resolved.userId !== target.userId) {
        throw identityConflictError();
      }
      const profile = toUserProfile({
        id: target.userId,
        realName: target.realName,
        version: target.profileVersion,
      });
      const response: WechatAdminBindingConfirmResponse = {
        expiresAt: new Date(Date.now() + WECHAT_SESSION_TTL_SECONDS * 1000).toISOString(),
        profile,
        status: 'authenticated',
        token: createWechatSessionToken(
          {
            appId,
            authVersion: target.authVersion,
            ...(clientVersion === undefined ? {} : { clientVersion }),
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
        ...(ticket.groupId === null ? {} : { groupId: ticket.groupId }),
        metadata: { initiatedBy: ticket.initiatedBy },
        operationId: randomUUID(),
        outcome: 'completed',
        ...(requestId === undefined ? {} : { requestId }),
        targetId: target.userId,
        targetType: 'user',
      });
      return response;
    });
  }

  private async getTarget(
    transaction: DatabaseTransaction,
    userId: string,
    expectedAuthVersion?: number,
  ) {
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
      .leftJoin(userPasswordCredentials, eq(userPasswordCredentials.userId, users.id))
      .where(and(eq(users.id, userId), isNull(users.deletedAt), isNull(userProfiles.deletedAt)))
      .limit(1)
      .for('update');
    if (target === undefined) {
      throw targetUnavailableError();
    }
    if (expectedAuthVersion !== undefined) {
      assertExpectedAuthVersion({
        actualAuthVersion: target.authVersion,
        expectedAuthVersion,
        userId,
      });
    }
    if (
      target.status !== 'active' ||
      target.passwordHash === null ||
      target.username === null ||
      target.username.length === 0
    )
      throw targetUnavailableError();
    return target;
  }

  private async assertUserUnbound(transaction: DatabaseTransaction, userId: string): Promise<void> {
    const [bound] = await transaction
      .select({ id: userAuthIdentities.id })
      .from(userAuthIdentities)
      .where(
        and(
          eq(userAuthIdentities.userId, userId),
          eq(userAuthIdentities.provider, 'wechat_mini_program'),
        ),
      )
      .limit(1)
      .for('update');
    if (bound !== undefined) throw alreadyBoundError();
  }

  private deriveBindingTicket(
    actorUserId: string,
    targetUserId: string,
    operationId: string,
    authVersion: number,
  ): string {
    if (this.sessionSecret === undefined || this.sessionSecret.length < 32) {
      throw serviceUnavailableError();
    }
    const signature = createHmac('sha256', this.sessionSecret)
      .update(`schedule-admin-bind:v1:${actorUserId}:${targetUserId}:${operationId}:${authVersion}`)
      .digest('base64url');
    return `p8.${authVersion}.${signature}`;
  }

  private deriveMemberQrTicket(
    actorUserId: string,
    membershipId: string,
    operationId: string,
  ): string {
    if (this.sessionSecret === undefined || this.sessionSecret.length < 32)
      throw serviceUnavailableError();
    return createHmac('sha256', this.sessionSecret)
      .update(`schedule-member-bind:v1:${actorUserId}:${membershipId}:${operationId}`)
      .digest('base64url')
      .slice(0, 24);
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

function readTicketAuthVersion(ticket: string): number | undefined {
  const [prefix, rawVersion, signature, ...extra] = ticket.split('.');
  if (prefix !== 'p8') return undefined;
  const authVersion = Number(rawVersion);
  if (
    signature === undefined ||
    signature.length === 0 ||
    extra.length > 0 ||
    !Number.isInteger(authVersion) ||
    authVersion < 1
  ) {
    throw invalidTicketError();
  }
  return authVersion;
}

function serializeBindingLinkResult(
  result: CreateWechatAdminBindingLinkResponse,
): Record<string, unknown> {
  return { authVersion: result.authVersion, expiresAt: result.expiresAt };
}

function deserializeStoredBindingLinkResult(stored: Record<string, unknown>): {
  readonly authVersion: number;
  readonly expiresAt: string;
} {
  const parsed = createWechatAdminBindingLinkResponseSchema.safeParse({
    ...stored,
    urlLink: 'https://wxaurl.cn/idempotent-replay',
  });
  if (!parsed.success) throw invalidStoredOperationResult();
  return { authVersion: parsed.data.authVersion, expiresAt: parsed.data.expiresAt };
}

function invalidStoredOperationResult(): ApiError {
  return new ApiError({
    code: 'INTERNAL_ERROR',
    statusCode: 500,
    userMessage: '操作已完成，但绑定链接恢复失败，请重新生成。',
  });
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
function alreadyBoundError(): ApiError {
  return new ApiError({
    code: 'CONFLICT',
    statusCode: 409,
    userMessage: '该账号已绑定微信，无需生成绑定二维码。',
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
