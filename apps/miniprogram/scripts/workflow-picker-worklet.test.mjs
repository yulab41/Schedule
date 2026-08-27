import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const sourceRoot = join(
  process.cwd(),
  'src',
  'subpackages',
  'workflows',
  'components',
  'workflow-picker',
);

function read(name) {
  return readFileSync(join(sourceRoot, name), 'utf8');
}

describe('workflow picker UI-thread wheel architecture', () => {
  it('keeps native scrolling as the only snap owner and observes pixels on the UI thread', () => {
    const source = read('index.ts');
    const template = read('index.wxml');

    expect(template).toContain('worklet:onscrollupdate="handleYearWheelScrollUpdate"');
    expect(template).toContain('worklet:onscrollupdate="handleMonthWheelScrollUpdate"');
    expect(template).toContain('scroll-anchoring="{{false}}"');
    expect(template).toContain('id="workflow-picker-year-item-{{index}}"');
    expect(template).toContain('id="workflow-picker-month-number-{{index}}"');
    expect(template).not.toContain('scroll-with-animation="{{wheelSnapAnimating}}"');
    expect(template).not.toContain('bindscroll="handleYearWheelScroll"');
    expect(template).not.toContain('bindscroll="handleMonthWheelScroll"');

    expect(source).toContain('MiniProgramSharedValue<number>');
    expect(source).toContain('applyAnimatedStyle');
    expect(source).toContain('wx.worklet.runOnJS');
    expect(source).not.toContain('scheduleWheelSnap');
    expect(source).not.toContain('completeWheelSnap');
    expect(source).not.toContain('_wheelAnimationTimer');
    expect(source).not.toContain('setWheelProgress');
  });

  it('uses fixed glyph metrics plus compositor transforms for the existing 19-to-24px visual', () => {
    const source = read('index.ts');
    const styles = read('index.wxss');
    const template = read('index.wxml');

    expect(template).toContain('class="workflow-picker-wheel-number"');
    expect(styles).toMatch(
      /\.workflow-picker-wheel-number\s*\{[^}]*font-size:\s*24px;[^}]*transform:\s*scale\(0\.7916667\);/su,
    );
    expect(source).toContain('(19 + 5 * proximity) / 24');
    expect(source).toContain('0.94 + 0.06 * proximity');
    expect(source).toContain('0.58 + 0.42 * proximity');
  });
});
