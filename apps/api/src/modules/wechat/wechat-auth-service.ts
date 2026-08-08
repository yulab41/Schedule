import { randomUUID } from 'node:crypto';

import type { WechatLoginResponse, UserProfile } from '@schedule/contracts';
import { type DatabaseClient, userProfiles, users, withTransaction } from '@schedule/database';
import { and, eq, isNull } from 'drizzle-orm';

import { createWechatSessionToken } from '../../adapters/auth/wechat-auth.js';
import { ApiError } from '../../plugins/error-handler.js';
import { AuditWriter } from '../audit/audit-writer.js';
import { toWechatGatewayApiError } from './wechat-errors.js';
import { WechatGatewayError, type WechatGateway } from './wechat-gateway.js';

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
    let openid: string;
    try {
      const exchanged = await this.gateway.exchangeCode(code);
      openid = exchanged.openid;
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
        and(eq(users.wechatOpenid, openid), eq(users.status, 'active'), isNull(users.deletedAt)),
      )
      .limit(1);

    if (existingUser !== undefined && existingUser.cloudbaseUid !== null) {
      return {
        isNewUser: false,
        profile: await this.findProfile(existingUser.id),
        token: this.issueSessionForUser(existingUser.id, openid),
      };
    }

    const userId = await this.createWechatUser(openid);
    return {
      isNewUser: true,
      profile: undefined,
      token: this.issueSessionForUser(userId, openid),
    };
  }

  public issueSessionForUser(userId: string, openid: string): string {
    return createWechatSessionToken({ openid, sub: userId }, this.sessionSecret);
  }

  private async createWechatUser(openid: string): Promise<string> {
    const userId = randomUUID();
    try {
      return await withTransaction(this.databaseClient, async (transaction) => {
        await transaction.insert(users).values({
          cloudbaseUid: `wx_${openid}`,
          id: userId,
          wechatOpenid: openid,
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
