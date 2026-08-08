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

async function assertManualScheduleDefaultStartDate(page) {
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
}

async function assertWeekendCalendarHighlight(page) {
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
    await assertWeekendCalendarHighlight(page);
    await assertManualScheduleDefaultStartDate(page);
    await assertBackfillCalendarColors(page);

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
    assertNoErrors(errors, '成员模式');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '3-member.png') });

    step('5/6 退出成员');
    await page.locator('button', { hasText: '退出登录' }).first().click();
    await waitForUrl(page, (url) => new URL(url).pathname === '/login', 15000, '回到登录页');
    await waitForBodyText(page, '访客查看排班', 10000);

    step('6/6 访客查看排班');
    await page.locator('button', { hasText: '访客查看排班' }).first().click();
    await waitForUrl(page, (url) => new URL(url).pathname === '/guest', 15000, '访客路径 /guest');
    await waitForBodyText(page, '访客查看', 15000);
    await page
      .waitForFunction(
        () => {
          const list = document.querySelector('.guest-group-list');
          if (list === null) return false;
          return (
            list.querySelectorAll('button').length > 0 ||
            list.textContent?.includes('暂无可查看的群组') === true
          );
        },
        null,
        { timeout: 20000 },
      )
      .catch(() => fail('访客群组列表未加载'));
    const guestBody = await page.locator('body').innerText();
    if (guestBody.includes('群组暂时无法加载') || guestBody.includes('排班暂时无法加载')) {
      fail('访客页面加载群组/排班失败。');
    }
    assertNoErrors(errors, '访客模式');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '4-guest.png') });
  } finally {
    await browser.close();
  }

  step('冒烟通过：登录 / 管理员 / 成员 / 访客全流程无浏览器错误');
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
