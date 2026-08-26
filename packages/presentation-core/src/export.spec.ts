import { describe, expect, it, vi } from 'vitest';

import {
  buildExportFileName,
  getExportPeriodLabel,
  getExportSelectionSummary,
  pollExportJob,
} from './export.js';

describe('Mini export adapter mirrors Web export rules', () => {
  it('uses the Web file, period and selection labels', () => {
    expect(buildExportFileName('schedule', '2026-08')).toBe('schedule-export-2026-08.csv');
    expect(getExportPeriodLabel('2026-08')).toBe('2026年8月');
    expect(getExportPeriodLabel('2026')).toBe('2026年');
    expect(getExportSelectionSummary('statistics', '2026')).toBe('统计 · 2026年');
  });

  it('polls immediately, returns a finished job and preserves its identity', async () => {
    const job = exportJob({ status: 'completed' });
    const getJob = vi.fn(async () => job);

    await expect(
      pollExportJob(job.id, getJob, {
        now: () => 0,
        sleep: async () => undefined,
      }),
    ).resolves.toEqual({ job, status: 'finished' });
    expect(getJob).toHaveBeenCalledTimes(1);
  });

  it('times out without changing or recreating the existing job', async () => {
    const job = exportJob({ status: 'running' });
    let now = 0;
    const getJob = vi.fn(async () => job);

    await expect(
      pollExportJob(job.id, getJob, {
        now: () => now,
        pollIntervalMs: 1_000,
        sleep: async (milliseconds) => {
          now += milliseconds;
        },
        timeoutMs: 2_000,
      }),
    ).resolves.toEqual({ exportJobId: job.id, status: 'timed_out' });
    expect(getJob).toHaveBeenCalledTimes(3);
  });
});

function exportJob(overrides: Record<string, unknown> = {}) {
  return {
    createdAt: '2026-08-26T00:00:00.000Z',
    exportType: 'schedule' as const,
    groupId: 'group-1',
    id: 'job-1',
    period: '2026-08',
    periodType: 'month' as const,
    status: 'pending' as const,
    ...overrides,
  };
}
