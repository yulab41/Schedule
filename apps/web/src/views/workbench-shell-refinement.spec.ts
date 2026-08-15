import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

function readSource(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

const appLayout = readSource('../layouts/AppLayout.vue');
const homeView = readSource('./HomeView.vue');
const groupSwitcher = readSource('../features/groups/GroupSwitcher.vue');
const calendarView = readSource('./calendar/CalendarView.vue');
const monthGrid = readSource('../features/calendar/MonthGrid.vue');
const leavePanel = readSource('../features/leaves/LeavePanel.vue');
const swapPanel = readSource('../features/swaps/SwapPanel.vue');
const dutyPanel = readSource('../features/duty-adjustments/DutyAdjustmentPanel.vue');

describe('formal compact workbench shell', () => {
  it('removes the product banner and lets the workbench own the top header', () => {
    expect(appLayout).not.toContain('class="app-header"');
    expect(appLayout).not.toContain('class="product-name"');
    expect(homeView).toContain('class="workbench-shell-header"');
    expect(homeView).toContain('<h1>{{ activePageTitle }}</h1>');
    expect(homeView).toContain('<NotificationBell />');
    expect(homeView).not.toContain('class="home-heading"');
    expect(homeView).not.toContain('class="workbench-context-heading"');
  });

  it('keeps the group selector compact without exposing the group code globally', () => {
    expect(groupSwitcher).toContain(
      '{{ selectedGroup?.name }} · {{ roleLabel(selectedGroup?.role) }}',
    );
    expect(groupSwitcher).toContain('aria-label="切换排班群组"');
    expect(groupSwitcher).toContain('label: group.name');
    expect(groupSwitcher).not.toContain('group.groupCode');
    expect(groupSwitcher).not.toContain('当前群组码');
    expect(groupSwitcher).toContain("'update:modelValue': [groupId: string]");
  });

  it('places export in the compact header and keeps its mobile accessible name', () => {
    expect(homeView).toContain('class="shell-export-action"');
    expect(homeView).toContain('aria-label="导出排班"');
    expect(homeView).toContain('@click="exportDialogVisible = true"');
  });

  it('uses the confirmed full-month card and compact controls', () => {
    expect(calendarView).not.toContain('<h2>排班日历</h2>');
    expect(calendarView).toContain('class="month-calendar-card"');
    expect(calendarView).toContain('class="month-swipe-hint"');
    expect(calendarView).toMatch(
      /\.month-calendar-card\s*{[^}]*border-radius:\s*var\(--ui-radius-large\);[^}]*box-shadow:\s*var\(--ui-shadow-card\);/s,
    );
    expect(calendarView).toMatch(
      /\.view-mode-switch :deep\(\.t-radio-button\)\s*{[^}]*min-height:[^;]+;[^}]*font-size:\s*var\(--ui-font-size-sm\);/s,
    );
    expect(monthGrid).toContain("weekday === '六' || weekday === '日'");
    expect(monthGrid).toMatch(
      /\.weekday-row span\.is-weekend\s*{[^}]*color:\s*var\(--ui-color-weekend\);/s,
    );
    expect(monthGrid).toMatch(
      /\.day-cell\.is-weekend \.day-number\s*{[^}]*color:\s*var\(--ui-color-weekend\);/s,
    );
  });

  it('does not repeat workflow titles below the shared page title', () => {
    expect(leavePanel).not.toContain('<h2>请假与审批</h2>');
    expect(swapPanel).not.toContain('<h2>换班</h2>');
    expect(dutyPanel).not.toContain('<h2>加扣班</h2>');
  });
});
