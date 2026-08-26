import { describe, expect, it } from 'vitest';

import * as sharedExport from '../../../packages/presentation-core/src/export.ts';
import * as webExport from '../../web/src/features/exports/export-logic.ts';

describe('Mini export rules mirror the immutable Web golden', () => {
  it('keeps labels and finished-state rules equivalent', () => {
    for (const [type, period] of [
      ['schedule', '2026-08'],
      ['statistics', '2026'],
    ]) {
      expect(sharedExport.buildExportFileName(type, period)).toBe(
        webExport.buildExportFileName(type, period),
      );
      expect(sharedExport.getExportPeriodLabel(period)).toBe(
        webExport.getExportPeriodLabel(period),
      );
      expect(sharedExport.getExportSelectionSummary(type, period)).toBe(
        webExport.getExportSelectionSummary(type, period),
      );
    }
    expect(sharedExport.isExportJobFinished({ status: 'completed' })).toBe(
      webExport.isExportJobFinished({ status: 'completed' }),
    );
    expect(sharedExport.isExportJobFinished({ status: 'running' })).toBe(
      webExport.isExportJobFinished({ status: 'running' }),
    );
  });

  it('keeps deterministic polling results equivalent', async () => {
    const jobs = [job('running'), job('completed')];
    const makeGetJob = () => {
      let index = 0;
      return async () => jobs[Math.min(index++, jobs.length - 1)];
    };
    const options = {
      now: () => 0,
      sleep: async () => undefined,
      timeoutMs: 90_000,
    };

    expect(await sharedExport.pollExportJob('job-1', makeGetJob(), options)).toEqual(
      await webExport.pollExportJob('job-1', makeGetJob(), options),
    );
  });
});

function job(status) {
  return {
    createdAt: '2026-08-26T00:00:00.000Z',
    exportType: 'schedule',
    groupId: 'group-1',
    id: 'job-1',
    period: '2026-08',
    periodType: 'month',
    status,
  };
}
