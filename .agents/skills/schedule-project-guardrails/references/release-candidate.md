# Release-candidate routing

Read this reference for `L3` only. It does not grant production access.

Authoritative sources:

- [release worktree helper](../../../../scripts/prepare-release-worktree.mjs)
- [ECS packager](../../../../scripts/package-ecs-release.mjs) and [release cache](../../../../scripts/release-cache.mjs)
- [release-cache pitfall](../../../../docs/agent-context/pitfalls/release-cache-and-reuse.md)
- Platform-specific release runbooks routed by the task

## Candidate invariant

Freeze one target SHA. Prepare it only through the managed `$REPO_ROOT/runtime/release-worktree`, then prove the worktree is registered, detached, clean, and at that SHA with `scripts/check-worktree-safety.ps1 -RequireReady -ExpectedCommit <sha>`. Do not package or upload from the main worktree.

Run the complete gate set required by the affected release plan only after the candidate is final. Record a reusable fingerprint consisting of the SHA, dependency/toolchain identity, exact commands, build profile/environment, and relevant input hashes. If all fields and retained evidence are identical, reuse the result instead of rerunning an expensive gate. Any source, dependency, toolchain, command, profile, environment, guard, or evidence change invalidates reuse.

All candidate manifests and evidence stay under preconfirmed ignored `runtime/` paths. A candidate operation must finish with the source worktree clean. Runtime disabling of diagnostics is not evidence that diagnostic code is absent; package-content claims need source/output audit evidence.

For Mini upload candidates, also read [Mini Program routing](miniprogram.md), reject `version=local`, and obtain the current-message upload approval. For an ECS candidate, packaging remains local `L3`; connecting, backing up, migrating, deploying, rolling back, or verifying production is `L4` and requires separate explicit authorization.
