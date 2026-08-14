#!/usr/bin/env node
/**
 * 浏览器冒烟验证 + 核心链路改动强制校验
 *
 * 用法：
 *   pnpm smoke:browser                运行冒烟流程（登录/管理员/成员/访客/工作台）
 *   pnpm smoke:browser --check-core   校验“核心链路改动必须已记录冒烟验证”（不启动浏览器）
 *   pnpm smoke:browser --help
 *
 * 环境变量：
 *   SMOKE_BASE_URL        Web 地址，默认 http://localhost:5173
 *   SMOKE_BROWSER_PATH    浏览器可执行文件路径；缺省自动探测 Edge/Chrome
 *   SMOKE_SCREENSHOT_DIR  截图目录；缺省使用系统临时目录
 *
 * 退出码：0 成功；1 冒烟失败；2 核心链路校验未通过；3 环境/用法错误
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE_URL = (process.env.SMOKE_BASE_URL ?? 'http://localhost:5173').replace(/\/$/, '');
const SCREENSHOT_DIR =
  process.env.SMOKE_SCREENSHOT_DIR ?? fs.mkdtempSync(path.join(os.tmpdir(), 'schedule-smoke-'));

const CORE_PATTERNS = [
  /^apps\/web\/src\/api\//,
  /^apps\/web\/src\/auth\//,
  /^apps\/web\/src\/router\//,
  /^apps\/web\/src\/pwa\//,
  /^apps\/web\/src\/stores\/session\.ts$/,
  /^apps\/web\/src\/App\.vue$/,
  /^apps\/web\/src\/main\.ts$/,
  /^apps\/web\/src\/layouts\//,
  /^packages\/contracts\/src\//,
  /^apps\/web\/vite\.config\.ts$/,
  /^\.env\.example$/,
];

const RECORD_FILES = [
  'fix-progress.md',
  'docs/debug/debug-feedback-log.md',
  'docs/project-status.md',
];

function step(label) {
  console.log(`\n[smoke] ${label}`);
}

function fail(message, code = 1) {
  console.error(`[smoke] 失败：${message}`);
  process.exit(code);
}

function gitOutput(args) {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' })
      .split(/\r?\n/)
      .filter(Boolean);
  } catch {
    return [];
  }
}

function findBrowserExecutable() {
  const explicit = process.env.SMOKE_BROWSER_PATH;
  if (explicit !== undefined && explicit.length > 0) {
    if (!fs.existsSync(explicit)) fail(`SMOKE_BROWSER_PATH 不存在：${explicit}`, 3);
    return explicit;
  }

  const candidates = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/microsoft-edge',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  fail('未找到可用的 Edge/Chrome。请安装浏览器，或通过 SMOKE_BROWSER_PATH 指定可执行文件路径。', 3);
}

async function waitForBodyText(page, text, timeoutMs = 20000, label = text) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const body = await page
      .locator('body')
      .innerText()
      .catch(() => '');
    if (body.includes(text)) return;
    await page.waitForTimeout(250);
  }
  fail(`等待超时：未看到“${label}”（当前 URL: ${page.url()}）`);
}

async function waitForUrl(page, predicate, timeoutMs = 15000, label = '') {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate(page.url())) return;
    await page.waitForTimeout(250);
  }
  fail(`等待超时：URL 未满足“${label}”（当前: ${page.url()}）`);
}

function attachErrorCollector(page, errors) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`[console.error] ${msg.text()}`);
  });
  page.on('pageerror', (err) => errors.push(`[pageerror] ${err.message}`));
  page.on('requestfailed', (req) =>
    errors.push(
      `[requestfailed] ${req.method()} ${req.url()} -> ${req.failure()?.errorText ?? 'unknown'}`,
    ),
  );
}

function assertNoErrors(errors, phase) {
  if (errors.length === 0) return;
  fail(`${phase} 出现浏览器错误：\n${errors.join('\n')}`);
}

async function assertTDesignTheme(page) {
  const theme = await page.evaluate(() => {
    const brand = getComputedStyle(document.documentElement)
      .getPropertyValue('--td-brand-color')
      .trim();
    const button = document.querySelector('.t-button--variant-base.t-button--theme-primary');
    if (button === null) {
      return { brand, background: null, height: null };
    }
    const style = getComputedStyle(button);
    return { brand, background: style.backgroundColor, height: style.height };
  });

  if (theme.brand.length === 0) {
    fail('TDesign 基础主题变量缺失（--td-brand-color 为空），页面外观会失效。');
  }
  if (
    theme.background === null ||
    theme.background === 'rgba(0, 0, 0, 0)' ||
    theme.background === 'transparent'
  ) {
    fail('登录页 TDesign 主按钮未应用主题背景色，外观回归。');
  }
  if (theme.height === null || Number.parseFloat(theme.height) < 28) {
    fail('登录页 TDesign 主按钮高度异常，外观回归。');
  }
}

async function assertResponsiveLoginShell(page) {
  for (const { height, width } of [
    { height: 900, width: 1280 },
    { height: 844, width: 390 },
    { height: 844, width: 320 },
  ]) {
    await page.setViewportSize({ height, width });
    await page.waitForTimeout(150);
    const result = await page.evaluate(() => {
      const controls = [
        ...document.querySelectorAll('.auth-mode-switch button, .auth-submit, .guest-entry'),
      ];
      return {
        overflow: document.documentElement.scrollWidth > window.innerWidth,
        smallControls: controls
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            return rect.width < 44 || rect.height < 44;
          })
          .map((element) => element.textContent?.trim() ?? element.tagName),
      };
    });

    if (result.overflow) fail(`${width}px 登录页出现横向溢出。`);
    if (result.smallControls.length > 0) {
      fail(`${width}px 登录页存在小于 44px 的关键点触目标：${result.smallControls.join('、')}`);
    }
  }

  await page.setViewportSize({ height: 900, width: 1280 });
}

async function assertResponsiveWorkbenchShell(page) {
  for (const width of [390, 320]) {
    await page.setViewportSize({ height: 844, width });
    await page.waitForTimeout(200);
    const result = await page.evaluate(() => {
      const nav = document.querySelector('.workbench-bottom-nav');
      const panels = document.querySelector('.workbench-panels');
      const navButtons = [...document.querySelectorAll('.workbench-bottom-nav button')];
      return {
        bottomPadding: Number.parseFloat(
          panels === null ? '0' : getComputedStyle(panels).paddingBottom,
        ),
        navBottom: nav?.getBoundingClientRect().bottom ?? 0,
        navButtons: navButtons.length,
        navHeight: nav?.getBoundingClientRect().height ?? 0,
        overflow: document.documentElement.scrollWidth > window.innerWidth,
        smallNavButtons: navButtons
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            return rect.width < 44 || rect.height < 44;
          })
          .map((element) => element.textContent?.trim() ?? ''),
      };
    });

    if (result.overflow) fail(`${width}px 工作台出现横向溢出。`);
    if (result.navButtons !== 5) fail(`${width}px 工作台未保留四个主入口与“更多”。`);
    if (result.smallNavButtons.length > 0) {
      fail(`${width}px 底栏存在小于 44px 的点触目标：${result.smallNavButtons.join('、')}`);
    }
    if (result.navHeight < 70 || Math.abs(result.navBottom - 844) > 1) {
      fail(`${width}px 底栏未正确贴合手机底部安全区。`);
    }
    if (result.bottomPadding < result.navHeight) {
      fail(`${width}px 工作台内容没有为固定底栏预留空间。`);
    }

    await page.locator('.workbench-bottom-nav button', { hasText: '更多' }).click();
    const sheet = page.locator('dialog[open][aria-label="更多功能"]');
    await sheet.waitFor({ state: 'visible', timeout: 5000 });
    const sheetText = await sheet.innerText();
    if (!sheetText.includes('群组与排班') || !sheetText.includes('账号')) {
      fail(`${width}px “更多”底部页缺少功能或账号分组。`);
    }
    if (!sheetText.includes('退出登录')) fail(`${width}px 退出登录未放入账号分组。`);
    await sheet.locator('button[aria-label="关闭"]').click();
  }

  await page.setViewportSize({ height: 900, width: 1280 });
  await page.waitForTimeout(150);
}

async function assertManualScheduleDenseInteractions(page) {
  await page.locator('.workbench-sidebar button', { hasText: '手动排班' }).first().click();
  await waitForBodyText(page, '手动排班模板', 15000, '手动排班模板');
  const dateInput = page.locator('input[type="date"]').first();
  await dateInput.waitFor({ state: 'visible', timeout: 15000 });
  const actual = await dateInput.inputValue();
  const expected = await page.evaluate(() => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      day: '2-digit',
      month: '2-digit',
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
    }).formatToParts(new Date());
    const part = (type) => parts.find((item) => item.type === type)?.value ?? '';
    return `${part('year')}-${part('month')}-${part('day')}`;
  });
  if (actual !== expected) {
    fail(`手动排班开始日期默认值应为今天 ${expected}，实际为 ${actual}。`);
  }

  const roleSelect = page.locator('.editor-config .t-select').nth(1);
  await roleSelect.click();
  const roleOption = page.locator('.t-select-option:visible').first();
  await roleOption.waitFor({ state: 'visible', timeout: 5000 });
  await roleOption.click();
  const memberCheckboxes = page.locator('.member-selector input[type="checkbox"]');
  const memberCount = await memberCheckboxes.count();
  if (memberCount === 0) fail('手动排班岗位没有可用于矩阵验收的成员。');
  for (let index = 0; index < memberCount; index += 1) {
    await memberCheckboxes.nth(index).check();
  }
  await page.locator('.editor-config input[type="number"]').fill('31');
  const gridFrame = page.locator('.manual-grid-frame');
  await gridFrame.waitFor({ state: 'visible', timeout: 5000 });

  for (const { height, width } of [
    { height: 900, width: 1280 },
    { height: 844, width: 390 },
    { height: 844, width: 320 },
  ]) {
    await page.setViewportSize({ height, width });
    await page.waitForTimeout(250);
    await gridFrame.scrollIntoViewIfNeeded();
    const scroll = gridFrame.locator('.manual-grid-scroll');
    const firstCell = gridFrame.locator('.template-cell-button').first();
    const metrics = await gridFrame.evaluate((element) => {
      const scrollElement = element.querySelector('.manual-grid-scroll');
      const guide = element.querySelector('.manual-grid-guide');
      const firstButton = element.querySelector('.template-cell-button');
      const firstMember = element.querySelector('.member-name');
      const dateHeader = element.querySelector('.date-header');
      const clearActions = element.parentElement?.querySelector('.clear-actions');
      if (
        scrollElement === null ||
        guide === null ||
        firstButton === null ||
        firstMember === null ||
        dateHeader === null
      ) {
        return undefined;
      }
      const buttonRect = firstButton.getBoundingClientRect();
      const guideRect = guide.getBoundingClientRect();
      const touchControls = [
        ...document.querySelectorAll(
          '.member-selector label, .shift-palette button, .clear-actions .t-button, .template-actions .t-button',
        ),
      ].filter((control) => {
        const rect = control.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      return {
        buttonHeight: buttonRect.height,
        buttonWidth: buttonRect.width,
        clientWidth: scrollElement.clientWidth,
        clearActionsOverflow:
          clearActions !== null && clearActions !== undefined
            ? clearActions.scrollWidth > clearActions.clientWidth
            : true,
        dateHeaderPosition: getComputedStyle(dateHeader).position,
        guideHeight: guideRect.height,
        guideText: guide.textContent ?? '',
        memberLeft: firstMember.getBoundingClientRect().left,
        memberPosition: getComputedStyle(firstMember).position,
        overflow: document.documentElement.scrollWidth > window.innerWidth,
        scrollWidth: scrollElement.scrollWidth,
        smallControls: touchControls
          .filter((control) => {
            const rect = control.getBoundingClientRect();
            return rect.width < 44 || rect.height < 44;
          })
          .map((control) => control.textContent?.trim() || control.tagName),
      };
    });
    if (metrics === undefined) fail(`${width}px 手动排班矩阵结构不完整。`);
    if (metrics.overflow) fail(`${width}px 手动排班页面出现横向溢出。`);
    if (metrics.clearActionsOverflow) fail(`${width}px 手动排班清空操作发生横向溢出。`);
    if (metrics.scrollWidth <= metrics.clientWidth) fail(`${width}px 手动排班矩阵未保留横向滚动。`);
    if (!metrics.guideText.includes('滑动') || !metrics.guideText.includes('人员列保持固定')) {
      fail(`${width}px 手动排班矩阵缺少明确的横滑/固定列提示。`);
    }
    if (metrics.guideHeight < 44) fail(`${width}px 手动排班横滑提示高度小于 44px。`);
    if (metrics.buttonHeight < 44 || metrics.buttonWidth < 44) {
      fail(`${width}px 手动排班单元格点触目标小于 44px。`);
    }
    if (metrics.smallControls.length > 0) {
      fail(`${width}px 手动排班存在小于 44px 的控件：${metrics.smallControls.join('、')}`);
    }
    if (metrics.memberPosition !== 'sticky' || metrics.dateHeaderPosition !== 'sticky') {
      fail(`${width}px 手动排班矩阵未固定人员列或日期表头。`);
    }

    await scroll.evaluate((element) => {
      element.scrollLeft = Math.min(360, element.scrollWidth - element.clientWidth);
      element.dispatchEvent(new Event('scroll'));
    });
    await page.waitForTimeout(150);
    const scrolled = await gridFrame.evaluate((element) => {
      const member = element.querySelector('.member-name');
      const progress = element.querySelector('.scroll-progress');
      return {
        guideText: element.querySelector('.manual-grid-guide')?.textContent ?? '',
        memberLeft: member?.getBoundingClientRect().left,
        progress: Number(progress?.getAttribute('aria-valuenow') ?? '0'),
      };
    });
    if (Math.abs((scrolled.memberLeft ?? metrics.memberLeft) - metrics.memberLeft) > 1) {
      fail(`${width}px 手动排班人员首列在横滑后没有保持固定。`);
    }
    if (scrolled.progress <= 0 || !scrolled.guideText.includes('左右滑动')) {
      fail(`${width}px 手动排班横滑进度或方向提示未随滚动更新。`);
    }

    await scroll.evaluate((element) => {
      element.scrollLeft = 0;
      element.dispatchEvent(new Event('scroll'));
    });
    await firstCell.click();
    if ((await firstCell.getAttribute('aria-pressed')) !== 'true') {
      fail(`${width}px 手动排班单元格点选后缺少选中反馈。`);
    }
    await firstCell.click();

    await scroll.evaluate((element) => {
      element.scrollLeft = Math.min(360, element.scrollWidth - element.clientWidth);
      element.dispatchEvent(new Event('scroll'));
    });
    await page.screenshot({
      path: path.join(
        SCREENSHOT_DIR,
        width === 1280
          ? '10-admin-desktop-manual-grid.png'
          : `10-admin-mobile-manual-grid-${width}.png`,
      ),
    });
  }

  await page.setViewportSize({ height: 900, width: 1280 });
}

async function assertLeaveWorkflowMobile(page) {
  await page.setViewportSize({ height: 900, width: 1280 });
  await page.locator('.workbench-sidebar button', { hasText: '请假' }).first().click();
  await waitForBodyText(page, '请假与审批', 15000, '请假与审批');

  for (const width of [390, 320]) {
    await page.setViewportSize({ height: 844, width });
    await page.waitForTimeout(200);
    await page.locator('.mobile-workflow-tabs button', { hasText: '我的请假' }).click();
    const metrics = await page.evaluate(() => {
      const tabs = [...document.querySelectorAll('.mobile-workflow-tabs button')];
      const createButton = document.querySelector('#leave-create-button');
      const visibleSections = [...document.querySelectorAll('.workflow-section')].filter(
        (element) => getComputedStyle(element).display !== 'none',
      );
      const controls = [...tabs, ...(createButton === null ? [] : [createButton])];
      return {
        overflow: document.documentElement.scrollWidth > window.innerWidth,
        smallControls: controls
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            return rect.width < 44 || rect.height < 44;
          })
          .map((element) => element.textContent?.trim() ?? ''),
        tabCount: tabs.length,
        visibleSectionCount: visibleSections.length,
      };
    });

    if (metrics.overflow) fail(`${width}px 请假工作流出现页面横向溢出。`);
    if (metrics.tabCount !== 2) fail(`${width}px 请假页未显示“我的请假 / 待我审批”分段入口。`);
    if (metrics.visibleSectionCount !== 1) fail(`${width}px 请假页应只显示当前分段的卡片列表。`);
    if (metrics.smallControls.length > 0) {
      fail(`${width}px 请假页存在小于 44px 的关键点触目标：${metrics.smallControls.join('、')}`);
    }

    await page.locator('.mobile-workflow-tabs button', { hasText: '待我审批' }).click();
    const visibleReviewSections = await page
      .locator('.mobile-review-content:not(.mobile-tab-hidden)')
      .count();
    if (visibleReviewSections < 2) fail(`${width}px 待审批分段未显示策略与审批卡片。`);

    await page.locator('#leave-create-button').click();
    const formSheet = page.locator('dialog[open][aria-label="新建请假"]');
    await formSheet.waitFor({ state: 'visible', timeout: 5000 });
    const sheetText = await formSheet.innerText();
    if (!sheetText.includes('请假类型') || !sheetText.includes('提交请假')) {
      fail(`${width}px 新建请假底部页缺少表单内容。`);
    }
    const sheetMetrics = await formSheet.evaluate((element) => {
      const controls = [
        ...element.querySelectorAll(
          'button, input:not(.t-input__inner), textarea, .t-input, .t-select',
        ),
      ].filter((control) => {
        const rect = control.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      return {
        dateInputs: element.querySelectorAll('input[type="date"]').length,
        smallControls: controls
          .filter((control) => {
            const rect = control.getBoundingClientRect();
            return rect.width < 44 || rect.height < 44;
          })
          .map(
            (control) =>
              control.textContent?.trim() || control.getAttribute('aria-label') || control.tagName,
          ),
      };
    });
    if (sheetMetrics.dateInputs !== 2) fail(`${width}px 新建请假底部页缺少起止日期。`);
    if (sheetMetrics.smallControls.length > 0) {
      fail(
        `${width}px 新建请假底部页存在小于 44px 的控件：${sheetMetrics.smallControls.join('、')}`,
      );
    }

    if (width === 390) {
      await page.screenshot({
        fullPage: true,
        path: path.join(SCREENSHOT_DIR, '3-admin-mobile-leave-sheet.png'),
      });
    }
    await formSheet.locator('button[aria-label="关闭"]').click();
  }

  await page.setViewportSize({ height: 900, width: 1280 });
  await page.locator('.workbench-sidebar button', { hasText: '排班日历' }).first().click();
  await waitForBodyText(page, '排班日历', 10000);
}

async function assertWorkflowSheetTouchTargets(sheet, width, label) {
  await sheet.page().waitForTimeout(350);
  const metrics = await sheet.evaluate((element) => {
    const sheetRect = element.getBoundingClientRect();
    const controls = [
      ...element.querySelectorAll(
        'button, input:not(.t-input__inner), textarea, summary, .t-input, .t-select',
      ),
    ].filter((control) => {
      const rect = control.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    return {
      bottom: sheetRect.bottom,
      smallControls: controls
        .filter((control) => {
          const rect = control.getBoundingClientRect();
          return rect.width < 44 || rect.height < 44;
        })
        .map(
          (control) =>
            control.textContent?.trim() || control.getAttribute('aria-label') || control.tagName,
        ),
      top: sheetRect.top,
      viewportHeight: window.innerHeight,
    };
  });
  if (metrics.top < -1 || metrics.bottom > metrics.viewportHeight + 1) {
    fail(
      `${width}px ${label}超出可视区：top=${metrics.top}，bottom=${metrics.bottom}，viewport=${metrics.viewportHeight}。`,
    );
  }
  if (metrics.smallControls.length > 0) {
    fail(`${width}px ${label}存在小于 44px 的控件：${metrics.smallControls.join('、')}`);
  }
}

async function assertShiftWorkflowsMobile(page) {
  await page.setViewportSize({ height: 900, width: 1280 });
  await page.locator('.workbench-sidebar button', { hasText: '换班' }).first().click();
  await waitForBodyText(page, '交换双方已发布班次', 15000, '换班');

  for (const width of [390, 320]) {
    await page.setViewportSize({ height: 844, width });
    await page.waitForTimeout(200);
    const pageMetrics = await page.evaluate(() => {
      const buttons = [
        document.querySelector('#swap-create-button'),
        document.querySelector('#swap-admin-create-button'),
      ].filter((element) => element !== null);
      const card = document.querySelector('.workflow-table .workflow-card');
      return {
        cardDisplay: card === null ? undefined : getComputedStyle(card).display,
        overflow: document.documentElement.scrollWidth > window.innerWidth,
        smallButtons: buttons
          .filter((button) => {
            const rect = button.getBoundingClientRect();
            return rect.width < 44 || rect.height < 44;
          })
          .map((button) => button.textContent?.trim() ?? ''),
      };
    });
    if (pageMetrics.overflow) fail(`${width}px 换班工作流出现页面横向溢出。`);
    if (pageMetrics.cardDisplay !== undefined && pageMetrics.cardDisplay !== 'grid') {
      fail(`${width}px 换班记录未切换为移动卡片。`);
    }
    if (pageMetrics.smallButtons.length > 0) {
      fail(`${width}px 换班页存在小于 44px 的关键按钮：${pageMetrics.smallButtons.join('、')}`);
    }

    await page.locator('#swap-create-button').click();
    const requestSheet = page.locator('dialog[open][aria-label="发起换班"]');
    await requestSheet.waitFor({ state: 'visible', timeout: 5000 });
    const requestText = await requestSheet.innerText();
    if (!requestText.includes('我的班次') || !requestText.includes('提交换班')) {
      fail(`${width}px 发起换班底部页缺少表单内容。`);
    }
    await assertWorkflowSheetTouchTargets(requestSheet, width, '发起换班底部页');
    if (width === 390) {
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '4-admin-mobile-swap-sheet.png') });
    }
    await requestSheet.locator('button[aria-label="关闭"]').click();

    await page.locator('#swap-admin-create-button').click();
    const adminSheet = page.locator('dialog[open][aria-label="管理员直接换班"]');
    await adminSheet.waitFor({ state: 'visible', timeout: 5000 });
    const adminText = await adminSheet.innerText();
    if (!adminText.includes('成员一') || !adminText.includes('直接执行换班')) {
      fail(`${width}px 管理员直接换班底部页缺少表单内容。`);
    }
    await assertWorkflowSheetTouchTargets(adminSheet, width, '管理员直接换班底部页');
    await adminSheet.locator('button[aria-label="关闭"]').click();
  }

  await page.setViewportSize({ height: 900, width: 1280 });
  await page.locator('.workbench-sidebar button', { hasText: '加扣班' }).first().click();
  await waitForBodyText(page, '安排成员代值已发布班次', 15000, '加扣班');

  for (const width of [390, 320]) {
    await page.setViewportSize({ height: 844, width });
    await page.waitForTimeout(200);
    const pageMetrics = await page.evaluate(() => {
      const buttons = [
        document.querySelector('#duty-create-button'),
        document.querySelector('#duty-admin-create-button'),
      ].filter((element) => element !== null);
      const card = document.querySelector('.workflow-table .workflow-card');
      return {
        cardDisplay: card === null ? undefined : getComputedStyle(card).display,
        overflow: document.documentElement.scrollWidth > window.innerWidth,
        smallButtons: buttons
          .filter((button) => {
            const rect = button.getBoundingClientRect();
            return rect.width < 44 || rect.height < 44;
          })
          .map((button) => button.textContent?.trim() ?? ''),
      };
    });
    if (pageMetrics.overflow) fail(`${width}px 加扣班工作流出现页面横向溢出。`);
    if (pageMetrics.cardDisplay !== undefined && pageMetrics.cardDisplay !== 'grid') {
      fail(`${width}px 加扣班记录未切换为移动卡片。`);
    }
    if (pageMetrics.smallButtons.length > 0) {
      fail(`${width}px 加扣班页存在小于 44px 的关键按钮：${pageMetrics.smallButtons.join('、')}`);
    }

    await page.locator('#duty-create-button').click();
    const requestSheet = page.locator('dialog[open][aria-label="发起加扣班"]');
    await requestSheet.waitFor({ state: 'visible', timeout: 5000 });
    const requestText = await requestSheet.innerText();
    if (!requestText.includes('我的班次') || !requestText.includes('提交申请')) {
      fail(`${width}px 发起加扣班底部页缺少表单内容。`);
    }
    await assertWorkflowSheetTouchTargets(requestSheet, width, '发起加扣班底部页');
    if (width === 390) {
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '5-admin-mobile-duty-sheet.png') });
    }
    await requestSheet.locator('button[aria-label="关闭"]').click();

    await page.locator('#duty-admin-create-button').click();
    const adminSheet = page.locator('dialog[open][aria-label="管理员直接代值"]');
    await adminSheet.waitFor({ state: 'visible', timeout: 5000 });
    const adminText = await adminSheet.innerText();
    if (!adminText.includes('被代班班次') || !adminText.includes('直接代值')) {
      fail(`${width}px 管理员直接代值底部页缺少表单内容。`);
    }
    await assertWorkflowSheetTouchTargets(adminSheet, width, '管理员直接代值底部页');
    await adminSheet.locator('button[aria-label="关闭"]').click();
  }

  await page.setViewportSize({ height: 900, width: 1280 });
  await page.locator('.workbench-sidebar button', { hasText: '排班日历' }).first().click();
  await waitForBodyText(page, '排班日历', 10000);
}

async function assertWeekendCalendarHighlight(page) {
  const weekdayHeader = page.locator('.weekday-row span.is-weekend').first();
  await weekdayHeader.waitFor({ state: 'visible', timeout: 15000 });
  const headerColor = await weekdayHeader.evaluate((element) => getComputedStyle(element).color);
  if (headerColor !== 'rgb(224, 49, 49)') {
    fail(`日历顶部“六/日”列名未使用偏大红，当前颜色：${headerColor}。`);
  }
  const weekendNumber = page.locator('.day-cell.is-weekend .day-number').first();
  await weekendNumber.waitFor({ state: 'visible', timeout: 15000 });
  const color = await weekendNumber.evaluate((element) => getComputedStyle(element).color);
  if (color !== 'rgb(224, 49, 49)') {
    fail(`周末日期未使用偏大红，当前颜色：${color}。`);
  }
  const todayNumber = page.locator('.day-cell.is-today .day-number').first();
  await todayNumber.waitFor({ state: 'visible', timeout: 15000 });
  const todayBackground = await todayNumber.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  );
  if (todayBackground !== 'rgb(245, 197, 24)') {
    fail(`今天圆形标记未使用金黄色，当前背景：${todayBackground}。`);
  }
}

async function assertMonthCalendarInteractions(page) {
  await page.setViewportSize({ height: 844, width: 390 });
  const swipeSurface = page.locator('.month-swipe-surface');
  await swipeSurface.waitFor({ state: 'visible', timeout: 15000 });

  const filterTrigger = page.locator('.mobile-filter-trigger');
  await filterTrigger.click();
  const filterSheet = page.locator('dialog[open][aria-label="筛选排班"]');
  await filterSheet.waitFor({ state: 'visible', timeout: 5000 });
  const filterSheetText = await filterSheet.innerText();
  if (!filterSheetText.includes('只看有变更的班次') || !filterSheetText.includes('查看结果')) {
    fail('手机筛选底部页缺少筛选项或结果操作。');
  }
  const smallFilterActions = await filterSheet.locator('button').evaluateAll((buttons) =>
    buttons
      .filter((button) => {
        const rect = button.getBoundingClientRect();
        return rect.width < 44 || rect.height < 44;
      })
      .map((button) => button.textContent?.trim() ?? button.getAttribute('aria-label') ?? ''),
  );
  if (smallFilterActions.length > 0) {
    fail(`手机筛选底部页存在小于 44px 的按钮：${smallFilterActions.join('、')}`);
  }
  await filterSheet.locator('button[aria-label="关闭"]').click();

  const selectedButtons = page.locator('.day-select-button[aria-pressed="true"]');
  if ((await selectedButtons.count()) !== 1) {
    fail('手机月历应始终只有一个选中日期。');
  }

  const expectedToday = await page.evaluate(() => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      day: '2-digit',
      month: '2-digit',
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
    }).formatToParts(new Date());
    const part = (type) => parts.find((item) => item.type === type)?.value ?? '';
    return `${part('year')}-${part('month')}-${part('day')}`;
  });
  const initialSelectedLabel = await selectedButtons.first().getAttribute('aria-label');
  if (!initialSelectedLabel?.startsWith(expectedToday)) {
    fail(`当前月份默认选中日期应为今天 ${expectedToday}，实际为 ${initialSelectedLabel ?? '无'}。`);
  }

  const anotherDate = page.locator('.day-select-button[aria-pressed="false"]').first();
  const anotherLabel = await anotherDate.getAttribute('aria-label');
  await anotherDate.click();
  const changedSelectedLabel = await selectedButtons.first().getAttribute('aria-label');
  if (changedSelectedLabel !== anotherLabel) {
    fail('点触月格后选中日期未更新。');
  }

  const dutyDetails = page.locator('.selected-date-details');
  await dutyDetails.waitFor({ state: 'visible', timeout: 5000 });
  const dutyDetailsText = await dutyDetails.innerText();
  if (!dutyDetailsText.includes('选中日期') || !dutyDetailsText.includes('个班次')) {
    fail('选中日期下方缺少完整值班详情轨道。');
  }
  if ((await dutyDetails.locator('.track-event').count()) === 0) {
    fail('有排班的选中日期未显示班次轨道卡片。');
  }

  for (const width of [390, 320]) {
    await page.setViewportSize({ height: 844, width });
    await page.waitForTimeout(100);
    const detailMetrics = await dutyDetails.evaluate((element) => {
      const actions = [...element.querySelectorAll('.phone-action, .event-action')];
      return {
        overflow: document.documentElement.scrollWidth > window.innerWidth,
        smallActions: actions
          .filter((action) => {
            const rect = action.getBoundingClientRect();
            return rect.width < 44 || rect.height < 44;
          })
          .map((action) => action.textContent?.trim() ?? ''),
      };
    });
    if (detailMetrics.overflow) fail(`${width}px 值班详情出现横向溢出。`);
    if (detailMetrics.smallActions.length > 0) {
      fail(`${width}px 值班详情存在小于 44px 的操作：${detailMetrics.smallActions.join('、')}`);
    }
  }

  await page.setViewportSize({ height: 844, width: 390 });
  const eventAction = dutyDetails.locator('.event-action').first();
  await eventAction.click();
  const eventSheet = page.locator('dialog[open][aria-label="班次事件记录"]');
  await eventSheet.waitFor({ state: 'visible', timeout: 5000 });
  await waitForBodyText(page, '班次事件记录', 10000);
  if (!(await eventSheet.innerText()).includes('事件记录')) {
    fail('班次事件响应式 Sheet 未显示事件记录内容。');
  }
  await eventSheet.locator('button[aria-label="关闭"]').click();

  await page.screenshot({
    fullPage: true,
    path: path.join(SCREENSHOT_DIR, '2-admin-mobile-calendar.png'),
  });

  const monthLabel = page.locator('.month-navigation strong').first();
  const initialMonth = (await monthLabel.innerText()).trim();
  await swipeSurface.evaluate((element) => element.scrollIntoView({ block: 'center' }));
  const bounds = await swipeSurface.boundingBox();
  if (bounds === null) fail('无法取得月历横滑区域。');

  const startX = bounds.x + bounds.width * 0.78;
  const startY = bounds.y + Math.min(160, bounds.height * 0.4);
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX - 80, startY + 10, { steps: 4 });
  await page.mouse.up();
  await page.waitForFunction(
    ({ selector, value }) => document.querySelector(selector)?.textContent?.trim() !== value,
    { selector: '.month-navigation strong', value: initialMonth },
    { timeout: 15000 },
  );
  const nextMonth = (await monthLabel.innerText()).trim();
  if (nextMonth === initialMonth) fail('清晰左滑后月份未切换。');

  await swipeSurface.evaluate((element) => element.scrollIntoView({ block: 'center' }));
  const nextBounds = await swipeSurface.boundingBox();
  if (nextBounds === null) fail('切换月份后无法取得月历横滑区域。');
  const verticalStartX = nextBounds.x + nextBounds.width * 0.7;
  const verticalStartY = nextBounds.y + Math.min(120, nextBounds.height * 0.3);
  await page.mouse.move(verticalStartX, verticalStartY);
  await page.mouse.down();
  await page.mouse.move(verticalStartX - 64, verticalStartY + 80, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(250);
  if ((await monthLabel.innerText()).trim() !== nextMonth) {
    fail('垂直位移占优时不应切换月份。');
  }

  await page.setViewportSize({ height: 900, width: 1280 });
}

async function assertBackfillCalendarColors(page) {
  await page.locator('.workbench-sidebar button', { hasText: '排班补录' }).first().click();
  await waitForBodyText(page, '排班补录', 15000, '排班补录');
  const weekendNumber = page
    .locator('.month-grid.invert-past-colors .day-cell.is-weekend .day-number')
    .first();
  await weekendNumber.waitFor({ state: 'visible', timeout: 15000 });
  const color = await weekendNumber.evaluate((element) => getComputedStyle(element).color);
  if (color !== 'rgb(224, 49, 49)') {
    fail(`补录日历周末日期未使用偏大红，当前颜色：${color}。`);
  }
  const todayNumber = page
    .locator('.month-grid.invert-past-colors .day-cell.is-today .day-number')
    .first();
  await todayNumber.waitFor({ state: 'visible', timeout: 15000 });
  const todayBackground = await todayNumber.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  );
  if (todayBackground !== 'rgb(245, 197, 24)') {
    fail(`补录日历今天圆形标记未使用金黄色，当前背景：${todayBackground}。`);
  }

  for (const { height, width } of [
    { height: 900, width: 1280 },
    { height: 844, width: 390 },
    { height: 844, width: 320 },
  ]) {
    await page.setViewportSize({ height, width });
    await page.waitForTimeout(200);
    const calendar = page.locator('.backfill-calendar');
    await calendar.evaluate((element) => element.scrollIntoView({ block: 'start' }));
    await page.waitForTimeout(150);
    const metrics = await page.evaluate(() => {
      const controls = [
        ...document.querySelectorAll(
          '.month-nav button, .month-input, .palette-button, .staged-item, .staged-actions button, .backfill-calendar .day-select-button',
        ),
      ].filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      const paintStatus = document.querySelector('.paint-status');
      return {
        paintStatusHeight: paintStatus?.getBoundingClientRect().height ?? 0,
        paintStatusText: paintStatus?.textContent ?? '',
        overflow: document.documentElement.scrollWidth > window.innerWidth,
        smallControls: controls
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            return rect.width < 44 || rect.height < 44;
          })
          .map(
            (element) => element.textContent?.trim() || element.getAttribute('aria-label') || '',
          ),
      };
    });
    if (metrics.overflow) fail(`${width}px 排班补录页面出现横向溢出。`);
    if (metrics.paintStatusHeight < 44 || !metrics.paintStatusText.includes('当前配班')) {
      fail(`${width}px 排班补录缺少清晰的当前配班状态。`);
    }
    if (metrics.smallControls.length > 0) {
      fail(`${width}px 排班补录存在小于 44px 的控件：${metrics.smallControls.join('、')}`);
    }

    const memberButton = page.locator('.member-button').first();
    if ((await memberButton.count()) > 0) {
      await memberButton.click();
      if ((await memberButton.getAttribute('aria-pressed')) !== 'true') {
        fail(`${width}px 排班补录成员按钮缺少选中反馈。`);
      }
      await memberButton.click();
    }
    await calendar.evaluate((element) => element.scrollIntoView({ block: 'start' }));
    await page.waitForTimeout(150);
    await page.screenshot({
      path: path.join(
        SCREENSHOT_DIR,
        width === 1280 ? '11-admin-desktop-backfill.png' : `11-admin-mobile-backfill-${width}.png`,
      ),
    });
  }

  await page.setViewportSize({ height: 900, width: 1280 });
}

async function assertGroupManagementAndEventNav(page) {
  await page.locator('.workbench-sidebar button', { hasText: '群组管理' }).first().click();
  await waitForBodyText(page, '加入其他群组', 15000, '加入其他群组');
  await waitForBodyText(page, '当前群组码：', 15000, '当前群组码');
  const groupCode = await page.locator('[data-testid="current-group-code"]').innerText();
  if (!/^当前群组码：\s*\d{4}$/u.test(groupCode.trim())) {
    fail(`当前群组码展示异常：${groupCode}`);
  }
  const initialGroupCode = groupCode.trim();
  const regenerateButton = page.locator('button', { hasText: '重新生成群组码' }).first();
  await regenerateButton.click();
  const updateDeadline = Date.now() + 15000;
  let updatedGroupCode = initialGroupCode;
  while (Date.now() < updateDeadline) {
    updatedGroupCode = (
      await page.locator('[data-testid="current-group-code"]').innerText()
    ).trim();
    if (updatedGroupCode !== initialGroupCode) break;
    await page.waitForTimeout(250);
  }
  if (!/^当前群组码：\s*\d{4}$/u.test(updatedGroupCode.trim())) {
    fail(`重新生成后的群组码展示异常：${updatedGroupCode}`);
  }
  const adminEventEntry = page.locator('.workbench-sidebar button', { hasText: '事件' }).first();
  await adminEventEntry.waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('.workbench-sidebar button', { hasText: '排班日历' }).first().click();
  await waitForBodyText(page, '排班日历', 10000);
}

async function assertMemberAndNotificationPages(page) {
  await page.locator('.workbench-sidebar button', { hasText: '成员' }).first().click();
  await waitForBodyText(page, '我的真实姓名', 15000, '成员身份表单');
  await page.locator('table').first().waitFor({ state: 'visible', timeout: 15000 });
  const memberBody = await page.locator('body').innerText();
  if (memberBody.includes('请求的资源不存在')) {
    fail('成员页仍返回“请求的资源不存在”，认领相关 API 未恢复。');
  }
  if (memberBody.includes('成员数据暂时无法加载')) {
    fail('成员页数据加载失败。');
  }

  for (const width of [390, 320]) {
    await page.setViewportSize({ height: 844, width });
    await page.waitForTimeout(200);
    await page.locator('.member-list-heading').scrollIntoViewIfNeeded();
    const metrics = await page.evaluate(() => {
      const card = document.querySelector('.member-table-wrap .member-card');
      const controls = [
        ...document.querySelectorAll(
          '.identity-form input, .identity-form button, .add-member-form textarea, .add-member-form button, .contact-edit-button, .mobile-member-actions button',
        ),
      ].filter((control) => {
        const rect = control.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      return {
        cardDisplay: card === null ? undefined : getComputedStyle(card).display,
        desktopActionsVisible: [...document.querySelectorAll('.desktop-member-actions')].some(
          (element) => getComputedStyle(element).display !== 'none',
        ),
        overflow: document.documentElement.scrollWidth > window.innerWidth,
        smallControls: controls
          .filter((control) => {
            const rect = control.getBoundingClientRect();
            return rect.width < 44 || rect.height < 44;
          })
          .map((control) => control.textContent?.trim() || control.tagName),
      };
    });
    if (metrics.overflow) fail(`${width}px 成员页出现横向溢出。`);
    if (metrics.cardDisplay !== 'grid') fail(`${width}px 成员名单未切换为移动卡片。`);
    if (metrics.desktopActionsVisible) fail(`${width}px 成员卡片仍显示桌面密集操作区。`);
    if (metrics.smallControls.length > 0) {
      fail(`${width}px 成员页存在小于 44px 的控件：${metrics.smallControls.join('、')}`);
    }

    const manageButton = page.locator('.member-manage-button:visible').first();
    if ((await manageButton.count()) === 0) fail(`${width}px 成员卡片缺少明确的管理入口。`);
    await manageButton.click();
    const manageSheet = page.locator('dialog[open][aria-label^="管理成员"]');
    await manageSheet.waitFor({ state: 'visible', timeout: 5000 });
    await assertWorkflowSheetTouchTargets(manageSheet, width, '成员管理底部页');
    if (width === 390) {
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, '6-admin-mobile-member-actions.png'),
      });
    }
    await manageSheet.locator('button[aria-label="关闭"]').click();

    const contactButton = page.locator('.contact-edit-button:visible').first();
    await contactButton.click();
    const contactSheet = page.locator('dialog[open][aria-label^="编辑"]');
    await contactSheet.waitFor({ state: 'visible', timeout: 5000 });
    const contactText = await contactSheet.innerText();
    if (!contactText.includes('长号') || !contactText.includes('短号')) {
      fail(`${width}px 联系方式底部页缺少长号或短号字段。`);
    }
    await assertWorkflowSheetTouchTargets(contactSheet, width, '联系方式底部页');
    await contactSheet.locator('button[aria-label="关闭"]').click();
  }

  await page.setViewportSize({ height: 900, width: 1280 });
  await page.locator('.workbench-sidebar button', { hasText: '事件' }).first().click();
  await waitForBodyText(page, '追踪排班变更', 15000, '事件中心');
  await waitForBodyText(page, '访客访问记录', 15000, '访客访问记录');

  for (const width of [390, 320]) {
    await page.setViewportSize({ height: 844, width });
    await page.waitForTimeout(200);
    const metrics = await page.evaluate(() => {
      const eventCard = document.querySelector('.event-table .event-card');
      const visitorCard = document.querySelector('.visitor-logs-table .visitor-log-card');
      const filterButton = document.querySelector('#event-filter-button');
      const filterRect = filterButton?.getBoundingClientRect();
      return {
        desktopFiltersVisible:
          getComputedStyle(document.querySelector('.desktop-event-filters')).display !== 'none',
        eventCardDisplay: eventCard === null ? undefined : getComputedStyle(eventCard).display,
        filterIsSmall: filterRect === undefined || filterRect.width < 44 || filterRect.height < 44,
        overflow: document.documentElement.scrollWidth > window.innerWidth,
        visitorCardDisplay:
          visitorCard === null ? undefined : getComputedStyle(visitorCard).display,
      };
    });
    if (metrics.overflow) fail(`${width}px 事件中心出现横向溢出。`);
    if (metrics.desktopFiltersVisible) fail(`${width}px 事件中心仍显示桌面筛选网格。`);
    if (metrics.eventCardDisplay !== undefined && metrics.eventCardDisplay !== 'grid') {
      fail(`${width}px 事件记录未切换为移动卡片。`);
    }
    if (metrics.visitorCardDisplay !== undefined && metrics.visitorCardDisplay !== 'grid') {
      fail(`${width}px 访客记录未切换为移动卡片。`);
    }
    if (metrics.filterIsSmall) fail(`${width}px 事件筛选入口小于 44px。`);

    await page.locator('#event-filter-button').click();
    const filterSheet = page.locator('dialog[open][aria-label="筛选事件"]');
    await filterSheet.waitFor({ state: 'visible', timeout: 5000 });
    const filterText = await filterSheet.innerText();
    if (!filterText.includes('开始时间') || !filterText.includes('事件类型')) {
      fail(`${width}px 事件筛选底部页缺少筛选字段。`);
    }
    await assertWorkflowSheetTouchTargets(filterSheet, width, '事件筛选底部页');
    if (width === 390) {
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '7-admin-mobile-event-filter.png') });
    }
    await filterSheet.locator('button[aria-label="关闭"]').click();

    const detailButton = page.locator('.event-actions button:visible').first();
    if ((await detailButton.count()) > 0) {
      await detailButton.click();
      const detailSheet = page.locator('dialog[open][aria-label="事件详情与关联链"]');
      await detailSheet.waitFor({ state: 'visible', timeout: 10000 });
      await assertWorkflowSheetTouchTargets(detailSheet, width, '事件详情底部页');
      if (width === 390) {
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, '8-admin-mobile-event-detail.png'),
        });
      }
      await detailSheet.locator('button[aria-label="关闭"]').click();
    }
  }

  await page.setViewportSize({ height: 900, width: 1280 });

  await page.locator('.workbench-sidebar button', { hasText: '通知' }).first().click();
  await waitForBodyText(page, '我的提醒', 15000, '通知设置');
  const notificationBody = await page.locator('body').innerText();
  if (notificationBody.includes('服务返回了无效资料')) {
    fail('通知页仍返回“服务返回了无效资料”，通知偏好响应契约不兼容。');
  }
  if (notificationBody.includes('通知设置暂时无法保存')) {
    fail('通知设置加载失败。');
  }

  await page.locator('.workbench-sidebar button', { hasText: '排班日历' }).first().click();
  await waitForBodyText(page, '排班日历', 10000);
}

async function runSmoke() {
  const browserPath = findBrowserExecutable();
  step(`浏览器：${browserPath}`);
  step(`目标：${BASE_URL}`);
  step(`截图目录：${SCREENSHOT_DIR}`);
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const browser = await chromium.launch({ executablePath: browserPath, headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  attachErrorCollector(page, errors);

  try {
    step('1/6 打开登录页');
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await waitForBodyText(page, '登录', 15000, '登录卡片');
    await assertTDesignTheme(page);
    await assertResponsiveLoginShell(page);
    const adminButton = page.locator('button', { hasText: '本地管理员' });
    const memberButton = page.locator('button', { hasText: '本地成员' });
    if ((await adminButton.count()) === 0 || (await memberButton.count()) === 0) {
      fail(
        '登录页没有“本地管理员/本地成员”按钮：请确认本地 Web 以 VITE_AUTH_DEV_MODE=true 启动（本地开发模式）。',
      );
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '1-login.png') });

    step('2/6 管理员模式进入工作台');
    await adminButton.first().click();
    await waitForUrl(page, (url) => new URL(url).pathname === '/', 20000, '工作台路径 /');
    await waitForBodyText(page, '排班工作台', 20000);
    await waitForBodyText(page, '排班日历', 15000);
    await waitForBodyText(page, '手动排班', 15000);
    assertNoErrors(errors, '管理员模式');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '2-admin.png') });
    await assertResponsiveWorkbenchShell(page);
    await assertWeekendCalendarHighlight(page);
    await assertMonthCalendarInteractions(page);
    await assertLeaveWorkflowMobile(page);
    await assertShiftWorkflowsMobile(page);
    await assertManualScheduleDenseInteractions(page);
    await assertBackfillCalendarColors(page);
    await assertGroupManagementAndEventNav(page);
    await assertMemberAndNotificationPages(page);
    assertNoErrors(errors, '成员与通知页面');

    step('3/6 退出管理员');
    await page.locator('button', { hasText: '退出登录' }).first().click();
    await waitForUrl(page, (url) => new URL(url).pathname === '/login', 15000, '回到登录页');
    await waitForBodyText(page, '本地管理员', 10000);

    step('4/6 成员模式进入工作台');
    await page.locator('button', { hasText: '本地成员' }).first().click();
    await waitForUrl(page, (url) => new URL(url).pathname === '/', 20000, '工作台路径 /');
    await waitForBodyText(page, '排班工作台', 20000);
    await waitForBodyText(page, '排班日历', 15000);
    const memberBody = await page.locator('body').innerText();
    if (memberBody.includes('手动排班') || memberBody.includes('排班配置')) {
      fail('成员模式不应出现管理员专属入口（手动排班/排班配置）。');
    }
    const memberEventCount = await page
      .locator('.workbench-sidebar button', { hasText: '事件' })
      .count();
    if (memberEventCount !== 0) {
      fail('成员模式不应出现“事件”导航入口。');
    }
    assertNoErrors(errors, '成员模式');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '3-member.png') });

    step('5/6 退出成员');
    await page.locator('button', { hasText: '退出登录' }).first().click();
    await waitForUrl(page, (url) => new URL(url).pathname === '/login', 15000, '回到登录页');
    await waitForBodyText(page, '访客查看排班', 10000);

    step('6/6 访客查看排班（仅扫码 vkey）');
    await page.locator('button', { hasText: '访客查看排班' }).first().click();
    await waitForUrl(page, (url) => new URL(url).pathname === '/guest', 15000, '访客路径 /guest');
    await waitForBodyText(page, '访客查看', 15000);
    await waitForBodyText(page, '请扫描群主或管理员分享的群组小程序码查看排班。', 15000);
    if ((await page.locator('.guest-group-list').count()) > 0) {
      fail('访客公开群组目录不应再出现。');
    }
    const guestBody = await page.locator('body').innerText();
    if (guestBody.includes('群组暂时无法加载') || guestBody.includes('排班暂时无法加载')) {
      fail('访客页面加载群组/排班失败。');
    }
    assertNoErrors(errors, '访客提示模式');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '4-guest.png') });

    const visitorKey = await readVisitorKeyFromDatabase();
    if (visitorKey === undefined) {
      fail('本地数据库未找到可用群组 visitor_key，无法验证访客 vkey 访问。');
    }
    await page.goto(`${BASE_URL}/guest?vkey=${visitorKey}`, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });
    await waitForBodyText(page, '访客查看', 15000);
    await page.locator('.month-grid').first().waitFor({ state: 'visible', timeout: 20000 });
    assertNoErrors(errors, '访客 vkey 模式');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '5-guest-vkey.png') });

    step('7/7 管理员查看访客访问记录');
    await page.locator('button', { hasText: '返回登录' }).first().click();
    await waitForUrl(page, (url) => new URL(url).pathname === '/login', 15000, '回到登录页');
    await waitForBodyText(page, '本地管理员', 10000);
    await page.locator('button', { hasText: '本地管理员' }).first().click();
    await waitForUrl(page, (url) => new URL(url).pathname === '/', 20000, '工作台路径 /');
    await waitForBodyText(page, '排班工作台', 20000);
    await page.locator('.workbench-sidebar button', { hasText: '事件' }).first().click();
    await waitForBodyText(page, '访客访问记录', 15000);
    await page
      .waitForFunction(
        () => document.querySelectorAll('.visitor-logs-table tbody tr').length >= 1,
        null,
        { timeout: 20000 },
      )
      .catch(() => fail('访客访问记录未显示最近访问'));
    await page.setViewportSize({ height: 844, width: 390 });
    await page.waitForTimeout(200);
    const visitorMetrics = await page.evaluate(() => {
      const card = document.querySelector('.visitor-logs-table .visitor-log-card');
      return {
        cardDisplay: card === null ? undefined : getComputedStyle(card).display,
        overflow: document.documentElement.scrollWidth > window.innerWidth,
      };
    });
    if (visitorMetrics.overflow) fail('390px 访客访问记录出现横向溢出。');
    if (visitorMetrics.cardDisplay !== 'grid') fail('390px 访客访问记录未切换为移动卡片。');
    await page.locator('.visitor-logs-section').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '9-admin-mobile-visitor-logs.png') });
    await page.setViewportSize({ height: 900, width: 1280 });
    assertNoErrors(errors, '访问记录');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '6-visitor-logs.png') });
  } finally {
    await browser.close();
  }

  step('冒烟通过：登录 / 管理员 / 成员 / 访客（目录下线 + vkey + 访问记录）全流程无浏览器错误');
}

async function readVisitorKeyFromDatabase() {
  const require = createRequire(path.join(ROOT, 'packages/database/package.json'));
  const mysql = require('mysql2/promise');
  const host = readDotEnvValue('MYSQL_HOST') ?? '127.0.0.1';
  const port = Number(readDotEnvValue('MYSQL_PORT') ?? '3306');
  const database = readDotEnvValue('MYSQL_DATABASE');
  const user = readDotEnvValue('MYSQL_USER');
  const password = readDotEnvValue('MYSQL_PASSWORD');
  if (database === undefined || user === undefined || password === undefined) {
    fail('读取本地 .env 的 MYSQL_* 失败，无法验证访客 vkey 访问。', 3);
  }

  const connection = await mysql.createConnection({ database, host, password, port, user });
  try {
    const [rows] = await connection.query(
      'SELECT visitor_key AS visitorKey FROM `groups` WHERE deleted_at IS NULL ORDER BY created_at LIMIT 1',
    );
    return rows[0]?.visitorKey;
  } finally {
    await connection.end();
  }
}

function readDotEnvValue(key) {
  const content = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.startsWith(`${key}=`)) {
      return trimmed.slice(key.length + 1).replace(/^["']|["']$/g, '');
    }
  }
  return undefined;
}

function checkCore() {
  step('核心链路改动强制校验');

  const porcelain = gitOutput(['status', '--porcelain']);
  const uncommitted = porcelain.map((line) => {
    let filePath = line.slice(3).trim();
    const arrow = filePath.indexOf(' -> ');
    if (arrow !== -1) filePath = filePath.slice(arrow + 4);
    return filePath.replace(/^"|"$/g, '');
  });

  const hasOriginMain = gitOutput(['rev-parse', '--verify', '--quiet', 'origin/main']).length > 0;
  const committed = hasOriginMain
    ? gitOutput(['diff', '--name-only', 'origin/main...HEAD'])
    : gitOutput(['diff', '--name-only', 'HEAD^', 'HEAD']);
  const changed = [...new Set([...uncommitted, ...committed])].filter(Boolean);
  const coreChanged = changed.filter((filePath) =>
    CORE_PATTERNS.some((pattern) => pattern.test(filePath.replace(/\\/g, '/'))),
  );

  if (coreChanged.length === 0) {
    step('未涉及核心链路文件，无需浏览器冒烟记录。');
    console.log(`[smoke] 变更文件：${changed.join(', ') || '（无）'}`);
    return;
  }

  const committedRecord = gitOutput(['diff', 'origin/main...HEAD', '--', ...RECORD_FILES]);
  const uncommittedRecord = gitOutput(['diff', '--', ...RECORD_FILES]);
  const recordLines = [...committedRecord, ...uncommittedRecord].filter(
    (line) => line.startsWith('+') && !line.startsWith('+++'),
  );
  const hasRecord = recordLines.some(
    (line) => line.includes('运行/浏览器验证') && line.includes('smoke:browser'),
  );

  console.log(`[smoke] 核心链路变更：${coreChanged.join(', ')}`);
  if (hasRecord) {
    step('已找到“运行/浏览器验证：pnpm smoke:browser”记录，校验通过。');
    return;
  }

  fail(
    '核心链路有改动，但 fix-progress.md / docs/debug/debug-feedback-log.md 未记录“运行/浏览器验证：pnpm smoke:browser …”及结果。' +
      '请先运行 pnpm smoke:browser，把命令与结果写入本轮记录后再提交（可运行 pnpm smoke:check-core 复核）。',
    2,
  );
}

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`用法：
  pnpm smoke:browser                运行冒烟流程（登录/管理员/成员/访客/工作台）
  pnpm smoke:browser --check-core   校验“核心链路改动必须已记录冒烟验证”

环境变量：
  SMOKE_BASE_URL        Web 地址，默认 http://localhost:5173
  SMOKE_BROWSER_PATH    浏览器可执行文件路径；缺省自动探测 Edge/Chrome
  SMOKE_SCREENSHOT_DIR  截图目录；缺省使用系统临时目录

退出码：0 成功；1 冒烟失败；2 核心链路校验未通过；3 环境/用法错误`);
  process.exit(0);
}

if (args.includes('--check-core')) {
  checkCore();
  process.exit(0);
}

if (args.length > 0) {
  fail(`未知参数：${args.join(' ')}（--help 查看用法）`, 3);
}

runSmoke().catch((error) => {
  console.error('[smoke] 未预期异常：', error);
  process.exit(1);
});
