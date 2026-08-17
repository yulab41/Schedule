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
| `ManualScheduleCell`           | 空/班种/冲突/禁用/选中/撤销目标                                    | P1 PoC |

组件不得直接依赖业务 API。业务状态由 presentation-core 或 feature controller 映射为组件 props/events。
