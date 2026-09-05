---
name: schedule-project-guardrails
description: Use for every Schedule modification, debug, test, build, upload, release, production-related, or parallel task. Default DEPENDENCY_MODE=REUSE_ONLY; acquire an exclusive warm worktree first. New conversations are not dependency invalidation. Ordinary tasks have no install permission. Schedule does not depend on Hooks or manual trust.
---

# Schedule Project Guardrails

Use this skill as a router; repository rules, plans, runbooks, and tests remain the facts.

## Enter the skill

Before any project action, run the read-only context inspector from the repository root. Choose the level from the table below; default ordinary work to `L1`.

```powershell
& .agents/skills/schedule-project-guardrails/scripts/inspect-task-context.ps1 `
  -Level L1 -TaskText '<concise task>' -Paths '<affected path>'
```

The inspector must confirm Schedule markers and print `RESULT=PASS`; otherwise stop. Read the reported root
`AGENTS.md`, status, pitfall index, applicable child `AGENTS.md`, and only the reported references. Rematch
the pitfall index if the diff expands.

Keep `SKILL_HASH` in the thread. If unchanged, reread only newly routed references; if changed, reload this
router and the active references.

The default is `DEPENDENCY_MODE=REUSE_ONLY`. A conversation boundary is never a dependency invalidation boundary. Read the [dependency environment lifecycle](references/dependency-lifecycle.md) for maintenance;
ordinary task level, branch/SHA movement, missing output, or clean checks never authorize installation.

Every new Schedule task started from the canonical root follows this first-line route before source edits:

```text
TASK_LEVEL=<L0-L4>
DEPENDENCY_MODE=REUSE_ONLY
ASSIGNED_WORKTREE=<path>
DEPENDENCIES_REUSED=true
INSTALL_INVOKED=false
HIGHEST_GATE=<gate>
```

The task invokes `scripts/codex/manage-worktree-pool.ps1 -Action Acquire`, then runs ReuseOnly, incremental
bootstrap, and a targeted test in the returned slot. The canonical root and non-pool managed worktrees are
routing surfaces only. A full pool returns
`TASK_STATUS=POOL_BUSY`, `INSTALL_INVOKED=false`, and `WORKTREE_CREATED=false`.

`.codex/setup.ps1` is no-install: it derives the canonical home from Git common-dir, reads the route, and
checks only an assigned pool slot. Schedule has no Hook registration, Hook trust state, or `/hooks` dependency.
The only non-maintenance install exception is the committed GitHub Actions fresh-checkout path, covered by synthetic tripwire allow/deny tests; it is not a local bypass.

In `REUSE_ONLY`:

- A matching fingerprint and healthy worktree-local `node_modules` are reused.
- A fingerprint mismatch stops with the changed fields; it does not install, delete dependencies, repair the store, or use `--force`.
- A missing environment stops with `TASK_STATUS=BLOCKED_NO_REUSABLE_DEPENDENCY_ENV`.
- Normal output is `DEPENDENCIES_REUSED=true` and `INSTALL_INVOKED=false`.
- A parallel task acquires one exclusive warm slot; a busy or exhausted pool returns `POOL_BUSY` and never creates a cold worktree.

For a fingerprint mismatch, report `TASK_STATUS=BLOCKED_DEPENDENCY_INSTALL_REQUIRED`,
`DEPENDENCIES_REUSED=false`, `INSTALL_INVOKED=false`, and changed fields. Missing producer `dist` is a
bootstrap decision, never an install trigger.

## Route the task

| Level | Use for                                                                                    | Required routing                                                                                                                                           |
| ----- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `L0`  | Read-only audit or diagnosis with no repository mutation                                   | [task levels](references/task-levels.md); add a symptom-matched reference only                                                                             |
| `L1`  | Ordinary modification or known-scope debug; default                                        | [task levels](references/task-levels.md) and [testing/evidence](references/testing-and-evidence.md)                                                        |
| `L2`  | Cross-package integration or acceptance                                                    | `L1` references plus the affected platform reference                                                                                                       |
| `L3`  | Experience upload or final release candidate                                               | [release candidate](references/release-candidate.md), [worktree/bootstrap](references/worktree-and-bootstrap.md), and affected platform/testing references |
| `L4`  | Production connection, backup, migration, deployment, rollback, or production verification | Only after explicit authorization in the current user message; then read [production](references/production.md) and all `L3` references                    |

`L0`–`L3` never upgrade themselves to `L4`. Approved design, code, tests, a Git push, or a Mini Program upload is not production authorization.

Version, SHA, and release identifiers in prompts, examples, plans, or status snapshots are observations, never permanent defaults. For identity-sensitive evidence or external actions, follow the [dynamic release identity](references/release-candidate.md#dynamic-release-identity) rule: discover the latest state permitted by current authorization, revalidate before mutation, and freeze the run baseline when the operation starts. Keep the latest `origin/main`, the latest eligible uploaded trial, and the production live release distinct; a live production lookup remains `L4`.

Load conditional references only when their trigger matches:

- Fresh worktree, dependency bootstrap, missing declarations/dist, or build provenance: [worktree/bootstrap](references/worktree-and-bootstrap.md) and [dependency lifecycle](references/dependency-lifecycle.md).
- Persistent worktree pool, leases, or parallel coordination: [multi-parallel workflow](references/multi-parallel-workflow.md).
- Mini Program code, build, native evidence, preview, or upload: [Mini Program](references/miniprogram.md). For a Mini modification, this conditional reference plus the level-required testing/evidence reference replaces a repeated Mini safety preamble; do not load it for non-Mini work.
- Unknown root cause or regression investigation: [debugging](references/debugging.md).
- Gate selection, comparisons, or evidence claims: [testing/evidence](references/testing-and-evidence.md).
- Web/Mini icon source, context, state, motion, asset liveness, or gallery work: [icon parity](references/icon-parity.md).
- VPN/TUN, GitHub, WeChat upload, or ECS route selection: [network and VPN](references/network-and-vpn.md).
- A matching known symptom: search the compact [known-pitfall index](references/known-pitfalls.md) by ID or symptom; do not load it for unrelated work.

Load other skills only on these triggers:

- `$miniprogram-development`: Mini Program tasks only. Repository prohibitions on WeChat DevTools GUI/CLI remain controlling.
- `$frontend-design`: visible UI or interaction-structure work only.
- `$systematic-debugging`: failures whose root cause is not already established.
- `$brainstorming`: unresolved requirements or architecture only. Do not repeat it when the user has approved a complete design.

Run [worktree safety](scripts/check-worktree-safety.ps1) before any `L3` source is prepared. Run [skill validation](scripts/validate-project-skill.ps1) after changing this skill. The reusable dependency wrapper is `scripts/codex/ensure-worktree-deps.ps1 -Mode ReuseOnly`; the bootstrap wrapper is `scripts/codex/ensure-workspace-bootstrap.ps1 -Profile <mini|api|web|root|release>`. Neither validation script authorizes a build, upload, production connection, deletion, or dependency installation.
