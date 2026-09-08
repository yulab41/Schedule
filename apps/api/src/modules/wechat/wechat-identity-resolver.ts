import { randomUUID } from 'node:crypto';

import {
  type DatabaseClient,
  type DatabaseTransaction,
  userAuthIdentities,
  users,
  wechatIdentityDetachments,
} from '@schedule/database';
import { and, eq, or } from 'drizzle-orm';

import { isDuplicateKeyError } from '../../database-error.js';
import {
  lockWechatBindingScope,
  invalidateWechatBindingProofs,
  withWechatBindingTransaction,
} from './wechat-binding-transaction.js';
import { ApiError } from '../../plugins/error-handler.js';
import { hashWechatIdentitySubject } from './wechat-identity-hash.js';

export type WechatIdentityProvider = 'wechat_mini_program';

interface CreatedWechatUser {
  readonly authVersion: number;
  readonly userId: string;
}

interface ResolveWechatIdentityInput {
  readonly allowDetachedIdentity?: boolean | undefined;
  readonly targetUserId?: string | undefined;
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
      return await withWechatBindingTransaction(this.databaseClient, async (transaction) => {
        await lockWechatBindingScope(transaction, input.appId, input.subject);
        return this.resolveInTransaction(transaction, input);
      });
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
      if (input.targetUserId !== undefined)
        return this.bindTarget(transaction, input, input.targetUserId);
      const detachment = await this.findDetachment(transaction, input);
      if (detachment !== undefined && input.allowDetachedIdentity !== true) {
        return undefined;
      }
      const existingIdentity = await this.findIdentity(transaction, input);
      if (existingIdentity !== undefined) {
        if (existingIdentity.appId === null) {
          await transaction
            .update(userAuthIdentities)
            .set({ appId: input.appId })
            .where(eq(userAuthIdentities.id, existingIdentity.id));
        } else if (existingIdentity.appId !== input.appId) {
          throw wechatBindingConflictError('WECHAT_APP_ID_MISMATCH');
        }
        const user = await this.getActiveUser(transaction, existingIdentity.userId);
        await this.clearMatchingDetachment(transaction, detachment, user.userId);
        await input.onResolved?.(transaction, user.userId);
        return { ...user, isNewUser: false };
      }

      if (input.provider === 'wechat_mini_program') {
        const legacyUser = await this.findLegacyMiniUser(transaction, input.subject);
        if (legacyUser !== undefined) {
          await this.insertIdentity(transaction, input, legacyUser.userId);
          await this.clearMatchingDetachment(transaction, detachment, legacyUser.userId);
          await input.onResolved?.(transaction, legacyUser.userId);
          return { ...legacyUser, isNewUser: false };
        }
      }

      if (input.createUser === undefined) return undefined;
      const created = await input.createUser(transaction);
      await this.insertIdentity(transaction, input, created.userId);
      await this.clearMatchingDetachment(transaction, detachment, created.userId);
      await input.onResolved?.(transaction, created.userId);
      return { ...created, isNewUser: true };
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw identityConflictError();
      }
      throw error;
    }
  }

  private async bindTarget(
    transaction: DatabaseTransaction,
    input: ResolveWechatIdentityInput,
    userId: string,
  ): Promise<ResolvedWechatIdentity> {
    const user = await this.getActiveUser(transaction, userId);
    const existing = await this.findIdentity(transaction, input);
    if (existing !== undefined && existing.appId !== null && existing.appId !== input.appId)
      throw wechatBindingConflictError('WECHAT_APP_ID_MISMATCH');
    if (existing !== undefined && existing.userId !== userId)
      throw wechatBindingConflictError('WECHAT_IDENTITY_IN_USE');
    const targetIdentities = await transaction
      .select({ subject: userAuthIdentities.subject, appId: userAuthIdentities.appId })
      .from(userAuthIdentities)
      .where(
        and(
          eq(userAuthIdentities.provider, 'wechat_mini_program'),
          eq(userAuthIdentities.userId, userId),
        ),
      )
      .for('update');
    if (targetIdentities.some((identity) => identity.subject !== input.subject))
      throw wechatBindingConflictError('WECHAT_ACCOUNT_ALREADY_BOUND');
    if (
      targetIdentities.some((identity) => identity.appId !== null && identity.appId !== input.appId)
    )
      throw wechatBindingConflictError('WECHAT_APP_ID_MISMATCH');
    const [target] = await transaction
      .select({ subject: users.wechatOpenid })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
      .for('update');
    if (target?.subject !== null && target?.subject !== input.subject)
      throw wechatBindingConflictError('WECHAT_ACCOUNT_ALREADY_BOUND');
    const legacyOwner = await this.findLegacyMiniUser(transaction, input.subject);
    if (legacyOwner !== undefined && legacyOwner.userId !== userId)
      throw wechatBindingConflictError('WECHAT_IDENTITY_IN_USE');
    if (existing === undefined) await this.insertIdentity(transaction, input, userId);
    else if (existing.appId === null)
      await transaction
        .update(userAuthIdentities)
        .set({ appId: input.appId })
        .where(eq(userAuthIdentities.id, existing.id));
    await transaction
      .update(users)
      .set({ wechatOpenid: input.subject })
      .where(eq(users.id, userId));
    // Suppression markers may be replaced; the immutable unbind audit stays intact.
    await transaction
      .delete(wechatIdentityDetachments)
      .where(
        and(
          eq(wechatIdentityDetachments.provider, 'wechat_mini_program'),
          eq(wechatIdentityDetachments.appId, input.appId),
          or(
            eq(wechatIdentityDetachments.subjectHash, hashWechatIdentitySubject(input.subject)),
            eq(wechatIdentityDetachments.userId, userId),
          ),
        ),
      );
    await invalidateWechatBindingProofs(transaction, input.appId, input.subject, userId);
    await input.onResolved?.(transaction, userId);
    return { ...user, isNewUser: false };
  }

  private async clearMatchingDetachment(
    transaction: DatabaseTransaction,
    detachment: { readonly id: string; readonly userId: string } | undefined,
    userId: string,
  ): Promise<void> {
    if (detachment === undefined) return;
    if (detachment.userId !== userId) throw identityConflictError();
    await transaction
      .delete(wechatIdentityDetachments)
      .where(eq(wechatIdentityDetachments.id, detachment.id));
  }

  private async findDetachment(
    transaction: DatabaseTransaction,
    input: Pick<ResolveWechatIdentityInput, 'appId' | 'provider' | 'subject'>,
  ): Promise<{ readonly id: string; readonly userId: string } | undefined> {
    if (input.provider !== 'wechat_mini_program') return undefined;
    const [detachment] = await transaction
      .select({ id: wechatIdentityDetachments.id, userId: wechatIdentityDetachments.userId })
      .from(wechatIdentityDetachments)
      .where(
        and(
          eq(wechatIdentityDetachments.provider, input.provider),
          eq(wechatIdentityDetachments.appId, input.appId),
          eq(wechatIdentityDetachments.subjectHash, hashWechatIdentitySubject(input.subject)),
        ),
      )
      .limit(1)
      .for('update');
    return detachment;
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

export function wechatBindingConflictError(
  code: 'WECHAT_IDENTITY_IN_USE' | 'WECHAT_ACCOUNT_ALREADY_BOUND' | 'WECHAT_APP_ID_MISMATCH',
): ApiError {
  const messages = {
    WECHAT_IDENTITY_IN_USE: '当前微信仍绑定其他账号，请先解除原账号绑定。',
    WECHAT_ACCOUNT_ALREADY_BOUND: '目标账号已绑定其他微信，请先解除绑定。',
    WECHAT_APP_ID_MISMATCH: '微信应用身份不匹配，请重新从当前小程序登录。',
  };
  return new ApiError({ code, statusCode: 409, userMessage: messages[code] });
}
