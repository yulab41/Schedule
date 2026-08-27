# Line-ending portability

The Git index is LF, but Windows `core.autocrlf` previously materialized hundreds of CRLF files and
made clean release worktrees disagree with generators and Prettier. `.gitattributes` now enforces
LF for tracked text, with explicit shell and Mini-script rules retained.

Do not weaken token equality tests by normalizing strings. Regenerate tokens when the current
working tree needs one-time LF materialization. Never run broad `git add --renormalize .` in a dirty
user worktree; new/managed worktrees should rematerialize only tracked files while preserving
ignored dependencies and caches.
