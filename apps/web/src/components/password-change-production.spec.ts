import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

describe('production password change dialog', () => {
  it('reuses the approved default-password reminder structure without exposing the password', () => {
    const dialog = source('./PasswordChangeDialog.vue');
    const layout = source('../layouts/AppLayout.vue');

    expect(dialog).toContain('当前使用的是初始密码');
    expect(dialog).toContain('账号安全提醒');
    expect(dialog).toContain('修改密码');
    expect(dialog).toContain('当前密码');
    expect(dialog).toContain('新密码');
    expect(dialog).toContain('确认新密码');
    expect(dialog).not.toContain('<strong>123</strong>');
    expect(layout).toContain('PasswordChangeDialog');
    expect(layout).toContain('session.passwordReminderVisible');
  });
});
