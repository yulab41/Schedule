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
    expect(homeView).toContain('class="workbench-shell-heading"');
    expect(homeView).toContain('<h1>{{ activePageTitle }}</h1>');
    expect(homeView).toContain('<NotificationBell />');
    expect(homeView).not.toContain('class="shell-sign-out"');
    expect(homeView.indexOf('<div class="workbench-shell-heading">')).toBeLessThan(
      homeView.indexOf('<GroupSwitcher'),
    );
    expect(homeView.indexOf('<GroupSwitcher')).toBeLessThan(
      homeView.indexOf('<h1>{{ activePageTitle }}</h1>'),
    );
    expect(homeView).not.toContain('class="shell-group-context"');
    expect(homeView).toMatch(
      /\.workbench-shell-header\s*{[^}]*display:\s*flex;[^}]*align-items:\s*flex-end;/s,
    );
    expect(homeView.indexOf('<NotificationBell />')).toBeLessThan(
      homeView.indexOf('class="shell-export-action"'),
    );
  });

  it('keeps the group selector compact without exposing the group code globally', () => {
    expect(groupSwitcher).toContain(
      '{{ selectedGroup?.name }} · {{ roleLabel(selectedGroup?.role) }}',
    );
    expect(groupSwitcher).toContain('aria-label="展开排班群组列表"');
    expect(groupSwitcher).toContain('label: group.name');
    expect(groupSwitcher).toContain('role="listbox"');
    expect(groupSwitcher).toContain(':aria-expanded="isOpen"');
    expect(groupSwitcher).toContain('class="group-switcher-menu"');
    expect(groupSwitcher).toContain('@keydown="handleTriggerKeydown"');
    expect(groupSwitcher).not.toContain('<select');
    expect(groupSwitcher).not.toContain('HTMLSelectElement');
    expect(groupSwitcher).not.toContain('group.groupCode');
    expect(groupSwitcher).not.toContain('当前群组码');
    expect(groupSwitcher).toContain("'update:modelValue': [groupId: string]");
    expect(groupSwitcher).toMatch(
      /\.group-switcher-trigger\s*{[^}]*min-height:\s*var\(--ui-touch-target-minimum\);/s,
    );
    expect(groupSwitcher).toContain('class="group-switcher-arrow-button"');
    expect(groupSwitcher).toContain('aria-label="展开排班群组列表"');
    expect(groupSwitcher).toMatch(
      /\.group-switcher-copy\s*{[^}]*font-size:\s*var\(--ui-font-size-md\);/s,
    );
    expect(groupSwitcher).toMatch(
      /\.group-switcher-arrow-button\s*{[^}]*min-height:\s*var\(--ui-touch-target-minimum\);[^}]*background:\s*transparent;/s,
    );
    expect(groupSwitcher).toMatch(
      /\.group-switcher-arrow\s*{[^}]*border-right:\s*2px solid currentColor;[^}]*border-bottom:\s*2px solid currentColor;/s,
    );
    expect(groupSwitcher).toMatch(
      /\.group-switcher\s*{[^}]*width:\s*fit-content;[^}]*max-width:\s*100%;/s,
    );
    expect(groupSwitcher).toMatch(
      /\.group-switcher-menu\s*{[^}]*position:\s*absolute;[^}]*top:\s*calc\(100% \+ var\(--ui-spacing-xs\)\);/s,
    );
  });

  it('places export in the compact header and keeps its mobile accessible name', () => {
    expect(homeView).toContain('class="shell-export-action"');
    expect(homeView).toContain('aria-label="导出排班"');
    expect(homeView).toContain('@click="exportDialogVisible = true"');
    expect(homeView).not.toContain('grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);');
  });

  it('uses the confirmed full-month card and compact controls', () => {
    expect(calendarView).not.toContain('<h2>排班日历</h2>');
    expect(calendarView).toContain('class="month-calendar-card"');
    expect(calendarView).toContain('class="month-swipe-hint"');
    expect(calendarView).toMatch(
      /\.month-calendar-card\s*{[^}]*border-radius:\s*var\(--ui-radius-large\);[^}]*box-shadow:\s*var\(--ui-shadow-card\);/s,
    );
    expect(calendarView).toMatch(
      /\.view-mode-button\s*{[^}]*min-height:\s*44px;[^}]*font-size:\s*13px;/s,
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
