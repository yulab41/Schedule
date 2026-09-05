import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  allocateNextTrialVersion,
  bindTrialManifest,
  readLocalTrialAllocations,
  recordTrialAllocation,
  withTrialUploadLock,
} from './trial-lineage.mjs';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const scratch = path.join(project, 'runtime/codex/trial-lock-fixtures');
const version = '0.1.0-p10.20260905.9000';
const commit = 'a'.repeat(40);
async function fixture() {
  await mkdir(scratch, { recursive: true });
  const root = await mkdtemp(path.join(scratch, 'case-'));
  return {
    root,
    options: {
      receiptRoot: path.join(root, 'runtime/audit/miniprogram-trials'),
      verifyIgnored: async () => true,
    },
    candidate: {
      version,
      head: commit,
      profile: 'production',
      description: `fixture-${commit.slice(0, 7)}`,
      repositoryRoot: root,
    },
  };
}
async function dispose(f) {
  expect(path.dirname(f.root)).toBe(scratch);
  await rm(f.root, { recursive: true });
}

describe('existing allocator and immutable upload records', () => {
  it('does not reassign a locally allocated version when a build failed before remote reservation', async () => {
    let allocate = allocateNextTrialVersion;
    if (process.env.SCHEDULE_TRIAL_TEST_BASELINE === '1') {
      const modulePath = fileURLToPath(new URL('./trial-lineage.mjs', import.meta.url));
      const source = execFileSync(
        'git',
        ['show', 'cdb759b9:apps/miniprogram/scripts/trial-lineage.mjs'],
        { cwd: project, encoding: 'utf8', windowsHide: true },
      ).replaceAll('import.meta.url', JSON.stringify(pathToFileURL(modulePath).href));
      allocate = (
        await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
      ).allocateNextTrialVersion;
    }
    const result = await allocate(
      { now: new Date('2026-09-05T00:00:00Z'), repositoryRoot: project },
      {
        runGit: async () => ({ code: 0, stdout: '', stderr: '' }),
        readLocalTrialAllocations: async () => [{ version, commit }],
      },
    );
    expect(result).toBe('0.1.0-p10.20260905.9001');
  });

  it('binds version to SHA and manifest immutably without changing an earlier binding', async () => {
    const f = await fixture();
    try {
      await recordTrialAllocation(f.candidate, f.options);
      const payload = {
        candidate: f.candidate,
        manifestDigest: 'b'.repeat(64),
        buildTime: '2026-09-05T00:00:00Z',
      };
      const file = await bindTrialManifest(payload, f.options);
      const original = await readFile(file, 'utf8');
      await expect(bindTrialManifest(payload, f.options)).resolves.toBe(file);
      await expect(
        bindTrialManifest({ ...payload, manifestDigest: 'c'.repeat(64) }, f.options),
      ).rejects.toThrow(/immutable.*conflict/iu);
      await expect(
        recordTrialAllocation({ ...f.candidate, head: 'd'.repeat(40) }, f.options),
      ).rejects.toThrow(/immutable.*conflict/iu);
      expect(await readFile(file, 'utf8')).toBe(original);
      expect(await readLocalTrialAllocations(f.root, f.options)).toHaveLength(1);
    } finally {
      await dispose(f);
    }
  });

  it('refuses uncertain reserved-version retry without original immutable manifest evidence', async () => {
    const f = await fixture();
    try {
      await expect(
        bindTrialManifest(
          {
            candidate: { ...f.candidate, reservation: 'idempotent' },
            manifestDigest: 'b'.repeat(64),
            buildTime: '2026-09-05T00:00:00Z',
          },
          f.options,
        ),
      ).rejects.toThrow(/without immutable manifest/u);
    } finally {
      await dispose(f);
    }
  });
});

describe('exclusive version allocation/upload lock', () => {
  it('excludes other RUN_IDs until completion and releases only its own lock', async () => {
    const f = await fixture();
    try {
      let entered = 0;
      await withTrialUploadLock(
        { repositoryRoot: f.root, runId: 'owner' },
        async () => {
          await expect(
            withTrialUploadLock(
              { repositoryRoot: f.root, runId: 'other' },
              async () => {
                entered++;
              },
              f.options,
            ),
          ).rejects.toThrow(/UPLOAD_VERSION_ALLOCATION_BLOCKED/u);
        },
        f.options,
      );
      await withTrialUploadLock(
        { repositoryRoot: f.root, runId: 'next' },
        async () => {
          entered++;
        },
        f.options,
      );
      expect(entered).toBe(1);
    } finally {
      await dispose(f);
    }
  });

  it('releases the operation lock on a failed build but retains the consumed allocation', async () => {
    const f = await fixture();
    try {
      await expect(
        withTrialUploadLock(
          { repositoryRoot: f.root, runId: 'owner' },
          async () => {
            await recordTrialAllocation(f.candidate, f.options);
            throw new Error('synthetic build failure');
          },
          f.options,
        ),
      ).rejects.toThrow(/synthetic build failure/u);
      expect(await readLocalTrialAllocations(f.root, f.options)).toHaveLength(1);
      await expect(
        withTrialUploadLock(
          { repositoryRoot: f.root, runId: 'next' },
          async () => 'ready',
          f.options,
        ),
      ).resolves.toBe('ready');
    } finally {
      await dispose(f);
    }
  });
});
