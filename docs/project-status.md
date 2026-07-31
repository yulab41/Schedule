# Project Status

This file is the concise handoff entry point for every new implementation conversation. It records current state only; Git history preserves older state.

## Current Position

- Last updated: 2026-08-01
- Branch: `main`
- Upstream: `origin/main`
- Target release: Doctor Scheduling Web 1.0
- Current phase: Phase Zero — Engineering Foundation
- Implementation plan: Approved by the user
- Implementation code: Not started

## Approved Sources

- Design specification: `docs/superpowers/specs/2026-08-01-medical-staff-scheduling-system-design.md`
- Implementation plan: `docs/superpowers/plans/2026-08-01-medical-staff-scheduling-system-implementation-plan.md`
- Repository rules: `AGENTS.md`

## Completed Work

- Product requirements and architecture are approved.
- The full design specification is committed.
- The 32-task Web 1.0 implementation plan is approved and committed.
- Automatic Git/GitHub checkpoint rules are active.
- Cross-conversation handoff rules are active.

## Active Batch

- Task 1: Initialize the TypeScript workspace.
- Task 2: Add the local Docker and environment configuration.
- Stop after Task 2, or earlier if Task 1 exposes a blocker that changes the approved toolchain.

Task 1 and Task 2 are the only implementation tasks authorized for the next conversation. Each task must be validated and committed separately.

## Required Reading for the Next Conversation

1. Read this file completely.
2. Read `AGENTS.md` completely.
3. Read Task 1 and Task 2 in the implementation plan.
4. Read design sections 3 and 20, plus any section referenced by an unexpected issue.
5. Inspect `git status --short --branch`, `git log -5 --oneline --decorate`, the current branch, and remotes.

## Known Environment State

- The repository is connected to `https://github.com/yulab41/Schedule.git`.
- `main` was synchronized with `origin/main` before this handoff update.
- Windows 11 and Docker are user-provided prerequisites but have not yet been verified by implementation commands.
- Node.js, pnpm, Docker Compose, and CloudBase development credentials have not yet been verified.
- No CloudBase development environment configuration or secrets are stored in the repository.

## Recent Checkpoints

- `0c58852` — `docs: add Web 1.0 implementation plan`
- `0a375f0` — `docs: add automatic Git checkpoint policy`
- `2238103` — `Initial commit`

## Handoff Requirements

Before ending each implementation conversation:

1. Update the current phase and completed work.
2. Record validation commands and whether they passed.
3. Record relevant decisions, deviations, blockers, and external console state.
4. Set the next active batch to 1–3 exact task numbers with a stop condition.
5. Include the status update in the appropriate task checkpoint commit.
6. Push only when `AGENTS.md` Git rules allow it.
