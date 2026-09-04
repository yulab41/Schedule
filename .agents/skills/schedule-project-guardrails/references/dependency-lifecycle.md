# Dependency environment lifecycle

This reference governs dependency reuse for the Schedule repository. It is a no-install default; the
project-local `scripts/codex/dependency-maintenance.ps1` channel is the only path that may install or
update dependencies.

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
with an explicit adoption flag, record a marker for an already healthy environment. A `.pnpmfile.cjs`
tripwire independently rejects dependency mutation before pnpm resolution/import/link unless the
single-use project-local maintenance authorization matches the exact command.

## Fingerprint

The marker is ignored project-local state under `runtime/codex/fingerprints/<worktree-key>/`, never a
tracked file. Its fingerprint includes the SHA-256 of:

- `pnpm-lock.yaml`, `pnpm-workspace.yaml`, the root `package.json`, every workspace `package.json`;
- dependency patches and pnpm hooks (`patches/**`, `.pnpmfile.*`), plus `.npmrc`/pnpm layout configuration;
- Node and pnpm versions, operating system and architecture, and the resolved pnpm store path identity (the project-local target);
- dependency-layout pnpm settings, including linker, import method, virtual-store, and cache choices;
- `nodeLinker`, package import method, global virtual store, side-effects cache, virtual-store type,
  recursive install, `verifyDepsBeforeRun`, and other dependency-layout settings.

The Schedule store target is the ignored project-local `runtime/pnpm-store` path, calculated from the
canonical project home. Existing external stores may remain for other projects, but are never used by
Schedule pool environments or its maintenance wrapper.

## Health and decisions

When the fingerprint matches and `node_modules` passes its health check:

- reuse the environment directly;
- skip `pnpm install`;

Health is a lightweight read-only check, never an install. It verifies `node_modules/.modules.yaml`,
the required root executables, the accessible project-local store, a worktree-local virtual store,
workspace links that resolve to the same worktree, and the absence of another slot/install lease.

The standard command is:

```powershell
& scripts/codex/ensure-worktree-deps.ps1 -Mode ReuseOnly
```

The only maintenance entrypoint is `scripts/codex/dependency-maintenance.ps1`. It creates a single-use
local authorization record just before the exact offline pnpm child process starts and removes it on
every exit path. Its install branch passes the calculated project-local `runtime/pnpm-store` target.

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

Dependency maintenance is independent of L0–L4. The local authorization is bound to the canonical Git
common directory, target worktree, exact command arguments, lockfile SHA-256, Node version, pnpm
version, nonce, reason, and an expiry no longer than 15 minutes. The wrapper never uses `--force`,
never enables networking, never deletes the store, and writes the dependency fingerprint only after
health passes. A second attempt cannot reuse the consumed nonce. A single-use local authorization record
is required for maintenance; in `ReuseOnly`, no install is run.
