import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

function readSource(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

describe('P3 platform admin users production view', () => {
  it('uses the redacted account API and keeps secrets out of the table', () => {
    const view = readSource('./PlatformAdminUsersView.vue');
    const router = readSource('../../router/index.ts');

    expect(view).toContain('listPlatformUserAccounts');
    expect(view).toContain('assignPlatformPasswordIdentity');
    expect(view).toContain('createWechatAdminBindingLink');
    expect(view).toContain('不显示姓名');
    expect(view).not.toContain('passwordHash');
    expect(view).not.toContain('realName');
    expect(router).toContain("name: 'platform-admin-users'");
    expect(router).toContain("path: '/platform-admin/users'");
  });

  it('anchors screen-reader-only table labels so narrow layouts do not widen the page', () => {
    const view = readSource('./PlatformAdminUsersView.vue');

    expect(view).toMatch(
      /\.visually-hidden\s*{[^}]*position:\s*absolute;[^}]*top:\s*0;[^}]*left:\s*0;/s,
    );
  });
});
