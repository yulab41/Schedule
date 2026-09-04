# Persistent parallel worktree workflow

## Pool and ownership

The Schedule pool is project-local and lives under the canonical project home at `runtime/wt`; its
registration and lease state lives under the ignored `runtime/codex` tree. The pool manager may
register existing direct-child worktrees, but it must never create a cold worktree as a fallback and
must never place a worktree inside another worktree.

Each active task owns one worktree and its own writable `node_modules`. Two tasks may not share a slot,
branch, `HEAD`, writable dependency directory, or mixed `dist` output. Existing worktrees not explicitly
released by their owner are `external/occupied`: do not register over them, move them, clean them, or
change their branch.

Slot selection is ordered as follows:

1. the current task's already healthy bound worktree;
2. a registered `permanent/free/clean` compatible warm slot;
3. another explicitly released clean worktree with independent healthy dependencies;
4. no slot: return `POOL_BUSY` or `BLOCKED_NO_REUSABLE_DEPENDENCY_ENV`.

Never fall back to `new worktree -> install -> full build`.

## Lease

Lease state is local and lives under `runtime/codex/leases/`, never in Git administrative state.
Acquire uses an atomic create operation. A lease records at least the slot path, session ID,
task/thread ID, owner PID and process evidence, acquisition time, last heartbeat, `HEAD`, branch,
dependency fingerprint, bootstrap profile, status, and a random lease token. A second claimant seeing
the same atomic lease returns exactly:

```text
TASK_STATUS=POOL_BUSY
INSTALL_INVOKED=false
WORKTREE_CREATED=false
```

Release requires the owning token/session, a clean worktree, and evidence of no active test, build,
server, or child process. Release removes only that lease record; it never resets, checks out, cleans,
deletes the worktree, or deletes `node_modules`.

An expired lease is not reclaimed merely because a conversation ended. Reclaim requires all of these:
the recorded process/session is absent, the TTL is exceeded, the worktree is clean, no child or related
process remains, and the slot identity, `HEAD`, and registration still match. If any check is uncertain,
leave the lease in place and fail closed.

## Bootstrap after reuse

After dependency reuse, run only the requested incremental bootstrap profile:

```text
mini   contracts, client-core, presentation-core
api    contracts, database, scheduling-domain, test-fixtures
web    contracts, client-core, presentation-core, scheduling-domain, ui-tokens
root   all existing shared producers needed by root checks
release all existing shared producers needed by a release build
```

The bootstrap fingerprint is separate from the dependency fingerprint. It hashes each producer's
`src/**`, `package.json`, `tsconfig*.json`, build script, TypeScript/Node versions, and upstream
producer fingerprints. Rebuild only changed producers or missing/invalid outputs; reuse valid `dist`
and `.tsbuildinfo`. Missing outputs never trigger dependency installation. A release clean build may
clear application outputs but must not delete a valid dependency environment.

## Capacity

The maximum no-install concurrency is the number of registered free warm slots with independent healthy
dependencies, not the number of chats or Git worktrees. When capacity is exhausted, queue or return
`POOL_BUSY`; never silently run a cold install.
