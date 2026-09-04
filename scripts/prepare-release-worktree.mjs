/**
 * Prepare one persistent detached worktree for exact-commit release builds.
 *
 * The worktree is isolated under runtime/ inside the repository, while its ignored
 * node_modules directory survives commit changes. Dependencies are never installed
 * by this helper; a matching healthy environment is required before a release build.
 *
 * Usage:
 *   node scripts/prepare-release-worktree.mjs
 *   node scripts/prepare-release-worktree.mjs --commit <ref> --path <absolute-path>
 */

/* global console, process */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  PNPM_INSTALL_ARGUMENTS as SHARED_PNPM_INSTALL_ARGUMENTS,
  ensureWorktreeDependencies,
} from './codex/worktree-deps-core.mjs';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const SCRIPT_CHECKOUT_ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');

function resolveCanonicalProjectHome() {
  const result = spawnSync('git', ['-C', SCRIPT_CHECKOUT_ROOT, 'rev-parse', '--git-common-dir'], {
    cwd: SCRIPT_CHECKOUT_ROOT,
    encoding: 'utf8',
    windowsHide: true,
  });
  if (result.error || result.status !== 0 || !result.stdout.trim()) {
    fail('无法从 Git common directory 解析 canonical project home。');
  }
  const commonDirectory = path.isAbsolute(result.stdout.trim())
    ? path.resolve(result.stdout.trim())
    : path.resolve(SCRIPT_CHECKOUT_ROOT, result.stdout.trim());
  return path.dirname(commonDirectory);
}

const ROOT = resolveCanonicalProjectHome();
const DEPENDENCY_MARKER = 'schedule-release-dependencies.json';
export const RELEASE_RUNTIME_ROOT = path.join(ROOT, 'runtime');
export const DEFAULT_RELEASE_WORKTREE_PATH = path.join(ROOT, 'runtime', 'release-worktree');
export const PNPM_INSTALL_ARGUMENTS = SHARED_PNPM_INSTALL_ARGUMENTS;

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

export function collectDependencyInputs(trackedFiles) {
  return trackedFiles
    .map((file) => file.replaceAll('\\', '/'))
    .filter((file) => {
      const basename = path.posix.basename(file);
      return (
        basename === 'package.json' ||
        file === '.npmrc' ||
        file === '.pnpmfile.cjs' ||
        file === 'pnpm-lock.yaml' ||
        file === 'pnpm-workspace.yaml' ||
        file === 'pnpm-workspace.yml' ||
        file === 'pnpmfile.cjs' ||
        file.startsWith('patches/')
      );
    })
    .sort();
}

export function computeDependencyFingerprint(root, relativePaths) {
  const hash = crypto.createHash('sha256');
  for (const relativePath of [...relativePaths].sort()) {
    hash.update(relativePath);
    hash.update('\0');
    hash.update(fs.readFileSync(path.join(root, relativePath)));
    hash.update('\0');
  }
  return hash.digest('hex');
}

export function shouldReuseDependencies(worktreeRoot, stateDirectory, fingerprint) {
  if (!fs.existsSync(path.join(worktreeRoot, 'node_modules'))) return false;
  try {
    const markerPath = path.join(stateDirectory, DEPENDENCY_MARKER);
    const marker = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
    return marker.fingerprint === fingerprint;
  } catch {
    return false;
  }
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
    fail(
      `TASK_STATUS=BLOCKED_NO_REUSABLE_DEPENDENCY_ENV\nDEPENDENCIES_REUSED=false\nINSTALL_INVOKED=false\nWORKTREE_CREATED=false\nNo existing warm release worktree is registered: ${target}`,
    );
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

function trackedDependencyInputs(worktreeRoot) {
  const source = git(['ls-files', '-z'], { cwd: worktreeRoot }).stdout;
  return collectDependencyInputs(source.split('\0').filter(Boolean));
}

export function resolvePnpmInvocation(
  environment = process.env,
  platform = process.platform,
  nodeExecutable = process.execPath,
) {
  const explicitCli = environment.npm_execpath;
  if (explicitCli !== undefined && fs.existsSync(explicitCli)) {
    return { argumentsPrefix: [explicitCli], command: nodeExecutable };
  }

  if (platform === 'win32') {
    const candidates = [
      environment.APPDATA === undefined
        ? undefined
        : path.join(environment.APPDATA, 'npm', 'node_modules', 'pnpm', 'bin', 'pnpm.mjs'),
      path.join(path.dirname(nodeExecutable), 'node_modules', 'pnpm', 'bin', 'pnpm.mjs'),
      path.join(path.dirname(nodeExecutable), 'node_modules', 'corepack', 'dist', 'pnpm.js'),
    ];
    const cliPath = candidates.find(
      (candidate) => candidate !== undefined && fs.existsSync(candidate),
    );
    if (cliPath === undefined) {
      fail('找不到可直接交给 Node 执行的 pnpm JavaScript 入口。');
    }
    return { argumentsPrefix: [cliPath], command: nodeExecutable };
  }

  return { argumentsPrefix: [], command: 'pnpm' };
}

export function stripPnpmBuildPlaceholders(source) {
  return source.replace(
    /^[ \t]+(?:'[^'\r\n]+'|"[^"\r\n]+"|[^:\r\n]+): set this to true or false\r?\n/gmu,
    '',
  );
}

export function main(arguments_ = process.argv.slice(2)) {
  const options = parseArguments(arguments_);
  const target = options.worktreePath ?? DEFAULT_RELEASE_WORKTREE_PATH;
  assertSafeTarget(target);

  const commit = resolveCommit(options.commit);
  const created = prepareRegisteredWorktree(target, commit);
  const dependencyState = ensureWorktreeDependencies({
    worktree: target,
    mode: 'ReuseOnly',
    adoptHealthyExisting: true,
    json: options.json,
  });
  if (dependencyState.taskStatus !== 'READY_REUSE' || !dependencyState.dependenciesReused) {
    fail(
      [
        `TASK_STATUS=${dependencyState.taskStatus}`,
        'DEPENDENCIES_REUSED=false',
        'INSTALL_INVOKED=false',
        'WORKTREE_CREATED=false',
        ...(dependencyState.reasons ?? []).map((reason) => `INVALIDATION_REASON=${reason}`),
      ].join('\n'),
    );
  }
  assertCleanWorktree(target);

  const result = {
    commit,
    created,
    dependencies: 'reused',
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
