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
    expect(preview).toContain('第 {{ weekNumber }} 周');
    expect(preview).not.toContain('class="week-list"');
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
    expect(weekTemplate).toContain("day.holiday || day.date === '17'");
    expect(weekTemplate).not.toContain('weekend-chip');
    expect(weekTemplate).not.toContain('class="call-button"');
    expect(preview).toContain('v-for="assignment in selectedWeekDay.assignments"');
  });

  it('exposes mobile and desktop Storybook entries for the visual review', () => {
    const stories = readSource('./CalendarViewsRefinementPreview.stories.ts');

    expect(stories).toContain("title: 'Web UI 2.0/Calendar Views Refinement'");
    expect(stories).toContain('export const Mobile390');
    expect(stories).toContain('export const Desktop1280');
  });
});
