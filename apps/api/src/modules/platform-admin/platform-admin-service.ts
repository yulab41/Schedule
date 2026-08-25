import { randomUUID } from 'node:crypto';

import type {
  PlatformBackup,
  PlatformBackupList,
  PlatformAdminUserAccountList,
  PasswordIdentityAssignmentRequest,
  PasswordIdentityAssignmentResponse,
  PlatformJobRun,
  PlatformJobStatusPage,
  PlatformMeResponse,
  UpdatePlatformUserStatusInput,
} from '@schedule/contracts';
import {
  backupArchives,
  groups,
  platformJobRuns,
  userPasswordCredentials,
  users,
  withTransaction,
  type DatabaseClient,
} from '@schedule/database';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';

import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import { isDuplicateKeyError } from '../../database-error.js';
import { ApiError } from '../../plugins/error-handler.js';
import { AuditWriter } from '../audit/audit-writer.js';
import { normalizeUsername } from '../auth/password-auth-service.js';
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
