import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

function readSource(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

describe('notification settings Storybook preview', () => {
  it('uses a full settings row and lets the wrapper own the 44px touch target', () => {
    const preview = readSource('./NotificationSettingsPreview.vue');

    expect(preview).toContain('class="notification-control-row"');
    expect(preview).toContain('class="switch-hit-area"');
    expect(preview).toMatch(
      /\.switch-hit-area\s*{[^}]*min-width:\s*44px;[^}]*min-height:\s*44px;/s,
    );
    expect(preview).toMatch(/\.notification-switch\s*{[^}]*width:\s*52px;[^}]*height:\s*30px;/s);
    expect(preview).not.toMatch(/\.notification-switch\s*{[^}]*min-height:\s*44px;/s);
  });

  it('exposes off, on, denied, registration and desktop review stories', () => {
    const preview = readSource('./NotificationSettingsPreview.vue');
    const stories = readSource('./NotificationSettingsPreview.stories.ts');

    expect(preview).toContain('浏览器权限只在您主动开启时申请');
    expect(preview).toContain("status === 'permission-denied'");
    expect(preview).toContain("status === 'registration-needed'");
    expect(stories).toContain('Off390');
    expect(stories).toContain('On390');
    expect(stories).toContain('PermissionDenied320');
    expect(stories).toContain('RegistrationNeeded390');
    expect(stories).toContain('Desktop1280');
    expect(stories).toContain("viewport: 'mobile320'");
    expect(stories).toContain("viewport: 'mobile390'");
    expect(stories).toContain("viewport: 'desktop1280'");
  });

  it('defines keyboard focus and reduced-motion behavior without requesting real permission', () => {
    const preview = readSource('./NotificationSettingsPreview.vue');

    expect(preview).toContain('role="switch"');
    expect(preview).toMatch(/:focus-visible\s*{[^}]*outline:/s);
    expect(preview).toContain('@media (prefers-reduced-motion: reduce)');
    expect(preview).not.toContain('Notification.requestPermission');
  });
});
