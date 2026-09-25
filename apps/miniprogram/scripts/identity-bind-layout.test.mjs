import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(path.join(appRoot, file), 'utf8');
const bindingTemplate = read('src/pages/admin-bind/preview.wxml');
const bindingConfig = read('src/pages/admin-bind/preview.json');
const bindingSource = read('src/pages/admin-bind/preview.ts');
const identityStyles = read('src/styles/identity.wxss');
const bindingStyles = read('src/pages/admin-bind/preview.wxss').replace(/@import[^;]+;/gu, '');
const buttonStyles = read('src/components/ui/ui-button/index.wxss');
const toastStyles = read('src/components/ui/ui-toast/index.wxss');
const tokens = read('../../packages/ui-tokens/src/tokens.wxss').replace(
  /\bpage(?=\s*\{)/gu,
  ':root',
);
const appStyles = read('src/app.wxss')
  .replace(/@import[^;]+;/gu, '')
  .replace(/\bpage(?=\s*\{)/gu, 'body');
const layoutStyles = [
  'html, body { margin: 0; min-height: 100%; }',
  'view, scroll-view { display: block; }',
  'text { display: block; }',
  tokens,
  appStyles,
  identityStyles,
  bindingStyles,
  buttonStyles,
  toastStyles,
  '.ui-toast__layer { top: 16px; }',
].join('\n');

it('keeps every invitation state free from visitor actions, links and QR content', () => {
  expect(bindingTemplate).toContain('handleBackToLogin');
  expect(bindingTemplate).toContain('ui-toast');
  expect(bindingTemplate).not.toContain('ui-alert');
  expect(bindingTemplate).not.toMatch(/访客|guest|visitor|扫码/u);
  expect(bindingSource).not.toMatch(/handleGuest|guest-entry|GuestQr|访客|visitor/u);
  expect(bindingConfig).not.toMatch(/guest|visitor|访客/u);
});

const browserPath = process.env.MINI_LAYOUT_BROWSER_PATH;
describe.skipIf(!browserPath)('Invitation binding layout proxy (not native acceptance)', () => {
  let browserServer;
  let browser;
  let page;
  let evidenceDirectory;
  const observations = [];

  beforeAll(async () => {
    expect(existsSync(browserPath)).toBe(true);
    evidenceDirectory = path.resolve(process.env.MINI_LAYOUT_EVIDENCE_DIR ?? '');
    if (
      !evidenceDirectory ||
      !evidenceDirectory.includes(`${path.sep}runtime${path.sep}codex${path.sep}`)
    ) {
      throw new Error('MINI_LAYOUT_EVIDENCE_DIR must be under project runtime/codex.');
    }
    mkdirSync(evidenceDirectory, { recursive: true });
    browserServer = await chromium.launchServer({ executablePath: browserPath, headless: true });
    browser = await chromium.connect(browserServer.wsEndpoint());
    page = await browser.newPage();
  }, 30_000);

  afterAll(async () => {
    if (evidenceDirectory) {
      writeFileSync(
        path.join(evidenceDirectory, 'geometry.json'),
        JSON.stringify(observations, null, 2),
      );
    }
    await browserServer?.kill();
  }, 30_000);

  it('keeps the confirmation action, login return and transient notice separated at 390px and 320px', async () => {
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await page.setContent(`
        <style>
          ${layoutStyles}
        </style>
        <scroll-view class="identity-scroll">
          <view class="identity-page is-login identity-bind-page">
            <view class="identity-login-intro">
              <view class="identity-login-brand-mark"><view></view><view></view></view>
              <text class="identity-login-title">确认绑定排班账号</text>
            </view>
            <view class="identity-card identity-login-card">
              <text class="identity-bind-expiry">有效至 2099-12-31 23:59</text>
              <view class="identity-target">
                <text class="identity-target__label">目标账号</text>
                <text class="identity-target__name">演示成员</text>
                <text class="identity-target__username">工号：TEST01</text>
              </view>
              <text class="identity-bind-description">确认后，当前微信身份会绑定到该排班账号。</text>
              <view class="identity-card__button">
                <view class="ui-button ui-button--primary"><text class="ui-button__label">确认绑定</text></view>
              </view>
            </view>
            <view class="identity-page-back identity-login-actions">
              <view class="identity-card__button identity-card__button--secondary">
                <view class="ui-button ui-button--secondary"><text class="ui-button__label">返回登录页面</text></view>
              </view>
            </view>
            <text class="identity-login-privacy">身份信息只用于进入管理员指定群组的排班账号。</text>
            <text class="identity-login-build">0.1.0-test@0000000</text>
          </view>
        </scroll-view>
        <view class="ui-toast__layer is-visible"><view class="ui-toast ui-toast--success"><text class="ui-toast__message">绑定信息已读取。</text></view></view>
      `);

      const geometry = await page.evaluate(() => {
        const card = globalThis.document.querySelector('.identity-card').getBoundingClientRect();
        const action = globalThis.document
          .querySelector('.identity-card__button .ui-button')
          .getBoundingClientRect();
        const back = globalThis.document
          .querySelector('.identity-page-back')
          .getBoundingClientRect();
        const backAction = globalThis.document
          .querySelector('.identity-page-back .ui-button')
          .getBoundingClientRect();
        const toast = globalThis.document.querySelector('.ui-toast__layer').getBoundingClientRect();
        return {
          cardBottom: card.bottom,
          actionTop: action.top,
          actionBottom: action.bottom,
          actionHeight: action.height,
          backTop: back.top,
          backHeight: back.height,
          backActionTop: backAction.top,
          backActionBottom: backAction.bottom,
          backActionHeight: backAction.height,
          toastBottom: toast.bottom,
          hasHorizontalOverflow:
            globalThis.document.documentElement.scrollWidth > globalThis.innerWidth,
        };
      });
      expect(geometry.actionHeight).toBeGreaterThanOrEqual(44);
      expect(geometry.actionBottom).toBeLessThanOrEqual(geometry.cardBottom);
      expect(geometry.backHeight).toBeGreaterThanOrEqual(44);
      expect(geometry.backTop).toBeGreaterThan(geometry.cardBottom);
      expect(geometry.backActionHeight).toBeGreaterThanOrEqual(44);
      expect(geometry.backActionTop).toBeGreaterThanOrEqual(geometry.backTop);
      expect(geometry.backActionBottom).toBeLessThanOrEqual(geometry.backTop + geometry.backHeight);
      expect(geometry.toastBottom).toBeLessThan(geometry.actionTop);
      expect(geometry.toastBottom).toBeLessThan(geometry.backTop);
      expect(geometry.hasHorizontalOverflow).toBe(false);
      observations.push({ width, geometry });
      await page.screenshot({ path: path.join(evidenceDirectory, `binding-${width}.png`) });

      await page.setContent(`
        <style>
          ${layoutStyles}
        </style>
        <scroll-view class="identity-scroll">
          <view class="identity-page is-login identity-bind-page">
            <view class="identity-login-intro">
              <view class="identity-login-brand-mark"><view></view><view></view></view>
              <text class="identity-login-title">绑定暂未完成</text>
              <text class="identity-bind-description">请向管理员重新获取绑定链接，或返回登录页面。</text>
            </view>
            <view class="identity-card identity-login-card">
              <view class="identity-bind-error-copy">
                <text class="identity-card__heading">绑定暂时无法完成</text>
                <text class="identity-bind-description">请检查链接有效期和目标账号的绑定状态。</text>
              </view>
            </view>
            <view class="identity-page-back identity-login-actions">
              <view class="identity-card__button identity-card__button--secondary">
                <view class="ui-button ui-button--secondary"><text class="ui-button__label">返回登录页面</text></view>
              </view>
            </view>
            <text class="identity-login-privacy">身份信息只用于进入管理员指定群组的排班账号。</text>
            <text class="identity-login-build">0.1.0-test@0000000</text>
          </view>
        </scroll-view>
        <view class="ui-toast__layer is-visible"><view class="ui-toast ui-toast--error"><text class="ui-toast__message">绑定链接已过期。</text></view></view>
      `);

      const errorGeometry = await page.evaluate(() => {
        const card = globalThis.document.querySelector('.identity-card').getBoundingClientRect();
        const back = globalThis.document
          .querySelector('.identity-page-back')
          .getBoundingClientRect();
        const backAction = globalThis.document
          .querySelector('.identity-page-back .ui-button')
          .getBoundingClientRect();
        const toast = globalThis.document.querySelector('.ui-toast__layer').getBoundingClientRect();
        return {
          cardTop: card.top,
          cardBottom: card.bottom,
          backTop: back.top,
          backHeight: back.height,
          backActionTop: backAction.top,
          backActionBottom: backAction.bottom,
          backActionHeight: backAction.height,
          toastBottom: toast.bottom,
          hasHorizontalOverflow:
            globalThis.document.documentElement.scrollWidth > globalThis.innerWidth,
        };
      });
      expect(errorGeometry.backHeight).toBeGreaterThanOrEqual(44);
      expect(errorGeometry.backTop).toBeGreaterThan(errorGeometry.cardBottom);
      expect(errorGeometry.backActionHeight).toBeGreaterThanOrEqual(44);
      expect(errorGeometry.backActionTop).toBeGreaterThanOrEqual(errorGeometry.backTop);
      expect(errorGeometry.backActionBottom).toBeLessThanOrEqual(
        errorGeometry.backTop + errorGeometry.backHeight,
      );
      expect(errorGeometry.toastBottom).toBeLessThan(errorGeometry.cardTop);
      expect(errorGeometry.hasHorizontalOverflow).toBe(false);
      observations.push({ width, error: errorGeometry });
      await page.screenshot({ path: path.join(evidenceDirectory, `binding-error-${width}.png`) });
    }
  });
});
