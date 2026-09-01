# Project Status

本文档只记录当前可安全接续的事实；详细历史以 Git 提交、`docs/audit/wechat-miniprogram-audit.md` 和
精确 debug 日志为准。每轮先读 `docs/agent-context/pitfall-index.json`，只加载与任务匹配的坑位详情。

## 仓库与任务基线（2026-09-01）

- 当前任务：只验证并修复 `MINI-G1-001`——workflow `controller-host.ts` 的异步生命周期失效边界。
- 起始/提交前复核主线：`origin/main@eb36d70fa28cf8705b0795a516ea3d4420399efc`，消息
  `docs(audit): investigate reproducible xmb query tail`。
- 独立分支/worktree：`codex/fix-mini-g1-001-lifecycle` /
  `runtime/external-project-worktrees/mini-g1-001-lifecycle-20260901`。
- 计划 checkpoint：`fix(miniprogram): invalidate stale workflow controllers`；提交 SHA 在提交后由 Git
  历史提供。
- 远端审计分支 `codex/audit-static-state-async-list-20260901` 的 docs-only 提交 `4ddaa38e` 不是
  当前主线祖先；本分支只内容合并其三份文档证据，没有带入旧分支源码。
- fresh worktree 已按依赖策略执行 frozen install（1,459 包本地复用、0 下载）和 7 个 packages 预构建；
  没有借用主工作区 ignored dist。

## 工作树与并行边界

- 用户主工作区在任务开始时有既有修改且落后于远端；这些内容全部视为用户所有，本轮未读取后写回、
  未暂存、未清理、未覆盖。
- 其他 `runtime/external-project-worktrees/`、release worktree、旧审计分支和并行任务均未修改或删除。
- 本轮不调用微信开发者工具 GUI/CLI，不上传体验版、不提审/发布、不改 production allowlist、不部署、
  不创建生产备份。
- 既有 production、体验版与小米 14 证据只按各自历史 SHA 保留；本轮 checkpoint 不外推为新的真机
  或 production 验收。

## 文档继承与长期事实

- `d23a78a9` 是历史 test-tools 验收侧枝，不是当前主线祖先；主线 `a2cdd065` 已等价恢复该批 Flex、
  换行和截图类不变量。非祖先关系本身不是停止条件，只有相关路径变化或语义不变量失效才重查。
- 已关闭的 test-tools Skyline Warning、真机验收和 automator
  `getPageMetaByWebviewId(...)=null` 本轮没有重新展开。
- `apps/miniprogram/AGENTS.md` 中历史 plans 相对路径已失效；实际计划在
  `apps/miniprogram/docs/plans/2026-08-17-wechat-miniprogram-migration-plan.md`，不阻断任务。
- 既有 `xmb` 首字母搜索 9–10 秒服务端主查询长尾是独立 API/SQL 观察项；本轮不修改客户端搜索、
  SQL、索引、缓存、预热或绑定状态链路。

## 当前实现：MINI-G1-001

- 状态：P1，`已确认并修复（逻辑层）`；微信原生可见故障尚未直接确认。
- 引入点：组件 host/controller 为 `bc32a4f1`，直达 Page host 为 `50c696ab`，持久 workspace 的
  A→B controller 替换路径为 `4fe1b5e7`。
- 根因：factory 重建把 controller 私有 serial 从 0 重新复制到同一 host；detach/unload 仅丢 controller，
  没有 host-owned、不可碰撞的生命周期/上下文身份。A→B 时仍 mounted，单一 mounted 布尔值不足。
- 生产调用者共 6 个：leave/swap/duty 三个组件通过 `registerWorkflowPanel`，三个同名直达 Page 通过
  `createWorkflowPageDefinition`；三个 controller 没有自身 unload/dispose，由共享 host 统一处理。
- `controller-host.ts` 为每次 attachment/controller 安装分配对象 token；Component detach、Page
  unload、group 置空、A→B 替换统一 dispose。延迟 `workspaceready` callback 与 info timer 也验证身份。
- leave/swap/duty 的 32 个 async 函数、83 个 await 全部捕获同一 task guard，并在 await 后、catch、
  finally、确认框和串联刷新边界验证。过期 resolve/reject 零 `setData`、零当前状态改写、零事件/回调/
  toast/导航/UI 副作用；B 的当前结果仍可更新。
- 修复不会取消已经发出的 transport；一个业务写若在失效前已送达服务端仍可能完成，原权限、版本和
  幂等继续负责服务端最终保护，旧续体不能再改变当前 UI 或继续发起串联动作。
- `MINI-G1-002`～`004`、API、缓存策略、数据模型、路由和页面交互均未修改。

## 先红后绿与验证

- 永久测试：`apps/miniprogram/scripts/workflow-controller-lifecycle.test.mjs`。
- 修复前：在最新主线未改源码时 7/7 行为测试失败，覆盖 detach 后 resolve/reject、A→B 旧请求晚返、
  detach→attach 编号碰撞、并发乱序、group 置空及 Page unload。
- 修复后：生命周期 12/12 通过（8 个行为场景 + 3 个 controller async/await 合同 + 1 个显式 `.then`
  continuation 合同）；后者在最终 diff 审阅中先得到 1/12 红灯，再修复三个同根微任务窗口。
- 相关 host/controller：9 files / 61 tests 通过。
- Mini 全量：112 files / 592 tests / 0 failure，73.03s。
- TypeScript：通过。
- `pnpm miniprogram:verify`：通过；production build，main 1,677,802B、total 5,120,949B、Worklet 2/2、
  matrix 1445/1506、manifest `ad7c65bd…1420`。这些是 Node/静态证据，不替代原生运行时。
- 定向 Prettier check、`git diff --check`、agent-context 状态策略 3/3 和 `smoke:check-core` 均通过；
  core smoke 确认没有触及需浏览器冒烟的 Web 核心路径。若最终 fetch 发现主线变化，先 rebase，再按
  同口径重跑。

## 语义等价与行为变化

- 明确行为变化：旧 attachment/controller 的异步续体从“可能继续更新/触发副作用”改为“永久失效”；
  A→B、group 置空、detach、Page unload 均进入统一 dispose；延迟 callback/timer 同样失效。
- 保持不变：controller 方法 receiver 仍是实际 host；同步表单 handler、空值、错误文案、权限、Bearer、
  capability、API 参数、请求次数、写入幂等键、成功路径事件和导航语义不变。
- 已发出的 API 请求不做 Abort；修复只隔离失效后的本地续体和后续链路，不伪装成 transport 取消。
- `MINI-G1-002`～`004` 的证据和状态见审计报告，本轮不处理。

## 唯一下一任务与停止条件

当前批次的停止条件是：完成全部最终验证、审阅精确 diff、显式暂存本批文件、创建并推送
`fix(miniprogram): invalidate stale workflow controllers`，确认分支工作树 clean 后停止。不合并主线，
不上传体验版、不部署 production，不开始其他问题。

如果用户继续第 1 组，唯一建议下一轮只处理 `MINI-G1-002` 的同年 holidays in-flight/result 去重，
必须另建批次并重新先红后绿；不与 scheduling payload、列表分页或包体积审计混做。
