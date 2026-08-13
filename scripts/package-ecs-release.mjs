#!/usr/bin/env node
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
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RELEASE_ROOT = path.resolve(ROOT, process.argv[2] ?? 'runtime/ecs-release');
const RELEASE_PATH_PREFIX = path.join(ROOT, 'runtime') + path.sep;

const DIST_PATHS = [
  'migrations',
  'apps/web/dist',
  'apps/api/dist',
  'packages/contracts/dist',
  'packages/database/dist',
  'packages/scheduling-domain/dist',
];
const TREE_PATHS = {
  webDist: 'apps/web/dist',
  apiDist: 'apps/api/dist',
  contractsDist: 'packages/contracts/dist',
  databaseDist: 'packages/database/dist',
  schedulingDomainDist: 'packages/scheduling-domain/dist',
  migrations: 'migrations',
};

function fail(message) {
  console.error(`[ecs:package] 失败：${message}`);
  process.exit(1);
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: 'inherit',
    shell: process.platform === 'win32',
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
  const result = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    fail('无法读取当前 Git commit。');
  }
  return result.stdout.trim();
}

function ensureInsideRuntime() {
  if (!RELEASE_ROOT.startsWith(RELEASE_PATH_PREFIX)) {
    fail(`发布目录必须位于 runtime/ 下：${RELEASE_ROOT}`);
  }
}

function tarPath() {
  return process.platform === 'win32' ? 'tar.exe' : 'tar';
}

ensureInsideRuntime();
for (const relativePath of DIST_PATHS) {
  if (!fs.existsSync(path.join(ROOT, relativePath))) {
    fail(`请先完成构建，缺少：${relativePath}`);
  }
}

fs.rmSync(RELEASE_ROOT, { force: true, recursive: true });
fs.mkdirSync(RELEASE_ROOT, { recursive: true });

const distArchivePath = path.join(RELEASE_ROOT, 'schedule-dist.tar.gz');
const apiFlatArchivePath = path.join(RELEASE_ROOT, 'api-flat.tar.gz');
const apiFlatPath = fs.mkdtempSync(path.join(os.tmpdir(), 'schedule-api-flat-'));

const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
run(pnpmCommand, ['deploy', '--legacy', '--filter', '@schedule/api', '--prod', apiFlatPath]);

if (!fs.existsSync(path.join(apiFlatPath, 'node_modules'))) {
  fail('pnpm deploy 未生成 api-flat/node_modules。');
}

run(tarPath(), ['-czf', distArchivePath, '-C', ROOT, ...DIST_PATHS]);
run(tarPath(), ['-czf', apiFlatArchivePath, '-C', apiFlatPath, 'node_modules']);
fs.rmSync(apiFlatPath, { force: true, recursive: true });

const commit = gitCommit();
const manifest = {
  schemaVersion: 1,
  releaseId: commit,
  gitCommit: commit,
  generatedAt: new Date().toISOString(),
  nodeVersion: process.version,
  authMode:
    process.env.NODE_ENV === 'production' && process.env.AUTH_DEV_MODE !== 'true'
      ? 'production'
      : 'development',
  lockfileSha256: sha256File(path.join(ROOT, 'pnpm-lock.yaml')),
  artifacts: {
    distArchiveSha256: sha256File(distArchivePath),
    apiRuntimeArchiveSha256: sha256File(apiFlatArchivePath),
    webDistTreeSha256: sha256Tree(TREE_PATHS.webDist),
    apiDistTreeSha256: sha256Tree(TREE_PATHS.apiDist),
    contractsDistTreeSha256: sha256Tree(TREE_PATHS.contractsDist),
    databaseDistTreeSha256: sha256Tree(TREE_PATHS.databaseDist),
    schedulingDomainDistTreeSha256: sha256Tree(TREE_PATHS.schedulingDomainDist),
    migrationsTreeSha256: sha256Tree(TREE_PATHS.migrations),
    composeProdSha256: sha256File(path.join(ROOT, 'infra/docker/compose.prod.yml')),
    nginxConfigSha256: sha256File(path.join(ROOT, 'infra/docker/nginx.prod.conf')),
  },
};

const manifestPath = path.join(RELEASE_ROOT, 'deploy-manifest.json');
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

console.log(`[ecs:package] commit: ${commit}`);
console.log(`[ecs:package] release: ${RELEASE_ROOT}`);
console.log(`[ecs:package] manifest: ${manifestPath}`);
