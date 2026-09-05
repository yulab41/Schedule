# Warm upload candidate compatibility and feedback trial

RUN_ID: `warm-upload-guard-20260905154545`. Application checkpoint: `cdb759b9d8781dc01749f103d2d30d346689121d`.
Current phase: independent tooling fix pushed; real clean-candidate gates and authorized experience upload completed.
Native visual/interaction acceptance remains pending user evidence. Exact delivery facts are recorded below and in ignored task state.

## Root cause and responsibility

Classification: **LATENT_COMPATIBILITY_GAP_EXPOSED**.

- `76a572a3` introduced the fixed-path restriction in
  `.agents/skills/schedule-project-guardrails/scripts/check-worktree-safety.ps1` (original lines 138–146).
  It accepted only canonical `runtime/release-worktree`.
- `4602120b` made the managed pool project-local in `scripts/codex/manage-worktree-pool.ps1`;
  the official current rule is an exclusive healthy direct child of canonical `runtime/wt`.
- Current real candidate path is `runtime/wt/icon-parity-1`; its existing schema-v2 lease records token,
  path, owner, sessionId, taskId, starting HEAD/branch, dependency fingerprint, heartbeat and bootstrap profile.
- Actual old-checker errors: pool path rejected with `release worktree must use the fixed path`;
  fixed path rejected with `fixed path exists but is not a registered worktree; refusing to take it over`.
  The fixed directory has no Git file/registration and contains old dependency material; it was left untouched.
- `.88` was uploaded from `84dc966ea384e6f88c354bc5e5fb506ee5144d08`, production profile, 329 files,
  manifest `bad19c28d9844176ee42a94ade9425eecd0cc4c3ed978ebc73c87e3adffdc372`, official accepted receipt
  `2026-09-05T02:48:58.237Z`. Its task-local runner used the warm pool and existing Node CI helpers,
  but did not invoke this mandatory fixed-path checker. Receipt success does not prove checker compatibility.
- Exact `84dc966e..cdb759b9` diff is empty for the pool manager, checker and release helper.
  `ef6885d0` changed guidance/CI install tripwire; `d10db9fe` changed guidance/evidence routing.
  Neither changed the worktree root, warm layout, lease schema or checker implementation. Thus neither
  recent parallel commit directly introduced this mismatch.

## Ownership and scope

- Read and used project guardrails, systematic debugging, Mini development/preview knowledge and skill-creator.
  WeChat DevTools execution remains forbidden and was not invoked.
- Acquired an existing `icon`-role warm slot; ReuseOnly passed with fingerprint
  `aef084f57bf1321a10e60130f912fe4ef35127421f368cd461c490b7ef7ec527`; 3 Mini producers reused, installations 0.
  An initial request for non-existent role `icon-parity` returned POOL_BUSY; actual registry role was then used.
- Coordinated with task `修复 Acquire 租约衔接死锁`. Its B0 work owned general-6/general-1 and separate
  pool/reconciliation files. No duplicate repair, borrowed lease, or edit of its active files occurred.
  Its independent `57d11d70c242f36cdd5e3ef055e1e432829d22e2` was subsequently fast-forward integrated.
- Only release tools, their tests and necessary documentation changed. `cdb759b9` was not amended or rewritten.
  No business source, API/Web, dependency declaration/lockfile, generated dist or `.88` entry/manifest changed.

## Fix and behavior audit

1. The existing PS checker and release helper now share `scripts/codex/release-candidate-core.mjs`.
   Candidate paths must be real, non-aliased, non-junction direct children of the approved canonical warm pool.
   Git top-level, registration, common directory and Git-file identity must agree.
2. The helper requires the existing owning token and RUN_ID, clean exact HEAD, own task branch/base and fresh
   dependency health. Under the existing lease operation lock, it adds a bounded `releaseCandidate` record
   to that same lease: upload purpose, RUN_ID, SHA, exact own dist, preparation time and expiry.
   This is an official lease transition, not a fabricated lease or second registry. It detaches only current SHA,
   using normal switch; no force/skip flag, path widening, old-directory takeover, copy or dependency installation.
3. Readiness rejects ordinary development leases, foreign/released/quarantined/expired leases, stale heartbeat,
   wrong HEAD/branch, dirty tree, foreign output and invalid production build identity. The output build time
   must be newer than purpose preparation; the actual output manifest is re-hashed before upload.
4. Real CI now always checks the same candidate before allocation and after building. The existing allocator
   holds an atomic operation lock and includes immutable local allocations alongside tracked floor/remote tags.
   Build failures retain occupied versions. Version/SHA/manifest binding precedes the unchanged remote tag
   reservation. An uncertain old-version retry without original immutable manifest evidence is refused.
5. Receiver-bound CI calls, build-profile/lineage/source checks, success-only receipt, no-review/publication
   boundary and exception propagation remain. Cleanup preserves the original operation error if it also fails.
   Preview/dry-run still performs no version reservation or upload. This is an explicit tooling behavior change,
   not a claim of semantic-equivalent business refactoring.

## Validation and evidence reuse

Evidence: canonical `runtime/codex/logs/warm-upload-guard-20260905154545/`.

- Baseline: release/artifact tests14 PASS; pool policy5 PASS. New existing-helper regression3 FAIL/8 PASS
  on old implementation (`release-red.log`), then all14 PASS after the fix.
- New path cases first reproduced output alias and dangling-junction failures, then passed. Additional expiry
  cases first failed then passed. Candidate suite42 PASS, including real junction filesystem fixtures.
- Real PS frontend rejects this task's dirty owned warm tree with the expected clean-tree error, not old-path rejection.
  After checkpoint c25fcf43, the real official prepare helper and PS checker passed on a clean detached owned upload candidate.
  The development lease was released; a fresh Acquire/ReuseOnly/bootstrap upload lease at the same final main also passed.
  The same checker passed again against the actual version-bound production output, not only synthetic fixtures.
- Node tooling81 PASS (includes B0 and candidate safety); root targeted25 PASS (includes allowlist5 and repository guards);
  Mini upload tooling30 PASS (lineage16, CI6, lock/manifest5, mandatory CI gate3). Total136 targeted checks.
  The extra real-file case modifies output after build and proves reservation/upload remain blocked by manifest re-hashing.
- Mandatory CI gate2 first failed on old CI behavior, then passed; no actual upload or credentials were used in fixtures.
  Git-baseline allocator selected an already locally allocated fixture version; current allocator correctly advances.
  Version tests include mutual exclusion, immutable SHA/manifest, uncertain retry refusal and failure lock cleanup.
- Target lint, JS syntax, PS syntax, official format:check and smoke:check-core PASS. The first formatter call
  passed a PS array as one argument; corrected splatting, not source/test relaxation. Strict lint issues were fixed.
- Repository Skill validator PASS: structure15, markdown14/108 links, three PS AST checks, YAML and ignore policy.
  Generic Python quick_validate could not import PyYAML; no dependency was installed. Repository validator is the fallback.
- Application `apps/miniprogram/src` tree equals `cdb759b9`:
  `f505883d01359db826c7a181009e3b98e7ad22e4`. Git diff also proves unchanged Web/packages/manifests/lockfile.
  Reuse prior **789 passed / 11 conditional skipped** business evidence; no unconditional business rerun.
  Fresh production build, source/package/performance/determinism and actual CI dry-run passed for the new artifact below.
  Mini typecheck and local trial-lineage audit also passed. The receipt-only checkpoint reruns lightweight documentation guards,
  not the unchanged business suite; no source changes were introduced after artifact freeze.

## Production and upload boundaries

- Latest detailed user message authorizes tool repair/tests/docs/normal commit/push, new trial upload,
  add-only allowlist ensure/verify and the complete production verifier. No further upload approval is needed.
- Read-only SSH preflight succeeded with strict host-key verification. Installed and local control hashes match:
  allowlist `d247f942746586b813ad1497e61efc0a8a9d7320d3ae27b7ab95676491f09f9b`;
  verifier `72cec609a8c5c08413e9bce92ec5250a6f3befd7c9df83481cbc26a53b62412e`.
  Immediately before and after the allowed operation, live release was `48488019171924701054354e8f707b08eb4d12fe`.
- Allowlist updates only the exact new version and may refresh API/Web configuration, not deploy application code.
  Verifier database queries are read-only. No database backup, deployment, migration or release-metadata synchronization.
- Independent tooling checkpoint `c25fcf43a01e7f5d27a59856891387b0fe918228`:
  `fix(release): align upload checker with leased worktree layout`; normal HEAD:main push succeeded.
  Fetch before/after push and immediately before/after upload confirmed the same source main.
  Both cdb759b9 and c25fcf43 remain ancestors of origin/main; the later documentation checkpoint does not change application/build inputs.

## Actual experience delivery

| Field                                              | Verified value                                                                                                                                          |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dynamically allocated version                      | `0.1.0-p10.20260905.89`                                                                                                                                 |
| Source / upload-time main                          | `c25fcf43a01e7f5d27a59856891387b0fe918228`                                                                                                              |
| Description                                        | `feedback-toast-switch-c25fcf4`                                                                                                                         |
| Build identity                                     | clean production; built `2026-09-05T09:47:57.642Z`                                                                                                      |
| Accepted receipt                                   | `2026-09-05T09:56:18.409Z`                                                                                                                              |
| Manifest SHA-256                                   | `df43c76b82c975f812dd726d49e666822b40ee27d8d63e7cc1f69d67dfc68047`                                                                                      |
| Files / total bytes                                | 330 / 5,212,766                                                                                                                                         |
| Main package                                       | 1,761,110 bytes                                                                                                                                         |
| Subpackages: scheduling / organization / workflows | 426,031 / 1,064,454 / 836,574 bytes                                                                                                                     |
| Subpackages: insights / diagnostics                | 1,072,435 / 52,162 bytes                                                                                                                                |
| Gates                                              | source/package, performance, determinism, real CI dry-run, leased output checker, allowlist ensure/verify, complete installed production verifier: PASS |

- The official entry acquired the atomic upload lock, dynamically observed history/tags/local allocations, allocated the next
  available sequence, rebuilt its own clean dist and froze the immutable tuple. No `.88` or foreign/root dist was reused.
  Two deterministic builds, the actual production build and the credential-free CI dry-run all had the same manifest.
- Manifest re-hashing and exact profile checks ran again before the official CI upload. Receipt, local allocation, bound manifest,
  frozen actual dist, archived dist and remote lightweight tag all independently matched the version/SHA/input manifest.
  Evidence lives under ignored `runtime/codex/warm-upload-guard-20260905154545/upload/` and `runtime/audit/miniprogram-trials/`.
  `.88` receipt and frozen manifest remain exactly `bad19c28d9844176ee42a94ade9425eecd0cc4c3ed978ebc73c87e3adffdc372`.
- The execution reviewer initially failed to recognize the current explicit upload/L4 authorization. Read-only inspection proved
  no command had started and confirmed the narrow approved effects; the identical command was accepted with the exact current-message
  authorization quoted. No approval or application gate was bypassed.
- First platform attempt explicitly returned `-10008 invalid ip`, not ambiguous success. The SDK had auto-selected the system proxy
  despite the recorded DNS route. The official pinned SDK source confirms its single-host NO_PROXY opt-out. After checking no success
  receipt and unchanged remote tag/manifest, one idempotent retry used the same frozen files with the documented process-only IPv4 route
  and `servicewechat.com` NO_PROXY. No rebuild, version/manifest change, system proxy/DNS change, TLS weakening or blind retry occurred.
  Official CI resolved successfully and wrote the receipt. Compiler processes belonged only to this run; no DevTools was controlled.
- Package audit retains the pre-existing main-package >1.5M warning; no internal 1.8M blocker. Performance audit retains 1445/1506
  maximum-matrix host-element best-effort warnings, payload 171340 bytes and two tap patch paths. Desktop logic observations were
  1.2664ms matrix / 0.2318ms tap, not Android startup, rendering or device performance measurements.
- Exact add-only allowlist ensure and verify both passed, followed by the complete hash-verified installed production verifier.
  Its default unset `ECS_PUBLIC_IP` active probe was explicitly skipped, not represented as passed. Expected rejection probes and
  short readiness retries during configuration refresh were logged; final health/capabilities/artifacts/database read checks passed.
  Only API/Web configuration containers were refreshed; live application release stayed unchanged and MySQL was not recreated.
- The platform response does not expose an independently queryable server-side manifest hash. Evidence proves successful official CI
  acceptance for the exact bound upload arguments and local input manifest; it does not claim an independent server byte-hash proof.
  No review submission, formal publication, ECS application deployment, database deployment/backup/migration or Xiaomi14 acceptance.

## One-time B2 P0 handoff (scope report, not new implementation)

Conclusion: **P0_NOT_COVERED_OR_PARTIAL**. This compatibility task did not take over P1/P2 or redesign lineage equivalence.
Current source is a direct descendant of the previously accepted `.88` and cdb759b9; this upload never uses the non-ancestor exception.

| Requested P0 boundary                                                                                   | Actual coverage at c25fcf43                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Latest accepted source is normally an ancestor                                                          | Existing production preflight verifies actual Git ancestry; this upload's `.88` ancestor proof passed.                                                          |
| Higher version/description/old checkpoints/booleans cannot bypass ancestry                              | Partial: existing rejection tests cover ordinary non-ancestor/higher-version facts, but the legacy trackedHistory + required checkpoint exception remains.      |
| Non-ancestor use requires explicit versioned restricted policy                                          | Partial: versioned canonical-file policy exists, but it is not a latest-trial-specific exception policy.                                                        |
| Bind latest ledger, exact trial SHA, exact candidate SHA, complete feature proof-set and Git identities | Not fully covered: current canonical blobs are checked against HEAD, but policy lacks these complete latest-trial/ledger/candidate bindings.                    |
| Missing/partial/outside/ignored/blob/ledger mismatch fails closed                                       | Partial: unsafe relative paths and blob mismatches are checked; no complete ignored-path/ledger-identity/proof-set matrix was implemented or tested here.       |
| New required proof invalidates old proof-set                                                            | Not covered by a latest-trial-bound proof-set regression in this task.                                                                                          |
| Seven requested ancestor/restricted-proof cases                                                         | Not all covered: existing lineage16 and compatibility/lock tests are not a complete P0 suite, especially old-icon-only and complete restricted-proof semantics. |

Evidence files: `apps/miniprogram/scripts/trial-lineage.mjs` (`assertTrialCandidateFacts`, `evaluateEquivalentProof`),
`trial-lineage.test.mjs` and `release/trial-lineage-policy.v1.json`. The policy was not modified. The existing equivalent-policy test
accepts one fixture checkpoint with `trackedHistory=true`; this is precisely why no full P0 completion claim is justified.
Tooling changes are in c25fcf43; existing lineage16 PASS, lock/manifest5 PASS, CI helper6 PASS and mandatory gate3 PASS.
Final origin/main and owned lease-release facts are delivered to the requesting task after the documentation checkpoint is pushed.

## Current next action

Implementation/upload are finished; only commit/push this documentation checkpoint and release its owned lease remain.
Message: `docs(release): record verified feedback trial upload`. Upload lease has already been officially released.
Receipt-only validation: `pnpm exec vitest run scripts/agent-context-policy.test.mjs scripts/test-discovery-policy.test.mjs --fileParallelism=false`
passed 6/6; targeted Markdown formatting, `pnpm smoke:check-core` and `git diff --check` passed. Only four scoped Markdown files changed.
Root original untracked content remains intact; final Git/lease facts are in ignored task state. Then stop automatic work.
Only next acceptance action is user Xiaomi14 feedback for `.89@c25fcf4`: toast capsule background, swap toggles,
leave-policy notice and scheduling configuration switches. Native evidence remains pending; do not start B2 or another batch.
