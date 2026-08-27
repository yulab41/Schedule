# Project Status

本文档只记录当前可安全接续的事实；详细历史以 Git 提交为准。每轮同时读取
`docs/agent-context/pitfall-index.json`，只加载与任务匹配的坑位详情。

## 仓库与生产基线（2026-08-27）

- 分支：`main`；运行时代码 checkpoint 为
  `f6be9cdb762ab2321f4f2bddcb0f1e7dd17ba73b`。最终状态以“包含本文件的 Git HEAD”为
  Git/origin/production 对齐标识，并通过 hash-identical reuse 同步，不重启应用。
- 当前生产小程序最终体验候选：`0.1.0-p9.20260827.48@f6be9cd`，164 code files，zip
  `2,109,019` bytes，upload manifest `4d92065bd9565a1838a4f46295bb4d271ba4cb972e6fddf2c57376b77511ca42`。
- `.48` 已通过正式 `schedule-client-version-allowlist ensure/verify` 加入白名单。global/core/
  workflows/organization/insights/
  externalMessages/guest 七维均为 `true`，未知版本返回 426。
- 当前生产数据库 schema 51；最近一次已完成发布备份为
  `29266719-280d-4a8b-b617-2654a367d36e`（54 表、179,421 行、82,573,904 bytes、
  SHA-256 `869954743ddca6479431fb0968bd33100d9f0d53c7f4dcf33fd9d0a9c2f13e6d`）。
- 微信体验轨道未提交审核、未正式发布；自动化不得推断审核/正式发布授权。

## 用户所有的工作树内容

以下内容在本轮开始前已存在或由用户并行维护；不得删除、覆盖或整文件暂存：

- `apps/miniprogram/project.config.json`：用户 compiler/libVersion 设置。
- `apps/miniprogram/scripts/group-settings-page.test.mjs`：用户新增成员行回归；当前批次不暂存。
- `apps/miniprogram/src/subpackages/organization/components/group-settings-panel/index.wxml`：用户修复成员 `wx:if`；本轮静态 include 复用但不暂存。
- `.agents/`、Web UI2 Storybook 草稿、根 `src/`、`runtime/` 历史证据与工作簿。
- `runtime/external-project-worktrees/` 中未落地 P10 worktree 必须保留。

## 当前活动批次

- 用户在 `.47` 实体 Android 反馈年月滚轮同向停止后立即反向拖动会卡住，并要求使用
  systematic debugging 及微信、Android、Apple 官方文档排查。
- 根因已定位为 320ms 受控吸附没有被新触摸中断，且陈旧 `scrollend` 可在新触摸期间重启吸附；
  引入链为 `80ddadf0` → `c1b9536a` → `0975b2d1`。
- 旧实现回归已先红；当前单一修复清理同滚轮 animation timer/owner，并在触摸期间拒绝重启吸附。
  不改 WXML/WXSS、日期日历、年月值、完成/取消事件或业务请求。
- 状态：`已完成（自动验证、体验上传与生产发布）→ 待实体 Android 复核`。代码 checkpoint
  `f6be9cdb` 已推送；最终状态 checkpoint 识别消息为
  `docs(status): record wheel snap deployment`。

## 已完成的发布基线与当前修复

### 年月滚轮反向接管

- 新触摸命中同一滚轮正在执行的吸附时，先清 320ms timer 和 animation owner，再关闭动画；
  后续反向 `scroll` 可立即更新草稿。
- `snapWheel` 在该滚轮仍处于触摸期间直接返回，防止取消旧动画产生的陈旧 `scrollend` 重启吸附。
- 平台结论：日期继续使用日历；年月保留已确认的双滚轮，但让原生滚动/用户触摸优先于程序动画。

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
- 年月滚轮反向接管登记为 `mini-workflow-wheel-snap-interruption`，实体复核前状态为
  `fixed-pending-external`。
- guard 失败或 staleWhen 命中时，旧结论降级为假设并重新 systemically debug。
- 禁止全文读取 `docs/debug/debug-feedback-log.md`；历史只用精确 `rg` + 有界行段。
- 本状态受 `scripts/agent-context-policy.test.mjs` 限制为 ≤40KB/250 行；索引 ≤12KB。

## 已完成验证

- Page/controller/handler/timer/实例隔离/薄壳/build-tools 定向：9 files / 48+ tests 通过；
  workflow host 强化 7/7，organization WXML handler 全注册 16/16。
- 年月滚轮定向：picker + P7 feedback 2 files / 22 tests 通过；旧实现的反向接管用例先红。
- Mini 全量：91 files / 434 tests 通过。
- root Vitest：233 files / 1,113 tests 通过；37 files / 352 tests 按无数据库环境跳过。
- Mini typecheck/production verify/determinism/package/CI dry-run 通过；2/2 Worklet，4,689,130 bytes，manifest
  `20c89aa38e29f529b5812a5943b4b4e4ab1fdfa64fc2ae35578f7bb5495fa7ea`。
- 任务文件 Prettier/ESLint、root build/typecheck 与 `pnpm smoke:check-core` 通过；未触及 Web 核心链路，
  无需 Web browser smoke。
- 完整 `pnpm verify` 被 411 个既有文件的全仓 format 阻断；独立 root lint 被未修改
  `apps/miniprogram/src/platform/wx-request-executor.ts:141` 的既有 `prefer-const` 阻断。
  任务文件不在失败集内，未接管或格式化无关用户内容。
- allowlist/release/cache 控制面：4 files / 32 tests 通过；新增 Bash 均通过 Git Bash `bash -n`。
- 主 checkpoint `50c696ab` 已推送；Mini `.46` 官方上传、完整生产部署、正式 allowlist
  ensure/verify、重复幂等 ensure、两次 full verifier 与远端临时目录清理均通过。
- 状态 checkpoint `f7557992` 的本地打包继续 2.9 秒三层 hit。生产只上传 manifest 后，
  `schedule-ecs-reuse-release` 前后 API container ID
  `5b8ed6e6…45cd74`/created `2026-08-27T10:37:11.855693624Z` 与 Web ID
  `ba7b789a…672362`/created `2026-08-27T10:37:22.371720913Z` 完全不变；工具内双 verifier
  与随后带公网 IP full verifier 均通过。
- 完整 boundary checkpoint `f71540d8` 与 release-worktree 修复 `7de1bee1` 均已推送；forced
  detached checkout 在三重 clean 后成功且 dependencies reused，ECS 再次三层 hit。
  `.47` 上传、manifest-only reuse、正式 allowlist ensure/幂等 ensure/verify 与公网 full verifier
  全部通过；生产 release 在最终状态同步前为 `7de1bee1378fe5ac415f95a0865c9b8683049bc0`。
- 滚轮代码 checkpoint `f6be9cdb` 已推送；`.48` 官方上传成功。clean release worktree 复用三层
  cache，备份 `29266719-280d-4a8b-b617-2654a367d36e` 后可信 hash-identical reuse 通过；切换前后
  API/Web container ID 与 created timestamp 不变。随后正式 ensure/verify `.48`、七维 capability、
  未知版本 426 和带公网 IP full verifier 全部通过，远端临时目录已删除。

## 语义与偏差记录

- 八页迁移不改 API、Bearer、权限、capability、幂等、版本、Promise/catch、空值或业务写入。
- directory 新增 page disableScroll；页面原本只使用内部 scroll-view，防止外层原生滚动。
- group/workflow 正常 query 从壳层+controller 双 decode 恢复 controller 单 decode；缺失 query
  恢复 controller 原有 stored-group fallback。此为架构修复的明确行为恢复，不伪装成纯重构。
- platform page 保留旧壳未使用的 groupId data/setData，避免迁移混入死状态清理。
- 工作流 host 曾被初版简单直连遗漏 picker/timer，红灯后已撤回并改为 fresh-controller adapter。
- 根测试首次仅排除 runtime 后仍以错误 cwd 执行 Mini；现由 root exclusion + 显式 Mini 入口修复。
- 年月滚轮修复只改变竞争窗口的 UI timer 生命周期；receiver、Promise/catch、空值、年月格式、
  完成一次 emit、取消零次 emit、API/权限/幂等和业务写次数不变。

## 下一步与停止条件

1. 用户在 `.48` 实体 Android 分别对年份/月滚轮执行“同向滑动停止后立即反向”至少 10 次；
   必须持续跟手、最终单行吸附，完成只提交当前值一次。此前状态保持待用户复核。

停止条件：基础设施发布门槛已满足，所有用户工作树内容未进入提交；现在停止实施并等待 `.48`
实体反向滚动复核，不提交审核/正式发布。
