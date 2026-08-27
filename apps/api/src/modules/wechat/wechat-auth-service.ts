import { randomUUID } from 'node:crypto';

import type {
  ClientVersion,
  UserProfile,
  WechatLinkPasswordRequest,
  WechatLinkPasswordResponse,
  WechatLoginResponse,
  WechatRegisterRequest,
  WechatRegisterResponse,
} from '@schedule/contracts';
import {
  groupMemberships,
  groups,
  type DatabaseClient,
  type DatabaseTransaction,
  userPasswordCredentials,
  userAuthIdentities,
  userProfileAvatars,
  userProfiles,
  users,
  wechatIdentityDetachments,
  wechatUnionAccounts,
} from '@schedule/database';
import { and, eq, isNull, sql } from 'drizzle-orm';

import {
  createWechatSessionToken,
  WECHAT_SESSION_TTL_SECONDS,
} from '../../adapters/auth/wechat-auth.js';
import { ApiError } from '../../plugins/error-handler.js';
import { AuditWriter } from '../audit/audit-writer.js';
import { normalizeUsername, verifyPassword } from '../auth/password-auth-service.js';
import { findUserAvatarVersion, toUserProfile } from '../users/user-profile.js';
import { WechatIdentityResolver } from './wechat-identity-resolver.js';
import { toWechatGatewayApiError } from './wechat-errors.js';
import {
  WechatGatewayError,
  type WechatExchangeCodeResult,
  type WechatGateway,
} from './wechat-gateway.js';
import { WechatLinkTokenService } from './wechat-link-token-service.js';

export interface WechatAuthServiceOptions {
  readonly databaseClient: DatabaseClient;
  readonly gateway: WechatGateway;
  readonly now?: (() => Date) | undefined;
  readonly sessionSecret: string | undefined;
}

export class WechatAuthService {
  private readonly auditWriter = new AuditWriter();
  private readonly databaseClient: DatabaseClient;
  private readonly gateway: WechatGateway;
  private readonly identityResolver: WechatIdentityResolver;
  private readonly linkTokenService: WechatLinkTokenService;
  private readonly now: () => Date;
  private readonly sessionSecret: string | undefined;

  public constructor(options: WechatAuthServiceOptions) {
    this.databaseClient = options.databaseClient;
    this.gateway = options.gateway;
    this.identityResolver = new WechatIdentityResolver(options.databaseClient);
    this.now = options.now ?? (() => new Date());
    this.linkTokenService = new WechatLinkTokenService({
      databaseClient: options.databaseClient,
      now: this.now,
    });
    this.sessionSecret = options.sessionSecret;
  }

  public async login(code: string, clientVersion?: ClientVersion): Promise<WechatLoginResponse> {
    let exchanged: WechatExchangeCodeResult;
    try {
      exchanged = await this.gateway.exchangeCode(code);
    } catch (error) {
      if (error instanceof WechatGatewayError) {
        throw toWechatGatewayApiError(error);
      }
      throw error;
    }

    const appId = this.getAppId();
    const resolved = await this.identityResolver.resolve({
      appId,
      onResolved: async (transaction, userId) => {
        await transaction
          .update(users)
          .set({ wechatOpenid: exchanged.openid })
          .where(and(eq(users.id, userId), isNull(users.wechatOpenid)));
      },
      provider: 'wechat_mini_program',
      subject: exchanged.openid,
      unionId: exchanged.unionid,
    });
    if (resolved === undefined) {
      return {
        ...(await this.linkTokenService.issue({
          appId,
          existingUserId: undefined,
          subject: exchanged.openid,
          unionId: exchanged.unionid,
        })),
        status: 'link_required',
      };
    }
    const profile = await this.findProfile(resolved.userId);
    if (profile === undefined) {
      return {
        ...(await this.linkTokenService.issue({
          appId,
          existingUserId: resolved.userId,
          subject: exchanged.openid,
          unionId: exchanged.unionid,
        })),
        status: 'link_required',
      };
    }
    return {
      expiresAt: new Date(this.now().valueOf() + WECHAT_SESSION_TTL_SECONDS * 1000).toISOString(),
      profile,
      status: 'authenticated',
      token: this.issueSessionForUser(
        resolved.userId,
        exchanged.openid,
        resolved.authVersion,
        clientVersion,
      ),
    };
  }

  public async linkPassword(
    input: WechatLinkPasswordRequest,
    requestId?: string,
    clientVersion?: ClientVersion,
  ): Promise<WechatLinkPasswordResponse> {
    return this.linkTokenService.consume(input.linkToken, async (transaction, identity) => {
      this.assertCurrentAppId(identity.appId);
      const account = await this.findPasswordAccount(transaction, input.username, input.password);
      if (identity.existingUserId !== undefined && identity.existingUserId !== account.userId) {
        await this.rehomeLegacyWechatIdentity(
          transaction,
          identity.existingUserId,
          account,
          identity.subject,
          requestId,
        );
      }

      const resolved = await this.identityResolver.resolveInTransaction(transaction, {
        allowDetachedIdentity: true,
        appId: identity.appId,
        createUser: async () => ({
          authVersion: account.authVersion,
          userId: account.userId,
        }),
        onResolved: async (currentTransaction, userId) => {
          if (userId !== account.userId) throw identityConflictError();
          await this.rememberLegacyOpenid(currentTransaction, userId, identity.subject);
        },
        provider: 'wechat_mini_program',
        subject: identity.subject,
        unionId: identity.unionId,
      });
      if (resolved === undefined || resolved.userId !== account.userId) {
        throw identityConflictError();
      }

      await this.auditWriter.append(transaction, {
        action: 'wechat_miniprogram_password_linked',
        actorUserId: account.userId,
        metadata: { proof: 'password' },
        operationId: randomUUID(),
        outcome: 'completed',
        ...(requestId === undefined ? {} : { requestId }),
        targetId: account.userId,
        targetType: 'user',
      });
      return this.createAuthenticatedResponse(
        account.userId,
        identity.subject,
        account.authVersion,
        account.profile,
        clientVersion,
      );
    });
  }

  public async register(
    input: WechatRegisterRequest,
    requestId?: string,
    clientVersion?: ClientVersion,
  ): Promise<WechatRegisterResponse> {
    return this.linkTokenService.consume(input.linkToken, async (transaction, identity) => {
      this.assertCurrentAppId(identity.appId);
      const existingUser =
        identity.existingUserId === undefined
          ? undefined
          : await this.getActiveUser(transaction, identity.existingUserId);
      const resolved = await this.identityResolver.resolveInTransaction(transaction, {
        allowDetachedIdentity: true,
        appId: identity.appId,
        createUser: (currentTransaction) =>
          existingUser === undefined
            ? this.createMiniUser(currentTransaction, identity.subject)
            : Promise.resolve(existingUser),
        onResolved: async (currentTransaction, userId) => {
          if (existingUser !== undefined && userId !== existingUser.userId) {
            throw identityConflictError();
          }
          await this.rememberLegacyOpenid(currentTransaction, userId, identity.subject);
          await this.insertProfile(currentTransaction, userId, input.realName);
        },
        provider: 'wechat_mini_program',
        subject: identity.subject,
        unionId: identity.unionId,
      });
      if (resolved === undefined) throw identityConflictError();

      const profile = { id: resolved.userId, realName: input.realName, version: 1 };
      await this.auditWriter.append(transaction, {
        action: 'wechat_miniprogram_registered',
        actorUserId: resolved.userId,
        metadata: { loginChannel: 'wechat_mini_program' },
        operationId: randomUUID(),
        outcome: 'completed',
        ...(requestId === undefined ? {} : { requestId }),
        targetId: resolved.userId,
        targetType: 'user',
      });
      return this.createAuthenticatedResponse(
        resolved.userId,
        identity.subject,
        resolved.authVersion,
        profile,
        clientVersion,
      );
    });
  }

  public issueSessionForUser(
    userId: string,
    openid: string,
    authVersion: number,
    clientVersion?: ClientVersion,
  ): string {
    return createWechatSessionToken(
      {
        appId: this.getAppId(),
        authVersion,
        ...(clientVersion === undefined ? {} : { clientVersion }),
        openid,
        provider: 'wechat_mini_program',
        sub: userId,
      },
      this.sessionSecret,
    );
  }

  private assertCurrentAppId(appId: string): void {
    if (appId !== this.getAppId()) throw identityConflictError();
  }

  private async createMiniUser(
    transaction: DatabaseTransaction,
    subject: string,
  ): Promise<{ readonly authVersion: number; readonly userId: string }> {
    const userId = randomUUID();
    await transaction.insert(users).values({
      cloudbaseUid: `wechat_mini_${userId}`,
      id: userId,
      wechatOpenid: subject,
    });
    return { authVersion: 1, userId };
  }

  private createAuthenticatedResponse(
    userId: string,
    subject: string,
    authVersion: number,
    profile: UserProfile,
    clientVersion?: ClientVersion,
  ): WechatLinkPasswordResponse {
    return {
      expiresAt: new Date(this.now().valueOf() + WECHAT_SESSION_TTL_SECONDS * 1000).toISOString(),
      profile,
      status: 'authenticated',
      token: this.issueSessionForUser(userId, subject, authVersion, clientVersion),
    };
  }

  private async findPasswordAccount(
    transaction: DatabaseTransaction,
    username: string,
    password: string,
  ): Promise<{
    readonly authVersion: number;
    readonly profile: UserProfile;
    readonly wechatOpenid: string | null;
    readonly userId: string;
  }> {
    const [account] = await transaction
      .select({
        authVersion: users.authVersion,
        cloudbaseUid: users.cloudbaseUid,
        passwordHash: userPasswordCredentials.passwordHash,
        profileVersion: userProfiles.version,
        realName: userProfiles.realName,
        userId: users.id,
        wechatOpenid: users.wechatOpenid,
      })
      .from(userPasswordCredentials)
      .innerJoin(users, eq(users.id, userPasswordCredentials.userId))
      .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
      .where(
        and(
          eq(userPasswordCredentials.username, normalizeUsername(username)),
          eq(users.status, 'active'),
          isNull(users.deletedAt),
          isNull(userProfiles.deletedAt),
        ),
      )
      .limit(1)
      .for('update');
    if (
      account === undefined ||
      account.cloudbaseUid === null ||
      account.passwordHash === null ||
      !(await verifyPassword(password, account.passwordHash))
    ) {
      throw invalidCredentialsError();
    }
    const avatarVersion = await findUserAvatarVersion(transaction, account.userId);
    return {
      authVersion: account.authVersion,
      profile: toUserProfile({
        avatarVersion,
        id: account.userId,
        realName: account.realName,
        version: account.profileVersion,
      }),
      wechatOpenid: account.wechatOpenid,
      userId: account.userId,
    };
  }

  private async rehomeLegacyWechatIdentity(
    transaction: DatabaseTransaction,
    sourceUserId: string,
    account: {
      readonly profile: UserProfile;
      readonly userId: string;
      readonly wechatOpenid: string | null;
    },
    subject: string,
    requestId?: string,
  ): Promise<void> {
    if (account.wechatOpenid !== null && account.wechatOpenid !== subject) {
      throw identityConflictError();
    }

    const [source] = await transaction
      .select({
        cloudbaseUid: users.cloudbaseUid,
        deletedAt: users.deletedAt,
        detachmentCount: sql<number>`(
          SELECT COUNT(*) FROM ${wechatIdentityDetachments}
          WHERE ${wechatIdentityDetachments.userId} = ${sourceUserId}
        )`,
        groupMembershipCount: sql<number>`(
          SELECT COUNT(*) FROM ${groupMemberships}
          WHERE ${groupMemberships.userId} = ${sourceUserId}
        )`,
        identityCount: sql<number>`(
          SELECT COUNT(*) FROM ${userAuthIdentities}
          WHERE ${userAuthIdentities.userId} = ${sourceUserId}
        )`,
        ownedGroupCount: sql<number>`(
          SELECT COUNT(*) FROM ${groups}
          WHERE ${groups.ownerUserId} = ${sourceUserId}
        )`,
        passwordCount: sql<number>`(
          SELECT COUNT(*) FROM ${userPasswordCredentials}
          WHERE ${userPasswordCredentials.userId} = ${sourceUserId}
        )`,
        profileCount: sql<number>`(
          SELECT COUNT(*) FROM ${userProfiles}
          WHERE ${userProfiles.userId} = ${sourceUserId}
        )`,
        profileRealName: sql<string | null>`(
          SELECT ${userProfiles.realName} FROM ${userProfiles}
          WHERE ${userProfiles.userId} = ${sourceUserId}
          ORDER BY ${userProfiles.deletedAt} IS NULL DESC, ${userProfiles.updatedAt} DESC
          LIMIT 1
        )`,
        status: users.status,
        unionCount: sql<number>`(
          SELECT COUNT(*) FROM ${wechatUnionAccounts}
          WHERE ${wechatUnionAccounts.userId} = ${sourceUserId}
        )`,
        wechatOpenid: users.wechatOpenid,
      })
      .from(users)
      .where(eq(users.id, sourceUserId))
      .limit(1)
      .for('update');

    if (
      source === undefined ||
      source.cloudbaseUid === null ||
      source.deletedAt !== null ||
      source.status !== 'active' ||
      source.wechatOpenid !== subject ||
      Number(source.detachmentCount) !== 0 ||
      Number(source.groupMembershipCount) !== 0 ||
      Number(source.identityCount) !== 1 ||
      Number(source.ownedGroupCount) !== 0 ||
      Number(source.passwordCount) !== 0 ||
      Number(source.profileCount) > 1 ||
      Number(source.unionCount) !== 0 ||
      (source.profileRealName !== null && source.profileRealName !== account.profile.realName)
    ) {
      throw identityConflictError();
    }

    const [legacyIdentity] = await transaction
      .select({ id: userAuthIdentities.id })
      .from(userAuthIdentities)
      .where(
        and(
          eq(userAuthIdentities.provider, 'wechat_mini_program'),
          eq(userAuthIdentities.subject, subject),
          eq(userAuthIdentities.userId, sourceUserId),
        ),
      )
      .limit(1)
      .for('update');
    if (legacyIdentity === undefined) throw identityConflictError();

    await transaction
      .update(userAuthIdentities)
      .set({ userId: account.userId })
      .where(eq(userAuthIdentities.id, legacyIdentity.id));
    await transaction
      .update(userProfiles)
      .set({ deletedAt: sql`current_timestamp(3)`, version: sql`${userProfiles.version} + 1` })
      .where(and(eq(userProfiles.userId, sourceUserId), isNull(userProfiles.deletedAt)));
    await transaction
      .update(users)
      .set({
        cloudbaseUid: null,
        deletedAt: sql`current_timestamp(3)`,
        status: 'deleted',
        version: sql`${users.version} + 1`,
        wechatOpenid: null,
      })
      .where(eq(users.id, sourceUserId));
    await transaction
      .update(users)
      .set({
        wechatOpenid: subject,
        version: sql`${users.version} + 1`,
      })
      .where(eq(users.id, account.userId));

    await this.auditWriter.append(transaction, {
      action: 'wechat_miniprogram_legacy_rehomed',
      actorUserId: account.userId,
      metadata: { proof: 'password' },
      operationId: randomUUID(),
      outcome: 'completed',
      ...(requestId === undefined ? {} : { requestId }),
      targetId: sourceUserId,
      targetType: 'user',
    });
  }

  private async getActiveUser(
    transaction: DatabaseTransaction,
    userId: string,
  ): Promise<{ readonly authVersion: number; readonly userId: string }> {
    const [user] = await transaction
      .select({
        authVersion: users.authVersion,
        cloudbaseUid: users.cloudbaseUid,
        deletedAt: users.deletedAt,
        status: users.status,
        userId: users.id,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
      .for('update');
    if (
      user === undefined ||
      user.cloudbaseUid === null ||
      user.status !== 'active' ||
      user.deletedAt !== null
    ) {
      throw registrationUnavailableError();
    }
    return { authVersion: user.authVersion, userId: user.userId };
  }

  private async insertProfile(
    transaction: DatabaseTransaction,
    userId: string,
    realName: string,
  ): Promise<void> {
    const [existing] = await transaction
      .select({ userId: userProfiles.userId })
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1)
      .for('update');
    if (existing !== undefined) throw profileAlreadyExistsError();
    await transaction.insert(userProfiles).values({ realName, userId });
  }

  private async rememberLegacyOpenid(
    transaction: DatabaseTransaction,
    userId: string,
    subject: string,
  ): Promise<void> {
    const [user] = await transaction
      .select({ wechatOpenid: users.wechatOpenid })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
      .for('update');
    if (user === undefined) throw identityConflictError();
    if (user.wechatOpenid !== null && user.wechatOpenid !== subject) {
      throw identityConflictError();
    }
    if (user.wechatOpenid === null) {
      await transaction.update(users).set({ wechatOpenid: subject }).where(eq(users.id, userId));
    }
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

  private async findProfile(userId: string): Promise<UserProfile | undefined> {
    const [profile] = await this.databaseClient.database
      .select({
        avatarVersion: userProfileAvatars.version,
        id: userProfiles.userId,
        realName: userProfiles.realName,
        version: userProfiles.version,
      })
      .from(userProfiles)
      .leftJoin(userProfileAvatars, eq(userProfileAvatars.userId, userProfiles.userId))
      .where(and(eq(userProfiles.userId, userId), isNull(userProfiles.deletedAt)))
      .limit(1);

    if (profile === undefined) {
      return undefined;
    }
    return toUserProfile(profile);
  }
}

function identityConflictError(): ApiError {
  return new ApiError({
    code: 'CONFLICT',
    statusCode: 409,
    userMessage: '微信身份状态冲突，请联系管理员处理。',
  });
}

function invalidCredentialsError(): ApiError {
  return new ApiError({
    code: 'AUTHENTICATION_REQUIRED',
    statusCode: 401,
    userMessage: '账号或密码不正确，请重试。',
  });
}

function profileAlreadyExistsError(): ApiError {
  return new ApiError({
    code: 'CONFLICT',
    statusCode: 409,
    userMessage: '该微信身份已完成注册，请重新登录。',
  });
}

function registrationUnavailableError(): ApiError {
  return new ApiError({
    code: 'FORBIDDEN',
    statusCode: 403,
    userMessage: '该账号当前无法完成注册。',
  });
}
