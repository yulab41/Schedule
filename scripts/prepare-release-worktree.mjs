/**
 * Prepare one persistent detached worktree for exact-commit release builds.
 *
 * The worktree is isolated from the developer checkout, while its ignored
 * node_modules directory survives commit changes. Dependencies are installed
 * only when their tracked inputs change.
 *
 * Usage:
 *   node scripts/prepare-release-worktree.mjs
 *   node scripts/prepare-release-worktree.mjs --commit <ref> --path <absolute-path>
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');
const DEPENDENCY_MARKER = 'schedule-release-dependencies.json';
export const PNPM_INSTALL_ARGUMENTS = [
  'install',
  '--frozen-lockfile',
  '--config.strictDepBuilds=false',
];

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

export function shouldReuseDependencies(worktreeRoot, gitDirectory, fingerprint) {
  if (!fs.existsSync(path.join(worktreeRoot, 'node_modules'))) return false;
  try {
    const marker = JSON.parse(fs.readFileSync(path.join(gitDirectory, DEPENDENCY_MARKER), 'utf8'));
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

function assertSafeTarget(target) {
  const root = canonicalPath(ROOT);
  const candidate = canonicalPath(target);
  const relativeFromRoot = path.relative(root, candidate);
  const relativeToRoot = path.relative(candidate, root);

  if (
    candidate === root ||
    (!relativeFromRoot.startsWith('..') && !path.isAbsolute(relativeFromRoot)) ||
    (!relativeToRoot.startsWith('..') && !path.isAbsolute(relativeToRoot))
  ) {
    fail('发布 worktree 必须是仓库外的独立兄弟目录，不能是仓库本身、其子目录或父目录。');
  }
}

function resolveCommit(reference) {
  return git(['rev-parse', '--verify', `${reference}^{commit}`]).stdout.trim();
}

function assertCleanWorktree(worktreeRoot) {
  const status = git(['status', '--porcelain=v1', '--untracked-files=all'], {
    cwd: worktreeRoot,
  }).stdout.trim();
  if (status !== '') {
    fail(`复用目录存在未提交或未忽略内容，已停止以免覆盖：${worktreeRoot}\n${status}`);
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
  git(['checkout', '--detach', commit], { cwd: target });
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

function restorePnpmWorkspaceAfterInstall(workspacePath, original) {
  const current = fs.readFileSync(workspacePath);
  if (current.equals(original)) return;
  const stripped = stripPnpmBuildPlaceholders(current.toString('utf8'));
  const normalize = (value) => value.replaceAll('\r\n', '\n');
  if (normalize(stripped) !== normalize(original.toString('utf8'))) {
    fail('pnpm install 修改了 build-review 占位值以外的 workspace 配置，拒绝自动恢复。');
  }
  fs.writeFileSync(workspacePath, original);
}

function runPnpmInstall(worktreeRoot) {
  const environment = { ...process.env, CI: 'true' };
  const invocation = resolvePnpmInvocation(environment);
  const workspacePath = path.join(worktreeRoot, 'pnpm-workspace.yaml');
  const originalWorkspace = fs.readFileSync(workspacePath);
  try {
    run(invocation.command, [...invocation.argumentsPrefix, ...PNPM_INSTALL_ARGUMENTS], {
      cwd: worktreeRoot,
      env: environment,
      stdio: 'inherit',
    });
  } finally {
    restorePnpmWorkspaceAfterInstall(workspacePath, originalWorkspace);
  }
}

function writeDependencyMarker(gitDirectory, fingerprint, commit) {
  const markerPath = path.join(gitDirectory, DEPENDENCY_MARKER);
  const temporaryPath = `${markerPath}.${process.pid}.tmp`;
  fs.writeFileSync(
    temporaryPath,
    `${JSON.stringify({ commit, fingerprint, updatedAt: new Date().toISOString() }, undefined, 2)}\n`,
    'utf8',
  );
  fs.renameSync(temporaryPath, markerPath);
}

export function main(arguments_ = process.argv.slice(2)) {
  const options = parseArguments(arguments_);
  const target =
    options.worktreePath ??
    path.join(path.dirname(ROOT), `${path.basename(ROOT)}-release-worktree`);
  assertSafeTarget(target);

  const commit = resolveCommit(options.commit);
  const created = prepareRegisteredWorktree(target, commit);
  const gitDirectory = git(['rev-parse', '--absolute-git-dir'], { cwd: target }).stdout.trim();
  const dependencyInputs = trackedDependencyInputs(target);
  const fingerprint = computeDependencyFingerprint(target, dependencyInputs);
  const reusedDependencies = shouldReuseDependencies(target, gitDirectory, fingerprint);

  if (!reusedDependencies) {
    runPnpmInstall(target);
    writeDependencyMarker(gitDirectory, fingerprint, commit);
  }
  assertCleanWorktree(target);

  const result = {
    commit,
    created,
    dependencies: reusedDependencies ? 'reused' : 'installed',
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
