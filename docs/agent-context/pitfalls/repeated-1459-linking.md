# Repeated 1459-package linking

The Schedule workspace has a large dependency graph. Repeated frozen commands may report all packages
as reused while still spending most of their time materializing worktree links. That is not evidence of
a download problem and is not a reason to run another cold install.

First check the complete dependency fingerprint and the worktree-local health markers. A matching
fingerprint reuses the existing independent `node_modules`; a mismatch reports the changed input or
environment field and stops in `REUSE_ONLY`. A missing environment selects another warm slot or returns
`BLOCKED_NO_REUSABLE_DEPENDENCY_ENV`. Never copy a writable dependency tree between worktrees, enable
GVS, delete the store, or use `--force` to hide the mismatch.
