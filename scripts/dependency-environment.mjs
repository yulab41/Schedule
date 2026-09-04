/**
 * Worktree-local dependency environment fingerprinting and health checks.
 *
 * The read-only check is intentionally separate from the explicitly authorized
 * install path. A dependency environment is reusable only when both its complete
 * fingerprint marker and its current node_modules health agree.
 */

/* global process */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const DEPENDENCY_ENVIRONMENT_SCHEMA_VERSION = 1;
export const DEPENDENCY_ENVIRONMENT_MARKER = 'schedule-dependency-environment-v1.json';
export const PNPM_INSTALL_ARGUMENTS = [
  'install',
  '--frozen-lockfile',
  '--config.strictDepBuilds=false',
];

const PNPM_LAYOUT_SETTING_ALIASES = {
  dedupePeerDependents: ['dedupe-peer-dependents', 'dedupePeerDependents'],
  enableModulesDir: ['enable-modules-dir', 'enableModulesDir'],
  hoist: ['hoist'],
  hoistPattern: ['hoist-pattern', 'hoistPattern'],
  nodeLinker: ['node-linker', 'nodeLinker'],
  packageImportMethod: ['package-import-method', 'packageImportMethod'],
  publicHoistPattern: ['public-hoist-pattern', 'publicHoistPattern'],
  resolvePeersFromWorkspaceRoot: [
    'resolve-peers-from-workspace-root',
    'resolvePeersFromWorkspaceRoot',
  ],
  shamefullyHoist: ['shamefully-hoist', 'shamefullyHoist'],
  symlink: ['symlink'],
  virtualStoreDir: ['virtual-store-dir', 'virtualStoreDir'],
  virtualStoreDirMaxLength: ['virtual-store-dir-max-length', 'virtualStoreDirMaxLength'],
};

function fail(message) {
  throw new Error(`[dependency-environment] ${message}`);
}

function run(command, arguments_, options = {}) {
  const result = spawnSync(command, arguments_, {
    cwd: options.cwd,
    encoding: 'utf8',
    env: options.env ?? process.env,
    stdio: options.stdio ?? ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0) {
    const detail = `${result.stderr ?? ''}${result.stdout ?? ''}`.trim();
    fail(`${command} ${arguments_.join(' ')} failed${detail === '' ? '' : `: ${detail}`}`);
  }
  return result.stdout ?? '';
}

function runGit(root, arguments_) {
  return run('git', arguments_, { cwd: root });
}

function canonicalPath(value, platform = process.platform) {
  const resolved = path.resolve(value);
  return platform === 'win32' ? resolved.toLocaleLowerCase('en-US') : resolved;
}

function normalizeRelativePath(value) {
  return value.replaceAll('\\', '/');
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map((item) => stableValue(item));
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stableValue(item)]),
    );
  }
  return value;
}

function hashJson(value) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(stableValue(value)))
    .digest('hex');
}

function readJson(absolutePath) {
  return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
}

function listFilesRecursively(root, relativeDirectory) {
  const directory = path.join(root, relativeDirectory);
  if (!fs.existsSync(directory)) return [];

  const files = [];
  const visit = (absoluteDirectory) => {
    for (const entry of fs.readdirSync(absoluteDirectory, { withFileTypes: true })) {
      const absolutePath = path.join(absoluteDirectory, entry.name);
      if (entry.isDirectory()) visit(absolutePath);
      else if (entry.isFile()) files.push(normalizeRelativePath(path.relative(root, absolutePath)));
    }
  };
  visit(directory);
  return files;
}

export function collectDependencyInputs(candidateFiles) {
  return [...new Set(candidateFiles.map((file) => normalizeRelativePath(file)))]
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
        file.startsWith('patches/') ||
        file.endsWith('.patch')
      );
    })
    .sort();
}

export function computeDependencyFingerprint(root, relativePaths) {
  const hash = crypto.createHash('sha256');
  for (const relativePath of [...relativePaths].sort()) {
    const absolutePath = path.join(root, relativePath);
    hash.update(relativePath);
    hash.update('\0');
    if (fs.existsSync(absolutePath)) hash.update(fs.readFileSync(absolutePath));
    else hash.update('<missing>');
    hash.update('\0');
  }
  return hash.digest('hex');
}

export function normalizePnpmLayoutSettings(configuration) {
  const normalized = {};
  for (const [name, aliases] of Object.entries(PNPM_LAYOUT_SETTING_ALIASES)) {
    const alias = aliases.find((candidate) =>
      Object.prototype.hasOwnProperty.call(configuration, candidate),
    );
    normalized[name] = alias === undefined ? null : stableValue(configuration[alias]);
  }
  return normalized;
}

export function computeDependencyEnvironmentFingerprint(dimensions) {
  return hashJson({
    architecture: dimensions.architecture,
    nodeVersion: dimensions.nodeVersion,
    operatingSystem: dimensions.operatingSystem,
    pnpmLayout: normalizePnpmLayoutSettings(dimensions.pnpmLayout ?? {}),
    pnpmVersion: dimensions.pnpmVersion,
    schemaVersion: DEPENDENCY_ENVIRONMENT_SCHEMA_VERSION,
    sourceFingerprint: dimensions.sourceFingerprint,
    storePath: canonicalPath(dimensions.storePath, dimensions.operatingSystem),
  });
}

function dependencyIssue(kind, importerRelativePath, dependencyName) {
  return importerRelativePath === ''
    ? `${kind}:${dependencyName}`
    : `${kind}:${normalizeRelativePath(importerRelativePath)}:${dependencyName}`;
}

export function collectDependencyHealthIssues({ packageJsonPaths, pnpmVersion, root, storePath }) {
  const issues = [];
  const nodeModulesPath = path.join(root, 'node_modules');
  const modulesMetadataPath = path.join(nodeModulesPath, '.modules.yaml');

  if (!fs.existsSync(nodeModulesPath)) return ['node-modules-missing'];

  let modulesMetadata;
  try {
    modulesMetadata = readJson(modulesMetadataPath);
  } catch {
    issues.push('modules-metadata');
  }

  if (modulesMetadata !== undefined) {
    if (modulesMetadata.packageManager !== `pnpm@${pnpmVersion}`) issues.push('pnpm-version');
    if (
      typeof modulesMetadata.storeDir !== 'string' ||
      canonicalPath(modulesMetadata.storeDir) !== canonicalPath(storePath)
    ) {
      issues.push('pnpm-store');
    }

    const expectedVirtualStore = path.join(nodeModulesPath, '.pnpm');
    if (
      typeof modulesMetadata.virtualStoreDir !== 'string' ||
      canonicalPath(modulesMetadata.virtualStoreDir) !== canonicalPath(expectedVirtualStore) ||
      !fs.existsSync(expectedVirtualStore)
    ) {
      issues.push('virtual-store');
    }
    if (!Number.isInteger(modulesMetadata.layoutVersion)) issues.push('layout-version');
  }

  if (!fs.existsSync(storePath)) issues.push('pnpm-store-missing');

  const manifests = [];
  const workspacePackages = new Map();
  for (const relativePath of packageJsonPaths) {
    const absolutePath = path.isAbsolute(relativePath)
      ? relativePath
      : path.join(root, relativePath);
    try {
      const manifest = readJson(absolutePath);
      const packageRoot = path.dirname(absolutePath);
      manifests.push({ manifest, packageRoot });
      if (typeof manifest.name === 'string') {
        if (workspacePackages.has(manifest.name)) {
          issues.push(`workspace-package-name-duplicate:${manifest.name}`);
        } else {
          workspacePackages.set(manifest.name, packageRoot);
        }
      }
    } catch {
      issues.push(`package-manifest:${normalizeRelativePath(path.relative(root, absolutePath))}`);
    }
  }

  for (const { manifest, packageRoot } of manifests) {
    const importerRelativePath = path.relative(root, packageRoot);
    const dependencies = { ...manifest.dependencies, ...manifest.devDependencies };
    for (const dependencyName of Object.keys(dependencies).sort()) {
      const dependencyPath = path.join(packageRoot, 'node_modules', dependencyName);
      if (!fs.existsSync(dependencyPath)) {
        issues.push(dependencyIssue('missing-dependency', importerRelativePath, dependencyName));
        continue;
      }

      const workspaceTarget = workspacePackages.get(dependencyName);
      if (workspaceTarget === undefined) continue;
      try {
        if (
          canonicalPath(fs.realpathSync.native(dependencyPath)) !== canonicalPath(workspaceTarget)
        ) {
          issues.push(
            dependencyIssue('workspace-link-target', importerRelativePath, dependencyName),
          );
        }
      } catch {
        issues.push(dependencyIssue('workspace-link-target', importerRelativePath, dependencyName));
      }
    }
  }

  return [...new Set(issues)].sort();
}

export function classifyDependencyEnvironment({
  fingerprint,
  healthIssues,
  marker,
  markerIssues = [],
}) {
  const reasons = [...markerIssues];
  if (marker === undefined && !reasons.includes('marker-invalid')) reasons.push('marker-missing');
  else if (marker !== undefined) {
    if (marker.schemaVersion !== DEPENDENCY_ENVIRONMENT_SCHEMA_VERSION) {
      reasons.push('marker-schema');
    } else if (marker.fingerprint !== fingerprint) {
      reasons.push('fingerprint-mismatch');
    }
  }
  reasons.push(...healthIssues);
  const uniqueReasons = [...new Set(reasons)];
  return uniqueReasons.length === 0
    ? { reasons: [], status: 'MATCH' }
    : { reasons: uniqueReasons, status: 'MISS' };
}

export function runDependencyInstallIfNeeded({ check, install, record, verifyHealth }) {
  const initial = check();
  if (initial.status === 'MATCH') {
    return { action: 'reused', initialReasons: [] };
  }

  install();
  const healthIssues = verifyHealth();
  if (healthIssues.length > 0) {
    fail(`post-install health check failed: ${healthIssues.join(', ')}`);
  }
  record();

  const final = check();
  if (final.status !== 'MATCH') {
    fail(`recorded environment still reports MISS: ${final.reasons.join(', ')}`);
  }
  return { action: 'installed', initialReasons: initial.reasons };
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
      fail('cannot find a pnpm JavaScript entry point for direct Node execution');
    }
    return { argumentsPrefix: [cliPath], command: nodeExecutable };
  }

  return { argumentsPrefix: [], command: 'pnpm' };
}

function runPnpm(root, arguments_, options = {}) {
  const invocation = resolvePnpmInvocation(options.environment);
  return run(invocation.command, [...invocation.argumentsPrefix, ...arguments_], {
    cwd: root,
    env: options.environment,
    stdio: options.stdio,
  });
}

function workspacePackageJsonPaths(root) {
  let workspaces;
  try {
    workspaces = JSON.parse(runPnpm(root, ['list', '--recursive', '--depth', '-1', '--json']));
  } catch (error) {
    fail(`cannot enumerate workspace packages: ${error instanceof Error ? error.message : error}`);
  }
  if (!Array.isArray(workspaces)) fail('pnpm workspace enumeration did not return an array');

  return [
    ...new Set(
      workspaces.map((workspace) => {
        if (workspace === null || typeof workspace.path !== 'string') {
          fail('pnpm workspace enumeration contains an invalid path');
        }
        const relativePath = path.relative(root, path.resolve(workspace.path));
        if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
          fail(`workspace package is outside the repository: ${workspace.path}`);
        }
        return normalizeRelativePath(path.join(relativePath, 'package.json'));
      }),
    ),
  ].sort();
}

function currentDependencyContext(root) {
  const trackedFiles = runGit(root, ['ls-files', '-z']).split('\0').filter(Boolean);
  const packageJsonPaths = workspacePackageJsonPaths(root);
  const dependencyInputs = collectDependencyInputs([
    ...trackedFiles,
    ...packageJsonPaths,
    ...listFilesRecursively(root, 'patches'),
  ]);
  const pnpmVersion = runPnpm(root, ['--version']).trim();
  const storePath = runPnpm(root, ['store', 'path', '--silent']).trim();
  let pnpmConfiguration;
  try {
    pnpmConfiguration = JSON.parse(runPnpm(root, ['config', 'list', '--json']));
  } catch (error) {
    fail(
      `cannot read pnpm layout configuration: ${error instanceof Error ? error.message : error}`,
    );
  }
  const dimensions = {
    architecture: process.arch,
    nodeVersion: process.version,
    operatingSystem: process.platform,
    pnpmLayout: normalizePnpmLayoutSettings(pnpmConfiguration),
    pnpmVersion,
    sourceFingerprint: computeDependencyFingerprint(root, dependencyInputs),
    storePath,
  };

  return {
    dependencyInputs,
    dimensions,
    fingerprint: computeDependencyEnvironmentFingerprint(dimensions),
    packageJsonPaths,
  };
}

function dependencyMarkerPath(root) {
  const gitDirectory = runGit(root, ['rev-parse', '--absolute-git-dir']).trim();
  return path.join(gitDirectory, DEPENDENCY_ENVIRONMENT_MARKER);
}

function readDependencyMarker(markerPath) {
  if (!fs.existsSync(markerPath)) return { marker: undefined, markerIssues: [] };
  try {
    return { marker: readJson(markerPath), markerIssues: [] };
  } catch {
    return { marker: undefined, markerIssues: ['marker-invalid'] };
  }
}

export function inspectCurrentDependencyEnvironment(root) {
  const resolvedRoot = path.resolve(root);
  const context = currentDependencyContext(resolvedRoot);
  const markerPath = dependencyMarkerPath(resolvedRoot);
  const { marker, markerIssues } = readDependencyMarker(markerPath);
  const healthIssues = collectDependencyHealthIssues({
    packageJsonPaths: context.packageJsonPaths,
    pnpmVersion: context.dimensions.pnpmVersion,
    root: resolvedRoot,
    storePath: context.dimensions.storePath,
  });
  return {
    ...classifyDependencyEnvironment({
      fingerprint: context.fingerprint,
      healthIssues,
      marker,
      markerIssues,
    }),
    context,
    healthIssues,
    markerPath,
  };
}

function writeDependencyMarker(root, context) {
  const markerPath = dependencyMarkerPath(root);
  const temporaryPath = `${markerPath}.${process.pid}.tmp`;
  let commit = 'unborn';
  try {
    commit = runGit(root, ['rev-parse', 'HEAD']).trim();
  } catch {
    // A dependency environment can still be established before the first commit.
  }
  fs.writeFileSync(
    temporaryPath,
    `${JSON.stringify(
      {
        commit,
        dimensions: context.dimensions,
        fingerprint: context.fingerprint,
        schemaVersion: DEPENDENCY_ENVIRONMENT_SCHEMA_VERSION,
        updatedAt: new Date().toISOString(),
      },
      undefined,
      2,
    )}\n`,
    'utf8',
  );
  fs.renameSync(temporaryPath, markerPath);
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
    fail('pnpm install changed workspace configuration beyond generated build-review placeholders');
  }
  fs.writeFileSync(workspacePath, original);
}

export function runPnpmInstall(root) {
  const environment = { ...process.env, CI: 'true' };
  const workspacePath = path.join(root, 'pnpm-workspace.yaml');
  const originalWorkspace = fs.readFileSync(workspacePath);
  try {
    runPnpm(root, PNPM_INSTALL_ARGUMENTS, { environment, stdio: 'inherit' });
  } finally {
    restorePnpmWorkspaceAfterInstall(workspacePath, originalWorkspace);
  }
}

export function installCurrentDependencyEnvironmentIfNeeded(root) {
  const resolvedRoot = path.resolve(root);
  let verifiedContext;
  return runDependencyInstallIfNeeded({
    check: () => inspectCurrentDependencyEnvironment(resolvedRoot),
    install: () => runPnpmInstall(resolvedRoot),
    record: () => writeDependencyMarker(resolvedRoot, verifiedContext),
    verifyHealth: () => {
      verifiedContext = currentDependencyContext(resolvedRoot);
      return collectDependencyHealthIssues({
        packageJsonPaths: verifiedContext.packageJsonPaths,
        pnpmVersion: verifiedContext.dimensions.pnpmVersion,
        root: resolvedRoot,
        storePath: verifiedContext.dimensions.storePath,
      });
    },
  });
}
