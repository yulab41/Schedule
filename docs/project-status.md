# Project Status

本文档只记录当前可安全接续的事实；详细历史以 Git 提交为准。每轮同时读取 `docs/agent-context/pitfall-index.json`，只加载与任务匹配的坑位详情。

## 仓库与生产基线（2026-09-01）

- 纠偏分支：`codex/preupload-diagnostics-correction`，独立 worktree 基线为最新 `origin/main`
  `a23266182122c6e2fcb5ca5aba5d8857ef781910`；阶段 B 保持在前驱中。
- `.72@5fff288` 与 `.73@c7c142e` 均为历史已上传版本；纠偏源码
  `24a847ffdeec5899ab7c9d505c740b715df3ef6e` 的首次直接 SDK 调用虽返回成功，但平台仍显示 `.74`，
  不作为有效上传结论；2026-09-01 20:27:38 +08:00 已用仓库标准
  `pnpm miniprogram:upload-experience` 重传 `.75@24a847f`。本项目开发版即体验版，无额外网页设置；
  未提审或正式发布，平台最新版本显示仍待用户刷新确认。
- `.59/.60/.61/.62/.63/.64/.65/.66/.68/.69/.70/.71/.72/.73/.75` 已通过正式 `schedule-client-version-allowlist ensure/verify` 加入白名单；`.55-.58` 因来源
  污染、Summer 超时或上传 IP 拒绝而废弃，均未进入白名单。global/core/workflows/organization/
  insights/externalMessages/guest 七维均为 `true`，未知版本返回 426。`.75` 于 2026-09-01 20:10:36
  +08:00 经可信 add-only 工具追加；API/Web 条件重建，预热首个 TLS EOF 后恢复，live release 保持
  `a23266182122c6e2fcb5ca5aba5d8857ef781910`，未重建 MySQL、未创建数据库备份或同步 release。
- `.68` 从 exact clean `fe12db53` 经已登记直连 IPv4 上传成功，184 files/2,351,718 bytes，upload
  manifest `764b93dc…dd9d`；未使用微信开发者工具。
- `.69` 从 exact clean `c2a57441` 经用户新登记 IPv4 `154.64.226.11` 上传成功，185 files/
  2,373,410 bytes，upload manifest `0b8c9155…aa38c5`；allowlist 重建预热的一次 reset/一次 502
  在受控等待内恢复，随后 trusted verify 与公网 full verifier 通过。
- `.70` 从 exact clean `18498a8b` 经已登记 IPv4 上传成功，188 files/2,444,502 bytes，upload manifest `8c4dae56…7287b`；allowlist 重建预热的一次 TLS EOF/一次 502 在受控等待内恢复。
- `.71` 从 exact clean `7952f1d1` 经已登记 IPv4 `154.64.226.11` 上传成功，189 files/2,449,336 bytes，
  upload manifest `b2090d71…df55`；allowlist 重建预热的一次 TLS EOF/一次 502 在 2/30 内恢复。
- `.72@5fff288` 首次被微信 `20003 invalid ip: 38.190.176.204` 拒绝；用户登记 IP 后同版本重试成功，190 files/2,504,558 bytes，manifest `9868c0c7…1a106c`。
- 当前 production 应用 checkpoint `bb97145dee8f8ee7a1ec4a57d532c60eb8f63625`、数据库 schema 52；
  最终 release 元数据将以 `docs(status): record directory phase b deployment` 识别。备份
  `758c1a3b-d444-4bd1-879a-e675ae6276e5`（55 表/197,477 行/88,492,384 bytes）后完整重建 API/Web，
  首次健康探测 502 后恢复，privacy 0/0、公网 full verifier 与远端临时目录清理通过。
- 微信体验轨道未提交审核、未正式发布；自动化不得推断审核/正式发布授权。

## 用户所有的工作树内容

以下内容在本轮开始前已存在或由用户并行维护；不得删除、覆盖或整文件暂存：

- `apps/miniprogram/project.config.json`：用户 compiler/libVersion 设置。
- `apps/miniprogram/scripts/group-settings-page.test.mjs`：用户新增成员行回归；导航批次只分 hunk
  暂存自身断言，成员行回归保持未暂存。
- `apps/miniprogram/src/subpackages/organization/components/group-settings-panel/index.wxml`：用户修复成员 `wx:if`；本轮静态 include 复用但不暂存。
- `build-tools.mjs`、`build-info.ts`、`build-env.d.ts` 与 `runtime-environment.ts` 原登记为并行环境标识；用户已明确授权测试工具仅接入构建元数据和 develop/trial/release 门禁，其他环境切换不扩展。
- 年月滚轮、通讯录与 Profile 已由用户合并进当前修复批次；只允许显式暂存本批精确 hunk，登录及
  其他既有 checkpoint 仍只作为发布前驱。
- 通知 Sheet 已完成并只作为发布前驱；当前工作台修改不得夹带其历史外的无关 hunk。
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
- `712aa4ee` 的 Skyline 布局修复仍有效，但初始树同时挂载 directory/profile 已由 `.63/.64/.65`
  同环境 A/B 证实阻断 workbench；当前改为 Page 首帧后自动串行预载。
- 群组普通成员权限与日历偏好已获用户书面批准；规格与实施计划为
  `docs/superpowers/specs/2026-08-27-miniprogram-member-permission-design.md` 及对应 `plans/` 文件。
  代码 `dffef1f2` 已推送并以备份后 trusted reuse 部署；`.62@dffef1f` 已上传、allowlist/full verifier
  通过，当前只待实体 Android 复核。
- `.63` 的 `UiWheelColumn + gesture-probe E` 已完成自动验证；用户通过直达 QR 明确确认目标 Android
  的吸附、逐像素字号/透明度和慢速反向均符合预期。生产 `workflow-picker` 当前仍为 `.51` 语义，
  阶段 B 已获批准并纳入当前修复。

## 当前活动批次

- 唯一任务为“体验版上传前纠偏审计”，checkpoint 以
  `a9021c4e fix(miniprogram): correct preupload diagnostics boundaries` 识别，已推送并快进
  `origin/main`；不改 API contract、数据库、索引、
  production 缓存或搜索业务。
- App 只保留会话内定长数据槽和一次性启动标记；旧 `runtime-directory-diagnostics-bridge.ts` 与
  `search-diagnostics.ts` 已删除。报告/复制/展示只在 diagnostics 分包；organization 以同分包共享
  controller/轻量 bridge 供 component 与独立 Page 复用。
- develop/trial 支持“下次 App 启动首次搜索诊断”：持久化值只有 schema/armedAt/expiresAt，新的
  `App.onLaunch` 立即消费；release 清除且不启用。记录不持久化，跨测试工具/通讯录仍使用同一 App 槽。
- 记录上限 20 条、单条 4096 B、复制 24576 B、Header 值 4096 字符、request ID 64 个白名单字符；
  原始 response/header/profile/搜索参数不进入仓库，序列化耗时和估算标志单列。
- capability 等待、失败、无权限零请求、卸载/群组变化失效、Promise 复用/释放、旧响应隔离均有直接
  回归；transport 仍是最终 capability/上下文门禁，未恢复 controller 的搜索前重复等待。
- 相同 Node 24.14.0/pnpm 11.9.0、lockfile、production profile 和命令下，基线→clean checkpoint：
  总包 5,280,739→5,115,045 B，main 1,680,271→1,678,747 B（`app.js` −7,977 B），organization
  1,231,973→1,053,980 B。
- 完整 Mini 同一命令连续两次均为 111 files/578 tests/0 skipped。此前 561/560 差异的唯一测试是
  用户脏主树未提交的 `renders member rows without combining wx:else and wx:for on one element`，不属于本批。
- 用户当次批准的唯一 `.75` 产物已从上述 exact clean SHA 上传：191 code files、官方上传 ZIP
  2,445,701 B；本地包审计 5,114,602 B，上传 manifest
  `be28692545891baf083dda498b4c45587e144d7e6601b4dd62f9d80f5dcf129f` 与批准的 dry-run 完全一致。
  本次使用根标准脚本而非直接 SDK 编排；`.75` production allowlist 已另行授权并通过公网验证。
- 上传状态文档 checkpoint 以 `docs(audit): record .75 diagnostics upload` 识别；该后续文档提交不得
  写作体验版源码 SHA，也不触发 ECS/production/数据库操作。
- allowlist 状态文档 checkpoint 以 `docs(audit): record .75 allowlist activation` 识别；它同样不是
  上传源码 SHA，且不得因文档提交再次操作 production。
- 标准 CLI 重传状态文档 checkpoint 以 `docs(audit): correct .75 standard CLI upload` 识别；体验版
  源码仍为 `24a847ff…`，不得写成后续文档 SHA。
- 用户已回传匹配 `.75@24a847f` 的小米 14 启动诊断：5/5 request ID 与 production API 日志匹配、
  HTTP 200。页面会话首次搜索总计 10,016ms，其中服务端 9,942ms、rows/main query 9,696ms；后续
  4 次中位 471/404.5/209.5ms。客户端响应后中位 17.5ms、首次 21ms，网络外差值约 40ms。
- 该批只有 1 条独立 App 启动首次样本，全部 5 条均无完成/进行中请求复用；当前结论是“已定位一次
  服务端主查询长尾，复现率未确定”，不是普遍性能结论，也不授权直接修改查询、索引或数据库。
- 首批真机证据文档 checkpoint 以 `docs(audit): record .75 first-search evidence` 识别；该文档提交
  不触发上传、allowlist、production 或数据库操作。
- 第二批匹配 `.75@24a847f` 的 5/5 request ID 同样为 production HTTP 200；新独立 App 启动首搜
  685ms、服务端 617ms、主查询 412ms，首批 10,016/9,942/9,696ms 长尾未复现。第二批另一条页面
  会话首搜 725/667/438ms，但与首条共用 App 启动时间基线和内存报告，不计为独立启动样本。
- 两批独立启动首搜当前为 10,016ms 与 685ms，只能确认一次服务端主查询长尾，不能确认稳定退化；
  第二批被替代请求仍在服务端 291.2ms/200 完成，页面正确拒绝旧结果。
- 第二批真机证据文档 checkpoint 以 `docs(audit): record .75 first-search repeat` 识别；该文档提交
  不触发上传、allowlist、production 或数据库操作。
- 第三次独立 App 首搜记录数仅 1，request ID 匹配 production HTTP 200/705.3ms；total/TTFB/server/
  main=799/741/705/505ms。三次独立样本为 10,016/685/799ms，中位 799/741/705/505ms；10 秒长尾
  连续两次未复现。已排除稳定的客户端首次搜索退化；已确认一次服务端主查询约 9.7 秒长尾，但测试
  集中在十几分钟内、未覆盖服务端或数据库长时间冷态，根因与发生率未知，当前转观察且不标记解决。
- 正常首搜约 0.7–0.8 秒，本轮不再优化；精确计数查询约 180–200ms。若未来要压缩正常延迟，先单独
  确认页面是否需要精确总数，不能与 10 秒长尾混为一谈。
- 超过 total 2,000ms 或 main query 1,500ms 时，以 request ID 调查查询计划、锁等待、I/O、系统负载、
  备份或导入任务；当前不改客户端、SQL、索引、缓存、API 或预热策略。
- 非阻塞待办：`instanceAgeMs` 达 600000ms 上限时，报告应显示 `≥600000ms` 或“已封顶”，不得作为
  精确值；不为此单独发版。
- 性能最终口径 checkpoint 以 `docs(audit): clarify .75 long-tail observation` 识别；它只更新文档，
  不触发代码、上传、allowlist、production 或数据库操作。
- 文档 Prettier、`git diff --check` 与 agent-context policy 3/3 通过；`project-status.md` 已从既存
  290 行历史流水账精简到规则上限内，旧细节仍由 Git 与定向 debug 日志保存。
- 第三批收口文档 checkpoint 以 `docs(audit): close .75 first-search sampling` 识别；该文档提交不触发
  上传、allowlist、production 或数据库操作。
- 用户已在 `.75@24a847f` 的小米 14 上确认半屏筛选的高度、下滑关闭/短拖回弹、内部列表滚动不误关、
  固定清除入口四项全部通过；该真机结论仅适用于当前 Android 设备与构建，不外推到其他平台。
- 半屏真机收口 checkpoint 以 `docs(audit): close .75 Xiaomi half-sheet acceptance` 识别；它只更新文档，
  不触发上传、allowlist、production、数据库备份或服务器 release。

## 已完成的测试工具批次

- “更多 → 测试工具”已由 `18498a8b` 实现，production 与 `.70@18498a8` 已同步并放行；release
  失败关闭、只读有界诊断和隐私边界保持有效，当前只待实体 Android/DevTools 人工复核。

## 已完成的发布基线与当前修复

### 年月滚轮反向接管

- 新触摸命中同一滚轮正在执行的吸附时，先清 320ms timer 和 animation owner，再关闭动画；
  后续反向 `scroll` 可立即更新草稿。
- `snapWheel` 在该滚轮仍处于触摸期间直接返回，防止取消旧动画产生的陈旧 `scrollend` 重启吸附。
- 平台结论：日期继续使用日历；年月保留已确认的双滚轮，但让原生滚动/用户触摸优先于程序动画。

### Mini Page 架构

- 已把 directory、group-settings、scheduling-config、invite-visitor、platform-accounts、
  duty、leave、swap 八个薄壳改为直接 Page 注册并静态 include/import 原 WXML/WXSS。
- 工作台使用同一 header、五个常驻无外层滑动内容槽和同一 bottom nav；directory/profile/swap 由
  ready 队列串行挂载并常驻，通讯录内部 `directory-mode-swiper` 保留。
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
- 年月滚轮反向接管登记为 `mini-workflow-wheel-snap-interruption`；阶段 A 真机门槛已通过，状态
  回到 `active`，直到阶段 B 生产接入和业务页实体复核完成。
- guard 失败或 staleWhen 命中时，旧结论降级为假设并重新 systemically debug。
- 禁止全文读取 `docs/debug/debug-feedback-log.md`；历史只用精确 `rg` + 有界行段。
- 本状态受 `scripts/agent-context-policy.test.mjs` 限制为 ≤40KB/250 行；索引 ≤12KB。

## 已完成验证

- 当前纠偏批次的测试、包体、上传、allowlist、三批真机诊断与半屏验收事实保留在上方活动批次及
  `docs/audit/STATUS.md`；逐命令与旧批次验证由 Git checkpoint 和定向 debug 日志保存。
- `.46–.52`、`.60–.62` 的上传、allowlist、备份、部署与 verifier 历史已由各自 Git checkpoint
  和 debug 日志保存；当前操作边界以上方最新 `.75` 事实为准。

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

1. `.75@24a847f` 已由标准 CLI 重传、正式 allowlist 放行并由小米 14 报告确认；不再次上传或改版本。
2. 性能长尾未解决、转观察；仅在 total >2,000ms 或 main query >1,500ms 时复制最近一次记录，并按
   request ID 调查查询计划、锁等待、I/O、系统负载及备份或导入任务。
3. 小米 14 半屏筛选四项已全部通过；当前纠偏审计批次完成，没有自动实施任务。

停止条件：等待性能阈值再次超限的脱敏记录或用户明确开启新批次；不自行进入阶段 B 优化，不改客户端、
SQL、索引、缓存、API 或预热，不再次上传、修改 allowlist、部署、创建生产备份或同步服务器 release。
`instanceAgeMs` 封顶显示只随未来合适版本修正，不单独发版；微信原生 Console/Network 输出仍未采集。
