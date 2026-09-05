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
- Final upload candidates use an exclusive healthy direct-child `runtime/wt` slot. The existing release helper freezes its already checked-out clean SHA and records upload purpose/expiry in the same owned lease; see [candidate routing](release-candidate.md).
- Before building and uploading, run the existing `scripts/check-worktree-safety.ps1` with exact path, SHA, lease token and RUN_ID. Wrong, linked, unregistered, foreign, expired, development-only, branch-attached, dirty or commit-mismatched candidates fail closed. The checker never mutates them.
- Do not resurrect, delete or recreate the retired `runtime/release-worktree`, copy dependencies, or create nested/cold candidates to satisfy a legacy path assumption.

Start recursive audits with explicit allowlists/exclusions for `.git`, `node_modules`, `dist`, `runtime/wt`,
`runtime/codex`, and recovery/evidence roots. Before archive or delete, require a worktree gitfile/metadata,
matching `git rev-parse --show-toplevel`, and membership in `git worktree list`; `git -C <path>` alone is not proof.

## Routing

The complete dependency rules are in [dependency lifecycle](dependency-lifecycle.md). The complete lease and pool rules are in [multi-parallel workflow](multi-parallel-workflow.md). Keep these concerns separate: dependency health decides whether an environment can be reused; bootstrap health decides which workspace producers need incremental rebuilding.

## Fresh workspace outputs

A clean worktree can have installed dependencies but no generated workspace package `dist` or declarations. If a targeted Vitest collection or typecheck fails on missing workspace output, identify the producer package and run only its existing build before retrying the consumer. Do not copy `dist` from the main worktree, and do not treat a mixed-source/mixed-dist pass as evidence.

Use the repository build graph for a final candidate. Do not invent a bootstrap order or add dependencies. A missing declaration or `dist` file is a producer-bootstrap decision; dependency reuse follows the canonical lifecycle reference above.

Generated release, smoke, log, recovery, lease, fingerprint, and scratch data stays in the ignored
repository `runtime/` paths established by the helpers. Credentials remain outside the repository.

Install tripwire and authorized reconciliation decisions belong only to
[dependency lifecycle](dependency-lifecycle.md); use its official checks.
