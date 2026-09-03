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
- Long-lived Codex development slots may use the same-volume short external pool managed by
  `scripts/codex/manage-worktree-pool.ps1`. Use the minimum number of slots, retain healthy slots across
  conversations, and never make the writable `node_modules` root a junction shared by multiple slots.
- Final-candidate work uses the repository-managed fixed short path `$REPO_ROOT/runtime/release-worktree`. Use the existing helper; never create a worktree inside another candidate, beneath a package, or in a deeper ad hoc directory.
- Before using a candidate, run `scripts/check-worktree-safety.ps1`. A wrong, linked, unregistered, branch-attached, dirty, or commit-mismatched path fails closed. The checker never creates, cleans, switches, or deletes it.
- Only the existing release helper may create or advance the managed path. Do not delete/recreate it to solve dependency or line-ending symptoms.

## Fresh workspace outputs

A clean worktree can have installed dependencies but no generated workspace package `dist` or declarations. If a targeted Vitest collection or typecheck fails on missing workspace output, identify the producer package and run only its existing build before retrying the consumer. Do not copy `dist` from the main worktree, and do not treat a mixed-source/mixed-dist pass as evidence.

Use the repository build graph for a final candidate. Do not invent a bootstrap order or add dependencies. Dependency installation is explicit only when the managed helper reports a fingerprint miss or required dependencies are absent. A successful install that links the same 1459 packages is not a reason to repeat it; a matching helper fingerprint must reuse them.

Generated release, smoke, log, and scratch data stays in the ignored repository `runtime/` paths established by the helpers. Credentials remain outside the repository.

## Dependency lifecycle

`A conversation boundary is never a dependency invalidation boundary.`

- 不得因为新对话重装依赖；branch、源码 SHA 或 `origin/main` 前进也不是失效原因。
- 不得把 clean source 与 fresh `node_modules` 混为一谈；源码清理不得删除健康依赖。
- 相同指纹必须复用依赖，并输出 `DEPENDENCIES_REUSED=true`。
- worktree 池必须长期保留；对话结束只释放租约，不删除健康槽位。
- 安装依赖前必须输出具体失效原因；只允许 lockfile、workspace manifests、patches、pnpm hook/
  布局配置、Node/pnpm、OS/architecture 或 store 身份变化以及明确健康失败触发安装。
- 未发生指纹变化却执行 install，视为门禁失败。不得自动使用 `--force`，不得删除 pnpm store。

每个槽位先运行：

```powershell
& scripts/codex/ensure-worktree-deps.ps1 -WorktreeRoot '<slot>'
```

marker 和 install lock 位于该 worktree 的 Git 私有目录；marker 只保存相对输入及哈希、工具链和
布局事实，不保存 registry 内容、token 或绝对 store 路径。现有健康安装只能用显式
`-AdoptHealthyExisting` 迁移一次；健康失败时不得 adoption。

## Workspace bootstrap lifecycle

依赖安装与 workspace 自有产物分别管理。`scripts/codex/ensure-workspace-bootstrap.ps1` 按 profile
计算 `src/**`、`package.json`、`tsconfig*.json`、上游 workspace 指纹、Node 和 TypeScript 指纹，
只构建失效或输出损坏的共享包：

- `mini`: contracts → client-core，加独立 presentation-core；不得因此构建整个 workspace。
- `api`: contracts、database、scheduling-domain、test-fixtures。
- `web`: contracts、client-core、presentation-core、scheduling-domain、ui-tokens。
- `root-typecheck` / `release`: 全部共享 producer，仍按拓扑增量检查。

指纹一致时保留并复用 `dist` 与已有 `.tsbuildinfo`。应用 release 输出可以由其既有 helper 清理，
但不得顺带删除有效 `node_modules` 或共享 producer 输出。
