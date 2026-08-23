import { createHmac, timingSafeEqual } from 'node:crypto';

import { clientVersionSchema, type ClientVersion } from '@schedule/contracts';
import { type DatabaseClient, userAuthIdentities, users } from '@schedule/database';
import { and, eq, isNull } from 'drizzle-orm';

import { ApiError } from '../../plugins/error-handler.js';
import type { AuthPort } from './auth-port.js';

export interface WechatSessionClaims {
  readonly appId?: string;
  readonly authVersion?: number;
  readonly clientVersion?: ClientVersion;
  readonly exp: number;
  readonly openid: string;
  readonly provider?: 'password' | 'wechat_mini_program' | 'wechat_web';
  readonly sub: string;
}

export const WECHAT_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const MINIMUM_SESSION_SECRET_LENGTH = 32;

export function createWechatSessionToken(
  claims: {
    readonly appId?: string;
    readonly authVersion?: number;
    readonly clientVersion?: ClientVersion;
    readonly openid: string;
    readonly provider?: 'password' | 'wechat_mini_program' | 'wechat_web';
    readonly sub: string;
  },
  sessionSecret: string | undefined,
  nowSeconds = Math.floor(Date.now() / 1000),
): string {
  if (sessionSecret === undefined || sessionSecret.length < MINIMUM_SESSION_SECRET_LENGTH) {
    throw new ApiError({
      code: 'AUTHENTICATION_REQUIRED',
      statusCode: 401,
      userMessage: '微信登录暂不可用，请稍后重试。',
    });
  }

  const header = encodeBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = encodeBase64Url(
    JSON.stringify({ exp: nowSeconds + WECHAT_SESSION_TTL_SECONDS, ...claims }),
  );
  const signature = createHmac('sha256', sessionSecret)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
}

export function createPasswordSessionToken(
  claims: { readonly authVersion: number; readonly sub: string; readonly username: string },
  sessionSecret: string | undefined,
  nowSeconds = Math.floor(Date.now() / 1000),
): string {
  return createWechatSessionToken(
    {
      authVersion: claims.authVersion,
      openid: claims.username,
      provider: 'password',
      sub: claims.sub,
    },
    sessionSecret,
    nowSeconds,
  );
}

export function verifyWechatSessionToken(
  token: string | undefined,
  sessionSecret: string | undefined,
  nowSeconds = Math.floor(Date.now() / 1000),
): WechatSessionClaims | undefined {
  if (sessionSecret === undefined || sessionSecret.length < MINIMUM_SESSION_SECRET_LENGTH) {
    return undefined;
  }
  if (token === undefined) {
    return undefined;
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return undefined;
  }
  const [headerPart, payloadPart, signaturePart] = parts;
  if (headerPart === undefined || payloadPart === undefined || signaturePart === undefined) {
    return undefined;
  }

  const expectedSignature = createHmac('sha256', sessionSecret)
    .update(`${headerPart}.${payloadPart}`)
    .digest('base64url');
  const expected = Buffer.from(expectedSignature);
  const actual = Buffer.from(signaturePart);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return undefined;
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8')) as unknown;
    if (!isWechatSessionClaims(payload)) {
      return undefined;
    }
    if (payload.exp <= nowSeconds) {
      return undefined;
    }
    return payload;
  } catch {
    return undefined;
  }
}

export interface WechatAuthPortOptions {
  readonly allowDevTokens: boolean;
  readonly databaseClient: DatabaseClient;
  readonly sessionSecret: string | undefined;
}

export function createWechatAuthPort(options: WechatAuthPortOptions): AuthPort {
  return {
    async authenticate({ authorization }) {
      const token = authorization?.replace(/^Bearer\s+/iu, '');
      if (token === undefined || token.length === 0) {
        return undefined;
      }

      const claims = verifyWechatSessionToken(token, options.sessionSecret);
      if (claims !== undefined) {
        const authVersion = claims.authVersion ?? 1;
        if (claims.provider === 'password') {
          const [user] = await options.databaseClient.database
            .select({ authVersion: users.authVersion, cloudbaseUid: users.cloudbaseUid })
            .from(users)
            .where(
              and(
                eq(users.id, claims.sub),
                eq(users.authVersion, authVersion),
                eq(users.status, 'active'),
                isNull(users.deletedAt),
              ),
            )
            .limit(1);
          return user?.cloudbaseUid === null || user?.cloudbaseUid === undefined
            ? undefined
            : { cloudbaseUid: user.cloudbaseUid };
        }
        if (claims.provider === 'wechat_web') {
          const [identity] = await options.databaseClient.database
            .select({ userId: userAuthIdentities.userId })
            .from(userAuthIdentities)
            .where(
              and(
                eq(userAuthIdentities.provider, 'wechat_web'),
                ...(claims.appId === undefined ? [] : [eq(userAuthIdentities.appId, claims.appId)]),
                eq(userAuthIdentities.subject, claims.openid),
                eq(userAuthIdentities.userId, claims.sub),
              ),
            )
            .limit(1);
          if (identity === undefined) {
            return undefined;
          }
          const [user] = await options.databaseClient.database
            .select({ authVersion: users.authVersion, cloudbaseUid: users.cloudbaseUid })
            .from(users)
            .where(
              and(
                eq(users.id, identity.userId),
                eq(users.authVersion, authVersion),
                eq(users.status, 'active'),
                isNull(users.deletedAt),
              ),
            )
            .limit(1);
          return user?.cloudbaseUid === null || user?.cloudbaseUid === undefined
            ? undefined
            : { cloudbaseUid: user.cloudbaseUid };
        }

        if (claims.appId !== undefined) {
          const [identity] = await options.databaseClient.database
            .select({ userId: userAuthIdentities.userId })
            .from(userAuthIdentities)
            .where(
              and(
                eq(userAuthIdentities.provider, 'wechat_mini_program'),
                eq(userAuthIdentities.appId, claims.appId),
                eq(userAuthIdentities.subject, claims.openid),
                eq(userAuthIdentities.userId, claims.sub),
              ),
            )
            .limit(1);
          if (identity === undefined) return undefined;

          const [user] = await options.databaseClient.database
            .select({ cloudbaseUid: users.cloudbaseUid })
            .from(users)
            .where(
              and(
                eq(users.id, identity.userId),
                eq(users.authVersion, authVersion),
                eq(users.status, 'active'),
                isNull(users.deletedAt),
              ),
            )
            .limit(1);
          return user?.cloudbaseUid === null || user?.cloudbaseUid === undefined
            ? undefined
            : {
                clientPlatform: 'miniprogram',
                ...(claims.clientVersion === undefined
                  ? {}
                  : { clientVersion: claims.clientVersion }),
                cloudbaseUid: user.cloudbaseUid,
              };
        }

        const [user] = await options.databaseClient.database
          .select({ cloudbaseUid: users.cloudbaseUid })
          .from(users)
          .where(
            and(
              eq(users.id, claims.sub),
              eq(users.authVersion, authVersion),
              eq(users.wechatOpenid, claims.openid),
              eq(users.status, 'active'),
              isNull(users.deletedAt),
            ),
          )
          .limit(1);
        if (user !== undefined && user.cloudbaseUid !== null) {
          return {
            clientPlatform: 'miniprogram',
            ...(claims.clientVersion === undefined ? {} : { clientVersion: claims.clientVersion }),
            cloudbaseUid: user.cloudbaseUid,
          };
        }
        return undefined;
      }

      if (options.allowDevTokens) {
        return { cloudbaseUid: token };
      }
      return undefined;
    },
  };
}

function isWechatSessionClaims(value: unknown): value is WechatSessionClaims {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const candidate = value as {
    appId?: unknown;
    authVersion?: unknown;
    clientVersion?: unknown;
    exp?: unknown;
    openid?: unknown;
    provider?: unknown;
    sub?: unknown;
  };
  return (
    typeof candidate.exp === 'number' &&
    (candidate.appId === undefined ||
      (typeof candidate.appId === 'string' && candidate.appId.length > 0)) &&
    (candidate.authVersion === undefined ||
      (typeof candidate.authVersion === 'number' &&
        Number.isInteger(candidate.authVersion) &&
        candidate.authVersion >= 1)) &&
    (candidate.clientVersion === undefined ||
      clientVersionSchema.safeParse(candidate.clientVersion).success) &&
    typeof candidate.openid === 'string' &&
    candidate.openid.length > 0 &&
    typeof candidate.sub === 'string' &&
    candidate.sub.length > 0 &&
    (candidate.provider === undefined ||
      candidate.provider === 'password' ||
      candidate.provider === 'wechat_mini_program' ||
      candidate.provider === 'wechat_web') &&
    !(candidate.clientVersion !== undefined && candidate.provider !== 'wechat_mini_program') &&
    !(candidate.provider === 'password' && candidate.appId !== undefined)
  );
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}
