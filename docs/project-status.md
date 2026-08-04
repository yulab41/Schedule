# Project Status

本文件是精简交接入口，只保留当前状态、下一步与关键环境信息。每一轮调试反馈、修改意见、自查发现、修复与验证的完整记录统一维护在 `docs/debug/debug-feedback-log.md`（单一来源）；Git 历史为持久历史，本文件不保留逐轮重复内容。

## Current Position

- Last updated: 2026-08-04
- Branch: `main` / Upstream: `origin/main`
- Target: Doctor Scheduling Web 1.0（`v1.0.0` 已发布）
- Current phase: Web 1.0 调试与测试阶段（完善后进入微信小程序阶段，设计规格 26.1 另建独立实施计划）
- Implementation: 32 项任务全部完成（详见实施计划与 Git 历史）
- Debug rounds: 1–43 已完成；最新验证基线 379/379（61 个测试文件，隔离 MySQL）
- Next actions: 排查 Fastify 非标准 Content-Type 被错误归一化为 500 的问题；本轮不部署 CloudBase，后续仍只允许手动触发部署

## Debug / Test Feedback Log

- 单一来源：`docs/debug/debug-feedback-log.md`（含记录规则模板、通用注意事项、轮次 1–35 明细、待办/下一步）
- 本文件不再重复逐轮内容，避免每轮对话重复读取同一份日志

## Approved Sources

- 设计规格：`docs/superpowers/specs/2026-08-01-medical-staff-scheduling-system-design.md`
- 实施计划：`docs/superpowers/plans/2026-08-01-medical-staff-scheduling-system-implementation-plan.md`
- 调试反馈日志：`docs/debug/debug-feedback-log.md`
- CloudBase 运维笔记：`docs/deployment/cloudbase-ops-notes.md`
- 仓库规则：`AGENTS.md`

## Completed Work（摘要）

- Tasks 1–32 全部完成并发布 `v1.0.0`（发布基线 322/322）；验收记录见 `docs/releases/web-1.0-acceptance.md`，发布提交 `release: web scheduling system 1.0`（tag `v1.0.0`）。
- 2026-08-04 调试期轮次 1–43 全部完成（用户反馈、根因、修复、验证详见 debug 日志；最新基线 379/379；CloudBase 部署保持手动触发，本轮未部署）。
- 轮次 35 按用户要求开放访客节假日、联系电话与当天标记，并禁止换班/加扣班等事件标记与事件入口；月/周/列表日历对过去日期统一显示深灰色（访客与用户/管理员模式一致）。检查点提交 `feat(guest): expose holidays and contacts while hiding events, gray past dates` 识别。
- 轮次 37 修复管理员发起的换班事件在首页弹窗错误显示“由成员一发出”，改为按实际操作账户显示发起人；人员变更链移到事件弹窗底部并默认折叠。检查点提交 `fix(events): show acting account for admin swaps; collapsible change chain` 识别。
- 轮次 38 合并换班/加扣班人员变更链为一条、去掉日历“事件”按钮并改为点击“换/加”等标记打开事件弹窗、恢复点击姓名弹出联系电话（未确认号码仅可复制）。检查点提交 `fix(events): merge change chains, marker-click events, restore phone menu` 识别。
- 轮次 39 新增成员身份认领工作流（同名检测、普通成员申请/管理员审批、管理员直认领与撤销、群主保护），成员页改为紧凑表格布局；新增迁移 0022。检查点提交 `feat(members): identity claim workflow with admin approval and compact member table` 识别。
- 轮次 40 为换班/加扣班/请假审批增加“已受理”同步：处理人姓名回填到读模型，三个面板显示已受理记录（状态 + 来自 xx），其他管理员刷新后不再把已处理申请当待审批。检查点提交 `feat(events): sync multi-admin approval handled state with decider name` 识别。
- 轮次 41 新增换班“已生效待撤销”与用户侧撤销（管理员或双方可撤销），统一换班/加扣班/请假撤销权限；撤销前校验班次状态（失效/后续有变动时 409），已生效列表只显示可撤销记录并自动归档失效项。检查点提交 `feat(workflows): revocable completed swaps, unified revoke permissions, stale auto-archive and ordering guard` 识别。
- 轮次 42 将撤销加扣班与管理员直接代值的原因改为选填（未填时保留原原因，省略字段不校验）。检查点提交 `feat(duty-adjustments): make direct apply and revoke reasons optional` 识别。
- 轮次 43 将撤销换班的理由改为选填（省略时事件不写原因）。检查点提交 `feat(swaps): make swap revoke reason optional` 识别。
- 轮次 33 完成排班变更工作流撤销、发布版本月历、当前撤销/归档重发、已发布草稿归档体验和群组码访客只读月历；检查点提交以 `feat(schedules): add publication lifecycle and guest calendar` 识别。
- 轮次 34 修复历史软删除排班导致换班/加扣班审批页 500，访客改为公开群组名称列表和当月默认月历，并将 PWA 缓存升级到 v3 以清除旧发布记录前端资源；检查点提交以 `fix(schedules): restore history and guest access` 识别。
- 线上数据操作（2026-08-03）：按用户要求清空线上草稿与排班（23 个排班期间、638 条班次软删除，统计快照清空；模板/成员/岗位/班种/联系方式/事件历史保留）；线上迁移已执行至 20 条（`0018`/`0019`/`0020`）。

## Active Batch

- 32 项实施计划已完结；当前为 Web 1.0 调试/验收批次。轮次 34 已完成排班版本验收回归、工作流历史读取和访客访问策略调整。
- 下一活动批次（1 项）：排查并修复 Fastify 非标准 Content-Type 被错误归一化为 500 的问题。
- 停止条件：该问题完成定向测试并通过完整验证；不启动微信小程序，不部署 CloudBase。

## Required Reading for the Next Conversation

1. 本文件（精简版）。
2. `AGENTS.md`。
3. `docs/debug/debug-feedback-log.md`（每轮只需读一遍，后续轮次在其上追加）。
4. `docs/deployment/cloudbase-ops-notes.md`（涉及 CloudBase 控制台/CLI 时必须读）。
5. 设计规格相关章节（按当轮任务定位；常用 22/23/24/27）。
6. `git status --short --branch`、`git log -5 --oneline --decorate`、remotes，确认当前批次与代码一致。

## Known Environment State（关键信息；详细命令见 cloudbase-ops-notes）

- CloudBase 开发环境 `schedule-dev-d1geh4w1l4af7359d`（公网 + 单账号全局授权妥协）；`/api` 走 SCF + 网关鉴权，`/api/health` 匿名。
- 线上 MySQL（CynosDB 公共端点）：`sh-cynosdbmysql-grp-3vcucsya.sql.tencentcdb.com:24819`，库 `schedule_dev`，用户 `schedule_app`；凭据在 CloudBase 函数环境与 `infra/cloudbase/cloudbaserc.local.json`（gitignored），不入库。迁移记录 20 条。
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
