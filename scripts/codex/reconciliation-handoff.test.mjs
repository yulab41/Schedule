/* global process, URL */
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { withReconciliationLease, inferDownloadCount } from './worktree-deps-core.mjs';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const fixtureFile = fileURLToPath(new URL('./reconciliation-handoff.fixture.ps1', import.meta.url));
test(
  'Acquire preserves an exclusive reconciliation lease after checkout MISS',
  { skip: process.platform !== 'win32' },
  () => {
    const result = spawnSync('pwsh', ['-NoProfile', '-File', fixtureFile], {
      encoding: 'utf8',
      windowsHide: true,
    });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /HANDOFF_FIXTURE_PASS/u);
  },
);

function fixture(t) {
  const root = fs.mkdtempSync(
    path.join(path.dirname(fixturePath()), '../../runtime/codex/handoff-'),
  );
  const state = {
    worktreeKey: 'fingerprint-key',
    slotKey: 'slot',
    stateRoot: root,
    leaseRoot: path.join(root, 'leases'),
    fingerprintRoot: path.join(root, 'fingerprints'),
  };
  state.dependencyMarkerPath = path.join(state.fingerprintRoot, 'dependencies-v2.json');
  fs.mkdirSync(state.leaseRoot, { recursive: true });
  fs.mkdirSync(state.fingerprintRoot, { recursive: true });
  fs.mkdirSync(path.join(root, 'state/slots'), { recursive: true });
  const options = {
    owner: 'owner',
    sessionId: 'session',
    taskId: 'task',
    leaseToken: 'token',
    slotId: 'slot',
    baseSha: 'b'.repeat(40),
    fingerprint: 'c'.repeat(64),
  };
  const lease = {
    schemaVersion: 2,
    path: root,
    owner: options.owner,
    sessionId: options.sessionId,
    taskId: options.taskId,
    token: options.leaseToken,
    slotId: options.slotId,
    head: options.baseSha,
    baseSha: options.baseSha,
    dependencyFingerprint: options.fingerprint,
    status: 'NEEDS_RECONCILIATION',
  };
  const leasePath = path.join(state.leaseRoot, 'slot.json');
  const slotPath = path.join(root, 'state/slots/slot.json');
  fs.writeFileSync(leasePath, JSON.stringify(lease));
  fs.writeFileSync(
    slotPath,
    JSON.stringify({ schemaVersion: 2, path: root, status: lease.status }),
  );
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  let installs = 0;
  const context = {
    root,
    state,
    options,
    measure: () => ({ baseSha: options.baseSha, fingerprint: options.fingerprint, tracked: '' }),
    reconcile: () => {
      installs++;
      fs.writeFileSync(state.dependencyMarkerPath, '{}');
      return { taskStatus: 'READY_INSTALLED', installInvoked: true };
    },
    bootstrap: () => ({ taskStatus: 'READY_BOOTSTRAP' }),
  };
  return {
    context,
    leasePath,
    slotPath,
    installs: () => installs,
    read: (p) => JSON.parse(fs.readFileSync(p, 'utf8')),
  };
}
function fixturePath() {
  return fileURLToPath(new URL('./reconciliation-handoff.fixture.ps1', import.meta.url));
}
for (const key of [
  'owner',
  'sessionId',
  'taskId',
  'leaseToken',
  'slotId',
  'baseSha',
  'fingerprint',
]) {
  test(
    'reconciliation rejects mismatched ' + key + ' before pnpm and preserves owner lease',
    (t) => {
      const f = fixture(t);
      const before = fs.readFileSync(f.leasePath, 'utf8');
      f.context.options = { ...f.context.options, [key]: 'incorrect' };
      const result = withReconciliationLease(f.context);
      assert.equal(result.installInvoked, false);
      assert.equal(f.installs(), 0);
      assert.equal(fs.readFileSync(f.leasePath, 'utf8'), before);
    },
  );
}
test('no lease remains unauthorized', (t) => {
  const f = fixture(t);
  fs.unlinkSync(f.leasePath);
  assert.equal(withReconciliationLease(f.context).installInvoked, false);
  assert.equal(f.installs(), 0);
});
test('running reconciliation excludes a concurrent operation without overwriting lease', (t) => {
  const f = fixture(t);
  const before = fs.readFileSync(f.leasePath, 'utf8');
  fs.writeFileSync(f.leasePath + '.operation', 'busy');
  assert.equal(withReconciliationLease(f.context).taskStatus, 'POOL_BUSY');
  assert.equal(fs.readFileSync(f.leasePath, 'utf8'), before);
  assert.equal(f.installs(), 0);
});
test('successful provisioning commits READY_REUSE with same lease and bootstrap, then reuses', (t) => {
  const f = fixture(t);
  const result = withReconciliationLease(f.context);
  assert.equal(result.taskStatus, 'READY_REUSE');
  assert.equal(result.bootstrap.taskStatus, 'READY_BOOTSTRAP');
  assert.equal(f.read(f.leasePath).token, 'token');
  assert.equal(f.read(f.slotPath).status, 'READY_REUSE');
  f.context.reconcile = () => ({ taskStatus: 'READY_REUSE', installInvoked: false });
  assert.equal(withReconciliationLease(f.context).installInvoked, false);
  assert.equal(f.installs(), 1);
  assert.equal(fs.existsSync(f.leasePath + '.operation'), false);
});
for (const phase of ['pnpm', 'health', 'bootstrap', 'tracked']) {
  test(
    phase +
      ' failure quarantines environment, removes success markers, and releases operation lock',
    (t) => {
      const f = fixture(t);
      fs.writeFileSync(f.context.state.dependencyMarkerPath, '{}');
      if (phase === 'pnpm')
        f.context.reconcile = () => {
          throw new Error('pnpm failed');
        };
      if (phase === 'health')
        f.context.reconcile = () => ({
          taskStatus: 'BLOCKED_NO_REUSABLE_DEPENDENCY_ENV',
          installInvoked: true,
          reasons: ['links-missing'],
        });
      if (phase === 'bootstrap') f.context.bootstrap = () => ({ taskStatus: 'BLOCKED_BOOTSTRAP' });
      if (phase === 'tracked') {
        let calls = 0;
        const measure = f.context.measure;
        f.context.measure = () => ({ ...measure(), tracked: calls++ ? ' M lockfile' : '' });
      }
      assert.throws(() => withReconciliationLease(f.context));
      assert.equal(f.read(f.leasePath).status, 'QUARANTINED_RECONCILIATION');
      assert.equal(f.read(f.slotPath).status, 'quarantined-dependency');
      assert.equal(fs.existsSync(f.context.state.dependencyMarkerPath), false);
      assert.equal(fs.existsSync(f.leasePath + '.operation'), false);
    },
  );
}
test('download evidence distinguishes imported packages and checks every progress count', () => {
  assert.equal(inferDownloadCount('resolved 1459, reused 1459, downloaded 0, added 1459'), 0);
  assert.equal(inferDownloadCount('downloaded 2\ndownloaded 0'), 2);
  assert.equal(inferDownloadCount('added 1459'), null);
});
