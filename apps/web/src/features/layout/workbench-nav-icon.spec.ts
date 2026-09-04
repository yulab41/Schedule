import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

function readSource(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

describe('production workbench navigation icons', () => {
  it('replaces the TDesign icon map with the confirmed local Lucide Minimal component', () => {
    const nav = readSource('./WorkbenchNav.vue');

    expect(nav).toContain("import WorkbenchNavIcon from './WorkbenchNavIcon.vue'");
    expect(nav).not.toContain("from 'tdesign-icons-vue-next'");
    expect(nav).not.toContain('const iconComponents');
    expect(nav).not.toContain('<component :is="iconComponents[item.icon]"');
  });

  it('loops only the current destination or the active mobile more entry', () => {
    const nav = readSource('./WorkbenchNav.vue');

    expect(nav.match(/:looping="item\.id === activeTab"/g)).toHaveLength(4);
    expect(nav).toContain(':looping="secondaryItems.some((item) => item.id === activeTab)"');
    expect(nav).toContain('<WorkbenchNavIcon name="logout" aria-hidden="true" />');
  });

  it('adapts every production icon plus more and logout from the shared catalog', () => {
    const icon = readSource('./WorkbenchNavIcon.vue');
    const generatedMotion = readSource('../../generated/ui-icon-motion.css');
    const navModel = readSource('./workbench-nav.ts');

    for (const name of [
      'backfill',
      'calendar',
      'config',
      'directory',
      'duty',
      'events',
      'groups',
      'leave',
      'logout',
      'manual',
      'members',
      'more',
      'notifications',
      'profile',
      'statistics',
      'swap',
    ]) {
      if (name === 'logout' || name === 'more') continue;
      expect(navModel).toContain(`'${name}'`);
    }

    expect(icon).toContain("import { type IconKey } from '@schedule/ui-icons'");
    expect(icon).toContain("Extract<IconKey, WorkbenchNavIconId | 'logout' | 'more'>");
    expect(icon).toContain("'logout'");
    expect(icon).toContain("'more'");
    expect(icon).toContain(':name="name"');
    expect(icon).toContain('data-source="lucide-animated-pqoqubbw"');
    expect(icon).not.toContain('@keyframes');
    expect(generatedMotion).toContain('.workbench-bottom-nav .workbench-nav-icon');
    expect(generatedMotion).toContain('width: 23px;');
    expect(generatedMotion).toContain('@media (prefers-reduced-motion: reduce)');
    expect(icon).not.toContain('icon-detail');
    expect(icon).not.toContain('icon-layer-fill');
  });

  it('keeps the implementation dependency-free and records the upstream licenses', () => {
    const packageJson = readSource('../../../package.json');
    const sources = readSource('../../../docs/navigation-icon-sources.md');
    const licenses = readSource('../../../docs/third-party-navigation-icon-licenses.md');

    expect(packageJson).not.toContain('@animated-color-icons');
    expect(packageJson).not.toContain('motion-v');
    expect(sources).toContain('Lucide');
    expect(sources).toContain('ISC');
    expect(sources).toContain('pqoqubbw/icons');
    expect(sources).toContain('MIT');
    expect(licenses).toContain('Copyright (c) 2026 Lucide Icons and Contributors');
    expect(licenses).toContain('Copyright (c) 2024-2026 pqoqubbw');
  });

  it('previews the production component on desktop and mobile', () => {
    const nav = readSource('./WorkbenchNav.vue');
    const story = readSource('./WorkbenchNav.stories.ts');

    expect(nav).toContain('readonly forceIconMotion?: boolean;');
    expect(nav.match(/:force-motion="forceIconMotion"/gu)).toHaveLength(5);
    expect(story).toContain("title: 'Web UI 2.0/Production · Workbench Navigation'");
    expect(story).toContain('forceIconMotion: true');
    expect(story).toContain('DesktopOwner');
    expect(story).toContain('MobilePrimary390');
    expect(story).toContain('MobileSecondary390');
    expect(story).toContain("args: { activeTab: 'leave' }");
  });

  it('plays every navigation loop continuously without grouped idle keyframes', () => {
    const icon = readSource('./WorkbenchNavIcon.vue');
    const generatedMotion = readSource('../../generated/ui-icon-motion.css');

    expect(icon).not.toContain('@keyframes');
    expect(generatedMotion).toContain('1800ms');
    expect(generatedMotion).not.toMatch(/\d+%\s*,\s*\d+%/u);
  });
});
