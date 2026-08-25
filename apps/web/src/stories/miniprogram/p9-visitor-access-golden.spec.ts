import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

function read(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

describe('P9 visitor access Web golden', () => {
  it('covers the audit states and privacy boundary', () => {
    const source = read('./P9VisitorAccessGolden.vue');
    expect(source).toContain('近四个月访问次数');
    expect(source).toContain('最近访问');
    expect(source).toContain('暂无访客访问记录');
    expect(source).toContain('访问记录暂时无法加载');
    expect(source).toContain('insights 暂未开放');
    expect(source).toContain('原始访问记录保留 90 天');
    expect(source).toContain('访客凭证不会出现在记录中');
    expect(source).toContain('min-height: 44px');
    expect(source).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('registers 390, 320, large-text, loading, empty, error and disabled stories', () => {
    const source = read('./P9VisitorAccessGolden.stories.ts');
    for (const story of ['Ready390', 'Ready320', 'LargeText390', 'Loading', 'Empty', 'ErrorState', 'InsightsDisabled']) {
      expect(source).toContain(`export const ${story}`);
    }
  });
});
