# Project Status

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

## 上一批次：数据缓存与服务器性能审计（已交付，待小米 14 复核）

- 用户授权全面检查/优化并允许联系方式持久缓存，确认采用“服务器推送优先、低频校验兜底”。独占 general-5，REUSE_ONLY，安装 0。
- 生产只读基线：live 318b275d，实际内存 1608 MiB、可用 858 MiB；API/MySQL/Web 三容器无重启/OOM，memory PSI=0。此前每分钟重复容器与 MySQL 内存修复仍有效，本轮不重复清理或停服务。
- 已实现：按 owner+group 保存一份联系人；旧格式扫描每进程一次；月缓存未满不遍历 payload；后台预取并发 2；屏外失效和失败游标修正；403 清缓存；节假日只更新年份；扫描缓存 30 秒/128 条、通讯录筛选 LRU 64 条。
- 推送：复用 API HTTP 分块流，无 Redis/新依赖/后台进程；前台单连接，后台关闭，初连/重连补查，120 秒无提示校验兜底；服务端 110 秒重新鉴权、200 总连接/账号 2 连接上限。联系方式跨组更新也发送提示。
- 验证：Mini 1231 通过/16 跳过、根 Vitest 1297 通过/448 跳过、池工具 81 通过、真实 MySQL 日历集成 41 通过；完整门禁分段完成，细节见报告。开发者工具 3.17.3 实收 SSE 分块，配置已恢复；主包 1715052 B、总包 4615896 B；小米 14 未验收。
- Git/生产：应用 `ebcea83e`，血缘候选 `bc5fc307` 已推送 main 并部署，schema 62 未变；现场回滚候选 `318b275d`。加密备份 `1fb654a7-c6d8-497a-a6ec-6c421f86dfa0`（56 表/284764 行/119964272 B）核对记录、文件大小和 SHA-256 后才部署；完整 ecs-verify 通过。
- 体验版 `0.1.0-p10.20260920.181`（`bc5fc307`）已上传并只增放行，旧版保留；`.181`/`.180` 公网能力 200、未知版 426，新流接口未登录 401。发布后仍只有 3 个常驻容器、restartCount=0/OOM=false；备份后短期指标不当作稳态提速证据。
- 详见 [审计报告](audit/loading-cache-server-20260920.md)；旧测试夹具在父源码复跑也失败，已修正调用签名及统计范围，不降低断言。
- 交付记录 checkpoint：`docs(release): record cache audit deployment and trial 181`；仅文档，按例外不再备份/部署/同步服务器元数据。唯一下一任务：小米 14 `.181@bc5fc307` 验证跨设备联系方式静默更新、前后台/断网补查、切组/退出账号隔离；取得同构建证据前保持“待用户复核”，本批停止扩展修改。

## 上一批次：极致读缓存与增量同步（已过排班 + 节假日/补班）

- 用户批准的方案：服务端**群级变更日志 + 单调 `calendar_revision` 游标**，客户端按 `(owner, group)` 持久化"日历快照 + lastSeq"，切月/切周永不等待网络；增量只重取受影响月份。上一批（`.173`–`.177` 快速滑动与读缓存）已合入 `main`，本轮在其之上继续。
- 契约决定（重要偏差）：`calendarReadModelSchema` / `holidayReadModelSchema` 是 `.strict()`，生成解码器为 `additionalProperties:false`；给**已发布**的 `/groups/:id/calendar`、`/holidays` 直接加 `revision` / `version` 会让 `.177` 及更早的体验版与线上 Web 解码失败。故本轮**不改动任何既有响应形状**，改由新端点 `GET /api/groups/:groupId/calendar-changes?since=<seq>` 返回 `{revision, resync, changes[], holidayVersions[]}`；节假日版本也随该响应下发，避免二级通道。
- 服务端：`0062_group_calendar_changes` 迁移（`groups.calendar_revision` + `group_calendar_changes(id, group_id, seq, business_month, kind, changed_at)`，唯一键 `(group_id, seq)`、级联外键、`(group_id, changed_at)` 索引，含 `rollback/`）。`EventWriter.append` 是排班/补录/换班/休假替班/加班/手排的**共同事务汇点**，在此统一记录变更并解析 `businessMonth`；排班配置（班种/岗位）与成员/联系方式/账号手机号走 `runOrganizationMutation` 的 `calendarChange` 声明或显式调用。保留窗口每群最近 500 条或 90 天。
- 兜底（防漏 bump）：读取时用一条 join 聚合比较"排班/班次/事件/班种/岗位/成员/联系方式的 `max(updated_at/deleted_at)`"与"最新变更 `changed_at`"；一旦发现未入账的写入，服务端**当场补记一条 config 变更并返回 `resync:true`**，把"永久陈旧"收敛为"一次整窗重读"。这也是本轮未逐个调用点插桩仍能保证正确性的原因。
- Mini 端：`workbench-read` 复用既有存储边界新增游标 `schedule.wechat.workbench.calendar-cursor.v1:<owner>:<group>`（读/写/校验、账号或退群整体清除）；月份缓存沿用既有 `...cache.v2` 条目但新增"忽略 24h TTL"的读取模式。进入页面先用本地群 ID 同步铺缓存帧（`prerendered` 标记），再发**一次** `calendar-changes`：空增量 → 立刻结束；有增量 → 只重取受影响月份（`resync`/`businessMonth` 缺省 → 可见窗口 ±3）；游标只在所有需要重读的月份都成功后才前进。节假日按 `(year, version)` 校验，版本前进才重取，仍保留 24h TTL 兜底。端点 404/离线/降级时完全回落到今天的行为。
- 明确不做：不做本地写入失效标记。写操作成功后清缓存会让游标归零并触发**整窗 ±3 重读**，比服务端日志驱动的单月增量更慢；服务端 `seq` 严格单调，回到前台必有该变更。
- 顺手修复的阻塞：`main` 上 `pnpm lint` 因 `44b98811`/`9ac4a301` 遗留的 4 处未使用导入（`cancelCalendarPeriodShift`×3、`childArrayKey`）而**长期为红**，本轮一并移除，使 `pnpm verify` 的 lint 段恢复绿色。
- 验证：Mini production verify 通过（主包 1695589 / 总包 4593769 字节）；新增 Mini 增量用例 5/5、API 游标判定 5/5、schema/发布门禁 49/49 通过；根 `vitest` 1279 通过 / 448 跳过（MySQL 集成在本槽无测试库，全部跳过且**不计通过**）；`format:check`、`lint`、`pnpm build`（含 Web）通过。已如实记录两处未验证项：`packages/ui-icons/src/catalog.test.ts` 因本槽 `apps/web/node_modules/tdesign-icons-vue-next` 未链接而失败（环境缺链，非本轮改动，未安装依赖）；MySQL 集成用例（含本轮新增 4 条）本轮跳过。
- 生产部署（L4，本轮已授权）发现并修掉两个"只在真库上才暴露"的缺陷，三次部署后才稳定：①`0062` 缺 `--> statement-breakpoint`，drizzle 把 `ALTER`+`CREATE` 当一条语句执行 → 迁移失败（此时**数据库未被改动**，核对 `__drizzle_migrations`=61、无新表新列）；②指纹 SQL 用了 `schedule_events.updated_at`，而该表是追加表只有 `occurred_at` → 端点 500。修复方式：补 breakpoint；改读 `occurred_at` 并用 `LEAST(..., CURRENT_TIMESTAMP(3))` 夹住未来时间戳；剪枝下界用 `Math.max(..., 0)`；并新增 schema 形状测试钉住"事件表没有 updated_at/deleted_at"。
- 生产现状：`main`=`e4b8d1f6`（应用代码）、部署前备份 `8121099c-329e-43a9-8c81-bb05c8946275`（56 表 / 282559 行 / 119241208 字节，SHA-256 `da69407f…815d3`）、live release `e4b8d1f613d985d058bc5afca2b16cbb818ad799`、数据库 schema 62；完整 `ecs-verify.sh` 通过（`[verify] complete`），公网探针 `/api/health`=200、直连公网 IP 被拒、未鉴权 `/api/groups/<uuid>/calendar-changes`=401（路由已上线而非 404）。生产 MySQL 上以 `START TRANSACTION … ROLLBACK` 只读演练了记账、剪枝、指纹、增量与节假日版本五段 SQL，全部执行成功且回滚后 `group_calendar_changes`=0 行、`calendar_revision`=0。
- 遗留过程风险（已记录）：首次失败时 `ecs-update.sh` 会把 `deploy-manifest.json` 覆盖成新 manifest 而 `current-release` 仍是旧值，导致它自己的重试守卫报"上一发布身份不一致"。本轮的处理是把该文件从 `/opt/schedule/releases/44034fcc…/deploy-manifest.json` 复制回原位（同一脚本刚覆盖的文件，可核验可回滚），再正常前滚；另存了一份 `deploy-manifest.json.failed-7470efb1` 备查。
- 逐条复核（2026-09-19 晚）：按计划条目在 main 代码上只读核对，确认账本/游标、成员鉴权（`guest` 只有 `viewGuestCalendar` ⟹ 403）、12 个 `updateShiftAssignments` 调用点全部位于已记账事务内、节假日确认必然伴随版本前进、Mini 的缓存优先+单次校验+按月增量+游标后置推进均已落地。**发现并修复 1 个真实缺口**：计划的"缓存保留最近 24 个月（LRU）"未实现，`ignoreAge` 读取让原 24h TTL 失效后持久月份缓存等价于无上限增长 → 新增 `WORKBENCH_MONTH_CACHE_LIMIT=24` 与淘汰逻辑（写入后按 `savedAt` 保留最新 24 个月）+ 26 个月淘汰用例；同时补了一个契约用例钉死"既有 `/calendar`、`/holidays` 形状闭合，`revision`/`version` 只能走新端点"。有意偏差三条（既有响应不加字段、不做本机写入本地失效、先 API 后体验版）已在调试日志逐条给出理由。
- 体验版：`0.1.0-p10.20260919.179`（候选 `063bb67a`、234 个代码文件、ZIP 2628279 字节、Manifest `73351d99…118c`）已上传并放行，`ensure`+`verify` 通过；公网探针 `.179`/`.178`/`.177`=200、未知 `.7777`=426。上一版 `178`（候选 `373ae354`、Manifest `d1e6439d…c841f`）保留可用。lineage policy 本轮无需再改（未触碰 `workbench/index.ts`）。
- 闭环进度（2026-09-19 晚，用户授权）：**第 1 项已完成**——用本地 Docker `mysql:8.4.11`（与生产同版本）跑通约 263 个 MySQL 集成用例，零生产负载；顺带抓到并修掉 3 个真实问题（迁移计数真实值是 62 且旧断言本就 stale、两个 legacy 夹具被新列 `calendar_revision` 打破、我自己那条保留窗口断言的语义写错），另证明 `schedule-repository` 的 2 个失败是"用例硬编码 2026-08 而今天已是过去月份"的既有日期过期失败（临时停掉新记账写入后一字不差复现）。**第 2 项受阻**——开发者工具运行态上报 `version=local`，被生产能力门禁按设计拒绝（400），探针拿不到日历请求数；跑通需另起"本地 API + dev profile + 本地放行 local"的一批工作，把 `local` 加进生产白名单是错误做法。
- 服务器体检与减负（回答"是否被我留下垃圾"）：**我这次没有留下垃圾**（`/tmp` 残留 0、`/opt/schedule` 174M、只有 3 个生产容器、无遗留 `api-run-*`、docker 可回收 0B）。顺手清掉宿主机历史占用：journal 3.8G→537M（并加 `SystemMaxUse=500M` 上限）、apt 缓存 313M→72K、移除 snap 旧 `lxd` revision，`/` 从 17G/44% 降到 13G/33%。真实瓶颈是机型本身（2 vCPU/1.6G 内存、swap 已用 1.1G、长期高 iowait），可选优化是关 `performance_schema` 或升内存，**需重启 MySQL 容器，等用户同意后再做**；未动 swap（`swapoff` 有 OOM 风险）。
- 生产 MySQL 内存优化（用户批准，release `318b275d`）：关掉 `performance_schema`（实测占 MySQL 内存 46%/233.7MB）并把 `innodb_log_buffer_size` 从 64M 回到上游默认 16M；本地同镜像 A/B 为 441.1MiB → 143.7MiB（省约 297MB）。已写入 `infra/docker/compose.prod.yml`（必须落在仓库，否则部署会覆盖），部署后可用的 mysqld RSS 约 174MB 空闲 / 210MB 跑完全库备份（优化前同等工作下测到 507MB），宿主机 swap 从 1.1G 降到约 0.2–0.25G。部署前备份 `9e716397-26ae-4f09-b3d2-64dfe550e69b`；`ecs-verify.sh` 完整通过，全库备份与隐私保留任务冒烟通过。**注意**：本地 `scripts/directory-query-readiness/*` 基准脚本依赖 P_S，对生产跑需临时开回。回滚=去掉两个参数重新部署并重建 mysql 容器。升内存需在阿里云控制台操作（我做不了）。
- 2026-09-20 批次（用户指派）：①**联系方式丢失（我上一批引入的回归）**——`sanitizeCalendarForCache` 会剥掉落盘副本里的 `members[].mobilePhone`，而持久缓存已从"离线兜底"变成"在线主渲染"，于是缓存渲染的月份在详情卡片里只剩短号、没有短号就整行消失（切群组时最明显）。修法：把缓存命中标记为 `contactsIncomplete`，对**正在看的那一个月**补一次网络读取并重渲染（每群每月至多一次、不动游标）；落盘仍保持不含手机号。代价是进入页面/切群后多 1 个后台月份请求。②**节假日版本漏判**——被查看月份现在始终经版本感知读取（版本一致时零请求），仅当本地已有版本且与发布版本不同才整窗标脏。③**节假日存储去重**——月份条目只留 `holidayYear`，节假日按年只存一份，旧形态仍可读。体验版 `0.1.0-p10.20260920.180`（候选 `5b9c2e21`、Manifest `e8e896d9…57ff`）已上传放行，探针 `.180`/`.179`=200、未知=426。Mini verify、`workbench-calendar-sync` 7/7、`workbench-holiday-dedupe` 4/4、format/lint 通过。
- 下一任务/停止条件：小米 14 打开体验版 `0.1.0-p10.20260920.180`，确认（1）切换群组后详情卡片手机号稳定出现；（2）节假日/补班角标与后台一致；（3）手感与 `.179` 一致。未取得与 `5b9c2e21` 一致的真机结论前，不得写"小米 14 验收通过"。若要继续闭环开发者工具探针，需先做本地 API + dev profile 环境。

- 更早批次（Feedback19 及以前，以及 Feedback20–26 细节）见 Git 历史与 `docs/audit/` 对应文档；本文件只保留策略变更、当前月历批次与近期交付指针。

## 历史批次：Feedback26 导出筛选切换重置文件状态

- 基线`4d75ab20`；独占general-1，REUSE_ONLY且无安装。设计与证据见`docs/superpowers/specs/2026-09-14-feedback26-export-selection-reset-design.md`和`docs/audit/feedback26-export-selection-reset.md`。
- 根因是导出周期/类型只更新选择摘要，岗位/人员多选直接写data，均未使已生成任务和临时文件失效。现在七类实际参数变化统一清理旧任务并回到“选择内容后创建任务”；相同值点击不重置。
- 回归RED为7失败/29通过，GREEN控制器36通过；导出下载/直接Page/thin-page联合43通过。Mini production verify通过，包体4579789字节、Worklet2/2、Manifest`30a26638…9cb9b`；保留既有内部预警。
- 待提交检查点：`fix(miniprogram): reset generated export after selection changes`。未操作微信开发者工具、未上传体验版、未部署生产。如需小米14原生复核，由 Agent 在最终干净SHA上自主上传体验版（不再需要另行授权）。

## 历史批次：Feedback25 已部署并放行体验版129，待小米14复核

- 小米14 `.127` 证据确认：访客五行月历因 viewport 62px/行而 panel 仍54px/行产生底部留白；访客列表模板漏掉成员列表已有的班种状态。需继续核对医生/护士月周列表结构与交互，成员日历页面禁止修改。
- 访客二维码当前只有5分钟进程缓存，冷路径串行生成正式/体验两码并在客户端二次绘制；用户确认二维码永久保存，只有手动“刷新访客码”才更换 visitorKey 并废除旧码。设计采用独立持久资源表、双码并行、同请求合并和分段脱敏耗时证据。
- 设计与计划见`docs/superpowers/specs/2026-09-13-feedback25-guest-calendar-qr-performance-design.md`及对应plan。访客month panel已补齐62px rowHeight，列表主体结构与成员一致；成员日历文件零修改。schema61永久保存正式/体验访客二维码，冷生成并行且合并重复请求，刷新事务内废除旧资源，界面统一“刷新访客码”。
- RED旧代码Mini 4/5失败且0061缺失；Feedback25/guest/导出/布局55项、schema兼容与备份表计数32项通过。完整门禁根1266项通过/443跳过、Mini1175项通过/16跳过；Windows release-cache rename曾一次`EPERM`，独立复跑4/4通过。Mini production verify主包1728134、总包4580599字节、Worklet2/2及确定性通过，`smoke:check-core`无需Web冒烟。MySQL持久化集成已加入但warm槽无测试库而14项跳过。独占general-1，REUSE_ONLY且未安装依赖；成员日历零修改和逐行diff通过。
- 应用检查点`21fe6591`及验证器检查点`590aebb4`已推送；schema61/API与最终可信控制面已部署。首次备份`ef3a25ea-0180-462b-819c-fa75ad5081f4`为54表/256555行，最终部署前备份`9a29cb36-fe58-44c3-a933-6114e6a6c16b`为55表/256584行/108379344字节，SHA-256 `2981b347…05d558`。完整生产verifier通过。
- `0.1.0-p10.20260914.129`以production/clean绑定`590aebb4`上传成功，Manifest `21075b8e…fdb360`；可信ensure仅追加129并保留全部旧版本。allowlist verifier、完整ecs verifier及公网探针通过：129/128=200，动态未知=426。未提审、未正式发布、未退役旧版本。当时下一任务：小米14打开129复核医生/护士访客月周列表、首次/再次读取二维码及“刷新访客码”速度。

## 上一批次：Feedback15 已部署并放行112，待小米14复核

- 用户批准八项计划；基线a8695f2a，独占general-4依赖复用、无安装。详情docs/audit/feedback15.md。
- 当前周独立测量/点选局部更新、before折叠、岗位改名接口与弹窗、月历顺延/62px、三视图补班、单按钮两步授权及日期文字盒居中已实现。
- pnpm verify通过：Mini1184/16跳过、根1252/439跳过、依赖保护81；MySQL模式集成套件46项通过。收口额外通知保存失败回归RED1→联合35通过，最终Mini verify/Worklet2/2/包体通过（主包1708859/总4550421字节）。
- 390/320真实WXML/生产CSS几何及运行/浏览器验证：pnpm smoke:browser通过；smoke:check-core通过。本地synthetic管理员标记已回读恢复、3105/4175服务已停止；小米14原生待同版本复核。
- 83d8a03b已推送；112/83d8a03已上传成功，357文件冻结包/receipt/远端tag一致，主包1709858/总4552499。上传专项30项及候选前后检查通过，见docs/audit/feedback15-trial-release.md。
- 用户随后授权生产操作：备份d89f173b-8b76-463c-b560-3e0726ff3d5d成功（54表、106182176字节）；服务端83d8a03b部署完成，schema57，独立ecs-verify通过。生产健康探测首段短暂502后恢复，未改变业务数据。
- 可信ensure仅追加112并保留111；allowlist verifier、再次ecs-verify及公网策略探针通过：112/111=200，动态未知=426。未执行replace、版本退役或真实通知。
- 当时下一任务：小米14重开体验版112/83d8a03b，复核八项交互和视觉。自动化与生产验证完成，原生待用户复核；不重复上传、放行或部署。文档检查点docs(release): record feedback15 trial 112 delivery。

## 上一批次：Feedback14 已交付111，导出白屏待同版本报告

- 本轮限定两项反馈；实现与引入点见docs/audit/feedback14.md。基线e163fde8，独占general-4/5依赖复用、无安装。
- 更多页位移来自7923262d的onHide删除底部诊断区域、返回再插入。现在普通遮盖保留已授权区域，权限撤销仍即时生效，后台不能新授权或跳转；没有WXML/WXSS或无关UI修改。
- 新位移回归先失败后通过；workbench31、联合真实导出及诊断69项通过。390×844/320生产样式浏览器复现旧内容缩短107px、修复布局保持不变，原生效果待同版本验收。
- 导出已对照102/106及9bae5beb、执行110真实冻结JS与真实Page测试，未证实原生白屏根因。新增可复制的固定首屏阶段与root/header/scroll分类诊断；不改CSV操作语义，不宣称白屏已修复。
- 检查点fix(miniprogram): stabilize More navigation and expose export render stages；完整pnpm verify通过：Mini1179/15跳过、根1251/436跳过、依赖保护81；最终Mini verify、Worklet2/2及包体通过。用户随后批准上传并追加放行，已交付111/6b8a9e9，保留110；完整生产verifier/allowlist及公网111/110=200、未知426通过。服务器仍e163fde8，无新应用部署。
- 当时下一任务：小米14重开111/6b8a9e9，复核更多位移，进入导出停留5秒返回，再到测试工具刷新并复制完整诊断报告。交付见docs/audit/feedback14-trial-release.md；不重复上传、放行或部署，白屏仍待定位。二维码及自动收信待用户原生复核状态保留。

## 上一批次：Feedback13 已部署并上传110，待用户真机复核

- 应用8f441d2d已推送部署，累计体验版0.1.0-p10.20260912.110上传成功并仅追加放行，109继续可用。四项日历修复和五类通知独立授权入口均包含；交付证据见docs/audit/feedback13-release.md。
- 加密备份0e13bb85-dabe-40b4-ae94-a7beb6fafefc（54表、106020632字节）实际hash核验一致；schema57，无新增迁移。完整生产verifier/allowlist通过，公网110/109=200、未知426。
- 五模板配置、四业务模板实际字段和外部消息能力复核通过。未主动发送真实消息、不重放历史通知。上传30项、356文件Manifest/receipt/远端tag一致，主包1704137/总包4535157字节。
- 实现验证沿用完整pnpm verify：Mini1170/15跳过、根1251/436跳过、依赖保护81；额外跨月高度2项、MySQL calendar36及390/320生产CSS/ViewModel几何和本地浏览器通过。均非小米14验收。
- general-4/5独占复用，无依赖安装。文档检查点docs(release): record feedback13 delivery，在本次部署授权内以可信哈希复用流程同步文档release身份，应用及体验包仍绑定8f441d2d。
- 当时下一任务/停止条件：小米14重开110/8f441d2，复核四项日历交互及五个通知授权按钮、自然自动收信；二维码相册保存、导出白屏和发送文件仍待当前版本真机证据，不提前标记完成。不重复上传、放行、模板配置或护士导入。

## 上一批次：护士照片139条已录入，待用户查看

- 用户明确批准多人补录及静默导入修复、代码修改和生产部署，最终继续139条已确认数据导入。只匹配已有成员/班次，D5电脑，指定跳过项不写；资料留ignored runtime。
- 基线fe505ee9，独占general-4依赖复用，无安装。新增可选成员匹配补录和静默手排，旧行为/旧请求幂等指纹保持，无数据库迁移或小程序上传。详情docs/audit/nurse-schedule-import.md。
- 旧版两项MySQL回归失败；修复后32个不同MySQL用例、契约/路由10项通过。pnpm verify通过：Mini1122/15跳过、根1241/424跳过、依赖保护81；浏览器完整冒烟及smoke:check-core通过。代码及运行验证已完成。
- 生产备份542b8bcb-9796-4cb2-92b0-25d740229594（54表、105228472字节）已核验文件hash；数据尚未录入。
- c4a9b67f及补充修复a90e3b0a均已推送部署，最终live=a90e3b0a2b1db4eb252eb73e3940964bbf83813d、schema57；完整生产verifier通过。计划人员回退查找回归RED为3条而非2条，修复后MySQL12项复测通过，API build/lint/格式与smoke:check-core通过。
- 最终部署前备份f2cca68a-7547-4b16-8d0a-841019f55cce（54表、105250592字节）文件hash与登记一致；即时回滚候选c4a9b67f。两次打包均85包复用、downloaded0，无依赖安装。
- 2026-09-12北京时间08:08事务提交139条：历史54、当前/未来85；独立回读139一致、重复0；原有287条有效排班不变，其中9月1—6日59条保留。成员、岗位、班次配置不变，通知/投递新增0，无小程序上传或新增迁移。
- 原照片1处NP到次日11:00、A次日08:00的3小时重叠按确认原样保留，不自行改班。报告与个人明细仅存ignored runtime/audit/nurse-import-20260911。
- 文档收口：docs(ops): record verified nurse schedule import；仅记录已交付应用与数据，不重复部署或导入。当时下一任务：用户刷新护士群日历查看9月7—20日；自动交付已完成，真机显示待用户复核。

## 上一批次：feedback11 体验版108已上传放行，导出空白待定位

- 用户批准三项故障修复计划；基线72ea0ab0，独占general-4复用依赖，无安装。二维码PNG/JPEG格式与通知空JSON正文缺陷已复现修复；导出真实Page/模板检查通过但原生空白未复现，未猜测修改。
- RED 4失败/38通过；完整格式/lint/build/typecheck、Mini1122/15跳过、根1240/421跳过及依赖保护81通过；最终Mini verify、Worklet2/2、包体/确定性和smoke:check-core通过。主包1679971/总包4502798，保留已有内部警告。详情见docs/audit/feedback11.md。
- 用户明确授权上传并放行；c563afff已交付`0.1.0-p10.20260912.108`，production/clean，354文件Manifest/receipt/远端不可变tag一致。上传专项30项及候选前后检查通过，主包1681039/总包4505008。详情见docs/audit/feedback11-trial-release.md。
- 可信ensure只追加108并保留旧版；完整生产verifier与版本策略验证通过，公网108/107=200、未知版本426。即时服务器仍b618d938，本轮没有新应用部署、备份、迁移或真实通知；网络及107残留操作锁已验证处理，版本预约记录全部保留。
- 文档检查点：`docs(release): record feedback11 trial 108 delivery`。当时下一任务：小米14重开108/c563aff复核二维码和通知，并取得导出空白安全诊断继续定位。不得写三项全部完成，不重复上传/放行或部署。

Feedback10/VIS-02 与更早批次的部署、备份、体验版和验证细节见 Git 历史及 `docs/audit/feedback10-release.md`；本状态文件不再重复历史流水。

## 历史批次：Feedback9 及更早交付

- .102 及更早版本的验证、备份、放行和真机待办见 Git 历史与 docs/audit/feedback9.md、docs/audit/feedback9-trial-release.md；当前唯一下一任务以上方当前批次为准。
