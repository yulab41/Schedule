---
name: schedule-project-guardrails
description: Route Schedule repository changes, debugging, builds, Mini Program uploads, release candidates, and production work through project-specific context, authorization, worktree, and validation guardrails. Use only when the Schedule repository markers match.
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

- Fresh worktree, dependency bootstrap, missing declarations/dist, or build provenance: [worktree/bootstrap](references/worktree-and-bootstrap.md).
- Mini Program code, build, native evidence, preview, or upload: [Mini Program](references/miniprogram.md).
- Unknown root cause or regression investigation: [debugging](references/debugging.md).
- Gate selection, comparisons, or evidence claims: [testing/evidence](references/testing-and-evidence.md).
- A matching known symptom: search the compact [known-pitfall index](references/known-pitfalls.md) by ID or symptom; do not load it for unrelated work.

Load other skills only on these triggers:

- `$miniprogram-development`: Mini Program tasks only. Repository prohibitions on WeChat DevTools GUI/CLI remain controlling.
- `$frontend-design`: visible UI or interaction-structure work only.
- `$systematic-debugging`: failures whose root cause is not already established.
- `$brainstorming`: unresolved requirements or architecture only. Do not repeat it when the user has approved a complete design.

Run [worktree safety](scripts/check-worktree-safety.ps1) before any `L3` source is prepared. Run [skill validation](scripts/validate-project-skill.ps1) after changing this skill. Neither script authorizes a build, upload, production connection, or deletion.
