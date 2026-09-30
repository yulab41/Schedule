# 点击通知导致“全部已读”按钮闪烁（2026-09-30）

## 现象与范围

- 用户报告：在通知中心点击一条通知时，“全部已读”按钮会闪一下。
- 范围：仅微信小程序通知面板模板 + 回归测试 + 文档；控制器状态机、契约、API、数据库均未改动，无迁移。

## 定位与引入点

- `git log -S"actionBusyId !== '' ? 'is-disabled'" -- apps/miniprogram` 与
  `git log -S'notification-sheet-read-all {{actionBusyId' -- apps/miniprogram/.../notifications-panel/index.wxml`
  都只指向 `304d742f`（2026-08-27 `fix(miniprogram): open group notification sheet`），即把通知面板嵌入工作台 Sheet 的那次提交；`git show 304d742f -- .../index.wxml` 确认该绑定随嵌入视图首次写入。
- 根因：控制器用**一个**忙碌标记 `actionBusyId` 表示“有操作在进行”，点击单条通知时它被设成该条通知的 ID。
  “全部已读”控件把**可见的禁用样式**绑在 `actionBusyId !== ''`（任意操作）上，于是每一条通知的已读请求都会让这个按钮
  变灰再恢复：嵌入 Sheet 里是 `.notification-sheet-read-all.is-disabled{opacity:.5}` 的瞬变，独立通知页的
  `ui-button` 还带 `transition: opacity` 与 `is-inactive` 的配色变化，闪动更明显。窗口长度等于一次
  `markNotificationRead` 往返，快网络下就是一次典型的“闪烁”。
- 该绑定不受设计约束：`docs/superpowers/specs/2026-08-27-miniprogram-notification-sheet-design.md` 只要求覆盖
  “单条与全部已读”两个状态，没有定义“点击单条时全部已读应变成忙碌外观”。

## 修复

- `index.wxml` 嵌入 Sheet 的 `notification-sheet-read-all`：可见禁用样式改为只在该控件自己的操作进行中生效
  （`actionBusyId === 'all'`）。
- `index.wxml` 独立通知页的 `全部标为已读`：`disabled="{{actionBusyId === 'all'}}"`（其 `loading` 本来就是 `=== 'all'`）。
- 该控件的 `aria-disabled` 仍按 `actionBusyId !== ''`：点击被控制器守卫吞掉时读屏仍报“当前不可操作”。
  控制器 `if (actionBusyId.length > 0) return;` 并发守卫、`markRead`/`markAllRead` 的请求、计数与
  `unreadchanged` 事件全部未改。
- 追加（用户当次指示“允许按压反馈”，处理同一文件里最后一个同类绑定）：独立通知页每行“已读”按钮的
  `disabled` 改为 `{{actionBusyId !== '' && actionBusyId !== item.id}}`，只有正在保存的那一行保持
  `loading="{{actionBusyId === item.id}}"`（`ui-button` 对 `disabled || loading` 都渲染 `is-inactive`），
  其它行不再被别人的请求变灰；嵌入 Sheet 的卡片 `hover-class` 与“全部已读”`hover-class` 从条件表达式改为固定
  `is-pressed`，按压反馈只由手指触摸驱动。重复点击仍由控制器守卫吞掉，不会产生第二次请求。
  取舍：`ui-button` 的 `aria-disabled` 由 `disabled || loading` 计算，因此在这段请求窗口内其它行会读作“可用”
  而点击无效果；这是“允许按压反馈”选定的方向，若以后要恢复严格无障碍语义，需要给 `ui-button` 增加“惰性但外观正常”的状态。

## 验证

- 回归先红后绿（两条用例都在旧模板上失败、修复后通过）：
  1. `keeps the read-all controls still while a single notification is being marked`：断言 `actionBusyId === 'all'`
     的样式/禁用绑定不得再出现 `actionBusyId !== ''`，并驱动真实控制器在请求未返回时断言 `actionBusyId === 'notice-1'`
     （即“全部已读”此刻不应处于忙碌外观）。首次落地时在旧模板上失败 → 修复后通过。
  2. `keeps press feedback on every notification control and only the busy row inactive`：断言模板不再存在
     `hover-class="{{actionBusyId…}}`，且行内“已读”按钮为 `disabled="{{actionBusyId !== '' && actionBusyId !== item.id}}"`。
     为验证它是真的回归守卫，本轮回退模板到 HEAD 复跑：`1 failed | 34 passed`，恢复后 `35 passed`。
- `pnpm miniprogram:test` 1308 通过 / 23 跳过（基线 1306 通过 / 23 跳过，+2 为新回归用例）。
- `pnpm typecheck`、`pnpm lint`、`pnpm format:check` 通过；`pnpm miniprogram:verify`（production）通过：
  包体 4,447,507 B、矩阵节点 1,513、manifest `91589cee652a55cc2b06f03dbf54ceeca770fe50eb93565075f0102a9d99ea7d`。
- `pnpm smoke:check-core` 输出“未涉及核心链路文件，无需浏览器冒烟记录”（本轮只改 `apps/miniprogram/**`），未运行 `pnpm smoke:browser`。
- 证据分层：静态模板契约 + Node 控制器测试 + production 构建已验证；开发者工具与小米 14 真机未在本轮运行，闪烁的视觉复核仍需真机。

## 交付边界

- 未部署生产、未改契约/API/数据库；本轮为 Mini/文档范围检查点，不具备触发生产部署或数据库备份的条件。
- 体验版上传与只增放行按用户当次授权执行，记录见下节。
