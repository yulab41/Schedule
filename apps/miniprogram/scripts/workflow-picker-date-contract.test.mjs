import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const miniRoot = process.cwd();

function read(relativePath) {
  return readFileSync(path.join(miniRoot, 'src', relativePath), 'utf8');
}

describe('EXP-CALENDAR-003 date picker contract', () => {
  it('uses the same shared pager state machine and native motion parameters as the home calendar', () => {
    const homePager = read('components/calendar/calendar-month/index.ts');
    const picker = read('subpackages/workflows/components/workflow-picker/index.ts');
    const homeTemplate = read('components/calendar/calendar-month/index.wxml');
    const pickerTemplate = read('subpackages/workflows/components/workflow-picker/index.wxml');

    for (const source of [homePager, picker]) {
      expect(source).toContain('calendar-period-pager');
      expect(source).toContain('CALENDAR_PERIOD_SWIPER_DURATION_MS');
      expect(source).toContain('requestCalendarPeriodShift');
      expect(source).toContain('commitCalendarPeriodSwipe');
    }
    for (const template of [homeTemplate, pickerTemplate]) {
      expect(template).toContain('duration="{{');
      expect(template).toContain('easing-function="{{');
      expect(template).toContain('circular="{{true}}"');
      expect(template).toContain('skip-hidden-item-layout="{{false}}"');
    }
  });

  it('commits date month changes only from animationfinish and keeps one horizontal owner', () => {
    const template = read('subpackages/workflows/components/workflow-picker/index.wxml');
    const controller = read('subpackages/workflows/components/workflow-picker/index.ts');

    expect(template).toContain('bindchange="handleDateSwiperChangeStart"');
    expect(template).toContain('bindanimationfinish="handleDateSwiperFinish"');
    expect(template).toContain('wx:key="slot"');
    expect(template).not.toContain('bindchange="handleDateSwiperChange"');
    expect(template).not.toContain('bindtouchmove=');
    expect(template).not.toContain('<wxs');
    expect(controller).toContain('handleDateSwiperChangeStart');
    expect(controller).toContain('handleDateSwiperFinish');
    expect(controller).toContain('dateLocateTarget');
    expect(controller).not.toContain('dateSwiperIndex: 1 });');
  });

  it('uses the existing yellow semantic token and separates today, selected, weekend, and disabled states', () => {
    const template = read('subpackages/workflows/components/workflow-picker/index.wxml');
    const styles = read('subpackages/workflows/components/workflow-picker/index.wxss');
    const weekendRule = styles.indexOf('.workflow-picker-date-cell.is-weekend:not(.is-muted)');
    const selectedRule = styles.indexOf('.workflow-picker-date-cell.is-selected');
    const selectedCellRule = styles.slice(
      selectedRule,
      styles.indexOf('.workflow-picker-date-cell.is-disabled', selectedRule),
    );

    expect(template).toContain("{{item.isToday ? 'is-today' : ''}}");
    expect(selectedCellRule).toContain('background: var(--ui-color-today-marker);');
    expect(selectedCellRule).toContain('color: var(--ui-color-near-black);');
    expect(styles).toContain('.workflow-picker-date-cell.is-today:not(.is-selected) > text');
    expect(styles).toContain('.workflow-picker-date-cell.is-today.is-selected > text');
    expect(styles).toContain('.workflow-picker-date-cell.is-disabled');
    expect(selectedRule).toBeGreaterThan(weekendRule);
    expect(selectedCellRule).not.toContain('background: var(--ui-color-primary);');
  });
});
