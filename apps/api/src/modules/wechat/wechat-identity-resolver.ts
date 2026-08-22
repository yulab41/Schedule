import { randomUUID } from 'node:crypto';

import {
  type DatabaseClient,
  type DatabaseTransaction,
  userAuthIdentities,
  users,
  wechatUnionAccounts,
  withTransaction,
} from '@schedule/database';
import { and, eq } from 'drizzle-orm';

import { ApiError } from '../../plugins/error-handler.js';

export type WechatIdentityProvider = 'wechat_mini_program' | 'wechat_web';

interface CreatedWechatUser {
  readonly authVersion: number;
  readonly userId: string;
}

interface ResolveWechatIdentityInput {
  readonly appId: string;
  readonly createUser?:
    ((transaction: DatabaseTransaction) => Promise<CreatedWechatUser>) | undefined;
  readonly onResolved?:
    ((transaction: DatabaseTransaction, userId: string) => Promise<void>) | undefined;
  readonly provider: WechatIdentityProvider;
  readonly subject: string;
  readonly unionId: string | undefined;
}

export interface ResolvedWechatIdentity extends CreatedWechatUser {
  readonly isNewUser: boolean;
}

export class WechatIdentityResolver {
  public constructor(private readonly databaseClient: DatabaseClient) {}

  public async resolve(
    input: ResolveWechatIdentityInput,
  ): Promise<ResolvedWechatIdentity | undefined> {
    if (input.appId.length === 0) {
      throw identityConfigurationError();
    }

    try {
      return await withTransaction(this.databaseClient, (transaction) =>
        this.resolveInTransaction(transaction, input),
      );
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw identityConflictError();
      }
      throw error;
    }
  }

  public async resolveInTransaction(
    transaction: DatabaseTransaction,
    input: ResolveWechatIdentityInput,
  ): Promise<ResolvedWechatIdentity | undefined> {
    if (input.appId.length === 0) {
      throw identityConfigurationError();
    }

    try {
      const existingIdentity = await this.findIdentity(transaction, input);
      if (existingIdentity !== undefined) {
        if (existingIdentity.appId === null) {
          await transaction
            .update(userAuthIdentities)
            .set({ appId: input.appId })
            .where(eq(userAuthIdentities.id, existingIdentity.id));
        } else if (existingIdentity.appId !== input.appId) {
          throw identityConflictError();
        }
        const user = await this.getActiveUser(transaction, existingIdentity.userId);
        await this.ensureUnionAccount(transaction, user.userId, input.unionId);
        await input.onResolved?.(transaction, user.userId);
        return { ...user, isNewUser: false };
      }

      if (input.provider === 'wechat_mini_program') {
        const legacyUser = await this.findLegacyMiniUser(transaction, input.subject);
        if (legacyUser !== undefined) {
          await this.insertIdentity(transaction, input, legacyUser.userId);
          await this.ensureUnionAccount(transaction, legacyUser.userId, input.unionId);
          await input.onResolved?.(transaction, legacyUser.userId);
          return { ...legacyUser, isNewUser: false };
        }
      }

      const unionUser = await this.findUnionUser(transaction, input.unionId);
      if (unionUser !== undefined) {
        const user = await this.getActiveUser(transaction, unionUser);
        await this.insertIdentity(transaction, input, user.userId);
        await input.onResolved?.(transaction, user.userId);
        return { ...user, isNewUser: false };
      }

      if (input.createUser === undefined) return undefined;
      const created = await input.createUser(transaction);
      await this.insertIdentity(transaction, input, created.userId);
      await this.ensureUnionAccount(transaction, created.userId, input.unionId);
      await input.onResolved?.(transaction, created.userId);
      return { ...created, isNewUser: true };
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw identityConflictError();
      }
      throw error;
    }
  }

  private async findIdentity(
    transaction: DatabaseTransaction,
    input: Pick<ResolveWechatIdentityInput, 'provider' | 'subject'>,
  ): Promise<
    { readonly appId: string | null; readonly id: string; readonly userId: string } | undefined
  > {
    const [identity] = await transaction
      .select({
        appId: userAuthIdentities.appId,
        id: userAuthIdentities.id,
        userId: userAuthIdentities.userId,
      })
      .from(userAuthIdentities)
      .where(
        and(
          eq(userAuthIdentities.provider, input.provider),
          eq(userAuthIdentities.subject, input.subject),
        ),
      )
      .limit(1)
      .for('update');
    return identity;
  }

  private async findLegacyMiniUser(
    transaction: DatabaseTransaction,
    subject: string,
  ): Promise<CreatedWechatUser | undefined> {
    const [user] = await transaction
      .select({
        authVersion: users.authVersion,
        cloudbaseUid: users.cloudbaseUid,
        deletedAt: users.deletedAt,
        status: users.status,
        userId: users.id,
      })
      .from(users)
      .where(eq(users.wechatOpenid, subject))
      .limit(1)
      .for('update');
    if (user === undefined) return undefined;
    assertActiveUser(user);
    return { authVersion: user.authVersion, userId: user.userId };
  }

  private async findUnionUser(
    transaction: DatabaseTransaction,
    unionId: string | undefined,
  ): Promise<string | undefined> {
    if (unionId === undefined) return undefined;
    const [account] = await transaction
      .select({ userId: wechatUnionAccounts.userId })
      .from(wechatUnionAccounts)
      .where(eq(wechatUnionAccounts.unionId, unionId))
      .limit(1)
      .for('update');
    return account?.userId;
  }

  private async getActiveUser(
    transaction: DatabaseTransaction,
    userId: string,
  ): Promise<CreatedWechatUser> {
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
    if (user === undefined) throw identityConflictError();
    assertActiveUser(user);
    return { authVersion: user.authVersion, userId: user.userId };
  }

  private async insertIdentity(
    transaction: DatabaseTransaction,
    input: Pick<ResolveWechatIdentityInput, 'appId' | 'provider' | 'subject'>,
    userId: string,
  ): Promise<void> {
    await transaction.insert(userAuthIdentities).values({
      appId: input.appId,
      id: randomUUID(),
      provider: input.provider,
      subject: input.subject,
      userId,
    });
  }

  private async ensureUnionAccount(
    transaction: DatabaseTransaction,
    userId: string,
    unionId: string | undefined,
  ): Promise<void> {
    if (unionId === undefined) return;

    const [byUnion] = await transaction
      .select({ userId: wechatUnionAccounts.userId })
      .from(wechatUnionAccounts)
      .where(eq(wechatUnionAccounts.unionId, unionId))
      .limit(1)
      .for('update');
    if (byUnion !== undefined) {
      if (byUnion.userId !== userId) throw identityConflictError();
      return;
    }

    const [byUser] = await transaction
      .select({ unionId: wechatUnionAccounts.unionId })
      .from(wechatUnionAccounts)
      .where(eq(wechatUnionAccounts.userId, userId))
      .limit(1)
      .for('update');
    if (byUser !== undefined) {
      if (byUser.unionId !== unionId) throw identityConflictError();
      return;
    }

    await transaction.insert(wechatUnionAccounts).values({ id: randomUUID(), unionId, userId });
  }
}

function assertActiveUser(user: {
  readonly cloudbaseUid: string | null;
  readonly deletedAt: Date | null;
  readonly status: string;
}): void {
  if (user.cloudbaseUid === null || user.status !== 'active' || user.deletedAt !== null) {
    throw new ApiError({
      code: 'FORBIDDEN',
      statusCode: 403,
      userMessage: '该账号当前无法登录。',
    });
  }
}

function identityConflictError(): ApiError {
  return new ApiError({
    code: 'CONFLICT',
    statusCode: 409,
    userMessage: '微信身份状态冲突，请联系管理员处理。',
  });
}

function identityConfigurationError(): ApiError {
  return new ApiError({
    code: 'SERVICE_UNAVAILABLE',
    statusCode: 503,
    userMessage: '微信登录暂未配置，请稍后重试。',
  });
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY'
  );
}
