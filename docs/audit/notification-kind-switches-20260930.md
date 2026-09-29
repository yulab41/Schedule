# 通知设置只保留按类型微信提醒开关（2026-09-30）

## 范围与决定

- 用户要求：**去掉“接收微信提醒”总开关**，只保留 5 个独立开关；“打开某个开关时独立授权”。
- 早期讨论过的联动方案（总开关全开/全关、部分状态、三态中间态、3+2 两步授权）在本轮全部作废，未实现；微信仍要求每类订阅由用户点击触发且单次最多 3 个模板，因此按类授权是唯一不额外增加点击步骤的做法。
- 范围：仅微信小程序通知设置页与相关脚本/测试；契约、API、数据库、迁移均未改动（`wechatNotificationsEnabled` 字段保留以兼容旧客户端与历史数据）。

## 实现

- `notifications-panel/index.wxml`：删除总开关行（含 `handleToggle`、`busy` 绑定）与其说明；卡片改为“微信提醒授权 + 逐类开启说明”，保留 5 行按类型开关与底部授权说明（改为“互不影响 / 一次性模板可关闭后再开启重新授权”）。
- `notifications-panel/controller.ts`：移除总开关相关状态与处理器（`busy`、`enabled`、`handleToggle`、`toggleWechatMaster`）；按类型开关打开时先同步申请该模板的一次订阅，成功后 `PUT` **完整 5 类偏好 + `wechatNotificationsEnabled: true`**；关闭时只 `PUT` 完整 5 类偏好（不发微信请求、不改总闸）。
- 历史“总开关关闭”状态（`wechatNotificationsEnabled=false`）：行开关按“全部关闭”呈现；用户打开任一类时用完整偏好归一，只有该类变为开启，不会连带唤醒其它类。该逻辑由 `resolveNextKind` 单点实现。
- 开关绘制遵循既有 MINI-FEEDBACK-REGRESSION 契约：保存中的那一行只显示 `loading`，其它行不做全局变灰；仅“模板未配置”的行永久禁用（脚本守卫已同步）。
- `notifications-panel/index.wxss`：删除只服务总开关行的 `.settings-row/.settings-copy` 规则。

## 验证

- `notifications-controller.test.mjs` 30 项通过：5 类独立开关、逐类申请模板、关闭只写偏好、拒绝/不可用/被过滤/未配置分支、保存失败可重试、账号切换丢弃旧授权，以及新增“历史总开关关闭归一后只开启所点类型且总开关字段不再出现于页面数据”。
- `workflow-switch-feedback.test.mjs` 23 项通过（开关保存中 loading、未配置才永久禁用，无全页变灰）。
- `pnpm miniprogram:test` 1303 通过 / 23 跳过；`pnpm typecheck`、`pnpm lint`、`pnpm format:check`、`pnpm miniprogram:verify`（production、包体 4,440,213 B、矩阵节点 1,513、manifest `1d102623…`）通过；`pnpm smoke:check-core` 判定未涉及核心链路文件。
- 证据分层：静态/Node/几何与生产构建已验证；小米 14 同构建体验版未验证（本轮未上传/未放行）。

## 交付边界

- 本检查点只改 `apps/miniprogram/**` 与文档，属 Mini/文档范围：不触发生产部署、数据库备份或 release 元数据同步。
- 2026-09-30 用户当次授权后完成体验版上传 + 追加放行，见下节。

## 体验版交付（2026-09-30，用户授权）

- 应用检查点 `8ec20dd2`（`fix(miniprogram): keep only per-kind WeChat reminder switches`）已 fast-forward 推送 `origin/main`；候选在独占 warm 槽位冻结（`prepare-release-worktree` + `check-worktree-safety` 均 PASS）。
- 体验版 `0.1.0-p10.20260930.218`（描述“通知设置只保留按类型微信提醒开关 8ec20dd”、production、manifest `b89fbd28d8eed0e734649b96370a90cf8f5bdf7bfaa5b0889d3eb5c210caad1e`、不可变 tag `miniprogram-trial/0.1.0-p10.20260930.218`、receipt 见 ignored `runtime/audit/miniprogram-trials/0.1.0-p10.20260930.218.json`）上传成功。
- 放行：可信控制 `schedule-client-version-allowlist ensure 0.1.0-p10.20260930.218` 只增追加并通过健康与策略验证；`verify` 再次通过；随后完整 `ecs-verify.sh` 通过。
- 首次完整 verifier 失败于遥测保留检查（30 天边界竞态：9→1 条记录刚跨过 30 天、下一次 15 分钟 cron 尚未清理）。执行已安装的 `schedule-privacy-retention.sh` 一次（与 cron 相同操作，本次 `telemetryDeletedRows=1`，不涉及业务数据）后计数归 0，verifier 完整通过。
- 本检查点为 Mini/文档范围：**未**触发生产部署、数据库备份或 release 元数据同步；生产 live release 仍为 `5f25d946`（schema 69）。
- 证据分层：微信 CI 上传回执、可信放行控制、服务器 verifier 均为已验证；小米 14 同构建体验版仍需用户真机复核。
