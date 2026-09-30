import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import * as dependencies from './worktree-deps-core.mjs';

const emptyTreeHash = createHash('sha256').update('').digest('hex');
const current = {
  fingerprint: 'a'.repeat(64),
  lockfileSha256: 'b'.repeat(64),
  commandHash: 'c'.repeat(64),
  command: {
    cwd: '/pool/slot',
    args: [
      'install',
      '--frozen-lockfile',
      '--offline',
      '--config.strictDepBuilds=false',
      '--store-dir=/pool/store',
    ],
  },
  trackedTreeHash: emptyTreeHash,
  healthy: true,
};
const completed = {
  ...current,
  installInvoked: true,
  status: 'zero-downloads-not-proven',
  completedAt: '2026-09-30T09:00:00.000Z',
  downloadCount: null,
  trackedTreeBeforeHash: emptyTreeHash,
  trackedTreeAfterHash: emptyTreeHash,
  trackedTreeChanged: false,
};

test('finalizes a completed frozen offline install without running a second install', () => {
  assert.equal(dependencies.canFinalizeOfflineReconciliation(completed, current), true);
});

test('does not finalize failed, unfinished, online or changed installations', () => {
  for (const change of [
    { status: 'started' },
    { status: 'health-failed' },
    { status: 'ready-reuse' },
    { installInvoked: false },
    { completedAt: undefined },
    { downloadCount: 1 },
    { fingerprint: 'd'.repeat(64) },
    { lockfileSha256: 'd'.repeat(64) },
    { commandHash: 'd'.repeat(64) },
    { trackedTreeChanged: true },
    { trackedTreeAfterHash: 'd'.repeat(64) },
    { command: { ...current.command, cwd: '/different-slot' } },
    {
      command: {
        ...current.command,
        args: current.command.args.filter((arg) => arg !== '--offline'),
      },
    },
  ]) {
    assert.equal(
      dependencies.canFinalizeOfflineReconciliation({ ...completed, ...change }, current),
      false,
      JSON.stringify(change),
    );
  }
  assert.equal(
    dependencies.canFinalizeOfflineReconciliation(completed, { ...current, healthy: false }),
    false,
  );
  assert.equal(
    dependencies.canFinalizeOfflineReconciliation(completed, {
      ...current,
      trackedTreeHash: 'd'.repeat(64),
    }),
    false,
  );
});
