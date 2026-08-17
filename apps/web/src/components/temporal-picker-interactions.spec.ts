import { describe, expect, it } from 'vitest';

import { isPointOutsideRectangle } from './temporal-picker-interactions.js';

describe('temporal picker interactions', () => {
  it('distinguishes the visible dialog surface from its modal backdrop', () => {
    const rectangle = { bottom: 700, left: 700, right: 1080, top: 300 };

    expect(isPointOutsideRectangle({ clientX: 20, clientY: 20 }, rectangle)).toBe(true);
    expect(isPointOutsideRectangle({ clientX: 800, clientY: 400 }, rectangle)).toBe(false);
    expect(isPointOutsideRectangle({ clientX: 700, clientY: 300 }, rectangle)).toBe(false);
  });
});
