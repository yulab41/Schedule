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
- 有意保留、不属行为变化的部分：该控件的 `hover-class` 与 `aria-disabled` 仍按 `actionBusyId !== ''`。点击被控制器
  守卫吞掉时读屏仍报“当前不可操作”，同时避免改成“看起来可点、按下才闪”的新闪烁。控制器 `if (actionBusyId.length > 0) return;`
  并发守卫、`markRead`/`markAllRead` 的请求、计数与 `unreadchanged` 事件全部未改。

## 验证

- 回归先红后绿：`apps/miniprogram/scripts/notifications-controller.test.mjs` 新增
  `keeps the read-all controls still while a single notification is being marked`。它在旧模板上失败（断言
  `actionBusyId === 'all'` 的样式/禁用绑定、且不得再出现 `actionBusyId !== ''`），同时驱动真实控制器在请求未返回时
  断言 `actionBusyId === 'notice-1'`（即“全部已读”控件此刻不应处于忙碌外观）；修复后 34 项通过。
- `pnpm miniprogram:test` 1307 通过 / 23 跳过（基线 1306 通过 / 23 跳过，+1 为新回归用例）。
- `pnpm typecheck`、`pnpm lint`、`pnpm format:check` 通过；`pnpm miniprogram:verify`（production）通过：
  包体 4,447,553 B、矩阵节点 1,513、manifest `4b5305f88c95e38565b0de5721609d1107d690089c15414085eee72c71d1f010`。
- `pnpm smoke:check-core` 输出“未涉及核心链路文件，无需浏览器冒烟记录”（本轮只改 `apps/miniprogram/**`），未运行 `pnpm smoke:browser`。
- 证据分层：静态模板契约 + Node 控制器测试 + production 构建已验证；开发者工具与小米 14 真机未在本轮运行，闪烁的视觉复核仍需真机。

## 未做与遗留

- 未上传体验版、未放行、未部署生产、未改契约/API/数据库；本轮为 Mini/文档范围检查点。
- 同一文件里每行的“已读”按钮仍是 `disabled="{{actionBusyId !== ''}}"`（独立通知页），点击其中一条会让其它行的
  “已读”按钮短暂变灰。它与本次报告同一个模式，但正确改法需要先决定“吞掉点击但不改外观”还是允许按压反馈；
  为避免引入新的按压闪烁，本轮未改，等用户确认后再单独处理。
