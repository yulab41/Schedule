# Repeated 1,459-package linking

On Windows, a store-complete frozen/offline install still spent about eight minutes importing the
workspace: 1,459 packages were found in the E: store, 1,454 used hardlinks, 5 used copies, and no
lifecycle build ran. The import stage, not resolve or download, was the bottleneck.

Acquire a clean persistent slot with `scripts/codex/manage-worktree-pool.ps1`, then run
`scripts/codex/ensure-worktree-deps.ps1`. Conversation, branch, commit, ordinary source changes, and
`origin/main` movement are never invalidation inputs. An install is allowed only after the gate prints
the changed dependency/environment input or a concrete health failure.

Run `scripts/codex/ensure-workspace-bootstrap.ps1` separately with the task profile. Missing workspace
`dist` is a producer build miss, not a dependency install miss. Keep each slot's writable
`node_modules`; do not junction multiple slots to one directory and do not delete a healthy slot at a
conversation boundary.

The pnpm 11.9 global virtual store passed the tested stack. Its observed cold time was 5.34% lower,
but Defender activity differed, so no causal performance improvement was accepted. It remains
experimental and is not enabled in main or the formal release path.
