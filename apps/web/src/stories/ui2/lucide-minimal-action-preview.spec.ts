import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

function readSource(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

describe('Lucide Minimal action icon preview', () => {
  it('keeps the current production geometry intact and animates it only on demand', () => {
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
      'click-bell',
      'click-department',
      'click-export-arrow',
      'click-filter-bottom',
      'click-filter-middle',
      'click-filter-top',
      'click-locate',
      'click-people-primary',
      'click-people-secondary',
      'click-phone',
      'click-profile',
    ]) {
      expect(icon).toContain(`@keyframes ${motion}`);
    }

    expect(icon).toContain(
      "import { CallIcon, ExportIcon, UserIcon } from 'tdesign-icons-vue-next'",
    );
    for (const source of [
      'calendar-filter',
      'calendar-locator',
      'directory-department',
      'directory-people',
      'notification-bell',
      'tdesign-call',
      'tdesign-export',
      'tdesign-user',
    ]) {
      expect(icon).toContain(`data-static-source="${source}"`);
    }

    expect(icon).toContain('readonly motionKey?: number;');
    expect(icon).toContain('readonly previewMotion?: boolean;');
    expect(icon).toContain('transform: rotate(90deg);');
    expect(icon).toContain(':deep(#stroke2)');
    expect(icon).toContain('stroke-dashoffset: 42;');
    expect(icon).toContain('d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"');
    expect(icon).toContain('d="M22 21v-2a4 4 0 0 0-3-3.87"');
    expect(icon).not.toContain('d="M3 21v-2a7 7 0 0 1 7-7h4a7 7 0 0 1 7 7v2"');
    expect(icon).toContain(':data-motion-key="motionKey"');
    expect(icon).toContain('stroke-width: 2;');
    expect(icon).toContain('@media (prefers-reduced-motion: reduce)');
    expect(icon).not.toContain('infinite');
    expect(icon.match(/stroke-dasharray/gu)).toHaveLength(1);
    expect(icon).not.toContain('opacity:');
    expect(icon).not.toContain('readonly delay?: number;');
    expect(icon).not.toContain('readonly looping?: boolean;');
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
    expect(preview).toContain('点击图标播放');
    expect(preview).toContain('playMotion');
    expect(preview).toContain(':motion-key="motionKeys.bell"');
    expect(preview).toContain('preview-motion');
    expect(preview).toContain("playMotion('department')");
    expect(preview).toContain("if (directoryMode.value === 'department') return;");
    expect(preview).toContain("if (directoryMode.value === 'people') return;");
    expect(preview).toContain('@click.prevent="playMotion(\'phone\')"');
    expect(preview).not.toContain('force-motion');
    expect(preview).not.toContain(':delay=');
    expect(preview).not.toContain('首尾连续 · 无空拍');
    expect(preview).not.toContain('.export-action span {');
    expect(preview).toContain('.export-action > span:last-child');

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
