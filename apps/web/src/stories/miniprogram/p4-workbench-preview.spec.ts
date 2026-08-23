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
    expect(source).toContain('aria-disabled="true"');
    expect(source).toContain('功能将在后续阶段开放');
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

  it('keeps the reused Web mobile calendar cells square instead of content-driven', () => {
    const source = readSource('../ui2/Ui2MonthCalendar.vue');

    expect(source).toMatch(
      /@media \(max-width: 640px\)[\s\S]*?\.calendar-cell\s*{[^}]*aspect-ratio:\s*1\s*\/\s*1;[^}]*min-height:\s*0;[^}]*overflow:\s*hidden;/s,
    );
  });

  it('keeps the P4 calendar shell aligned with the Web read-only controls', () => {
    const preview = readSource('./P4WorkbenchPreview.vue');
    const calendar = readSource('../ui2/Ui2MonthCalendar.vue');

    expect(preview).toContain('aria-label="筛选排班"');
    expect(preview).toContain('class="filter-button"');
    expect(calendar).toContain("(event: 'locate')");
    expect(calendar).toContain('aria-label="定位到今天"');
  });

  it('covers the P4 month, week, list and selected-detail surfaces without placeholder copy', () => {
    const source = readSource('./P4WorkbenchPreview.vue');

    expect(source).toContain('class="week-calendar"');
    expect(source).toContain('class="list-calendar"');
    expect(source).toContain('class="selected-detail"');
    expect(source).toContain('联系方式仅在群组成员单独同意后显示');
    expect(source).not.toContain('这一视图将在月历只读链路确认后接入');
  });

  it('keeps month, week and list period navigation stateful instead of decorative', () => {
    const source = readSource('./P4WorkbenchPreview.vue');

    expect(source).toContain('@month-change="changeMonth"');
    expect(source).toContain('const monthOffset = ref(0)');
    expect(source).toContain('const weekOffset = ref(0)');
    expect(source).toContain('const listRows = computed');
    expect(source).toContain('weekRangeLabel');
  });
});
