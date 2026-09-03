# Task levels and authority

Read this reference for every Schedule task after the repository markers pass. The root [AGENTS.md](../../../../AGENTS.md), current [project status](../../../../docs/project-status.md), and user message remain authoritative.

## Classification

| Level | Entry condition                                                                                                        | Normal completion boundary                                                   |
| ----- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `L0`  | Inspection, review, explanation, evidence inventory, or diagnosis that does not edit files or external state           | Report evidence and unknowns; do not commit or mutate                        |
| `L1`  | A scoped code/document/configuration change, or debug with a known cause                                               | Targeted red/green tests, affected package gates, status/checkpoint decision |
| `L2`  | Multiple packages or runtime surfaces must work together, or an integration/acceptance claim is requested              | Relevant integration gates and evidence at the claimed layer                 |
| `L3`  | A final candidate is being built, measured, previewed, or uploaded                                                     | Exact clean SHA, isolated worktree, final relevant gates, traceable evidence |
| `L4`  | Any production connection, backup, data migration, deployment, rollback, capability change, or production verification | The explicitly authorized production action and its runbook verification     |

Default edits and debugging to `L1`. Choose `L2` only when the requested claim crosses a package or runtime boundary. Choose `L3` only for a final candidate or an experience-track action, not for every edit.

## Non-escalation

- `L0`–`L3` cannot infer `L4` from repository policy, prior chat, a status file, approval of a design, approval of code, successful tests, a commit, a push, or an upload.
- Enter `L4` only when the current user message explicitly authorizes the exact production action. Ambiguous words such as “release”, “finish”, or “publish” are insufficient when the target is unclear.
- Mini-only changes do not authorize server deployment, database migration, a production backup, or a capability change.
- Experience upload changes external state and requires the current-message approval required by the Mini audit rules. Review submission and formal publication always require separate explicit approval.

## Work within the selected level

Do not broaden the active batch. Preserve pre-existing changes as user-owned, stage exact task paths, and leave the current activity and stop condition in `docs/project-status.md` intact unless the user explicitly changes them. Follow the root checkpoint policy after validation, but an explicit user prohibition on upload or production work is a hard stop.
