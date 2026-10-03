import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { open, readFile } from 'node:fs/promises';

import { type DatabaseClient, type DatabaseTransaction, withTransaction } from '@schedule/database';
import { sql } from 'drizzle-orm';
import { streamBackupMagic } from './backup-stream-format.js';
import {
  insertBackupRows,
  readBackupTableMetadata,
  restoreStreamBackupArchive,
} from './backup-stream-archive.js';

export const backupFormatName = 'medical-schedule-backup';
export const backupFormatVersion = 2;
export const backupKeyLengthBytes = 32;
const excludedBackupTableNames = new Set([
  'miniprogram_telemetry_events',
  'visitor_access_logs',
  'account_open_receipts',
]);

export type BackupFormatVersion = 1 | typeof backupFormatVersion;

export interface BackupTablePayload {
  readonly rowCount: number;
  readonly rows: readonly unknown[];
  readonly sha256: string;
}

export interface BackupArchivePayload {
  readonly createdAt: string;
  readonly format: typeof backupFormatName;
  readonly formatVersion: BackupFormatVersion;
  readonly tables: Readonly<Record<string, BackupTablePayload>>;
}

export interface EncryptedBackupEnvelope {
  readonly algorithm: 'aes-256-gcm';
  readonly ciphertext: string;
  readonly iv: string;
  readonly tag: string;
  readonly version: 1;
}

export interface RestoreBackupResult {
  readonly mismatches: readonly string[];
  readonly rowCount: number;
  readonly tableCount: number;
}

export function deriveBackupKey(value: string): Buffer {
  const trimmed = value.trim();
  if (/^[\da-f]{64}$/iu.test(trimmed)) {
    return Buffer.from(trimmed, 'hex');
  }

  const base64 = Buffer.from(trimmed, 'base64');
  if (base64.length === backupKeyLengthBytes) {
    return base64;
  }

  throw new Error('BACKUP_ENCRYPTION_KEY must be 32 bytes: 64 hexadecimal characters or base64.');
}

export function encryptBackupArchive(
  payload: BackupArchivePayload,
  key: Buffer,
): EncryptedBackupEnvelope {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);

  return {
    algorithm: 'aes-256-gcm',
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    version: 1,
  };
}

export function decryptBackupArchive(
  envelope: EncryptedBackupEnvelope,
  key: Buffer,
): BackupArchivePayload {
  if (envelope.algorithm !== 'aes-256-gcm' || envelope.version !== 1) {
    throw new Error('Unsupported backup encryption format.');
  }

  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
    decipher.final(),
  ]);
  const payload = JSON.parse(plaintext.toString('utf8')) as BackupArchivePayload;
  if (
    payload.format !== backupFormatName ||
    (payload.formatVersion !== 1 && payload.formatVersion !== backupFormatVersion)
  ) {
    throw new Error('The backup archive uses an unsupported format.');
  }

  return payload;
}

export function computeTableChecksum(rows: readonly unknown[]): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(rows)))
    .digest('hex');
}

export function computeFileSha256(content: Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

export function createBackupStorageKey(now: Date, kind: 'daily' | 'monthly'): string {
  return `backups/${kind}/${now.toISOString().replaceAll(':', '-')}.backup`;
}

export function shouldIncludeBackupTable(tableName: string): boolean {
  return !excludedBackupTableNames.has(tableName);
}

export function sanitizeBackupPayloadForRestore(
  payload: BackupArchivePayload,
): BackupArchivePayload {
  return {
    ...payload,
    tables: Object.fromEntries(
      Object.entries(payload.tables).filter(([tableName]) => shouldIncludeBackupTable(tableName)),
    ),
  };
}

export async function restoreBackupArchive(
  client: DatabaseClient,
  archiveContent: Buffer,
  encryptionKey: Buffer,
): Promise<RestoreBackupResult> {
  if (archiveContent.subarray(0, streamBackupMagic.length).equals(streamBackupMagic))
    return restoreStreamBackupArchive(
      client,
      (async function* () {
        yield archiveContent;
      })(),
      encryptionKey,
    );
  const envelope = JSON.parse(archiveContent.toString('utf8')) as EncryptedBackupEnvelope;
  const payload = sanitizeBackupPayloadForRestore(decryptBackupArchive(envelope, encryptionKey));

  return withTransaction(client, async (transaction) => {
    await transaction.execute(sql.raw('SET FOREIGN_KEY_CHECKS = 0'));
    try {
      for (const [tableName, table] of Object.entries(payload.tables)) {
        await insertRows(transaction, tableName, table.rows);
      }
      const result = await verifyRestoredArchive(transaction, payload);
      if (result.mismatches.length) throw new Error('Restored backup checksum mismatch');
      return result;
    } finally {
      await transaction.execute(sql.raw('SET FOREIGN_KEY_CHECKS = 1'));
    }
  });
}

export async function restoreBackupArchiveFromFile(
  client: DatabaseClient,
  filename: string,
  key: Buffer,
): Promise<RestoreBackupResult> {
  const handle = await open(filename, 'r'),
    prefix = Buffer.alloc(streamBackupMagic.length);
  try {
    await handle.read(prefix, 0, prefix.length, 0);
  } finally {
    await handle.close();
  }
  return prefix.equals(streamBackupMagic)
    ? restoreStreamBackupArchive(client, createReadStream(filename), key)
    : restoreBackupArchive(client, await readFile(filename), key);
}

export async function verifyRestoredArchive(
  transaction: DatabaseTransaction,
  payload: BackupArchivePayload,
): Promise<RestoreBackupResult> {
  const sanitizedPayload = sanitizeBackupPayloadForRestore(payload);
  const mismatches: string[] = [];
  let totalRowCount = 0;

  for (const [tableName, expected] of Object.entries(sanitizedPayload.tables)) {
    const rows = await readTableRows(transaction, tableName);
    totalRowCount += rows.length;
    if (rows.length !== expected.rowCount) {
      mismatches.push(`${tableName}: expected ${expected.rowCount} rows, restored ${rows.length}`);
      continue;
    }
    const columns = Object.keys((expected.rows[0] as Record<string, unknown>) ?? {});
    const actualChecksum = computeTableChecksum(
      rows.map((row) => Object.fromEntries(columns.map((column) => [column, row[column]]))),
    );
    if (actualChecksum !== expected.sha256) {
      mismatches.push(`${tableName}: checksum mismatch`);
    }
  }

  return {
    mismatches,
    rowCount: totalRowCount,
    tableCount: Object.keys(sanitizedPayload.tables).length,
  };
}

async function insertRows(
  transaction: DatabaseTransaction,
  tableName: string,
  rows: readonly unknown[],
): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  const table = await readBackupTableMetadata(transaction, tableName);
  await insertBackupRows(transaction, table, rows as readonly Record<string, unknown>[]);
}

async function readTableRows(
  transaction: DatabaseTransaction,
  tableName: string,
): Promise<readonly Record<string, unknown>[]> {
  const [rows] = (await transaction.execute(
    sql.raw(`SELECT * FROM ${quoteIdentifier(tableName)}`),
  )) as unknown as [Record<string, unknown>[], unknown];
  return rows;
}

function quoteIdentifier(identifier: string): string {
  return `\`${identifier.replaceAll('`', '``')}\``;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, nested]) => [key, canonicalize(nested)] as const)
      .sort(([first], [second]) => first.localeCompare(second)),
  );
}
