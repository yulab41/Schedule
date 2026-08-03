# Project Status

本文件是精简交接入口，只保留当前状态、下一步与关键环境信息。每一轮调试反馈、修改意见、自查发现、修复与验证的完整记录统一维护在 `docs/debug/debug-feedback-log.md`（单一来源）；Git 历史为持久历史，本文件不保留逐轮重复内容。

## Current Position

- Last updated: 2026-08-03
- Branch: `main` / Upstream: `origin/main`
- Target: Doctor Scheduling Web 1.0（`v1.0.0` 已发布）
- Current phase: Web 1.0 调试与测试阶段（完善后进入微信小程序阶段，设计规格 26.1 另建独立实施计划）
- Implementation: 32 项任务全部完成（详见实施计划与 Git 历史）
- Debug rounds: 1–28 已完成；最新验证基线 `pnpm verify` 354/354（60 个测试文件，隔离 MySQL）
- Next actions: 本地验收（Web `http://localhost:5173`，本地账号 `local-admin`/`local-member`；当前重点：添加成员后列表自动刷新、本地节假日标注恢复、换班事件叙述恢复完整姓名、统计页切换后不残留）+ 部署后线上验收；下一轮规划：月历式草稿/发布/应用预览、发布记录撤销/恢复/删除、发布前工作流清理、未来日期发布限制与既往排班模块

## Debug / Test Feedback Log

- 单一来源：`docs/debug/debug-feedback-log.md`（含记录规则模板、通用注意事项、轮次 1–18 明细、待办/下一步）
- 本文件不再重复逐轮内容，避免每轮对话重复读取同一份日志

## Approved Sources

- 设计规格：`docs/superpowers/specs/2026-08-01-medical-staff-scheduling-system-design.md`
- 实施计划：`docs/superpowers/plans/2026-08-01-medical-staff-scheduling-system-implementation-plan.md`
- 调试反馈日志：`docs/debug/debug-feedback-log.md`
- CloudBase 运维笔记：`docs/deployment/cloudbase-ops-notes.md`
- 仓库规则：`AGENTS.md`

## Completed Work（摘要）

- Tasks 1–32 全部完成并发布 `v1.0.0`（发布基线 322/322）；验收记录见 `docs/releases/web-1.0-acceptance.md`，发布提交 `release: web scheduling system 1.0`（tag `v1.0.0`）。
- 2026-08-03 调试期轮次 1–28 全部完成并部署（用户反馈、根因、修复、验证详见 debug 日志；最新基线 354/354）。
- 线上数据操作（2026-08-03）：按用户要求清空线上草稿与排班（23 个排班期间、638 条班次软删除，统计快照清空；模板/成员/岗位/班种/联系方式/事件历史保留）；线上迁移已执行至 20 条（`0018`/`0019`/`0020`）。

## Active Batch

- 32 任务计划已完结；当前为调试/测试批次：等待用户按 debug 日志与发布说明验收，并继续追加反馈轮次。
- 每轮默认动作：复现/修复用户反馈 → `pnpm verify`（隔离 MySQL）→ 更新 debug 日志与本文件 → commit + push（GitHub Actions 自动部署 CloudBase）。

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
- 本地：Docker dev MySQL（`medical-schedule-dev-mysql-1`，端口 3306）健康；`.env` 仅本地使用（含 `AUTH_DEV_MODE`/`VITE_AUTH_DEV_MODE`/`HOLIDAY_ADMIN_UIDS=local-admin`）；本地库已导入并确认 2026 节假日（39 条，v1）；隔离测试库端口 3307（临时容器用完即删）。
- 工具：`gh` 位于 `C:\Program Files\GitHub CLI\gh.exe`；CloudBase CLI 用 `pnpm exec tcb`；CAM 子账号 `schedule` 有 TCB/SCF/COS/CDN 权限（无 cynosdb）。
- 安全 TODO：CAM SecretId/SecretKey 曾贴入对话，需轮换并更新 GitHub `development` secrets；生产化另需 VPC 内网与专用运行账号（妥协与升级路径见 `docs/deployment/production-readiness.md`）。

## Reusable Operational Notes

- 含迁移的发布必须“先迁移线上库，再部署代码”。
- 隔离测试库：`docker compose --env-file .env -f infra/docker/compose.test.yml up --detach --wait`，以 `NODE_ENV=test` + `TEST_MYSQL_*` 运行 `pnpm verify`，结束后 `down --volumes`。
- 修改 contracts/database 后需先 `pnpm --filter @schedule/contracts build` / `pnpm --filter @schedule/database build` 再跑 API 集成测试。
- Web 改动上线后提醒用户强制刷新（PWA 缓存）；必要时升级 shell/schedule 缓存版本号。
- GitHub Actions 的 Deploy 由 Verify 成功触发；Verify 失败则该提交不部署，以上线状态以 `gh run list` 为准。
- 每次 push 后确认 `git status --short --branch` 与远端一致再继续。

## Decisions and Blockers（仅保留当前仍相关）

- 迁移先行规则（轮次 12 事故教训，必须遵守）。
- 撤销已批准请假不会自动还原已重排班次；如需恢复请重新生成/发布排班（轮次 13）。
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
