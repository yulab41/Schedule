---
name: schedule-project-guardrails
description: Use only for the Schedule medical-staff scheduling repository. Trigger for every repository change, debug, test, build, Mini Program upload, release, production-related, or parallel-worktree task. Default to DEPENDENCY_MODE=REUSE_ONLY; new conversations and source changes do not invalidate dependencies. Parallel work requires an exclusive warm worktree. Never install dependencies, upload, or touch production without separate current-message authorization.
---

# Schedule Project Guardrails

Use this skill as a router. Existing repository rules, plans, runbooks, and tests remain the facts; do not copy them into task notes or this entrypoint.

## Enter the skill

Before any project action, run the read-only context inspector from the repository root. Choose the level from the table below; default ordinary work to `L1`.

```powershell
& .agents/skills/schedule-project-guardrails/scripts/inspect-task-context.ps1 `
  -Level L1 -TaskText '<concise task>' -Paths '<affected path>'
```

The inspector must confirm all Schedule markers and print `RESULT=PASS`. If it does not, stop using this skill. Read the reported root `AGENTS.md`, continuity status, pitfall index, applicable child `AGENTS.md`, and only the reported references. Match the pitfall index again if the diff expands.

Keep the reported `SKILL_HASH` in the current thread. When it is unchanged, do not reread this file or references already read in that thread; read only a newly routed reference. When it changes, reload this router and the references for the active task.

The default is `DEPENDENCY_MODE=REUSE_ONLY`. A conversation boundary is never a dependency invalidation boundary. Read the [dependency environment lifecycle](references/dependency-lifecycle.md) before any dependency maintenance request; ordinary task level, branch/SHA movement, missing workspace output, or a clean-source check never authorizes installation.

In `REUSE_ONLY`:

- A matching fingerprint and healthy worktree-local `node_modules` are reused.
- A fingerprint mismatch stops with the changed fields; it does not install, delete dependencies, repair the store, or use `--force`.
- A missing environment stops with `TASK_STATUS=BLOCKED_NO_REUSABLE_DEPENDENCY_ENV`.
- Normal output is `DEPENDENCIES_REUSED=true` and `INSTALL_INVOKED=false`.
- A parallel task acquires one exclusive warm slot; a busy or exhausted pool returns `POOL_BUSY` and never creates a cold worktree.

## Route the task

| Level | Use for                                                                                    | Required routing                                                                                                                                           |
| ----- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `L0`  | Read-only audit or diagnosis with no repository mutation                                   | [task levels](references/task-levels.md); add a symptom-matched reference only                                                                             |
| `L1`  | Ordinary modification or known-scope debug; default                                        | [task levels](references/task-levels.md) and [testing/evidence](references/testing-and-evidence.md)                                                        |
| `L2`  | Cross-package integration or acceptance                                                    | `L1` references plus the affected platform reference                                                                                                       |
| `L3`  | Experience upload or final release candidate                                               | [release candidate](references/release-candidate.md), [worktree/bootstrap](references/worktree-and-bootstrap.md), and affected platform/testing references |
| `L4`  | Production connection, backup, migration, deployment, rollback, or production verification | Only after explicit authorization in the current user message; then read [production](references/production.md) and all `L3` references                    |

`L0`–`L3` never upgrade themselves to `L4`. Approved design, code, tests, a Git push, or a Mini Program upload is not production authorization.

Load conditional references only when their trigger matches:

- Fresh worktree, dependency bootstrap, missing declarations/dist, or build provenance: [worktree/bootstrap](references/worktree-and-bootstrap.md) and [dependency lifecycle](references/dependency-lifecycle.md).
- Persistent worktree pool, leases, or parallel coordination: [multi-parallel workflow](references/multi-parallel-workflow.md).
- Mini Program code, build, native evidence, preview, or upload: [Mini Program](references/miniprogram.md).
- Unknown root cause or regression investigation: [debugging](references/debugging.md).
- Gate selection, comparisons, or evidence claims: [testing/evidence](references/testing-and-evidence.md).
- A matching known symptom: search the compact [known-pitfall index](references/known-pitfalls.md) by ID or symptom; do not load it for unrelated work.

Load other skills only on these triggers:

- `$miniprogram-development`: Mini Program tasks only. Repository prohibitions on WeChat DevTools GUI/CLI remain controlling.
- `$frontend-design`: visible UI or interaction-structure work only.
- `$systematic-debugging`: failures whose root cause is not already established.
- `$brainstorming`: unresolved requirements or architecture only. Do not repeat it when the user has approved a complete design.

Run [worktree safety](scripts/check-worktree-safety.ps1) before any `L3` source is prepared. Run [skill validation](scripts/validate-project-skill.ps1) after changing this skill. The reusable dependency wrapper is `scripts/codex/ensure-worktree-deps.ps1 -Mode ReuseOnly`; the bootstrap wrapper is `scripts/codex/ensure-workspace-bootstrap.ps1 -Profile <mini|api|web|root|release>`. Neither validation script authorizes a build, upload, production connection, deletion, or dependency installation.
