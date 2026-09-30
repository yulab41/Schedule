# 点击一条「已读」后其它「已读」按钮闪烁（2026-09-30）

## 现象与范围

- 用户报告：通知中心里点一条通知的「已读」按钮后，**其它**「已读」按钮也会闪一下（浅蓝/浅灰填充快速闪过）。
- 范围：仅小程序通知面板模板 + 回归测试 + 文档；控制器状态机、契约、API、数据库未改，无迁移。

## 定位与引入点

- 引入点 1（原始过度禁用）：`git log -S"disabled=\"{{actionBusyId !== '" -- apps/miniprogram/.../notifications-panel/index.wxml`
  指向 `1a428d73`（2026-08-26 通知中心首版）把独立通知页每行「已读」的 `disabled` 绑到“**任意**操作进行中”
  （`actionBusyId !== ''`），`304d742f`（2026-08-27 嵌入通知 Sheet）沿用同一写法。
- 引入点 2（本轮前一次修复写反）：`939c1d5f`（2026-09-30 上一轮，本会话）按用户“允许按压反馈”的指示改写时，
  写成 `disabled="{{actionBusyId !== '' && actionBusyId !== item.id}}"`。它对“其它行”仍求值为真：
  只有**正在保存的那一行**被排除在禁用之外，其余所有行照旧被禁用——方向正好写反，所以报告的现象没有消失。
- 机制：`ui-button` 的外观是 `class="... {{disabled || loading ? 'is-inactive' : ''}}"`，
  `.is-inactive` 把按钮从“白底 + 浅蓝描边（`--ui-color-primary-border: #b9d8ff`）”改成
  “浅灰填充（`--ui-color-surface-muted: #f8fafc`）+ 弱化文字 + `opacity: .72`”。
  因此任何一条通知的已读请求都会让**其余每一条**的「已读」按钮在整段往返时间里换成这套配色再恢复，
  就是用户看到的“填充快速闪过”。窗口长度等于一次 `markNotificationRead` 往返。

## 修复

- `index.wxml` 独立通知页每行「已读」：`disabled="{{actionBusyId === item.id}}"`，与同一按钮的
  `loading="{{actionBusyId === item.id}}"` 完全对齐——只有正在保存的那一行进入 `is-inactive`（并显示转圈），
  其它行保持正常外观与按压反馈。
- 语义审计：只改模板绑定，未改方法、请求、计数或事件。控制器仍保留
  `if (page.data.actionBusyId.length > 0) return;` 并发守卫，因此在别人的请求窗口里点另一行依旧不会发起第二次请求，
  只是现在按下去有即时反馈（这正是用户上一轮选定的“允许按压反馈”）。
- 复查同一文件里所有 `actionBusyId` 引用：Sheet 的「全部已读」（`=== 'all'`）、列表页的「全部标为已读」
  （`disabled`/`loading` 均 `=== 'all'`）、卡片与按钮的 `hover-class`（固定 `is-pressed`）都已只由自身操作驱动；
  仅剩 `aria-disabled="{{actionBusyId !== ''}}"` 仍按“任意操作”判断，它不产生任何视觉变化，保留以反映点击会被吞掉的事实。

## 验证

- 回归先红后绿：`apps/miniprogram/scripts/notifications-controller.test.mjs` 的
  `keeps press feedback on every notification control and only the busy row inactive` 更新为断言
  `disabled="{{actionBusyId === item.id}}"` 且该按钮绑定里不得再出现 `actionBusyId !== ''`。
  修复前运行：`1 failed | 34 passed`；修复后 `35 passed`。
- `pnpm miniprogram:test` 1308 通过 / 23 跳过；`pnpm typecheck`、`pnpm lint`、`pnpm format:check` 通过；
  `pnpm miniprogram:verify`（production）通过：包体 4,446,633 B、矩阵节点 1,513、
  manifest `d2036fe16a557f6f55a2d004950bccf4fe0c9121fb9ab2a880d0e8e3043fc34a`。
- `pnpm smoke:check-core` 判定未涉及核心链路文件，未运行 `pnpm smoke:browser`。
- 证据分层：静态模板契约 + Node 控制器测试 + production 构建已验证；开发者工具与小米 14 真机未在本轮运行，
  闪烁是否消失仍需同构建真机复核。

## 交付边界

- 未部署生产、未改契约/API/数据库；Mini/文档范围检查点，不具备触发生产部署或备份的条件。
- 体验版上传与只增放行按用户当次授权执行，记录见下节。

## 体验版交付与放行（2026-09-30，用户当次授权）

- 候选：独占 warm 槽位 `runtime/wt/general-6`（REUSE_ONLY，无安装）冻结最终 clean SHA
  `025eef769c71fa70d8e0e682d8ce34c142ea16fe`（`prepare-release-worktree.mjs --purpose upload` →
  `check-worktree-safety.ps1 -RequireReady` 输出 `STATE=ready-clean-detached`、`RESULT=PASS`）。
- 上传：先 `pnpm miniprogram:ci:dry-run`（production、manifest `b17b6279…`），再用仓库外上传私钥执行
  `pnpm miniprogram:upload-experience`（Node `miniprogram-ci`，未使用开发者工具）。版本由 helper 动态分配为
  `0.1.0-p10.20260930.222`，描述“修复点击一条已读后其它已读按钮闪烁 025eef7”，profile `production`，
  上传 manifest `de82259b1a1455ddb4f3ef8e8de6cf111037ef55190d1463e7530e41ed5902f3`，不可变轻量 tag
  `miniprogram-trial/0.1.0-p10.20260930.222`（远端已确认指向同一 SHA），receipt 见 ignored
  `runtime/audit/miniprogram-trials/0.1.0-p10.20260930.222.json`；上传日志中 AppID 为 `[REDACTED]`。
- 放行（只增）：`schedule-client-version-allowlist ensure 0.1.0-p10.20260930.222` 追加 1 个版本，
  `.218`–`.221` 原样保留；重复执行返回“请求的版本已存在并通过验证；未重建容器。”（幂等、exit 0）。
  随后 `schedule-client-version-allowlist verify` 与完整 `ecs-verify.sh`（`ECS_PUBLIC_IP=120.77.220.79`）
  均通过（退出码 0，输出含 `[verify] release=5f25d946…` 与 `[verify] complete`）。
- 生产身份：放行前后 live release 均为 `5f25d9469a6da6e88da9a244e048b0251f01b864`（schema 69）；
  本检查点为 Mini/文档范围，未部署应用、未同步 release 元数据、未创建数据库备份、未执行迁移。
  放行前的白名单控制/verifier 哈希与两次校验结果记录在 ignored
  `runtime/audit/notification-read-button-flicker-20260930/allowlist-result.json`。
- 未提交审核、未撤回、未正式发布。证据分层：微信 CI 上传回执、可信放行控制、服务器 verifier 为已验证；
  小米 14 同构建体验版 `.222@025eef7` 仍待用户真机复核，模拟器/自动化不得替代。
