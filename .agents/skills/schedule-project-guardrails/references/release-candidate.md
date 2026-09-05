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

Freeze one target SHA in an already acquired healthy direct child of the canonical `runtime/wt` pool. The retired `runtime/release-worktree` is not an alternate upload path; do not copy, link or move source into it.

The existing helper promotes only the owning task's lease, under its operation lock:

```text
node scripts/prepare-release-worktree.mjs --path <leased-slot> --commit <full-sha> --lease-token <token> --run-id <lease-taskId> --purpose upload
```

It preserves the original registry/token, adds a bounded `releaseCandidate` purpose/commit/output/expiry, and detaches only the already checked-out clean SHA. It never creates a worktree, installs, force-checks out, or takes over a foreign branch. Ordinary development leases are not upload candidates.

Run the skill's `scripts/check-worktree-safety.ps1 -RepoRoot <canonical-root> -WorktreePath <leased-slot> -RequireReady -ExpectedCommit <sha> -LeaseToken <token> -RunId <lease-taskId>`. The checker and helper share one core; they require real direct-child paths without aliases/junctions, registered Git identity, current ownership/heartbeat/purpose/expiry, exact SHA, a clean detached tree, independent healthy dependencies and the slot's own output. Repeat with `-ForMiniprogramUpload -MiniProgramVersion <version>` after a fresh build. Do not package or upload from the main worktree.

Use the canonical [candidate preflight and application evidence rules](testing-and-evidence.md#candidate-preflight).

All candidate manifests and evidence stay under preconfirmed ignored `runtime/` paths. A candidate operation must finish with the source worktree clean. Runtime disabling of diagnostics is not evidence that diagnostic code is absent; package-content claims need source/output audit evidence.

For Mini upload candidates, also read [Mini Program routing](miniprogram.md), reject `version=local`, and obtain the current-message upload approval. For an ECS candidate, packaging remains local `L3`; connecting, backing up, migrating, deploying, rolling back, or verifying production is `L4` and requires separate explicit authorization.

## Release cutoff

After candidate freeze, compare main movement with `old-main..new-main`, cross-checking commit list and name-only diff.
Only application source, dependency, build configuration, or release-tool changes require reintegration and affected
evidence review. Docs/status-only drift is an impact note, never a repeated merge or a post-upload branch change.
Concurrent edits to the same guard/reference require safe integration and only the affected lightweight checks.
