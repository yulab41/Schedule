import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';

import {
  backupArchives,
  type DatabaseTransaction,
  type DatabaseClient,
  withTransaction,
} from '@schedule/database';
import { and, eq, inArray, isNotNull, sql } from 'drizzle-orm';

import { createBackupStorageKey, shouldIncludeBackupTable } from './backup-archive.js';
import { selectArchivesToDelete } from './backup-retention.js';
import type { BackupStorage } from './backup-storage.js';
import { encryptBackupFrames } from './backup-stream-format.js';
import { createBackupFrames } from './backup-stream-archive.js';

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
    if (!this.options.storage.writeStream)
      throw new Error('Backup storage must support streaming writes');
    const archiveId = randomUUID();
    const summary = { tableCount: 0, rowCount: 0 };
    const hash = createHash('sha256');
    let fileSize = 0;
    let storageKey: string | undefined;
    let registered = false;
    try {
      const backupKind = await this.databaseClient.database.transaction(
        async (transaction) => {
          const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
          const [monthlyRows] = (await transaction.execute(
            sql`SELECT COUNT(*) AS count FROM backup_archives WHERE backup_kind='monthly' AND created_at >= ${monthStart}`,
          )) as unknown as [{ count: number }[], unknown];
          const kind = Number(monthlyRows[0]?.count ?? 0) > 0 ? 'daily' : 'monthly';
          storageKey = createBackupStorageKey(now, kind).replace('.backup', `.${archiveId}.backup`);
          const names = await listTableNames(transaction);
          const encrypted = encryptBackupFrames(
            createBackupFrames(transaction, names, now, summary),
            this.options.encryptionKey,
          );
          await this.options.storage.writeStream!(
            storageKey,
            (async function* () {
              for await (const chunk of encrypted) {
                hash.update(chunk);
                fileSize += chunk.length;
                yield chunk;
              }
            })(),
          );
          return kind;
        },
        { isolationLevel: 'repeatable read', withConsistentSnapshot: true },
      );
      const sha256 = hash.digest('hex');
      const key = storageKey!;
      await withTransaction(this.databaseClient, async (transaction) => {
        await transaction.insert(backupArchives).values({
          backupKind,
          createdAt: now,
          fileSize,
          id: archiveId,
          rowCount: summary.rowCount,
          sha256,
          storageKey: key,
          tableCount: summary.tableCount,
        });
      });

      registered = true;
      const retention = await this.applyRetention();
      return {
        archiveId,
        backupKind,
        deletedArchives: retention.deleted,
        fileSize,
        rowCount: summary.rowCount,
        sha256,
        storageKey: key,
        tableCount: summary.tableCount,
      };
    } catch (error) {
      if (storageKey && !registered) await this.options.storage.delete(storageKey);
      throw error;
    }
  }

  private async applyRetention(): Promise<{ readonly deleted: number }> {
    const pending = await withTransaction(this.databaseClient, async (transaction) => {
      const entries = await transaction
        .select({
          backupKind: backupArchives.backupKind,
          createdAt: backupArchives.createdAt,
          id: backupArchives.id,
          storageKey: backupArchives.storageKey,
          deletedAt: backupArchives.deletedAt,
        })
        .from(backupArchives)
        .for('update');
      const decision = selectArchivesToDelete(
        entries
          .filter((entry) => entry.deletedAt === null)
          .map((entry) => ({
            backupKind: entry.backupKind,
            createdAt: entry.createdAt.toISOString(),
            id: entry.id,
          })),
        30,
        12,
      );
      if (decision.archiveIdsToDelete.length)
        await transaction
          .update(backupArchives)
          .set({ deletedAt: new Date() })
          .where(inArray(backupArchives.id, [...decision.archiveIdsToDelete]));
      const selected = new Set(decision.archiveIdsToDelete);
      return entries.filter((entry) => entry.deletedAt !== null || selected.has(entry.id));
    });
    let deleted = 0;
    for (const entry of pending) {
      await this.options.storage.delete(entry.storageKey);
      await this.databaseClient.database
        .delete(backupArchives)
        .where(and(eq(backupArchives.id, entry.id), isNotNull(backupArchives.deletedAt)));
      deleted++;
    }
    return { deleted };
  }
}

async function listTableNames(transaction: DatabaseTransaction): Promise<readonly string[]> {
  const [rows] = (await transaction.execute(
    sql`SELECT TABLE_NAME
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
          AND TABLE_TYPE = 'BASE TABLE'
          AND TABLE_NAME <> '__drizzle_migrations'
        ORDER BY TABLE_NAME`,
  )) as unknown as [{ TABLE_NAME: string }[], unknown];
  return rows.map((row) => row.TABLE_NAME).filter(shouldIncludeBackupTable);
}
