# Project Status

本文档只记录当前可安全接续的事实；详细历史以 Git 提交为准。每轮同时读取
`docs/agent-context/pitfall-index.json`，只加载与任务匹配的坑位详情。

## 仓库与生产基线（2026-08-27）

- 分支：`main`；运行时代码 checkpoint 为
  `5bed6d34196fb0443506cfa637ff239110f7dbed`。最终状态以“包含本文件的 Git HEAD”为
  Git/origin/production 对齐标识，并通过 hash-identical reuse 同步，不重启应用。
- 当前生产小程序最终体验候选：`0.1.0-p9.20260827.50@5bed6d3`，165 code files，zip
  `1,937,770` bytes，upload manifest `aa2867ca73067ef2dfcf3189a6dfe5e66c821d885b31249fcaeabfeb60380d73`。
- `.50` 已通过正式 `schedule-client-version-allowlist ensure/verify` 加入白名单。global/core/
  workflows/organization/insights/
  externalMessages/guest 七维均为 `true`，未知版本返回 426。
- 当前生产数据库 schema 51；最近一次已完成发布备份为
  `ea1e3ea9-8c03-49e3-a405-0315fc64a34f`（54 表、179,793 行、82,696,816 bytes、
  SHA-256 `43ee98b92681a92d8183598be6880788e302c6c4ade7d5f8efacb2fbc575af81`）。
- 微信体验轨道未提交审核、未正式发布；自动化不得推断审核/正式发布授权。

## 用户所有的工作树内容

以下内容在本轮开始前已存在或由用户并行维护；不得删除、覆盖或整文件暂存：

- `apps/miniprogram/project.config.json`：用户 compiler/libVersion 设置。
- `apps/miniprogram/scripts/group-settings-page.test.mjs`：用户新增成员行回归；导航批次只分 hunk
  暂存自身断言，成员行回归保持未暂存。
- `apps/miniprogram/src/subpackages/organization/components/group-settings-panel/index.wxml`：用户修复成员 `wx:if`；本轮静态 include 复用但不暂存。
- `.agents/`、Web UI2 Storybook 草稿、根 `src/`、`runtime/` 历史证据与工作簿。
- `runtime/external-project-worktrees/` 中未落地 P10 worktree 必须保留。

## 登录会话与入口设计（排队批次）

- 用户确认复现：在“我的”执行切换/退出后不重启小程序，再以 D0468 登录，“我的”仍显示
  “尚未登录”；冷启动使用 `admin` 不复现。
- 生产只读证据排除账号/API 失败：D0468 与 `admin` 的账号、profile、有效成员关系均正常；两轮
  password login 与随后 `/groups` 均为 HTTP 200。未读取密码、token、联系方式或排班正文。
- 根因为每入口 `bundle: true` 复制 `wechat-identity.ts` 模块状态：profile bundle 清会话后保留
  `sessionInvalidated=true`，identity bundle 的新登录只能复位自己的副本。当前可见引入点为
  `79a0ae90 feat(miniprogram): align workbench navigation with web`。
- 用户已确认 App 级共享会话运行时、成功后 `wx.reLaunch` 直达主页及 Web 对齐登录页；登录页不放
  “访客查看排班”，扫码访客仅进入独立日历页且本批不改。书面规格为
  `docs/superpowers/specs/2026-08-27-miniprogram-login-session-continuity-design.md`。
- 登录设计 checkpoint 只提交书面规格与本节的一致性修正，识别消息为
  `docs(design): specify miniprogram login continuity`；验证为任务文档 Prettier、占位符/歧义自检、
  `git diff --check` 与 agent-context policy。下一步是用户书面复核，通过前不修改 runtime。
- Worklet runtime 已由并行 checkpoint `5bed6d34` 提交；当前通知 runtime、测试与视觉稿仍是并行用户
  工作树内容。登录批次不得暂存、重写或混入；停止条件是 Git/origin/production release 对齐并
  保持全部并行内容未提交。

## 当前活动批次

- `.50@5bed6d3` 已包含 UI-thread 滚轮和 `.49` 导航；用户目标为慢速逐格反向持续跟手、吸附
  无明显跳帧。
- UI-thread Worklet 已实现：原生 scroll-view 独占位置；6/6 Worklet、每实例 SharedValue、46 个
  stable animated-style updater 保留逐像素字号/缩放/透明度；逻辑层只按行/最终停止同步。
- JS 二次吸附、320ms timer、共享 animation owner 和逐帧 `setData` 已删除；generation/sequence
  拒绝关闭重开及乱序旧事件，scroll anchoring 显式关闭。
- 状态：`已完成（自动验证、体验上传与生产发布）→ 待实体 Android 复核`。runtime checkpoint
  `5bed6d34` 已推送；最终状态 checkpoint 识别消息为
  `docs(status): record worklet wheel deployment`。

## 已完成的发布基线与当前修复

### 年月滚轮反向接管

- 新触摸命中同一滚轮正在执行的吸附时，先清 320ms timer 和 animation owner，再关闭动画；
  后续反向 `scroll` 可立即更新草稿。
- `snapWheel` 在该滚轮仍处于触摸期间直接返回，防止取消旧动画产生的陈旧 `scrollend` 重启吸附。
- 平台结论：日期继续使用日历；年月保留已确认的双滚轮，但让原生滚动/用户触摸优先于程序动画。

### Mini Page 架构

- 已把 directory、group-settings、scheduling-config、invite-visitor、platform-accounts、
  duty、leave、swap 八个薄壳改为直接 Page 注册并静态 include/import 原 WXML/WXSS。
- 工作台现只嵌入 directory、profile 与 swap：directory/profile 首次进入后常驻 hidden；
  group-settings、leave、duty 改用独立 Page，相关不可达 component `index.js` 被回收。
- profile Page 与 workbench component 共用 controller/WXML/WXSS，Page 仍为静态 include/import；
  directory Page 明确 `embedded=false`，工作台 component 为 `embedded=true`。
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
- UI-thread 滚轮定向：3 files / 25 tests 通过；旧架构新增回归 3 项先红。
- Mini 全量：93 files / 443 tests 通过；导航定向 12 files / 77 tests 通过。
- root Vitest：233 files / 1,113 tests 通过；37 files / 352 tests 按无数据库环境跳过。
- Mini typecheck/production verify/determinism/package/CI dry-run 通过；6/6 Worklet，4,345,198 bytes，
  manifest `8c6b62e9a10cb4d0d58aa83e949f0af8237f2e11eaa7f5466cadf0b51f3c5be8`。
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
- 导航代码 checkpoint `79a0ae90` 已推送；clean release worktree 三层 cache hit。备份
  `b7794f7f-4b4a-42c9-a7c8-cf4b01b9a92c` 后可信 hash-identical reuse 无停机切换，随后
  `.49` 官方上传并正式 ensure/verify；allowlist 重建容器首次 TLS EOF 后自动恢复。七维能力、
  未知版本 426、带公网 IP full verifier 与远端临时目录清理均通过。最终状态发布备份为
  `29442285-9d6e-446c-8b1c-5c4d20f46192`。
- UI-thread 滚轮 checkpoint `5bed6d34` 已推送；`.50` 官方 Summer 上传 165 files/zip 1,937,770/
  manifest `aa2867ca…0d73`。备份 `ea1e3ea9-8c03-49e3-a405-0315fc64a34f` 后可信 reuse
  无停机同步且容器不变；正式 ensure/verify `.50`、七维 capability、未知版本 426、带公网 IP
  full verifier 与远端 temp 清理通过。

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
- UI-thread 重构删除全部 wheel timer/逐帧 setData；打开/点行仍一次 programmatic top，原生拖动不受
  逻辑 gating。字体视觉公式端点与连续值等价；row-boundary/final commit 以 generation/sequence
  保持 receiver、顺序与每行最多一次副作用，完成/取消、API 和业务写次数不变。
- 导航重组不改 API、Bearer、capability、角色权限、空值或业务写入。通讯录查询/分页/偏好、
  Profile 会话清理、工作流操作 receiver 与副作用次数不变；群组切到访客时若正在目录/换班，
  安全回到日历。独立 Page 依赖微信 Page 栈，自带返回按钮并保留系统侧滑返回。

## 下一步与停止条件

1. 提交最终状态 checkpoint 并以已完成备份再次同步 production release。
2. 用户在 `.50` 实体 Android 执行 20 次慢速逐格下→上、半格反向、吸附中反向与年/月交替；
   此前状态只能是待用户复核。

停止条件：`.50` 上传、Git/origin/production release、allowlist/full verifier 全部对齐，所有用户
工作树内容保持未提交；随后等待实体滚轮复核，不提交审核或正式发布。
