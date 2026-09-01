# 微信小程序审计状态

- 当前阶段：`MINI-G1-001`（workflow `controller-host.ts` 异步生命周期失效边界）已完成先红后绿修复，
  等待本分支最终 checkpoint 与推送后关闭
- 本轮起始/提交前复核主线：`origin/main@eb36d70fa28cf8705b0795a516ea3d4420399efc`
- 分支/worktree：`codex/fix-mini-g1-001-lifecycle` /
  `runtime/external-project-worktrees/mini-g1-001-lifecycle-20260901`
- 计划 checkpoint：`fix(miniprogram): invalidate stale workflow controllers`
- 范围：只修改共享 workflow host、leave/swap/duty 三个 controller、永久回归和审计/状态/debug 文档；
  `MINI-G1-002`～`004`、API、数据库、缓存、页面交互、其他 worktree 均未修改
- 外部状态：未调用微信开发者工具 GUI/CLI，未上传体验版、未提审/发布、未修改 allowlist，未部署
  production 或创建生产备份

## 基线与继承事实

- 远端审计提交 `4ddaa38e70adbc356e2cc390ea2c3ebe2ad30fd2` 不是当前主线祖先；本轮只把其中三份
  审计/状态文档的等价内容合入新修复分支，没有从旧审计分支带入任何源码。
- `d23a78a9` 是历史验收侧枝，不是当前主线祖先；主线 `a2cdd065` 已等价恢复已验收 test-tools
  Flex、换行和截图类不变量。非祖先关系本身不是停止条件，只有相关路径变化或不变量失效才重查；
  本轮没有重开已关闭的 Skyline Warning、真机验收或 automator null。
- `apps/miniprogram/AGENTS.md` 指向的历史 plans 相对路径已失效；实际计划位于
  `apps/miniprogram/docs/plans/2026-08-17-wechat-miniprogram-migration-plan.md`。内容可读，路径问题
  不阻断本任务。
- fresh worktree 依赖按 `pnpm-preflight-build-policy` 初始化；`pnpm install --frozen-lockfile` 复用
  1,459 包、0 下载，packages 7 项预构建通过，没有借用主工作区 ignored dist。

## MINI-G1-001 结论

- 等级/状态：P1，`已确认并修复（逻辑层）`；微信原生可见故障尚未确认，不能表述为真机已复现。
- 原审计临时 Node/Vitest 探针稳定复现 detach 后回写与 A→B serial 碰撞，随后已删除且未入 Git；
  本轮开始时仓库没有永久回归。
- 根因：共享 host 在 factory 重建时把 controller 私有 serial 从 0 重新复制到同一实例；detach/unload
  只丢 controller，没有 host-owned、不可碰撞的 attachment/controller 身份。A→B 时组件仍 mounted，
  所以单一 `mounted` 布尔值不能失效旧上下文。
- 生产调用者共 6 个：leave/swap/duty 三个组件调用 `registerWorkflowPanel`，同名三个直达 Page 调用
  `createWorkflowPageDefinition`。三个 controller 均无自身 `onUnload`/`dispose`；现在由共享 host 统一
  dispose。
- 修复：每次 attachment 与 controller 安装分配新的对象 token；detach、Page unload、group 置空、
  A→B 替换统一 dispose；延迟 `workspaceready`、info timer 和 controller async 续体都验证捕获身份。
- 审计范围内 32 个 async 函数、83 个 await 均遵守同一 task guard：过期 resolve/reject 不得
  `setData`、修改 host/controller 状态、覆盖 B、触发事件/回调/UI 副作用或串联读取；B 正常结果仍更新。
- 已经发出的 transport 不会被此修复取消；若业务写在失效前已经发出，服务端仍可能完成，原有权限、
  版本和幂等继续承担最终保护，但过期续体不能再改变当前 UI 或触发后续动作。

## 红绿与验证证据

| 层级                   | 结果                                                                                                 |
| ---------------------- | ---------------------------------------------------------------------------------------------------- |
| 永久行为回归（修复前） | 最新主线未改源码时 7/7 失败：detach resolve/reject、A→B、重挂碰撞、并发乱序、group 置空、Page unload |
| 生命周期定向（修复后） | 12/12 通过：8 个行为场景 + 3 个 async/await 合同 + 1 个显式 `.then` continuation 合同                |
| 相关 host/controller   | 9 files / 61 tests 通过                                                                              |
| Mini 全量              | 112 files / 592 tests / 0 failure；73.03s                                                            |
| TypeScript             | 通过                                                                                                 |
| `miniprogram:verify`   | 通过；main 1,677,802B、total 5,120,949B、Worklet 2/2、matrix 1445/1506、manifest `ad7c65bd…1420`     |

定向 Prettier check、`git diff --check`、agent-context 状态策略 3/3 和 `smoke:check-core` 均通过；
提交后 clean 状态仍作为 checkpoint 最后门禁。详细红灯、调用链、文件和剩余风险见
`docs/audit/wechat-miniprogram-audit.md`。

## 仍有效的独立状态

- `MINI-G1-002` P2 已确认：同年五个月首次读取产生 5 次同 URL holidays GET；本轮未修复。
- `MINI-G1-003` P2 高可信候选：4 岗位×100 人合成输入 payload 56,171B；真机迟滞未验证。
- `MINI-G1-004` P3 待运行证据：平台账号/群组成员列表无明确分页上限；实际规模与原生耗时未知。
- 1445/1506 节点为有界 20×30 手排矩阵，不据节点数单独判定卡顿；主包 1.5MiB 留给包体积轮次。
- 冷构建固定 5 秒超时只属于测试基础设施线索，不能推断用户侧性能。
- `xmb` 首字母搜索已至少两次出现 9–10 秒服务端主查询长尾，也有同词亚秒结果；这是独立 API/SQL
  观察项，本轮未改客户端、查询、索引、缓存或预热。

## 唯一下一任务与停止条件

本轮完成提交并推送新分支后停止，不合并主线、不上传体验版、不部署 production，也不开始
`MINI-G1-002`～`004`。如果用户继续第 1 组，唯一建议下一轮只处理 `MINI-G1-002` 的同年 holidays
in-flight/result 去重，并重新执行独立先红后绿与完整验证。
