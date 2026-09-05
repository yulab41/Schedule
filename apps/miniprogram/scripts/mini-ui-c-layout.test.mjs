// @vitest-environment jsdom

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import simulate from 'miniprogram-simulate';
import { afterEach, describe, expect, it, vi } from 'vitest';

const source = (file) => readFileSync(path.join(process.cwd(), 'src', file), 'utf8');
const evidence = process.env.SCHEDULE_MINI_UI_C_EVIDENCE;
const enabled = process.env.SCHEDULE_MINI_UI_C_LAYOUT === '1';

afterEach(() => {
  globalThis.document.body.replaceChildren();
  vi.unstubAllGlobals();
});

async function render(importer, file, properties, setup) {
  let definition;
  vi.stubGlobal('Component', (value) => {
    definition = value;
  });
  await importer();
  const loading = simulate.load({ template: '<view></view>' });
  const id = simulate.load({
    ...definition,
    usingComponents: { 'ui-loading': loading },
    template: source(file),
  });
  const component = simulate.render(id, properties);
  const host = globalThis.document.createElement('div');
  globalThis.document.body.append(host);
  component.attach(host);
  setup?.(component);
  return host.innerHTML;
}

// Explicit opt-in: keep the ordinary Mini gate lightweight; use the already installed browser.
describe.runIf(enabled)('task C browser layout fixture (not WeChat runtime evidence)', () => {
  it('checks 320/390/414, large text, resize, reduced motion, indicator bounds and long event scrolling', async () => {
    expect(evidence).toBeTruthy();
    mkdirSync(evidence, { recursive: true });
    const pickerHtml = await render(
      () => import('../src/subpackages/organization/components/shift-color-picker/index.ts'),
      'subpackages/organization/components/shift-color-picker/index.wxml',
      { value: '#0F766E', largeText: false },
      (component) => {
        const changed = vi.fn();
        component.addEventListener('change', changed);
        expect(component.querySelectorAll('.color-swatch')).toHaveLength(6);
        component.instance.handleCustomToggle();
        expect(
          component.querySelector('#shift-color-spectrum').toJSON().event.touchmove.handler,
        ).toBe('handleTouchMove');
        component.instance.handleHexInput({ detail: { value: '0f766e' } });
        component.instance.handleApply();
        expect(changed.mock.calls.at(-1)[0].detail.value).toBe('#0F766E');
        component.instance.handleCustomToggle();
        // simulate does not paint native wx-input. Mirror the actual bound component data,
        // not a hardcoded screenshot label; this remains browser CSS fixture evidence.
        expect(component.data.customHex).toBe('#0F766E');
        const mirror = globalThis.document.createElement('input');
        mirror.className = 'fixture-native-input';
        mirror.setAttribute('value', component.data.customHex);
        mirror.setAttribute('readonly', '');
        component.querySelector('.hex-color-input').dom.replaceChildren(mirror);
      },
    );
    const monthHtml = await render(
      () => import('../src/components/calendar/calendar-cell/index.ts'),
      'components/calendar/calendar-cell/index.wxml',
      {
        day: '4',
        isToday: true,
        isSelected: true,
        isWeekend: true,
        isHoliday: true,
        holiday: '中秋',
      },
    );
    const parsedPage = globalThis.document.createElement('div');
    parsedPage.innerHTML = source('pages/workbench/index.wxml');
    const weekSource = parsedPage.querySelector('.week-day').outerHTML;
    const weekId = simulate.load({
      template: `<view class="week-day-grid">${weekSource}</view>`,
      data: {
        item: {
          days: [
            {
              day: '4',
              businessDate: '2026-09-04',
              isToday: true,
              isSelected: true,
              isWeekend: true,
              duties: [],
            },
            { day: '14', businessDate: '2026-09-14', isToday: true, isSelected: true, duties: [] },
          ],
        },
      },
    });
    const week = simulate.render(weekId);
    week.attach(globalThis.document.body);
    const eventHtml = await render(
      () => import('../src/components/shift-event-records/index.ts'),
      'components/shift-event-records/index.wxml',
      {
        state: 'ready',
        meta: '2026-09-05 · 全天班',
        changeChain: '首位 → 中间 → 最后一位',
        cards: Array.from({ length: 80 }, (_, index) => ({
          id: `${index}`,
          eventTypeLabel: `记录 ${index + 1}`,
          eventTone: 'neutral',
          narrative: '用于检查长记录能够滚动到底的固定测试文本。',
          changes: [],
        })),
      },
    );
    const tokenStyles = readFileSync(
      path.join(process.cwd(), 'dist/styles/tokens.wxss'),
      'utf8',
    ).replace(/\bpage\b/gu, ':root');
    const styles = [
      'styles/calendar-date-marker.wxss',
      'components/calendar/calendar-cell/index.wxss',
      'pages/workbench/index.wxss',
      'components/shift-event-records/index.wxss',
      'subpackages/organization/components/shift-color-picker/index.wxss',
    ]
      .map(source)
      .join('\n')
      .replace(/@import[^;]+;/gu, '');
    const executablePath = [
      process.env.SMOKE_BROWSER_PATH,
      'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
      'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
      'C:/Program Files/Google/Chrome/Application/chrome.exe',
    ].find((candidate) => candidate && existsSync(candidate));
    expect(executablePath).toBeTruthy();
    const browser = await chromium.launch({ executablePath, headless: true });
    const reports = [];
    try {
      const page = await browser.newPage({
        viewport: { width: 320, height: 844 },
        deviceScaleFactor: 3,
        reducedMotion: 'reduce',
      });
      await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
        ${tokenStyles}\n${styles}
        body{margin:0;padding:12px;box-sizing:border-box;background:#F4F7FB;font-family:var(--ui-font-family-system)}
        wx-view,wx-scroll-view{display:block}wx-text{display:inline}wx-scroll-view{overflow-y:auto}
        .fixture-picker{padding:12px;border:1px solid #DCE3EB;border-radius:12px;background:white}
        .fixture-month{width:44px;height:66px}.fixture-week{margin:12px 0}
        .fixture-events{height:300px;display:flex;flex-direction:column;border:1px solid #DCE3EB;background:white;margin-top:12px;overflow:hidden}
        .fixture-header{height:56px;flex:none;display:flex;align-items:center;justify-content:space-between;padding:0 16px}
        .fixture-body{display:flex;flex:1;min-height:0;padding:0 16px 16px;flex-direction:column}
        .fixture-body>*,.fixture-month>*{height:100%;min-height:0}
        .fixture-native-input{display:block;width:100%;height:100%;padding:0;border:0;background:transparent;box-sizing:border-box;color:inherit;font:inherit}
      </style></head><body><div class="fixture-picker">${pickerHtml}</div><div class="fixture-week">${week.dom.outerHTML}</div>
      <div class="fixture-month">${monthHtml}</div>
      <div class="fixture-events"><div class="fixture-header"><span>班次事件记录</span><span>完成</span></div><div class="fixture-body">${eventHtml}</div></div></body></html>`);
      for (const [width, height] of [
        [320, 844],
        [390, 844],
        [414, 896],
        [844, 390],
      ]) {
        await page.setViewportSize({ width, height });
        const metrics = await page.evaluate(() => {
          const doc = globalThis.document;
          const rect = (node) => node.getBoundingClientRect();
          const markers = [...doc.querySelectorAll('.calendar-date-marker')].map((node) => {
            const box = rect(node),
              text = rect(node.querySelector('.calendar-date-text'));
            return {
              width: box.width,
              height: box.height,
              dx: Math.abs(text.left + text.width / 2 - box.left - box.width / 2),
              dy: Math.abs(text.top + text.height / 2 - box.top - box.height / 2),
              background: globalThis.getComputedStyle(node).backgroundColor,
              color: globalThis.getComputedStyle(node.querySelector('.calendar-date-text')).color,
            };
          });
          const bounds = [...doc.querySelectorAll('.spectrum-cursor,.hue-cursor')].map((node) => {
            const child = rect(node),
              parent = rect(node.parentElement);
            return (
              child.left >= parent.left &&
              child.top >= parent.top &&
              child.right <= parent.right &&
              child.bottom <= parent.bottom
            );
          });
          const input = rect(doc.querySelector('.hex-color-input'));
          const apply = rect(doc.querySelector('.apply-custom-color'));
          const inputRow = rect(doc.querySelector('.color-input-row'));
          const hue = rect(doc.querySelector('.hue-track'));
          const hueTarget = rect(doc.querySelector('.hue-hitbox'));
          const spectrum = rect(doc.querySelector('.color-spectrum'));
          const hexLabel = rect(doc.querySelector('.hex-color-field .color-label'));
          const fontSize = (selector) =>
            globalThis.getComputedStyle(doc.querySelector(selector)).fontSize;
          const scroll = doc.querySelector('.shift-event-sheet-scroll');
          const headerTop = rect(doc.querySelector('.fixture-header')).top;
          scroll.scrollTop = scroll.scrollHeight;
          const last = rect(doc.querySelector('.shift-event-chain-summary'));
          const viewport = rect(scroll);
          return {
            viewport: globalThis.innerWidth,
            scrollWidth: doc.documentElement.scrollWidth,
            markers,
            bounds,
            inputOverlap:
              input.right > apply.left &&
              input.left < apply.right &&
              input.bottom > apply.top &&
              input.top < apply.bottom,
            applyBelow: apply.top >= input.bottom + 6,
            applyWidthGap: Math.abs(apply.width - inputRow.width),
            halfInputGap: Math.abs(input.width - (inputRow.width - 8) / 2),
            hueHexGap: hexLabel.top - hue.bottom,
            hueHeight: hue.height,
            hueTargetHeight: hueTarget.height,
            hueTargetOverlapsControls:
              hueTarget.top < spectrum.bottom || hueTarget.bottom > input.top,
            legendFont: fontSize('.shift-color-picker > .color-label'),
            labelFont: fontSize('.hex-color-field .color-label'),
            inputFont: fontSize('.hex-color-input'),
            applyFont: fontSize('.apply-custom-color'),
            hexValue: doc.querySelector('.fixture-native-input').value,
            scrollable: scroll.scrollHeight > scroll.clientHeight,
            lastVisible: last.bottom <= viewport.bottom + 1 && last.top >= viewport.top,
            headerStable: headerTop === rect(doc.querySelector('.fixture-header')).top,
            reducedMotion: globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches,
            animation: globalThis.getComputedStyle(doc.querySelector('.custom-color-panel'))
              .animationName,
          };
        });
        expect(metrics.scrollWidth).toBeLessThanOrEqual(width);
        expect(metrics.markers).toHaveLength(3);
        for (const marker of metrics.markers) {
          expect(marker).toMatchObject({
            width: 18,
            height: 18,
            background: 'rgb(245, 197, 24)',
            color: 'rgb(22, 32, 42)',
          });
          expect(marker.dx).toBeLessThan(0.1);
          expect(marker.dy).toBeLessThan(0.1);
        }
        expect(metrics.bounds.every(Boolean)).toBe(true);
        expect(metrics.inputOverlap).toBe(false);
        expect(metrics.hexValue).toBe('#0F766E');
        expect(metrics.hueTargetHeight).toBe(44);
        expect(metrics.hueTargetOverlapsControls).toBe(false);
        expect(metrics).toMatchObject({
          hueHeight: 18,
          legendFont: '10px',
          labelFont: '9px',
          inputFont: '12px',
          applyFont: '12px',
        });
        if (width <= 640) {
          expect(metrics.applyBelow).toBe(true);
          expect(metrics.applyWidthGap).toBeLessThan(0.1);
          expect(metrics.halfInputGap).toBeLessThan(0.1);
          expect(metrics.hueHexGap).toBeGreaterThanOrEqual(7);
          expect(metrics.hueHexGap).toBeLessThanOrEqual(10);
        }
        expect(
          metrics.scrollable &&
            metrics.lastVisible &&
            metrics.headerStable &&
            metrics.reducedMotion,
        ).toBe(true);
        expect(metrics.animation).toBe('none');
        reports.push({ width, height, ...metrics });
        await page.screenshot({ path: path.join(evidence, `layout-${width}.png`), fullPage: true });
        await page
          .locator('.shift-color-picker')
          .evaluate((node) => node.classList.add('is-large-text'));
        const largeText = await page.evaluate(() => {
          const doc = globalThis.document;
          const input = doc.querySelector('.hex-color-input').getBoundingClientRect();
          const apply = doc.querySelector('.apply-custom-color').getBoundingClientRect();
          const row = doc.querySelector('.color-input-row').getBoundingClientRect();
          return {
            scrollWidth: doc.documentElement.scrollWidth,
            inputFont: globalThis.getComputedStyle(doc.querySelector('.hex-color-input')).fontSize,
            inputOverlap:
              input.right > apply.left &&
              input.left < apply.right &&
              input.bottom > apply.top &&
              input.top < apply.bottom,
            applyBelow: apply.top >= input.bottom + 6,
            applyWidthGap: Math.abs(apply.width - row.width),
            hexValue: doc.querySelector('.fixture-native-input').value,
          };
        });
        expect(largeText.scrollWidth).toBeLessThanOrEqual(width);
        expect(largeText).toMatchObject({
          inputFont: '16px',
          inputOverlap: false,
          hexValue: '#0F766E',
        });
        if (width <= 640) {
          expect(largeText.applyBelow).toBe(true);
          expect(largeText.applyWidthGap).toBeLessThan(0.1);
        }
        reports.at(-1).largeText = largeText;
        await page
          .locator('.shift-color-picker')
          .evaluate((node) => node.classList.remove('is-large-text'));
      }
      writeFileSync(
        path.join(evidence, 'layout.json'),
        JSON.stringify(
          { evidenceLayer: 'Node simulate + browser CSS fixture; not native WeChat', reports },
          null,
          2,
        ),
      );
    } finally {
      await browser.close();
    }
  }, 60000);
});
