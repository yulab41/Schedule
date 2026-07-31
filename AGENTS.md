# Project Agent Rules

These instructions apply to the entire repository.

## Cross-Conversation Continuity

Do not rely on prior chat history when starting or resuming implementation.

At the beginning of every implementation conversation:

1. Read `docs/project-status.md` completely.
2. Inspect the Git state and recent history as required below.
3. Read the exact active task sections in `docs/superpowers/plans/2026-08-01-medical-staff-scheduling-system-implementation-plan.md`.
4. Read the design sections linked or implicated by those tasks in `docs/superpowers/specs/2026-08-01-medical-staff-scheduling-system-design.md`.
5. Confirm that the active batch in `docs/project-status.md` matches the code and Git history before editing.

Complete only 1 to 3 implementation tasks per conversation. Prefer 1 task for complex domain, concurrency, deployment, or security work and 2 tasks for ordinary dependent work. Never begin a task outside the active batch merely because context remains available.

Before each task checkpoint commit, update `docs/project-status.md` with:

- Completed task numbers and outcomes.
- Validation commands and results.
- Commit hash if already known from the preceding checkpoint, otherwise the commit message that will identify the checkpoint.
- Decisions, deviations, blockers, and external console state needed by the next conversation.
- The exact next active batch of 1 to 3 tasks and its stop condition.

Keep `docs/project-status.md` concise and current rather than turning it into a full historical log. Git history is the durable history. A new conversation should be able to resume safely from the repository alone.

## Git and GitHub Checkpoints

At the beginning of every new task or conversation that may change repository files:

1. Inspect `git status --short --branch`, the current branch, recent commits, and configured remotes.
2. Treat pre-existing uncommitted changes as user-owned. Do not discard, rewrite, stage, or commit unrelated changes.
3. Work on the current branch unless the user explicitly requests another branch.

At the end of each task, decide whether the work forms a safe version checkpoint.

Create a Git commit when all of the following are true:

- The task changed repository files and the requested unit of work is complete.
- Relevant validation has passed, or the change is an approved documentation-only update that has been reviewed for consistency.
- The staged diff contains only files belonging to the completed task.
- No credentials, secrets, local environment files, generated caches, or unrelated user changes are included.

Do not create a commit when the task is read-only, work is incomplete, validation has a relevant failure, merge conflicts exist, or the diff cannot be safely separated from unrelated user changes. Report the reason instead.

Before committing:

1. Review `git diff` and `git diff --cached`.
2. Stage explicit task-related paths rather than staging the whole repository blindly.
3. Use a concise commit message that describes one coherent version checkpoint.

After creating a commit, push the current branch to its configured GitHub upstream when all of the following are true:

- An `origin` remote and upstream branch are configured.
- The user has not asked to keep the commit local.
- The push is a normal fast-forward push and does not require force.
- Authentication and network access are available.

Never force-push, rewrite published history, delete remote branches, or bypass branch protection unless the user explicitly requests the exact operation. If a push fails, keep the local commit intact and report the failure.

In the final response, state whether a commit was created, include its short hash and message, and state whether the GitHub push succeeded. This policy requires judgment; it does not mean every conversation must produce a commit.
