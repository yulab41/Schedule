# 自绘组件清单

第三方 UI 组件库为零。以下状态必须在 Storybook 黄金和原生组件测试中一一覆盖。

| 组件                           | 必备状态/语义                                                      | 首阶段 |
| ------------------------------ | ------------------------------------------------------------------ | ------ |
| `UiButton`                     | primary/secondary/danger；normal/pressed/focus/disabled/loading    | P1 PoC |
| `UiSwitch`                     | on/off；pressed/focus/disabled/loading；`aria-role`/`aria-checked` | P1 PoC |
| `UiCheckbox` / `UiRadio`       | 选中、部分选中、禁用、错误                                         | P4/P5  |
| `UiInputShell`                 | label/help/error/required/disabled/focus                           | P3     |
| `UiPicker`                     | month/date/time/option；Sheet/邻近浮层语义                         | P4/P5  |
| `UiTextarea`                   | 字数、错误、键盘、安全区                                           | P5     |
| `UiAlert` / `UiChip`           | info/success/warning/error；班次/节假日/变更                       | P1/P4  |
| `UiLoading`                    | 页面、区块、按钮；减少动态                                         | P1     |
| `UiDialog` / `UiConfirm`       | 焦点、危险确认、取消、处理中                                       | P3/P5  |
| `UiSheet`                      | 安全区、键盘、拖动/关闭、长内容滚动                                | P1/P3  |
| `UiNavigationBar` / `UiTabBar` | safe area、当前项、badge、禁用入口                                 | P4     |
| `CalendarCell`                 | 跨月/今天/选中/历史/节假日/班次/变更/补录                          | P1 PoC |
| `CalendarMonth`                | 42 格/三面板/方向锁/阈值/速度/回弹/定位今天                        | P1 PoC |
| `ManualScheduleCell`           | 空/班种/冲突/禁用/选中/撤销目标                                    | P1 PoC |

组件不得直接依赖业务 API。业务状态由 presentation-core 或 feature controller 映射为组件 props/events。

## P1 原生实现状态（2026-08-18）

- 已实现 Web 黄金稿直接覆盖的 `UiButton`、`UiSwitch`、`UiCheckbox`、`UiRadio`、`UiInputShell`、`UiPicker`、`UiAlert`、`UiChip`，以及按钮复用的 `UiLoading`。
- `UiSwitch` 固定为 52×30px 可见本体和 60×44px 触控层；开、关、禁用、加载由受控属性驱动，禁用/加载态不会发出变更事件。
- 颜色、字号、间距、圆角、阴影和触控尺寸由 `@schedule/ui-tokens/tokens.ts` 同时生成 `tokens.css` 与 `tokens.wxss`；小程序构建只复制生成物，不维护第二套令牌值。
- 已实现 `CalendarCell` 与 `CalendarMonth`：固定三面板各 42 格，跨月/今天/选中/周末/节假日/人员/加换状态独立；方形日期格由 18px 外框统一裁切，下方详情为独立表面并保持 12px 间距。
- 月历横向手势在 UI 线程执行方向锁、56px 距离或 600px/s 速度结算、180ms 回弹与 240ms 翻页；结算后只向逻辑层发送一次月份变化事件，滚动过程中不调用 `setData`。
- 已实现 `ManualScheduleCell` 与矩阵 PoC：`pages/manual-matrix-poc/index?mode=daily|maximum` 分别生成 7×7 和 20×30 确定性数据；单一 Skyline 双轴 `scroll-view` 承载主体，日期与人员覆盖层由 5 个 Worklet 在 UI 线程同步，滚动期间不调用 `setData`。
- 班种选择只更新前一选中格和目标格的数据路径；撤销栈只保存 `{key,before,after}` 增量。20 行使用 `type=list` 按视口绘制直接子行，不依赖最低基础库 3.0.2 尚不可用的 `list-builder` 节点回收。
- 已通过属性/事件单测、`miniprogram-simulate` 组件树与事件烟测、源码边界、包体和确定性构建。Storybook/simulate 仍不等价于微信运行时，基础控件、月历和矩阵的原生视觉状态均保持“已实现待用户实体 Android 人工复核”。
- `UiSheet`、`UiDialog`、`UiConfirm`、导航与业务组件尚未实现；必须等待其对应黄金状态确认，不从本批次外推样式。
