import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

function readSource(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

describe('P4 workbench visual preview', () => {
  it('keeps the first slice read-only and explicit about the authenticated group', () => {
    const source = readSource('./P4WorkbenchPreview.vue');

    expect(source).toContain('P4 · 已认证工作台');
    expect(source).toContain('当前群组');
    expect(source).toContain('月');
    expect(source).toContain('周');
    expect(source).toContain('列表');
    expect(source).toContain('只读查看');
    expect(source).not.toContain('<form');
    expect(source).not.toContain('method=');
  });

  it('covers ready, empty, loading, error and offline states without hiding the recovery path', () => {
    const source = readSource('./P4WorkbenchPreview.vue');

    expect(source).toContain("'ready' | 'empty' | 'loading' | 'error' | 'offline'");
    expect(source).toContain('正在读取排班');
    expect(source).toContain('暂时没有已发布排班');
    expect(source).toContain('排班暂时无法加载');
    expect(source).toContain('当前为离线状态');
    expect(source).toContain('重新加载');
    expect(source).toContain('24 小时缓存');
  });

  it('keeps mobile controls usable at the 320px boundary and respects reduced motion', () => {
    const source = readSource('./P4WorkbenchPreview.vue');

    expect(source).toContain('min-height: 44px');
    expect(source).toContain('@media (max-width: 340px)');
    expect(source).toContain('@media (prefers-reduced-motion: reduce)');
    expect(source).toContain('min-width: 0');
  });
});
