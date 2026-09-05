import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  assertNoPathLinks,
  validateCandidateFacts,
  validateUploadProfile,
} from './release-candidate-core.mjs';

const root = path.resolve('fixture-schedule');
const worktree = path.join(root, 'runtime/wt/slot-1');
const commit = 'a'.repeat(40);
const fingerprint = 'b'.repeat(64);
const now = Date.parse('2026-09-05T08:00:00Z');

function fixture() {
  return {
    root,
    worktree,
    expectedCommit: commit,
    head: commit,
    actualTopLevel: worktree,
    commonDir: path.join(root, '.git'),
    registered: true,
    detached: true,
    branch: undefined,
    ownerBranchHead: commit,
    clean: true,
    gitFile: true,
    leaseAncestor: true,
    runId: 'fixture-upload',
    leaseToken: 'fixture-token',
    now,
    outputDirectory: path.join(worktree, 'apps/miniprogram/dist'),
    slot: {
      schemaVersion: 2,
      permanence: 'permanent',
      path: worktree,
      commonDir: path.join(root, '.git'),
      status: 'leased',
      dependencyFingerprint: fingerprint,
    },
    lease: {
      schemaVersion: 2,
      path: worktree,
      status: 'leased',
      token: 'fixture-token',
      taskId: 'fixture-upload',
      sessionId: 'fixture-session',
      owner: 'fixture-owner',
      lastHeartbeat: '2026-09-05T07:59:00Z',
      head: commit,
      branch: 'refs/heads/codex/fixture-upload',
      dependencyFingerprint: fingerprint,
      releaseCandidate: {
        schemaVersion: 1,
        purpose: 'upload',
        runId: 'fixture-upload',
        commit,
        preparedAt: '2026-09-05T07:59:00Z',
        expiresAt: '2026-09-05T09:00:00Z',
        outputDirectory: path.join(worktree, 'apps/miniprogram/dist'),
      },
    },
    dependencies: {
      taskStatus: 'READY_REUSE',
      dependenciesReused: true,
      installInvoked: false,
      dependencyFingerprint: fingerprint,
    },
  };
}

test('a registered, owned, purpose-bound healthy warm upload slot is accepted', () => {
  assert.doesNotThrow(() => validateCandidateFacts(fixture()));
});

const invalid = [
  [
    'canonical root',
    (f) => {
      f.worktree = root;
    },
  ],
  [
    'retired fixed layout',
    (f) => {
      f.worktree = path.join(root, 'runtime/release-worktree');
    },
  ],
  [
    'unregistered worktree',
    (f) => {
      f.registered = false;
    },
  ],
  [
    'missing lease',
    (f) => {
      f.lease = null;
    },
  ],
  [
    'foreign token',
    (f) => {
      f.leaseToken = 'other-token';
    },
  ],
  [
    'foreign RUN_ID',
    (f) => {
      f.runId = 'other-run';
    },
  ],
  [
    'released lease',
    (f) => {
      f.lease.status = 'released';
    },
  ],
  [
    'expired upload lease',
    (f) => {
      f.lease.releaseCandidate.expiresAt = '2026-09-05T07:00:00Z';
    },
  ],
  [
    'expired base lease',
    (f) => {
      f.lease.expiresAt = '2026-09-05T07:00:00Z';
    },
  ],
  [
    'stale lease heartbeat',
    (f) => {
      f.lease.lastHeartbeat = '2026-09-04T07:00:00Z';
    },
  ],
  [
    'unbounded upload expiry',
    (f) => {
      f.lease.releaseCandidate.expiresAt = '2027-01-01T00:00:00Z';
    },
  ],
  [
    'invalid expiry',
    (f) => {
      f.lease.releaseCandidate.expiresAt = 'invalid';
    },
  ],
  [
    'unprepared development lease',
    (f) => {
      delete f.lease.releaseCandidate;
    },
  ],
  [
    'non-upload purpose',
    (f) => {
      f.lease.releaseCandidate.purpose = 'development';
    },
  ],
  [
    'outside approved root',
    (f) => {
      f.worktree = path.resolve('outside/slot');
    },
  ],
  [
    'nested pool path',
    (f) => {
      f.worktree = path.join(worktree, 'nested');
    },
  ],
  [
    'dot-dot escape',
    (f) => {
      f.worktree = worktree + '/../../outside';
    },
  ],
  [
    'HEAD mismatch',
    (f) => {
      f.head = 'c'.repeat(40);
    },
  ],
  [
    'lease candidate SHA mismatch',
    (f) => {
      f.lease.releaseCandidate.commit = 'c'.repeat(40);
    },
  ],
  [
    'dirty production tree',
    (f) => {
      f.clean = false;
    },
  ],
  [
    'foreign output',
    (f) => {
      f.outputDirectory = path.join(root, 'runtime/wt/other/apps/miniprogram/dist');
    },
  ],
  [
    'foreign recorded output',
    (f) => {
      f.lease.releaseCandidate.outputDirectory = path.join(
        root,
        'runtime/wt/other/apps/miniprogram/dist',
      );
    },
  ],
  [
    'output path alias',
    (f) => {
      f.outputDirectory = path.join(worktree, 'apps') + '/unused/../miniprogram/dist';
    },
  ],
  [
    'foreign Git common directory',
    (f) => {
      f.commonDir = path.resolve('other/.git');
    },
  ],
  [
    'false top level',
    (f) => {
      f.actualTopLevel = root;
    },
  ],
  [
    'branch attached',
    (f) => {
      f.detached = false;
      f.branch = f.lease.branch;
    },
  ],
  [
    'owner branch advanced',
    (f) => {
      f.ownerBranchHead = 'c'.repeat(40);
    },
  ],
  [
    'unrelated lease base',
    (f) => {
      f.leaseAncestor = false;
    },
  ],
  [
    'missing Git file',
    (f) => {
      f.gitFile = false;
    },
  ],
  [
    'quarantined slot',
    (f) => {
      f.slot.status = 'quarantined-dependency';
    },
  ],
  [
    'foreign slot record',
    (f) => {
      f.slot.path = root;
    },
  ],
  [
    'dependency MISS',
    (f) => {
      f.dependencies.taskStatus = 'BLOCKED_DEPENDENCY_INSTALL_REQUIRED';
    },
  ],
  [
    'fingerprint mismatch',
    (f) => {
      f.lease.dependencyFingerprint = 'd'.repeat(64);
    },
  ],
];
for (const [name, mutate] of invalid) {
  test(`fails closed: ${name}`, () => {
    const facts = fixture();
    mutate(facts);
    assert.throws(() => validateCandidateFacts(facts));
  });
}

test('rejects a real directory junction and a dangling output junction without following either', (t) => {
  const scratch = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../runtime/codex/candidate-fixtures',
  );
  fs.mkdirSync(scratch, { recursive: true });
  const directory = fs.mkdtempSync(path.join(scratch, 'links-'));
  const outside = path.join(directory, 'outside');
  const fixtureRoot = path.join(directory, 'repository');
  fs.mkdirSync(outside);
  fs.mkdirSync(fixtureRoot);
  const link = path.join(fixtureRoot, 'linked');
  const dangling = path.join(fixtureRoot, 'dangling');
  fs.symlinkSync(outside, link, 'junction');
  fs.symlinkSync(path.join(directory, 'missing'), dangling, 'junction');
  t.after(() => {
    fs.unlinkSync(link);
    fs.unlinkSync(dangling);
    assert.equal(path.dirname(directory), scratch);
    fs.rmSync(directory, { recursive: true });
  });
  assert.throws(() => assertNoPathLinks(fixtureRoot, link), /junction|symbolic/u);
  assert.throws(() => assertNoPathLinks(fixtureRoot, dangling), /junction|symbolic/u);
});

function profile() {
  return {
    schemaVersion: 1,
    profile: 'production',
    buildCommit: commit.slice(0, 7),
    buildDirty: false,
    buildVersion: '0.1.0-p10.20260905.999',
    buildDescription: `fixture-${commit.slice(0, 7)}`,
    buildTime: '2026-09-05T08:00:00Z',
  };
}
test('upload profile binds fresh own output to clean production SHA and explicit non-local version', () => {
  const facts = fixture();
  assert.doesNotThrow(() => validateUploadProfile(profile(), facts, profile().buildVersion));
});
for (const [key, value] of [
  ['profile', 'staging'],
  ['buildDirty', true],
  ['buildCommit', 'wrong'],
  ['buildVersion', 'local'],
  ['buildDescription', 'missing-sha'],
  ['buildTime', '2026-09-04T00:00:00Z'],
]) {
  test(`rejects uploaded profile with invalid ${key}`, () => {
    assert.throws(() =>
      validateUploadProfile({ ...profile(), [key]: value }, fixture(), profile().buildVersion),
    );
  });
}
