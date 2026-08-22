import { createHash, randomBytes, randomUUID } from 'node:crypto';

import {
  type DatabaseClient,
  type DatabaseTransaction,
  wechatLinkTokens,
  withTransaction,
} from '@schedule/database';
import { and, eq } from 'drizzle-orm';

import { ApiError } from '../../plugins/error-handler.js';

const LINK_TOKEN_TTL_MS = 10 * 60 * 1000;

export interface WechatLinkIdentity {
  readonly appId: string;
  readonly existingUserId: string | undefined;
  readonly subject: string;
  readonly unionId: string | undefined;
}

interface WechatLinkTokenServiceOptions {
  readonly databaseClient: DatabaseClient;
  readonly now?: (() => Date) | undefined;
}

export interface IssuedWechatLinkToken {
  readonly expiresAt: string;
  readonly linkToken: string;
}

export class WechatLinkTokenService {
  private readonly databaseClient: DatabaseClient;
  private readonly now: () => Date;

  public constructor(options: WechatLinkTokenServiceOptions) {
    this.databaseClient = options.databaseClient;
    this.now = options.now ?? (() => new Date());
  }

  public async issue(identity: WechatLinkIdentity): Promise<IssuedWechatLinkToken> {
    if (identity.appId.length === 0 || identity.subject.length === 0) {
      throw invalidLinkTokenError();
    }

    const linkToken = randomBytes(32).toString('base64url');
    const expiresAt = new Date(this.now().valueOf() + LINK_TOKEN_TTL_MS);
    await this.databaseClient.database.insert(wechatLinkTokens).values({
      appId: identity.appId,
      existingUserId: identity.existingUserId,
      expiresAt,
      id: randomUUID(),
      subject: identity.subject,
      tokenHash: hashToken(linkToken),
      unionId: identity.unionId,
    });
    return { expiresAt: expiresAt.toISOString(), linkToken };
  }

  public async consume<Result = WechatLinkIdentity>(
    linkToken: string,
    operation?:
      | ((transaction: DatabaseTransaction, identity: WechatLinkIdentity) => Promise<Result>)
      | undefined,
  ): Promise<Result> {
    const tokenHash = hashToken(linkToken);
    return withTransaction(this.databaseClient, async (transaction) => {
      const [record] = await transaction
        .select({
          appId: wechatLinkTokens.appId,
          existingUserId: wechatLinkTokens.existingUserId,
          expiresAt: wechatLinkTokens.expiresAt,
          id: wechatLinkTokens.id,
          status: wechatLinkTokens.status,
          subject: wechatLinkTokens.subject,
          unionId: wechatLinkTokens.unionId,
        })
        .from(wechatLinkTokens)
        .where(eq(wechatLinkTokens.tokenHash, tokenHash))
        .limit(1)
        .for('update');

      if (record === undefined) throw invalidLinkTokenError();
      if (record.status !== 'pending') throw usedLinkTokenError();
      const consumedAt = this.now();
      if (record.expiresAt.valueOf() <= consumedAt.valueOf()) {
        throw expiredLinkTokenError();
      }

      const identity = {
        appId: record.appId,
        existingUserId: record.existingUserId ?? undefined,
        subject: record.subject,
        unionId: record.unionId ?? undefined,
      };
      const result =
        operation === undefined ? (identity as Result) : await operation(transaction, identity);
      await transaction
        .update(wechatLinkTokens)
        .set({ consumedAt, status: 'consumed' })
        .where(and(eq(wechatLinkTokens.id, record.id), eq(wechatLinkTokens.status, 'pending')));
      return result;
    });
  }
}

function hashToken(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function invalidLinkTokenError(): ApiError {
  return new ApiError({
    code: 'WECHAT_LINK_TOKEN_INVALID',
    statusCode: 401,
    userMessage: '微信绑定凭证无效，请重新登录。',
  });
}

function usedLinkTokenError(): ApiError {
  return new ApiError({
    code: 'WECHAT_LINK_TOKEN_USED',
    statusCode: 409,
    userMessage: '微信绑定凭证已使用，请重新登录。',
  });
}

function expiredLinkTokenError(): ApiError {
  return new ApiError({
    code: 'WECHAT_LINK_TOKEN_EXPIRED',
    statusCode: 410,
    userMessage: '微信绑定凭证已过期，请重新登录。',
  });
}
