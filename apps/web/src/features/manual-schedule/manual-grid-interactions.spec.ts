import { describe, expect, it } from 'vitest';

import { getHorizontalScrollState, getManualGridScrollHint } from './manual-grid-interactions.js';

describe('manual schedule grid interactions', () => {
  it('reports both scroll directions and normalized progress inside an overflowing grid', () => {
    expect(
      getHorizontalScrollState({ clientWidth: 320, scrollLeft: 240, scrollWidth: 800 }),
    ).toEqual({
      canScrollLeft: true,
      canScrollRight: true,
      isOverflowing: true,
      progress: 0.5,
    });
  });

  it('tolerates fractional layout values at both scroll boundaries', () => {
    expect(
      getHorizontalScrollState({ clientWidth: 320, scrollLeft: 0.4, scrollWidth: 800 }),
    ).toMatchObject({
      canScrollLeft: false,
      canScrollRight: true,
      progress: 0,
    });
    expect(
      getHorizontalScrollState({ clientWidth: 320, scrollLeft: 479.6, scrollWidth: 800 }),
    ).toMatchObject({
      canScrollLeft: true,
      canScrollRight: false,
      progress: 1,
    });
  });

  it('does not advertise scrolling when every date is already visible', () => {
    const state = getHorizontalScrollState({ clientWidth: 800, scrollLeft: 0, scrollWidth: 640 });

    expect(state).toEqual({
      canScrollLeft: false,
      canScrollRight: false,
      isOverflowing: false,
      progress: 0,
    });
    expect(getManualGridScrollHint(state, 7)).toBe('7 天排班均已显示');
  });

  it('describes the remaining horizontal direction without hiding the fixed member column', () => {
    const start = getHorizontalScrollState({ clientWidth: 320, scrollLeft: 0, scrollWidth: 800 });
    const middle = getHorizontalScrollState({
      clientWidth: 320,
      scrollLeft: 240,
      scrollWidth: 800,
    });
    const end = getHorizontalScrollState({ clientWidth: 320, scrollLeft: 480, scrollWidth: 800 });

    expect(getManualGridScrollHint(start, 31)).toBe('向左滑动查看其余日期，人员列保持固定');
    expect(getManualGridScrollHint(middle, 31)).toBe('左右滑动查看全部 31 天，人员列保持固定');
    expect(getManualGridScrollHint(end, 31)).toBe('向右滑动返回较早日期，人员列保持固定');
  });
});
