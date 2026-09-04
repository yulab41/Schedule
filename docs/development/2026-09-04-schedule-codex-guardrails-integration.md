# Schedule Codex guardrails integration

## Scope and baseline

This L2 checkpoint closes the Schedule repository's dependency-reuse, incremental-bootstrap,
persistent-warm-worktree, lease, and local Codex Hook paths. The clean integration source was created
from `origin/main@75cc0d3b`. No product behavior, schema, migration, lockfile, dependency declaration,
production configuration, or Mini Program release artifact is in scope.

The audited candidate was `5c45236d` on branch `codex/schedule-project-guardrails`. Its two commits were
`411399e7` (`chore(agent): add Schedule project guardrails`) and `5c45236d`
(`perf(dev): reuse worktree dependencies by fingerprint`). The candidate's useful Skill and helper
ideas were selectively reimplemented. The candidate's date-drift test edits, measurement script,
long debug log, performance audit, and old status snapshot were not integrated.

## Decisions

- `DEPENDENCY_MODE=REUSE_ONLY` is the default for every task level. Conversation, branch, source SHA,
  remote-main movement, ordinary source changes, clean-source checks, and missing producer output do not
  trigger installation.
- The dependency fingerprint is separate from the workspace bootstrap fingerprint. Health checks cover
  metadata, root executables, the store, local workspace links, and local lease state.
- The pool manager registers existing warm worktrees only. It never creates a cold fallback, shares a
  writable dependency tree, resets a slot, runs `git clean`, or deletes `node_modules`.
- Dependency maintenance is a separate user-authorized channel with an exact command hash, a single use,
  and a maximum 15-minute lifetime. No maintenance authorization was created in this checkpoint.
- No portable project `.codex` setup configuration existed, so no undocumented setup format was added.
  The documented local startup path now calls the no-install wrapper first.

## Evidence

The integration worktree without dependencies returned `TASK_STATUS=BLOCKED_NO_REUSABLE_DEPENDENCY_ENV`,
`DEPENDENCIES_REUSED=false`, `INSTALL_INVOKED=false`, and `WORKTREE_CREATED=false`. A previously known
clean warm slot was independently checked, its healthy dependency state was adopted without installation,
and its pool lease was acquired and released atomically. The `mini` bootstrap built only contracts,
client-core, and presentation-core. An existing Mini `build-tools` test passed 7/7. A first scale-probe
attempt was rejected by Vitest because that file was introduced after the warm slot's candidate SHA;
path and history tracing confirmed a SHA/content mismatch, not a test regression. The replacement test
was an existing file in that slot.

The repository-only Node tests pass 13/13; a competing real pool claimant received `POOL_BUSY` while
the first lease was held, then the owning lease was released. Skill structure/front matter/Markdown/
PowerShell validation passes. No install, cold benchmark, GVS change, node-linker change, lockfile
change, production connection, database operation, or Mini Program upload occurred.
