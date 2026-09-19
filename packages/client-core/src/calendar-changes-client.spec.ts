import { describe, expect, it } from 'vitest';

import {
  calendarChangesReadModelDecoder,
  calendarReadModelDecoder,
  holidayReadModelDecoder,
} from './calendar-client.js';
import {
  calendarApiGoldenResponse,
  holidayApiGoldenResponse,
} from './testing/calendar-api-golden.js';

describe('calendar change cursor client', () => {
  /**
   * The incremental revision deliberately lives in its own response. The two
   * published shapes stay byte-for-byte strict so already-deployed Mini
   * versions and the Web bundle keep decoding the calendar they always got.
   */
  it('keeps the published calendar and holiday responses closed to new fields', () => {
    expect(calendarReadModelDecoder.safeDecode(calendarApiGoldenResponse).success).toBe(true);
    expect(holidayReadModelDecoder.safeDecode(holidayApiGoldenResponse).success).toBe(true);
    expect(
      calendarReadModelDecoder.safeDecode({ ...calendarApiGoldenResponse, revision: 3 }).success,
    ).toBe(false);
    expect(
      holidayReadModelDecoder.safeDecode({ ...holidayApiGoldenResponse, version: 2 }).success,
    ).toBe(false);
  });

  it('accepts a month-scoped delta and an unscoped one', () => {
    const decoded = calendarChangesReadModelDecoder.safeDecode({
      changes: [
        {
          businessMonth: '2026-08',
          changedAt: '2026-09-19T12:00:00.000Z',
          kind: 'schedule',
          seq: 4,
        },
        { changedAt: '2026-09-19T12:00:01.000Z', kind: 'member', seq: 5 },
      ],
      holidayVersions: [{ version: 2, year: 2026 }],
      resync: false,
      revision: 5,
    });
    expect(decoded.success).toBe(true);
  });

  it('rejects unknown fields, unknown kinds and a missing revision', () => {
    const base = { changes: [], holidayVersions: [], resync: false, revision: 0 };
    expect(calendarChangesReadModelDecoder.safeDecode(base).success).toBe(true);
    expect(calendarChangesReadModelDecoder.safeDecode({ ...base, extra: 1 }).success).toBe(false);
    expect(calendarChangesReadModelDecoder.safeDecode({ ...base, revision: -1 }).success).toBe(
      false,
    );
    expect(
      calendarChangesReadModelDecoder.safeDecode({
        ...base,
        changes: [{ changedAt: 'now', kind: 'unknown', seq: 1 }],
      }).success,
    ).toBe(false);
    expect(
      calendarChangesReadModelDecoder.safeDecode({
        ...base,
        changes: [{ businessMonth: '2026-8', changedAt: 'now', kind: 'config', seq: 1 }],
      }).success,
    ).toBe(false);
  });
});
