/**
 * Prepare one persistent detached worktree for exact-commit release builds.
 *
 * The worktree is isolated under runtime/ inside the repository, while its ignored
 * node_modules directory survives commit changes. Dependencies are installed
 * only when the complete environment fingerprint misses or health fails.
 *
 * Usage:
 *   node scripts/prepare-release-worktree.mjs
 *   node scripts/prepare-release-worktree.mjs --commit <ref> --path <absolute-path>
 */

/* global console, process */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { installCurrentDependencyEnvironmentIfNeeded } from './dependency-environment.mjs';

export {
  PNPM_INSTALL_ARGUMENTS,
  collectDependencyInputs,
  computeDependencyFingerprint,
  resolvePnpmInvocation,
  stripPnpmBuildPlaceholders,
} from './dependency-environment.mjs';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');
export const RELEASE_RUNTIME_ROOT = path.join(ROOT, 'runtime');
export const DEFAULT_RELEASE_WORKTREE_PATH = path.join(ROOT, 'runtime', 'release-worktree');

function fail(message) {
  throw new Error(`[release:worktree] ${message}`);
}

export function parseArguments(arguments_) {
  const result = { commit: 'HEAD', json: false, worktreePath: undefined };

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === '--json') {
      result.json = true;
      continue;
    }
    if (argument === '--commit' || argument === '--path') {
      const value = arguments_[index + 1];
      if (value === undefined || value.startsWith('--')) {
        fail(`${argument} 缺少值。`);
      }
      if (argument === '--commit') result.commit = value;
      else result.worktreePath = path.resolve(value);
      index += 1;
      continue;
    }
    fail(`未知参数：${argument}`);
  }

  return result;
}

export function parseWorktreeList(source) {
  const entries = [];
  let current;

  for (const line of source.split(/\r?\n/u)) {
    if (line.startsWith('worktree ')) {
      if (current !== undefined) entries.push(current);
      current = {
        branch: undefined,
        detached: false,
        head: '',
        path: path.normalize(line.slice('worktree '.length)),
      };
      continue;
    }
    if (current === undefined) continue;
    if (line.startsWith('HEAD ')) current.head = line.slice('HEAD '.length);
    else if (line.startsWith('branch ')) current.branch = line.slice('branch '.length);
    else if (line === 'detached') current.detached = true;
  }

  if (current !== undefined) entries.push(current);
  return entries;
}

function run(command, arguments_, options = {}) {
  const result = spawnSync(command, arguments_, {
    cwd: options.cwd ?? ROOT,
    encoding: options.encoding ?? 'utf8',
    env: options.env ?? process.env,
    stdio: options.stdio ?? ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0 && options.allowFailure !== true) {
    const detail = `${result.stderr ?? ''}${result.stdout ?? ''}`.trim();
    fail(`${command} ${arguments_.join(' ')} 失败${detail === '' ? '' : `：${detail}`}`);
  }
  return result;
}

function git(arguments_, options = {}) {
  return run('git', arguments_, options);
}

function canonicalPath(value) {
  const resolved = path.resolve(value);
  return process.platform === 'win32' ? resolved.toLocaleLowerCase('en-US') : resolved;
}

export function assertSafeTarget(target) {
  const runtimeRoot = canonicalPath(RELEASE_RUNTIME_ROOT);
  const candidate = canonicalPath(target);
  const relativeFromRuntime = path.relative(runtimeRoot, candidate);

  if (
    candidate === runtimeRoot ||
    relativeFromRuntime.startsWith('..') ||
    path.isAbsolute(relativeFromRuntime)
  ) {
    fail('发布 worktree 必须位于仓库 runtime 子目录内，不能使用项目外路径。');
  }

  if (fs.existsSync(RELEASE_RUNTIME_ROOT) && fs.lstatSync(RELEASE_RUNTIME_ROOT).isSymbolicLink()) {
    fail('仓库 runtime/ 不得是符号链接或目录联接。');
  }
  let current = RELEASE_RUNTIME_ROOT;
  for (const segment of relativeFromRuntime.split(path.sep)) {
    current = path.join(current, segment);
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) {
      fail(`发布 worktree 路径不得穿过符号链接或目录联接：${current}`);
    }
  }
}

function resolveCommit(reference) {
  return git(['rev-parse', '--verify', `${reference}^{commit}`]).stdout.trim();
}

function assertCleanWorktree(worktreeRoot) {
  const unstagedClean =
    git(['diff', '--quiet', '--exit-code'], { allowFailure: true, cwd: worktreeRoot }).status === 0;
  const stagedClean =
    git(['diff', '--cached', '--quiet', '--exit-code'], {
      allowFailure: true,
      cwd: worktreeRoot,
    }).status === 0;
  const untracked = git(['ls-files', '--others', '--exclude-standard'], {
    cwd: worktreeRoot,
  }).stdout.trim();
  if (!unstagedClean || !stagedClean || untracked !== '') {
    const detail = git(['status', '--short'], { cwd: worktreeRoot }).stdout.trim();
    fail(`复用目录存在未提交或未忽略内容，已停止以免覆盖：${worktreeRoot}\n${detail}`);
  }
}

function prepareRegisteredWorktree(target, commit) {
  const registered = parseWorktreeList(git(['worktree', 'list', '--porcelain']).stdout);
  const entry = registered.find(
    (candidate) => canonicalPath(candidate.path) === canonicalPath(target),
  );

  if (entry === undefined) {
    if (fs.existsSync(target)) {
      fail(`目标目录已存在但不是本仓库登记的 worktree，拒绝接管：${target}`);
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    git(['worktree', 'add', '--detach', target, commit], { stdio: 'inherit' });
    return true;
  }

  if (!entry.detached || entry.branch !== undefined) {
    fail(`目标 worktree 挂载了分支，拒绝将用户分支改作发布目录：${target}`);
  }
  if (!fs.existsSync(target)) {
    fail(`Git 仍登记发布 worktree，但目录不存在；请先人工执行 git worktree repair：${target}`);
  }

  assertCleanWorktree(target);
  // Content/index/untracked checks above prove there is no user work to lose. Force only the
  // tracked checkout so stat-only CRLF→LF noise cannot block the managed worktree; ignored
  // node_modules and release caches remain intact.
  git(['checkout', '--force', '--detach', commit], { cwd: target });
  assertCleanWorktree(target);
  return false;
}

export function main(arguments_ = process.argv.slice(2)) {
  const options = parseArguments(arguments_);
  const target = options.worktreePath ?? DEFAULT_RELEASE_WORKTREE_PATH;
  assertSafeTarget(target);

  const commit = resolveCommit(options.commit);
  const created = prepareRegisteredWorktree(target, commit);
  const dependencyResult = installCurrentDependencyEnvironmentIfNeeded(target);
  assertCleanWorktree(target);

  const result = {
    commit,
    created,
    dependencies: dependencyResult.action,
    path: target,
  };
  if (options.json) console.log(JSON.stringify(result));
  else {
    console.log(`[release:worktree] commit: ${commit}`);
    console.log(`[release:worktree] path: ${target}`);
    console.log(`[release:worktree] dependencies: ${result.dependencies}`);
  }
  return result;
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
