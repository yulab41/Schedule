#!/usr/bin/env node
/**
 * 小程序模拟器冒烟（本地开发使用，不进入 CI）
 *
 * 前提：
 *   1. 微信开发者工具已启动，且 设置 → 安全设置 → 服务端口 已开启；
 *   2. 已执行过 pnpm miniprogram:devtools:build-npm。
 *
 * 行为：
 *   - 通过 CLI 启用自动化并连接模拟器；
 *   - 逐个打开 app.json 中注册的全部页面（tab 页 switchTab，其余 reLaunch）；
 *   - 每页截图到 .tmp-miniprogram-preview/screens/；
 *   - 收集控制台/异常输出，若出现脚本级错误则以退出码 1 结束。
 *
 * 环境变量：
 *   MINIPROGRAM_SMOKE_PORT 手动指定服务端口；缺省读取开发者工具配置
 */
import automator from 'miniprogram-automator';
import { mkdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PROJECT_DIR, findServicePort, runCli } from './miniprogram-devtools-lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCREENSHOT_DIR = path.join(ROOT, '.tmp-miniprogram-preview', 'screens');

const SCRIPT_ERROR_PATTERNS = [
  'ReferenceError',
  'TypeError',
  'SyntaxError',
  'is not defined',
  'Cannot read',
  'thirdScriptError',
  'UnhandledPromiseRejection',
  'Component is not found',
];

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

async function connectWithRetry(wsEndpoint, attempts = 6, delayMs = 2000) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await automator.connect({ wsEndpoint });
    } catch (error) {
      lastError = error;
      console.log(`[miniprogram-smoke] 连接尝试 ${attempt}/${attempts} 失败：${error.message}`);
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  throw lastError;
}

async function main() {
  const port = Number(process.env.MINIPROGRAM_SMOKE_PORT) || findServicePort() || 0;
  if (!port) {
    console.error('[miniprogram-smoke] 未发现已开启的服务端口，请先在 设置 → 安全设置 开启');
    process.exit(2);
  }

  const appJson = JSON.parse(readFileSync(path.join(PROJECT_DIR, 'app.json'), 'utf8'));
  const tabPages = new Set((appJson.tabBar?.list ?? []).map((tab) => tab.pagePath));
  const pages = appJson.pages;

  mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const autoPort = await getFreePort();
  console.log(`[miniprogram-smoke] 启用自动化：服务端口 ${port} / 自动化端口 ${autoPort}`);
  const autoResult = runCli('auto', [
    '--project',
    PROJECT_DIR,
    '--port',
    String(port),
    '--auto-port',
    String(autoPort),
    '--trust-project',
  ]);
  if (autoResult.status !== 0) {
    console.error('[miniprogram-smoke] 启用自动化失败');
    process.exit(autoResult.status ?? 1);
  }

  const miniProgram = await connectWithRetry(`ws://127.0.0.1:${autoPort}`);
  console.log('[miniprogram-smoke] 已连接模拟器');

  const consoleLogs = [];
  try {
    miniProgram.on('console', (log) => {
      consoleLogs.push({ type: log.type, text: log.text });
    });
    miniProgram.on('exception', (error) => {
      consoleLogs.push({
        type: 'exception',
        text: error?.stack ?? error?.message ?? String(error),
      });
    });
  } catch {
    // 旧版本 automator 无 app 级事件时忽略
  }

  try {
    const results = [];
    for (const route of pages) {
      const url = `/${route}`;
      if (tabPages.has(route)) {
        await miniProgram.switchTab(url);
      } else {
        await miniProgram.reLaunch(url);
      }
      const page = await miniProgram.currentPage();
      await page.waitFor(1200);
      const fileName = `${route.replaceAll('/', '_')}.png`;
      await miniProgram.screenshot({ path: path.join(SCREENSHOT_DIR, fileName) });
      results.push({ route, pagePath: page.path, screenshot: fileName });
      console.log(`[miniprogram-smoke] OK ${route} -> ${page.path}`);
    }

    const scriptErrors = consoleLogs.filter((log) =>
      SCRIPT_ERROR_PATTERNS.some((pattern) => String(log.text ?? '').includes(pattern)),
    );
    if (scriptErrors.length > 0) {
      console.error('[miniprogram-smoke] 检测到脚本级错误：');
      for (const error of scriptErrors) {
        console.error(`  [${error.type}] ${error.text}`);
      }
      process.exitCode = 1;
    } else {
      console.log(`[miniprogram-smoke] 全部 ${pages.length} 个页面打开成功，无脚本级错误`);
      console.log(`[miniprogram-smoke] 截图目录：${SCREENSHOT_DIR}`);
    }
    console.log(`[miniprogram-smoke] 控制台消息 ${consoleLogs.length} 条（含网络/业务日志）`);
  } finally {
    // 只断开自动化连接，不关闭开发者工具的项目窗口（close() 会发 Tool.close）。
    miniProgram.disconnect();
  }
}

main().catch((error) => {
  console.error('[miniprogram-smoke] 执行失败：', error);
  process.exit(1);
});
