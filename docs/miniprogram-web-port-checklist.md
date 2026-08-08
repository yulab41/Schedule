# 小程序 Web 移植清单

用途：逐项核对“Web 功能/修复 → 小程序实现 → 验证方式”。每一行打勾后才能宣称对应功能已移植；未打勾不得宣称完成。

| # | Web 模块/行为来源 | 小程序实现 | 验证方式 | 批次 | 状态 |
| --- | --- | --- | --- | --- | --- |
| 1 | 工作台导航与角色过滤（workbench-nav） | pages/workbench + utils/workbench-nav | 单测 + 模拟器 | A | ☑ |
| 2 | 登录/资料（微信扩展） | pages/login、register、profile | 模拟器登录 | A | ☑ |
| 3 | 日历月/周/列表 + 节假日 + 配色（轮次 58–61） | pages/calendar/* | 单测 + 模拟器 | A | ☑ |
| 4 | 访客扫码日历（微信扩展） | pages/guest | 模拟器 scene | A | ☑ |
| 5 | 群组管理（改名/改码/访客 key/解散恢复/退出/目录） | pages/group/groups | 模拟器流程 | A | ☑ |
| 6 | 成员/待认领/角色/转让/删除/邀请（微信扩展） | pages/group/members | 模拟器流程 | A | ☑ |
| 7 | 联系方式编辑确认（GroupContactForm） | pages/group/contact-edit | 模拟器流程 | A/C | ☑ |
| 8 | 排班配置（岗位成员+班种，无轮值；轮次 45） | pages/schedule/config | 模拟器流程 | A | ☑ |
| 9 | 手动排班绘制式编辑器（ManualGrid/Palette/撤销/清除/失效标记） | pages/schedule/manual | utils 单测 + 模拟器 | B | ☑ |
| 10 | 模板新建/编辑/删除/应用/预览/下一可用起始日 | pages/schedule/manual | utils 单测 + 模拟器 | B | ☑ |
| 11 | 草稿批次发布/删除、发布记录（当前/既往/归档）、重新发布/撤销 + 影响确认 | pages/schedule/manual | 模拟器流程 | B | ☑ |
| 12 | 版本冲突 409 弹窗与刷新（conflict-handler） | utils/conflict + 确认弹层 | 单测 + 模拟器 | B | ☑ |
| 13 | 排班补录（PastScheduleView 绘制 + 待确认 + 记录） | pages/schedule/backfill | 模拟器流程 | C | ☐ |
| 14 | 统计完整明细（汇总卡/成员/岗位/班种/计值班次/原实对照/重算） | pages/schedule/statistics | utils 单测 + 模拟器 | C | ☐ |
| 15 | 导出（任务轮询 + CSV 保存/分享/打开） | pages/schedule/export | 模拟器流程 | C | ☐ |
| 16 | 请假/换班/加扣班（表单/预览/我的申请/审批） | pages/requests/*、approvals | 既有流程复核 | A | ☑ |
| 17 | 事件时间线 + 访客访问记录 | pages/events | 既有流程复核 | A | ☑ |
| 18 | 通知列表/未读/已读 + 提醒设置 + 订阅（微信扩展） | pages/notifications/* | 既有流程复核 | A | ☑ |
| 19 | 平台运维：任务列表 | pages/platform/jobs | 模拟器流程 | D | ☐ |
| 20 | 平台运维：备份列表（仅列表） | pages/platform/backups | 模拟器流程 | D | ☐ |
| 21 | 平台运维：群组恢复 | pages/platform/backups | 模拟器流程 | D | ☐ |
| 22 | 平台运维：用户状态 | pages/platform/users | 模拟器流程 | D | ☐ |
| 23 | 平台运维：节假日导入/版本/覆盖（import-preview/import/versions/confirm/coverage） | pages/platform/holidays | 模拟器流程 | D | ☐ |
| 24 | 平台管理员入口（GET /platform/me） | profile/workbench 条件入口 | 集成测试 + 模拟器 | D | ☐ |
| 25 | Web 逻辑单测等价移植（calendar/manual/statistics/workflow/swap/duty/leave/events/export/roster/notifications） | apps/miniprogram/utils/*.spec.ts | vitest | A–E | ☐ |
| 26 | 模拟器逐页截图冒烟 | scripts/miniprogram-smoke.mjs 全页面 | 冒烟脚本 | E | ☐ |

说明：微信扩展（登录/邀请/扫码/订阅）不在此清单中作为“Web 对照项”，但它们必须与既有后端集成测试一致。
