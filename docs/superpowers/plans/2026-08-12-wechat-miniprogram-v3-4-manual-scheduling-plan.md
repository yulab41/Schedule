# 微信小程序 V3-4：双模式手动排班阶段计划

- 文档日期：2026-08-12
- 状态：**Task 11/12 已实现待设备复核；Task 13 已实现待 DevTools/设备复核**
- 前置检查点：Task 11 `4a0d44c`、Task 12 `43eae1c` 已正常快进推送；V3-3 Task 9、Task 10 的代码、真实数据库测试与 DevTools 验证已完成，Task 9/10 真机角色矩阵仍待用户复核
- 实施范围：V3-4 Task 11–13——双模式手动排班、模板应用、草稿/发布与并发保护
- 权威顺序：共享契约/API/integration tests → 当前 Web 运行代码与用户确认交互 → V3 设计第 3、8、9–12、15 节 → 本计划

> 当前小程序已封装模板、预览、应用、草稿、发布和撤回的既有端点；尚未存在任何手动排班页面或本地编辑状态。本阶段只能消费这些真实端点和共享契约，不能为移动端补造 API、字段、权限、版本号或离线写入协议。

## 0. 处女原则、阶段目标与不可扩大范围

本阶段采用**处女原则（clean-slate / 可重复的初始态）**：每条关键旅程都从无本地草稿、无选中班种、无缓存依赖、无偶然登录态和无服务端遗留草稿的可控起点验证；已加载模板、快速点按、切换群组、失败和 409 只是在该基线之上的显式状态转换。不得把一次偶然可用、旧选择残留或历史数据容忍当作交付通过。

V3-4 的最终目标是让 owner/administrator 能安全完成“选择岗位和成员 → 编辑本地模板 → 保存 → 预览应用 → 草稿/发布/撤回”的完整闭环，同时保持：

1. 人员为行、日期为列；班种颜色、简称、停用警告、节假日、CST 日期和已过日期语义与 Web 一致。
2. 单元格优先与班种锁定共用**同一份**内存草稿、选择状态、撤销栈、校验结果和服务端冲突恢复路径。
3. 编辑单元格、切换班种、撤销、行/列清空不会产生任何服务端写入；只有用户明确保存模板、应用、发布、撤回或删除时才调用既有写端点。
4. 预览不是锁；写入仍由服务端事务、`operationId`、`expectedVersion` 和当前规则版本裁决。409 必须刷新权威数据、保留原错误并要求重新确认，绝不自动重放。

明确不在 V3-4：涂抹排班、离线写队列、自动重试/持久化 operationId、手动补录、排班配置管理、统计/导出、群组/平台管理、API 或共享契约改造，以及把 Skyline 扩展到手动排班页。涂抹仅可在 V3-6 作为独立 Spike；Task 11–13 均保留 WebView 基线，除非独立证据批准变更。

## 1. 已核验的事实与从 Web 调试继承的硬规则

| 事实或历史根因                                                                                                                         | V3-4 的固定决议                                                                                                                                                     |
| -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 小程序 `api/endpoints.ts` 自 `a68dd03` 已有模板 CRUD、`apply-preview`、`apply`、草稿/历史、批量发布、发布/撤回和 change-impact wrapper | 先为 wrapper 写 method/path/body/auth 边界测试；页面只注入/调用这些 wrapper，不改 API 或契约来迎合界面                                                              |
| 工作台已显示“手动排班”管理员入口，但没有 route；现有 `route-guard` 只解决 anonymous/guest/成员存在性                                   | 新增明确的管理员上下文解析；owner/administrator 才能在任何数据请求前进入，member/guest/无效 group 一律回工作台且 endpoint 调用为零                                  |
| Web 曾因 sticky/grid 表格在移动 WebView 错位，后改为人员行、日期列、普通横向滚动表格                                                   | 小程序网格不用 sticky/grid 拼接桌面布局；采用稳定列宽的单一横向 `scroll-view`，纵向滚动留给页面壳，轴向和触控边界可测试                                             |
| Web 绘制模式已验证“同班种再次点击清空”，且下一可用开始日只计未删除的 published 期间，用户手动日期优先                                  | 单元格优先和锁定模式都保留 toggle-off；默认开始日是今天/下一可用建议值而非硬约束，手动选择永远优先                                                                  |
| Web 发现已批准请假、已过日期、活跃工作流、重叠草稿/已发布版本必须由服务端阻断并给出具体原因                                            | 本地不复制排班规则；预览/写入显示服务端具体错误和影响。现有 `acknowledgeBlockers`、`replace*`、workflow acknowledgement 仅在契约允许时出现                          |
| Web 曾把刷新后的通用提示覆盖掉 409/请假详细原因，造成“点击没反应”                                                                      | 冲突流程固定为“捕获原错误 → 废弃预览 → 刷新权威模板/草稿/历史与受影响月 → 发布原 message/安全 latest summary”；不先清错误、不自动重交                               |
| V3 日历曾因 slot 内 fixed 层、未 composed 的组件事件、无显式 scroll-view 高度而出现入口不可见或无法点击                                | Task 11 长按清除优先使用 `wx.showActionSheet`；自定义组件跨页事件必须显式 `{ bubbles: true, composed: true }`；未来自绘确认层必须放在页面级宿主且滚动视口有明确高度 |
| V3 月导航曾因 fast-path 不 emit 而永久 loading，多个控制器均已使用 generation/single-flight                                            | 手动排班 controller 用 `contextKey + generation` 淘汰过期完成；同步抛错也必须释放 flight；切群/退出/重新进入不得让旧模板或旧错误回填                                |

## 2. 阶段拆分、权限和停止线

| 批次    | 唯一目标                                  | 当前可执行性                 | 单独停止条件                                       | 预计 checkpoint                                                      |
| ------- | ----------------------------------------- | ---------------------------- | -------------------------------------------------- | -------------------------------------------------------------------- |
| Task 11 | 单元格优先、本地草稿、模板 CRUD、长按清除 | 已实现，待设备复核           | 可从全新空态编辑/撤销/保存模板；无编辑期写入       | `4a0d44c feat(miniprogram): add cell-first manual scheduling`        |
| Task 12 | 班种锁定、连续填入、轴向隔离              | 已实现，待设备复核           | 与 Task 11 同一草稿源；快点和横向滚动不误填/误切月 | `43eae1c feat(miniprogram): add locked-shift editing mode`           |
| Task 13 | 应用、草稿、发布/撤回、409                | 已实现，待 DevTools/设备复核 | 不多/少日期、不丢事件、不覆盖更新后的排班          | `feat(miniprogram): add template publishing and conflict protection` |

每个 checkpoint 都必须单独提交、正常 fast-forward 推送并停止。Task 12/13 只冻结本阶段的业务与验收边界；在 Task 11/12 的真实文件和测试落地前，不伪造它们的最终类型、行号或实现细节。

## 3. Task 11：单元格优先编辑器与班种调色板

### 3.1 文件职责与真实依赖

| 文件/目录                                                                                         | Task 11 职责                                                                                                                            |
| ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/miniprogram/features/manual-schedule/manual-grid-logic.ts`（新增）及测试                    | 纯 CST 日期列、`cycleDay:membershipId` cell key、选择/填入/同班种清除、行列清空、不可变草稿快照、有限撤销栈、停用引用显示和长按阈值判定 |
| `apps/miniprogram/features/manual-schedule/manual-schedule-controller.ts`（新增）及测试           | 注入现有 endpoint wrapper；按群组/版本激活、generation、single-flight、加载/保存/删除/409 状态；不含 `wx`、WXML 或服务端规则复制        |
| `apps/miniprogram/components/manual-grid/*`（新增）                                               | 仅渲染行、日期列、节假日摘要、选中/失效/班种令牌，转发 tap/long-press；不请求 API、不访问 session、不直接写 storage                     |
| `apps/miniprogram/components/shift-palette/*`、`manual-actions-sheet/*`（新增）                   | 自绘大热区班种面板和本地清除/撤销操作；已停用班种只能显示警告，不能新填入                                                               |
| `apps/miniprogram/features/navigation/workbench-navigation.ts`、测试与 `pages/workbench/index.ts` | 为现有管理员“手动排班”入口建立带 `groupId/groupRole/groupVersion` 的实际 route；不改变 member/guest 的可见矩阵                          |
| `apps/miniprogram/subpackages/manual-schedule/pages/editor/*`（新增）、`app.json`                 | 新增按需加载的手动排班分包和编辑页；页面先做 route/管理员检查，再创建 controller 并同步 WXML-safe state                                 |
| `apps/miniprogram/api/endpoints.ts` 与 `.test.ts`                                                 | 仅验证/消费现有 scheduling config、template、history、holiday 端点；若实际契约不足，停止在计划层，不扩接口                              |
| `apps/miniprogram/features/navigation/route-guard.ts`、manifest/page boundary tests               | 锁定管理员路径、分包注册、guest/member 直接 URL 拦截、组件依赖边界和跨组件 composed 事件                                                |
| `docs/project-status.md`、`docs/debug/debug-feedback-log.md`                                      | 记录 git provenance、红测、实际设备证据、验证结果、行为变化和下一批；不把 DevTools transport 问题记成页面通过                           |

### 3.2 红测优先的完成步骤

- [ ] **入口与权限红测。** 对 `workbench-navigation`、route guard、manifest/page boundary 新增失败断言：owner/administrator 的指定 group 才得到 manual route；member、guest、匿名、已离群 group 和 platform-admin + guest 都不能进入；被拒页面在 `onShow` 前不创建 controller、不请求模板/配置。先用 `git log -S "id: 'manual'"`、`git log -S 'requiresMembership'` 和 `git blame` 记录入口来源。
- [ ] **纯草稿逻辑红测。** 新模块首先覆盖：今天、月/年边界、7/30 天列数；人员行 × 日期列；同一 cell key；选择后选择同班种清除/选择其他班种替换；取消选择；行/列/单元格清空；每次有变化都生成独立 undo snapshot；undo 不修改原 map；无选择或不可用班种不改变草稿。`cycleDays` 必须是 1–31，非法日期/成员/班种输入在纯层明确拒绝。
- [ ] **模板陈旧与首次进入红测。** 模板现有成员/班种引用仍要显示姓名、简称和颜色，同时以警告标示 member 离岗、班种停用或版本变化；禁用班种不能新填，但不能被静默从旧模板删除。无模板、无岗位成员、空模板和无节假日均有稳定空态；首次进入默认日期是中国业务今天，建议下一可用日期只读取未删除的 published 历史，用户手改日期不被后续 refresh 覆盖。
- [ ] **controller 红测。** 依赖接口只包含已有 `getSchedulingConfig`、`listManualScheduleTemplates`、`listSchedulePeriodHistory`、`getHolidays` 和 template CRUD wrapper。测试同 context 复用单个加载 Promise；同步 wrapper throw 会释放 flight；A→B 群组切换、logout、页面隐藏后 A 的迟到 resolve/reject 都不能发布；模板 update 使用加载到的 `expectedVersion`；create/update/delete 成功后才刷新权威列表。
- [ ] **冲突/错误红测。** 保存遇 409 时保留原始 message/安全 latest summary，刷新权威模板与配置，废弃待保存动作且不自动重发。内存草稿进入显式“需重新核对”状态，用户只能明确选择重载权威模板（放弃本地更改）或返回编辑；不得把旧 `expectedVersion` 或旧 cell map 原样再提交。网络错误保持内存草稿和可重试保存入口。
- [ ] **实现单一状态源。** controller state 是页面唯一数据源，包含 context、配置/模板/节假日、编辑中的 membershipIds/cells/selectedCell、undo、stale refs、loading/error/conflict。WXML 只消费 WXML-safe display state；禁止把 `Map`、原始 API 对象、函数或 promise 交给 `setData`。编辑期绝不写 `wx` storage、cache 或 API。
- [ ] **实现页面交互。** 页面布局为岗位、成员、开始日、周期天数 → 稳定尺寸横向网格 → 底部班种面板 → 保存/删除/撤销。单元格优先严格执行“点格 → 点班种 → 写一次”；班种按钮不跨单元格锁定，这属于 Task 12。班种全称和颜色令牌可见，单元格展示简称；姓名不固定三字截断；节假日保留放假/调休语义。
- [ ] **实现安全清除。** 长按仅在持续至少 500ms 且横向位移小于 12px 时打开 `wx.showActionSheet`，提供清空此格/行/列。整行或整列必须经 `wx.showModal` 二次确认；清除与撤销只改本地草稿。横向滑动、页面滚动、只读日历和班种按钮均不得触发清除。
- [ ] **走查与 checkpoint。** 模拟器至少覆盖 7/30 日、窄屏横向滚动、选格/填入/替换/清除/撤销、禁用引用、空态、A→B group 切换和 member/guest direct route。更新状态/日志，审查 staged diff 后提交并推送 Task 11 checkpoint，然后停止。

### 3.3 Task 11 验收矩阵

| ID     | 初始态/动作                   | 必须结果                                                             |
| ------ | ----------------------------- | -------------------------------------------------------------------- |
| M11-01 | 全新管理员群组，无模板        | 默认今天、无选中班种/单元格；不发写请求；空态可创建本地模板          |
| M11-02 | 选 7/30 天并勾选成员          | 精确 7/30 列，人员为行、日期为列；跨月节假日正确；横向滚动不改变选择 |
| M11-03 | 点 cell 后点班种、再点同班种  | 先填入，再清空；不同班种是替换；每次可撤销                           |
| M11-04 | 先点班种、尚未点 cell         | 不写任意 cell，也不进入 Task 12 锁定态                               |
| M11-05 | 长按 cell/row/column 与滚动   | 只有 500ms/12px 内的长按打开操作；行列二次确认；滚动不误清           |
| M11-06 | 模板含离岗成员或停用班种      | 已有引用可见并警告；禁用班种不可新填；保存由服务器最终校验           |
| M11-07 | group A 加载中切 B / logout   | A 任何迟到 success/error 不回填；flight 释放；B 无 A 的模板/错误     |
| M11-08 | update 409                    | 刷新权威数据、显示原错误；无自动重发/覆盖，用户明确重载后才可继续    |
| M11-09 | member/guest/匿名直达分包 URL | 路由在请求前返回工作台/登录；manual endpoint spy 为零                |

**Task 11 停止条件：** 以上矩阵通过，页面仅实现本地单元格优先和模板 CRUD；没有班种锁定、模板应用、草稿发布或服务端排班写入。

## 4. Task 12：班种锁定、连续填入与触控隔离（冻结，待 Task 11 后展开）

Task 12 必须在 Task 11 的实际 state 与页面结构稳定后重新读取文件、`git blame` 和真实失败测试；本节不预设最终文件签名。届时只能在同一 controller state 中增加 `lockedShiftTypeId` 或经测试的等价状态，绝不可建立第二个 cells map、第二份 undo stack 或独立写入路径。

固定需求如下：

1. 选择班种后进入显式锁定态，锁定按钮和页面顶部都有“退出锁定”入口；连续点击任意 cell 直接填入，同班种再次点同一 cell 清空，换班种后后续 cell 使用新班种。
2. 使用 `membershipId + businessDate/cycleDay + shiftTypeId` 的单元格级去重与本地提交完成门槛，**禁止全局 200ms 防抖**；快速连续点击的意图不得被吞掉，也不能重复写 undo 或重复触发触感。
3. 网格内横向滚动优先消费横轴；只有月份导航区域可切换月份。建立 touch start/move/end 的轴向锁定，手势帧不重建完整 grid VM、不发 API、不调用服务端写入或逐帧 `setData`。
4. 轻震只可在进入/退出锁定和明确批量操作时增强反馈；不强制每格震动。手动页仍保留 WebView 基线，Skyline/Worklet 结论延后 V3-6。
5. 红测和真机矩阵至少覆盖：快速 A→B→A、同 cell 反复点击、锁定切换/退出、横向拖动、纵向页面滚动、长按阈值、窄屏 Android 与 iOS；任一误填/误清/误切月即不进入 Task 13。

**Task 12 停止条件：** 锁定模式与单元格优先严格共享状态源；高频触控无重复/漏填、网格滚动无误触；Task 11 所有回归仍通过。

## 5. Task 13：模板应用、草稿、发布与冲突保护（已按 Task 12 真实代码展开）

Task 13 开始前重新审阅 Task 11–12 checkpoint 和当前 `packages/contracts/src/manual-schedules.ts`、schedule contracts/API integration tests。以下是不可变业务边界，不是提前授权实现：

1. 模板 CRUD 继续使用既有 `expectedVersion`；应用预览仅调用 `previewManualTemplateApply(groupId, templateId, { expectedRulesVersion, startDate, endDate? })`。一轮与重复到结束日、中途截断、跨月/跨年、闰年和 1–31 天周期必须由现有服务端/领域测试裁决。
2. 用户确认实际 apply 时才生成新的 UUID `operationId` 并调用 `applyManualScheduleTemplate`；operationId 不进入 storage、不跨失败自动复用。preview 一旦群组、模板版本、规则版本、起止日期、成员/班种引用或冲突上下文变化即失效。
3. UI 必须呈现服务端的 assignments 统计、hard conflicts、连续值班 warnings、vacancies、已批准请假、活跃 workflow 影响、已有草稿/已发布版本。只有契约已有的 `acknowledgeBlockers`、`replaceExistingDrafts`、`replacePublished`、`acknowledgeWorkflowRevocations` 才能显示和提交；`workflowBlockers` 等硬阻塞不得用确认框绕过。
4. 草稿按服务端 `operationId` 分组。批量发布使用已有 `publishScheduleDraftBatch`，单期间发布/撤回先使用 `previewScheduleChange`；已过日期、既往排班和补录边界按服务端 message/状态呈现，不在小程序猜规则。删除、覆盖发布、撤回和重新发布均有动作专属确认。
5. 所有成功的 schedule-affecting 写入才通过既有 `calendar-cache-runtime` 精确删除并 invalidate 对应 user/group/businessMonth；失败、取消和过期响应绝不清 cache。409 固定刷新模板、draft/history、当前日历月和 preview，丢弃旧 preview，保留原错误，要求用户重新确认。
6. 增加/启用一个只允许固定手动排班 integration allowlist 的命令，覆盖既有 template 与 manual-apply integration tests 及实际受影响 publish tests；真实 `schedule_test`、零 skip 才能称通过。若当前 runner 或数据库不满足，停止并记录“待验证”，不将 skip 视作绿色。

**Task 13 停止条件：** 周期不会少/多日期；模板失效、请假、冲突、覆盖、重复操作和 409 均有可恢复的具体反馈；成功写入的日历精确失效；发布不会静默覆盖新版本或丢失事件。

### 5.1 实际实现与检查点（2026-08-12）

- `manual-schedule-controller.ts` 以同一 generation state 加载 config/template/draft/history；apply preview 使用当前 rules version，明确确认时才生成 operationId。模板/规则/本地编辑变更、成功写入和 409 都废弃旧 preview；409 保留原 message/latestData、刷新权威列表，绝不自动重放。
- 页面仅调用既有 wrapper：apply、`publishScheduleDraftBatch`、withdraw 前的 `previewScheduleChange`；草稿从 history 的服务端 operationId 映射分组后逐组发布。应用预览显示 assignment、hard conflict、vacancy、连续值班 warning；hard conflict 禁用确认。撤回显示服务端 workflow impact；页面不伪造 acknowledge/replace 字段。
- apply、批量发布、撤回成功后才通过 `calendar-cache-runtime` 失效实际 period 对应的 user/group/month（将 `YYYY-MM-DD` 摘为 cache 所需 `YYYY-MM`）；取消、失败和陈旧响应不失效。当前页不持有日历月控制器，409 不删除失败 cache；重返日历仍由既有 invalidation observer/onShow 流程重新读取成功变更的月份。
- 新增 `pnpm test:api-integration:manual-schedule`，固定仅跑 template 与 manual-apply 两个既有 integration 文件，后者覆盖跨月重复、batch publish、覆盖、请假、陈旧规则和 operationId 幂等。真实 `schedule_test` 运行 2 文件 / 22 项、零 skip。
- 自动验证已通过：定向 17 项、小程序 181 项、config audit、typecheck、lint、Prettier、diff check、`pnpm smoke:browser`、`pnpm smoke:check-core`。DevTools 的最终串行 build/preview/smoke 在启动时 64 秒无输出超时，只记为工具边界；需 Android/iOS 复核后才可将状态改为已完成。

## 6. 统一验证、设备复核与 Git

每个 Task 在红测转绿后，至少依序运行该任务的定向 suite、完整小程序 suite、配置审计、typecheck、lint、明确文件的 Prettier 和 `git diff --check`。Task 13 以及任何改动 API/契约/认证/路由/构建核心链路的 checkpoint 还必须运行真实数据库 integration allowlist、`pnpm smoke:browser`，随后运行 `pnpm smoke:check-core`。

```powershell
pnpm vitest run apps/miniprogram
pnpm miniprogram:config:audit
pnpm miniprogram:typecheck
pnpm miniprogram:lint
pnpm exec prettier --check <本任务明确文件>
pnpm smoke:browser                 # 触及核心链路时
pnpm smoke:check-core
git diff --check
```

每个 checkpoint 最后才运行 `pnpm miniprogram:devtools:build-npm`、preview 与连接态 `pnpm miniprogram:smoke`。DevTools 自动化 transport、截图或 Skyline selector 限制只可记录为工具边界，不能替代人工视觉/触控证据；手动页必须额外由至少一台 Android 和一台 iOS 走查横/纵滚动、长按、快速点按、保存、409 和重返页面。

提交前逐行审阅 `git diff` 与 `git diff --cached`，列出接收者绑定、异步/generation、空值、调用次数和副作用的变化。只显式暂存当前 task 路径；用户保留的 `apps/miniprogram/minitest/` 不读取、修改、格式化或暂存。验证通过后正常 fast-forward push，绝不 force-push。

## 7. 本轮结论与下一批

- [x] Web 的人员行/日期列、同班种 toggle-off、下一可用开始日、请假/过期/冲突提示、批量草稿/发布和版本保护语义已映射到 V3-4。
- [x] 已将 Web 与 V3 的已知回归转化为 Task 11–13 的红测、架构边界和设备验收，不复制桌面 sticky/grid、统一错误吞没、全局防抖、旧预览自动重放或 scroll-slot fixed 层问题。
- [x] V3-4 只复用当前 API/契约；没有虚构小程序专属后端能力。
- [x] 用户已批准并完成 **Task 11** 与 **Task 12** 的实现及各自 checkpoint。
- [x] Task 13 已依 Task 12 真实代码展开并完成实现、真实数据库 allowlist 和自动化检查；仅待 DevTools/Android/iOS 设备复核，然后在 checkpoint 后停止。
