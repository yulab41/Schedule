import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

function readSource(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

describe('next visual refinement Storybook previews', () => {
  it('shows all check-style controls as compact notification-like switches', () => {
    const preview = readSource('./CompactControlsPreview.vue');
    const stories = readSource('./CompactControlsPreview.stories.ts');

    expect(preview).toContain('role="switch"');
    expect(preview).toContain('class="control-switch"');
    expect(preview).toMatch(/\.control-switch\s*{[^}]*width:\s*52px;[^}]*height:\s*30px;/s);
    expect(preview).toMatch(
      /\.switch-hit-area\s*{[^}]*min-width:\s*60px;[^}]*min-height:\s*44px;/s,
    );
    expect(preview).not.toContain('type="checkbox"');
    expect(stories).toContain('CompactMobile390');
    expect(stories).toContain('CompactMobile320');
    expect(stories).toContain('Desktop1280');
  });

  it('presents shift types as compact rows with inline time ranges and switches', () => {
    const preview = readSource('./ShiftTypeSettingsPreview.vue');
    const colorPicker = readSource('../../features/scheduling-config/ShiftColorPicker.vue');
    const stories = readSource('./ShiftTypeSettingsPreview.stories.ts');

    expect(preview).toContain('class="shift-type-row"');
    expect(preview).toContain('class="time-range-control"');
    expect(preview).toContain('class="shift-summary"');
    expect(preview).toContain('class="compact-switch"');
    expect(preview).toContain('import ShiftColorPicker');
    expect(preview).toContain('<ShiftColorPicker v-model="shift.color" />');
    expect(colorPicker).toContain('class="custom-color-trigger color-swatch"');
    expect(colorPicker).toContain('class="custom-color-panel"');
    expect(colorPicker).not.toContain('type="color"');
    expect(colorPicker).toContain('class="color-spectrum"');
    expect(colorPicker).toContain('type="range"');
    expect(colorPicker).toContain('HEX');
    expect(colorPicker).toContain('function applyCustomColor');
    expect(preview).not.toContain('type="checkbox"');
    expect(stories).toContain('Mobile390');
    expect(stories).toContain('Mobile320');
    expect(stories).toContain('Desktop1280');
  });

  it('uses a continuous chronological rail for the event page', () => {
    const preview = readSource('./EventTimelinePagePreview.vue');
    const stories = readSource('./EventTimelinePagePreview.stories.ts');

    expect(preview).toContain('class="timeline-rail"');
    expect(preview).toContain('class="timeline-node"');
    expect(preview).toContain('class="event-summary-card"');
    expect(preview).toContain('class="timeline-day-label"');
    expect(preview).toContain('class="timeline-day-toggle"');
    expect(preview).toContain(':aria-expanded="isDateExpanded(day.key)"');
    expect(preview).toContain('function toggleDate');
    expect(preview).toContain('function expandAllDates');
    expect(preview).toContain('function collapseAllDates');
    expect(preview).toContain('展开全部日期');
    expect(preview).toContain('折叠全部日期');
    expect(preview).not.toContain('<table');
    expect(stories).toContain('Mobile390');
    expect(stories).toContain('Mobile320');
    expect(stories).toContain('Desktop1280');
  });
});
