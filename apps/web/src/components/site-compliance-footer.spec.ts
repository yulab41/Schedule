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

  it('is present on authenticated, login, and guest entry pages', () => {
    for (const source of [appLayout, loginView, guestView]) {
      expect(source).toContain('import SiteComplianceFooter from');
      expect(source).toContain('<SiteComplianceFooter');
    }
  });
});
