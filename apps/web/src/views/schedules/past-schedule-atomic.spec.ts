import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

describe('PastScheduleView atomic backfill boundary', () => {
  it('uses one batch mutation and the semantic date-selection event', async () => {
    const source = await readFile(new URL('./PastScheduleView.vue', import.meta.url), 'utf8');

    expect(source).toContain('api.submitPastScheduleBackfillBatch');
    expect(source).not.toContain('api.createPastScheduleAssignment');
    expect(source).toContain('@select-date="clickDate"');
    expect(source).not.toContain('@click="onCalendarClick"');
    expect(source.match(/:disabled="isSaving"/gu)?.length ?? 0).toBeGreaterThanOrEqual(8);
    expect(source).toContain('createPastScheduleBackfillBatchSnapshot');
    expect(source).toContain('resolvePastScheduleBackfillAttempt');
  });

  it('blocks semantic date selection in the page while an atomic save is in flight', async () => {
    const source = await readFile(new URL('./PastScheduleView.vue', import.meta.url), 'utf8');

    expect(source).toMatch(
      /function clickDate\(date: string\): void \{\s+if \(isSaving\.value\) return;/u,
    );
  });
});
