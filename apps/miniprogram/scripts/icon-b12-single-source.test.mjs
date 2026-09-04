import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '../../..');

function absolute(relativePath) {
  return resolve(repositoryRoot, relativePath);
}

function read(relativePath) {
  const filePath = absolute(relativePath);
  return existsSync(filePath) ? readFileSync(filePath, 'utf8').replaceAll('\r\n', '\n') : '';
}

function generatedContentHash(asset) {
  const match = asset.match(/content:([a-f0-9]{64})/u);
  expect(match).not.toBeNull();
  return match?.[1];
}

describe('EXP-ICON-004-B1.2 single visual source', () => {
  it('owns context dimensions and platform selector bindings in ui-icons', () => {
    const contextPath = absolute('packages/ui-icons/src/context.ts');
    const bindingsPath = absolute('packages/ui-icons/src/platform-bindings.ts');

    expect(existsSync(contextPath)).toBe(true);
    expect(existsSync(bindingsPath)).toBe(true);

    const context = read('packages/ui-icons/src/context.ts');
    for (const [key, size, stroke] of [
      ['mobile-bottom-navigation', 23, 2],
      ['desktop-navigation', 20, 2],
      ['top-profile', 20, 2],
      ['top-bell', 21.6, 1.8],
      ['directory-mode', 18, 1.8],
      ['directory-favorite', 21, 2],
      ['directory-phone', 17, 2],
      ['calendar-filter', 20, 1.8],
      ['calendar-locate', 16, 2],
      ['more-row', 20, 2],
    ]) {
      expect(context).toContain(`'${key}'`);
      expect(context).toMatch(
        new RegExp(`'${key}'[\\s\\S]{0,180}?sizePx:\\s*${String(size).replace('.', '\\.')}`),
      );
      expect(context).toMatch(
        new RegExp(`'${key}'[\\s\\S]{0,220}?strokeWidth:\\s*${String(stroke).replace('.', '\\.')}`),
      );
    }

    const bindings = read('packages/ui-icons/src/platform-bindings.ts');
    expect(bindings).toContain('webMotionBindings');
    expect(bindings).toContain('miniProgramMotionBindings');
    expect(bindings).toContain('webContextBindings');
    expect(bindings).toContain('miniProgramContextBindings');
  });

  it('binds every bottom icon directly to active state, tone variants, and layered Web geometry', () => {
    const template = read('apps/miniprogram/src/pages/workbench/index.wxml');
    const controller = read('apps/miniprogram/src/pages/workbench/index.ts');

    expect(template).toContain(
      "nav-icon nav-directory {{activeWorkspace === 'directory' ? 'is-looping' : ''}}",
    );
    expect(template).toContain('/assets/icons/ui-directory-base-muted.svg');
    expect(template).toContain('/assets/icons/ui-directory-person-muted.svg');
    expect(template).toContain(
      "nav-icon nav-swap {{activeWorkspace === 'swap' ? 'is-looping' : ''}}",
    );
    expect(template).toContain('/assets/icons/ui-swap-left-muted.svg');
    expect(template).toContain('/assets/icons/ui-swap-right-muted.svg');
    expect(template).toContain(
      "nav-icon nav-profile {{activeWorkspace === 'profile' ? 'is-looping' : ''}}",
    );
    expect(template).toContain('/assets/icons/ui-profile-body-muted.svg');
    expect(template).toContain('/assets/icons/ui-profile-portrait-muted.svg');
    expect(template).toContain(
      "nav-icon nav-more {{activeWorkspace === 'more' ? 'is-looping' : ''}}",
    );
    expect(template).toContain('/assets/icons/ui-more-primary-muted.svg');
    expect(template).toContain('/assets/icons/ui-more-secondary-muted.svg');
    expect(template).toContain('/assets/icons/ui-more-tertiary-muted.svg');
    expect(template).toContain('class="top-icon profile-icon');
    expect(template).toContain('src="/assets/icons/ui-user.svg"');
    expect(template).not.toContain('navMotion');
    expect(controller).not.toContain('navMotion');
  });

  it('generates both motion adapters and removes platform-owned timing copies', () => {
    const webGenerated = read('apps/web/src/generated/ui-icon-motion.css');
    const miniGenerated = read('apps/miniprogram/src/styles/ui-icon-motion.wxss');
    const webNavigation = read('apps/web/src/features/layout/WorkbenchNavIcon.vue');
    const webActions = read('apps/web/src/components/LucideMinimalActionIcon.vue');
    const webBaseStyles = read('apps/web/src/styles/base.css');
    const storybookPreview = read('apps/web/.storybook/preview.ts');
    const miniWorkbench = read('apps/miniprogram/src/pages/workbench/index.wxss');
    const miniDirectory = read(
      'apps/miniprogram/src/subpackages/organization/components/directory-panel/index.wxss',
    );

    for (const generated of [webGenerated, miniGenerated]) {
      expect(generated).toContain('generated:ui-icon-motion');
      expect(generated).toMatch(/motion:[a-f0-9]{64}/u);
      expect(generated).toMatch(/bindings:[a-f0-9]{64}/u);
      expect(generated).toContain('@keyframes ui-motion-people-primary');
      expect(generated).toContain('520ms cubic-bezier(0.2, 0, 0, 1)');
      expect(generated).toContain('@keyframes ui-motion-more-stagger-dot-two');
      expect(generated).toContain('1800ms ease-in-out 100ms infinite normal none;');
      expect(generated).toContain('@media (prefers-reduced-motion: reduce)');
    }
    expect(webGenerated).toContain('stroke-dashoffset: 1;');
    expect(miniGenerated).not.toContain('stroke-dashoffset:');
    expect(miniGenerated).toContain('.nav-more.is-looping .nav-icon-actor-secondary');

    expect(webBaseStyles).toContain('ui-icon-motion');
    expect(storybookPreview).toContain('ui-icon-motion');
    for (const source of [miniWorkbench, miniDirectory]) {
      expect(source).toContain('ui-icon-motion');
      expect(source).not.toContain('@keyframes click-people-primary');
    }
    expect(webNavigation).not.toContain('@keyframes minimal-draw');
    expect(webActions).not.toContain('@keyframes click-bell');
    expect(miniWorkbench).not.toContain('@keyframes minimal-dot');
  });

  it('generates context-correct assets from identical geometry', () => {
    const pairs = [
      ['directory-base', 'directory-base-muted'],
      ['directory-person', 'directory-person-muted'],
      ['profile-body', 'profile-body-muted'],
      ['profile-portrait', 'profile-portrait-muted'],
      ['swap-left', 'swap-left-muted'],
      ['swap-right', 'swap-right-muted'],
      ['more-primary', 'more-primary-muted'],
      ['more-secondary', 'more-secondary-muted'],
      ['more-tertiary', 'more-tertiary-muted'],
    ];

    for (const [activeKey, inactiveKey] of pairs) {
      const active = read(`apps/miniprogram/src/assets/icons/ui-${activeKey}.svg`);
      const inactive = read(`apps/miniprogram/src/assets/icons/ui-${inactiveKey}.svg`);
      expect(active).not.toBe('');
      expect(inactive).not.toBe('');
      expect(generatedContentHash(inactive)).toBe(generatedContentHash(active));
      expect(active).toContain('stroke="#0A66D5"');
      expect(inactive).toContain('stroke="#5E6A78"');
    }

    for (const filterPart of ['top', 'middle', 'bottom']) {
      expect(read(`apps/miniprogram/src/assets/icons/ui-filter-${filterPart}.svg`)).toContain(
        'stroke-width="1.8"',
      );
    }
    expect(read('apps/miniprogram/src/assets/icons/ui-bell-top.svg')).toContain(
      'stroke-width="1.8"',
    );
  });

  it('keeps tracked SVG and motion output deterministic', () => {
    const assetGenerator = absolute('packages/ui-icons/scripts/generate-miniprogram-assets.mjs');
    const motionGenerator = absolute('packages/ui-icons/scripts/generate-motion-adapters.mjs');
    expect(existsSync(assetGenerator)).toBe(true);
    expect(existsSync(motionGenerator)).toBe(true);
    if (!existsSync(motionGenerator)) return;

    for (const generator of [assetGenerator, motionGenerator]) {
      const result = spawnSync(process.execPath, [generator, '--check'], {
        cwd: repositoryRoot,
        encoding: 'utf8',
        windowsHide: true,
      });
      expect(result.status, `${result.stdout}${result.stderr}`).toBe(0);
    }
  });
});
