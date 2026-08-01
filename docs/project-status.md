# Project Status

This file is the concise handoff entry point for every new implementation conversation. It records current state only; Git history preserves older state.

## Current Position

- Last updated: 2026-08-01
- Branch: `main`
- Upstream: `origin/main`
- Target release: Doctor Scheduling Web 1.0
- Current phase: Phase Zero — Engineering Foundation
- Implementation plan: Approved by the user
- Implementation code: Task 1 complete; Task 2 is next.

## Approved Sources

- Design specification: `docs/superpowers/specs/2026-08-01-medical-staff-scheduling-system-design.md`
- Implementation plan: `docs/superpowers/plans/2026-08-01-medical-staff-scheduling-system-implementation-plan.md`
- Repository rules: `AGENTS.md`

## Completed Work

- Product requirements, architecture, and the 32-task implementation plan are approved and committed.
- Automatic Git/GitHub checkpoint and cross-conversation handoff rules are active.
- Task 1 completed: pnpm TypeScript workspace with minimal API, Vue Web, contracts, database, and scheduling-domain package entries.
- Task 1 completed: strict TypeScript, ESLint, Prettier, Vitest, build/typecheck scripts, secure pnpm build approval, and local-output/secret ignore rules.

## Active Batch

- Task 2: Add the local Docker and environment configuration.
- Stop after Task 2, or earlier if Docker availability or its required configuration exposes a blocker.

Task 2 is the only remaining implementation task authorized for this conversation. It must be validated and committed separately.

## Required Reading for the Next Conversation

1. Read this file completely.
2. Read `AGENTS.md` completely.
3. Read Task 2 in the implementation plan.
4. Read design sections 3 and 20, plus any section referenced by an unexpected issue.
5. Inspect `git status --short --branch`, `git log -5 --oneline --decorate`, the current branch, and remotes.

## Known Environment State

- The repository is connected to `https://github.com/yulab41/Schedule.git`.
- `main` was synchronized with `origin/main` before this handoff update.
- Node.js v24.14.0, pnpm v11.9.0, Docker v29.4.0, and Docker Compose v5.1.2 were detected.
- Docker's client reported that the sandbox cannot read the user's Docker configuration file; Docker engine and compose startup are still unverified and are Task 2 validation.
- No CloudBase development environment configuration or secrets are stored in the repository.

## Latest Validation

- Task 1: `pnpm install --frozen-lockfile=false` passed after allowing only `esbuild` in pnpm's committed `allowBuilds` configuration.
- Task 1: `pnpm verify` passed: Prettier, ESLint, strict TypeScript checks for five workspace packages, 1 Vitest test, and all package/Web production builds.

## Recent Checkpoints

- `0c58852` — `docs: add Web 1.0 implementation plan`
- `0a375f0` — `docs: add automatic Git checkpoint policy`
- `2238103` — `Initial commit`
- Pending checkpoint: `chore: scaffold TypeScript workspace`

## Handoff Requirements

Before ending each implementation conversation:

1. Update the current phase and completed work.
2. Record validation commands and whether they passed.
3. Record relevant decisions, deviations, blockers, and external console state.
4. Set the next active batch to 1–3 exact task numbers with a stop condition.
5. Include the status update in the appropriate task checkpoint commit.
6. Push only when `AGENTS.md` Git rules allow it.
