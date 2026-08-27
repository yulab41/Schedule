# 小程序顶部通知 Sheet 设计规格

## 目标

将工作台顶部铃铛从占位提示改为当前群组通知弹层。信息层级、文案和卡片状态复刻 Web `NotificationBell` + `ResponsiveSheet` + `NotificationCenterPanel`，小程序额外提供标题区下滑关闭。

## 已确认决策

- 顶部铃铛只展示当前 `currentGroupId` 的通知；“更多 → 通知中心”独立页继续保留。
- 无当前群组时不打开 Sheet，显示工作台现有错误提示。
- 下滑仅由把手与标题区识别，通知列表仍由原生 `scroll-view` 独占纵向滚动。
- 关闭始终有两个单指替代：“完成”和遮罩点按。
- 不引入第三方 UI 库，颜色、字号、圆角、间距和动效使用现有 `@schedule/ui-tokens` 语义令牌。

## 组件与数据流

- 新增无业务 API 依赖的 `UiSheet`：受控 `visible`、`title`、`closeLabel`、`swipeDismiss`，通过 `close { source }` 报告 `button | backdrop | swipe`，默认 slot 承载业务内容。
- 现有 `notifications-panel` 增加 `embedded` 呈现模式，复用同一控制器的加载、分页、已读、全部已读、能力开关、错误和陈旧请求保护。
- 工作台以 `requiredComponents + componentPlaceholder` 异步嵌入通知组件；构建器必须恢复可达的 `notifications-panel/index.js`，同时继续把 controller 只打入 Page/组件 bundle，不重建已修复的薄 Page 壳。
- 嵌入模式通过 `unreadchanged { unreadCount }` 同步顶部红点。Sheet 关闭时卸载通知面板，通知正文不写工作台状态、缓存或日志。
- 工作台在首次群组数据 ready、群组切换和前台恢复时刷新未读数，前台每 60 秒轮询；网络错误保留同群组最后值，能力关闭清零。

## 群组未读接口

- `GET /notifications/unread-count` 增加可选 `groupId` 查询参数；无参数仍返回 Web 使用的全账号未读数。
- `P9InsightsActionsClient.unreadCount(groupId?)` 保留无参调用并为群组 ID 做 URI 编码。
- `GET /notifications?groupId=...` 的 `unreadCount` 改为同一群组筛选下的未读总数；无 `groupId` 时语义不变。
- 无 schema 迁移；旧 Web/小程序客户端的无参请求继续兼容。

## 视觉与手势

- Sheet 全宽，顶部 22px 圆角，高度 `min(78vh, 660px)`，底部包含 safe-area；遮罩使用 32% 深蓝灰并以 2px blur 渐进增强背景分离。
- 头部保留 38×5px 把手、“通知中心”和 44px 触控面的“完成”。
- 未读卡使用浅蓝背景、蓝色边框和左侧 3px 状态线；已读卡保持白色。整卡点按标记已读。
- WXS 在视图层直接 `setStyle` 更新 `transform/opacity`，不在 `touchmove` 中 `setData`。下移 ≥96px，或下移 ≥28px 且速度 ≥0.65px/ms 时关闭；其他移动回弹。
- 横向、向上、未达 8px 的位移不启动关闭手势。动效仅使用 transform/opacity，并为减少动态禁用过渡。

## 状态与验收

- 覆盖 ready/loading/empty/error/disabled、首页与加载更多、单条与全部已读、群组切换、后台/销毁和陈旧响应。
- Storybook 以生产 `HomeView` 和通知组件生成 390×844、320×844 和大字号黄金；用户所附 Web 截图已确认设计意图。
- 自动验证不代替微信实体 Android 的红点、滚动、回弹、下滑、完成和遮罩关闭验收。
