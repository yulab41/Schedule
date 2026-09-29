/* global document, getComputedStyle, innerWidth */
import { mkdirSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { describe, expect, it } from 'vitest';
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const source = 'src/subpackages/workflows/components/workflow-leave-panel/';
const message =
  '请假期间仍有已发布班次，暂不能提交。请先通过“换班”或“加扣班”调整班次，或联系管理员撤回相关排班发布。';
const template = read(source + 'index.wxml');
const warning = template
  .match(
    /<(view|text) wx:if="\{\{affectedWarningMessage\}\}" class="affected-warning"[\s\S]*?<\/(?:view|text)>/u,
  )[0]
  .replace(/wx:if="[^"]*"/u, '')
  .replace('{{affectedWarningMessage}}', message)
  .replace(/view/gu, 'div')
  .replace(/text/gu, 'span');
// Browser geometry proxy using production WXSS; this is not Mini Program/device acceptance.
describe.runIf(!!process.env.SCHEDULE_WORKFLOW_LAYOUT)(
  'leave and statistics browser geometry',
  () => {
    it('keeps warnings, reason and footer separate at 320/390px including large text', async () => {
      const browser = await chromium.launch({
        executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
        headless: true,
      });
      const output = new URL('../../../runtime/audit/leave-statistics-layout/', import.meta.url);
      mkdirSync(output, { recursive: true });
      try {
        for (const width of [320, 390])
          for (const large of [false, true]) {
            const page = await browser.newPage({
              viewport: { width, height: 740 },
              reducedMotion: 'reduce',
            });
            const css =
              read('dist/styles/tokens.wxss').replace(/^page/mu, ':root') +
              read('src/components/ui/ui-sheet/index.wxss') +
              read(source + 'index.wxss') +
              read('src/subpackages/insights/components/insights-dashboard-panel/index.wxss') +
              read('src/components/ui/ui-selector/index.wxss');
            await page.setContent(
              `<style>${css}body{margin:0}*{box-sizing:border-box}.workflow-sheet-scroll{overflow:auto} ${large ? ':root{--ui-font-size-sm:20px;--ui-font-size-md:22px;--ui-line-height-body:1.6}' : ''}</style><div class="leave-page"><div class="ui-sheet__layer"><div class="ui-sheet__panel"><div class="ui-sheet__header">新建请假</div><div class="ui-sheet__content"><div class="workflow-sheet-scroll"><div class="sheet-body"><div>2026-09-29 至 2026-10-30</div><div class="affected-block"><div class="affected-list">${Array.from({ length: 8 }, (_, i) => `<div class="affected-row">2026-10-${String(i + 1).padStart(2, '0')} 全天班<span>需先调整</span></div>`).join('')}</div>${warning}</div><div class="field-block reason-field"><span>原因说明（选填）</span><textarea class="native-textarea leave-reason-field"></textarea></div></div></div><div class="workflow-sheet-footer"><div class="web-button is-primary leave-submit is-disabled">提交请假</div></div></div></div></div></div>`,
            );
            const geometry = await page.evaluate(() => {
              const rect = (s) => document.querySelector(s).getBoundingClientRect();
              const list = rect('.affected-list'),
                warning = rect('.affected-warning'),
                reason = rect('.reason-field'),
                scroll = rect('.workflow-sheet-scroll'),
                footer = rect('.workflow-sheet-footer');
              return {
                warningGap: warning.top - list.bottom,
                reasonGap: reason.top - warning.bottom,
                footerGap: footer.top - scroll.bottom,
                overflow: document.documentElement.scrollWidth > innerWidth,
                warningHeight: warning.height,
              };
            });
            expect(geometry.warningGap).toBeGreaterThanOrEqual(12);
            expect(geometry.reasonGap).toBeGreaterThanOrEqual(12);
            expect(geometry.footerGap).toBeGreaterThanOrEqual(0);
            expect(geometry.overflow).toBe(false);
            await page.locator('.workflow-sheet-scroll').evaluate((el) => {
              el.scrollTop = el.scrollHeight;
            });
            const reason = await page.locator('.reason-field').boundingBox(),
              footer = await page.locator('.workflow-sheet-footer').boundingBox();
            expect(reason.y + reason.height).toBeLessThanOrEqual(footer.y);
            await page.screenshot({
              path: new URL(
                `leave-${width}-${large ? 'large' : 'normal'}.png`,
                output,
              ).pathname.replace(/^\/([A-Za-z]:)/u, '$1'),
            });
            await page.setContent(
              `<style>${css}body{margin:0;padding:16px}${large ? ':root{--ui-font-size-sm:20px}' : ''}</style><div class="member-row"><strong>测试护士</strong><div class="member-detail-toggle">班种明细 收起</div><div class="member-shift-details"><div class="member-shift-detail"><span>N班 · 多2班</span><div class="shift-metrics">${['计划 5', '实际 7', '周末 2', '节假日 1', '换班 1', '加班 2', '扣班 0'].map((v) => `<span>${v}</span>`).join('')}</div></div><div class="member-shift-detail">休息（不计入总数） · 与计划一致</div></div><div class="workflow-picker-option">测试成员<span class="workflow-picker-option-weekend">（请假）</span></div></div>`,
            );
            expect(
              await page
                .locator('.workflow-picker-option-weekend')
                .evaluate((el) => getComputedStyle(el).color),
            ).toBe('rgb(217, 45, 32)');
            expect(
              await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
            ).toBe(true);
            await page.screenshot({
              path: new URL(
                `details-${width}-${large ? 'large' : 'normal'}.png`,
                output,
              ).pathname.replace(/^\/([A-Za-z]:)/u, '$1'),
            });
            await page.close();
          }
      } finally {
        await browser.close();
      }
    }, 30000);
  },
);
