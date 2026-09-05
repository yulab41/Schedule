# B0 Acquire/reconciliation handoff

- Task: B0-ACQUIRE-RECONCILIATION-HANDOFF. Scope: dependency tooling only; no production authorization.
- Start and integration origin/main: cdb759b9d8781dc01749f103d2d30d346689121d.
- Repeated final fetch showed an empty exact two-point diff from that baseline.
- Checkpoint: fix(tooling): preserve owned lease through offline reconciliation.
- Development branch: codex/b0-acquire-reconciliation-handoff; exclusive general-6, root profile, reused dependencies.
- No business code, icons, manifests, lockfile, Skill, known pitfalls, trial, allowlist or production changes.

## Root cause and behavioral changes

Acquire branch assignment was introduced in bb81e723; its catch deleted the lease before returning a dependency block.
The controlled current-message maintenance path requires an owned lease, so that cleanup prevented the legal repair.

- manage-worktree-pool.ps1: after checkout MISS, preserve the atomic lease, record the exact base/fingerprint and
  return NEEDS_RECONCILIATION. Explicit ReconciliationHandoff can select an already mismatched registered clean slot.
  Path selects one slot. Ordinary Acquire still never installs. Unexpected failures quarantine the slot.
- The same lease binds owner, sessionId, taskId, slotId, token, base SHA and complete dependency fingerprint.
  Slot registry keys are full SHA-256; fingerprint directories use their existing 24-character prefix.
- dependency-maintenance.ps1 and ensure-worktree-deps.ps1 forward the complete binding through the existing wrapper.
  Wrapper preflight failures are append-only audit events, before pnpm and before effective reconciliation counting.
- worktree-deps-core.mjs holds a CreateNew/exclusive operation file shared with pool Release/Heartbeat/Reclaim.
  Lease ownership excludes other Acquire calls; the operation file serializes mutations of that lease.
  Individual state files use atomic replacement. READY_REUSE becomes visible only while ownership is retained,
  after dependency health, immutable inputs and bootstrap pass; release is a separate verified transition.
- Failure removes success markers and retains an explicitly quarantined lease; a clean, inactive owned release
  detaches it, revokes the lease and keeps the slot quarantined. No half-linked environment becomes free.
- The same fingerprint cannot invoke another effective install. The old tripwire retry exception is removed.
  Download evidence counts downloaded packages, not added packages, and missing zero-download evidence fails closed.
- install-tripwire.test.mjs uses the Git common-directory workspace for its synthetic CI identity in linked worktrees.
  This changes the fixture only, not the tripwire policy.

## Tests and actual evidence

- Old implementation: new Acquire fixture FAIL, expected NEEDS_RECONCILIATION but got BLOCKED_NO_REUSABLE_DEPENDENCY_ENV.
- New implementation: handoff fixture PASS, including competing Acquire, preserved heartbeat state and quarantine release.
- Seven binding mismatches, no lease, concurrent operation, success/reuse and pnpm/health/bootstrap/tracked failures PASS.
- node --test --test-concurrency=1 scripts/codex/*.test.mjs: 39 PASS.
- pnpm exec vitest run scripts/agent-context-policy.test.mjs scripts/test-discovery-policy.test.mjs: 6 PASS.
- pnpm smoke:check-core: PASS, no core browser-chain changes; browser smoke not required.
- pnpm format:check: PASS. Targeted changed JavaScript ESLint: PASS.
- One baseline bootstrap fixture had transient Windows rename EPERM; isolated and serial reruns passed without code changes.
- Mini/Web full business suites were not needed for this tooling-only scope.

## Actual offline provisioning and fresh task smoke

- Slot: general-1; profile: root; base: cdb759b9d8781dc01749f103d2d30d346689121d.
- Slot ID: 650254b0061549e5e7e48f7aed770ace51f47fa5c72b3183bce447e6da18d352.
- Recomputed fingerprint: aef084f57bf1321a10e60130f912fe4ef35127421f368cd461c490b7ef7ec527.
  It happens to match the historical anchor; it was calculated from current Git/files/runtime, never hardcoded.
- Actual MISS: missing @schedule/ui-icons -> @schedule/ui-tokens and @schedule/web -> @schedule/ui-icons links.
- First wrapper call stopped before pnpm because full lease key and short fingerprint key were confused.
  Record retained; authorization removed; zero effective installs. Fixture now uses distinct registry/fingerprint keys.
- One effective install: install --frozen-lockfile --offline --config.strictDepBuilds=false
  --store-dir=e:\aitools\schedule\runtime\pnpm-store. Download count 0, attemptCount 1, recoveryAttempted false.
- Lockfile SHA-256: 729d208b4513e3211f87c13876ff838d805cad618fe85f74aa9244d2a15ee883.
- Health verified complete same-worktree workspace links and .modules.yaml storeDir runtime/pnpm-store/v11.
- Tracked status before/after: clean; both status hashes e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855.
  Dependency snapshot was also rechecked after install, covering lockfile and all manifests.
- Dependency marker exact; root bootstrap READY_BOOTSTRAP. Provisioning returned READY_REUSE and lease was released.
- Fresh owner b0-fresh-smoke / session b0-fresh-smoke-20260905 / task B0-FRESH-REUSE-SMOKE:
  ordinary Acquire returned READY_REUSE, dependenciesReused=true, installInvoked=false; all 8 producers reused.
  Tracked tree remained clean and the smoke lease was released. No second reconciliation was run.
- Ignored evidence: runtime/codex/logs/b0-acquire-reconciliation-20260905/ and canonical per-slot audit/markers.
- Final pushed-checkpoint SHA and post-push smoke/cleanup facts belong in the ignored handoff.json, avoiding self-SHA recursion.
- Stop after the pushed checkpoint is on origin/main, a fresh smoke succeeds there, and B0 leases are released.
  Only then report READY_FOR_QUEUE_B2. B2 is a separate future task; do not implement it here.
