import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

function readSource(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

describe('production browser notification setting row', () => {
  it('keeps a full setting row with a 44px wrapper and an undistorted switch', () => {
    const source = readSource('./NotificationSettingsPanel.vue');

    expect(source).toContain('class="browser-notification-row"');
    expect(source).toContain('class="browser-switch-hit-area"');
    expect(source).toMatch(
      /\.browser-switch-hit-area\s*{[^}]*min-width:\s*60px;[^}]*min-height:\s*44px;/s,
    );
    expect(source).toMatch(/\.browser-notification-switch\s*{[^}]*min-width:\s*52px;/s);
    expect(source).not.toMatch(
      /\.browser-notification-switch\s*{[^}]*min-height:\s*var\(--ui-touch-target-minimum\);/s,
    );
  });

  it('requests permission only in the user-triggered enable and re-registration paths', () => {
    const source = readSource('./NotificationSettingsPanel.vue');
    const toggleStart = source.indexOf('async function toggleBrowserNotifications');
    const registerStart = source.indexOf('async function registerBrowserNotificationsAgain');
    const loadStart = source.indexOf('async function load()');

    expect(toggleStart).toBeGreaterThan(-1);
    expect(registerStart).toBeGreaterThan(toggleStart);
    expect(source.slice(toggleStart, registerStart)).toContain('Notification.requestPermission()');
    expect(source.slice(registerStart)).toContain('Notification.requestPermission()');
    expect(source.slice(loadStart, toggleStart)).not.toContain('Notification.requestPermission()');
  });
});
