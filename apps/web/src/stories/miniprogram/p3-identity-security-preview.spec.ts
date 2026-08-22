import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

function readSource(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

describe('P3 identity security preview', () => {
  it('keeps Web login closed to public registration', () => {
    const source = readSource('./P3IdentitySecurityPreview.vue');

    expect(source).toContain("screen === 'web-login'");
    expect(source).toContain('没有“注册”入口');
    expect(source).not.toContain('登录或注册');
  });

  it('shows the platform account safety boundary without exposing secrets', () => {
    const source = readSource('./P3IdentitySecurityPreview.vue');

    expect(source).toContain('只显示必要状态，不显示密码或联系方式');
    expect(source).toContain('这里只分配用户名，不设置或显示密码');
    expect(source).not.toContain('passwordHash');
  });

  it('covers the Mini identity states and the masked ten-minute admin ticket', () => {
    const source = readSource('./P3IdentitySecurityPreview.vue');

    expect(source).toContain("'mini-login'");
    expect(source).toContain("'mini-link'");
    expect(source).toContain("'mini-register'");
    expect(source).toContain("'mini-admin-preview'");
    expect(source).toContain('还剩约 10 分钟');
    expect(source).toContain('账号 d0***');
  });

  it('keeps the 44px touch target and reduced-motion guard', () => {
    const source = readSource('./P3IdentitySecurityPreview.vue');

    expect(source).toMatch(
      /\.mini-primary,\s*\.mini-secondary\s*{[^}]*min-height:\s*var\(--ui-touch-target-comfortable\)/s,
    );
    expect(source).toContain('@media (prefers-reduced-motion: reduce)');
    expect(source).toContain('min-height: 844px');
  });
});
