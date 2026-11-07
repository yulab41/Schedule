# 群组切换视图偏好修复

## 范围与原因

- 用户要求切换群组时使用目标群组设置的月、日历或列表视图。本轮仅小程序工作台及回归测试，属于 L1。
- 基线 main/origin/main 为 4540736b，canonical 既有未跟踪文件保留。独占 general-4，Acquire 已完成 ReuseOnly 和 mini Bootstrap，三个 producer 全复用，安装零次。
- `git log -S 'page._groupMonthShiftTypeId = preferences.groupDefaultMonthShiftTypeId'` 与 `git blame -L 2454,2480` 定位至 e94a54ca。读取偏好后只应用默认班种，未应用 effectiveView，群组切换清理也未重置视图。
- GVIEW-01，P2，高置信，已修复。位置为 `apps/miniprogram/src/pages/workbench/index.ts` 的 loadCalendarPreferences、handleViewChange 和 resetCalendarContext。影响为跨群组显示错误视图，风险低，可按提交回退。

## 行为变化与边界

- 账号、群组或角色切换时清理视图初始化标记，先显示月视图，取得当前成员的 effectiveView 后应用。沿用现有服务端成员偏好优先、未设置时采用群组默认值的规则。
- 用户在读取偏好期间主动选择视图后，较晚的偏好响应不覆盖其选择。同一群组前台刷新及读取失败后的恢复保留手动选择。
- 偏好与视图内容经 setCalendarData 一次更新，继续使用现有日期、视图建模及列表补齐逻辑。原有账号、群组、角色、可见性及请求序号校验继续生效。
- 认证访客的现有 display-settings 接口只提供默认班种，没有视图字段，切换进入该上下文采用月视图。未扩展访客接口。
- 本轮是明确行为修复。接收者绑定、原请求次数、异常捕获范围、权限与班种语义沿用原实现，新增初始化标记仅用于视图选择。API、数据库及 WXML/WXSS 无改动。

## 验证记录

- 静态检查和 Node 自动化。基线工作台 31 项通过，typecheck、受影响 ESLint、production build 和 icon:parity 通过。基线定向运行总耗时 8.11 秒。
- 三种目标视图回归在旧业务实现上全部失败，原 31 项通过。修复后 34 项通过。慢偏好响应的手动选择断言同时通过。
- 只读复核发现错误恢复误清理视图，以及测试遗漏首次 onShow。已增加真实前台偏好请求计数与同群组 400 错误恢复断言，先得到 3 失败/31 通过，再修复为 34 通过，总耗时 8.25 秒。
- 最终 `pnpm miniprogram:test` 为 1381 通过、23 既有跳过，197 文件通过、4 文件跳过，耗时 164.05 秒。typecheck、受影响 ESLint、Prettier、icon:parity、production verify、包审计、git diff --check、smoke:check-core 及连续性3项全部通过。只读复评无剩余问题。
- production verify 总包 3889728 B，主包 1128672 B，排班/组织/工作流/洞察分包依次为425091/851105/525349/959511 B。最大文件为工作台 index.js 238334 B。Manifest为80505c47…，本地构建标记local/4540736/dirty，作为本轮自动化证据。保留既有手动矩阵1513节点预算提示。
- 本轮未测同口径基线包体或独立构建耗时，不声称性能、包体改善。Console、Network、冷启动和手机性能当前工具无法测量，暂未验证。
- 本轮使用本地 Git、PowerShell、pnpm、TypeScript、ESLint、Vitest 及现有构建工具。未调用开发者工具或 MCP 运行验证，未取得小米14实体证据。

## 交付与停止条件

- 检查点消息为 `fix(miniprogram): apply calendar view preferences on group switch`。
- 状态为已实现待运行复核。唯一下一任务为同构建体验版复核群组往返切换、三种偏好与手动选择后的前台恢复。本轮停止于验证、提交和推送。
- 本轮没有体验版上传身份，手机验收待后续同构建证据。Mini/文档范围不触发生产部署、数据库备份或服务器发布身份同步。
- 根状态原末尾旧交付摘要为满足40KiB门禁移出当前状态，完整历史仍保存在Git及对应审计报告。

## 第二轮，个人与群组偏好优先级

- 用户明确成员群组优先个人设置，未设置时沿用群组默认；非成员群组采用该群默认。本轮跨Mini、client-core及API，按L2处理。基线1545acba，独占general-4，release Bootstrap六项复用、database/test-fixtures两项增量构建，依赖安装0。
- 成员路径使用既有effectiveView，真实数据库验证个人list覆盖群组week、清除个人设置后回到week。关联访客通过新增getWithView按需请求includeView=true，复用现有三字段显示设置解码器，采用groupDefaultView。原不带参数请求继续只返回两字段，避免已上传旧客户端严格解码失败。
- API在现有权限事务内读取群组视图，使用左连接确保默认班种为空、停用或跨群组时仍能返回群组视图。权限撤销后仍返回403，匿名401，非法includeView为400。无数据库迁移。
- 原缺口来自7842c4da的两字段访客设置，前轮1545acba仅补成员effectiveView。log -S及blame已核对，视图配置与图标/动作代码逐行复核，图标门禁通过。
- 客户端先1失败/4通过，API实库先1失败/40未选择，Mini先5失败/32通过（含查询路径更新的两条预期旧路径失败）；修复后客户端5、Mini37、API访客1及成员偏好2项通过。覆盖六种角色/视图组合、手动视图、错误恢复及迟到访客设置200/403。
- 首次成员实库测试因旧清库列表遗漏user_profile_avatars失败2项，来源f723b0db。改用仓库现有共享resetDatabase，保持权限和业务断言并增加清除个人偏好的回退断言，实库2项复测通过。
- API/client-core/Mini类型、受影响ESLint/格式、API及client-core构建、production verify、包审计、图标及core smoke通过。Mini第一次全量1383通过/23既有跳过/1失败，失败为上一轮HEAD推进后canonical proof仍指向旧工作台blob；按既有runbook另建发布证明检查点，再复测。
- 当前本地生产构建总包3906813 B，主包1131086 B，四分包426283/855665/528322/965457 B，Manifest8107c4dc…。本轮未建立同口径干净基线，不计算提升比例。
- 新实现仍保留已有账号/群组/角色/请求序号及前台可见性校验，采用目标群组偏好；同一群组的手动选择继续保留。第二轮规则取代前述关联访客固定月视图的范围边界。
- 检查点消息为fix(calendar): honor group view defaults for linked guests；生产备份与服务器部署已提出本次授权请求，批准前LIVE_RELEASE_VERIFIED=false。体验版尚未上传，手机证据待后续同构建复核。
- 应用提交6914bf68。按现有runbook另立chore(release): refresh group preference source proof，记录e573f842工作台blob及两轮明确行为变更，图标/动作证据经只读复评通过。门禁与保护文件范围沿用原规则。
- 最终全Mini1384通过、23既有跳过，197文件通过/4文件跳过，163.68秒；血缘定向17通过。Web类型检查、连续性3项及测试发现政策3项通过。此前清库与旧证明失败均保留在本记录，最后复测通过。本轮停止于提交推送，唯一下一任务为获本次授权后备份部署配套API，之后同构建体验版验证。
