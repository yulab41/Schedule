import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

function readSource(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

describe('Lucide Minimal production action icons', () => {
  it('uses one production component as the Storybook and application source of truth', () => {
    const componentPath = fileURLToPath(new URL('./LucideMinimalActionIcon.vue', import.meta.url));
    const preview = readSource('../stories/ui2/LucideMinimalActionPreview.vue');

    expect(existsSync(componentPath)).toBe(true);
    expect(preview).toContain("from '../../components/LucideMinimalActionIcon.vue'");
    expect(preview).not.toContain("from './LucideMinimalActionIcon.vue'");

    if (!existsSync(componentPath)) return;
    const icon = readFileSync(componentPath, 'utf8');
    const generatedMotion = readSource('../generated/ui-icon-motion.css');
    expect(icon).toContain('readonly motionKey?: number;');
    expect(icon).toContain('const isAnimating = ref(false);');
    expect(icon).toContain("flush: 'sync'");
    expect(icon).toContain(':class="{ \'is-animating\': isAnimating }"');
    expect(icon).not.toContain("'is-animating': motionKey > 0");
    expect(icon).not.toContain('@keyframes');
    expect(generatedMotion).toContain('@media (prefers-reduced-motion: reduce)');
    expect(generatedMotion).toContain('.icon-bell .is-animating');
    expect(generatedMotion).toContain('620ms cubic-bezier(0.2, 0, 0, 1)');
    expect(icon).not.toContain('infinite');
    expect(icon).not.toContain('opacity:');
    expect(icon).not.toContain('stroke-dasharray');
    expect(icon).not.toContain('stroke-dashoffset');
  });

  it('connects notification, profile, and export motion without changing their actions', () => {
    const home = readSource('../views/HomeView.vue');
    const notification = readSource('../features/notifications/NotificationBell.vue');

    expect(home).toContain(
      "import LucideMinimalActionIcon from '../components/LucideMinimalActionIcon.vue'",
    );
    expect(home).toContain('const profileMotionKey = ref(0);');
    expect(home).toContain('const exportMotionKey = ref(0);');
    expect(home).toContain('function playProfileMotion(): void');
    expect(home).toContain('function openExportDialog(): void');
    expect(home).toContain('name="profile"');
    expect(home).toContain(':motion-key="profileMotionKey"');
    expect(home).toContain('name="export"');
    expect(home).toContain(':motion-key="exportMotionKey"');
    expect(home).not.toContain('<UserIcon');
    expect(home).not.toContain('<ExportIcon');

    expect(notification).toContain('const bellMotionKey = ref(0);');
    expect(notification).toContain('function openNotificationCenter(): void');
    expect(notification).toContain('name="bell"');
    expect(notification).toContain(':motion-key="bellMotionKey"');
    expect(notification).toContain('isOpen.value = true;');
  });

  it('connects filter and locator motion to the existing calendar controls', () => {
    const calendar = readSource('../views/calendar/CalendarView.vue');

    expect(calendar).toContain('const filterMotionKey = ref(0);');
    expect(calendar).toContain('const locateMotionKey = ref(0);');
    expect(calendar).toContain('function openCalendarFilters(): void');
    expect(calendar).toContain('function playLocateMotionAndGoToToday(): void');
    expect(calendar).toContain('name="filter"');
    expect(calendar).toContain(':motion-key="filterMotionKey"');
    expect(calendar.match(/name="locate"/gu)).toHaveLength(3);
    expect(calendar.match(/:motion-key="locateMotionKey"/gu)).toHaveLength(3);
    expect(calendar).not.toContain('class="locator-crosshair"');
    expect(calendar).not.toContain('<svg class="filter-icon"');
  });

  it('animates directory mode icons only when the selection actually changes', () => {
    const directory = readSource('../views/directory/UnifiedDirectoryView.vue');

    expect(directory).toContain('const departmentMotionKey = ref(0);');
    expect(directory).toContain('const peopleMotionKey = ref(0);');
    expect(directory).toContain('if (directory === activeDirectory.value) {');
    expect(directory).toContain('playDirectoryMotion(directory);');
    expect(directory.indexOf('if (directory === activeDirectory.value) {')).toBeLessThan(
      directory.indexOf('playDirectoryMotion(directory);'),
    );
    expect(directory).toContain('name="department"');
    expect(directory).toContain(':motion-key="departmentMotionKey"');
    expect(directory).toContain('name="people"');
    expect(directory).toContain(':motion-key="peopleMotionKey"');
    expect(directory).not.toContain('class="department-mark"');
    expect(directory).not.toContain('class="people-mark"');
  });

  it('replaces every existing production phone glyph while preserving dial targets', () => {
    const dutyCell = readSource('../features/calendar/DutyCell.vue');
    const selectedDetails = readSource('../features/calendar/SelectedDateDutyDetails.vue');
    const directory = readSource('../views/directory/InternalDirectoryView.vue');

    for (const source of [dutyCell, selectedDetails, directory]) {
      expect(source).toContain('LucideMinimalActionIcon');
      expect(source).toContain('name="phone"');
      expect(source).toContain('phoneMotion');
      expect(source).not.toContain('CallIcon');
    }

    expect(dutyCell).toContain(':href="buildDialLink(option.number)"');
    expect(selectedDetails).toContain(':href="buildDialLink(option.number)"');
    expect(directory).toContain(':href="toDirectoryDialHref(contact.fullNumber)"');
    expect(directory).toContain(':href="toDirectoryDialHref(getSafeInternalExtension(contact)!)"');
  });
});
