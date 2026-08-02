# Web 1.0 发布验收记录

- 版本：`v1.0.0`（2026-08-02）
- 发布环境：CloudBase 开发环境 `schedule-dev-d1geh4w1l4af7359d`，入口 `https://schedule-dev-d1geh4w1l4af7359d-1300188335.tcloudbaseapp.com`
- 环境决策：用户接受“公网 + 单账号全局授权”妥协方案，付费正式化项延后（详见 `docs/deployment/production-readiness.md`）
- 验收范围：计划 Task 32 的 12 个验收场景 + 发布步骤

## 1. 自动化验证（全部通过）

| 检查                              | 结果                                                                                                               |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `pnpm verify`（含隔离 MySQL 8.4） | 通过：60 个测试文件、322 个测试全部通过（含全部数据库集成套件）                                                    |
| `pnpm cloudbase:build`            | 通过：API 包 6.1 MB、jobs 包 2.4 MB                                                                                |
| 容量与并发                        | `tests/load` 通过（100 群组/2000 用户、100 并发读、20 路换班竞争等），报告见 `docs/testing/performance-report.md`  |
| 安全矩阵                          | `tests/security` 4/4 通过（跨群隔离、群组码 429、幂等重放、陈旧审批回滚），见 `docs/testing/security-checklist.md` |

## 2. 线上冒烟验收（2026-08-02 实测）

| 检查项                                                 | 结果                                                                                                                                                                            |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/health`                                      | 200 `{"component":"api","ready":true}`                                                                                                                                          |
| `GET /`（首页）                                        | 200，返回应用外壳                                                                                                                                                               |
| `GET /api/users/me`（admin01）                         | 200：真实姓名“林恩宇”，version 1                                                                                                                                                |
| `GET /api/groups`                                      | 200：群组“头颈外科”（群组码 1717，owner）                                                                                                                                       |
| `GET /api/groups/:id/calendar?businessMonth=2026-08`   | 200：已发布排班 7 条排班记录，期间 `6baccc7b-9f3f-46d7-9bd2-5543124130ec`                                                                                                       |
| `GET /api/groups/:id/scheduling-config`                | 200：角色、6 个班种、rulesVersion 13                                                                                                                                            |
| `GET /api/groups/:id/members`                          | 200：成员“林恩宇”                                                                                                                                                               |
| `GET /api/groups/:id/statistics?businessMonth=2026-08` | 200：林恩宇 5 个计值班次统计                                                                                                                                                    |
| `GET /api/groups/:id/events?pageSize=5`                | 200：`leave_request_submitted` → `leave_request_approved` → `leave_cover_completed` 事件链（请假 `b513ff59-ff58-49ba-82a2-e970ddc1cd10`）                                       |
| `GET /api/groups/:id/leave-reflow-strategy`            | 200：`keep-original-order`                                                                                                                                                      |
| `GET /api/holidays?year=2026`                          | 200：`confirmed:true`，39 条官方安排（2026-08-03 导入确认，国办发明电〔2025〕7 号）                                                                                             |
| `GET /api/platform/jobs`                               | 200：`database-backup`、`statistics-rebuild` 均 completed                                                                                                                       |
| `GET /api/platform/backups`                            | 200：归档 `22fc2b6d-b5b0-4dc5-9b8b-1201401378f3`（37 表、471 行、SHA-256 已记录）                                                                                               |
| 线上备份任务                                           | `schedule_database_backup` 触发成功，`runId fd441b12-df1f-4408-9b6a-40968fa1ed47`，归档 `backups/monthly/2026-08-02T14-37-40.657Z.backup`（769,544 字节，monthly 保留档）       |
| 部署复验                                               | 最近全绿 CI 部署 `30751971001`（14:22）；复验时两次 CI 运行卡在 Runner 侧静态托管上传（函数代码均已更新成功），本地 `tcb hosting deploy` 9/9 文件秒传成功，线上健康检查保持 200 |

## 3. 验收场景对照

| #   | 场景                               | 自动化证据                                                    | 线上证据                               | 结论                         |
| --- | ---------------------------------- | ------------------------------------------------------------- | -------------------------------------- | ---------------------------- |
| 1   | 新用户登录、完善真实姓名并保持登录 | `user-routes.integration.test.ts` 6 项                        | `/api/users/me` 200（林恩宇）          | 通过                         |
| 2   | 管理员创建群组、人员、角色和班种   | `group-permissions`、`scheduling-config`、`roster-input` 测试 | 群组/成员/配置接口 200                 | 通过                         |
| 3   | 成员通过群组码自动认领             | 认领与安全矩阵测试                                            | Task 30 浏览器验收（群组码 1717）      | 通过                         |
| 4   | 自动生成固定顺序排班               | `schedule-generation` 7 项 + 轮转域测试                       | 已发布 2026-08 期间存在                | 通过                         |
| 5   | 手动 7 天模板重复到指定日期        | `templates` 5 项 + `apply` 10 项 + 域测试                     | 功能已部署（测试覆盖）                 | 通过                         |
| 6   | 登录后直接看到当月值班姓名         | `calendar` 6 项 + 视图/当月逻辑测试                           | 日历接口 200、7 条值班                 | 通过（浏览器目视由用户确认） |
| 7   | 手机拨打长号/短号                  | 日历逻辑测试覆盖拨号与复制                                    | 待用户浏览器确认                       | 通过（逻辑）/用户确认        |
| 8   | 请假两种重排策略                   | `leaves` 10 项 + `reflow`/`overlap` 域测试                    | 策略接口 200 + Task 30 请假审批链      | 通过                         |
| 9   | 换班和加扣班                       | `swaps` 10 项 + `duty-adjustments` 12 项                      | 功能已部署（测试覆盖）                 | 通过                         |
| 10  | 双浏览器并发修改被阻止并刷新       | `concurrency` 4 项 + 负载/安全矩阵                            | 版本冲突机制线上生效（409 契约）       | 通过                         |
| 11  | 事件和统计影响                     | `event-routes` 5 项 + `statistics` 5 项 + 逻辑测试            | 事件链与统计接口 200                   | 通过                         |
| 12  | 通知、备份、恢复、监控             | `notifications` 7 项、备份/恢复/平台 15 项                    | 线上备份与任务记录 200；监控手册已发布 | 通过                         |

## 4. 发布步骤记录

1. 完成所有自动检查：`pnpm verify` 322/322 通过，`pnpm cloudbase:build` 通过。✅
2. 创建正式数据库备份：线上 `database-backup` 任务完成并记录归档（见第 2 节）。✅
3. 在开发环境完成完整验收：本文件第 2、3 节。✅
4. 手动批准生产部署：在妥协环境下，函数代码已由 CI 更新、静态托管已上传最新构建；正式环境拆分延后（Task 31）。✅（按妥协方案）
5. 运行生产冒烟测试：健康检查、首页、业务接口全部 200。✅
6. 创建语义化 Web 1.0 Git 标签与 GitHub Release：`v1.0.0`。✅

## 5. 遗留项与注意事项

- 2026 年法定节假日已导入并确认（39 条，含 6 个调休上班日），数据集与来源见 `infra/holidays/`；2027 年数据待官方通知发布后按同一流程导入。
- 浏览器级最终确认项（手机拨号、浏览器推送授权、PWA 安装）请用户在正式域名上过一遍；相关逻辑已由自动化测试覆盖。
- CAM 子账号密钥轮换、单账号公网 MySQL、备份持久化等安全/付费事项按 Task 31 记录延后处理。
- 默认域名作为正式入口是本次妥协方案的一部分；自定义域名与 ICP 备案完成后按 `docs/deployment/dns-and-https.md` 切换。
