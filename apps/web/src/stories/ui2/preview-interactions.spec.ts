import { describe, expect, it } from 'vitest';

import { getSwipeMonthIntent } from './preview-interactions.js';

describe('UI 2.0 preview swipe intent', () => {
  it('changes to the next month after a clear left swipe', () => {
    expect(getSwipeMonthIntent({ deltaX: -72, deltaY: 18 })).toBe(1);
  });

  it('changes to the previous month after a clear right swipe', () => {
    expect(getSwipeMonthIntent({ deltaX: 64, deltaY: 12 })).toBe(-1);
  });

  it('ignores horizontal movement below the 56px threshold', () => {
    expect(getSwipeMonthIntent({ deltaX: -55, deltaY: 8 })).toBe(0);
  });

  it('cancels a swipe when vertical movement is not clearly smaller', () => {
    expect(getSwipeMonthIntent({ deltaX: -80, deltaY: 70 })).toBe(0);
  });
});
