import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '../../..');

function read(relativePath) {
  return readFileSync(resolve(repositoryRoot, relativePath), 'utf8').replaceAll('\r\n', '\n');
}

function block(source, marker) {
  const markerIndex = source.indexOf(marker);
  expect(markerIndex, `missing ${marker}`).toBeGreaterThanOrEqual(0);
  const openIndex = source.indexOf('{', markerIndex);
  expect(openIndex, `missing block for ${marker}`).toBeGreaterThan(markerIndex);

  let depth = 0;
  for (let index = openIndex; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(markerIndex, index + 1);
  }
  throw new Error(`unterminated block for ${marker}`);
}

function segment(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  expect(start, `missing ${startMarker}`).toBeGreaterThanOrEqual(0);
  const end = source.indexOf(endMarker, start + startMarker.length);
  expect(end, `missing ${endMarker}`).toBeGreaterThan(start);
  return source.slice(start, end);
}

function generatedContentHash(asset) {
  const match = asset.match(/content:([a-f0-9]{64})/);
  expect(match).not.toBeNull();
  return match[1];
}

describe('EXP-ICON-004-B1.1 motion parity', () => {
  it('uses active-only calendar motion and same-source color variants', () => {
    const template = read('apps/miniprogram/src/pages/workbench/index.wxml');
    const controller = read('apps/miniprogram/src/pages/workbench/index.ts');
    const catalog = read('packages/ui-icons/src/catalog.ts');
    const iconDirectory = resolve(repositoryRoot, 'apps/miniprogram/src/assets/icons');

    expect(catalog).toMatch(
      /fileKey: 'calendar-muted'[\s\S]{0,120}?sourceKey: 'calendar-base'[\s\S]{0,120}?colorRole: 'secondary'/,
    );
    expect(catalog).toMatch(
      /fileKey: 'calendar-check-muted'[\s\S]{0,120}?sourceKey: 'calendar-check'[\s\S]{0,120}?colorRole: 'secondary'/,
    );
    expect(existsSync(resolve(iconDirectory, 'ui-calendar-muted.svg'))).toBe(true);
    expect(existsSync(resolve(iconDirectory, 'ui-calendar-check-muted.svg'))).toBe(true);
    expect(template).toContain(
      "src=\"{{activeWorkspace === 'calendar' ? '/assets/icons/ui-calendar.svg' : '/assets/icons/ui-calendar-muted.svg'}}\"",
    );
    expect(template).toContain(
      "src=\"{{activeWorkspace === 'calendar' ? '/assets/icons/ui-calendar-check.svg' : '/assets/icons/ui-calendar-check-muted.svg'}}\"",
    );
    expect(template).not.toContain('calendarNavAnimating');
    expect(controller).not.toContain('calendarNavAnimating');

    for (const [activeFile, inactiveFile] of [
      ['ui-calendar.svg', 'ui-calendar-muted.svg'],
      ['ui-calendar-check.svg', 'ui-calendar-check-muted.svg'],
    ]) {
      const active = read(`apps/miniprogram/src/assets/icons/${activeFile}`);
      const inactive = read(`apps/miniprogram/src/assets/icons/${inactiveFile}`);
      expect(generatedContentHash(inactive)).toBe(generatedContentHash(active));
    }

    const handler = block(controller, 'handleCalendarNav(this: WorkbenchPageInstance): void');
    expect(handler).toContain("activatePrimaryWorkspace(this, 'calendar');");
    expect(handler).toContain("this.setData({ scrollTarget: '' }, () => {");
    expect(handler).toContain("this.setData({ scrollTarget: 'workbench-content-top' });");
    expect(handler.match(/activatePrimaryWorkspace/g)).toHaveLength(1);
    expect(handler.match(/this\.setData/g)).toHaveLength(2);
    expect(handler).not.toMatch(/setTimeout|setInterval|createCanvas|requestAnimationFrame/);
  });

  it('adapts calendar draw without inventing a Mini-only geometry animation', () => {
    const miniStyles = read('apps/miniprogram/src/pages/workbench/index.wxss');
    const webStyles = read('apps/web/src/features/layout/WorkbenchNavIcon.vue');
    const motion = read('packages/ui-icons/src/motion.ts');
    const miniRule = block(miniStyles, '.nav-calendar.is-looping .nav-icon-actor');
    const miniFrames = block(miniStyles, '@keyframes minimal-draw');
    const webFrames = block(webStyles, '@keyframes minimal-draw');

    expect(motion).toContain("navigation: loop('navigation'");
    expect(motion).toContain('{ offset: 0, opacity: 0.3, strokeDashoffset: 1 }');
    expect(motion).toContain('{ offset: 0.5, opacity: 1, strokeDashoffset: 0 }');
    expect(motion).toContain('{ offset: 1, opacity: 0.3, strokeDashoffset: 1 }');
    expect(webFrames).toContain('opacity: 0.3;');
    expect(webFrames).toContain('stroke-dashoffset: 1;');
    expect(miniRule).toContain('animation: minimal-draw 1800ms ease-in-out infinite;');
    expect(miniFrames).toContain('opacity: 0.3;');
    expect(miniFrames).toContain('opacity: 1;');
    expect(miniFrames).not.toMatch(/scaleX|stroke-dashoffset/);
    expect(miniStyles).not.toContain('.nav-calendar.is-animating');
    expect(miniStyles).not.toContain('@keyframes click-nav-calendar');
  });

  it('renders directory mode assets with the Web stroke and shared inactive color', () => {
    const types = read('packages/ui-icons/src/types.ts');
    const catalog = read('packages/ui-icons/src/catalog.ts');
    const tokenSource = read('packages/ui-tokens/src/tokens.ts');
    const tokenCss = read('packages/ui-tokens/src/tokens.css');
    const tokenWxss = read('packages/ui-tokens/src/tokens.wxss');
    const webView = read('apps/web/src/views/directory/UnifiedDirectoryView.vue');
    const miniStyles = read(
      'apps/miniprogram/src/subpackages/organization/components/directory-panel/index.wxss',
    );

    expect(types).toContain('readonly strokeWidth?: number;');
    expect(types).toContain("'directoryModeInactive'");
    expect(tokenSource).toContain("directoryModeInactive: '#586678'");
    expect(tokenCss).toContain('--ui-color-directory-mode-inactive: #586678;');
    expect(tokenWxss).toContain('--ui-color-directory-mode-inactive: #586678;');
    expect(webView).toContain('color: var(--ui-color-directory-mode-inactive);');
    expect(miniStyles).toContain('color: var(--ui-color-directory-mode-inactive);');

    for (const fileKey of [
      'department',
      'department-muted',
      'people-primary',
      'people-primary-muted',
      'people-secondary',
      'people-secondary-muted',
    ]) {
      expect(catalog).toMatch(
        new RegExp(`fileKey: '${fileKey}'[\\s\\S]{0,180}?strokeWidth: 1\\.8`),
      );
      const asset = read(`apps/miniprogram/src/assets/icons/ui-${fileKey}.svg`);
      expect(asset).toContain('viewBox="0 0 24 24"');
      expect(asset).toContain('stroke-width="1.8"');
      expect(asset).toContain('stroke-linecap="round"');
      expect(asset).toContain('stroke-linejoin="round"');
      if (fileKey.endsWith('-muted')) expect(asset).toContain('stroke="#586678"');
      else expect(asset).toContain('stroke="#0A66D5"');
    }
    for (const part of ['department', 'people-primary', 'people-secondary']) {
      const active = read(`apps/miniprogram/src/assets/icons/ui-${part}.svg`);
      const inactive = read(`apps/miniprogram/src/assets/icons/ui-${part}-muted.svg`);
      expect(generatedContentHash(inactive)).toBe(generatedContentHash(active));
    }
  });

  it('keeps people motion values and destination-only triggers aligned', () => {
    const sharedMotion = read('packages/ui-icons/src/motion.ts');
    const webIcon = read('apps/web/src/components/LucideMinimalActionIcon.vue');
    const webView = read('apps/web/src/views/directory/UnifiedDirectoryView.vue');
    const miniController = read(
      'apps/miniprogram/src/subpackages/organization/components/directory-panel/controller.ts',
    );
    const miniStyles = read(
      'apps/miniprogram/src/subpackages/organization/components/directory-panel/index.wxss',
    );

    const sharedPeople = segment(
      sharedMotion,
      "people: oneShot('people'",
      "phone: oneShot('phone'",
    );
    const miniPrimary = block(miniStyles, '@keyframes click-people-primary');
    const miniSecondary = block(miniStyles, '@keyframes click-people-secondary');
    const webPrimary = block(webIcon, '@keyframes click-people-primary');
    const webSecondary = block(webIcon, '@keyframes click-people-secondary');
    const miniActivate = block(miniController, 'function activateMode(');
    const webSelect = block(webView, 'function selectDirectory(');

    expect(sharedPeople).toContain("oneShot('people', 'toggle', 520");
    for (const source of [webIcon, miniStyles]) {
      expect(source).toContain('520ms');
      expect(source).toContain('cubic-bezier(0.2, 0, 0, 1)');
    }
    expect(sharedPeople).toContain("'cubic-bezier(0.2, 0, 0, 1)'");
    for (const source of [miniPrimary, webPrimary]) {
      expect(source).toContain('46%');
      expect(source).toContain('translateX(-0.75px)');
    }
    for (const source of [miniSecondary, webSecondary]) {
      expect(source).toContain('46%');
      expect(source).toContain('translateX(1px)');
    }
    expect(sharedPeople).toContain("{ offset: 0.46, transform: 'translateX(-0.75px)' }");
    expect(sharedPeople).toContain("{ offset: 0.46, transform: 'translateX(1px)' }");
    expect(miniActivate).toContain(
      'if (page.data.directoryKind === normalized && page.data.activeModeIndex === index) return;',
    );
    expect(miniActivate.indexOf('return;')).toBeLessThan(miniActivate.indexOf('playModeIcon'));
    expect(webSelect).toContain('if (directory === activeDirectory.value) {');
    expect(webSelect.indexOf('return;')).toBeLessThan(webSelect.indexOf('playDirectoryMotion'));
  });
});
