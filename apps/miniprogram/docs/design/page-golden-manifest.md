# 页面黄金清单

本清单是 `小程序页面 → Storybook story ID → fixture → 状态 → 用户人工原生验收` 的唯一映射。P1 先盘点现有 Storybook，再填写真实 story ID；禁止猜测或创建第二套视觉真源。

| 阶段 | 小程序页面/组件                                                                                                | Storybook story ID                                                                                                                                                                                                                                                                                                                    | Fixture/状态                                                                                                                                     | 390 黄金         | 320 边界             | 用户 Android 原生 | 用户确认                                  |
| ---- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- | -------------------- | ----------------- | ----------------------------------------- |
| P1   | 基础控件画廊                                                                                                   | `miniprogram-parity-p1-foundation--controls-390` / `--controls-320`                                                                                                                                                                                                                                                                   | 按钮/开关/选择/字段/反馈                                                                                                                         | 已截图           | 已截图               | 待人工测试        | 已通过 Web 黄金                           |
| P1   | 动态月历 PoC                                                                                                   | `miniprogram-parity-p1-calendar--month-390` / `--month-320`                                                                                                                                                                                                                                                                           | `pages/calendar-poc/index`；5/6 周/今天/选择/底角/跨月/变更                                                                                      | 已更新           | 已更新               | 待人工复测        | 已对齐当前 Web                            |
| P1   | 7×7 矩阵 PoC                                                                                                   | `miniprogram-parity-p1-manual-matrix--daily-390` / `--daily-320`                                                                                                                                                                                                                                                                      | `pages/manual-matrix-poc/index?mode=daily`；日常数据/冻结/滚动/单格更新                                                                          | 已截图           | 已截图               | 待人工测试        | 已通过 Web 黄金                           |
| P1   | 20×30 矩阵 PoC                                                                                                 | `miniprogram-parity-p1-manual-matrix--maximum-390` / `--maximum-320`                                                                                                                                                                                                                                                                  | `pages/manual-matrix-poc/index?mode=maximum`；最大数据/失效/撤销/滚动                                                                            | 已截图           | 已截图               | 待人工测试        | 已通过 Web 黄金                           |
| P3   | `pages/identity/index` 账号密码登录/微信快捷登录/密码绑定/建档；`pages/admin-bind/preview` 管理员绑定；`pages/identity/unbind` 解绑 | `miniprogram-parity-p3-identity-security--mini-login-390` / `--mini-login-320` / `--mini-link-password` / `--mini-register-profile` / `--mini-admin-link-preview` / `--mini-admin-link-confirm` / `--mini-unbind-confirm` / `--mini-unbind-confirm-320`                                                                               | Web 同源账号密码表单、微信已绑定成员快捷登录、`link_required`、既有账号、首次真实姓名、脱敏 ticket preview、fresh code confirm、authenticated、当前 AppID 解绑确认                             | 已确认           | 已确认               | 待人工测试        | Web 黄金已确认；账号密码与微信快捷登录已同步到原生页                            |
| P4   | 工作台/月/周/列表/详情                                                                                         | `miniprogram-parity-p4-workbench--ready-390` / `--ready-320` / `--filter-open-390` / `--week-390` / `--list-390` / `--empty` / `--loading` / `--error` / `--offline`                                                                                                                                                                  | 已认证群组工作台；月/周/列表；定位到今天；筛选展开；选中日期详情；联系方式同意边界；空、加载、错误、离线缓存状态                                 | Web 已确认       | Web 已确认           | 待人工测试        | Web 黄金已确认；原生待验收                |
| P5   | 手排/预览应用/草稿发布/版本/补录/群组设置中的联系方式同意                                                      | `miniprogram-parity-p5-scheduling-closure--editor-390` / `--editor-320` / `--maximum-390` / `--preview-390` / `--risk-blocked-390` / `--release-390` / `--release-blocked-390` / `--release-withdraw-390` / `--release-republish-390` / `--release-delete-390` / `--release-republish-320` / `--backfill-390` / `--phone-consent-390` | 20/30/600、30 天区间、风险确认、Web 同构草稿/发布历史、覆盖冲突/撤回/重发/删除确认、Web 同构排班补录、群组设置中的手机号同意                     | 390 全部已确认   | 320 全部已确认       | 待人工测试        | Web 黄金全部已确认                        |
| P7   | `subpackages/workflows` 请假/换班/加扣班/审批与撤销                                                            | `miniprogram-parity-p7-workflow-parity--*`；20 个精确 ID 见下方                                                                                                                                                                                                                                                                       | 真实 `HomeView` + production panels；成员/管理员；mine/review；form/preview/conflict/confirm；两组完整状态；direct/settings；empty/error/loading | 390 全状态已固化 | 320 边界已固化       | 待人工测试        | 用户已固定1:1 Web手机版；浏览器自检已通过 |
| P8-B | `subpackage-organization` 群组/成员/配置/邀请访客/平台账号                                                     | `miniprogram-parity-p8-organization-parity--*`；34 个精确 ID 见下方                                                                                                                                                                                                                                                                   | production panels；群主/管理员/成员/后台/平台管理员；ready/loading/empty/error/conflict/confirm/success/disabled；大字号                         | 390 全状态已固化 | 320/大字号边界已固化 | 待人工测试        | 待用户确认后进入原生页面                  |
| P9-A2 | `subpackage-insights` 访客访问日志/月份聚合只读页                                                             | `miniprogram-parity-p9-visitor-access--ready-390` / `--ready-320` / `--large-text-390` / `--loading` / `--empty` / `--error-state` / `--insights-disabled`                                                                                                                                    | 访问脉搏聚合、最近访问记录、隐私脱敏、加载/空/失败/能力关闭；原生 `subpackages/insights/pages/visitor-access/index` 已实现                                                                 | 黄金已固化       | 黄金已固化          | 待人工测试       | 用户已确认 Web 黄金；原生体验版待实体机验收 |
| P9-A4 | Web 数据与消息黄金（事件/统计/通知/导出）                                                                 | `miniprogram-parity-p9-insights-suite--events-ready-390` / `--statistics-ready-390` / `--notifications-ready-390` / `--export-ready-390` / `--events-boundary-320` / `--large-text-390` / `--loading` / `--empty` / `--error-state` / `--disabled-member` | 值班台账视觉方向；事件时间线、统计摘要、通知中心、导出安全说明；原生分包页面待用户确认后实现                                                                 | Web 黄金已固化 | Web 黄金已固化      | 待人工测试       | 待用户视觉确认；不打开生产 `insights` |
| P9-A5 | `client-core` 事件时间线与排班统计只读边界                                                               | 原生页面待实现；对照 P9-A4 `events-ready-390` / `statistics-ready-390`                                                                                                                                    | 事件列表/详情、按月/按年统计；严格 decoder、Bearer、URI 编码；原生分包页面待实现                                                                 | Web 黄金已固化 | Web 黄金已固化      | 待人工测试       | 共享边界已完成；待原生页面与实体机验收 |
| P9-A6 | Mini runtime 事件/统计 transport bridge                                                                    | 原生页面待实现；复用 P9-A5 `InsightsReadClient`                                                                                                                                                | `insights` capability resolver、Bearer 单飞会话恢复、平台 transport；不读取业务数据                                                                 | Web 黄金已固化 | Web 黄金已固化      | 待人工测试       | runtime bridge 已完成；待原生页面与实体机验收 |
| P10  | 院内通讯录                                                                                                     | 待最终阶段盘点                                                                                                                                                                                                                                                                                                                        | 搜索/七级筛选/权限/号码展示                                                                                                                      | 待生成           | 待生成               | 待人工测试        | 待确认                                    |

P7-B 精确 Storybook ID：

- `miniprogram-parity-p7-workflow-parity--leave-member-390`
- `miniprogram-parity-p7-workflow-parity--leave-create-390`
- `miniprogram-parity-p7-workflow-parity--leave-approval-conflict-390`
- `miniprogram-parity-p7-workflow-parity--leave-empty-320`
- `miniprogram-parity-p7-workflow-parity--leave-error-320`
- `miniprogram-parity-p7-workflow-parity--leave-loading-320`
- `miniprogram-parity-p7-workflow-parity--swap-member-states-390`
- `miniprogram-parity-p7-workflow-parity--swap-create-preview-390`
- `miniprogram-parity-p7-workflow-parity--swap-admin-states-390`
- `miniprogram-parity-p7-workflow-parity--swap-direct-320`
- `miniprogram-parity-p7-workflow-parity--swap-empty-320`
- `miniprogram-parity-p7-workflow-parity--swap-error-320`
- `miniprogram-parity-p7-workflow-parity--swap-loading-320`
- `miniprogram-parity-p7-workflow-parity--duty-member-states-390`
- `miniprogram-parity-p7-workflow-parity--duty-create-conflict-390`
- `miniprogram-parity-p7-workflow-parity--duty-admin-states-390`
- `miniprogram-parity-p7-workflow-parity--duty-direct-320`
- `miniprogram-parity-p7-workflow-parity--duty-empty-320`
- `miniprogram-parity-p7-workflow-parity--duty-error-320`
- `miniprogram-parity-p7-workflow-parity--duty-loading-320`

P8-B 精确 Storybook ID：

- `miniprogram-parity-p8-organization-parity--group-owner-390`
- `miniprogram-parity-p8-organization-parity--group-administrator-390`
- `miniprogram-parity-p8-organization-parity--group-member-390`
- `miniprogram-parity-p8-organization-parity--group-dissolve-confirm-390`
- `miniprogram-parity-p8-organization-parity--group-conflict-320`
- `miniprogram-parity-p8-organization-parity--group-success-320`
- `miniprogram-parity-p8-organization-parity--group-loading-320`
- `miniprogram-parity-p8-organization-parity--group-error-320`
- `miniprogram-parity-p8-organization-parity--members-owner-390`
- `miniprogram-parity-p8-organization-parity--members-administrator-390`
- `miniprogram-parity-p8-organization-parity--members-member-390`
- `miniprogram-parity-p8-organization-parity--members-developer-claims-390`
- `miniprogram-parity-p8-organization-parity--members-manage-confirm-320`
- `miniprogram-parity-p8-organization-parity--members-empty-320`
- `miniprogram-parity-p8-organization-parity--members-success-320`
- `miniprogram-parity-p8-organization-parity--config-owner-390`
- `miniprogram-parity-p8-organization-parity--config-administrator-390`
- `miniprogram-parity-p8-organization-parity--config-conflict-320`
- `miniprogram-parity-p8-organization-parity--config-confirm-320`
- `miniprogram-parity-p8-organization-parity--config-empty-320`
- `miniprogram-parity-p8-organization-parity--config-loading-320`
- `miniprogram-parity-p8-organization-parity--config-disabled-member-320`
- `miniprogram-parity-p8-organization-parity--invite-visitor-owner-390`
- `miniprogram-parity-p8-organization-parity--invite-visitor-administrator-320`
- `miniprogram-parity-p8-organization-parity--invite-visitor-confirm-320`
- `miniprogram-parity-p8-organization-parity--invite-visitor-success-390`
- `miniprogram-parity-p8-organization-parity--invite-visitor-disabled-320`
- `miniprogram-parity-p8-organization-parity--platform-admin-390`
- `miniprogram-parity-p8-organization-parity--platform-assignment-320`
- `miniprogram-parity-p8-organization-parity--platform-link-success-390`
- `miniprogram-parity-p8-organization-parity--platform-conflict-320`
- `miniprogram-parity-p8-organization-parity--platform-empty-320`
- `miniprogram-parity-p8-organization-parity--platform-loading-320`
- `miniprogram-parity-p8-organization-parity--organization-large-text-390`

截图文件只放 `.artifacts/` 或外部 CI artifact，不进入 Git。清单记录 artifact ID、commit、fixture hash、设备、基础库和遮罩版本，不记录本地绝对截图路径。

P1 视觉意图和状态矩阵见 [`p1-visual-confirmation.md`](./p1-visual-confirmation.md)。以上 Storybook ID 是 Web 黄金源；后续原生截图不得反向覆盖这些 story。

矩阵性能扁平化不得建立新的视觉基线：页面内 `.manual-schedule-cell`、按压、选中、失效、班次徽标、空态和失效徽标声明与保留组件逐项等价，仍对照原 daily/maximum Storybook 状态。

`pages/gesture-probe/index` 是用于区分 Android Pan Worklet、WXS 视图层与普通逻辑层触摸能力的 diagnostic-only 页面，不是产品 UI，不建立 Storybook 黄金样张，也不参与 98% 视觉门槛。WXS 黄色点已由目标 Android 确认横纵同步跟手，矩阵接入后仍需独立完成 C/D 产品交互验收。
