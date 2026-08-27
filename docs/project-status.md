# Project Status

本文档只记录当前可安全接续的事实；详细历史以 Git 提交为准。每轮同时读取
`docs/agent-context/pitfall-index.json`，只加载与任务匹配的坑位详情。

## 仓库与生产基线（2026-08-27）

- 分支：`main`；运行时代码 checkpoint 为
  `50c696ab7d271d62d01984d90acbf3c408b22e6f`。最终状态以“包含本文件的 Git HEAD”为
  Git/origin/production 对齐标识，并通过 hash-identical reuse 同步，不重启应用。
- 当前生产小程序已验证基线：`0.1.0-p9.20260827.46`，164 code files，zip
  `2,088,212` bytes，upload manifest `6cbbb9075a82f577d71b8cb77ae56a14147bd68b38b5de82cfe12afe3e19e59e`。
- `.46` 已通过正式 `schedule-client-version-allowlist ensure` 加入白名单；重复 ensure
  验证了幂等且没有重建容器。global/core/workflows/organization/insights/
  externalMessages/guest 七维均为 `true`，未知版本返回 426。
- 当前生产数据库 schema 51；最近一次已完成发布备份为
  `c6e7abd2-d74e-49a1-a6ee-6d64e12dd7d0`（54 表、178,978 行、82,416,400 bytes、
  SHA-256 `0a7890a8a5719560a7c6a15abbcadd0ae192a9228a52b222526c30fa49d594aa`）。
- 微信体验轨道未提交审核、未正式发布；自动化不得推断审核/正式发布授权。

## 用户所有的工作树内容

以下内容在本轮开始前已存在或由用户并行维护；不得删除、覆盖或整文件暂存：

- `apps/miniprogram/project.config.json`：用户 compiler/libVersion 设置。
- `apps/miniprogram/scripts/group-settings-page.test.mjs`：用户新增成员行回归；本轮只窄改旧薄壳断言，提交时必须分 hunk。
- `apps/miniprogram/src/subpackages/organization/components/group-settings-panel/index.wxml`：用户修复成员 `wx:if`；本轮静态 include 复用但不暂存。
- `.agents/`、Web UI2 Storybook 草稿、根 `src/`、`runtime/` 历史证据与工作簿。
- `runtime/external-project-worktrees/` 中未落地 P10 worktree 必须保留。

## 当前用户授权范围

用户明确要求连续完成全部 P0/P1，不设每轮任务数量上限，并允许循环使用多个 sub-agent：

1. 消除全部大型 panel 薄 Page 注入边界并迁移 8 页。
2. 固化 Mini/root 测试发现、日期、PowerShell fail-fast 与 LF。
3. 建立正式版本白名单控制。
4. 建立 build/dist/API-flat 哈希缓存与 hash-identical 无停机 release。
5. 建立按需坑位索引、压缩状态和隐私安全 boundary telemetry。

仍须按独立可验证 checkpoint、显式暂存、Git push、Mini 体验上传、生产备份、部署和
verifier 执行；不得把多任务授权解释为放宽安全门禁。

## 本轮已完成并发布的代码

### Mini Page 架构

- 已把 directory、group-settings、scheduling-config、invite-visitor、platform-accounts、
  duty、leave、swap 八个薄壳改为直接 Page 注册并静态 include/import 原 WXML/WXSS。
- group-settings 与三套 workflow component 仍被工作台嵌入，必须保留 component `index.js`；
  只回收不可达 controller 输出。其余四套 organization wrapper/controller 均回收。
- workflow direct Page 通过共享 host adapter 保留 picker 协调、infoMessage 2 秒 timer、
  setData callback、onShow/onHide/onUnload 和每实例独立 Map/数组；不能简化为 `Page(factory())`。
- 通用 `thin-page-boundary.test.mjs` 禁止重新引入“Page 全模板只有一个业务 panel”。
- 补齐全部迁移页的闭合 Page/controller runtime marker 后，下一候选 production verify 总包
  `4,688,851` bytes：main `1,130,399`，scheduling `412,996`，organization `1,128,976`，
  workflows `1,152,712`，insights `863,768`。

### 测试与跨平台工具链

- Mini 唯一入口为 `pnpm miniprogram:test`，包内使用 `vitest run --dir scripts`。
- root Vitest 排除 `runtime/**`、根 `src/**`、`.artifacts/**` 和 Mini scripts；根 verify
  显式先跑 Mini，再跑其余测试。
- duty/swap controller 测试冻结 2026-08-25T04:00:00Z 并逐项恢复真实时间。
- `.gitattributes` 强制 tracked text LF；不在用户脏树执行全仓 renormalize。
- PowerShell 多原生命令强制同时设置 `$ErrorActionPreference='Stop'` 与
  `$PSNativeCommandUseErrorActionPreference=$true`。
- pnpm 四个非必要 build scripts 已明确 `false`，`verifyDepsBeforeRun=false` 已部署；显式
  frozen install 与 release dependency fingerprint 保留。

### 生产控制与增量发布

- 新增 `schedule-client-version-allowlist ensure VERSION...|verify`：只增不删、release→
  capability 双锁、root:root/0600 原子写、API+Web 条件重建、无序 JSON 精确探针、动态
  unknown=426、错误/信号回滚。
- 新增 `runtime/release-cache/v1` 三层不可变缓存：ECS build、dist archive、API-flat。
  key 使用排序后的文件哈希、命令、Node/pnpm/platform/env，不使用 commit/mtime。
- 缓存命中仍要求 clean exact commit、shell LF/syntax、payload SHA 和 build tree hash；输出
  使用 copy，缓存损坏为 miss。数据库、env、凭据、会话和上传 key 永不缓存。
- 新增可信 `schedule-ecs-reuse-release`：仅当新旧 application/control/schema/archive 哈希
  全同且 rollbackCandidate=当前 release 时，无停机切换 manifest/current-release；否则拒绝
  并要求完整部署。生产备份与完整 verifier 仍强制。
- clean release worktree 首次真实打包三层 miss；第二次 2.8 秒完成并显示 build
  `hit (existing)`、dist hit、api-flat hit。cache keys 分别为
  `af117a98…e4ca3`、`6b3fb887…63460`、`cc01f17f…ab5c5`；第二次没有编译、清理 build
  输出或执行 pnpm deploy。

### 按需 Agent 上下文

- `docs/agent-context/pitfall-index.json` 为每轮必读小索引；按 signals/paths 只读匹配详情。
- guard 失败或 staleWhen 命中时，旧结论降级为假设并重新 systemically debug。
- 禁止全文读取 `docs/debug/debug-feedback-log.md`；历史只用精确 `rg` + 有界行段。
- 本状态受 `scripts/agent-context-policy.test.mjs` 限制为 ≤40KB/250 行；索引 ≤12KB。

## 已完成验证

- Page/controller/handler/timer/实例隔离/薄壳/build-tools 定向：9 files / 48+ tests 通过；
  workflow host 强化 7/7，organization WXML handler 全注册 16/16。
- Mini 全量：91 files / 433 tests 通过。
- root Vitest：233 files / 1,113 tests 通过；37 files / 352 tests 按无数据库环境跳过。
- Mini typecheck/production verify/source/package/determinism/CI dry-run 通过；2/2 Worklet。
- root build/typecheck 通过。
- allowlist/release/cache 控制面：4 files / 32 tests 通过；新增 Bash 均通过 Git Bash `bash -n`。
- 主 checkpoint `50c696ab` 已推送；Mini `.46` 官方上传、完整生产部署、正式 allowlist
  ensure/verify、重复幂等 ensure、两次 full verifier 与远端临时目录清理均通过。
- 状态 checkpoint `f7557992` 的本地打包继续 2.9 秒三层 hit。生产只上传 manifest 后，
  `schedule-ecs-reuse-release` 前后 API container ID
  `5b8ed6e6…45cd74`/created `2026-08-27T10:37:11.855693624Z` 与 Web ID
  `ba7b789a…672362`/created `2026-08-27T10:37:22.371720913Z` 完全不变；工具内双 verifier
  与随后带公网 IP full verifier 均通过。

## 语义与偏差记录

- 八页迁移不改 API、Bearer、权限、capability、幂等、版本、Promise/catch、空值或业务写入。
- directory 新增 page disableScroll；页面原本只使用内部 scroll-view，防止外层原生滚动。
- group/workflow 正常 query 从壳层+controller 双 decode 恢复 controller 单 decode；缺失 query
  恢复 controller 原有 stored-group fallback。此为架构修复的明确行为恢复，不伪装成纯重构。
- platform page 保留旧壳未使用的 groupId data/setData，避免迁移混入死状态清理。
- 工作流 host 曾被初版简单直连遗漏 picker/timer，红灯后已撤回并改为 fresh-controller adapter。
- 根测试首次仅排除 runtime 后仍以错误 cwd 执行 Mini；现由 root exclusion + 显式 Mini 入口修复。

## 下一步与停止条件

1. 提交并推送 `feat(miniprogram): trace all migrated page boundaries`；ECS 应三层 cache hit
   并以 manifest-only reuse 同步该 Mini-only HEAD。
2. 上传最终体验候选 `.47`，用正式 allowlist ensure/verify 后再跑 full verifier。
3. 用户在 `.47` 实体 Android 复核通知双页及八个预防性迁移页面；此前状态为
   `已实现并自动验证 → 待用户复核`，不提交审核/正式发布。

停止条件：`.47` checkpoint/cache/reuse/allowlist/full verifier 通过，Git/origin/production release
再次一致；所有用户工作树内容未进入提交。随后只等待 `.47`
实体复核。

补充阻断：持久 release worktree 的 blob hash/content diff 均干净，但 Git checkout 被旧 CRLF→LF
stat noise 阻断。最终工具 checkpoint 将在 content/cached/untracked 三重 clean 后使用 forced
detached tracked checkout；ignored node_modules/cache 保留，普通用户 worktree 禁止复用该 force。
