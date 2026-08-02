import { randomUUID } from 'node:crypto';

import type { CreateScheduleExportInput, ScheduleExportJob } from '@schedule/contracts';
import type { DatabaseClient, DatabaseTransaction } from '@schedule/database';
import { exportJobs, groupMemberships, scheduleRoles, withTransaction } from '@schedule/database';
import { and, eq, isNull } from 'drizzle-orm';

import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import { ApiError } from '../../plugins/error-handler.js';
import { AuditWriter } from '../audit/audit-writer.js';
import { GroupPermissionService } from '../groups/permission-service.js';

export interface ExportDownloadResult {
  readonly content: string;
  readonly fileName: string;
}

export class ExportService {
  private readonly auditWriter = new AuditWriter();
  private readonly permissionService = new GroupPermissionService();

  public constructor(private readonly databaseClient: DatabaseClient) {}

  public async create(
    identity: AuthenticatedIdentity,
    groupId: string,
    input: CreateScheduleExportInput,
  ): Promise<ScheduleExportJob> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'manageScheduleConfiguration',
      );
      const periodType = getPeriodType(input.period);
      if (input.roleId !== undefined) {
        await this.assertRoleInGroup(transaction, groupId, input.roleId);
      }
      if (input.membershipId !== undefined) {
        await this.assertMembershipInGroup(transaction, groupId, input.membershipId);
      }

      const exportJobId = randomUUID();
      await transaction.insert(exportJobs).values({
        exportType: input.exportType,
        groupId,
        id: exportJobId,
        membershipId: input.membershipId ?? null,
        period: input.period,
        periodType,
        requestedByUserId: authorization.user.id,
        scheduleRoleId: input.roleId ?? null,
        status: 'pending',
      });
      await this.auditWriter.append(transaction, {
        action: 'schedule_export_created',
        actorUserId: authorization.user.id,
        groupId,
        metadata: {
          exportType: input.exportType,
          ...(input.membershipId === undefined ? {} : { membershipId: input.membershipId }),
          period: input.period,
          periodType,
          ...(input.roleId === undefined ? {} : { roleId: input.roleId }),
        },
        operationId: randomUUID(),
        outcome: 'completed',
        targetId: exportJobId,
        targetType: 'export_job',
      });

      return this.readJob(transaction, groupId, exportJobId);
    });
  }

  public async getJob(
    identity: AuthenticatedIdentity,
    groupId: string,
    exportJobId: string,
  ): Promise<ScheduleExportJob> {
    return withTransaction(this.databaseClient, async (transaction) => {
      await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'manageScheduleConfiguration',
      );
      return this.readJob(transaction, groupId, exportJobId);
    });
  }

  public async download(
    identity: AuthenticatedIdentity,
    groupId: string,
    exportJobId: string,
    now = new Date(),
  ): Promise<ExportDownloadResult> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const authorization = await this.permissionService.requirePermission(
        transaction,
        identity,
        groupId,
        'manageScheduleConfiguration',
      );
      const [job] = await transaction
        .select()
        .from(exportJobs)
        .where(and(eq(exportJobs.id, exportJobId), eq(exportJobs.groupId, groupId)))
        .limit(1)
        .for('update');
      if (job === undefined) {
        throw new ApiError({
          code: 'NOT_FOUND',
          statusCode: 404,
          userMessage: '导出任务不存在。',
        });
      }
      if (job.status !== 'completed' || job.fileContent === null) {
        throw new ApiError({
          code: 'CONFLICT',
          statusCode: 409,
          userMessage: '导出尚未完成，请稍后再试。',
        });
      }
      if (job.expiresAt !== null && job.expiresAt.valueOf() < now.valueOf()) {
        throw new ApiError({
          code: 'NOT_FOUND',
          statusCode: 404,
          userMessage: '导出链接已过期，请重新导出。',
        });
      }

      if (job.downloadedAt === null) {
        await transaction
          .update(exportJobs)
          .set({ downloadedAt: now })
          .where(eq(exportJobs.id, exportJobId));
      }
      await this.auditWriter.append(transaction, {
        action: 'schedule_export_downloaded',
        actorUserId: authorization.user.id,
        groupId,
        metadata: {
          exportType: job.exportType,
          period: job.period,
          periodType: job.periodType,
          rowCount: job.rowCount ?? 0,
        },
        operationId: randomUUID(),
        outcome: 'completed',
        targetId: exportJobId,
        targetType: 'export_job',
      });

      return {
        content: job.fileContent,
        fileName: `${job.exportType}-export-${job.period}.csv`,
      };
    });
  }

  private async assertRoleInGroup(
    transaction: DatabaseTransaction,
    groupId: string,
    roleId: string,
  ): Promise<void> {
    const [role] = await transaction
      .select({ id: scheduleRoles.id })
      .from(scheduleRoles)
      .where(
        and(
          eq(scheduleRoles.id, roleId),
          eq(scheduleRoles.groupId, groupId),
          isNull(scheduleRoles.deletedAt),
        ),
      )
      .limit(1);
    if (role === undefined) {
      throw new ApiError({
        code: 'VALIDATION_FAILED',
        statusCode: 400,
        userMessage: '排班角色不属于该群组。',
      });
    }
  }

  private async assertMembershipInGroup(
    transaction: DatabaseTransaction,
    groupId: string,
    membershipId: string,
  ): Promise<void> {
    const [membership] = await transaction
      .select({ id: groupMemberships.id })
      .from(groupMemberships)
      .where(
        and(
          eq(groupMemberships.id, membershipId),
          eq(groupMemberships.groupId, groupId),
          isNull(groupMemberships.deletedAt),
        ),
      )
      .limit(1);
    if (membership === undefined) {
      throw new ApiError({
        code: 'VALIDATION_FAILED',
        statusCode: 400,
        userMessage: '成员不属于该群组。',
      });
    }
  }

  private async readJob(
    transaction: DatabaseTransaction,
    groupId: string,
    exportJobId: string,
  ): Promise<ScheduleExportJob> {
    const [job] = await transaction
      .select()
      .from(exportJobs)
      .where(and(eq(exportJobs.id, exportJobId), eq(exportJobs.groupId, groupId)))
      .limit(1);
    if (job === undefined) {
      throw new ApiError({
        code: 'NOT_FOUND',
        statusCode: 404,
        userMessage: '导出任务不存在。',
      });
    }
    return toExportJob(job);
  }
}

function toExportJob(row: typeof exportJobs.$inferSelect): ScheduleExportJob {
  return {
    ...(row.completedAt === null ? {} : { completedAt: row.completedAt.toISOString() }),
    createdAt: row.createdAt.toISOString(),
    ...(row.error === null ? {} : { error: row.error }),
    ...(row.expiresAt === null ? {} : { expiresAt: row.expiresAt.toISOString() }),
    exportType: row.exportType,
    groupId: row.groupId,
    id: row.id,
    ...(row.membershipId === null ? {} : { membershipId: row.membershipId }),
    period: row.period,
    periodType: row.periodType,
    ...(row.scheduleRoleId === null ? {} : { roleId: row.scheduleRoleId }),
    ...(row.rowCount === null ? {} : { rowCount: row.rowCount }),
    status: row.status,
  };
}

function getPeriodType(period: string): 'month' | 'year' {
  if (/^\d{4}-(0[1-9]|1[0-2])$/u.test(period)) {
    return 'month';
  }
  if (/^(19|20)\d{2}$/u.test(period)) {
    return 'year';
  }
  throw new ApiError({
    code: 'VALIDATION_FAILED',
    statusCode: 400,
    userMessage: '导出周期必须是 YYYY-MM 或 YYYY。',
  });
}
