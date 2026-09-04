# Schedule Codex guardrails integration

## Scope and direction correction

This L2 checkpoint closes the Schedule repository's dependency-reuse, incremental-bootstrap,
project-local warm-worktree, lease, and local Codex Hook paths. The canonical project home is derived
from the Git common directory. Persistent pool slots, ignored state, and the future package-store
target are all rooted below the repository's `runtime/` tree.

An earlier integration checkpoint was created before the project-local layout correction. Its external
worktree and the pre-existing external dependency environment remain untouched as legacy transition
state. They are not registered in the project-local pool, are not moved or cleaned by this change, and
are not evidence that the project-local store has been migrated.

## Candidate audit

The audited candidate was `5c45236d` on branch `codex/schedule-project-guardrails`. Its two unique
commits were `411399e7` (`chore(agent): add Schedule project guardrails`) and `5c45236d`
(`perf(dev): reuse worktree dependencies by fingerprint`). The useful Skill, fingerprint, bootstrap,
pool, lease, Hook, and validation ideas were selectively reimplemented from the latest main tip.

The candidate's date-drift test edits were not tooling prerequisites: the Mini boundary fix was already
on main, while the two Web edits were candidate-only behavior changes. The cold-install measurement
script, performance audit, long debug log, old status snapshot, and any runtime artifacts were also
excluded. No lockfile, workspace configuration, dependency declaration, production Compose, migration,
or business runtime change was ported.

## Project-local decisions

- `DEPENDENCY_MODE=REUSE_ONLY` is the default for every task level. Conversation, branch, source SHA,
  remote-main movement, ordinary source changes, clean-source checks, and missing producer output do
  not trigger installation.
- Dependency fingerprints are separate from workspace bootstrap fingerprints. Dependency markers and
  locks are keyed by canonical worktree identity under ignored `runtime/codex/fingerprints/`.
- The pool manager accepts only existing direct-child worktrees under `runtime/wt`. It never creates a
  cold fallback, shares a writable dependency tree, resets a slot, runs destructive cleanup, or deletes
  `node_modules`. Leases are atomic files under `runtime/codex/leases/`.
- Dependency maintenance is a separate user-authorized channel with an exact command hash, single use,
  and a maximum 15-minute lifetime. No maintenance authorization was created by this checkpoint.
- The project-local Hook wrapper resolves the current checkout with Git, then imports the canonical
  repository Hook source and relative project config. The project Hook still requires manual trust in
  the Codex `/hooks` UI; trust data was not changed automatically.

## Evidence and limits

The project-local integration worktree has no dependency environment. Its ReuseOnly path therefore
fails closed with `TASK_STATUS=BLOCKED_NO_REUSABLE_DEPENDENCY_ENV`,
`DEPENDENCIES_REUSED=false`, `INSTALL_INVOKED=false`, and `WORKTREE_CREATED=false`. No project-local
warm slot was created by installing dependencies, and no legacy external slot was adopted after the
layout correction.

Lightweight validation covers Skill structure/front matter/Markdown, project Hook JSON, Node syntax,
PowerShell AST, fingerprint/bootstrap/pool tests, Hook synthetic events, exact ignore rules, and
`git diff --check`. No dependency install/fetch/rebuild/prune, cold benchmark, full verification,
browser smoke, production operation, database migration, Mini Program upload, or store migration is
part of this checkpoint.
