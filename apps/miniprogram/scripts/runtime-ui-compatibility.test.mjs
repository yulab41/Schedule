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

  it('applies the same 3.17.2 press-feedback boundary to guest calendar views', () => {
    const workbenchTemplate = readSource('pages/workbench/index.wxml');
    const guestTemplate = readSource('pages/guest/guest.wxml');
    const pressedFeedbackBoundary =
      "hover-class=\"{{skyline3172UiCompatibility ? 'none' : 'is-pressed'}}\"";

    expect(workbenchTemplate).toContain(
      'runtime-pressed-feedback-compatibility="{{skyline3172UiCompatibility}}"',
    );
    expect(guestTemplate).toContain(
      'runtime-pressed-feedback-compatibility="{{skyline3172UiCompatibility}}"',
    );
    expect(workbenchTemplate).toContain(pressedFeedbackBoundary);
    expect(guestTemplate).toContain(pressedFeedbackBoundary);
    expect(guestTemplate.match(/class="week-day /gu)).toHaveLength(1);
    expect(guestTemplate.slice(guestTemplate.indexOf('class="week-day ')).slice(0, 400)).toContain(
      pressedFeedbackBoundary,
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

  it('keeps the group dropdown arrow beside the group name on 3.17.2 only', () => {
    const styles = readSource('pages/workbench/index.wxss');

    expect(styles).toMatch(/\.group-switcher-arrow\s*\{[^}]*position:\s*absolute/su);
    expect(styles).toMatch(
      /\.is-skyline-3172-ui \.group-switcher-trigger\s*\{[^}]*padding-right:\s*0/su,
    );
    expect(styles).toMatch(
      /\.is-skyline-3172-ui \.group-switcher-arrow\s*\{[^}]*position:\s*static/su,
    );
  });

  it('gives the selector popover a fixed height and in-place expansion on 3.17.2', async () => {
    const { createSelectorPopoverStyle } =
      await import('../src/components/ui/ui-selector/selector.ts');
    const optionsTemplate = readSource('components/ui/ui-selector/options.wxml');
    const selectorTemplate = readSource('components/ui/ui-selector/index.wxml');
    const selectorComponent = readSource('components/ui/ui-selector/index.ts');
    const selectorStyles = readSource('components/ui/ui-selector/index.wxss');
    const pickerTemplate = readSource('components/ui/ui-date-picker/index.wxml');
    const pickerComponent = readSource('components/ui/ui-date-picker/index.ts');

    expect(createSelectorPopoverStyle(3, false)).toBe('');
    expect(createSelectorPopoverStyle(0, true)).toBe('height:56px;');
    expect(createSelectorPopoverStyle(3, true)).toBe('height:100px;');
    expect(createSelectorPopoverStyle(20, true)).toBe('height:300px;');
    expect(optionsTemplate).toContain('style="{{popoverStyle}}"');
    expect(optionsTemplate).toContain("{{skyline3172UiCompatibility ? 'is-inline' : ''}}");
    expect(optionsTemplate).toContain('wx:if="{{open && !skyline3172UiCompatibility}}"');
    expect(selectorTemplate).toContain('popoverStyle');
    expect(selectorTemplate).toContain('skyline3172UiCompatibility');
    expect(pickerTemplate).toContain('popoverStyle');
    expect(pickerTemplate).toContain('skyline3172UiCompatibility');
    expect(selectorStyles).toMatch(
      /\.workflow-picker-selector-popover\.is-inline\s*\{[^}]*position:\s*static/su,
    );
    expect(selectorStyles).toMatch(
      /\.workflow-picker-selector-popover\.is-inline\.is-measuring\s*\{[^}]*visibility:\s*visible/su,
    );
    expect(selectorComponent).toContain('needsCurrentRuntimeSkyline3172UiCompatibility');
    expect(pickerComponent).toContain('needsCurrentRuntimeSkyline3172UiCompatibility');
  });

  it('hosts the 3.17.2 workflow picker dialog on the panel root layer', () => {
    const template = readSource('components/ui/ui-date-picker/index.wxml');
    const styles = readSource('components/ui/ui-date-picker/index.wxss');
    const component = readSource('components/ui/ui-date-picker/index.ts');
    const host = readSource('subpackages/workflows/components/controller-host.ts');

    expect(template.match(/class="workflow-picker-layer/gu)).toHaveLength(1);
    expect(template).not.toContain('<root-portal');
    expect(template).toContain(
      `wx:if="{{open && mode !== 'selector' && (dialogOnly || !hostedLocally)}}"`,
    );
    // The hosted dialog lives at page level, so it must swallow its own taps;
    // otherwise the panel-root close handler would dismiss it on every tap.
    expect(template).toMatch(
      /class="workflow-picker-layer[^"]*"\s*\n?\s*catchtap="handleInternalTap"/su,
    );
    expect(template).toContain(`{{hostedLocally ? 'is-inline' : ''}}`);
    expect(template).toContain('wx:if="{{!dialogOnly}}"');
    expect(template).toContain('wx:if="{{!hostedLocally}}" class="workflow-picker-scrim"');
    expect(template).toContain('wx:if="{{!hostedLocally}}" class="workflow-picker-handle"');
    expect(component).toContain('dialogOnly: { type: Boolean, value: false }');
    expect(component).toContain("hostKey: { type: String, value: '' }");
    expect(component).toContain('function needsHostedDialog');
    expect(component).toContain('forwardHostedChange');
    expect(component).toContain('forwardHostedClose');
    expect(host).toContain("'#workflow-picker-host'");
    expect(host).toContain('pickerDialog: closedPickerDialog()');
    expect(host).toContain("selectComponent?.('#workflow-picker-host')");
    expect(host).toContain('requestCloseFromParent');
    expect(readSource('components/ui/ui-sheet/index.ts')).toContain(
      'requestCloseFromParent(this: UiSheetInstance): void',
    );
    for (const panel of ['leave', 'swap', 'duty']) {
      const panelTemplate = readSource(
        `subpackages/workflows/components/workflow-${panel}-panel/index.wxml`,
      );
      expect(panelTemplate).toContain('dialog-only="{{true}}"');
      expect(panelTemplate).toContain('id="workflow-picker-host"');
      expect(panelTemplate).toContain('host-key="');
      expect(panelTemplate).toContain('bindchange="handleHostedPickerChange"');
      expect(panelTemplate).toContain('bindclose="handleHostedPickerClose"');
    }
    expect(styles).not.toContain('ui-root-portal-tokens.wxss');
    expect(styles).toMatch(/\.workflow-picker-layer\s*\{[^}]*position:\s*fixed/su);
    expect(styles).toMatch(/\.workflow-picker-layer\.is-inline\s*\{[^}]*position:\s*static/su);
    expect(styles).toMatch(/\.workflow-picker-sheet\.is-inline\s*\{[^}]*position:\s*static/su);
  });

  it('positions every overlay layer with explicit offsets for the affected runtime', () => {
    const files = [
      'components/ui/ui-date-picker/index.wxss',
      'components/ui/ui-selector/index.wxss',
      'components/ui/ui-sheet/index.wxss',
    ];
    for (const file of files) {
      const styles = readSource(file);
      expect(styles).toContain('top: 0;');
      expect(styles).toContain('right: 0;');
      expect(styles).toContain('bottom: 0;');
      expect(styles).toContain('left: 0;');
    }
    const pickerStyles = readSource('components/ui/ui-date-picker/index.wxss');
    expect(pickerStyles).toMatch(/\.workflow-picker-layer\s*\{[^}]*top:\s*0;/su);
    expect(pickerStyles).toMatch(/\.workflow-picker-layer\s*\{[^}]*left:\s*0;/su);
    // A safe-area value must keep a plain fallback for the affected runtime.
    expect(pickerStyles).toMatch(/bottom:\s*12px;\s*\n\s*bottom:\s*max\(/su);
  });

  it('keeps wheel paging and programmatic month jumps working on the affected runtime', () => {
    const wheelTemplate = readSource('components/ui/ui-wheel-column/index.wxml');
    const wheelGesture = readFileSync(
      new URL('../src/components/ui/ui-wheel-column/wheel-gesture.wxs', import.meta.url),
      'utf8',
    );
    const monthComponent = readSource('components/calendar/calendar-month/index.ts');
    const picker = readSource('components/ui/ui-date-picker/index.ts');

    // The WXS owns the track transform, so the template must not bind a style
    // that a re-render could use to clobber it.
    expect(wheelTemplate).toContain('id="ui-wheel-track"');
    expect(wheelTemplate).not.toContain('wheelInitialOffset');
    expect(wheelGesture).toContain("selectComponent('#ui-wheel-track')");
    // The affected runtime does not honour `touch-action` for pan arbitration,
    // so the wheel must claim the vertical gesture before an ancestor can.
    expect(wheelTemplate).toContain('catchtouchstart="{{wheelGesture.touchStart}}"');
    expect(wheelTemplate).toContain('catchtouchmove="{{wheelGesture.touchMove}}"');
    expect(wheelTemplate).not.toContain('bindtouchmove="{{wheelGesture.touchMove}}"');
    // Programmatic month paging must not replay a reversed circular animation:
    // on the affected runtime the same ring is paged by a native horizontal
    // scroller, which the platform animates and which tracks the finger itself.
    expect(picker).toContain('datePagerAnimated: true');
    expect(picker).toContain('handleDateCompatScroll');
    const pickerTemplate = readSource('components/ui/ui-date-picker/index.wxml');
    expect(pickerTemplate).toContain('scroll-into-view="{{datePagerTarget}}"');
    expect(pickerTemplate).toContain('bindscroll="handleDateCompatScroll"');
    expect(pickerTemplate).toContain('wx:if="{{skyline3172UiCompatibility}}"');
    // A settled native scroll must still commit the ring shift.
    expect(picker).toMatch(/finishDateSwiperAt\(instance, slot\)/u);
    // The home month calendar pages the same way there, so its arrows animate
    // and its locate button slides a single panel instead of jumping.
    const monthTemplate = readSource('components/calendar/calendar-month/index.wxml');
    expect(monthTemplate).toContain('scroll-into-view="{{pagerTarget}}"');
    expect(monthTemplate).toContain('bindscroll="handlePagerScroll"');
    expect(monthTemplate).toContain('wx:if="{{skyline3172UiCompatibility}}"');
    expect(monthComponent).toContain('pagerAnimated: true');
    expect(monthComponent).toContain('function settleCompatPagerScroll');
    expect(monthComponent).not.toContain('swiperDuration: this.data.skyline3172UiCompatibility');
    // The height lands in its own update before the scroll target is set: the
    // platform defers a height transition on a node that is already running a
    // smooth scroll, which would read as the height settling after the slide.
    const heightWrite = monthComponent.indexOf('setData({ viewportHeight: next.viewportHeight }');
    const slideTarget = monthComponent.indexOf(
      "pagerTarget: createCalendarPeriodPaneId('month-pane-', delta < 0 ? 0 : 2)",
    );
    expect(heightWrite).toBeGreaterThan(-1);
    expect(slideTarget).toBeGreaterThan(-1);
    expect(heightWrite).toBeLessThan(slideTarget);
    // A programmatic step settles as soon as the slide reaches its target pane,
    // instead of waiting out the longer gesture window.
    expect(monthComponent).toContain('requested === compatPaneDelta(this)');
    // Inside a native scroller the affected runtime cannot resolve percentage
    // widths, so both rings measure the pane once and apply it inline.
    expect(monthTemplate).toContain('style="{{paneStyle}}"');
    expect(monthComponent).toContain('measureCalendarPeriodPaneWidth');
    expect(pickerTemplate).toContain('style="{{datePaneStyle}}"');
    expect(picker).toContain('measureCalendarPeriodPaneWidth');
    // Both rings keep a fixed physical pane order there, so a step always travels
    // the way a month does and one swipe never crosses more than one month.
    expect(monthTemplate).toContain('wx:for="{{compatPanes}}"');
    expect(pickerTemplate).toContain('wx:for="{{compatPanes}}"');
    expect(monthComponent).toContain('function syncCompatPanes');
    expect(picker).toContain('function syncCompatDatePanes');
    // The gesture must survive a missing config observer: the template carries the
    // base position, and the node dataset re-seeds the state per generation.
    // Both carriers go through the component's own data: the renderer on the
    // affected runtime does not deliver property/observer reads reliably.
    expect(wheelTemplate).toContain('data-item-count="{{wheelConfig.itemCount}}"');
    expect(wheelTemplate).toContain('data-base-index="{{wheelLayoutIndex}}"');
    expect(wheelTemplate).toContain('style="{{wheelTrackStyle}}"');
    expect(wheelGesture).toContain('seedStateFromDataset');
    // 3.17.3 keeps its original split: template base + gesture delta.
    expect(wheelGesture).toContain('state.offset - state.baseOffset');
    expect(wheelGesture).toContain('refreshItemCount');
    // The 年/月 unit prefers item data and falls back to the component property.
    expect(wheelTemplate).toContain(
      '<text wx:if="{{item.unit}}" class="ui-wheel-unit">{{item.unit}}</text>',
    );
    expect(wheelTemplate).toContain('<text wx:else class="ui-wheel-unit">{{unit}}</text>');
    // Pixel motion must not depend on WXS style writes on the affected runtime.
    const wheelComponent = readSource('components/ui/ui-wheel-column/index.ts');
    expect(wheelComponent).toContain('function createWheelTrackStylePatch');
    // The affected runtime gets the whole absolute offset in the transform, while
    // 3.17.3 keeps the template-owned base and must stay byte-identical.
    expect(wheelComponent).toContain('transform:translateY(${absoluteOffset}px)');
    expect(wheelComponent).toContain('margin-top:${layoutOffset}px');
    // Selected-row emphasis must not depend on the WXS reaching the renderer.
    const wheelStyles = readSource('components/ui/ui-wheel-column/index.wxss');
    expect(wheelTemplate).toContain('is-skyline-3172-ui');
    // On the affected runtime the emphasis is transported through data too, so
    // the wheel scrolls natively and every row style comes from the frame.
    expect(wheelTemplate).toContain('style="{{compatStyles[index]}}"');
    expect(wheelTemplate).toContain('style="{{compatNumberStyles[index]}}"');
    expect(wheelTemplate).toContain('bindscroll="handleCompatScroll"');
    expect(wheelStyles).toContain('.ui-wheel-compat-scroll {');
    expect(wheelComponent).toContain('function paintCompatFrame');
    // The emphasised row is interpolated from the scroll frame now, so the
    // discrete font-size bump is gone from the compatible path.
    expect(wheelComponent).toContain('function compatNumberStyle');
    expect(wheelComponent).toContain('function compatRowStyle');
    // Locate-today re-centers in one step no matter what the pager was doing.
    expect(picker).toMatch(/handleDateToday[\s\S]{0,900}resetDatePager\(this\)/u);
    expect(picker).toMatch(/handleDateToday[\s\S]{0,900}createDateDraftPatch/u);
    expect(picker).not.toContain('_dateLocateTarget');
  });
});
