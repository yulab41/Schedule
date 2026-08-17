import { describe, expect, it } from 'vitest';

import { updateShiftDraftTime } from './shift-time-draft.js';

describe('shift time draft', () => {
  it('keeps the cross-day setting synchronized with the selected time order', () => {
    const draft = { crossesMidnight: false, endTime: '', startTime: '' };

    updateShiftDraftTime(draft, 'startTime', '20:00');
    expect(draft).toEqual({ crossesMidnight: false, endTime: '', startTime: '20:00' });

    updateShiftDraftTime(draft, 'endTime', '08:00');
    expect(draft.crossesMidnight).toBe(true);

    updateShiftDraftTime(draft, 'endTime', '22:00');
    expect(draft.crossesMidnight).toBe(false);

    updateShiftDraftTime(draft, 'endTime', '20:00');
    expect(draft.crossesMidnight).toBe(true);
  });
});
