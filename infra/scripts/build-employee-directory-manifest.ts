import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

import {
  cleanEmployeeDirectoryRecords,
  type EmployeeDirectoryRawRecord,
  type CleanEmployeeDirectoryRecord,
} from './employee-directory-cleaner.js';
import {
  matchEmployeeDirectoryRecords,
  parseEmployeeIdentityText,
  type EmployeeIdentityMatchReport,
} from './employee-directory-identity-matcher.js';

const [
  inputPath,
  outputPath,
  effectiveOn = new Date().toISOString().slice(0, 10),
  identityPath,
  identityReportPath,
] = process.argv.slice(2);
if (inputPath === undefined || outputPath === undefined) {
  throw new Error(
    'Usage: build-employee-directory-manifest.js <input.jsonl> <output.json> [effectiveOn] [identity.txt] [identity-report.json]',
  );
}

const sourceBytes = await readFile(inputPath);
const sourceText = sourceBytes.toString('utf8');
const sourceRecords = sourceText
  .split(/\r?\n/u)
  .filter((line) => line.trim().length > 0)
  .map((line) => JSON.parse(line) as EmployeeDirectoryRawRecord);
const cleaned = cleanEmployeeDirectoryRecords(sourceRecords);
if (cleaned.records.length === 0)
  throw new Error('Employee directory cleaning produced no records.');
let identityReport: EmployeeIdentityMatchReport | undefined;
let records: readonly CleanEmployeeDirectoryRecord[] = cleaned.records;
if (identityPath !== undefined) {
  const identityText = await readFile(identityPath, 'utf8');
  const parsedIdentities = parseEmployeeIdentityText(identityText);
  const matched = matchEmployeeDirectoryRecords(
    cleaned.records,
    parsedIdentities.records,
    parsedIdentities.emptyCodeSourceCount,
  );
  records = matched.records;
  identityReport = matched.report;
  if (identityReportPath !== undefined) {
    await writeFile(identityReportPath, `${JSON.stringify(identityReport, null, 2)}\n`, 'utf8');
  }
}

const campusName = records[0]?.levelPath[0] ?? '员工组织';
const campusCode = 'employee-hospital';
const sourceSha256 = createHash('sha256').update(sourceBytes).digest('hex');
const cleanedSha256 = createHash('sha256').update(JSON.stringify(records), 'utf8').digest('hex');
const documentKey = `employee-directory-${sourceSha256.slice(0, 16)}`;
const entries = records.map((record, index) => toManifestEntry(record, index, documentKey));
const manifest = {
  schemaVersion: 1,
  directoryKind: 'employee',
  importVersion: `employee-${effectiveOn.replaceAll('-', '')}-${sourceSha256.slice(0, 8)}-${cleanedSha256.slice(0, 8)}`,
  effectiveOn,
  campuses: [{ code: campusCode, name: campusName, displayOrder: 1 }],
  documents: [
    {
      documentKey,
      campusCode,
      title: `员工通讯录清洗数据（${effectiveOn}）`,
      sha256: sourceSha256,
      effectiveOn,
      pageCount: 1,
      displayOrder: 1,
    },
  ],
  entries,
};

await writeFile(outputPath, `${JSON.stringify(manifest)}\n`, 'utf8');
const identitySummary =
  identityReport === undefined
    ? undefined
    : (({ unmatchedCurrentRecords, ...summary }) => ({
        ...summary,
        unresolvedRecordCount: unmatchedCurrentRecords.length,
      }))(identityReport);
console.error(
  JSON.stringify({
    ...cleaned.stats,
    ...(identitySummary === undefined ? {} : { identityReport: identitySummary }),
    manifestEntries: entries.length,
  }),
);

function toManifestEntry(
  record: CleanEmployeeDirectoryRecord,
  index: number,
  documentKey: string,
): Record<string, unknown> {
  const path = record.levelPath;
  const entryKey = `employee:${createHash('sha256')
    .update(`${record.name}\0${record.level}`, 'utf8')
    .digest('hex')}`;
  return {
    entryKey,
    sourceDocumentKey: documentKey,
    sourcePage: 1,
    sourceLocator: `jsonl:${index + 1}`,
    campusCode: 'employee-hospital',
    ...(path[1] === undefined ? {} : { section: path[1] }),
    ...(path[2] === undefined ? {} : { building: path[2] }),
    ...(path[3] === undefined ? {} : { floor: path[3] }),
    ...(path[4] === undefined ? {} : { department: path[4] }),
    ...(path[5] === undefined ? {} : { subunit: path[5] }),
    contactName: record.name,
    ...(record.employeeCode === undefined ? {} : { employeeCode: record.employeeCode }),
    entryKind: 'person',
    visibility: 'member',
    verificationStatus: 'source_exact',
    displayOrder: index + 1,
    contacts: toManifestContacts(record),
  };
}

function toManifestContacts(
  record: CleanEmployeeDirectoryRecord,
): readonly Record<string, unknown>[] {
  const fullNumbers = record.phones.filter((phone) => phone.kind === 'full');
  const extensions = record.phones.filter((phone) => phone.kind === 'extension');
  const count = Math.max(fullNumbers.length, extensions.length);
  return Array.from({ length: count }, (_, index) => ({
    type: 'mobile',
    ...(fullNumbers[index] === undefined ? {} : { fullNumber: fullNumbers[index].value }),
    ...(extensions[index] === undefined ? {} : { internalExtension: extensions[index].value }),
    isPrimary: index === 0,
    displayOrder: index + 1,
    ...(index === 0 ? { label: '移动电话' } : { label: `移动电话${index}` }),
  }));
}
