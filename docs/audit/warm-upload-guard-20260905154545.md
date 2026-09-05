# Warm upload candidate compatibility and feedback trial

RUN_ID: `warm-upload-guard-20260905154545`. Application checkpoint: `cdb759b9d8781dc01749f103d2d30d346689121d`.
Current phase: release tooling implemented and targeted checks passed; clean-candidate proof, main push and authorized upload follow.
Final source/version/manifest/receipt facts are recorded below after actual upload, and in ignored task state.

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
  A positive real clean detached candidate will be recorded after a clean checkpoint exists.
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
  Fresh production build, source/package/performance/determinism and final CI dry-run are still required for the new artifact.

## Production and upload boundaries

- Latest detailed user message authorizes tool repair/tests/docs/normal commit/push, new trial upload,
  add-only allowlist ensure/verify and the complete production verifier. No further upload approval is needed.
- Read-only SSH preflight succeeded with strict host-key verification. Installed and local control hashes match:
  allowlist `d247f942746586b813ad1497e61efc0a8a9d7320d3ae27b7ab95676491f09f9b`;
  verifier `72cec609a8c5c08413e9bce92ec5250a6f3befd7c9df83481cbc26a53b62412e`.
  Observed live release `48488019171924701054354e8f707b08eb4d12fe`; re-read immediately before the allowed operation.
- Allowlist updates only the exact new version and may refresh API/Web configuration, not deploy application code.
  Verifier database queries are read-only. No database backup, deployment, migration or release-metadata synchronization.
- Independent tooling checkpoint message: `fix(release): align upload checker with leased worktree layout`.
  No version is preselected, and `.88` remains immutable. Actual upload result is not claimed until receipt verification.

## Current next action

Create the clean independent tool checkpoint, prove positive real candidate readiness, normal-push/integrate latest main,
then acquire a fresh upload lease at that final main and perform the already-authorized dynamic production build/upload.
Complete source/package/performance/determinism/CI dry-run, exact allowlist/full verifier and receipt/manifest checks.
Preserve original root files and release only owned leases. Do not start B2 or other work; do not claim Xiaomi14 acceptance.
