import { randomUUID } from 'node:crypto';

import type { ApiErrorCode, WechatLoginResponse, UserProfile } from '@schedule/contracts';
import { type DatabaseClient, userProfiles, users, withTransaction } from '@schedule/database';
import { and, eq, isNull } from 'drizzle-orm';

import { createWechatSessionToken } from '../../adapters/auth/wechat-auth.js';
import { ApiError } from '../../plugins/error-handler.js';
import { AuditWriter } from '../audit/audit-writer.js';
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
        throw toApiError(error);
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

function toApiError(error: WechatGatewayError): ApiError {
  const statusCode = wechatGatewayStatusCodes[error.mappedCode] ?? 500;
  return new ApiError({
    code: error.mappedCode,
    statusCode,
    userMessage: wechatGatewayUserMessages[error.mappedCode] ?? '微信服务暂时不可用，请稍后重试。',
  });
}

const wechatGatewayStatusCodes: Readonly<Record<ApiErrorCode, number>> = {
  AUTHENTICATION_REQUIRED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_FAILED: 400,
  UNSUPPORTED_MEDIA_TYPE: 415,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  SERVICE_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
  WECHAT_LOGIN_FAILED: 401,
  WECHAT_MESSAGE_SEND_FAILED: 502,
  INVITE_INVALID: 400,
  INVITE_USED: 409,
  INVITE_EXPIRED: 410,
  VISITOR_KEY_INVALID: 400,
};

const wechatGatewayUserMessages: Readonly<Record<ApiErrorCode, string>> = {
  AUTHENTICATION_REQUIRED: '需要先登录后才能继续。',
  FORBIDDEN: '当前账号无法执行该操作。',
  NOT_FOUND: '请求的资源不存在。',
  VALIDATION_FAILED: '请求数据不符合要求。',
  UNSUPPORTED_MEDIA_TYPE: '不支持的请求内容类型。',
  CONFLICT: '数据已更新，请刷新后重试。',
  RATE_LIMITED: '请求过于频繁，请稍后重试。',
  SERVICE_UNAVAILABLE: '微信服务暂时不可用，请稍后重试。',
  INTERNAL_ERROR: '服务器暂时无法处理请求，请稍后重试。',
  WECHAT_LOGIN_FAILED: '微信登录失败，请重新尝试。',
  WECHAT_MESSAGE_SEND_FAILED: '微信消息发送失败。',
  INVITE_INVALID: '邀请链接无效。',
  INVITE_USED: '邀请链接已被使用。',
  INVITE_EXPIRED: '邀请链接已过期。',
  VISITOR_KEY_INVALID: '访客链接无效。',
};
