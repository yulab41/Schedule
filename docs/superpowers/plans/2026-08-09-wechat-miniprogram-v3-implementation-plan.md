# 微信小程序 V3 实施计划

- 文档日期：2026-08-09
- 状态：待用户复核
- 依据设计：`docs/superpowers/specs/2026-08-09-wechat-miniprogram-v3-design.md`
- 实施范围：原生微信小程序 V3 表现层、触控交互、日历、手动排班和业务流程
- 共享内核：`apps/api/**`、`packages/contracts/**`、`packages/database/**`、`packages/scheduling-domain/**`
- 本计划独立于 `2026-08-01-medical-staff-scheduling-system-implementation-plan.md`；后者是 Web 1.0 计划，不得用来推断 V3 页面任务。

## 0. 目标和停止条件

目标是建立一个可长期维护、可由低阶模型按批次执行的 V3 小程序。V3 保留 Web 的业务语义、数据完整性、权限和错误路径；只适配输入方式、布局密度、滚动和面板交互。

整个 V3 完成的停止条件：

1. V3 跟踪配置可复现，生成物、私钥和本机私有配置边界清楚。
2. app-shell、认证入口、原生 tabBar、角色入口和局部滚动可启动。
3. 日历黄金数据集在 WebView、Skyline 和低版本 fallback 下完成视觉、触控和错误路径验收。
4. 请假、换班、加扣班、通知、手动排班、补录、统计、导出、群组和平台入口遵守 Web 权限和服务端预览/版本保护。
5. 主包目标小于 2MB；实际包体、首屏、切月、详情面板和编辑操作耗时有记录。
6. 涂抹排班 Spike 有明确的通过或不通过结论；失败不得阻塞基础的单元格优先和班种锁定模式。
7. 用户确认最终 Skyline 页面范围和 WebView fallback 结论。

## 1. 低阶模型执行规则

每次新对话先完整读取 `AGENTS.md`、`docs/project-status.md`、本计划当前批次和 V3 设计对应章节。每轮只执行当前批次的 1–3 个任务；复杂日历、渲染器、并发和发布任务单独成轮。

实施者必须遵守：

- 不恢复、复制或参考 V1/V2 页面、旧 manifest、旧展示模型、旧移植清单和已作废外部计划。
- 不自行新增 API、契约字段、权限、标识类型、缓存写入语义或后端排班规则。发现缺口先停在计划/设计层。
- 日历数据必须先转换为类型化 `CalendarMonthViewModel`，再进入 WXML；日期、筛选、排序、标识映射、触控阈值和草稿操作使用独立 TypeScript 模块并有测试。
- Worklet 只处理帧同步动画值和有限共享值；API、权限、排班计算、缓存写入、持久化和整月模型重建留在 JS 线程/服务端。
- 先写会在旧行为上失败的新测试，再实现；不能修改测试来掩盖行为变化。
- 每个任务提交前运行定向验证、`git diff`、`git diff --cached` 和行为变化清单；只显式暂存当前任务文件。
- 没有开发者工具或真机证据时，渲染器、TDesign Skyline 适配、包体积和性能结论只能写为“待验证”。

## 2. 固定交互和数据契约

### 2.1 日历事件路由

- 日期空白区域打开日期详情。
- 排班行打开值班详情；电话入口打开电话面板。
- 换/替/加等标识打开关联事件详情。
- 可以使用整格事件委托扩大热区，但不能把所有目标映射成同一动作。
- 同日多排班按服务端顺序/当前 Web 排序完整渲染；成员全名首屏可见，不能固定截断为三字。
- 微标签使用 Web 令牌；可用低饱和度填充和圆角，但保留语义颜色、边框、状态和独立点击反馈。

### 2.2 标识 ID

日历标识直接使用共享契约/当前 Web 的 ID：`swap`、`leave-cover`、`overtime`。`deduction` 只在服务端和契约已经提供且上下文允许时展示，不为小程序视觉单独新增类型；历史“调”标识以 Web 黄金基线为准。

### 2.3 手动排班模式

- 单元格优先：点格 → 选择班种 → 填入；再次点当前班种可清空。
- 班种锁定：先锁定班种 → 连续点成员 × 日期单元格；再次点同班种清空；有明确退出入口。
- 两种模式共享一个草稿、撤销栈和冲突校验。
- 草稿阶段替换已有值不逐格确认；整行、整列清除和正式发布确认。
- 长按仅用于清空此格/行/列，不用于多选或只读页面操作。
- 涂抹排班只能在基础模式通过后进入独立 Spike，不得在首批基线中偷偷实现。

### 2.4 服务端写入

所有创建、审批、发布、撤回、清除和模板应用都走 API、服务端预览、operationId 和版本号。离线只能读带时间戳的快照；不建立离线写入队列。

## 3. 工程和验证命令

定向命令：

- `pnpm miniprogram:typecheck`
- `pnpm vitest run apps/miniprogram`
- `pnpm miniprogram:lint`
- `pnpm exec prettier --check docs/superpowers/specs/2026-08-09-wechat-miniprogram-v3-design.md docs/superpowers/plans/2026-08-09-wechat-miniprogram-v3-implementation-plan.md`
- `pnpm miniprogram:smoke`（开发者工具启动并有 V3 manifest 后）

全量命令：

- `pnpm verify`
- 涉及 API、认证、契约、路由或构建核心链路时：`pnpm smoke:browser`、`pnpm smoke:check-core`

真机/开发者工具命令：

- `pnpm miniprogram:devtools:build-npm`
- `pnpm miniprogram:devtools:preview`
- `pnpm miniprogram:devtools:auto-preview`

`pnpm miniprogram:smoke` 必须读取 `app.json.pages`、`tabBar.list` 和每个 `subPackages[].pages`；分包页面不能漏测。模拟器或真机阻塞时，状态只能写“已实现待开发者工具/真机复核”。

## 4. 实施批次总览

| 批次   | 任务  | 内容                                       | 批次停止条件                                                   |
| ------ | ----- | ------------------------------------------ | -------------------------------------------------------------- |
| V3-0.5 | 1–2   | 配置、生成物、认证回调、manifest 冒烟边界  | 配置可审计、类型检查通过、旧登录路径消失、脚本可遍历主包和分包 |
| V3-1   | 3–5   | app-shell、认证入口、导航、日期/VM 模块    | 空壳可启动、角色入口正确、纯逻辑测试通过                       |
| V3-2   | 6–8   | 日历黄金基线、月周列表、详情/事件/电话面板 | 固定密集数据集 Web 对照和事件路由通过                          |
| V3-3   | 9–10  | 请假、换班、加扣班、通知和个人入口         | 预览、409、状态刷新和权限路径通过                              |
| V3-4   | 11–13 | 双模式手动排班、模板、应用、发布           | 草稿/撤销/冲突/发布版本保护通过                                |
| V3-5   | 14–15 | 群组、配置、补录、统计、导出和平台页       | 角色过滤、服务端权限和数据影响通过                             |
| V3-6   | 16–18 | 涂抹 Spike、渲染器/包体/性能、最终验收     | Spike 有结论，主包目标和真机记录通过，用户确认范围             |

## 5. V3-0.5：干净构建基线

### 任务 1：清理生成物并重建跟踪配置

主要文件：

- `apps/miniprogram/project.config.json`
- `apps/miniprogram/package.json`
- `apps/miniprogram/miniprogram_npm/**`（生成物，不提交）
- `apps/miniprogram/pages/test/**`（空目录/生成物）
- `apps/miniprogram/project.private.config.json`（只读审计，不提交）
- `.gitignore`

步骤：

1. 记录当前 `project.config.json`、被忽略私有配置、生成物和私钥的状态；不得删除私钥或改写用户私有配置。
2. 删除可重建的 `miniprogram_npm`、空测试目录和其他 V2 输出；保留 AppID 私钥和被忽略私有文件。
3. 将跟踪配置缩减到 AppID、工程类型、工程根目录、项目名称和实施时开发者工具支持的必要字段。
4. 固定实施时实际验证的稳定基础库版本，不使用 `latest`；默认开启域名校验、TypeScript 和 Worklet 编译。
5. 删除未经验证的 SWC/Babel/实验开关；每个保留 setting 都在配置审计表中说明来源和验证结果。
6. 保持 `tdesign-miniprogram` 版本由 package manifest/lockfile 决定，只有实际使用的组件在后续任务构建 npm。

验证：

- `git diff --check`
- `pnpm miniprogram:typecheck`
- `pnpm exec prettier --check apps/miniprogram/package.json apps/miniprogram/project.config.json`
- 开发者工具打开工程并完成一次空工程编译；记录基础库、渲染模式和 Worklet 编译结果。

停止条件：工作树不含旧生成物和旧页面，跟踪配置可复现，私钥/私有配置仍未被 Git 跟踪，定向类型检查和配置审计通过。

版本节点：`chore(miniprogram): establish V3 clean build baseline`

### 任务 2：解耦 401 认证过期和扩展分包冒烟

主要文件：

- `apps/miniprogram/api/client.ts`
- `apps/miniprogram/api/client.test.ts`
- `apps/miniprogram/store/session.ts`
- `scripts/miniprogram-smoke.mjs`
- `scripts/miniprogram-smoke.test.mjs`（若脚本测试框架已存在则放入对应测试目录）

步骤：

1. 删除 `api/client.ts` 对 `/pages/login/login` 的硬编码路由。
2. 提供可注入且可清除的认证过期回调；401 只清除会话并调用回调一次，匿名请求 401 不触发登录跳转。
3. app-shell 在启动时注册回调，回调只负责进入 V3 登录入口并保留待处理邀请回流。
4. 保持错误载荷、requestId、latestData、网络错误和调用次数语义不变。
5. 冒烟脚本读取 `pages`、`tabBar.list` 和 `subPackages[].pages`，对 tab 页使用 `switchTab`，其他页使用 `reLaunch`，输出每页截图和脚本错误。
6. 对重复 manifest 路由去重；分包页面只打开一次，不因 tabBar 或 pages 重复计数。

验证：

- 先写并运行 401 回调、匿名 401、重复回调和请求错误路径失败测试，再实现。
- `pnpm miniprogram:typecheck`
- `pnpm vitest run apps/miniprogram`
- `pnpm miniprogram:smoke`（需要开发者工具）；无工具时记录阻塞，不伪造通过。

停止条件：API 层没有任何旧登录路径字面量，认证回调测试通过，冒烟脚本能遍历主包和分包。

版本节点：`fix(miniprogram): inject auth expiry and cover subpackages`

## 6. V3-1：app-shell 和纯逻辑基础

### 任务 3：建立 V3 manifest、局部滚动壳和原生 tabBar

主要文件：

- `apps/miniprogram/app.json`
- `apps/miniprogram/app.ts`
- `apps/miniprogram/app.wxss`
- `apps/miniprogram/pages/auth/login/*`
- `apps/miniprogram/pages/workbench/index/*`
- `apps/miniprogram/pages/calendar/index/*`
- `apps/miniprogram/pages/notifications/index/*`
- `apps/miniprogram/pages/profile/index/*`
- `apps/miniprogram/assets/tab-bar/*`
- `apps/miniprogram/tokens/*`

步骤：

1. 新建仅包含 V3 页面和分包声明的 manifest；主包只放启动、认证和四个 tab 入口。
2. 原生 tabBar 固定为工作台、日历、通知、我的；不恢复 V2 custom-tab-bar。
3. 所有页面使用自定义导航和局部 `scroll-view`；页面配置使用 Skyline 的候选字段时必须引用任务 1 的审计结果。
4. 建立颜色、字号、间距、圆角、动效和触控尺寸 token；日期格、按钮、面板和工具栏使用稳定尺寸。
5. 首屏提供加载、未登录、无权限、错误和空状态，不在模板中直接拼服务端对象。

验证：

- manifest JSON 解析、tabBar 路径和 subPackages 路径测试。
- `pnpm miniprogram:typecheck`、`pnpm miniprogram:lint`。
- 开发者工具编译并手动打开首屏；记录 WebView 基线截图。

停止条件：空壳可启动，四个 tab 路径正确，未登录进入 V3 登录入口，主包未恢复任何 V2 页面。

版本节点：`feat(miniprogram): add V3 app shell and native navigation`

### 任务 4：会话恢复、微信登录、资料和角色入口

主要文件：

- `apps/miniprogram/store/session.ts`
- `apps/miniprogram/pages/auth/login/*`
- `apps/miniprogram/pages/auth/register/*`
- `apps/miniprogram/pages/profile/index/*`
- `apps/miniprogram/features/navigation/*`
- `apps/miniprogram/api/endpoints.ts`

步骤：

1. 启动时恢复 token，调用当前资料接口；需要真实姓名时进入资料入口，不能把姓名当作身份认证。
2. 微信登录成功后保留 pending invite token，并在资料/认领完成后只消费一次。
3. 角色入口由 Web `workbenchNavItems` 和服务端 `GET /platform/me` 共同决定；前端过滤不代替后端权限。
4. 401 回调只触发一次登录导航，重复请求不能叠加页面。
5. 个人页显示联系方式确认状态；拨号前遵守已确认号码权限。

验证：

- token 缺失、过期、需要资料、邀请回流和重复 401 测试。
- `pnpm miniprogram:typecheck`、`pnpm vitest run apps/miniprogram`。
- `pnpm smoke:browser`、`pnpm smoke:check-core`（认证入口属于核心链路）。

停止条件：登录、资料、邀请回流、401、角色入口和权限错误路径可复现。

版本节点：`feat(miniprogram): add V3 auth and role routing`

### 任务 5：日期、筛选、排序和 `CalendarMonthViewModel`

主要文件：

- `apps/miniprogram/features/calendar/calendar-logic.ts`
- `apps/miniprogram/features/calendar/calendar-logic.test.ts`
- `apps/miniprogram/features/calendar/calendar-view-model.ts`
- `apps/miniprogram/features/calendar/calendar-view-model.test.ts`
- `packages/contracts/src/calendar.ts`（仅在共享契约已确认缺口时修改）

步骤：

1. 复用/等价移植 Web 的业务日期、月份网格、周起始、排序、节假日短标签、过去日期和电话权限逻辑。
2. 明确 `actualMemberName ?? plannedMemberName`、同日多排班排序、跨日班次时间显示和空成员“待定”语义。
3. 将 API `CalendarReadModel` 和节假日结果转换为完整 VM；WXML 只消费 VM 字段和动作 ID。
4. VM 必须包含加载、局部加载、缓存、空日、错误、无权限和冲突刷新状态。
5. 筛选只影响展示，不改变服务端数据、排序稳定性或权限。

验证：

- 多排班、全名、缺失实际成员、班种颜色、节假日/调休、换/替/加标识、权限和跨月网格测试。
- `pnpm miniprogram:typecheck`、`pnpm vitest run apps/miniprogram`。

停止条件：固定 Web 数据集生成的 VM 与 Web 语义一致，所有纯逻辑测试通过。

版本节点：`feat(miniprogram): add typed calendar view model`

## 7. V3-2：日历黄金基线和详情层

### 任务 6：自绘日历网格、微标签和事件路由

主要文件：

- `apps/miniprogram/components/calendar-grid/*`
- `apps/miniprogram/components/assignment-row/*`
- `apps/miniprogram/components/marker-badge/*`
- `apps/miniprogram/components/holiday-tag/*`
- `apps/miniprogram/pages/calendar/index/*`
- `apps/miniprogram/tests/calendar-golden-data.test.ts`

步骤：

1. 使用 VM 渲染星期头、日期格、完整排班数组和节假日状态；不接入通用日历库。
2. 采用紧凑双行和微标签视觉，但姓名不固定截断，同日多排班按行堆叠或受控折叠次要内容。
3. 日期格、排班行、标识和电话入口使用独立稳定热区；实现明确事件路由。
4. 保留今天、周末、过去日期、班种颜色、节假日边框和标识颜色。
5. 选中/按压/焦点状态不能改变布局尺寸；支持无障碍文本和低动态模式。

验证：

- 固定密集月份截图 fixture：多排班、长姓名、节假日/调休、每种标识、无电话/未确认电话。
- 单元测试断言事件路由和权限矩阵。
- 开发者工具 WebView 截图与 Web 黄金截图对照。

停止条件：日历首屏显示全名和标识，事件路由正确，视觉差异有记录且无未批准的语义简化。

版本节点：`feat(miniprogram): build calendar golden baseline`

### 任务 7：三页切月、月/周/列表模式和只读缓存

主要文件：

- `apps/miniprogram/features/calendar/calendar-shell.ts`
- `apps/miniprogram/features/calendar/calendar-shell.test.ts`
- `apps/miniprogram/pages/calendar/index/*`
- `apps/miniprogram/components/calendar-week/*`
- `apps/miniprogram/components/calendar-list/*`
- `apps/miniprogram/store/calendar-cache.ts`

步骤：

1. 使用上月/当前月/下月三页 `swiper`，循环切页由触摸来源、目标月份和请求序号保护。
2. 月份切换位移阈值采用屏宽 18% 与 48px 的较大值；纵向位移更大时锁定滚动。
3. 月/周/列表模式共享 VM 和筛选状态；切换群组或月份不能混入旧缓存。
4. 只读快照按用户、群组、月份和版本隔离，显示时间戳和“可能不是最新数据”。
5. 服务端成功响应覆盖快照；写操作成功主动失效相关月份；离线阻断所有写入。

验证：

- 循环 swiper 重复回调、快速切月、跨年、切群组、缓存过期和离线写入测试。
- 模拟器截图和低端设备切月/滚动走查。

停止条件：切月不跳回、不重复请求、不串群组；WebView fallback 功能完整。

版本节点：`feat(miniprogram): add calendar navigation and read cache`

### 任务 8：详情、事件时间线和电话 Bottom Sheet

主要文件：

- `apps/miniprogram/components/duty-detail-sheet/*`
- `apps/miniprogram/components/event-timeline-sheet/*`
- `apps/miniprogram/components/phone-sheet/*`
- `apps/miniprogram/components/confirm-sheet/*`
- `apps/miniprogram/features/events/*`
- `apps/miniprogram/features/phone/*`

步骤：

1. 日期详情展示完整日期、全部排班、节假日状态和可执行入口。
2. 值班详情展示成员、岗位、班种、时间、实际/计划人员和事件摘要。
3. 事件面板按 Web 状态展示前后人员、操作者、原因、审批、关联链和统计影响。
4. 电话面板展示长号/短号；已确认号码可拨打，未确认号码只能复制；无号码不生成无效拨号链接。
5. Bottom Sheet 下滑阈值为滚动到顶部后 80px 或速度阈值；否则回弹。关闭不能丢失待提交表单。
6. 不使用一个通用确认框替代不同业务状态。

验证：

- 事件详情加载失败、空事件、无权限、号码权限、面板拖拽关闭和返回焦点测试。
- 模拟器/真机截图和触控走查。

停止条件：详情层级清楚，电话号码不越权，事件和表单状态不丢失。

版本节点：`feat(miniprogram): add calendar detail sheets`

## 8. V3-3：业务流程和通知

### 任务 9：请假、换班、加扣班表单和预览

主要文件：

- `apps/miniprogram/pages/requests/*`
- `apps/miniprogram/components/request-form/*`
- `apps/miniprogram/components/preview-sheet/*`
- `apps/miniprogram/components/approval-sheet/*`
- `apps/miniprogram/features/workflows/*`
- `apps/miniprogram/api/endpoints.ts`
- `apps/miniprogram/tests/workflows.test.ts`

步骤：

1. 按 Web 字段实现请假、换班、加扣班申请、接受、批准、驳回、撤回、取消和归档状态。
2. 始终执行“填写 → 服务端预览 → 影响确认 → 提交 → 状态刷新”。
3. 预览必须显示受影响班次、前后人员、策略、资格、请假、时间冲突、连续值班、节假日、空缺、成对加扣记录和净值变化。
4. 任意关键字段变化清空旧预览；提交前刷新版本；409 展示最新摘要和重新预览动作，不自动重放旧操作。
5. 管理员直办加扣班也必须填写原因；不能绕过群组审批设置。

验证：

- 预览失效、策略变化、409、重复 operationId、审批状态和撤回权限测试。
- `pnpm miniprogram:typecheck`、`pnpm vitest run apps/miniprogram`。
- `pnpm smoke:browser`、`pnpm smoke:check-core`。

停止条件：三类流程的字段、状态、预览、确认、冲突和权限与 Web 一致。

版本节点：`feat(miniprogram): add workflow forms and previews`

### 任务 10：通知、个人页、访客和群组入口

主要文件：

- `apps/miniprogram/pages/notifications/*`
- `apps/miniprogram/pages/profile/*`
- `apps/miniprogram/pages/groups/*`
- `apps/miniprogram/features/navigation/*`
- `apps/miniprogram/features/notifications/*`

步骤：

1. 通知页按 Web 状态展示已读、未读、审批、值班提醒和排班变化；订阅消息只接入授权入口，不自行伪造发送成功。
2. 访客只显示允许群组和只读月历；不显示事件、管理或写入入口。电话入口严格跟随 Web 的访客权限和联系方式确认状态，不能由小程序自行放宽。
3. 群组切换、退出、访客加入、邀请回流和已解散恢复入口遵守服务端权限。
4. 个人页展示资料、号码确认、通知偏好、版本和登出；登出清理会话与按用户隔离的缓存。

验证：

- 角色导航矩阵、通知状态、访客只读、群组切换和登出缓存清理测试。
- `pnpm smoke:browser`、`pnpm smoke:check-core`。

停止条件：普通成员、管理员、群主、平台管理员和访客入口不越权，通知状态可刷新。

版本节点：`feat(miniprogram): add notifications and group-aware navigation`

## 9. V3-4：双模式手动排班

### 任务 11：单元格优先编辑器和班种调色板

主要文件：

- `apps/miniprogram/pages/schedule/manual/*`
- `apps/miniprogram/components/manual-grid/*`
- `apps/miniprogram/components/shift-palette/*`
- `apps/miniprogram/features/manual-schedule/manual-grid-logic.ts`
- `apps/miniprogram/features/manual-schedule/manual-grid-logic.test.ts`

步骤：

1. 选择岗位、成员、开始日期和周期天数，渲染人员行 × 日期列。
2. 实现单元格优先：选格、选班种、填入、再次点击当前班种清空。
3. 班种颜色、简称、停用警告和节假日摘要与 Web 一致。
4. 所有改动进入唯一草稿和撤销栈；不逐格弹覆盖确认。
5. 长按只打开清空此格/行/列面板；整行/整列清除需要确认。

验证：

- 7/30 天列数、成员变化、停用班种、填入/清空、长按和撤销测试。
- 模拟器横向滚动和局部滚动走查。

停止条件：单元格优先模式可完整编辑，草稿状态可撤销且不产生服务端写入。

版本节点：`feat(miniprogram): add cell-first manual scheduling`

### 任务 12：班种锁定、连续填入和触控隔离

主要文件：

- `apps/miniprogram/components/manual-grid/*`
- `apps/miniprogram/components/shift-palette/*`
- `apps/miniprogram/features/manual-schedule/gesture-logic.ts`
- `apps/miniprogram/features/manual-schedule/gesture-logic.test.ts`

步骤：

1. 先锁定班种后连续点击任意单元格填入；再次点同班种清空；提供明确退出锁定入口。
2. 使用 `memberId + date + shiftId` 单元格级去重；不使用全局 200ms 防抖。
3. 分离网格横向滚动和月份切换；仅月份导航区域消费切月手势。
4. 横向/纵向轴向锁定，稳定单元格尺寸，不在触摸帧重建整月 VM。
5. 轻震只作增强反馈，不强制每格震动。

验证：

- 快速连续点击、重复点击、切换班种、退出锁定、横向滚动和误触切月测试。
- 低端 Android 与 iOS 触控记录。

停止条件：锁定模式与单元格优先共享同一状态源，触控不误触滚动或切月。

版本节点：`feat(miniprogram): add locked-shift editing mode`

### 任务 13：模板、应用、发布和冲突保护

主要文件：

- `apps/miniprogram/pages/schedule/templates/*`
- `apps/miniprogram/pages/schedule/publishing/*`
- `apps/miniprogram/features/manual-schedule/template-logic.ts`
- `apps/miniprogram/features/manual-schedule/template-logic.test.ts`
- `apps/miniprogram/api/endpoints.ts`

步骤：

1. 保存/编辑/删除模板，保存成员和班种引用版本。
2. 支持单次应用和循环到结束日期；中间截断必须正确。
3. 应用、发布、撤回、重发和删除前重新验证人员、班种、请假、冲突、连续值班、节假日和统计影响。
4. 使用服务端预览、operationId 和预期版本号；409 刷新最新数据并要求用户重新确认。
5. 草稿批次按 operationId 分组；发布不覆盖当前版本，除非用户完成明确的替换确认。

验证：

- 周期边界、模板引用失效、草稿批次、重复提交、409 和撤销测试。
- `pnpm smoke:browser`、`pnpm smoke:check-core`。

停止条件：模板和发布不会产生少/多日期、丢失事件或覆盖新数据。

版本节点：`feat(miniprogram): add template publishing and conflict protection`

## 10. V3-5：管理、补录、统计和导出

### 任务 14：群组、成员、排班配置和补录

主要文件：

- `apps/miniprogram/pages/groups/*`
- `apps/miniprogram/pages/schedule/config/*`
- `apps/miniprogram/pages/schedule/backfill/*`
- `apps/miniprogram/features/groups/*`
- `apps/miniprogram/features/schedule-config/*`
- `apps/miniprogram/features/backfill/*`

步骤：

1. 群主/管理员管理成员、联系方式、角色、轮值顺序和班种；服务端权限是最终判断。
2. 支持群组码、邀请、访客加入/退出、解散/恢复和群组切换；不把群组码或电话写入其他群组缓存。
3. 补录只允许授权角色操作过去日期；输入仍走 API、原因、operationId 和版本保护。
4. 所有列表、空态、失效成员、停用班种、错误和冲突状态可恢复。

验证：

- 角色权限、联系方式确认、群组隔离、补录过去日期和失败重试测试。
- `pnpm smoke:browser`、`pnpm smoke:check-core`。

停止条件：管理和补录入口与 Web 权限矩阵一致，不能通过前端隐藏绕过服务端校验。

版本节点：`feat(miniprogram): add group and schedule administration`

### 任务 15：统计、导出和平台运维入口

主要文件：

- `apps/miniprogram/pages/statistics/*`
- `apps/miniprogram/pages/exports/*`
- `apps/miniprogram/pages/platform/*`
- `apps/miniprogram/features/statistics/*`
- `apps/miniprogram/features/exports/*`
- `apps/miniprogram/features/platform/*`

步骤：

1. 展示月度/年度、周末、法定节假日、换班、加班、扣班、请假补位和人工调整影响；统计以服务端快照为准。
2. 导出按月份/年份、岗位、成员筛选；默认不包含长号、短号和内部审计内容；下载链接短期有效。
3. 平台管理员查看任务、备份列表、用户状态、节假日版本和覆盖率；备份只做列表，不做客户端恢复下载。
4. 平台入口由 `GET /platform/me` 决定；普通成员和访客不能看到平台页。

验证：

- 周末与法定节假日互斥、加扣班净值、导出脱敏、平台权限和任务状态测试。
- `pnpm smoke:browser`、`pnpm smoke:check-core`。

停止条件：统计与 Web 可核对，导出不泄露电话，平台操作不扩大权限。

版本节点：`feat(miniprogram): add statistics exports and platform views`

## 11. V3-6：Spike、兼容性和发布验收

### 任务 16：涂抹排班 Spike（可选）

主要文件：

- `apps/miniprogram/features/manual-schedule/paint-gesture.ts`
- `apps/miniprogram/features/manual-schedule/paint-gesture.test.ts`
- `apps/miniprogram/components/manual-grid/*`
- `docs/testing/miniprogram-v3-paint-spike.md`

前置条件：任务 11–13 已通过，单元格优先和班种锁定可用。

步骤：

1. 仅在手动网格编辑模式启用按住滑动；查看模式和只读日历不启用。
2. 以触摸轨迹映射经过的单元格，使用 cell key 去重；不在每帧调用 API、`setData` 或提交服务端写操作。
3. 处理轴向锁定、月份导航隔离、网格滚动隔离、橡皮擦、取消、撤销和点击回退。
4. 在低端 Android、iOS、WebView 和 Skyline（若该页已启用）记录误触、掉帧、内存和响应时间。

通过条件：连续填入明显减少操作，核心触控无误阻断，撤销/清除可靠，WebView fallback 可用，包体增量可接受。否则只保留任务 11–12 的点击模式，并在记录中写明不通过原因。

版本节点（仅 Spike 通过时）：`feat(miniprogram): add manual paint gesture spike`

### 任务 17：Skyline/WebView、TDesign 白名单和包体验收

主要文件：

- `apps/miniprogram/app.json`
- 日历页和使用 TDesign 的页面 JSON
- `docs/testing/miniprogram-v3-renderer-matrix.md`
- `docs/testing/miniprogram-v3-device-report.md`
- `docs/testing/miniprogram-v3-bundle-report.md`

步骤：

1. 锁定开发者工具版本、基础库版本、TDesign 版本和测试数据集。
2. 对日历页逐项验证 renderer、Glass Esel、Worklet、局部滚动、底部面板、swiper 和 fallback；不支持的配置字段删除。
3. 对每个进入 Skyline 的 TDesign 组件记录官方适配状态、实际设备结果和替代方案。
4. 测量主包、分包、首屏、切月、打开详情、打开 Bottom Sheet 和编辑操作；主包目标小于 2MB。
5. 只依据低端 Android+iOS 的综合结果决定是否扩展 Skyline；不能只看开发者工具平均帧率。

验证：

- `pnpm miniprogram:typecheck`
- `pnpm vitest run apps/miniprogram`
- `pnpm miniprogram:smoke`
- `pnpm smoke:check-core`

停止条件：矩阵、包体报告、真机截图和性能数据齐全；每个 Skyline 页面都有可用 fallback 或明确保留 WebView 的结论。

版本节点：`test(miniprogram): validate V3 renderer and bundle budget`

### 任务 18：V3 最终验收和交接

主要文件：

- `docs/testing/miniprogram-v3-acceptance.md`
- `docs/project-status.md`
- `docs/debug/debug-feedback-log.md`
- `README.md` 或小程序开发文档（若入口已存在）

验收场景：

1. 未登录、需要资料、邀请回流、登录过期和登出。
2. 工作台、日历、通知、我的四个 tab 以及所有角色入口。
3. 当前月密集日历、前后月、周/列表、节假日、全名、多排班、换/替/加标识和电话。
4. 日期/排班行/标识/电话事件路由，Bottom Sheet 下滑关闭和回弹。
5. 请假、换班、加扣班完整预览、确认、提交、409、撤回和审批。
6. 单元格优先、班种锁定、清空、撤销、模板、应用、发布和并发冲突。
7. 访客、成员、管理员、群主和平台管理员权限隔离。
8. 离线只读快照、过期提示和写操作阻断。

停止条件：自动验证、开发者工具编译、模拟器截图、低端 Android/iOS 走查和用户确认全部完成。状态写为“待用户复核”，不得把单测通过写成最终完成。

版本节点：`release(miniprogram): V3 acceptance baseline`

## 12. 每批提交要求

每个任务形成独立提交。提交前：

1. 更新 `docs/project-status.md`：完成任务、验证结果、停止条件、决策/偏差和下一批 1–3 个任务。
2. 更新 `docs/debug/debug-feedback-log.md`：若触及 API、认证、契约、构建或路由，记录 `pnpm smoke:browser` 和 `pnpm smoke:check-core`；若未运行，明确原因。
3. 检查 `git diff`、`git diff --cached` 和行为变化清单，只暂存当前任务相关文件。
4. 有 origin/upstream 且验证通过时，按 `AGENTS.md` 推送正常 fast-forward 提交；不 force-push。

文档变化本身不运行浏览器冒烟；开始实现 app-shell、认证、契约、路由或构建核心链路后必须按设计和 `AGENTS.md` 执行浏览器验证。
