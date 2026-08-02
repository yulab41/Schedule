export interface BackupArchiveEntry {
  readonly backupKind: 'daily' | 'monthly';
  readonly createdAt: string;
  readonly id: string;
}

export interface RetentionDecision {
  readonly archiveIdsToDelete: readonly string[];
  readonly dailyRetained: number;
  readonly monthlyRetained: number;
}

export const dailyRetentionCount = 30;
export const monthlyRetentionCount = 12;

export function selectArchivesToDelete(
  entries: readonly BackupArchiveEntry[],
  dailyLimit = dailyRetentionCount,
  monthlyLimit = monthlyRetentionCount,
): RetentionDecision {
  const daily = entries
    .filter((entry) => entry.backupKind === 'daily')
    .sort((first, second) => second.createdAt.localeCompare(first.createdAt));
  const dailyIds = new Set(daily.slice(dailyLimit).map((entry) => entry.id));

  const monthly = entries
    .filter((entry) => entry.backupKind === 'monthly')
    .sort((first, second) => second.createdAt.localeCompare(first.createdAt));
  const monthlyByMonth = new Map<string, BackupArchiveEntry[]>();
  for (const entry of monthly) {
    const month = entry.createdAt.slice(0, 7);
    const list = monthlyByMonth.get(month) ?? [];
    list.push(entry);
    monthlyByMonth.set(month, list);
  }

  const retainedMonths = new Set([...monthlyByMonth.keys()].slice(0, monthlyLimit));
  const monthlyIds = new Set<string>();
  for (const [month, entriesInMonth] of monthlyByMonth) {
    if (!retainedMonths.has(month)) {
      for (const entry of entriesInMonth) {
        monthlyIds.add(entry.id);
      }
      continue;
    }
    for (const entry of entriesInMonth.slice(1)) {
      monthlyIds.add(entry.id);
    }
  }

  const archiveIdsToDelete = [...new Set([...dailyIds, ...monthlyIds])];
  return {
    archiveIdsToDelete,
    dailyRetained: daily.length - [...dailyIds].length,
    monthlyRetained: monthly.length - [...monthlyIds].length,
  };
}
