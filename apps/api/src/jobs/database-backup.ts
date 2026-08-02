import { randomUUID } from 'node:crypto';

import {
  backupArchives,
  type DatabaseTransaction,
  type DatabaseClient,
  withTransaction,
} from '@schedule/database';
import { eq, sql } from 'drizzle-orm';

import {
  backupFormatName,
  backupFormatVersion,
  computeFileSha256,
  computeTableChecksum,
  createBackupStorageKey,
  encryptBackupArchive,
  type BackupArchivePayload,
} from './backup-archive.js';
import { selectArchivesToDelete } from './backup-retention.js';
import type { BackupStorage } from './backup-storage.js';

export interface DatabaseBackupJobOptions {
  readonly encryptionKey: Buffer;
  readonly storage: BackupStorage;
}

export interface DatabaseBackupRunResult {
  readonly archiveId: string;
  readonly backupKind: 'daily' | 'monthly';
  readonly deletedArchives: number;
  readonly fileSize: number;
  readonly rowCount: number;
  readonly sha256: string;
  readonly storageKey: string;
  readonly tableCount: number;
}

export class DatabaseBackupJob {
  public constructor(
    private readonly databaseClient: DatabaseClient,
    private readonly options: DatabaseBackupJobOptions,
  ) {}

  public async run(now = new Date()): Promise<DatabaseBackupRunResult> {
    const payload = await readBackupPayload(this.databaseClient, now);
    const envelope = encryptBackupArchive(payload, this.options.encryptionKey);
    const content = Buffer.from(JSON.stringify(envelope), 'utf8');
    const storageKey = createBackupStorageKey(now, payload.backupKind);
    const sha256 = computeFileSha256(content);

    await this.options.storage.write(storageKey, content);

    try {
      const archiveId = randomUUID();
      await withTransaction(this.databaseClient, async (transaction) => {
        const [latest] = await transaction
          .select({ createdAt: backupArchives.createdAt })
          .from(backupArchives)
          .where(eq(backupArchives.storageKey, storageKey))
          .limit(1);
        if (latest === undefined) {
          await transaction.insert(backupArchives).values({
            backupKind: payload.backupKind,
            createdAt: now,
            fileSize: content.length,
            id: archiveId,
            rowCount: payload.totalRowCount,
            sha256,
            storageKey,
            tableCount: payload.tableCount,
          });
        }
      });

      const retention = await this.applyRetention();
      return {
        archiveId,
        backupKind: payload.backupKind,
        deletedArchives: retention.deleted,
        fileSize: content.length,
        rowCount: payload.totalRowCount,
        sha256,
        storageKey,
        tableCount: payload.tableCount,
      };
    } catch (error) {
      await this.options.storage.delete(storageKey);
      throw error;
    }
  }

  private async applyRetention(): Promise<{ readonly deleted: number }> {
    return withTransaction(this.databaseClient, async (transaction) => {
      const entries = await transaction
        .select({
          backupKind: backupArchives.backupKind,
          createdAt: backupArchives.createdAt,
          id: backupArchives.id,
          storageKey: backupArchives.storageKey,
        })
        .from(backupArchives)
        .where(sql`${backupArchives.deletedAt} is null`);
      const decision = selectArchivesToDelete(
        entries.map((entry) => ({
          backupKind: entry.backupKind,
          createdAt: entry.createdAt.toISOString(),
          id: entry.id,
        })),
        30,
        12,
      );
      if (decision.archiveIdsToDelete.length === 0) {
        return { deleted: 0 };
      }

      const keysByArchive = new Map(entries.map((entry) => [entry.id, entry.storageKey] as const));
      for (const archiveId of decision.archiveIdsToDelete) {
        const key = keysByArchive.get(archiveId);
        if (key !== undefined) {
          await this.options.storage.delete(key);
        }
        await transaction.delete(backupArchives).where(eq(backupArchives.id, archiveId));
      }

      return { deleted: decision.archiveIdsToDelete.length };
    });
  }
}

async function readBackupPayload(
  client: DatabaseClient,
  now: Date,
): Promise<
  BackupArchivePayload & {
    readonly backupKind: 'daily' | 'monthly';
    readonly tableCount: number;
    readonly totalRowCount: number;
  }
> {
  return withTransaction(client, async (transaction) => {
    const tableNames = await listTableNames(transaction);
    const tables: Record<string, { rowCount: number; rows: unknown[]; sha256: string }> = {};
    let totalRowCount = 0;

    for (const tableName of tableNames) {
      const [rows] = (await transaction.execute(
        sql.raw(`SELECT * FROM \`${tableName.replaceAll('`', '``')}\``),
      )) as unknown as [Record<string, unknown>[], unknown];
      totalRowCount += rows.length;
      tables[tableName] = {
        rowCount: rows.length,
        rows,
        sha256: computeTableChecksum(rows),
      };
    }

    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const [monthlyRows] = (await transaction.execute(
      sql`SELECT COUNT(*) AS count
          FROM backup_archives
          WHERE backup_kind = 'monthly' AND created_at >= ${monthStart}`,
    )) as unknown as [{ count: number }[], unknown];
    const hasMonthlyArchive = monthlyRows[0]?.count !== undefined && monthlyRows[0].count > 0;

    return {
      backupKind: hasMonthlyArchive ? 'daily' : 'monthly',
      createdAt: now.toISOString(),
      format: backupFormatName,
      formatVersion: backupFormatVersion,
      tableCount: tableNames.length,
      tables,
      totalRowCount,
    };
  });
}

async function listTableNames(transaction: DatabaseTransaction): Promise<readonly string[]> {
  const [rows] = (await transaction.execute(
    sql`SELECT TABLE_NAME
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
          AND TABLE_NAME <> '__drizzle_migrations'
        ORDER BY TABLE_NAME`,
  )) as unknown as [{ TABLE_NAME: string }[], unknown];
  return rows.map((row) => row.TABLE_NAME);
}
