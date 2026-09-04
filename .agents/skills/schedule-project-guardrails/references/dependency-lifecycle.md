# Dependency environment lifecycle

This reference governs dependency reuse for the Schedule repository. It is a no-install default; a
separate dependency-maintenance task is the only path that may install or update dependencies.

## Invalidation boundary

A conversation boundary is never a dependency invalidation boundary.

None of the following is sufficient reason to install:

- a new or resumed Codex conversation, task, or branch;
- switching branches or source SHA, including a new `origin/main` tip;
- ordinary business-source changes;
- a clean-source check or a repeated test run;
- missing workspace declarations or producer `dist` output.

Use `DEPENDENCY_MODE=REUSE_ONLY` by default. In that mode the wrapper must never install, update,
rebuild, prune, delete, repair, or use `--force` for dependencies. It may read local state and, only
with an explicit adoption flag, record a marker for an already healthy environment.

## Fingerprint

The marker is ignored project-local state under `runtime/codex/fingerprints/<worktree-key>/`, never a
tracked file. Its fingerprint includes the SHA-256 of:

- `pnpm-lock.yaml`, `pnpm-workspace.yaml`, the root `package.json`, every workspace `package.json`;
- dependency patches and pnpm hooks (`patches/**`, `.pnpmfile.*`), plus `.npmrc`/pnpm layout configuration;
- Node and pnpm versions, operating system and architecture, and the resolved pnpm store path identity;
- dependency-layout pnpm settings, including linker, import method, virtual-store, and cache choices;
- `nodeLinker`, package import method, global virtual store, side-effects cache, virtual-store type,
  recursive install, `verifyDepsBeforeRun`, and other dependency-layout settings.

The future Schedule store target is the ignored project-local `runtime/pnpm-store` path, calculated
from the canonical project home. Existing external stores remain legacy transition state and are not
registered as project-local pool environments; no migration is implicit.

## Health and decisions

When the fingerprint matches and `node_modules` passes its health check:

- reuse the environment directly;
- skip `pnpm install`;

Health is a lightweight read-only check, never an install. It verifies `node_modules/.modules.yaml`,
the required root executables, an accessible store, a worktree-local virtual store, workspace links
that resolve to the same worktree, and the absence of another slot/install lease.

The standard command is:

```powershell
& scripts/codex/ensure-worktree-deps.ps1 -Mode ReuseOnly
```

The only maintenance entrypoint is `scripts/codex/dependency-maintenance.ps1`. It requires a
user-created authorization record; the wrapper does not create records, choose a store, or broaden
the authorization. Its install branch passes the calculated project-local `runtime/pnpm-store` target,
keeps `--frozen-lockfile`, and uses `--prefer-offline`: cached content is preferred, while missing
lockfile-pinned tarballs may be downloaded only inside this separately authorized channel. `ReuseOnly`
never invokes pnpm, never downloads, and never upgrades itself to maintenance. Fingerprinting and
health checks use the versioned path returned by `pnpm store path --store-dir=<project-local-target>`
(for example the target's `v11` child), never the ambient default pnpm store.

Expected reuse output is:

```text
DEPENDENCIES_REUSED=true
INSTALL_INVOKED=false
```

If no healthy environment exists:

```text
TASK_STATUS=BLOCKED_NO_REUSABLE_DEPENDENCY_ENV
DEPENDENCIES_REUSED=false
INSTALL_INVOKED=false
WORKTREE_CREATED=false
```

If a marker or input differs, stop with a field-level reason:

```text
TASK_STATUS=BLOCKED_DEPENDENCY_INSTALL_REQUIRED
DEPENDENCIES_REUSED=false
INSTALL_INVOKED=false
INVALIDATION_REASON=<field and change>
```

The caller must use another compatible warm slot or explicitly start a separately authorized
`DEPENDENCY_MAINTENANCE` task. A missing dependency environment is not repaired by creating a cold
worktree, copying `node_modules`, junctioning a writable dependency tree, or changing the pnpm store.

## Separate maintenance channel

Dependency maintenance is independent of L0–L4. The optional maintenance mode requires a user-created,
single-use local authorization record bound to the Schedule Git common directory, the exact command
hash, a reason, and an expiry no longer than 15 minutes. The wrapper validates and consumes that record;
this repository does not provide a command that creates one. No authorization record is created by this
round, and no install is run.
