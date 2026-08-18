import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

function readSource(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

describe('formal calendar view refinement', () => {
  it('keeps the week view as a seven-column calendar surface with a stable cell baseline', () => {
    const weekGrid = readSource('./WeekGrid.vue');
    const calendarView = readSource('../../views/calendar/CalendarView.vue');

    expect(weekGrid).not.toContain('const weekCardHeight = computed(() =>');
    expect(weekGrid).not.toContain('weekCardHeight}px');
    expect(weekGrid).toMatch(/\.day-cell\s*{[^}]*min-height:\s*86px;/s);
    expect(weekGrid).toContain('class="weekday-row"');
    expect(weekGrid).toContain('class="day-cell"');
    expect(weekGrid).toContain('contact-mode="hidden"');
    expect(weekGrid).toContain('compact-shift-badge');
    expect(weekGrid).toMatch(/\.week-row\s*{[^}]*gap:\s*1px/s);
    expect(weekGrid).toMatch(/\.day-cell\s*{[^}]*border:\s*0;[^}]*border-radius:\s*0;/s);
    expect(calendarView).toContain('class="week-calendar-card"');
    expect(calendarView).toContain(
      'weekPanels.value.flatMap((panelWeek) => getWeekBusinessMonths(panelWeek))',
    );
    expect(calendarView).not.toContain('syncMonthToWeek');
    expect(calendarView).toMatch(
      /<section v-if="viewMode === 'week'" class="week-calendar-card">[\s\S]*class="week-navigation"[\s\S]*class="calendar-weekday-row"[\s\S]*class="calendar-swipe-track"[\s\S]*<WeekGrid/s,
    );
    expect(weekGrid).toMatch(
      /@media \(max-width: 640px\)[\s\S]*?\.week-row\s*{[^}]*grid-template-columns:\s*repeat\(7,\s*minmax\(0,\s*1fr\)\)/s,
    );
    expect(weekGrid).not.toMatch(
      /@media \(max-width: 640px\)[\s\S]*?\.week-row\s*{[^}]*grid-template-columns:\s*1fr/s,
    );
  });

  it('uses native touch scrolling and scroll snap for real adjacent month and week cells', () => {
    const calendarView = readSource('../../views/calendar/CalendarView.vue');
    const monthGrid = readSource('./MonthGrid.vue');
    const weekGrid = readSource('./WeekGrid.vue');

    expect(calendarView).toContain('v-for="(panelMonth, panelIndex) in monthPanels"');
    expect(calendarView).toContain('v-for="(panelWeek, panelIndex) in weekPanels"');
    expect(calendarView).toContain(':business-month="panelMonth"');
    expect(calendarView).toContain(':week-start="panelWeek"');
    expect(calendarView).not.toContain('function onCalendarPointerDown');
    expect(calendarView).not.toContain('setPointerCapture');
    expect(calendarView).not.toContain('event.preventDefault()');
    expect(calendarView).toContain('@scroll.passive="onCalendarScroll"');
    expect(calendarView).toContain('@scrollend="onCalendarScrollEnd"');
    expect(calendarView).toContain('syncSwipeViewportHeight');
    expect(calendarView).toMatch(
      /\.calendar-swipe-viewport\s*{[^}]*overflow-x:\s*auto;[^}]*scroll-snap-type:\s*x mandatory;[^}]*touch-action:\s*pan-x pan-y;/s,
    );
    expect(calendarView).toMatch(
      /\.calendar-swipe-track\s*{[^}]*width:\s*300%;[^}]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\);[^}]*align-items:\s*start;/s,
    );
    expect(calendarView).toMatch(
      /\.calendar-swipe-panel\s*{[^}]*scroll-snap-align:\s*start;[^}]*scroll-snap-stop:\s*always;/s,
    );
    expect(monthGrid).toMatch(/touch-action:\s*pan-x pan-y;/);
    expect(monthGrid).not.toMatch(/touch-action:\s*pan-y;/);
    expect(monthGrid).toContain('v-if="showWeekdayHeader !== false"');
    expect(weekGrid).toContain('v-if="showWeekdayHeader !== false"');
    expect(monthGrid).toMatch(/withDefaults\([\s\S]*showWeekdayHeader:\s*true/);
    expect(weekGrid).toMatch(/withDefaults\([\s\S]*showWeekdayHeader:\s*true/);
  });

  it('selects a week day and renders the existing detail track below it', () => {
    const weekGrid = readSource('./WeekGrid.vue');
    const calendarView = readSource('../../views/calendar/CalendarView.vue');

    expect(weekGrid).toContain("(event: 'select-date', businessDate: string)");
    expect(weekGrid).toContain('@click="selectDate(date)"');
    expect(calendarView).toContain('@select-date="selectedDate = $event"');
    expect(calendarView).toContain("viewMode === 'month' || viewMode === 'week'");
    expect(calendarView).toContain('selectedDate !== undefined');
    expect(calendarView).toContain(
      'const shouldInitializeSelection = selectedDate.value === undefined',
    );
    expect(calendarView).not.toContain(
      "viewMode.value !== 'week' || selectedDate.value === undefined",
    );
    expect(calendarView).not.toContain('selectedDate.value = weekStart.value;');
  });

  it('binds month selection and selected-date details to the same complete date key', () => {
    const calendarView = readSource('../../views/calendar/CalendarView.vue');
    const selectedDateDetails = readSource('./selected-date-duty.ts');

    expect(calendarView).toContain(
      'selectedDate.value = retargetSelectedDateToMonth(selectedDate.value, targetBusinessMonth)',
    );
    expect(calendarView.indexOf('selectedDate.value = retargetSelectedDateToMonth')).toBeLessThan(
      calendarView.indexOf('businessMonth.value = targetBusinessMonth'),
    );
    expect(calendarView).toContain(':model-value="businessMonth"');
    expect(calendarView).toContain('@update:model-value="setBusinessMonth"');
    expect(selectedDateDetails).toContain(
      'groupAssignmentsByDate(assignments).get(selectedDate) ?? []',
    );
  });

  it('clips square sliding cells with the fixed card and draws rounded selection independently', () => {
    const weekGrid = readSource('./WeekGrid.vue');
    const monthGrid = readSource('./MonthGrid.vue');
    const calendarView = readSource('../../views/calendar/CalendarView.vue');

    expect(monthGrid).not.toMatch(
      /\.week-row:last-child \.day-cell:first-child\s*{[^}]*border-bottom-left-radius:/s,
    );
    expect(monthGrid).toMatch(
      /\.week-row:last-child \.day-cell:first-child\.is-selected::after\s*{[^}]*border-bottom-left-radius:\s*calc\(var\(--ui-radius-large\) - 1px\);/s,
    );
    expect(monthGrid).toMatch(
      /\.week-row:last-child \.day-cell:last-child\.is-selected::after\s*{[^}]*border-bottom-right-radius:\s*calc\(var\(--ui-radius-large\) - 1px\);/s,
    );
    expect(weekGrid).not.toMatch(
      /\.week-row \.day-cell:first-child\s*{[^}]*border-bottom-left-radius:/s,
    );
    expect(weekGrid).toMatch(
      /\.week-row \.day-cell:first-child\.is-selected::after\s*{[^}]*border-bottom-left-radius:\s*calc\(var\(--ui-radius-large\) - 1px\);/s,
    );
    expect(weekGrid).toMatch(
      /\.week-row \.day-cell:last-child\.is-selected::after\s*{[^}]*border-bottom-right-radius:\s*calc\(var\(--ui-radius-large\) - 1px\);/s,
    );
    expect(weekGrid).not.toMatch(/\.day-cell\.is-today\s*{[^}]*box-shadow:/s);
    expect(weekGrid).toMatch(/\.is-today \.day-number\s*{[^}]*background:/s);
    expect(calendarView).not.toContain("'is-swiping': swipeTrackMoving");
    expect(calendarView).not.toContain('swipeTrackMoving');
    expect(calendarView).not.toMatch(
      /\.week-calendar-card \.calendar-swipe-panel\s*{[^}]*display:\s*flex;/s,
    );
    expect(calendarView).not.toMatch(
      /\.week-calendar-card :deep\(\.week-grid\)\s*{[^}]*height:\s*100%;/s,
    );
    expect(calendarView).not.toContain('.calendar-swipe-viewport.is-swiping');
    expect(calendarView).toMatch(
      /\.month-calendar-card,\s*\.week-calendar-card\s*{[^}]*overflow:\s*hidden;[^}]*border-radius:\s*var\(--ui-radius-large\);/s,
    );
  });

  it('sizes the swipe viewport from the active panel instead of the tallest adjacent month', () => {
    const calendarView = readSource('../../views/calendar/CalendarView.vue');

    expect(calendarView).toContain(':style="swipeViewportStyle"');
    expect(calendarView).toContain('const swipeViewportHeightPx = ref<number>();');
    expect(calendarView).toContain('panelHeights');
    expect(calendarView).toContain('interpolatedHeight');
    expect(calendarView).toMatch(/\.calendar-swipe-track\s*{[^}]*align-items:\s*start;/s);
  });

  it('adds frozen month controls to the list view', () => {
    const calendarView = readSource('../../views/calendar/CalendarView.vue');
    const listGrid = readSource('./ListGrid.vue');
    const dutyCell = readSource('./DutyCell.vue');

    expect(calendarView).toContain('class="list-sticky-toolbar"');
    expect(calendarView).toContain('aria-label="上一月"');
    expect(calendarView).toContain('aria-label="定位到今天"');
    expect(calendarView).toContain('aria-label="下一月"');
    expect(listGrid).toContain('contact-mode="button"');
    expect(listGrid).toContain('marker-mode="button"');
    expect(listGrid).toContain('defineExpose({ scrollToDate })');
    expect(listGrid).toContain(':data-business-date="day.businessDate"');
    expect(listGrid).toContain('show-details');
    expect(listGrid).toContain('{{ day.assignments.length }} 班');
    expect(listGrid).toContain("'is-today': day.isToday");
    expect(dutyCell).toContain('class="duty-details"');
    expect(dutyCell).toContain('formatShiftTimeRange(props.assignment)');
    expect(dutyCell).toMatch(/\.change-marker-list\s*{[^}]*display:\s*contents;/s);
    expect(dutyCell).toMatch(
      /\.duty-cell\.contact-button \.change-marker-list\s*{[^}]*display:\s*inline-flex;/s,
    );
    expect(calendarView).toContain('月份工具栏固定 · 已按日期排序');
    expect(calendarView).toContain("今天 · {{ todayBusinessDate.slice(5).replace('-', '/') }}");
    expect(calendarView).toContain('当前筛选下今天没有排班');
    expect(calendarView).toContain('listGridRef.value?.scrollToDate');
  });

  it('keeps month and week names and change markers read-only', () => {
    const monthGrid = readSource('./MonthGrid.vue');
    const weekGrid = readSource('./WeekGrid.vue');
    const listGrid = readSource('./ListGrid.vue');
    const dutyCell = readSource('./DutyCell.vue');

    expect(monthGrid).toContain('contact-mode="hidden"');
    expect(monthGrid).toContain('marker-mode="static"');
    expect(weekGrid).toContain('contact-mode="hidden"');
    expect(weekGrid).toContain('marker-mode="static"');
    expect(monthGrid).not.toContain('@open-events="emit(\'open-events\', $event)"');
    expect(weekGrid).not.toContain('@open-events="emit(\'open-events\', $event)"');
    expect(listGrid).toContain('contact-mode="button"');
    expect(listGrid).toContain('marker-mode="button"');
    expect(dutyCell).toContain("readonly markerMode?: 'button' | 'static'");
    expect(dutyCell).toContain('v-if="markerMode === \'button\'"');
    expect(dutyCell).toContain('v-else class="change-marker-static"');
    expect(dutyCell).toContain("canCall.value && contactMode.value !== 'hidden'");
  });

  it('uses touch-safe navigation feedback without a persistent mobile hover state', () => {
    const calendarView = readSource('../../views/calendar/CalendarView.vue');

    expect(calendarView).not.toContain('<t-button class="week-step"');
    expect(calendarView).not.toContain('<t-button class="month-step"');
    expect(calendarView).toContain('class="calendar-step week-step"');
    expect(calendarView).toContain('class="calendar-step month-step"');
    expect(calendarView).toMatch(
      /\.calendar-step:active,\s*\.calendar-locator:active\s*{[^}]*transform:\s*scale\(0\.9\);/s,
    );
    expect(calendarView).toContain('@touchstart.passive="pressCalendarControl"');
    expect(calendarView).toContain('@touchend.passive="releaseCalendarControl"');
    expect(calendarView).toContain('@touchcancel.passive="releaseCalendarControl"');
    expect(calendarView).toMatch(
      /\.calendar-step\.is-touch-pressed,\s*\.calendar-locator\.is-touch-pressed\s*{[^}]*transform:\s*scale\(0\.9\);/s,
    );
    expect(calendarView).not.toContain('.calendar-step:hover');
    expect(calendarView).not.toContain('.calendar-locator:hover');
    expect(calendarView).toMatch(
      /\.calendar-step:focus-visible,\s*\.calendar-locator:focus-visible\s*{[^}]*outline:/s,
    );
    expect(calendarView).toContain('class="calendar-locator"');
    expect(calendarView).toContain('class="locator-crosshair-center"');
    expect(calendarView).toMatch(
      /\.calendar-locator\s*{[^}]*background:\s*transparent;[^}]*border:\s*0;[^}]*box-shadow:\s*none;/s,
    );
    expect(calendarView).not.toContain('is-pulsing');
  });

  it('uses direct dial links in list and selected-date details on every pointer type', () => {
    const dutyCell = readSource('./DutyCell.vue');
    const selectedDateDetails = readSource('./SelectedDateDutyDetails.vue');

    expect(dutyCell).toContain('v-for="option in phoneOptions"');
    expect(dutyCell).toContain(':href="buildDialLink(option.number)"');
    expect(dutyCell).not.toContain('isCoarsePointer');
    expect(dutyCell).not.toContain('@click="copyNumber(option.number)"');
    expect(selectedDateDetails).toContain('v-for="option in row.phoneOptions"');
    expect(selectedDateDetails).not.toContain('@click="copyNumber(option.number)"');
  });
});
