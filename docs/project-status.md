# Project Status

本文档只记录当前可安全接续的事实；详细历史以 Git 提交为准。每轮同时读取
`docs/agent-context/pitfall-index.json`，只加载与任务匹配的坑位详情。

## 仓库与生产基线（2026-08-28）

- 分支：`main`；运行时代码 checkpoint 为
  `6cf71152006728a26dd99c1eb766dfe8febeaf14`。最终状态以“包含本文件的 Git HEAD”为
  Git/origin/production 对齐标识，并通过 hash-identical reuse 同步，不重启应用。
- 当前生产小程序最终体验候选：`0.1.0-p9.20260828.52@304d742`，170 code files，zip
  `2,017,665` bytes，upload manifest `c2f45e08c2316648e60c61a20ee09967e27569602b2f709b4d9caee64dd10110`。
- `.52` 已通过正式 `schedule-client-version-allowlist ensure/verify` 加入白名单。global/core/
  workflows/organization/insights/
  externalMessages/guest 七维均为 `true`，未知版本返回 426。
- 当前生产数据库 schema 52；最近一次已完成发布备份为
  `cb88870f-e685-4609-bcef-5f39bcc7ec8b`（55 表、180,371 行、82,888,368 bytes、
  SHA-256 `ab960b5b90219f0627d7b50eb60b648e274b34210a5497d21b9bd1710412a3b6`）。
- 微信体验轨道未提交审核、未正式发布；自动化不得推断审核/正式发布授权。

## 用户所有的工作树内容

以下内容在本轮开始前已存在或由用户并行维护；不得删除、覆盖或整文件暂存：

- `apps/miniprogram/project.config.json`：用户 compiler/libVersion 设置。
- `apps/miniprogram/scripts/group-settings-page.test.mjs`：用户新增成员行回归；导航批次只分 hunk
  暂存自身断言，成员行回归保持未暂存。
- `apps/miniprogram/src/subpackages/organization/components/group-settings-panel/index.wxml`：用户修复成员 `wx:if`；本轮静态 include 复用但不暂存。
- 登录会话连续性、通讯录/群组权限的 runtime、测试和视觉稿正由并行任务维护；
  涉及 identity/session/directory 的脏文件均不得整文件暂存。
- 通知 Sheet 为本轮明确批次；只能显式暂存通知/API/UiSheet/工作台自身文件，
  不得夹带同一工作树的登录、通讯录、Profile 或其他用户内容。
- `.agents/`、Web UI2 Storybook 草稿、根 `src/`、`runtime/` 历史证据与工作簿。
- `runtime/external-project-worktrees/` 中未落地 P10 worktree 必须保留。

## 并行用户批次

- 登录会话连续性设计 checkpoint `3eae93c2` 已推送并部署；用户已批准实施，当前 App singleton、
  直达工作台和 Web 登录视觉仍为并行未提交内容，本批等待其 checkpoint 后才做头像登录集成。
- 通知 Sheet/群组未读已实现：API 可选 `groupId`、Client Core、无业务依赖 `UiSheet`、
  嵌入通知面板、60s 当前群组轮询、红点与 390/320/大字号 Web 黄金均已完成。
  构建器已恢复重新可达的 `notifications-panel/index.js`；checkpoint `304d742f`
  已推送、完整部署，`.52` 体验上传和 allowlist/full verifier 通过，待实体 Android 复核。
- 通讯录切换和群组普通成员权限仍是并行用户工作；本批不接管其 directory 源码或测试。
- 群组普通成员权限与日历偏好已获用户书面批准；规格与实施计划为
  `docs/superpowers/specs/2026-08-27-miniprogram-member-permission-design.md` 及对应 `plans/` 文件。
  当前只落文档 checkpoint，随后以独立测试文件先冻结权限矩阵，不接管登录或通讯录测试 hunk。
- `.51@99006ba` 已完成 `.50` 前向回滚、自动验证、体验上传、生产同步和 allowlist；实体 Android
  “恢复 `.49` 表现”的确认可独立进行，不阻塞非滚轮代码设计。

## 当前活动批次

- 用户已批准把小程序“我的”页按 Web Production 1:1 重建，并增加真实的小程序身份状态与账号级
  微信头像；不显示真实微信号，头像只在微信快捷登录时可选刷新。
- 书面规格与计划为 `docs/superpowers/specs/2026-08-27-miniprogram-my-profile-web-parity-design.md`
  和对应 `plans/` 文件；文档 checkpoint `bb52e47b` 已推送并部署。
- 引入点：Web 个人值班聚合来自 `ebd1b19f`，Mini 常驻 Profile controller/workbench 入口来自
  `79a0ae90`，微信快捷登录来自 `e69cfb76`，密码登录禁解绑来自 `75ec2c1d`。
- Task 1 `9e42057c` 已共享 Web 值班模型与 avatarVersion 兼容契约；Task 2 `3c1b131a` 和控制修复
  `6cf71152` 已部署头像/绑定 API 与 schema 52，生产应用/DB/控制面一致；最近备份见本页基线。
- Task 3 非重叠部分已测试先行实现独立 Mini profile-media：进程内 pending、认证原始图片上传/
  下载、owner/version 私有文件缓存、401 单次恢复、串行最后选择、幂等删除与退出物理清理均完成；
  checkpoint 识别消息为 `feat(miniprogram): cache private profile avatars`。
- 当前 Profile 活跃批次为 Task 3 checkpoint/发布；不接管并行登录/通讯录脏文件，精确 clean
  checkpoint 验证、体验上传和生产同步完成即停，再复核重叠集成边界。

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

- Profile Task 3 media：旧实现因模块不存在 7 项先红；补充 401 恢复 generation 与退出清 pending 后
  2 项再次先红。最终 profile-media 8/8、会话/下载定向 3 files/21 tests、Mini typecheck、任务
  Prettier/ESLint/diff 通过；当前 dirty tree Mini 96 files/469 tests 通过。
- Profile Tasks 1–2 的共享等价、严格契约、头像安全/隔离/版本、schema52 发布控制和生产探针均通过；
  详细红绿、全仓计数、browser 环境阻塞、备份与 release 证据保留在 debug 日志及对应 Git checkpoint。
- Profile browser smoke 已实际运行：首次因 5173 未启动停止；启动源码服务后因未启用 dev auth、
  Docker daemon/本机 MySQL 均不存在而在登录门禁停止，未进入产品断言；临时服务已停止并在
  debug round 精确记录。本 Task 不改 Web 视觉或请求行为。
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
- clean rollback Mini 全量：92 files / 439 tests 通过；picker 定向 2 files / 22 tests 通过。
- clean rollback root Vitest：230 files / 1,103 tests 通过；37 files / 352 tests 按环境跳过。
- rollback Mini typecheck/production verify/determinism/package/CI dry-run 通过；2/2 Worklet，4,343,790 bytes，
  manifest `6a8971435a7947e40cb8207f6cc8bbb0833b31e0eff10c116439d31748906b85`。
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
- Profile Task 3 media 的 pending 只存 App 进程内；每次 flush 同步取走并按全局 tail 串行，失败不重试，
  新选择不会被旧上传清除。上传使用一次 raw ArrayBuffer PUT；下载只用 Bearer header，401 至多恢复一次
  并以新 generation 为准。缓存键/文件同时绑定 owner/version，退出只删除本地文件/元数据，不调用
  DELETE；恢复首字仅显式 DELETE 成功后清本地。图片、token、临时路径均不进入日志、遥测或 storage。

## 下一步与停止条件

1. 显式暂存并提交 Task 3 非重叠 media checkpoint，clean 复验后推送、上传下一单调 `.53` 体验版，
   执行正式 allowlist、生产备份/ECS 同步与 full verifier。
2. checkpoint 发布完成后复核并行登录/通讯录状态；只有其内容已落地或能以独立 cached hunk 构建时，
   才进入 chooseAvatar 叶组件、登录 flush 与最终 Mini Profile runtime。
3. 群组权限 runtime 仍保持独立，不夹带其计划或工作树内容。

停止条件：Task 3 非重叠 profile-media/cache 完成测试、checkpoint、推送和生产同步，其他并行用户
工作树内容保持未提交；随后等待重叠登录/通讯录 checkpoint，未经新的安全边界复核不修改其文件，
不提交审核或正式发布。
