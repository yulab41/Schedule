import fs from 'node:fs';
import path from 'node:path';
import { URL } from 'node:url';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import {
  DEFAULT_RELEASE_WORKTREE_PATH,
  PNPM_INSTALL_ARGUMENTS,
  assertSafeTarget,
  collectDependencyInputs,
  computeDependencyFingerprint,
  parseArguments,
  parseWorktreeList,
  resolvePnpmInvocation,
  shouldReuseDependencies,
  stripPnpmBuildPlaceholders,
} from './prepare-release-worktree.mjs';

const temporaryDirectories = [];
const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { force: true, recursive: true });
  }
});

function createTemporaryDirectory() {
  const runtimeRoot = path.join(REPOSITORY_ROOT, 'runtime');
  fs.mkdirSync(runtimeRoot, { recursive: true });
  const directory = fs.mkdtempSync(path.join(runtimeRoot, 'codex-test-release-'));
  temporaryDirectories.push(directory);
  return directory;
}

describe('reusable isolated release worktree', () => {
  it('keeps every release worktree inside the repository runtime directory', () => {
    const runtimeRoot = path.dirname(DEFAULT_RELEASE_WORKTREE_PATH);
    const repositoryRoot = path.dirname(runtimeRoot);

    expect(DEFAULT_RELEASE_WORKTREE_PATH).toBe(path.join(runtimeRoot, 'release-worktree'));
    expect(() => assertSafeTarget(DEFAULT_RELEASE_WORKTREE_PATH)).not.toThrow();
    expect(() =>
      assertSafeTarget(path.join(runtimeRoot, 'release-worktree-secondary')),
    ).not.toThrow();
    expect(() => assertSafeTarget(runtimeRoot)).toThrow(/runtime 子目录/u);
    expect(() => assertSafeTarget(repositoryRoot)).toThrow(/runtime 子目录/u);
    expect(() =>
      assertSafeTarget(path.join(path.dirname(repositoryRoot), 'Schedule-release')),
    ).toThrow(/runtime 子目录/u);
  });

  it('defaults to HEAD and accepts an explicit commit and absolute worktree path', () => {
    expect(parseArguments([])).toEqual({ commit: 'HEAD', json: false, worktreePath: undefined });

    const worktreePath = path.resolve('E:/isolated/schedule-release');
    expect(parseArguments(['--commit', 'abc1234', '--path', worktreePath, '--json'])).toEqual({
      commit: 'abc1234',
      json: true,
      worktreePath,
    });
  });

  it('parses registered detached worktrees without treating their paths as disposable folders', () => {
    const entries = parseWorktreeList(
      [
        'worktree E:/AItools/Schedule',
        'HEAD f070b69600000000000000000000000000000000',
        'branch refs/heads/main',
        '',
        'worktree E:/AItools/Schedule-release-worktree',
        'HEAD 7f4f70a000000000000000000000000000000000',
        'detached',
        '',
      ].join('\n'),
    );

    expect(entries).toEqual([
      {
        branch: 'refs/heads/main',
        detached: false,
        head: 'f070b69600000000000000000000000000000000',
        path: path.normalize('E:/AItools/Schedule'),
      },
      {
        branch: undefined,
        detached: true,
        head: '7f4f70a000000000000000000000000000000000',
        path: path.normalize('E:/AItools/Schedule-release-worktree'),
      },
    ]);
  });

  it('fingerprints every tracked pnpm dependency input and changes when one changes', () => {
    const root = createTemporaryDirectory();
    const files = [
      '.npmrc',
      'apps/api/package.json',
      'package.json',
      'patches/example.patch',
      'pnpm-lock.yaml',
      'pnpm-workspace.yaml',
    ];

    for (const relativePath of files) {
      const absolutePath = path.join(root, relativePath);
      fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
      fs.writeFileSync(absolutePath, `${relativePath}\n`, 'utf8');
    }

    expect(collectDependencyInputs(files)).toEqual(files);
    const first = computeDependencyFingerprint(root, files);
    fs.appendFileSync(path.join(root, 'apps/api/package.json'), 'changed\n');
    expect(computeDependencyFingerprint(root, files)).not.toBe(first);
  });

  it('reuses dependencies only when node_modules and the worktree-local fingerprint agree', () => {
    const root = createTemporaryDirectory();
    const stateDirectory = path.join(root, 'runtime', 'codex', 'fingerprints', 'test');
    fs.mkdirSync(path.join(root, 'node_modules'), { recursive: true });
    fs.mkdirSync(stateDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(stateDirectory, 'schedule-release-dependencies.json'),
      JSON.stringify({ fingerprint: 'same' }),
      'utf8',
    );

    expect(shouldReuseDependencies(root, stateDirectory, 'same')).toBe(true);
    expect(shouldReuseDependencies(root, stateDirectory, 'different')).toBe(false);
    fs.rmSync(path.join(root, 'node_modules'), { recursive: true });
    expect(shouldReuseDependencies(root, stateDirectory, 'same')).toBe(false);
  });

  it('invokes the pnpm JavaScript entry directly on Windows instead of spawning pnpm.cmd', () => {
    const appData = createTemporaryDirectory();
    const cliPath = path.join(appData, 'npm', 'node_modules', 'pnpm', 'bin', 'pnpm.mjs');
    fs.mkdirSync(path.dirname(cliPath), { recursive: true });
    fs.writeFileSync(cliPath, '', 'utf8');

    expect(
      resolvePnpmInvocation({ APPDATA: appData }, 'win32', 'C:/Program Files/nodejs/node.exe'),
    ).toEqual({
      argumentsPrefix: [cliPath],
      command: 'C:/Program Files/nodejs/node.exe',
    });
  });

  it('keeps the separately authorized maintenance argument list offline and non-forced', () => {
    expect(PNPM_INSTALL_ARGUMENTS).toEqual([
      'install',
      '--frozen-lockfile',
      '--offline',
      '--config.strictDepBuilds=false',
    ]);
  });

  it('routes release preparation through ReuseOnly and has no automatic install call', () => {
    const source = fs.readFileSync(new URL('./prepare-release-worktree.mjs', import.meta.url), 'utf8');
    expect(source).toContain("mode: 'ReuseOnly'");
    expect(source).toContain('ensureWorktreeDependencies');
    expect(source).not.toContain('runPnpmInstall');
  });

  it('records explicit non-build decisions for optional dependency install scripts', () => {
    const workspace = fs.readFileSync(new URL('../pnpm-workspace.yaml', import.meta.url), 'utf8');

    for (const dependency of ['@parcel/watcher', '@swc/core', 'less', 'protobufjs']) {
      expect(workspace).toMatch(new RegExp(`^  ['"]?${dependency}['"]?: false$`, 'mu'));
    }
    expect(workspace).not.toContain('set this to true or false');
    expect(workspace).toMatch(/^verifyDepsBeforeRun: false$/mu);
  });

  it('recognizes only pnpm generated build-review placeholders for restoration', () => {
    expect(
      stripPnpmBuildPlaceholders(
        [
          'allowBuilds:',
          "  '@parcel/watcher': set this to true or false",
          '  esbuild: true',
          '  protobufjs: set this to true or false',
          '',
        ].join('\r\n'),
      ),
    ).toBe(['allowBuilds:', '  esbuild: true', ''].join('\r\n'));
  });

  it('checks content, index, and untracked files instead of rejecting stat-only EOL noise', () => {
    const source = fs.readFileSync(
      new URL('./prepare-release-worktree.mjs', import.meta.url),
      'utf8',
    );
    expect(source).not.toContain("['status', '--porcelain=v1', '--untracked-files=all']");
    expect(source).toContain("['diff', '--quiet', '--exit-code']");
    expect(source).toContain("['diff', '--cached', '--quiet', '--exit-code']");
    expect(source).toContain("['ls-files', '--others', '--exclude-standard']");
    expect(source).toContain("['checkout', '--force', '--detach', commit]");
  });
});
