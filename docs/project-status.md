# Project Status

本文档只记录当前可安全接续的事实；详细历史以 Git 提交为准。每轮同时读取
`docs/agent-context/pitfall-index.json`，只加载与任务匹配的坑位详情。

## 仓库与生产基线（2026-08-27）

- 分支：`main`；本轮开始时 Git/origin/production release 均为
  `314b21dbfb57299ae9baaab8895d82678bfd50c5`。
- 当前生产小程序体验候选：`0.1.0-p9.20260827.45`，177 code files，zip
  `2,361,119` bytes，upload manifest `79ad5571d5d9c03d1030db84ac44ac4b02f32c19250d9268b835b8f479216189`。
- `.45` 已加入生产版本白名单；global/core/workflows/organization/insights/
  externalMessages/guest 七维均为 `true`，未知版本返回 426。
- 当前生产数据库 schema 51；最近一次已完成发布备份为
  `cd179adc-a650-4f41-836d-2b1329e0c844`（54 表、178,669 行、82,314,752 bytes、
  SHA-256 `a19705a11462a91bab8adce8a6b811f5403195e0cd2dfd00788bc13ad2aed7ef`）。
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

## 本轮已实现待最终验证的代码

### Mini Page 架构

- 已把 directory、group-settings、scheduling-config、invite-visitor、platform-accounts、
  duty、leave、swap 八个薄壳改为直接 Page 注册并静态 include/import 原 WXML/WXSS。
- group-settings 与三套 workflow component 仍被工作台嵌入，必须保留 component `index.js`；
  只回收不可达 controller 输出。其余四套 organization wrapper/controller 均回收。
- workflow direct Page 通过共享 host adapter 保留 picker 协调、infoMessage 2 秒 timer、
  setData callback、onShow/onHide/onUnload 和每实例独立 Map/数组；不能简化为 `Page(factory())`。
- 通用 `thin-page-boundary.test.mjs` 禁止重新引入“Page 全模板只有一个业务 panel”。
- production verify 当前总包 `4,669,357` bytes：main `1,128,543`，scheduling
  `412,996`，organization `1,120,658`，workflows `1,145,712`，insights `861,448`。

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

### 按需 Agent 上下文

- `docs/agent-context/pitfall-index.json` 为每轮必读小索引；按 signals/paths 只读匹配详情。
- guard 失败或 staleWhen 命中时，旧结论降级为假设并重新 systemically debug。
- 禁止全文读取 `docs/debug/debug-feedback-log.md`；历史只用精确 `rg` + 有界行段。
- 本状态受 `scripts/agent-context-policy.test.mjs` 限制为 ≤40KB/250 行；索引 ≤12KB。

## 已完成验证

- Page/controller/handler/timer/实例隔离/薄壳/build-tools 定向：9 files / 48+ tests 通过；
  workflow host 强化 7/7，organization WXML handler 全注册 16/16。
- Mini 全量：91 files / 432 tests 通过。
- root Vitest：233 files / 1,113 tests 通过；37 files / 352 tests 按无数据库环境跳过。
- Mini typecheck/production verify/source/package/determinism/CI dry-run 通过；2/2 Worklet。
- root build/typecheck 通过。
- allowlist/release/cache 控制面：4 files / 32 tests 通过；新增 Bash 均通过 Git Bash `bash -n`。
- 仍需在最终源码上复跑格式、ESLint、root/Mini 全量、package cache miss→hit、
  `smoke:check-core` 与 `git diff --check`。

## 语义与偏差记录

- 八页迁移不改 API、Bearer、权限、capability、幂等、版本、Promise/catch、空值或业务写入。
- directory 新增 page disableScroll；页面原本只使用内部 scroll-view，防止外层原生滚动。
- group/workflow 正常 query 从壳层+controller 双 decode 恢复 controller 单 decode；缺失 query
  恢复 controller 原有 stored-group fallback。此为架构修复的明确行为恢复，不伪装成纯重构。
- platform page 保留旧壳未使用的 groupId data/setData，避免迁移混入死状态清理。
- 工作流 host 曾被初版简单直连遗漏 picker/timer，红灯后已撤回并改为 fresh-controller adapter。
- 根测试首次仅排除 runtime 后仍以错误 cwd 执行 Mini；现由 root exclusion + 显式 Mini 入口修复。

## 下一步与停止条件

1. 收紧 `recordMiniTelemetryBoundary` 为闭合 marker registry、运行时拒绝和每会话一次；补隐私回归。
2. 完成 agent-context 索引/status 大小测试、allowlist/cache/updater/verifier 全量回归与格式检查。
3. 创建并推送 checkpoint `fix(platform): harden mini and release boundaries`（暂定识别消息）。
4. 从干净 release worktree验证 cache miss→hit；production-profile 上传下一体验版本 `.46`。
5. 生产数据库备份；第一次完整部署新控制面并运行 full verifier。
6. 使用正式 `schedule-client-version-allowlist ensure 0.1.0-p9.20260827.46`，再次 full verify。
7. 创建状态 docs checkpoint；若 artifact hashes 全同，使用 `schedule-ecs-reuse-release` 实际演练
   无停机同步并再跑 verifier。
8. 用户在 `.46` 实体 Android 复核通知双页及八个预防性迁移页面；此前状态为
   `已实现并自动验证 → 待用户复核`，不提交审核/正式发布。

停止条件：Git/origin/production release 一致；Mini `.46` 已上传和加入白名单；缓存两次打包显示
第二次 build/dist/api-flat 全 hit；正式 allowlist、full deploy、hash-identical reuse 和自动回滚门禁均
通过；所有用户工作树内容未进入提交。
