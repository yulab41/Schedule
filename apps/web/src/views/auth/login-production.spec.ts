import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

function readSource(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

describe('P3 Web login production boundary', () => {
  it('keeps the public login page free of registration controls', () => {
    const source = readSource('./LoginView.vue');

    expect(source).toContain('进入工作台');
    expect(source).toContain('账号由平台管理员预置');
    expect(source).not.toContain('authMode');
    expect(source).not.toContain('创建账号');
    expect(source).not.toContain('确认密码');
  });
});
