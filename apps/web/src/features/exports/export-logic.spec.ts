import { describe, expect, it, vi } from 'vitest';

import type { ScheduleExportJob } from '@schedule/contracts';

import {
  buildExportFileName,
  EXPORT_POLL_TIMEOUT_MS,
  getExportPeriodLabel,
  getExportSelectionSummary,
  isExportJobFinished,
  pollExportJob,
} from './export-logic.js';

function job(status: ScheduleExportJob['status']): ScheduleExportJob {
  return {
    createdAt: '2026-08-02T00:00:00.000Z',
    exportType: 'schedule',
    groupId: 'group-1',
    id: 'job-1',
    period: '2026-10',
    periodType: 'month',
    status,
  };
}

describe('export logic', () => {
  it('builds file names and period labels', () => {
    expect(buildExportFileName('schedule', '2026-10')).toBe('schedule-export-2026-10.csv');
    expect(buildExportFileName('statistics', '2026')).toBe('statistics-export-2026.csv');
    expect(getExportPeriodLabel('2026-10')).toBe('2026年10月');
    expect(getExportPeriodLabel('2026')).toBe('2026年');
  });

  it('treats only terminal statuses as finished', () => {
    expect(isExportJobFinished(job('completed'))).toBe(true);
    expect(isExportJobFinished(job('failed'))).toBe(true);
    expect(isExportJobFinished(job('pending'))).toBe(false);
    expect(isExportJobFinished(job('running'))).toBe(false);
  });

  it('summarizes the exact export content and period before download', () => {
    expect(getExportSelectionSummary('schedule', '2026-10')).toBe('排班 · 2026年10月');
    expect(getExportSelectionSummary('statistics', '2026')).toBe('统计 · 2026年');
  });

  it('returns a completed job without creating another task', async () => {
    let now = 0;
    const getJob = vi
      .fn<() => Promise<ScheduleExportJob>>()
      .mockResolvedValueOnce(job('pending'))
      .mockResolvedValueOnce(job('running'))
      .mockResolvedValueOnce(job('completed'));

    await expect(
      pollExportJob('job-1', getJob, {
        now: () => now,
        sleep: async (milliseconds) => {
          now += milliseconds;
        },
      }),
    ).resolves.toEqual({ job: job('completed'), status: 'finished' });
    expect(getJob).toHaveBeenCalledTimes(3);
    expect(getJob).toHaveBeenCalledWith('job-1');
  });

  it('stops after 90 seconds and retains the existing task for a later check', async () => {
    let now = 0;
    const getJob = vi.fn(async () => job('pending'));

    await expect(
      pollExportJob('job-1', getJob, {
        now: () => now,
        sleep: async (milliseconds) => {
          now += milliseconds;
        },
      }),
    ).resolves.toEqual({ exportJobId: 'job-1', status: 'timed_out' });
    expect(now).toBe(EXPORT_POLL_TIMEOUT_MS);
  });

  it('stops polling when its sheet unmounts', async () => {
    let cancelled = false;
    const getJob = vi.fn(async () => {
      cancelled = true;
      return job('completed');
    });

    await expect(
      pollExportJob('job-1', getJob, {
        isCancelled: () => cancelled,
        sleep: async () => undefined,
      }),
    ).resolves.toEqual({ status: 'cancelled' });
    expect(getJob).toHaveBeenCalledTimes(1);
  });
});
