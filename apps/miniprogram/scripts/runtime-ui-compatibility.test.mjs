import { readFileSync } from 'node:fs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function readSource(relativePath) {
  return readFileSync(new URL(`../src/${relativePath}`, import.meta.url), 'utf8');
}

describe('Skyline 3.17.2 UI compatibility boundary', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('matches only the confirmed 3.17.2 base-library runtime', async () => {
    const { needsSkyline3172UiCompatibility } =
      await import('../src/platform/runtime-ui-compatibility.ts');

    expect(needsSkyline3172UiCompatibility({ SDKVersion: '3.17.2' })).toBe(true);
    expect(needsSkyline3172UiCompatibility({ SDKVersion: '3.17.3' })).toBe(false);
    expect(needsSkyline3172UiCompatibility({ SDKVersion: '3.18.0' })).toBe(false);
    expect(needsSkyline3172UiCompatibility(undefined)).toBe(false);
  });

  it('keeps the normal path when the runtime version cannot be read', async () => {
    const { needsCurrentRuntimeSkyline3172UiCompatibility } =
      await import('../src/platform/runtime-ui-compatibility.ts');

    vi.stubGlobal('wx', {});
    expect(needsCurrentRuntimeSkyline3172UiCompatibility()).toBe(false);

    vi.stubGlobal('wx', {
      getAppBaseInfo() {
        throw new Error('runtime unavailable');
      },
    });
    expect(needsCurrentRuntimeSkyline3172UiCompatibility()).toBe(false);
  });

  it('keeps the normal Grid path and adds a scoped Flex fallback to calendar pages', () => {
    const workbenchTemplate = readSource('pages/workbench/index.wxml');
    const guestTemplate = readSource('pages/guest/guest.wxml');
    const styles = readSource('pages/workbench/index.wxss');

    expect(workbenchTemplate).toContain(
      "{{skyline3172UiCompatibility ? 'is-skyline-3172-ui' : ''}}",
    );
    expect(guestTemplate).toContain("{{skyline3172UiCompatibility ? 'is-skyline-3172-ui' : ''}}");
    expect(styles).toMatch(/\.staff-duty-heading\s*\{[^}]*display:\s*grid;/su);
    expect(styles).toMatch(/\.phone-split-actions\s*\{[^}]*display:\s*grid;/su);
    expect(styles).toContain('.is-skyline-3172-ui .staff-duty-heading,');
    expect(styles).toContain('.is-skyline-3172-ui .phone-split-actions {');
    expect(styles).toMatch(/\.is-skyline-3172-ui \.phone-split-actions\s*\{\s*display:\s*flex;/su);
  });

  it('keeps the normal CSS spinner and uses SVG only on the affected runtime', () => {
    const component = readSource('components/ui/ui-loading/index.ts');
    const template = readSource('components/ui/ui-loading/index.wxml');
    const styles = readSource('components/ui/ui-loading/index.wxss');

    expect(component).toContain('needsCurrentRuntimeSkyline3172UiCompatibility');
    expect(template).toContain('wx:if="{{!skyline3172UiCompatibility}}"');
    expect(template).toContain('/assets/icons/ui-loading-primary.svg');
    expect(template).toContain('/assets/icons/ui-loading-muted.svg');
    expect(styles).toMatch(/\.ui-loading__spinner\s*\{[^}]*border:\s*2px solid currentColor;/su);
    expect(styles).toMatch(
      /\.ui-loading__spinner-image\s*\{[^}]*animation:\s*ui-loading-spin 700ms linear infinite;/su,
    );
  });

  it('keeps normal workbench visuals and scopes the confirmed 3.17.2 fallbacks', () => {
    const template = readSource('pages/workbench/index.wxml');
    const styles = readSource('pages/workbench/index.wxss');

    expect(template).toContain('circular="{{true}}"');
    expect(template).toContain('bindchange="handleWeekSwiperChange"');
    expect(template).toContain('weekPanels[weekSwiperCurrent].weekOrdinalLabel');
    expect(styles).toMatch(/\.week-day\.is-selected::after\s*\{[^}]*box-shadow:/su);
    expect(styles).toMatch(
      /\.is-skyline-3172-ui \.week-day\.is-selected\s*\{[^}]*box-shadow:\s*inset 0 0 0 2px/su,
    );
    expect(styles).toMatch(
      /\.is-skyline-3172-ui \.week-day\.is-selected::after\s*\{[^}]*display:\s*none/su,
    );
    expect(styles).toMatch(
      /\.is-skyline-3172-ui \.group-switcher\s*\{[^}]*width:\s*220px[^}]*max-width:\s*none/su,
    );
    expect(styles).toMatch(
      /\.is-skyline-3172-ui \.group-switcher-trigger\s*\{[^}]*width:\s*220px[^}]*max-width:\s*none/su,
    );
    expect(template).toContain(
      "hover-class=\"{{skyline3172UiCompatibility ? 'none' : 'is-pressed'}}\"",
    );
  });

  it('uses one shared root-layer group menu across Skyline runtimes', () => {
    const template = readSource('pages/workbench/index.wxml');
    const styles = readSource('pages/workbench/index.wxss');
    const page = readSource('pages/workbench/index.ts');
    const buildTools = readFileSync(new URL('./build-tools.mjs', import.meta.url), 'utf8');

    expect(template.match(/class="group-menu(?:\s|")/gu)).toHaveLength(1);
    expect(template.match(/bindtap="handleGroupSelect"/gu)).toHaveLength(1);
    expect(template).not.toContain('groupOpen && !skyline3172UiCompatibility');
    expect(template).not.toContain('groupOpen && skyline3172UiCompatibility');
    expect(template).toMatch(
      /<root-portal\s+wx:if="\{\{groupOpen\}\}"\s+enable="\{\{true\}\}"\s*>/u,
    );
    expect(template).toContain('class="group-menu group-menu-portal ui-root-portal-token-scope"');
    expect(template).toContain('style="{{groupMenuPortalStyle}}"');
    expect(styles).toContain("@import '../../styles/ui-root-portal-tokens.wxss';");
    expect(styles).toMatch(/\.group-menu-portal\s*\{[^}]*position:\s*fixed/su);
    expect(styles).toMatch(/\.group-menu-portal\s*\{[^}]*z-index:\s*200/su);
    expect(styles).not.toContain('.workbench-shell-header .group-menu');
    expect(styles).not.toContain('.workbench-shell-header .group-option');
    expect(page).toContain('readonly groupMenuPortalStyle: string;');
    expect(page).toContain('groupMenuPortalStyle: `top:${contentTop + 34}px;left:12px;`');
    expect(buildTools).toContain(
      "path.join(outputDirectory, 'styles', 'ui-root-portal-tokens.wxss')",
    );
    expect(buildTools).toContain(
      "tokens.replace(/^page(?=\\s*\\{)/u, '.ui-root-portal-token-scope')",
    );
  });

  it('shortens pressed feedback only on 3.17.2 month cells', () => {
    const workbenchTemplate = readSource('pages/workbench/index.wxml');
    const monthTemplate = readSource('components/calendar/calendar-month/index.wxml');
    const monthComponent = readSource('components/calendar/calendar-month/index.ts');
    const cellTemplate = readSource('components/calendar/calendar-cell/index.wxml');
    const cellComponent = readSource('components/calendar/calendar-cell/index.ts');

    expect(workbenchTemplate).toContain(
      'runtime-pressed-feedback-compatibility="{{skyline3172UiCompatibility}}"',
    );
    expect(monthComponent).toContain(
      'runtimePressedFeedbackCompatibility: { type: Boolean, value: false }',
    );
    expect(monthTemplate).toContain(
      'runtime-pressed-feedback-compatibility="{{runtimePressedFeedbackCompatibility}}"',
    );
    expect(cellComponent).toContain(
      'runtimePressedFeedbackCompatibility: { type: Boolean, value: false }',
    );
    expect(cellTemplate).toContain(
      'hover-stay-time="{{runtimePressedFeedbackCompatibility ? 0 : 70}}"',
    );
  });

  it('keeps the normal toast border and uses an element accent only on 3.17.2', () => {
    const component = readSource('components/ui/ui-toast/index.ts');
    const template = readSource('components/ui/ui-toast/index.wxml');
    const styles = readSource('components/ui/ui-toast/index.wxss');

    expect(component).toContain('needsCurrentRuntimeSkyline3172UiCompatibility');
    expect(template).toContain("{{skyline3172UiCompatibility ? 'is-skyline-3172-ui' : ''}}");
    expect(template).toContain('wx:if="{{skyline3172UiCompatibility}}"');
    expect(template).toContain('class="ui-toast__accent"');
    expect(styles).toMatch(/\.ui-toast\s*\{[^}]*border-left:\s*4px solid/su);
    expect(styles).toMatch(/\.ui-toast\.is-skyline-3172-ui\s*\{[^}]*border-left-width:\s*1px/su);
  });

  it('scopes every production Grid fallback to the affected runtime class', () => {
    const fixtures = [
      {
        path: 'subpackages/organization/components/directory-entry-card',
        selector: '.directory-entry.is-skyline-3172-ui',
      },
      {
        path: 'subpackages/organization/components/platform-accounts-panel',
        selector: '.platform-accounts-page.is-skyline-3172-ui .account-row',
      },
      {
        path: 'subpackages/organization/components/scheduling-config-panel',
        selector: '.scheduling-config-page.is-skyline-3172-ui .shift-row',
      },
      {
        path: 'subpackages/insights/components/insights-dashboard-panel',
        selector: '.insights-dashboard-page.is-skyline-3172-ui .primary-statistics',
      },
    ];

    for (const fixture of fixtures) {
      const template = readSource(`${fixture.path}/index.wxml`);
      const styles = readSource(`${fixture.path}/index.wxss`);
      expect(template).toContain("{{skyline3172UiCompatibility ? 'is-skyline-3172-ui' : ''}}");
      expect(styles).toContain(fixture.selector);
      expect(styles.slice(styles.indexOf(fixture.selector))).toContain('display: flex;');
    }
  });

  it('uses the SVG fallback for workflow-native spinners only on 3.17.2', () => {
    const host = readSource('subpackages/workflows/components/controller-host.ts');
    const styles = readSource('subpackages/workflows/components/workflow-leave-panel/index.wxss');

    expect(host).toContain('needsCurrentRuntimeSkyline3172UiCompatibility');
    expect(styles).toMatch(
      /\.native-spinner-image\s*\{[^}]*animation:\s*native-spin 0\.8s linear infinite;/su,
    );
    for (const panel of ['leave', 'swap', 'duty']) {
      const template = readSource(
        `subpackages/workflows/components/workflow-${panel}-panel/index.wxml`,
      );
      expect(template).toContain("{{skyline3172UiCompatibility ? 'is-skyline-3172-ui' : ''}}");
      expect(template).toContain('wx:if="{{!skyline3172UiCompatibility}}"');
      expect(template).toContain('/assets/icons/ui-loading-primary.svg');
    }
  });
});
