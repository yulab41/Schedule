import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

function readSource(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

describe('production browser notification setting row', () => {
  it('matches the approved 52 by 30 switch inside a separate 44px hit target', () => {
    const source = readSource('./NotificationSettingsPanel.vue');

    expect(source).toContain('class="browser-notification-row"');
    expect(source).toContain('class="browser-switch-hit-area"');
    expect(source).toContain('role="switch"');
    expect(source).toContain(':aria-checked="browserNotificationsEnabled"');
    expect(source).toContain('class="browser-switch-thumb"');
    expect(source).not.toContain('<t-switch');
    expect(source).toMatch(
      /\.browser-switch-hit-area\s*{[^}]*min-width:\s*60px;[^}]*min-height:\s*44px;/s,
    );
    expect(source).toMatch(
      /\.browser-notification-switch\s*{[^}]*width:\s*52px;[^}]*height:\s*30px;/s,
    );
    expect(source).toMatch(/\.browser-switch-thumb\s*{[^}]*width:\s*24px;[^}]*height:\s*24px;/s);
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
