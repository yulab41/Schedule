# Leased warm upload candidates

The legacy fixed-path checker and the current project-local warm pool were incompatible before
WARM-UPLOAD-GUARD-001. The `.88` runner did not call that checker; its accepted receipt was not proof
of candidate compatibility. See the exact Git comparison in `docs/audit/warm-upload-guard-20260905154545.md`.

Use the existing pool Acquire/ReuseOnly/Bootstrap first. The existing release helper may promote only
the current task's valid lease to bounded `releaseCandidate` upload purpose at the already checked-out
clean SHA; it does not create a second registry, install, copy output or take over a fixed directory.
The existing PowerShell checker and CI entry both use `scripts/codex/release-candidate-core.mjs`.

Required identity: real canonical direct-child pool path, registered Git file/top-level/common-dir,
matching owner token and RUN_ID, current heartbeat and expiry, upload purpose, own task branch/base,
clean detached exact SHA, current independent dependency fingerprint and exact own dist directory.
Output must be freshly built after purpose preparation and match production/version/SHA/manifest.
Do not accept a development-only, stale/released, foreign, dirty, linked or aliased candidate.

Real CI must acquire the existing allocator's operation lock before selecting a version. Failed local
allocations remain occupied; remote tag reservation remains atomic and immutable. Bind manifest before
upload and reject uncertain retries without original tuple evidence. Never reuse `.88` or guess a next version.

Tests: Node candidate-core suite, existing release-helper suite, Mini upload-worktree-gate/trial-upload-lock/
trial-lineage/CI suites; run the real PS checker on the prepared clean candidate before upload.
Tool tests do not replace source/package/determinism/production verifier or native device acceptance.
