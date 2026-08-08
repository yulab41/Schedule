#!/usr/bin/env node
/**
 * 微信开发者工具 CLI 封装（仅本地开发使用，不进入 CI）
 *
 * 用法：
 *   pnpm miniprogram:devtools:open         打开小程序工程
 *   pnpm miniprogram:devtools:build-npm    构建 TDesign npm 依赖（生成 miniprogram_npm/）
 *   pnpm miniprogram:devtools:preview      编译并生成预览二维码（.tmp-miniprogram-preview/preview.png）
 *   pnpm miniprogram:devtools:auto-preview 编译并输出预览信息（信息写入 .tmp-miniprogram-preview/）
 *   pnpm miniprogram:devtools:auto         启用自动化（--trust-project）
 *   pnpm miniprogram:devtools close|quit   关闭工程 / 退出开发者工具
 *
 * 环境变量：
 *   WECHAT_DEVTOOLS_CLI   开发者工具 cli.bat 完整路径；缺省自动探测常见安装位置
 *
 * 退出码：0 成功；1 未找到 CLI；2 用法错误；其余为 cli.bat 自身退出码
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PROJECT_DIR, findCli, findServicePort, runCli } from './miniprogram-devtools-lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_DIR = path.join(ROOT, '.tmp-miniprogram-preview');

const COMMANDS = new Set([
  'open',
  'build-npm',
  'preview',
  'auto-preview',
  'auto',
  'close',
  'quit',
  'login',
  'islogin',
  'cache',
  'engine',
]);

function printUsage() {
  console.log(`用法：node scripts/miniprogram-devtools.mjs <命令> [cli.bat 参数]

命令：
  ${[...COMMANDS].join('\n  ')}

示例：
  node scripts/miniprogram-devtools.mjs open
  node scripts/miniprogram-devtools.mjs build-npm
  node scripts/miniprogram-devtools.mjs preview
  node scripts/miniprogram-devtools.mjs auto-preview
  node scripts/miniprogram-devtools.mjs auto --trust-project
`);
}

function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printUsage();
    return;
  }

  const command = process.argv[2];
  if (!command || !COMMANDS.has(command)) {
    console.error(`[miniprogram-devtools] 未知命令：${command ?? '(空)'}`);
    printUsage();
    process.exit(2);
  }

  const cli = findCli();
  if (!cli) {
    console.error(
      '[miniprogram-devtools] 未找到微信开发者工具 cli.bat，' +
        '请安装开发者工具或将 WECHAT_DEVTOOLS_CLI 指向 cli.bat 完整路径。',
    );
    process.exit(1);
  }

  mkdirSync(OUTPUT_DIR, { recursive: true });

  const args = [];
  const passthrough = process.argv.slice(3);

  if (!['login', 'islogin', 'quit'].includes(command)) {
    args.push('--project', PROJECT_DIR);
  }

  if (command === 'preview' && !passthrough.some((arg) => arg === '-o' || arg === '--qr-output')) {
    args.push('-f', 'image', '-o', path.join(OUTPUT_DIR, 'preview.png'));
  }
  if (
    command === 'auto-preview' &&
    !passthrough.some((arg) => arg === '-i' || arg === '--info-output')
  ) {
    args.push('--info-output', path.join(OUTPUT_DIR, 'auto-preview.json'));
  }
  if (command === 'auto' && !passthrough.includes('--trust-project')) {
    args.push('--trust-project');
  }
  if (!['quit'].includes(command) && !passthrough.some((arg) => arg === '--port')) {
    const servicePort = findServicePort();
    if (servicePort !== null) {
      args.push('--port', String(servicePort));
    } else {
      console.warn(
        '[miniprogram-devtools] 未在开发者工具配置中发现已开启的服务端口，' +
          '请先在 设置 → 安全设置 中开启“服务端口”，或手动传入 --port <端口>。',
      );
    }
  }
  args.push(...passthrough);

  console.log(`[miniprogram-devtools] CLI：${cli}`);
  console.log(`[miniprogram-devtools] 项目：${PROJECT_DIR}`);
  console.log(`[miniprogram-devtools] 执行：cli.bat ${[command, ...args].join(' ')}`);

  const result = runCli(command, args);
  if (result.error) {
    console.error(`[miniprogram-devtools] 启动失败：${result.error.message}`);
    process.exit(1);
  }
  process.exit(result.status ?? 1);
}

main();
