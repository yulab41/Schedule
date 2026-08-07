# Project Status

本文件是精简交接入口，只保留当前状态、下一步与关键环境信息。每一轮调试反馈、修改意见、自查发现、修复与验证的完整记录统一维护在 `docs/debug/debug-feedback-log.md`（单一来源）；Git 历史为持久历史，本文件不保留逐轮重复内容。

## Current Position

- Last updated: 2026-08-07
- Branch: `main` / Upstream: `origin/main`
- Target: Doctor Scheduling Web 1.0（`v1.0.0` 已发布）
- Current phase: Web 1.0 调试与测试阶段（完善后进入微信小程序阶段，设计规格 26.1 另建独立实施计划）
- Implementation: 32 项任务全部完成（详见实施计划与 Git 历史）
- Debug rounds: 1–57 已完成；fix-progress 轮次 1–22 已完成（轮次 22 = #7.1 子步骤 3 批次 11：exports/platform + users/profile 收尾读模型 zod schema 替换 2 个手写守卫，子步骤 3 全部完成）；最新验证基线 561/561（68 个测试文件，隔离 MySQL）
- Deployment: 本地部署继续（用户决定暂不上线）：API `127.0.0.1:3000/3001` 与 Web `localhost:5173/5174` 均为 2026-08-07 最新构建，`/health`、`/api/health`、首页均 200，开发模式认证可用；PWA shell/schedule 缓存升至 `v5`；阿里云 ECS 试用机与 CloudBase 上线验证暂停，等待用户后续决定
- Next actions: 轮次 57（fetch 接收者修复，登录按钮无法进入页面）已完成并待用户强刷复核；之后 fix-progress 轮次 23 目标为 #7.4（前端 swap/duty 候选与 isFutureAssignment 重复：合并 feature 逻辑）；上线暂停（用户决定，2026-08-07）：CloudBase 余额不足导致的 `/api/health` 不可用不再作为当前动作，待用户决定后再继续上线验证

## Debug / Test Feedback Log

- 单一来源：`docs/debug/debug-feedback-log.md`（含记录规则模板、通用注意事项、轮次 1–57 明细、待办/下一步）
- 本文件不再重复逐轮内容，避免每轮对话重复读取同一份日志

## Approved Sources

- 设计规格：`docs/superpowers/specs/2026-08-01-medical-staff-scheduling-system-design.md`
- 实施计划：`docs/superpowers/plans/2026-08-01-medical-staff-scheduling-system-implementation-plan.md`
- 调试反馈日志：`docs/debug/debug-feedback-log.md`
- CloudBase 运维笔记：`docs/deployment/cloudbase-ops-notes.md`
- 仓库规则：`AGENTS.md`

## Completed Work（摘要）

- 2026-08-07 调试轮次 57：修复本地开发登录“管理员/成员模式”无法进入页面——`requestWithOnline` 以 `options.fetchImplementation(...)` 调用原生 fetch 导致 `this` 为 options 对象，浏览器抛 `Illegal invocation` 并被包装为 NETWORK_ERROR；改为 `.call(globalThis, ...)` 后，`apps/web/src/api/client.test.ts` 新增接收者回归测试（143 → 144 条），`pnpm verify` 561/561 通过（68 个测试文件，隔离 MySQL），无头 Edge 实测管理员（林恩宇）与成员（徐漫彬）工作台均可进入；检查点提交 `fix(web): keep the native fetch receiver for API requests` 识别。
- 2026-08-07 fix-progress 轮次 22：完成 #7.1 子步骤 3 批次 11（exports/platform + users/profile 收尾读模型）——`packages/contracts/src/exports.ts` 新增 4 个 schema（含 3 个枚举），`packages/contracts/src/users.ts` 新增 `userProfileSchema`，`ScheduleExportJob`/`UserProfile` 及枚举类型由 schema 派生；`apps/web/src/api/client.ts` 5 处调用点改用 `isResponseBodyFromSchema`，删除 2 个手写守卫；`client.test.ts` 先写 7 条锁定测试再替换，136 → 143 条；`pnpm verify` 560/560 通过。至此 #7.1 子步骤 3 的 11 个读模型批次全部完成，client.ts 仅剩 `isApiErrorResponse`/`isUndefined` 两个基础设施守卫。
- 2026-08-07 fix-progress 轮次 21：完成 #7.1 子步骤 3 批次 10（statistics 读模型）——`packages/contracts/src/statistics.ts` 新增 7 个 schema，7 个读模型类型由 schema 派生（`actualVsPlanned` 用 `z.custom` 保持旧守卫“仅数组”检查，其余按 typeof number/string 校验）；`apps/web/src/api/client.ts` 4 处调用点改用 `isResponseBodyFromSchema`，删除 7 个手写守卫；`client.test.ts` 先写 12 条锁定测试再替换，124 → 136 条；`pnpm verify` 553/553 通过。
- 2026-08-07 fix-progress 轮次 20：完成 #7.1 子步骤 3 批次 9（events/notifications 读模型）——`packages/contracts/src/events.ts` 新增 3 个 schema，`packages/contracts/src/notifications.ts` 新增 9 个 schema，3+5 个读模型类型由 schema 派生（JsonObject 可选字段用 `z.custom` 复刻原检查、提醒小时整数 ≥1、可空联合按接口）；`apps/web/src/api/client.ts` 13 处调用点改用 `isResponseBodyFromSchema`，删除 13 个手写守卫（含 `isJsonObjectValue`）；`client.test.ts` 先写 13 条锁定测试再替换，111 → 124 条；`pnpm verify` 541/541 通过。
- 2026-08-07 fix-progress 轮次 19：完成 #7.1 子步骤 3 批次 8（manual-schedules 读模型）——`packages/contracts/src/manual-schedules.ts` 新增 7 个 schema（含列表），`packages/contracts/src/schedules.ts` 新增 3 个统计 schema（对旧守卫忽略的分项字段保持宽松），3+1 个读模型类型由 schema 派生、`ManualApplyPreview`/`AppliedManualScheduleTemplateResult` 用显式契约别名；`apps/web/src/api/client.ts` 5 处调用点改用 schema（2 处 `isResponseBodyMatching<T>`），删除 13 个手写守卫（含上一轮遗留的 `isContinuousDutyWarning`/`isScheduleGenerationVacancy`）；`client.test.ts` 先写 11 条锁定测试再替换，100 → 111 条；`pnpm verify` 528/528 通过。
- 2026-08-07 fix-progress 轮次 18：完成 #7.1 子步骤 3 批次 7（leaves 读模型）——`packages/contracts/src/leaves.ts` 新增 15 个 schema（含列表），`packages/contracts/src/schedules.ts` 新增 `scheduleGenerationWarningSchema`/`scheduleGenerationVacancySchema`，13 个读模型类型由 schema 派生或显式契约别名（`leaveReflowPreviewSchema` 对旧守卫忽略的 `affectedShiftCount`/`affectedShifts`/`overlapsUnpublishedPeriod` 保持宽松、导出类型保留必填，`periodVersions` 用 `z.custom` 复刻原检查）；`apps/web/src/api/client.ts` 11 处调用点改用 schema（2 处 `isResponseBodyMatching<T>`），删除 12 个手写守卫及无引用的 `isStringNumberRecord`；`client.test.ts` 先写 13 条锁定测试再替换，87 → 100 条；`pnpm verify` 517/517 通过。
- 2026-08-07 fix-progress 轮次 17：完成 #7.1 子步骤 3 批次 6（swaps/duty 读模型）——`packages/contracts/src/swaps.ts` 新增 8 个 schema（含列表），`packages/contracts/src/duty-adjustments.ts` 新增 7 个 schema（含列表），8+7 个读模型类型由 schema 派生（状态/冲突码枚举、日期/颜色正则、整数 ≥1、可选字段、`passthrough()`、嵌套数组 `z.readonly`）；`apps/web/src/api/client.ts` 27 处调用点改用 `isResponseBodyFromSchema`，删除 15 个手写守卫；`client.test.ts` 先写 12 条锁定测试再替换，75 → 87 条；`pnpm verify` 504/504 通过。
- 2026-08-07 fix-progress 轮次 16：完成 #7.1 子步骤 3 批次 5（schedules/past-schedules 读模型）——`packages/contracts/src/schedules.ts` 新增 10 个 schema（含列表），`packages/contracts/src/past-schedules.ts` 新增 7 个 schema（含列表），8+4 个读模型类型由 schema 派生或显式契约别名（旧守卫忽略的必填字段用 `z.custom(...).optional()` 保持宽松、导出类型保留必填；嵌套数组用 `z.readonly`）；`apps/web/src/api/client.ts` 12 处调用点改用 schema（5 处用新增 `isResponseBodyMatching<T>` 类型化桥接），删除 18 个手写守卫，`isAppliedManualScheduleTemplateResult` 复用 `schedulePeriodSummarySchema`；`client.test.ts` 先写 12 条锁定测试再替换，63 → 75 条；`pnpm verify` 492/492 通过。
- 2026-08-07 fix-progress 轮次 15：完成 #7.1 子步骤 3 批次 4（scheduling-config 读模型）——`packages/contracts/src/scheduling-config.ts` 新增 6 个 schema（`schedulingGroupMemberSchema`/`scheduleRoleMemberSchema`/`rotationRuleSchema`/`scheduleRoleSchema`/`shiftTypeSchema`/`schedulingConfigSchema`），6 个读模型类型改为由 schema 派生（约束与旧守卫一致；`rulesVersion` 用 `z.custom<number>(() => true).optional()` 保持旧守卫“不校验”的宽松行为，导出类型交叉保持必填 number）；`apps/web/src/api/client.ts` 7 处调用点改用 schema，删除 6 个手写守卫，`getSchedulingConfig` 用 `isSchedulingConfigResponse` 谓词包装；`client.test.ts` 先写 8 条锁定测试再替换，55 → 63 条；`pnpm verify` 480/480 通过。
- 2026-08-07 fix-progress 轮次 14：完成 #7.1 子步骤 3 批次 3（groups/membership 读模型）——`packages/contracts/src/groups.ts` 新增 `groupRoleSchema` 与 15 个读模型/列表 schema，11 个读模型类型改为由 schema 派生（约束与旧守卫一致；`claimGroupResponseSchema` 的 `request_created` 分支 `.strict()` 保持“仅 status 一个键”，`membershipClaimRequestSchema.status` 用 `z.custom<MembershipClaimRequestStatus>` 保持字符串校验同时保留枚举类型）；`packages/contracts/src/schedules.ts` 新增 `groupSchedulePublishModeSchema`；`apps/web/src/api/client.ts` 16 处调用点改用 `isResponseBodyFromSchema`，删除 15 个手写守卫；`client.test.ts` 先写 14 条锁定测试再替换，41 → 55 条；`pnpm verify` 472/472 通过。
- 2026-08-07 fix-progress 轮次 13：完成 #7.1 子步骤 3 批次 2（holidays 读模型）——`packages/contracts/src/holidays.ts` 新增 `confirmedHolidayDateSchema`/`holidayReadModelSchema` 2 个运行时 schema，`ConfirmedHolidayDate`/`HolidayReadModel` 类型改为由 schema 派生（约束与旧守卫一致：布尔/整数/字符串字段，`passthrough()` 保留未知字段）；`apps/web/src/api/client.ts` 的 `getHolidays`/`getGuestHolidays` 改用 `isResponseBodyFromSchema(holidayReadModelSchema)`，删除 `isHolidayReadModel` 手写守卫；`client.test.ts` 先写 7 条锁定测试（未知字段透传、非整数 year、confirmed 非布尔、缺 dates 数组、日期条目缺 holidayName、isOffDay 非布尔、date 非字符串）再替换，34 → 41 条；`pnpm verify` 458/458 通过。
- 2026-08-07 fix-progress 轮次 12：开始 #7.1 子步骤 3（日历读模型批次）——`packages/contracts` 新增 `zod` 依赖，`calendar.ts` 新增 9 个运行时 schema（变动标记、班次、成员、角色、班种、日历、访客日历、访客群组、访客群组列表）并将 8 个读模型类型改为由 schema 派生，约束与旧手写守卫一致（日期/月份/颜色/时间正则、非空字符串、整数 ≥1、枚举标记、可选字段、`passthrough()` 保留未知字段）；`apps/web/src/api/client.ts` 新增通用 `JsonSchema` + `isResponseBodyFromSchema` 桥接，`getCalendar`/`getSchedulePeriodCalendar`/`getGuestCalendar`/`getGuestGroupCalendar`/`listGuestGroups` 5 处调用点改用 schema，删除 8 个 `isCalendar*`/`isGuest*` 手写守卫；`client.test.ts` 先写 6 条锁定测试（未知变动标记、业务月份格式、空姓名、非法颜色、访客日历缺群名、访客群组缺名称）再替换，28 → 34 条；`pnpm verify` 451/451 通过。
- 2026-08-06 fix-progress 轮次 11：收敛 #7.1 子步骤 2 并完成 #7.2——`packages/contracts/src/errors.ts` 新增运行时 `apiErrorCodes` 列表作为错误码唯一来源，`ApiErrorCode` 联合类型改为由它派生；`apps/web/src/api/client.ts` 的 `knownApiErrorCodes` 改为 `new Set(apiErrorCodes)`（删除本地字面量表），`isApiErrorResponse` 去掉 `as ApiErrorCode` 强转；新增 3 条锁定测试（契约列表完整且无重复、全部错误码映射为类型化客户端错误、未知码回退通用 HTTP 文案），`client.test.ts` 26 → 28 条；`pnpm verify` 445/445 通过。
- 2026-08-06 fix-progress 轮次 10：收敛 #7.1 子步骤 1 的 client.ts 重复请求函数——新增共享 `requestWithOnline`（离线/会话/网络错误/fetch 发起统一）与 `parseJsonResponse`/`parseTextResponse`，删除 `requestPublicJsonWithOnline`/`requestJsonWithOnline`/`requestTextWithOnline` 三个复制函数，4 个公开端点改用新 `requestPublicJson` 包装；复核 `isUndefined` 实际被 7 处守卫使用（非死代码）未删；`client.test.ts` 新增 2 条锁定测试（公开请求不带 token、文本下载错误映射），24 → 26 条；`pnpm verify` 442/442 通过。
- 2026-08-06 fix-progress 轮次 9：收敛 #2.1 的 ui-tokens CSS/TS 双份维护——新增 `packages/ui-tokens/src/tokens.ts` 作为 8 组令牌唯一来源（含 `tokenGroups` 前缀/格式元数据），`index.ts` 改为显式 re-export（公共 API 不变）；新增 `scripts/generate-tokens-css.mjs` 生成 `tokens.css`（`pnpm tokens:generate`）与 `tokens-css.test.ts` 锁定测试（已提交 CSS == 生成器 `--stdout` 输出）；`pnpm verify` 440/440 通过。
- 2026-08-06 fix-progress 轮次 8：清理 #7.5 的 event-timeline 死代码——`apps/web/src/features/events/event-timeline.ts` 删除 `getEventRelationLabel`/`buildSwapChainSummary`/`buildDutyAdjustmentChainSummary` 三个仅被 spec 引用的导出与 `EventTimelineItem.isCorrection` 字段，`getEventMarker` 改为模块私有（仅 `buildEventTimelineItems` 内部使用）；`EventTimeline.vue` 删除未使用的 `.entry-relation`/`.entry-relation.correction` 样式；`event-timeline.spec.ts` 同步删除对应导入与 2 条死代码测试，并用 `buildEventTimelineItems` 补 1 条日历标记映射测试（保持行为覆盖）；`pnpm verify` 439/439 通过。
- 2026-08-06 fix-progress 轮次 6：收敛 #3.3 的任务分派静默兜底——`apps/api/src/jobs/runner.ts` 的 if 链 + 导出兜底改为 `Record<JobName, JobRunner>` 穷举映射表（新增 `JobName` 时 TypeScript 强制补充分支），`jobNames` 从映射表派生为单一来源，`runJob` 只做映射查找；新增 `runner.spec.ts` 2 条映射一致性锁定测试；`pnpm verify` 436/436 通过。
- 2026-08-06 fix-progress 轮次 7：收敛 #3.4/#1.2 的开发认证环境防线——`apps/api/src/config/env.ts` 正式/测试 schema 新增 `AUTH_DEV_MODE: z.enum(['true', 'false']).default('false')`；`apps/api/src/runtime.ts` 新增 `isDevAuthEnabled`（`NODE_ENV === 'development' && AUTH_DEV_MODE === 'true'`）替换裸 `process.env` 检查；`.env.example` 补 `VITE_AUTH_DEV_MODE`/`AUTH_DEV_MODE` 两个本地开关并注明禁止上线，`docs/development/local-setup.md` 补本地开发认证说明；新增 4 条锁定测试；`pnpm verify` 440/440 通过。
- 2026-08-06 fix-progress 轮次 4：收敛 #3.2 的日志/审计脱敏双份清单——新增 `apps/api/src/security/redact.ts` 共享模块（唯一敏感字段清单、`logRedactionPaths`、递归脱敏），`app.ts` 与 `audit-writer.ts` 删除各自清单与实现并统一引用（日志补上 `telephone`）；新增 6 条共享模块单元测试，日志/审计两端一致性测试扩展至完整字段；`pnpm verify` 434/434 通过。
- 2026-08-06 fix-progress 轮次 5：收敛 #1.1 的文档过期/自相矛盾——重写 `docs/debug/debug-feedback-log.md`“待办 / 下一步”（删除“既往排班模块未实现”“Fastify 415 待排查”等已解决条目，上线状态改为“迁移与部署已执行、仅剩余额阻塞”，保留 #4.5 待用户确认的登记）；`docs/project-status.md` 轮次范围 1–49 → 1–56，当前批次与下一步同步更新；纯文档修改，`pnpm verify` 434/434 通过。
- 2026-08-06 fix-progress 轮次 3：收敛 #7.3 的中国时区算法——领域包导出唯一 `chinaStandardTimeOffsetMilliseconds` 与 `toChinaStandardTimeUtcTimestamp`，web 新增 `@schedule/scheduling-domain` 依赖，9 个前端文件删除重复常量/裸魔法数并改用领域函数（calendar-logic/calendar-views 保留薄包装），StatisticsView/ExportDialog/ManualScheduleView 三个视图裸写随本轮一并替换（#8.2 视为完成）；新增 1 条 UTC 换算锁定测试；`pnpm verify` 428/428 通过。
- 2026-08-06 fix-progress 轮次 2：收敛 #4.1 的 swap/duty 重复成员/角色读取为共享 `GroupMemberReader`（`apps/api/src/modules/groups/group-member-reader.ts`），`loadMembers` 用 `autoAcceptSwapsDefault` 显式表达差异（swap=1、duty=0），`loadRoleNames` 共享；两个服务删除私有复制实现与重复类型；新增“从未设置偏好”默认行为锁定测试 2 条 + 共享读取器集成测试 4 条；`pnpm verify` 427/427 通过。
- 2026-08-06 fix-progress 轮次 1：收敛 #3.1 的 starts_at 环境补丁为统一 `updateShiftAssignments` 助手（注释 CynosDB `explicit_defaults_for_timestamp=OFF` 原因），5 个文件 12 处调用点全部改用助手；新增“批量更新不改变 starts_at（模拟 ON UPDATE）”锁定测试；`pnpm verify` 421/421 通过。
- Tasks 1–32 全部完成并发布 `v1.0.0`（发布基线 322/322）；验收记录见 `docs/releases/web-1.0-acceptance.md`，发布提交 `release: web scheduling system 1.0`（tag `v1.0.0`）。
- 调试期轮次 1–56 已全部完成（2026-08-05 完成 1–49，随后完成 50–56；用户反馈、根因、修复、验证详见 debug 日志；当前基线 434/434）。
- 2026-08-06 全库合规审查报告全文并入 `fix-progress.md`（清单编号与报告证据一一对应，含文件/行号/原文/建议），并补充原清单缺失的 #2.2/#7.2/#2.3/#8.2 与外部阻塞登记；该文件成为 Web 1.0 合规修复阶段的新对话唯一切入点。检查点提交 `docs: integrate full compliance audit report into fix-progress checklist` 识别。
- 轮次 35 按用户要求开放访客节假日、联系电话与当天标记，并禁止换班/加扣班等事件标记与事件入口；月/周/列表日历对过去日期统一显示深灰色（访客与用户/管理员模式一致）。检查点提交 `feat(guest): expose holidays and contacts while hiding events, gray past dates` 识别。
- 轮次 37 修复管理员发起的换班事件在首页弹窗错误显示“由成员一发出”，改为按实际操作账户显示发起人；人员变更链移到事件弹窗底部并默认折叠。检查点提交 `fix(events): show acting account for admin swaps; collapsible change chain` 识别。
- 轮次 38 合并换班/加扣班人员变更链为一条、去掉日历“事件”按钮并改为点击“换/加”等标记打开事件弹窗、恢复点击姓名弹出联系电话（未确认号码仅可复制）。检查点提交 `fix(events): merge change chains, marker-click events, restore phone menu` 识别。
- 轮次 39 新增成员身份认领工作流（同名检测、普通成员申请/管理员审批、管理员直认领与撤销、群主保护），成员页改为紧凑表格布局；新增迁移 0022。检查点提交 `feat(members): identity claim workflow with admin approval and compact member table` 识别。
- 轮次 40 为换班/加扣班/请假审批增加“已受理”同步：处理人姓名回填到读模型，三个面板显示已受理记录（状态 + 来自 xx），其他管理员刷新后不再把已处理申请当待审批。检查点提交 `feat(events): sync multi-admin approval handled state with decider name` 识别。
- 轮次 41 新增换班“已生效待撤销”与用户侧撤销（管理员或双方可撤销），统一换班/加扣班/请假撤销权限；撤销前校验班次状态（失效/后续有变动时 409），已生效列表只显示可撤销记录并自动归档失效项。检查点提交 `feat(workflows): revocable completed swaps, unified revoke permissions, stale auto-archive and ordering guard` 识别。
- 轮次 42 将撤销加扣班与管理员直接代值的原因改为选填（未填时保留原原因，省略字段不校验）。检查点提交 `feat(duty-adjustments): make direct apply and revoke reasons optional` 识别。
- 轮次 43 将撤销换班的理由改为选填（省略时事件不写原因）。检查点提交 `feat(swaps): make swap revoke reason optional` 识别。
- 轮次 44 请假原因改为选填；提交不再强制手动/顺延二选一（受影响班次提示不阻断）；审批弹窗显示涉及班次数并提供换班/加扣班/手动排班跳转；自动排班跳过已批准请假成员（迁移 0023）。检查点提交 `feat(leaves): optional reason, non-blocking affected shifts, approval with adjustment shortcuts and leave-aware generation` 识别。
- 轮次 45 日历按班种时间排序（A/P/N）；手动排班改为班种绘制模式；模板应用起始日期自动取已排班之后的首个未排日期；排班配置紧凑化并移除轮值规则/轮值顺序入口（废除前端自动排班模块）。检查点提交 `feat(schedules): shift-time calendar ordering, manual paint mode, next-free template start, compact config and rotation removal` 识别。
- 轮次 46 手动排班起始日期只统计已发布记录（归档/删除不影响自动检测），且手动修改后保存/应用以手动日期为准；手动排班/模板应用检测已批准请假并阻断；再次点击当前班种可清除单元格；审批弹窗列出具体冲突班次；班种配置改为每班种一行紧凑布局。检查点提交 `fix(schedules): published-only next start, leave-aware manual apply, toggle-off paint, one-row shift config` 识别；追加提交 `fix(scheduling-config): prevent shift type editor field overlap` 修复班种输入框重叠。
- 轮次 47 已过日期硬性锁定：新增 `past` 排班状态（既往排班），发布/替换/撤销自动把已过班次移入既往期间并锁定；已过期月份禁止撤销/重发并自动清理其草稿与归档；手动模板应用禁止回填已过日期；换班/请假/加扣班撤销阻断已过日期；新增“排班补录”页面与接口（仅管理员/群主，修改留痕 `schedule_backfill_completed` 事件）。检查点提交 `feat(schedules): lock past dates, past-schedule archive, backfill corrections with audit` 识别；追加提交 `fix(web): accept past schedule status in history validator` 修复手动排班“服务返回了无效资料”；追加提交 `feat(web): auto-refresh manual schedule locks at midnight` 实现零点自动刷新锁定状态；追加提交 `fix(calendar): keep past duty names callable with clear hover cue` 恢复既往排班联系电话可点击提示；追加提交 `feat(backfill): calendar painting with shift/member palettes and unique period list` 重构排班补录为日历配班交互并去重既往月份；追加提交 `fix(manual-apply): surface detailed conflict reasons instead of generic refresh hint` 应用模板冲突显示具体原因；追加提交 `feat(backfill): free month navigation, staged confirm painting, name-only shift labels` 实现补录自由跳转月份/空月新增班次、待确认后生效与全称班种按钮；追加提交 `feat(backfill): multi-date staged painting without per-cell prompts` 补录连续多日期点选后一次确认；追加提交 `fix(backfill): hide only manual-adjustment markers, keep swap and duty markers` 补录日历仅隐藏“调”标记；追加提交 `feat(backfill): current-state backfill trace with revert cancel` 补录痕迹跟随班次当前状态、撤销即抵消并移除日历“调”标记。
- 轮次 48 加扣班下拉不再出现既往（已过/已开始）班次：“我的班次”与管理员“被代班班次”只保留 `startsAt > now` 的未来班次，与换班候选和后端 `assertFutureShift` 校验一致。检查点提交 `fix(duty-adjustments): exclude past shifts from candidate options` 识别。
- 轮次 49 换班预览新增活跃工作流检查：存在待处理换班或待处理/生效中加扣班时，预览直接返回具体冲突；前端提交失败改为展示后端原始原因，不再被通用提示吞掉。检查点提交 `fix(swaps): surface active workflow blockers in preview` 识别。
- 轮次 33 完成排班变更工作流撤销、发布版本月历、当前撤销/归档重发、已发布草稿归档体验和群组码访客只读月历；检查点提交以 `feat(schedules): add publication lifecycle and guest calendar` 识别。
- 轮次 34 修复历史软删除排班导致换班/加扣班审批页 500，访客改为公开群组名称列表和当月默认月历，并将 PWA 缓存升级到 v3 以清除旧发布记录前端资源；检查点提交以 `fix(schedules): restore history and guest access` 识别。
- 线上数据操作（2026-08-03）：按用户要求清空线上草稿与排班（23 个排班期间、638 条班次软删除，统计快照清空；模板/成员/岗位/班种/联系方式/事件历史保留）；线上迁移已执行至 20 条（`0018`/`0019`/`0020`）。

## Active Batch

- fix-progress 轮次 22（#7.1 子步骤 3 批次 11）已完成：contracts 新增 exports/platform + users/profile 收尾读模型 schema（exports.ts 4 个 + users.ts 1 个），`ScheduleExportJob`/`UserProfile` 及枚举类型由 schema 派生，client.ts 5 处调用点改用 `isResponseBodyFromSchema` 并删除 2 个手写守卫，先新增 7 条锁定测试再替换，`pnpm verify` 560/560 通过；#7.1 子步骤 3 全部 11 个批次完成，client.ts 仅剩 `isApiErrorResponse`/`isUndefined` 基础设施守卫；下一活动批次为 fix-progress 轮次 23（#7.4：前端 swap/duty 候选与 isFutureAssignment 重复合并）。
- fix-progress 轮次 21（#7.1 子步骤 3 批次 10）已完成：contracts 新增 statistics 读模型族 7 个 schema，7 个读模型类型由 schema 派生（`actualVsPlanned` 用 `z.custom` 保持旧守卫“仅数组”检查），client.ts 4 处调用点改用 `isResponseBodyFromSchema` 并删除 7 个手写守卫，先新增 12 条锁定测试再替换，`pnpm verify` 553/553 通过；下一活动批次为 fix-progress 轮次 22（#7.1 子步骤 3 批次 11：exports/platform + users/profile 收尾读模型先写锁定测试再替换）。
- fix-progress 轮次 20（#7.1 子步骤 3 批次 9）已完成：contracts 新增 events/notifications 读模型族 schema（events.ts 3 个 + notifications.ts 9 个），3+5 个读模型类型由 schema 派生（JsonObject 可选字段用 `z.custom` 复刻原检查、提醒小时整数 ≥1、可空联合按接口），client.ts 13 处调用点改用 `isResponseBodyFromSchema` 并删除 13 个手写守卫（含 `isJsonObjectValue`），先新增 13 条锁定测试再替换，`pnpm verify` 541/541 通过；下一活动批次为 fix-progress 轮次 21（#7.1 子步骤 3 批次 10：statistics 读模型先写锁定测试再替换）。
- fix-progress 轮次 19（#7.1 子步骤 3 批次 8）已完成：contracts 新增 manual-schedules 读模型族 schema（manual-schedules.ts 7 个 + schedules.ts 3 个统计 schema），3+1 个读模型类型由 schema 派生、`ManualApplyPreview`/`AppliedManualScheduleTemplateResult` 用显式契约别名（旧守卫忽略的统计分项字段保持宽松），client.ts 5 处调用点改用 schema（2 处 `isResponseBodyMatching<T>`）并删除 13 个手写守卫（含遗留的 `isContinuousDutyWarning`/`isScheduleGenerationVacancy`），先新增 11 条锁定测试再替换，`pnpm verify` 528/528 通过；下一活动批次为 fix-progress 轮次 20（#7.1 子步骤 3 批次 9：events/notifications 读模型先写锁定测试再替换）。
- fix-progress 轮次 18（#7.1 子步骤 3 批次 7）已完成：contracts 新增 leaves 读模型族 schema（leaves.ts 15 个 + schedules.ts 2 个），13 个读模型类型由 schema 派生或显式契约别名（`leaveReflowPreviewSchema` 对旧守卫忽略字段保持宽松、导出类型保留必填），client.ts 11 处调用点改用 schema（2 处 `isResponseBodyMatching<T>`）并删除 12 个手写守卫及 `isStringNumberRecord`，先新增 13 条锁定测试再替换，`pnpm verify` 517/517 通过；下一活动批次为 fix-progress 轮次 19（#7.1 子步骤 3 批次 8：manual-schedules 读模型先写锁定测试再替换）。
- fix-progress 轮次 17（#7.1 子步骤 3 批次 6）已完成：contracts 新增 swaps/duty 读模型族 schema（swaps.ts 8 个 + duty-adjustments.ts 7 个），15 个读模型类型由 schema 派生（状态/冲突码枚举、日期/颜色正则、整数 ≥1、可选字段、`passthrough()`、嵌套数组 `z.readonly`），client.ts 27 处调用点改用 `isResponseBodyFromSchema` 并删除 15 个手写守卫，先新增 12 条锁定测试再替换，`pnpm verify` 504/504 通过；下一活动批次为 fix-progress 轮次 18（#7.1 子步骤 3 批次 7：leaves 读模型先写锁定测试再替换）。
- fix-progress 轮次 16（#7.1 子步骤 3 批次 5）已完成：contracts 新增 schedules/past-schedules 读模型族 schema（schedules.ts 10 个 + past-schedules.ts 7 个），8+4 个读模型类型由 schema 派生或显式契约别名（旧守卫忽略的必填字段保持宽松、导出类型保留必填，嵌套数组用 `z.readonly`），client.ts 12 处调用点改用 schema（5 处 `isResponseBodyMatching<T>` 桥接）并删除 18 个手写守卫，先新增 12 条锁定测试再替换，`pnpm verify` 492/492 通过；下一活动批次为 fix-progress 轮次 17（#7.1 子步骤 3 批次 6：swaps/duty 读模型先写锁定测试再替换）。
- fix-progress 轮次 15（#7.1 子步骤 3 批次 4）已完成：contracts 新增 scheduling-config 读模型族 6 个 schema，6 个读模型类型由 schema 派生（`rulesVersion` 用 `z.custom<number>(() => true).optional()` 保持旧守卫“不校验”行为、导出类型保持必填 number），client.ts 7 处调用点改用 schema 并删除 6 个手写守卫（`getSchedulingConfig` 用 `isSchedulingConfigResponse` 谓词包装），先新增 8 条锁定测试再替换，`pnpm verify` 480/480 通过；下一活动批次为 fix-progress 轮次 16（#7.1 子步骤 3 批次 5：schedules/past-schedules 读模型先写锁定测试再替换）。
- fix-progress 轮次 14（#7.1 子步骤 3 批次 3）已完成：contracts 新增 groups/membership 读模型族 schema（`groupRoleSchema` + 15 个读模型/列表 schema），11 个读模型类型由 schema 派生（含 `claimGroupResponseSchema` 的 `request_created` `.strict()` 精确键检查、`membershipClaimRequestSchema.status` 的 `z.custom` 字符串放行 + 枚举类型），client.ts 16 处调用点改用 `isResponseBodyFromSchema` 并删除 15 个手写守卫，先新增 14 条锁定测试再替换，`pnpm verify` 472/472 通过；下一活动批次为 fix-progress 轮次 15（#7.1 子步骤 3 批次 4：scheduling-config 读模型先写锁定测试再替换）。
- fix-progress 轮次 13（#7.1 子步骤 3 批次 2）已完成：contracts 新增 holidays 读模型族 2 个 schema（`confirmedHolidayDateSchema`/`holidayReadModelSchema`），`ConfirmedHolidayDate`/`HolidayReadModel` 类型由 schema 派生，client.ts 的 `getHolidays`/`getGuestHolidays` 改用 `isResponseBodyFromSchema` 并删除 `isHolidayReadModel` 手写守卫，先新增 7 条锁定测试再替换，`pnpm verify` 458/458 通过；下一活动批次为 fix-progress 轮次 14（#7.1 子步骤 3 批次 3：groups/membership 读模型先写锁定测试再替换剩余 `isX` 守卫）。
- fix-progress 轮次 12（#7.1 子步骤 3 批次 1）已完成：contracts 引入 zod 并新增日历读模型族 9 个 schema，8 个读模型类型由 schema 派生，client.ts 用通用 `isResponseBodyFromSchema` 替换 8 个手写守卫（5 个调用点），先新增 6 条锁定测试再替换，`pnpm verify` 451/451 通过；下一活动批次为 fix-progress 轮次 13（#7.1 子步骤 3 批次 2：holidays 读模型 `isHolidayReadModel`/`isConfirmedHolidayDate` 先写锁定测试再替换）。
- fix-progress 轮次 9（#2.1）已完成：ui-tokens 8 组令牌收敛为 `packages/ui-tokens/src/tokens.ts` 单一来源（含 `tokenGroups` 前缀/格式元数据），`index.ts` re-export 保持公共 API，新增 `scripts/generate-tokens-css.mjs` + `pnpm tokens:generate`，新增 1 条“已提交 `tokens.css` == 生成器输出”锁定测试；`pnpm verify` 440/440 通过；下一活动批次为 fix-progress 轮次 10（#7.1，client.ts 校验器拆子步骤）。
- fix-progress 轮次 8（#7.5）已完成：删除 event-timeline 三个仅 spec 引用的死导出与 `isCorrection` 字段、移除 `getEventMarker` 导出、删除 `.entry-relation` 样式，spec 同步改写并用 `buildEventTimelineItems` 保持标记映射覆盖；`pnpm verify` 439/439 通过；下一活动批次为 fix-progress 轮次 9（#2.1，ui-tokens 单一来源生成）。
- fix-progress 轮次 7（#3.4/#1.2）已完成：AUTH_DEV_MODE 纳入 env schema（严格 `'true'`/`'false'` 默认 false），runtime 显式双条件（`NODE_ENV=development` 且开关开启）才启用任意 Bearer 认证端口，`.env.example` 补两个本地开关并同步本地文档；新增 4 条锁定测试，`pnpm verify` 440/440 通过；下一活动批次为 fix-progress 轮次 8（#7.5）。
- fix-progress 轮次 4（#3.2）已完成：日志/审计敏感字段清单与脱敏实现合并为 `apps/api/src/security/redact.ts` 共享模块（`redactSensitiveFields` + 派生 `logRedactionPaths`），日志补上 `telephone`，两端一致性测试覆盖完整字段；下一活动批次为 fix-progress 轮次 5（#1.1）。
- fix-progress 轮次 5（#1.1）已完成：以当前代码与 Git 历史为准重写 debug 日志“待办 / 下一步”与 project-status 轮次/批次表述，删除已解决条目（既往排班模块、Fastify 415），保留 #4.5“仅未来日期发布”登记；纯文档修改，一致性核对通过；下一活动批次为 fix-progress 轮次 6（#3.3）。
- fix-progress 轮次 6（#3.3）已完成：任务分派从 if 链 + 导出兜底改为 `Record<JobName, JobRunner>` 穷举映射（新增任务名时编译期强制补充分支），`jobNames` 由映射表派生，`runJob` 删除静默兜底；新增 2 条映射一致性锁定测试，`pnpm verify` 436/436 通过；下一活动批次为 fix-progress 轮次 7（#3.4）。
- 32 项实施计划已完结；当前为 Web 1.0 调试/验收批次。轮次 34 已完成排班版本验收回归、工作流历史读取和访客访问策略调整。
- 轮次 48 已处理加扣班下拉展示既往班次的问题；下一活动批次仍为 Fastify 非标准 Content-Type 问题。
- 轮次 49 已处理换班预览未显示加扣班/待处理换班拦截的问题；下一活动批次仍为 Fastify 非标准 Content-Type 问题。
- 统一工作流冲突检查器重构（阶段 1/3）：换班模块已迁移，新增共享 `WorkflowConflictService`；已生效加扣班不再阻止换班、待处理请假参与换班拦截、撤销改为按变更链检查后续工作流。
- 统一工作流冲突检查器重构（阶段 2/3）：加扣班模块已迁移，待处理/已批准请假均拦截加扣班，接受/审批环节重新校验，预览返回班次占用冲突。
- 统一工作流冲突检查器重构（阶段 3/3）：请假模块已迁移，请假审批会拦截“因换班/加扣班成为实际当值”的班次，预览返回 `workflowBlockers`。
- 统一工作流冲突检查器重构已完成：三模块冲突检测统一到 `WorkflowConflictService`，旧的重复资格/时间/工作流查询已删除，最终全量回归 403/403 通过。
- 轮次 50 修复请假审批把排他截止日当天误计入“涉及已发布班次”的问题，重排提示与重排逻辑恢复一致。
- 轮次 51 修复加扣班/换班冲突提示被 `loadData()` 清空的问题，并让加扣班返回具体请假冲突原因。
- 轮次 52 新增自定义班种删除能力，并修复岗位删除失败时仍显示“已删除”的双重提示。
- 轮次 53 岗位删除改为忽略已软删除的排班期间，解决“页面看不到护理排班但后端仍提示已用于排班”的数据不一致。
- 轮次 54 换班撤销增加后续工作流顺序保护，并修复本地 8/21、8/22 因乱序撤销残留的日历标签。
- 轮次 55 实现失效工作流自动归档/自愈：新增单调工作流序列（迁移 0026–0031）替换毫秒级 createdAt 排序；`WorkflowSelfHealingService` 自动检测 completed 但实际人员不匹配且无后续有效工作流的记录，写入撤销事件并归档（不修改实际人员）；接入换班/加扣班全部事务入口与排班补录；启动巡检一次全库扫描（GET_LOCK 互斥、幂等）。检查点提交 `feat(workflows): auto-archive stale completed workflows with monotonic ordering` 识别。
- 轮次 56 修复 Fastify 非标准 Content-Type 被错误归一化为 500 的问题：错误处理器识别框架 4xx 并保留状态码，415 映射新增错误码 `UNSUPPORTED_MEDIA_TYPE`。检查点提交 `fix(api): map unsupported content types to 415 instead of 500` 识别。
- 下一活动批次：轮次 57（fetch 接收者修复）已完成、待用户强刷复核；随后 fix-progress 轮次 23 处理 #7.4（前端 swap/duty 候选与 isFutureAssignment 重复合并）；项目暂不上线，本地部署持续维护；CloudBase 上线验证暂停，待用户决定后再继续（随后等待用户验收并启动微信小程序立项，设计 26.1）。
- 上线状态：线上库迁移已执行至 0031（含 0021–0025）；API/schedule-jobs 与静态托管已上传；CloudBase 环境 `InsufficientBalance` 阻塞函数调用，健康检查未通过。
- 停止条件：本地部署可用且用户验收完成（上线暂停，待用户决定后再恢复“上线健康检查通过”停止条件）。

## Required Reading for the Next Conversation

1. 本文件（精简版）。
2. `fix-progress.md`（Web 1.0 合规修复的唯一切入点，含审查报告全文证据）。
3. `AGENTS.md`。
4. `docs/debug/debug-feedback-log.md`（每轮只需读一遍，后续轮次在其上追加）。
5. `docs/deployment/cloudbase-ops-notes.md`（涉及 CloudBase 控制台/CLI 时必须读）。
6. 设计规格相关章节（按当轮任务定位；常用 22/23/24/27）。
7. `git status --short --branch`、`git log -5 --oneline --decorate`、remotes，确认当前批次与代码一致。

## Known Environment State（关键信息；详细命令见 cloudbase-ops-notes）

- CloudBase 开发环境 `schedule-dev-d1geh4w1l4af7359d`（公网 + 单账号全局授权妥协）；`/api` 走 SCF + 网关鉴权，`/api/health` 匿名。
- 线上 MySQL（CynosDB 公共端点）：`sh-cynosdbmysql-grp-3vcucsya.sql.tencentcdb.com:24819`，库 `schedule_dev`，用户 `schedule_app`；凭据在 CloudBase 函数环境与 `infra/cloudbase/cloudbaserc.local.json`（gitignored），不入库。线上迁移记录已到 31 条（0021–0031 已应用）。
- CloudBase 环境当前状态：`InsufficientBalance`（余额不足），API 函数不可调用；需充值后重新触发部署验证。
- CynosDB `explicit_defaults_for_timestamp=OFF`：TIMESTAMP 列必须显式写明默认值，否则隐式带 `ON UPDATE CURRENT_TIMESTAMP`（`0018`/`0020` 已修复；新增 TIMESTAMP 列需遵循）。
- 部署铁律：含新迁移的发布必须先对线上库执行迁移（`pnpm --filter @schedule/api migrate`，带线上 `MYSQL_*` 环境），再部署代码；否则线上全站 500（轮次 12 事故）。
- 2026 法定节假日已导入并确认（39 条，`confirmedYears: [2026]`）。
- 本地：Docker dev MySQL（`medical-schedule-dev-mysql-1`，端口 3306）健康；`.env` 仅本地使用（含 `AUTH_DEV_MODE`/`VITE_AUTH_DEV_MODE`/`HOLIDAY_ADMIN_UIDS=local-admin`）；本地库已导入并确认 2026 节假日（39 条，v1）；隔离测试库端口 3307 当前运行。用户原端口 API `127.0.0.1:3000` 与验收 API `127.0.0.1:3001` 均为 2026-08-07 最新构建；Web 为用户原 `localhost:5173`（代理 3000）与验收 `localhost:5174`（代理 3001，`VITE_API_PROXY_TARGET` 可配置）；PWA shell/排班缓存当前为 `v5`。
- pnpm v11 依赖状态检查在 node_modules 元数据陈旧时会尝试以 production 裁剪 devDependencies（报 `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`）；已重新 `pnpm install` 恢复完整依赖（`.modules.yaml` 现为 `devDependencies: true`）。如再遇到该错误，先 `pnpm install` 再跑 `pnpm verify`，不要依赖 `CI=true` 让 pnpm 自行裁剪。
- 工具：`gh` 位于 `C:\Program Files\GitHub CLI\gh.exe`；CloudBase CLI 用 `pnpm exec tcb`；CAM 子账号 `schedule` 有 TCB/SCF/COS/CDN 权限（无 cynosdb）。
- 安全 TODO：CAM SecretId/SecretKey 曾贴入对话，需轮换并更新 GitHub `development` secrets；生产化另需 VPC 内网与专用运行账号（妥协与升级路径见 `docs/deployment/production-readiness.md`）。

## Reusable Operational Notes

- 含迁移的发布必须“先迁移线上库，再部署代码”。
- 隔离测试库：`docker compose --env-file .env -f infra/docker/compose.test.yml up --detach --wait`，以 `NODE_ENV=test` + `TEST_MYSQL_*` 运行 `pnpm verify`，结束后 `down --volumes`。
- 修改 contracts/database 后需先 `pnpm --filter @schedule/contracts build` / `pnpm --filter @schedule/database build` 再跑 API 集成测试。
- Web 改动上线后提醒用户强制刷新（PWA 缓存）；必要时升级 shell/schedule 缓存版本号。
- 本地验收对启动方式：`API_PORT=3001` 启动第二个 API，`VITE_API_PROXY_TARGET=http://127.0.0.1:3001 pnpm --filter @schedule/web dev -- --port 5174` 启动第二个 Vite（详见 `docs/development/local-setup.md`）。
- GitHub Actions 的 Verify 由 push/PR 触发；Deploy Development 仅允许手动触发，以上线状态以 `gh run list` 为准。
- 每次 push 后确认 `git status --short --branch` 与远端一致再继续。

## Decisions and Blockers（仅保留当前仍相关）

- 迁移先行规则（轮次 12 事故教训，必须遵守）。
- 撤销已批准请假不会自动还原已重排班次；如需恢复请重新生成/发布排班（轮次 13）。
- “覆盖已发布排班”确认项保留：设计规格禁止静默覆盖；轮次 32 已修复为必须真实勾选后才能提交。
- 排班变更只自动撤销换班/加扣班工作流，不自动撤销请假；撤销原因固定记录为“排班变更”。归档重发恢复所选原版本，不重新激活旧工作流效果。
- 已发布草稿自动离开活动草稿区，其编号与排班内容保留在当前/归档发布版本记录；访客无需登录，从公开群组名称列表选择群组后直接读取当天所在月份的月历，不返回群组码、电话、事件或管理能力；加入群组的群组码失败尝试仍按来源限流。
- 草稿过期提醒（设计 16.2）未实现，留待后续轮次。
- 生产化妥协（公网 + 单账号全局授权）：风险与升级路径见 `docs/deployment/production-readiness.md`；CAM key 轮换为安全 TODO。
- 阿里云迁移（2026-08-06，用户决定弃用腾讯云）：Web 1.0 已用 `infra/docker/compose.prod.yml` 部署到阿里云 ECS 试用机；试用机仅 1.6G 内存，镜像构建/依赖安装均会卡死系统，因此 API 依赖树由开发机 `pnpm deploy` 后拍平上传挂载（`runtime/api-flat/node_modules`），Web 前端由开发机 `vite build` 后上传挂载，服务器不做任何编译；登录认证暂为开发模式（`AUTH_DEV_MODE=true`），自建认证改造为后续任务。
- 当前无阻塞；待用户验收项见 debug 日志“待办 / 下一步”。

## Handoff Requirements

每次实现对话结束前：

1. 更新当前阶段与完成内容（debug 日志 + 本文件）。
2. 记录验证命令与结果（`pnpm verify` 基线）。
3. 记录相关决策、偏差、阻塞与外部控制台状态。
4. 设置下一批 1–3 个明确任务与停止条件。
5. 把状态更新纳入对应检查点提交。
6. 仅当 `AGENTS.md` Git 规则允许时推送。
