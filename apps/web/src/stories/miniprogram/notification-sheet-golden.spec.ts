import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

describe('Mini notification Sheet Web golden', () => {
  it('stages the production HomeView notification bell and Sheet against deterministic data', () => {
    const preview = read('./NotificationSheetGolden.vue');
    const fixture = read('./notification-sheet-golden-fixture.ts');

    expect(preview).toContain("import HomeView from '../../views/HomeView.vue'");
    expect(preview).toContain('createNotificationSheetFixtureFetch');
    expect(preview).toContain('button[aria-label^="\u901a\u77e5\u4e2d\u5fc3"]');
    expect(preview).toContain(
      'dialog.responsive-sheet[open][aria-label="\u901a\u77e5\u4e2d\u5fc3"]',
    );
    expect(preview).toContain('data-notification-sheet-ready');
    expect(fixture).toContain("path === '/notifications/unread-count'");
    expect(fixture).toContain("path === '/notifications'");
    expect(fixture).toContain("notificationType: 'duty_reminder'");
    expect(fixture).toContain("notificationType: 'schedule_changed'");
  });

  it('registers 390, 320, and large-text viewport states', () => {
    const stories = read('./NotificationSheetGolden.stories.ts');

    expect(stories).toContain('export const Ready390');
    expect(stories).toContain('export const Ready320');
    expect(stories).toContain('export const LargeText390');
    expect(stories).toContain("viewport: 'mobile390'");
    expect(stories).toContain("viewport: 'mobile320'");
    expect(stories).toContain('largeText: true');
  });
});
