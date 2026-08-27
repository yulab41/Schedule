import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { APP_ROOT } from './build-tools.mjs';
import {
  MINIPROGRAM_CI_SETTINGS,
  configureMiniprogramCiModulePath,
  parseCiArguments,
  redactText,
  resolveCiCredentials,
  resolveUploadMetadata,
  runCiCommand,
} from './miniprogram-ci-helpers.mjs';

describe('miniprogram-ci helpers', () => {
  it('always compiles Worklet functions in official preview and upload builds', () => {
    expect(MINIPROGRAM_CI_SETTINGS).toMatchObject({
      compileWorklet: true,
      ignoreUploadUnusedFiles: false,
    });
  });

  it('supports only preview and experience upload actions', () => {
    expect(parseCiArguments(['preview', '--profile=staging', '--dry-run'])).toEqual({
      action: 'preview',
      dryRun: true,
      profile: 'staging',
    });
    expect(parseCiArguments(['upload-experience', '--profile=production'])).toEqual({
      action: 'upload-experience',
      dryRun: false,
      profile: 'production',
    });
    expect(() => parseCiArguments(['release'])).toThrow(/preview.*upload-experience/);
  });

  it('performs a credential-free dry run without changing external state', async () => {
    const result = await runCiCommand({
      action: 'preview',
      dryRun: true,
      profile: 'staging',
    });

    expect(result.externalStateChanged).toBe(false);
    expect(result.manifestDigest).toMatch(/^[a-f0-9]{64}$/);
  });

  it('requires upload keys to remain outside the repository', async () => {
    expect(() =>
      resolveCiCredentials({
        WECHAT_CI_PRIVATE_KEY_PATH: path.join(APP_ROOT, 'project.config.json'),
      }),
    ).toThrow(/outside the repository/);

    const temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'schedule-wechat-ci-'));
    const privateKeyPath = path.join(temporaryDirectory, 'private.key');
    await writeFile(privateKeyPath, 'fixture-only');

    try {
      expect(
        resolveCiCredentials({
          WECHAT_CI_PRIVATE_KEY_PATH: privateKeyPath,
          WECHAT_CI_ROBOT: '3',
        }),
      ).toEqual({ privateKeyPath, robot: 3 });
    } finally {
      await rm(temporaryDirectory, { force: true, recursive: true });
    }
  });

  it('validates upload metadata and redacts known sensitive values', () => {
    expect(
      resolveUploadMetadata({
        WECHAT_CI_DESCRIPTION: 'P1 preview candidate',
        WECHAT_CI_VERSION: '0.1.0-p1',
      }),
    ).toEqual({ description: 'P1 preview candidate', version: '0.1.0-p1' });
    expect(() =>
      resolveUploadMetadata({ WECHAT_CI_DESCRIPTION: 'candidate', WECHAT_CI_VERSION: 'latest' }),
    ).toThrow(/semantic version/);
    expect(redactText('appid=CREDENTIAL path=C:\\key', ['CREDENTIAL', 'C:\\key'])).toBe(
      'appid=[REDACTED] path=[REDACTED]',
    );
  });

  it('exposes miniprogram-ci bundled compiler dependencies to worker processes', () => {
    const existingRoot = path.resolve('fixture-existing');
    const sharedRoot = path.resolve('fixture-shared');
    const environment = { NODE_PATH: `${existingRoot}${path.delimiter}${sharedRoot}` };
    const dependencyRoot = path.resolve('fixture-ci', 'node_modules');
    const resolvedSpecifiers = [];
    const resolvePackage = (specifier) => {
      resolvedSpecifiers.push(specifier);
      return specifier === 'miniprogram-ci/package.json'
        ? path.join(dependencyRoot, 'miniprogram-ci', 'package.json')
        : path.join(existingRoot, '@babel', 'preset-typescript', 'package.json');
    };
    const resolvedRoot = configureMiniprogramCiModulePath(environment, resolvePackage);

    expect(resolvedRoot).toBe(dependencyRoot);
    expect(resolvedSpecifiers).toEqual([
      'miniprogram-ci/package.json',
      '@babel/preset-typescript/package.json',
    ]);
    expect(environment.__MINIPROGRAM_CI_TEST__).toBe('true');
    expect(environment.NODE_PATH.split(path.delimiter)).toEqual([
      dependencyRoot,
      existingRoot,
      sharedRoot,
    ]);

    configureMiniprogramCiModulePath(environment, resolvePackage);
    expect(environment.NODE_PATH.split(path.delimiter)).toHaveLength(3);
  });
});
