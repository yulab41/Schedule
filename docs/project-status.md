# Project Status

本文件是精简交接入口，只保留当前状态、下一步与关键环境信息。每一轮调试反馈、修改意见、自查发现、修复与验证的完整记录统一维护在 `docs/debug/debug-feedback-log.md`（单一来源）；Git 历史为持久历史，本文件不保留逐轮重复内容。

## Current Position

- Last updated: 2026-08-06
- Branch: `main` / Upstream: `origin/main`
- Target: Doctor Scheduling Web 1.0（`v1.0.0` 已发布）
- Current phase: Web 1.0 调试与测试阶段（完善后进入微信小程序阶段，设计规格 26.1 另建独立实施计划）
- Implementation: 32 项任务全部完成（详见实施计划与 Git 历史）
- Debug rounds: 1–56 已完成；fix-progress 轮次 1（#3.1）、2（#4.1）、3（#7.3）已完成；最新验证基线 428/428（63 个测试文件，隔离 MySQL）
- Next actions: fix-progress 轮次 4 目标为 #3.2（日志/审计脱敏清单双份维护，合并为共享脱敏模块）；上线执行中：线上库已迁移至 0031、云函数与静态托管已上传，但 CloudBase 环境余额不足导致 `/api/health` 不可用；待用户充值后重新触发 Deploy Development 并验证，随后等待用户验收并启动微信小程序立项

## Debug / Test Feedback Log

- 单一来源：`docs/debug/debug-feedback-log.md`（含记录规则模板、通用注意事项、轮次 1–49 明细、待办/下一步）
- 本文件不再重复逐轮内容，避免每轮对话重复读取同一份日志

## Approved Sources

- 设计规格：`docs/superpowers/specs/2026-08-01-medical-staff-scheduling-system-design.md`
- 实施计划：`docs/superpowers/plans/2026-08-01-medical-staff-scheduling-system-implementation-plan.md`
- 调试反馈日志：`docs/debug/debug-feedback-log.md`
- CloudBase 运维笔记：`docs/deployment/cloudbase-ops-notes.md`
- 仓库规则：`AGENTS.md`

## Completed Work（摘要）

- 2026-08-06 fix-progress 轮次 3：收敛 #7.3 的中国时区算法——领域包导出唯一 `chinaStandardTimeOffsetMilliseconds` 与 `toChinaStandardTimeUtcTimestamp`，web 新增 `@schedule/scheduling-domain` 依赖，9 个前端文件删除重复常量/裸魔法数并改用领域函数（calendar-logic/calendar-views 保留薄包装），StatisticsView/ExportDialog/ManualScheduleView 三个视图裸写随本轮一并替换（#8.2 视为完成）；新增 1 条 UTC 换算锁定测试；`pnpm verify` 428/428 通过。
- 2026-08-06 fix-progress 轮次 2：收敛 #4.1 的 swap/duty 重复成员/角色读取为共享 `GroupMemberReader`（`apps/api/src/modules/groups/group-member-reader.ts`），`loadMembers` 用 `autoAcceptSwapsDefault` 显式表达差异（swap=1、duty=0），`loadRoleNames` 共享；两个服务删除私有复制实现与重复类型；新增“从未设置偏好”默认行为锁定测试 2 条 + 共享读取器集成测试 4 条；`pnpm verify` 427/427 通过。
- 2026-08-06 fix-progress 轮次 1：收敛 #3.1 的 starts_at 环境补丁为统一 `updateShiftAssignments` 助手（注释 CynosDB `explicit_defaults_for_timestamp=OFF` 原因），5 个文件 12 处调用点全部改用助手；新增“批量更新不改变 starts_at（模拟 ON UPDATE）”锁定测试；`pnpm verify` 421/421 通过。
- Tasks 1–32 全部完成并发布 `v1.0.0`（发布基线 322/322）；验收记录见 `docs/releases/web-1.0-acceptance.md`，发布提交 `release: web scheduling system 1.0`（tag `v1.0.0`）。
- 2026-08-05 调试期轮次 1–49 全部完成（用户反馈、根因、修复、验证详见 debug 日志；最新基线 394/394；CloudBase 部署保持手动触发，本轮未部署）。
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

- fix-progress 轮次 3（#7.3）已完成：中国时区算法已统一到 `@schedule/scheduling-domain`（唯一偏移常量 + UTC 换算助手），web 依赖领域包并删除 9 个文件重复实现；#8.2 三个视图裸写随本轮一并替换；下一活动批次为 fix-progress 轮次 4（#3.2）。
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
- 下一活动批次：fix-progress 轮次 4 处理 P1 #3.2（日志/审计脱敏清单双份维护，合并为共享脱敏模块）；同时用户为 CloudBase 环境充值后重新触发 Deploy Development，验证 `/api/health` 与首页；随后等待用户验收并启动微信小程序立项（设计 26.1）。
- 上线状态：线上库迁移已执行至 0031（含 0021–0025）；API/schedule-jobs 与静态托管已上传；CloudBase 环境 `InsufficientBalance` 阻塞函数调用，健康检查未通过。
- 停止条件：上线健康检查通过且用户验收完成。

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
- 本地：Docker dev MySQL（`medical-schedule-dev-mysql-1`，端口 3306）健康；`.env` 仅本地使用（含 `AUTH_DEV_MODE`/`VITE_AUTH_DEV_MODE`/`HOLIDAY_ADMIN_UIDS=local-admin`）；本地库已导入并确认 2026 节假日（39 条，v1）；隔离测试库端口 3307 当前运行。用户原端口 API `127.0.0.1:3000` 与验收 API `127.0.0.1:3001` 均为最新构建（轮次 36 已重启 3000 修复陈旧进程）；Web 为用户原 `localhost:5173`（代理 3000）与验收 `127.0.0.1:5174`（代理 3001）；PWA shell/排班缓存当前为 `v4`。
- 工具：`gh` 位于 `C:\Program Files\GitHub CLI\gh.exe`；CloudBase CLI 用 `pnpm exec tcb`；CAM 子账号 `schedule` 有 TCB/SCF/COS/CDN 权限（无 cynosdb）。
- 安全 TODO：CAM SecretId/SecretKey 曾贴入对话，需轮换并更新 GitHub `development` secrets；生产化另需 VPC 内网与专用运行账号（妥协与升级路径见 `docs/deployment/production-readiness.md`）。

## Reusable Operational Notes

- 含迁移的发布必须“先迁移线上库，再部署代码”。
- 隔离测试库：`docker compose --env-file .env -f infra/docker/compose.test.yml up --detach --wait`，以 `NODE_ENV=test` + `TEST_MYSQL_*` 运行 `pnpm verify`，结束后 `down --volumes`。
- 修改 contracts/database 后需先 `pnpm --filter @schedule/contracts build` / `pnpm --filter @schedule/database build` 再跑 API 集成测试。
- Web 改动上线后提醒用户强制刷新（PWA 缓存）；必要时升级 shell/schedule 缓存版本号。
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
- 当前无阻塞；待用户验收项见 debug 日志“待办 / 下一步”。

## Handoff Requirements

每次实现对话结束前：

1. 更新当前阶段与完成内容（debug 日志 + 本文件）。
2. 记录验证命令与结果（`pnpm verify` 基线）。
3. 记录相关决策、偏差、阻塞与外部控制台状态。
4. 设置下一批 1–3 个明确任务与停止条件。
5. 把状态更新纳入对应检查点提交。
6. 仅当 `AGENTS.md` Git 规则允许时推送。
