/**
 * Prepare an already owned warm pool worktree for an exact-commit upload.
 *
 * The worktree is isolated under runtime/ inside the repository, while its ignored
 * node_modules directory survives commit changes. Dependencies are never installed
 * by this helper; a matching healthy environment is required before a release build.
 *
 * Usage:
 *   node scripts/prepare-release-worktree.mjs --commit <ref> --path <leased-pool-path>
 *     --lease-token <token> --run-id <taskId> --purpose upload
 */

/* global console, process */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { PNPM_INSTALL_ARGUMENTS as SHARED_PNPM_INSTALL_ARGUMENTS } from './codex/worktree-deps-core.mjs';
import {
  assertApprovedPoolPath,
  assertNoPathLinks,
  inspectReleaseCandidate,
  prepareReleaseCandidate,
} from './codex/release-candidate-core.mjs';

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
export const PNPM_INSTALL_ARGUMENTS = SHARED_PNPM_INSTALL_ARGUMENTS;

function fail(message) {
  throw new Error(`[release:worktree] ${message}`);
}

export function parseArguments(arguments_) {
  const result = {
    commit: 'HEAD',
    json: false,
    worktreePath: undefined,
    leaseToken: undefined,
    runId: undefined,
    purpose: undefined,
    ttlMinutes: 120,
    checkOnly: false,
  };

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === '--json') {
      result.json = true;
      continue;
    }
    if (argument === '--check-only') {
      result.checkOnly = true;
      continue;
    }
    if (
      ['--commit', '--path', '--lease-token', '--run-id', '--purpose', '--ttl-minutes'].includes(
        argument,
      )
    ) {
      const value = arguments_[index + 1];
      if (value === undefined || value.startsWith('--')) {
        fail(`${argument} 缺少值。`);
      }
      if (argument === '--commit') result.commit = value;
      else if (argument === '--path') result.worktreePath = value;
      else if (argument === '--lease-token') result.leaseToken = value;
      else if (argument === '--run-id') result.runId = value;
      else if (argument === '--purpose') result.purpose = value;
      else result.ttlMinutes = Number(value);
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

export function assertSafeTarget(target) {
  assertApprovedPoolPath(ROOT, target);
  assertNoPathLinks(ROOT, target);
}

function resolveCommit(reference) {
  return git(['rev-parse', '--verify', `${reference}^{commit}`]).stdout.trim();
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
  if (!options.worktreePath || !options.leaseToken || !options.runId) {
    fail(
      'Use --path, --lease-token and --run-id from an exclusive Acquire; TASK_STATUS=BLOCKED_NO_REUSABLE_DEPENDENCY_ENV',
    );
  }
  const target = options.worktreePath;
  assertSafeTarget(target);

  const commit = resolveCommit(options.commit);
  const candidateOptions = {
    worktree: target,
    expectedCommit: commit,
    leaseToken: options.leaseToken,
    runId: options.runId,
    purpose: options.purpose,
    ttlMinutes: options.ttlMinutes,
  };
  const checked = options.checkOnly
    ? inspectReleaseCandidate(candidateOptions)
    : prepareReleaseCandidate(candidateOptions);

  const result = {
    ...checked,
    commit,
    created: false,
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
