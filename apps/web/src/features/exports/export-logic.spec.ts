import { describe, expect, it } from 'vitest';

import type { ScheduleExportJob } from '@schedule/contracts';

import {
  buildExportFileName,
  getExportPeriodLabel,
  getExportSelectionSummary,
  isExportJobFinished,
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
});
