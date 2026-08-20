import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

function readSource(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

describe('Lucide Minimal action icon preview', () => {
  it('covers every requested workbench action with semantic continuous motion', () => {
    const icon = readSource('./LucideMinimalActionIcon.vue');

    for (const name of [
      'bell',
      'department',
      'export',
      'filter',
      'locate',
      'people',
      'phone',
      'profile',
    ]) {
      expect(icon).toContain(`name === '${name}'`);
      expect(icon).toContain(`.icon-${name}`);
    }

    for (const motion of [
      'action-bell',
      'action-department',
      'action-export',
      'action-filter',
      'action-locate',
      'action-people',
      'action-phone',
      'action-profile',
    ]) {
      expect(icon).toContain(`@keyframes ${motion}`);
    }

    expect(icon).toContain('data-source="lucide-animated-pqoqubbw"');
    expect(icon).toContain('stroke-width: 2;');
    expect(icon).toContain('@media (prefers-reduced-motion: reduce)');
    expect(icon).not.toMatch(/\d+%\s*,\s*\d+%/u);
    expect(icon).not.toContain('stroke-dashoffset: 1;');
    expect(icon).toContain('stroke-dashoffset: 0.22;');
    expect(icon).not.toContain('icon-detail');
    expect(icon).not.toContain('icon-layer-fill');
  });

  it('places the icon system in the requested desktop and mobile product contexts', () => {
    const preview = readSource('./LucideMinimalActionPreview.vue');
    const story = readSource('./LucideMinimalActionPreview.stories.ts');

    for (const label of [
      '通知中心',
      '个人中心',
      '导出排班',
      '筛选',
      '定位到今天',
      '科室',
      '人员',
      '短号 6618',
      '手机 138 0013 8000',
    ]) {
      expect(preview).toContain(label);
    }

    expect(story).toContain("title: 'Web UI 2.0/Icon Motion · Lucide Minimal Actions'");
    expect(story).toContain('DesktopWorkbench');
    expect(story).toContain('MobileWorkbench390');
    expect(story).toContain('IconMotionBoard');

    for (const insufficientContrastColor of [
      '#7c8793',
      '#727d89',
      '#bd5959',
      '#697581',
      '#65717d',
      '#75818d',
    ]) {
      expect(preview).not.toContain(insufficientContrastColor);
    }
  });
});
