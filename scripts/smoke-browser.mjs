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
  for (const width of [390, 320]) {
    await page.setViewportSize({ height: 844, width });
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
    await assertManualScheduleDefaultStartDate(page);
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
