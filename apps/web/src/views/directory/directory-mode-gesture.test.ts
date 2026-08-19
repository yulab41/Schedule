import { describe, expect, it } from 'vitest';

import { getDirectorySwipeTarget } from './directory-mode-gesture.js';

describe('directory mode swipe gesture', () => {
  it('moves from departments to people on a decisive left swipe', () => {
    expect(
      getDirectorySwipeTarget('internal', {
        endX: 80,
        endY: 120,
        startX: 160,
        startY: 116,
      }),
    ).toBe('employee');
  });

  it('moves from people to departments on a decisive right swipe', () => {
    expect(
      getDirectorySwipeTarget('employee', {
        endX: 180,
        endY: 120,
        startX: 92,
        startY: 118,
      }),
    ).toBe('internal');
  });

  it('ignores short, vertical, and edge swipes', () => {
    expect(
      getDirectorySwipeTarget('internal', {
        endX: 122,
        endY: 100,
        startX: 80,
        startY: 98,
      }),
    ).toBeUndefined();
    expect(
      getDirectorySwipeTarget('internal', {
        endX: 180,
        endY: 190,
        startX: 92,
        startY: 80,
      }),
    ).toBeUndefined();
    expect(
      getDirectorySwipeTarget('employee', {
        endX: 60,
        endY: 120,
        startX: 160,
        startY: 120,
      }),
    ).toBeUndefined();
  });
});
