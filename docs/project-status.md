# Project Status

本文档只记录当前可安全接续的事实；详细历史以 Git 提交为准。每轮同时读取
`docs/agent-context/pitfall-index.json`，只加载与任务匹配的坑位详情。

## 仓库与生产基线（2026-08-28）

- 分支：`main`；运行时代码 checkpoint 为
  `57e10cdceffe05699457e4776bb823f4f7835432`。最终状态以“包含本文件的 Git HEAD”为
  Git/origin/production 对齐标识，并通过 hash-identical reuse 同步，不重启应用。
- 当前生产小程序最终体验候选：`0.1.0-p9.20260828.62@dffef1f`，178 code files，zip
  `2,333,143` bytes，upload manifest `f6cd22018b046c8f015533fca3030f81b9d87aa23cbf1d5ff3bff2534cd843b0`。
- `.59/.60/.61/.62` 已通过正式 `schedule-client-version-allowlist ensure/verify` 加入白名单；`.55-.58` 因来源
  污染、Summer 超时或上传 IP 拒绝而废弃，均未进入白名单。global/core/workflows/organization/
  insights/externalMessages/guest 七维均为 `true`，未知版本返回 426。
- `.63@57e10cd` 两次 Summer 编译通过但均被微信代码上传 IPv4 白名单拒绝，未成版、未 allowlist；
  必须在用户新增当前出口后重试同一 checkpoint。
- 当前生产数据库 schema 52；最近一次已完成发布备份为
  `1104ef32-0ad6-4b16-84e6-4341816826f1`（55 表、182,235 行、83,505,136 bytes、
  SHA-256 `330e5cc925d325f05cd9bfae4aed720d1d93182cccdad82465826dbb054942a4`）。
- 微信体验轨道未提交审核、未正式发布；自动化不得推断审核/正式发布授权。

## 用户所有的工作树内容

以下内容在本轮开始前已存在或由用户并行维护；不得删除、覆盖或整文件暂存：

- `apps/miniprogram/project.config.json`：用户 compiler/libVersion 设置。
- `apps/miniprogram/scripts/group-settings-page.test.mjs`：用户新增成员行回归；导航批次只分 hunk
  暂存自身断言，成员行回归保持未暂存。
- `apps/miniprogram/src/subpackages/organization/components/group-settings-panel/index.wxml`：用户修复成员 `wx:if`；本轮静态 include 复用但不暂存。
- 年月滚轮 WXS 探针正由并行任务维护；其 gesture/ui-wheel、坑位索引、RC 与计划文件不得整文件
  暂存。通讯录/Profile/登录已完成的 checkpoint 只作为当前发布前驱。
- 通知 Sheet 为本轮明确批次；只能显式暂存通知/API/UiSheet/工作台自身文件，
  不得夹带同一工作树的登录、通讯录、Profile 或其他用户内容。
- `.agents/`、Web UI2 Storybook 草稿、根 `src/`、`runtime/` 历史证据与工作簿。
- `runtime/external-project-worktrees/` 中未落地 P10 worktree 必须保留。

## 并行用户批次

- 登录会话连续性已实现：App singleton 跨 bundle 共享 invalidation/generation/recovery，五条有效会话
  路径 `reLaunch` 直达工作台，Web 对齐登录页保留微信快捷登录且不放访客入口。红绿定向、隔离
  Mini 93/444、root 230/1,103、全端 build/typecheck、production verify/determinism/package/CI dry-run、
  390/320 Storybook 与 core smoke 通过；代码 `62e45eb7`、契约补丁 `353ec1b9` 已推送并以备份后
  hash-identical reuse/公网 full verifier 同步生产；`.61@353ec1b` 已上传并完成正式 allowlist/full
  verifier，当前只待实体 Android 复核。
- 通知 Sheet/群组未读已实现：API 可选 `groupId`、Client Core、无业务依赖 `UiSheet`、
  嵌入通知面板、60s 当前群组轮询、红点与 390/320/大字号 Web 黄金均已完成。
  构建器已恢复重新可达的 `notifications-panel/index.js`；checkpoint `304d742f`
  已推送、完整部署，`.52` 体验上传和 allowlist/full verifier 通过，待实体 Android 复核。
- 通讯录双页常驻与 Web 视觉对齐由本并行批次负责：科室/人员原生 swiper、独立状态、双 facets
  轻量预热、折叠筛选层、结果卡分割线和有效行高已实现。代码 `6b5b30fb` 已推送、备份并以
  hash-identical reuse 部署；`.59@6b5b30f` 已从独立 immutable 快照上传，正式 allowlist、七维能力、
  未知版本 426 与带公网 IP full verifier 均通过，当前只待实体 Android 复核。
- 群组普通成员权限与日历偏好已获用户书面批准；规格与实施计划为
  `docs/superpowers/specs/2026-08-27-miniprogram-member-permission-design.md` 及对应 `plans/` 文件。
  代码 `dffef1f2` 已推送并以备份后 trusted reuse 部署；`.62@dffef1f` 已上传、allowlist/full verifier
  通过，当前只待实体 Android 复核。
- 年月滚轮 WXS 规格已获用户书面确认；阶段 A 计划为
  `docs/superpowers/plans/2026-08-28-miniprogram-workflow-picker-wxs-probe-implementation-plan.md`。
  `UiWheelColumn + gesture-probe E` 已实现并完成自动验证，生产 `workflow-picker` 保持 `.51` 语义；
  checkpoint 识别消息为 `test(miniprogram): add WXS wheel capability probe`，目标体验版为 `.63`。

## 当前活动批次

- 用户已确认 WXS 单引擎规格；`writing-plans` 不可用，已用仓库计划替代。本轮只做阶段 A。
- 引入点为 WXS 黄点 `2b5f536c`、矩阵 WXS `c35b35b8`；新 `UiWheelColumn` 只用普通 view/WXS、
  runtimeKey/generation/sequence、单段吸附和 transform/opacity，probe E 直接复用真实候选。
- 状态：`已实现、Git/origin/production 对齐 → 微信 .63 上传阻塞`；未 allowlist，待用户新增 IPv4。

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

- Profile Tasks 1–3 的共享/后端/媒体/登录红绿、全仓计数、browser 环境阻塞和发布证据保留在 debug
  日志及对应 Git checkpoint；`.53/.54` upload、allowlist 与生产 full verifier 均已通过。
- Profile Task 4：旧 controller/account/native 15 项先红；锁定 `353ec1b9` 最终定向 11 files/
  67 tests、Mini 100 files/486 tests、root 238 files/1,122 tests 通过（37 files/355 tests 按无数据库
  环境跳过）。全端 build/typecheck、production verify/determinism/source/package/performance/CI dry-run 与 core
  smoke 通过；总包 5,006,692 bytes、主包 1,579,433 bytes 仅触发 1.5M 预警且低于 1.8M 阻断线，
  manifest `45c97151fc82910951b44ecbb6aa7a0544f8b9f76b1b00a38336016ce188069e`。
- 权限批次旧实现红灯覆盖缺失客户端、成员事件/通知误禁、管理项仍渲染、创建/加入可调用及偏好失败
  隔离；实现后 Mini 103 files/499 tests、root 239 files/1,125 tests 通过（37 files/355 tests 按环境
  跳过），全端 build/typecheck、任务代码 Prettier/ESLint、production verify/CI dry-run 与 core smoke 通过。
  clean checkpoint 包 5,067,668 bytes、main 1,593,819 bytes、2/2 Worklet，manifest `8d1dbdfe…2123c`。
- 通知定向：API SQL/Client Core/Storybook 3 files/6 tests；Mini build-tools/UiSheet/通知/工作台
  7 files/33 tests 通过。Web typecheck/build/Storybook build 通过；390/320/大字号均 ready 且无水平溢出。
- 通知干净 checkpoint Mini typecheck/production verify/determinism/package/CI dry-run 通过；2/2 Worklet，
  4,527,949 bytes，insights 1,033,326 bytes，manifest `66b531c6…17158e2`，产物已包含通知组件 JS。
- 通知干净 checkpoint Mini 全量 93 files/448 tests，root 串行 232 files/1,106 tests 通过；
  37 files/353 tests 按无数据库环境跳过。全端 typecheck/build、Storybook build 和 core smoke 通过。
- 本机通知 MySQL 集成用例因 Docker daemon/127.0.0.1:3307 未运行而阻塞；已增加无数据库
  SQL condition 回归并通过，双群组真实 MySQL 用例保留给可用 DB 环境。`pnpm smoke:browser`
  因 5173 无服务在第 1/6 步拒绝连接；`pnpm smoke:check-core` 通过。
- Page/controller/handler/timer/实例隔离/薄壳/build-tools 定向：9 files / 48+ tests 通过；
  workflow host 强化 7/7，organization WXML handler 全注册 16/16。
- 年月滚轮定向：picker + P7 feedback 2 files / 22 tests 通过；旧实现的反向接管用例先红。
- `.50` UI-thread 滚轮自动回归曾 3 files / 25 tests 通过，但真机三项核心行为全部缺失，结果无效并已回滚。
- WXS 探针先红 6+3 项；clean 定向 5 files/31、Mini 105/508、root 239/1,125 通过，37/355 跳过。
- 全端 build/typecheck、verify/determinism/source/package/performance/CI/core smoke 通过；2/2 Worklet、
  5,088,998 bytes、main 1,615,149、manifest `9f7e174b…c14d`。
- 通讯录旧实现的双页持久化/异步隔离/视觉契约 3 项先红；实现后 controller 14/14、视觉 5/5、
  卡片 simulate 1/1、Mini 95 files/460 tests、Web 目录黄金 3 files/19 tests 通过；当前 dirty tree
  root Vitest 236 files/1,118 tests 通过（37 files/353 tests 按环境跳过）。
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
- rollback checkpoint `99006bad` 已推送；`.51` 官方上传 165 files/zip 1,935,669/manifest
  `30271052…b0e3`。备份 `0025dcf8-6495-428e-9c4a-6da457e2f680` 后 trusted reuse，正式
  ensure/verify `.51`、七维 capability、未知版本 426、带公网 IP full verifier 与远端 temp 清理通过。
- 通知 checkpoint `304d742f` 已推送；发布备份
  `9c9f2551-965f-4293-91f2-269271e06ba0` 后完整部署 API/Web，预热首个 502 后恢复。`.52`
  官方上传 170 code files/zip 2,017,665/manifest `c2f45e08…0110`；正式 ensure/verify、
  七维 capability、未知版本 426、带公网 IP full verifier 与远端 temp 清理通过。
- Profile Task 4 代码 `a50b423b` 及组合契约 `353ec1b9` 已推送；`.60` 官方上传 177 code
  files/zip 2,315,337/upload manifest `14c1f298…0bd9`，正式 ensure/verify、七维 capability、未知版本
  426 与带公网 IP full verifier 通过。最终状态 checkpoint 识别消息为
  `docs(status): record profile web parity deployment`，发布备份为 `ed1d8535-810c-470b-b790-8d2e207cc1bc`。
- 登录 `.61@353ec1b` 官方上传 177 code files/zip 2,315,373/upload manifest `e114414f…e2ef9`；
  正式 ensure/verify、七维 capability、未知版本 426 与带公网 IP full verifier 通过。
- 权限代码 `dffef1f2` 已推送；`.62` 官方上传 178 code files/zip 2,333,143/manifest `f6cd2201…43b0`。
  备份 `451bff17-6ded-41a6-950f-808e93046a0a` 后制品全哈希相同，trusted reuse 无停机切换；正式
  ensure/verify、七维 capability、未知版本 426、公网 full verifier 与远端 temp 清理通过。

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
- 通知只新增当前群组未读 GET 轮询和嵌入展示；无参 Web 未读语义不变。单条/全部已读仍各一次
  原写请求，Bearer、capability、Promise/catch、陈旧响应保护和通知正文不落盘不变。
- Profile Task 4 只新增当前群组成员主 GET、五项 allSettled GET、绑定 GET 与显式密码/头像写操作；
  group/request serial 隔离陈旧响应，访客/无群组零值班请求。密码 PUT 不重试且成功后清旧会话；头像
  DELETE 必须确认。Bearer、receiver、Promise/catch、可选空值、业务排班写次数和隐私边界不变。
- 通讯录本批唯一请求变化为进入时科室/人员各一次 facets 与收藏索引轻量预热；未搜索/筛选不读取
  列表，模式切换零请求。每模式异步序号、偏好 owner/group/kind key、分页、号码可拨规则、收藏
  一次存储和拨号一次副作用不变；群组变化、卸载或 organization 失效同时作废两页。
- 权限批次将 `canManageScheduleTools/allowMembers` 替换为逐工具纯矩阵；渲染、群组切换和点击均使用
  当前角色/capability，拒绝路径零导航。新增偏好读取为一次 preferences + 一次现有 config GET，保存
  各一次 PUT；Bearer、receiver、Promise/catch、严格解码与 `null` 跟随语义不变，无缓存/离线写队列。

## 下一步与停止条件

1. 用户在微信公众平台代码上传 IP 白名单加入本轮返回的 IPv4，随后重试精确 `.63@57e10cd`。
2. 上传成功后才 ensure/verify allowlist；再由用户执行 probe E 实体清单。
3. 用户明确通过前，不修改生产 `workflow-picker`，不进入阶段 B；不提审或正式发布。

停止条件：当前 Git/origin/production 已对齐，`.63` 因外部 IP 白名单阻塞且保持 426；记录阻塞并
等待用户操作，生产年月滚轮仍为 `.51` 语义，用户 dirty 文件保持未提交。
