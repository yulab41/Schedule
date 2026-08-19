import type { CleanEmployeeDirectoryRecord } from './employee-directory-cleaner.js';

const identityPattern =
  /(?<name>[^()[\]]+?)\((?<employeeCode>[^()[\]]*)\)\[(?<department>[^\]]*)\](?<phone>\d+)/gu;
const employeeCodePattern = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/u;

export interface EmployeeIdentityRecord {
  readonly department: string;
  readonly employeeCode: string;
  readonly name: string;
  readonly sourcePhone: string;
}

export interface EmployeeIdentityMatchReport {
  readonly ambiguousCurrentRecordCount: number;
  readonly emptyCodeSourceCount: number;
  readonly identityRecordCount: number;
  readonly matchedByDepartmentCount: number;
  readonly matchedByNameOnlyCount: number;
  readonly unmatchedCurrentRecordCount: number;
  readonly unmatchedCurrentRecords: readonly EmployeeIdentityUnmatchedRecord[];
}

export interface EmployeeIdentityUnmatchedRecord {
  readonly candidateCodes: readonly string[];
  readonly level: string;
  readonly name: string;
  readonly reason: 'ambiguous' | 'not_found';
}

export interface EmployeeIdentityMatchResult {
  readonly records: readonly CleanEmployeeDirectoryRecord[];
  readonly report: EmployeeIdentityMatchReport;
}

export function parseEmployeeIdentityText(text: string): {
  readonly records: readonly EmployeeIdentityRecord[];
  readonly emptyCodeSourceCount: number;
} {
  const records: EmployeeIdentityRecord[] = [];
  let emptyCodeSourceCount = 0;
  for (const match of text.matchAll(identityPattern)) {
    const groups = match.groups;
    if (groups === undefined) continue;
    const name = groups.name;
    const employeeCodeValue = groups.employeeCode;
    const department = groups.department;
    const sourcePhone = groups.phone;
    if (
      name === undefined ||
      employeeCodeValue === undefined ||
      department === undefined ||
      sourcePhone === undefined
    ) {
      continue;
    }
    const employeeCode = employeeCodeValue.trim();
    if (employeeCode.length === 0) {
      emptyCodeSourceCount += 1;
      continue;
    }
    if (!employeeCodePattern.test(employeeCode)) continue;
    records.push({
      department: department.normalize('NFKC').trim(),
      employeeCode,
      name: name.normalize('NFKC').trim(),
      sourcePhone,
    });
  }
  return { records, emptyCodeSourceCount };
}

export function matchEmployeeDirectoryRecords(
  currentRecords: readonly CleanEmployeeDirectoryRecord[],
  identities: readonly EmployeeIdentityRecord[],
  emptyCodeSourceCount = 0,
): EmployeeIdentityMatchResult {
  const byName = new Map<string, EmployeeIdentityRecord[]>();
  for (const identity of identities) {
    const key = normalizeMatchText(identity.name);
    const current = byName.get(key) ?? [];
    current.push(identity);
    byName.set(key, current);
  }

  let matchedByDepartmentCount = 0;
  let matchedByNameOnlyCount = 0;
  let ambiguousCurrentRecordCount = 0;
  let unmatchedCurrentRecordCount = 0;
  const unmatchedCurrentRecords: EmployeeIdentityUnmatchedRecord[] = [];
  const records = currentRecords.map((record) => {
    const candidates = byName.get(normalizeMatchText(record.name)) ?? [];
    const departmentCandidates = candidates.filter((identity) =>
      record.levelPath.some(
        (level) => normalizeMatchText(level) === normalizeMatchText(identity.department),
      ),
    );
    const selected =
      departmentCandidates.length === 1
        ? departmentCandidates[0]
        : departmentCandidates.length > 1
          ? undefined
          : candidates.length === 1
            ? candidates[0]
            : undefined;

    if (selected !== undefined) {
      if (departmentCandidates.length === 1) matchedByDepartmentCount += 1;
      else matchedByNameOnlyCount += 1;
      return { ...record, employeeCode: selected.employeeCode };
    }

    const reason = candidates.length === 0 ? 'not_found' : 'ambiguous';
    if (reason === 'not_found') unmatchedCurrentRecordCount += 1;
    else ambiguousCurrentRecordCount += 1;
    unmatchedCurrentRecords.push({
      candidateCodes: candidates.map((candidate) => candidate.employeeCode),
      level: record.level,
      name: record.name,
      reason,
    });
    return record;
  });

  return {
    records,
    report: {
      ambiguousCurrentRecordCount,
      emptyCodeSourceCount,
      identityRecordCount: identities.length,
      matchedByDepartmentCount,
      matchedByNameOnlyCount,
      unmatchedCurrentRecordCount,
      unmatchedCurrentRecords,
    },
  };
}

function normalizeMatchText(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .replaceAll(/\s+/gu, '')
    .replace(/\(停用\)$/u, '')
    .toLocaleLowerCase('zh-CN');
}
