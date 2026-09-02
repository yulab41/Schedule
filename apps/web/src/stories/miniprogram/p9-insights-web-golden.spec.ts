import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const storyRoot = path.dirname(fileURLToPath(import.meta.url));

describe('P9 insights Web golden', () => {
  it('keeps the audit-ledger surfaces and privacy language in one visual direction', () => {
    const source = readFileSync(path.join(storyRoot, 'P9InsightsWebGolden.vue'), 'utf8');

    expect(source).toContain('事件时间线');
    expect(source).toContain('排班统计');
    expect(source).toContain('通知中心');
    expect(source).toContain('导出排班与统计');
    expect(source).toContain('原始事件不可变');
    expect(source).toContain('不在 URL 中携带 token');
    expect(source).toContain('prefers-reduced-motion');
    expect(source).toContain('min-height: 44px');
  });

  it('registers ready, boundary, large-text, and failure stories', () => {
    const source = readFileSync(path.join(storyRoot, 'P9InsightsWebGolden.stories.ts'), 'utf8');

    expect(source).toContain("surface: 'events'");
    expect(source).toContain("surface: 'statistics'");
    expect(source).toContain("surface: 'notifications'");
    expect(source).toContain("surface: 'export'");
    expect(source).toContain('mobile320');
    expect(source).toContain('largeText: true');
    expect(source).toContain("state: 'disabled'");
  });
});
