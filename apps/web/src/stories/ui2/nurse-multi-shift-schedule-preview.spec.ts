import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

function readSource(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

describe('nurse multi-shift schedule Storybook preview', () => {
  it('reuses the production month and week components without redesigning their surfaces', () => {
    const preview = readSource('./NurseMultiShiftSchedulePreview.vue');

    expect(preview).toContain("import MonthGrid from '../../features/calendar/MonthGrid.vue'");
    expect(preview).toContain("import WeekGrid from '../../features/calendar/WeekGrid.vue'");
    expect(preview).toContain('<MonthGrid');
    expect(preview).toContain('<WeekGrid');
    expect(preview).not.toContain('class="week-time-matrix"');
    expect(preview).not.toContain('class="mobile-time-rail"');
    expect(preview).not.toContain('class="month-duty-pill"');
  });

  it('filters month data to one default shift while retaining every matching staff name', () => {
    const preview = readSource('./NurseMultiShiftSchedulePreview.vue');

    expect(preview).toContain('const monthAssignments = computed');
    expect(preview).toContain('assignment.shiftTypeId === selectedMonthShift.value');
    expect(preview).toContain('月视图当前仅显示');
    expect(preview).not.toContain('· {{ cell.count }}人');
    expect(preview).toContain("['computer', 'd', 'a', 'p', 'n', 'np']");
  });

  it('groups only the detail cards and exposes every staff name with split phone actions', () => {
    const preview = readSource('./NurseMultiShiftSchedulePreview.vue');

    expect(preview).toContain('class="shift-detail-card"');
    expect(preview).toContain('v-for="staff in shift.staff"');
    expect(preview).toContain('class="staff-name-button"');
    expect(preview).toContain('class="phone-split-actions"');
    expect(preview).not.toContain('D · 3人');
    expect(preview).toContain('短号');
    expect(preview).toContain('手机');
  });

  it('shows group defaults and member overrides as separate settings stories', () => {
    const preview = readSource('./NurseMultiShiftSchedulePreview.vue');
    const stories = readSource('./NurseMultiShiftSchedulePreview.stories.ts');

    expect(preview).toContain('群组日历默认设置');
    expect(preview).toContain('我的日历偏好');
    expect(preview).toContain('成员的个人设置优先于群组默认');
    expect(stories).toContain('export const GroupDefaults');
    expect(stories).toContain('export const MemberPreferences');
    expect(stories).toContain('export const MobileWeek390');
    expect(stories).toContain('export const DesktopWeek1280');
  });

  it('keeps mobile actions reachable and supports reduced motion', () => {
    const preview = readSource('./NurseMultiShiftSchedulePreview.vue');

    expect(preview).toContain('min-height: 44px');
    expect(preview).toContain('@media (prefers-reduced-motion: reduce)');
    expect(preview).toContain(':focus-visible');
  });
});
