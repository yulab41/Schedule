/* global document: readonly, getComputedStyle: readonly, innerWidth: readonly */
// Browser globals are used only inside page.evaluate callbacks.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { JSDOM } from 'jsdom';
import { chromium } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(path.join(appRoot, file), 'utf8');
const identityTemplate = read('src/pages/identity/index.wxml');
const profileTemplate = read('src/components/profile-panel/index.wxml');
const identityStyles = read('src/styles/identity.wxss');
const profileStyles = read('src/components/profile-panel/index.wxss');
const appStyles = read('src/app.wxss')
  .replace(/@import[^;]+;/gu, '')
  .replace(/\bpage(?=\s*\{)/gu, 'body');

// This is a browser layout proxy using the actual WXML/WXSS, not Skyline/device evidence.
// Host defaults deliberately stress width/margins/line-height so local resets stay observable.
const primitiveStyles = `
  html, body { margin: 0; height: 100%; }
  view, scroll-view { display: block; }
  block { display: contents; }
  scroll-view { overflow-y: auto; }
  input { border: 0; outline: 0; box-sizing: border-box; }
  button { display: block; width: auto; min-width: 184px; margin: 0 auto; padding: 0 14px;
    font: inherit; line-height: 2.55555556; text-align: center; }
`;
const tokens = read('../../packages/ui-tokens/src/tokens.wxss').replace(
  /\bpage(?=\s*\{)/gu,
  ':root',
);

function fragment(source) {
  return JSDOM.fragment(source.replace(/<image\b([^>]*?)\/>/gsu, '<img$1>'));
}

function profileFixture({ bindingLabel, avatarSyncLabel, avatar = false, large = false }) {
  const tree = fragment(profileTemplate);
  const card = tree.querySelector('.profile-account-card');
  const details = card.querySelector('.profile-details');
  const rows = [...details.children].filter((row) =>
    /微信小程序身份|微信头像|登录密码/u.test(row.textContent),
  );
  details.replaceChildren(...rows);
  rows.forEach((row, index) => row.setAttribute('data-row', String(index)));
  for (const node of card.querySelectorAll('[wx\\:if]')) {
    const condition = node.getAttribute('wx:if');
    if (
      (condition.includes('avatarPath') && !avatar) ||
      (condition.includes('canUnbindWechat') && !avatar) ||
      (condition.includes('bindingState') && bindingLabel !== '暂时无法读取')
    ) {
      node.remove();
    }
  }
  for (const button of card.querySelectorAll('button')) button.removeAttribute('disabled');
  const markup = `${card.outerHTML}${tree.querySelector('.profile-actions').outerHTML}`
    .replaceAll('{{bindingLabel}}', bindingLabel)
    .replaceAll('{{avatarSyncLabel}}', avatarSyncLabel);
  return `<view class="profile-page ${large ? 'is-large-text' : ''}">${markup}</view>`;
}

function loginFixture(error = false) {
  const tree = fragment(identityTemplate);
  const page = tree.querySelector('.identity-page');
  page.className = 'identity-page is-login';
  const card = tree.querySelector('.identity-card');
  card.className = 'identity-card identity-login-card';
  for (const block of [...tree.querySelectorAll('block')]) {
    if (block.getAttribute('wx:if') !== "{{mode === 'login'}}") block.remove();
  }
  for (const node of [...page.children]) {
    if (node.hasAttribute('wx:else')) node.remove();
  }
  const alert = card.querySelector('ui-alert');
  if (error) alert.textContent = '无法继续：账号或密码不正确，请检查后重试。';
  else alert.remove();
  const primary = card.querySelector('ui-button');
  const primaryTree = fragment(read('src/components/ui/ui-button/index.wxml'));
  primaryTree.querySelector('.ui-button').className = 'ui-button ui-button--primary';
  primaryTree.querySelector('.ui-button__loading').remove();
  primaryTree.querySelector('.ui-button__label').textContent = primary.getAttribute('label');
  primary.append(primaryTree);
  const wechat = card.querySelector('profile-avatar-login-button');
  const wechatTree = fragment(read('src/components/profile-avatar-login-button/index.wxml'));
  const wechatButton = wechatTree.querySelector('button');
  wechatButton.className = 'profile-avatar-login-button';
  wechatButton.removeAttribute('disabled');
  wechatTree.querySelector('.profile-avatar-login-button__loading').remove();
  wechatTree.querySelector('text').textContent = wechat.getAttribute('label');
  wechat.append(wechatTree);
  for (const input of tree.querySelectorAll('input')) input.removeAttribute('value');
  for (const image of tree.querySelectorAll('img')) image.removeAttribute('src');
  tree.querySelector('.identity-login-build').textContent = 'layout-test · local';
  return tree.firstElementChild.outerHTML;
}

describe('Profile and identity layout contracts', () => {
  it('keeps account controls and native avatar/login event contracts', () => {
    const tree = fragment(identityTemplate);
    const inputs = [...tree.querySelectorAll('.identity-login-field__control')];
    expect(inputs.map((input) => input.getAttribute('bindinput'))).toEqual([
      'handleUsernameChange',
      'handlePasswordInput',
    ]);
    expect(inputs[0].getAttribute('maxlength')).toBe('64');
    expect(inputs[1].hasAttribute('password')).toBe(true);
    expect(inputs[1].getAttribute('bindconfirm')).toBe('handlePasswordLogin');
    expect(tree.querySelector('ui-button[label="进入工作台"]').getAttribute('bind:press')).toBe(
      'handlePasswordLogin',
    );
    expect(tree.querySelector('profile-avatar-login-button').getAttribute('bind:press')).toBe(
      'handleWechatLogin',
    );
    const avatar = fragment(read('src/components/profile-avatar-login-button/index.wxml'));
    expect(avatar.querySelector('button').getAttribute('open-type')).toBe('chooseAvatar');
    expect(avatar.querySelector('button').getAttribute('bindchooseavatar')).toBe(
      'handleChooseAvatar',
    );
    expect(avatar.querySelector('button').getAttribute('bindtap')).toBe('handlePress');
    const profile = fragment(profileTemplate);
    expect(profile.querySelector('.profile-password-action').getAttribute('bindtap')).toBe(
      'handlePasswordOpen',
    );
    expect(profile.querySelector('.profile-sign-out').getAttribute('bindtap')).toBe(
      'handleSignOut',
    );
  });

  it('gives fields and actions real block containers while keeping keyboard scrolling', () => {
    const tree = fragment(identityTemplate);
    const form = tree.querySelector('view.identity-login-form');
    expect(form?.querySelectorAll('input').length).toBe(2);
    const actions = tree.querySelector('view.identity-login-actions');
    expect(actions?.querySelector('ui-button[label="进入工作台"]')).not.toBeNull();
    expect(actions?.querySelector('profile-avatar-login-button')).not.toBeNull();
    expect(tree.querySelector('scroll-view.identity-scroll').hasAttribute('scroll-y')).toBe(true);
    const layoutRules =
      identityStyles.match(
        /\.identity-(?:scroll|login-(?:form|actions?|field)[^{]*)\s*\{[^}]*\}/gsu,
      ) ?? [];
    expect(layoutRules.join('\n')).not.toMatch(
      /(?:margin[\w-]*:\s*-|position:\s*(?:absolute|fixed)|overflow-y:\s*hidden)/u,
    );
  });
});

// Opt in explicitly: ordinary Mini test collection must not launch a browser or contend for I/O.
const browserPath = process.env.MINI_LAYOUT_BROWSER_PATH;

describe.skipIf(!browserPath)(
  'Profile/identity browser geometry proxy (not native acceptance)',
  () => {
    let browser;
    let browserServer;
    let page;
    let evidenceDirectory;
    const observations = [];
    beforeAll(async () => {
      expect(existsSync(browserPath)).toBe(true);
      const commonDirectory = execFileSync(
        'git',
        ['rev-parse', '--path-format=absolute', '--git-common-dir'],
        { cwd: appRoot, encoding: 'utf8' },
      ).trim();
      const canonicalRoot = path.dirname(commonDirectory);
      evidenceDirectory = path.resolve(process.env.MINI_LAYOUT_EVIDENCE_DIR);
      const runtimeRoot = path.join(canonicalRoot, 'runtime', 'codex');
      const relative = path.relative(runtimeRoot, evidenceDirectory);
      if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
        throw new Error(
          'MINI_LAYOUT_EVIDENCE_DIR must be a task directory under canonical runtime/codex',
        );
      }
      execFileSync(
        'git',
        ['check-ignore', '--quiet', path.relative(canonicalRoot, evidenceDirectory)],
        { cwd: canonicalRoot },
      );
      mkdirSync(evidenceDirectory, { recursive: true });
      browserServer = await chromium.launchServer({ executablePath: browserPath, headless: true });
      browser = await chromium.connect(browserServer.wsEndpoint());
      page = await browser.newPage();
    }, 30_000);
    afterAll(async () => {
      if (evidenceDirectory)
        writeFileSync(
          path.join(evidenceDirectory, 'geometry.json'),
          JSON.stringify(observations, null, 2),
        );
      // Dispose only this test-owned browser tree; graceful Browser.close can stall on Windows.
      // kill() waits for the owned process and its temporary directories to be cleaned up.
      await browserServer?.kill();
    }, 30_000);

    async function render(markup, styles, width) {
      await page.setViewportSize({ width, height: width === 844 ? 390 : 844 });
      await page.setContent(
        `<style>${primitiveStyles}${tokens}${appStyles}${styles}</style>${markup}`,
      );
    }

    for (const width of [320, 390, 393, 414, 844]) {
      it(`keeps profile status horizontal and buttons aligned at ${width}px, including large text`, async () => {
        for (const large of [false, true]) {
          for (const state of [
            { bindingLabel: '暂时无法读取', avatarSyncLabel: '未设置' },
            { bindingLabel: '已绑定', avatarSyncLabel: '已同步', avatar: true },
            { bindingLabel: '当前微信身份暂时无法读取', avatarSyncLabel: '本次头像暂时无法更新' },
          ]) {
            await render(profileFixture({ ...state, large }), profileStyles, width);
            const geometry = await page.evaluate(() => {
              const rect = (node) => node.getBoundingClientRect();
              const statuses = [...document.querySelectorAll('.profile-detail-action > text')].map(
                (node) => {
                  const box = rect(node);
                  const style = getComputedStyle(node);
                  const range = document.createRange();
                  range.selectNodeContents(node);
                  const lines = new Set(
                    [...range.getClientRects()].map((line) => Math.round(line.y)),
                  ).size;
                  return {
                    width: box.width,
                    right: box.right,
                    rowRight: rect(node.closest('.profile-detail-row')).right,
                    lines,
                    fontSize: parseFloat(style.fontSize),
                  };
                },
              );
              const buttons = [
                ...document.querySelectorAll('.profile-password-action, .profile-sign-out'),
              ].map((node) => {
                const box = rect(node);
                const row = rect(node.parentElement);
                const range = document.createRange();
                range.selectNodeContents(node);
                const text = range.getBoundingClientRect();
                return {
                  rightGap: row.right - box.right,
                  outerCenter: (box.left + box.right - row.left - row.right) / 2,
                  textX: (text.left + text.right - box.left - box.right) / 2,
                  textY: (text.top + text.bottom - box.top - box.bottom) / 2,
                  width: box.width,
                  height: box.height,
                };
              });
              return {
                statuses,
                buttons,
                rows: [...document.querySelectorAll('.profile-detail-row')].map((row) => {
                  const label = rect(row.firstElementChild);
                  const value = rect(row.lastElementChild);
                  return {
                    leftGap: label.left - rect(row).left,
                    centerGap: (label.top + label.bottom - value.top - value.bottom) / 2,
                  };
                }),
                overflow: document.documentElement.scrollWidth > innerWidth,
              };
            });
            observations.push({
              surface: 'profile',
              width,
              height: width === 844 ? 390 : 844,
              large,
              ...state,
              geometry,
            });
            expect(geometry.overflow).toBe(false);
            for (const row of geometry.rows) {
              expect(Math.abs(row.leftGap)).toBeLessThanOrEqual(1);
              expect(Math.abs(row.centerGap)).toBeLessThanOrEqual(1);
            }
            if (state.bindingLabel.length <= 6) expect(geometry.statuses[0].lines).toBe(1);
            if (state.avatarSyncLabel.length <= 3) expect(geometry.statuses[1].lines).toBe(1);
            for (const status of geometry.statuses) {
              expect(status.lines).toBeLessThanOrEqual(2);
              expect(status.width).toBeGreaterThanOrEqual(status.fontSize * 3);
              expect(Math.abs(status.right - status.rowRight)).toBeLessThanOrEqual(1);
            }
            expect(Math.abs(geometry.buttons[0].rightGap)).toBeLessThanOrEqual(1);
            expect(Math.abs(geometry.buttons[1].outerCenter)).toBeLessThanOrEqual(1);
            // The approved native 414px screenshot has a 184px sign-out button.
            // Web's intrinsic content width is not the Mini width contract.
            expect(geometry.buttons[1].width).toBe(184);
            for (const button of geometry.buttons) {
              expect(button.height).toBeGreaterThanOrEqual(44);
              expect(Math.abs(button.textX)).toBeLessThanOrEqual(1);
              expect(Math.abs(button.textY)).toBeLessThanOrEqual(2);
            }
            if ((width === 390 && !large) || ([320, 393, 844].includes(width) && large)) {
              await page.screenshot({
                path: path.join(
                  evidenceDirectory,
                  `profile-${width}-${state.avatar ? 'avatar' : state.bindingLabel.length > 6 ? 'long' : 'error'}.png`,
                ),
              });
            }
          }
        }
      }, 30_000);

      it(`separates login fields/actions at ${width}px across focus, error, large text and keyboard-height changes`, async () => {
        const styles =
          identityStyles +
          read('src/components/ui/ui-button/index.wxss') +
          read('src/components/profile-avatar-login-button/index.wxss').replaceAll(
            ':host',
            'profile-avatar-login-button',
          );
        for (const large of [false, true]) {
          for (const error of [false, true]) {
            await render(loginFixture(error), styles, width);
            if (large)
              await page.addStyleTag({
                content: ':root { --ui-font-size-sm: 20px; --ui-font-size-md: 24px; }',
              });
            for (const focus of [null, '账号', '密码', null]) {
              const height = width === 844 ? (focus ? 220 : 390) : focus ? 420 : 844;
              await page.setViewportSize({ width, height });
              if (focus) await page.getByLabel(focus, { exact: true }).focus();
              else await page.evaluate(() => document.activeElement?.blur());
              const geometry = await page.evaluate(() => {
                const box = (selector) => document.querySelector(selector).getBoundingClientRect();
                const password = box(
                  '.identity-login-field--following .identity-login-field__shell',
                );
                const primary = box('.ui-button');
                const divider = box('.identity-divider');
                const wechat = box('.profile-avatar-login-button');
                const privacy = box('.identity-login-privacy');
                const scroll = document.querySelector('.identity-scroll');
                scroll.scrollTop = scroll.scrollHeight;
                return {
                  gap: primary.top - password.bottom,
                  dividerGap: divider.top - primary.bottom,
                  wechatGap: wechat.top - divider.bottom,
                  privacyGap: privacy.top - wechat.bottom,
                  overflow: document.documentElement.scrollWidth > innerWidth,
                  canScroll: scroll.scrollHeight <= scroll.clientHeight || scroll.scrollTop > 0,
                };
              });
              observations.push({ surface: 'login', width, height, large, error, focus, geometry });
              expect(geometry.overflow).toBe(false);
              // 3px focus ring still leaves a visible gap before the primary action.
              expect(geometry.gap).toBeGreaterThanOrEqual(16);
              expect(geometry.dividerGap).toBeGreaterThanOrEqual(12);
              expect(geometry.wechatGap).toBeGreaterThanOrEqual(12);
              expect(geometry.privacyGap).toBeGreaterThanOrEqual(12);
              expect(geometry.canScroll).toBe(true);
            }
            if (width === 390 || ([320, 393, 844].includes(width) && large)) {
              await page.evaluate(() => {
                document.querySelector('.identity-scroll').scrollTop = 0;
              });
              await page.screenshot({
                path: path.join(
                  evidenceDirectory,
                  `login-${width}-${large ? 'large' : 'normal'}-${error ? 'error' : 'ready'}.png`,
                ),
              });
            }
          }
        }
      }, 30_000);
    }
  },
);
