/**
 * 微信开发者工具 CLI 探测与调用的共享工具（仅本地开发使用）
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PROJECT_DIR = path.join(ROOT, 'apps', 'miniprogram');

const SETTINGS_FILE_NAME = 'localstorage_b72da75d79277d2f5f9c30c9177be57e.json';

const CANDIDATE_CLI_PATHS = [
  process.env.WECHAT_DEVTOOLS_CLI,
  'C:\\Program Files (x86)\\Tencent\\微信web开发者工具\\cli.bat',
  'C:\\Program Files\\Tencent\\微信开发者工具\\cli.bat',
  'C:\\Program Files (x86)\\Tencent\\微信开发者工具\\cli.bat',
  'C:\\Program Files\\Tencent\\微信web开发者工具\\cli.bat',
  path.join(process.env.LOCALAPPDATA ?? '', 'Programs', '微信开发者工具', 'cli.bat'),
].filter(Boolean);

export function findCli() {
  return CANDIDATE_CLI_PATHS.find((candidate) => existsSync(candidate));
}

export function findServicePort() {
  const userDataRoot = process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, '微信开发者工具', 'User Data')
    : null;
  if (!userDataRoot || !existsSync(userDataRoot)) {
    return null;
  }
  for (const profile of readdirSync(userDataRoot, { withFileTypes: true })) {
    if (!profile.isDirectory()) {
      continue;
    }
    const settingsFile = path.join(
      userDataRoot,
      profile.name,
      'WeappLocalData',
      SETTINGS_FILE_NAME,
    );
    if (!existsSync(settingsFile)) {
      continue;
    }
    try {
      const settings = JSON.parse(readFileSync(settingsFile, 'utf8'));
      const port = settings?.security?.port;
      if (settings?.security?.enableServicePort === true && Number.isInteger(port)) {
        return port;
      }
    } catch {
      // 配置损坏时跳过该 profile
    }
  }
  return null;
}

function quoteArg(arg) {
  return /[\s"]/.test(arg) ? `"${arg.replace(/"/g, '\\"')}"` : arg;
}

export function runCli(command, args = [], { stdio = 'inherit' } = {}) {
  const cli = findCli();
  if (!cli) {
    console.error(
      '[miniprogram-devtools] 未找到微信开发者工具 cli.bat，请设置 WECHAT_DEVTOOLS_CLI',
    );
    return { status: 1 };
  }
  const commandLine = [quoteArg(cli), quoteArg(command), ...args.map(quoteArg)].join(' ');
  const result =
    process.platform === 'win32'
      ? spawnSync('cmd.exe', ['/d', '/s', '/c', `"${commandLine}"`], {
          stdio,
          windowsVerbatimArguments: true,
        })
      : spawnSync(cli, [command, ...args], { stdio });
  return { status: result.status ?? 1, error: result.error };
}
