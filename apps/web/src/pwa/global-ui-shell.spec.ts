import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

function readSource(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

const baseStyles = readSource('../styles/base.css');
const homeView = readSource('../views/HomeView.vue');
const loginView = readSource('../views/auth/LoginView.vue');
const guestView = readSource('../views/guest/GuestScheduleView.vue');
const responsiveSheet = readSource('../components/ResponsiveSheet.vue');
const workbenchNav = readSource('../features/layout/WorkbenchNav.vue');

describe('global mobile UI shell', () => {
  it('uses the dynamic viewport with a 100vh fallback on every full-height application shell', () => {
    expect(baseStyles).toMatch(/body\s*{[^}]*min-height:\s*100vh;[^}]*min-height:\s*100dvh;/s);
    expect(baseStyles).toMatch(/#app\s*{[^}]*min-height:\s*100vh;[^}]*min-height:\s*100dvh;/s);
    expect(baseStyles).toMatch(
      /\.app-layout\s*{[^}]*min-height:\s*100vh;[^}]*min-height:\s*100dvh;/s,
    );
    expect(baseStyles).toMatch(
      /\.auth-page,\s*\.profile-panel,\s*\.state-panel\s*{[^}]*min-height:\s*100vh;[^}]*min-height:\s*100dvh;/s,
    );
    expect(baseStyles).toMatch(
      /\.state-panel\s*{[^}]*min-height:\s*calc\(100vh - 104px\);[^}]*min-height:\s*calc\(100dvh - 104px\);/s,
    );
    expect(loginView).toMatch(/\.auth-page\s*{[^}]*min-height:\s*100dvh;/s);
    expect(guestView).toMatch(
      /\.guest-schedule-page\s*{[^}]*min-height:\s*100vh;[^}]*min-height:\s*100dvh;/s,
    );
  });

  it('keeps visible keyboard focus and disables nonessential motion globally', () => {
    expect(baseStyles).toMatch(/:focus-visible\s*{[^}]*outline:[^}]*focus-ring/s);
    expect(baseStyles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*transition-duration:\s*0\.01ms !important;/,
    );
    expect(baseStyles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*animation-duration:\s*0\.01ms !important;/,
    );
    expect(responsiveSheet).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*animation:\s*none;/,
    );
  });

  it('traps focus inside responsive sheets and restores the opening control', () => {
    expect(responsiveSheet).toContain('function trapFocus(event: KeyboardEvent)');
    expect(responsiveSheet).toContain('@keydown="trapFocus"');
    expect(responsiveSheet).toContain('previouslyFocused');
    expect(responsiveSheet).toContain('restoreFocus()');
  });

  it('reserves the top and bottom safe areas for the mobile header, navigation, content, and sheets', () => {
    expect(baseStyles).toContain('env(safe-area-inset-top)');
    expect(loginView).toContain('env(safe-area-inset-bottom)');
    expect(guestView).toContain('env(safe-area-inset-top)');
    expect(guestView).toContain('env(safe-area-inset-bottom)');
    expect(workbenchNav).toContain('env(safe-area-inset-bottom)');
    expect(homeView).toContain('env(safe-area-inset-bottom)');
    expect(responsiveSheet).toContain('env(safe-area-inset-bottom)');
  });
});
