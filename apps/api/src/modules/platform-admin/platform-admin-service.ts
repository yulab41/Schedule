import { createHmac, randomUUID } from 'node:crypto';

import type {
  PlatformBackup,
  PlatformBackupList,
  PlatformAdminUserAccountList,
  PasswordIdentityAssignmentRequest,
  PasswordIdentityAssignmentResponse,
  PlatformJobRun,
  PlatformJobStatusPage,
  PlatformMeResponse,
  PlatformAdminUserDetailsList,
  UpdatePlatformUserProfileRequest,
  UpdatePlatformUserProfileResponse,
  ResetPlatformUserPasswordRequest,
  ResetPlatformUserPasswordResponse,
  UpdatePlatformUserStatusInput,
} from '@schedule/contracts';
import {
  backupArchives,
  groups,
  platformJobRuns,
  userPasswordCredentials,
  userProfiles,
  users,
  withTransaction,
  type DatabaseClient,
} from '@schedule/database';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';

import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import { isDuplicateKeyError } from '../../database-error.js';
import { ApiError } from '../../plugins/error-handler.js';
import { AuditWriter } from '../audit/audit-writer.js';
import { hashPassword, normalizeUsername } from '../auth/password-auth-service.js';
import {
  normalizeAccountMobilePhone,
  setAccountMobilePhone,
} from '../users/account-mobile-phone.js';
import { assertExpectedVersion } from '../concurrency/version-guard.js';
import {
  assertExpectedAuthVersion,
  createPlatformAdminFingerprint,
  runPlatformAdminMutation,
} from './platform-admin-operation.js';
import { requirePlatformAdmin } from './platform-admin.js';

const recycleWindowDays = 30;

export class PlatformAdminService {
  private readonly auditWriter = new AuditWriter();

  public constructor(
    private readonly databaseClient: DatabaseClient,
    private readonly allowedCloudbaseUids: ReadonlySet<string>,
    private readonly operationSecret?: string,
  ) {}

  public async listJobRuns(identity: AuthenticatedIdentity): Promise<PlatformJobStatusPage> {
    return withTransaction(this.databaseClient, async (transaction) => {
      await requirePlatformAdmin(transaction, identity, this.allowedCloudbaseUids);
      const runs = await transaction
        .select()
        .from(platformJobRuns)
        .orderBy(desc(platformJobRuns.startedAt), desc(platformJobRuns.id))
        .limit(50);

      return { runs: runs.map(toJobRun) };
    });
  }

  public async me(identity: AuthenticatedIdentity): Promise<PlatformMeResponse> {
    if (this.allowedCloudbaseUids.has(identity.cloudbaseUid)) {
      return { isPlatformAdmin: true };
    }
    const [user] = await this.databaseClient.database
      .select({ isDeveloperAdmin: users.isDeveloperAdmin })
      .from(users)
      .where(
        and(
          eq(users.cloudbaseUid, identity.cloudbaseUid),
          eq(users.status, 'active'),
          isNull(users.deletedAt),
        ),
      )
      .limit(1);
    return { isPlatformAdmin: user?.isDeveloperAdmin === 1 };
  }

  public async diagnosticsAccess(
    identity: AuthenticatedIdentity,
  ): Promise<{ readonly allowed: boolean }> {
    // The account seeded by 0037 is the designated admin, not every group/platform administrator.
    const [user] = await this.databaseClient.database
      .select({ isDeveloperAdmin: users.isDeveloperAdmin })
      .from(users)
      .where(
        and(
          eq(users.id, '00000000-0000-4000-8000-000000000001'),
          eq(users.cloudbaseUid, identity.cloudbaseUid),
          eq(users.status, 'active'),
          isNull(users.deletedAt),
        ),
      )
      .limit(1);
    return { allowed: user?.isDeveloperAdmin === 1 };
  }

  public async listUserAccounts(
    identity: AuthenticatedIdentity,
  ): Promise<PlatformAdminUserAccountList> {
    return withTransaction(this.databaseClient, async (transaction) => {
      await requirePlatformAdmin(transaction, identity, this.allowedCloudbaseUids);
      const rows = await transaction
        .select({
          authVersion: users.authVersion,
          hasPassword: userPasswordCredentials.passwordHash,
          id: users.id,
          status: users.status,
          username: userPasswordCredentials.username,
        })
        .from(users)
        .leftJoin(userPasswordCredentials, eq(userPasswordCredentials.userId, users.id))
        .where(isNull(users.deletedAt))
        .orderBy(users.createdAt, users.id);
      return {
        users: rows.map((row) => ({
          authVersion: row.authVersion,
          hasPassword: row.hasPassword !== null,
          id: row.id,
          status: row.status as 'active' | 'suspended',
          ...(row.username === null ? {} : { username: row.username }),
        })),
      };
    });
  }

  public async listUserDetails(
    identity: AuthenticatedIdentity,
  ): Promise<PlatformAdminUserDetailsList> {
    return withTransaction(this.databaseClient, async (transaction) => {
      await requirePlatformAdmin(transaction, identity, this.allowedCloudbaseUids);
      const rows = await transaction
        .select({
          id: users.id,
          status: users.status,
          authVersion: users.authVersion,
          accountVersion: users.version,
          profileVersion: userProfiles.version,
          realName: userProfiles.realName,
          mobilePhone: users.mobilePhone,
          username: userPasswordCredentials.username,
          passwordHash: userPasswordCredentials.passwordHash,
          hasWechat: sql<number>`EXISTS(SELECT 1 FROM user_auth_identities i WHERE i.user_id = ${users.id} AND i.provider = 'wechat_mini_program')`,
          hasMembership: sql<number>`EXISTS(SELECT 1 FROM group_memberships m WHERE m.user_id = ${users.id} AND m.deleted_at IS NULL AND m.status = 'active')`,
          hasHistory: sql<number>`EXISTS(SELECT 1 FROM group_memberships m JOIN shift_assignments s ON s.planned_membership_id = m.id OR s.actual_membership_id = m.id WHERE m.user_id = ${users.id})`,
        })
        .from(users)
        .leftJoin(
          userProfiles,
          and(eq(userProfiles.userId, users.id), isNull(userProfiles.deletedAt)),
        )
        .leftJoin(userPasswordCredentials, eq(userPasswordCredentials.userId, users.id))
        .where(isNull(users.deletedAt))
        .orderBy(users.createdAt, users.id);
      return {
        users: rows.map((row) => ({
          id: row.id,
          status: row.status as 'active' | 'suspended',
          authVersion: row.authVersion,
          accountVersion: row.accountVersion,
          profileVersion: row.profileVersion ?? 0,
          hasPassword: row.passwordHash !== null,
          ...(row.realName === null ? {} : { realName: row.realName }),
          ...(row.mobilePhone === null ? {} : { mobilePhone: row.mobilePhone }),
          ...(row.username === null ? {} : { username: row.username }),
          accountKind:
            row.username !== null
              ? 'password'
              : Number(row.hasWechat) > 0
                ? 'wechat'
                : Number(row.hasMembership) > 0
                  ? 'unbound-member'
                  : Number(row.hasHistory) > 0
                    ? 'history-member'
                    : 'incomplete',
        })),
      };
    });
  }

  public async updateUserProfile(
    identity: AuthenticatedIdentity,
    userId: string,
    input: UpdatePlatformUserProfileRequest,
  ): Promise<UpdatePlatformUserProfileResponse> {
    return runPlatformAdminMutation({
      retryDeadlocks: true,
      allowedCloudbaseUids: this.allowedCloudbaseUids,
      databaseClient: this.databaseClient,
      identity,
      operationId: input.operationId,
      scope: 'platform_user_profile_update',
      requestFingerprint: createPlatformAdminFingerprint({
        userId,
        ...input,
        mobilePhone: normalizeAccountMobilePhone(input.mobilePhone),
      }),
      run: async (transaction, actorUserId) => {
        const [account] = await transaction
          .select({ version: users.version })
          .from(users)
          .where(and(eq(users.id, userId), isNull(users.deletedAt)))
          .limit(1)
          .for('update');
        if (account === undefined)
          throw new ApiError({ code: 'NOT_FOUND', statusCode: 404, userMessage: '账号不存在。' });
        const [profile] = await transaction
          .select({ realName: userProfiles.realName, version: userProfiles.version })
          .from(userProfiles)
          .where(and(eq(userProfiles.userId, userId), isNull(userProfiles.deletedAt)))
          .limit(1)
          .for('update');
        assertExpectedVersion({
          actualVersion: account.version,
          expectedVersion: input.expectedAccountVersion,
          id: userId,
          objectType: 'platform_user',
        });
        assertExpectedVersion({
          actualVersion: profile?.version ?? 0,
          expectedVersion: input.expectedProfileVersion,
          id: userId,
          objectType: 'user_profile',
        });
        if (profile === undefined)
          await transaction.insert(userProfiles).values({ userId, realName: input.realName });
        else if (profile.realName !== input.realName)
          await transaction
            .update(userProfiles)
            .set({ realName: input.realName, version: sql`${userProfiles.version} + 1` })
            .where(eq(userProfiles.userId, userId));
        await setAccountMobilePhone(transaction, userId, input.mobilePhone);
        const [updated] = await transaction
          .select({ version: users.version })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);
        await this.auditWriter.append(transaction, {
          action: 'platform_user_profile_updated',
          actorUserId,
          metadata: { fields: ['realName', 'mobilePhone'] },
          operationId: input.operationId,
          outcome: 'completed',
          targetId: userId,
          targetType: 'user',
        });
        return {
          accountVersion: updated!.version,
          profileVersion:
            profile === undefined
              ? 1
              : profile.version + (profile.realName === input.realName ? 0 : 1),
        };
      },
    });
  }

  public async resetUserPassword(
    identity: AuthenticatedIdentity,
    userId: string,
    input: ResetPlatformUserPasswordRequest,
  ): Promise<ResetPlatformUserPasswordResponse> {
    if (this.operationSecret === undefined || this.operationSecret.length < 32)
      throw new ApiError({
        code: 'SERVICE_UNAVAILABLE',
        statusCode: 503,
        userMessage: '密码管理暂未配置。',
      });
    const requestFingerprint = createHmac('sha256', this.operationSecret)
      .update(
        JSON.stringify([
          'platform-password-reset-v1',
          userId,
          input.expectedAuthVersion,
          input.newPassword,
        ]),
      )
      .digest('hex');
    return runPlatformAdminMutation({
      retryDeadlocks: true,
      allowedCloudbaseUids: this.allowedCloudbaseUids,
      databaseClient: this.databaseClient,
      identity,
      operationId: input.operationId,
      scope: 'platform_user_password_reset',
      requestFingerprint,
      run: async (transaction, actorUserId) => {
        const [account] = await transaction
          .select({ authVersion: users.authVersion })
          .from(users)
          .where(and(eq(users.id, userId), isNull(users.deletedAt)))
          .limit(1)
          .for('update');
        if (account === undefined)
          throw new ApiError({ code: 'NOT_FOUND', statusCode: 404, userMessage: '账号不存在。' });
        assertExpectedAuthVersion({
          actualAuthVersion: account.authVersion,
          expectedAuthVersion: input.expectedAuthVersion,
          userId,
        });
        const [credential] = await transaction
          .select({ userId: userPasswordCredentials.userId })
          .from(userPasswordCredentials)
          .where(eq(userPasswordCredentials.userId, userId))
          .limit(1)
          .for('update');
        if (credential === undefined)
          throw new ApiError({
            code: 'CONFLICT',
            statusCode: 409,
            userMessage: '请先为该账号分配用户名。',
          });
        const passwordHash = await hashPassword(input.newPassword);
        await transaction
          .update(userPasswordCredentials)
          .set({ passwordHash })
          .where(eq(userPasswordCredentials.userId, userId));
        await transaction
          .update(users)
          .set({ authVersion: sql`${users.authVersion} + 1`, version: sql`${users.version} + 1` })
          .where(eq(users.id, userId));
        await this.auditWriter.append(transaction, {
          action: 'platform_user_password_reset',
          actorUserId,
          metadata: { passwordConfigured: true },
          operationId: input.operationId,
          outcome: 'completed',
          targetId: userId,
          targetType: 'user',
        });
        return { authVersion: account.authVersion + 1, passwordConfigured: true };
      },
    });
  }

  public async assignPasswordIdentity(
    identity: AuthenticatedIdentity,
    userId: string,
    input: PasswordIdentityAssignmentRequest,
  ): Promise<PasswordIdentityAssignmentResponse> {
    const username = normalizeUsername(input.username);
    try {
      return await runPlatformAdminMutation({
        allowedCloudbaseUids: this.allowedCloudbaseUids,
        databaseClient: this.databaseClient,
        identity,
        operationId: input.operationId,
        requestFingerprint: createPlatformAdminFingerprint({
          expectedAuthVersion: input.expectedAuthVersion,
          userId,
          username,
        }),
        run: async (transaction, actorUserId) => {
          const [target] = await transaction
            .select({
              authVersion: users.authVersion,
              cloudbaseUid: users.cloudbaseUid,
              credentialUsername: userPasswordCredentials.username,
              id: users.id,
              isDeveloperAdmin: users.isDeveloperAdmin,
              passwordHash: userPasswordCredentials.passwordHash,
              status: users.status,
            })
            .from(users)
            .leftJoin(userPasswordCredentials, eq(userPasswordCredentials.userId, users.id))
            .where(and(eq(users.id, userId), isNull(users.deletedAt)))
            .limit(1)
            .for('update');
          if (target === undefined)
            throw new ApiError({
              code: 'NOT_FOUND',
              statusCode: 404,
              userMessage: '用户不存在。',
            });
          assertExpectedAuthVersion({
            actualAuthVersion: target.authVersion,
            expectedAuthVersion: input.expectedAuthVersion,
            userId,
          });
          if (target.isDeveloperAdmin === 1)
            throw new ApiError({
              code: 'FORBIDDEN',
              statusCode: 403,
              userMessage: '后台系统账号不能通过此接口修改。',
            });
          if (target.credentialUsername === username) {
            return {
              authVersion: target.authVersion,
              passwordConfigured: target.passwordHash !== null,
              username,
            };
          }
          if (target.credentialUsername === null) {
            await transaction.insert(userPasswordCredentials).values({
              passwordHash: null,
              userId,
              username,
            });
          } else {
            await transaction
              .update(userPasswordCredentials)
              .set({ username })
              .where(eq(userPasswordCredentials.userId, userId));
          }
          await transaction
            .update(users)
            .set({
              authVersion: sql`${users.authVersion} + 1`,
              cloudbaseUid: target.cloudbaseUid ?? `password_${userId}`,
              version: sql`${users.version} + 1`,
            })
            .where(eq(users.id, userId));
          await this.auditWriter.append(transaction, {
            action: 'password_identity_assigned',
            actorUserId,
            metadata: { passwordConfigured: target.passwordHash !== null },
            operationId: input.operationId,
            outcome: 'completed',
            targetId: userId,
            targetType: 'user',
          });
          return {
            authVersion: target.authVersion + 1,
            passwordConfigured: target.passwordHash !== null,
            username,
          };
        },
        scope: 'platform_password_identity_assign',
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ApiError({
          code: 'CONFLICT',
          statusCode: 409,
          userMessage: '该用户名已被其他账号使用。',
        });
      }
      throw error;
    }
  }

  public async listBackups(identity: AuthenticatedIdentity): Promise<PlatformBackupList> {
    return withTransaction(this.databaseClient, async (transaction) => {
      await requirePlatformAdmin(transaction, identity, this.allowedCloudbaseUids);
      const archives = await transaction
        .select()
        .from(backupArchives)
        .where(isNull(backupArchives.deletedAt))
        .orderBy(desc(backupArchives.createdAt), desc(backupArchives.id))
        .limit(100);

      return { archives: archives.map(toBackup) };
    });
  }

  public async restoreGroup(identity: AuthenticatedIdentity, groupId: string): Promise<void> {
    await withTransaction(this.databaseClient, async (transaction) => {
      const actorUserId = await requirePlatformAdmin(
        transaction,
        identity,
        this.allowedCloudbaseUids,
      );
      const [group] = await transaction
        .select({ deletedAt: groups.deletedAt, id: groups.id })
        .from(groups)
        .where(eq(groups.id, groupId))
        .limit(1)
        .for('update');
      if (group === undefined || group.deletedAt === null) {
        throw new ApiError({
          code: 'NOT_FOUND',
          statusCode: 404,
          userMessage: '群组不存在或不在回收站中。',
        });
      }

      const recycleCutoff = new Date(Date.now() - recycleWindowDays * 24 * 60 * 60 * 1000);
      if (group.deletedAt < recycleCutoff) {
        throw new ApiError({
          code: 'CONFLICT',
          statusCode: 409,
          userMessage: '群组已超过 30 天回收期，无法恢复。',
        });
      }

      await transaction
        .update(groups)
        .set({ deletedAt: null, version: sql`${groups.version} + 1` })
        .where(eq(groups.id, groupId));
      await this.auditWriter.append(transaction, {
        action: 'group_restore',
        actorUserId,
        metadata: { deletedAt: group.deletedAt.toISOString() },
        operationId: randomUUID(),
        outcome: 'completed',
        targetId: groupId,
        targetType: 'group',
      });
    });
  }

  public async setUserStatus(
    identity: AuthenticatedIdentity,
    userId: string,
    input: UpdatePlatformUserStatusInput,
  ): Promise<{ readonly id: string; readonly status: 'active' | 'suspended' }> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const actorUserId = await requirePlatformAdmin(
        transaction,
        identity,
        this.allowedCloudbaseUids,
      );
      const [user] = await transaction
        .select({ id: users.id, status: users.status })
        .from(users)
        .where(and(eq(users.id, userId), isNull(users.deletedAt)))
        .limit(1)
        .for('update');
      if (user === undefined) {
        throw new ApiError({
          code: 'NOT_FOUND',
          statusCode: 404,
          userMessage: '用户不存在。',
        });
      }
      if (user.status === input.status) {
        throw new ApiError({
          code: 'CONFLICT',
          statusCode: 409,
          userMessage: `该用户已经是${input.status === 'active' ? '正常' : '封禁'}状态。`,
        });
      }

      await transaction
        .update(users)
        .set({ status: input.status, version: sql`${users.version} + 1` })
        .where(eq(users.id, userId));
      await this.auditWriter.append(transaction, {
        action: 'user_status_change',
        actorUserId,
        metadata: { from: user.status, to: input.status },
        operationId: randomUUID(),
        outcome: 'completed',
        targetId: userId,
        targetType: 'user',
      });

      return { id: userId, status: input.status };
    });
  }
}

function toJobRun(row: typeof platformJobRuns.$inferSelect): PlatformJobRun {
  return {
    id: row.id,
    jobName: row.jobName,
    startedAt: row.startedAt.toISOString(),
    status: row.status,
    ...(row.finishedAt === null ? {} : { finishedAt: row.finishedAt.toISOString() }),
    ...(row.summary === null ? {} : { summary: row.summary }),
  };
}

function toBackup(row: typeof backupArchives.$inferSelect): PlatformBackup {
  return {
    backupKind: row.backupKind,
    createdAt: row.createdAt.toISOString(),
    fileSize: row.fileSize,
    id: row.id,
    rowCount: row.rowCount,
    sha256: row.sha256,
    storageKey: row.storageKey,
    tableCount: row.tableCount,
  };
}
