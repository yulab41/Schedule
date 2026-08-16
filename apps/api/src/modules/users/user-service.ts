import { randomUUID } from 'node:crypto';

import type {
  CreateUserProfileRequest,
  DeregisterAccountResult,
  UpdateUserProfileRequest,
  UserProfile,
} from '@schedule/contracts';
import {
  type DatabaseClient,
  groupMemberContacts,
  userProfiles,
  users,
  withTransaction,
} from '@schedule/database';
import { and, eq, isNull, sql } from 'drizzle-orm';

import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import { ApiError } from '../../plugins/error-handler.js';
import { AuditWriter } from '../audit/audit-writer.js';

export class UserService {
  private readonly auditWriter = new AuditWriter();

  public constructor(private readonly databaseClient: DatabaseClient) {}

  public async register(
    identity: AuthenticatedIdentity,
    input: CreateUserProfileRequest,
  ): Promise<UserProfile> {
    try {
      return await withTransaction(this.databaseClient, async (transaction) => {
        const [existingUser] = await transaction
          .select({ id: users.id, status: users.status })
          .from(users)
          .where(eq(users.cloudbaseUid, identity.cloudbaseUid))
          .limit(1);

        if (existingUser !== undefined) {
          if (existingUser.status === 'active') {
            const [existingProfile] = await transaction
              .select({ userId: userProfiles.userId })
              .from(userProfiles)
              .where(eq(userProfiles.userId, existingUser.id))
              .limit(1);

            // 微信登录会先创建账号但不建资料；此时允许补齐真实姓名资料。
            if (existingProfile === undefined) {
              await transaction
                .insert(userProfiles)
                .values({ realName: input.realName, userId: existingUser.id });
              return { id: existingUser.id, realName: input.realName, version: 1 };
            }

            throw new ApiError({
              code: 'CONFLICT',
              statusCode: 409,
              userMessage: '该账号已完成注册。',
            });
          }

          throw new ApiError({
            code: 'FORBIDDEN',
            statusCode: 403,
            userMessage: '该账号当前无法完成注册。',
          });
        }

        const id = randomUUID();
        await transaction.insert(users).values({ cloudbaseUid: identity.cloudbaseUid, id });
        await transaction.insert(userProfiles).values({ realName: input.realName, userId: id });

        return { id, realName: input.realName, version: 1 };
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ApiError({
          code: 'CONFLICT',
          statusCode: 409,
          userMessage: '该账号已完成注册。',
        });
      }

      throw error;
    }
  }

  public async getCurrentProfile(identity: AuthenticatedIdentity): Promise<UserProfile> {
    return this.getActiveProfile(identity.cloudbaseUid);
  }

  public async updateCurrentProfile(
    identity: AuthenticatedIdentity,
    input: UpdateUserProfileRequest,
  ): Promise<UserProfile> {
    void identity;
    void input;
    throw new ApiError({
      code: 'FORBIDDEN',
      statusCode: 403,
      userMessage: '姓名由后台管理员统一维护，当前账号不能自行修改。',
    });
  }

  public async deregisterOwnAccount(
    identity: AuthenticatedIdentity,
  ): Promise<DeregisterAccountResult> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const [user] = await transaction
        .select({ id: users.id, isDeveloperAdmin: users.isDeveloperAdmin, status: users.status })
        .from(users)
        .where(and(eq(users.cloudbaseUid, identity.cloudbaseUid), isNull(users.deletedAt)))
        .limit(1)
        .for('update');

      if (user === undefined || user.status !== 'active') {
        throw new ApiError({
          code: 'NOT_FOUND',
          statusCode: 404,
          userMessage: '当前账号不可注销。',
        });
      }
      if (user.isDeveloperAdmin === 1) {
        throw new ApiError({
          code: 'FORBIDDEN',
          statusCode: 403,
          userMessage: '后台管理员账号不可注销。',
        });
      }

      await transaction
        .update(users)
        .set({
          cloudbaseUid: null,
          deletedAt: sql`current_timestamp(3)`,
          status: 'deleted',
          version: sql`${users.version} + 1`,
        })
        .where(eq(users.id, user.id));
      await transaction
        .update(groupMemberContacts)
        .set({
          isConfirmed: 0,
          mobilePhone: null,
          shortPhone: null,
          version: sql`${groupMemberContacts.version} + 1`,
        })
        .where(
          sql`membership_id IN (
            SELECT id FROM group_memberships
            WHERE user_id = ${user.id} AND deleted_at IS NULL
          )`,
        );
      await this.auditWriter.append(transaction, {
        action: 'user_deregister',
        actorUserId: user.id,
        metadata: { deregisteredAt: new Date().toISOString() },
        operationId: randomUUID(),
        outcome: 'completed',
        targetId: user.id,
        targetType: 'user',
      });

      return { id: user.id, status: 'deleted' };
    });
  }

  private async getActiveProfile(cloudbaseUid: string): Promise<UserProfile> {
    const [profile] = await this.databaseClient.database
      .select({
        id: users.id,
        realName: userProfiles.realName,
        status: users.status,
        version: userProfiles.version,
      })
      .from(users)
      .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
      .where(
        and(
          eq(users.cloudbaseUid, cloudbaseUid),
          isNull(users.deletedAt),
          isNull(userProfiles.deletedAt),
        ),
      )
      .limit(1);

    if (profile === undefined) {
      throw new ApiError({
        code: 'NOT_FOUND',
        statusCode: 404,
        userMessage: '当前账号尚未完成注册。',
      });
    }

    if (profile.status !== 'active') {
      throw new ApiError({
        code: 'FORBIDDEN',
        statusCode: 403,
        userMessage: '当前账号无法访问资料。',
      });
    }

    return { id: profile.id, realName: profile.realName, version: profile.version };
  }
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY'
  );
}
