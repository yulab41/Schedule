import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

function readSource(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

const footer = readSource('./SiteComplianceFooter.vue');
const appLayout = readSource('../layouts/AppLayout.vue');
const loginView = readSource('../views/auth/LoginView.vue');
const guestView = readSource('../views/guest/GuestScheduleView.vue');

describe('site compliance footer', () => {
  it('links the approved ICP filing number to the MIIT filing system', () => {
    expect(footer).toContain('粤ICP备2026116116号-1');
    expect(footer).toContain('href="https://beian.miit.gov.cn/"');
    expect(footer).toContain('rel="noopener noreferrer"');
  });

  it('is present on the login page only', () => {
    expect(loginView).toContain('import SiteComplianceFooter from');
    expect(loginView).toContain('<SiteComplianceFooter');

    for (const source of [appLayout, guestView]) {
      expect(source).not.toContain('import SiteComplianceFooter from');
      expect(source).not.toContain('<SiteComplianceFooter');
    }
  });

  it('blends into the login canvas while preserving an accessible feedback target', () => {
    expect(footer).toMatch(/\.site-compliance-footer\s*{[^}]*background:\s*transparent;/s);
    expect(footer).toMatch(/\.site-compliance-footer\s*{[^}]*border:\s*0;/s);
    expect(footer).toMatch(/\.site-compliance-footer a\s*{[^}]*min-height:[^;]+;/s);
    expect(footer).toMatch(
      /\.site-compliance-footer a:(?:hover|active|focus-visible)[\s\S]*background:\s*var\(--ui-color-primary-light\)/,
    );
  });
});
