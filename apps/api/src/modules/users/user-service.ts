import { randomUUID } from 'node:crypto';

import type {
  CreateUserProfileRequest,
  UpdateUserProfileRequest,
  UserProfile,
} from '@schedule/contracts';
import { type DatabaseClient, userProfiles, users, withTransaction } from '@schedule/database';
import { and, eq, exists, isNull, sql } from 'drizzle-orm';

import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import { ApiError } from '../../plugins/error-handler.js';

export class UserService {
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
    const profile = await this.getActiveProfile(identity.cloudbaseUid);
    const activeUser = this.databaseClient.database
      .select({ id: users.id })
      .from(users)
      .where(
        and(eq(users.id, userProfiles.userId), eq(users.status, 'active'), isNull(users.deletedAt)),
      );

    const [result] = await this.databaseClient.database
      .update(userProfiles)
      .set({
        realName: input.realName,
        version: sql`${userProfiles.version} + 1`,
      })
      .where(
        and(
          eq(userProfiles.userId, profile.id),
          eq(userProfiles.version, input.version),
          isNull(userProfiles.deletedAt),
          exists(activeUser),
        ),
      );

    if (result.affectedRows !== 1) {
      let latestVersion = profile.version;
      try {
        latestVersion = (await this.getActiveProfile(identity.cloudbaseUid)).version;
      } catch {
        // A suspended or deleted user cannot be re-read; keep the last known version.
      }
      throw new ApiError({
        code: 'CONFLICT',
        latestData: {
          id: profile.id,
          objectType: 'user_profile',
          version: latestVersion,
        },
        statusCode: 409,
        userMessage: '资料已被更新，请刷新后重试。',
      });
    }

    return { ...profile, realName: input.realName, version: profile.version + 1 };
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
