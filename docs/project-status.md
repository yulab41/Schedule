# Project Status

## 策略变更：Agent 可直接操作微信开发者工具（编译/预览/上传免逐次确认）

- 用户明确要求：允许 Agent 调用微信开发者工具（`wechatide` CLI 与开发者工具 MCP），且编译、预览、上传不再需要用户逐次确认。
- 已移除禁令与逐次批准门禁的位置：根`AGENTS.md`、`apps/miniprogram/AGENTS.md`、`schedule-project-guardrails`（`SKILL.md`、`references/miniprogram.md`、`references/task-levels.md`、`references/release-candidate.md`）、小程序迁移计划、`architecture/runtime-and-build.md`、`runbooks/manual-native-testing.md`、`runbooks/p6-core-rc.md`、`p7-workflow-rc.md`、`p8-organization-rc.md`、`runbooks/miniprogram-ci.md`、`testing/device-matrix.md`、`testing/test-plan.md`、`docs/audit/AUDIT_MASTER_PLAN.md`、`docs/audit/XIAOMI14_TEST_PROTOCOL.md`。
- 守卫与历史记录处理：`validate-project-skill.ps1` 原先断言运行手册含“当前消息已明确授权上传”，该审批要求正是本次取消的策略，故改为断言“不需要用户逐次批准”并复核其余版本分配/血缘 token 仍全部成立；这是策略变更的同步，不是用改测试掩盖失败。`wechat-miniprogram-audit.md` 与`exp-icon-004`计划只加日期化的“当时/现已解除”说明，不改写历史结论。
- `docs/project-status.md` 原为40551字节，已接近`agent-context-policy.test.mjs`的40960字节硬门槛，加一轮记录必然越界。按根`AGENTS.md`“保持简洁、Git历史才是持久历史”的要求，裁掉访客修复101及以前的历史批次（保留当前与近期批次，并在文末指向`docs/audit/`），现为32047字节/168行。
- ADR：ADR-0002 的执行边界部分由新增`apps/miniprogram/docs/decisions/ADR-0006-agent-devtools-automation.md`取代，其余部分（日常主循环不依赖开发者工具）仍有效。
- 保留不变的边界：提交审核、撤回审核、正式发布，以及删除云资源、生产数据库破坏性写入、真实支付等其他不可逆操作仍需用户当次明确批准；体验版上传仍走版本分配、冻结干净候选、Manifest/receipt/远端tag血缘与只追加allowlist；模拟器、自动化与截图不得冒充实体设备验收。
- 环境事实（本轮实测）：开发者工具`2.02.2609162`（Nightly，高于门槛`2.02.2607152`）；`wechatide -h`退出码0；agent侧skill`0.3.11`与工具内置版逐文件一致且`versionRelation: equal`；MCP `wechat-devtools`带独立Token调用`check_wechatide_status`成功，`loginExpired: false`。
- 验证：`validate-project-skill.ps1` RESULT=PASS（15文件、14 markdown、108链接）；`vitest run scripts/agent-context-policy.test.mjs` 3/3通过；`node --test scripts/codex/worktree-pool-policy.test.mjs` 5/5通过；`vitest run scripts/test-discovery-policy.test.mjs scripts/project-local-artifacts.test.mjs` 6/6通过；`node --test scripts/codex/project-local-layout.test.mjs scripts/codex/release-candidate-core.test.mjs scripts/codex/workspace-bootstrap-core.test.mjs` 47/47通过；`git diff --check`通过。改动只涉及markdown与一个PowerShell脚本，未触及`format:check`的Prettier范围，也未触及Mini/Web源码，故未跑全量verify。
- 唯一建议下一任务：需要原生复核时由 Agent 自主上传体验版（记录短SHA、版本、Manifest与测试页面），随后请用户在小米14微信客户端打开该体验版复核。停止条件：用户给出与当前构建一致的真机结论前，不得写“小米14体验版验收通过”。

## 当前批次：月历快速滑动内容回退修复（Mini-only）

- 用户反馈日历首页月视图快速左滑时动画向前但内容/月份偶发回退（`9-10-9-10-11`）。基线`9fb00a6a`，独占general-5，REUSE_ONLY且未安装依赖；引入点`9045dc02`（移除原生回中后的环形槽位设计）+`4e5cb461`（共享 pager 在`shiftPending`期间丢弃新滑动）。
- 根因：换月 patch 在途时旧实现丢弃新的原生滑动，原生 swiper 索引与环锚点分离；环按旧锚点映射月份，下一次向前滑动落到“上个月”槽，内容与`businessMonth`同时倒一格。
- 修复：`calendar-period-pager`以原生槽位为唯一事实源（`swiperSlot`/`pendingDelta`），在途滑动排队并在 settle 时无动画 adopt；`prepare`区分 locked/tracked，stale/replay 事件仍忽略；`delta`放开为整数并同步 guest 与 `ui-date-picker`；去掉`swiperCurrent`回调等待（Page 处理器提前约28ms）。
- 验证（Agent 操作的开发者工具，非实体设备）：同环境同节奏350ms连续5次左滑，基线`9→10→9→10→10`，修复后`9→10→11→12→2027-01`单调向前；250ms故障注入下提交月份不回退。RED→GREEN：基线源码跑新测试8失败/44通过，修复后全绿；Mini 173文件/1188项通过（16跳过）、`tsc`、Mini production verify（包体4581614字节、Worklet2/2、manifest`c13a5d88…`）、`format:check`、`lint`、`icon:parity:check`、`smoke:check-core`通过；证据见 ignored `runtime/audit/calendar-month-swipe-20260919/`。
- 性能旁证与决策：一次换月 Page patch 40.8KB/往返115～120ms，settle 另有2次约100KB patch（91ms/75ms）；已试的两项 patch 瘦身（去掉未挂载视图数据、按槽位路径下发）无可靠收益或更慢，按“收益不明确即回滚”未纳入。
- 本批为 Mini-only：不触发生产部署、生产备份或 release-metadata 同步。检查点：`e149c9fd`（修复）与 `263ee95f`（刷新 `.5285dd17` 血缘证明中 `pages/workbench/index.ts` 的 blob 并记录等价证据）。
- 首次上传被血缘门禁阻塞（`.172`及`.130`起体验版都不在 main 血统上）。用户确认并行`runtime-3172`线已下令撤回并选择方案 B：main 执行`git merge --no-ff -s ours 44a25885`（`48102b9a`），内容保持 main、`.172`成为祖先；合并前后本批 11 个文件 blob mismatch=0，滑动修复未被抹掉。
- 已上传并放行：候选`48102b9a`、general-5 upload 用途 lease、checker `PASS`，动态分配`0.1.0-p10.20260919.173`（description `calendar swipe fix 48102b9`、production、Manifest `5a31d053…46522`、远端tag同一SHA、receipt 在 ignored 目录）；L4 放行按运维笔记物理路线校验后执行可信`ensure`（只增不删、API/Web 重建、预热502后恢复）并通过`verify`、公网探针`.173/.172`=200、未知=426、`ECS_PUBLIC_IP`完整`ecs-verify.sh`（release `44034fcc` 未变）。未部署生产应用、未备份生产库、未提审/正式发布；general-5 已释放。
- `.173`复查为**错误交付**：其内容与`.172`差199个文件（用了 main 内容，丢了`runtime-3172`运行线），而生产 live release`44034fcc`属于那条线，故客户端与服务器 API 不匹配。已按“`.172`内容 + 滑动修复”重建候选`697795eb`（`read-tree`切到`44a25885`后移植修复：pager/月组件/日期选择器 + 该线独有的周历环形 pager 同步 adopt；刷新该线血缘证明blob），`tsc`、Mini 1205项、production verify通过，分支已推送`codex/schedule-65704-00e7c79fd459`。
- 已重发并放行体验版`0.1.0-p10.20260919.174`（description`swipe fix on 172 line 697795e`、Manifest`80967ffa…3d251`、233 code files、远端tag同一SHA、receipt在ignored目录）；`ensure .174`+`verify`+公网探针`.174/.173/.172`=200、未知=426+完整`ecs-verify.sh`（release`44034fcc`未变）全部通过。未部署生产应用、未备份生产库、未提审/正式发布；`.173`仍被放行，退役需另行批准。
- 内容线已正式落到 main：`git merge --no-ff 697795eb` 产生 `a28cd528`（main 内容 = 该运行线内容 + 滑动修复；合并结果与候选仅差两份交付文档），已推送。main 工作区重建 `contracts/client-core/presentation-core` 产物后 Mini typecheck 通过；候选槽内的完整证据（tsc、Mini 1205 项、production verify）对同一内容继续有效。
- 生产边界：服务器 live release `44034fcc` 属于这条内容线的更早提交，已在 main 历史内；main 现在比服务器应用代码多出该线最后几个提交（WebView-only 强制、PoC 页面删除等）。本次**未部署生产应用**（L4 需当次明确授权），也未退役 `.173`（仍在放行）。general-5 已释放。
- 唯一下一任务/停止条件：用户在小米14打开体验版`0.1.0-p10.20260919.174`，确认内容与`.172`一致、月视图/周视图连续快速滑动月份单调向前不回退；未取得与`697795eb`一致的真机结论前，不得写“小米14验收通过”。详情见`docs/debug/debug-feedback-log.md`2026-09-19第四条。

## 当前批次：Feedback26 导出筛选切换重置文件状态

- 基线`4d75ab20`；独占general-1，REUSE_ONLY且无安装。设计与证据见`docs/superpowers/specs/2026-09-14-feedback26-export-selection-reset-design.md`和`docs/audit/feedback26-export-selection-reset.md`。
- 根因是导出周期/类型只更新选择摘要，岗位/人员多选直接写data，均未使已生成任务和临时文件失效。现在七类实际参数变化统一清理旧任务并回到“选择内容后创建任务”；相同值点击不重置。
- 回归RED为7失败/29通过，GREEN控制器36通过；导出下载/直接Page/thin-page联合43通过。Mini production verify通过，包体4579789字节、Worklet2/2、Manifest`30a26638…9cb9b`；保留既有内部预警。
- 待提交检查点：`fix(miniprogram): reset generated export after selection changes`。未操作微信开发者工具、未上传体验版、未部署生产。如需小米14原生复核，由 Agent 在最终干净SHA上自主上传体验版（不再需要另行授权）。

## 当前批次：Feedback25 已部署并放行体验版129，待小米14复核

- 小米14 `.127` 证据确认：访客五行月历因 viewport 62px/行而 panel 仍54px/行产生底部留白；访客列表模板漏掉成员列表已有的班种状态。需继续核对医生/护士月周列表结构与交互，成员日历页面禁止修改。
- 访客二维码当前只有5分钟进程缓存，冷路径串行生成正式/体验两码并在客户端二次绘制；用户确认二维码永久保存，只有手动“刷新访客码”才更换 visitorKey 并废除旧码。设计采用独立持久资源表、双码并行、同请求合并和分段脱敏耗时证据。
- 设计与计划见`docs/superpowers/specs/2026-09-13-feedback25-guest-calendar-qr-performance-design.md`及对应plan。访客month panel已补齐62px rowHeight，列表主体结构与成员一致；成员日历文件零修改。schema61永久保存正式/体验访客二维码，冷生成并行且合并重复请求，刷新事务内废除旧资源，界面统一“刷新访客码”。
- RED旧代码Mini 4/5失败且0061缺失；Feedback25/guest/导出/布局55项、schema兼容与备份表计数32项通过。完整门禁根1266项通过/443跳过、Mini1175项通过/16跳过；Windows release-cache rename曾一次`EPERM`，独立复跑4/4通过。Mini production verify主包1728134、总包4580599字节、Worklet2/2及确定性通过，`smoke:check-core`无需Web冒烟。MySQL持久化集成已加入但warm槽无测试库而14项跳过。独占general-1，REUSE_ONLY且未安装依赖；成员日历零修改和逐行diff通过。
- 应用检查点`21fe6591`及验证器检查点`590aebb4`已推送；schema61/API与最终可信控制面已部署。首次备份`ef3a25ea-0180-462b-819c-fa75ad5081f4`为54表/256555行，最终部署前备份`9a29cb36-fe58-44c3-a933-6114e6a6c16b`为55表/256584行/108379344字节，SHA-256 `2981b347…05d558`。完整生产verifier通过。
- `0.1.0-p10.20260914.129`以production/clean绑定`590aebb4`上传成功，Manifest `21075b8e…fdb360`；可信ensure仅追加129并保留全部旧版本。allowlist verifier、完整ecs verifier及公网探针通过：129/128=200，动态未知=426。未提审、未正式发布、未退役旧版本。唯一下一任务：小米14打开129复核医生/护士访客月周列表、首次/再次读取二维码及“刷新访客码”速度。

## 当前批次：Feedback24 与头颈 DOCX 已部署并放行128，待小米14复核

- 小米14体验版126确认：导出成员选择器弹层被表单卡片裁剪，文件类型仍为原生picker；护士匿名访客缺少成员护士预设/群组月历班种偏好，周/列表swiper归中使用260ms造成反向跳动，启动时先渲染持久缓存造成旧班种闪现。
- 修复限定在导出宿主、匿名访客和独立安全显示设置端点：文件类型复用`ui-selector`，卡片允许弹层显示；旧访客日历响应不加字段。访客从群组设置读取默认视图（当前护士周/医生月）和月历班种，接入护士排序/状态/折叠、62px月格、compact详情和0ms归中提交锁/队列，持久缓存只作网络失败兜底。成员日历页面未修改。
- Feedback24修复限定在导出宿主、匿名访客和独立安全显示设置端点：文件类型复用`ui-selector`，卡片允许弹层显示；访客读取群组默认视图/月历班种并接入护士排序、状态、折叠、62px月格和0ms归中提交锁。成员日历页面未修改。详情`docs/audit/feedback24.md`。
- 同时保留生产刚部署的头颈外科医生群 DOCX/schema60 功能：目标群排班为Word/CSV，统计及其他群为Excel/CSV，固定姓名配置与生产Compose透传不回退。详情`docs/audit/head-neck-docx-export.md`。
- 两条分支共同基于`40723a1d`；检测到真实并发发布后未抢锁，合并生产`ececc967`并形成累计检查点`463f4512`。锁空闲后重新备份`f2ade922-8942-44fd-8cf9-5351489ee66d`（54表、256201行、108185080字节、SHA-256 `aaa2095a…584f5`），schema60/API部署及完整verifier通过。
- 完整`pnpm verify`通过（Mini1169/16跳过、根1262/442跳过、依赖保护81）；Mini production verify主包1727549、总包4579238字节、Worklet2/2及确定性通过。浏览器冒烟因localhost:5173未启动而`ERR_CONNECTION_REFUSED`，`smoke:check-core`通过。
- `0.1.0-p10.20260913.127`绑定`463f4512`以production/clean上传成功，Manifest `f570cb98…c9812`；可信ensure仅追加127并保留全部旧版本。allowlist verifier、完整ecs verifier及公网探针通过：127/126=200，动态未知=426。未提审、未正式发布、未退役旧版本；唯一下一任务为小米14复核访客三视图与导出选择器/DOCX入口。
- 用户确认127已被占用并精确授权改用128。同一累计应用以主线发布记录提交`0e7fc6c7`、production/clean上传`0.1.0-p10.20260913.128`，Manifest `71109555…8297`，receipt与远端轻量tag均绑定同一SHA。可信ensure只追加128；完整ecs verifier及公网探针通过：128/127/126=200，动态未知=426。未提审、未正式发布、未退役旧版本；唯一下一任务仍为小米14打开128复核。

## 当前批次：Feedback23 已部署并放行126，待小米14复核

- 已确认导出选择器溢出来自导出页缺少本地字段内边距容器；共享`ui-selector`无须修改。访客与成员使用同一ViewModel且访客WXSS已导入成员样式，成员在e94a54ca后使用`shiftGroups/tint`，访客模板仍循环旧`duties`，属于展示模板同步遗漏。
- 用户确认访客开放电话和事件，但完整手机号继续受当前群组有效同意门槛。绑定二维码允许群主/群管理员为本群待绑定成员生成，平台管理员也可生成；生成前必须检查未绑定，图片显示群组名/群组码/姓名/工号/有效期，scene只含一次性随机票据。
- 用户授权以视觉/交互匹配、减少重复、包体和加载为目标；实时追随未来成员日历更新不是验收项。当前访客已接入`shiftGroups/tint`、公共详情折叠/班种自动折叠和成员同口径周高，成员日历文件尚未修改；导出选择器已加本地边界容器。Mini typecheck及定向48项通过，QR定向19项通过；API绑定集成因本机未配置测试MySQL而7项明确跳过，不能记为通过。
- 一次性成员绑定二维码API/schema59/client-core和Mini信息卡已实现；幂等记录不保存Base64图片，平台/群组管理员来源分别审计。最终`pnpm verify`通过（Mini1164/16跳过、根1257/440跳过）；Mini production verify主包1720876、总包4570156字节、Worklet2/2、确定性通过。运行/浏览器验证：`pnpm smoke:browser`已执行，warm槽未启动localhost:5173，结果`ERR_CONNECTION_REFUSED`，不记浏览器通过；`pnpm smoke:check-core`通过。MySQL集成因本机测试库未配置而跳过。
- 应用检查点87475d51已推送并部署，schema59；备份cc678008-9368-4332-a7f7-0e7bc070fe19（54表、108086228字节、SHA-256 4e14781b…d8e0）完成，完整ecs-verify通过。125因预构建时间戳冲突在微信上传前失败，永久保留占用且未放行；126/87475d51 production-clean上传成功，359文件Manifest 66e8d858…18b32c，receipt/tag一致。
- 可信ensure仅追加126并保留旧版本；allowlist verifier、完整ecs-verify与公网探针通过：126/124=200，125/动态未知=426。未提审、未正式发布、未退役旧版本。唯一下一任务：小米14打开126，复核访客三视图/电话/事件、成员绑定二维码扫码确认及导出选择器边界；自动化和生产验证不代替原生验收。证据见`docs/audit/feedback23.md`。

## 当前批次：Feedback22 已部署并放行124，待小米14复核

- 独占general-5，基线ea0db36c；依赖采用锁内已有`archiver@5.3.1`生成标准OOXML Excel，稳定store维护下载0。访客码故障根因为client-core严格生成schema遗漏`trialImageBase64`，已修复并回归。
- 导出页移除Feedback14遗留的生产诊断链，表单立即呈现、筛选后台读取；右上角改为Excel/CSV二选一。岗位/成员复用手动排班`ui-selector`多选，“全部”与具体项互斥。
- API与schema58支持xlsx及岗位/成员数组并兼容旧CSV/单选请求。测试库迁移28项、导出集成6项通过；完整`pnpm verify`通过（Mini1161/16跳过，根1338/440跳过）。Mini production verify主包1714300、总包4555475字节，Worklet2/2，确定性及包体通过。
- 运行/浏览器验证：`pnpm smoke:browser`已执行，warm槽未启动localhost:5173，结果`ERR_CONNECTION_REFUSED`，无浏览器运行证据；静态/Node/MySQL自动化不代替小米14验收。详情见docs/audit/feedback22-export-xlsx.md。
- 检查点4cdfdbbd和f0c46078已推送main。生产即时回滚候选ea0db36c；加密备份cb765202-9d82-4199-aa62-d83b44e6bf2c（54表、107939924字节、SHA-256 0d8c20f1…6153c3）完成后，f0c46078部署及schema58迁移成功，完整ecs-verify通过。
- 体验版`0.1.0-p10.20260913.124`绑定f0c46078上传成功，Manifest `e28a01c5…2d3a`、receipt/远端tag一致。可信ensure仅追加124并保留旧版；allowlist与ecs verifier通过，公网124/123=200、动态未知=426。未提审、未正式发布、未退役旧版。
- 唯一下一任务：小米14重开124，复核正式/体验访客二维码读取和带群名保存、导出页首屏、自绘岗位/成员多选，以及Excel/CSV生成和发送。自动化与生产验证完成，原生验收仍待用户。

## 当前批次：Feedback21 已部署并放行123，待小米14复核

- 基线2d63e5a3，独占general-5，REUSE_ONLY且未安装依赖。访客公开排班改为7天持久缓存和后台刷新，完整手机号、访客密钥及Guest token不落盘；切后台/卸载不再全量清除，明确失效仅清对应群组。
- 正式版/体验版二维码分环境生成与缓存，客户端合成为二维码加群名的PNG供长按保存；服务端开关可关闭体验版生成。导出CSV增加UTF-8 BOM，创建后立即处理，分钟任务保留兜底；Mini自动下载后仅显示发送文件/取消，失败时显示重新获取文件，并删除导出页冗余说明区。
- 附件证据：9月CSV 2562字节/30行，无BOM；9月8—9日源快照为全天班/全，其余28行为全天班/全天。换班只变实际成员，导出未截断字段。详见docs/audit/feedback21-visitor-export.md。
- 最终`pnpm verify`通过：Mini 1160通过/16跳过、根1255通过/439跳过，格式、lint、构建、typecheck和icon parity通过；另有Mini定向53项、契约/API定向23项。Mini production verify主包1713723、总包4554857字节。首次Web构建完成后遇Windows libuv退出断言，单独及最终全量Web build均通过。运行/浏览器验证：`pnpm smoke:browser`登录页通过后因warm槽无`.env`、本地API未启动而停在管理员登录；未复制凭据，结果已记录。
- 应用检查点9e603fdb及文档检查点be6ff2ac已推送；0.1.0-p10.20260913.123上传成功，production/clean，Manifest 03986dd5…f5495c，receipt/tag同一应用SHA。
- 用户随后授权生产部署与放行。两个DoH、直连TLS、既有公网IP ED25519严格SSH认证后，正式域名host key安全协调且有ignored备份。备份b0bbc0cc-bcf2-4c29-96c5-4eff80274bd1成功（54表、107823088字节、SHA-256 90b69342…db7f1）。
- be6ff2ac已部署，实时回滚候选83d8a03b；预热3次502后恢复，更新器及完整ecs-verify通过。可信ensure仅追加123并保留旧版；allowlist verifier、再次ecs-verify和公网123/122=200、动态未知=426通过。
- 唯一下一任务：小米14打开体验版123，复核访客缓存/返回登录、正式与体验二维码带群名长按保存，以及医生群CSV速度、自动发送和Microsoft Excel中文显示。未提审或正式发布。

## 当前批次：Feedback20 已上传并放行122，待小米14复核

- 原始访客/二维码检查点325f82ea与累计合并检查点66b18b26均已推送；后者包含体验版121的导出真实上传转换修复、二维码点击预览/轮换自动刷新，以及本轮删除相册按钮/API、访客月窗和返回登录。详情docs/audit/feedback20-visitor-export.md及feedback20-trial-release.md。
- 完整verify通过：Mini1159/16跳过、根1254/439跳过、依赖保护81；Mini verify/Worklet2/2/确定性/包体/smoke:check-core通过，主包1709746/总4549449字节。
- 0.1.0-p10.20260913.122/66b18b26 production/clean上传成功，Manifest fd736127…bece5，build-profile/receipt/远端tag一致。可信ensure仅追加122并保留121；allowlist verify、完整ecs-verify、DoH/TLS/strict SSH和公网122/121=200、动态未知=426通过。服务器应用release仍83d8a03b，未部署代码、备份/迁移数据库或退役旧版。
- 微信公众平台浏览器执行面不可用，无法代配置downloadFile合法域名。唯一下一任务：管理员在公众平台加入`https://hosp.schedule.eylinhome.top`为downloadFile合法域名，然后用户在小米14重开122/66b18b2复核CSV下载、访客三控件/切换、二维码点击预览与长按。未提审或正式发布。

## 当前批次：Feedback19 导出页真实上传转换故障已修复，待体验版交付

- 基线3d83d236（体验版120源码c2dbe4c3）；独占general-5，REUSE_ONLY，未安装依赖。
- 根因：106已包含的9bae5beb在共享CSV轮询循环中增加捕获remaining的Promise闭包，
  微信SDK ES6转换生成regeneratorValues，但SDK既未识别也未附带此模块，导致页面载入即失败。
- 本轮运行真实miniprogram-ci转换及仅含其自带helper的VM，旧产物缺模块失败，新产物注册和初始化通过。
  详细引入点、语义审计与旧测试盲区见docs/audit/feedback19-export-runtime.md。
- 修复等待函数作用域，保留轮询/超时/取消语义；导出恢复单一Page及静态模板，
  保留data群组上下文。删除临时组件wrapper、重复加载壳/样式、挂载计时器和未调用测量代码。
- 替换临时结构测试为上传转换后Page运行测试；Mini verify增加SDK helper可打包性门禁。
- 验证：Mini全量168文件1191项通过、2文件16项跳过；共享presentation-core32项通过。
  Mini verify/Worklet2/2/包体4,551,833字节/确定性、typecheck、lint、format、icon parity、
  smoke:check-core通过。既有主包和矩阵内部预警保留；未控制微信开发者工具。
- 检查点：fix(miniprogram): repair export upload transform and remove startup scaffolding。
- 下一任务：交付此修复的干净体验版，再由小米14验证真实导出入口及CSV下载/发送。
  尚无修复后同SHA真机证据，不将Node执行等同于原生通过。生产应用与数据库不在本轮修复范围。

## 上一批次：Feedback15 已部署并放行112，待小米14复核

- 用户批准八项计划；基线a8695f2a，独占general-4依赖复用、无安装。详情docs/audit/feedback15.md。
- 当前周独立测量/点选局部更新、before折叠、岗位改名接口与弹窗、月历顺延/62px、三视图补班、单按钮两步授权及日期文字盒居中已实现。
- pnpm verify通过：Mini1184/16跳过、根1252/439跳过、依赖保护81；MySQL模式集成套件46项通过。收口额外通知保存失败回归RED1→联合35通过，最终Mini verify/Worklet2/2/包体通过（主包1708859/总4550421字节）。
- 390/320真实WXML/生产CSS几何及运行/浏览器验证：pnpm smoke:browser通过；smoke:check-core通过。本地synthetic管理员标记已回读恢复、3105/4175服务已停止；小米14原生待同版本复核。
- 83d8a03b已推送；112/83d8a03已上传成功，357文件冻结包/receipt/远端tag一致，主包1709858/总4552499。上传专项30项及候选前后检查通过，见docs/audit/feedback15-trial-release.md。
- 用户随后授权生产操作：备份d89f173b-8b76-463c-b560-3e0726ff3d5d成功（54表、106182176字节）；服务端83d8a03b部署完成，schema57，独立ecs-verify通过。生产健康探测首段短暂502后恢复，未改变业务数据。
- 可信ensure仅追加112并保留111；allowlist verifier、再次ecs-verify及公网策略探针通过：112/111=200，动态未知=426。未执行replace、版本退役或真实通知。
- 唯一下一任务：小米14重开体验版112/83d8a03b，复核八项交互和视觉。自动化与生产验证完成，原生待用户复核；不重复上传、放行或部署。文档检查点docs(release): record feedback15 trial 112 delivery。

## 上一批次：Feedback14 已交付111，导出白屏待同版本报告

- 本轮限定两项反馈；实现与引入点见docs/audit/feedback14.md。基线e163fde8，独占general-4/5依赖复用、无安装。
- 更多页位移来自7923262d的onHide删除底部诊断区域、返回再插入。现在普通遮盖保留已授权区域，权限撤销仍即时生效，后台不能新授权或跳转；没有WXML/WXSS或无关UI修改。
- 新位移回归先失败后通过；workbench31、联合真实导出及诊断69项通过。390×844/320生产样式浏览器复现旧内容缩短107px、修复布局保持不变，原生效果待同版本验收。
- 导出已对照102/106及9bae5beb、执行110真实冻结JS与真实Page测试，未证实原生白屏根因。新增可复制的固定首屏阶段与root/header/scroll分类诊断；不改CSV操作语义，不宣称白屏已修复。
- 检查点fix(miniprogram): stabilize More navigation and expose export render stages；完整pnpm verify通过：Mini1179/15跳过、根1251/436跳过、依赖保护81；最终Mini verify、Worklet2/2及包体通过。用户随后批准上传并追加放行，已交付111/6b8a9e9，保留110；完整生产verifier/allowlist及公网111/110=200、未知426通过。服务器仍e163fde8，无新应用部署。
- 唯一下一任务：小米14重开111/6b8a9e9，复核更多位移，进入导出停留5秒返回，再到测试工具刷新并复制完整诊断报告。交付见docs/audit/feedback14-trial-release.md；不重复上传、放行或部署，白屏仍待定位。二维码及自动收信待用户原生复核状态保留。

## 上一批次：Feedback13 已部署并上传110，待用户真机复核

- 应用8f441d2d已推送部署，累计体验版0.1.0-p10.20260912.110上传成功并仅追加放行，109继续可用。四项日历修复和五类通知独立授权入口均包含；交付证据见docs/audit/feedback13-release.md。
- 加密备份0e13bb85-dabe-40b4-ae94-a7beb6fafefc（54表、106020632字节）实际hash核验一致；schema57，无新增迁移。完整生产verifier/allowlist通过，公网110/109=200、未知426。
- 五模板配置、四业务模板实际字段和外部消息能力复核通过。未主动发送真实消息、不重放历史通知。上传30项、356文件Manifest/receipt/远端tag一致，主包1704137/总包4535157字节。
- 实现验证沿用完整pnpm verify：Mini1170/15跳过、根1251/436跳过、依赖保护81；额外跨月高度2项、MySQL calendar36及390/320生产CSS/ViewModel几何和本地浏览器通过。均非小米14验收。
- general-4/5独占复用，无依赖安装。文档检查点docs(release): record feedback13 delivery，在本次部署授权内以可信哈希复用流程同步文档release身份，应用及体验包仍绑定8f441d2d。
- 唯一下一任务/停止条件：小米14重开110/8f441d2，复核四项日历交互及五个通知授权按钮、自然自动收信；二维码相册保存、导出白屏和发送文件仍待当前版本真机证据，不提前标记完成。不重复上传、放行、模板配置或护士导入。

## 上一批次：护士照片139条已录入，待用户查看

- 用户明确批准多人补录及静默导入修复、代码修改和生产部署，最终继续139条已确认数据导入。只匹配已有成员/班次，D5电脑，指定跳过项不写；资料留ignored runtime。
- 基线fe505ee9，独占general-4依赖复用，无安装。新增可选成员匹配补录和静默手排，旧行为/旧请求幂等指纹保持，无数据库迁移或小程序上传。详情docs/audit/nurse-schedule-import.md。
- 旧版两项MySQL回归失败；修复后32个不同MySQL用例、契约/路由10项通过。pnpm verify通过：Mini1122/15跳过、根1241/424跳过、依赖保护81；浏览器完整冒烟及smoke:check-core通过。代码及运行验证已完成。
- 生产备份542b8bcb-9796-4cb2-92b0-25d740229594（54表、105228472字节）已核验文件hash；数据尚未录入。
- c4a9b67f及补充修复a90e3b0a均已推送部署，最终live=a90e3b0a2b1db4eb252eb73e3940964bbf83813d、schema57；完整生产verifier通过。计划人员回退查找回归RED为3条而非2条，修复后MySQL12项复测通过，API build/lint/格式与smoke:check-core通过。
- 最终部署前备份f2cca68a-7547-4b16-8d0a-841019f55cce（54表、105250592字节）文件hash与登记一致；即时回滚候选c4a9b67f。两次打包均85包复用、downloaded0，无依赖安装。
- 2026-09-12北京时间08:08事务提交139条：历史54、当前/未来85；独立回读139一致、重复0；原有287条有效排班不变，其中9月1—6日59条保留。成员、岗位、班次配置不变，通知/投递新增0，无小程序上传或新增迁移。
- 原照片1处NP到次日11:00、A次日08:00的3小时重叠按确认原样保留，不自行改班。报告与个人明细仅存ignored runtime/audit/nurse-import-20260911。
- 文档收口：docs(ops): record verified nurse schedule import；仅记录已交付应用与数据，不重复部署或导入。唯一下一任务：用户刷新护士群日历查看9月7—20日；自动交付已完成，真机显示待用户复核。

## 上一批次：feedback11 体验版108已上传放行，导出空白待定位

- 用户批准三项故障修复计划；基线72ea0ab0，独占general-4复用依赖，无安装。二维码PNG/JPEG格式与通知空JSON正文缺陷已复现修复；导出真实Page/模板检查通过但原生空白未复现，未猜测修改。
- RED 4失败/38通过；完整格式/lint/build/typecheck、Mini1122/15跳过、根1240/421跳过及依赖保护81通过；最终Mini verify、Worklet2/2、包体/确定性和smoke:check-core通过。主包1679971/总包4502798，保留已有内部警告。详情见docs/audit/feedback11.md。
- 用户明确授权上传并放行；c563afff已交付`0.1.0-p10.20260912.108`，production/clean，354文件Manifest/receipt/远端不可变tag一致。上传专项30项及候选前后检查通过，主包1681039/总包4505008。详情见docs/audit/feedback11-trial-release.md。
- 可信ensure只追加108并保留旧版；完整生产verifier与版本策略验证通过，公网108/107=200、未知版本426。即时服务器仍b618d938，本轮没有新应用部署、备份、迁移或真实通知；网络及107残留操作锁已验证处理，版本预约记录全部保留。
- 文档检查点：`docs(release): record feedback11 trial 108 delivery`。唯一下一任务：小米14重开108/c563aff复核二维码和通知，并取得导出空白安全诊断继续定位。不得写三项全部完成，不重复上传/放行或部署。

## 上一批次：feedback10/VIS-02 服务端与体验版107已交付

- 用户已授权上传、追加放行及必要部署。累计应用0565f023包含feedback10四项修复和VIS-02访客日历，发布校验修复b618d938已提交推送并部署，实际live为b618d93861d05ae0c597fa8dfe40ed478902be5c、schema57。完整生产verifier和既有版本策略验证通过；详情见docs/audit/feedback10-release.md。
- 部署期间发现0057新增访客关联表后旧校验器不接受54表新备份。仅新增schema57迁移前53/迁移后54表分支；旧代码23通过/2失败，修复后发布/回滚35项通过，项目lint、格式、smoke:check-core通过。未改变业务数据或新增迁移。
- 最终部署前备份e011c56b-699e-422d-9b30-24b2282279f4，实际104354272字节、54表，SHA-256 6fcb93a4d09413a789abbd198eaaea4c0240ed82047968d03dae7b95abbadeb2与登记一致。应用与控制产物hash验证通过；回滚候选来自本次即时live 0565f023。
- .103/.104分别保留失败记录；直连IPv4出口120.230.6.0加入微信CI白名单后，.106=0.1.0-p10.20260911.106以63877b5e、production/clean、354文件Manifest c4bf033e252a94927000c6489fabb9f33f679c608c2abb6104606c5f3cc44ceb上传成功，receipt与不可变远端tag一致。
- 独立HTTPS核验：.102仍200，.103/.104均426；不修改微信平台配置、不关闭IP白名单、不改系统网络。浏览器库存读取失败，无法核对公众平台配置。已归档冻结包/错误/备份/发布证据到ignored runtime/audit/feedback10-delivery-final-20260911及feedback10-delivery-initial-20260911；确认上传进程退出后清理本任务孤立操作锁，不改预约记录。
- 应用验证复用feedback10.md和visitor-calendar-parity.md：合并MySQL45、Mini联合146、共享/API33及访客浏览器通过，Mini/Worklet和专项上传30项通过；不把自动化算作原生验收。CSV真实发送、相册扫码、瞬时通知、新消息点入及访客显示均待小米14。
- 独占general-4全程复用依赖；官方ECS flat导出复用85包、downloaded0，最终重打包命中flat缓存。无workspace依赖安装、无本地数据库上传、无真实通知、无正式发布、无新增放行或旧版退役。
- 独立HTTPS核验：.106/.102=200，.105/.104/.100/未知版本=426；可信ensure仅追加.106，保留旧版。上传和放行已完成，后续只待小米14原生复核，不重复部署或上传。
- 106 已占用后，107 以 clean production 累积候选 `4b4af0a233f1a3ab06e4178333181747a6250e25` 上传成功；Manifest `ed36fd07a1266a33875f101b85d486c180a0bba60351b6cf0e1168c12794bfc4`、receipt、远端不可变 tag 和 add-only allowlist ensure/verify 均一致。生产 live 仍 `b618d938`/schema57，本轮无需重复部署或备份。首次网络 ECONNRESET 后通过已验证 IPv4/TLS 路线对同一三元组重试成功。
- 体验版107说明“访客日历电话事件 4b4af0a”，主包1679405、总包4501599；保留既有内部主包预警。自动化和生产验证完成，CSV真实发送、相册扫码、通知点入和访客原生显示待小米14。

## 上一批次：feedback9 体验版102已上传并放行，待小米14复核

- 用户已批准方案：矩阵随人数完全展开、纵向页面滚动；默认日期占位后直接显示首个未排班日期；CSV 保留并增加用户主动发送文件。
- 使用独占 general-4，导出并行任务独占 general-5；用户另行授权两槽离线锁文件校准，已完成并回到 ReuseOnly，无依赖升级。
- 群组分区、班种选择、矩阵实测边界/高度、月历正方形标识/节假日/圆角/阴影、日期加载与竞态修复已实现；CSV 下载后发送、错误分类和临时文件清理已整合。已保留并行访客101交付（656a463d）。
- 基线与回归、行为变化、槽位恢复结果见 docs/audit/feedback9.md；不重复旧批次账户删除、通知测试或生产操作。
- pnpm verify通过：Mini1057/15跳过、root1226/418跳过、依赖保护81；最终Mini verify、Worklet2/2及320/390桌面布局通过。真实下载原因、文件发送和原生手势待用户复核。
- 应用检查点e40c4f9201bd7e79af151508e00e6667b6897a63已推送main；用户明确授权上传并放行，已交付0.1.0-p10.20260910.102。production/clean，353文件冻结Manifest、成功receipt与远端不可变tag一致；详情见docs/audit/feedback9-trial-release.md。
- 上传专项30项与候选前后检查通过；版本绑定主包1646789/总包4441027字节，保留既有内部主包预警。可信ensure仅追加.102，完整生产verifier及allowlist验证通过；独立HTTPS .102/.101/.99/.98=200、.100/未知版本=426。服务器应用仍4e0a0d1a/schema57，没有新应用部署、数据库备份/迁移或真实通知。
- 文档收口检查点：docs(release): record feedback9 trial 102 delivery。唯一下一任务/停止条件：用户在小米14重开.102/e40c4f9，复核群组偏好、手排矩阵/日期/月历、补录和CSV下载后发送/取消；失败时保留新版分类提示。自动化交付完成，真实下载原因与原生效果待用户复核；不重复上传、放行、部署或同步服务器release标识。
- general-4/5已恢复；general-2/3历史改动保留，general-6精确路径恢复/删除被自动审批以blocked by policy拒绝而未执行，归档及原文件保留。

- 更早批次（访客修复101及以前）的交付记录见 Git 历史与 `docs/audit/` 对应文档；本文件只保留当前与近期批次。
