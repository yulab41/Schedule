# Worktree and bootstrap routing

Read this reference only for a fresh/managed worktree, dependency bootstrap, build provenance, or missing workspace outputs.

Authoritative sources:

- [Repository-local artifact and worktree policy](../../../../AGENTS.md#project-local-generated-artifacts)
- [Release worktree helper](../../../../scripts/prepare-release-worktree.mjs) and its [tests](../../../../scripts/prepare-release-worktree.test.mjs)
- [ECS deployment runbook](../../../../docs/deployment/aliyun-ecs.md)
- [pnpm preflight pitfall](../../../../docs/agent-context/pitfalls/pnpm-preflight-build-policy.md)
- [line-ending pitfall](../../../../docs/agent-context/pitfalls/line-ending-portability.md)
- [project-local artifact guard](../../../../scripts/project-local-artifacts.test.mjs)
- [dependency lifecycle](dependency-lifecycle.md)
- [parallel workflow](multi-parallel-workflow.md)

## Boundaries

The project-local `.codex/setup.ps1` is a no-install setup script. It only resolves the canonical home
from the Git common directory, reads the current `AGENTS.md`/legacy overlay, and checks an existing
pool slot. It does not acquire a different Codex worktree, create `node_modules`, run bootstrap, or
install dependencies. Task routing performs Acquire separately.

- Ordinary `L1` work stays in the current worktree; do not create another worktree merely for convenience.
- The canonical project home is the parent of the Git common directory. New persistent Schedule pool
  slots are direct children of its `runtime/wt` directory; a linked worktree must never be used as the
  base for a nested `runtime/wt` path.
- `runtime/wt`, `runtime/codex`, and `runtime/pnpm-store` are exact ignored project-local paths. They
  are excluded from workspace and tool discovery, while other managed `runtime/` evidence remains
  governed by the existing scoped rules.
- Final-candidate work uses the repository-managed fixed short path `$REPO_ROOT/runtime/release-worktree`. Use the existing helper; never create a worktree inside another candidate, beneath a package, or in a deeper ad hoc directory.
- Before using a candidate, run `scripts/check-worktree-safety.ps1`. A wrong, linked, unregistered, branch-attached, dirty, or commit-mismatched path fails closed. The checker never creates, cleans, switches, or deletes it.
- Only the existing release helper may create or advance the managed path. Do not delete/recreate it to solve dependency or line-ending symptoms.

## Routing

The complete dependency rules are in [dependency lifecycle](dependency-lifecycle.md). The complete lease and pool rules are in [multi-parallel workflow](multi-parallel-workflow.md). Keep these concerns separate: dependency health decides whether an environment can be reused; bootstrap health decides which workspace producers need incremental rebuilding.

## Fresh workspace outputs

A clean worktree can have installed dependencies but no generated workspace package `dist` or declarations. If a targeted Vitest collection or typecheck fails on missing workspace output, identify the producer package and run only its existing build before retrying the consumer. Do not copy `dist` from the main worktree, and do not treat a mixed-source/mixed-dist pass as evidence.

Use the repository build graph for a final candidate. Do not invent a bootstrap order or add dependencies. A missing declaration or `dist` file is a producer-bootstrap decision, never a reason to install dependencies. A successful install that links the same 1459 packages is not a reason to repeat it; a matching fingerprint and healthy `node_modules` must be reused.

Generated release, smoke, log, recovery, lease, fingerprint, and scratch data stays in the ignored
repository `runtime/` paths established by the helpers. Credentials remain outside the repository.

The project `.pnpmfile.cjs` is an early install tripwire. Direct local dependency mutation must exit
before import/link and point to `scripts/codex/dependency-maintenance.ps1`; preinstall-only checks are
not an acceptable substitute.

For the L2 exact-lockfile reconciliation rule and the icon-specific dependency evidence contract, also read
[worktree and dependencies](worktree-and-dependencies.md). Do not use that route to bypass the no-install
default or to manually repair workspace links.
