# 小程序六项修复 + 按类型微信提醒 + 体验版交付（2026-09-29）

## 范围与基线

- 用户一次提出六项：①5 月 1 日请假误报 4 月 29 日排班冲突；②手动排班「周期天数」选择器对齐换班年月选择器；③删除管理员弹窗“直接生效…”胶囊；④通知设置改为 5 个可独立开关的微信提醒授权（保留总开关）；⑤事件时间轴中文标识；⑥我的页「登录密码」与「修改登录密码」水平居中对齐，并追加“胶囊四周等宽窄内边距”。
- 范围：仅微信小程序视觉/交互 + 必要的共享包与 API 改动；不改 Web 视觉。
- 基线：`origin/main` = `9b13dc8e`；独占 warm 槽位 `runtime/wt/general-6`，分支 `codex/mini-six-fixes-20260929`；`DEPENDENCY_MODE=REUSE_ONLY`，未安装依赖；`.env` 以硬链接方式接入工作树（不入库）。

## 实现与根因

1. **请假日期边界（真 Bug）**：`getChinaStandardTimeBusinessDate()` 带中国标准时间 08:00 交班规则，被用来解释**请假自身的日历边界**（`parseChinaDateStart` 存的是 CST 00:00）。请假 2027-05-01~05-06 因此被读成业务日 04-30~05-05：派生窗口起点 `2027-04-30T00:00+08`(=04-29T16:00Z) 覆盖 04-29 全天班（04-29 08:00→04-30 08:00）尾部而误报，终点又少一天使 05-06 班次漏检。引入点：`52e4b7e2` 新增的原始区间分支（叠加 `6452fa92` 起的业务日换算）。
   - `packages/scheduling-domain/src/leave/overlap.ts`：全天请假自身起止改用 `getChinaStandardTimeCalendarDate`（日历日），班次侧仍按业务日，保留原始区间兜底。
   - 同口径修正：`leave-availability.ts`（`leaveIntersectsDateRange`）、`leave-assignment-service.ts`（审批预览 SQL 与月份窗口，下界保留业务日以覆盖跨夜顺延）、`leave-service.ts` 撤销守卫（改用 `isLeaveStartBeforeChinaToday`）、`apply-service.ts` 冲突文案日期。
   - 结果：5/1 起的整天请假不再命中 4/29 班次；跨夜顺延到 05-01 08:00 的 04-30 班次仍判冲突（沿用既有语义与既有测试）。
2. **周期天数选择器**：抽出共享外观 `apps/miniprogram/src/styles/picker-sheet.wxss`（中间选中横杠、上下渐隐遮罩、底部取消/完成按钮行），由 `ui-date-picker`（换班年月选择器）与手动排班周期天数弹层共同 `@import`；保留 `ui-sheet` + `ui-wheel-column`，仅替换动作行与新增滚轮外框；该滚轮数值字号 24px→30px（WXS 比例后约 19→23.8px），`font-size` 仅作用于周期天数滚轮。
3. **删除胶囊**：移除 `workflow-swap-panel` 与 `workflow-duty-panel` 管理员弹层中的“直接生效…”提示节点；同弹层其余说明与校验不变。
4. **微信提醒按类型**：`wechatNotificationKinds`（5 类）进入契约、设备存储与 UI。
   - 契约：`wechatNotificationKindsSchema` + 默认全开 + `WechatNotificationKindsPatch`（局部更新）；响应对老客户端兼容（缺失视为全开）。
   - 数据：迁移 `0069_member_wechat_notification_kinds.sql` 增列 `notification_preferences.wechat_notification_kinds`（json NULL=全开，无需回填），同步 `_journal.json`、`packages/database` schema、`ecs-schema-compatibility`（68→69）与 `ecs-verify.sh` 的 69 段校验、`migrations.test.ts` 计数。
   - API：`notification-service` 读取/合并（只认显式 false）；`notification-writer.shouldDispatchWechat` 在解析出 kind 后按类型偏好决定是否入队微信投递（总开关校验保留为二道防线）；路由入参 `wechatNotificationKinds` 部分可选。
   - 客户端：`client-core` 的手写解码器加入该字段（校验 5 个布尔键，缺失回退全开；client-core 运行时不引入 contracts）；小程序通知设置页把“单个授权按钮 + 两批两步”改为 5 行独立开关（每行：中文名 + 本次授权结果），总开关只保存接收偏好，开关打开时只申请该类模板一次订阅，关闭时只保存偏好不发微信请求，模板未配置的行置灰显示“暂未配置”，20004 仍保留“打开微信设置”。
5. **事件时间轴中文**：`presentation-core/event` 新增 objectType 中文映射、影响说明（班次/成员分开）与 `describeEventSubject`；`insights-dashboard-panel` 的 detailLabel 不再显示 `leave_request`/`swap_request` 与“影响 N 项”，未知对象回退为事件类型标签。
6. **我的页胶囊**：详情行操作按钮（重试/解除绑定/修改登录密码）改为“透明按钮壳 + 单一胶囊”结构（`padding: 0; background: transparent; font-size/line-height: 0`），胶囊四周等宽窄内边距（390/320px：10px/7px，大字号同步放大），末行改为跟随内容高度，消除底边多余空白；行内左标签与胶囊在同一 flex 行居中。

## 验证（分层）

- **先红后绿**：`overlap.test.ts` 新增“all-day leave boundary as China calendar date”用例先在旧实现上失败（expected false, received true），改后通过；`packages/scheduling-domain` 52 项通过。
- **真实 MySQL**：`pnpm test:api-integration`（leaves/swaps/duty-adjustments）88 项通过，含新增 `keeps a China calendar-date leave on its own days when checking published conflicts`（affected-shifts 不再返回 04-29，移走跨夜顺延班次后 5/1 起请假可提交，覆盖 04-30 的请假仍命中 04-29）；`pnpm test:api-integration:manual-schedule` 37 项通过；`packages/database/tests/migrations.test.ts` 30 项通过（含 0069 应用与计数 69）；`wechat-notifications.integration.test.ts` 新增“只跳过被关闭类型”用例通过（值班提醒与请假通知仍入队，换班通知被跳过）。
- **既有失败（非本轮引入）**：`pnpm test:api-integration:task10` 中 `calendar.integration.test.ts > excludes drafts and replaced revisions from the calendar` 在 `52e4b7e2`/`9b13dc8e` 基线（本轮改动 `git stash` 后）同样失败：第二条 `savePublished('2026-08')` 在把时钟回拨到 2026-08-02 后命中 `草稿包含已过日期，不能替换既往排班。`（409），与本轮改动无关，未修改该测试。
- **Node 门禁**：`pnpm typecheck`、`pnpm lint`、`pnpm format:check`、`pnpm build`、`pnpm icon:parity:check`、`pnpm miniprogram:verify`（production 构建、包体 4,442,815 B、矩阵节点 1,513、manifest `d5927312…`）均通过；`pnpm miniprogram:test` 1304 通过/23 跳过；`pnpm test`（根 guard + Vitest）1356 通过/468 跳过。
- **几何代理（非原生验收）**：`profile-identity-layout.test.mjs` 在 390/320px × 普通/大字号下测得「登录密码」文字中心与胶囊中心偏差 ≤0.01px、右边缘与上方行右列偏差 0px、胶囊四边内边距完全一致；`picker-sheet` 探针确认底部按钮 flex 比 1.345、横杠与滚轮中心重合、周期天数数值字号 30px（约 23.8px 渲染）。
- **运行/浏览器验证**：`pnpm smoke:browser` 通过（登录/管理员/成员/访客 vkey/访问记录 7 个阶段，浏览器错误 0）。本地开发库已迁移到 schema 69；仅本地合成 `local-admin` 临时设为平台管理员以匹配冒烟前置，跑完立即恢复为 0；未接触生产。
- **证据分层**：静态检查 / Node / 本地真实 MySQL / Edge 浏览器代理 / 本地开发库均已验证；微信开发者工具与小米 14 同构建真机未在本轮取得证据。

## 发布边界

- 本轮用户明确授权“完成后直接上传并放行”，按 L3 体验版上传 + 追加放行执行；生产部署（L4）授权同批给出，按 runbook 备份 → 部署（含 0069 迁移）→ 验证。
- 未提交审核、未正式发布；真机验收证据仍需用户在小米 14 体验版同构建下确认。

## 生产交付（2026-09-29，用户授权 L4）

- 应用检查点 `5f25d946`（`fix(miniprogram): fix leave date boundary and deliver six mini fixes`）已按 fast-forward 推送 `origin/main`。
- 动态基线：操作前实时读取线上 `current-release` = `c59975c4…` 作为回滚候选（`git merge-base --is-ancestor` 验证为候选祖先）；未使用任何状态文档中的历史值。
- 生产备份（可信控制 `/usr/local/lib/schedule/schedule-backup.sh`，部署前）：归档 `49236b11-b57e-4994-bca2-5a7b7ce2edec`，56 表 / 139,505,928 B / sha256 `5ee00d5a791b91542a42891d1f37e38d6eba6461484ec4f4d65cdd9b69773f16`。
- 部署：本地 `pnpm ecs:package`（`databaseSchemaMin/Max=69`、rollback candidate `c59975c4…`）产生 `schedule-dist.tar.gz`(1,460,586 B)、`api-flat.tar.zst`(6,104,138 B)、`deploy-manifest.json`，连同同 commit 的 `ecs-update.sh`/`ecs-verify.sh` 上传到服务器临时目录；归一 LF、`bash -n` 通过后执行 `ecs-update.sh` → `发布成功：5f25d946…`（迁移 69 应用、api/web 容器重建、api 就绪探针通过）；独立 `ecs-verify.sh` 通过（含新增 69 段 `notification_preferences.wechat_notification_kinds` 校验、产物哈希、容器、迁移计数 69）。部署后回读 `current-release=5f25d946…`、`databaseSchemaMax=69`、公网 `https://hosp.schedule.eylinhome.top/api/health` 返回 `ready:true`。
- 体验版：独占上传 lease 下动态分配 `0.1.0-p10.20260929.217`（描述含短 SHA `5f25d94`，production，manifest `8a432f758cda56b8e1b785d0c1e4a90c15afd42b72242aadcd8b6a77bacdfa62`，不可变 tag `miniprogram-trial/0.1.0-p10.20260929.217`，receipt 见 ignored `runtime/audit/miniprogram-trials/0.1.0-p10.20260929.217.json`），上传成功；随后可信控制 `schedule-client-version-allowlist ensure` 只增放行该版本并通过健康与策略验证，`verify` 再次通过，放行后完整 `ecs-verify.sh` 通过。
- 证据分层：服务器只读 SQL、部署脚本输出、独立 verifier、微信 CI 上传均为已验证；小米 14 同构建体验版、iOS 与其他安卓仍未验证。
