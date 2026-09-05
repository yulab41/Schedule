# Release-candidate routing

Read the dynamic identity section whenever a task depends on version/SHA/release freshness. Read the remaining candidate sections for `L3` only. This reference does not grant production access.

Authoritative sources:

- [dynamic release identity and baseline freeze](../../../../docs/operations/runbook.md#动态发布身份与基线冻结)
- [release worktree helper](../../../../scripts/prepare-release-worktree.mjs)
- [ECS packager](../../../../scripts/package-ecs-release.mjs) and [release cache](../../../../scripts/release-cache.mjs)
- [release-cache pitfall](../../../../docs/agent-context/pitfalls/release-cache-and-reuse.md)
- Platform-specific release runbooks routed by the task

## Dynamic release identity

Values recorded in prompts, examples, plans, or status documents are timestamped evidence, not permanent defaults. Follow the operations runbook to discover only the state permitted by the current authorization at task start, revalidate the affected identities immediately before the first external mutation, and freeze the run baseline when that mutation starts.

Keep fetched `origin/main`, the latest eligible uploaded Mini Program trial, and the production live release as independent identities even when two values happen to share a SHA. Without an explicitly authorized current `L4` lookup, a recorded production value must remain `LIVE_RELEASE_VERIFIED=false` and cannot be used as a current rollback or deployment fact.

For Mini Program version selection and immutable version/SHA/Manifest binding, also read [Mini Program routing](miniprogram.md).

## Candidate invariant

Freeze one target SHA. Prepare it only through the managed `$REPO_ROOT/runtime/release-worktree`, then prove the worktree is registered, detached, clean, and at that SHA with `scripts/check-worktree-safety.ps1 -RequireReady -ExpectedCommit <sha>`. Do not package or upload from the main worktree.

Use the canonical [candidate preflight and application evidence rules](testing-and-evidence.md#candidate-preflight).

All candidate manifests and evidence stay under preconfirmed ignored `runtime/` paths. A candidate operation must finish with the source worktree clean. Runtime disabling of diagnostics is not evidence that diagnostic code is absent; package-content claims need source/output audit evidence.

For Mini upload candidates, also read [Mini Program routing](miniprogram.md), reject `version=local`, and obtain the current-message upload approval. For an ECS candidate, packaging remains local `L3`; connecting, backing up, migrating, deploying, rolling back, or verifying production is `L4` and requires separate explicit authorization.

## Release cutoff

After candidate freeze, compare main movement with `old-main..new-main`, cross-checking commit list and name-only diff.
Only application source, dependency, build configuration, or release-tool changes require reintegration and affected
evidence review. Docs/status-only drift is an impact note, never a repeated merge or a post-upload branch change.
Concurrent edits to the same guard/reference require safe integration and only the affected lightweight checks.
