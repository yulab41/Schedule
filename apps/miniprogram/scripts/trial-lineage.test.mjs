import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import { runCiCommand } from './miniprogram-ci-helpers.mjs';
import {
  allocateNextTrialVersion,
  assertBuildProfileMatchesCandidate,
  assertTrialCandidateFacts,
  evaluateEquivalentProof,
  inspectTrialCandidate,
  loadTrialHistory,
  loadTrialPolicy,
  parseTrialVersion,
  reserveTrialVersion,
  validateTrialConfiguration,
  writeTrialReceipt,
} from './trial-lineage.mjs';

const REPOSITORY_ROOT = path.resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const TEST_RUNTIME_ROOT = path.join(REPOSITORY_ROOT, 'runtime');
const REQUIRED_ICON_CHECKPOINT = '5285dd17a78793f2e62e1afcb0a7ef65f6ae57c1';
const REQUIRED_SOURCE_MIGRATION = '1ffab10c3f30987e31db47eb555f9e0aef0bf787';
const REQUIRED_MOTION_CANDIDATE = '71110712d41756d19e95a50ecf5aa0d083728da1';

function git(repositoryRoot, args) {
  return execFileSync('git', args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

async function createRemoteFixture() {
  await mkdir(TEST_RUNTIME_ROOT, { recursive: true });
  const fixtureRoot = await mkdtemp(path.join(TEST_RUNTIME_ROOT, 'test-trial-lineage-'));
  const remoteRoot = path.join(fixtureRoot, 'remote.git');
  const seedRoot = path.join(fixtureRoot, 'seed');
  const firstRoot = path.join(fixtureRoot, 'candidate-a');
  const secondRoot = path.join(fixtureRoot, 'candidate-b');

  git(fixtureRoot, ['init', '--bare', remoteRoot]);
  git(fixtureRoot, ['init', '--initial-branch=main', seedRoot]);
  git(seedRoot, ['config', 'user.name', 'Schedule Test']);
  git(seedRoot, ['config', 'user.email', 'schedule-test@example.invalid']);
  await writeFile(path.join(seedRoot, 'baseline.txt'), 'baseline\n', 'utf8');
  git(seedRoot, ['add', 'baseline.txt']);
  git(seedRoot, ['commit', '-m', 'test: baseline']);
  const baselineCommit = git(seedRoot, ['rev-parse', 'HEAD']);
  git(seedRoot, ['remote', 'add', 'origin', remoteRoot]);
  git(seedRoot, ['push', '-u', 'origin', 'main']);
  git(remoteRoot, ['symbolic-ref', 'HEAD', 'refs/heads/main']);

  for (const cloneRoot of [firstRoot, secondRoot]) {
    git(fixtureRoot, ['clone', remoteRoot, cloneRoot]);
    git(cloneRoot, ['config', 'user.name', 'Schedule Test']);
    git(cloneRoot, ['config', 'user.email', 'schedule-test@example.invalid']);
  }

  await writeFile(path.join(firstRoot, 'candidate.txt'), 'candidate-a\n', 'utf8');
  git(firstRoot, ['add', 'candidate.txt']);
  git(firstRoot, ['commit', '-m', 'test: candidate a']);
  const firstCommit = git(firstRoot, ['rev-parse', 'HEAD']);

  await writeFile(path.join(secondRoot, 'candidate.txt'), 'candidate-b\n', 'utf8');
  git(secondRoot, ['add', 'candidate.txt']);
  git(secondRoot, ['commit', '-m', 'test: candidate b']);
  const secondCommit = git(secondRoot, ['rev-parse', 'HEAD']);

  return {
    baselineCommit,
    firstCommit,
    firstRoot,
    fixtureRoot,
    remoteRoot,
    secondCommit,
    secondRoot,
  };
}

function createPolicy(requiredCommit = REQUIRED_ICON_CHECKPOINT) {
  return {
    lastSequence: 85,
    mainBranch: 'main',
    remote: 'origin',
    requiredCheckpoints: [
      {
        commit: requiredCommit,
        reason: 'Required test checkpoint.',
      },
    ],
    schemaVersion: 1,
    tagPrefix: 'miniprogram-trial/',
    versionPrefix: '0.1.0-p10',
  };
}

function createEquivalentPolicy() {
  const policy = createPolicy();
  const actualCheckpoint = loadTrialPolicy().requiredCheckpoints.find(
    ({ commit }) => commit === REQUIRED_ICON_CHECKPOINT,
  );
  policy.requiredCheckpoints[0].equivalentProof = structuredClone(actualCheckpoint.equivalentProof);
  return policy;
}

function createTestHistory() {
  const history = structuredClone(loadTrialHistory());
  history.sequenceRange.to = 85;
  history.entries = history.entries.filter(({ sequence }) => sequence <= 85);
  return history;
}

function createCandidateFacts(overrides = {}) {
  const head = 'abcdef0123456789abcdef0123456789abcdef01';
  return {
    description: `EXP-ICON-004 B1 candidate ${head.slice(0, 7)}`,
    dirty: false,
    existingVersionCommit: null,
    head,
    latestTrial: null,
    originMain: {
      commit: '1111111111111111111111111111111111111111',
      isAncestor: true,
    },
    profile: 'production',
    requiredCheckpoints: [
      {
        commit: REQUIRED_ICON_CHECKPOINT,
        isAncestor: true,
      },
    ],
    version: '0.1.0-p10.20260904.86',
    ...overrides,
  };
}

describe('trial lineage history and policy', () => {
  it('tracks every legacy sequence from .74 through .86 and marks every collision', () => {
    const history = loadTrialHistory();
    const policy = loadTrialPolicy();

    expect(() => validateTrialConfiguration(history, policy)).not.toThrow();
    expect(history.entries.map(({ sequence }) => sequence)).toEqual([
      74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86,
    ]);
    expect(
      history.entries.filter(({ collision }) => collision).map(({ sequence }) => sequence),
    ).toEqual([74, 81, 82]);
    expect(history.entries.find(({ sequence }) => sequence === 77)?.events).toEqual([
      expect.objectContaining({ platformAction: 'dry-run-only', version: null }),
    ]);
    expect(history.entries.find(({ sequence }) => sequence === 85)?.events).toEqual([
      expect.objectContaining({
        commit: 'a1bba5710cfd5c94b5fd5148898e4f17e45faab9',
        version: '0.1.0-p10.20260903.85',
      }),
    ]);
    expect(history.entries.find(({ sequence }) => sequence === 86)?.events).toEqual([
      expect.objectContaining({
        commit: '8caa5f201b373fadd9453b8e4ec02fc3f93fe0cb',
        version: '0.1.0-p10.20260904.86',
      }),
    ]);
    expect(policy).toMatchObject({ lastSequence: 86, schemaVersion: 1 });
    expect(policy.requiredCheckpoints).toContainEqual(
      expect.objectContaining({ commit: REQUIRED_ICON_CHECKPOINT }),
    );
    expect(policy.requiredCheckpoints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ commit: REQUIRED_SOURCE_MIGRATION }),
        expect.objectContaining({ commit: REQUIRED_ICON_CHECKPOINT }),
        expect.objectContaining({ commit: REQUIRED_MOTION_CANDIDATE }),
      ]),
    );
  });

  it('rejects an unmarked legacy sequence collision', () => {
    const history = structuredClone(loadTrialHistory());
    const policy = loadTrialPolicy();
    history.entries.find(({ sequence }) => sequence === 81).collision = false;

    expect(() => validateTrialConfiguration(history, policy)).toThrow(/collision.*\.81/iu);
  });

  it('parses only the explicit global trial version syntax', () => {
    const policy = loadTrialPolicy();

    expect(parseTrialVersion('0.1.0-p10.20260904.86', policy)).toEqual({
      date: '20260904',
      sequence: 86,
      version: '0.1.0-p10.20260904.86',
    });
    expect(() => parseTrialVersion('local', policy)).toThrow(/trial version/iu);
    expect(() => parseTrialVersion('0.1.0-p10.20260230.86', policy)).toThrow(/calendar date/iu);
  });

  it('allocates the next sequence from the tracked floor and remote reservations', async () => {
    const runGit = vi.fn(async (arguments_) => ({
      code: 0,
      stderr: '',
      stdout:
        arguments_[0] === 'ls-remote'
          ? [
              `${'a'.repeat(40)} refs/tags/miniprogram-trial/0.1.0-p10.20260904.87`,
              `${'b'.repeat(40)} refs/tags/miniprogram-trial/0.1.0-p10.20260905.88`,
            ].join('\n')
          : '',
    }));

    await expect(
      allocateNextTrialVersion(
        { now: new Date('2026-09-05T00:00:00.000Z'), repositoryRoot: 'fixture-root' },
        { runGit },
      ),
    ).resolves.toBe('0.1.0-p10.20260905.89');
    expect(runGit).toHaveBeenCalledWith(
      expect.arrayContaining(['ls-remote', '--refs', '--tags', 'origin']),
      expect.objectContaining({ cwd: path.resolve('fixture-root') }),
    );
  });
});

describe('trial candidate preflight', () => {
  it('matches every canonical proof file against the candidate tree', async () => {
    const checkpoint = loadTrialPolicy().requiredCheckpoints.find(
      ({ commit }) => commit === REQUIRED_ICON_CHECKPOINT,
    );
    const blobs = new Map(
      checkpoint.equivalentProof.files.map(({ path: file, blob }) => [file, blob]),
    );
    const runGit = vi.fn(async (arguments_) => ({
      code: 0,
      stderr: '',
      stdout: arguments_[0] === 'rev-parse' ? blobs.get(arguments_[1].slice('HEAD:'.length)) : '',
    }));

    await expect(
      evaluateEquivalentProof(runGit, 'fixture-root', checkpoint),
    ).resolves.toMatchObject({
      equivalent: true,
      strategy: 'canonical-tree-files',
    });
  });

  it('accepts only a clean production cumulative candidate with traceable metadata', () => {
    const policy = createPolicy();

    expect(assertTrialCandidateFacts(createCandidateFacts(), policy)).toMatchObject({
      sequence: 86,
      shortHead: 'abcdef0',
    });

    const invalidFacts = [
      [createCandidateFacts({ dirty: true }), /clean working tree/iu],
      [createCandidateFacts({ profile: 'staging' }), /production profile/iu],
      [createCandidateFacts({ version: 'local' }), /trial version/iu],
      [createCandidateFacts({ description: 'missing commit identity' }), /description.*abcdef0/iu],
      [
        createCandidateFacts({
          originMain: {
            commit: '1111111111111111111111111111111111111111',
            isAncestor: false,
          },
        }),
        /origin\/main.*ancestor/iu,
      ],
      [
        createCandidateFacts({
          requiredCheckpoints: [
            {
              commit: REQUIRED_ICON_CHECKPOINT,
              isAncestor: false,
            },
          ],
        }),
        /required checkpoint.*5285dd1/iu,
      ],
      [
        createCandidateFacts({
          latestTrial: {
            commit: '2222222222222222222222222222222222222222',
            isAncestor: false,
            sequence: 86,
            version: '0.1.0-p10.20260904.86',
          },
          version: '0.1.0-p10.20260904.87',
        }),
        /latest cumulative trial.*ancestor/iu,
      ],
      [createCandidateFacts({ version: '0.1.0-p10.20260904.85' }), /greater than 85/iu],
    ];

    for (const [facts, expectedError] of invalidFacts) {
      expect(() => assertTrialCandidateFacts(facts, policy)).toThrow(expectedError);
    }
  });

  it('allows an idempotent retry only when the exact version is bound to the same HEAD', () => {
    const policy = createPolicy();
    const facts = createCandidateFacts();

    expect(
      assertTrialCandidateFacts(
        {
          ...facts,
          existingVersionCommit: facts.head,
          latestTrial: {
            commit: facts.head,
            isAncestor: true,
            sequence: 86,
            version: facts.version,
          },
        },
        policy,
      ),
    ).toMatchObject({ reservation: 'idempotent' });

    expect(() =>
      assertTrialCandidateFacts(
        {
          ...facts,
          existingVersionCommit: '9999999999999999999999999999999999999999',
          latestTrial: {
            commit: '9999999999999999999999999999999999999999',
            isAncestor: false,
            sequence: 86,
            version: facts.version,
          },
        },
        policy,
      ),
    ).toThrow(/already reserved.*different commit/iu);
  });

  it('accepts a tracked old trial only when every required feature has a canonical equivalent proof', () => {
    const policy = createEquivalentPolicy();
    const facts = createCandidateFacts({
      latestTrial: {
        commit: '2222222222222222222222222222222222222222',
        isAncestor: false,
        sequence: 86,
        trackedHistory: true,
        version: '0.1.0-p10.20260904.86',
      },
      requiredCheckpoints: [
        {
          commit: REQUIRED_ICON_CHECKPOINT,
          equivalent: true,
          isAncestor: false,
        },
      ],
      version: '0.1.0-p10.20260905.87',
    });

    expect(assertTrialCandidateFacts(facts, policy)).toMatchObject({
      reservation: 'new',
      sequence: 87,
    });

    expect(() =>
      assertTrialCandidateFacts(
        {
          ...facts,
          latestTrial: { ...facts.latestTrial, trackedHistory: false },
        },
        policy,
      ),
    ).toThrow(/latest cumulative trial.*ancestor/iu);
  });

  it('freshly fetches origin/main and rejects a candidate made stale by a parallel branch', async () => {
    const fixture = await createRemoteFixture();
    const history = createTestHistory();
    const policy = createPolicy(fixture.baselineCommit);
    const description = `lineage candidate ${fixture.firstCommit.slice(0, 7)}`;

    try {
      await expect(
        inspectTrialCandidate(
          {
            description,
            profile: 'production',
            repositoryRoot: fixture.firstRoot,
            version: '0.1.0-p10.20260904.86',
          },
          { history, policy },
        ),
      ).resolves.toMatchObject({ head: fixture.firstCommit });

      git(fixture.secondRoot, ['push', 'origin', 'HEAD:main']);

      await expect(
        inspectTrialCandidate(
          {
            description,
            profile: 'production',
            repositoryRoot: fixture.firstRoot,
            version: '0.1.0-p10.20260904.86',
          },
          { history, policy },
        ),
      ).rejects.toThrow(/origin\/main.*ancestor/iu);
    } finally {
      await rm(fixture.fixtureRoot, { force: true, recursive: true });
    }
  }, 30_000);
});

describe('remote trial version reservation', () => {
  it('lets only one of two candidates claim a new remote tag and keeps retries immutable', async () => {
    const fixture = await createRemoteFixture();
    const policy = createPolicy(fixture.baselineCommit);
    const version = '0.1.0-p10.20260904.86';

    try {
      const attempts = await Promise.allSettled([
        reserveTrialVersion(
          {
            head: fixture.firstCommit,
            repositoryRoot: fixture.firstRoot,
            version,
          },
          { policy },
        ),
        reserveTrialVersion(
          {
            head: fixture.secondCommit,
            repositoryRoot: fixture.secondRoot,
            version,
          },
          { policy },
        ),
      ]);
      const successes = attempts.filter(({ status }) => status === 'fulfilled');
      const failures = attempts.filter(({ status }) => status === 'rejected');

      expect(successes).toHaveLength(1);
      expect(failures).toHaveLength(1);
      expect(failures[0].reason).toMatchObject({
        message: expect.stringMatching(/already reserved.*different commit/iu),
      });

      const winner = successes[0].value;
      const winnerRoot =
        winner.head === fixture.firstCommit ? fixture.firstRoot : fixture.secondRoot;
      const loserRoot = winnerRoot === fixture.firstRoot ? fixture.secondRoot : fixture.firstRoot;
      const loserHead =
        winnerRoot === fixture.firstRoot ? fixture.secondCommit : fixture.firstCommit;

      await expect(
        reserveTrialVersion({ head: winner.head, repositoryRoot: winnerRoot, version }, { policy }),
      ).resolves.toMatchObject({ reservation: 'idempotent' });
      await expect(
        reserveTrialVersion({ head: loserHead, repositoryRoot: loserRoot, version }, { policy }),
      ).rejects.toThrow(/already reserved.*different commit/iu);
      expect(
        git(fixture.remoteRoot, ['rev-parse', `refs/tags/${policy.tagPrefix}${version}`]),
      ).toBe(winner.head);
      await expect(
        inspectTrialCandidate(
          {
            description: `retry ${winner.head.slice(0, 7)}`,
            profile: 'production',
            repositoryRoot: winnerRoot,
            version,
          },
          { history: createTestHistory(), policy },
        ),
      ).resolves.toMatchObject({ reservation: 'idempotent' });
    } finally {
      await rm(fixture.fixtureRoot, { force: true, recursive: true });
    }
  }, 30_000);
});

describe('build identity, receipt, and upload integration', () => {
  it('requires the production build profile to exactly match the inspected candidate', () => {
    const facts = createCandidateFacts();
    const candidate = {
      description: facts.description,
      head: facts.head,
      profile: facts.profile,
      shortHead: facts.head.slice(0, 7),
      version: facts.version,
    };
    const buildProfile = {
      buildCommit: candidate.shortHead,
      buildDescription: candidate.description,
      buildDirty: false,
      buildTime: '2026-09-04T00:00:00.000Z',
      buildVersion: candidate.version,
      profile: 'production',
      schemaVersion: 1,
    };

    expect(() => assertBuildProfileMatchesCandidate(buildProfile, candidate)).not.toThrow();
    for (const [field, value] of [
      ['buildCommit', '9999999'],
      ['buildDescription', 'different description'],
      ['buildDirty', true],
      ['buildVersion', '0.1.0-p10.20260904.87'],
      ['profile', 'staging'],
    ]) {
      expect(() =>
        assertBuildProfileMatchesCandidate({ ...buildProfile, [field]: value }, candidate),
      ).toThrow(/build-profile.*candidate/iu);
    }
  });

  it('writes a redacted ignored receipt only after an upload succeeds', async () => {
    await mkdir(TEST_RUNTIME_ROOT, { recursive: true });
    const fixtureRoot = await mkdtemp(path.join(TEST_RUNTIME_ROOT, 'test-trial-receipt-'));
    const receiptRoot = path.join(fixtureRoot, 'receipts');
    const facts = createCandidateFacts();
    const candidate = {
      description: facts.description,
      head: facts.head,
      profile: facts.profile,
      shortHead: facts.head.slice(0, 7),
      version: facts.version,
    };
    const verifyIgnored = vi.fn(async () => true);

    try {
      const receiptPath = await writeTrialReceipt(
        {
          buildTime: '2026-09-04T00:00:00.000Z',
          candidate,
          manifestDigest: 'a'.repeat(64),
          reservation: 'created',
          uploadedAt: '2026-09-04T01:00:00.000Z',
        },
        { receiptRoot, verifyIgnored },
      );
      const receipt = JSON.parse(await readFile(receiptPath, 'utf8'));

      expect(verifyIgnored).toHaveBeenCalledOnce();
      expect(receipt).toEqual({
        buildTime: '2026-09-04T00:00:00.000Z',
        commit: candidate.head,
        description: candidate.description,
        manifestDigest: 'a'.repeat(64),
        profile: 'production',
        reservation: 'created',
        schemaVersion: 1,
        tag: `miniprogram-trial/${candidate.version}`,
        uploadedAt: '2026-09-04T01:00:00.000Z',
        version: candidate.version,
      });
      expect(JSON.stringify(receipt)).not.toMatch(/appid|private|credential|token/iu);
    } finally {
      await rm(fixtureRoot, { force: true, recursive: true });
    }
  });

  it('keeps dry-runs external-state free and orders reservation before upload and receipt', async () => {
    const forbidden = vi.fn(() => {
      throw new Error('external lineage operation must not run');
    });
    const dryRun = await runCiCommand(
      { action: 'upload-experience', dryRun: true, profile: 'production' },
      {},
      {
        buildMiniProgram: async () => ({ files: [{ path: 'app.js', sha256: 'fixture' }] }),
        inspectTrialCandidate: forbidden,
        reserveTrialVersion: forbidden,
        writeTrialReceipt: forbidden,
      },
    );

    expect(dryRun.externalStateChanged).toBe(false);
    expect(forbidden).not.toHaveBeenCalled();

    const order = [];
    const facts = createCandidateFacts();
    const candidate = {
      description: facts.description,
      head: facts.head,
      profile: facts.profile,
      repositoryRoot: REPOSITORY_ROOT,
      shortHead: facts.head.slice(0, 7),
      version: facts.version,
    };
    const buildProfile = {
      buildCommit: candidate.shortHead,
      buildDescription: candidate.description,
      buildDirty: false,
      buildTime: '2026-09-04T00:00:00.000Z',
      buildVersion: candidate.version,
      profile: candidate.profile,
      schemaVersion: 1,
    };
    const upload = vi.fn(async () => order.push('upload'));
    const result = await runCiCommand(
      { action: 'upload-experience', dryRun: false, profile: 'production' },
      {
        WECHAT_CI_DESCRIPTION: candidate.description,
        WECHAT_CI_VERSION: candidate.version,
      },
      {
        assertBuildProfileMatchesCandidate: () => order.push('assert-build-profile'),
        buildMiniProgram: async (options) => {
          order.push('build');
          expect(options).toMatchObject({
            buildCommit: candidate.shortHead,
            buildDescription: candidate.description,
            buildDirty: false,
            buildVersion: candidate.version,
            profile: 'production',
          });
          return { files: [{ path: 'app.js', sha256: 'fixture' }], outputDirectory: 'fixture' };
        },
        configureMiniprogramCiModulePath: () => order.push('configure-ci'),
        confirmTrialCandidate: async () => {
          order.push('confirm');
          return candidate;
        },
        inspectTrialCandidate: async () => {
          order.push('inspect');
          return candidate;
        },
        loadCiModule: async () => ({
          Project: class Project {},
          upload,
        }),
        loadProjectIdentity: async () => ({ appid: 'fixture-appid' }),
        readBuildProfile: async () => {
          order.push('read-build-profile');
          return buildProfile;
        },
        reserveTrialVersion: async () => {
          order.push('reserve');
          return { head: candidate.head, reservation: 'created', version: candidate.version };
        },
        resolveCiCredentials: () => ({ privateKeyPath: 'fixture-private-key', robot: 1 }),
        writeTrialReceipt: async () => {
          order.push('receipt');
          return 'runtime/audit/miniprogram-trials/fixture.json';
        },
      },
    );

    expect(result).toMatchObject({
      externalStateChanged: true,
      receipt: 'runtime/audit/miniprogram-trials/fixture.json',
      version: candidate.version,
    });
    expect(order).toEqual([
      'inspect',
      'build',
      'configure-ci',
      'confirm',
      'read-build-profile',
      'assert-build-profile',
      'reserve',
      'upload',
      'receipt',
    ]);
  });

  it('keeps real previews independent of cumulative trial tags', async () => {
    const forbidden = vi.fn(() => {
      throw new Error('trial lineage must not run for preview');
    });
    const preview = vi.fn(async () => undefined);

    const result = await runCiCommand(
      { action: 'preview', dryRun: false, profile: 'production' },
      {},
      {
        buildMiniProgram: async () => ({ files: [{ path: 'app.js', sha256: 'fixture' }] }),
        configureMiniprogramCiModulePath: () => undefined,
        confirmTrialCandidate: forbidden,
        inspectTrialCandidate: forbidden,
        loadCiModule: async () => ({
          Project: class Project {},
          preview,
        }),
        loadProjectIdentity: async () => ({ appid: 'fixture-appid' }),
        reserveTrialVersion: forbidden,
        resolveCiCredentials: () => ({ privateKeyPath: 'fixture-private-key', robot: 1 }),
        writeTrialReceipt: forbidden,
      },
    );

    expect(result).toMatchObject({
      action: 'preview',
      externalStateChanged: true,
      profile: 'production',
    });
    expect(preview).toHaveBeenCalledOnce();
    expect(forbidden).not.toHaveBeenCalled();
  });

  it('keeps a reserved version consumed and omits the receipt when upload fails', async () => {
    const facts = createCandidateFacts();
    const candidate = {
      description: facts.description,
      head: facts.head,
      profile: facts.profile,
      repositoryRoot: REPOSITORY_ROOT,
      shortHead: facts.head.slice(0, 7),
      version: facts.version,
    };
    const reserveTrialVersion = vi.fn(async () => ({
      head: candidate.head,
      reservation: 'created',
      version: candidate.version,
    }));
    const writeTrialReceipt = vi.fn();

    await expect(
      runCiCommand(
        { action: 'upload-experience', dryRun: false, profile: 'production' },
        {
          WECHAT_CI_DESCRIPTION: candidate.description,
          WECHAT_CI_VERSION: candidate.version,
        },
        {
          assertBuildProfileMatchesCandidate: () => undefined,
          buildMiniProgram: async () => ({
            files: [{ path: 'app.js', sha256: 'fixture' }],
            outputDirectory: 'fixture',
          }),
          configureMiniprogramCiModulePath: () => undefined,
          confirmTrialCandidate: async () => candidate,
          inspectTrialCandidate: async () => candidate,
          loadCiModule: async () => ({
            Project: class Project {},
            upload: async () => {
              throw new Error('fixture upload failed');
            },
          }),
          loadProjectIdentity: async () => ({ appid: 'fixture-appid' }),
          readBuildProfile: async () => ({
            buildTime: '2026-09-04T00:00:00.000Z',
          }),
          reserveTrialVersion,
          resolveCiCredentials: () => ({ privateKeyPath: 'fixture-private-key', robot: 1 }),
          writeTrialReceipt,
        },
      ),
    ).rejects.toThrow(/fixture upload failed/iu);

    expect(reserveTrialVersion).toHaveBeenCalledOnce();
    expect(writeTrialReceipt).not.toHaveBeenCalled();
  });
});
