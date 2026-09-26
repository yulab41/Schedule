# Project Status

## 当前批次：小程序正式包精简（体验版 `.202` 已部署放行，待小米 14 验收）

- 用户范围：删六个无正式导航用途的独立/诊断路由和三套独立业务包装页；测试三页源码及单测留仓库，但构建和上传产物排除。工作台内业务组件及网络/通知/错误记录链路保留。原精简轮次未授权部署；用户随后明确授权部署和放行，未授权提审或正式发布。
- 实测：在独占 `runtime/wt/general-6` 复用依赖、未安装；相同 production 命令的原始包 4,819,158→4,326,081 B，减少 493,077 B；主包 1,835,334→1,616,037 B，减少 219,297 B；本地 ZIP 代理减少 119,398 B。超过 400,000/170,000 B 停止阈值。详情见[包体精简轮次记录](audit/mini-package-slim-20260926.md)。
- 验证：Mini 完整 1,273 通过/18 跳过、根测试 1,307 通过/452 跳过；Mini production verify、lint/build/typecheck、图标一致性、smoke:check-core、CI dry-run/血缘及上传内容拒绝门禁通过。全仓 `format:check` 因五个本轮未改文件的既有格式差异失败；本轮文件格式检查通过。开发者工具五标签状态和登录/访客/四个业务分包模板编译通过；访客无有效链接，运行时读取超时，真机未验证。
- 检查点 `e6ef714b`（精简）和 `5b12c724`（更新精确血缘证明）已推送 `origin/main`。首次上传在版本分配前被旧 blob 证明拦下；红绿测试和血缘审计确认仅诊断入口变化，第二次 Git tag 读取遇到瞬时网络错误，均未占用新版本。同一干净 production 候选随后动态分配并成功上传 `0.1.0-p10.20260926.202@5b12c724`；Manifest `bdb22991a43ecdf3d9c5f22064a8125a244564d6e4c2e9a688fb6ccddabe61f7`，上传 ZIP 2,360,179 B，远端 tag/本地 receipt/构建身份一致，330 个正式产物文件无测试工具和旧包装页。上传实际 ZIP 没有同工具链基线值，减量仅以上述本地同口径 ZIP 代理为准。
- 用户本轮明确授权“部署并放行”。实时生产前驱为 `833a11e4`，和候选 `8ab6663b` 的 21 项应用/控制/schema 哈希相同。加密备份 `e465caa7-6d6c-491d-b652-adc9d9bde087`（54 表、315,123 行、131,224,032 B，服务器文件 SHA-256 与记录一致）后，可信无停机复用发布到 `8ab6663b`，前后完整 verifier 通过；受信 `ensure` 只追加 `.202`，独立 allowlist verify 和完整 ECS verifier 通过，公网 `.202/.201=200`、动态未知版=426。允许版本操作中一次短暂 TLS EOF 已由健康等待恢复。交付记录检查点消息：`docs(release): record Mini package slim deployment and allowlist`；该文档检查点以相同产物哈希同步生产 release 元数据，另行备份。唯一下一任务：等待同构建小米 14 的登录、工作台五标签、访客和主要业务分包验收；缺真实证据不写通过。不提审、不正式发布。

## 上一批次：日历定位按钮位置统一（体验版 `.201` 已放行，待小米 14 复核）

- 用户范围：日历首页定位按钮在月视图与周视图不一致、周视图偏左，以月视图为准；首页、访客等所有定位按钮统一；只改这一件事，改完直接提交并放行。
- 根因与基线：月视图用共享组件 `.locate-button`（40×44，距卡片右外沿 71px，`1f715c96`），周/列表视图用页面内联 `.calendar-locator`（44×44 + `margin-left: 4px`，`ad4cfb2c`），准星偏左 2px。两次独立测量：`.198` 开发者工具截图月 443 / 周 440（chevron 一致）；真实 WXSS 390px 无头几何月 70.00px / 修复前周 72.00px。
- 修改：`apps/miniprogram/src/pages/workbench/index.wxss` 的 `.calendar-locator` 改为 `width: 40px` 并删除无布局作用的 `margin-left`；换期 chevron、标题、按压/hover、动效与定位逻辑未改。访客页经 `@import '../workbench/index.wxss'` 同批生效；列表视图仍按 Web 金标准保留最右槽位。
- 验证：新增“定位按钮盒一致”断言先失败后通过（该文件 27 passed）；Mini 全量 `183 passed | 2 skipped`（1282/18 跳过）；Mini production verify（总包 4,817,890 B、manifest `40f35b70e93f890d6adfd88d020ae67a9f03e778867962f0ce9ad766a679025a`）、`pnpm typecheck`、`pnpm lint`、`icon:parity:check`、`smoke:check-core` 通过。开发者工具（`.201` production 构建、真实排班、390px、WebView）：月/周准星 `left` 均为 299.6（卡片右沿 378.4），chevron 同为 339.6/30.8，列表 343.6。
- 交付：检查点 `287691ff` 已推送 `main`；体验版 `0.1.0-p10.20260926.201`（Manifest `72e7f32900c6f1550514d82300983bf5d39e24667748868f05783ccad9439060`、239 代码文件、ZIP 2,703,186 B）上传，tag/allocation/manifest/receipt 同一 SHA；add-only `schedule-client-version-allowlist ensure` 只追加 `.201` 并保留 `.200`，独立 verify、完整 `ecs-verify.sh`（live release 仍 `833a11e4`、schema 64）与公网 `.201/.200=200`、未知版本 `=426` 通过。
- 本轮是小程序 + 文档范围：未部署生产、未备份或迁移数据库、未提审、未正式发布、未退役旧版本。未验证：访客页模拟器实测（需有效访客链接）、模拟器截图接口本轮只返回 35×75、小米 14 同构建复核。细节见 [轮次记录](audit/calendar-locate-button-20260926.md)。
- 下一批次与停止条件：用户用小米 14 打开 `.201@287691ff`，复核首页/访客月、周、列表的定位按钮位置是否与月视图一致；取得同构建真机证据前保持“待用户复核”，不进其他功能开发。

## 上一批次：补录「移除已有班次」+ 预览精简 + 圆角统一（生产已部署，体验版 `.200` 已放行）

- 服务端（`20c024c6`）：批量补录请求新增可选 `removals: [{ assignmentId, businessDate, scheduleRoleId }]`，`items` 取消 `min(1)` 改为「items+removals 至少一项」；`backfillBatch` 在同一事务、同一幂等指纹、同一审计事件、同一统计刷新与工作流自愈内软删除班次（`deletedAt` + `version + 1`），老客户端不带 `removals` 时行为不变。真实 MySQL 集成 `13/13`。
- 客户端（本批）：点击已存在的「人员 + 班种」= 暂存**移除**，否则 = 暂存**新增**，两者都只在点「确认补录」时一次提交 `items + removals`；草稿键改为「岗位:日期:类型:目标」，同一天可同时挂多条改动；周/月视图统一用 `state: removed|added`（黑色删除线 / 暗红 `#a42620`），删除（原）（拟）徽标，并按班种 + 人员锚定；修掉「只看当天第一条」与「同一人 + 班种重复暂存」两个缺陷。
- 预览窗口：删除单元格点击详情（绑定、模板、样式、模型 `details`/`selectedDate` 与选中态），高度不再随详情变化。
- 圆角统一核验：首页/访客周视图（inline `.week-day-grid` 17px，`e5305bd0` 修复）、月视图与补录/手排预览周视图（`calendar-month`：卡片内圆角 17px = 格子 17px）。无头浏览器量测圆弧/直线覆盖率 0.996 / 1.045 / 1.073（均不偏细），开发者工具实拍月视图左下圆角与直线等宽。访客页 `@import` 首页样式、手排预览复用 `calendar-month`，无独立实现。
- 验证：Mini 全量 183 文件 / 1281 通过 / 18 跳过；presentation-core 备份模型 7/7；补录控制器 15/15；`pnpm typecheck`、`pnpm lint`、root `pnpm test` 通过；Mini production verify 通过（总包 4,817,910 B，manifest `1870568db54fec0788e3925e0dc4df12229a93267654ea0e4fa9555aa01db50a`）。开发者工具：首页月/周、补录页均正常加载，Console 无 error。
- 交付：检查点 `833a11e4` 已推送 `main`；ECS 制品打包后先创建生产加密备份 `7fd67e5c-3d9c-49a5-9b4a-643bc9620bc3`（54 表 / 311,250 行 / 129,955,640 B / SHA-256 `4fdf9bbaa4be6288551d46059d02aa66547d8794852f08eada76bf606954ac6a`），再完整部署到 release `833a11e462a2526df6f117b94b6afb77d19a9f4c`（回滚候选 `ad6c09fe`），`ecs-verify.sh` 完整通过。体验版 `0.1.0-p10.20260926.200`（Manifest `9a9dd18a11a5c3c064b5275c6abcb3b99c6f48c083e6ee3c7dbee1e3e84b7a09`、239 文件、ZIP 2,703,801 B）已上传，受信 add-only `ensure` 只追加该版本，独立 verify 与完整 verifier 通过；公网 `.200`/`.199`=200、动态未知版本=426。
- 未验证：小米 14 同构建真机（护士群多班种补录的移除交互、删除线/暗红渲染、三类预览周/月圆角）。下一批次：用户在小米 14 复核；若发现问题按最小改动修复。

## 当前批次：周视图网格圆角统一体验版 `.199` 已上传放行，待小米 14 复核

- 用户授权对“选中蓝色框圆弧偏细”做最小统一改动。结论与证据：直线与圆弧是同一支 `inset box-shadow: 0 0 0 2px`；开发者工具实测（`.198` production 构建、真实排班数据）圆弧外缘半径 16.96–17.21px 等于设计值 17，无遮挡；观感偏细源自抗锯齿（圆弧峰值不透明度 0.83–0.92，直线 0.94–1.00）。
- 唯一结构性不一致是首页 `.week-day-grid` 裁剪圆角 18px（`var(--ui-radius-large)`）对格子 17px；隔离 CSS 复现显示该 1px 差会削掉圆弧外层约 0.3px。最小改动：仅把网格圆角改为 17px（补录/预览共用组件已是 17/17，不动）。
- 验证：新增“网格圆角必须为 17px”断言先红后绿（该文件 5 passed/1 skipped）；Mini 全量 183 文件/1280 通过/18 跳过；`pnpm --filter @schedule/miniprogram verify` 通过（总包 4,817,612 B、manifest `4d4391501819a2a20c94da84b580695f9a78e07e6dca818fb3e52e6292ceafbb`）；`pnpm smoke:check-core` 通过。开发者工具复测：左下圆弧 2.131 → 2.259 CSS px、峰值 0.92 → 0.965；右下 1.876 → 1.997、0.826 → 0.887。
- 交付：用户授权“上传并放行”后，干净候选 `e5305bd0c68734a913f1da04c01f01aed490ba2b` 上传体验版 `0.1.0-p10.20260925.199`（Manifest `14b8aeb2bb4e0f038a29428f2498ef38a471bcf73493705e9f048aac332104df`、239 代码文件、ZIP 2,703,859 B），tag/allocation/manifest/receipt 同一 SHA；可信 `ensure` 只追加 `.199` 并保留旧版，独立 verify 与完整 ECS verifier 通过（一次 502 后恢复），线上 release 仍 `ad6c09fe`。公网 `.199=200`、`.198=200`、未知版 `=426`。未提审、未正式发布、未部署生产、未迁移数据库。
- 下一批次与停止条件：唯一下一任务是用小米 14 打开同构建 `.199@e5305bd0`，复核周视图左下/右下圆弧笔画观感；取得同构建真机证据前保持“待用户复核”，不进入其他功能开发。

## 上一批次：周视图回归修复体验版 `.198` 已上传放行，待小米 14 复核

- 回归引入点为 `e8286722`：首页周格被替换为独立 `calendar-week-panel`，并把首页高度公式从 `+20` 改为共享公式。当前修复将首页页面、视图模型和事件处理精确恢复到 `aef86299`；只在补录/预览周格保留共享组件并修正高度、底角圆弧和未来日期灰显。
- 测试先行：新增回归用例先在旧实现上失败（首页结构/高度/事件、补录灰显、预览圆角与高度）；修复后 Mini 全量 `1280 passed / 18 skipped`，根 `1306 passed / 451 skipped`，最终 `pnpm verify` 通过。Mini production verify 通过（4,817,496 B，manifest `a1deb7225864811c054ec55f06fde0b77c90816f4c9fe60d331b5a20c16003a8`），格式、lint、构建、类型、图标门禁和开发者工具 WXML/WXSS 编译通过。模拟器首页仍停在排班读取，真实排班视觉、连续手势及小米 14 未验证。
- 交付：干净 production 候选 `a3eccb490c6f3a31645a6ab8528eea43ff492ff6` 已推送；体验版 `0.1.0-p10.20260925.198` 上传成功（description `weekly calendar parity a3eccb4`、239 代码文件、ZIP 2,703,520 B、Manifest `a9064a4d781a76d7e4137e612f10d8048a569c019878259ed348ddea392d5014`），远端 tag、allocation、manifest 与 receipt 绑定同一 SHA；候选冻结在独占 `general-6`、REUSE_ONLY、未安装依赖，`check-worktree-safety` 前后 `RESULT=PASS/ready-clean-detached`、`VERSION_LOCAL=absent`。
- 放行：按受信物理路线执行 add-only `schedule-client-version-allowlist ensure`，只追加 `.198` 并保留旧版；独立 `verify` 与完整 `ecs-verify.sh` 退出 0，公网 `.198=200`、`.197=200`、动态未知版本 `=426`。线上 release 仍 `ad6c09fe`、schema 未变；本轮 Mini/文档范围不触发生产部署、数据库备份或迁移，未提审、未正式发布、未退役旧版本。
- 偏差与阻塞：首次上传在动态版本分配前被 `trial-lineage` 拒绝——策略 `5285dd1` required checkpoint 仍记录共用组件版首页 `index.ts` 指纹 `0d80dfc…`，而本轮按用户要求把首页恢复到 `aef86299` 后指纹为 `e0f48e5…`；该次无版本、tag、receipt 或平台副作用。只更新该 canonical proof 后门禁与 19 项定向测试通过，提交 `a3eccb49`。模拟器首页仍停在“正在读取排班”，真实排班视觉、连续手势与 320px 仅由自动化/几何代理覆盖。
- 下一批次与停止条件：唯一下一任务是用小米 14 打开同构建 `.198@a3eccb49`，复核首页周视图高度、底角圆弧、蓝色选中框是否完全复原，以及补录/预览周视图与首页是否 1:1 一致；取得同构建真机证据前保持“待用户复核”，不进入新功能开发。

## 上一批次：补录与预览修复 .196 已放行，待小米 14 复核

- 基线 `5befe6a3`；独占 warm `general-4`、REUSE_ONLY、未安装依赖。引入点 `8e68a480`（班种徽标首汉字）与 `672d52ef`（预览独立周格）；详情见 [轮次记录](audit/schedule-week-preview-20260925.md)。
- 共用徽标现按首页规则显示 N/NP/A/D/电脑；补录按群组默认周/月，列表映射月；手排生成、草稿、发布预览的周历复用已有日历分页/单元格，保留灰色已有排班、节假日、日期详情、滑动和定位。代码改动限 Mini；后续生产操作获用户单独授权。
- 定向 42/42，根 `pnpm verify` 1306 通过/451 跳过，Mini production verify 通过（总包 4,801,743 B、主包 1,826,112 B），开发者工具三处 WXML 编译通过。模拟器补录页未获得排班数据；真实滑动及小米 14 未验证。代码检查点 `aef86299` 已推送。
- 经授权上传 `0.1.0-p10.20260925.196@aef86299`；tag、receipt、构建身份及 Manifest `16a51495e92e8f2d60988432632602d0490bb8a5335bb54e559576e83e4e0beb` 一致。交付记录 `17c1c90f` 已推送；生产备份 `49c9cf91-8a30-45b5-ab83-d74f1bf0d80f` 的文件大小和 SHA 核对通过，全部应用/控制/schema 哈希相同时无停机复用发布 `17c1c90f`，前后完整 verifier 通过。`.196` 只追加放行，独立 allowlist 与完整 ECS verifier 通过；`.196/.195=200`、未知版=426。未迁移、提审或正式发布。唯一下一任务：用同构建小米 14 复核护士群补录及三类预览；取得证据前保持待用户复核。

## 上一批次：排班补录与预览修复已上传放行，待小米 14 复核

- 用户授权上传并放行排班补录与预览修复。先将 `4eceafac` 与最新体验版 `.194@a83be6a4` 合并，保留两边功能；上传需绑定合并后的干净 SHA，放行仅追加版本，不替换旧版。真机验收仍待小米 14 同构建证据。
- 三处文本冲突已按两边语义合并；定向 49/49、Mini production verify、完整 `pnpm verify`（根 1306/451 跳过）、格式/图标门禁通过。`pnpm smoke:browser` 因本地 5173 未启动返回连接拒绝，已记录且不计通过；`smoke:check-core` 通过。合并检查点 `d4f0cbe3` 已推送；体验版 `0.1.0-p10.20260925.195` 已从 clean production 候选上传，Manifest `3b593acff0edbdecb90ccea9dca51ec39a35e574600e66b20b6cc37150e579e6`、receipt、远端 tag 一致。
- 用户随后明确授权生产部署。实时回滚基线 `162ef4c1`；候选与线上产物、控制面、schema 哈希完全一致。部署前 verifier 首次在遥测隐私检查报错，汇总只读核对及完整复跑通过后继续。加密备份 `a521826a-24c6-42b7-a38d-319cfb09da67` 的服务器文件哈希与记录一致；可信复用发布将线上 release 无停机切至 `d4f0cbe3`，前后完整 verifier 通过。`.195` 通过 `ensure` 只增放行及独立 `verify`；再次完整 ECS verifier 通过，公网 `.195`=200、动态未知版=426。未执行数据库迁移、提审或正式发布。
- 本轮记录 checkpoint：`docs(release): record schedule preview trial 195 delivery`；文档例外不再次部署或上传。唯一下一任务：用户在小米 14 同构建 `.195@d4f0cbe3` 验证补录日历、选中样式和周/月预览；取得真机证据前保持“待用户复核”。

## 上一批次：按日期发布与成员绑定修复（生产与体验版已交付，待真机复核）

- `162ef4c1` 已推送并部署生产 schema 64；受控恢复后 2026-12 月历及导出各 31 天。备份、部署、数据核对与 API/MySQL 验证见 [完整交付记录](audit/date-granular-publish-binding-20260924.md)。
- 累积体验版 `.192@162ef4c1` 已上传并放行；版本/Manifest 与恢复交付细节见同一记录。可靠的小屏和小米 14 原生复核仍待用户提供同构建证据。

## 上一批次：手动排班预览对照与访客审计去重（生产与体验版已交付，待真机复核）

- 已实现：模板 DELETE 显式 `{}`；草稿按可见三月窗口叠加同岗位已有排班，已有嫩灰、本次彩色且不增加图例；compact 节假日标识专属缩小；访客用可选 `visitId` 按页面实例原子去重，旧客户端仍逐请求记录。无数据库迁移，不清理历史记录。
- RED→GREEN 与全门禁：contracts/client-core 22、Mini 定向 49；真实 MySQL 手排 34、Task10 107；`pnpm verify` 的 Mini 1254/16 skip、根 1302/445 skip、warm 工具 81 全绿。生产 Mini verify/source/package/determinism/dry-run 通过，总包 4,798,345 B、主包 1,821,922 B。
- 运行/浏览器验证：默认 5173 未启动首轮失败不计通过；当前源码 API 3105/Web 4175 的原 smoke 完整通过且临时服务已停。最终 `.191@c6c4fcd2` 在开发者工具能力与一次性预览请求均 200，页面进入预览态、无新增图例、已有排班灰显，Console 无 error/fail；彩色空草稿与 compact 节假日仍由自动化证明。当前证据不等于小米 14。
- checkpoint `c6c4fcd2` 已推送。加密备份 `2432fa5e-bb1e-4b09-ad3e-40da590350b7` 核验后部署生产 `c6c4fcd2`/schema 63，完整 verifier 通过；动态体验版 `.191`（Manifest `0b7a8161…8c46`）上传并只追加放行，`.191/.190=200`、未知版 426。未提审、不正式发布。
- 完整证据见 [交付记录](audit/manual-preview-visitor-followup-20260923.md)；发布记录 checkpoint 以 `docs(release): record manual preview and visitor trial delivery` 标识。唯一下一任务为小米 14 `.191@c6c4fcd2` 原生复核；取得同构建证据前保持“待用户复核”。

## 上一批次：手动排班一次性编辑、366 天应用与模板删除（生产已部署放行，待真机复核）

- 模板/岗位首行约 2:1，其余两行等宽；未保存编辑可直接预览并以同一不可变快照创建草稿。周期矩阵仍限 30 天/20 人/600 格，应用范围独立放宽至含首尾 366 天，保存模板保留自选日期。
- 已保存模板提供独立删除 action 和摘要确认；一次性草稿按业务月拆分，幂等指纹包含完整快照和日期，预览/草稿不隐式写模板。
- 自动化、真实 MySQL、生成器、typecheck、format/lint/build、包体/确定性、浏览器 smoke 与 390px 开发者工具验证通过；模拟器不等于小米 14 验收。
- `eacfd752` 已推送；`.190` 身份/Manifest/receipt 一致。备份 `18760517-efb4-45fa-9012-5b478e658db5` 后部署 `b17a4e57`/schema 63，并只追加放行 `.190`；完整记录见 [审计文档](audit/manual-schedule-inline-editor-20260923.md)。

## 上一批次：联系方式弹窗首次输入层预热（体验版已上传放行，待小米 14 复核）

- 小米 14 `.188@83eb80c` 证明键盘关闭回底已正常；剩余现象严格只发生在应用生命周期第一次打开联系方式弹窗：弹窗已出现后 input 文字慢半拍上移。关闭并重新打开键盘时，sheet 位移和文字已经同步。
- `git log -S`/`git blame` 定位共享 `ui-sheet` 自 `304d742f` 起以 `wx:if="{{visible}}"` 销毁隐藏内容（`5947982a` 后续改手势仍保留）。因此第一次打开同时创建原生 input、播放 sheet 入场动画并自动聚焦；后续原生输入层已被运行时预热，症状不再出现。
- 修复只给 `ui-sheet` 新增默认关闭的 `keepAlive=false`；联系方式弹窗显式启用后，关闭态保留 slot/input 节点但以 `visibility:hidden`、`pointer-events:none`、`aria-hidden` 和禁用动画完全隐藏，input 仍保持未聚焦。其他 sheet 继续原有 `wx:if` 销毁路径，键盘高度、回底、号码校验/保存/409/跨群同步均未改。
- 测试先行：旧实现 3 失败/7 通过；修复后共享/个人页定向 44/44，Mini 全量 1245 通过/16 跳过。typecheck、production verify/package/source/determinism、任务文件 Prettier/ESLint、`smoke:check-core`、diff check 通过；总包 4,568,025 B、主包 1,747,915 B，相对 `.188` 同口径各 +373 B。
- 开发者工具 0.3.11 门禁登录/版本关系正常；当前独占 worktree 的共享 sheet 与 profile WXML/WXSS 编译、模拟器刷新成功，console error 过滤为空。该层不能证明小米 14 第一次原生输入动画已通过。
- 代码 checkpoint `531d7c399cde3407844162fba0104d8fde8d797f` 已推送；干净 production 候选上传为 `0.1.0-p10.20260922.189`（232 个代码文件、ZIP 2,648,616 B、Manifest `5b8e241ec169e38fe21a71a95d3522682a0d62170055f42ce0b15cbe140da2e1`）。可信 allowlist 只追加 `.189`，健康、策略与完整生产 verifier 通过；生产应用 release 保持 `cfa934d1`、schema 63，未执行应用部署、数据库备份或迁移，未提审或正式发布。
- 唯一下一任务：请在小米 14 冷启动 `.189@531d7c39`，分别第一次打开手机号和短号弹窗，确认文字与键盘/弹窗同步；取得同构建证据前保持“待用户复核”。

- 前序 `.186` 修复了联系方式事件转发与 18×18 SVG 箭头；`.185` 及更早二维码/访客改造事实保持不变。用户撤回顶部导航改版，五个主页面原导航/标题继续保持原样；二维码四字段为原生 40px、Storybook 20px。
- 已实现账号级手机号/短号弹窗与跨群同步、`0063` 确定性回填、单环境成员/访客二维码、严格 POST 访客读取、可降级 OpenID 换码、白名单设备上下文及可展开审计详情。
- 用户明确要求不再保留旧正式版兼容并授权生产破坏性迁移：运行时邀请生成/解析/接受/撤销/分享、旧双码接口、群组码服务与权限已删除；`0063` 直接删除 `invite_tokens`、`group_code_attempts`、`groups.group_code`/唯一索引和成员联系方式旧短号列。历史迁移与 Git 历史不改写。
- 验证：累计 Mini 179 文件通过/2 跳过（1241/16），根 Vitest 274 文件通过/36 跳过（1296/441）；真实 MySQL 工作流 94/94、Task10 106/106、迁移 32/32；schema 63 发布/回滚门禁 52/52；typecheck、lint、format、build、Storybook、契约生成、浏览器 smoke、`smoke:check-core` 和累计 CI dry-run 通过。开发者工具状态正常，模拟器刷新、Console 错误检查及二维码面板 WXML/WXSS 编译通过；视觉比较缺成对夹具，不记为通过。
- 累计包体相对前序实现总量 4,578,755 → 4,563,508 B（−15,247），主包 1,747,454 → 1,743,398（−4,056），organization 815,361 → 810,098（−5,263）。实现 checkpoint `f42d3edb` 与发布门禁 `cfa934d1` 已推送；累计 CI dry-run Manifest 为 `2486df9a35d62b2e8cdeb9af73569d49a355719e0744f89b2d878b0cff536ba4`。
- 生产：加密备份 `9e20efab-b355-45e6-ba82-f45745687a8c` 已核对记录、文件大小和 SHA-256；live 已部署 `cfa934d1749ccf92c8b316065e5a17193c4f5a91`、schema 63，完整 verifier 与旧端点 404/新端点 401 探针通过。
- 首次体验上传在版本分配前发现最新累计体验版 `.184@91b19bcf` 不是候选祖先并安全停止，未占号。现已将 `.184` 的选择器统一/长列表安全区合并到二维码面板（绑定对象同步使用共享 selector），没有恢复邀请能力；累计 Mini/包体/血缘门禁全部通过。
- 累积 checkpoint `b45bbbe0` 与等价证明 checkpoint `cbe19af5` 已推送。首次重传在版本分配前由 `5285dd1` canonical 等价证明安全拒绝且未占号；刷新精确 blob 后，血缘/上传槽专项 19/19 与 tracked audit 通过，没有削弱门禁。
- 体验版 `0.1.0-p10.20260922.185` 已上传：候选 `cbe19af5`、production、说明含短 SHA、Manifest `ff14e32989a103e85e5d69e06ed36f0b0c98ff84378adb0ae59e7f6faf2b097d`、232 个代码文件、ZIP 2,646,093 B。远端不可变 tag、allocation、manifest 与 receipt 均精确绑定同一 SHA/Manifest。
- 放行：可信 `schedule-client-version-allowlist ensure` 只追加 `.185` 并保留 `.184`；独立 verify、完整 `ecs-verify.sh` 与公网 `.185/.184=200`、未知版 `=426` 通过。生产应用仍为 `cfa934d1`/schema 63，没有重复部署或迁移；重建预热的一次 TLS EOF 后恢复。
- 交付记录 checkpoint：`docs(release): record QR audit trial 185`；仅根文档，按 Mini/文档例外不再重复生产备份、部署或体验版上传。
- `.185@cbe19af5` 仍可作为二维码、访客详情与五页原导航的旧对照；`.186@59f1e801` 是点击/箭头修复和本轮键盘遮挡的修复前证据。详见 [审计报告](audit/profile-qr-visitor-audit-20260921.md)。

## 历史批次摘要

- 数据缓存与服务器性能审计、极致读缓存与增量同步（已过排班 + 节假日/补班）、Feedback26 导出筛选重置、Feedback25 `.129`、Feedback15 `.112`、Feedback14 `.111`、Feedback13 `.110`、护士照片 139 条导入、feedback11 `.108`、Feedback9 及更早：均已完成交付或放行，未决项统一为“小米 14 同构建复核”。
- 细节按主题检索：`docs/audit/`（轮次记录）、`docs/debug/debug-feedback-log.md`（运行与发布日志）、`git log`（历史检查点）。
