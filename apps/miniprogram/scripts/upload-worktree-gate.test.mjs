import { describe, expect, it, vi } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFileManifest } from './build-tools.mjs';
import { runCiCommand } from './miniprogram-ci-helpers.mjs';

const head = 'a'.repeat(40);
const candidate = {
  head,
  shortHead: head.slice(0, 7),
  version: '0.1.0-p10.20260905.999',
  profile: 'production',
  description: `fixture-${head.slice(0, 7)}`,
};
const environment = {
  WECHAT_CI_VERSION: candidate.version,
  WECHAT_CI_DESCRIPTION: candidate.description,
};
function fixture() {
  const upload = vi.fn();
  return {
    upload,
    dependencies: {
      allocateNextTrialVersion: vi.fn(),
      buildMiniProgram: vi.fn(async () => ({
        files: [{ path: 'app.js', sha256: 'fixture' }],
        outputDirectory: 'fixture',
      })),
      inspectTrialCandidate: async () => candidate,
      confirmTrialCandidate: async () => candidate,
      configureMiniprogramCiModulePath: () => undefined,
      loadProjectIdentity: async () => ({ appid: 'fixture' }),
      loadCiModule: async () => ({ Project: class {}, upload }),
      resolveCiCredentials: () => ({ privateKeyPath: 'fixture', robot: 1 }),
      readBuildProfile: async () => ({ buildTime: '2026-09-05T00:00:00Z' }),
      assertBuildProfileMatchesCandidate: () => undefined,
      reserveTrialVersion: vi.fn(async () => ({ reservation: 'created' })),
      writeTrialReceipt: vi.fn(async () => 'fixture-receipt'),
      recordTrialAllocation: vi.fn(),
      bindTrialManifest: vi.fn(),
      verifyBuildManifest: vi.fn(),
      withTrialUploadLock: async (_options, operation) => operation(),
    },
  };
}

describe('mandatory upload worktree gate', () => {
  it('rehashes the actual output and blocks files modified after build before reservation', async () => {
    const scratch = fileURLToPath(
      new URL('../../../runtime/codex/ci-manifest-fixtures/', import.meta.url),
    );
    await mkdir(scratch, { recursive: true });
    const outputDirectory = await mkdtemp(path.join(scratch, 'case-'));
    const f = fixture();
    f.dependencies.checkUploadCandidate = () => ({ head });
    delete f.dependencies.verifyBuildManifest;
    f.dependencies.buildMiniProgram = async () => {
      await writeFile(path.join(outputDirectory, 'app.js'), 'original');
      return { outputDirectory, files: createFileManifest(outputDirectory) };
    };
    f.dependencies.loadCiModule = async () => {
      await writeFile(path.join(outputDirectory, 'app.js'), 'modified-after-build');
      return { Project: class {}, upload: f.upload };
    };
    try {
      await expect(
        runCiCommand(
          { action: 'upload-experience', dryRun: false, profile: 'production' },
          environment,
          f.dependencies,
        ),
      ).rejects.toThrow(/manifest mismatch/u);
      expect(f.dependencies.reserveTrialVersion).not.toHaveBeenCalled();
      expect(f.upload).not.toHaveBeenCalled();
    } finally {
      expect(path.dirname(outputDirectory)).toBe(path.resolve(scratch));
      await rm(outputDirectory, { recursive: true });
    }
  });

  it('rejects a real upload without lease/RUN_ID before allocation, build or external calls', async () => {
    const f = fixture();
    await expect(
      runCiCommand(
        { action: 'upload-experience', dryRun: false, profile: 'production' },
        environment,
        f.dependencies,
      ),
    ).rejects.toThrow(/SCHEDULE_UPLOAD_RUN_ID|lease/iu);
    expect(f.dependencies.buildMiniProgram).not.toHaveBeenCalled();
    expect(f.dependencies.allocateNextTrialVersion).not.toHaveBeenCalled();
    expect(f.dependencies.reserveTrialVersion).not.toHaveBeenCalled();
    expect(f.upload).not.toHaveBeenCalled();
  });

  it('rechecks ownership after building and rejects a lost lease before reservation or upload', async () => {
    const f = fixture();
    let checks = 0;
    f.dependencies.checkUploadCandidate = vi.fn(() => {
      if (++checks === 2) throw new Error('synthetic lost lease');
      return { head };
    });
    await expect(
      runCiCommand(
        { action: 'upload-experience', dryRun: false, profile: 'production' },
        environment,
        f.dependencies,
      ),
    ).rejects.toThrow(/synthetic lost lease/u);
    expect(checks).toBe(2);
    expect(f.dependencies.buildMiniProgram).toHaveBeenCalledOnce();
    expect(f.dependencies.reserveTrialVersion).not.toHaveBeenCalled();
    expect(f.upload).not.toHaveBeenCalled();
  });
});
