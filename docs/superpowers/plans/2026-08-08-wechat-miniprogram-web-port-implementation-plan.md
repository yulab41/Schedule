# 实施计划：微信小程序重制（Web 最新版全量移植 + 微信扩展 + 平台运维控制台）

- 日期：2026-08-08
- 状态：用户已确认基准设计 `docs/superpowers/specs/2026-08-08-wechat-miniprogram-web-port-design.md`
- 执行方式：**新对话 Codex goal 模式一次性完成**（本文件为唯一执行依据，不依赖聊天记忆）
- 目标：小程序功能面 = 当前 Web 最新版 + 微信扩展（登录/认证/邀请/访客扫码/订阅消息）+ 平台运维控制台；UI 从零绘制，禁止在旧小程序页面/组件上打补丁
- 停止条件：移植清单全部打勾、全部验证通过、文档状态更新并推送

## 0. 新对话执行规则（必须遵守）

1. 先完整读取：`AGENTS.md`、`docs/project-status.md`、本计划、`docs/superpowers/specs/2026-08-08-wechat-miniprogram-web-port-design.md`、`docs/miniprogram-web-port-checklist.md`。
2. 检查 `git status --short --branch`、`git log -5 --oneline`、remotes，确认工作区与计划一致；不触碰用户未提交文件（当前存在未跟踪 `docs/mini-program/`，不得暂存）。
3. 严格按批次 A→E 顺序执行；每批独立验证并提交；每批完成后更新 `docs/miniprogram-web-port-checklist.md` 对应行。
4. 每个批次提交前更新 `docs/project-status.md` 与 `docs/debug/debug-feedback-log.md`（简短）。
5. 完成后推送 `main`；如推送失败，保留本地提交并报告。
6. 涉及 `packages/contracts`、`packages/database`、`apps/api` 的改动，先构建再跑集成测试；涉及 Web 核心链路时按 AGENTS.md 跑 `pnpm smoke:check-core`。

## 1. 总原则

- 内核（apps/api + packages/contracts + packages/database + packages/scheduling-domain）**不改**，仅批次 D 新增一个只读接口 `GET /platform/me`。
- Web 前端纯逻辑文件**直接复制/搬运**到 `apps/miniprogram/utils/`（改导入路径、适配 `ApiClientError`），并连同 Web 对应单测一起搬运；禁止重写业务算法。
- 小程序 UI（WXML/WXSS/组件/页面）**从零新建**；批次 A 第一步整目录删除旧 `pages/*` 与 `components/*`，不迁移旧页面代码。
- 保留的工程基础设施：`project.config.json`、`app.ts`、`app.wxss`、`styles/tokens.wxss`、`config/index.ts`、`api/client.ts`、`store/session.ts`、`scripts/*`。`api/endpoints.ts` 在旧版基础上按需增删（属基础设施，不算 UI 补丁）。
- 微信专属能力保留并重画 UI：登录/注册、邀请落地与创建、访客扫码、群码、订阅提醒设置。

## 2. 批次 A：工程重置、信息架构、日历、群组、排班配置

### A1. 重置目录

- 删除：`apps/miniprogram/pages/`（全部）、`apps/miniprogram/components/`（全部）。
- 删除旧版独立 utils 中已被 Web 逻辑替代者：`utils/calendar.ts`、`utils/workflow.ts`、`utils/time.ts`、`utils/events.ts`；保留 `utils/uuid.ts`、`utils/subscription.ts`（重写），删除 `store/group.ts`（由新 store 替代）。
- 新建目录结构（页面路径即最终形态）：
  - `pages/login/login`、`pages/register/register`、`pages/workbench/workbench`、`pages/profile/profile`
  - `pages/calendar/calendar`、`pages/calendar-week/calendar-week`、`pages/calendar-list/calendar-list`、`pages/guest/guest`
  - `pages/group/groups`、`pages/group/members`、`pages/group/contact-edit`、`pages/group/invite-create`、`pages/group/qr`、`pages/invite/invite`
  - `pages/schedule/config`、`pages/schedule/manual`、`pages/schedule/backfill`、`pages/schedule/statistics`、`pages/schedule/export`
  - `pages/requests/requests`、`pages/requests/leave-create`、`pages/requests/swap-create`、`pages/requests/duty-create`
  - `pages/approvals/approvals`、`pages/events/events`
  - `pages/notifications/notifications`、`pages/notifications/settings`
  - `pages/platform/jobs`、`pages/platform/backups`、`pages/platform/users`、`pages/platform/holidays`
- `app.json`：注册上述页面；tabBar 固定为 工作台/日历/通知/我的。

### A2. 搬运 Web 前端逻辑（后续批次共用）

从 `apps/web/src/features`、`apps/web/src/utils` 复制到 `apps/miniprogram/utils/`（保留行为，含注释）：

- `calendar-logic.ts`、`calendar-views.ts`
- `manual-schedule-logic.ts`（批次 B 使用）
- `statistics-logic.ts`（批次 C 使用）
- `workflow-logic.ts`、`assignment-option.ts`、`leave-logic.ts`、`swap-logic.ts`、`duty-adjustment-logic.ts`
- `event-timeline.ts`、`export-logic.ts`（批次 C 使用）、`roster-input.ts`、`notification-logic.ts`、`user-message.ts`
- `workbench-nav.ts` → `utils/workbench-nav.ts`（角色过滤与 Web 一致）
- `apps/web/src/api/conflict-handler.ts` → `utils/conflict.ts`，把 `ApiClientError` 换成小程序版

同步复制 Web 对应 `.spec.ts` 为 `apps/miniprogram/utils/*.spec.ts`（改导入路径），保证行为等价。

### A3. 工作台 Hub 与角色过滤

- `pages/workbench/workbench`：模块入口列表与 Web `workbenchNavItems` 一致（日历/群组/手动排班/补录/请假/换班/加扣班/事件/通知/统计/成员/排班配置/导出/平台运维）；
- 角色过滤：成员隐藏 手动排班/补录/事件/排班配置；访客只显示 日历/群组；群主/管理员全量；平台管理员额外显示 平台运维；
- `pages/profile/profile`：真实姓名、联系方式编辑确认、退出登录、注销（`/users/me/deregister`）、平台运维入口（当 `GET /platform/me` 为 true）。

### A4. 日历三视图 + 访客 + 节假日

- 月/周/列表三视图；周末红 `#E03131`、今天金 `#F5C518`、六/日列名红色、班次色块、换替角标、值班详情（姓名/时间/已确认电话）；
- 节假日/调休标签：调用 `GET /holidays`、`GET /guest/holidays`（新增 endpoint 封装）；
- 访客：扫码落地（scene v=）→ resolve → 简化月历；登录访客走 `guest-calendar`。

### A5. 群组与成员

- `pages/group/groups`：创建群组、目录（访客加入）、改名/改码/访客 key 重生成/群码展示/转让/解散/恢复、退出、已解散列表；
- `pages/group/members`：成员/待认领名单、添加/转正/删除、设管理员/移除、转让群主、发起邀请（跳 invite-create）；
- `pages/group/contact-edit`：本人“保存并确认”、管理员“预填联系方式”（`updateGroupMemberContact`）；
- `pages/group/invite-create`：一次性邀请（岗位/权限角色）、转发、撤销；`pages/invite/invite` 落地接受。

### A6. 排班配置（重写，无轮值）

- `pages/schedule/config`：班种（增改删/启用/跨日/计入统计/颜色/时间）+ 岗位（新增/删除/参与成员勾选）；
- 删除轮值顺序/轮值规则/自动生成入口；后端轮值接口不暴露。

### A7. 验证与提交

- `pnpm miniprogram:typecheck`、`pnpm miniprogram:lint`、`pnpm vitest run apps/miniprogram`；
- 扩展 `scripts/miniprogram-smoke.mjs` 覆盖新页面（逐页打开无脚本错误）；
- 更新移植清单批次 A 行；提交 `feat(miniprogram): rebuild shell, workbench, calendar, groups and schedule config from web baseline`。

## 3. 批次 B：手动排班（绘制式 + 草稿 + 发布记录）

- `pages/schedule/manual`：完整对齐 Web `ManualScheduleView`：
  - 编辑器：岗位/成员勾选/起始日期/循环天数；班种调色板点选后点格子填/清除；格子/行/列清除；撤销栈；失效标记（成员失效、班种停用/版本变更）；
  - 模板：新建/编辑/删除/应用；应用预览（冲突/空缺/连续值班）；起始日期自动取已发布之后首个未排日期；
  - 草稿批次：按 `operationId` 分组（起止范围/角色/月份 chips），发布整个排班/删除草稿；
  - 发布记录：按 月份+岗位 分组（当前已发布/既往锁定/已归档）；归档可重新发布/删除；既往月份显示“排班补录”入口；
  - 发布/撤销/重新发布前：变更影响预览（工作流撤销、硬冲突、空缺、已过日期）+ 确认勾选；
  - 版本冲突 409：弹窗提示并刷新（等价 Web `DataConflictDialog`）。
- 组件（新建）：`components/manual-grid`、`components/shift-palette`、`components/confirm-dialog`、`components/calendar-grid`（月历复用）。
- 验证：`utils/manual-schedule.spec.ts`（搬运 Web spec）+ typecheck/lint + 模拟器手工流程（绘制→保存草稿→发布→撤销→重发）；
- 更新移植清单；提交 `feat(miniprogram): manual scheduling paint mode, templates, draft batches and publishing`。

## 4. 批次 C：排班补录、统计、成员联系方式、导出

### C1. 排班补录

- `pages/schedule/backfill`：对齐 Web `PastScheduleView`——岗位/月份切换、班种+成员调色板、点击既往日期加入待确认、再点移除、清空、补录说明、确认后逐条 `createPastScheduleAssignment`、显示最近补录记录；
- 未来日期不可补录；已过月份锁定。
- endpoint 新增：`listPastSchedulePeriods`、`listPastScheduleAssignments`、`listPastScheduleBackfillRecords`、`createPastScheduleAssignment`、`updatePastScheduleAssignment`、`getSchedulePeriodCalendar`。

### C2. 统计（补齐）

- `pages/schedule/statistics`：汇总卡（计划/实际/计值班次/周末/节假日/换班/加班/扣班/净值/请假补位/人工调整）、成员表（按实际排序 + 计值班次 + 原实对照）、按岗位/按班种明细、刷新快照、重算校验（摘要文案与 Web 一致）。
- 搬运 `statistics-logic.ts` 与 spec。

### C3. 成员联系方式

- `pages/group/contact-edit`：与 C 批次联动（A5 已有页面，这里补接口与流程验证）。

### C4. 导出

- `pages/schedule/export`：导出内容（排班/统计）、时间范围（月/年）、岗位/成员筛选 → `POST /exports` → 轮询 `GET /exports/:id` → `wx.downloadFile`（带 Bearer）→ 保存/分享/`wx.openDocument`；
- 搬运 `export-logic.ts` 与 spec；文件名/审计规则一致；
- 注意：downloadFile 合法域名需与 request 域名相同；备案前真机调试依赖“打开调试”。

### C5. 验证与提交

- `pnpm vitest run apps/miniprogram`、typecheck、lint、模拟器流程；
- 更新移植清单；提交 `feat(miniprogram): backfill, full statistics, contact editing and exports`。

## 5. 批次 D：平台运维控制台

### D1. 最小后端扩展

- `packages/contracts/src/platform.ts`：新增 `GET /platform/me` 响应 schema `{ isPlatformAdmin: boolean }`；
- `apps/api/src/modules/platform-admin/platform-admin-routes.ts`：新增只读路由，用 `allowedCloudbaseUids` 判断（不泄露其他信息）；
- 集成测试 1–2 条（管理员 true / 非管理员 false）；先写失败测试再实现。

### D2. 小程序页面

- `pages/platform/jobs`：任务运行列表 `GET /platform/jobs`；
- `pages/platform/backups`：备份列表 `GET /platform/backups`（**仅列表，不做下载**，按用户确认）；若列表含已解散群组标识，提供“恢复群组”`POST /platform/groups/:groupId/restore`；
- `pages/platform/users`：平台用户列表/状态（停用/启用）`PUT /platform/users/:userId/status`（用户列表数据来自现有内核能力，若无可列出则仅支持已知用户操作，以 API 为准）；
- `pages/platform/holidays`：节假日导入流程：`import-preview` → `import` → `versions` → `confirm` → `coverage`；
- 入口：`profile` 与 `workbench` 仅在 `GET /platform/me` 为 true 时显示“平台运维”。

### D3. 验证与提交

- contracts/api 构建 + 定向集成测试；`pnpm verify`（若隔离 MySQL 可用则含集成）；
- 小程序 typecheck/lint；模拟器页面冒烟；
- 更新移植清单；提交 `feat(platform+miniprogram): platform admin console and holiday import`。

## 6. 批次 E：移植清单全量走查与收尾

1. 逐行核对 `docs/miniprogram-web-port-checklist.md`，未打勾项必须补实现或明确“不移植”理由；
2. 运行完整验证矩阵（见第 7 节）；
3. 扩展并运行 `scripts/miniprogram-smoke.mjs` 全部页面截图冒烟；
4. 更新 `docs/project-status.md`（完成项、验证结果、下一阶段=部署验收）与 debug 日志；
5. 提交 `docs+test(miniprogram): complete web port checklist and verification` 并推送。

## 7. 测试方案（重新拟定，避免时间浪费）

### 7.1 测试分层与命令矩阵

| 层 | 内容 | 何时运行 |
| --- | --- | --- |
| 快层 | `pnpm miniprogram:typecheck`、`pnpm miniprogram:lint`、`pnpm vitest run apps/miniprogram`（搬运逻辑单测） | 每个批次内、每次改动后 |
| 内核层 | `pnpm verify`（format/lint/build/typecheck + 全仓单测） | 批次边界；批次 D 必跑 |
| 集成层 | 隔离 MySQL 集成测试（`TEST_MYSQL_*`） | 仅当 `apps/api`、`packages/contracts`、`packages/database`、`packages/scheduling-domain` 改动时（批次 D） |
| Web 冒烟 | `pnpm smoke:browser` / `pnpm smoke:check-core` | 仅当 Web/核心链路改动时（本计划不涉及） |
| 小程序冒烟 | `scripts/miniprogram-smoke.mjs` 逐页截图 | 每个批次结束 |

### 7.2 保留 / 新增 / 剔除

- **保留**：`apps/api`、`packages/*` 全部测试——它们是共享内核的保障，删除会失去“Web 轮次 1–61/N1–N15 行为继承”的验证基础；
- **保留**：Web 前端现有单测与冒烟——Web 尚未下线，且是移植对照基准；
- **新增（小程序）**：仅为“从 Web 搬运的逻辑”写等价单测（`utils/*.spec.ts`），数量与 Web 对应 spec 一致；
- **不新增**：小程序 WXML 页面级 UI 单测（无基础设施，用模拟器冒烟替代）；不引入 Vue Test Utils 类框架；
- **剔除**：旧小程序页面整目录删除后，其相关文件（目前无测试）不迁移；旧 `utils/calendar.ts`、`utils/workflow.ts` 等被 Web 逻辑替代，旧测试（无）不保留；`docs/miniprogram-web-port-checklist.md` 中标记“不移植”的项不产生测试。
- **时间优化**：不再每批次跑全量隔离 MySQL；只有批次 D 动了内核才跑。最终验收跑一次完整矩阵。

## 8. 明确不移植 / 不恢复

- 轮值顺序/轮值规则/自动生成排班前端入口；
- Web PWA 离线缓存、浏览器推送、桌面布局（hover/宽表格/桌面弹窗）；
- 免登录公开访客目录；
- 备份下载（仅列表；如需下载另行新增后端接口）；
- 平台用户管理如当前内核无“列表”接口，仅实现接口支持的操作，不伪造数据。

## 9. 风险与决策记录

- `PLATFORM_ADMIN_UIDS`：批次 D 完成后需在服务器配置用户微信账号的 cloudbaseUid（`wx_` 开头），由用户执行；
- downloadFile 合法域名与真机调试限制见设计文档 §9；
- 旧设计/计划与本计划冲突时以本计划为准；旧实施计划任务 13 内容作废。
