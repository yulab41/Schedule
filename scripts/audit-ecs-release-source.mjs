#!/usr/bin/env node
/* global console, process */
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PRODUCTION_SOURCE_PATHS = [
  '.env.production.example',
  'apps/api',
  'apps/web',
  'infra/docker',
  'infra/scripts',
  'migrations',
  'package.json',
  'packages/contracts',
  'packages/database',
  'packages/scheduling-domain',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'scripts/package-ecs-release.mjs',
  'scripts/release-cache.mjs',
  'tsconfig.base.json',
];
const EXCLUDED_EVIDENCE_PATHS = ['scripts/directory-query-readiness/', 'runtime/'];

function git(args, options = {}) {
  const result = spawnSync('git', args, {
    cwd: ROOT,
    encoding: options.encoding ?? 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed`);
  }
  return result.stdout;
}

function gitPathExists(commit, relativePath) {
  return (
    spawnSync('git', ['cat-file', '-e', `${commit}:${relativePath}`], {
      cwd: ROOT,
      stdio: 'ignore',
    }).status === 0
  );
}

function gitFile(commit, relativePath) {
  return git(['show', `${commit}:${relativePath}`], { encoding: 'buffer' });
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function buildEcsSourceDryRunManifest(ref) {
  const releaseId = String(git(['rev-parse', '--verify', `${ref}^{commit}`])).trim();
  if (!/^[0-9a-f]{40}$/u.test(releaseId)) throw new Error('resolved release ID is invalid');
  const journal = JSON.parse(String(gitFile(releaseId, 'migrations/meta/_journal.json')));
  const packagerSource = String(gitFile(releaseId, 'scripts/package-ecs-release.mjs'));
  const archiveBlock = /const DIST_PATHS = \[(?<paths>[\s\S]*?)\n\];/u.exec(packagerSource)?.groups
    ?.paths;
  if (archiveBlock === undefined) throw new Error('unable to read production archive allowlist');
  const productionArchivePaths = [...archiveBlock.matchAll(/'([^']+)'/gu)].map((match) => match[1]);
  const migrationTags = journal.entries.map((entry) => entry.tag);
  const migration0053Path = 'migrations/0053_directory_candidate_covering_index.sql';
  const includes0053 = gitPathExists(releaseId, migration0053Path);
  const sourceTree = git([
    'ls-tree',
    '-r',
    '--full-tree',
    releaseId,
    '--',
    ...PRODUCTION_SOURCE_PATHS,
  ]);
  const evidenceTree = String(
    git(['ls-tree', '-r', '--name-only', releaseId, '--', 'scripts/directory-query-readiness']),
  )
    .trim()
    .split('\n')
    .filter(Boolean);
  const commitDeltaPaths = String(
    git(['diff-tree', '--no-commit-id', '--name-only', '-r', releaseId]),
  )
    .trim()
    .split('\n')
    .filter(Boolean)
    .sort();

  return {
    schemaVersion: 1,
    kind: 'ecs-source-only-dry-run',
    releaseId,
    deployable: false,
    buildArtifactsGenerated: false,
    productionDeploymentExecuted: false,
    productionSourceTreeSha256: sha256(sourceTree),
    productionArchivePaths,
    excludedEvidencePaths: [...EXCLUDED_EVIDENCE_PATHS],
    trackedExcludedEvidenceFileCount: evidenceTree.length,
    commitDeltaPaths,
    migrations: {
      entryCount: migrationTags.length,
      highestTag: migrationTags.at(-1) ?? null,
      includes0053,
      migration0053Sha256: includes0053 ? sha256(gitFile(releaseId, migration0053Path)) : null,
      updaterCanExecute0053: includes0053 && productionArchivePaths.includes('migrations'),
    },
  };
}

function writeManifest(manifest, outputArgument) {
  const json = `${JSON.stringify(manifest, null, 2)}\n`;
  if (outputArgument === undefined) {
    console.log(json.trimEnd());
    return;
  }
  const outputPath = path.resolve(ROOT, outputArgument);
  const runtimeRoot = path.join(ROOT, 'runtime') + path.sep;
  if (!outputPath.startsWith(runtimeRoot)) {
    throw new Error('source-only dry-run output must stay under runtime/');
  }
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, json, 'utf8');
  console.log(outputPath);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const ref = process.argv[2];
  if (ref === undefined)
    throw new Error('usage: audit-ecs-release-source.mjs <git-ref> [runtime/output.json]');
  writeManifest(buildEcsSourceDryRunManifest(ref), process.argv[3]);
}
