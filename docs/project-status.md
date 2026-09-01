# Project Status

本文档只记录当前可安全接续的事实；详细历史以 Git、`docs/audit/wechat-miniprogram-audit.md` 和精确
debug 日志为准。每轮先读 `docs/agent-context/pitfall-index.json`，只加载匹配坑位详情。

## 当前仓库批次（2026-09-02）

- 唯一任务：把 `MINI-G1-001` workflow 异步生命周期修复整合并最终收口到执行时最新主线；不开始
  `MINI-G1-002`。
- 起始主线：`origin/main@eb36d70fa28cf8705b0795a516ea3d4420399efc`；来源修复：
  `2a856725e927fcd82cd382b9f63e2681c8dee75d`。
- integration 分支/worktree：`codex/integrate-mini-g1-001-main-20260902` /
  `runtime/external-project-worktrees/mini-g1-001-main-integration-20260902`。
- 最终 checkpoint：`fix(miniprogram): integrate workflow lifecycle invalidation`，提交信息记录
  `2a856725 -> 最终主线` 的来源映射。
- fresh worktree 已执行 frozen install：1,459 包全部本地复用、0 下载、7m40.1s；packages 7 项预构建
  通过，锁文件未变，没有借用主工作区 ignored dist。
- 用户脏主工作区、旧审计/修复/release worktree、其他分支和并行任务均未修改、清理或覆盖。

## 精确整合范围

- 业务源码：
  `apps/miniprogram/src/subpackages/workflows/components/controller-host.ts` 与 leave/swap/duty 三个
  controller。
- 永久测试：`apps/miniprogram/scripts/workflow-controller-lifecycle.test.mjs`。
- 四份连续性文档：`docs/audit/wechat-miniprogram-audit.md`、`docs/audit/STATUS.md`、本文件和
  `docs/debug/debug-feedback-log.md`。第 9 个文件即 debug 日志，按根规则保存引入点和红绿证据，保留。
- `2a856725` 的 1,675 行 churn 中四份文档占 878 行，永久测试 391 行；其余是统一 guard 源码。
  没有 `MINI-G1-002`～`004` 修复、API/SQL/缓存/路由/页面交互变化、锁文件或构建产物。
- `4ddaa38e` 的审计内容已由 `2a856725` 内容继承，本轮没有重复 cherry-pick。主线 XMB 详细调查
  未覆盖或回退，审计章节无重复，新增长期文档没有本机绝对路径。

## MINI-G1-001 最终语义

- 状态：P1，逻辑层已确认并修复；微信原生可见故障未直接确认，但不再需要真机复现作为修复门禁。
- 引入点：组件 host/controller 为 `bc32a4f1`，直达 Page host 为 `50c696ab`，持久 workspace 的
  A→B 替换路径为 `4fe1b5e7`。
- 根因：factory 重建把私有 serial 从 0 复制到同一 host；旧 detach/unload 没有不可碰撞的 host-owned
  生命周期/上下文身份，A 与 B 可以同时得到 serial=1。A→B 时仍 mounted，单一 mounted 布尔值不足。
- 统一契约：每次 attachment/controller 安装分配对象 token；detach、Page unload、group 置空、A→B
  统一 dispose。六个生产调用者、32 async/83 await、3 `.then`、timer 和延迟 callback 均验证身份。
- 过期 resolve/reject 零 `setData`、零当前状态改写、零事件/回调/toast/导航/UI 副作用、零后续串联；
  B 的当前结果仍更新。重复 dispose 对每代只 unload 一次，重新 attach 的同步 handler 正常。
- 已发出的 transport 不 Abort；服务端可能完成失效前已发出的业务写，原权限、版本和幂等继续承担
  最终保护，旧续体不能再影响当前 UI。

## 最终 clean checkpoint 验证

- 生命周期永久合同 13/13；相关 workflow 9 files/62 tests。
- 标准 `pnpm miniprogram:test` 自动发现生命周期文件，112 files/593 tests，全绿。
- Mini TypeScript 通过；production build 276 files。
- 未整合基线 verify：main 1,677,803B、total 5,113,474B。
- exact clean verify：main 1,677,803B、total 5,120,950B、workflows 839,488B、Worklet 2/2、
  matrix 1445/1506。总包 +7,476B 来自 workflows guard；主包与基线相同。
- 基线与 clean checkpoint warning 都只有既有主包 1.5MiB 和矩阵 1445/1506 三项，没有新 error/warning。
- 任务文件 Prettier、`git diff --check`、状态策略 3/3 和 `smoke:check-core` 均通过；exact clean
  checkpoint 已按用户清单完整复验。最终 push 前若主线推进则自行重基线并重跑受影响门禁。

## 长期事实与外部边界

- `d23a78a9` 是历史 test-tools 验收侧枝；主线 `a2cdd065` 已等价恢复其不变量。非祖先关系不是
  blocker，已关闭 Skyline Warning、真机验收和 automator null 不重开。
- `apps/miniprogram/AGENTS.md` 的历史 plans 相对路径失效；实际计划在
  `apps/miniprogram/docs/plans/2026-08-17-wechat-miniprogram-migration-plan.md`，不阻断任务。
- XMB 首字母搜索 9–10 秒服务端主查询长尾是独立 API/SQL 观察项；本轮未改搜索、SQL、索引、缓存或预热。
- 本轮不调用微信开发者工具 GUI/CLI，不上传体验版、不提审/发布、不改 allowlist、不部署 production、
  不创建生产备份。既有真机/体验版/production 结论只属于各自历史 SHA。

## 唯一下一任务与停止条件

当前停止条件：再次 fetch；若主线未漂移，则把已完整复验且可追溯到 `2a856725` 的 checkpoint 非强制
推送到 `origin/main`，核对远端 SHA、永久测试存在、无未推送提交且工作树 clean 后停止。

后续唯一候选是另开批次处理 `MINI-G1-002` 同年 holidays in-flight/result 去重；本轮不执行。
