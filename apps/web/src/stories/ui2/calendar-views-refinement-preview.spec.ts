import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

function readSource(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

describe('calendar views refinement Storybook preview', () => {
  it('keeps the week view as a seven-column Monday-to-Sunday rail', () => {
    const preview = readSource('./CalendarViewsRefinementPreview.vue');

    expect(preview).toContain('class="week-grid"');
    expect(preview).toContain("['一', '二', '三', '四', '五', '六', '日']");
    expect(preview).toMatch(
      /\.week-grid\s*{[^}]*grid-template-columns:\s*repeat\(7,\s*minmax\(0,\s*1fr\)\)/s,
    );
    expect(preview).toContain('{{ weekTitle }}');
    expect(preview).not.toContain('class="week-list"');
  });

  it('uses the month calendar frame and line-divided cells for the week preview', () => {
    const preview = readSource('./CalendarViewsRefinementPreview.vue');

    expect(preview).toContain('class="week-calendar-card"');
    expect(preview).toContain('class="week-weekday-row"');
    expect(preview).toMatch(/\.week-grid\s*{[^}]*gap:\s*1px/s);
    expect(preview).toMatch(/\.week-day-card\s*{[^}]*border:\s*0;[^}]*border-radius:\s*0;/s);
    expect(preview).toContain('assignment.shift.slice(0, 2)');
    expect(preview).toMatch(/\.shift-pill\s*{[^}]*white-space:\s*nowrap;/s);
  });

  it('fits all seven week columns inside the mobile preview without horizontal scrolling', () => {
    const preview = readSource('./CalendarViewsRefinementPreview.vue');

    expect(preview).toMatch(/\.week-rail\s*{[^}]*overflow-x:\s*hidden;/s);
    expect(preview).toContain('@media (max-width: 640px)');
    expect(preview).toContain('grid-template-columns: repeat(7, minmax(0, 1fr));');
    expect(preview).not.toContain('min-width: 984px');
  });

  it('sizes every week card from the longest day content', () => {
    const preview = readSource('./CalendarViewsRefinementPreview.vue');

    expect(preview).toContain('const weekCardHeight = computed(() =>');
    expect(preview).toContain('Math.max(');
    expect(preview).toContain('...weekDays.value.map');
    expect(preview).toContain(':style="{ minHeight:');
    expect(preview).toContain('weekCardHeight}px');
    expect(preview).not.toContain('min-height: 260px');
    expect(preview).not.toContain('min-height: 340px');
  });

  it('uses week navigation for the week view rather than changing the month', () => {
    const preview = readSource('./CalendarViewsRefinementPreview.vue');

    expect(preview).toContain('function shiftWeek(delta: -1 | 1)');
    expect(preview).toContain('@click="shiftWeek(-1)"');
    expect(preview).toContain('@click="shiftWeek(1)"');
    expect(preview).toContain('const weekOffset = ref(0)');
    expect(preview).toContain('getWeekOfMonthLabel(previewWeekStart.value)');
    expect(preview).toContain('getWeekDays(weekStart)');
    expect(preview).toContain('createWeekDays(weekOffset.value)');
    expect(preview).toContain('weekOffset.value += delta');
    expect(preview).not.toContain('Math.max(-1, Math.min(1, weekOffset.value + delta))');
  });

  it('slides a real three-panel month and week track while keeping the frame fixed', () => {
    const preview = readSource('./CalendarViewsRefinementPreview.vue');

    expect(preview).toContain('const monthPanels = computed');
    expect(preview).toContain('const weekPanels = computed');
    expect(preview).toContain('function onSwipePointerDown');
    expect(preview).toContain('function onSwipePointerUp');
    expect(preview).toContain('class="calendar-motion-viewport"');
    expect(preview).toContain('class="calendar-slider-track"');
    expect(preview).toContain('v-for="panel in monthPanels"');
    expect(preview).toContain('v-for="panel in weekPanels"');
    expect(preview).toContain(':aria-hidden="panel.relative !== 0"');
    expect(preview).toContain(':inert="panel.relative !== 0"');
    expect(preview).toContain('function finishTrackSlide');
    expect(preview).toContain('const calendarTrackTransform = computed');
    expect(preview).toContain('const swipeTransitionMs = ref(0)');
    expect(preview).toContain('startedAt: event.timeStamp');
    expect(preview).toContain('getSwipeNavigationIntent({');
    expect(preview).toContain('getSwipeSettleDuration({');
    expect(preview).toContain('cubic-bezier(0.22, 1, 0.36, 1)');
    expect(preview).not.toContain('<Transition :name="slideTransitionName"');
    expect(preview).toMatch(
      /\.calendar-slider-track\s*{[^}]*grid-template-columns:\s*repeat\(3,\s*100%\)/s,
    );
    expect(preview).toMatch(/\.calendar-slider-track\.is-animating\s*{[^}]*transition:/s);
    expect(preview).toContain('@media (prefers-reduced-motion: reduce)');
    expect(preview).toMatch(
      /\.summary-call-action\s*{[^}]*width:\s*44px;[^}]*height:\s*44px;[^}]*background:\s*transparent;/s,
    );
  });

  it('keeps location controls clean after activation', () => {
    const preview = readSource('./CalendarViewsRefinementPreview.vue');

    expect(preview).toMatch(
      /\.locate-button\s*{[^}]*background:\s*transparent;[^}]*border:\s*0;[^}]*box-shadow:\s*none;/s,
    );
    expect(preview).toContain('class="locate-button"');
    expect(preview).not.toContain('locatePulse');
    expect(preview).not.toContain('is-pulsing');
    expect(preview).not.toMatch(/\.locate-button:active/);
    expect(preview).toMatch(/\.locate-crosshair\s*{[^}]*width:\s*16px;[^}]*height:\s*16px;/s);
  });

  it('uses a compact target-style location icon', () => {
    const preview = readSource('./CalendarViewsRefinementPreview.vue');

    expect(preview).toContain('class="locate-crosshair-center"');
    expect(preview).toMatch(
      /\.locate-crosshair::before\s*{[^}]*border:\s*2px solid currentColor;/s,
    );
    expect(preview).toMatch(
      /\.locate-crosshair-center\s*{[^}]*width:\s*4px;[^}]*height:\s*4px;[^}]*border-radius:\s*50%;/s,
    );
  });

  it('opens selected week-day details below the seven-column rail', () => {
    const preview = readSource('./CalendarViewsRefinementPreview.vue');
    const weekTemplateStart = preview.indexOf('<section v-else-if="activeView === \'week\'"');
    const weekTemplateEnd = preview.indexOf('<section v-else class="list-view"');
    const weekTemplate = preview.slice(weekTemplateStart, weekTemplateEnd);

    expect(preview).toContain('const selectedWeekdayIndex = ref(2)');
    expect(preview).toContain('function selectWeekDay(dayIndex: number)');
    expect(preview).toContain('@click="selectWeekDay(dayIndex)"');
    expect(preview).toContain('class="selected-summary week-selected-summary"');
    expect(weekTemplate).toContain('class="assignment-meta"');
    expect(weekTemplate).toContain('v-if="day.holiday"');
    expect(weekTemplate).not.toContain("day.date === '17'");
    expect(weekTemplate).not.toContain('weekend-chip');
    expect(weekTemplate).not.toContain('class="call-button"');
    expect(preview).toContain('v-for="assignment in selectedWeekDay.assignments"');
  });

  it('keeps the month calendar and selected-date details as separately spaced surfaces', () => {
    const preview = readSource('./CalendarViewsRefinementPreview.vue');
    const monthTemplateStart = preview.indexOf('<section v-if="activeView === \'month\'"');
    const monthTemplateEnd = preview.indexOf('<section v-else-if="activeView === \'week\'"');
    const monthTemplate = preview.slice(monthTemplateStart, monthTemplateEnd);

    expect(monthTemplate).toContain('class="month-view"');
    expect(monthTemplate).toContain('class="month-card"');
    expect(monthTemplate).toContain('class="selected-summary month-selected-summary"');
    expect(preview).toMatch(/\.month-view\s*{[^}]*margin:\s*12px;/s);
    expect(preview).toMatch(/\.month-selected-summary\s*{[^}]*margin:\s*12px 0 0;/s);
  });

  it('lets the fixed month frame clip square cells without exposing reverse corners', () => {
    const preview = readSource('./CalendarViewsRefinementPreview.vue');

    expect(preview).toContain('const weekCount = Math.ceil((firstMondayOffset + daysInMonth) / 7)');
    expect(preview).toContain('Array.from({ length: weekCount * 7 }');
    expect(preview).toContain('const currentMonthGridHeight = computed');
    expect(preview).toContain(':style="{ height: `${currentMonthGridHeight}px` }"');
    expect(preview).toMatch(
      /\.month-cell:nth-last-child\(7\)\s*{[^}]*border-bottom-left-radius:\s*17px;/s,
    );
    expect(preview).toMatch(/\.month-cell:last-child\s*{[^}]*border-bottom-right-radius:\s*17px;/s);
    expect(preview).toMatch(
      /\.week-day-card:first-child\s*{[^}]*border-bottom-left-radius:\s*17px;/s,
    );
    expect(preview).toMatch(
      /\.week-day-card:last-child\s*{[^}]*border-bottom-right-radius:\s*17px;/s,
    );
    expect(preview).not.toMatch(/\.week-day-card\.today\s*{[^}]*box-shadow:/s);
    expect(preview).not.toMatch(/\.week-day-card\.today\s*{[^}]*background:/s);
    expect(preview).toMatch(
      /\.week-day-card\.today \.week-day-heading strong\s*{[^}]*background:/s,
    );
  });

  it('exposes mobile and desktop Storybook entries for the visual review', () => {
    const stories = readSource('./CalendarViewsRefinementPreview.stories.ts');

    expect(stories).toContain("title: 'Web UI 2.0/Calendar Views Refinement'");
    expect(stories).toContain('export const Mobile390');
    expect(stories).toContain('export const Desktop1280');
  });
});
