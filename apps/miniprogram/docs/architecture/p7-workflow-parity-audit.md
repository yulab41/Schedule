# P7 工作流 Web/API/Mini 对等审计

## 结论

P7 不需要重写后端领域模型。现有 Web/API 已完整覆盖请假、换班、加扣班、审批、拒绝、取消、完成后撤销、冲突、事件和通知写入；P7-A 已关闭共享客户端与危险写幂等缺口，P7-B 已用真实 `HomeView` 和 production panels 固化完整 Storybook 状态黄金。Mini 剩余缺口是原生 `subpackage-workflows` 页面、controller/ViewModel、工作台导航和 `workflows` capability 发布。

P7-A/B 已完成并通过真实 MySQL、Web/Storybook build 和 390/320 浏览器自检；下一实施批才允许从请假原生垂直切片开始，继续禁止把 Web/TDesign 运行时带入 Mini。

## 权威来源与引入点

| 范围                 | 权威来源                                                                                                                            | 引入点                             |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| 请假/reflow/API/Web  | `packages/contracts/src/leaves.ts`、`apps/api/src/modules/leaves/*`、`apps/web/src/features/leaves/*`                               | `0d5ec55c`                         |
| 换班/API/Web         | `packages/contracts/src/swaps.ts`、`apps/api/src/modules/swaps/*`、`apps/web/src/features/swaps/*`                                  | `b20ff9b8`                         |
| 加扣班/API/Web       | `packages/contracts/src/duty-adjustments.ts`、`apps/api/src/modules/duty-adjustments/*`、`apps/web/src/features/duty-adjustments/*` | `5d8b205a`                         |
| 工作流共享事务/幂等  | `apps/api/src/modules/workflows/workflow-operation.ts`                                                                              | `beae8e84`、`7fcd6ae4`、`e5608cf3` |
| Mini capability 分类 | `apps/api/src/plugins/client-capability-guard.ts`                                                                                   | `e25878f0`                         |
| Mini 禁用导航占位    | `apps/miniprogram/src/pages/workbench/index.ts/.wxml`                                                                               | `ad4cfb2c`、`733e3af6`             |

现有 Web 回归基线：workflow/client 定向 8 files、193 tests 通过。API 的真实 MySQL 套件分别覆盖请假19项、换班34项、加扣班26项、通知8项以及微信投递4项；这些名称已逐项盘点，本审计不以静态数量代替后续改动后的真实 MySQL 复跑。

## 已有 API 真值

### 请假

- 成员：新建、我的列表、受影响班次、取消待审批申请。
- 管理员：审批列表、reflow preview、批准/驳回、撤销已批准申请、群组默认 reflow 策略。
- 状态：`pending | approved | rejected`；取消/撤销返回独立 mutation result，成功后记录从活动列表移除。
- 批准必须携带 request version、rules version、全部 period versions、operation id；冲突/空缺需显式 acknowledgement。
- reflow 支持 `keep-original-order | shift-forward`，覆盖未发布期间、硬冲突、连续24小时风险、空缺、统计变化和其他活动工作流 blocker。

### 换班

- 成员：跨已发布月份选择自己的班次、目标成员/班次、preview、提交、目标接受/拒绝、申请人取消。
- 管理员：待审批列表、批准/拒绝、任意两班直接换班、群组审批开关。
- 个人设置：自动接受换班。
- 状态：`pending_target | pending_approval | completed | rejected | cancelled | revoked`。
- 完成后只能按工作流链逆序撤销；历史/过期/已归档班次保持可读但不可撤销。

### 加扣班

- 成员：选择自己的已发布班次和加班成员、preview、提交、加班成员接受/拒绝、申请人取消。
- 管理员：待审批列表、批准/拒绝、直接指定被代班班次与加班成员、群组审批开关。
- 个人设置复用自动接受换班/加扣班。
- 状态与撤销链语义和换班一致；完成后恢复被扣班成员，活动 swap/duty/leave 冲突失败关闭。

### 消息

- 三类业务事务已在同一事务中写不可变事件与受影响成员/管理员通知；发布冲突另写 conflict notification。
- 浏览器/微信 delivery、拒绝/系统错误重试、偏好与模板行为已有 API 测试。
- P7 只保证工作流动作生成消息并在页面 `onShow` 刷新状态；通知中心、订阅授权和通知设置原生页属于 P9 `subpackage-insights`，不得为了 P7 提前复制。

## Web 手机版冻结映射

### 请假

- 顶部标题“请假与审批”；手机分段为“我的请假 / 待我审批”，审批计数 badge。
- 我的列表显示类型、日期范围、原因、受影响班次、状态；`pending` 可取消，`approved` 可在允许时撤销。
- 管理员列表区分待审批与已处理；审批弹层展示受影响班次、未发布期间、策略、统计变化、硬冲突、workflow blocker、连续值班风险和空缺，并提供驳回/批准。
- 新建为底部 sheet：全日日期区间、类型、可选原因、受影响班次预读、提交状态。

### 换班 / 加扣班

- 页面标题、说明、主操作按钮、个人自动接受设置、待我接受、待管理员审批、已受理记录、已生效待撤销、我的记录必须与 Web 同序。
- 表单使用底部 sheet；preview 先于提交，显示双方/班次、下一状态和逐条冲突。
- 管理员 direct form 与普通成员 form 分离；成功、网络失败、409 conflict、刷新失败必须使用 Web 同义状态。
- 390px 来源为 production panel 加 `web-ui-2-0-shell-refinement-preview--swap-390/--duty-390`；320px 与完整状态需在 P7 专用 Storybook fixture 中从 production panel 固化，不能把现有简化卡片当完整黄金。

## Mini 当前状态

1. `subpackages/workflows` 已注册请假、换班、加扣班三个原生页面；工作台与页内底栏三项真实互转，guest/disabled/deep link失败关闭。
2. 三页 controller/ViewModel 已覆盖operation freeze、409刷新、前后台serial、loading/error/empty/success、成员/管理员、preview/direct/revoke与设置；离线只读且没有写队列。
3. client-core 的38个workflow endpoint/compact decoder/Web委托、19个危险写header/body门禁、leave create幂等和20个production-panel Storybook 390/320黄金均已关闭。
4. `.85/.86` 已完成两轮 RC 上传并收到实体反馈；剩余门槛是交互稳定性修复候选 `.87` 的上传、production allowlist/回滚探测，以及用户实体 Android P7 复核；明确通过前不进入 P8。

## 冻结实施顺序

### P7-A 安全与共享客户端边界（已完成）

- 为 leave create 增加 operation id、规范 fingerprint 和 `runAuthorizedMutation`；同 key同payload重放，同 key异payload 409。
- 所有 workflow dangerous writes 用 `resolveDangerousOperationId` 强制 `Idempotency-Key` 与 body 一致；Web 先改为冻结同一 operation id/header，网络结果不明确保留。
- 在 client-core 新增 workflow endpoints、compact decoders、golden fixtures、Zod深等价；Web 现有方法先委托共享 service，保持 `fetch.call(globalThis)`、认证、错误和调用次数。
- 共享 presentation-core 只迁纯状态/格式/候选/冻结提交逻辑，Web 先使用；不得把 Vue/Zod/DB 带入 Mini。

停止条件：相关 contracts/client/Web/API 单测先红后绿，真实 MySQL leave/swap/duty/notification 全绿，浏览器 smoke 通过；不写 Mini WXML。

### P7-B Storybook 完整状态黄金（已完成）

- 使用 `frontend-design`，从 production Web 手机版固化 leave/swap/duty 的390/320、成员/管理员、列表/表单/preview/冲突/确认/错误/空状态。
- 用户已明确要求不再询问 UI 设计并固定1:1 Web手机版；该指令视为视觉方向确认，但仍必须执行截图/几何/溢出自检。

### P7-C–E 原生页面

1. 请假：新建、affected shifts、我的列表、取消、审批preview/批准/驳回/撤销、策略。
2. 换班：跨月候选、preview/提交、接受/拒绝/取消/审批/direct/revoke、设置。
3. 加扣班：候选、原因、preview/提交、接受/拒绝/取消/审批/direct/revoke、设置。
4. 注册 `subpackages/workflows`，工作台底栏启用三项真实导航；guest/disabled/deep link失败关闭。
5. 完整 P7 候选固定为`0.1.0-p7.20260824.94`；`.82-leave/.83-swap/.84-duty`仅用于逐切片可追溯上传，部分切片候选永不加入 production allowlist；`.85/.86/.87/.88/.89/.90/.91/.92/.93` 是前九轮完整 RC，已被本轮 Web/Mini 自然日限制、请假 Sheet/冲突列表、无闪烁下拉、平滑滚轮、日期横滑定位和周视图字重修复版 `.94` 取代。`.94` 上传、代码部署、自动 RC 和回滚探测通过后，才在 release 锁下原子加入 allowlist；旧版本继续保留自身 UI 行为，不新增离线写队列。

### P7 RC

- 自动：权限、版本、幂等、事务、冲突、跨月、中国时间、前后台/弱网、package/Worklet/determinism/simulate、390/320。
- 实体 Android：成员和管理员各完成三类工作流的提交→接受/审批→拒绝/取消→完成后撤销，并确认通知/日历标记、无重复写、弱网结果不确定时可安全重试。
- 用户明确通过前不进入P8，不提审/正式发布。
