# Line-ending portability

The Git index is LF, but Windows `core.autocrlf` previously materialized hundreds of CRLF files and
made clean release worktrees disagree with generators and Prettier. `.gitattributes` now enforces
LF for tracked text, with explicit shell and Mini-script rules retained.

Do not weaken token equality tests by normalizing strings. Regenerate tokens when the current
working tree needs one-time LF materialization. Never run broad `git add --renormalize .` in a dirty
user worktree; new/managed worktrees should rematerialize only tracked files while preserving
ignored dependencies and caches.

The current upload helper proves content diff, cached diff, untracked state and lease ownership are
clean, then detaches only the already checked-out SHA with a normal switch. It does not force a
checkout or rematerialize a retired directory. If stat-only CRLF→LF noise prevents that operation,
diagnose the exact file/index difference; never copy another task's source or output to pass it.
