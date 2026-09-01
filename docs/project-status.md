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
- `.59/.60/.61/.62/.63/.64/.65/.66/.68/.69/.70/.71/.72/.73/.75/.76` 已通过正式 `schedule-client-version-allowlist ensure/verify` 加入白名单；`.55-.58` 因来源
  污染、Summer 超时或上传 IP 拒绝而废弃，均未进入白名单。global/core/workflows/organization/
  insights/externalMessages/guest 七维均为 `true`，未知版本返回 426。`.75` 于 2026-09-01 20:10:36
  +08:00 经可信 add-only 工具追加；API/Web 条件重建，预热首个 TLS EOF 后恢复，live release 保持
  `a23266182122c6e2fcb5ca5aba5d8857ef781910`，未重建 MySQL、未创建数据库备份或同步 release。
- `.76` 因上传后未同步 allowlist 导致体验版被 HTTP 426 拒绝；2026-09-01 21:42 +08:00 经用户当次
  授权用同一可信 add-only 工具追加。API/Web 重建预热的 TLS EOF/502 在 1/30、2/30 后恢复；`.76/.75`
  公网 200、七维全 true，未知版本 426、health 200，live release 不变；未备份、上传或同步 release。
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

- 唯一任务为 test-tools Skyline Warning 语义核验与最终收口；起始 `origin/main` 为 `89cafa28`，
  源码 checkpoint `a2cdd065 fix(miniprogram): restore test tools Skyline compatibility`。
- 历史 `d23a78a9` 与 `a9021c4e` 的 merge-base 均为 `a2326618`；`a9021c4e` 是主线祖先，
  `d23a78a9` 是 `.74` 真机验收侧枝。主线 test-tools 继承旧 Grid/换行实现，本轮在保留全部通讯录
  诊断功能的前提下最小向前修复，不 cherry-pick/覆盖旧文件，不回退 `a9021c4e`。
- 当前实现：四处 `word-break:break-all`、两组可换行 Flex、等宽报告按钮、自适应链接、固定 54px
  正常/异常按钮、320px 纵向/换行与明确 `.scenario-screenshot`；`disableScroll:false`、事件 handler、
  页面纵向滚动和通讯录新增诊断语义不变。
- 当前源码定向先红 15/16 后绿 17/17；Mini 111 files/580 tests、TypeScript、276-file production
  build、verify、dry-run、ESLint/Prettier/core smoke 通过。源码/dist 目标不兼容写法为 0，
  320/390/412、长文本、点击合同和无横溢由当前自动化覆盖。
- 当前真实开发者工具 Stable `2.02.2608040`、基础库 3.17.1、Skyline、develop：390px 显示
  `.76@a2cdd06`，fresh/截图后 Console 应用 error 0、目标 9 条 Warning 0；两条
  `tagNameStyleIsolation` 为独立环境提示。已知 automator `getPageMetaByWebviewId(...)=null` 是环境问题。
- `.76@a2cdd06` 已从 exact clean 源码用标准 CLI 上传：描述 `p10-test-tools-skyline-a2cdd06`、
  `buildDirty=false`、191 code files、ZIP 2,446,002 B、manifest `e50d001d…f027`；未提审、未发布，
  上传当时未改 allowlist、production、数据库、备份或服务器 release；其后已按独立授权完成 `.76`
  add-only allowlist 与 capability 验证。
- `.74@d23a78a` 已由用户在小米 14 按 test-tools 清单确认无异常；该历史真机证据不外推为当前
  `.76@a2cdd06` 真机通过。当前结论仅为历史不变量已恢复，且当前 SHA 自动化/开发者工具回归通过。
- 前序通讯录纠偏 `a9021c4e`/上传源码 `24a847f` 保持主线：一次性 App 启动标记、会话内有界诊断、
  transport 最终门禁和隐私上限有效；`.75@24a847f` 已标准 CLI 上传并加入 allowlist。
- `.75` 新证据推翻“单个孤立样本”结论：`xmb` 页面会话首搜已至少两次出现主查询
  9,696/8,932ms，同时另一次相同 `xmb` 仅 331ms；中文姓名和完整拼音主查询分别 240/235ms。
  已排除稳定客户端首搜退化，但首字母查询与数据库/服务冷态、执行路径或资源等待的组合根因仍在调查。
- production MySQL 当前 `EXPLAIN` 证实非数字搜索会先扫描当前员工批次约 1,200 行，再逐行执行
  exact/source-prefix/pinyin-prefix/contains 相关子查询并按派生 rank 排序；同一主查询 digest 117 次平均
  746ms、最大 9,877ms、平均检查约 56.6k 行。历史 statement/wait 明细未开启，物理 I/O 与当时 CPU
  仍不能直接归因；聚合锁时间和临时表指标不支持锁等待或磁盘临时表作为主要解释。
- 正常首搜约 0.7–0.8 秒，本轮不再优化；精确计数约 180–200ms。若未来压缩正常延迟，先单独确认页面
  是否需要精确总数，不与 10 秒长尾混为一谈。
- 保留 total >2,000ms 或 main query >1,500ms 阈值；自然使用超限时按 request ID 调查查询计划、
  锁等待、I/O、系统负载及备份或导入任务。当前不改客户端、SQL、索引、缓存、API 或预热策略。
- 非阻塞待办：`instanceAgeMs` 达 600000ms 上限时，报告显示 `≥600000ms` 或“已封顶”，不得作为精确值；
  不为此单独发版。性能最终口径 checkpoint 为 `docs(audit): clarify .75 long-tail observation`。
- 本次只读根因轮次验证：production 脱敏日志/request ID 关联、MySQL 状态与普通 `EXPLAIN`、controller
  1 file/44 tests、任务文档 Prettier、agent-context-policy 3/3 和 `git diff --check` 通过。checkpoint 以
  `docs(audit): investigate reproducible xmb query tail` 识别；不触发 production、备份、上传或业务改动。
- `.76` allowlist 状态 checkpoint 以 `docs(audit): record .76 allowlist activation` 识别；它只记录已完成的
  production 配置操作，不得写作体验版源码 SHA，也不因文档提交再次操作 production。
- `.75@24a847f` 小米 14 已确认半屏高度、关闭/回弹、内部列表滚动和固定清除入口四项通过；详细
  request ID、包体、manifest 和文档 checkpoint 留在 `docs/audit/STATUS.md`、审计报告与 Git 历史。

## 已完成的测试工具批次

- “更多 → 测试工具”由 `18498a8b` 实现；`.74@d23a78a` 历史小米 14 验收通过，主线回归由
  `a2cdd065` 向前修复并以 `.76@a2cdd06` 完成当前自动化、开发者工具和体验上传。release 失败关闭、
  只读有界诊断、隐私边界和后续通讯录诊断均保持有效；Skyline Warning 清理任务已完成关闭。

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

- 详细历史以 Git checkpoint、`docs/audit/wechat-miniprogram-audit.md` 和精确 debug 日志为准；本状态只
  保留仍影响下一批的事实。
- 当前 test-tools 源码：定向红灯 15/16，修复后 17/17；Mini 111 files/580 tests、TypeScript、
  production build/verify/dry-run、ESLint/Prettier/core smoke 通过；源码/dist 目标 Warning 源为 0。
- 当前 `.76@a2cdd06`：真实 DevTools 3.17.1/Skyline/390px/Console 通过，标准 CLI 上传及 production
  allowlist/capability 验证成功；历史
  `.74@d23a78a` 小米 14 test-tools 与 `.75@24a847f` 半屏证据按各自 SHA 保留。
- 既有 Page/controller/handler/timer/实例隔离、Worklet 2/2、权限/通知/Profile、发布控制与回滚门禁
  仍由原 checkpoint 测试保护；无本轮证据授权修改 API、数据库、索引、缓存或生产发布轨道。
- 性能口径文档 Prettier、`git diff --check` 与 agent-context policy 3/3 通过；状态文档保持在 250 行上限内。

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

1. test-tools Skyline Warning 清理在当前源码 `a2cdd065` 完成；`.76@a2cdd06` 已上传并通过 allowlist，
   后续 docs-only 收口 SHA 不是体验版源码，不再次上传或操作 production。
2. 主包 1.5 MiB 提示留给包体积审计；1445/1506 节点提示留给“页面状态、异步链路与列表性能”；
   既有冷构建时限波动不直接视为用户侧性能，绑定状态 503 仅在直接证据再次出现时调查。
3. `.75` 的 `xmb` 服务端长尾已至少两次复现，不再按孤立样本收口；保留 total >2,000ms 或 main
   query >1,500ms 阈值。当前只完成只读根因分析，不改客户端、SQL、索引、缓存、API 或预热。
4. 唯一下一任务：等待用户从隔离冷/热复现、语义等价候选集查询改写、输入请求收敛三个候选方向中
   确认后再实施；`instanceAgeMs` 封顶显示仍不单独发版。

停止条件：本轮完成只读根因报告和 docs-only checkpoint 并推送后停止；不再次上传、提审、发布、修改
allowlist、部署、创建生产备份、同步服务器 release，或改客户端、SQL、索引、缓存、API、预热。
