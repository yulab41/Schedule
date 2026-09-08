import { describe, expect, it } from 'vitest';
import { getTodayBusinessDate } from '../src/features/workbench/workbench-model.ts';

describe('calendar eight o’clock handover', () => {
  it.each([
    ['2026-09-07T16:00:00.000Z', '2026-09-07'],
    ['2026-09-07T23:59:59.999Z', '2026-09-07'],
    ['2026-09-08T00:00:00.000Z', '2026-09-08'],
    ['2026-12-31T16:00:00.000Z', '2026-12-31'],
    ['2028-02-29T23:59:59.999Z', '2028-02-29'],
    ['2028-03-01T00:00:00.000Z', '2028-03-01'],
  ])('%s belongs to duty date %s', (instant, expected) => {
    expect(getTodayBusinessDate(new Date(instant))).toBe(expected);
  });
});
