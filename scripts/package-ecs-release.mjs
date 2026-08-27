#!/usr/bin/env node
/* global console, process */
/**
 * Build one immutable ECS release bundle from the already-built workspace.
 *
 * Usage:
 *   pnpm ecs:package
 *   pnpm ecs:package runtime/ecs-release
 */
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  acquireCacheLock,
  computeCacheKey,
  invalidateCacheEntry,
  publishCacheEntry,
  readCacheEntry,
  restoreCachePayload,
} from './release-cache.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RELEASE_ROOT = path.resolve(ROOT, process.argv[2] ?? 'runtime/ecs-release');
const RELEASE_PATH_PREFIX = path.join(ROOT, 'runtime') + path.sep;
const TEMP_ROOT = path.join(ROOT, 'runtime', 'tmp');
const CACHE_ROOT = path.join(ROOT, 'runtime', 'release-cache', 'v1');
const RELEASE_FEATURE_LEVEL = 'p6-client-capabilities-v1';
const RELEASE_CACHE_SCHEMA = 1;

const DIST_PATHS = [
  'migrations',
  'apps/web/dist',
  'apps/api/dist',
  'packages/contracts/dist',
  'packages/database/dist',
  'packages/scheduling-domain/dist',
  'pnpm-lock.yaml',
  'infra/docker/compose.prod.yml',
  'infra/docker/nginx.prod.conf',
  'infra/scripts/dist',
  'infra/scripts/ecs-update.sh',
  'infra/scripts/ecs-verify.sh',
  'infra/scripts/ecs-rollback.sh',
  'infra/scripts/ecs-reuse-release.sh',
  'infra/scripts/client-capability-switch.sh',
  'infra/scripts/client-version-allowlist.sh',
  'infra/scripts/schedule-backup.sh',
  'infra/scripts/schedule-notifications.sh',
  'infra/scripts/schedule-privacy-retention.sh',
  '.env.production.example',
];
const TREE_PATHS = {
  webDist: 'apps/web/dist',
  apiDist: 'apps/api/dist',
  contractsDist: 'packages/contracts/dist',
  databaseDist: 'packages/database/dist',
  schedulingDomainDist: 'packages/scheduling-domain/dist',
  infraScriptsDist: 'infra/scripts/dist',
  migrations: 'migrations',
};
const BUILD_OUTPUT_PATHS = Object.values(TREE_PATHS).filter((value) => value !== 'migrations');
const ECS_BUILD_COMMANDS = [
  [
    '-r',
    '--filter',
    './packages/**',
    '--filter',
    '@schedule/api',
    '--filter',
    '@schedule/web',
    '--if-present',
    'run',
    'build',
  ],
  ['holidays:build'],
];
const PORTABLE_SHELL_PATHS = [
  'infra/scripts/ecs-update.sh',
  'infra/scripts/ecs-verify.sh',
  'infra/scripts/ecs-rollback.sh',
  'infra/scripts/ecs-reuse-release.sh',
  'infra/scripts/client-capability-switch.sh',
  'infra/scripts/client-version-allowlist.sh',
  'infra/scripts/schedule-backup.sh',
  'infra/scripts/schedule-notifications.sh',
  'infra/scripts/schedule-privacy-retention.sh',
];

function fail(message) {
  console.error(`[ecs:package] 失败：${message}`);
  process.exit(1);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: 'inherit',
    shell: options.shell ?? false,
  });
  if (result.status !== 0) {
    fail(`${command} ${args.join(' ')} 执行失败。`);
  }
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function collectFiles(relativePath) {
  const absolutePath = path.join(ROOT, relativePath);
  if (!fs.existsSync(absolutePath)) {
    fail(`缺少构建路径：${relativePath}`);
  }

  const files = [];
  const visit = (currentPath, currentRelativePath) => {
    const entry = fs.statSync(currentPath);
    if (entry.isDirectory()) {
      for (const child of fs.readdirSync(currentPath).sort()) {
        visit(path.join(currentPath, child), path.join(currentRelativePath, child));
      }
      return;
    }
    files.push({ path: currentRelativePath.replaceAll(path.sep, '/'), absolutePath: currentPath });
  };
  visit(absolutePath, relativePath);
  return files;
}

function sha256Tree(relativePath) {
  const hash = crypto.createHash('sha256');
  for (const file of collectFiles(relativePath)) {
    hash.update(file.path);
    hash.update('\0');
    hash.update(sha256File(file.absolutePath));
    hash.update('\0');
  }
  return hash.digest('hex');
}

function gitCommit() {
  return gitOutput(['rev-parse', 'HEAD']);
}

function rollbackCandidate() {
  const candidate = process.env.ECS_ROLLBACK_CANDIDATE?.trim();
  const commit = gitCommit();
  if (!/^[0-9a-f]{40}$/.test(candidate ?? '') || candidate === commit) {
    fail('ECS_ROLLBACK_CANDIDATE 必须是不同于 HEAD 的 40 位已审计 commit。');
  }
  const ancestry = spawnSync('git', ['merge-base', '--is-ancestor', candidate, commit], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  if (ancestry.status !== 0) fail('ECS_ROLLBACK_CANDIDATE 必须是当前 HEAD 的祖先。');
  return candidate;
}

function gitOutput(args) {
  const result = spawnSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    fail(`git ${args.join(' ')} 执行失败。`);
  }
  return result.stdout.trim();
}

function gitExitSucceeded(args) {
  const result = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  if (result.status === null) fail(`git ${args.join(' ')} 无法启动。`);
  return result.status === 0;
}

function trackedFiles() {
  const result = spawnSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' });
  if (result.status !== 0) fail('git ls-files -z 执行失败。');
  return result.stdout
    .split('\0')
    .filter(Boolean)
    .map((value) => value.replaceAll('\\', '/'));
}

function commandOutput(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    shell: options.shell ?? false,
  });
  if (result.status !== 0) fail(`${command} ${args.join(' ')} 执行失败。`);
  return result.stdout.trim();
}

function buildInputFiles() {
  const roots = ['apps/api/', 'apps/web/', 'packages/', 'infra/scripts/'];
  const exact = new Set([
    '.gitattributes',
    '.npmrc',
    'eslint.config.js',
    'package.json',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    'tsconfig.base.json',
    'vitest.config.ts',
  ]);
  return trackedFiles().filter(
    (relativePath) =>
      exact.has(relativePath) || roots.some((prefix) => relativePath.startsWith(prefix)),
  );
}

function dependencyInputFiles() {
  return trackedFiles().filter((relativePath) => {
    const basename = path.posix.basename(relativePath);
    return (
      basename === 'package.json' ||
      relativePath === '.npmrc' ||
      relativePath === '.pnpmfile.cjs' ||
      relativePath === 'pnpm-lock.yaml' ||
      relativePath === 'pnpm-workspace.yaml' ||
      relativePath === 'pnpm-workspace.yml' ||
      relativePath === 'pnpmfile.cjs' ||
      relativePath.startsWith('patches/')
    );
  });
}

function filesUnder(relativePaths) {
  return relativePaths.flatMap((relativePath) =>
    collectFiles(relativePath).map((file) => file.path),
  );
}

function buildTreeHashes() {
  return Object.fromEntries(
    Object.entries(TREE_PATHS)
      .filter(([key]) => key !== 'migrations')
      .map(([key, relativePath]) => [key, sha256Tree(relativePath)]),
  );
}

function sameTreeHashes(expected) {
  try {
    return Object.entries(buildTreeHashes()).every(([key, value]) => expected?.[key] === value);
  } catch {
    return false;
  }
}

function clearBuildOutputs() {
  for (const relativePath of BUILD_OUTPUT_PATHS) {
    fs.rmSync(path.join(ROOT, relativePath), { force: true, recursive: true });
  }
}

function ensureInsideRuntime() {
  if (!RELEASE_ROOT.startsWith(RELEASE_PATH_PREFIX)) {
    fail(`发布目录必须位于 runtime/ 下：${RELEASE_ROOT}`);
  }
  const runtimeRoot = path.join(ROOT, 'runtime');
  if (!fs.existsSync(runtimeRoot)) fs.mkdirSync(runtimeRoot);
  if (fs.lstatSync(runtimeRoot).isSymbolicLink()) {
    fail('runtime/ 不得是符号链接或目录联接。');
  }
  const relativeSegments = path.relative(runtimeRoot, RELEASE_ROOT).split(path.sep);
  let current = runtimeRoot;
  for (const segment of relativeSegments) {
    current = path.join(current, segment);
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) {
      fail(`发布目录不得穿过符号链接或目录联接：${current}`);
    }
  }
  const canonicalRuntime = fs.realpathSync(runtimeRoot);
  let existingAncestor = path.dirname(RELEASE_ROOT);
  while (!fs.existsSync(existingAncestor)) existingAncestor = path.dirname(existingAncestor);
  const canonicalAncestor = fs.realpathSync(existingAncestor);
  if (
    canonicalAncestor !== canonicalRuntime &&
    !canonicalAncestor.startsWith(canonicalRuntime + path.sep)
  ) {
    fail(`发布目录的真实父路径越界：${canonicalAncestor}`);
  }
}

function assertExpectedCleanCommit() {
  const commit = gitCommit();
  const expected = process.env.ECS_RELEASE_EXPECTED_COMMIT?.trim();
  if (!/^[0-9a-f]{40}$/.test(expected ?? '') || expected !== commit) {
    fail('ECS_RELEASE_EXPECTED_COMMIT 必须与当前 40 位 Git HEAD 完全一致。');
  }
  const unstagedClean = gitExitSucceeded(['diff', '--quiet', '--exit-code']);
  const stagedClean = gitExitSucceeded(['diff', '--cached', '--quiet', '--exit-code']);
  const untracked = gitOutput(['ls-files', '--others', '--exclude-standard']);
  if (!unstagedClean || !stagedClean || untracked !== '') {
    fail('正式 release 禁止包含 tracked、staged 或 untracked 内容改动。');
  }
  return commit;
}

function assertPortableShellScripts() {
  for (const relativePath of PORTABLE_SHELL_PATHS) {
    const content = fs.readFileSync(path.join(ROOT, relativePath));
    if (content.includes(13)) fail(`${relativePath} 含 CR 字节，必须使用 LF。`);
  }
}

function assertPortableShellSyntax() {
  const configured = process.env.SCHEDULE_BASH_PATH?.trim();
  const candidates =
    process.platform === 'win32'
      ? [
          configured,
          'C:\\Program Files\\Git\\bin\\bash.exe',
          'C:\\Program Files\\Git\\usr\\bin\\bash.exe',
        ]
      : [configured, 'bash'];
  const shell = candidates.find(
    (candidate) =>
      candidate !== undefined &&
      candidate.length > 0 &&
      (candidate === 'bash' || fs.existsSync(candidate)),
  );
  if (shell === undefined) fail('找不到可用于 release shell 语法门禁的 Bash。');
  for (const relativePath of PORTABLE_SHELL_PATHS) {
    const result = spawnSync(shell, ['-n', relativePath], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: 'inherit',
    });
    if (result.status !== 0) fail(`${relativePath} 未通过 bash -n。`);
  }
}

function tarPath() {
  return process.platform === 'win32' ? 'tar.exe' : 'tar';
}

function restoreBuildCache(entry, temporaryDirectory) {
  if (sameTreeHashes(entry.metadata.treeHashes)) return 'existing';
  const archivePath = path.join(temporaryDirectory, 'build-outputs.tar.zst');
  restoreCachePayload(entry, archivePath);
  clearBuildOutputs();
  run(tarPath(), ['--zstd', '-xf', archivePath, '-C', ROOT]);
  if (!sameTreeHashes(entry.metadata.treeHashes)) {
    clearBuildOutputs();
    throw new Error('cached build tree hashes do not match restored outputs');
  }
  return 'restored';
}

function createBuildCache(pnpmCommand, buildKey, temporaryDirectory) {
  for (const args of ECS_BUILD_COMMANDS) {
    run(pnpmCommand, args, { shell: process.platform === 'win32' });
  }
  assertExpectedCleanCommit();
  const treeHashes = buildTreeHashes();
  const archivePath = path.join(temporaryDirectory, 'build-outputs.tar.zst');
  run(tarPath(), ['--zstd', '-cf', archivePath, '-C', ROOT, ...BUILD_OUTPUT_PATHS]);
  return publishCacheEntry(CACHE_ROOT, 'build', buildKey, archivePath, { treeHashes });
}

ensureInsideRuntime();
if (
  process.env.NODE_ENV !== 'production' ||
  process.env.AUTH_DEV_MODE === 'true' ||
  process.env.AUTH_PASSWORD_ENABLED !== 'true'
) {
  fail('正式 ECS release 必须使用 NODE_ENV=production 且 AUTH_DEV_MODE=false。');
}
const commit = assertExpectedCleanCommit();
const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
assertPortableShellScripts();
assertPortableShellSyntax();
fs.mkdirSync(TEMP_ROOT, { recursive: true });
if (fs.lstatSync(TEMP_ROOT).isSymbolicLink()) {
  fail('runtime/tmp 不得是符号链接或目录联接。');
}
const releaseCacheLock = acquireCacheLock(CACHE_ROOT, 'package');
const packageTemporaryDirectory = fs.mkdtempSync(path.join(TEMP_ROOT, 'release-cache-package-'));
const cleanupPackageRuntime = () => {
  fs.rmSync(packageTemporaryDirectory, { force: true, recursive: true });
  releaseCacheLock();
};
process.once('exit', cleanupPackageRuntime);
const pnpmVersion = commandOutput(pnpmCommand, ['--version'], {
  shell: process.platform === 'win32',
});
const toolchain = {
  node: process.version,
  pnpm: pnpmVersion,
  platform: process.platform,
  arch: process.arch,
};
const buildKey = computeCacheKey(ROOT, buildInputFiles(), {
  schema: RELEASE_CACHE_SCHEMA,
  kind: 'ecs-build',
  commands: ECS_BUILD_COMMANDS,
  environment: {
    AUTH_DEV_MODE: 'false',
    AUTH_PASSWORD_ENABLED: 'true',
    NODE_ENV: 'production',
  },
  toolchain,
});
let buildEntry = readCacheEntry(CACHE_ROOT, 'build', buildKey);
if (buildEntry !== undefined) {
  try {
    const reuseMode = restoreBuildCache(buildEntry, packageTemporaryDirectory);
    console.log(`[ecs:package] build cache hit (${reuseMode}): ${buildKey}`);
  } catch {
    invalidateCacheEntry(CACHE_ROOT, 'build', buildKey);
    buildEntry = undefined;
  }
}
if (buildEntry === undefined) {
  clearBuildOutputs();
  buildEntry = createBuildCache(pnpmCommand, buildKey, packageTemporaryDirectory);
  console.log(`[ecs:package] build cache miss: ${buildKey}`);
}
assertExpectedCleanCommit();
for (const relativePath of DIST_PATHS) {
  if (!fs.existsSync(path.join(ROOT, relativePath))) {
    fail(`请先完成构建，缺少：${relativePath}`);
  }
}

fs.rmSync(RELEASE_ROOT, { force: true, recursive: true });
fs.mkdirSync(RELEASE_ROOT, { recursive: true });

const distArchivePath = path.join(RELEASE_ROOT, 'schedule-dist.tar.gz');
const apiFlatArchivePath = path.join(RELEASE_ROOT, 'api-flat.tar.zst');
const distKey = computeCacheKey(ROOT, filesUnder(DIST_PATHS), {
  schema: RELEASE_CACHE_SCHEMA,
  kind: 'ecs-dist-archive',
  format: 'tar-gzip',
  toolchain,
});
let distEntry = readCacheEntry(CACHE_ROOT, 'dist', distKey);
if (distEntry === undefined) {
  run(tarPath(), ['-czf', distArchivePath, '-C', ROOT, ...DIST_PATHS]);
  distEntry = publishCacheEntry(CACHE_ROOT, 'dist', distKey, distArchivePath, {
    treeHashes: buildTreeHashes(),
  });
  console.log(`[ecs:package] dist cache miss: ${distKey}`);
} else {
  restoreCachePayload(distEntry, distArchivePath);
  console.log(`[ecs:package] dist cache hit: ${distKey}`);
}

const flatDeployArguments = [
  'deploy',
  '--legacy',
  '--config.node-linker=hoisted',
  '--config.shamefully-hoist=true',
  '--filter',
  '@schedule/holiday-import-script',
  '--prod',
];
const flatInputs = [
  ...dependencyInputFiles(),
  ...filesUnder([
    TREE_PATHS.apiDist,
    TREE_PATHS.contractsDist,
    TREE_PATHS.databaseDist,
    TREE_PATHS.schedulingDomainDist,
    TREE_PATHS.infraScriptsDist,
    TREE_PATHS.migrations,
  ]),
];
const flatKey = computeCacheKey(ROOT, flatInputs, {
  schema: RELEASE_CACHE_SCHEMA,
  kind: 'api-flat',
  command: flatDeployArguments,
  toolchain,
});
let flatEntry = readCacheEntry(CACHE_ROOT, 'api-flat', flatKey);
if (flatEntry === undefined) {
  const apiFlatPath = fs.mkdtempSync(path.join(TEMP_ROOT, 'api-flat-'));
  try {
    run(pnpmCommand, [...flatDeployArguments, apiFlatPath], {
      shell: process.platform === 'win32',
    });
    if (!fs.existsSync(path.join(apiFlatPath, 'node_modules'))) {
      fail('pnpm deploy 未生成 api-flat/node_modules。');
    }
    if (fs.existsSync(path.join(apiFlatPath, 'node_modules', '@cloudbase'))) {
      fail('pnpm deploy 生成的 API runtime 仍含 @cloudbase。');
    }
    fs.cpSync(path.join(ROOT, 'migrations'), path.join(apiFlatPath, 'node_modules', 'migrations'), {
      recursive: true,
    });
    run(tarPath(), ['--zstd', '-cf', apiFlatArchivePath, '-C', apiFlatPath, 'node_modules']);
    flatEntry = publishCacheEntry(CACHE_ROOT, 'api-flat', flatKey, apiFlatArchivePath, {});
  } finally {
    fs.rmSync(apiFlatPath, { force: true, recursive: true });
  }
  console.log(`[ecs:package] api-flat cache miss: ${flatKey}`);
} else {
  restoreCachePayload(flatEntry, apiFlatArchivePath);
  console.log(`[ecs:package] api-flat cache hit: ${flatKey}`);
}

const manifest = {
  schemaVersion: 1,
  releaseFeatureLevel: RELEASE_FEATURE_LEVEL,
  databaseSchemaMin: '52',
  databaseSchemaMax: '52',
  rollbackCandidate: rollbackCandidate(),
  releaseId: commit,
  gitCommit: commit,
  generatedAt: new Date().toISOString(),
  nodeVersion: process.version,
  authMode: 'production',
  lockfileSha256: sha256File(path.join(ROOT, 'pnpm-lock.yaml')),
  artifacts: {
    distArchiveSha256: sha256File(distArchivePath),
    apiRuntimeArchiveSha256: sha256File(apiFlatArchivePath),
    webDistTreeSha256: sha256Tree(TREE_PATHS.webDist),
    apiDistTreeSha256: sha256Tree(TREE_PATHS.apiDist),
    contractsDistTreeSha256: sha256Tree(TREE_PATHS.contractsDist),
    databaseDistTreeSha256: sha256Tree(TREE_PATHS.databaseDist),
    schedulingDomainDistTreeSha256: sha256Tree(TREE_PATHS.schedulingDomainDist),
    infraScriptsDistTreeSha256: sha256Tree(TREE_PATHS.infraScriptsDist),
    migrationsTreeSha256: sha256Tree(TREE_PATHS.migrations),
    composeProdSha256: sha256File(path.join(ROOT, 'infra/docker/compose.prod.yml')),
    nginxConfigSha256: sha256File(path.join(ROOT, 'infra/docker/nginx.prod.conf')),
    notificationSchedulerSha256: sha256File(
      path.join(ROOT, 'infra/scripts/schedule-notifications.sh'),
    ),
    backupSchedulerSha256: sha256File(path.join(ROOT, 'infra/scripts/schedule-backup.sh')),
    privacyRetentionSchedulerSha256: sha256File(
      path.join(ROOT, 'infra/scripts/schedule-privacy-retention.sh'),
    ),
    ecsUpdateSha256: sha256File(path.join(ROOT, 'infra/scripts/ecs-update.sh')),
    ecsVerifySha256: sha256File(path.join(ROOT, 'infra/scripts/ecs-verify.sh')),
    ecsRollbackSha256: sha256File(path.join(ROOT, 'infra/scripts/ecs-rollback.sh')),
    ecsReuseReleaseSha256: sha256File(path.join(ROOT, 'infra/scripts/ecs-reuse-release.sh')),
    clientCapabilitySwitchSha256: sha256File(
      path.join(ROOT, 'infra/scripts/client-capability-switch.sh'),
    ),
    clientVersionAllowlistSha256: sha256File(
      path.join(ROOT, 'infra/scripts/client-version-allowlist.sh'),
    ),
  },
};

const manifestPath = path.join(RELEASE_ROOT, 'deploy-manifest.json');
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

process.removeListener('exit', cleanupPackageRuntime);
cleanupPackageRuntime();

console.log(`[ecs:package] commit: ${commit}`);
console.log(`[ecs:package] release: ${RELEASE_ROOT}`);
console.log(`[ecs:package] manifest: ${manifestPath}`);
