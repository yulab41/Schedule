import { createHash } from 'node:crypto';
import { sql, type SQL } from 'drizzle-orm';
import { withTransaction, type DatabaseClient, type DatabaseTransaction } from '@schedule/database';
import { shouldIncludeBackupTable, type RestoreBackupResult } from './backup-archive.js';
import { decryptBackupFrames, type BackupFrame } from './backup-stream-format.js';

const quote = (value: string) => `\`${value.replaceAll('`', '``')}\``;
interface Columns {
  name: string;
  type: string;
  extra: string;
}
export interface BackupTableMetadata {
  name: string;
  primaryKey: readonly string[];
  binaryColumns: readonly string[];
  columns: readonly Columns[];
}
const binaryTypes = new Set(['blob', 'tinyblob', 'mediumblob', 'longblob', 'binary', 'varbinary']);
const temporalTypes = new Set(['timestamp', 'datetime', 'date']);
export async function readBackupTableMetadata(
  transaction: DatabaseTransaction,
  name: string,
): Promise<BackupTableMetadata> {
  const [columns] = (await transaction.execute(
    sql`SELECT COLUMN_NAME AS name,DATA_TYPE AS type,EXTRA AS extra FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=${name} ORDER BY ORDINAL_POSITION`,
  )) as unknown as [Columns[], unknown];
  const [keys] = (await transaction.execute(
    sql`SELECT COLUMN_NAME AS name FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name=${name} AND INDEX_NAME='PRIMARY' ORDER BY SEQ_IN_INDEX`,
  )) as unknown as [{ name: string }[], unknown];
  if (!columns.length || !keys.length)
    throw new Error('Backup requires an existing table with a stable primary key');
  return {
    name,
    columns,
    primaryKey: keys.map((k) => k.name),
    binaryColumns: columns.filter((c) => binaryTypes.has(c.type)).map((c) => c.name),
  };
}
export async function* readBackupRows(
  transaction: DatabaseTransaction,
  table: BackupTableMetadata,
): AsyncGenerator<Record<string, unknown>[]> {
  const keys = table.primaryKey.map((key) => sql.raw(quote(key)));
  const batchSize = 200;
  // Bound transfer size before selecting large JSON/text/BLOB values. The estimate
  // allows worst-case JSON escaping; binary uses its base64 expansion instead.
  const estimatedBytes = sql.join(
    table.columns.map((column) => {
      const value = sql.raw(quote(column.name));
      return binaryTypes.has(column.type)
        ? sql`(CEIL(COALESCE(OCTET_LENGTH(${value}),0)*4/3)+128)`
        : sql`(COALESCE(OCTET_LENGTH(${value}),0)*6+64)`;
    }),
    sql`+`,
  );
  let last: readonly unknown[] | undefined;
  for (;;) {
    const after: SQL = last
      ? sql`WHERE (${sql.join(keys, sql`,`)}) > (${sql.join(
          last.map((value) => sql`${value}`),
          sql`,`,
        )})`
      : sql``;
    const [candidates] = (await transaction.execute(
      sql`SELECT ${sql.join(keys, sql`,`)}, (${estimatedBytes}) AS estimated_bytes FROM ${sql.raw(quote(table.name))} ${after} ORDER BY ${sql.join(keys, sql`,`)} LIMIT ${batchSize}`,
    )) as unknown as [Record<string, unknown>[], unknown];
    if (!candidates.length) break;
    let bytes = 0,
      selected = 0;
    for (const row of candidates) {
      const size = Number(row['estimated_bytes']);
      if (!Number.isFinite(size) || size > 64 * 1024 * 1024 - 1024)
        throw new Error('Backup row exceeds safe frame budget');
      if (selected && bytes + size > 1024 * 1024) break;
      bytes += size;
      selected++;
    }
    const upper = table.primaryKey.map((key) => candidates[selected - 1]![key]);
    const lower = last
      ? sql`(${sql.join(keys, sql`,`)}) > (${sql.join(
          last.map((value) => sql`${value}`),
          sql`,`,
        )}) AND`
      : sql``;
    const [rows] = (await transaction.execute(
      sql`SELECT ${sql.join(
        table.columns.map((column) =>
          column.type === 'json'
            ? sql`CAST(${sql.raw(quote(column.name))} AS CHAR CHARACTER SET utf8mb4) AS ${sql.raw(quote(column.name))}`
            : sql.raw(quote(column.name)),
        ),
        sql`,`,
      )} FROM ${sql.raw(quote(table.name))} WHERE ${lower} (${sql.join(keys, sql`,`)}) <= (${sql.join(
        upper.map((value) => sql`${value}`),
        sql`,`,
      )}) ORDER BY ${sql.join(keys, sql`,`)}`,
    )) as unknown as [Record<string, unknown>[], unknown];
    if (rows.length !== selected) throw new Error('Backup snapshot changed during stable paging');
    yield rows;
    last = table.primaryKey.map((key) => rows.at(-1)![key]);
    if (selected === candidates.length && candidates.length < batchSize) break;
  }
}
export function encodeBackupRow(
  row: Record<string, unknown>,
  binaryColumns: readonly string[],
  jsonColumns: readonly string[] = [],
): Record<string, unknown> {
  const result = { ...row };
  for (const column of binaryColumns)
    if (Buffer.isBuffer(result[column]))
      result[column] = { type: 'binary', base64: (result[column] as Buffer).toString('base64') };
  for (const column of jsonColumns) {
    if (Object.hasOwn(result, column) && result[column] !== null) {
      if (typeof result[column] !== 'string') throw new Error('Invalid raw JSON backup column');
      result[column] = { type: 'json', text: result[column] };
    }
  }
  return result;
}
function canonical(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => [k, canonical(v)]),
  );
}
export function incrementalBackupChecksum() {
  const hash = createHash('sha256').update('[');
  let count = 0;
  return {
    add: (row: Record<string, unknown>) => {
      if (count++) hash.update(',');
      hash.update(JSON.stringify(canonical(row)));
    },
    finish: () => hash.update(']').digest('hex'),
    count: () => count,
  };
}

export async function* createBackupFrames(
  transaction: DatabaseTransaction,
  tableNames: readonly string[],
  now: Date,
  summary: { tableCount: number; rowCount: number },
): AsyncGenerator<BackupFrame> {
  yield { kind: 'archive', createdAt: now.toISOString() };
  for (const name of tableNames) {
    const table = await readBackupTableMetadata(transaction, name),
      checksum = incrementalBackupChecksum();
    yield {
      kind: 'table',
      name,
      primaryKey: table.primaryKey,
      binaryColumns: table.binaryColumns,
      columns: table.columns.map((column) => column.name),
    };
    for await (const rows of readBackupRows(transaction, table)) {
      const encoded = rows.map((row) =>
        encodeBackupRow(
          row,
          table.binaryColumns,
          table.columns.filter((column) => column.type === 'json').map((column) => column.name),
        ),
      );
      for (const row of encoded) checksum.add(row);
      yield { kind: 'rows', rows: encoded };
    }
    summary.tableCount++;
    summary.rowCount += checksum.count();
    yield { kind: 'table-end', rowCount: checksum.count(), sha256: checksum.finish() };
  }
  yield { kind: 'end', ...summary };
}

export async function insertBackupRows(
  transaction: DatabaseTransaction,
  table: BackupTableMetadata,
  rows: readonly Record<string, unknown>[],
  encodedJson = false,
): Promise<void> {
  if (!rows.length) return;
  const columns = table.columns.filter(
    (column) =>
      Object.hasOwn(rows[0]!, column.name) && !/(VIRTUAL|STORED) GENERATED/u.test(column.extra),
  );
  if (
    rows.some((row) =>
      Object.keys(row).some((key) => !table.columns.some((column) => column.name === key)),
    )
  )
    throw new Error('Backup contains an unknown column');
  for (let start = 0; start < rows.length; start += 100) {
    const values = rows.slice(start, start + 100).map(
      (row) =>
        sql`(${sql.join(
          columns.map((column) => {
            let value = row[column.name];
            if (column.type === 'json' && value !== null) {
              if (encodedJson) {
                const json = value as { type?: unknown; text?: unknown };
                if (json?.type !== 'json' || typeof json.text !== 'string')
                  throw new Error('Invalid encoded JSON backup column');
                value = json.text;
              } else value = JSON.stringify(value);
            } else if (value !== null && binaryTypes.has(column.type)) {
              const binary = value as { type?: unknown; base64?: unknown; data?: unknown };
              if (binary?.type === 'binary' && typeof binary.base64 === 'string')
                value = Buffer.from(binary.base64, 'base64');
              else if (
                binary?.type === 'Buffer' &&
                Array.isArray(binary.data) &&
                binary.data.every((v) => Number.isInteger(v) && v >= 0 && v <= 255)
              )
                value = Buffer.from(binary.data as number[]);
              else if (!Buffer.isBuffer(value)) throw new Error('Invalid backup binary column');
            } else if (
              typeof value === 'string' &&
              temporalTypes.has(column.type) &&
              /T.*(?:Z|[+-]\d{2}:\d{2})$/u.test(value)
            ) {
              const date = new Date(value);
              if (!Number.isFinite(date.valueOf())) throw new Error('Invalid backup timestamp');
              value = date;
            } else if (value !== null && typeof value === 'object' && !(value instanceof Date))
              value = JSON.stringify(value);
            return sql`${value}`;
          }),
          sql`,`,
        )})`,
    );
    await transaction.execute(
      sql`INSERT INTO ${sql.raw(quote(table.name))} (${sql.join(
        columns.map((c) => sql.raw(quote(c.name))),
        sql`,`,
      )}) VALUES ${sql.join(values, sql`,`)}`,
    );
  }
}

export async function restoreStreamBackupArchive(
  client: DatabaseClient,
  source: AsyncIterable<Uint8Array>,
  key: Buffer,
): Promise<RestoreBackupResult> {
  return withTransaction(client, async (transaction) => {
    const seen = new Set<string>();
    let table: BackupTableMetadata | undefined,
      checksum: ReturnType<typeof incrementalBackupChecksum> | undefined;
    let count = 0,
      total = 0,
      restoredCount = 0,
      restoredRows = 0,
      include = false;
    let archivedColumns: readonly string[] = [];
    await transaction.execute(sql`SET FOREIGN_KEY_CHECKS=0`);
    try {
      for await (const frame of decryptBackupFrames(source, key)) {
        if (frame.kind === 'table') {
          if (table || seen.has(frame.name) || typeof frame.name !== 'string')
            throw new Error('Invalid backup table sequence');
          table = await readBackupTableMetadata(transaction, frame.name);
          if (
            JSON.stringify(table.primaryKey) !== JSON.stringify(frame.primaryKey) ||
            !Array.isArray(frame.columns) ||
            !Array.isArray(frame.binaryColumns) ||
            frame.columns.some(
              (name) =>
                typeof name !== 'string' || !table!.columns.some((column) => column.name === name),
            ) ||
            frame.binaryColumns.some((name) => !table!.binaryColumns.includes(name))
          )
            throw new Error('Backup schema does not match restore schema');
          include = shouldIncludeBackupTable(frame.name);
          archivedColumns = frame.columns;
          seen.add(frame.name);
          checksum = incrementalBackupChecksum();
        } else if (frame.kind === 'rows') {
          if (
            !table ||
            !checksum ||
            !Array.isArray(frame.rows) ||
            frame.rows.some((row) => !row || typeof row !== 'object' || Array.isArray(row))
          )
            throw new Error('Invalid backup rows');
          for (const row of frame.rows) checksum.add(row);
          if (include) await insertBackupRows(transaction, table, frame.rows, true);
        } else if (frame.kind === 'table-end') {
          if (
            !table ||
            !checksum ||
            checksum.count() !== frame.rowCount ||
            checksum.finish() !== frame.sha256
          )
            throw new Error('Backup table checksum mismatch');
          if (include) {
            const actual = incrementalBackupChecksum();
            for await (const rows of readBackupRows(transaction, table))
              for (const row of rows)
                actual.add(
                  encodeBackupRow(
                    Object.fromEntries(archivedColumns.map((name) => [name, row[name]])),
                    table.binaryColumns,
                    table.columns
                      .filter((column) => column.type === 'json')
                      .map((column) => column.name),
                  ),
                );
            if (actual.count() !== frame.rowCount || actual.finish() !== frame.sha256)
              throw new Error('Restored backup checksum mismatch');
            restoredCount++;
            restoredRows += frame.rowCount;
          }
          count++;
          total += frame.rowCount;
          table = undefined;
          checksum = undefined;
        } else if (frame.kind === 'end') {
          if (table || frame.tableCount !== count || frame.rowCount !== total)
            throw new Error('Backup completion totals mismatch');
        } else if (table) throw new Error('Invalid archive frame sequence');
      }
      return { mismatches: [], tableCount: restoredCount, rowCount: restoredRows };
    } finally {
      await transaction.execute(sql`SET FOREIGN_KEY_CHECKS=1`);
    }
  });
}
