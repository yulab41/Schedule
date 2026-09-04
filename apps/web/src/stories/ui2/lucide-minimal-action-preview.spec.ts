import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

function readSource(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

describe('Lucide Minimal action icon preview', () => {
  it('keeps the current production geometry intact and animates it only on demand', () => {
    const icon = readSource('../../components/LucideMinimalActionIcon.vue');
    const generatedMotion = readSource('../../generated/ui-icon-motion.css');

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
      expect(generatedMotion).toContain(`.icon-${name}`);
    }

    for (const motion of [
      'ui-motion-bell-bell',
      'ui-motion-department-rotor',
      'ui-motion-export-arrow',
      'ui-motion-export-frame',
      'ui-motion-filter-filter-bottom',
      'ui-motion-filter-filter-middle',
      'ui-motion-filter-filter-top',
      'ui-motion-locate-rotor',
      'ui-motion-people-primary',
      'ui-motion-people-secondary',
      'ui-motion-phone-phone-body',
      'ui-motion-profile-portrait',
    ]) {
      expect(generatedMotion).toContain(`@keyframes ${motion}`);
    }

    expect(icon).toContain("import { type IconKey } from '@schedule/ui-icons'");
    expect(icon).toContain('<SharedIcon');
    expect(icon).toContain('const sharedIconName = computed<IconKey>');
    for (const source of ['tdesign-call', 'tdesign-export', 'tdesign-user']) {
      expect(icon).toContain(`return '${source}'`);
    }

    expect(icon).toContain('readonly motionKey?: number;');
    expect(icon).toContain('readonly previewMotion?: boolean;');
    expect(generatedMotion).toContain('transform: rotate(90deg);');
    expect(generatedMotion).toContain('transform: translate(2.2px, -2.2px);');
    expect(generatedMotion).toContain('transform: translate(-0.7px, 0.7px);');
    expect(icon).toContain(':data-motion-key="motionKey"');
    expect(icon).toContain('stroke-width: var(--action-motion-icon-stroke-width, 2);');
    expect(generatedMotion).toContain('@media (prefers-reduced-motion: reduce)');
    expect(icon).not.toContain('infinite');
    expect(icon).not.toContain('stroke-dasharray');
    expect(icon).not.toContain('stroke-dashoffset');
    expect(icon).not.toContain('opacity:');
    expect(icon).not.toContain('readonly delay?: number;');
    expect(icon).not.toContain('readonly looping?: boolean;');
  });

  it('places the icon system in the requested desktop and mobile product contexts', () => {
    const preview = readSource('./LucideMinimalActionPreview.vue');
    const story = readSource('./LucideMinimalActionPreview.stories.ts');

    expect(preview).toContain("from '../../components/LucideMinimalActionIcon.vue'");

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
    expect(preview).toContain('原导出图标 · 箭头柔和弹出');
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
