import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

function readSource(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

describe('workbench shell refinement preview', () => {
  it('uses the confirmed mobile header with group identity and no product banner', () => {
    const preview = readSource('./WorkbenchShellRefinementPreview.vue');

    expect(preview).toContain('{{ selectedGroupName }} · {{ selectedGroupRole }}');
    expect(preview).toContain('aria-label="展开排班群组列表"');
    expect(preview).toContain('class="export-action"');
    expect(preview).toContain('class="group-heading-row"');
    expect(preview).toContain('role="listbox"');
    expect(preview).toContain('class="workbench-header"');
    expect(preview).toContain('class="workbench-title-block"');
    expect(preview).not.toContain('class="group-context"');
    expect(preview).not.toContain('class="product-header"');
  });

  it('puts each workflow name in the shared top title instead of repeating it in content', () => {
    const preview = readSource('./WorkbenchShellRefinementPreview.vue');

    expect(preview).toContain("if (props.screen === 'swap') return '换班'");
    expect(preview).toContain("if (props.screen === 'duty') return '加扣班'");
    expect(preview).toContain('<h1>{{ pageTitle }}</h1>');
    expect(preview).not.toContain("<h2>{{ screen === 'swap' ? '换班' : '加扣班' }}</h2>");
  });

  it('keeps long group identities on one truncating line inside the left-aligned control', () => {
    const preview = readSource('./WorkbenchShellRefinementPreview.vue');

    expect(preview).toMatch(
      /\.group-identity\s*{[^}]*overflow:\s*hidden;[^}]*text-overflow:\s*ellipsis;[^}]*white-space:\s*nowrap;/s,
    );
    expect(preview).toMatch(/\.group-menu-action\s*{[^}]*min-height:\s*44px;/s);
    expect(preview).toMatch(/\.group-heading-row\s*{[^}]*align-items:\s*center;/s);
  });

  it('reuses the complete confirmed holiday calendar and selected-date capsule', () => {
    const preview = readSource('./WorkbenchShellRefinementPreview.vue');

    expect(preview).toContain("import Ui2MonthCalendar from './Ui2MonthCalendar.vue'");
    expect(preview).toContain('scenario="october-holiday"');
    expect(preview).toContain('@select="selectedDay = $event"');
    expect(preview).toContain('class="selected-summary"');
    expect(preview).toContain('查看完整值班');
  });

  it('copies the compact Mobile Screens 2 shell metrics and calendar tokens', () => {
    const preview = readSource('./WorkbenchShellRefinementPreview.vue');

    expect(preview).toContain('--ui2-danger: #d92d20');
    expect(preview).toContain('--ui2-radius-lg: 18px');
    expect(preview).toContain('--ui2-shadow-card: 0 8px 24px rgb(22 32 42 / 7%)');
    expect(preview).toMatch(
      /\.workbench-header\s*{[^}]*min-height:\s*calc\(68px \+ env\(safe-area-inset-top\)\);[^}]*padding:\s*calc\(12px \+ env\(safe-area-inset-top\)\) 16px 10px;/s,
    );
    expect(preview).toMatch(
      /\.workbench-header\s*{[^}]*display:\s*flex;[^}]*align-items:\s*flex-end;/s,
    );
    expect(preview).toMatch(/\.group-heading-row\s*{[^}]*position:\s*relative;/s);
    expect(preview).toMatch(/\.group-menu-list\s*{[^}]*position:\s*absolute;/s);
    expect(preview).toMatch(/\.group-menu-list\s*{[^}]*display:\s*grid;[^}]*gap:\s*4px;/s);
    expect(preview).toMatch(/\.segmented button\s*{[^}]*font-size:\s*13px;/s);
    expect(preview).toMatch(/\.filter-action\s*{[^}]*min-height:\s*44px;[^}]*font-size:\s*13px;/s);
    expect(preview).toMatch(
      /\.is-mobile \.workspace\s*{[^}]*padding:\s*14px 12px calc\(90px \+ env\(safe-area-inset-bottom\)\);/s,
    );
  });

  it('renders the low-emphasis filing footer on the login preview only', () => {
    const preview = readSource('./WorkbenchShellRefinementPreview.vue');

    expect(preview.match(/<footer class="filing-footer/g)).toHaveLength(1);
    expect(preview).toContain('粤ICP备2026116116号-1');
    expect(preview).toMatch(/\.filing-footer\s*{[^}]*background:\s*transparent;/s);
    expect(preview).toMatch(/\.filing-link\s*{[^}]*min-height:\s*44px;/s);
    expect(preview).toMatch(
      /\.filing-link:(?:hover|focus-visible)[\s\S]*background:\s*var\(--ui2-primary-tint\)/,
    );
  });
});
