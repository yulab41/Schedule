# Worktree and bootstrap routing

Read this reference only for a fresh/managed worktree, dependency bootstrap, build provenance, or missing workspace outputs.

Authoritative sources:

- [Repository-local artifact and worktree policy](../../../../AGENTS.md#project-local-generated-artifacts)
- [Release worktree helper](../../../../scripts/prepare-release-worktree.mjs) and its [tests](../../../../scripts/prepare-release-worktree.test.mjs)
- [ECS deployment runbook](../../../../docs/deployment/aliyun-ecs.md)
- [pnpm preflight pitfall](../../../../docs/agent-context/pitfalls/pnpm-preflight-build-policy.md)
- [line-ending pitfall](../../../../docs/agent-context/pitfalls/line-ending-portability.md)
- [project-local artifact guard](../../../../scripts/project-local-artifacts.test.mjs)

## Boundaries

- Ordinary `L1` work stays in the current worktree; do not create another worktree merely for convenience.
- Final-candidate work uses the repository-managed fixed short path `$REPO_ROOT/runtime/release-worktree`. Use the existing helper; never create a worktree inside another candidate, beneath a package, or in a deeper ad hoc directory.
- Before using a candidate, run `scripts/check-worktree-safety.ps1`. A wrong, linked, unregistered, branch-attached, dirty, or commit-mismatched path fails closed. The checker never creates, cleans, switches, or deletes it.
- Only the existing release helper may create or advance the managed path. Do not delete/recreate it to solve dependency or line-ending symptoms.

## Dependency environment lifecycle

A conversation boundary is never a dependency invalidation boundary.

Do not run `pnpm install` merely because:

- a new Codex conversation started;
- a new task branch was created;
- `origin/main` advanced;
- the worktree switched to another SHA;
- a clean-source verification is required.

Before installing, run the repository's read-only checker from the worktree root:

```powershell
node scripts/check-dependency-environment.mjs
```

`DEPENDENCY_ENVIRONMENT=MATCH` exits successfully and authorizes reuse. `MISS` reports only the
fingerprint/health reason and does not mutate the worktree. It is not install authorization by itself.
After the current task has explicit dependency-install authorization, use the guarded installer:

```powershell
node scripts/install-dependency-environment.mjs
```

The installer rechecks first, performs at most one frozen install on a `MISS`, verifies health before
recording the worktree-local marker, and performs no install on `MATCH`. The release worktree helper uses
the same implementation rather than a separate marker contract.

The dependency fingerprint must include:

- `pnpm-lock.yaml`;
- `pnpm-workspace.yaml`;
- all workspace `package.json` files;
- dependency patches and pnpm hooks;
- Node and pnpm versions;
- operating system and architecture;
- dependency-layout pnpm settings;
- the resolved pnpm store path.

When the fingerprint matches and `node_modules` passes its health check:

- skip `pnpm install`;
- retain the worktree-local `node_modules`;
- proceed directly to the required bootstrap or test.

Use a persistent pool of short-path worktrees on the same drive as the repository and pnpm store. Do not delete these worktrees at the end of each conversation. Never use `git clean -xfd` on a reusable worktree.

For Schedule, “same drive” still means the ignored repository-local `runtime/` locations required by the root `AGENTS.md`; it does not authorize sibling `Schedule-*` directories or relocating this repository-local Skill into a worktree-only branch.

Each worktree keeps its own `node_modules`. Do not junction one writable `node_modules` directory into multiple worktrees.

Workspace build outputs have a separate source/config fingerprint. Rebuild only the shared workspace packages whose fingerprint changed.

A production or release clean build may clear application build outputs, but must not delete a valid dependency environment solely to demonstrate source cleanliness.

A helper result counts only when it covers every fingerprint and health dimension above. If the current main branch has no applicable complete checker for a worktree, stop and report the missing guard; do not substitute an install or claim that a partial marker is the full fingerprint.

## Fresh workspace outputs

A clean worktree can have installed dependencies but no generated workspace package `dist` or declarations. If a targeted Vitest collection or typecheck fails on missing workspace output, identify the producer package and run only its existing build before retrying the consumer. Do not copy `dist` from the main worktree, and do not treat a mixed-source/mixed-dist pass as evidence.

Use the repository build graph for a final candidate. Do not invent a bootstrap order or add dependencies. Dependency installation is explicit only when the applicable complete project check proves a fingerprint miss or dependency-health failure. A successful install that links the same 1459 packages is not a reason to repeat it; a matching fingerprint and healthy `node_modules` must be reused.

Generated release, smoke, log, and scratch data stays in the ignored repository `runtime/` paths established by the helpers. Credentials remain outside the repository.
