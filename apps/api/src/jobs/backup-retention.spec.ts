import { describe, expect, it } from 'vitest';

import {
  dailyRetentionCount,
  monthlyRetentionCount,
  selectArchivesToDelete,
  type BackupArchiveEntry,
} from './backup-retention.js';

function daily(date: string, id = date): BackupArchiveEntry {
  return { backupKind: 'daily', createdAt: date, id };
}

function monthly(date: string, id = date): BackupArchiveEntry {
  return { backupKind: 'monthly', createdAt: date, id };
}

describe('Backup retention', () => {
  it('keeps the newest 30 daily archives', () => {
    const entries = Array.from({ length: 35 }, (_, index) =>
      daily(`2026-06-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`, `daily-${index}`),
    );
    const decision = selectArchivesToDelete(entries);
    expect(decision.archiveIdsToDelete).toHaveLength(5);
    expect(decision.dailyRetained).toBe(dailyRetentionCount);
    expect(decision.archiveIdsToDelete).toContain('daily-0');
    expect(decision.archiveIdsToDelete).not.toContain('daily-34');
  });

  it('keeps one archive per month for the newest 12 months', () => {
    const entries: BackupArchiveEntry[] = [];
    for (let month = 1; month <= 14; month += 1) {
      entries.push(
        monthly(`2025-${String(month).padStart(2, '0')}-01T00:00:00.000Z`, `m-${month}`),
      );
    }
    entries.push(monthly('2025-06-15T00:00:00.000Z', 'm-6-extra'));

    const decision = selectArchivesToDelete(entries);
    expect(decision.monthlyRetained).toBe(monthlyRetentionCount);
    expect(decision.archiveIdsToDelete).toContain('m-1');
    expect(decision.archiveIdsToDelete).toContain('m-2');
    expect(decision.archiveIdsToDelete).toContain('m-6');
    expect(decision.archiveIdsToDelete).not.toContain('m-6-extra');
    expect(decision.archiveIdsToDelete).not.toContain('m-14');
  });

  it('combines daily and monthly pruning without duplicates', () => {
    const entries = [
      monthly('2026-01-01T00:00:00.000Z', 'jan'),
      daily('2026-01-01T00:00:00.000Z', 'jan-daily'),
      daily('2026-01-02T00:00:00.000Z', 'jan-daily-2'),
    ];
    const decision = selectArchivesToDelete(entries, 1, 0);
    expect(decision.archiveIdsToDelete).toEqual(['jan-daily', 'jan']);
  });
});
