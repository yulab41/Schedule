import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const calendarView = readFileSync(
  fileURLToPath(new URL('../../views/calendar/CalendarView.vue', import.meta.url)),
  'utf8',
);

describe('calendar navigation performance regression', () => {
  it('settles programmatic scrolling after the browser finishes instead of using an early timer', () => {
    expect(calendarView).not.toContain('scheduleSwipeSettle(reducedMotion ? 0 : 180)');
    expect(calendarView).toContain('PROGRAMMATIC_SWIPE_FALLBACK_MS');
    expect(calendarView).toContain('navigationRequest?.direction ?? snappedDirection');
    expect(calendarView).toContain('activeSwipeNavigation !== undefined');
    expect(calendarView).toContain('!swipeTouchActive && activeSwipeNavigation === undefined');
    expect(calendarView).toContain('queuedSwipeNavigation');
    expect(calendarView).toContain('flushQueuedSwipeNavigation');
  });

  it('reuses immutable calendar resources and keeps selection stable after the first load', () => {
    expect(calendarView).toContain('shallowRef<CalendarReadModel>');
    expect(calendarView).toContain('calendarResourceCache.get');
    expect(calendarView).toContain('holidayResourceCache.get');
    expect(calendarView).toContain('forceRefresh: true');
    expect(calendarView).toContain(
      'const shouldInitializeSelection = selectedDate.value === undefined',
    );
    expect(calendarView).not.toContain(
      "if (viewMode.value === 'week') {\n    selectedDate.value = todayBusinessDate;",
    );
    expect(calendarView).not.toContain('selectedDate.value = weekStart.value;');
  });

  it('animates locate-today through the existing month and week swipe viewport', () => {
    expect(calendarView).toContain('targetBusinessMonth');
    expect(calendarView).toContain('targetWeekStart');
    expect(calendarView).toMatch(/startSwipeNavigation\([\s\S]*targetBusinessMonth/);
    expect(calendarView).toMatch(/startSwipeNavigation\([\s\S]*targetWeekStart/);
  });
});
