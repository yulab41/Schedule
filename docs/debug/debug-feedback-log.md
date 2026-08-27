# Web 1.0 调试与验证记录

本文件只记录当前轮次的变更、验证和状态；详细历史以 Git 提交为准。

## 2026-08-27 P0/P1 页面、测试、发布缓存与按需上下文硬化

- 根因批量收口：`.42/.43` 已证明 Skyline requiredComponents 下大型业务 panel 预注入可在 Page.onLoad 前失败；本轮把 organization 五页和 workflow 三页全部改为直接 Page + static include/import，并以通用 thin-page guard 禁止回归。工作流初版简单直连被 sub-agent 审计发现遗漏 picker/timer/实例隔离后撤回，最终 fresh-controller Page host 保留全部 receiver、生命周期、2 秒提示、callback 和 per-instance Map/array。
- 测试/平台：Mini 唯一 `--dir scripts` 入口，root Vitest 永久排除 runtime/src/artifacts/Mini scripts；duty/swap 冻结业务日期；PowerShell native fail-fast 与全 tracked text LF 固化。Mini 91 files/432、root 233 files/1113（37/352 skip）已通过；包体 4,669,357 bytes，organization 1,120,658。
- 控制面/性能：新增 add-only client version allowlist 双锁事务、三层 hash release cache 和 hash-identical metadata-only release；缓存/控制静态 32 项与 Bash syntax 通过，仍待 clean release worktree cache miss→hit 和生产真实控制验证。
- 上下文：project-status 从 759KB/2533 行压缩为当前事实；每轮只读 ≤12KB pitfall index，再按 paths/signals 读取匹配详情；禁止全文读取 debug log。boundary telemetry 改为闭合 marker registry、运行时拒绝、core 关闭可重试、每会话一次，并补通知双页固定 Page/controller 标记。
- 当前 checkpoint 识别消息：`fix(platform): harden mini and release boundaries`。提交前还需最终 format/lint/root+Mini full/cache 实测/core smoke/diff；推送后上传 `.46`、完整部署新控制面、正式 ensure 白名单，再以 docs-only checkpoint 实测无停机 reuse。
- 实际发布：代码 checkpoint `50c696ab` 已推送；clean release 第一次 cache 三层 miss、第二次 2.8 秒 build existing/dist/flat 全 hit。`.46` 官方上传 164 files/zip 2,088,212/manifest `6cbbb907…e19e59e`。备份 `1b2d0b06-b291-4143-8050-687325875be9`（54 表/178964 行/82411400 bytes/SHA `2a237225…eeb76`）后完整部署；正式 allowlist ensure 追加 `.46`，重复 ensure 无重建，trusted verify/full verifier 通过。下一 docs checkpoint 实测 hash-identical 无停机 release。

## 2026-08-27 pnpm 构建脚本策略固定

- 根因：pnpm 11 自动写入四个 `set this to true or false` 未决值；workspace 状态因而持续不匹配，每个 pnpm 命令先隐式 install，再以 `ERR_PNPM_IGNORED_BUILDS` 失败。首个显式策略 checkpoint 的隔离打包又暴露第二层：helper 临时 strict 配置与普通命令指纹不同，普通 pnpm 仍补跑 install。`allowBuilds` 来自 `ae649b32`，已做 `git log -S`/blame。
- 红绿/安全：策略测试先后在占位配置、缺少 `verifyDepsBeforeRun=false` 时各自红；四包在 build scripts 被阻止的现有安装中都能加载，故四项明确 false，esbuild true 保持。项目级关闭脚本前自动依赖预检，但显式 frozen install、release fingerprint/helper install 全部保留；测试 10/10，无 override 的 Mini verify/root build/typecheck/format/lint/core smoke/diff 通过。
- checkpoint/发布：`aa2380a0` 已推送但因打包暴露第二层重复 install 未单独部署；最终 `51d74dcd` 已推送。无 Mini runtime 变化，不另传版本。备份 `cee7a5a6-88ee-4ebf-ad9f-1a28e4ffe0af`（54 表/178654 行/82309268 bytes/SHA `d29b64bc…de13`）后部署最终 release；privacy 0/0、full verifier、`.45` capability、未知版本 426、env root/600 均通过，远端 temp 已删。随后转入三个 organization 同风险薄壳。

## 2026-08-27 P9 通知双页直接注册与同类页面审计

- 反馈/证据：通知设置继续白屏，生产无通知列表/偏好请求；通知中心与设置自 `1a428d73`/`766ec6ac` 起均为同一个大型 `notifications-panel` 的薄 Page 壳。沿用 `.42` Page 前失败与 `.43` 直接 Page 成功的根因，不另造假设。
- 红绿/实现：旧薄壳 direct runtime/static 4 项先红；两页以不同 mode 直接挂同一 controller，并静态复用 WXML/WXSS 后转绿。构建器新增回归先证明八个已不可达 P9 panel/controller JS 入口仍重复输出，再改为只参与 Page bundle；insights 分包约 `2,095,118`→`857,676` bytes。业务 API、权限、订阅授权、错误/空值、调用次数和视觉内容不变。
- 验证：通知 direct/page/controller/build-tools 定向通过；排除既有日期敏感 P7 duty/swap controller 后 Mini 86 files/393 tests 全绿。Mini production/source/package/determinism/CI dry-run、根 build/typecheck、任务 format、core smoke/diff 通过；manifest `f0b27cc9…61f92`，总包 `5,298,266`，organization `1,753,082` 仅 warning。首次验证因 workspace 占位 allowBuilds 值临时用 `--config.verify-deps-before-run=false`；用户随后要求永久处理，已由上方独立工具链 checkpoint 收口。
- 全页审计：同风险薄壳还剩 organization 的 directory/group-settings/invite-visitor/platform-accounts/scheduling-config 和 workflows 的 duty/leave/swap，共 8 页；只标为风险、未把未复现页面宣称为故障。按仓库批次约束，下一页面批次先迁移 directory/group-settings/scheduling-config 三页，再分批处理其余五页。
- checkpoint/发布：`4d8a38e9` 已推送；`.45` 官方上传 177 files/zip `2,361,119`/manifest `79ad5571…16189`。备份 `b76e3e04-3d73-486c-ab42-7a1cecb1a55b`（54 表/178600 行/82291256 bytes/SHA `06b7f88b…c3ec5`）后部署同 release，privacy 0/0。首次白名单探针因 JSON 字段顺序比较过严失败并完整回滚；无序字段逐值探针重试后 `.45` 七维 true、未知版本 426、env root/600、full verifier 通过，远端 temp 已删；等待通知双页实体复核。

## 2026-08-27 P9 统计与导出直接注册根因修复

- 根因闭环：`.43` 访客实体恢复；生产出现 Page `49b3e23b…765f`、controller `e81c5ca2…4e64` 和 visitor aggregates/logs API。`.42` Page 前失败与 `.43` 直接 Page 成功严格对照，确认 requiredComponents 大型 panel 预注入架构是根因。
- Phase 4：统计与导出精确复用同一直接 Page 模式，业务 controller/WXML/WXSS/API/权限/状态不变，通知不动。旧实现 direct/static 4 项失败，实施后 4 files/25、其余 Mini 85 files/390 通过。
- 验证：Mini production/source/package/determinism/CI dry-run、根 build/typecheck、任务 format/lint/core smoke/diff 通过；manifest `f0ee2f88…021e`，总包 `6,219,241`、insights `1,777,061`（1.5M warning、低于 1.8M block）。下一候选 `.44` 只收口统计/导出实体结果，包体重复项另开任务。
- checkpoint/发布：`49b6841e` 已推送；`.44` 官方上传 185 files/zip `2,748,070`/manifest `5022c068…693c`。备份 `3183f4dc-3015-48aa-b0e6-17fad4cc9798`（54 表/178441 行/82234428 bytes/SHA `c975ed1f…e367`）后部署同 release；预热一次 502 后恢复、privacy 0/0、full verifier 通过。`.44` 双锁加入白名单，七维 capability true、未知版本 426、env root/0600；等待统计/导出实体复核。

## 2026-08-27 P9 访客页直接注册架构验证

- Phase 1：`.42` 三页触发后六个指纹均缺失，四次 telemetry POST 均 204 且只落 workbench 样本，证明失败在 Page `onLoad` 之前。用户按 systematic-debugging 的架构讨论要求，明确批准只对访客页做直接注册实验。
- 单一改动：访客页直接挂既有 controller data/methods/lifetimes，静态 include/import 原 WXML/WXSS，只保留稳定 UI components；事件统计/导出完全不动。旧实现 direct/static 2 项失败，实施后访客 3 files/16、其余 Mini 84 files/388 通过。
- 验证：Mini production/source/package/determinism、根 build/typecheck、任务 format/lint/core smoke/diff 通过；manifest `cd14fd76…c1e95`，总包 `5,912,836`、insights `1,470,660`。下一候选 `.43` 只验证访客页；成功才迁移其余两页，失败立即停止该架构方向。
- checkpoint/发布：`5993aabf` 已推送；`.43` 官方上传 185 files/zip `2,619,012`/manifest `30e4e781…1809`。备份 `51abee04-6234-4fc6-80fc-f3390591496b`（54 表/178115 行/82126764 bytes/SHA `fd68b6bd…f9e1`）后部署同 release；预热一次 502 后恢复、privacy 0/0、full verifier 通过。`.43` 双锁加入白名单，七维 capability true、未知版本 426、env root/0600；等待访客页单一对照结果。

## 2026-08-27 P9 systematic-debugging 边界诊断

- 用户反馈/规则：`.41` 访客访问、事件统计、导出排班仍白屏。用户要求安装并使用 `systematic-debugging`；技能已安装。按“三次修复失败后停止第 4 个补丁”规则，撤回直接注册草稿，本批只增加匿名边界证据。
- 根因阶段证据：官方 `.41` 185 code files 精确等于 dist 的 JS+JSON+WXML+WXS 全集，上传裁剪已排除；生产仍没有三页业务请求。当前未知点只剩 Page `onLoad` 是否执行、panel `attached` 是否执行。
- 诊断/隐私：三个 Page 与对应 panel 各写一个固定 `unknown/UNKNOWN` telemetry 指纹，不含身份、群组、参数、正文或原始 stack。六个指纹映射已写入状态文档；旧实现 3/9 失败，加入后页面壳 9/9，P9/runtime/telemetry 6 files/41、其余 Mini 83 files/387 通过。Mini production/根门禁通过，manifest `3def817a…98dcf`、总包 `5,766,384`、insights `1,324,210`；`telemetry.ts` 全文件 lint 仅保留 `c5322516` 的既有 `_dedupeKey` 1 项，本批不混入清理。
- checkpoint/发布：`eecc46f4` 已推送；`.42` 官方上传 185 files/zip `2,559,893`/manifest `e64f68f8…fbfc`。备份 `2c8df6b0-2fa4-4460-9f38-2a041f57ef0f`（54 表/178009 行/82091384 bytes/SHA `8f92c07d…2c38`）后部署同 release；预热一次 502 后恢复、privacy 0/0、full verifier 通过。`.42` 双锁加入白名单，七维 capability true、未知版本 426、env root/0600；等待用户各触发三页一次。

## 2026-08-27 P9 官方上传完整性白屏

- 复测/定位：用户确认 `.39` 页面高度修复后仍白屏。11:35–11:52 的 `.39` 匿名 workbench 样本正常、无 runtime error，API 仍没有 P9 页面请求，失败点继续位于自定义组件 controller 之前。
- 失败实验：`728ecaf0` 移除 requiredComponents 后，官方 Summer 编译器以 code 10009 在上传前拒绝“Skyline 必须配置 requiredComponents”；`.40` 没有形成，外部版本/白名单/生产均未变化，配置已恢复。
- 上传实验：本地构建 255 files，而 `.38/.39` 官方上传只包含 153 个代码文件；`ignoreUploadUnusedFiles=true` 来自 `3884713b`。`30b967eb` 通过 CI setting 传 false 后 `.40` 仍为 153 files/zip `1,404,416`/manifest `2e4105b0…9a15`，因此未加白名单、未部署、不要求用户复测。
- 最终实现/验证：在 project config 把裁剪开关改为 false，移除无效 CI override，并更新 source audit；同文件用户其他改动原样保留且只部分暂存目标行。工程配置/CI/页面壳 3 files/18、P9/CI/构建 13 files/63、先前其余 Mini 83 files/384 通过；Mini verify manifest `ff288b71…7664`、总包 `5,759,536` bytes、insights `1,317,455` bytes。最终候选改为 `.41`，只有官方文件数增加才继续部署。
- checkpoint/发布：`106d6c3e` 已推送；`.41` 官方上传从 153 增至 185 files，zip `2,553,561`、manifest `a79b96b7…fba1`。备份 `51b066e9-f254-4d77-a479-2bf6480d4319`（54 表/177757 行/82008060 bytes/SHA `d8943bfc…83f7`）后部署同 release；预热一次 502 后恢复、privacy 0/0、full verifier 通过。`.41` 双锁加入白名单，七维 capability 全 true、未知版本 426、env root/0600；等待实体 Android 复核。

## 2026-08-27 P9 安卓真机页面壳白屏

- 反馈/定位：`.38` 安卓真机在通知设置、访客访问、事件与统计、导出排班进入白屏卡死。11:06–11:10 的匿名遥测有正常 `.38` workbench 性能样本且无运行时错误；生产 API 同窗没有收到任何 P9 业务请求，故定位在页面壳/组件挂载之前。`git log -S`/`git blame` 确认 P9 页面壳来自 `ca7d92ee`、`ee6f9cb8`、`1a428d73`、`de710eaf`、`766ec6ac`。
- 根因/修复：五个页面使用 100% 高组件宿主但 `page` 只有全局 `min-height`，没有 Skyline 所需的确定视口；通知设置的宿主选择器还写成未挂载的 `notification-settings-panel`，并遗漏同分包页面配置。现在全部 P9 页面显式建立 100% `page` 高度/裁切/背景，通知设置改为真实 `notifications-panel` 并补齐 Skyline、自定义导航和禁滚配置。
- 红绿/语义：页面壳契约旧实现 5/5 失败，修复后 5/5；P9 controller/native 11 files/50 tests 通过。仅改变页面挂载几何和配置，不改 controller、请求、权限、capability、异步错误、通知授权、导出或业务数据。
- 运行/浏览器验证：Mini production verify/source/package/determinism/CI dry-run、根 build/typecheck、任务格式/lint/diff 通过；manifest `8c9160bb…42d`，总包 `5,759,536` bytes、insights `1,317,455` bytes。`pnpm --config.verifyDepsBeforeRun=false smoke:check-core` 确认未触及 Web 核心链路，无需 Web 浏览器冒烟；Mini 全量仅保留未修改 P7 swap/duty 的 5 项日期敏感失败。安卓原生结果必须由 `.39` 实体复核关闭。
- checkpoint/发布：`db45b719` 已推送；`.39` 官方上传 153 files/zip `1,404,421`/manifest `19a6bf1f…1fe8`。备份 `d201910a-f10f-4114-84fc-fb3fc0530587`（54 表/177629 行/81965592 bytes/SHA `b6d1e866…07a2`）后部署同 release；预热一次 502 后恢复、privacy 0/0、full verifier 通过。双锁原子追加 `.39` 并同时重建 API/web，`.39` 七维 capability 全为 true、未知版本 426、env root/0600。未提审/正式发布，等待用户实体 Android 复核五个 P9 页面。

## 2026-08-26 Mini 事件与统计复刻 Web 规则

- 当前结论：Web 生产代码/功能冻结且 tracked diff 为 0。事件标签/状态/色调/时间/分组与统计 10 项汇总、排序、周期口径按 Web 黄金复制到隔离的 presentation-core 子路径，只由 Mini 新接入且不进入根导出图；Mini 增加日期分组、游标分页、月/年周期、成员/岗位/班种统计，同时保持 P9 原始 payload/operation id/完整身份不入页面状态。
- 回归门禁：共享模块和 Mini 对等契约旧实现先红；跨实现等价测试持续比较未修改 Web 与 Mini 使用的共享规则。Web/共享 138 files/715、Mini 78 files/349 通过；四端 typecheck、build、generated、Mini production 门禁和任务 lint/format 通过。Mini `5,707,902` bytes，manifest `ddd7bd8a…0249e`。
- 运行/浏览器验证：`pnpm smoke:browser` 等价入口连续三次被既有周视图按压反馈断言提前阻断；当前源码专项浏览器实际验证事件/统计真实只读数据、月年切换、横向溢出 0、console error/warn 0，未提交业务写入。提交前运行 `pnpm smoke:check-core`。
- 发布状态：`4de2cd91` 已推送；production-profile `.26` 官方上传 153 files/zip `1,388,999`/manifest `30f80419…5ba5b`，未提审/正式发布。备份 `e9a8c72a-348e-40d0-9d78-05d4d21d2bf8`（54 表/175,174 行/81,138,876 bytes/SHA `a6f1dc8f…3bc7`）后部署同一 release，full verifier 通过；`.26` capability 200 且 `insights/externalMessages=false`，远端临时目录已删除。以后每个 Mini 版本必须主动提供更新说明。

## 2026-08-26 Web/Mini 通知中心与通知设置共享

- 当前结论：通知类型标签/色调/时间、提醒小时与模式、群组管理权限已统一下沉 `presentation-core`，通知设置网络边界已统一下沉 `client-core`；Web 与 Mini 不再各自维护业务规则，微信订阅授权仍为 Mini 平台能力。
- 回归门禁：旧实现缺共享模块/群组客户端并保留 Mini 私有规则时先红；共享化后 Web/共享包 136 files/709、Mini 75 files/342 全绿，旧响应缺微信开关时默认开启的兼容语义也由共享 decoder 覆盖。
- 运行/浏览器验证：`pnpm smoke:browser` 等价直接入口在当前源码 API 3000/Web 5400 完整通过管理员、成员、访客 vkey 与访问记录，浏览器错误为 0；证据只保留 `runtime/smoke/latest`，服务已关闭。提交前运行 `pnpm smoke:check-core`。
- 发布状态：`5aa23fd7` 已推送；production-profile `.25` 官方上传 153 files/zip `1,371,373`/manifest `fc75d4f9…81fd`，未提审/正式发布。备份 `94fa0c8f-c143-403d-a7fc-dc36426c6996`（54 表/174,969 行/81,070,972 bytes/SHA `9ed228b7…94c2`）后部署同一 release，full verifier 通过；`.25` capability 200 且 `insights/externalMessages=false`，远端临时目录已删除。

## 2026-08-26 项目内生成物约束与历史目录清理

- 范围：用户禁止项目相关 worktree/release/smoke/log/tmp 留在项目外；允许删除已落地淘汰版本和调试/测试内容，但未落地开发必须保留。初始盘点为 `E:\AItools` 104 个 `Schedule-*`、16 个外部 worktree、Temp 1002 个 `schedule-*` 和项目内多批旧 release/test 副本。
- 清理/保留：Temp 与项目外 Schedule 目录最终均为 0；`runtime` 仅保留 `directory-data`、未落地 P10 directory/preflight worktree、最新 `release-worktree@8505d2f1`。P10 两 HEAD 均非 main 祖先，完整保留；删除的旧 worktree 均为已落地 main 祖先或明确调试/测试内容，Git 分支和提交未删除。
- 恢复：历史依赖归档内链接误指主工作区，导致 409 tracked 文件短暂成为 D；立即按删除路径清单从 HEAD 恢复。最终删除 0、cached diff 0、409 blob hash 与 HEAD 一致，用户原有两项修改不变。root dependencies frozen reinstall 本地复用 1459/download 0，workspace 备份原样恢复。
- 防复发/红绿：release worktree 默认和自定义路径锁定 `runtime/` 子目录；ECS scratch=`runtime/tmp`，smoke evidence=`runtime/smoke/latest` 且覆盖旧 latest；AGENTS/runbook 同步。旧实现 4 failures；现定向 2 files/12、Node syntax、全仓 typecheck/build、任务 Prettier、core smoke/diff 通过。真实 helper 首装 1459/reuse1459/download0，复跑 1 秒 `dependencies=reused`；正式 ECS package 明确使用内部 `runtime/tmp/api-flat-*` 且退出后清空。正式 lint 只报既有 5 个 Mini 文件 7 项错误；宽泛根 Vitest 错误 cwd 扫入 Mini page tests 后停止，均未改未落地内容。
- checkpoint/发布：`2a9f7dfc`（`fix(tooling): keep project artifacts in repository`）已推送，无 Mini 上传。备份 `a5beb36b-e699-4ad4-8b1a-de52797e5d32`（54 表/174836 行/81026748 bytes/SHA `24694aa8…5900`）后部署 release `2a9f7dfcab2efe68db5abd9e21164e22344df0e8`；预热一次 502 恢复、privacy 0/0、full verifier 与远端 temp 清理通过。

## 2026-08-26 Web/Mini 工作流展示规则共享

- 范围/引入点：用户确认通讯录 `.23` 真机视觉通过，并把“Web 规则下沉、Web/Mini 同源”冻结为所有页面/功能的项目原则。本批只共享请假、换班、加扣班的展示/候选/日期算法；Web 候选/状态来自 `d14a4ffe`、色调来自 `2bb9fce1`、请假来自 `0d5ec55c`，Mini 三套副本来自 `bc32a4f1`；均已执行 `git log -S`/`git blame`。
- 红绿/实现：新增 `presentation-core/workflow` 行为契约及 Mini 禁止私有副本契约；旧代码分别因模块不存在和三 controller 保留状态 helper 先红。Web workflow/leave/swap/duty helper 改为共享 re-export，assignment option 只保留 Vue VNode；Mini 直接调用同源状态、色调、下一状态、业务日、候选、成员、星期/班次、请假区间/统计和跨月规则。
- 行为/语义：Mini 未来班次改用 Web 的中国时间 08:00 业务日交接，非法请假日期采用 Web 精确错误；其他显示行为等价。API client/receiver、Promise/catch/finally、空值、权限/capability、operation id、版本、冲突/网络重试、调用次数、写入、刷新和存储不变；无 API/DB/capability 变化。
- 验证：共享/Web 定向 6 files/36、Mini/共享定向 5 files/30；Web+presentation 115 files/642、Mini 73 files/338 通过。三端 typecheck、presentation/Web production build、任务 Prettier/ESLint、Mini verify/source/package/determinism/CI dry-run 通过；包体 `5,614,509` bytes、workflows `1,135,823`、manifest `d1d19c52ed3a292307bdce33738d679771c8e140af87094e70959d94058e3387`。宽泛 Vitest 误扫用户 `.artifacts/runtime/src` 历史副本后按正确 cwd/排除重跑全绿；`pnpm verify` 仅被 32 个用户自有/既有文件格式差异阻断，任务文件全绿。
- 运行/浏览器验证：`pnpm --config.verifyDepsBeforeRun=false smoke:browser` 首次因 5173 无服务停止；当前源码 API 3000/Web 4173 重跑进入管理员工作台后，被既有“周视图定位按钮按下反馈”断言提前阻断，未到工作流。应用内浏览器本地 WebView 两次无法附着；临时服务关闭。提交前运行 `pnpm --config.verifyDepsBeforeRun=false smoke:check-core`。
- checkpoint/发布：代码 `08c8414e`（`feat(workflows): share Web presentation rules`）已推送；production-profile `.24` 官方上传 153 files/zip `1,359,588`/manifest `65e80f65…8949`，未提审/正式发布。备份 `e8fcb486-ad25-43c1-93fe-485566976a55`（54 表/174,379 行/80,876,900 bytes/SHA `a374ed32…569e`）后部署 release `08c8414e1593e3561fd4b519e1d49477de7d60e8`；预热一次 TLS EOF 恢复、privacy 0/0、full verifier 通过。
- allowlist 偏差：`.24` 首次原子追加因探针错误要求 JSON 字段顺序一致且预热短暂 502 触发安全回滚；确认旧列表、`.23=200`、`.24=426` 和健康后，改为字段顺序无关并带 30 次重试的同一原子流程成功追加。`.24` HTTP 200，`global/core/workflows/organization/guest=true`、`insights/externalMessages=false`，第二次 verifier 通过，远端 temp 已清理。下一批只审计通知/事件/统计展示规则。

## 2026-08-25 P8-B 组织管理 Web 黄金

- 引入点/测试先行：production 群组/成员/配置/平台页分别来自既有实现；本轮额外定位 `5102950a` 的 320 成员管理隐藏、`02a508dd` 的平台绝对定位屏幕阅读器标签、`bfa07554` 的群组/配置 muted labels、`f723b0db/59300957` 的个人 scope 与 `41d284b3` 的禁用班种 opacity。P8 黄金测试最初因 story/fixture/manifest 缺失先 4 项红；Pinia、320 状态装配、平台溢出和 AA 对比度均先补失败断言后修复。
- 行为/语义：34 个 Storybook story 直接渲染 production `GroupSetupPanel`、`MemberManager`、`SchedulingConfigPanel`、`PlatformAdminUsersView`，覆盖五类角色、八类状态、390/320/大字号；邀请/访客使用无 secret 的同源新 story。Storybook 只安装 Pinia/memory router、脱敏 fetch fixture 和状态装配器。production 改动仅为更深现有 token、禁用 glyph 移除 opacity、危险按钮颜色、screen-reader label 绝对锚点；请求接收者、异步/错误、空值、权限、副作用、调用次数和离线无写队列语义不变。
- 视觉/无障碍：34/34 最终装配、根横向溢出 0、console error/warn 0；群组、成员确认、配置冲突、邀请成功、平台链接和大字号六类 Storybook Accessibility/Axe 均 `Violations 0`。390/320 首屏、成员 bottom sheet、配置 409、邀请成功、平台一次性链接与大字号均已实际截图检查；链接/二维码全部为脱敏占位，没有输出真实 secret/电话/subject。
- 运行/浏览器验证：`pnpm smoke:browser` 首次访问默认 5173 因本地服务未启动停止；仓库 dev 首启又因 Windows 保留 5173–5240，首个 6009 Web 未设 `VITE_AUTH_DEV_MODE=true` 按门禁停止。随后当前源码 API `127.0.0.1:3000`、Web `127.0.0.1:6009` 完整通过登录、管理员、成员、访客扫码 vkey 与访问记录，全流程无浏览器错误；临时服务已关闭。`pnpm smoke:check-core` 通过并确认本批不含列明核心链路。
- 其他验证/发布：P8 定向 4 files/14 tests、Web 106 files/612 tests、typecheck、production build、Storybook static build、任务文件 Prettier 与 diff 检查通过；首次 Web 全量只被 P7 对旧单行 Storybook setup 的源码形状断言阻断，收窄为实际 `app.use(TDesign)` 后全绿。代码 checkpoint `d8e323d5` 已推送；无 Mini 上传。备份 `2a9f21ea-18fa-4361-98ee-089e85911290`（54 表/168,905 行/78,973,204 bytes/SHA `610a470b…3f83`）后部署 release `d8e323d5ab0de0d61ad28042207bcf3e32dbef71`，预热一次 502 后恢复；full verifier/health 200、`.94 organization=false`、`.96/.97/.98/.99` 426、远端 temp 清理通过。最终状态 checkpoint 识别消息 `docs(status): record p8 web golden deployment`；当前等待用户确认 Web 黄金后才进入 P8-C-1。

## 2026-08-25 P8-A2-2 排班配置写入安全硬化

- 范围/引入点：只硬化岗位创建/成员替换/轮转排序/轮转规则/岗位删除及班种创建/更新/删除；不处理邀请、visitor key、平台身份或 Mini UI。Web/API 主调用来自 `04c7da36`，班种删除来自 `d24b6920`；已执行 `git log -S`/`git blame`。
- 红绿/实现：Contracts、scheduling route、client-core 和 Web 配置表面 4 组新契约在旧实现为 4 files/6 failures；实现后 4 files/8 tests 通过。8 个 endpoint 统一 operation id；group rules + role + rotation-rule/shift-type 多层 expected version，actor-first 幂等事务先于权限/目标检查，删除后可重放；同 payload 重试冻结，成功清理，失败复用。
- 真实数据库/联动：配置核心 7/7 覆盖创建/更新/删除重放、同键异 payload、stale aggregate/entity、角色/规则版本推进及并发单一胜者；API 全量真实 MySQL 串行 70 files/467 tests 全绿。下游日历、自动生成、手排、请假、换班、加扣班、通知、事件、统计、导出、邀请和历史补录夹具均提交当前版本。
- 语义审计：Web 仍经同一 shared transport/`fetch.call(globalThis)` 发一次请求；Promise/catch/finally、确认框、空值、loading、错误文案和成功 `loadConfig` 次数保持。班种即时启停继续不整页刷新，只在成功结果局部替换实体并将本地 rulesVersion 推进一次；失败恢复开关并保留相同 snapshot。Mini 无配置写入口、存储或离线写队列，organization 仍关闭。
- 运行/浏览器验证：Contracts 16/58、client-core 12/41、Web 103/604、Mini 45/254；typecheck、API/Web/Storybook build、generated freshness、Mini production verify/source/package/performance/determinism/CI dry-run、任务 lint/format/diff 通过。`pnpm --config.verifyDepsBeforeRun=false smoke:browser` 首轮因 Vite 在仓库根启动导致站点根 404、未进入产品断言；改在 `apps/web` 启动同一当前源码后，登录、管理员、成员、vkey 访客及访问记录完整通过且无浏览器错误；`pnpm --config.verifyDepsBeforeRun=false smoke:check-core` 通过。临时 API/Web 已关闭。Mini 2/2 Worklet、3,367,089 bytes、manifest `a7ee17d9fdbb6fe3ad42a24760982ddb0c1278863c4ff08e9e19f58e11cbbf5f`，仅既有 600 格 warning。

## 2026-08-25 P8-A2-1 群组/成员写入安全硬化

- 范围/引入点：仅硬化群组创建/认领/加入/退出/改名/群组码/解散恢复、成员/预设增删转换、角色/姓名/联系方式、所有权及历史认领决定；不处理排班配置、邀请、visitor key、平台身份或 Mini UI。调用点来自 `1b5a17ae/8e42afb8/322550d9/394b1c87`，API 事务来自相同首版服务；已执行 `git log -S`/`git blame`。
- 红绿/实现：Contracts、group route、client-core 和 Web 三表面 4 组新契约在旧实现分别因缺 operation/version、路由未拒绝、共享写客户端不存在及重试未冻结而先红；实现后 4 files/8 tests 通过。20 个 endpoint 统一 header/body operation id；actor 锁和 idempotency row 先于会改变权限/删除目标的领域校验，因此所有权转让、退出、删除和恢复可重放原结果。Group/member/roster/dissolved/contact/claim 使用 expected version，409 返回最小 latest data；姓名变更同时推进 membership version。
- 真实数据库：API 全量真实 MySQL 串行 69 files/463 tests 全绿；其中 P8 核心 group/permission/claim 3 files/23 tests 覆盖同键同 payload 重放、同键异 payload 409、stale group/member/contact version、所有权变化后的重放、唯一 owner 和事务回滚。所有下游日历、手排、发布、请假/换班/加扣班、通知、统计与导出 fixture 已带独立测试幂等键。顺带修正 4 项既有测试漂移：缺两张身份表清理、旧 `/config` 路径、已关闭的自助改名并发预期、历史请假改为直接历史 fixture；均不改生产语义。
- 语义审计：Web 仍经原 shared transport/`fetch.call(globalThis)` 发一次请求；三个 production surface 使用 presentation-core fingerprint 冻结同 payload operation id，成功后清理，失败后同 payload 可安全重试。receiver、Promise/catch、loading、表单空值和成功刷新次数不变。Mini 仅因共享包/严格 GroupMember version 更新测试 fixture，没有写入口、存储或离线队列；organization capability 仍关闭。联系人 audit 改用本次 operation id，不记录原始电话。
- 运行/浏览器验证：`pnpm --config.verifyDepsBeforeRun=false smoke:browser` 首轮在 smoke 自身旧 contact payload 得到 400 后停止；补 expectedVersion/header+body operation id 和版本化清理后重跑，登录、管理员、成员、vkey 访客及访问记录全通过，无浏览器错误。Contracts 15/56、client-core 2/7、API 69/463（真实 MySQL）、Web 102/602、Mini 45/254 通过；三端 typecheck/build、Web/Storybook build、Mini production verify/source/package/performance/determinism/CI dry-run、任务 lint/format/diff 通过。`pnpm --config.verifyDepsBeforeRun=false smoke:check-core` 找到本节记录并通过；临时 API/Web 已关闭。

## 2026-08-25 P8-A1 组织管理共享只读边界

- 范围/引入点：只建立群组摘要/目录、成员/预设、联系方式、认领请求/查找、排班配置、平台账号和邀请预览的共享 endpoint/decoder；Web 既有只读调用先委托，Mini 工作台移除 groups/members 手写结构校验。群组/成员=`8e42afb8`，配置=`04c7da36`，邀请=`a50c4fce`，平台账号=`02a508dd`，Mini workbench=`733e3af6`；均已执行 `git log -S`/`git blame`。不接入写 UI，不打开 organization capability。
- 红绿：新增 client-core/Web/Mini 三组契约在旧实现分别因模块不存在、Web 未委托和 Mini 仍手写解码而失败；实现后 3 files/8 tests 首轮通过，补充 legacy rulesVersion 兼容后 client-core 5 项通过。Web 全量 101 files/600 tests、Mini 45 files/254 tests 通过；Mini 星期格式测试在系统日期跨至 8/25 后暴露既有硬编码日期，现只在该测试冻结 Date 并重载模块，不改生产日期守卫。
- 语义审计：Web 仍通过原 shared transport 和 `requestWithOnline`，保持 `fetch.call(globalThis)` receiver、Bearer/Content-Type、离线只读、HTTP/无效响应和每方法一次调用；缺省 `rulesVersion` 继续按旧 Web 行为接受。Mini 复用原 `createWxJsonTransport`，groups/members 仍要求 core，401 单飞恢复、错误拒绝和请求次数不变；缓存仍删除 groupCode/手机号。platform/dissolved/claim lookup 继续要求 organization，邀请 resolve 保持 core；无写请求、重试或存储新增。
- 运行/浏览器验证：`pnpm smoke:browser` 首次触发 pnpm 非 TTY 依赖目录重装询问，已拒绝且未改依赖；127.0.0.1:4173 + 本地 dev auth 下运行 `pnpm --config.verifyDepsBeforeRun=false smoke:browser`，登录、管理员、成员、vkey 访客和访问记录全流程通过且无浏览器错误。`pnpm --config.verifyDepsBeforeRun=false smoke:check-core` 找到本节记录并通过；临时 API/Web 已关闭，4173/3000 无监听。

## 2026-08-24 P7 `.94` 请假/选择器/日历实体反馈修复

- 范围：Mini 请假 Sheet 改为一行日期、44px 原因框、Web 同款灰色空态与受影响班次列表；日期 picker 增加三面板横滑、当天定位按钮及按压/旋转动效；selector 测量完成前隐藏，消除先下后上的闪现；年月吸附不再预跳字体状态，并以 `scrollend` 完成、320ms 兜底；周视图姓名补 semibold。Web/Mini/API 请假最早日期统一按中国标准时间自然日，不复用 08:00 业务日。
- 引入点：affected message/list=`bc32a4f1`，Sheet 日期列=`c1b9536a`，reason 88px=`80ddadf0`，selector placement=`c1b9536a`，wheel snap=`80ddadf0/c1b9536a`，周姓名无字重=`50c6d1ed`，日期横滑首版=`b5603189`，历史日期保护首版=`18d2a2ea`。上述调用点已执行 `git log -S` 与 `git blame`。
- 红绿：Mini picker/leave/static 旧实现 7 项失败后转绿；自然日边界和跨午夜重开表单在 Mini/API/Web 旧实现分别失败后通过。最终 Mini 44 files/252、Web 100 files/598、API 35 files/148 通过，API 33 files/311 数据库集成按本机无数据库配置跳过；Mini/Web/API typecheck、Web/API/Storybook build、Mini production verify/source/package/performance/determinism/CI dry-run、任务 lint/format/diff/core smoke 通过。Mini 2/2 Worklet、3,034,245 bytes、manifest `e2a350b2e6e467aa79ad03c02cfa1ed45cf4d477869d8fec5097655d97dc5bc6`，仅既有 600 格 warning。体验上传与生产部署待本 checkpoint 收口。
- 语义审计：selector 只延迟可见性，不改 open/选择事件；wheel 只改显示吸附进度与完成时机，完成/取消 payload 不变；日期定位不提前 emit；冲突列表只拆分展示字段；自然日守卫仅收紧请假日期，不改变排班业务日、事务、权限、幂等、409/弱网和写次数。
- 运行/浏览器验证：`pnpm smoke:browser` 首次因 5173 无服务未进入断言；改用 127.0.0.1:4173 + dev auth 后两次均在既有周视图左切换按下态断言停止，未到本轮请假页。应用内浏览器 390×844 专项确认 Web 请假表单无横溢、空态为灰色、起止日期触发器完整，开始日期选择器 1–23 日禁用、24 日为首个可选自然日，console warn/error=0；未提交业务写入，临时 API/Web 已关闭。`pnpm smoke:check-core` 通过并确认本轮未触及其定义的核心链路路径。
- 体验/生产：`0975b2d1` 已推送；`.94@0975b2d` 官方上传 96 files/zip 792699/manifest `cb9e7a63…3f64`，未提审/正式发布。备份 `d289468d-c317-4dbd-982b-fb1697ad2955`（54 表/166064 行/78003772 bytes/SHA `7726622f…36fa`）后部署同 release，预热 1 次 502 恢复、privacy 0/0；双锁追加 `.94`，`.93/.94` 200、partial/unknown 426、`.94` core/workflows=true、env root/600、ECS_PUBLIC_IP full verifier 通过。
- 生产数据修复：徐漫彬 `8125ca23…` 仍为 active/approved 且无 revoke；备份 `f8878d42-1c05-4d9a-88dc-4a4e90ed1c5e`（54 表/166111 行/78019548 bytes/SHA `f2e06a69…b452`）后，单事务软删除 1 行、version 2→3、追加 1 条系统 `leave_request_revoked` 事件；既有 cover 审计/排班格不改，8/10、8/16、8/22 marker projection 均为 0。修复后 full verifier 通过、远端 temp 已删。

## 2026-08-24 P7 `.92` 请假日期与历史标识修复

- API 创建/affected/preview/approve 均拒绝今天以前的开始日期；Mini 传入 `min` 并在 controller 层二次拦截。calendar-query 对 `leave_cover_completed` 关联 leave request，删除或非 approved 时不返回 marker。
- 验证：Mini 44/247、API typecheck、calendar/leaves 精确测试入口通过/数据库集成按环境跳过；尚未上传或部署。

## 2026-08-24 P7 `.91` 日历/滚轮/Sheet 对齐

- 范围/引入点：`.90` 实体反馈；字号=`1f715c96/50c6d1ed/16c02f56`，picker root/定位=`bc32a4f1/7f4f70a0`，离散 wheel/snap=`16c02f56/80ddadf0`，Sheet=`80ddadf0`。只改 Mini UI/controller、测试和 `.91` 契约。
- 红绿/实现：连续 wheel 字体、向上 placement、空白 backdrop、箭头/完成几何、leave 日期周几和 Web body 结构均先红后绿。月11px、周12px固定统一；progress 插值19–24px/0.58–1/0.94–1，snap 240ms cubic-bezier；selector用组件 query 判断窗口上下空间；leave字段组、day-count、affected hint/list、单列日期、reason=1000、submit=提交请假。
- 语义审计：下拉 backdrop/placement只改视觉 open/placement；picker instance registry、month/date complete/cancel、operation payload与写次数不变。请假日期保留原始YYYY-MM-DD提交值，新增display label；原因仍走同一handler。
- 验证：Mini精确44 files/246、typecheck、production verify/determinism/source/package/build/performance、CI dry-run、lint/format/diff/core smoke通过；persistent clean=2 Worklets/3038926 bytes/manifest`a69c74fe…09bb`，仅既有600格warning。未操作微信开发者工具。
- 体验/生产：`c1b9536a`已推送；`.91@c1b9536`官方上传96 files/zip790149/manifest`39370032…076bb`，未提审/正式发布。部署前备份`ae5c5d1e-f1f1-457e-8479-38856f6fa946`（54表/165673行/77862612 bytes/SHA`5ee7eb42…8d6d`）后部署同release，预热1次502恢复、privacy0/0。双锁追加`.91`、`.90/.91` capability200且core/workflows=true，partial/unknown426，env root/600，full verifier/current release/health200及temp清理通过。
- 状态：已实现待实体复核。最终checkpoint=`docs(status): record p7 calendar sheets deployment`；最后一次备份保护 docs release 后停止等待`.91@c1b9536`。

## 2026-08-24 P7 `.90` Web 下拉/滚轮/Sheet 对齐

- 范围/引入点：`.89` 二次实体反馈；2秒状态目标覆盖 `16c02f56` 的1秒，picker独立 open=`bc32a4f1/7f4f70a0`，60ms hover=`0d971de1`，双滚轮静态 scrollend=`16c02f56`，82%灰底Sheet/96px textarea=`bc32a4f1`。只改 Mini UI/controller 和 `.90` 发布契约，不改业务/API/DB/P8。
- 红绿/实现：timer、实例registry互斥、100ms idle/180ms animated snap、Web select几何/常亮态、Web request Sheet/紧凑原因框和 `.90` contract 均先红后绿。selector=300px/6px/28px/3px/shadow-2，移除60ms hover；滚动中按44px实时 draft，原生惯性期间只存私有top，停止后再受控吸附；request Sheet=白底/22px/78vh/32%遮罩/右上完成，leave=88px三行，duty=44px单行。
- 语义审计：picker互斥只改open；selector仍一次change，month/date完成一次、取消零次。wheel timer/registry均在close/detached清理，不改value；reason input继续同handler/detail.value/maxlength/payload。Promise、receiver、空值、幂等、409/弱网与写次数未触及。
- 验证：定向20、release3、Mini精确44 files/243、typecheck、production verify/determinism/source/package/performance/build、CI dry-run、lint/format/diff/core smoke通过；persistent clean=2 Worklets/3029919 bytes/manifest`34520295…96a0`，仅既有600格warning。根目录/路径式 Vitest 会误扫用户`.artifacts`旧副本，保留副本后用包目录`--dir scripts`验证真实源码。发布worktree=`dependencies:reused`，直接pnpm预检失败后使用既有执行入口，未重装依赖；Windows主工作区二次build首次瞬时ENOTEMPTY，800ms重试通过；未操作微信开发者工具。
- 体验/生产：`80ddadf0`已推送；`.90@80ddadf`官方上传96 files/zip787035/manifest`279ff1f7…9db0`，未提审/正式发布。首次缺key失败未成版；ECS首传API归档partial被hash门禁拦截，持续会话重传完整。首次备份CRLF参数只打印usage、未成archive；随后正确备份`6c1259df-1652-4908-b4fe-e6abe0e1f6c6`（54表/165519行/77785416 bytes/SHA`cbe645a4…406e`）后部署同release，预热1次502恢复、privacy0/0。双锁同时recreate api/web追加`.90`成功，`.89/.90`200且core/workflows=true，partial/unknown426，env root/600，full verifier/current release/health200通过，temp已删。
- 状态：已实现待实体复核。最终checkpoint=`docs(status): record p7 web control deployment`；备份后同步production，再停止等待`.90@80ddadf`。

## 2026-08-24 P7 `.89` 下拉、滚轮、预热与日历字号

- 范围/引入点：只修 `.88` 实体反馈 7 项；timer=`0d971de1`，独立 picker/120px empty/native wheel=`bc32a4f1/7f4f70a0`，筛选阻断冒泡=`733e3af6`，群组点击后 mount=`0d971de1`，月/周姓名=`1f715c96/50c6d1ed`。不改 API/DB/危险写/P8。
- 红绿/实现：1秒 timer、sibling/parent close 5项，filter outside/empty/warmup，year/month continuous scroll，native picker removal，月/周固定字号及 `.89` contract 均先红后绿。Panel 用冒泡 request-open 同步关 sibling，组件 catchtap 保留内部选择；筛选 option catchtap 保持多选，Sheet 空白只收下拉。年月改双 enhanced scroll-view，拖动中按 44px 中心实时高亮并在 scrollend 吸附；Apple HIG/UIPickerView 作为交互参考。核心 ready 后后台预热群组 Panel；empty=44px；月/周姓名固定 10/11px。
- 语义审计：selector 仍点选一次 emit，month/date 完成一次、取消零次；互斥/外部 close 只改 open。筛选多选/summary/refresh不变；group warmup 只增加 ready 后既有只读 GET，无号码缓存/写队列。字体不改变数据/点击。业务 receiver、幂等、409/弱网路径和写次数均未触及。
- 验证/发布：persistent clean Mini44/238、release18/18、定向15，typecheck、production verify/determinism/source/package/performance、CI dry-run、任务 lint/format/core smoke/diff通过；clean=2 Worklets/3024024 bytes/manifest`2ba339de…98c44`，仅既有600格warning。`16c02f56`已推送，`.89@16c02f5`官方上传96 files/zip784225/manifest`d6122a44…ffea`，未提审/正式发布。部署前备份`515fc053-7ca0-4fd7-9840-4fd4d03c0232`（54表/165292行/77686716 bytes/SHA-256`8da250f1…7be6`）后部署同release，预热2次502恢复、privacy0/0。首次allowlist只recreate API后健康超时，trap恢复`.88`但Nginx旧upstream造成短暂502；同时recreate api/web恢复后，改良双锁脚本幂等追加`.89`成功。`.88/.89`200、partial/unknown426、env root/600、full verifier/health200通过，temp已删。
- 状态：已实现待实体复核。最终状态 checkpoint=`docs(status): record p7 interaction refinement deployment`；先备份再同步production后停止等待`.89@16c02f5`。

## 2026-08-24 P7 `.88` 实体反馈与发布 worktree

- 范围/引入点：`.87@7f4f70a` 实体反馈只修日历同步、工作流/群组壳层、提示生命周期和 picker/Sheet 视觉；另修本地 Windows 每轮临时 clean worktree 重装配。`git log -S`/blame 定位发布文字到 `de3ad5f7/e25878f0`、日历内存缓存到 `9e3a966c`、群组全页入口到 `59300957`，Panel/picker/form/hover/周末/常驻提示到 `bc32a4f1/7f4f70a0`。
- 红绿/实现：缺 release helper 先整 suite 红；Panel 壳层、calendar event、3 秒 timer、群组嵌入先 7 红；weekend 分段、19/24px wheel、60ms 无蓝填充、预挂载表单/固定关闭位/较轻遮罩先 4 组红；`.88` contract 3 红，现均转绿。release helper 复用仓库外 detached worktree 和 Git-dir 依赖指纹，任何脏目录/分支/非登记目录失败关闭。真实首跑安全创建 worktree 后先暴露 Windows 直接 Node 的 `pnpm.cmd EINVAL`；第 5 项回归改为 Node 执行 AppData `pnpm.mjs`。1,459 包随后 reuse 1,459/download 0/added 1,459，但 strictDepBuilds 因 4 个未审构建脚本退出；第 6 项回归只降 strict 为 warning，脚本仍被阻止且不使用 all-builds。pnpm warning 仍会自动写 review 占位行；第 7 项回归只在剥离这些行后与安装前原文完全等价时恢复原文，其他改动失败关闭。专用 worktree 的自动占位已精确移除，node_modules 保留。三工作流成功后触发同群 calendar 强刷；群组管理中央 Panel 保留工作台壳层；提示自动收起。周末仅括号字样红且选中不丢，leave form 不再运行时创建 textarea/闪“读取中”。
- 语义审计：所有业务写 payload/幂等 key/409/模糊重试/receiver/catch 与次数不变；只新增成功后的日历 GET。timer 只清视觉字符串；Panel 复用原 P5 controller；selector 仍一次即选，month/date 完成才 emit。发布脚本不执行 clean/delete/reset，不接管普通目录或用户分支。
- 验证：persistent clean Mini 44 files/234；release/worktree/controls 4 files/29；Mini typecheck、production verify/determinism/source/package/performance、CI dry-run、任务 ESLint/Prettier、Node syntax、diff check 通过。clean production=2 Worklets/3,018,325 bytes/manifest `500966810019827ab35929d464025c916918443c9a902d7b42ffeb13bdbae142`，仅既有 600 格节点 warning。精确 clean worktree 首跑曾暴露 `9a436e8b` CSS 预算直接数 CRLF 和 Mini MJS 未固定 LF，分别表现为 45,005 误超限和 Vitest/Vite 语法误报；新增 EOL 契约先红后绿，预算先规范化 CRLF、Mini scripts 由 gitattributes 固定 LF。`.88` 官方上传 96 code files/zip780059/manifest`705af2e7ee9d7b45466688ab721296168aa47acae3b3dbade0c28d223a3c32fe`。ECS packager 首跑又被 `pnpm build` 冗余依赖预检阻断，测试先红后以 `verifyDepsBeforeRun=false` 转绿；构建本身尚未开始、服务器未变化。运行/浏览器验证：`pnpm smoke:check-core` 通过并判定无 Web 核心变化，无需 `pnpm smoke:browser`；禁止的微信开发者工具 GUI 未启动/控制。
- 体验/生产：`.88@a6a029b` 官方上传成功（96 files/zip780059/manifest`705af2e7…32fe`），未提审/正式发布。release `1d19d493` 部署、预热 502 恢复、privacy0/0；误以为 updater 含 DB job，部署后复核才发现只备份应用文件，因本批无 API/DB/迁移变更而立即补做加密备份 `b7ea25b8-0753-4799-929e-e58a4ac38fbd`（54表/165115行/77606204 bytes/SHA-256`140345f1…e1ed`），记录顺序偏差。双锁追加 `.88` 后 `.87/.88` core/workflows=true，partial/unknown426，env root/600；full verifier/health200通过，远端临时目录已删。
- 收口：packager 写 LF `components.d.ts` 后内容 hash 与 HEAD 相同但 status stat-only M；helper 第 8 项回归先红，改用 content diff/cached diff/untracked 三项后转绿，真实差异仍阻断。`f7253bbd` 推送后，以部署前备份 `4c97b416-c7b4-4ab8-8b59-6cdb8ee79330`（54表/165133行/77612324 bytes/SHA-256`494be9a2…4368`）保护并复用同制品部署；预热 TLS EOF 恢复、privacy0/0、full verifier/`.88` capability/health200通过，远端 temp 已删。
- 状态：已实现待实体复核。最终状态 checkpoint=`docs(status): record p7 physical feedback deployment`；它也必须先备份再同步 production，随后停止等待 `.88@a6a029b` 的实体反馈。

## 2026-08-24 P7-B 工作流 Storybook 全状态黄金

- 来源/范围：production leave/swap/duty=`0d5ec55c/b20ff9b8/5d8b205a`，seed=`b903c6dc`；只做真实HomeView+production panels的P7黄金与一处44px生产样式，不改Mini源码/API/DB/capability。
- 红绿：缺production复用/20态/manifest先3红；浏览器发现TDesign未注册后新增回归再红；请假重排预览按钮32px后新增触控断言再红。实现Storybook全局Web TDesign注册、fixture fail-closed装配和按钮44px后4/4转绿。Web没有弃用TDesign；Mini仍禁止任何TDesign/第三方UI运行时。
- 状态：20 stories覆盖三工作流、成员/群主、list/form/approval/preview/conflict/direct/settings、全部状态及empty/error/loading，390/320精确ID已写入黄金清单。fixture只在story iframe替换fetch/auth，卸载恢复；没有第二套workflow-card。
- 浏览器/验证：最终静态Storybook 20/20 ready；未知TDesign、装配错误、console warn/error、页面/panel/Sheet横溢、低于44px工作流按钮均为0。截图artifact=`schedule-p7-workflow-golden-7cbb`。定向47、non-integration984、Web typecheck/build、Storybook build、Prettier/ESLint通过；下一步checkpoint=`feat(storybook): freeze p7 workflow parity states`，随后仅做P7-C原生请假。
- 发布：`a2f98361`已推送；备份`afefaed8-5a98-4067-a91b-4a87ecd6a016`（54表/163889行/77146000 bytes/SHA-256`7ef85dbd…acbb`）后部署同一release。DB51、retention0/0，预热首个502后恢复，完整verifier通过且远端临时文件已删；最终状态checkpoint=`docs(status): record p7 workflow golden deployment`。

## 2026-08-24 P7-A 工作流危险写与共享客户端

- 来源/红绿：leave=`0d5ec55c`、swap=`b20ff9b8`、duty=`5d8b205a`、mutation骨架=`beae8e84/7fcd6ae4/e5608cf3`。contract、19个危险route、38端点client-core、Web delegation、深冻结attempt和四panel wiring测试均先失败后通过。
- 实现：leave create强制operation ID并用canonical fingerprint事务幂等；三工作流危险写统一校验header/body，不一致在service前400。client-core严格解码全部工作流结果并生成schema；Web 38方法委托共享client。四panel同payload模糊失败重试复用ID、payload变化换ID、成功才删除attempt，不增加离线队列。
- 语义审计：共享transport receiver、认证、异步catch/错误映射、preview/settings调用次数与空值语义不变；危险写新增header/body一致性，leave新建从非幂等变为精确重放。生成器只新增typed map/propertyNames和仓库Prettier配置解析，不放宽未知字段。
- 验证：定向172、runtime boundary4、non-integration980、Mini191通过；真实MySQL leave20/swap34/duty26/notifications8/WeChat4共92/92。首次7失败均为跨suite旧leave helper漏operation ID，补齐同header/body后全绿。typecheck/build、Web production build、generated freshness、Mini production verify通过。
- 运行/浏览器验证：`pnpm smoke:browser`等价直接入口`SMOKE_BASE_URL=http://127.0.0.1:4173 node scripts/smoke-browser.mjs`在最终源码通过管理员、成员、访客vkey和访问记录，全流程无浏览器错误，最终截图`C:\Users\eylin\AppData\Local\Temp\schedule-smoke-oKEqzb`，临时服务已停止。前两轮周导航按下态失败定位为`0aaa5620`验证器先滚动周面板后在视口外按钮取CDP坐标；只给helper补`scrollIntoViewIfNeeded`后原样通过，未改产品UI。
- 发布：`b667dcc5`已推送；加密备份`e81f6b7d-62e1-4c0c-9a82-33af178a6b3b`（54表/163744行/77097920 bytes/SHA-256`4d134322…24c0`）后部署同一release。DB51、retention0/0，预热首个502后恢复，完整verifier通过且远端临时文件已删除。
- 下一步：最终状态checkpoint=`docs(status): record p7 workflow safety deployment`；P7-B只固化production panels的390/320全状态Storybook与1:1证据，通知中心仍留P9，不写Mini页面。

## 2026-08-24 P6-C9 核心 RC（用户已通过）

- 用户对`.81`实体Android RC明确回复“通过，继续”；依runbook约定，无需截图/数字即可将5/5/5/10阈值、弱网/离线/前后台/滚动项记为通过。P6正式关闭并允许进入P7，但未授权微信提审/正式发布。
- 修正文档漂移：`e2270bde`的“probe仅query/不上传”已被`c5322516`替代；`.81`始终测量并best-effort上传固定匿名duration，只有`performance=1`显示/保留页面样本证据，阈值与操作不变。
- Git/origin/production=`7d9a81b6`、DB51、`.81`能力正常。下一批只做P7 Web/API/Mini差距审计与首个工作流闭环；UI直接1:1复刻Web手机版，不再请求逐页设计选择。

## 2026-08-24 P6-C8 Mini `.81` anonymous telemetry（已部署待RC）

- 基线/来源：`a1d25fde`/DB51；App+capability=`e25878f0`，POST no-idempotency no-retry=`9e3a966c`，performance callbacks=`e2270bde`。不改UI/API/DB。
- 红绿/实现：缺emitter/hooks/wiring先8红；in-flight ceiling、path normalization、hostile getter再各1红。实现global+core、总量10/去重、单POST3s、无Bearer/retry/storage/offline queue；raw error只在本地归一化后纯TS SHA-256，队列只有固定匿名字段。tier只读benchmark并分unknown/1-2/3-5/6+；network/page严格枚举。
- 语义：App error/rejection只发app MINI_RUNTIME_ERROR；既有4项callback duration默认发送，诊断文字仍只`performance=1`，默认无新增setData/视觉。receiver/catch/null/认证重试/业务调用/矩阵mutation+undo/WXS不变；失败丢弃且不递归。
- 验证/发布：Mini33/191，non-integration913，lint/typecheck/build、source/verify/2 Worklets/determinism/package/dry-run通过；clean `c5322516` `.81`为132 files/1329516 bytes/manifest`8e11d0fc6a074a4ac78bdd76b5cd5a389aa4b433b1d1f76577929005eb522d5b`。CRLF只触发一次clean Vite解析噪声，规范行尾cached diff0后全绿。运行/浏览器验证：pnpm smoke:check-core无Web核心变化，无需pnpm smoke:browser。
- 体验/生产：第一次代理IPv6被微信拒绝且未成版；直连同commit `.81`上传72文件/zip476544成功。production allowlist原子扩`.78-.81`，env0/600，`.81` global/core/guest=true。备份`5d10a80c-…`后部署`c5322516`，job`55eccf06-…`/full verify/DB51/telemetry0/backup54通过。未提审；等待实体RC，checkpoint=`docs(status): record mini telemetry deployment`。

## 2026-08-24 P6-C7 telemetry schema 51 feature（已部署并演练）

- 基线/来源：Git/origin/production`be740fc`、DB50/无表；schema失败关闭来自`e25878f0`，0050范式`1514de25`，telemetry runtime`03c5d465`。只新增0051并收紧manifest51..51，不改UI/API运行时/Mini源码。
- 红绿/实现：缺migration、min51和DB51 verifier先3红；新增10列/3索引/3 CHECK匿名表，verifier检查严格30天、retention和最新backup54表，29个custom reset显式drop telemetry。真实MySQL migration/backup-retention/ingestion 42/42，静态40、non-integration913、Mini181、lint/typecheck/build/Mini verify通过。
- 验证说明：未排除历史副本和共享单库并行命令分别产生副本路径/建表冲突并停止；宽串行又暴露既有calendar-preferences reset与concurrency fixture噪声。排除副本并串行的相关源全绿；随机UUID同毫秒排序假设修正为按page断言。运行/浏览器验证：pnpm smoke:check-core判定无Web核心变化，无需pnpm smoke:browser；bash-n/diff check通过。
- 行为审计/发布：additive表不接触任何业务表/身份/FK；只激活已部署endpoint/job并让feature release拒绝DB50。`fb510c23`已推送；备份`c43c46dd-…`后升DB51，job`04e27e7e-…`/full verify通过；迁移后备份`643675bb-…`仍54表。rollback备份`c78c48e0-…`后回到`be740fc`，DB51/表1/行0，bridge job`71bff47f-…`与前向verifier通过；再前滚feature，job`32688425-…`/final verify通过。下一批做Mini `.81`；最终状态checkpoint=`docs(status): record telemetry retention deployment`。

## 2026-08-24 P6-C6 脱敏遥测 runtime bridge（已部署）

- 基线/范围：`b8c60827` schema bridge已部署、DB50。本轮只做DB50/51 strict telemetry runtime，不含0051/Mini/UI。
- 红绿/实现：缺contract/schema/service与backup/30天job/rate/redaction共8红+2缺模块suite；实现固定匿名字段、Mini exact headers+global/core、16KiB/10条、no Bearer/read、单SQL插入、30天skip-locked、backup exclusion、Nginx/API budget和stack/message redaction。unit/static32、真实MySQL bridge ingestion3/3、lint/typecheck/build通过。
- 运行/浏览器验证：pnpm smoke:browser在127.0.0.1:4173当前源码/API通过管理员/成员/访客vkey/访问记录，无浏览器错误，截图`C:\Users\eylin\AppData\Local\Temp\schedule-smoke-EGPa7t`，临时服务已停。
- 运行/浏览器验证：pnpm smoke:browser 完整通过后，以 pnpm smoke:check-core 复核telemetry核心链路。
- 发布：`03c5d465`已推送；备份`09e4200d-…`后部署同一release，full verifier通过。生产仍DB50且telemetry表数0；手工job `8a2b4d2e-…`返回visitor/telemetry 0/0，证明DB50兼容跳过。下一批才应用0051/Mini `.81`。

## 2026-08-24 P6-C5 数据库 50→51 遥测兼容桥（已部署）

- 基线/范围：Git/origin/production`47e753e3`、DB50；仅把manifest max50→51，min仍50，无迁移/API/Mini/runtime变化。
- 发布：package max51断言先红后绿，`b8c60827`/备份`80341696-…`部署，job no-op/full verify通过；manifest50..51且DB仍50。0051不得绕过runtime bridge。

## 2026-08-24 P6-C4 访客 IP 90 天 feature（已部署并演练）

- 基线/范围：`bbcd00d4` runtime bridge已部署且DB49/raw0。本轮只提交0050、minSchema50并激活aggregate/job/cron，无UI/遥测/P7。
- 真实MySQL：migrations22、privacy事务4、visitor API9、platform backup/restore10，共45/45；覆盖严格90天边界、中国月桶、多群/月、幂等、rollback、backlog续跑、并发worker、平台管理员、trusted proxy和raw backup exclusion。中间索引行数/相对路径/随机排序/seed清理均为测试夹具修正。
- 发布/演练：`1514de25`已推送；迁移前备份`73e56ae0-…`(53表)后升DB50，首跑`b945b606-…` no-op/full verify通过；迁移后备份`2921998f-…`为54表。rollback备份`8d3b59eb-…`后回到`bbcd00d4`，DB50/control/cron保留并full verify，bridge job`909316b9-…`成功；再前滚feature，job`cd2423b1-…`和full verify通过。最终50 migrations、55业务表、raw/expired/aggregate=0/0/0、retention completed=4、MySQL2592000/0、health200。最终状态checkpoint为`docs(status): record visitor retention deployment`。

## 2026-08-24 P6-C3 访客 IP 隐私运行时桥（已部署）

- 基线/来源：`da144470` schema bridge已部署且DB49。visitor表/服务/IP/备份/recycle来源为`4fc6bd21`、`4b337490`、`7c783c71`、`a837586e`、`9e4a6765`。
- 红绿与实现：aggregate/schema/job/scheduler、trustProxy/Nginx/MySQL先6红，backup format2/legacy raw skip先2红，recycle明示覆盖先1红；实现raw API先行90天隐藏、平台管理员、IP规范化、backup raw永久排除、privacy log/MySQL retention及dormant 15分钟job控制，unit/static 9 files/50、真实MySQL visitor/platform+backup 19/19和typecheck通过。
- 运行/浏览器验证：pnpm smoke:browser 初次因5173未启动、`::1` EACCES及未显式dev auth依次安全停止；最终在127.0.0.1:4173当前源码+本地API通过管理员/成员/访客vkey/访问记录全链路且无浏览器错误，截图`C:\Users\eylin\AppData\Local\Temp\schedule-smoke-9arQfM`，临时服务已停。
- 运行/浏览器验证：pnpm smoke:browser 完整通过后，以 pnpm smoke:check-core 复核核心链路门禁。
- 兼容/回滚：DB49 aggregate endpoint 503、recycle跳过缺表、control只安装不调度；DB50才建cron并首跑。feature回滚后保留前向control plane，runtime bridge在DB50继续清理、隐藏raw并保持隐私日志/备份。
- 部署反馈：`4f1047c8`/备份`f71c6fca-…`在DB49部署，full verify发现http级privacy log与main log双写并失败关闭；4个server覆盖回归先红，`bbcd00d4`修复。新runtime备份`d8ec7b2b-…`为53表（raw整表排除），部署后full verify通过；DB49/raw0、MySQL2592000/0、control installed、cron absent、manifest49..50。该release固定为0050 candidate。

## 2026-08-24 P6-C2 数据库 49→50 兼容桥（已部署）

- 基线/引入点：Git/origin/production `5e010927`、DB49；manifest 的 49..49 由 `e25878f0` 引入。本轮只声明当前应用接受 additive schema50，不含迁移、表、API、任务或 UI。
- 测试与语义：先把 max 期望改为50，旧 packager 1项失败，修复后 package/release controls 2 files/21 tests；min仍49。DB49 bridge 可回到 `5e010927`；0050 feature release 只能回到接受DB50的 bridge，数据库从不降级。
- 验证/运行：任务 Prettier、Node syntax、diff、核心 smoke通过；无需浏览器 smoke。宽泛 Vitest 扫到用户历史副本噪声后，排除副本的真实源全绿；root MJS直接 ESLint的既有Node globals噪声不作为门禁，提交前运行根 lint。
- 发布：`da144470`已推送；备份`88931ea1-…`后部署，首个502自动恢复，full verify通过。manifest 49..50、rollback=`5e010927`、生产仍49 migrations；随后进入隐私运行时桥。

## 2026-08-24 P6-C1 性能量化与实体回调探针

- 范围/引入点：只做 P6 性能与 RC，不改 Web UI。门槛/人工清单来自 `c8d50f53`/`e53f3611`，20×30 fixture/限制来自 `6cc7463d`/`591ccff6`，WXS 热路径来自 `c35b35b8`。缺文件、false 分支双计、缺 probe/foreground wiring 均先红后绿。
- 自动门禁：修正 WXML 确定 false 与 unknown 的语义后，maximum PoC/正式 manual 的展开宿主元素下界为 1445/1506，depth/direct 为 8/31、11/31；view-model 171340 bytes，WXS `setData=0`、tap cell paths≤2。节点 `<1000` 明确未达并保持 warning+各页 exact no-growth，不将 desktop logic smoke 宣称为 Android 性能。
- 真机取证：显式 `performance=1` 才创建内存 probe；工作台 cold/resume、最大矩阵 render/tap 都以真实 `setData` callback 为终点并显示样本。默认路径零额外 patch/storage/network/视觉。RC JSON/runbook 固定 5/5/5/10 样本和 2500/2500/1000/100ms，仍待用户实体 Android 数字与滚动手感。
- 行为审计：workbench 请求、capability、缓存、ready commit、pending scroll、错误路径不变；manual matrix receiver、cell mutation、undo、WXS 坐标与默认 setData 次数不变。诊断文字只在被测 callback 完成后出现；P5 写链路和 Web 1:1 页面未触及。
- 验证：Mini 32/181，定向 5/25，non-Mini 176/948（36/324 skip）；全仓 lint/typecheck/build、任务 Prettier/diff、Mini verify/determinism/source/package/dry-run 通过。运行/浏览器验证：`pnpm smoke:check-core` 判定未涉及 Web 核心链路，无需 `pnpm smoke:browser`。宽泛根测试的 35 项错误 cwd Mini 噪声已用正确 Mini cwd复核全绿；全量格式只剩 15 个本批前已有文件。
- 体验与生产：实现 `e2270bde`、allowlist `ceeea26c` 已推送。clean `.80` 为 131 files、2 Worklets、1,294,199 bytes、manifest `f3728c55dda9a76b7c3514597c94364a80e120792450e380cd0e61c442dd2690`；体验上传 72 文件/zip459105 completed，未提审/正式发布。备份 `d96c7d70-…` 后原子扩展 `.78,.79,.80` allowlist 并部署 `ceeea26c1b4fa9e19a4a949707f69604974c44d3`；首个 502 自动恢复，full verify、49 migrations、首页/健康200、`.80` 七维和未知版本426通过，env仍0:0/0600。最终状态 checkpoint 为 `docs(status): record p6 performance deployment`；当前“已实现待实体性能复核”。

## 2026-08-24 P6-B 签名版本、七维能力与可回滚发布

- 范围/引入点：本轮只做 capability 与 rollback，不改 Web UI。shared endpoint/error 来自 `60cec6ed`/`884512c0`/`5ba3993d`，JWT/auth/env 来自 `39f9c66e`/`4416f79b`/`0a794d9a`/`c4504055`，Mini App/transport/workbench/consent 来自 `3884713b`/`9e3a966c`/`ad4cfb2c`/`59300957`，ECS immutable release 基础来自 `5f2bb8b3`。
- 实现：严格两 header、signed Mini claim、legacy .78/current .79 exact allowlist、七维 effective response、426/503、authenticated route fail-closed 与 public guest paired-header guard 完成。Mini App-global 纯内存 store、launch/show refresh flight、请求前守卫与既有 disabled layout 完成；privacy escape 先于版本/flag，grant 仍 core。
- 发布安全：显式 env 默认全关；production global/core/guest 开。switch 双锁、0600、只保留旧 boolean、信号/失败反改；manifest 固定 feature/hash/DB49/candidate。packager clean+fresh build+LF+逐脚本 bash-n+canonical/shell gate；rollback 只接受明示前驱，先 DB backup，不回退 DB，控制面前向保留，verify 失败自动前滚；update/current-release/system controls 均原子/可补偿。
- 测试：API 28/133 non-DB，真实 MySQL 48/48；Mini 29/171（含 manual in-flight capability invalidation 红→绿）；contracts/client/release 8/36；受控 non-Mini 176/948，36/324 skip。全仓 typecheck/Lint/build/generated/Prettier/diff check 通过；精确 `72d5dd34` Mini 为 1,286,719 bytes、2 Worklets、manifest `6e08894f73dbfe6dc1c24be1b8cef227ef10b51630d97fff11427ad07710a57d`，package/source/determinism/dry-run 全绿。
- 运行/浏览器验证：`pnpm smoke:browser` 当前源码 4173/API3000 最终通过管理员、成员、访客 vkey 与访问记录，无浏览器错误，截图 `C:\Users\eylin\AppData\Local\Temp\schedule-smoke-mbiazF`。首次缺 Web dev auth、随后两次 44px 瞬时量测停止，原样复跑通过；临时诊断已完全撤回。
- 生产演练：`b96b0a63` 初次回滚在应用变更前暴露并失败关闭 `/var/lock` canonical bug；`72d5dd34` 修复后以备份 `15d8de8f-…` 部署。global off/on 双版本全通过；备份 `0030fc85-…` 后回退 `0cfdeba6` 并完整 verify（capability 404、DB49不变、控制面前向），再以备份 `f08f77ea-…` 前滚 `72d5dd34`，最终 production verify 全通过。
- 状态：`.79` 体验版上传成功（72 文件、zip 455469、manifest `6e08894f73dbfe6dc1c24be1b8cef227ef10b51630d97fff11427ad07710a57d`），未提审/正式发布。待 `docs(status): record p6 capability rollback deployment` 同步生产后进入 P6-C，不进入 P7。

## 2026-08-24 P6-A 会话、弱网与离线缓存安全壳

- 范围/引入点：本轮只做 P6-A Mini runtime，不改 UI、Web/API/contracts/DB。session、一次请求 transport、24h 缓存、解绑成功状态和多月表现分别来自 `e69cfb76`、`884512c0`、`ad4cfb2c`、`9b7ffbef`、`3fc41610`。审计确认旧实现可在 401/403 后读缓存、解绑留 token/cache、换账号复用 group/month cache，并被邻月弱网拖垮当前月。
- 测试先行：新增 `p6-runtime`、`workbench-runtime` 并扩展 transport/P5 controller 回归；旧实现 15 failed/5 passed，另有 64 个未处理 401 rejection。实现后核心 3 文件/26 项、全 Mini 28 文件/155 项、受控非 Mini 169 文件/901 项通过；主审新增活动月保持断言先失败（邻月回写成 2026-06），修复后转绿。
- 实现：统一 executor 为 GET/非空幂等写提供 12s timeout 与 network/502/503/504 的 200/400ms 两次退避；空/无 key 写、4xx、invalid 不重试。64 并发/顺序旧 token 401 单飞一次 `wx.login`/login POST，fresh-code proof 401 不误判；严格 UTC session expiry、generation/tombstone、跨用户/解绑/final401/link-required 清理。v2 owner cache、无 groupCode snapshot、24h/未来/损坏/quota/离群门禁与真离线冷启完成；active month 先 ready，邻月非暂态失败关闭；hide/unload 旧 serial 不提交，show 强制重验。
- 行为审计：P5 所有危险写保持同 payload/key 自动重放，不建立离线写队列；非幂等写仍一次。`wx.request` 接收者、409/失败草稿、成功清 key、公开请求、完整手机号缓存剥离和 Web 语义不变。旧 generation 200 拒绝但不清新 session；storage 物理删除失败也不能恢复旧 token。
- 验证：全仓 typecheck/Lint/build、Mini source、production verify/package/determinism/CI dry-run 和任务 diff check 通过。精确 `9e3a966c` clean worktree Mini 为 1087846 bytes、2/2 Worklet、manifest `c5f68ce84139fe4b4ff4e06048870477f2c92e47fc2361fb3a7a521797238167`；无 Web 核心变化，不运行浏览器 smoke，`pnpm smoke:check-core` 通过。
- 发布：代码 checkpoint `9e3a966c` 已推送；production-profile 体验版 `0.1.0-p6.20260824.78` 上传成功（72 文件、zip 396436 bytes，manifest `947ad9001a9e12d3935abe49ede87102cc9c4e22f8e856e70732ea169863edce`），未提审/正式发布。生产备份 `3144fa12-8b3f-4e88-880f-9fe839e4cea4`（54 表、162572 行、76698680 bytes，SHA-256 `d62508415d7856753afbc041a9417a693f630449fc08ce89f7a0660e52c6678c`）后部署 release `9e3a966cb7bc81fe0399494fb719c142471f9c0a`；预热首次 TLS EOF 后恢复，`ecs-verify.sh` 通过 49 migrations，公网健康 200，远端临时目录已删除。
- 状态：P6-A 已完成（含自动运行验证、体验上传与生产发布）→待 P6 RC 实体复核。最终状态 checkpoint `docs(status): record p6 runtime hardening deployment` 对齐后，下一批只做 P6-B client capability、kill switch 和应用回滚演练；P6 性能量化、遥测/IP 保留和人工 RC 仍未关闭。

## 2026-08-24 P5 群组内手机号单独同意

- 范围与引入点：用户确认 P4 已全部完成并授权直接提交后续版本；本轮只把 P5 手机号同意落在群组设置，不再归入排班补录。`git log -S`/`git blame` 定位完整成员目录/原始联系人读取/管理员确认到 `6183e9d1`、`8e42afb8`、`394b1c87`，calendar 联系方式读取到 `20407fcf`/`ab250646`，手机号黄金到 `591ccff6`，Mini 完整号码缓存剥离到 `ad4cfb2c`。旧实现的 `isConfirmed` 是管理员核验，不是成员同意，无法阻止同群/guest calendar raw mobile 泄露。
- 测试先行与实现：contracts、路由、客户端、Web/Mini 页面缺失和 calendar raw 泄露均先红；后端增加 0049 nullable evidence、self-only GET/PUT、current contact version、header/body 幂等和精确 replay。fingerprint 绑定 group/membership/规范号码；grant/revoke/invalidated audit 含 fingerprint、noticeVersion、contactVersion 且不含 raw。号码、说明、新群或撤回均失败关闭；管理员不能代授权或提交他人 mobile，但 shortPhone/isConfirmed 旧权限不变。
- 跨端与语义：client-core compact decoder 新增 UUID/date-time/maxLength 支持并保持 Web Zod 等价；presentation-core 统一四态、冻结 request snapshot 和模糊失败稳定 key。Web 群组设置卡覆盖 loading/error/retry/missing/stale/consented/revoke/saving，跨群序号隔离；非本人联系方式编辑经白名单复制，getter-trap 证明不读取 mobile。Mini organization 分包只显示 masked phone，ready 态复刻已确认 22×22 checkbox，无额外状态 chip/action note/save hint；409 后若刷新也失败会清旧草稿并进入整页 error，不可继续旧版本写。
- 验证：相关真实 MySQL 43/43；受控非 DB 169 文件/901 项通过，36 文件/323 项按环境跳过；Mini 26 文件/136 项、共享/Web 187 项和 Mini consent 14 项通过。全仓 typecheck、Lint、production build、generated check、任务 Prettier 与 `git diff --check` 通过。宽泛根 Vitest 曾误扫用户自有 `.artifacts/runtime/src` 历史副本并以错误 cwd 运行 Mini 脚本，随后显式排除副本、Mini 正确 cwd 全绿，未修改这些用户目录。根 `format:check` 只报告用户自有 `project.config.json`、既有 `directory-entry-groups.ts` 和 3 个未跟踪 Storybook 静态目录共 14 文件，任务文件单独全绿。
- Mini production：精确 `59300957` clean worktree verify 为 2/2 Worklet、944442 bytes、manifest `702b2b274aea9cba46cd94e3fc645001377dab47c6d246a87b8cddae859c5dcb`；source/package/determinism/CI dry-run 通过。上传构建 944607 bytes，organization 分包 92178 bytes；不写完整手机号、同意状态、payload 或离线队列。
- 运行/浏览器验证：`pnpm smoke:browser` 在当前源码 4173 + 本地 API 通过管理员、成员、访客 vkey 和访问记录；1280/390/320 群组卡无横溢、操作 ≥44px。缺号码 fixture 临时写入测试号码，真实完成同意后管理员可见、撤回后立即隐藏，再恢复原缺号码/确认状态；截图 `C:\Users\eylin\AppData\Local\Temp\schedule-smoke-gWdKMl\16-member-mobile-phone-consent-ready-390.png`。浏览器无 error，Storybook 开关/视口已恢复。
- 发布：代码 checkpoint `59300957` 已推送；production-profile 体验版 `0.1.0-p5.20260824.77` 上传成功（72 个代码文件、zip 315651 bytes，manifest `bb8cacff632d15bd0c47e07e01aab9354504d84e419f1f4ff4a70ad13e1ff6fb`），未提审/正式发布。生产备份 archive `933fd73e-96c4-4128-a290-5fba1377a846`（54 表、162570 行、76692396 bytes，SHA-256 `5ff922c9286cc9e19afecf323cd3a6c38f47063f3f51e514e22fc26be6341385`）后部署 release `5930095705437d856d32aa61aaef4319c3dac23d`；预热首次 502 后恢复，`ecs-verify.sh` 通过 49 条迁移、产物/域名/容器/认证检查。首页/健康 200，新端点未登录 401，4 列存在、证据 0 行，远端临时目录已删除。
- 状态：P5 已完成（含运行验证、体验上传与生产发布）→待实体微信复核。最终状态 checkpoint `docs(status): record scoped phone consent deployment` 同步生产后进入 P6 核心 v1。

## 2026-08-24 P5 Web 同构原子排班补录

- 范围与引入点：用户确认 P4 已全部完成并授权直接提交后续版本，本轮只收口 P5 排班补录，不提前实现手机号同意。`git log -S`/`git blame` 确认 Web 多日期 staged/逐条确认来自 `561310ce`，服务端单条补录来自 `561310ce`，补录当前状态追踪来自 `0bcc39fa`；幂等 helper 最初来自 `7aac9c28`，completed 重放分支来自 `3a082d8d`、重试竞态修复来自 `31999918`，header/body operation-id 兼容来自 `591ccff6`。旧 Web 逐条事务会部分成功，Mini 发布历史入口则指向未注册页面。
- 测试先行与实现：contracts、API、client-core、presentation-core、Web 与 Mini 的缺模块/缺端点/逐条提交/未注册页面回归均先失败。新增最多 31 项且 `scheduleRoleId|businessDate` 唯一的严格真实日期契约；`POST /groups/:groupId/past-schedules/backfill-batches` 在一个事务内完成权限、规范指纹幂等、全部 upsert、逐项 immutable `schedule_backfill_completed`、按月统计和一次 workflow self-heal，任一失败连 period/event/idempotency 一起回滚。过期 24h key 现删除旧行后可复用；同 key 同 payload 重放不增写、异 payload 409。软删除 slot 1 唯一键冲突改为锁定并恢复原行。
- 跨端语义：Web/Mini 共用 endpoint/compact decoder 与纯 TS staged ViewModel；班种、成员和日期第二次点击均取消，今天/未来/相邻月失败关闭，岗位/月切换清除不匹配草稿。确认时冻结排序 items 与统一 reason，一次 POST；网络结果不明确保留同一 operationId，payload 改变才换 key，成功才清草稿。Mini 新增原生 `subpackages/scheduling/pages/backfill`，复刻已确认 Web 手机版结构、44px、全宽七列、390/320 compact class、最近记录和多 slot 只读显示；无离线写队列或业务正文缓存。
- 行为变化审计：旧单条 GET/POST/PUT 保留；active assignment 仍按 slotPosition/id 第一条修改，新 operationId 的同值写仍保持既有 version+1。新增 batch 会为每项写不可变补录事件并计入 manualAdjustment，`affectedShiftIds` 是 assignment ID；这修复了页面宣称“留下事件记录”而历史实现只写可变 trace 的缺口。Web shared transport 仍以成员调用保留 `fetch.call(globalThis)`、Bearer/public、离线 guard、错误映射和调用次数；Mini 仍以成员调用 `wx.request`。提交成功后的 records/calendar 刷新失败现在明确显示“已成功，刷新失败”，不再误报整批未确认。
- 验证：真实 MySQL past-schedules 11/11；受控非 DB 工作区 163 文件/881 项，Mini 24 文件/122 项，相关 Web 日历不可变/移动端/原子补录 23/23 通过；全仓 typecheck、Lint、production build 通过。精确代码 checkpoint clean worktree 的 Mini production verify 通过（2/2 Worklet，831731 bytes，manifest `fe9dbd2a142d3e24bb0a623013df17fdc7016e7d846d09696568487fcd4d3bd0`），source/package/determinism 与 CI dry-run 同 manifest 通过。根测试若不排除用户自有 `.artifacts/runtime/src` 会误扫历史副本，正确工作目录/排除后真实源全绿，未修改这些用户目录。全量 format check 只被用户自有 `project.config.json`、未提交 Storybook 静态目录和既有 `directory-entry-groups.ts` 阻断；任务文件定向 Prettier 与 `git diff --check` 通过。
- 运行/浏览器验证：`pnpm smoke:browser` 在 `http://127.0.0.1:4173` 当前源码、仅当前进程开发认证和本地 API 上通过；管理员、成员、访客 vkey、访问记录及既有 1280/390/320 补录颜色、44px、无横溢与成员二次点击检查均无浏览器错误，截图目录 `C:\Users\eylin\AppData\Local\Temp\schedule-smoke-so5b9r`。原生微信视觉/交互仍只能由体验版实体运行复核。
- 发布：代码 checkpoint `27992c75`（`feat(scheduling): add atomic backfill flow`）已推送；精确 clean worktree 的 production-profile 体验版 `0.1.0-p5.20260824.76` 上传成功（69 个平台代码文件，manifest `a3ad2af1ea740ba55c0790e442b7d38db16588a219dd8af2533b9b5f5d352441`），未提审/正式发布，也未使用微信开发者工具自动化。
- 生产：加密数据库备份 archive `34025a7f-fb8e-4853-be54-3f5c55526957`（54 表、162568 行、76691076 bytes，SHA-256 `19b8297cd30d1df8d3c337efeb794c30c6d633490b698cb1d25b8b3c29a4007e`）后部署 release `27992c758d06b1279a350b3721cdcaa2978fefac`。预热首个健康请求短暂 502 后恢复，`ecs-verify.sh` 通过产物哈希、域名/IP 隔离、公开端口、容器、依赖、退役认证和 48 条迁移检查；公网健康 200，远端临时目录已清理。
- 状态：已完成（含运行验证、体验上传与生产发布）→待实体微信复核。最终状态 checkpoint `docs(status): record atomic backfill deployment` 同步生产后，下一批只实现 P5 群组设置中的手机号单独同意，不提前进入 P6。

## 2026-08-24 P5 手排限制与发布版本闭环

- 前置与引入点：用户确认 P4 已全部完成并允许直接提交后续版本。`git log -S`/`git blame` 确认草稿/历史、发布状态机、共享 presentation-core 和既往日期撤回分别来自 `2834f07e`、`7c783c71`、`3be831be`、`b24db461`；浏览器 smoke 的旧“个班次”/`.track-event` 选择器来自 `1c84fd65`，生产按班种分组结构由 `f723b0db` 引入。
- 测试先行：共享 publication client 4 项、原生发布控制器 3 项在实现前全部失败；迁移/20-30-600 限制在旧实现上先失败。实现后 MySQL 迁移 20/20、手排模板/应用 26/26、关联撤回/重发工作流 60/60、受控真实工作区 862 项、Mini 113 项通过。撤回/删除重放、header/body 一致性、网络结果不明确时操作号复用均有回归覆盖。
- 行为与语义审计：手排上限明确收紧为 20 人、30 天、600 格，不截断存量；迁移违规即停止。矩阵同格同班种第二次点触取消且没有撤销按钮。发布/撤回/重发/删除的接收者、异步 catch、空值分支和业务调用次数保持原 Web 语义；新增的稳定操作号只在成功后清除。`Idempotency-Key` 为危险写统一入口，旧 body 字段兼容且不一致返回 400。
- 运行/浏览器验证：`pnpm smoke:browser` 首次因 5173 未启动停止；4173 当前源码服务中先修正两个过时 P4 smoke 文案/选择器和旧 31 天压力输入，最终管理员、成员、访客 vkey、访问记录全流程通过且无浏览器错误，截图目录 `C:\Users\eylin\AppData\Local\Temp\schedule-smoke-RkP89G`。Storybook build 2720 modules、Mini production verify（693683 bytes，manifest `bd2fe99ba2dfccbc5aed8104d65f5d69f49b057936418bd96609a174c3cc69e5`）及 source/package/determinism/CI dry-run 通过。默认格式门禁只报告用户自有 `project.config.json`、未提交 Storybook 产物和既有目录文件；任务文件格式与 diff check 通过，未改这些无关文件。
- 发布：代码 checkpoint `591ccff6` 已推送；精确 clean worktree 的 production-profile 体验版 `0.1.0-p5.20260824.75` 上传成功（66 个代码文件，manifest `d0b57bef9b7247c61f177f808256a0d48d6dd75c08b2500afd2b57825fc0f1f8`），未提审/正式发布。首次 pnpm 委托只在上传前被依赖安装脚本策略阻断，微信无外部变化；随后使用同一仓库 Node 封装直传成功。
- 生产：四类存量上限违规预检均为 0；备份 archive `e00e5848-d6d0-45b8-9318-1a9dcf96e6fa`（54 表、162566 行、76689752 bytes，SHA-256 `cf8a51a4aeeb32172e5886bfd7fc2d07f5db3a0f8a4175eccc605f6b0e43af4e`）后部署 release `591ccff6ac29f504cd57578a684552d9856b547e`。迁移前停止旧 API；预热首个 TLS 请求短暂 EOF 后恢复，`ecs-verify.sh` 通过产物、域名、容器、依赖和 48 条迁移检查，公网健康 200，远端临时目录已清理。
- 状态：代码已完成推送、体验上传和生产发布，待原生微信复核。最终状态 checkpoint `docs(status): record p5 manual release deployment` 同步生产后，下一批仅做原子补录和群组设置中的手机号同意。

## 2026-08-23 P4 `.73` 实体复核：角落裁切与列表控件

- 反馈与引入点：普通格 2px 选中框正常，只有底角格右/底边变细。`4b33274e` 的 month-grid/corner slot 多层 overflow、`733e3af6` 的 grid 顶边和 slot divider、`9045dc02` 的负 offset 共同造成：`defaultContentBox:true` 下 270/324px 内容实际多 1px，被 swiper 裁底，角落 slot 又裁掉跨 divider 的 right:-1。列表定位 id 位于 card 本体，原生对齐后没有前置 8px；`50c6d1ed` 的 54px/14px override 与同层级分割带覆盖造成 list heading 矮、小圆角和下阴影异常。
- 测试先行与实现：新增固定 28px 星期栏内分隔、month-grid 无额外顶边/角落无第二裁切、slot target 8px、card margin0，以及 list heading 62px/large radius/z3/card shadow 契约，`.73` 旧实现 3 项失败。修复后分隔线不再增加月格高度，统一 2px frame 保留；日期 id 移至 8px slot，默认/卡间/定位后三态同距；heading 提升到 z3，分割带 z2、swiper z1，复用现有大圆角与阴影令牌。
- 语义审计：没有 3px/DPR 补偿，也没有 Skyline 不支持的 CSS Grid。月格数据、270/324px、circular 动画、列表 target 值与调用次数、点击/电话事件、缓存/异步/只读边界不变；只改变原生布局载体与绘制层级。
- 验证：定向 30/30；隔离 `11a1f462` + 本轮 5 文件的 Mini 18 文件/95 项、typecheck、production verify（414316 bytes，manifest `9059abbe992308cadcb5645c19e4c63ace4b615975694ed17eb1199f85e98547`）、CI dry-run、核心门禁、ESLint/Prettier 与 diff check 通过。checkpoint：`fix(miniprogram): align calendar edge and list controls`。
- 发布：代码 checkpoint `0d8e385d` 已推送；精确 worktree 18 文件/95 项、typecheck、production verify（417647 bytes，manifest `40eda6083bc9e919aadb22c41867e51c808d74528ee2cb6bac934fdb82a69fb3`）和 CI dry-run 通过。production-profile `.74` 上传成功（63 文件，manifest `bf3241f75a2430e4b0526029d213cefa10272865bbbd246ffe7050ef71e0f156`），未提审/正式发布。生产备份 archive `4de6838a-93c4-4e19-be56-25be1f1eda85`（54 表、162564 行、76688428 bytes，SHA-256 `f0a58e099029185537ee68b49bbe3ab4b530e484eb8c057e7198ceb75002ffbb`）后部署 release `0d8e385def2e8d1f8ec787cd690aa9df188b569c`；预热首个 502 后恢复，`ecs-verify.sh` 全项通过，远端临时目录已清理。最终状态 checkpoint：`docs(status): record calendar edge deployment`。

## 2026-08-23 P4 `.71` 实体复核：原生回中与列表内容边界

- 实体结论与引入点：22:23–22:24 的 `.71` 截图否定了 `6ba2c72c` 的零时长三阶段回中、scroll-view 宿主 padding 和 slot inset shadow。原生 swiper 的 0/2→1 属性写回仍会回弹；宿主 padding 没有成为随日期卡滚走的内容。`9fdf659` 的分割带 shadow 与 heading shadow 叠加，通用末卡 8px margin + 宿主 16px bottom padding 留出底部空带；slot padding box 又被右/底 grid border 各缩进 1px。用户随后补充 22:45 初始截图，确认此前标题裁掉只是已滚动状态，撤回“遗留锚点复播”推断。
- 测试先行与实现：circular 稳定物理槽、finish 禁止写 current/duration、2→0 连续切月、逻辑月槽映射、列表内容内 8px、末卡零尾距、分割带无第二阴影和边界实体 border 契约在旧实现失败。实现删除所有月历回中 patch，0/1/2 槽按当前月循环映射并只更新屏幕外槽；列表间距落在 `.list-panel-content`，宿主无 padding，最后一卡贴底且保留原滚动位置；蓝框以 2px border 覆盖 1px grid border，最右/底边采用无 border 的 0 偏移。
- 语义审计：月份、日期、定位、五六行高度、240ms 曲线、快速队列、列表滚动目标、缓存/预取、request serial、Promise catch、只读 GET 和业务写入不变；同一视图重复点击直接返回，防止存活组件槽位被外部重置。截图视觉审查沿用既有医疗蓝灰令牌，没有增加新装饰。
- 验证：定向 30/30；隔离 `e1d4c54` + 当前 10 文件的 Mini 18 文件/95 项、typecheck、production verify（413828 bytes，manifest `bb67cc585828b1db8b4d5b5c4a2b8d698fe7172057df0666eb09aba8e9c5dc0b`）、CI dry-run、核心门禁、ESLint/Prettier 与 diff check 通过。主工作区并行 P5 类型扩展造成的无关 typecheck 失败已隔离，用户文件未修改。checkpoint：`fix(miniprogram): remove native calendar recentering`。
- 发布：代码 checkpoint `9045dc02` 与截图纠正 checkpoint `4761c31f` 已推送；`.72` 被纠正版替代。精确 `4761c31f` worktree 18 文件/95 项、typecheck、production verify（417342 bytes，manifest `b74c809eeda554367987abfbe052526dc89ac988ec672f0b9b0418db2015295c`）和 CI dry-run 通过，production-profile `.73` 上传成功（63 文件，manifest `e71bf2064a15fbb87b27e69994fee6bc8e54763ed93357f77d9e981a73c2f302`），未提审/正式发布；首次 IPv6 白名单拒绝未形成版本，幂等重传成功。生产备份 archive `72616c10-7478-48ab-8a07-af09fdf8e21f`（54 表、162562 行、76687108 bytes，SHA-256 `a3e8b5fa19e020b56a5fc43e638663d1944f670b97dcb40831bcb60beb6a7d8f`）后部署 release `4761c31f20232b68857ffdb9b458600071c65943`；首次 SSH 连接超时未执行任何远端步骤，重连后备份/部署。预热首个 502 后恢复，`ecs-verify.sh` 全项通过，远端临时目录已清理。最终状态 checkpoint：`docs(status): record circular calendar deployment`。

## 2026-08-23 P4 月历反跳、全日缩写与列表边界回归

- 反馈与引入点：`9fdf659` 在 swiper 仍显示 0/2 边缘槽时一次替换完整三月数据，边缘槽因此短暂显示目标月的再下一/上一月，形成反跳；同提交把列表首卡顶距归零并给控件叠加独有上阴影。`50c6d1ed` 原样透传班种缩写，生产默认“全天”和历史/自定义“全”混存；`9cdd0a8` 的定位动画状态跨视图保留；单元格内部选中框仍会被父 grid 边界/圆角裁细。
- 测试先行与实现：回中桥接、稳定 `relative` 槽、回中间隙快速点击、混合全日班、动画重置、列表阴影/8px 滚动顶距/底界和外层角落描边契约在旧实现失败。换月现先把目标月镜像到当前活动边缘和中央槽，零时长回中后才无视觉变化地补齐真实两侧，并在最终回调读取和消费快速点击队列；全日紧凑徽标统一“全”，非全日按 Web 2 字口径；切视图清零定位动效。列表使用统一 card shadow、可滚走的 8px 首间距和 `61px + safe-area` 底界；选中框由父 slot 最高层向内绘制。
- 语义审计：组件/页面接收者、目标月份、五/六行高度、240ms 同步过渡、选中日期、request serial、缓存/预取、Promise catch、空值和只读边界不变；没有修改班种业务配置或详情。调用次数变化仅是回中拆成无视觉跳变的三阶段 patch，且快速队列在中央面板完成后继续。
- 验证：测试先红后绿；定向 30/30，隔离 `e1d4c54` + 本轮 10 文件的 Mini 18 文件/95 项、typecheck、production verify（2/2 Worklet，411296 bytes，manifest `e865cbaa55a3c0a77569faf70aec55d34133ebe6c202a3af0cd0a48aad4ba5e4`）、CI dry-run、ESLint/Prettier、`git diff --check` 和 `pnpm smoke:check-core` 通过。既有 `.artifacts` 不完整副本和隔离 pnpm 自动依赖检查只产生环境噪声，正确受控命令全绿且没有修改用户并行文件。checkpoint 识别消息：`fix(miniprogram): eliminate calendar recenter regressions`。
- 发布：代码 checkpoint `6ba2c72c` 已推送；精确干净 worktree 18 文件/95 项、typecheck 与 production verify（414813 bytes）通过，production-profile 体验版 `.71` 上传成功（63 文件，manifest `2f4b9ccf301890e812c4c6fefc8e8a92e54dfa951895d02b146303c08e9f41a8`），未提审/正式发布。生产备份 archive `b94c8363-132e-4d2f-b415-d94863832e5d`（54 表、162561 行、76686444 bytes，SHA-256 `9f2b1384b10abcb702a80cb4b7109dc4f9a00b9fb31a0dea08a4430ffc28eb95`）后部署 release `6ba2c72cccb96c55a2831bd9d8a40ab854e05ecb`；预热首次 502 后恢复，`ecs-verify.sh` 全项通过，远端临时目录已清理。最终状态 checkpoint：`docs(status): record calendar recenter deployment`。

## 2026-08-23 P4 列表视口、月格描边与快速切换回归

- 反馈与引入点：`50c6d1ed` 的列表底部 8px 留白、`d9296df` 的控件无阴影、`4300fbe` 紧贴控件的 1px 边界共同造成列表上下裁切层级错误；`3fc41610` 的 1px inset 月格框留下缝隙，其 `panels` observer 又会在异步数据到达时无条件回中；`53b5c74` 过渡锁直接丢快速月按钮，周/列表也没有输入队列。每次 finish 继续走完整 `loadWorkbench/listGroups`，放大下一段动画被数据刷新打断的概率。
- 测试先行与实现：新增通栏 8px 消失带/上阴影/底栏贴合、零缝隙边界安全内描边、显式 month finish、月周列表快速队列、重复 finish 防护与 stale read 无副作用契约，旧实现失败。修复后列表控件使用上沿轻阴影+卡片阴影，裁切线位于 8px 带下沿并通栏，列表内容盒贴底栏；月格用 Web 同口径 2px inset shadow。月 swiper 只接受父页 period commit 的显式回中，三视图保留快速输入；队列清空后仅预取缺失边缘月，在线命中不请求、不渲染，过期读取不能改资源 Map。
- 语义与视觉审查：接收者仍为组件/页面成员调用；目标 period 的 `??`、选中日期、定位、横纵高度、缓存/离线 fallback、错误 catch 和业务写入次数不变。视觉沿用现有蓝灰/1px 分界/卡片阴影；生产 Web 390px browser webview 未 attach，临时视口已 reset，静态审查以冻结 Web `MonthGrid`/tokens 与用户实体截图为准，实体原生真值仍待用户复核。
- 验证：定向 27/27；隔离 `940358e` + 本轮 6 文件的 Mini 18 文件/92 项、typecheck、production verify（2/2 Worklet，408847 bytes，manifest `85256aed45eea7d152158c5ad36b4b795799b5ba64185df03a27bec358280097`）、CI dry-run、ESLint/Prettier、`git diff --check` 和 `pnpm smoke:check-core` 通过。checkpoint 识别消息：`fix(miniprogram): stabilize calendar viewport and rapid shifts`。
- 发布：代码 checkpoint `9fdf659` 已推送；精确干净 worktree verify 为 411118 bytes，production-profile `.70` 上传成功（63 文件，manifest `7d3c6e3bb89f079fc1a8ba5e9e0481fefbe9c4e043ca5608f1307114f24aad05`），未审核/正式发布。首次代理上传被微信按未登记 IPv6 拒绝且未形成版本，移除代理后以已登记 IPv4 `103.54.154.21` 同版本重传成功。生产备份 archive `57285f39-d961-4169-a440-2532545a7ac6`（54 表、162559 行、76685124 bytes，SHA-256 `fd243107a5f5f43d8d4e08056dfdf6b03d9b4c0a11253e9e9665fce510b881eb`）后部署 release `9fdf659ac4413423da4b4b4f4e4fadd8f3509da5`；预热首次 502 后恢复，`ecs-verify.sh` 全项通过，远端临时目录已清理。最终状态 checkpoint：`docs(status): record calendar viewport deployment`。

## 2026-08-23 P4 Mini 表现层债务/包体回归审计

- 审计与引入点：扫描 production `src` 格式器、WXML↔WXSS 可达类、重复 `setData/ViewModel` 和 build manifest。日期格式已收口，唯一剩余页面/ViewModel 双源是 `ad4cfb2c` 的月份标题；工作台仍有 30 余个多轮改版遗留、模板不可达的旧页头/筛选/列表/手绘图标 CSS；`loadWorkbench` 和视图切换仍各做两次表现层提交。P1/矩阵资源虽约 85940 bytes，但仍被手册和并行 P5 测试引用，本轮不删。
- 测试先行与实现：新增唯一月份格式、不可达类清零、工作台 WXSS <43KB 和加载/视图切换单 patch 契约，旧实现 2 项失败。修复后页面复用 ViewModel 月份格式；删除不可达 CSS 与组合选择器死分支；网络读取完成后把 ViewPatch、筛选摘要和状态一次提交，视图切换同理。
- 语义审计：CSS 只删除模板/动态类集合均不可达的规则，现用类、状态和 keyframes 保留；加载合并不改变 calendar/holiday 赋值顺序、request serial、catch、缓存、筛选或 GET/写入次数。月份字符串字节级一致，接收者/空值/调用次数不变。
- 验证与体积：定向 18/18；隔离 `aa17776` + 本轮 4 文件的 Mini 18 文件/91 项、typecheck、production verify（2/2 Worklet，405716 bytes，manifest `7f3e872ac6136de930bdf44dff5a35f60103c05cc752c3af94d5e037fe484c59`）、CI dry-run、ESLint/Prettier、`git diff --check` 和 `pnpm smoke:check-core` 通过。编译 WXSS 50258→39891 bytes，production package 412558→405716 bytes。checkpoint 识别消息：`refactor(miniprogram): remove legacy presentation debt`。
- 发布：代码 checkpoint `9a436e8` 已推送；精确 worktree 上传 production-profile `.69`（63 文件，manifest `b035de67989a542f4ff03d99617bf44c76ffc6e2799fad1bbf74d085361a8dc9`），未审核/正式发布。生产备份 archive `c311d738-cd8f-4fc2-bec6-301317d54397`（54 表、162557 行、76683800 bytes，SHA-256 `69d60f211e1506e0d629eeaad31f4cb5976507088193be13ea9e1cb48291d07b`）后部署 release `9a436e8b8524c5bfef3f0c2d8ba2040d170f8313`；预热首次 502 后恢复，`ecs-verify.sh` 全项通过，远端临时目录已清理。最终状态 checkpoint：`docs(status): record mini presentation debt deployment`。

## 2026-08-23 P4 日期闪动、列表无形门槛与定位慢拍回归

- 反馈与引入点：页面 `ad4cfb2c` 遗留 `“8 月 23 日 · 星期日”` 格式器，ViewModel 已在 `d9296df` 改成 `“8月23日 周日”`，日期点击先后写两种标签。`d9296df` 给列表 heading 留 8px 外间距，swiper 的真实上裁切点不可见。`733e3af6` 定位先播旧相邻面板、finish 后才构建今天面板，`3fc41610` 五个月淘汰还会移除今天月份。
- 测试先行与实现：目标行高 override、单一格式器、1px 可见裁切边界、今天月常驻和定位目标面板预装 4 项契约在旧实现失败。修复后删除页面格式器，日期选择以一次 ViewPatch 同步标签/详情；列表边界线与 heading 底边重叠避免双线；requested month set 常驻今天月，定位前将目标中央面板放入滑入侧并把目标月高传给 calendar，finish 原子提交 period/ViewPatch 后立即滚动，后台读取不阻挡视觉。
- 语义审计：普通导航、筛选、请求串行、catch、缓存 TTL、脱敏与业务写入不变；只读资源窗口最多增加一个今天月，首次读取后缓存复用。点击日期的中间旧标签和重复 ViewPatch 被移除，最终 Web 文案/详情数据不变。
- 验证：定向 24/24；隔离 `ce4057b` + 本轮 7 文件的 Mini 18 文件/89 项、typecheck、production verify（2/2 Worklet，412558 bytes，manifest `a116e225eb4ed78ff80245228d454ab5f966e23d1f80f95d2d8579d9c894a822`）、CI dry-run、ESLint/Prettier、`git diff --check` 和 `pnpm smoke:check-core` 通过。一次仓库根定向命令因错误 cwd/既有 `.artifacts` 副本产生 13 项路径失败，正确 Mini 目录与隔离基线重跑全绿，未修改这些用户目录。checkpoint 识别消息：`fix(miniprogram): stabilize date selection and locate data`。
- 发布：代码 checkpoint `4300fbe` 已推送；精确 worktree 上传 production-profile `.68`（63 文件，manifest `a125b79350f561546e13a96098b429f839d09b399795402b9ddb764f58e77f0a`），未审核/正式发布；首次同版本调用无回执，幂等重传取得成功回执。生产备份 archive `b1c2dd02-0ec3-4bf9-9b5a-05bc35ad37ad`（54 表、162555 行、76682476 bytes，SHA-256 `a3d541646f9ef2a4776e281f94e3aa355c2ea743eb1e3f4e77e4d9b7966ab071`）后部署 release `4300fbe711de9229951265ef714d86308cf81621`；预热首次 502 后恢复，`ecs-verify.sh` 全项通过，远端临时目录已清理。最终状态 checkpoint：`docs(status): record p4 date and locate deployment`。

## 2026-08-23 P4 月历横向/高度同步过渡回归

- 反馈与引入点：`.66` 不再抖动，但 `3ed0e31` 的最终 `gridHeight` 只在 `animationfinish → monthchange → ViewModel` 后提交，导致横向动作结束后才开始纵向变化。连续 `bindtransition.dx` 方案由 `3fc41610` 引入并已证明会在回弹/回中时反向改判，因此不能直接恢复。
- 测试先行与实现：新增 `swiper change` 目标提交、方向只锁一次、回中最终高度、按钮横纵同批次以及 240ms 同曲线契约，旧实现 5 项失败。手势只在确定 current=0/2 时读取对应预取高度并锁定；程序按钮在启动横向动画的同一 patch 写目标高度；连续 change、快速重复按钮、pending 和 `duration=0` 回中均不能重写锁定目标。
- 语义审计：`this` 接收者、月份 delta、`monthchange` 调用次数、三面板回中、空值 fallback、GET/缓存、异步拒绝范围和业务写入不变；明确行为变化是高度从“横滑完成后启动 180ms”改为“目标确定时与横滑共同启动 240ms”。取消换月时只恢复中央高度，不提交月份事件。
- 验证：定向 21/21；隔离 `27d767d` + 本轮 7 文件的 Mini 18 文件/86 项、typecheck、production verify（2/2 Worklet，412303 bytes，manifest `f77c03e602f16c2811c9fbb95c7964c8a0238d5e16baf4f25eb304bc148c3420`）、CI dry-run、ESLint/Prettier、`git diff --check` 和 `pnpm smoke:check-core` 通过。主工作区的手排 contracts 并行修改造成无关 typecheck/核心门禁失败，用户文件未修改或暂存。checkpoint 识别消息：`fix(miniprogram): synchronize month height transition`。
- 发布：代码 checkpoint `53b5c74` 已推送；精确 worktree 上传 production-profile `.67`（63 文件，manifest `6506f55ef6ffe00d58219a899316e9baad5a18a8ddf76d4fbee4ea5f4cac33b3`），未审核/正式发布。生产备份 archive `06330b7b-6d49-4ce8-8587-0731ec9840f5`（54 表、162553 行、76681156 bytes，SHA-256 `749e2927195c5aa9c79a6ac8e7ba12f401984ccaabd9b715aa9d9bc6703877dc`）后部署 release `53b5c742f211b067c14ffc205c019b43271cb185`；预热首次 502 后恢复，`ecs-verify.sh` 全项通过，远端临时目录已清理。最终状态 checkpoint：`docs(status): record synchronized month transition deployment`。

## 2026-08-23 P4 8px 节奏与月历高度闪动回归

- 反馈与引入点：8px 已在中间 checkpoint `206a16e` 完成；实体微信复核表明其月高保护只加快/过滤了部分错误动作，五/六行切换时底边仍闪。`git log -S`/`git blame` 和 `git show 3fc41610^` 证明根因是 `3fc41610` 新增的滑动期 `bindtransition.dx → panelHeights → viewportHeight` 独立改高通道，横向滑动与纵向裁切动画并发。
- 测试先行与实现：改写回归契约，要求模板仅绑定最终 `gridHeight`、无 `bindtransition`，回中与程序化 shift patch 都不能包含高度；这些断言在 `206a16e` 上 4 项失败。实现完整删除 transition handler、三个面板高度、独立 viewport 和三处中间高度写入，父页只在最终月份 ViewModel 提交时计算一次 `cells.length / 7 * 54`；保留上一轮更严的 pending 回中时序，并恢复改版前 180ms height ease-out。
- 语义审计：接收者绑定、按钮/手势/定位目标、`monthchange` 调用次数、swiper duration/回中顺序、空值、GET/缓存、Promise catch 和业务写入均不变；明确行为变化只有“滑动期间不再预读相邻面板高度”，最终五/六行高度仍正确。
- 验证：定向 20/20、受控 Mini 18 文件/85 项、typecheck、production verify（2/2 Worklet，404393 bytes，manifest `0a9ee5e807606fb6341e781f1e2af72c48d57d5d705d854d7a3cfe8f7ed84773`）、CI dry-run、任务文件 ESLint/Prettier、`git diff --check` 与 `pnpm smoke:check-core` 通过；未改 Web 核心链路，无需完整 `pnpm smoke:browser`。红灯阶段命令额外误扫既有 `.artifacts` 旧副本并出现 3 项路径失败，显式排除后真实源全绿，用户目录未改。
- 发布：`206a16e` 的体验版 `.65` 和生产 release 已发布但实体结论为未解决。最终 checkpoint `3ed0e31` 已推送；精确 worktree 上传 production-profile `.66`（63 文件，manifest `e511d2d3f5cc73ced327c0d81bc97f990a7ecb81e138ae7fd5e9904f4ec08ebb`），未审核/正式发布。生产备份 archive `8b778460-7ecc-4999-b2a6-fa71a4ff5150`（54 表、162551 行、76679832 bytes，SHA-256 `90fc0f293818ebeba166d9fbf20060ca875345e9471025cb79400fb456d6bccc`）后部署 release `3ed0e31beaaf5afbf864cd63b668067aaf7fcfac`；仅 Mini/文档变化，服务器包复用上一 release 哈希一致的 Web/API/迁移产物。预热首次 502 后恢复，`ecs-verify.sh` 全项通过，远端临时目录已清理。最终状态 checkpoint：`docs(status): record single-height month deployment`。

## 2026-08-23 P4 三视图卡片节奏与事件图标回归

- 反馈与引入点：Mini 月卡到控制区只有 6px，周/列表各由自身 margin 留 12px；`git log -S`/`git blame` 定位到 `50c6d1ed`/`ad4cfb2c`。详情事件图标是 `d9296df` 新增的 13px 圆形伪元素拼图。生产 Web 390px 实测月/周/列表均为控制区底 144px→首卡顶 158px，即统一 14px；Web History SVG 实测 16×16。
- 测试先行与实现：旧实现共享 14px 节奏与 Web History SVG 两项断言全部失败；修复后由 `.workbench-view-anchor` 单点提供 14px `border-box` 上内边距，删除月特例和周/列表 margin。事件入口改用同路径 `web-history.svg`，删除 `::before`/`::after` 手绘。三视图内部按内容自然高度、选中详情 12px 间距、列表内层滚动均保持。
- 语义审计：只调整布局几何与图标载体；日历读取、缓存、筛选、swiper/定位、详情入口 `handleUnavailable`、Promise/错误路径和调用次数不变，无 API 或业务写入。
- 验证：定向 13/13、受控 Mini 18 文件/84 项、typecheck、production verify（2/2 Worklet，405458 bytes，manifest `108f9d0126dd21419839843469ef9e437fb197f727f6f1ea8d9ae30c7162b2b6`）与 CI dry-run 通过。运行/浏览器验证：生产 Web 390px 三视图间距均为 14px、History SVG 为 16×16，未触发业务写入且视口已恢复；未改 Web 核心链路，无需完整 `pnpm smoke:browser`。
- 行为变化清单：月/周/列表首卡统一离控制区 14px；事件记录图标从不稳定的 13px 伪元素拼图改为标准 16px SVG；其余布局和事件不变。checkpoint 识别消息：`fix(miniprogram): unify p4 card rhythm and event icon`。
- 发布：代码 checkpoint `48f2dc4` 已推送；production-profile 体验版 `0.1.0-p4.20260823.64` 上传成功，63 个平台代码文件，manifest `d0e29cdd27c41350caef2d17aaa863e4eab284cc20f2e8ffa3fbc34c4afe1fe2`，未审核/正式发布。生产备份 archive `b5b27a9a-a5e8-48a7-93f3-75656c4e460a`（54 表、162548 行、76677848 bytes，SHA-256 `5cf166bd6bf1d0203d94f196474f2cc0d69027cdc3bcb1d8ddbc54bae63a4ad9`）后部署 release `48f2dc47101eb17ae36343c1374379339d17225a`；预热首次 502 后恢复，`ecs-verify.sh` 全项通过，公网健康 200，远端临时目录已清理。最终状态 checkpoint：`docs(status): record p4 card rhythm deployment`。

## 2026-08-23 P4 月历摘要、标识位置与按压反馈回归

- 反馈与引入点：实体截图显示 Mini 多出 Web 没有的月份/24 小时缓存摘要，月格变更标识绝对定位在右下角，导航蓝色按压框松手后停留过久。`git log -S`/`git blame` 定位摘要到 `ad4cfb2c`，人名/绝对定位标识和月导航到 `1f715c96`，周/列表入口来自 P4 工作台提交；生产 `MonthGrid.vue`/`DutyCell.vue` 390px 实测姓名与标识同一 flex 行、纵坐标一致、间距 2px。
- 测试先行与实现：旧实现摘要、月格同行与 60ms 按压停留 3 项断言全部失败；修复后删除摘要并把滚动锚点移到视图控制器，月格以人员行顺序渲染姓名和 13px 标识，月/周/列表 9 个换期/定位按钮统一按下即显示、松手后 60ms 释放。Web 周视图有意把班种/变更放第二行，Mini 列表本就在人名后，故两者保持不变。
- 语义审计：只删除冗余文案/样式、重排同一只读 `person`/`marker` 数据和配置微信 hover 时长；GET、24 小时缓存、手机号脱敏、Promise/错误路径、筛选、swiper/定位事件、图标动画与调用次数不变。
- 验证：定向 11/11、受控 Mini 18 文件/82 项、typecheck、production verify（2/2 Worklet，405117 bytes，manifest `d9df7f147907e9c1a980c4537375a93d7c79c1bb460367890c786f390eabb4c3`）、CI dry-run、任务文件 ESLint/Prettier、`git diff --check` 与 `pnpm smoke:check-core` 通过。运行/浏览器验证：生产 Web 390×844 只读确认无摘要行及姓名后标识几何，未触发业务写入且已恢复视口；未改 Web 核心链路，无需完整 `pnpm smoke:browser`。一次根目录 Mini 测试仅因错误 `process.cwd()`/既有 `runtime` 副本出现 11 项路径失败，正确工作目录重跑全绿。
- 行为变化清单：顶部减少一条 40px 摘要；月格标识从右下绝对定位改为姓名后 2px；导航蓝底释放从微信默认停留缩短到 60ms，图标动画不变。checkpoint 识别消息：`fix(miniprogram): align p4 calendar markers and feedback`。
- 发布：代码 checkpoint `6525b1f` 已推送；production-profile 体验版 `0.1.0-p4.20260823.63` 上传成功，63 个平台代码文件，manifest `5e3ed404933e88ca0573b1361c3e406cb435d74279989a2aa84c4be4912db2ae`，未审核/正式发布。生产备份 archive `25dca2ba-3df0-408d-b856-b1f722bcdd38`（54 表、162546 行、76676524 bytes，SHA-256 `e301dd0aae0459f2f4d2129ab648e9b1eab68f459e3dee948b46bc5bba8a0adf`）后部署 release `6525b1f318685baa8256f727f5a9ccc006dd832d`；预热首次 502 后恢复，`ecs-verify.sh` 全项通过，公网健康 200，远端临时目录已清理。最终状态 checkpoint：`docs(status): record p4 marker feedback deployment`。

## 2026-08-23 P4 原生控件滚动、列表裁切与详情同构回归

- 反馈与引入点：实体截图证明 Mini 月/周的视图筛选行被错误 sticky 并覆盖日历；用户进一步明确列表问题是月份工具栏下沿阴影本身应删除；选中日期仍使用旧扁平摘要。`git log -S`/`git blame` 定位 sticky 到 `3fc41610`，inline top、列表内滚动与工具栏阴影到 `50c6d1ed`，旧详情模型/模板到 `ad4cfb2c`/`733e3af6`。
- 测试先行与实现：旧实现结构回归先后 2 项、阴影 1 项和详情标识口径 1 项失败；修复后 `.view-controls` 回普通文档流，列表由既有外层禁滚/内层滚动保持控制区固定；列表 toolbar 删除 box-shadow，只留边框/圆角/固定间距和 swiper 背景裁切。详情按生产 `SelectedDateDutyDetails.vue` 改为班种分组卡，补班种缩写/时间、成员/岗位、已排班/有变更/待安排、短号优先的电话展开、Web 的“替 / 请假替班”、其他变更说明与事件入口视觉；空态文案和日期/班种计数同步 Web。
- 语义审计：没有改 API、鉴权、缓存 TTL、请求接收者、异步错误范围或 GET 次数；分组与筛选均为纯本地 ViewModel。完整手机号仍在缓存前删除，电话动作继续调用 `wx.makePhoneCall`；事件记录仍在 P9，当前仅沿既有 `handleUnavailable` 显示阶段提示，不伪造业务数据。
- 验证：定向 8/8、受控 Mini 18 文件/79 项、typecheck、source/package audit、determinism、production verify（2/2 Worklet，405150 bytes，manifest `460c9c17dd514e03b08c0e2d0c74558bb915acc93ebb031554d487d42504cfff`）、CI dry-run、任务文件 ESLint/Prettier、`git diff --check` 与 `pnpm smoke:check-core` 通过。完整测试显式排除仓库既有的忽略目录 `.artifacts/ecs-runner-deploy-*`（其中含不完整旧源码副本），未删除或改动该既有产物。
- 运行/浏览器验证：生产域名 390×844 只读对照显示 Web 详情为“选中日期/班种数—班种卡—成员/岗位—电话/状态—事件记录”层级；浏览器提示弹层只取消、未提交数据，视口已恢复。未触及 Web 核心链路，无需完整 `pnpm smoke:browser`；原生最终视觉仍待用户体验版确认。
- 行为变化清单：月/周不再固定视图筛选行；列表控制区仍固定并删除下沿阴影；详情按班种而非 assignment 数计数并分组；日期删除中点；电话面板本地展开；事件入口仅阶段提示。checkpoint 识别消息：`fix(miniprogram): match p4 selected duty details`。
- 发布：代码 checkpoint `d9296df` 已推送；production-profile 体验版 `0.1.0-p4.20260823.62` 上传成功，63 个平台代码文件，manifest `4922f360416b9f0feed545c1f80ef5bb200557378cd0fc8e7c5642d3ecb0f4b9`，未审核/正式发布。生产备份 archive `61a0df40-43fb-4f9d-af77-20032bbc2385`（54 表、162544 行、76675204 bytes，SHA-256 `38064443aaf02cf46db2e1f9873eceb076f9bc0c92b333278dbfccadcde5b16f`）后部署 release `d9296df06b3579210cf9b50557cc1be81073ca41`，容器预热首次 502 后自动恢复，`ecs-verify.sh` 全项通过。首次远端调用误用相对产物路径，在哈希预检处停止、未解压或迁移；改用同一临时目录的绝对路径后发布成功。

## 2026-08-23 P4 安全区、筛选层与周/列表内容回归

- 反馈与引入点：实体截图证明 Mini 月历顶部/沉浸式状态栏遮挡、筛选下拉撑高 sheet、三视图按压态不一致、周/列表内容与 Web 不同以及列表外层滚动。`git log -S`/`git blame` 定位到 `733e3af6`、`3fc41610`、`ad4cfb2` 和 `1f715c96` 的对应调用点。
- 测试先行与实现：安全区/筛选/周列表结构回归旧实现 3 项失败；修复后以微信状态栏和胶囊几何计算顶栏，月历锚点留白，468px 筛选 sheet 的下拉改为按上下空间展开的覆盖层；周格补成员/班种/变更标记，列表改 Web 同构日期卡与内层平滑滚动，固定全部工具栏并删除说明文字。
- 语义审计：API 请求、request serial、离线 catch、筛选条件与身份/排班写入次数不变；新增的可拨号入口只在日历读模型已提供完整号码或短号时显示，离线缓存仍删除完整手机号。变化属于明确的 P4 视觉/交互修复，不是隐式重构。
- 验证：定向 8/8、受控 Mini 18 文件/79 项、typecheck、ESLint、Prettier、production verify（2/2 Worklet，386770 bytes，manifest `b45d0c7d6123a2c9e3d62410db973da924c542dd2db7db3931f113d92246c093`）、CI dry-run、`git diff --check` 和 `pnpm smoke:check-core` 通过。运行/浏览器验证：生产 Web 390px 只读对照周格、列表卡、筛选弹层和操作图标完成，浏览器视口已恢复；未改 Web 核心链路，无需完整 `pnpm smoke:browser`。
- 发布：checkpoint `50c6d1e` 已推送；production-profile 体验版 `0.1.0-p4.20260823.61` 上传成功（63 个平台代码文件，manifest `7ececb7ce5c30bc05246f4b90b65980e627ed35c3a2f17847438264a69e7fd45`），未审核/正式发布。生产备份 archive `dca6bce8-9453-4a8e-98c3-931570e4f173`（54 表、162542 行、76673880 bytes，SHA-256 `dd327717cfeba57e9fe59a7e60a6c9248a777a3e33c8b8893e8c0aa7976e3521`）后部署 release `50c6d1edc966b3c029d6b4e825f7fcb86d5d8f21`，预热首次 502 自动恢复，`ecs-verify.sh` 全项通过，临时目录已清理。
- 状态：已完成（含运行验证、体验上传和生产发布）→待实体 Android/微信复核；最终状态 checkpoint 识别消息 `docs(status): record p4 native detail deployment`，用户确认前不进入 P5。

## 2026-08-23 P4 空月、滑动层级与移动图标回归

- 反馈与引入点：Mini 无排班月份整页空态、展开式筛选、周标题缺周序和三面板复位反跳由 `733e3af6` 引入；五/六行月高只在滑动完成后变化的过渡来自 `4b33274e`；Web 列表定位时工具栏未固定来自 `38611902`，月格隐藏相邻月值班姓名来自 `abd20d2`/`ab25064`。以上调用点均执行 `git log -S` 与 `git blame`。
- 测试先行：Mini 新增折叠筛选、周序/日期格式、连续月历和滑动高度契约，Web 新增相邻月姓名、固定工具栏和当前月列表隔离断言；旧实现先失败，修复后 Mini 18 文件/79 项、Web 日历 14 文件/76 项通过。
- Mini 修复：空月份保留日历、换期和定位；筛选用三个折叠下拉按需展开；月历在 `bindtransition.dx` 起始阶段按方向提前过渡到相邻面板高度，蓝色选择框由格内绝对伪元素绘制；周标题统一为周序加完整日期范围；周/列表滑动结算一次性切换逻辑期和三面板，取消二次复位造成的反跳。月/列表只保留当前前后二月资源并聚合建模，相邻月姓名首帧可用且内存不会随连续翻月增长。
- 图标与动效：定位、换期、筛选、铃铛、我的、日历和底部入口改用生产 Web 的 24×24 viewBox、2px 圆头路径；微信小程序不依赖 SVG DOM/SMIL 动画，静态路径按角色拆层后由 WXSS keyframes 驱动，因此保留 Web 几何并实现日历勾选、请假减号、换班箭头和值班/更多的局部运动。
- Web 同步：`MonthGrid` 显示已预取的相邻月首位值班姓名；月模式预取前后二月以避免延迟；列表只读取当前月 assignment，防止五个月聚合后跨月混入。列表滚动顶部偏移包含工作台页头、月/周/列表工具栏和筛选栏，两个工具栏使用同一 sticky 层级。
- 语义等价审计：API 成员调用和接收者未改；异步拒绝仍由原 request serial/cache catch 处理，离线条目继续按原语义重试；空值从“无 assignment 即全局 empty”改为保留 ready/offline 月历是明确修复。只读 GET 的预取窗口由三个月扩大为五个月并复用内存缓存；筛选、身份、权限和业务写入次数均不变。
- 运行验证：Mini/Web typecheck、Mini production verify（2/2 Worklet，370126 bytes，manifest `8d3fb688176fb370f6660a51236f8cdc90d1f42c9726a0d3f86d443bfc8e72e0`）、Mini production build（112 文件）、Web production build、任务文件 Prettier 通过；Web build 仅有既有大 chunk warning。
- 运行/浏览器验证：390×844 当前 Web 源码实测月视图相邻月姓名首屏存在、底行蓝框完整、无横向溢出；列表严格为 8 月 1–31 日共 31 项，定位后 `scrollY=2466`，月/周/列表工具栏固定于 68–130px、筛选栏固定于 130–216px，目标行平滑滚至可见区域，console error/warning 为 0。`pnpm smoke:browser` 指向本地 6012 时在管理员工作台因本地既有 `/calendar-preferences` 返回 500 停止；该 API/偏好链路不在本轮 diff，定向 UI 浏览器验证已通过。
- 行为变化清单：保留空月导航；折叠筛选；Web 路径图标与分层动效；底行选择框层级；拖动期月高同步；周序/日期格式；取消反跳；列表固定控制条；相邻月姓名无延迟及 Web 同步。checkpoint 识别消息：`fix(calendar): stabilize p4 mobile navigation`。
- 发布：代码 checkpoint `3fc4161`（`fix(calendar): stabilize p4 mobile navigation`）已推送；production-profile 体验版 `0.1.0-p4.20260823.60` 上传成功，63 个代码文件，manifest `c937f97a8127147a9b0b9977ba683e1b1d19332ed7afac544f049c436b9d51dd`，未审核/正式发布。代码发布前加密备份 archive `3421dc2d-4581-4132-a259-8db5bdc3f88f`（54 表、162537 行、76671592 bytes，SHA-256 `5ed33819c65d26c93ac97e4037287a0fb7fd6d91951a648a4f133c3e3f7846e6`）后部署 release `3fc41610c2e52eb09a98a674dcd77b398d0ca82f`，`ecs-verify.sh` 全项通过。
- 正式域名复核：390px 月历上下月姓名均在首屏数据中；列表严格为 `2026-08-01` 至 `2026-08-31` 共 31 条。点击定位后 `scrollY=2703`，月/周/列表工具栏固定于 68–130px、列表工具栏固定于 130–216px，今天行位于 433–556px；横向溢出为 0，未触发业务写入。
- 状态：已完成（含运行验证、体验上传、生产发布和正式域名只读复核）→待实体 Android/微信复核；用户确认前不进入 P5。最终状态 checkpoint 识别消息为 `docs(status): record p4 calendar stabilization release`。

## 2026-08-23 P4 生产 Web 动效与筛选对齐

- 反馈：月份刷新行约 200ms 仍造成整页上下抖动；周/列表和定位硬跳；筛选不是生产 Web 弹层；顶部群组切换及定位、筛选、换期、顶部/底部导航图标和动效不一致。
- 引入点审计：`git log -S 'refresh-indicator'`/`git blame` 定位到 `9cdd0a8`；周/列表 `touchend` 后直接 `shiftWeek`/`shiftListMonth` 同样来自 `9cdd0a8`；内嵌三选一筛选和卡片式顶部群组入口来自 `ad4cfb2`。生产 Web 以 `HomeView`/`GroupSwitcher`/`CalendarView`/`ResponsiveSheet`/`LucideMinimalActionIcon`/`WorkbenchNavIcon` 为对照。
- 修正：移除已有数据刷新占位行；月/周/列表预取并绘制前中后三面板，周/列表切换改用原生 `swiper`，按钮、手势和定位共用动画路径；月切换先用预取数据即时重建再后台刷新。筛选改为底部 sheet，覆盖变更、岗位、班种、成员多选与清除/应用。顶部改成紧凑群组上下文和通知/我的动作，图标全部用原生 WXML/WXSS 几何及 keyframes 重绘；月历边界改为单一 1px，周选择态保留卡片底角。
- 语义审计：不改 API、鉴权、缓存 TTL 或 P4 只读边界；异步仍由 `requestSerial` 丢弃旧响应，月份/周/列表切换不会增加写入；筛选调用次数保持纯本地重建，只有换期/换群触发网络读取；跨群组清空旧筛选 ID。小程序不能直接继承 Vue 组件中的 SVG DOM 动画，采用原生分层节点复刻几何和局部运动，不依赖第三方 UI。
- 验证：测试先失败后通过；受控 Mini 18 文件/78 项、typecheck、verify、source/package/determinism 与 `pnpm smoke:check-core` 通过。运行/浏览器验证：浏览器读取 390×844 P4 黄金稿并核对生产 Web 源；本轮不改 Web 核心链路，`pnpm smoke:browser` 非强制。最终视觉状态必须由微信实体运行时复核。
- 发布：代码 checkpoint `733e3af6`（`fix(miniprogram): align p4 workbench with web motion`）已推送；production-profile 体验版 `0.1.0-p4.20260823.59` 上传成功，63 个平台代码文件，manifest `90c9d5940495558be06dadec6d29d8baaa3599e48e066180e3b2ae343bed014d`，未审核/正式发布。生产备份 archive `cf55e8db-431b-4400-9f0e-addf34e72a7a`（54 表、162176 行、76554532 bytes，SHA-256 `f508cb8ef649c1f53cd6176f65554626bd6534d48ff64e05dbbf7c8d4c9f6866`）后部署 release `733e3af67969e29aec6dcc943b571288c33e8549`，`ecs-verify.sh` 全项通过。
- 状态：已完成（含运行验证、体验上传和生产发布）→待实体 Android/微信复核；用户确认前不进入 P5。最终状态 checkpoint 识别消息 `docs(status): record p4 web-motion deployment`。

## 2026-08-23 P3 已有账号绑定遗留微信身份修复

- 反馈：体验版微信登录已成功；选择“绑定既有账号”输入 D0796 和密码后提示“身份状态发生变化”，而“第一次使用”可以在排班台前完成。
- 定位：生产只读检查确认 D0796 是正常密码账号；当前微信 identity 先指向历史迁移遗留的 active 空壳用户。原 `linkPassword` 在 `identity.existingUserId !== account.userId` 时直接返回 `CONFLICT`，引入点为 `2fc9c164`。
- 测试先行与实现：新增空壳无资料、首次使用后已有同名资料、资料姓名不匹配拒绝三条回归路径；通过后才实现受严格不变量保护的原子 rehome。来源存在密码、群组/群主、解绑记录、UnionID、多个 identity 或不同资料时不迁移，link token 保持 pending。
- 验证：API 微信认证集成测试 25/25、API typecheck、`git diff --check` 通过；本轮只改 API 与测试/文档，未触及 Web 核心链路，不运行浏览器 smoke；小程序体验版 56 无需重新上传。
- 发布：代码 checkpoint `7d454a5` 已推送并部署到 production release `7d454a5571cb996abf0ee2af57230d16d696267c`；代码发布前备份 archive `1a955aa1-0a8e-46a7-bc3f-c2db353b6213`，`ecs-verify.sh` 通过。身份迁移前再次备份 archive `2110eaaa-ecee-498a-b1e2-d4d3ba09db72`，D0796 线上已绑定当前微信 identity，来源空壳用户软删除并写入迁移审计；小程序体验版 `0.1.0-p3.20260823.56` 无需重新上传。
- 状态：已完成（含代码发布、线上身份迁移和核验）→待人工原生复核；用户重新登录体验版 56 应直接进入 D0796 对应排班台。

## 2026-08-23 P3 Mini production 默认 profile 固化

- 引入点：`git log -S 'upload-experience --profile=staging'`/`git blame` 确认默认 staging 由 `3884713b` 初始化；用户已决定不补建 staging，体验版与正式版统一使用 production API。
- 实现：默认 build、preview、verify、determinism、CI dry-run 和 experience upload 命令改为 production；保留显式 `build:staging`，不增加运行时切换。新增 profile 默认回归测试，旧配置 2/2 失败后转为 2/2 通过。
- 验证：受控 Mini 17 文件/71 项、typecheck、production verify（2/2 Worklet，203145 bytes）和 `git diff --check` 通过；主工作区既有 `.artifacts/ecs-runner-deploy-*` 副本误扫导致的 17 项失败已排除并单独记录，未修改该目录。
- 发布：代码 checkpoint `8927eae` 已推送；默认 `upload:experience` 成功上传 production-profile 体验版 `0.1.0-p3.20260823.56`，60 个代码文件，manifest `8e0455060cac0c61159c3955e5f7bb76db5a7af47bc8c8a7369d87675fd9480c`；未审核/正式发布。
- 状态：已完成（含运行验证）→待人工原生复核；等待用户在体验版复核微信登录及完整 P3 身份流程。
- checkpoint 识别消息：`fix(miniprogram): default experience builds to production`。

## 2026-08-23 P3 Mini 生产 API 体验版联通修复

- 根因：体验版 `0.1.0-p3.20260823.53` 使用 staging profile；`wx.login` 成功后请求 `/auth/wechat/login` 时，staging 域名 HTTPS 不可达，因此客户端显示“网络连接失败”。当前 2G ECS 只有 production 服务，没有 staging 服务或域名配置。
- 用户决策：不补建独立 staging；体验版与正式版均使用 production profile，测试身份绑定/建档允许写入 production；不增加运行时环境切换。
- 验证：production API `/api/health` 返回 200；Mini production typecheck 与 `node scripts/verify.mjs --profile=production` 通过（2/2 Worklet，203145 bytes）；未运行 `pnpm smoke:browser`，本轮仅 Mini profile/上传链路。
- 发布：`HEAD` `041a7424` 的 production profile 体验版 `0.1.0-p3.20260823.55` 已由本地 Node `miniprogram-ci` 成功上传，60 个代码文件，manifest `65bbb71f9b285d20de57f91e24e96ebd931d61118d7065dc64fa86c73b5a2ddd`；未审核/正式发布。
- 状态：已实现待浏览器/原生复核；等待用户在体验版复核微信登录及完整 P3 身份流程。
- checkpoint 识别消息：`docs(status): record production-profile mini experience`。

## 2026-08-23 P3 Mini 默认身份入口修正

- 反馈：冷启动没有看到登录入口。原因是 `app.json` 仍以 P1 `pages/index/index` 为第一项，P3 `pages/identity/index` 只是已注册但不会默认打开。
- 引入点审计：`git log -S 'pages/index/index'`/`git blame` 定位 P1 首路由来自 `3884713b`/`2d51e222`；本轮只重排既有路由并更新静态期望，不改身份页面逻辑、公共 API、ECS 或上传凭证。
- 验证：定向 6/6、受控全套 16 文件/69 项、typecheck、staging build、verify（2/2 Worklet，203180 bytes，manifest `f1715957936d60ccbe911acf28f923788ea2c6f53b5a10bd7ece9012b37bc4e8`）、source/package audit、determinism、官方 CI dry-run 和 `git diff --check` 通过。
- 运行/浏览器验证：`node scripts/smoke-browser.mjs` 因本机 `localhost:5173` 无服务先得到 `ERR_CONNECTION_REFUSED`；尝试直接启动 Vite 仍被系统 `EACCES` 拒绝监听 `::1:5173`，未进入浏览器产品断言。本轮无 Web 代码变化。
- 发布：checkpoint `984695ac` 已推送；公网 IPv4 `103.54.154.21` 与白名单一致。从精确干净 worktree 使用仓库外私钥、本地 Node `miniprogram-ci` 上传体验版 `0.1.0-p3.20260823.53`（60 个平台代码文件，上传 manifest `7befc46d5b5bae0bbd5b189047d01ae5963e3c3d6aa1ccbe86e68d6937c433d4`），未审核/正式发布。正确生产 ECS `120.77.220.79` 的备份 archive `6d1c0b1f-1bc8-46df-bd46-e5821a8e9723`（54 表、161508 行、76329196 bytes，SHA-256 `d717001dcebf8e0783d3339e43cbe4e73159d58c65a84d6eed3e5da3f12ed361`）后部署 release `984695ac13eff7e58258c4a549b0a506eb650d41`；`ecs-verify.sh` 通过，临时目录已删除，Git/远端/服务器 release 一致。未使用 ECS 上传小程序。
- 状态：等待用户在微信开发者工具/实体 Android 冷启动确认登录入口及完整 P3 身份流程。
- checkpoint 识别消息：`fix(miniprogram): open identity page by default`。

## 2026-08-23 P3 原生解绑页面切片

- 实现：新增 `pages/identity/unbind`，fresh `wx.login` + `/me/wechat/miniprogram/unbind` + 页面级 Idempotency-Key；不删除 Web 账号、资料或排班。
- 验证：Mini 定向 6 项、受控 16 文件/69 项、typecheck、verify（2/2 Worklet，207146 bytes，manifest `a83fbdd9cb177fc8e14f14984d55726f16a1a18c2a402b5c85818ece7fceccdb`）和 CI dry-run 通过。
- 发布：checkpoint `9b7ffbe` 已推送；本地 Node `miniprogram-ci` 上传体验版 `0.1.0-p3.20260823.52`（60 文件，manifest `931fc9eb526bb111265b61fc4dcbee93038dc26a10123dd217f882e0d9693c3d`），生产备份 `495bb52d-2890-4c0d-af62-1b06738712ed` 后部署 release `9b7ffbef8b152a31ba675a2a36f5c3e788a058b3`，`ecs-verify` 通过。
- 状态：已实现待人工原生复核；等待 P3 完整反馈。
- checkpoint 识别消息：`feat(miniprogram): add p3 native unbind page`。

## 2026-08-23 P3 解绑确认视觉黄金状态

- 实现：Storybook 新增 Mini 当前 AppID 解绑确认和 320px 边界；危险操作只移除微信身份，不删除 Web 账号、资料或排班。
- 验证：clean Storybook build、P3 source Vitest 4/4、390/320 浏览器几何自检通过，无横向溢出。
- 发布：checkpoint `89b7bdc` 已推送；备份 `0a29cff1-5b32-48e2-96b9-822084e82d8e` 后部署 release `89b7bdc5b7c36b1b5dbacf182aff89cbf261e809`，`ecs-verify` 通过。
- 状态：未实现原生解绑页面；本轮验证后暂停等待用户视觉确认。
- checkpoint 识别消息：`feat(miniprogram): add p3 unbind visual golden`。

## 2026-08-22 P3 Web 身份生产接线

- 实现：Web 登录去除公开注册入口；API `/auth/password/register` 关闭并返回 403；新增平台账号生产页面与 `ApiClient` 的账号列表、用户名分配、管理员绑定链接方法。
- 验证：API auth route 3 项、Web client 155 项、Web typecheck、root lint 通过。
- 运行/浏览器验证：`pnpm smoke:check-core` 通过；`pnpm smoke:browser` 的 Node 监听在 5173/5174 被系统 `EACCES` 阻断。clean static build 用 `SMOKE_BASE_URL=http://127.0.0.1:6008` 复核到登录页：横向布局、关闭公开注册和键盘焦点通过，随后因 production build 没有本地开发身份按钮停止。
- 修正：同步 smoke 旧 `.auth-mode-switch` 选择器到仅登录语义，并为登录/访客按钮补 3px focus-visible 描边。
- 发布：代码 checkpoint `02a508d` 与修正 `b9a5382` 已推送；生产备份 `0e062719-9a52-4367-8624-2b0f8fc315a2` 后部署 release `b9a538240e7148913cb4dd933b93395b05c5a05d`，`ecs-verify` 通过。Web 公开注册关闭，平台账号页面已接线。
- checkpoint 识别消息：`fix(web): align p3 smoke with closed registration`；当前等待 Mini 原生复核。

## 2026-08-22 P3 原生身份页面首个切片

- 实现：新增 `pages/identity/index` 和 `pages/admin-bind/preview`，覆盖微信登录、未知微信 `link_required`、既有账号密码绑定、真实姓名建档、管理员 ticket 脱敏预览和 fresh-code confirm；API 客户端无 Zod/Node/DOM/fetch，不触碰 P4 工作台。
- 验证：Mini typecheck/build、source audit、受控 16 文件/68 项、verify（2/2 Worklet，196458 bytes，manifest `abaf0bb1aede3a6fea714c7419c28815b2d45cc83d477e9f1e3c85901147f18b`）和 CI dry-run 通过。默认 test 对用户自有 `.artifacts/ecs-runner-deploy-*` 产生 17 项旧副本失败，排除后全绿。
- 发布：checkpoint `e69cfb7` 已推送；本地 Node `miniprogram-ci` 上传体验版 `0.1.0-p3.20260822.50`（57 文件，manifest `edbb1ffa99ab1ce6b0f2d8d40eac92e0291effdabb9ea1c146d5a09189088854`），未审核/正式发布。生产备份 `99b3dc26-a266-45f6-aac7-ce7b06574d3b` 后部署 release `e69cfb76ea0d5587a993b5c817f010606cdbb0d3`，`ecs-verify` 与生产身份不变量通过。
- 状态：已实现待人工原生复核；等待微信开发者工具/实体 Android 反馈。
- checkpoint 识别消息：`feat(miniprogram): add p3 native identity pages`。

## 2026-08-22 P3 身份安全视觉黄金稿

- 实现：新增 `P3IdentitySecurityPreview` Storybook 黄金稿及 9 个 Web/Mini 身份状态，保持 Web 无公开注册、平台账号不暴露密码、Mini 管理员 ticket 脱敏与 10 分钟边界；未改生产页面、Mini 页面或 API。
- 设计：使用现有 UI token 和医护工作台蓝白语义；Web 为身份确认台，Mini 为身份步骤流，进度线表达微信身份→账号证明→进入排班。
- 验证：clean worktree 完整 build、Web `vue-tsc`、定向 ESLint、源级 Vitest 4/4、Storybook build 通过；真实静态 Storybook 浏览器检查覆盖 Web 登录/平台账号与 Mini 390/320 身份状态，所有页面无横向溢出或 page error。Web 登录只有 Python 静态服务器 `/favicon.ico` 404。
- 预览：`http://127.0.0.1:6007/?path=/story/miniprogram-parity-p3-identity-security--mini-login-390`；截图保存在仓库外临时目录 `C:\Users\eylin\AppData\Local\Temp\p3-identity-screens`，未进入 Git。
- checkpoint 识别消息：`fix(miniprogram): stabilize p3 visual guard`；当前状态已完成 → 待用户人工视觉确认。

## 2026-08-22 P3-G 管理员 URL Link ticket 与 Mini admin-bind

- 实现：管理员 ticket 只存 hash、当前 AppID、target、pending/consumed/expiry；URL Link 只携带 ticket，服务端 10 分钟过期。preview 只返回 masked preview；confirm 以新 Mini code 在同一 ticket 事务内完成 current-AppID identity/Union 绑定、审计、session 签发和单次消费。
- 验证：contracts/0047/schema/package 19 项，真实 admin-bind 4、P3-E/F 15、migration/client 21 项，受控非 integration 155 文件/855 项和 Mini 15/63 全部门禁通过；精确 clean worktree 的 frozen install、root build/typecheck/lint 通过。Windows clean worktree 的 `format:check` 受全仓 CRLF 基线影响，未修改基线文件。无 UI 变化。`pnpm smoke:browser` 仍在 5173 第 1/6 步 `ERR_CONNECTION_REFUSED`；`pnpm smoke:check-core` 已通过。
- 发布：代码 checkpoint `668103c` 已推送；备份 `5d02a3cb-5eb3-41f7-8572-3a1bdfcfd7f3`（53 表、161465 行、76308616 bytes，SHA-256 `0f83718e5bd0987502a0877ae91e656e8b07c510f814140d674c44d9d7cec43c`）后部署 release `668103c2b6aabd72493f20c9a61f9c327e9c0d3a`。其后并行 Web 目录子提交 `99f222d` 进入生产但未改动 P3-G；最终 release `99f222d1ac4a0d83d4ab970fae3a0db845cbd4a1` 重跑 `ecs-verify.sh` 通过 47 migrations/54 业务表，identity/detachment/link/Union/admin-ticket 均 0。无 Mini runtime 变化，本轮未上传体验版。
- checkpoint 识别消息：`feat(auth): add admin mini binding ticket`；当前停止于页面人工视觉确认前。

## 2026-08-22 P3-F 管理员账号状态与 password/code proof

- 实现：平台管理员列表仅暴露脱敏账号状态；用户名分配可创建 nullable credential 并补 password locator；`PUT /me/password` 严格互斥支持 currentPassword/WeChat code proof，成功更新 hash、authVersion/version和审计，旧 token 失效。
- 验证：contracts 7 项、真实 MySQL 5 项、root build/typecheck/lint、受控非 integration 154 文件/851 项、Mini 15 文件/63 项与全部包门禁通过。既有 platform-admin integration 9/10，唯一失败是固定 contact UUID 的历史 backup fixture。
- 运行/浏览器验证：`pnpm smoke:browser` 在 5173 未启动时第 1/6 步 `ERR_CONNECTION_REFUSED`；无视觉变化。checkpoint 识别消息：`feat(auth): require admin password proof`。
- 发布与核验：checkpoint `0225e0e` 已推送；备份 `2e4b0172-0fcd-4df6-8510-6e001f705a60`（53 表、161459 行、76304648 bytes，SHA-256 `9b0ffc05d9643ecd7c83c55d1bdcab54d0d1e02a318e042f977b066be0cf65c0`）后部署 release `0225e0e79ae9838fe8c27dcb01a7808bea9ec98e`，`ecs-verify.sh` 通过，公网 health 200；生产身份/link/detachment/Union 仍 0，密码聚合不变。最终状态 checkpoint：`docs(status): record admin password proof deployment`。
- 文档 release：状态 checkpoint `8d78e4f` 已推送；第二次备份 archive `f83bd33a-4975-44f6-8847-771411879945`（53 表、161460 行、76305972 bytes，SHA-256 `c630e09d0d92caedbf6416e221ebca15f16bc80acf706f9f4ff91863081e9efb`）后部署 release `8d78e4fe8f9d4c1a4add658b436bca80c2ec6f94`，`ecs-verify.sh` 与公网 health 200 通过，Git/服务器 release 已对齐。

## 2026-08-22 P3-E 当前 Mini AppID 解绑

- 红灯与设计：新增 contracts/0046/schema 先在旧实现 3 项失败；5 个路由场景先返回 404。只删当前 Mini identity 会被 Union resolver 自动回挂，因此增加仅存 subject hash 的 detachment marker，并在 resolver 默认拒绝、显式密码重绑时原子清除。
- 实现：用户 fresh code + password prerequisite 与平台管理员 reason + password prerequisite 共用 current-AppID scoped service；Idempotency-Key 同 fingerprint replay，cross-body 409；删除 identity、清除 legacy mirror、authVersion/version、审计和 result 同事务。其他 Web/ Mini identity、Union、profile/password/群组引用不变。
- 等价与测试：`resolve()` 空 AppID 仍在开事务前拒绝；新增 `resolveInTransaction` 只改变调用方事务复用，不改变原查询顺序、receiver、错误或结果。真实 MySQL 解绑 6、既有微信 22、linkToken 4、邀请 7、迁移 19 项通过；受控非 integration 153 文件/848 项通过。平台 admin 10 项中 9 项通过，backup fixture 固定 contact UUID 的既有失败未改。
- 运行/浏览器验证：`pnpm smoke:browser` 在 5173 未启动时第 1/6 步 `ERR_CONNECTION_REFUSED`；本批无视觉变化。checkpoint 识别消息：`feat(auth): enforce current mini identity unbind`。
- 发布与核验：checkpoint `15ee912` 已推送；备份 `03d4a0f7-cefa-48c6-a835-f34d0e69e8db`（52 表、161456 行、76302488 bytes，SHA-256 `df942df399b6af301d941e99e2883cef1f50c1f762dc75582c3f4c48b602b58d`）后部署 release `15ee912f5ed3b57855fa3919c58fada218f78d00`，`ecs-verify.sh` 通过 46 migrations。未认证路由探测均 401；生产 detachment/linkToken/identity/Union 0、authVersion 全 1、密码聚合不变，未调用微信或写身份。最终状态 checkpoint：`docs(status): record current mini identity unbind deployment`。
- 文档 release：状态 checkpoint `69c34a7` 已推送；第二次备份 archive `f1ec980e-da4d-40e1-a7db-da83ea0993d4`（53 表、161457 行、76303324 bytes，SHA-256 `46de07494270bbdd324f04cea22bb195e2bc66c5cd5c662072dd58b89e679aef`）后部署 release `69c34a7f7a14617da1b93cd57ae1f55d1a728d61`；首次 TLS reset 后恢复，`ecs-verify.sh` 与公网 health 200 通过，Git/服务器 release 已对齐。

## 2026-08-22 P3-D linkToken 消费与显式建档

- 红灯与来源：contracts 新用例在旧代码 1 项失败，真实 MySQL 7 个新端点场景全部 404；登录、resolver、密码和 linkToken 来源为 `39f9c66`/`4416f79`/`de3ad5f`/`3919050`。默认 Vitest 另扫用户 `runtime/**` 副本导致迁移表竞争，显式排除后主文件红灯/绿灯可重复。
- 实现：新增严格 link-password/register contracts 与 200/201 routes。密码 proof 只接受 active、未删除、有资料和非空 hash 的账号；新微信建档创建 synthetic locator/user/profile/identity/可选 Union，不创建密码；已知无 profile identity 只补原 user。两条路径返回完整 authenticated profile/session并保留 authVersion。
- 事务与等价：resolver 原逻辑提取为可复用调用方事务的入口，原 `resolve()` 的 receiver、单事务、空 AppID 前置拒绝、查询/回调顺序、返回/错误保持。linkToken、identity/Union/legacy openid、profile、审计、session 签名和 consumed 同事务；错误 proof、篡改、过期、重放、并发、Union 冲突及缺 secret 均失败关闭并按预期回滚。
- 验证：契约/密码/Web 微信定向 5 文件/36 项；真实 MySQL identity 22、linkToken 4、邀请 7、database 19 项；受控非 integration 全仓 152 文件/845 项通过（2 文件/19 项环境跳过）。根 build/typecheck/lint、Mini 15 文件/63 项与全部静态/包门禁、任务格式/diff 通过；根 format 仍仅既有/用户所有 11 项。
- 运行/浏览器验证：`pnpm smoke:browser` 在 5173 未启动时第 1/6 步 `ERR_CONNECTION_REFUSED`；本批无视觉变化。checkpoint 识别消息：`feat(auth): complete explicit wechat linking`。
- 发布与核验：checkpoint `2fc9c16` 已推送；备份 `94ed7fdd-645e-4c0c-913d-4a911f04c018`（52 表、161454 行、76301168 bytes，SHA-256 `94afd1c97a7794dd2e8105557c659c5f443b199fe009ae927b879d6c6e40458e`）后部署 release `2fc9c164e716bea4b00c4eaf5bb32d67109cd93e`，`ecs-verify.sh` 通过。新路由空 JSON 均 400；生产 linkToken/identity/Union 0、authVersion 全 1、legacy Mini 1、密码聚合不变，未调用微信或写身份。最终状态 checkpoint：`docs(status): record explicit linking endpoints deployment`。

## 2026-08-22 P3-C 显式微信关联与无注销边界

- 红灯：Mini 判别联合、三类 link 错误、脱敏、0045 schema、link service 模块、未知不建号和注销 404 均在旧实现失败。
- 实现：未知 Mini 只返回 10 分钟 link_required 并写哈希 token，不建 user/identity/Union/audit；已知有 profile 才签 authenticated session，已知无 profile 的 token 绑定 existing user。link service 行锁单次消费并区分 invalid/used/expired；password/Web response 解耦，错误码生成到 client-core，linkToken/Union 日志脱敏。
- 无注销：删除 contract/service/route；404 回归确认 locator/status/profile/contact/audit 原样保留。公开 password register 本批不动。
- 验证：静态/contract/client 8 文件/29 项，真实 MySQL link 4、身份 14、邀请 7、无注销 1、迁移 17 项，非 DB 全仓 156 文件/854 项通过。根 build/typecheck/lint、任务格式/diff/`smoke:check-core` 通过，根 format 仅既有/用户所有 11 项。代码 checkpoint `3919050` 与修复 checkpoint `c4da389` 均已推送。
- Windows clean-worktree 回归：`3919050` 的 CRLF 检出让 Vitest 导入含 shebang 的 `visual-compare.mjs` 时语法失败；引入点为 `c8d50f5`。新增断言在旧代码先失败，删除冗余 shebang 后精确 `c4da389` clean checkout 无需修改即通过 Mini 15 文件/63 项、typecheck、verify/source/2 Worklets/package/determinism/CI dry-run（151108 bytes，manifest `365e3f6e476ad7525b91322f3a48d9bd4ec8d84ea69367425e89969024a70168`）。脚本仍由显式 `node` 调用，CLI 行为、错误路径和调用次数不变；`3919050` 产物作废。
- 运行/浏览器验证：修复后 `pnpm smoke:browser` 仍在 5173 未启动时第 1/6 步 `ERR_CONNECTION_REFUSED`；无视觉变化。修复 checkpoint 识别消息：`fix(miniprogram): keep visual comparer importable on Windows`。
- 发布与核验：公网 IPv4 两处均为 `103.54.154.21`；精确 `c4da389` 由本地 Node 上传体验版 `0.1.0-p3.20260822.49`（50 个代码文件、zip 38678 bytes，manifest `7e528f42e16972f25625028e2c6d952e5a4f989ae6ea2c5aaea6ca4b35e9c508`），未审核/正式发布。备份 `f61cbf8b-ff3c-415a-8091-3829ecd24747`（51 表、161452 行、76299680 bytes，SHA-256 `79009b0cbb89c7d5215ef4077d7e30842a4b3f13e094493dce2ecf5be6c08ccd`）后部署 release `c4da3896f40a8273b1b9d4ccbcff1f96cdf63b09`，`ecs-verify.sh` 通过 45 migrations。生产 linkToken 0、identity/Union 0、authVersion 全 1、legacy Mini 1、密码聚合不变；最终状态 checkpoint：`docs(status): record explicit wechat linking deployment`。

## 2026-08-22 P3-B 版本化会话与 AppID identity

- 红灯：claim/gateway 3 项和身份集成 5 项在旧实现失败，覆盖无版本/AppID 校验、legacy scoped 认领与跨渠道 Union 500。
- 实现：新 token 写 authVersion，Mini/Web 再写 AppID；旧 token 缺版本按 1 兼容。认证逐次校验 active/deleted/version 和 scoped identity。事务 resolver 统一 Mini/Web identity、Union account、legacy openid/null-AppID 惰性认领与冲突；AppSecret 使用 private field。邀请合并移动 identity/Union 并按目标版本重签。
- 等价：未知 Mini 仍返回原 `isNewUser` 并自动建号，contracts/路由/UI 不变；旧 password/Mini 会话、dev token、资料/群组和错误传播保持。P3-C 才切 `link_required`。
- 验证：专项 6 文件/49 项、真实 MySQL 身份 14 项+邀请 7 项、非 DB 全仓 155 文件/852 项、Mini 15 文件/62 项及全部静态/包门禁通过；根 build/typecheck/lint、任务格式/diff/`smoke:check-core` 通过，根 format 仅既有/用户所有 11 项。
- 运行/浏览器验证：`pnpm smoke:browser` 在 5173 未启动时第 1/6 步 `ERR_CONNECTION_REFUSED`；无视觉变化。checkpoint 识别消息：`feat(auth): version scoped identities`。
- 发布与核验：checkpoint `4416f79` 已推送；备份 `e4a7cee1-95ed-48b5-a7c9-50592be31aea`（51 表、161450 行、76298360 bytes，SHA-256 `d8813940663d3f939172a8bdacab6591776acbef47771623a6f79adf6a44b743`）后部署 release `4416f79be3764f510a0ef04fad56ed997e43841a`，`ecs-verify.sh` 通过。部署前后 0 identity/Union、authVersion 全 1、legacy Mini 1、password hash 摘要不变；未触发身份写。最终状态 checkpoint：`docs(status): record scoped identity deployment`。

## 2026-08-22 P3-A 加法式身份基础

- 红灯：foundation 4/4、nullable password 2/7、migration verifier 1/3 在旧实现失败；定位 identity/password/JWT 来源为 `12e7f40`/`de3ad5f`/`39f9c66`。
- 实现：migration 0044 增加 authVersion、可空 appId 过渡列、Union 一人一号表和 nullable hash；临时 CHECK 在 DDL 前阻断 locator/Union 冲突，只补 active password credential 的 null locator。null hash 登录/状态/proof 失败关闭；产品 API/UI 不变。集成 reset 补齐三张身份表清理。
- 验证：专项 14 项、真实 MySQL migration 17/17、非 DB 全仓 154 文件/848 项、Mini 15 文件/62 项及全部静态/包门禁通过；主工作区其余 integration 240 项通过。6 文件/10 项旧断言/fixture 与用户 runtime 副本失败已独立归因，不修改。根 build/typecheck/lint、任务格式/diff/`smoke:check-core` 通过，根 format 仅既有/用户所有 11 项。
- 运行/浏览器验证：`pnpm smoke:browser` 在 5173 未启动时第 1/6 步 `ERR_CONNECTION_REFUSED`；无视觉变化。checkpoint 识别消息：`feat(auth): add identity security foundation`。
- 发布与核验：checkpoint `297ec33` 已推送；迁移前备份 `e39ec634-be53-4536-891b-c729dee78aa6`（50 表、161448 行、76295676 bytes，SHA-256 `81f186d12654c15f5a93436ec7e51fe6260316c9453a9e6a60496a642e58899e`）后部署 release `297ec3356c9b7717cdb2c5f9c2326cfcfabca74c`。`ecs-verify.sh` 通过 44 migrations；生产精确补 5 个 locator、保留 9 个无凭证 null locator，24 个 hash 摘要不变，authVersion/appId/Union/nullability 全部符合门禁。最终状态 checkpoint：`docs(status): record p3 identity foundation deployment`。

## 2026-08-22 P3 身份安全预检

- 只读结论：identity 缺 appId、UnionID 直接唯一、未知 Mini 自动建号、匿名密码注册、真实注销和无版本 JWT 均与已批准 P3/ADR 冲突；引入点分别为 `12e7f40`、`39f9c66`、`de3ad5f`、`a837586`。
- 生产聚合：40 用户、24 密码身份、0 identity；5 个密码账号 locator 为 null 且有 active membership，当前登录错误拒绝；1 个无业务引用 legacy Mini stub；9 个无登录且无 active membership 的资料用户。只输出计数/配置存在性，无 PII/credential/secret。
- 顺序：P3-A 仅做 additive schema 和受限 locator backfill；之后才接 authVersion session、link-required、绑定/解绑和管理员/password proof。登录页/账号后台黄金稿为首个视觉暂停点。详细见 `apps/miniprogram/docs/architecture/p3-identity-security-preflight.md`。
- 验证：history/blame、schema/route/session 与生产聚合只读审计完成；任务格式/diff/`smoke:check-core` 通过，根 format 仅有既有/用户所有 11 项阻塞。本批无产品浏览器断言。
- 本批无代码/UI/Mini 产物变化；checkpoint 识别消息：`docs(miniprogram): record p3 identity preflight`。

## 2026-08-22 P2 共享核心完成审计

- 结论：P2 最小边界完成。Web 已先行采用 calendar/manual/publication presentation；calendar/holiday client、generated decoder 和错误语义；Mini 已复用 manual transition 与 `wx.request` JSON transport；tokens/fixtures/bundle 门禁齐全。domain runtime 只取 Zod-free metadata leaf。
- 明确延后：token/401 单飞重登到 P3/P4，幂等写/退避到 P5–P7，downloadFile/FileSystem 到 P9，迁移后新增 Web 功能到 P10；不提前扩张共享公共 API。
- 验证：P2 专项 14 文件/55 项、受控全仓 153 文件/842 项通过，32 文件/265 项跳过；Mini 15 文件/62 项与 verify/source/Worklet/package/determinism/CI dry-run 通过（147887 bytes，manifest `44e00e35fbbe675c4125484afb2f6ecb8ee7400c268afd731fb61b209dc251a8`）；任务格式/diff/`smoke:check-core` 通过，根 format 仅有既有/用户所有 11 项阻塞。默认测试误扫用户所有历史副本，显式排除后通过。
- 运行/浏览器验证：`pnpm smoke:browser` 在本机 5173 未启动时第 1/6 步 `ERR_CONNECTION_REFUSED`；本批仅阶段文档，无视觉变化。checkpoint 识别消息：`docs(miniprogram): close p2 shared core`。

## 2026-08-22 P2 scheduling-domain runtime barrel

- 引入点与红灯：`ae649b3` 为 health summary 从 contracts barrel 运行时取 `workspaceName`。bundle 守卫旧实现 1/2 失败，显示 23 个 contracts 源文件；summary 基线通过。
- 修复与等价：新增 Zod-free `@schedule/contracts/workspace-name` 子路径，domain 只改 import；health 字符串、同步调用、统计 type-only imports 和全部算法不变。修复后 runtime 仅含一个 metadata leaf，无 contracts index/Zod。
- 验证：定向 2 文件/3 项、受控全仓 153 文件/842 项通过，32 文件/265 项跳过；contracts/domain/根 build/typecheck/lint、任务格式、diff check 和 `smoke:check-core` 通过，根 format 仅有既有/用户所有 11 项阻塞。
- 运行/浏览器验证：`pnpm smoke:browser` 在本机 5173 未启动时第 1/6 步 `ERR_CONNECTION_REFUSED`；无视觉变化。checkpoint 识别消息：`refactor(domain): isolate runtime metadata`。
- 发布与核验：checkpoint `502bb85` 已推送并从精确干净 worktree 完成 production build/package；数据库备份 `d0eb57b2-e691-40c6-94f9-ddb317723dea`（50 表、161444 行、76293032 bytes，SHA-256 `8cdfebf62ed788ad401e24470ffc18cbc3f2d86a61d579eb5c5c8a27a9151aab`）后部署 release `502bb85d70b21c3a541cfdfbbdaea6ed9bb097e8`，预热首个 502 后恢复，`ecs-verify.sh` 完整通过并清理临时目录。最终状态 checkpoint 识别消息：`docs(status): record domain runtime deployment`。

## 2026-08-22 P2 Mini wx.request transport

- 红灯与范围：共享错误 API 旧实现 3/3 失败，Mini transport 因模块缺失失败；只实现月历/节假日 GET、status/auth/decode/error，不建页面、缓存、会话持久化、重登或重试。
- 实现与等价：contracts code 生成到 client-core；known/fallback/invalid/network 与 Web 逐字段等价。Mini bearer 读一次 token、public 不读，`wx.request` 成员调用一次，2xx 解码原对象，callback/sync throw 同映射；拒绝不包装重试。
- 体积与边界：三个逐文件入口的 183133-byte 中间实现未保留，合并单一 platform 入口后为 147887 bytes（+5070）。源码/产物继续无 Zod/contracts runtime、Node/DOM/fetch/Vue/数据库，无页面/WXML/WXSS/路由。
- 验证：共享/Web 4 文件/15 项、Mini 2 文件/8 项、受控全仓 152 文件/840 项通过，32 文件/265 项按环境跳过；client-core/Web/根 build/typecheck/lint 和 Mini 15 文件/62 项、verify/source/Worklet/package/determinism/CI dry-run 通过（manifest `219a4fbe51fa35bf2e64c7a06b02e542da216859568dbfcb71f4f15ccbb76144`）；任务格式、diff check、`smoke:check-core` 通过，根 format 仅有既有/用户所有 11 项阻塞。
- 运行/浏览器验证：`pnpm smoke:browser` 在本机 5173 未启动时第 1/6 步 `ERR_CONNECTION_REFUSED`；无视觉变化。checkpoint 识别消息：`feat(client): add miniprogram json transport`。
- 发布与核验：checkpoint `884512c` 已推送并通过精确干净 worktree 生成/build 门禁；体验版 `0.1.0-p2.20260822.48` 本地上传成功（50 个平台代码文件、38661 bytes，manifest `8bd158a8a7167737f696d587ed28b4749f16549c5d47ddae7a3c2e3114b8558c`），未审核、未正式发布。数据库备份 `9abd6e66-d9f8-4ea9-ba4d-9d045007d367`（50 表、161442 行、76291708 bytes，SHA-256 `d466606aa4232fe28ee23e66d1a79751db39b659b3ee4b1544c9f34440753fae`）后部署 release `884512c0a979a99b7971006f8a50e40b2ad12f03`；预热首个 502 后恢复，`ecs-verify.sh` 完整通过并清理临时目录。最终状态 checkpoint 识别消息：`docs(status): record miniprogram json transport deployment`。

## 2026-08-22 P2 client-core 月历读取边界

- 引入点与红灯：月历 `ab25064`、节假日 `48c6fdd`/`fbf59fa`、统一请求管线 `dd9981f`、fetch receiver `1c5d2c5`。Web/Mini 旧代码均因无 client-core 失败，Mini 真实边界入口追加红灯后实现。
- 实现与等价：新增 endpoint/transport/service/紧凑 decoder 和 Zod→JSON Schema 确定生成；Web 三方法委托共享 service，原 fetch/auth/offline/error 管线不动。路径编码、bearer/public、receiver、拒绝对象、调用次数、原响应身份及页面缓存/副作用保持；无重试。
- 生成与边界：生成器对未知 keyword/type 失败关闭，freshness 与 Zod 深等价通过；显式 ASCII hex 正则避免丢失 `i` flag。client-core browser bundle 与 Mini 8949-byte 输出无 Zod、contracts runtime、Node/DOM/fetch/Vue/数据库，Mini 无页面或网络。
- 验证：定向 5 文件/167 项、受控全仓 150 文件/829 项通过，32 文件/265 项按环境跳过；client-core/Web/根 build/typecheck/lint 通过。Mini 14 文件/56 项及 verify/source/Worklet/package/determinism/CI dry-run 通过（142817 bytes，manifest `fa75f52b0c78f7c14d42d1aaf5e037051326e8348adfc8e2f6f208c4268576c8`）；冻结 lockfile、任务格式、diff check 和 `smoke:check-core` 通过。根 format 仅有既有/用户所有 11 项阻塞。
- 运行/浏览器验证：`pnpm smoke:browser` 在本机 5173 未启动时第 1/6 步 `ERR_CONNECTION_REFUSED`；无模板/样式/页面变化。checkpoint 识别消息：`refactor(client): share calendar read boundary`。
- 隔离回归：`60cec6e` 推送后的精确 Windows worktree 因 CRLF/LF 原始比较误报 generated stale；未上传、未部署，生成的 release 包作废。换行测试旧实现 1/2 失败，统一 LF 后 2/2 与 check/build/typecheck/lint 通过；修正 checkpoint 识别消息：`fix(client): normalize generated schema line endings`。
- 发布与核验：修正 checkpoint `7b52ef8` 已推送并通过精确干净 worktree 门禁；体验版 `0.1.0-p2.20260822.47` 本地上传成功（50 个平台代码文件、38673 bytes，manifest `28ceb48c307f4d4ae704de6db71371e96cc7b0959e2fff061b9cb7e86750e60f`），完成后的遥测 TLS 断开不影响 exit 0 上传结果，未审核、未正式发布。数据库备份 `8a28f6c0-20ec-4c5a-99ac-1f2c1e4ded55`（50 表、161440 行、76290384 bytes，SHA-256 `28dde6c0bdd058388da04c38e6e55452f700cfc8211123f23cb97b73e854a151`）后部署 release `7b52ef8093cfcd95c7a90cfee16e1a946fd34c35`；预热首个 502 后恢复，`ecs-verify.sh` 完整通过并清理临时目录。最终状态 checkpoint 识别消息：`docs(status): record client-core calendar boundary deployment`。

## 2026-08-22 当前月撤回确认门禁

- 引入点与红灯：`927241c` 同时给 publish/withdraw 增加 `acknowledgePastDates` 禁用与提交守卫，但控件只在 publish 渲染。新回归旧实现 2/3 失败；重新发布双确认基线保持通过。
- 修复与语义：共享确认输入增加 action，只有 publish + past dates 检查第二日期确认；Vue script 和 confirm button 禁用条件同步限定 action。撤回仍要求可见的通用影响确认，重新发布仍要求通用+日期双确认；请求体、UUID、API 接收者、版本/幂等、异步错误和调用次数不变。
- 验证：回归 3/3、发布等价/边界 3 文件/11 项、受控全仓 146 文件/817 项通过，32 文件/265 项按环境跳过；presentation-core/Web/根 build/typecheck/lint 通过。Mini 13 文件/54 项及 verify/source/Worklet/package/determinism/CI dry-run 通过（133701 bytes，manifest `2fa6b96c62c44c32fcd1ec26626970ba801e894bd02656422ca2e61113d239ad`）；任务格式、diff check 和 `smoke:check-core` 通过。
- 运行/浏览器验证：`pnpm smoke:browser` 在本机 5173 未启动时第 1/6 步 `ERR_CONNECTION_REFUSED`；元素、文案和 style 不变，无视觉确认点。checkpoint 识别消息：`fix(web): allow current-month schedule withdrawal`。
- 发布与核验：checkpoint `b24db46` 已推送；本地 Node `miniprogram-ci` 从精确干净 worktree 上传体验版 `0.1.0-p2.20260822.46`（50 个代码文件、38661 bytes，manifest `012f71bed84a4bfd04c44a6426ac7b2453f767be7c01fec625fc483da19ec2dc`），未审核、未正式发布。数据库备份 `b021d3b4-4582-4607-86b2-63c49bb7c79e`（50 表、161438 行、76289064 bytes，SHA-256 `4b8a59e5b85235d74829a91a65f3ade8b7295f5ac2f0c85ea6ee4c7547974efd`）后部署 release `b24db461d77a839a23410f1d696662347338733a`；预热首个 502 后恢复，`ecs-verify.sh` 完整通过并清理精确临时目录。最终状态 checkpoint 识别消息：`docs(status): record current-month withdrawal deployment`。

## 2026-08-22 P2 发布生命周期共享

- 引入点与红灯：草稿批次/历史分组/批量发布来自 `2834f07`，发布/撤回/重发与确认来自 `7c783c7`/`968c6c5`，过去日期门禁来自 `927241c`。共享导出、黄金语料和 Web 接线旧代码 6/6 失败，实现后定向 4 文件/24 项通过。
- 实现与等价：共享核心只接收结构化历史、注入业务时钟和布尔确认状态，输出新分组数组或不含 `operationId` 的请求 intent。对象身份、输入顺序、`??` 空字符串、`localeCompare`、当前/过去/归档/未分类状态、时钟调用次数与确认短路保持；API 成员调用、UUID、冲突刷新、错误/catch/finally 和 UI 状态继续在 Web。
- 边界与验证：生产源无 contracts/Zod、Vue/Pinia/Router、DOM/fetch、Node、数据库或 scheduling-domain；presentation-core/Web/根 build/typecheck/lint、受控全仓 145 文件/814 项通过，32 文件/265 项按环境跳过。Mini 13 文件/54 项及 typecheck/verify/source/2 Worklets/package/determinism/CI dry-run 通过（133701 bytes，manifest `910f561f32385a6ee1f3b64d92133cae5cd0650d6e2d816e441700c65c5b8cfe`）；默认 Mini 命令只被用户所有 ignored ECS runner 副本的 17 项基线失败干扰。任务格式、diff check、`smoke:check-core` 通过，根 format 只被既有/用户所有文件拦截。
- 运行/浏览器验证：`pnpm smoke:browser` 在本机 5173 未启动时第 1/6 步 `ERR_CONNECTION_REFUSED`；SFC template/style 与 `HEAD` 逐字相同，无视觉变化。
- 后续回归：审计确认 `927241c` 起当前月撤回含过去日期时存在隐藏 `acknowledgePastDates` 门禁；本轮按等价要求未修。下一 checkpoint 先以独立红灯测试把第二日期确认限定为重新发布。当前 checkpoint 识别消息：`refactor(presentation): share publication lifecycle`。
- 发布与核验：checkpoint `3be831b` 已推送；本地 Node `miniprogram-ci` 从精确干净 worktree 上传体验版 `0.1.0-p2.20260822.45`（50 个代码文件、38664 bytes，manifest `b3df47f67ce38390cfda991a0e20630b0fcec068518b3777a51d789a2ecc7c47`），未审核、未正式发布。数据库备份 `4b60a85e-df68-4c3e-b734-1dd7c573e24e`（50 表、161436 行、76287740 bytes，SHA-256 `ff99363572bfe77b909d94e0be6d0dc8ade962eed40ff418431be3eaad8ba1f1`）后部署 release `3be831be71a9662d9cb48eea8d693d24ba5077cd`；预热首个 502 后恢复，`ecs-verify.sh` 完整通过并清理精确临时目录。最终状态 checkpoint 识别消息：`docs(status): record p2 publication lifecycle deployment`。

## 2026-08-22 P2 手排 transition、选择与撤销共享

- 引入点与红灯：`git log -S`/`git blame` 定位 Web 快照撤销/选择为 `6512274`，涂抹模式为 `b1ce5c7`/`25bb8fa`，Mini 增量 undo 为 `6cc7463`。共享导出旧代码 5/5 失败，Web 接线 1/6 失败，Mini 依赖接线 1/1 失败，随后分别转绿。
- 实现与等价：共享核心提供泛型 Map mutation、apply/revert、行列清除、snapshot stack 和 `toggle|replace` 模式。Web 保持同格取消选择、同班种清除和完整快照；Mini 保持 replace 选择、单格 `{key,before,after}` 与局部 `setData`。undo 仍只恢复 cells；无 `this`/异步/错误变化，replace 不调用 equality callback。
- Mini 边界：package、tsc、esbuild 与 Vitest 均使用共享源码；移走 shared dist 后 Mini typecheck/build 通过。产物继续通过 DOM/Node/Zod/数据库/绝对路径审计，包体 133701 bytes，determinism manifest `97f0ab994df01736b613c5d3e9b8379db82d40053a004a4bdcf0c542392c24e4`。
- 运行/浏览器验证：`pnpm --config.verifyDepsBeforeRun=false smoke:browser` 在本机 5173 未启动时第 1/6 步 `ERR_CONNECTION_REFUSED`；`smoke:check-core` 通过。Web SFC template/style 与 `HEAD` 逐字相同，无视觉变化。
- 验证：共享包/Web/根 build/typecheck/lint、手排/边界 4 文件 22 项、Mini 13 文件/54 项、受控全仓 141 文件/798 项通过，32 文件/265 项按环境跳过；Mini verify/source/Worklet/package/determinism/CI dry-run、任务 Prettier 与 `git diff --check` 通过。根 format 只被用户所有文件拦截。checkpoint 识别消息：`refactor(presentation): share manual transitions`。
- 发布与核验：checkpoint `42bcf49` 已推送；本地 Node `miniprogram-ci` 从精确干净 worktree 上传体验版 `0.1.0-p2.20260822.44`（50 个代码文件、38662 bytes，manifest `bf9a3f2d86142beced1e6c39761cc83880457f3b48ed0b685e6871831e08bbc7`），未审核、未正式发布。数据库备份 `1c623d16-9a19-48f3-872a-2d67841be221`（50 表、161434 行、76286416 bytes，SHA-256 `7f94a49b6235874605ffc189b0e054895ef64c10bd8d10ca3a421ce2ece834b1`）后部署 release `42bcf4992a834c042d9c355091919418f1574395`；预热首个 502 后恢复，`ecs-verify.sh` 完整通过并清理精确临时目录。最终状态 checkpoint 识别消息：`docs(status): record p2 manual transition deployment`。

## 2026-08-22 P2 日历共享核心 Web 先行迁移

- 引入点：`git log -S` / `git blame` 确认生产 5/6 周月网格来自 `abd20d2`，默认选择来自 `7c80488`，切月保持完整日期来自 `daf7ede`，日期分组和 CST 班次排序来自 `db35a77` / `b1ce5c7`，筛选及实际人员优先来自 `ab25064`。
- 测试先行与实现：新增旧 Web/共享实现黄金等价测试，旧代码因不存在 `@schedule/presentation-core` 先失败；新包只包含纯日期字符串、月周网格、选择、节假日、筛选/分组/排序和列表 ViewModel。Web 原 feature 模块变为兼容适配层；Vue 模板/样式、API/cache、异步、错误与调用次数不变。
- 语义审计：抽取函数无 `this`；错误消息、`??`（含显式空字符串）、泛型 DTO 身份、输入数组顺序、分组内排序和无额外副作用由 6 组等价测试锁定。运行边界测试证明 ES2020 browser bundle 只有包内输入且无 contracts/Zod、scheduling-domain barrel、Vue/Pinia/Router、DOM、fetch、Node 或数据库。MonthGrid/WeekGrid 字节哈希保持。
- 运行/浏览器验证：`pnpm --config.verifyDepsBeforeRun=false smoke:browser` 已运行；本机 5173/3000/3306 无监听、Docker 不可用，在第 1/6 步 `ERR_CONNECTION_REFUSED`，未进入产品断言。`smoke:check-core` 通过，确认未触及强制核心链路文件；本轮无视觉源变化。
- 验证：共享包/Web/根 build 与 typecheck、根 lint、日历/边界 14 文件 67 项、受控全仓 139 文件/791 项通过，32 文件/265 项按环境跳过；Mini verify/source/Worklet/package/determinism/CI dry-run、任务 Prettier 和 `git diff --check` 通过。根 verify/format 只被用户所有配置、目录文件和 Storybook 生成物阻断。checkpoint 识别消息：`refactor(presentation): share calendar core with web`。
- 发布与核验：checkpoint `ca16d7e` 已推送；本地 Node `miniprogram-ci` 从精确干净 worktree 上传体验版 `0.1.0-p2.20260822.43`（50 个代码文件、37872 bytes，manifest `7d6cf8febb025c7cd608638401c9dbc3693188c70b63cf3c962cec8578e73a4b`），未审核、未正式发布。数据库备份 `12899cc6-e6ad-4913-9ae1-0da3af2da1bd`（50 表、160997 行、75531784 bytes，SHA-256 `34a0e656ff0720ccd38f274265d7acbb38f10f63c3043fbc8618abc2feba8476`）后部署 release `ca16d7e3a77dd0e1a04ce23f363de93c7f6cb4fb`；预热首个 502 后恢复，`ecs-verify.sh` 通过并清理临时发布目录。最终状态 checkpoint 识别消息：`docs(status): record p2 calendar core deployment`。

## 2026-08-22 移动导出按钮空白

- 反馈与引入点：用户报告动作图标上线后移动端导出按钮为空白。`git log -S` / `git blame` 定位 `daff238` 的 `.shell-export-action span` 原本只隐藏文字；`b70bb99` 的动作图标以 `<span>` 为根，`fea129b` 接入后父级 scoped CSS 也把图标裁成 1×1。
- 测试先行与修复：新增 `shell-export-label`、直接子元素选择器和禁止宽泛 selector 的回归守卫；旧实现 1/5 失败，修复后 5/5。只把移动规则收窄为 `.shell-export-action > .shell-export-label`；20px SVG、导出 motion key、权限、点击一次打开 Sheet、API 与错误路径均不变。
- 运行/浏览器验证：`pnpm --config.verifyDepsBeforeRun=false smoke:browser` 已运行；本机 5173 无监听，在第 1/6 步以 `ERR_CONNECTION_REFUSED` 停止，未进入产品断言。390×844 Storybook 实测导出按钮 44×44、图标根/SVG 24×24、`clip-path: none`，点击后仍保持 24×24；正式域名同断点命中移动媒体规则，线上 CSS 精确包含 `.shell-export-action>.shell-export-label`、不含 `.shell-export-action span`，并保留 `.top-action-motion-icon` 的 20px 尺寸。正式账号只有成员群组，权限层不渲染导出按钮，本次未触发导出或其他业务写入。
- 验证：定向 2 文件/10 项、排除用户自有 `runtime/**` / `src/**` 后 141 文件/794 项通过，32 文件/265 项按环境跳过；根 lint/typecheck、Web typecheck/build、任务文件 Prettier/ESLint 与 `smoke:check-core` 通过。
- 正式发布与核验：checkpoint `993bdf4` 已推送；备份 archive `e186ef3e-f2aa-4658-b8dc-765a07873dc2`（50 表、157700 行、70980528 bytes，SHA-256 `95c0d57b6727080b5d65267fa0d9e63a9e753dcd4b04a3c152d3e8124f04f6da`）后部署 release `993bdf42b8052fcf0bab75e5e42bf48cd3f9d558`，预热首次 502 后恢复；`ecs-verify.sh` 通过健康、哈希、隔离、端口、容器、依赖和 43 条迁移，服务器 release/manifest 一致。当前状态：已完成并发布 → 待用户复核；最终状态 checkpoint 识别消息：`docs(status): record mobile export icon fix deployment`。

## 2026-08-21 Lucide Minimal 动作图标生产落地

- 用户确认与引入点：用户确认 Storybook 的静态保真点击动效并授权应用。`git log -S` / `git blame` 定位顶部通知/个人/导出分别来自 `abd20d2`、`0b7b1b8`、`daff238`，日历筛选/定位来自 `abd20d2`/`a1a732a`，通讯录模式来自 `046dc65`，现有电话图标来自 `8a49434`、`1c84fd6`、`8309dce`、`5437995`、`b09da6e`、`41d284b`、`f723b0d`。
- 测试先行与实现：生产共用源、顶部、日历、通讯录选中守卫和全部现有电话图标接线在旧代码上 7/7 失败，实现后转绿。Storybook 图标组件迁入生产 `components`，预览与应用引用同一 SVG/动画源；各入口只递增自己的 motion key，科室/人员已选中时先返回，电话拨号 `href`、使用次数记录和菜单展开保持原调用。
- 仅点击语义：审计发现简单使用 `motionKey > 0` 会让已点击过的定位图标在月/周/列表重新挂载时自动播放；追加守卫先失败后改为只监听组件挂载后的 key 变化。生产遵循 `prefers-reduced-motion`，Storybook 的 `previewMotion` 只用于确认稿强制演示。
- 运行/浏览器验证：`pnpm --config.verifyDepsBeforeRun=false smoke:browser` 已运行；本机 5173/3000/3306 均无服务且 Docker 不可用，因此在第 1/6 步访问登录页时以 `ERR_CONNECTION_REFUSED` 停止，未进入产品断言。真实生产 `UnifiedDirectoryView` Story 在 390×844 验证人员首次切换 key 0→1、重复点击仍为 1；真实 `SelectedDateDutyDetails` Story 只让被点电话 key 0→1，其他保持 0，两个链接仍为 `tel:61234` / `tel:13800138000`；确认稿导出峰值箭头向右上、外框向左下，Axe 违规 0。控制台无产品 error/warning，仅有 Storybook 11 的前向兼容提示。
- 验证：任务定向 9 文件/55 项及新增生产守卫通过；排除用户自有 `runtime/**` / `src/**` 后 140 文件/790 项通过，32 文件/265 项数据库集成按环境跳过；根 lint/build/typecheck、Web typecheck、完整 Storybook build、任务文件 Prettier/ESLint 与 `smoke:check-core` 通过。
- 正式发布与核验：代码 checkpoint `fea129b` 已推送；发布前加密备份 `7b782097-5e41-434b-895a-cc340187e16b`（50 表、157697 行、70978500 bytes，SHA-256 `f12b363391327c007581bc039e601d4dba3020e9aa94dfe68d6ff354baa895b7`）后部署 release `fea129bb15270c5c5a2d4405b2f9e0e9599e150b`，预热首次 TLS EOF 后恢复。`ecs-verify.sh` 通过 43 条迁移、产物哈希、域名/IP 隔离、端口和容器；正式首页/API 200，Web bundle 命中全部点击 keyframe 与静态源，API/契约/数据库/领域产物哈希不变。
- 当前状态：生产落地已完成并发布 → 待用户复核；最终状态 checkpoint 识别消息为 `docs(status): record action icon motion deployment`。

## 2026-08-20 移动常驻导航与科室电话行精简

- 反馈与引入点：用户指定移动常驻日历/通讯录/换班/我的，其余进入更多，并要求科室电话移除左侧标签、扩大号码空间。`git log -S` / `git blame` 定位移动入口由 `db35a77`/`0b7b1b8` 引入，电话标签和 62px 标签列由 `427ff6b` 引入。
- 测试先行与实现：旧实现导航/电话布局 2 项失败；主入口改按显式数组顺序输出 calendar/directory/swap/profile，secondary 自动接收请假等其余入口。科室模式不再渲染 contact-label，人员模式规则不变；长短号 gap 调整为 8px、窄屏 6px，号码仍 nowrap。职称循环仅改局部变量名以清除模板 shadow warning。
- 运行/浏览器验证：`pnpm --config.verifyDepsBeforeRun=false smoke:browser` 因本机 MySQL 127.0.0.1:3306 不可用，在管理员登录回退 `/login?redirect=/`。Storybook 390px 实测底栏 5 项顺序正确、更多页完整；科室“病案”结果在 390/320px 左侧标签为 0、gap 为 8px/6px、号码不换行、页面无横向溢出。
- 验证：定向 3 文件/25 项、主工作区 128 文件/752 项通过，31 文件/262 项按环境跳过；根 lint/build/typecheck、Web build/typecheck、Storybook build、任务文件 Prettier/ESLint、`git diff --check` 与 `smoke:check-core` 通过。格式全检只被用户配置/旧预览产物和已提交目录批次遗留文件阻断。
- 正式发布与核验：checkpoint `279c2fd` 网络恢复后推送；发布前加密备份 `52df93d2-293b-4c05-84d6-b386ae367e35`（50 表、131796 行、58820132 字节，SHA-256 `107b4d31ecc0dd9c4eeab1ff50cdd1ca195f854c28d5814bf1576c6fe80e2b37`）后部署 release `279c2fd2321f201973cf50fccc3361f8dff092e0`，预热首次 TLS 连接重置后恢复，`ecs-verify.sh` 通过 42 条迁移。正式首页/API 200，bundle 命中四项顺序和 8px/6px 号码间距；未写业务数据。
- 状态：已完成并发布 → 待用户复核；最终状态 checkpoint 识别消息为 `docs(status): record mobile nav and directory phone deployment`。

## 2026-08-20 个人数据与登录密码安全修复

- 反馈与引入点：用户要求手机号完整显示、修正个人统计、增加改密与初始密码登录提醒，并移除快速进入。`git log -S` / `git blame` 定位密码登录由 `de3ad5f` 引入、快速入口由 `0b7b1b8` 引入、统计单位/脱敏由 `ebd1b19` 引入；领域 `actualCount` 明确定义为班次数而不是天数。
- 测试先行：合约、默认密码判定、受保护状态/改密路由、哈希替换/审计、Web 客户端、会话恢复/提醒、个人页和生产弹窗在旧实现上共 12 项失败；`currentPassword` / `newPassword` 日志脱敏追加断言也先失败。实现后定向 8 文件/34 项、API 日志 10 项通过。
- 实现与语义：初始密码登录响应和恢复状态统一驱动一次登录内提醒；改密事务校验当前密码、生成新随机盐 scrypt 哈希并写无密码内容的审计。错误当前密码不更新；新旧相同拒绝；会话 token、资料、群组和业务权限不变。个人统计改用“次”，辅助请求部分失败不再整体归零；手机号完整展示，快速入口删除。
- 运行/浏览器验证：`运行/浏览器验证：pnpm --config.verifyDepsBeforeRun=false smoke:browser` 启动当前源码后因本机 MySQL 127.0.0.1:3306 不可用，在管理员登录回退 `/login?redirect=/`，未进入产品断言。Storybook 生产提醒/编辑两态在 390×844 实际操作通过，320px/390px 无横向溢出，字段 autocomplete 正确且输入/按钮/关闭触达均 44px；个人页完整手机号、统计“次”、快速入口 0 个。全程未输入或提交密码。
- 验证：主工作区 128 文件/753 项通过、31 文件/262 项按环境跳过；根 typecheck/build、Web/API/contracts typecheck/build、Storybook build、任务文件 Prettier/ESLint 与 `git diff --check` 通过。仅保留已提交目录批次的迁移计数测试 40→42 未同步和 2 个模板变量遮蔽 lint 警告，不纳入本认证 checkpoint。
- 正式发布与核验：checkpoint `664bc1f` 已推送；发布前加密备份 `e1c4985d-9519-42f1-8847-f1dbe9066c97`（50 表、131794 行、58818808 字节，SHA-256 `b4f59adc7f17864af2c693939890a1d37567a5fe3b866b89347f03389dfbf2c9`）后部署 release `664bc1f8a86ff2c342f7afe09213030ab2ede1cd`，预热首次 502 后恢复，`ecs-verify.sh` 通过 42 条迁移。正式首页/API 200，未认证密码状态端点 401，Web/API bundle 命中改密、初始密码提醒和正确统计口径；未登录、未输入或提交密码、未写业务数据。
- 状态：已完成并发布 → 待用户复核；最终状态 checkpoint 识别消息为 `docs(status): record profile password security deployment`。只读验证端点、bundle 和服务器 release，不替用户执行最终密码修改。

## 2026-08-19 员工通讯录移除 T9、增加工号搜索与电话行修复

- 反馈与引入点：用户要求去除低频 T9 搜索并增加工号搜索；同时完成上一轮“移动电话”标签占位导致号码换行的 UI 修复。`git log -S`/`git blame` 定位 T9 API/别名/提示均由 `9bc4922` 引入，电话卡片布局由 `926136a`/`b09da6e` 引入。
- 测试先行：新增员工搜索提示不得出现 T9 且必须包含工号、导入结果不得生成 T9 别名、API fixture 直接以 `employee_code=d0001` 搜索、迁移后枚举不得含 T9、电话行无移动电话标签且号码不换行断言；旧实现对应断言失败，实现后通过。
- 实现与语义：员工工号使用数据库字段精确/前缀排序（不依赖别名）；中文、拼音、首字母、号码和权限/分页保持。移除 T9 导入生成和数字匹配分支，迁移删除历史 T9 别名并收窄枚举；员工移动电话行改为号码全宽单列，固定电话标签仍保留。请求、Promise/catch、空值和副作用路径未改变。部署前发现 `ecs-verify.sh` 仍断言 40 条迁移，已更新为本批次迁移后的 41 条。
- 运行/浏览器验证：真实 MySQL API、导入、迁移 3 文件/21 项通过；Web/API/contracts/database typecheck、任务文件 ESLint/Prettier、`git diff --check` 通过。`SMOKE_BASE_URL=http://127.0.0.1:5173 node scripts/smoke-browser.mjs` 通过管理员、成员、访客/vkey、访问记录、员工中文/工号搜索及电话布局；`node scripts/smoke-browser.mjs --check-core` 通过，确认未涉及核心链路。
- 正式发布与核验：代码 checkpoint `427ff6b` 与部署验证修正 checkpoint `5704242` 已推送；发布前数据库备份 archive `6d798463-f2c1-4b22-a3c2-2e1c297ebead`（50 表、144597 行、62174612 字节，SHA-256 `157c51c67f0d5724687ef6b27beac82e33d2432a2dc187ec862723cfbd86796e`）；release `5704242e1b5aefb704f940c31668ee0f6f7343d0` 已部署，预热两次 502 后恢复，`ecs-verify.sh` 通过并确认 41 条迁移。正式域名 `/api/health` 200；生产 employee/internal 快照 1070/1073、341/359，1064 条 employee 记录含工号，T9 别名为 0、枚举不含 `t9`。仅执行只读核验，未写业务数据。
- 最终状态发布：状态文档 checkpoint `a840572` 已推送并部署；文档发布前数据库备份 archive `7f0bb519-b706-4b6d-a733-5d4a0b4f10ba`（50 表、106421 行、47263568 字节，SHA-256 `d7d802c24146957b10b4c08413095c8c07277fd6504bcce0e7429e3dc1d9c642`）；release `a8405721ddb35693c6fa480d536d02f1d079af28` 的健康、产物哈希、域名隔离、容器与 41 条迁移核验通过。随后状态文档收口 checkpoint 也已提交、推送并部署，服务器 `current-release` 与 Git `HEAD` 一致。
- 当前状态：已完成（含运行验证、代码发布、状态文档发布与线上只读核验）→待用户复核；不再开始其他实现任务。

## 2026-08-19 员工通讯录工号前缀优先配对（当前轮次）

- 反馈与引入点：在 `e92586b` 的姓名/部门配对基础上，用户要求同名候选优先 `d`/`g` 开头；本轮执行 `git log -S 'departmentCandidates.length === 1'` 与 `git blame infra/scripts/employee-directory-identity-matcher.ts`，确认原选择逻辑由 `e92586b` 引入。
- 测试先行：新增“同部门 `d`/`g` 与其他前缀并列时选唯一 `d`/`g`”及“无唯一 `d`/`g` 时保留空缺”回归用例；匹配器/清洗器定向 2 文件/8 项通过。
- 实现与语义：先使用部门候选池，再在候选池中筛选唯一 `d`/`g` 工号；无部门候选时维持唯一姓名回退；多个 `d`/`g` 或无候选均不写入。现有目录条目数、清单不新增人员、号码与搜索/权限行为不变。
- 数据结果：1070 条原目录保持不变，1015 条姓名+路径部门匹配，49 条唯一姓名补配，1064 条写入工号；0 条冲突，6 条无候选继续待人工核对。本机 manifest `employee-20260819-b443f8cc-ee8eefa6` SHA-256 `1b840957e3b4eb6a90a393297890335f961b5d9b854f2f34f10c1e8ff37354f6`，报告仍不含电话号码明细。
- 运行/浏览器验证：本轮任务未改动 Web 核心链路；排除用户自有 `runtime/**`、`src/**` 与小程序依赖缺失测试的主工作区 Vitest 111 文件/674 项通过（31 文件/262 项按环境跳过）；infra TypeScript、Prettier、任务文件 ESLint、`git diff --check` 通过。全仓原始扫描另有 7 个小程序测试因既有 `esbuild`/`miniprogram-simulate`/`pngjs` 依赖符号缺失失败，未修改依赖树。
- 正式发布与核验：代码 checkpoint `e5a6077` 已推送并部署；发布前备份 archive `95d2c1ba-a0bf-4395-a517-cc7d80c801e0`，release `e5a60777c9857cb87af91d9cb34e5cc239f7990c`，预热一次 502 后恢复，`ecs-verify.sh` 通过。数据发布前第二次备份 archive `0f1bb789-4c25-4604-9110-fa3b87afdbc4`；SSH stdin dry-run changed 4、warnings 0，原子批次 `b631ec70-cbec-4c8b-9abe-462b7ac20995` 替换旧员工批次，线上只读聚合确认 1070/1073/29724、1064 个工号和 6 条空缺，迁移数 40。
- 当前状态：已完成（含代码发布、数据发布、备份和线上只读核验）→待人工核对 6 条无候选内容；不自动填写人工结论。

## 2026-08-18 D/NP 固定班种分段状态提醒

- 需求与引入点：D 班午间间休、NP 班夜间值班房听班属于一个排班内的分段状态，现有 `shift_types` 和日历契约只保存单一起止时间；`git log -S 'formatShiftTimeRange'` / `git blame` 确认 `1c84fd6` 首次加入的选中日期详情只显示班种、人员和连续起止时间，未表达分段状态。
- 测试先行：新增 D 班 08:00–12:00/午休/14:30–17:30、NP 班 17:30–22:00/听班/次日07:00–11:00 边界用例；旧实现因 helper 不存在失败，实现后 3/3 通过。规则同时校验简称、中国标准时间起止值和精确持续分钟，编辑为其他时段的同名班种不会误套固定说明。
- 实现与语义：日历详情始终保留排班人员、岗位、电话、事件和“已排班/有变更”状态，仅追加分段说明；班次进行中每分钟更新“在岗中 / 午间间休 / 值班房听班中”标签。排班 API、数据库、班种配置、统计、生成、换班/请假/加扣班、事件、错误路径和调用次数均未修改。
- 运行/浏览器验证：`运行/浏览器验证：pnpm --config.verifyDepsBeforeRun=false smoke:browser` 在 `AUTH_DEV_MODE=true` / `VITE_AUTH_DEV_MODE=true` 当前源码服务通过管理员、成员、访客/vkey 与访问记录全流程，无浏览器错误；首次仅因 5173 服务未启动而连接失败，启动后原样复跑通过，截图目录 `C:\Users\eylin\AppData\Local\Temp\schedule-smoke-2eLV2J`。
- 专项视觉与验证：Storybook 390×844 实测 D/NP 两条说明完整换行、页面 `scrollWidth = clientWidth = 390`、电话/事件按钮均为 44px；当前 23 点 NP 显示“值班房听班中”，人员姓名与联系方式保留。主工作区排除用户自有 `runtime/**` / `src/**` 后 Vitest 119 文件/698 项通过（31 文件/261 项按环境跳过）；Web typecheck/build、Storybook build、任务文件 Prettier/ESLint 通过。原始 Vitest 会重复扫描 `runtime/` 历史 release 副本并暴露其 6 项旧断言失败，本轮未修改这些副本。
- 正式发布与只读复核：代码 checkpoint `81e44f7` 已推送；发布前加密数据库备份 archive 为 `8865ad86-a90c-4cc0-898c-a7b007be9b2a`（50 表、18,505 行、7,376,160 字节，SHA-256 `d6e48163573fd7f01dcf65b0c0382c235ded67bbab386c66440c93d113306929`）。从独立干净 worktree 构建并部署 release `81e44f74d0c052a4f667d534390768e7097d0168`；容器预热首个健康检查短暂 502 后自动恢复，`ecs-verify.sh` 通过。正式 D0796 群主会话正常加载现有空排班月历，未写业务数据；正式 Web bundle 精确包含分段状态实现，公开 API 200，Git 本地、`origin/main` 与服务器 `current-release` 一致。
- 当前状态：已完成（含生产发布与线上只读核验）→ 待用户复核；最终状态 checkpoint 识别消息为 `docs(status): record split shift status deployment`。

## 2026-08-18 通讯录空闲态、收藏卡片与拨号触控蓝框

- 反馈与引入点：用户要求未搜索/筛选时只显示收藏、常用，检索时结果在前；优先卡须与普通卡一致；导览置顶并移除“院内协作”胶囊；拨号触控后不得残留蓝框。`git log -S` / `git blame` 指向 `8309dce` 的标题/顺序及拨号 hover/active 规则、`5437995` 的紧凑优先卡与结果前置，号码高密度结构由 `926136a` 延续调整。
- 测试先行：有效查询 helper、无初始空查询、结果/优先区顺序、完整卡片复用、顶部顺序和触控 CSS 断言在旧实现 4 项失败；实现后通讯录/Storybook 定向 9 文件、41 项通过。
- 修复与语义审计：空闲初始化只加载 facet 与受权限约束的偏好 UUID lookup；搜索或筛选有效才调用 `searchDirectory`，清空会递增请求序列、清除游标/结果/加载状态，迟到 Promise 不再落盘。接收者绑定、查询参数、错误 catch、分页、同号合并、收藏 UUID/次数/时间及拨号使用记录次数不变。优先区直接复用完整结果卡 DOM/CSS；结果区先渲染，优先区随后渲染。
- UI/可访问性：移除可见标题胶囊，保留隐藏 `h2`；导览在搜索上方。拨号关闭 WebKit tap highlight，`:active` 透明，hover 限于 `(hover: hover) and (pointer: fine)`，键盘 `focus-visible` 保留 2px 描边。
- 运行/浏览器验证：`运行/浏览器验证：pnpm smoke:browser` 最终通过全部管理员、成员、访客/vkey 和访问记录，无浏览器错误。初次失败来自验证器把已存在的收藏卡误当作新搜索结果；改为等待 `.directory-search-results .directory-entry` 与“找到”状态后复跑通过。实际页面初始结果 0；“病案”5 条；收藏卡长短号与原结果一致且在其下方；清空后只保留收藏。390×844 无横向溢出，拨号目标 44px、透明背景。
- 验证：Web typecheck/build、Storybook build、任务文件 Prettier/ESLint、定向 Vitest 与任务差异检查通过。完整 `pnpm verify` 仅被既有用户所有的 `apps/miniprogram/project.config.json` 格式问题拦截，本轮未修改该文件或并行小程序、`runtime/`、`src/`。
- 正式发布：代码 checkpoint `b09da6e` 已推送；正式 ECS 发布前备份 `6245db84-5500-4ee7-8acf-340587de7b03`（50 表、18,491 行、7,366,940 字节，SHA-256 `e4a7a0bf5f22fdadba11e98957cd2eaec6e7ff834f909140b908f9a8188e70ca`）后，从干净 worktree 构建并部署 release `b09da6e24d2f5bbe5818b61cc5e8ad2a0d794608`。首个健康检查短暂 502 后自动恢复，`ecs-verify.sh` 通过。首次主机探测只在遗留 ECS 生成一份可恢复备份、未部署任何产物；随后以线上上一 release 精确确认正式 ECS，未对遗留环境做其他变更。
- 正式域名只读复核：D0796 群主会话初始结果区/全量卡片均为 0，导览在搜索上方且无旧胶囊；“病案”返回 5 条，首卡显示长号与短号。390×844 无横向溢出，拨号目标 44px、背景透明；清空后重新为 0 结果，浏览器 error/warning 为 0，未改收藏、筛选或业务数据。
- 状态：已完成（含生产发布与线上只读复核）→ 待用户复核；最终状态 checkpoint 识别消息为 `docs(status): record directory idle deployment`。

## 2026-08-18 月份切换后选中日期与值班详情错配

- 反馈与引入点：翻月后蓝框视觉位置保留，但详情日期与班次/时间不再对应。`git log -S` / `git blame` 指向 `628c79f`：该轮取消翻页重置选择，却没有把旧选中日号重定向为目标月份的完整日期。
- 测试先行：新增日期重定向和生产接线用例，旧实现 2 项失败；实现后定向 52/52。覆盖普通月份、31 日进入 2 月、闰年 2 月和桌面年月选择器入口。
- 修复与语义：`setBusinessMonth` 在写入月份前同步完整 `selectedDate`，详情仍以完整日期精确分组，不按日号模糊匹配。短月份只夹到月底；API、缓存、筛选、事件、Promise/catch 范围、空值和调用次数不变。
- 运行/浏览器验证：`运行/浏览器验证：pnpm --config.verifyDepsBeforeRun=false smoke:browser` 在当前源码 5174 服务通过管理员、成员、访客/vkey 与访问记录。390×844 选中 8 月 14 日后切到 9 月，蓝框和标题均为 9 月 14 日且 0 班；返回 8 月恢复对应全天班、姓名与 08:00–08:00 时间。Web typecheck/build、任务文件 Prettier/ESLint 与 diff check 通过；全仓仅并行小程序基础组件 5 项缺文件失败。
- 正式发布与只读复核：checkpoint `daf7ede` 已推送；发布前加密备份 `22fa6662-a451-43de-ba7d-ca0b16177e04`（50 表、18,482 行，SHA-256 `33eb553c4321aa7364f4d0d3cc2ff3a1c7a4ab358f30697b436a766de9615ce9`）后部署 release `daf7ede9cd7a47e92f4c1bb8a989fb54d9aab0b0`，`ecs-verify.sh` 通过。正式 390×844 下 8 月 14 日切到 9 月再返回，蓝框、标题和 0 班详情始终使用同一完整日期；现网无排班分支与本地有班次/时间分支共同覆盖，未触发业务写入。
- 状态：已完成（含生产发布与线上核验）→ 待用户复核；最终状态 checkpoint 识别消息为 `docs(status): record calendar detail binding deployment`。

## 2026-08-18 通讯录动态导览、收藏与常用优先区

- 反馈与引入点：无数据“楼宇”仍显示、七级导览依赖横滚且按钮只打开 Sheet 不定位，均由 `8309dce` 引入；层级联动和同号合并来自 `926136a`。已对 `wayfinding-ribbon`、`filterSections`、`updateDirectoryFilterSelection` 和卡片调用点执行 `git log -S` / `git blame`。
- 测试先行：空/单选层级、冗余下级清理、受权限 ID 批量恢复、收藏/常用最小化持久化、无横滚定位与优先区断言在旧实现上 6 项失败且 1 个模块缺失；实现后定向 6 文件/173 项、真实 MySQL 通讯录路由 5/5 通过。
- 实现与安全：导览和筛选 Sheet 只渲染当前兼容选项大于 1 的层级，改变上级时同时清除不兼容或已无筛选意义的下级。收藏按群组保存在浏览器本地，仅含条目 UUID、使用次数和最后使用时间，不保存名称或号码；刷新后通过 `/groups/:groupId/directory/lookup` 按当前成员权限读取，管理员可见条目不会被成员偏好恢复绕过。
- UI 与交互：`frontend-design` 延续医疗蓝白“院区站点”语言；390px 导览为两列紧凑网格、桌面自动适配，无水平滚动。点击任一层级会打开筛选 Sheet、滚动并把焦点放到相应区段；卡片右上角 44px 五角星可收藏/取消，导览下方按“收藏通讯录”“常用通讯录”显示快捷卡。
- 运行/浏览器验证：`pnpm smoke:browser` 在当前源码 5173 服务通过管理员、成员、访客/vkey 与访问记录全流程；首轮仅因服务未启动连接失败，启动当前源码后原样通过，截图目录 `C:\Users\eylin\AppData\Local\Temp\schedule-smoke-GHywhh`。Storybook 390×844 实测 6 个有效层级、楼宇层级为 0、两列无溢出；收藏优先区可逆，点击“科室”后活动焦点为 `directory-filter-department` 且楼宇区段为 0。全仓 Prettier/ESLint/build 通过，非集成 Vitest 110 文件/660 项通过（31 文件/261 项按环境跳过），Web/API/contracts typecheck、Storybook build、`pnpm smoke:check-core` 与 `git diff --check` 通过；全仓 typecheck 曾短暂命中并行日历文件已引用但尚未导出的 helper，该并行改动收口后 Web typecheck 原样复跑通过，本轮未修改其文件。
- 追加反馈与引入点：筛选 Sheet 偏矮、说明块占位、清除按钮不够易达且级别无法收起。通用移动 Sheet 的 78dvh 上限由 `5b00fa7` 引入，通讯录说明块/并排清除布局由 `926136a` 引入；追加源码回归断言在旧实现准确失败 1 项。
- 追加实现：仅对通讯录 Sheet 提高到移动端 92dvh/桌面最高 840px；删除“层级联动”等说明，自动清理状态保留为无障碍 live region。清除全部是顶部 sticky、内容区全宽的无阴影扁平按钮；每级标题整行 48px 可折叠，右侧方向符号旋转并提供 `aria-expanded/controls`，用户折叠选择在会话中保留，导览定点进入会先展开目标。
- 追加验证：`运行/浏览器验证：pnpm --config.verifyDepsBeforeRun=false smoke:browser` 通过完整管理员、成员、访客/vkey 和访问记录链路。Storybook 独立 390×844 画布测得 Sheet 776.47px、清除按钮/工具栏同宽 328px、折叠后选项 client rect 为 0、无横向溢出且 console error 为 0；全仓非集成 112 文件/669 项通过（31 文件/261 项跳过），Web typecheck/build、Storybook build、任务文件 Prettier/ESLint、`pnpm smoke:check-core` 与差异检查通过。
- 正式发布：动态导览/收藏 checkpoint `5437995` 与追加筛选 Sheet checkpoint `ee1296e` 均已推送。发布前加密备份 `2ab960ac-9286-4aba-9a2b-db5393697d00`（50 表、18,486 行、7,364,076 字节，SHA-256 `dabd9e4219cd66cba9ad3e75149d1c5d71c386b266c8541fc19982d9bf11b5e5`）后部署 release `ee1296ebff0dd4d6bdd49d511be97180f7ef8a05`；容器预热首个 HTTPS 探测短暂失败后自动恢复，`ecs-verify.sh` 通过。
- 正式域名只读复核：D0796 群主会话在 390×844 下实测 Sheet 375×776.47px，清除按钮与 sticky 工具栏同宽 328px；6 个级别均有 disclosure 语义，院区折叠后选项高度为 0，再展开正常。点击导览“片区”后 Sheet 打开、滚动 210px并把目标级别放入可视区，目标保持展开；无旧说明、无横向溢出，浏览器 error/warning 为 0，未触发业务写入。
- 状态：已完成（含生产发布与线上只读核验）→ 待用户复核；最终状态 checkpoint 识别消息为 `docs(status): record directory filter deployment`。

## 2026-08-18 统计页年度入口未使用统一时间选择器

- 反馈：统计页面切换“按年”后仍弹出浏览器原生年份列表，没有应用新版滚轮选择器。
- 引入点：`git log -S '<select v-else' -- apps/web/src/views/statistics/StatisticsView.vue` 与 `git blame` 指向 `36127b0`；`git log -S 'TemporalPickerKind'` 确认 `92038cd` 的统一选择器只声明 `month | date | time`，因此年度入口未在当轮迁移范围内。
- 测试先行：年度统一选择器源码回归用例在旧代码上准确失败（1 failed/5 passed）；ResizeObserver 空值断言也在旧实现准确失败。实现后定向 7/7、全仓 651/651 非集成测试通过。
- 修复与语义审计：新增单列 `year` 滚轮并复用既有触控滚动；统计页保留数字 `year` 作为 API 参数，只用 computed 做字符串 v-model 转换。`update:modelValue` 先更新数值，随后 `change` 执行原有 `load`；取消不 emit，错误路径、空值降级、统计接口及调用次数不变。
- 伴随修复：浏览器切换月/年后触发 `ResizeObserver.observe(null)`；`git blame` 指向 `6ec287d` 的 `undefined` 单值判断。新增回归断言先失败，再以 `instanceof HTMLElement` 同时保护滚动状态读取和 observe，不改变 observer 的创建/断开或滚动提示逻辑。
- 运行/浏览器验证：`pnpm smoke:browser` 通过管理员、成员、访客/vkey 与访问记录全流程。390×844 年度弹窗为 341×416px、单列滚轮 168×188px、触发区 44px，无原生 select/横向溢出；取消动画结束后弹窗为 0、`aria-expanded=false`、年份仍为 2026，浏览器 error/warning 为 0。Web typecheck/build、Storybook build、任务文件 Prettier/ESLint 和排除用户自有副本的全仓 Vitest 已通过。
- 正式发布与只读复核：checkpoint `ea5ad1c` 已推送；发布前备份 `5b8c8c5a-087c-4f4a-b796-206cd7e72f6b`（50 表、18,479 行），release `ea5ad1c6b80f30d2bddde64cff6be0db95973f34` 已部署且 `ecs-verify.sh` 通过。正式 390×844 量测与本地一致，取消关闭正常且日志为空，未触发业务写入。

## 2026-08-18 通讯录层级互斥、紧凑卡与同号合并

- 引入点：`git log -S 'filters.floor'`、`git log -S '清除全部'` 与 `git blame apps/web/src/views/directory/InternalDirectoryView.vue` 确认原平铺筛选、底部清除和号码分行布局由 `8309dce` 引入。
- 测试先行：层级路径契约/接口、祖先约束与自动清除、同号集合分组、Storybook/生产接入和 browser smoke 源码断言均先红后绿。最终定向 321/321、真实 MySQL 路由 4/4、全仓非数据库测试 105 文件/635 项通过。
- 行为：新增无号码的角色安全 facet paths；跳级筛选不强制补父级，改变上级仅清除不兼容后代。同号仅在类型、完整号码和短号的完整集合一致时合并，格式符/标签/顺序不影响；部分相同、类型不同、短号不同、无号码保持分开。CSV、数据库、来源和权限语义均不变。
- UI：清除全部上移并在 Sheet 顶部 sticky；长短号同排、路径/位置去重、单号码卡约 103–104px；合并卡保留全部名称、场景和备注。Storybook 合成 6 条显示为 5 卡/1 组合并，390px 无横向溢出。
- 运行/浏览器验证：`运行/浏览器验证：pnpm smoke:browser` 第三轮通过完整管理员、成员、访客/vkey 和访问记录链路，通讯录真实同号条目合并及七级联动专项均通过；前两轮分别停在既有手动排班固定列抖动和通知页瞬时空元素错误。Web/API/contracts typecheck、生产 build、Storybook build、任务文件 Prettier/ESLint 与 `git diff --check` 通过。
- 正式发布：checkpoint `926136a` 已推送；备份 `d35a8061-95ca-4e6b-b013-ea3bb58cec5f`（50 张表、18422 行、SHA-256 `4a3cb90cca407914612bb9e1ea023be9c07a5443812b6018a9fb832e1c9d66f4`）后部署 release `926136a8a4c380d812304708b1917d4b939b1eef`，`ecs-verify.sh` 通过；后续 release `3884713` 继续包含该代码。
- 正式只读复核：341 条原始记录可见；“手术室”结果为 4 卡/2 组合并，护士站和护士值班房名称均保留，卡高 119–120px、拨号目标 ≥44px、无横向溢出。“放疗中心”后改“饶平路院区”自动清除片区并提示，Sheet 不关闭，顶部清除位置正确；结束后已恢复排班日历，未写入业务数据。
- 状态：已完成（生产发布与只读核验）→ 待用户复核；最终状态 checkpoint 识别消息为 `docs(status): record linked directory deployment`。

## 2026-08-17 日期正圆标识与触控数字滚轮精修

- 回归定位：`git log -S '.date-grid button'`、`git log -S '.wheel-column button.is-selected'` 与 `git blame` 确认生产日期整格着色、34px 滚轮行和浅蓝选择框由 `92038cd` 引入。
- 测试先行：新增生产组件断言后旧实现 1 项失败/2 项通过；实现后生产组件与确认稿 5/5、Web 422/422、主工作区全仓 611/611 通过，数据库集成按默认环境跳过 256 项。
- 修复与语义：日期可见选中层独立为 36×36 圆；滚轮改为 44px 无框数字行、中心双分隔线、上下淡出、`touch-action: pan-y` 和移动惯性。分钟按合法集合循环且保留非步进旧值；取消、清除、完成、事件次数、日期边界、错误与焦点路径不变。
- 运行/浏览器验证：`pnpm smoke:browser` 包装器受 `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY` 阻断，等价入口 `SMOKE_BASE_URL=http://127.0.0.1:5174 node scripts/smoke-browser.mjs` 在当前源码服务通过管理员、成员、访客/vkey 和访问记录全流程，截图目录 `C:\Users\eylin\AppData\Local\Temp\schedule-smoke-ZIMJQO`；`node scripts/smoke-browser.mjs --check-core` 通过。320/390/1280 Storybook 几何、滚动结算、提交语义、无溢出和 Axe 0 违规均通过。
- 正式发布与核验：checkpoint `d29bb49` 已推送；部署前加密备份 `31f078ab-ee9b-4b6b-b6ca-66885f3b33af`（50 张表、16933 行，SHA-256 `048cefa2729fae44673ac40f0c8fa3e595511e3523bc9579c845e46ac33099a8`），release `d29bb4981bd94a4f3ede4299c7d1be7ef718b33a` 已部署，`ecs-verify.sh` 通过。正式域名只读复核确认日期标识 36×36 正圆、滚轮 188px/44px 行、透明选中态、月份和分钟单步结算、取消不写值、页面无横向溢出；所有草稿均取消，未触发业务写入。
- 当前状态：已完成（含生产发布与线上只读复核）→ 待用户复核；最终状态 checkpoint 识别消息为 `docs(status): record temporal wheel deployment`。

## 2026-08-17 通讯录短号六位上限与来源疑点处理

- 回归定位：`git log -S 'normalizePhoneValue' -- infra/scripts/directory-import-core.ts` 与 `git blame` 确认 `6f22319` 将完整号码和短号共同限制为 3–20 位，使来源短号栏的 8 位值能通过校验。
- 测试先行：新增 7 位短号必须拒绝且错误不得回显号码的断言；旧实现 1 项失败、12 项通过，修复后导入核心 13/13、隔离 MySQL 发布/回滚 2/2 通过。
- 修复与语义：完整号码仍允许 3–20 位，短号独立限制为 3–6 位；字符校验、NFKC 归一化、错误路径、事务和审计输出不变。修正后本地清单删除 4 个超过 6 位的短号值，疑似不一致的 1 个条目改为 `manually_verified`，完整号码、来源定位和本地 `source_text` 不变。
- 数据验证：修正后仍为 341 个条目、359 个联系方式、4488 个搜索别名；短号越界、孤儿外键、重复 ID、缺失号码和 `needs_review` 均为 0，11/11 校验和与两份来源 PDF 哈希一致；manifest SHA-256 为 `8df470f6e8e379f61d5d97e04d865885b011153b07678af24c9641ad71495e75`。
- 正式发布与核验：checkpoint `2744d76` 已推送并部署；发布前备份 `a8e21d39-4e2d-4c4f-9eaa-38fde8382d2e`，数据发布点备份 `0c74fdc0-92e0-46ca-9a9e-bfb91b374645`。批次 `87ee90fa-464d-45bf-86a4-cd17c2cbf23f` 原子发布后，生产 341/359/4488 与清单哈希一致，短号越界、缺失号码、告警均为 0；中文 ngram、拼音/首字母和号码/短号前缀探针通过，发布后 `ecs-verify.sh` 通过。
- 当前状态：DIR-02 已完成；并行 `d29bb49` 已由 UI 批次完成生产部署和只读核验，可与本轮最终状态记录一并形成 checkpoint，下一活动批次为 DIR-03。

## 2026-08-17 手机日历导航触态与滑动圆角分层修复

- 回归定位：`git log -S 'class="week-step"'` / `git blame` 确认月周导航来自 `8a49434`；移动格子底角来自 `c64f0d7`；拖动中 `.is-swiping` 圆角切换来自 `acd2507`。旧实现把移动背景和选中描边耦合，六行/月与五行/月交接时会让格子自身的透明圆角露出底层灰色，周格选中圆角则在拖动结束后重新出现。
- 测试先行：新增固定卡片裁切、移动格背景必须方形、选中伪元素独立圆角、原生导航按钮、触摸按压/取消清理及无 hover 残留断言；旧代码先失败。浏览器首次真实 touch 又证明单独 `:active` 不可靠，随后证明混合输入恢复 mouse 能力会让最后触点命中 hover；两项均先补失败断言再修复。
- 修复与语义：固定卡片继续承担圆角裁切，月/周格背景不再带底角；蓝框使用 `pointer-events: none` 的 `::after` 一次绘制，拖动时不再切换圆角类。月/周切换改为无组件内部状态的 44px 原生按钮，月/周/列表定位按钮共用短生命周期 `is-touch-pressed`，松手/取消清理；移除 hover 背景，键盘 `:focus-visible` 保留。原生 scroll snap、月份/周次、面板高度、详情、筛选和 API 均未改变。
- 运行/浏览器验证：`node scripts/smoke-browser.mjs` 在当前源码 5174 服务以真实 CDP touch 通过；检查按钮按住可见、松手后透明且无阴影/缩放/焦点残留，2026-08→09 半拖动无灰色反圆角，月历 8 月 31 日和周历左边界蓝框圆角同步完整。管理员、成员、访客 vkey 与访问记录全流程无浏览器错误，截图目录 `C:\Users\eylin\AppData\Local\Temp\schedule-smoke-ORNaq6`。
- 验证：日历定向 18/18、全仓 Vitest 90 文件/584 项通过（29 个数据库集成文件/253 项按默认环境跳过），Web typecheck/build、Storybook build、全仓 Prettier/ESLint、`node scripts/smoke-browser.mjs --check-core` 与 `git diff --check` 通过。`pnpm --config.production=false verify` 在进入实际脚本前要求删除并重装全部依赖目录，已拒绝该破坏性环境动作并用当前本地二进制逐项执行同范围门禁。checkpoint 识别消息为 `fix(web): stabilize mobile calendar controls and corners`。
- 正式发布：代码 checkpoint `0aaa562` 已推送；发布前加密备份 `1e04e2cc-4d73-4f85-9033-9227aa676767`（44 张表、11142 行，SHA-256 `1bd1d9e97244c3646f7ff1066ed2bb70aa098f1a66e596dcda10807562278c38`），release `0aaa5620616cda90dbd863656adb4ac0ae5c8c82` 已部署，发布前后 `ecs-verify.sh` 通过。
- 正式域名只读复核：390×844 月历外卡为 18px 圆角并统一裁切，2026-08-31 左下选中伪元素为 17px 圆角；周历 2026-08-17 左下选中伪元素同为 17px 圆角。左右按钮和定位按钮静止态均为透明背景、无阴影，截图无灰色反圆角或分步出现的蓝框；未触发业务写入。
- 状态：已完成（含生产发布与线上核验）→ 待用户复核。最终状态 checkpoint 识别消息为 `docs(status): record calendar touch and corner deployment`。

## 2026-08-17 换班下拉班次文案回归修复

- 回归定位：`git log -S 'formatSwapAssignmentOption' -- apps/web/src/features/swaps` 与对应 `git blame` 确认含时间/岗位的专用文案由跨月换班提交 `5a8380f` 引入；原公共 `createAssignmentOption` 来自 `11094e3`，仍完整提供“日期 + 班种 + 周X + 成员”以及周末周几红字 VNode。
- 测试先行：新增 `swap-cross-month-regression.spec.ts` 断言换班表单必须调用 `createAssignmentOption` 且源码不含 `formatSwapAssignmentOption`；旧实现 1 项失败、2 项通过，修复后换班逻辑、跨月回归与公共选项 11/11 通过。
- 修复：四组普通/管理员班次下拉统一复用公共选项；删除不再使用的专用格式函数及对应时间文案测试。现有换班记录表仍使用 `formatSwapShiftTime`，跨月月份加载、双方选择清空边界、候选人、预览、提交、审批与冲突处理均未改变。
- 运行/浏览器验证：`pnpm smoke:browser` 在 `AUTH_DEV_MODE=true` / `VITE_AUTH_DEV_MODE=true` 的当前源码服务下通过管理员、成员、访客 vkey 与访问记录全流程；首次未启动服务和首次未开启 Web 开发认证的运行分别被环境门禁正常拦截。`pnpm smoke:check-core` 通过并确认未涉及核心链路文件。
- 完整验证：Web typecheck/build、`pnpm verify`、定向 3 文件 11 项及 `git diff --check` 通过；全仓为 88 个测试文件、580 项通过，29 个数据库集成文件、253 项按默认环境跳过，仅有既有大 chunk warning。
- 正式发布：checkpoint `afe6a2d` 已推送；发布前加密数据库备份 archive 为 `5a1e925d-a75d-4b68-ad0b-3c246b787d90`（44 张表、9884 行，SHA-256 `56b9232458d5078da0cca8c552a287a301b94a7b41ab145997fbf3f30c1a0bd8`）。release `afe6a2d7531d26553e7cf7ebf1d48cd3af37a447` 部署成功，发布前后 `ecs-verify.sh` 均通过。
- 正式域名只读复核：正式 D0796 会话可正常打开换班页、发起换班 Sheet 和“我的班次”选项层；当前 2026-08 无可选已发布班次，显示“暂无数据”，未制造业务数据或触发写入，浏览器 error/warning 为 0。选项有数据分支由公共选项 VNode 测试、换班回归测试和本地浏览器验证覆盖。
- 状态：已完成（含生产发布与线上核验）→ 待用户复核；最终状态 checkpoint 识别消息为 `docs(status): record swap option deployment`。

## 2026-08-17 日历滑动、紧凑控件、拨号与事件时间轴落地

- 回归来源：月视图假滑动来自 `7c80488`；电话复制/菜单路径分别来自 `1c84fd6`、`7a47d69`、`ab25064`，成员目录来自 `6183e9d`；班种原始编辑器来自 `04c7da3`；事件表格来自 `7ac2a07`。本轮均已对关键表达式执行 `git log -S` 与 `git blame`。
- 测试先行：日历相邻轨道/速度吸附、直接拨号、紧凑班种/自定义颜色、事件日期分组/折叠在旧实现上分别失败；浏览器又准确暴露“按下即捕获指针会吞掉月格 click”以及布尔属性缺省导致访客星期栏隐藏，两项均先补失败断言再修复。最终定向 10 个文件 72/72 通过。
- 实现与语义：月/周只滚动圆角内的真实三面板内容，星期栏和工具栏固定；拖动按距离与速度决定翻页，松手使用柔和吸附曲线，减少动态时即时完成。普通点触仅在确认横向拖动后才捕获指针。电话入口统一为透明原样式 `tel:` 链接；相关打勾控件改为 60×44px 点触、52×30px 轨道的紧凑开关。班种列表按需展开，保留五色并新增同尺寸自定义色圆点、调色板和 HEX。事件页改为按日期分组的时间轴，支持全部/日期/单事件层级展开折叠。
- 运行/浏览器验证：`pnpm smoke:browser` 在 `AUTH_DEV_MODE=true` / `VITE_AUTH_DEV_MODE=true` 的当前源码服务下通过，覆盖管理员、普通成员、访客 vkey 与访问记录，全流程无浏览器错误；截图目录 `C:\Users\eylin\AppData\Local\Temp\schedule-smoke-7emAAK`。首次未启动服务、只启动 Web、旧验证器查找内部星期栏/旧班种文案的运行均在对应门禁停止；修正当前结构的验证目标并解决真实点触/访客回归后原样复跑通过。
- Storybook 浏览器专项：390px 月视图真实左滑由 10 月切至 11 月；成员页 6 个拨号链接均为透明背景、44px 点触；班种自定义颜色可展开调色板与 HEX；事件页可一键折叠全部日期；紧凑开关外层均为 60×44px。Storybook build 与 Web build 已通过，仅有既有大 chunk warning。
- 完整验证：`pnpm verify` 通过（88 个文件/579 项通过，29 个数据库集成文件/253 项按默认环境跳过）；Web/全仓 build 与 typecheck、Prettier、ESLint、Storybook build、`pnpm smoke:check-core` 和 `git diff --check` 均通过，仅保留既有大 chunk warning。
- 正式发布：checkpoint `41d284b` 已推送；发布前加密数据库备份 archive 为 `915fa54b-1054-4a81-b9a2-aefa9844d25d`（44 张表、9120 行，SHA-256 `4f1bec8ce81a40ef57758c151230e7a4cf471c73061b43eb6862d9733073ed41`）。release `41d284b312452df2762981e252251d5e871d9149` 部署成功，发布前后 `ecs-verify.sh` 均通过。
- 正式域名只读核验：月/周均保留 3 个真实相邻面板，实际拖动分别由 8 月切至 9 月、8 月第 4 周切至第 5 周；固定星期栏、无横向溢出、紧凑开关 60×44px/52×30px、6 行班种、42px 输入框、五个预设色加一个自定义色及调色板/HEX 均符合确认稿，浏览器 error/warning 为 0。当前生产会话群组未填写号码且没有事件，不为验收制造业务数据；空状态正常，拨号有数据分支与事件折叠由本地浏览器 smoke/Storybook 覆盖。浏览器开启“减少动态”时线上正确即时切换，同时已确认生产 CSS 载入 `cubic-bezier(0.22, 1, 0.36, 1)` 的正常动态曲线。
- 状态：已完成（含生产发布与线上核验）→ 待用户复核。最终状态 checkpoint 识别消息：`docs(status): record interface refinement deployment`。

## 2026-08-16 周视图与列表视图正式实现与生产发布

- 回归来源：周视图单列移动布局、列表值班姓名电话交互和月视图定位按钮分别通过 `git log -S`/`git blame` 定位到 `db35a77`、`a3b14fb` 和 `7c80488`；本轮只在这些调用点的展示层扩展，不改变日历 API、权限、排班数据或写入路径。
- 测试先行：新增正式日历视图回归断言；旧实现未通过周动态等高/七列选择、列表冻结月份工具栏和显式电话按钮等断言。实现后日历定向测试、Storybook 参考测试与现有月历 parity 共 47/47 通过。
- 变更：周视图改为固定七列，按当天值班人数/节假日/变动标识计算整周统一最小高度；姓名置于上方、班次和换/加标识置于下方，取消周末标签，仅保留周末颜色；点击日期沿用下方详情轨道。周切换按周推进，跨月不重置周起点，并显示“月第几周”。列表视图加入 sticky 月份切换/定位工具栏，电话按钮与姓名分栏，保留节假日、班次和变动信息；月/周/列表定位按钮默认透明无边框。
- 语义审计：月视图默认姓名电话交互保持不变；列表仅将原姓名电话入口改为显式按钮，仍复用原号码菜单；周视图隐藏卡内电话入口并把详情交互交给既有 `SelectedDateDutyDetails`，事件打开、筛选、月份请求和错误路径未增加调用次数。
- 运行/浏览器验证：`pnpm smoke:browser`（当前源码隔离 5174、`--config.production=false`）已通过，覆盖管理员/成员/访客/访问记录且无浏览器错误；本地桌面实际核对周视图 7 卡等高、无横向溢出、跨月按周切换、点击详情和列表 sticky 工具栏/月份切换/定位；定位按钮计算样式为透明、0 边框、无阴影。`pnpm smoke:check-core` 已通过并确认本轮未涉及核心链路文件。
- 运行验证：Web typecheck、生产 Web build、Storybook build、`pnpm --config.production=false verify` 和 Prettier 均通过；全仓库 77 个测试文件、527 项测试通过，29 个数据库集成文件、252 项测试按本机无测试 MySQL 跳过；生产构建仅有既有大 chunk warning。
- 正式发布：代码 checkpoint `8a49434` 已提交并推送；发布前加密数据库备份 archive 为 `99d2352c-5908-4d8f-865a-372a7bb8d9b8`（44 张表、5732 行）；release `8a49434b43741ca9a9a7562cfab7f8d628c93670` 已部署，业务数据保持服务器原位。
- 正式核验：发布前/后的 `/tmp/ecs-verify.sh` 均通过，正式域名/API 健康、未知 Host 拒绝、产物哈希、容器、无开发认证依赖和 36 个迁移检查通过。正式 D0796 会话在 1280px 核对 7 列周卡均高 143px、无横向溢出、卡内电话按钮为 0、点击日期详情正常；跨月连续切周保持周序；列表工具栏滚动后 `top=0` 固定，31 个班次含 5 个独立电话按钮且页面无横向溢出；月/周/列表定位按钮均为透明、0 边框、无阴影，浏览器日志为空。当前源码隔离 5174 的 390/320 响应式 smoke 和 Storybook 390 预览已通过。
- 最终状态 checkpoint `1570689` 已提交、推送并部署；其发布前加密数据库备份 archive 为 `637a925d-9693-45f1-97f7-93d2f7824ffa`（44 张表、5741 行），最终 release 为 `1570689259fad25d278db7dbd1db1973d64b2f94`。
- 状态记录收口前再次创建生产备份 archive `323d1957-66df-4cb4-956b-5c9256bfacda`（44 张表、5748 行）；本次只更新文档状态，提交信息为 `docs(status): finalize calendar views production status`，并将按规则作为最终 release 部署。
- 状态：已完成（含生产发布与线上核验）→ 待最终状态文档 checkpoint 部署；部署后保持 Git、远端和服务器 release 一致，再等待用户复核。

## 2026-08-14 账号密码认证切换

- 变更：正式网页从微信网站应用扫码登录切换为账号密码注册/登录；小程序身份和通知配置保持独立。
- 运行/浏览器验证：pnpm smoke:browser 已通过，覆盖开发管理员、开发成员、访客排班和访客访问记录流程；正式账号注册/登录需在新 release 部署后人工验收。
- 运行/浏览器验证：pnpm smoke:check-core 在补充本记录前因缺少本轮记录失败，补充后需重新运行并通过。
- 运行验证：pnpm verify 已通过；59 个测试文件通过，29 个数据库集成文件因本机没有测试 MySQL 跳过。
- 发布诊断：服务器数据库的既有 `users.id` 为 `utf8mb4_0900_ai_ci`，新增认证表迁移使用 `utf8mb4_unicode_ci`，MySQL 报告外键列不兼容；已将迁移 0035/0036 统一为既有排序规则。首次发布已自动回滚，现网旧 release 健康，待修正 release 重试。
- 发布验证：修正后的 release `c358109` 已部署；数据库迁移 0035/0036 成功，`ecs-verify.sh` 通过，正式域名/API、未知 Host 拒绝、共享入口端口、无开发认证依赖和迁移计数 36 均通过。
- 数据清理：旧 `local-admin` / `local-member` 记录的业务关联未删除，账号已改为 retired 标识并设为 suspended；生产管理员 UID 配置已清空，等待正式账号注册后配置。
- 负向验收：弱注册返回 400、未知账号登录返回 401、旧开发 Bearer token 返回 401；未创建测试账号。
- 状态：本轮发布已完成，当前为“待用户复核”；需要用户注册账号、确认管理员账号，并重置已暴露的小程序 AppSecret。

## 2026-08-14 密码策略与登录页提示调整

- 变更：密码移除最小/最大长度限制，仅拒绝空密码；登录页移除首次注册和微信 AppID/AppSecret 说明，并将登录密码输入标记为 current-password。
- 运行/浏览器验证：pnpm smoke:browser 已通过，覆盖开发管理员、开发成员、访客排班和访客访问记录流程。
- 运行验证：pnpm verify 已通过；60 个测试文件、447 个测试通过，29 个数据库集成文件因本机没有测试 MySQL 跳过。
- 发布验证：release `72f1076` 已部署；`ecs-verify.sh` 通过，正式构建产物不包含旧登录提示或“至少 8 位”文案，一位密码未知账号请求返回 401。
- 状态：本轮代码和正式部署已完成，当前为“待用户复核”；需要用户注册账号、确认管理员账号，并重置已暴露的小程序 AppSecret。

## 2026-08-14 配置正式管理员并重建 API

- 变更：确认正式密码账号 `D0796` 为 active 且资料已建立，将该账号对应的稳定认证 UID 写入生产 `PLATFORM_ADMIN_UIDS` 和 `HOLIDAY_ADMIN_UIDS`；未读取或修改账号密码。
- 发布验证：仅重建 API 容器，Web、MySQL 和共享 Nginx 网关未停止；API 健康接口返回 200，生产认证开关仍为 `NODE_ENV=production`、`AUTH_DEV_MODE=false`、`AUTH_PASSWORD_ENABLED=true`、`WECHAT_MOCK_MODE=false`。
- 运行验证：服务端管理员 UID 配置与账号身份映射一致；`ecs-verify.sh` 通过，正式 release、域名入口、未知 Host 拒绝、共享端口、产物哈希、无开发认证依赖和迁移计数 36 均通过。
- 状态：配置和服务端重建已完成，当前为“待用户复核”；请用户退出后重新登录 `D0796`，人工确认管理员页面和节假日管理功能。小程序 AppSecret 仍需在微信平台重置后再更新通知配置。

## 2026-08-14 关联原有群组到正式账号

- 变更：核对生产数据库后发现原有 1 个正式群组仍由已退役旧管理员身份持有，`D0796` 尚无该群组成员关系；已将个人资料显示姓名确认为“林恩宇”，并在单一数据库事务中完成群主转让。
- 数据结果：`D0796` 现在是该群组的 active `owner`；旧退役账号的原成员记录保留为 active `administrator` 历史关系，不删除原群组、群组编号或排班数据。
- 运行验证：群主 UID、owner 成员关系和旧管理员关系核验一致；原有 2 个排班周期仍在；正式域名 API 健康接口返回 200。
- 异常处理：第一次 SQL 因 `groups` 为数据库保留字而未提交，事务自动回滚；修正后重新执行成功，未产生部分写入。
- 状态：数据库关联已完成，当前为“待用户复核”；请用户退出后重新登录 `D0796`，确认群组显示姓名“林恩宇”和群主操作权限。

## 2026-08-14 群组页面与群组码展示修复

- 回归定位：群组 API 已返回 `D0796` 的 owner 群组，但前端只把群组放在下拉选择器中；群组码更新接口返回新码后，群组管理面板没有持久显示 `groupCode`。相关展示和刷新逻辑最初来自提交 `1b5a17a`，调用点已通过 `git blame` 确认。
- 变更：工作台顶部明确显示当前群组名称、角色和群组码；群组管理面板显示当前群组码；重新生成群组码后使用接口返回值提示，并由父级刷新最新码。
- 测试先行：增加浏览器回归断言后，旧实现因未看到“当前群组码”失败；修复后通过。
- 运行/浏览器验证：pnpm smoke:browser 已通过，覆盖群组列表展示、群组管理页面、重新生成群组码后四位码刷新，以及原有管理员、成员、访客流程。
- 运行验证：`pnpm --filter @schedule/web typecheck` 通过；`pnpm verify` 通过，60 个测试文件、447 个测试通过，29 个数据库集成文件因本机没有测试 MySQL 跳过；生产构建仅有既有的大 chunk warning。
- 发布验证：release `056fc59` 已部署；`ecs-verify.sh` 通过，正式 API 健康接口返回 200，`D0796` 的 `/api/groups` 返回原群组、`owner` 角色和四位群组码。
- 状态：代码修复和正式 Web release 已完成，当前为“待用户复核”；请用户退出后重新登录 `D0796`，确认群组名称、群主权限和群组码刷新。

## 2026-08-14 Web UI 2.0 Storybook 手机预览

- 范围：用户选择 Storybook + 本地浏览器替代 Figma；本轮只完成 Storybook 基础和四个关键手机预览，不改生产 UI、业务/API 或数据结构。
- 测试先行：横滑判定测试先因缺少 `preview-interactions.js` 失败；实现 56px 水平阈值和 1.2 倍水平意图判定后 4/4 通过，覆盖左右横滑、阈值不足和垂直滑动取消。
- 浏览器修正：320px 验收发现图标化筛选按钮缺少无障碍名称，以及部分带事件标识姓名被压窄；补充 `aria-label` 并调整月格行宽后复核通过。
- 运行/浏览器验证：Storybook 390×844 四屏及 320×844 月历无横向溢出、无姓名裁切、可见操作均至少 44px；底栏不遮挡最后一个电话按钮；筛选/更多底部页、登录/注册、请假/审批、月份左滑均实际操作通过，控制台无 warning/error。
- 运行/浏览器验证：`pnpm smoke:browser` 已通过，覆盖登录、管理员、成员、访客和访客访问记录；`pnpm smoke:check-core` 已通过并确认本轮未涉及核心链路文件。
- 运行验证：`pnpm --filter @schedule/web storybook:build`、Web typecheck、4 项横滑测试和 `pnpm verify` 均通过；全仓库为 61 个测试文件、451 个测试通过，29 个数据库集成文件因本机没有测试 MySQL 跳过。
- 状态：Storybook 预览为“待用户复核”；用户确认视觉、月格密度、底栏和详情轨道后，才进入生产令牌与应用框架批次。

## 2026-08-14 Storybook 月历视觉反馈精修

- 回归来源：原姓名彩色背景、纯文字节假日、蓝底白字加/换标识均由 `b903c6d` 引入；已通过 `git log -S` 和 `git blame` 定位到 `Ui2MonthCalendar.vue` 对应调用点。
- 用户确认：整体视觉风格可继续；本轮只精修 Storybook 月历状态，不改生产 UI。
- 测试先行：新增视觉状态测试后先因缺少 `preview-calendar.js` 失败；实现后周末列、多日节假日、单日标识与调休工作日 4/4 通过，连同横滑测试共 8/8 通过。
- 变更：姓名取消背景填充；节假日、调休“班”、加/换复用现有 Web 红/蓝/黄徽标配色；星期六/日表头改为周末红；多日节假日单元格为浅粉背景。使用仓库真实 2026 年国庆 7 天和 10 月 10 日调休数据新增独立状态 Story。
- 运行/浏览器验证：390×844 和 320×844 均无横向溢出、姓名/徽标裁切或小于 44px 的可见操作；7 个国庆单元格背景一致，稳定页面控制台无 warning/error。
- 运行验证：Storybook build、Web typecheck、`pnpm smoke:browser`、`pnpm smoke:check-core`、`pnpm verify` 均通过；62 个测试文件、455 个测试通过，29 个数据库集成文件因本机没有测试 MySQL 跳过。
- 状态：当前为“待用户复核”；确认本轮月历状态后，才进入生产令牌与应用框架批次。

## 2026-08-14 Web UI 2.0 令牌与应用框架

- 回归来源：响应式导航、四个手机主入口和固定底栏由 `db35a77` 引入；账号登录/注册结构由 `de3ad5f` 引入；顶部退出链路由 `e38cdba` 引入。已分别通过 `git log -S` 与 `git blame` 确认调用点。
- 测试先行：新语义令牌、15px 正文/20/28px 标题、4–32px 间距、44px 点触目标及强类型导航图标断言在旧实现上 6 项失败；实现后 4 个定向测试文件、18 项测试通过。
- 语义等价审计：登录/注册/开发登录继续调用原 session 方法，参数、异步等待、错误捕获与跳转范围未变；退出仍只调用 `AppLayout.signOut()` 一次，手机账号区经 Home/Nav 事件上送；导航条目顺序、角色过滤和四个手机主入口未变。未修改 API、契约或数据结构。
- 变更：生产登录页、顶部栏、群组上下文、桌面图标侧栏与手机图标底栏对齐已确认的 Apple Health 式视觉；“更多”改为原生焦点锁定的响应式 Sheet，手机底部页中包含功能分组和账号退出；加入安全区、按压态、键盘焦点、减少动态和底栏避让。
- 运行/浏览器验证：pnpm smoke:browser 已通过；新增 390×844/320×844 登录及工作台断言，无横向溢出，五个底栏入口均不小于 44px，固定底栏贴底且内容预留空间，“更多”底部页含功能/账号分组，原管理员、成员、访客和访问记录流程无错误。
- 本地浏览器验证：1280×900、390×844、320×844 实际登录管理员并操作“更多”与账号区退出；桌面侧栏项均为 44px，手机底栏为 70px、内容预留 94px，原生 dialog 连续 Tab 后焦点仍锁定在页内，控制台无 warning/error。
- 无障碍回归：首次 `pnpm verify` 发现次文字色 `#788492` 的对比度为 3.81:1，低于 4.5:1；已将令牌调整为 `#6B7785`（4.56:1）、重新生成 CSS，并通过 5 个定向测试文件、23 项测试。
- 运行验证：Storybook build、Web typecheck、Web 生产构建、`pnpm smoke:check-core` 和修正后的 `pnpm verify` 均通过；全仓库 62 个测试文件、457 项测试通过，29 个数据库集成文件、252 项测试因本机没有测试 MySQL 跳过，仅有既有的大 chunk warning。
- 状态：UI2-03 checkpoint `11bb812` 已提交并推送；UI2-04 已完成实现、浏览器与全仓库验证，checkpoint 识别消息为 `feat(web): ship responsive application shell`，当前为“待用户复核”。

## 2026-08-14 Web UI 2.0 触屏月历

- 回归来源：生产月格由 `ab250646` 引入，移动端月历行为由 `db35a77` 引入，班次事件入口由 `7ac2a07` 引入，节假日由 `48c6fdd` 引入；Storybook 56px 横滑判定由 `b903c6d` 引入，已通过 `git log -S` 和 `git blame` 核对调用点。
- 测试先行：新增当前月默认今天、其他月份首个有班日期/1 日、56px 水平主导手势、连续多日节假日浅粉范围 4 项断言；旧实现因 3 个函数均不存在而 4/4 失败，实现后连同现有日历及 Storybook 回归共 5 个文件、31 项通过。
- 语义审计：月份按钮、年月输入和横滑均只写入原 `businessMonth`，继续由既有 watch/API 最新请求追踪器加载；选中日期仅在当前响应生效时赋值。筛选仍写入原 `membershipIds`/`roleIds`/`shiftTypeIds`/`onlyChanges`，过滤函数、空值和调用次数不变；月/周/列表及事件按钮链路未改。
- 变更：`MonthGrid` 新增受控 `selectedDate`/`select-date`，手机七列使用 9–12px 自适应总览字号且完整姓名自然换行；连续同名多日休假整段浅粉，单日节日不填充；手机筛选移入响应式 Sheet，桌面保留直接筛选；生产横滑与已确认 Storybook 共用 56px/1.2 倍水平意图函数。
- 运行/浏览器验证：pnpm smoke:browser 已通过；390px 实际验证默认今天、点触换选中、筛选 Sheet、左滑换月、垂直移动取消，无横向溢出或控制台错误，管理员/成员/访客原流程通过。新增 smoke 首次因 Sheet 关闭后的月历位于视口外而手势超时，测试显式滚动到月历后通过，产品代码未为测试特判。
- 运行验证：格式、lint、5 个定向测试文件、31 项测试、Web typecheck、Web build、Storybook build 和 `pnpm smoke:check-core` 均通过；仅有既有的大 chunk warning。checkpoint 识别消息为 `feat(web): add touch-first month calendar`。

## 2026-08-14 Web UI 2.0 选中日期值班轨道

- 回归来源：班次成员/电话展示沿用 `ab250646` 的 `DutyCell`，事件查询与弹窗链路由 `7ac2a07` 引入，实际人员优先与节假日/成员契约由 `48c6fdd` 完善；已复用上一任务的 `git log -S`/`git blame` 结果并逐调用点核对。
- 测试先行：先新增多人班次原排序、实际人员全名优先、电话确认状态、已排班/有变更/待安排状态和中文日期 2 项断言；旧实现因 `selected-date-duty` 模块不存在而失败，实现后 2/2 通过，连同月历定向回归共 4 个文件、25 项通过。
- 语义等价审计：详情模型只读取 `visibleAssignments` 和现有成员契约，不修改筛选或排班；确认号码使用 `tel:`，未确认号码只复制且不写后端。事件按钮仍只调用原 `openAssignmentEvents()` 一次，原 `getGroupEvents(groupId, { pageSize: 100, shiftId })` 的参数、await/catch/finally 和空事件语义不变；仅把展示容器从 TDesign Dialog 换为响应式 Sheet。
- 变更：月历下方新增医疗蓝值班轨道，完整展示班种、岗位、姓名、开始刻度、完整时间范围、现有变更标识、推导状态、电话和事件入口；所有详情操作至少 44px。新增生产组件 Story，包含确认长/短号、未确认号码和换班状态，便于 Storybook 独立复核。
- 运行/浏览器验证：pnpm smoke:browser 已通过；390×844/320×844 下轨道无横向溢出、姓名/时间无裁切、电话/事件操作不小于 44px，事件 Sheet 实际打开加载，底栏不遮挡最后操作；管理员、成员、访客和控制台原回归通过。
- 运行验证：Storybook build、`pnpm smoke:check-core` 和 `pnpm verify` 通过；全仓库 64 个测试文件、463 项测试通过，29 个数据库集成文件、252 项因本机无测试 MySQL 跳过。首次组合验证因外层 120 秒超时关闭管道产生 `EPIPE`，分开重跑后退出码 0，非产品或测试失败。checkpoint 识别消息为 `feat(web): add selected date duty track`。

## 2026-08-14 Web UI 2.0 请假与审批移动工作流

- 回归来源：请假新建表单、三组表格和审批 Dialog 均由 `0d5ec55` 引入，后续日期、影响班次和处理人字段分别由既有工作流提交补充；已通过 `git log -S` 与 `git blame` 核对当前调用点。
- 测试先行：新增 pending/approved/rejected 三态卡片色调与驳回确认文案断言，旧实现因函数不存在而 1 项失败；实现后请假逻辑 8/8 通过。
- 语义审计：初始加载继续以同一 `Promise.all` 调用我的申请、审批列表和默认策略；提交仍只调用一次 `createLeaveRequest` 并在成功后刷新，新增成功关闭 Sheet 仅改变展示状态。审批预览/批准保持原参数、版本、冲突确认、await/catch/finally；取消和撤销调用不变；驳回新增显式确认后仍使用原 API 参数。未修改权限、API、契约或数据结构。
- 变更：手机提供“我的请假/待我审批”分段入口，列表在窄屏变为信息完整的状态卡片；新建表单与审批预览统一迁入 `ResponsiveSheet`，保留桌面对话框和手机底部页行为。所有关键操作至少 44px，状态色使用 UI 2.0 语义令牌，危险操作无滑动手势。
- 运行/浏览器验证：pnpm smoke:browser 已通过；390×844/320×844 实际切换分段并打开新建请假底部页，无横向溢出，起止日期和表单内容完整，关键点触面不小于 44px，原管理员/成员/访客流程与控制台无错误。首次检查到 TDesign 内部 22px 文本节点，其真实外层为 44px，校验改测外层；跨视口分段测试状态重置后复跑通过，未修改产品行为规避测试。
- 运行验证：Web typecheck、生产 build、Storybook build 和 `pnpm verify` 均通过；64 个测试文件、464 项测试通过，29 个数据库集成文件、252 项因本机无测试 MySQL 跳过。并行 build/typecheck 曾在产物完成后触发 Windows Node 退出断言，串行复跑退出码均为 0；仅保留既有大 chunk warning。checkpoint 识别消息为 `feat(web): add mobile leave workflow cards`。

## 2026-08-14 Web UI 2.0 换班与加扣班移动工作流

- 回归来源：换班表单/列表由 `b20ff9b` 引入，管理员直接换班由 `6452fa9` 引入；加扣班表单/列表由 `5d8b205` 引入，管理员可选原因、已受理状态和可撤销归档分别由 `cbe2e89`、`de3acab`、`f65a57d` 补充。已对当前模板执行 `git log -S` 与 `git blame`。
- 测试先行：新增 pending、completed、rejected、cancelled、revoked 六种共享工作流状态的语义色调断言，旧实现因缺少 `getWorkflowStatusTone` 失败；实现后共享工作流、换班与加扣班定向测试 18/18 通过。
- 语义等价审计：两页初始加载仍分别维持原六项 `Promise.all`、群组/月变更重置和窗口聚焦刷新；预览、普通提交、管理员直办、接受、批准、驳回、取消、撤销及设置更新继续调用原 API 一次，参数、版本、`operationId`、可选原因、冲突重载、await/catch/finally 和空值语义未变。新增成功关闭对应 Sheet 只改变显示状态；危险操作继续使用原 confirm/prompt，未增加滑动删除。未修改权限、API、契约或数据结构。
- 变更：换班和加扣班的普通/管理员表单迁入 `ResponsiveSheet`；五类表格在 760px 以下变为完整字段卡片，待操作记录使用医疗蓝侧边强调，状态使用可访问语义徽标；桌面继续保持高密度表格。共用样式以 UI 2.0 令牌实现 44px 点触、320px 堆叠与减少动态。
- 运行/浏览器验证：`pnpm smoke:browser` 已通过；390×844/320×844 实际打开四个 Sheet，确认无横向溢出、移动记录为卡片、关键控件不小于 44px，动画结束后 Sheet 完整位于可视区，管理员/成员/访客原流程及控制台无错误。一次中间断言在入口动画首帧检测到预期的 24px 位移，改为动画完成后验收并复跑通过，产品代码未作测试特判。
- 运行验证：Web typecheck、生产 build、Storybook build、`pnpm smoke:check-core` 和 `pnpm verify` 均通过；64 个测试文件、465 项测试通过，29 个数据库集成文件、252 项因本机无测试 MySQL 跳过；仅保留既有大 chunk warning。checkpoint 识别消息为 `feat(web): add mobile shift workflow cards`。

## 2026-08-14 Web UI 2.0 成员、认领与事件移动卡片

- 回归来源：成员/认领表格、同名认领 Dialog 与联系方式入口由 `d117bb0` 引入；事件筛选、事件表格与详情 Dialog 由 `7ac2a07` 引入；访客访问表由 `4b33749` 引入。已对当前模板执行 `git log -S` 和 `git blame`。
- 测试先行：新增成员待认领/未认领/待审批/已认领和认领申请四态的语义色调断言，旧实现因缺少 `member-presentation` 模块失败；实现后成员呈现、名单解析与事件时间线定向测试 19/19 通过。
- 语义等价审计：成员初始加载仍保持原三项 `Promise.all`、请求版本防旧响应和群组版本刷新；更新角色、添加/转正/删除成员、转让群主、同名检测、创建/撤销/审批认领与联系方式保存继续调用原 API 一次，参数、await/catch/finally、空值和确认文案未变。手机“管理成员”只在关闭 Sheet 后转调原函数，原 confirm 仍是写入门禁。事件群组/筛选 watch、查询构造、分页拼接、详情和访客加载调用保持不变；新筛选组件继续把清空值归一为原空字符串，未增加 API、权限、契约或数据结构变更。
- 变更：成员、认领、事件和访客表在 760px 以下转为完整字段卡片；手机成员主操作直接显示，危险/次级操作进入明确管理 Sheet。联系方式、同名认领、事件筛选和事件详情统一迁入 `ResponsiveSheet`；事件关联链使用 UI 2.0 令牌、15px 叙事正文与 44px 折叠项，桌面表格和直接筛选保持高密度。
- 运行/浏览器验证：`pnpm smoke:browser` 已通过；390×844/320×844 下成员、认领、事件和访客卡片无横向溢出，桌面操作区在手机隐藏，实际打开成员管理、联系方式、事件筛选和详情四类 Sheet，所有关键点触与原始数据折叠项不小于 44px；管理员/成员/访客流程与控制台无错误。四组截图逐屏复核通过。
- 运行验证：Web typecheck、生产 build、Storybook build、`pnpm smoke:check-core` 和 `pnpm verify` 均通过；65 个测试文件、467 项测试通过，29 个数据库集成文件、252 项因本机无测试 MySQL 跳过；仅保留既有大 chunk warning。checkpoint 识别消息为 `feat(web): add mobile member and event cards`。

## 2026-08-15 Web UI 2.0 手动排班矩阵与排班补录触控

- 回归来源：手动矩阵、单元格与视图入口由 `6512274` 引入；排班补录基础页和月历绘制由 `927241c`、`000ed93` 引入，暂存确认链路由 `561310c` 完善。浏览器复核发现空月格在未传 `selectedDate` 时也会被选中，表达式由 UI2-05 的 `7c80488` 引入；以上调用点均已执行 `git log -S` 与 `git blame`。
- 测试先行：新增手动矩阵横向溢出、滚动方向/进度和边界容差测试，旧实现先因缺少 `manual-grid-interactions` 模块失败；新增空月格不应选中测试，旧实现先因缺少独立判定函数失败。实现后月历交互、手动矩阵交互和编辑器逻辑 3 个定向测试文件、19 项全部通过。
- 语义等价审计：手动排班配置、模板列表/历史、节假日、模板增删改、应用批次、草稿删除/预览、周期月历、变更预览、撤回/发布及补录查询/创建的 API 调用次数前后相同；参数、`await`、错误捕获、版本冲突、空值语义和确认流程未变。矩阵按钮和补录暂存移除均只调用原处理函数一次；`select-date`/`open-events` 事件次数未变。唯一独立行为修正为空月格不再误选。
- 变更：手动排班矩阵使用内部横向滚动、固定双层表头与人员首列、方向/进度提示和真实 44px 单元格按钮；移动端保持完整姓名/班次，并优化班次面板、清空操作和保存/应用布局。补录页增加当前配班状态、图标化月份切换、44px 班次/成员/暂存操作和手机全宽七列月历；危险动作继续显式确认，无滑动删除。
- 运行/浏览器验证：`pnpm smoke:browser` 已通过；1280×900、390×844、320×844 实际验证两页无横向溢出或底栏遮挡，矩阵可内部横滑、人员首列位置固定、表头固定、提示/进度随滚动更新、单元格 `aria-pressed` 切换，补录七列完整、空月格中性且关键控件不小于 44px。六张截图已逐屏复核。原 5173 开发进程缓存旧样式，最终使用独立当前源码 5174 服务验收并在完成后停止，未修改原外部进程。
- 运行验证：Web typecheck、生产 build、Storybook build、`pnpm smoke:check-core`、`pnpm verify` 和 `git diff --check` 均通过；全仓库 66 个测试文件、472 项测试通过，29 个数据库集成文件、252 项因本机无测试 MySQL 跳过，仅有既有大 chunk warning。checkpoint `1203dc7`（`feat(web): improve dense schedule interactions`）已推送。

## 2026-08-15 Web UI 2.0 统计、通知与导出响应式界面

- 回归来源：统计成员表与汇总界面由 `36127b0` 引入，当前单元格渲染还包含 `540856e4`/`5cd8860` 的后续调整；通知铃铛、中心和设置由 `52e9e1f` 引入，触发器视觉由 `5b00fa7` 调整，注册警告由 `eab3ff2` 补充；导出对话框由 `15729f8` 引入，后续选择器与角色命名由 `540856e4`/`5cd8860` 调整，首页导出触发器由 `5b00fa7` 调整。以上调用点均已执行 `git log -S` 与 `git blame`。
- 测试先行：新增统计 10 项汇总与横向滚动方向、通知业务语义色调、导出内容/周期摘要断言；旧实现因缺少 `getStatisticsSummaryItems`、`getStatisticsTableScrollHint`、`getNotificationTone` 和 `getExportSelectionSummary` 而 3 个文件、4 项失败（其余 11 项通过），实现后 3 个文件、15/15 通过。
- 语义等价审计：统计的 `getMonthStatistics`、`getYearStatistics`、`refreshMonthStatistics`、`recalculateStatistics`；通知设置的偏好/群组设置/推送订阅读写，通知列表的读取/单条已读/全部已读，铃铛的未读轮询与定时器；导出的配置、任务创建、轮询、下载和 CSV 保存调用次数逐项对比 `HEAD` 均相同。参数、`await`、catch/finally、空值归一、权限门禁和成功/错误路径未改；本批只替换显示容器并新增纯派生文案/滚动状态。
- 变更：统计页改为“值班台账”汇总，原 3 项主指标与 7 项辅助指标全部保留；成员表使用内部横向滚动、固定表头/成员首列及方向/进度提示。通知中心与导出迁入 `ResponsiveSheet`，通知设置改为响应式卡片；导出显示实时选择摘要、安全说明和显式取消/导出操作。手机控件不小于 44px，未增加滑动删除或隐式危险操作。
- 浏览器复核发现并修正两处真实问题：成员表滚动提示最初直接读取非响应式 DOM 值，滚动后文案不更新，改为保存响应式滚动状态；TDesign 通知输入外层最初仍为 32px，补齐真实 `.t-input` 根节点 44px。导出固定操作区会覆盖安全说明，已改为 Sheet 内正常滚动流并复核说明完整可见。
- 运行/浏览器验证：`pnpm smoke:browser` 已通过；1280×900、390×844、320×844 下统计页无页面横向溢出，3+7 指标完整，成员表可内部横滑且表头/成员首列固定，提示与进度随滚动更新；通知设置卡片单列全宽，通知中心和导出均贴底占满手机宽度，关键点触目标不小于 44px。管理员、成员、访客、vkey 与访问记录原流程和控制台无错误。最终截图目录为 `C:\Users\eylin\AppData\Local\Temp\schedule-smoke-yZkNpJ`。
- 运行验证：3 个定向测试文件 15/15、Web typecheck、Storybook build、`pnpm smoke:check-core`、`pnpm verify` 和 `git diff --check` 均通过；全仓库 66 个测试文件、476 项测试通过，29 个数据库集成文件、252 项因本机无测试 MySQL 跳过，仅保留既有大 chunk warning。首轮组合验证因外层 123 秒上限在 Vitest 阶段被终止，延长时限后完整 `pnpm verify` 真实退出码为 0。checkpoint `6ec287d`（`feat(web): polish statistics notifications and exports`）已推送。

## 2026-08-15 Web UI 2.0 群组、配置、访客与应用状态

- 回归来源：群组创建界面由 `1b5a17a` 引入，重新生成群组码由 `caf0a8e` 完善；排班配置及读取链路由 `04c7da3` 引入；访客月历由 `7c783c7` 引入，vkey 访问由 `4b33749` 增加；离线横幅由 `db35a77` 引入。`ResponsiveSheet` 的模板引用守卫由 `5b00fa7` 引入。以上调用点均已执行 `git log -S` 和 `git blame`。
- 测试先行：新增四位群组码保留前导零/角色文案、三步基础配置准备轨道、缺失/失效访客链接与离线只读文案断言；旧实现先因 `group-presentation.js`、`scheduling-config-presentation.js`、`app-state.js` 不存在而 3 个文件失败，实现后连同 PWA 响应式测试共 4 个文件、10/10 通过。
- 语义等价审计：群组创建、加入、名单、改名、重新生成群组码、退出、解散和恢复继续调用原处理函数一次，参数、await/catch/finally 和成功刷新未改；危险确认仅从 TDesign Dialog 换为原生焦点锁定 `ResponsiveSheet`。排班配置加载、新增/保存/删除班种、新增/删除岗位和保存岗位成员的调用次数与参数未改，“准备轨道”只读取已有配置。访客仍只按原 query vkey 调用公开日历 API，月份切换、错误映射和访问记录语义未改；离线展示继续复用 `offlineSubmitMessage`，没有队列或写入。首页群组错误只增加手动重试入口，仍调用原 `refreshGroups()`。
- 浏览器回归：新增 `ResponsiveSheet` 使用后，首次 smoke 先出现 `Cannot read properties of null (reading 'open')`；原因是异步 `nextTick` 返回时组件可能已卸载，模板引用为 `null` 而旧守卫只判断 `undefined`。修复仅将 ref 明确初始化为 `null` 并把空引用作为 no-op，打开/关闭分支、调用次数和事件语义不变。修复后复跑通过。
- 运行/浏览器验证：`pnpm smoke:browser` 通过；新增 1280×900、390×844、320×844 群组/配置/访客断言，以及 390×844、320×844 离线只读断言。无页面横向溢出，群组码四位完整，班种编辑分别为 6/2/1 列，访客月历保持完整七列，关键操作不小于 44px；解散确认 Sheet 实际打开。管理员、成员、访客 vkey、访问记录和控制台原流程无错误，最终截图目录为 `C:\Users\eylin\AppData\Local\Temp\schedule-smoke-yhFCbi`。
- 本地浏览器验证：实际以 390×844 打开缺失访客链接、群组管理和排班配置；状态卡宽 358px、页面无横向溢出，群组码四位完整且控件均达 44px，准备轨道为三步、班种编辑为两列。最终复位临时视口并关闭验收标签页。
- 运行验证：Web typecheck、Storybook build、`pnpm smoke:browser`、`pnpm verify` 和 `git diff --check` 通过；全仓库 69 个测试文件、482 项测试通过，29 个数据库集成文件、252 项因本机无测试 MySQL 跳过，仅保留既有大 chunk warning。smoke 曾因 5173 旧 Vite 进程提供旧访客组件而等待旧文案超时；确认进程属于本仓库后只重启前端预览，API 和数据未改，当前源码复跑通过。
- 状态：UI2-13/14 已完成，checkpoint 识别消息为 `feat(web): polish group config and guest states`；下一批次只做最终全局焦点、减少动态、安全区和跨视口收尾审计。

## 2026-08-15 Web UI 2.0 最终全局收尾审计

- 回归来源：全局 `body`、`#app` 和 `.app-layout` 的 `100vh` 由 `e38cdba` 引入，访客页全屏高度由 `7c783c7` 引入；`ResponsiveSheet` 的原生 dialog 打开/关闭与隐式焦点行为由 `5b00fa7` 引入。以上调用点已执行 `git log -S` 与 `git blame`。
- 测试先行：`global-ui-shell.spec.ts` 的动态视口用例在旧实现上先失败，证明全屏容器缺少 `100dvh`；扩展后的 `pnpm smoke:browser` 首次在 390px “更多”Sheet 首尾 Tab 循环处失败，随后新增组件级焦点锁定/回焦断言并在旧实现上再次失败。修复后定向 4/4 与完整浏览器冒烟均通过。
- 行为与语义审计：`100dvh` 仅在 `100vh` 后覆盖，不支持动态视口的浏览器继续使用回退；没有改变布局分支、数据加载或副作用。`ResponsiveSheet` 保持原 `visible` watch、`showModal`/`close`、`update:visible`、cancel/backdrop 和 slot 语义，新行为仅为记录触发器、聚焦首项、首尾 Tab 循环及关闭后回焦；打开/关闭事件与业务处理函数调用次数不变。未修改 API、契约、权限或数据库。
- 运行/浏览器验证：`pnpm smoke:browser` 已通过；覆盖登录、管理员、成员、访客、vkey 和访问记录，并在 1280×900、390×844、320×844 验证无页面横向溢出、桌面/手机导航切换、底栏避让、44px 点触、2px 可见键盘焦点、Sheet 双向焦点锁定与回焦、`prefers-reduced-motion` 动画时长和关闭入场动画。最终截图目录为 `C:\Users\eylin\AppData\Local\Temp\schedule-smoke-aVpdbz`。
- 本地可视化复核：Storybook 390/320px 节假日月历为完整七列，姓名无背景/无裁切，周末、节假日、加换、调休和多日节假日状态色均与确认规则一致；生产工作台在 1280/390/320px 无横向溢出，320px 内容底部预留 94px。实际键盘操作确认 Sheet 正向循环到“完成”、反向循环到“退出登录”，关闭后回到“更多”。Storybook 验收页继续由 `http://127.0.0.1:6006` 提供。
- 运行验证：`pnpm exec vitest run apps/web/src/pwa/global-ui-shell.spec.ts` 4/4、Web typecheck、Storybook build、`pnpm smoke:browser`、`pnpm verify` 和 `git diff --check` 通过；全仓库 70 个测试文件、486 项测试通过，29 个数据库集成文件、252 项因本机无测试 MySQL 跳过，仅保留既有大 chunk warning。checkpoint 识别消息为 `feat(web): complete UI 2.0 global audit`。
- 完成审计：UI2-01–14 与本轮已覆盖 Storybook 预览、设计令牌/应用框架、月历与手势、值班详情、工作流卡片/Sheet、矩阵/统计、群组/配置/访客/应用状态和全局无障碍/视口规则；所有原计划代码接口已落地，未发现剩余 Web UI 2.0 实现缺口。状态转为待用户整体验收。

## 2026-08-15 Web UI 2.0 正式发布与 D0796 验收

- 同步审计：服务器旧 release `056fc59` 的文件哈希与部署清单完全一致，没有服务器端手工漂移；本地 `main` 比生产新 18 个 UI 2.0 提交。生产和本地数据库结构均为 36 个迁移、45 张表、467 个字段；生产业务数据继续以服务器为准，没有复制密码哈希、令牌、联系方式或用本地演示数据覆盖生产。
- 发布保护：先创建加密数据库备份 `cd707b42-2687-408b-b0ed-1f13a2c1d27e`（44 张业务表、3257 行），再生成并部署不可变 release `5ae4941792db56119f08d07f1ba5543cc3f3b209`。迁移器确认无新增迁移，API/Web 容器健康重建，`ecs-verify.sh` 通过域名、未知 Host、端口、产物哈希、认证模式和 36 个迁移检查。
- 运行/浏览器验证：`pnpm verify`、串行 `pnpm smoke:browser`、`pnpm smoke:check-core`、`git diff --check`、公开首页/API 200 检查均通过；486 项测试通过，252 项数据库集成测试按本机配置跳过。首次 smoke 与全仓库构建并行时遇到 390px 访客卡片 HMR 瞬时状态，构建结束后在独立 5174 服务串行复跑通过，产品代码未修改。
- 正式账号复核：`D0796` 登录成功，账号 active，姓名“林恩宇”，在“头颈外科医生”群组中为 active owner；服务器运行配置确认平台管理员与节假日管理员均生效。桌面群组管理、成员、排班配置、事件和访客访问记录入口正常，未执行任何写操作。
- 正式移动端复核：390px/320px 页面无横向溢出，五个底栏按钮均为 59px 高并固定底部；320px“更多”底部页从视口底部展开，完整包含群组、排班、信息管理和账号区。状态转为待用户直接在正式站点做最终视觉验收。

## 2026-08-15 手机 Sheet 下拉框不可见回归

- 回归来源：手机月历筛选由 `7c80488` 引入，换班/加扣班表单迁入 Sheet 由 `2bb9fce` 引入；共用 `ResponsiveSheet` 的原生 `showModal()` 由 `5b00fa7` 引入。已对相关模板和调用点执行 `git log -S` 与 `git blame`。
- 根因：TDesign Select 默认把选项浮层挂到 `body`；原生模态 `dialog` 位于浏览器 top layer，浮层因此落在模态层之外而不可见、不可交互。
- 测试先行：新增回归测试后先因共享挂载策略模块不存在而失败；实现后 4/4 通过，并约束首页手机筛选 3 个、换班 7 个、加扣班 4 个 Select 全部复用同一挂载策略。
- 行为与语义审计：只把上述 Select 的浮层容器改为其最近的已打开 Sheet；选择值、`v-model`/`change`、选项生成、清空、预览/提交、异步错误路径、API 调用和调用次数均未改变。非 Sheet 场景继续使用 TDesign 默认 `body` 挂载语义。
- 运行/浏览器验证：`pnpm smoke:browser` 使用当前源码的隔离 5174 服务通过；390×844/320×844 实际点击首页筛选、换班和加扣班下拉框，选项层均位于已打开 Sheet 内且有可见尺寸，管理员、成员、访客和访问记录全流程无浏览器错误。首次运行命中 5173 上不含开发登录入口的外部进程而在登录门禁停止，未进入产品断言；未修改该进程。
- 运行验证：定向测试 4/4、Web typecheck、`pnpm verify`（71 个测试文件、490 项通过，29 个数据库集成文件、252 项因本机无测试 MySQL 跳过）和 `git diff --check` 通过，仅保留既有大 chunk warning。状态为“已完成”，checkpoint 识别消息为 `fix(web): keep sheet dropdowns visible`。
- 正式发布：发布前 `ecs-verify.sh` 通过并创建加密数据库备份 `48b7e00f-19b3-4577-aefa-dad10a0ad0bd`（44 张表、3701 行）；release `af37f5e4ecf5abcc86ac7460361bbfb47ba4c8c4` 部署成功，产物哈希、API/Web 容器、域名隔离、无开发认证依赖和 36 个迁移检查通过。部署未复制或覆盖本地数据库。
- 持续规则：用户要求今后每个完成并推送的仓库修改检查点都直接部署并线上核验；生产业务数据始终以服务器数据库为准，禁止用本地库、演示数据、凭据或会话覆盖生产。该规则写入根 `AGENTS.md`，最终状态 checkpoint 识别消息为 `docs(status): require production deployment after changes`，并作为最终 release 部署以保持服务器 release 与 Git `HEAD` 一致。
- 最终一致性：自动部署规则的收口 checkpoint 识别消息为 `docs(status): confirm automatic deployment policy rollout`；该 checkpoint 作为正式 release 部署后，以 Git `HEAD` 和服务器 `current-release` 相等为完成门禁，不再用发布后的追加文档提交制造新偏差。

## 2026-08-15 微信网站认证与 ICP 备案展示

- 来源定位：工作台应用壳与登录入口由 `e38cdba` 引入，访客入口由 `7c783c7` 引入；已对三个当前模板执行 `git log -S` 与 `git blame`。本轮不是回退既有功能，而是在ICP备案通过后补充统一合规页脚。
- 测试先行：认证文件上线前，公网验证 URL 返回 1136 字节应用首页 HTML；加入公共根目录文件后生产产物为指定 41 字节正文。ICP 页脚测试先因 `SiteComplianceFooter.vue` 不存在失败；实现后 2/2 通过，并约束登录、访客和已认证应用壳均接入同一组件。
- 行为与语义审计：认证文件只增加静态站点资源；ICP 页脚只渲染外部工信部链接。登录/注册、开发登录、访客解析、会话恢复、路由、API、错误路径、空值、权限和业务副作用均未修改，原调用次数不变。
- 运行/浏览器验证：`pnpm smoke:browser` 在正确启用 `AUTH_DEV_MODE=true` / `VITE_AUTH_DEV_MODE=true` 的当前源码服务下通过，覆盖登录、管理员、成员、访客 vkey 和访问记录，全流程无浏览器错误。首轮因 5173 未启动而连接失败，第二轮因开发认证开关未启用而在登录门禁停止，均未进入产品断言；按既有验收配置启动后原样复跑通过。
- 本地浏览器验证：1280×900 登录页及 390×844 登录、无 vkey 访客、已认证工作台均找到唯一的 `https://beian.miit.gov.cn/` 链接，文字为 `粤ICP备2026116116号-1`，链接实际点触高度均为 44px；390px 下底部导航避让后仍完整位于视口内。
- 生产认证文件：checkpoint `859f28d` 发布前后 `ecs-verify.sh` 通过；加密数据库备份 archive `0c70b166-8d94-4a51-920c-5922ca046753`（44 张表、4856 行），release `859f28d376e13f90dc4dced83c974aed12d84f5f` 已上线。公网验证 URL 返回 200、`text/plain`、41 字节且正文精确匹配。
- 运行验证：定向测试 2/2、Web typecheck、`pnpm smoke:browser`、`pnpm smoke:check-core`、`pnpm verify` 和 `git diff --check` 通过；全仓库 72 个测试文件、492 项测试通过，29 个数据库集成文件、252 项因本机无测试 MySQL 跳过，仅保留既有大 chunk warning。
- 正式发布：发布前 `ecs-verify.sh` 通过并创建加密数据库备份 `d6e8a335-c0cf-4a5f-8257-666d992a136b`（44 张表、4887 行）；release `fb192d3cbf83191b0e50fec4ffc6b68399d3245d` 部署成功，产物哈希、API/Web 容器、域名隔离、无开发认证依赖和 36 个迁移检查通过。
- 生产浏览器复核：1280×900 正式登录页、390×844 正式登录页和无 vkey 访客页均存在唯一备案链接，文案、目标 URL、`rel` 和 44px 点触高度正确；微信认证文件继续返回 200、`text/plain` 和精确 41 字节正文。
- 状态：微信认证文件和 ICP 页脚均为“已完成”，当前转为“待用户复核”；只等待用户在微信侧完成管理员认证/临时恢复并反馈结果。

## 2026-08-16 工作台紧凑抬头、月历与 ICP 范围精修

- 回归来源：常驻工作台介绍与顶部壳由 `5b00fa7` 引入，常驻四位群组码由 `056fc59` 引入，三类入口共用 ICP 页脚由 `fb192d3` 引入，触控月历与月份切换由 `7c80488` 引入；已对当前调用点执行 `git log -S` 与 `git blame`。
- 测试先行：新增正式工作台标题映射、紧凑群组选择器、登录页专属 ICP、圆角完整月历和周末红字断言；旧实现定向运行 8 项失败、8 项通过，实现后连同 Storybook 预览共 4 个文件、22/22 通过。
- 变更：移除占空间的产品 Logo/“医护排班”招牌、工作台介绍、重复群组标题与常驻群组码；顶部改为“群组名称 · 身份 + 下拉”及当前功能标题，通知/导出保持同排。日历复用 Mobile Screens 2 的 44px 紧凑分段、18px 圆角六周月历、月份切换、选中日期胶囊和周末红字；换班与加扣班复用同一标题位置。ICP 仅登录页显示，透明融入画布并保留 44px 点触与浅蓝焦点反馈。
- 语义审计：`GroupSwitcher` 保留 `modelValue`/`update:modelValue` 契约、一次 emit 与同一群组持久化/返回日历链路；通知铃从应用壳移入工作台但轮询和打开行为不变，退出仍转调同一 `signOut`，导出仍只打开原对话框。月份切换、年月输入、触控手势、筛选、日期选择、值班详情、加载与错误路径继续调用原处理函数一次；本轮未修改 API、权限、认证、路由、数据库或共享契约。ICP 的链接、文案、`target` 与 `rel` 不变，仅按用户要求缩小渲染范围。
- 运行/浏览器验证：`pnpm smoke:browser` 通过；1280×900、390×844、320×844 下紧凑抬头高度 68px、群组入口不少于 44px、页面无横向溢出，完整六周月历为 18px 圆角，月/周/列表/筛选字体不大于 13px，星期六/日及所属日期为红字。工作台/换班/加扣班标题随底栏切换且无旧招牌、介绍、全局群组码或 ICP；登录页备案链接透明融入画布并保持 44px。管理员、成员、访客、vkey 与访问记录原流程及控制台无错误，最终截图目录为 `C:\Users\eylin\AppData\Local\Temp\schedule-smoke-SNFidG`。
- 预览与构建：Storybook 提供 390/320/1280 工作台、换班、加扣班与登录页页脚预览；正式 390px 工作台截图逐屏复核通过。Web typecheck、Storybook build、`pnpm smoke:check-core`、`pnpm verify` 与 `git diff --check` 通过；全仓库 74 个测试文件、505 项测试通过，29 个数据库集成文件、252 项因本机无测试 MySQL 跳过，仅保留既有大 chunk warning。
- 正式发布：代码 checkpoint `daff238` 已推送；发布前 `ecs-verify.sh` 通过并创建加密数据库备份 `43f639de-86a9-4090-9209-e46b443310b7`（44 张表、5245 行）。release `daff238e241c0b6d9c04f0c8b21b5cca3b356ca4` 部署成功，迁移器确认仍为 36 个迁移，API/Web 容器、产物哈希、正式域名、未知 Host 拒绝和无开发认证依赖检查通过。
- 生产浏览器复核：使用正式 `D0796` 会话在 390×844 核对工作台抬头 68px、群组选择目标 44px、月历圆角 18px、无横向溢出、无产品招牌/全局群组码/ICP；星期六、日及对应日期计算色均为 `rgb(224, 49, 49)`。实际切换换班和加扣班后顶部标题分别正确，内容区不再重复标题；未触发任何业务写入。最终状态 checkpoint 识别消息为 `docs(status): record compact workbench production deployment`。

## 2026-08-16 月历跨午夜业务日修复

- 回归来源：`getChinaStandardTimeBusinessDate` 由 `7a16c85` 统一，`getCurrentBusinessMonth` 的当前月边界由 `927241c` 引入；`CalendarView` 的当前月、业务日和默认选中日期调用点已执行 `git log -S` 与 `git blame`。
- 测试先行：先增加“00:00 后仍为上一业务日、08:00 才交接”和月初当前月边界断言；旧实现定向运行失败 3 项，实现后三个定向文件 24/24 通过。完整 `pnpm verify` 通过：74 passed、29 skipped，506 passed、252 skipped（本机无测试 MySQL）。
- 语义审计：仅将业务日边界从 00:00 调整为中国标准时间 08:00；`formatChinaDateTime` 的自然时间展示、`toChinaStandardTimeShiftRange` 的跨午夜范围、日期选择/月份 API 参数、错误路径、权限、契约和数据库均保持原语义。00:00–07:59 的当前月、过去日期锁定及默认日期统一落在上一业务日，08:00 起切换。
- 运行/浏览器验证：`pnpm smoke:check-core` 通过；专项月历浏览器断言通过，当前 00:xx 环境默认选中 `2026-08-15`。完整 `pnpm smoke:browser` 已通过月历交互与新日期断言，随后在未纳入本轮的并发 `MonthGrid`/手动排班横滑改动处失败（固定列或进度提示断言），因此不报告完整 smoke 通过。当前工作区复跑 `pnpm verify` 唯一失败为 `workbench-shell-refinement.spec.ts` 仍断言旧 `.t-radio-button`，与并发未提交的原生 `.view-mode-button` 改动冲突；不修改该用户变更。提交前还需复核 `git diff --check`。
- 本轮变更文件仅为 `packages/scheduling-domain/src/time.ts`、对应测试、两个月历 helper 测试和 `scripts/smoke-browser.mjs`；工作区中其他 UI 文件保持用户改动，不纳入提交。
- 状态：已完成（含月历专项浏览器验证）→ 待用户复核；checkpoint 识别消息为 `fix(web): keep calendar on previous duty date until handover`。

## 2026-08-16 Mobile Screens 2 月历视觉一致性

- 引入点：月历工具栏和移动样式来自 `7c80488`，通知入口来自 `52e9e1f`/`5b00fa7`，月格结构来自 `ab25064`；相关调用点已完成 `git log -S` 和 `git blame`。
- 测试先行：新回归测试在旧实现上因缺少 42 格展示模型而失败；实现后新增测试 4/4、工作台壳测试 5/5 通过。`pnpm smoke:browser` 首轮因 5173 未启动停止，服务启动后先定位到相邻月禁用格，修正 smoke 只选择可用当月日期后全流程通过。
- 行为变化：月/周/列表与筛选控件、通知铃、星期栏和月格比例按 Storybook Mobile Screens 2 的量测值实现；月历固定六周 42 格并显示相邻月日期，相邻日期不可选。API、权限、业务日期、筛选值、月份切换、通知轮询和抽屉行为未改。
- 运行/浏览器验证：390×844 实测分段容器 50px、按钮 44px/13px、筛选 44px/13px、通知 44px/15px 圆角、星期栏 28px，月格 49×49；320×844 月格约 41×41，两个视口均无内容横向溢出。1280×900、月/周/列表切换、筛选及通知 Sheet 均复核通过。
- 运行验证：Storybook build、Web typecheck、`pnpm smoke:browser`、`pnpm smoke:check-core`、`pnpm verify` 和 `git diff --check` 通过；75 个测试文件、510 项测试通过，29 个数据库集成文件、252 项因本机无测试 MySQL 跳过。checkpoint 识别消息为 `fix(web): match mobile calendar Storybook styling`。
- 正式发布：发布前 `ecs-verify.sh` 通过并创建备份 `fa99e3d2-0dbf-472a-8837-3fbde4dfbe2e`（44 张表、5367 行）；release `abd20d2aa94ce3425bff446047db094542aa2466` 部署及复核通过。
- 生产浏览器复核：390px 月格 49×49、320px 月格 41.14×41.14，均为完整 42 格且无内容横向溢出；星期栏填充、周末红字、相邻月日期、工具栏、通知铃、月/周/列表、筛选与通知 Sheet 均通过。未触发业务写入。最终状态 checkpoint 识别消息为 `docs(status): record mobile calendar parity deployment`。

## 2026-08-16 Mobile Screens 2 星期栏单线回归

- 引入点：移动 `MonthGrid` 的网格间隙/分隔色背景由 `7c80488` 引入，星期栏 `border-bottom` 由 `abd20d2` 引入；本轮对 `MonthGrid.vue` 执行了 `git log -S` 与 `git blame`，确认重复分隔线的来源。
- 根因：`.month-grid` 已用 `gap: 1px` 和边框色背景绘制星期栏与首行之间的分隔线，`.weekday-row` 又追加 `border-bottom: 1px`，该边界实际占两层。
- 测试先行：新增回归断言后旧实现 5 项中 1 项失败；移除重复底边后 `mobile-calendar-storybook-parity.spec.ts` 5/5、日历相关 31/31 通过。
- 变更与语义审计：仅删除移动 `.weekday-row` 的重复 `border-bottom`；没有改变模板、日期选择、相邻月份禁用、选中态、API、权限、错误路径、调用次数或副作用。Storybook 参考组件不变。
- 运行/浏览器验证：Storybook build、Web typecheck、`pnpm smoke:check-core`、`pnpm verify`、`git diff --check` 通过；本地源码 390×844 与 320×844 均测得 42 格、1:1 月格、`weekday-bottom-border=0px`、首行间距 1px、body 无横向溢出。完整 `pnpm smoke:browser` 因既有未提交的紧凑抬头/群组选择改动在早期断言停止，未归因于本轮。
- 状态：已完成（含运行验证）→ 待用户复核；checkpoint 识别消息：`fix(web): avoid stacked mobile calendar separators`。
- 正式发布：checkpoint `de69384` 已推送；备份 archive `c9785dbd-b267-4cfa-afc4-cb1f9556b57f`（44 张表、5406 行）；release `de69384164c6806e939ec6f9d67355e0d8710170` 已部署。
- 正式域名复核：390×844 月格 49×49、320×844 月格 41.14×41.14，均为 42 格、星期栏底边 `0px`、首行间距 `1px`，无横向溢出；`ecs-verify.sh` 通过，未触发业务写入。

## 2026-08-16 工作台抬头回退与自绘群组箭头

- 回归来源：工作台抬头和原生群组选择器由 `daff238` 引入，本轮已对 `HomeView.vue`、`GroupSwitcher.vue` 及冒烟断言执行 `git log -S` 与 `git blame`；退出入口确认仍由 `WorkbenchNav.vue` 的“更多”抽屉提供。
- 测试先行：按最新参考图把抬头断言改回“群组行在上、工作台在下、两者左对齐”；当前三列实现先有 6 项失败，回退后正式壳/Storybook 11/11 通过。
- 变更：恢复原有左侧上下排列和右侧铃铛/导出结构；群组控件继续不使用 `<select>`，改为透明背景的分体式箭头按钮，点击右侧线条箭头在控件下方展开自绘列表，支持键盘、Esc、Tab、点击外部关闭和 44px 触达区。导出仍仅 owner/administrator 显示；退出登录未移回顶部。
- 运行/浏览器验证：`pnpm smoke:browser` 已通过；管理员、成员、访客、vkey 与访问记录全流程无浏览器错误，1280×900、390×844、320×844 无横向溢出，群组箭头为自绘 `combobox` 且打开后为下方 `listbox`，退出登录从“更多”抽屉完成。首次冒烟仅发现旧脚本仍查找 `#group-switcher` 和顶部退出按钮，已同步验证器到最新布局后复跑通过。
- 预览与验证：Storybook `GroupMenuOpen390` 已在 390px 实际展开/关闭预览；Storybook build、Web typecheck、定向测试 11/11、`pnpm smoke:check-core`、`pnpm verify` 和 `git diff --check` 均通过。全仓库 75 个测试文件、511 项测试通过，29 个数据库集成文件、252 项因本机无测试 MySQL 跳过；Storybook 仅保留临时配置下的 addon 解析提示、CSF 解析提示和既有大 chunk warning。
- 正式发布：网络恢复后生成 release `42c342529c8cf1e9b3f125b3ae6b3c2928b33043`；发布前加密数据库备份 archive `5dba4d9d-6a0a-4a2f-98ea-c16d8419859a`（44 张表、5410 行）。`ecs-update.sh` 成功完成迁移、API/Web 重建并写入 current-release。
- 正式核验：服务器 `ecs-verify.sh` 退出码 0；正式 D0796 会话实际展开/关闭群组 `combobox`，listbox 显示 2 个选项，Escape 可关闭，抬头/通知/导出存在且浏览器控制台无 error/warning。状态：已完成（含生产发布与线上核验）→ 待用户复核。

## 2026-08-16 群组下拉选项蓝色状态重叠

- 反馈：群组下拉展开后上下选项的浅蓝选中/悬停背景相互贴合，视觉上像蓝色框重叠，选项之间没有间隔。
- 引入点：自绘 `.group-switcher-menu` 与 Storybook `.group-menu-list` 来自 `3febef0`；已执行 `git log -S 'group-switcher-menu'` 和 `git blame`。
- 测试先行：新增两个 CSS 结构回归断言；旧实现运行结果为 2 项失败、9 项通过。加入菜单容器 `display: grid` 和 `gap` 后，`apps/web/src/views/workbench-shell-refinement.spec.ts` 与 `apps/web/src/stories/ui2/workbench-shell-refinement-preview.spec.ts` 共 11/11 通过。
- 修复：正式菜单使用 `gap: var(--ui-spacing-xxs)`，Storybook 预览使用 `gap: 4px`；仅分隔选项背景，不改变选项触达高度、选中逻辑、键盘导航、关闭行为或任何 API/权限链路。
- 运行/浏览器验证：`运行/浏览器验证：pnpm smoke:browser` 已通过（管理员、成员、访客、访问记录全流程无浏览器错误）；Web typecheck、`pnpm smoke:check-core`、任务文件 Prettier、`git diff --check` 通过。全仓 `pnpm format:check` 被既有未跟踪日历测试文件的格式问题阻塞，未改动该文件。
- Storybook 实际复核：390×844 `GroupMenuOpen390` 的菜单计算 `gap = 4px`、`row-gap = 4px`，选项数量 2，截图确认上下状态背景之间有可见留白。
- 正式发布：代码 checkpoint `4857e76` 已推送；发布前加密数据库备份 archive `ccdd8bf2-9a7f-4e8d-b1c1-198a95cd6d05`（44 张表、5442 行）；release `4857e76e976e0010d2f52520e23fc73babb88c1e` 已部署。
- 正式核验：服务器 `ecs-verify.sh` 退出码 0；正式 D0796 会话测得 `gap/row-gap = 4px`，选项高 62px、上下顶部差 66px，Escape 后 `aria-expanded=false`、listbox 数量为 0、原生 `select` 数量为 0；工作台/通知/导出各 1 个，error/warning 日志为空。
- 状态：已完成（含生产发布与线上核验）→ 待用户复核；代码 checkpoint 识别消息：`fix(web): separate group dropdown option states`。

## 2026-08-16 工作台群组名垂直间距精修

- 用户反馈：群组名上下留白过大，抬头整体高度被 44px 群组内容行撑开，需要在保持触达能力的同时收紧视觉行高。
- 引入点：当前群组切换器结构来自 `3febef0`；本轮执行 `git log -S` 与 `git blame`，确认问题只涉及 `.group-switcher`/`.group-switcher-trigger` 的最小高度与箭头定位。
- 测试先行：正式壳和 Storybook 断言在旧实现上 2 项失败、9 项通过；改动后 11/11 通过。箭头仍为 44px 触达区，文字行恢复内容高度。
- 修复与审计：移除视觉行的 44px 最小高度，箭头绝对定位居中，菜单锚点下移以保持 8px 间距；未改群组值/事件、键盘与关闭行为、权限、导出或抽屉退出登录。
- 运行/浏览器验证：`运行/浏览器验证：pnpm smoke:browser`、Web typecheck、生产 `pnpm build`、Storybook build、`pnpm smoke:check-core`、定向测试 11/11、任务文件 Prettier 与 `git diff --check` 通过。Storybook 390px 抬头 94px → 70.25px，群组文字行 20.25px，箭头 44px，菜单间距 8.13px。
- 发布修正：首次 `ecs:package` 复用了旧 `apps/web/dist`，首次线上核验仍为 44px 群组行；按当前源码重新 `pnpm build`、打包并部署同一 commit，未将首次结果视为最终发布。
- 正式发布与核验：代码 checkpoint `e841c53` 已推送；最终部署前备份 `056ea6a5-2bf1-4df0-ac6e-a989206f224e`（44 张表、5531 行），release `e841c53f0462ddf5987cb02266abaaf50e12a501` 已部署，`ecs-verify.sh` 退出码 0。正式 1280×720/390×844 抬头均为 68px、群组文字行 20.25px、箭头 44px；移动无横向溢出，listbox 2 项且 `gap/row-gap = 4px`，Escape 可关闭、原生 `select` 为 0，日志无 error/warning。
- 状态：已完成（含生产发布与线上核验）→ 待用户复核。checkpoint 识别消息：`fix(web): compact group header spacing`；最终状态 checkpoint：`docs(status): record compact group header deployment`。

## 2026-08-16 连续周视图、列表一致性与微信移动满宽修复

- 回归来源：周卡动态高度、月内周标签和列表卡片精修由 `8a49434` 引入；请假标题 `max-width: 220px` 来自 `2d6f0a2`，换班/加扣班标题与操作宽度来自 `2bb9fce`，成员标题 `max-width: 230px` 来自 `23c1d9f`，窄屏群组码 `space-between` 来自 `bfa0755`。本轮已对各关键表达式执行 `git log -S` 与 `git blame`。
- 测试先行：连续周月份、双月周标题、班种两字符截断、月式周网格、Storybook 列表一致性和移动满宽源码断言先在旧实现失败；浏览器进一步发现未定义显式 Grid 单列轨道时按钮仍会收缩到 247px，新增 `minmax(0, 1fr)` 断言后旧 CSS 2 项失败，实现后定向 27/27 及工作台壳 5/5 通过。
- 语义审计：跨月周只增加第二个月的只读日历 GET，并把 assignments 合并到原模型；请求追踪、Promise 拒绝范围、空值降级、节假日失败降级、筛选、电话、事件和日期选择处理不变。周切换仅改变 `weekStart`/选中日期，不再同步修改月视图月份，这是明确的产品行为变更。移动工作流和群组码只改 CSS，无 API、权限、数据或副作用变化。
- 运行/浏览器验证：`pnpm smoke:browser` 包装器因本机 `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY` 未进入脚本；等价命令 `SMOKE_BASE_URL=http://127.0.0.1:5174 node scripts/smoke-browser.mjs` 首轮在 Sheet 动画瞬间误判 44px“完成”按钮，独立测量为 44×44px，原样第二轮通过管理员、成员、访客、vkey 与访问记录全流程且无浏览器错误。Web typecheck、生产 build、Storybook build、Prettier、ESLint、全仓 Vitest（78 passed/29 skipped；533 passed/252 skipped）和 `git diff --check` 通过。
- 浏览器量测：Storybook 390px/320px 周视图七列 `scrollWidth = clientWidth`，七格高度一致，班种标签 `white-space: nowrap` 且最多两字符；Storybook 与正式页均实测“7月第5周-8月第1周”后右切为“8月第2周”，预览周六/日无额外“休息”标识。列表固定工具栏、今天卡、数量、元数据和电话入口与 Storybook 一致。390px 请假/换班/加扣班/成员使用 351px 单列满宽；320px 群组码按 40px 数字块、4px 间距向左聚合。
- 正式发布与核验：代码 checkpoint `a1a732a` 已推送；发布前加密数据库备份 `a238d4aa-4332-4f1a-83bf-74c18b8dc60c`（44 张表、6147 行），release `a1a732a8d675ba759b27b96a7986294b7498327f` 已部署，`ecs-verify.sh` 退出码 0。正式 390px 跨月周标题及下一周连续，周网格无横向滚动且七格等高；列表固定工具栏和今天卡正确。请假/换班/加扣班/成员满宽，320px 群组码左聚合，未触发业务写入。
- 状态：已完成（含生产发布与线上核验）→ 待用户复核。代码 checkpoint：`fix(web): unify continuous calendar and mobile layouts`；最终状态 checkpoint：`docs(status): record continuous calendar deployment`。

## 2026-08-16 日历圆角选中框与周视图今天状态修复

- 回归来源：移动月历直角格/圆角裁切来自 `7c80488`；周视图今天整格描边来自 `a1a732a`，Storybook 今天整格背景来自 `8a49434`、描边来自 `a1a732a`。已执行 `git log -S` 与 `git blame`。
- 测试先行：新增圆角末格和唯一选中态断言，旧实现 3 项失败/21 项通过；实现后定向 24/24、全仓 Vitest 79 文件/537 项通过，29 个数据库集成文件/253 项按环境跳过。
- 变更与语义：只让月历末行首尾、周历周一周日继承对应底部圆角，并移除周视图未选中今天的整格蓝框；黄色日期圆点、`aria-current`、选中事件、详情及全部业务/API 语义不变。
- 运行/浏览器验证：`pnpm smoke:browser` 通过；Storybook build、Web typecheck/build、任务文件 Prettier/ESLint、任务文件 `git diff --check` 通过。390/320px 实测月视图 8 月 31 日左下圆角、周视图周日右下圆角描边完整；选中 14 日后今天 16 日只保留黄色圆点且无第二蓝框。完整 `pnpm verify` 仅被并发中的无关 API 格式问题拦截，`smoke:check-core` 仅被无关未提交 contracts 变更触发。
- 正式发布与核验：代码 checkpoint `c64f0d7` 已推送；发布前加密备份 `c2412550-9ae2-463f-8d1f-a488a7d9abb0`（44 张表、6218 行），release `c64f0d7f166adc61f0a6f9470f09519175c718e6` 从干净 worktree 构建并部署，`ecs-verify.sh` 退出码 0。正式 390/320px 月视图底角描边完整；周视图点击非今天后，今天仅保留黄色日期圆点、`aria-current=date` 且 `aria-pressed=false`，被选日期是唯一蓝框。
- 状态：已完成（含生产发布与线上核验）→ 待用户复核。代码 checkpoint：`fix(web): align rounded calendar selection states`；最终状态 checkpoint：`docs(status): record rounded calendar selection deployment`。

## 2026-08-16 群组后台管理与导出修复

- 回归来源：`export-jobs` 调度遗漏为 `eab3ff2`；随机群组码为 `1b5a17a`；成员认领界面为 `d117bb0`；电话确认权限为 `8e42afb`。均已通过 `git log -S` 与 `git blame` 核对。
- 测试先行/集成验证：新增导出调度、手填群组码/同名预设绑定、developer admin 跨群隐藏权限、普通用户禁改名和 admin 专属历史认领覆盖。隔离 MySQL 实测空库迁移至第 37 版并重复运行成功；相关 API 集成断言均通过。
- 运行/浏览器验证：`pnpm smoke:browser` 通过（管理员、普通成员、访客/vkey 与访问记录全流程无浏览器错误）；390px 普通成员页仅显示本人姓名/联系方式和姓名目录，输入与保存触控区不小于 44px。`pnpm smoke:check-core`、`pnpm verify`（79 个文件/537 项通过，29 个数据库集成文件/251 项按环境跳过）和 `git diff --check` 通过。
- 正式发布：`394b1c8` 已推送并部署；发布前备份 `51bdbfac-39b5-49e4-b203-0ee00d14496b`（44 张表、6226 行），生产迁移为 37，`ecs-verify.sh` 退出码 0。后台账号线上平台权限为真并可见 2 个群组，成员/联系人结果各 7 项且不含隐藏账号；一次 `2026-08` CSV 导出由 `pending` 完成至 `completed` 并成功下载 1551 字节。未为测试在生产创建普通账号，其资料边界已由隔离 MySQL 集成测试和本地浏览器 smoke 覆盖。

## 2026-08-16 成员通讯录与通知开关落地

- 回归来源：成员联系方式被收窄为本人可见、仅后台管理员可管理由 `394b1c8` 引入；成员姓名目录分支同样来自 `394b1c8`，常驻本人输入表单来自 `23c1d9f`；通知开关强制 44px 高度来自 `6ec287d`。均已执行 `git log -S` 与 `git blame`。
- 测试先行：旧后端在隔离 MySQL 中 2 项失败、5 项通过，准确暴露“普通成员只能读取本人、群主确认他人被 403”；旧生产 UI/通知源码断言 4 项失败、1 项通过。实现后成员/通知定向 14/14、Storybook 预览 6/6、群组相关 API 集成 13/13 通过。
- 前后端匹配：同群 active owner/administrator/member 可读取完整有效通讯录；继续排除 guest、停用/删除和隐藏后台账号，跨群 403。普通成员仅能修改本人且不能确认；群主、群管理员、后台管理员均可修改并确认任意有效成员。生产成员页改为统一通讯录、本人无常驻输入框、保存成功关闭 Sheet 并刷新；通知开关由 60×44px 外层点触区承载，TDesign 本体不再被拉高，权限仍只在用户主动开启/重新注册时申请。
- 运行/浏览器验证：`pnpm smoke:browser` 最终通过管理员、普通成员、访客/vkey 和访问记录全流程，无浏览器错误；1280×900、390×844、320×844 成员/通知页面无横向溢出，后台管理员有他人修改入口、普通成员仅有本人修改入口，编辑 Sheet 真实打开；通知外层点触区不小于 60×44px且开关本体低于 44px。前两轮分别准确发现旧 smoke 文案/权限假设和 TDesign 内部 checkbox 尺寸测量问题，只修正验证器目标后原样复跑通过。最终截图目录为 `C:\Users\eylin\AppData\Local\Temp\schedule-smoke-H6ZvoG`。
- 正式只读复核发现群主已具备确认权限但 Sheet 仍沿用“后台确认联系方式”旧文案；新增断言先失败后改为“确认联系方式”，不改变 checkbox 状态、请求 payload、权限或保存链路。修正后 `pnpm verify` 再次通过（83 个文件/548 项通过，29 个数据库集成文件/252 项按环境跳过）。后续 checkpoint 识别消息：`fix(groups): align contact confirmation label`。
- 正式发布：主 checkpoint `6183e9d` 与文案修正 `f9d0889` 均已推送；发布前加密备份分别为 `0ebc4723-ac13-429b-ab62-56c003b99196`（44 张表、6916 行）和 `55cb9743-5f8f-4f1e-a70d-9028f0519d6f`（44 张表、6951 行）。最终业务 release `f9d0889d194a39265f3efb9f8591d44601e00c08` 的 `ecs-verify.sh` 通过；正式 1280/390/320 成员页无横向溢出，Sheet 使用新文案，通知点触区 60×44px、开关本体 52×20px，浏览器日志为空，未触发业务写入或通知权限申请。

## 2026-08-17 手机日历拖动、工作流开关与自定义配色修复

- 回归来源：日历指针捕获/释放和三面板滑动由 `41d284b` 引入，周历底角由 `c64f0d7` 引入；换班与加扣班 checkbox 分别来自 `b20ff9b`、`5d8b205`；原生 `input[type=color]` 与自定义色徽标来自 `41d284b`。相关调用点均已执行 `git log -S` 与 `git blame`。
- 测试先行：新增触屏指针隔离、周历等高/拖动圆角、工作流 CompactSwitch、内嵌色域和徽标居中断言；旧实现 4 个文件 6 项失败、10 项通过，修复后 16/16 通过。
- 变更与语义审计：旧手势清理先清空当前 pointer，再释放捕获，并按 pointerId 忽略延迟的 lost capture；周历三面板等高，拖动中仅移除面板自身底角。换班/加扣班 4 个布尔设置复用 CompactSwitch，原 API 调用次数、boolean payload、异常范围不变。自定义颜色改为页面内 HSV 色域、色相滑杆与 HEX，移除浏览器原生调色器；预设颜色、v-model 更新和应用关闭行为保留。
- 运行/浏览器验证：`运行/浏览器验证：pnpm smoke:browser` 通过（管理员、成员、访客/vkey 与访问记录全流程无浏览器错误）；首次因 5173 未启动、第二次因临时进程未启用开发认证停止，按当前源码与临时开发认证覆盖启动后完成。Storybook 390px 实测无横向溢出、无 `input[type=color]`，色域 298×92px，点击可更新 HEX，“+”徽标视觉居中。
- 正式发布与核验：代码 checkpoint `acd2507` 已推送；发布前加密备份 `b38a4aea-a518-43c9-ba90-b18cc9d31f58`（44 张表、9970 行），release `acd25070b084768beede2fe40bf8c5e51d4fa7de` 已部署，`ecs-verify.sh` 退出码 0。正式周历三面板/当前网格底边精确对齐；换班/加扣班开关为 60×44px 点触区、52×30px 轨道；调色板无原生 color input、色域 308×92px且无横向溢出，浏览器日志为空。全程未保存配置或触发业务写入。

## 2026-08-17 原生触控日历与班种开关滚动位置修复

- 反馈：手机月/周历触屏拖动粘滞或无法通过；2026-09/10/12 月卡被相邻六行月份撑出空白；相同周内容高度随周次变化；班种启停保存会整页刷新并滚回顶部。
- 引入点：`41d284b` 引入 pointer capture + transform 三面板；`8a49434` 引入逐周内容高度；`acd2507` 强制三面板填满；`04c7da3` 在通用保存后调用整页 `loadConfig()`。已完成关键表达式的 `git log -S`/`git blame`。
- 测试先行：旧实现定向 5 失败/5 通过；实现后定向 19/19、Web 全量 410/410。回归断言要求无 pointer capture/`preventDefault`、原生 `scroll-snap`、子月格允许横向 pan、当前面板高度插值、周格 86px 基线，以及启停路径不得调用 `saveShift`/`loadConfig`。
- 修复与语义：采用 W3C 官方规范对应的原生横向滚动和惯性；保留真实前/中/后三页，触摸期间不启动 JS settle 定时器，松手后兼容 `scrollend` 与旧 WebView 回退。高度按滚动进度在三面板间插值，静止时等于当前面板。班种启停使用原 API 一次，成功局部合并返回值、失败恢复开关；通用保存逻辑未改。
- 运行/浏览器验证：`运行/浏览器验证：node scripts/smoke-browser.mjs` 通过。CDP 原生 touch 左滑月/周均切换，竖向主导手势不换月；2026-09 视口/五行面板差值 ≤1px；周七格均不低于 86px、互差 ≤1px、面板/视口底边差值 ≤1px；班种开关保存前后控件屏幕位置差值 ≤8px并恢复原状态。管理员、成员、访客/vkey、访问记录全流程无浏览器错误。
- 其他验证：Web typecheck/build、Storybook build、Prettier、ESLint、smoke core check、`git diff --check` 通过。全仓 `pnpm verify` 被本机 pnpm 无 TTY 生产依赖预检与既有数据库测试清理顺序阻塞；全新测试库仍可复现，与本轮 Web 改动无关。
- 正式发布与只读核验：代码 checkpoint `ee63532` 已推送；发布前加密备份 `f3b9a899-3c1a-41c1-bd26-075198dce913`（44 张表、10765 行），release `ee6353263d87fba18fe1d018e5347e44d1d6e2e2` 已部署且发布前后 `ecs-verify.sh` 通过。正式 390px 的 2026-09 为 35 格，视口/面板高度差小于 1px；周历七格与视口均为 86px；配置页开关点触区 60×44px、无横向溢出、浏览器日志为空，未触发业务写入。最终状态 checkpoint 识别消息为 `docs(status): record native touch calendar deployment`，发布前备份为 `d94afa5f-0192-4cb1-966a-10660d546143`。

## 2026-08-17 日历翻页性能、定位动画、标识密度与统一选择器预览

- 引入点：固定 180ms 程序滚动结算来自 `ee63532`；翻页选择重置来自 `41d284b`/`8a49434`；标识尺寸差异来自 `48c6fdd`/`a1a732a`。均已对修改调用点执行 `git log -S` 与 `git blame`。
- 失败复现与测试先行：旧实现缺少异步资源缓存，性能/选择/定位/标识预期共 7 项失败；追加的程序滚动排队和不得被短 idle timer 覆盖断言也先红后绿。实现后定向 86/86、全仓 Vitest 593/593 通过（253 项数据库集成按默认环境跳过）。
- 修复：程序翻页等待 `scrollend`，旧 WebView 700ms 回退；程序滚动期间不使用 180ms idle settle，连续点击排队。相邻月和节假日按群组缓存，聚焦/冲突强刷；`CalendarReadModel` 和节假日 Map 改为整体替换的 `shallowRef`。选择只在首载初始化，翻页不再重置。定位今天通过现有月/周三面板动画；列表定位不变。日历四类标识统一 16px/14px 高的紧凑几何。
- 语义等价审计：API 接收者与调用方式不变；缓存拒绝时删除条目并沿原 catch 处理，聚焦和冲突路径显式 `forceRefresh`；筛选、空值、最新请求判断、日期点击、详情和副作用次数不变。唯一行为变化是减少重复只读 GET、保持用户选择和为定位增加已认可动画。
- 运行/浏览器验证：`运行/浏览器验证：pnpm smoke:browser` 的包装器受本机非 TTY 依赖检查影响，等价入口 `node scripts/smoke-browser.mjs` 通过管理员、成员、访客/vkey 和访问记录全链路，无浏览器错误。390px 单击翻月、40ms 双击排队、月定位、单击翻周和周定位均观察到中间滚动位移并一次结算；Web typecheck/build、Storybook build、Prettier、ESLint、直接全仓 Vitest 与 `git diff --check` 通过。
- `frontend-design`/Storybook：新增统一月份、日期、时间选择器预览，手机底部 Sheet、桌面邻近浮层，保留医疗蓝、浅蓝摘要和系统字体；390/320/1280 无溢出、键盘焦点、减少动态、44px 主操作与 Axe WCAG A/AA 0 违规。四张确认图位于 `C:\Users\eylin\.codex\visualizations\2026\08\17\schedule-temporal-picker-preview`。生产选择器未改，等待用户确认。
- 正式发布与复核：checkpoint `628c79f` 已推送；备份 `494a53f0-db00-4c97-8469-71308de60e88`（44 张表、11348 行），release `628c79f27816302c781f429d4628be949b5b3f22` 已部署，发布前后 `ecs-verify.sh` 通过。正式 390px 减少动态会话中，月/周单击和定位均一次成功并按偏好即时完成；离开/返回 8 月时原 8月17日选择恢复。9 月“班”标识为 14px/8px/2px/3px，无溢出、日志为空，未写入业务数据。
- 状态：生产日历/标识已完成发布与线上只读复核；选择器仍为待用户确认设计稿。

## 2026-08-18 班种时间弹窗与跨日校验回归

- 引入点：`git log -S`/`git blame` 确认弹窗仅用 `event.target === dialog` 判断遮罩点击由 `92038cd` 引入；班种时间与跨日校验及直接绑定草稿时间由 `04c7da3` 引入，统一时间选择器替换仍保留了该直接绑定。
- 失败复现与测试先行：正式域名桌面端打开 A 班开始时间后点击弹窗外部，弹窗未关闭；新增坐标边界、监听器生命周期、时间顺序同步与 24 小时跨日集成断言后，旧代码因缺少 helper/监听器且后端拒绝 `08:00–次日08:00` 而失败。实现后 Web 定向 7/7、排班配置 API 集成 5/5 通过。
- 修复与语义：`TemporalPicker` 在打开期间使用捕获阶段 `pointerdown` 和可见矩形坐标判定外部点触，关闭/原生 close/卸载均移除监听器；取消仍不发出值变更并恢复原触发器焦点。开始或结束时间完成选择后，仅在双方均非空时把“结束时间早于或等于开始时间”同步为跨日；API 允许 `相同时间 + 跨日` 表示 24 小时，仍拒绝相同时间非跨日及其他不一致组合。权限、事务、保存请求次数和错误恢复路径未改。
- 运行/浏览器验证：`pnpm --config.verifyDepsBeforeRun=false smoke:browser` 通过管理员、成员、访客/vkey 与访问记录全流程且无浏览器错误；本地 Storybook 实际打开时间弹窗后点触面板外立即关闭。Web/API typecheck、Web build、定向 Vitest 与真实 MySQL 集成通过。首次 smoke 在服务未启动、开发登录未开启时按预期停止；一次 44px 瞬时量测失败原样复跑通过。
- 完整 `pnpm --config.verifyDepsBeforeRun=false verify` 的格式与 ESLint 已通过，构建被并行中的无关未提交通讯录测试 `directory-entry-groups.spec.ts` 引用尚未创建的 `directory-entry-groups.js` 阻断；本任务文件级 Prettier/ESLint、Storybook build 与 `git diff --check` 均通过，未修改该无关批次。
- 正式发布与只读复核：代码 checkpoint `b24a5b6` 已推送；发布前加密数据库备份 archive 为 `5b4bbb06-a9b6-4db7-afeb-1b134069a350`（50 张表、18408 行、7290860 字节，SHA-256 `a956b55aee98776927b942a6861273b3caacc088ab5ea7df05a0d21f4a071a5a`）。release `b24a5b6e3e1bbf9be2dc10661dd8d14ef7a9ea23` 从干净 worktree 构建并部署，`ecs-verify.sh` 通过；容器预热首次健康检查 502 后自动恢复。
- 正式域名无写入复核：A 班时间弹窗打开后点击外部，dialog 数量从 1 变为 0、触发器 `aria-expanded` 从 true 变为 false；未保存草稿选择 20:00→08:00 后“跨日”自动变为 true。随后刷新页面丢弃草稿，未点击班种保存/启用，浏览器日志为空。状态：已完成（含生产发布与线上核验）→ 待用户复核。

## 2026-08-18 手动排班刷新与时间选择器响应修复

- 回归来源：`git log -S`/`git blame` 确认手动排班定时刷新由 `eaadbdd` 引入；`b0f5dc6` 将业务日边界调整为中国标准时间 08:00 后，原“业务日 + 次日午夜”算法在 00:00–08:00 会得到过去时刻，并由 1 秒下限退化成循环刷新。选择器左侧图标、90ms 停止防抖和逐项 `scroll-snap-stop: always` 均由 `92038cd` 引入。
- 测试先行：业务交接延迟 helper 缺失、触发框仍有左图标且滚轮仍依赖定时器，旧代码新增用例失败；实现后定向 8/8 通过。用例覆盖 07:45 等待至 08:00+5 秒、09:30 等待次日交接、文字优先触发框、逐帧选中与无强制逐格停顿。
- 实现与语义审计：刷新时间严格按下一个未来的中国标准时间 08:00 交接点计算，初载、窗口聚焦、请求接收者、Promise 错误范围和卸载清理不变。触发框去掉装饰图标，视觉日期压缩为 `YYYY-MM-DD 周X`，完整中文日期保留在 `aria-label`；44px 点触面积、完成才 emit、取消不写值不变。滚轮保留浏览器原生惯性和中心吸附，移除逐项强制停止，滚动中每动画帧更新内部草稿，`scrollend` 只做最终校准；API 与业务副作用次数不变。
- 运行/浏览器验证：`运行/浏览器验证：node scripts/smoke-browser.mjs` 最终通过管理员、成员、访客/vkey 与访问记录全流程，无浏览器错误；前两次分别因本地 5173 未启动和未开启开发认证按门禁停止。主工作区 Vitest（显式排除用户自有 `runtime/**`、`src/**` 副本）109 files / 649 tests 通过；Web typecheck/build、Storybook build、任务文件 Prettier/ESLint、`node scripts/smoke-browser.mjs --check-core` 与 `git diff --check` 通过。完整 `pnpm verify` 的格式、Lint、构建和类型检查已通过，其测试发现并扫描用户自有 `runtime/` 副本后人工停止，未改动这些目录。320px 日期文本 `scrollWidth = clientWidth = 192px`、按钮 44px；390px 时间滚轮 40ms 内由 08:00 更新为 10:00，550ms 后无二次跳变；Storybook Axe 为 0 项违规。
- 正式发布与只读复核：代码 checkpoint `140b3fc` 已推送；发布前加密数据库备份 archive 为 `e409adc5-d2ae-4ab0-8b5a-c039a729ca7d`（50 张表、18447 行、7305428 字节，SHA-256 `77d143990c6ecc14ce7e86052db8ca797964f6c3876bf32673a82b781f7979f5`）。release `140b3fc44f432e18f0f390e9d37003128cb09ae8` 从干净 worktree 构建并部署，`ecs-verify.sh` 通过；容器预热首次健康检查 502 后自动恢复。
- 正式域名刷新到新 Service Worker bundle 后，手动排班页连续 5 秒无加载态或循环刷新；日期触发框显示 `2026-08-18 周二`，无左图标、44px 高且 `scrollWidth = clientWidth = 181px`，完整中文日期仍在无障碍名称。未保存时间草稿 08:00→10:00 在 40ms 内同步标题，550ms 后无二次跳变；点击取消后触发框仍为空值，未保存班种，浏览器日志为空。状态：已完成（含生产发布与线上核验）→ 待用户复核。

## 2026-08-18 P1 MiniTest 清单与 Minium 套件

- 回归来源：`git log -S`/`git blame` 确认基础控件 `dialog-open` 和 7×7 `vertical-scroll` 状态均由 `c8d50f5` 引入；已确认用户通过的 Storybook/原生基础页无对话框，7×7 的 82px 表头加 7×44px 数据行恰好占满 390px，不存在纵向滚动。
- 测试先行：新增 Minium 套件契约测试先因 helper 不存在失败；实现后 4/4 通过，锁定 4 个 `test_*` 方法、18 个截图名、稳定 WXML selector、无凭据边界和单文件根目录确定性 ZIP。Python 3.12 AST 校验通过。
- 修复与实现：清单改为实际交互状态；基础控件使用通知开启、联系方式取消核对和周视图选择，7×7 只测横向滚动，20×30 继续覆盖横纵滚动、失效格、单格更新和撤销。新增官方 `minium.MiniTest` Python 套件、确定性 ZIP 构建器和平台运行手册；生产 WXML 只增加无样式 selector，不改事件、状态、调用次数或业务数据。
- 运行/浏览器验证：Mini 45/45，staging/production verify、11 个 Worklet、确定性、源码/包体、CI/MiniTest dry-run、根 lint/build/typecheck、主工作区 119 文件/703 项、`pnpm smoke:check-core` 与任务文件 Prettier 通过；未触及核心 Web 链路，无需 `pnpm smoke:browser`。根格式检查仅被本轮前用户自有 `apps/miniprogram/project.config.json` 拦截。
- 外部状态：未启动本地微信开发者工具，未生成预览、上传开发/体验版或提交 MiniTest。平台仍需用户上传 ignored ZIP、建立计划并注入仓库外凭据后才能取得 Android/iOS 原生证据。

## 2026-08-18 P1 改为用户人工原生验收

- 决策覆盖：用户明确不使用 MiniTest/Minium 云测，改为用户人工打开微信开发者工具并在实体 Android 测试；用户反馈“通过”后继续 P2。上一节记录的是已推送但尚未部署的 `a9c71d6` 历史实现，现已被本节取代。
- 变更边界：移除云测 API runner、Minium Python/ZIP 构建器、云测命令/凭据说明及为自动化添加的产品 selector；保留 P1 基础控件、42 格月历、7×7/20×30 矩阵、确定性构建、simulate 与可选截图比较器。页面视觉、交互事件、Worklet、业务数据和 API 均未改变。
- 人工门禁：`testing/p1-manual-test-plan.json` 与 `docs/runbooks/manual-native-testing.md` 固定四条路由、实际交互状态、视觉/性能目标及反馈格式。通过不强制截图；失败需给出页面、状态和现象，之后只修失败项。
- 运行/浏览器验证：Mini 10 文件/35 项；staging/production verify、11 个 Worklet、确定性、源码/包体、无凭据 CI dry-run、根 lint/build/typecheck、排除用户自有 `runtime/**`/`src/**` 后主工作区 118 文件/693 项（31 文件/261 项按环境跳过）、任务文件 Prettier、`git diff --check` 和 `pnpm smoke:check-core` 通过。未触及 Web 核心链路，不需要 `pnpm smoke:browser`；根格式检查仅被用户自有 `apps/miniprogram/project.config.json` 拦截。LLM 未启动、唤醒或控制本地微信开发者工具。
- 正式发布：checkpoint `e53f361` 已推送；备份 `6d16b012-6d69-4728-a335-59ad00396999`（50 表、18,497 行、7,370,892 字节，SHA-256 `e6de3f9c748aa3db8b2789f1214bb48fdf61aa42f5293af3ba9f9e629e063eff`）成功。release `e53f3611350fa60c846f2f649f68b4fea9616f41` 从隔离干净 worktree 部署，容器预热首个健康检查一次 502 后恢复，`ecs-verify.sh`、正式首页和 API 通过；此前云测 checkpoint `a9c71d6` 未单独部署。

## 2026-08-18 P1 基础控件安卓按钮轨道与页面滚动修复

- 反馈与引入点：用户人工确认月历 B 通过；实体 Android 的基础控件页四个按钮各保持约半宽却逐行换行，Android 与 PC 开发者工具均无法向下滚动，阻断 A 后续及 C/D。`git log -S`/`git blame` 确认 `.button-cell { width: 50%; padding: 4.5px; }` 和仅依赖普通根节点的基础页均由 `24bc2c4` 引入。
- 测试先行：新增基础页必须使用全高纵向 `scroll-view`、按钮格必须显式 `border-box` 的结构回归；旧代码先因没有滚动容器失败，修复后定向 5/5、Mini 全套 36/36 通过。
- 修复与语义审计：保留 Web 黄金的 390px 两列和 320px 单列，不改按钮尺寸、文案、variant、禁用/加载态或事件；只让 50% 轨道把 padding 计入自身宽度。基础页增加全高原生纵向滚动容器，内容与状态组件结构不变；没有修改已通过月历、矩阵、API、store 或业务数据。
- 运行/浏览器验证：Mini 10 文件/36 项、排除用户自有 `runtime/**`/`src/**` 的主工作区 118 文件/694 项通过（31 文件/261 项按环境跳过）；staging/production verify、11 个 Worklet、确定性、源码/包体、无凭据 CI dry-run、根 lint/build/typecheck、任务文件 Prettier、`git diff --check` 与 `pnpm smoke:check-core` 通过。staging/production 包体为 101,403/101,396 bytes，manifest 为 `b9589e46d2b871df8272fc7662ede7cee6f986f5b59b48344e964944deb6aff6` / `abd93dab69da4b65e6df0cb35f9e95facc0cc6f86a1dd22964b0e331196ec084`。根 `format:check` 仍只被用户自有 `apps/miniprogram/project.config.json` 拦截；未触及 Web 核心链路，无需 `pnpm smoke:browser`。全程未启动或控制微信开发者工具。当前状态为已实现待用户复测基础控件 A，随后继续 C/D。
- 正式发布：代码 checkpoint `9c5c8b1` 已推送；发布前加密数据库备份 archive 为 `1ef4216c-1a80-42aa-86b8-129d5de5ad65`（50 表、18,499 行、7,372,208 字节，SHA-256 `72c3d890b717d8ffc4403e3b8fa213b2c7fc0ca495d0542f03c4913ad3cbd21f`）。release `9c5c8b1ada36dcb88a05e89753fec3b3cac710af` 从干净 worktree 构建并部署；容器预热首个 TLS 健康检查一次断开后恢复，`ecs-verify.sh`、外部正式首页与 API 均通过。最终状态 checkpoint 识别消息：`docs(status): record foundation native fix deployment`。

## 2026-08-18 P1 安卓预览内测试入口

- 反馈与定位：基础页滚动修复在用户 Android 上生效，但月历和矩阵不可见。`git log -S`/`git blame` 确认月历与矩阵自 `1f715c9`/`6cc7463` 起就是独立路由；之前只能在开发者工具切换编译模式，没有预览内入口。
- 设计与实现：依 `frontend-design` 保持临床蓝、病历纸白、系统字体和紧凑卡片；在基础页“状态反馈”后新增“人工测试入口”，三行 52px 原生 `navigator` 分别进入月历、7×7 和 20×30。入口只做测试路由，不把矩阵嵌进基础页，不改变已确认页面的布局、Fixture、事件或 Worklet。
- 测试先行与验证：新增三个精确 URL、入口数量和 52px 触控行断言，旧代码因没有 `navigator` 先失败；实现后定向 6/6、Mini 全套 37/37、排除用户自有 `runtime/**`/`src/**` 的主工作区 118 文件/695 项通过（31 文件/261 项按环境跳过）。staging/production verify 保留 11 个 Worklet，包体为 103,806/103,799 bytes，manifest 为 `3d2ec066cf7f054d7f08e1a182d8dfebcb476beaa844c0559a6d229b62b1e8b1` / `a9e3f8b6d4b0c83fc728e56e4bf00d47b4f291b23674d26aebc2929bf5743847`；确定性、无凭据 CI dry-run、根 lint/build/typecheck、任务文件 Prettier、`git diff --check` 与 `pnpm smoke:check-core` 通过。根 `format:check` 仍只被用户自有 `apps/miniprogram/project.config.json` 拦截；未启动或控制微信开发者工具，当前待用户重新编译并从入口完成 A/C/D。
- 正式发布：代码 checkpoint `e2852ef` 已推送；发布前加密数据库备份 archive 为 `07fb20ed-651b-43e1-b09d-82d9ef2415ca`（50 表、18,501 行、7,373,524 字节，SHA-256 `87751e7f8800d6691082b3e922317d6e39c3d4906b2e438a9beb76f11e1872b4`）。release `e2852ef603a0f8dee5dc5e991243b63d0a0182be` 从干净 worktree 构建并部署；容器预热首个健康检查一次 502 后恢复，`ecs-verify.sh`、外部正式首页与 API 均通过。最终状态 checkpoint 识别消息：`docs(status): record native p1 navigation deployment`。

## 2026-08-20 护士多班种日历偏好与分组详情落地

- 引入点：`git log -S`/`git blame` 确认默认月视图与通用筛选来自 `db35a77`/`ab25064`，选中日期逐班次轨道来自 `1c84fd6`，群组设置入口来自 `720404a`。本轮只在 `CalendarView` 数据调用点应用月视图默认班种，并重构 `SelectedDateDutyDetails`；`MonthGrid.vue`、`WeekGrid.vue` 源码哈希由回归测试锁定且不修改。
- 运行/浏览器验证：`pnpm smoke:browser` 的等价直接入口 `node scripts/smoke-browser.mjs` 已在当前源码 5173 与开发认证 API 3000 上运行；本机 MySQL `127.0.0.1:3306` 拒绝连接，管理员登录回退 `/login?redirect=/`，因此完整业务 smoke 在登录门禁停止。独立 Storybook 真实生产详情组件已在 390px 验证同班三人收进一张 D 班卡、姓名全部可见、短号/手机分体拨号、44px 操作和无横向溢出；控制台无产品错误。Docker Desktop 未运行，隔离 MySQL 集成测试按环境跳过。
- 正式发布与核验：代码 checkpoint `f723b0d` 已推送；发布前加密数据库备份 archive `9b092f7f-4fc9-4002-964a-09c2cac62e9a`（50 表、157657 行、70951728 字节，SHA-256 `8bd68d81e2390a5b13986d57702641edfb026d4823d6f2490bf32d22f030a13a`）。隔离干净工作树构建并部署 release `f723b0dbbe5b5f313158f2f76f8466159443074d`；预热首次 502 后恢复，`ecs-verify.sh` 通过。正式数据库为 43 条迁移且 4 个偏好列齐全，健康 200、未认证偏好端点 401，Web/API bundle 接线命中；未写入排班业务数据。

## 2026-08-22 密码提醒永久不再提示与弹窗收口

- 引入点：`git log -S 'dismissPasswordReminder'` / `git blame` 确认 `664bc1f` 首次把“不再提示”实现为会话内 `ref`；`getFocusableElements(dialog.value!)[1]` 同样来自 `664bc1f`，去掉右上角关闭按钮后会跳过第一个密码输入框。
- 测试先行：旧实现新增的弹窗文案/移除关闭按钮、焦点索引、永久偏好与“取消仅本次关闭”断言先失败；实现后生产弹窗 2/2、会话管理 13/13 通过（工作区扫描含用户自有 `runtime/**` 副本共 42 项）。
- 实现与语义：移除右上角关闭按钮，次级操作只显示“不再提示”；取消路径新增 `closePasswordReminder`，只关闭当前会话；“不再提示”新增按 `user_profiles.id` 隔离的 `localStorage` 偏好，登录、恢复会话与刷新密码状态均读取，存储异常不阻断登录。密码校验、修改提交、焦点陷阱和 API 调用次数不变。
- 运行/浏览器验证：`pnpm smoke:browser` 已运行，在第 1/6 步访问 `http://localhost:5173` 因本机无 Web 服务以 `ERR_CONNECTION_REFUSED` 停止；`pnpm smoke:check-core` 首次按门禁提示需先记录本条浏览器结果，记录后待复核。Web typecheck/build、Storybook build、任务文件 Prettier/ESLint、定向 Vitest 通过；Storybook 390×844 需复核“不再提示”文案、无右上角按钮及取消/永久偏好交互。
- 正式发布：代码 checkpoint `fc05236` 已推送；数据库备份 archive `cd80262e-341e-4b41-8aef-10f3b4cd7c5d`（50 表、157702 行、70981852 bytes，SHA-256 `7ff5252339a3072defdf91bfaccb1eed01f501d1d6aa8afd934c4470a5572e95`）后，release `fc052367239cf4c67430c9d61ddc993bb33974d6` 已部署；预热首次 502 后恢复，`ecs-verify.sh`、正式首页/API 200，线上 bundle 只读命中“不再提示”且不含旧文案/关闭类名。
- 当前状态：已完成（含 Storybook、代码发布、生产备份、ECS 验证与正式 bundle 只读复核）→ 待状态 checkpoint 收口；其他用户自有小程序/Storybook/runtime/src 改动未纳入。

## 2026-08-24 P7 实体反馈：工作台内嵌、Web 式选择器、撤销与联系方式默认值

- 引入点：`git log -S` / `git blame` 确认工作台跳转请假、换班、加扣班分别由 `9fae3869`、`7d3b93c8`、`764276f1` 引入；三个原生页中的系统 `<picker>` 同样来自这三次切片；完成换班的 `isRevocable` 展示由 `f65a57df` 引入且只审计排班链状态；手机号显式 opt-in 由 `59300957` 引入；群组设置入口也由 `59300957` 放入左上群组菜单。
- 测试先行：新增工作台常驻壳、左上仅切群组、更多菜单、自绘选择器/周末红字、过期换班不可撤销、手机号默认可见/明确关闭才隐藏及 `.86` 发布契约断言，均在旧实现先红；修复后 Mini 42 files/224、API 手机号/撤销单测 5/5、真实 MySQL 日历/群组/换班 56/56 通过。
- 实现与语义：工作台改为 `calendar/leave/swap/duty/more` 中央工作区，顶部和底部导航不卸载；三页业务控制器抽为分包组件，保留独立深链页兼容。“更多”内群组管理对非访客可用，手动排班/排班补录继续仅群主和管理员可用，与 Web 权限一致。全部工作流系统 `<picker>` 替换为自绘底部 Sheet，月份/日期使用内嵌滚轮，普通选择使用自绘列表，班次周末日期标红。服务端与 Mini 同时禁止过去业务日的完成换班显示/执行撤销。联系方式改为有手机号即默认群内可见，只有成员明确关闭形成的 `fingerprint=null + revoked_at!=null` 才隐藏，访客/跨群边界不变；生产只读聚合确认冯钦 1 条有效记录有手机号且明确关闭计数为 0，未读取号码、未写数据。
- 语义等价审计：工作流 API、危险写 operation snapshot、错误/重试、独立深链页面保持原控制器行为；中央切换只改变挂载位置。联系方式是用户明确要求的独立策略变化，不伪装为重构；管理员仍不能代替成员关闭/开启，主动关闭跨手机号变更继续保留。过期撤销增加服务端只读呈现门禁与 Mini 防御门禁，真实 revoke API 原有拒绝保持不变。
- 运行/浏览器验证：Mini typecheck、production verify（2/2 Worklet、2,836,191 bytes、manifest `ab55e4a609f6369ae7940316c3db13e95c6d41467d97bb14938505cfbd4276c1`）、无凭据 CI dry-run、任务 Prettier/ESLint、`git diff --check` 与 `node scripts/smoke-browser.mjs --check-core` 通过；未触及 Web 核心链路，无需 Web 浏览器冒烟。跨分包异步组件仍需微信官方上传编译和实体 Android 复核，状态为已实现待浏览器复核。
- checkpoint/体验/生产：`bc32a4f1` 已推送；微信官方 Summer 编译并上传 `.86`（93 files、zip 767,784 bytes、manifest `bcca6267d9592aabf0362711e7e4dc64bae05280810da0c7808f98c2a4a7c5de`），未提审/正式发布。生产备份 `c74e6442-534f-4ca0-8388-59f3f58fd7aa`（54 表、164,551 行、77,396,940 bytes、SHA-256 `4588b17d730b0b569e555f03351250def36467d18dc74ca75b76ac376120dfc2`）后部署 release `bc32a4f1be0defd41c85b8e5e6d078a993d0e25c`；预热 502 恢复、privacy 0/0、full verifier 通过，release 锁下原子追加 `.86`，`.86` 为 200 且 core/workflows=true，`.84-duty`/未知仍 426。状态为已完成（含运行验证）→ 待用户用 `.86@bc32a4f` 实体复核。

## 2026-08-24 P7 实体反馈二轮：选择器确认、底栏与切换稳定性

- 引入点/根因：`git log -S`/`git blame` 定位到 `bc32a4f1`：工作台以互斥 `wx:if/wx:elif` 挂载日历/工作流，导致组件反复销毁、重读和返回日历滚动重置；Panel/Picker 使用 `styleIsolation:shared`，其 `.bottom-nav` 反向污染工作台；嵌入工作区 `overflow:hidden` 且层级低于底栏，使 Picker 已存在的 actions 被裁切。用户确认滚轮截图值为人工调整，不存在初始值错位。
- 测试先行：新增常驻日历/预挂载 Panel、单向样式隔离、返回日历不滚顶、Web selector/month/date 结构和 controller 草稿/提交断言，旧实现 5 项失败；实现后 Mini 43 files/227、反馈+工作台 4 files/31、release-control 15/15 通过。
- 实现/视觉：依 `frontend-design` 直接复刻 production `TemporalPicker`，不新增视觉方向。普通 selector 改为就地下拉并点选即生效/收起；月份/日期浮层使用 12px 屏幕边距、22px 圆角、浅蓝摘要、188px 月份双滚轮、日期 7 列月历及固定取消/完成区。日历/三 Panel 常驻 hidden 切换，Panel 在 core ready 后后台预挂载；底栏固定高度，组件改 `apply-shared`，弹层不再被底栏遮挡。
- 语义审计/验证：危险写、幂等 snapshot、异步错误/409、空值、深链和 API 次数不变；新增副作用仅为首载后的工作流只读预取，后续切换减少重复 GET。selector 一次点击发一次 change；month/date 完成发一次、取消零次。Mini typecheck、任务 ESLint/Prettier、production verify（2/2 Worklet、2,847,420 bytes、manifest `e5d2b0c7d4feb3e9acbe4ac3a6d1cd2b7e3f9851076b8f81aa18c5b4fd878f96`）与 `git diff --check` 通过；状态为已实现待官方编译与实体复核。
- checkpoint/体验/生产：`7f4f70a0` 已推送；微信官方 Summer 编译并上传 `.87`（93 files、zip 772,080 bytes、manifest `944fef13c04b0e07423a993eb538b74d88048a6fccf8b7525cb75e467414869f`），未提审/正式发布。生产备份 `08d26fa0-e3df-40c3-9d49-cb879b31cfff`（54 表、164,777 行、77,474,196 bytes、SHA-256 `52a77469c5babca13158683aedf83ca0b958a5e77ad71a8931385b531cfd684e`）后部署 release `7f4f70a01200c876113a20e4c5fc22db19b2732b`；预热 502 恢复、privacy 0/0、full verifier 通过，`.87` 为 200 且 core/workflows=true，旧部分候选/未知仍 426。状态为已完成（含运行验证）→待用户用 `.87@7f4f70a` 实体复核。

## 2026-08-25 P8-A2-3 邀请与 visitor key 危险写入硬化

- 引入点/测试先行：`git log -S`/`git blame` 定位邀请 route/service=`a50c4fce`、visitor key=`4b337490`、邀请 schema=`4fc6bd21`。先新增 operation/version 契约、路由边界、敏感幂等 codec、共享客户端 receiver 与 Web 委托测试；旧实现因缺少字段/模块/委托和会把 raw secret 存入 result 而失败，实现后定向 7 files/26 tests 通过。
- 行为变化：邀请创建/接受/撤销与 visitor key 轮换均要求 header/body 同一 operation id 和实体 expected version；管理员不能邀请新管理员。创建 token 以服务器 secret+actor+operation 确定性派生，接受合并重放重新签发 session；幂等结果不保存 raw invite token、share path、session token 或 visitor key。同键同载荷重放，同键异载荷、stale target/role/invite/group version 返回 409；邀请仍单次使用且非接受者不能重放。
- 语义等价审计：client-core/Web 保持成员调用 receiver、Bearer、一次 transport 调用、Promise 拒绝与严格解码；无空值默认变化，无后台重试/离线队列/持久化新增。invite resolve 与 group QR 只读路径不变；Mini 无 UI 或 capability 变化。独立权限收紧（只有 owner/developer 可创建 administrator invite）有真实 MySQL 回归，不作为重构隐藏。
- 运行/浏览器验证：`pnpm smoke:browser` 等价直接入口 `node scripts/smoke-browser.mjs` 已运行；前两次分别因 Windows 保留 5173 和未开启本地开发认证按门禁停止，随后在当前源码 127.0.0.1:4173 完整通过登录、管理员、成员、访客/vkey 与访问记录，全流程无浏览器错误。API 真实 MySQL 全量 71 files/471 tests、Contracts 17/60、client-core 13/43、Web 104/605、Mini 45/254、全端 typecheck/build、generated freshness、Mini production verify 与 `node scripts/smoke-browser.mjs --check-core` 通过；临时 API/Web 服务已按 PID 精确关闭。
- checkpoint/发布/下一批：`cf453205` 已推送；production-profile `.98-invite` 官方上传 96 files/zip 840,636/manifest `90dc30ee9909a5c16c49f22189d54c502b1ff65da4b91b17089736bbfbe55656`，未进 allowlist、未提审/正式发布。生产备份 `abe33fb4-07d3-410a-905f-001d0dc8308b`（54 表、168,476 行、78,831,520 bytes、SHA `67c31964c7c7d5e8807d098c4c7b7b5a6d3ac127999ca21aa843cb7b456a86d3`）后部署 release `cf453205cef53ebb1006838c11b3af1522f07dc7`；预热两次 502 后恢复，带公网 IP full verifier、正式 health 200、`.94` organization=false、`.96/.97/.98-invite` 426 和远端 temp 清理均通过。最终状态 checkpoint 识别消息 `docs(status): record p8 invite visitor deployment`；下一批只做 P8-A2-4 平台用户名分配和管理员绑定链接危险写入，不提前进入 Web 黄金或 Mini 原生页面。

## 2026-08-25 P8-A2-4 平台身份危险写入硬化

- 引入点/测试先行：`git log -S`/`git blame` 定位用户名分配=`0225e0e7`、管理员 binding ticket=`668103c2`、Web 接线=`02a508dd`。operation/version contracts、路由前置、共享客户端 receiver、Web 冻结快照和真实 MySQL replay/并发/隐私测试在旧实现分别因 400、模块/委托缺失和同一请求生成两个随机 ticket 先红，实现后定向静态 7 files/27 tests、MySQL 2 files/14 tests 转绿。
- 行为变化：用户名分配与 binding-link create 均要求 header/body 同一 operation id 和目标 `expectedAuthVersion`；同键同载荷重放、异载荷/stale 409。用户名同版本并发只一胜；绑定 ticket 以服务器 secret+actor+target+operation+authVersion 确定性 HMAC，表只存 hash，幂等 result 只存版本/到期时间，URL/ticket 不缓存；重放以同 ticket 重新取得 URL，target authVersion 变化后 create replay/preview/confirm 全部拒绝。URL contract 同时收紧为 HTTPS。
- 语义等价审计：client-core/Web 继续由同一 shared transport 以成员调用发送 Bearer/body/Idempotency-Key，各写一次；Web 使用既有 presentation-core 冻结同 payload/operation，模糊失败保留、payload/version 变化换 ID、成功清理、409 刷新。用户名 trim、错误拒绝、modal/loading/finally、链接仅内存展示和无离线写队列不变；Mini 无 UI/缓存/写入，production organization 保持关闭。
- 运行/浏览器验证：`pnpm smoke:browser` 等价直接入口 `node scripts/smoke-browser.mjs` 在当前源码 127.0.0.1:4173 完整通过登录、管理员、成员、访客/vkey 与访问记录，无浏览器错误；临时服务按 PID 关闭。API 真实 MySQL 72 files/478 tests、Contracts 18/62、client-core 14/45、Web 105/606、Mini 45/254、全端 typecheck/build、generated freshness、Mini production verify、任务 ESLint/Prettier/diff 通过。
- checkpoint/发布/下一批：`a3bf2363` 已推送；production-profile `.99-identity` 官方上传 96 files/zip 847,455/manifest `7bb8388106e9f18b5aa6538a557d98122cc4913492ff53e09dd3f1170b6b92dd`，未 allowlist/提审/正式发布。生产备份 `83d9dfcd-cd9e-40ca-b0ce-de78c5cd9eb6`（54 表、168,663 行、78,893,252 bytes、SHA `27f212ad4715997afc717b19750cd06660b2e31e129d634652c67ec97d95caa2`）后部署 release `a3bf2363dcd7e0498b9a434c5b8f322bb850b4bd`；预热一次 TLS EOF 后恢复，带公网 IP full verifier、health 200、`.94` organization=false、`.96/.97/.98/.99-identity` 426 和远端 temp 清理均通过。最终状态 checkpoint 识别消息 `docs(status): record p8 platform identity deployment`；随后进入 P8-B Web 黄金，不提前写 Mini 原生页面或开启 organization capability。
