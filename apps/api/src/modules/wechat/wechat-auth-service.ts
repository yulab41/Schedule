import { randomUUID } from 'node:crypto';

import type { WechatLoginResponse, UserProfile } from '@schedule/contracts';
import {
  type DatabaseClient,
  userAuthIdentities,
  userProfiles,
  users,
  withTransaction,
} from '@schedule/database';
import { and, eq, isNull } from 'drizzle-orm';

import { createWechatSessionToken } from '../../adapters/auth/wechat-auth.js';
import { ApiError } from '../../plugins/error-handler.js';
import { AuditWriter } from '../audit/audit-writer.js';
import { toWechatGatewayApiError } from './wechat-errors.js';
import {
  WechatGatewayError,
  type WechatExchangeCodeResult,
  type WechatGateway,
} from './wechat-gateway.js';

export interface WechatAuthServiceOptions {
  readonly databaseClient: DatabaseClient;
  readonly gateway: WechatGateway;
  readonly sessionSecret: string | undefined;
}

export class WechatAuthService {
  private readonly auditWriter = new AuditWriter();
  private readonly databaseClient: DatabaseClient;
  private readonly gateway: WechatGateway;
  private readonly sessionSecret: string | undefined;

  public constructor(options: WechatAuthServiceOptions) {
    this.databaseClient = options.databaseClient;
    this.gateway = options.gateway;
    this.sessionSecret = options.sessionSecret;
  }

  public async login(code: string): Promise<WechatLoginResponse> {
    let exchanged: WechatExchangeCodeResult;
    try {
      exchanged = await this.gateway.exchangeCode(code);
    } catch (error) {
      if (error instanceof WechatGatewayError) {
        throw toWechatGatewayApiError(error);
      }
      throw error;
    }

    const [existingUser] = await this.databaseClient.database
      .select({ cloudbaseUid: users.cloudbaseUid, id: users.id })
      .from(users)
      .where(
        and(
          eq(users.wechatOpenid, exchanged.openid),
          eq(users.status, 'active'),
          isNull(users.deletedAt),
        ),
      )
      .limit(1);

    if (existingUser !== undefined && existingUser.cloudbaseUid !== null) {
      await this.ensureMiniProgramIdentity(existingUser.id, exchanged);
      return {
        isNewUser: false,
        profile: await this.findProfile(existingUser.id),
        token: this.issueSessionForUser(existingUser.id, exchanged.openid),
      };
    }

    if (exchanged.unionid !== undefined) {
      const [linkedIdentity] = await this.databaseClient.database
        .select({ userId: userAuthIdentities.userId })
        .from(userAuthIdentities)
        .where(eq(userAuthIdentities.unionId, exchanged.unionid))
        .limit(1);
      if (linkedIdentity !== undefined) {
        await this.databaseClient.database
          .update(users)
          .set({ wechatOpenid: exchanged.openid })
          .where(
            and(
              eq(users.id, linkedIdentity.userId),
              isNull(users.wechatOpenid),
              eq(users.status, 'active'),
              isNull(users.deletedAt),
            ),
          );
        await this.ensureMiniProgramIdentity(linkedIdentity.userId, exchanged);
        return {
          isNewUser: false,
          profile: await this.findProfile(linkedIdentity.userId),
          token: this.issueSessionForUser(linkedIdentity.userId, exchanged.openid),
        };
      }
    }

    const userId = await this.createWechatUser(exchanged);
    return {
      isNewUser: true,
      profile: undefined,
      token: this.issueSessionForUser(userId, exchanged.openid),
    };
  }

  public issueSessionForUser(userId: string, openid: string): string {
    return createWechatSessionToken(
      { openid, provider: 'wechat_mini_program', sub: userId },
      this.sessionSecret,
    );
  }

  private async createWechatUser(exchanged: {
    readonly openid: string;
    readonly unionid: string | undefined;
  }): Promise<string> {
    const userId = randomUUID();
    try {
      return await withTransaction(this.databaseClient, async (transaction) => {
        await transaction.insert(users).values({
          cloudbaseUid: `wx_${exchanged.openid}`,
          id: userId,
          wechatOpenid: exchanged.openid,
        });
        await transaction.insert(userAuthIdentities).values({
          id: randomUUID(),
          provider: 'wechat_mini_program',
          subject: exchanged.openid,
          unionId: exchanged.unionid,
          userId,
        });
        await this.auditWriter.append(transaction, {
          action: 'wechat_user_created',
          actorUserId: userId,
          metadata: { loginChannel: 'wechat' },
          operationId: randomUUID(),
          outcome: 'completed',
          targetId: userId,
          targetType: 'user',
        });
        return userId;
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ApiError({
          code: 'CONFLICT',
          statusCode: 409,
          userMessage: '该微信账号已存在且状态异常，请联系管理员。',
        });
      }
      throw error;
    }
  }

  private async ensureMiniProgramIdentity(
    userId: string,
    exchanged: { readonly openid: string; readonly unionid: string | undefined },
  ): Promise<void> {
    const [existingIdentity] = await this.databaseClient.database
      .select({ id: userAuthIdentities.id })
      .from(userAuthIdentities)
      .where(
        and(
          eq(userAuthIdentities.provider, 'wechat_mini_program'),
          eq(userAuthIdentities.subject, exchanged.openid),
        ),
      )
      .limit(1);
    if (existingIdentity === undefined) {
      await this.databaseClient.database.insert(userAuthIdentities).values({
        id: randomUUID(),
        provider: 'wechat_mini_program',
        subject: exchanged.openid,
        unionId: exchanged.unionid,
        userId,
      });
      return;
    }
    if (exchanged.unionid !== undefined) {
      await this.databaseClient.database
        .update(userAuthIdentities)
        .set({ unionId: exchanged.unionid })
        .where(eq(userAuthIdentities.id, existingIdentity.id));
    }
  }

  private async findProfile(userId: string): Promise<UserProfile | undefined> {
    const [profile] = await this.databaseClient.database
      .select({
        id: userProfiles.userId,
        realName: userProfiles.realName,
        version: userProfiles.version,
      })
      .from(userProfiles)
      .where(and(eq(userProfiles.userId, userId), isNull(userProfiles.deletedAt)))
      .limit(1);

    if (profile === undefined) {
      return undefined;
    }
    return { id: profile.id, realName: profile.realName, version: profile.version };
  }
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY'
  );
}
