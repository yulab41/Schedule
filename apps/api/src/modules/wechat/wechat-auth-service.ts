import type { WechatLoginResponse, UserProfile } from '@schedule/contracts';
import { type DatabaseClient, userProfiles, users } from '@schedule/database';
import { and, eq, isNull } from 'drizzle-orm';

import {
  createWechatSessionToken,
  WECHAT_SESSION_TTL_SECONDS,
} from '../../adapters/auth/wechat-auth.js';
import { ApiError } from '../../plugins/error-handler.js';
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
      token: this.issueSessionForUser(resolved.userId, exchanged.openid, resolved.authVersion),
    };
  }

  public issueSessionForUser(userId: string, openid: string, authVersion: number): string {
    return createWechatSessionToken(
      {
        appId: this.getAppId(),
        authVersion,
        openid,
        provider: 'wechat_mini_program',
        sub: userId,
      },
      this.sessionSecret,
    );
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
