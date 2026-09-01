# 微信小程序审计状态

- 当前阶段：`MINI-G1-001` 主线整合与最终收口已完成；逻辑层 P1 已确认并修复，exact clean checkpoint
  已按完整清单复验，最终以非强制推送和远端可追溯核对闭环
- 整合起始主线：`origin/main@eb36d70fa28cf8705b0795a516ea3d4420399efc`
- 原修复：`origin/codex/fix-mini-g1-001-lifecycle@2a856725e927fcd82cd382b9f63e2681c8dee75d`
- integration 分支/worktree：`codex/integrate-mini-g1-001-main-20260902` /
  `runtime/external-project-worktrees/mini-g1-001-main-integration-20260902`
- 计划 checkpoint：`fix(miniprogram): integrate workflow lifecycle invalidation`；提交信息保留
  `2a856725` 来源映射
- 范围：只整合共享 workflow host、leave/swap/duty 三个 controller、永久合同和四份审计连续性文档；
  `MINI-G1-002`～`004`、API、数据库、缓存、页面交互和其他 worktree 均未修改
- 外部状态：未调用微信开发者工具 GUI/CLI，未上传体验版、未提审/发布、未改 allowlist，未部署
  production 或创建生产备份

## 精确变更与文档继承

- `2a856725` 共 9 个文件：4 个业务源码、1 个永久测试、4 个文档。此前汇总漏列的第 9 个文件是
  `docs/debug/debug-feedback-log.md`，它按根规则保存引入点、红绿证据、语义边界和验证结果，属于本修复
  必需的连续性文档，不是生成物或偶然修改。
- `+1236/-439` 中四份文档占 878 行 churn，主要来自审计内容继承和状态压缩；永久测试新增 391 行；
  业务源码为统一 token/task guard。没有锁文件、构建产物、无关源码或其他 worktree 内容。
- `4ddaa38e` 不是主线祖先，其审计内容已由 `2a856725` 语义继承；本轮没有再次 cherry-pick。
- G1、`MINI-G1-001`、`MINI-G1-002` 和 test-tools 章节各只有一份；主线 XMB 详细调查原样保留。
  新增文档只使用仓库相对路径，没有 integration worktree 的本机绝对路径。
- `d23a78a9` 仍是历史验收侧枝；主线 `a2cdd065` 已等价恢复 test-tools 不变量。非祖先关系本身不是
  停止条件，本轮没有重开已关闭的 Skyline Warning、真机验收或 automator null。

## MINI-G1-001 最终语义

- 每次 attachment/controller 安装获得不可碰撞的对象 token；Component detach、Page unload、group
  置空和 A→B 替换统一 dispose，旧 token 永久失效。
- leave/swap/duty 的三个组件和三个直达 Page 共 6 个生产调用者受同一契约保护。32 个 async 函数、
  83 个 await、3 个显式 `.then`、info timer 和延迟 `workspaceready` callback 均验证捕获身份。
- 过期 resolve/reject 不得 `setData`、修改当前 host/controller、覆盖 B、触发事件/回调/toast/导航/
  UI 副作用或串联请求；当前 B 的正常结果仍能更新。
- 新增整合合同证明 dispose 可重复调用：同一代 controller 只 unload 一次，重新 attach 后同步 handler
  从干净状态正常执行。
- 已发出的 transport 不 Abort；若业务写在失效前已送达服务端仍可能完成，既有权限、版本和幂等继续
  提供最终保护，但旧续体不能再影响当前 UI 或继续后续链路。
- 微信原生可见故障未直接确认；永久自动化已覆盖逻辑竞态，因此不再以小米 14 复现作为修复门禁。

## 最终 clean checkpoint 验证

| 层级                          | 结果                                                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------------------------------ |
| 生命周期永久合同              | 13/13 通过；含 detach/unload、A→B、重挂碰撞、乱序、reject、callback/timer、显式 `.then` 与重复 dispose |
| 相关 host/controller          | 9 files / 62 tests 通过                                                                                |
| 标准 Mini 全量                | `pnpm miniprogram:test` 自动发现生命周期文件；112 files / 593 tests / 0 failure                        |
| TypeScript / production build | 通过；276 files                                                                                        |
| clean `miniprogram:verify`    | 通过；main 1,677,803B、total 5,120,950B、workflows 839,488B、Worklet 2/2、matrix 1445/1506             |
| 收口门禁                      | 任务文件 Prettier、`git diff --check`、状态策略 3/3、`smoke:check-core` 全部通过                       |

未整合 `eb36d70f` 基线为 main 1,677,803B、total 5,113,474B，warning 同样只有既有 1.5MiB 与
1445/1506 三项。clean 总包 +7,476B，主包无变化；唯一进入构建的源码变化位于 workflows 生命周期
守卫，因此没有把既有 warning 重新归类为本轮回归，也没有发现新 error/warning。

## 独立状态与停止条件

- `MINI-G1-002` P2 仍只是下一候选：同年五个月产生 5 次 holidays GET；尚未开始、尚未修复。
- `MINI-G1-003` P2 高可信候选、`MINI-G1-004` P3 待运行证据均保持原状态。
- XMB 9–10 秒服务端查询长尾、主包体积和矩阵节点仍是独立问题，不在本轮处理。

本轮最终 checkpoint 以 `fix(miniprogram): integrate workflow lifecycle invalidation` 识别，提交正文保留
`2a856725` 来源；非强制推送 `origin/main` 并确认远端可追溯和 clean 后停止。不上传体验版、不部署
production，也不开始 `MINI-G1-002`。
