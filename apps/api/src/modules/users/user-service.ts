import { randomUUID } from 'node:crypto';

import type {
  CreateUserProfileRequest,
  UpdateUserProfileRequest,
  UserProfile,
  UserProfileAvatarDeleteResponse,
  UserProfileAvatarMutationResponse,
} from '@schedule/contracts';
import {
  type DatabaseClient,
  userProfileAvatars,
  userProfiles,
  users,
  withTransaction,
} from '@schedule/database';
import { and, eq, isNull, sql } from 'drizzle-orm';

import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import { ApiError } from '../../plugins/error-handler.js';
import {
  inspectUserProfileAvatar,
  type StoredUserProfileAvatar,
  type UserProfileAvatarContentType,
} from './user-avatar.js';
import { toUserProfile } from './user-profile.js';

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

  public async getCurrentAvatar(identity: AuthenticatedIdentity): Promise<StoredUserProfileAvatar> {
    const profile = await this.getActiveProfile(identity.cloudbaseUid);
    const [avatar] = await this.databaseClient.database
      .select({
        content: userProfileAvatars.content,
        contentType: userProfileAvatars.contentType,
        sha256: userProfileAvatars.sha256,
        version: userProfileAvatars.version,
      })
      .from(userProfileAvatars)
      .where(eq(userProfileAvatars.userId, profile.id))
      .limit(1);
    if (avatar === undefined) throw avatarNotFoundError();
    return {
      content: avatar.content,
      contentType: avatar.contentType as UserProfileAvatarContentType,
      sha256: avatar.sha256,
      version: avatar.version,
    };
  }

  public async replaceCurrentAvatar(
    identity: AuthenticatedIdentity,
    content: Buffer,
    contentType: string,
  ): Promise<UserProfileAvatarMutationResponse> {
    const profile = await this.getActiveProfile(identity.cloudbaseUid);
    const inspected = inspectUserProfileAvatar(content, contentType);
    return withTransaction(this.databaseClient, async (transaction) => {
      await transaction
        .insert(userProfileAvatars)
        .values({
          ...inspected,
          content,
          userId: profile.id,
        })
        .onDuplicateKeyUpdate({
          set: {
            ...inspected,
            content,
            version: sql`${userProfileAvatars.version} + 1`,
          },
        });
      const [stored] = await transaction
        .select({ avatarVersion: userProfileAvatars.version })
        .from(userProfileAvatars)
        .where(eq(userProfileAvatars.userId, profile.id))
        .limit(1)
        .for('update');
      if (stored === undefined) throw avatarWriteFailedError();
      return stored;
    });
  }

  public async deleteCurrentAvatar(
    identity: AuthenticatedIdentity,
  ): Promise<UserProfileAvatarDeleteResponse> {
    const profile = await this.getActiveProfile(identity.cloudbaseUid);
    const [result] = await this.databaseClient.database
      .delete(userProfileAvatars)
      .where(eq(userProfileAvatars.userId, profile.id));
    return { removed: result.affectedRows > 0 };
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

  private async getActiveProfile(cloudbaseUid: string): Promise<UserProfile> {
    const [profile] = await this.databaseClient.database
      .select({
        avatarVersion: userProfileAvatars.version,
        id: users.id,
        realName: userProfiles.realName,
        status: users.status,
        version: userProfiles.version,
      })
      .from(users)
      .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
      .leftJoin(userProfileAvatars, eq(userProfileAvatars.userId, users.id))
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

    return toUserProfile(profile);
  }
}

function avatarNotFoundError(): ApiError {
  return new ApiError({
    code: 'NOT_FOUND',
    statusCode: 404,
    userMessage: '当前账号尚未设置头像。',
  });
}

function avatarWriteFailedError(): ApiError {
  return new ApiError({
    code: 'INTERNAL_ERROR',
    statusCode: 500,
    userMessage: '头像暂时无法保存，请稍后重试。',
  });
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY'
  );
}
