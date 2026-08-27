import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

import type {
  UserProfile,
  WechatWebLoginResponse,
  WechatWebLoginStartResponse,
} from '@schedule/contracts';
import {
  type DatabaseClient,
  type DatabaseTransaction,
  userProfileAvatars,
  userProfiles,
  users,
} from '@schedule/database';
import { and, eq, isNull } from 'drizzle-orm';

import { createWechatSessionToken } from '../../adapters/auth/wechat-auth.js';
import { ApiError } from '../../plugins/error-handler.js';
import { toUserProfile } from '../users/user-profile.js';
import {
  WechatGatewayError,
  type WechatExchangeCodeResult,
  type WechatWebGateway,
} from './wechat-gateway.js';
import { toWechatGatewayApiError } from './wechat-errors.js';
import { WechatIdentityResolver } from './wechat-identity-resolver.js';

const STATE_TTL_SECONDS = 5 * 60;

export interface WechatWebAuthServiceOptions {
  readonly databaseClient: DatabaseClient;
  readonly gateway: WechatWebGateway;
  readonly redirectUri: string | undefined;
  readonly sessionSecret: string | undefined;
  readonly nowSeconds?: () => number;
}

export class WechatWebAuthService {
  private readonly databaseClient: DatabaseClient;
  private readonly gateway: WechatWebGateway;
  private readonly identityResolver: WechatIdentityResolver;
  private readonly nowSeconds: () => number;
  private readonly redirectUri: string | undefined;
  private readonly sessionSecret: string | undefined;

  public constructor(options: WechatWebAuthServiceOptions) {
    this.databaseClient = options.databaseClient;
    this.gateway = options.gateway;
    this.identityResolver = new WechatIdentityResolver(options.databaseClient);
    this.nowSeconds = options.nowSeconds ?? (() => Math.floor(Date.now() / 1000));
    this.redirectUri = options.redirectUri;
    this.sessionSecret = options.sessionSecret;
  }

  public start(clientState: string): WechatWebLoginStartResponse {
    const appId = this.getAppId();
    const redirectUri = this.getRedirectUri();
    const state = createWechatWebState(clientState, this.sessionSecret, this.nowSeconds());
    const authorizeUrl = new URL('https://open.weixin.qq.com/connect/qrconnect');
    authorizeUrl.searchParams.set('appid', appId);
    authorizeUrl.searchParams.set('redirect_uri', redirectUri);
    authorizeUrl.searchParams.set('response_type', 'code');
    authorizeUrl.searchParams.set('scope', 'snsapi_login');
    authorizeUrl.searchParams.set('state', state);
    authorizeUrl.hash = 'wechat_redirect';
    return { authorizeUrl: authorizeUrl.toString(), state };
  }

  public async exchange(code: string, state: string): Promise<WechatWebLoginResponse> {
    if (!verifyWechatWebState(state, this.sessionSecret, this.nowSeconds())) {
      throw new ApiError({
        code: 'AUTHENTICATION_REQUIRED',
        statusCode: 401,
        userMessage: '微信登录状态已失效，请重新扫码登录。',
      });
    }

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
      createUser: (transaction) => this.createWechatUser(transaction, exchanged),
      provider: 'wechat_web',
      subject: exchanged.openid,
      unionId: exchanged.unionid,
    });
    if (resolved === undefined) {
      throw new ApiError({
        code: 'CONFLICT',
        statusCode: 409,
        userMessage: '微信身份状态冲突，请联系管理员处理。',
      });
    }
    const profile = await this.findProfile(resolved.userId);
    return {
      isNewUser: profile === undefined,
      profile,
      token: createWechatSessionToken(
        {
          appId,
          authVersion: resolved.authVersion,
          openid: exchanged.openid,
          provider: 'wechat_web',
          sub: resolved.userId,
        },
        this.sessionSecret,
      ),
    };
  }

  private getAppId(): string {
    const appId = this.gateway.appId;
    if (appId === undefined || appId.length === 0) {
      throw new ApiError({
        code: 'SERVICE_UNAVAILABLE',
        statusCode: 503,
        userMessage: '微信网页登录暂未配置，请稍后重试。',
      });
    }
    return appId;
  }

  private getRedirectUri(): string {
    if (this.redirectUri === undefined) {
      throw new ApiError({
        code: 'SERVICE_UNAVAILABLE',
        statusCode: 503,
        userMessage: '微信网页登录暂未配置，请稍后重试。',
      });
    }
    return this.redirectUri;
  }

  private async createWechatUser(
    transaction: DatabaseTransaction,
    exchanged: WechatExchangeCodeResult,
  ): Promise<{ readonly authVersion: number; readonly userId: string }> {
    const userId = randomUUID();
    await transaction.insert(users).values({
      cloudbaseUid: `wx_web_${exchanged.unionid ?? exchanged.openid}`,
      id: userId,
    });
    return { authVersion: 1, userId };
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

    return profile === undefined ? undefined : toUserProfile(profile);
  }
}

export function createWechatWebState(
  clientState: string,
  sessionSecret: string | undefined,
  nowSeconds: number,
): string {
  if (sessionSecret === undefined || sessionSecret.length < 32) {
    throw new ApiError({
      code: 'AUTHENTICATION_REQUIRED',
      statusCode: 401,
      userMessage: '微信登录暂不可用，请稍后重试。',
    });
  }
  const payload = encodeBase64Url(
    JSON.stringify({
      clientState,
      exp: nowSeconds + STATE_TTL_SECONDS,
      nonce: randomBytes(16).toString('hex'),
    }),
  );
  const signature = createHmac('sha256', sessionSecret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifyWechatWebState(
  state: string,
  sessionSecret: string | undefined,
  nowSeconds: number,
): boolean {
  if (sessionSecret === undefined || sessionSecret.length < 32) {
    return false;
  }
  const parts = state.split('.');
  if (parts.length !== 2) {
    return false;
  }
  const [payloadPart, signaturePart] = parts;
  if (payloadPart === undefined || signaturePart === undefined) {
    return false;
  }
  const expected = Buffer.from(
    createHmac('sha256', sessionSecret).update(payloadPart).digest('base64url'),
  );
  const actual = Buffer.from(signaturePart);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return false;
  }
  try {
    const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8')) as {
      clientState?: unknown;
      exp?: unknown;
      nonce?: unknown;
    };
    return (
      typeof payload.clientState === 'string' &&
      payload.clientState.length >= 16 &&
      typeof payload.exp === 'number' &&
      payload.exp > nowSeconds &&
      typeof payload.nonce === 'string' &&
      payload.nonce.length > 0
    );
  } catch {
    return false;
  }
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}
