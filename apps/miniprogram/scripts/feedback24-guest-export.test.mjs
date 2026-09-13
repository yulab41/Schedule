import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = new URL('../src/', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

describe('Feedback24 export and anonymous guest parity', () => {
  it('uses the shared selector for file type and does not clip selector popovers', () => {
    const template = read('subpackages/insights/components/exports-panel/index.wxml');
    const styles = read('subpackages/insights/components/exports-panel/index.wxss');
    expect(template).not.toMatch(/<picker[\s\S]*?文件类型/u);
    expect(template).toContain('title="文件类型"');
    expect(template).toContain('bindchange="handleTypeChange"');
    expect(styles).toMatch(/\.export-form-card\s*\{[^}]*overflow:\s*visible;/su);
  });

  it('passes nurse and month-display settings into the common view model', () => {
    const controller = read('pages/guest/guest.ts');
    expect(controller).toContain('isNurseCalendarGroup(page.data.currentGroupName)');
    expect(controller).toContain('effectiveMonthShiftTypeId: page.groupMonthShiftTypeId ?? null');
    expect(controller).toContain(
      'monthPreferencePending: page.groupMonthShiftTypeId === undefined',
    );
    expect(controller).toContain('viewMode: result.groupDefaultView');
    expect(controller).toContain('(panel.cells.length / 7) * 62');
  });

  it('commits period swipes without animated rebound and queues rapid changes', () => {
    const controller = read('pages/guest/guest.ts');
    expect(controller).toContain('periodShiftCommitPending');
    expect(controller).toContain('periodShiftQueue');
    expect(controller).toContain('periodSwiperDuration: 0');
    expect(controller).not.toMatch(/handleWeekSwiperFinish[\s\S]{0,180}changePeriod\(/u);
  });

  it('does not render persisted months before the active network month settles', () => {
    const controller = read('pages/guest/guest.ts');
    expect(controller).not.toMatch(/readGuestPublicCache\([\s\S]{0,220}applyCachedWindow\(/u);
    expect(controller).toContain('[-2, -1, 0, 1, 2]');
  });
});
