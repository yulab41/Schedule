import { readFile, writeFile } from 'node:fs/promises';

const phoneFields = ['移动电话', '移动电话1', '移动电话2'] as const;
export type EmployeePhoneField = (typeof phoneFields)[number];

export interface EmployeeDirectoryRawRecord {
  readonly crawl_path?: readonly unknown[];
  readonly employeeCode?: unknown;
  readonly jobTitle?: unknown;
  readonly 层级?: unknown;
  readonly 姓名?: unknown;
  readonly 移动电话?: unknown;
  readonly 移动电话1?: unknown;
  readonly 移动电话2?: unknown;
}

export interface CleanEmployeePhone {
  readonly sourceField: EmployeePhoneField;
  readonly value: string;
  readonly kind: 'full' | 'extension';
}

export interface CleanEmployeeDirectoryRecord {
  readonly employeeCode?: string;
  readonly jobTitle?: string;
  readonly name: string;
  readonly level: string;
  readonly levelPath: readonly string[];
  readonly phones: readonly CleanEmployeePhone[];
}

export interface EmployeeDirectoryCleaningStats {
  readonly duplicateFieldCount: number;
  readonly duplicateRecordCount: number;
  readonly droppedWithoutIdentityCount: number;
  readonly retainedWithoutValidPhoneCount: number;
  readonly inputRecordCount: number;
  readonly invalidFieldCount: number;
  readonly invalidFieldCounts: Readonly<Record<EmployeePhoneField, number>>;
  readonly outputRecordCount: number;
  readonly validFullPhoneCount: number;
  readonly validExtensionCount: number;
}

export interface EmployeeDirectoryCleaningResult {
  readonly records: readonly CleanEmployeeDirectoryRecord[];
  readonly stats: EmployeeDirectoryCleaningStats;
}

export function cleanEmployeeDirectoryRecords(
  input: readonly EmployeeDirectoryRawRecord[],
): EmployeeDirectoryCleaningResult {
  const invalidFieldCounts: Record<EmployeePhoneField, number> = {
    移动电话: 0,
    移动电话1: 0,
    移动电话2: 0,
  };
  const seenRecords = new Set<string>();
  const identitiesWithPhones = new Set<string>();
  const records: CleanEmployeeDirectoryRecord[] = [];
  let duplicateFieldCount = 0;
  let duplicateRecordCount = 0;
  let droppedWithoutIdentityCount = 0;
  let validFullPhoneCount = 0;
  let validExtensionCount = 0;

  for (const rawRecord of input) {
    const name = normalizeDisplayText(rawRecord.姓名);
    const levelPath = normalizeLevelPath(rawRecord.crawl_path, rawRecord.层级);
    if (name.length === 0 || levelPath.length === 0) {
      droppedWithoutIdentityCount += 1;
      continue;
    }

    const phones: CleanEmployeePhone[] = [];
    const seenPhones = new Set<string>();
    for (const field of phoneFields) {
      const value = normalizeText(rawRecord[field]);
      if (value.length === 0) continue;
      const kind = classifyPhone(value);
      if (kind === undefined) {
        invalidFieldCounts[field] += 1;
        continue;
      }
      if (seenPhones.has(value)) {
        duplicateFieldCount += 1;
        continue;
      }
      seenPhones.add(value);
      phones.push({ sourceField: field, value, kind });
      if (kind === 'full') validFullPhoneCount += 1;
      else validExtensionCount += 1;
    }

    const record: CleanEmployeeDirectoryRecord = {
      level: levelPath.join('/'),
      levelPath,
      name,
      phones,
      ...(normalizeDisplayText(rawRecord.employeeCode).length > 0
        ? { employeeCode: normalizeDisplayText(rawRecord.employeeCode) }
        : {}),
      ...(normalizeDisplayText(rawRecord.jobTitle).length > 0
        ? { jobTitle: normalizeDisplayText(rawRecord.jobTitle) }
        : {}),
    };
    const identityKey = employeeIdentityKey(record);
    const recordKey = JSON.stringify([
      identityKey,
      record.phones.map((phone) => [phone.kind, phone.value]),
    ]);
    if (seenRecords.has(recordKey)) {
      duplicateRecordCount += 1;
      continue;
    }
    seenRecords.add(recordKey);
    if (phones.length > 0) identitiesWithPhones.add(identityKey);
    records.push(record);
  }

  const retainedRecords = records.filter(
    (record) => record.phones.length > 0 || !identitiesWithPhones.has(employeeIdentityKey(record)),
  );

  return {
    records: retainedRecords,
    stats: {
      duplicateFieldCount,
      duplicateRecordCount: duplicateRecordCount + records.length - retainedRecords.length,
      droppedWithoutIdentityCount,
      retainedWithoutValidPhoneCount: retainedRecords.filter((record) => record.phones.length === 0)
        .length,
      inputRecordCount: input.length,
      invalidFieldCount: Object.values(invalidFieldCounts).reduce(
        (total, count) => total + count,
        0,
      ),
      invalidFieldCounts,
      outputRecordCount: retainedRecords.length,
      validExtensionCount,
      validFullPhoneCount,
    },
  };
}

function employeeIdentityKey(record: CleanEmployeeDirectoryRecord): string {
  return JSON.stringify([record.name, record.level, record.employeeCode?.toLowerCase()]);
}

export function classifyPhone(value: string): CleanEmployeePhone['kind'] | undefined {
  if (/^\d{11}$/u.test(value)) return 'full';
  if (/^\d{6}$/u.test(value)) return 'extension';
  return undefined;
}

function normalizeLevelPath(path: readonly unknown[] | undefined, level: unknown): string[] {
  const fromPath = (path ?? []).map(normalizeDisplayText).filter((value) => value.length > 0);
  if (fromPath.length > 0) return fromPath;
  return normalizeDisplayText(level)
    .split('/')
    .map(normalizeDisplayText)
    .filter((value) => value.length > 0);
}

const boundaryNoisePattern = /^[\s.,，。；;：:>＞|｜]+|[\s.,，。；;：:>＞|｜]+$/gu;

function normalizeDisplayText(value: unknown): string {
  return normalizeText(value).replace(boundaryNoisePattern, '').trim();
}

function normalizeText(value: unknown): string {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  return String(value).normalize('NFKC').trim();
}

if (process.argv[1]?.endsWith('employee-directory-cleaner.js')) {
  const [inputPath, outputPath] = process.argv.slice(2);
  if (inputPath === undefined || outputPath === undefined) {
    throw new Error('Usage: employee-directory-cleaner.js <input.jsonl> <output.jsonl>');
  }
  const raw = await readFile(inputPath, 'utf8');
  const parsed = raw
    .split(/\r?\n/u)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as EmployeeDirectoryRawRecord);
  const result = cleanEmployeeDirectoryRecords(parsed);
  await writeFile(
    outputPath,
    result.records.map((record) => `${JSON.stringify(record)}\n`).join(''),
    'utf8',
  );
  console.log(JSON.stringify(result.stats));
}
