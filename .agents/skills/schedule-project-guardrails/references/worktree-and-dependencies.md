# Worktree and dependency evidence

This is the compact route for the exact worktree/dependency contract. The existing detailed bootstrap and
dependency references remain authoritative; this file records the task-level invariants added for icon and
candidate work.

- Acquire one exclusive warm slot under `runtime/wt` before source edits. Never share writable `node_modules`,
  nest a worktree, borrow `dist`, or use the dirty canonical worktree as a candidate.
- Compute one complete dependency fingerprint from the lockfile, every workspace manifest, workspace config,
  pnpm configuration/tripwire, tracked patches, Node/pnpm versions, OS/architecture, project-local store
  identity, and workspace-link health. Conversation, branch/SHA, `origin/main`, source-only changes, and
  missing producer output do not invalidate dependencies.
- `READY_REUSE`/`MATCH` means no install. `MISS` reports exact fields and may use the existing official
  `dependency-maintenance.ps1 -CurrentMessageAuthorization` once per complete fingerprint with the fixed
  `--frozen-lockfile --offline` command; it must reach `READY_REUSE`, keep the tracked tree unchanged,
  and record its own ignored audit evidence. This is the L2 local frozen reconciliation permitted only by
  an explicit current-message authorization; it never authorizes upgrades, force options, store
  repair/deletion, production work, or formal publication.
- Do not create a second dependency checker, manually stitch links, install a second language validator, or
  treat a root `pnpm install` as evidence for another worktree. Reuse the official health/fingerprint result.
- Final candidate work uses `runtime/release-worktree` and `scripts/prepare-release-worktree.mjs`; run the
  safety checker before release gates. Keep build/profile/manifest/source SHA in the same ignored state record.
