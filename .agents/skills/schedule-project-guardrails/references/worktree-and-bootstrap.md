# Worktree and bootstrap routing

Read this reference only for a fresh/managed worktree, dependency bootstrap, build provenance, or missing workspace outputs.

Authoritative sources:

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

## Fresh workspace outputs

A clean worktree can have installed dependencies but no generated workspace package `dist` or declarations. If a targeted Vitest collection or typecheck fails on missing workspace output, identify the producer package and run only its existing build before retrying the consumer. Do not copy `dist` from the main worktree, and do not treat a mixed-source/mixed-dist pass as evidence.

Use the repository build graph for a final candidate. Do not invent a bootstrap order or add dependencies. Dependency installation is explicit only when the managed helper reports a fingerprint miss or required dependencies are absent. A successful install that links the same 1459 packages is not a reason to repeat it; a matching helper fingerprint must reuse them.

Generated release, smoke, log, and scratch data stays in the ignored repository `runtime/` paths established by the helpers. Credentials remain outside the repository.
