# Web 1.0 调试与验证记录

本文件只记录当前轮次的变更、验证和状态；详细历史以 Git 提交为准。

## 2026-08-14 账号密码认证切换

- 变更：正式网页从微信网站应用扫码登录切换为账号密码注册/登录；小程序身份和通知配置保持独立。
- 运行/浏览器验证：pnpm smoke:browser 已通过，覆盖开发管理员、开发成员、访客排班和访客访问记录流程；正式账号注册/登录需在新 release 部署后人工验收。
- 运行/浏览器验证：pnpm smoke:check-core 在补充本记录前因缺少本轮记录失败，补充后需重新运行并通过。
- 运行验证：pnpm verify 已通过；59 个测试文件通过，29 个数据库集成文件因本机没有测试 MySQL 跳过。
- 发布诊断：服务器数据库的既有 `users.id` 为 `utf8mb4_0900_ai_ci`，新增认证表迁移使用 `utf8mb4_unicode_ci`，MySQL 报告外键列不兼容；已将迁移 0035/0036 统一为既有排序规则。首次发布已自动回滚，现网旧 release 健康，待修正 release 重试。
- 发布验证：修正后的 release `c358109` 已部署；数据库迁移 0035/0036 成功，`ecs-verify.sh` 通过，正式域名/API、未知 Host 拒绝、共享入口端口、无开发认证依赖和迁移计数 36 均通过。
- 数据清理：旧 `local-admin` / `local-member` 记录的业务关联未删除，账号已改为 retired 标识并设为 suspended；生产管理员 UID 配置已清空，等待正式账号注册后配置。
- 负向验收：弱注册返回 400、未知账号登录返回 401、旧开发 Bearer token 返回 401；未创建测试账号。
- 状态：本轮发布已完成，当前为“待用户复核”；需要用户注册账号、确认管理员账号，并重置已暴露的小程序 AppSecret。

## 2026-08-14 密码策略与登录页提示调整

- 变更：密码移除最小/最大长度限制，仅拒绝空密码；登录页移除首次注册和微信 AppID/AppSecret 说明，并将登录密码输入标记为 current-password。
- 运行/浏览器验证：pnpm smoke:browser 已通过，覆盖开发管理员、开发成员、访客排班和访客访问记录流程。
- 运行验证：pnpm verify 已通过；60 个测试文件、447 个测试通过，29 个数据库集成文件因本机没有测试 MySQL 跳过。
- 发布验证：release `72f1076` 已部署；`ecs-verify.sh` 通过，正式构建产物不包含旧登录提示或“至少 8 位”文案，一位密码未知账号请求返回 401。
- 状态：本轮代码和正式部署已完成，当前为“待用户复核”；需要用户注册账号、确认管理员账号，并重置已暴露的小程序 AppSecret。

## 2026-08-14 配置正式管理员并重建 API

- 变更：确认正式密码账号 `D0796` 为 active 且资料已建立，将该账号对应的稳定认证 UID 写入生产 `PLATFORM_ADMIN_UIDS` 和 `HOLIDAY_ADMIN_UIDS`；未读取或修改账号密码。
- 发布验证：仅重建 API 容器，Web、MySQL 和共享 Nginx 网关未停止；API 健康接口返回 200，生产认证开关仍为 `NODE_ENV=production`、`AUTH_DEV_MODE=false`、`AUTH_PASSWORD_ENABLED=true`、`WECHAT_MOCK_MODE=false`。
- 运行验证：服务端管理员 UID 配置与账号身份映射一致；`ecs-verify.sh` 通过，正式 release、域名入口、未知 Host 拒绝、共享端口、产物哈希、无开发认证依赖和迁移计数 36 均通过。
- 状态：配置和服务端重建已完成，当前为“待用户复核”；请用户退出后重新登录 `D0796`，人工确认管理员页面和节假日管理功能。小程序 AppSecret 仍需在微信平台重置后再更新通知配置。

## 2026-08-14 关联原有群组到正式账号

- 变更：核对生产数据库后发现原有 1 个正式群组仍由已退役旧管理员身份持有，`D0796` 尚无该群组成员关系；已将个人资料显示姓名确认为“林恩宇”，并在单一数据库事务中完成群主转让。
- 数据结果：`D0796` 现在是该群组的 active `owner`；旧退役账号的原成员记录保留为 active `administrator` 历史关系，不删除原群组、群组编号或排班数据。
- 运行验证：群主 UID、owner 成员关系和旧管理员关系核验一致；原有 2 个排班周期仍在；正式域名 API 健康接口返回 200。
- 异常处理：第一次 SQL 因 `groups` 为数据库保留字而未提交，事务自动回滚；修正后重新执行成功，未产生部分写入。
- 状态：数据库关联已完成，当前为“待用户复核”；请用户退出后重新登录 `D0796`，确认群组显示姓名“林恩宇”和群主操作权限。

## 2026-08-14 群组页面与群组码展示修复

- 回归定位：群组 API 已返回 `D0796` 的 owner 群组，但前端只把群组放在下拉选择器中；群组码更新接口返回新码后，群组管理面板没有持久显示 `groupCode`。相关展示和刷新逻辑最初来自提交 `1b5a17a`，调用点已通过 `git blame` 确认。
- 变更：工作台顶部明确显示当前群组名称、角色和群组码；群组管理面板显示当前群组码；重新生成群组码后使用接口返回值提示，并由父级刷新最新码。
- 测试先行：增加浏览器回归断言后，旧实现因未看到“当前群组码”失败；修复后通过。
- 运行/浏览器验证：pnpm smoke:browser 已通过，覆盖群组列表展示、群组管理页面、重新生成群组码后四位码刷新，以及原有管理员、成员、访客流程。
- 运行验证：`pnpm --filter @schedule/web typecheck` 通过；`pnpm verify` 通过，60 个测试文件、447 个测试通过，29 个数据库集成文件因本机没有测试 MySQL 跳过；生产构建仅有既有的大 chunk warning。
- 发布验证：release `056fc59` 已部署；`ecs-verify.sh` 通过，正式 API 健康接口返回 200，`D0796` 的 `/api/groups` 返回原群组、`owner` 角色和四位群组码。
- 状态：代码修复和正式 Web release 已完成，当前为“待用户复核”；请用户退出后重新登录 `D0796`，确认群组名称、群主权限和群组码刷新。

## 2026-08-14 Web UI 2.0 Storybook 手机预览

- 范围：用户选择 Storybook + 本地浏览器替代 Figma；本轮只完成 Storybook 基础和四个关键手机预览，不改生产 UI、业务/API 或数据结构。
- 测试先行：横滑判定测试先因缺少 `preview-interactions.js` 失败；实现 56px 水平阈值和 1.2 倍水平意图判定后 4/4 通过，覆盖左右横滑、阈值不足和垂直滑动取消。
- 浏览器修正：320px 验收发现图标化筛选按钮缺少无障碍名称，以及部分带事件标识姓名被压窄；补充 `aria-label` 并调整月格行宽后复核通过。
- 运行/浏览器验证：Storybook 390×844 四屏及 320×844 月历无横向溢出、无姓名裁切、可见操作均至少 44px；底栏不遮挡最后一个电话按钮；筛选/更多底部页、登录/注册、请假/审批、月份左滑均实际操作通过，控制台无 warning/error。
- 运行/浏览器验证：`pnpm smoke:browser` 已通过，覆盖登录、管理员、成员、访客和访客访问记录；`pnpm smoke:check-core` 已通过并确认本轮未涉及核心链路文件。
- 运行验证：`pnpm --filter @schedule/web storybook:build`、Web typecheck、4 项横滑测试和 `pnpm verify` 均通过；全仓库为 61 个测试文件、451 个测试通过，29 个数据库集成文件因本机没有测试 MySQL 跳过。
- 状态：Storybook 预览为“待用户复核”；用户确认视觉、月格密度、底栏和详情轨道后，才进入生产令牌与应用框架批次。

## 2026-08-14 Storybook 月历视觉反馈精修

- 回归来源：原姓名彩色背景、纯文字节假日、蓝底白字加/换标识均由 `b903c6d` 引入；已通过 `git log -S` 和 `git blame` 定位到 `Ui2MonthCalendar.vue` 对应调用点。
- 用户确认：整体视觉风格可继续；本轮只精修 Storybook 月历状态，不改生产 UI。
- 测试先行：新增视觉状态测试后先因缺少 `preview-calendar.js` 失败；实现后周末列、多日节假日、单日标识与调休工作日 4/4 通过，连同横滑测试共 8/8 通过。
- 变更：姓名取消背景填充；节假日、调休“班”、加/换复用现有 Web 红/蓝/黄徽标配色；星期六/日表头改为周末红；多日节假日单元格为浅粉背景。使用仓库真实 2026 年国庆 7 天和 10 月 10 日调休数据新增独立状态 Story。
- 运行/浏览器验证：390×844 和 320×844 均无横向溢出、姓名/徽标裁切或小于 44px 的可见操作；7 个国庆单元格背景一致，稳定页面控制台无 warning/error。
- 运行验证：Storybook build、Web typecheck、`pnpm smoke:browser`、`pnpm smoke:check-core`、`pnpm verify` 均通过；62 个测试文件、455 个测试通过，29 个数据库集成文件因本机没有测试 MySQL 跳过。
- 状态：当前为“待用户复核”；确认本轮月历状态后，才进入生产令牌与应用框架批次。

## 2026-08-14 Web UI 2.0 令牌与应用框架

- 回归来源：响应式导航、四个手机主入口和固定底栏由 `db35a77` 引入；账号登录/注册结构由 `de3ad5f` 引入；顶部退出链路由 `e38cdba` 引入。已分别通过 `git log -S` 与 `git blame` 确认调用点。
- 测试先行：新语义令牌、15px 正文/20/28px 标题、4–32px 间距、44px 点触目标及强类型导航图标断言在旧实现上 6 项失败；实现后 4 个定向测试文件、18 项测试通过。
- 语义等价审计：登录/注册/开发登录继续调用原 session 方法，参数、异步等待、错误捕获与跳转范围未变；退出仍只调用 `AppLayout.signOut()` 一次，手机账号区经 Home/Nav 事件上送；导航条目顺序、角色过滤和四个手机主入口未变。未修改 API、契约或数据结构。
- 变更：生产登录页、顶部栏、群组上下文、桌面图标侧栏与手机图标底栏对齐已确认的 Apple Health 式视觉；“更多”改为原生焦点锁定的响应式 Sheet，手机底部页中包含功能分组和账号退出；加入安全区、按压态、键盘焦点、减少动态和底栏避让。
- 运行/浏览器验证：pnpm smoke:browser 已通过；新增 390×844/320×844 登录及工作台断言，无横向溢出，五个底栏入口均不小于 44px，固定底栏贴底且内容预留空间，“更多”底部页含功能/账号分组，原管理员、成员、访客和访问记录流程无错误。
- 本地浏览器验证：1280×900、390×844、320×844 实际登录管理员并操作“更多”与账号区退出；桌面侧栏项均为 44px，手机底栏为 70px、内容预留 94px，原生 dialog 连续 Tab 后焦点仍锁定在页内，控制台无 warning/error。
- 无障碍回归：首次 `pnpm verify` 发现次文字色 `#788492` 的对比度为 3.81:1，低于 4.5:1；已将令牌调整为 `#6B7785`（4.56:1）、重新生成 CSS，并通过 5 个定向测试文件、23 项测试。
- 运行验证：Storybook build、Web typecheck、Web 生产构建、`pnpm smoke:check-core` 和修正后的 `pnpm verify` 均通过；全仓库 62 个测试文件、457 项测试通过，29 个数据库集成文件、252 项测试因本机没有测试 MySQL 跳过，仅有既有的大 chunk warning。
- 状态：UI2-03 checkpoint `11bb812` 已提交并推送；UI2-04 已完成实现、浏览器与全仓库验证，checkpoint 识别消息为 `feat(web): ship responsive application shell`，当前为“待用户复核”。

## 2026-08-14 Web UI 2.0 触屏月历

- 回归来源：生产月格由 `ab250646` 引入，移动端月历行为由 `db35a77` 引入，班次事件入口由 `7ac2a07` 引入，节假日由 `48c6fdd` 引入；Storybook 56px 横滑判定由 `b903c6d` 引入，已通过 `git log -S` 和 `git blame` 核对调用点。
- 测试先行：新增当前月默认今天、其他月份首个有班日期/1 日、56px 水平主导手势、连续多日节假日浅粉范围 4 项断言；旧实现因 3 个函数均不存在而 4/4 失败，实现后连同现有日历及 Storybook 回归共 5 个文件、31 项通过。
- 语义审计：月份按钮、年月输入和横滑均只写入原 `businessMonth`，继续由既有 watch/API 最新请求追踪器加载；选中日期仅在当前响应生效时赋值。筛选仍写入原 `membershipIds`/`roleIds`/`shiftTypeIds`/`onlyChanges`，过滤函数、空值和调用次数不变；月/周/列表及事件按钮链路未改。
- 变更：`MonthGrid` 新增受控 `selectedDate`/`select-date`，手机七列使用 9–12px 自适应总览字号且完整姓名自然换行；连续同名多日休假整段浅粉，单日节日不填充；手机筛选移入响应式 Sheet，桌面保留直接筛选；生产横滑与已确认 Storybook 共用 56px/1.2 倍水平意图函数。
- 运行/浏览器验证：pnpm smoke:browser 已通过；390px 实际验证默认今天、点触换选中、筛选 Sheet、左滑换月、垂直移动取消，无横向溢出或控制台错误，管理员/成员/访客原流程通过。新增 smoke 首次因 Sheet 关闭后的月历位于视口外而手势超时，测试显式滚动到月历后通过，产品代码未为测试特判。
- 运行验证：格式、lint、5 个定向测试文件、31 项测试、Web typecheck、Web build、Storybook build 和 `pnpm smoke:check-core` 均通过；仅有既有的大 chunk warning。checkpoint 识别消息为 `feat(web): add touch-first month calendar`。

## 2026-08-14 Web UI 2.0 选中日期值班轨道

- 回归来源：班次成员/电话展示沿用 `ab250646` 的 `DutyCell`，事件查询与弹窗链路由 `7ac2a07` 引入，实际人员优先与节假日/成员契约由 `48c6fdd` 完善；已复用上一任务的 `git log -S`/`git blame` 结果并逐调用点核对。
- 测试先行：先新增多人班次原排序、实际人员全名优先、电话确认状态、已排班/有变更/待安排状态和中文日期 2 项断言；旧实现因 `selected-date-duty` 模块不存在而失败，实现后 2/2 通过，连同月历定向回归共 4 个文件、25 项通过。
- 语义等价审计：详情模型只读取 `visibleAssignments` 和现有成员契约，不修改筛选或排班；确认号码使用 `tel:`，未确认号码只复制且不写后端。事件按钮仍只调用原 `openAssignmentEvents()` 一次，原 `getGroupEvents(groupId, { pageSize: 100, shiftId })` 的参数、await/catch/finally 和空事件语义不变；仅把展示容器从 TDesign Dialog 换为响应式 Sheet。
- 变更：月历下方新增医疗蓝值班轨道，完整展示班种、岗位、姓名、开始刻度、完整时间范围、现有变更标识、推导状态、电话和事件入口；所有详情操作至少 44px。新增生产组件 Story，包含确认长/短号、未确认号码和换班状态，便于 Storybook 独立复核。
- 运行/浏览器验证：pnpm smoke:browser 已通过；390×844/320×844 下轨道无横向溢出、姓名/时间无裁切、电话/事件操作不小于 44px，事件 Sheet 实际打开加载，底栏不遮挡最后操作；管理员、成员、访客和控制台原回归通过。
- 运行验证：Storybook build、`pnpm smoke:check-core` 和 `pnpm verify` 通过；全仓库 64 个测试文件、463 项测试通过，29 个数据库集成文件、252 项因本机无测试 MySQL 跳过。首次组合验证因外层 120 秒超时关闭管道产生 `EPIPE`，分开重跑后退出码 0，非产品或测试失败。checkpoint 识别消息为 `feat(web): add selected date duty track`。

## 2026-08-14 Web UI 2.0 请假与审批移动工作流

- 回归来源：请假新建表单、三组表格和审批 Dialog 均由 `0d5ec55` 引入，后续日期、影响班次和处理人字段分别由既有工作流提交补充；已通过 `git log -S` 与 `git blame` 核对当前调用点。
- 测试先行：新增 pending/approved/rejected 三态卡片色调与驳回确认文案断言，旧实现因函数不存在而 1 项失败；实现后请假逻辑 8/8 通过。
- 语义审计：初始加载继续以同一 `Promise.all` 调用我的申请、审批列表和默认策略；提交仍只调用一次 `createLeaveRequest` 并在成功后刷新，新增成功关闭 Sheet 仅改变展示状态。审批预览/批准保持原参数、版本、冲突确认、await/catch/finally；取消和撤销调用不变；驳回新增显式确认后仍使用原 API 参数。未修改权限、API、契约或数据结构。
- 变更：手机提供“我的请假/待我审批”分段入口，列表在窄屏变为信息完整的状态卡片；新建表单与审批预览统一迁入 `ResponsiveSheet`，保留桌面对话框和手机底部页行为。所有关键操作至少 44px，状态色使用 UI 2.0 语义令牌，危险操作无滑动手势。
- 运行/浏览器验证：pnpm smoke:browser 已通过；390×844/320×844 实际切换分段并打开新建请假底部页，无横向溢出，起止日期和表单内容完整，关键点触面不小于 44px，原管理员/成员/访客流程与控制台无错误。首次检查到 TDesign 内部 22px 文本节点，其真实外层为 44px，校验改测外层；跨视口分段测试状态重置后复跑通过，未修改产品行为规避测试。
- 运行验证：Web typecheck、生产 build、Storybook build 和 `pnpm verify` 均通过；64 个测试文件、464 项测试通过，29 个数据库集成文件、252 项因本机无测试 MySQL 跳过。并行 build/typecheck 曾在产物完成后触发 Windows Node 退出断言，串行复跑退出码均为 0；仅保留既有大 chunk warning。checkpoint 识别消息为 `feat(web): add mobile leave workflow cards`。

## 2026-08-14 Web UI 2.0 换班与加扣班移动工作流

- 回归来源：换班表单/列表由 `b20ff9b` 引入，管理员直接换班由 `6452fa9` 引入；加扣班表单/列表由 `5d8b205` 引入，管理员可选原因、已受理状态和可撤销归档分别由 `cbe2e89`、`de3acab`、`f65a57d` 补充。已对当前模板执行 `git log -S` 与 `git blame`。
- 测试先行：新增 pending、completed、rejected、cancelled、revoked 六种共享工作流状态的语义色调断言，旧实现因缺少 `getWorkflowStatusTone` 失败；实现后共享工作流、换班与加扣班定向测试 18/18 通过。
- 语义等价审计：两页初始加载仍分别维持原六项 `Promise.all`、群组/月变更重置和窗口聚焦刷新；预览、普通提交、管理员直办、接受、批准、驳回、取消、撤销及设置更新继续调用原 API 一次，参数、版本、`operationId`、可选原因、冲突重载、await/catch/finally 和空值语义未变。新增成功关闭对应 Sheet 只改变显示状态；危险操作继续使用原 confirm/prompt，未增加滑动删除。未修改权限、API、契约或数据结构。
- 变更：换班和加扣班的普通/管理员表单迁入 `ResponsiveSheet`；五类表格在 760px 以下变为完整字段卡片，待操作记录使用医疗蓝侧边强调，状态使用可访问语义徽标；桌面继续保持高密度表格。共用样式以 UI 2.0 令牌实现 44px 点触、320px 堆叠与减少动态。
- 运行/浏览器验证：`pnpm smoke:browser` 已通过；390×844/320×844 实际打开四个 Sheet，确认无横向溢出、移动记录为卡片、关键控件不小于 44px，动画结束后 Sheet 完整位于可视区，管理员/成员/访客原流程及控制台无错误。一次中间断言在入口动画首帧检测到预期的 24px 位移，改为动画完成后验收并复跑通过，产品代码未作测试特判。
- 运行验证：Web typecheck、生产 build、Storybook build、`pnpm smoke:check-core` 和 `pnpm verify` 均通过；64 个测试文件、465 项测试通过，29 个数据库集成文件、252 项因本机无测试 MySQL 跳过；仅保留既有大 chunk warning。checkpoint 识别消息为 `feat(web): add mobile shift workflow cards`。

## 2026-08-14 Web UI 2.0 成员、认领与事件移动卡片

- 回归来源：成员/认领表格、同名认领 Dialog 与联系方式入口由 `d117bb0` 引入；事件筛选、事件表格与详情 Dialog 由 `7ac2a07` 引入；访客访问表由 `4b33749` 引入。已对当前模板执行 `git log -S` 和 `git blame`。
- 测试先行：新增成员待认领/未认领/待审批/已认领和认领申请四态的语义色调断言，旧实现因缺少 `member-presentation` 模块失败；实现后成员呈现、名单解析与事件时间线定向测试 19/19 通过。
- 语义等价审计：成员初始加载仍保持原三项 `Promise.all`、请求版本防旧响应和群组版本刷新；更新角色、添加/转正/删除成员、转让群主、同名检测、创建/撤销/审批认领与联系方式保存继续调用原 API 一次，参数、await/catch/finally、空值和确认文案未变。手机“管理成员”只在关闭 Sheet 后转调原函数，原 confirm 仍是写入门禁。事件群组/筛选 watch、查询构造、分页拼接、详情和访客加载调用保持不变；新筛选组件继续把清空值归一为原空字符串，未增加 API、权限、契约或数据结构变更。
- 变更：成员、认领、事件和访客表在 760px 以下转为完整字段卡片；手机成员主操作直接显示，危险/次级操作进入明确管理 Sheet。联系方式、同名认领、事件筛选和事件详情统一迁入 `ResponsiveSheet`；事件关联链使用 UI 2.0 令牌、15px 叙事正文与 44px 折叠项，桌面表格和直接筛选保持高密度。
- 运行/浏览器验证：`pnpm smoke:browser` 已通过；390×844/320×844 下成员、认领、事件和访客卡片无横向溢出，桌面操作区在手机隐藏，实际打开成员管理、联系方式、事件筛选和详情四类 Sheet，所有关键点触与原始数据折叠项不小于 44px；管理员/成员/访客流程与控制台无错误。四组截图逐屏复核通过。
- 运行验证：Web typecheck、生产 build、Storybook build、`pnpm smoke:check-core` 和 `pnpm verify` 均通过；65 个测试文件、467 项测试通过，29 个数据库集成文件、252 项因本机无测试 MySQL 跳过；仅保留既有大 chunk warning。checkpoint 识别消息为 `feat(web): add mobile member and event cards`。

## 2026-08-15 Web UI 2.0 手动排班矩阵与排班补录触控

- 回归来源：手动矩阵、单元格与视图入口由 `6512274` 引入；排班补录基础页和月历绘制由 `927241c`、`000ed93` 引入，暂存确认链路由 `561310c` 完善。浏览器复核发现空月格在未传 `selectedDate` 时也会被选中，表达式由 UI2-05 的 `7c80488` 引入；以上调用点均已执行 `git log -S` 与 `git blame`。
- 测试先行：新增手动矩阵横向溢出、滚动方向/进度和边界容差测试，旧实现先因缺少 `manual-grid-interactions` 模块失败；新增空月格不应选中测试，旧实现先因缺少独立判定函数失败。实现后月历交互、手动矩阵交互和编辑器逻辑 3 个定向测试文件、19 项全部通过。
- 语义等价审计：手动排班配置、模板列表/历史、节假日、模板增删改、应用批次、草稿删除/预览、周期月历、变更预览、撤回/发布及补录查询/创建的 API 调用次数前后相同；参数、`await`、错误捕获、版本冲突、空值语义和确认流程未变。矩阵按钮和补录暂存移除均只调用原处理函数一次；`select-date`/`open-events` 事件次数未变。唯一独立行为修正为空月格不再误选。
- 变更：手动排班矩阵使用内部横向滚动、固定双层表头与人员首列、方向/进度提示和真实 44px 单元格按钮；移动端保持完整姓名/班次，并优化班次面板、清空操作和保存/应用布局。补录页增加当前配班状态、图标化月份切换、44px 班次/成员/暂存操作和手机全宽七列月历；危险动作继续显式确认，无滑动删除。
- 运行/浏览器验证：`pnpm smoke:browser` 已通过；1280×900、390×844、320×844 实际验证两页无横向溢出或底栏遮挡，矩阵可内部横滑、人员首列位置固定、表头固定、提示/进度随滚动更新、单元格 `aria-pressed` 切换，补录七列完整、空月格中性且关键控件不小于 44px。六张截图已逐屏复核。原 5173 开发进程缓存旧样式，最终使用独立当前源码 5174 服务验收并在完成后停止，未修改原外部进程。
- 运行验证：Web typecheck、生产 build、Storybook build、`pnpm smoke:check-core`、`pnpm verify` 和 `git diff --check` 均通过；全仓库 66 个测试文件、472 项测试通过，29 个数据库集成文件、252 项因本机无测试 MySQL 跳过，仅有既有大 chunk warning。checkpoint `1203dc7`（`feat(web): improve dense schedule interactions`）已推送。

## 2026-08-15 Web UI 2.0 统计、通知与导出响应式界面

- 回归来源：统计成员表与汇总界面由 `36127b0` 引入，当前单元格渲染还包含 `540856e4`/`5cd8860` 的后续调整；通知铃铛、中心和设置由 `52e9e1f` 引入，触发器视觉由 `5b00fa7` 调整，注册警告由 `eab3ff2` 补充；导出对话框由 `15729f8` 引入，后续选择器与角色命名由 `540856e4`/`5cd8860` 调整，首页导出触发器由 `5b00fa7` 调整。以上调用点均已执行 `git log -S` 与 `git blame`。
- 测试先行：新增统计 10 项汇总与横向滚动方向、通知业务语义色调、导出内容/周期摘要断言；旧实现因缺少 `getStatisticsSummaryItems`、`getStatisticsTableScrollHint`、`getNotificationTone` 和 `getExportSelectionSummary` 而 3 个文件、4 项失败（其余 11 项通过），实现后 3 个文件、15/15 通过。
- 语义等价审计：统计的 `getMonthStatistics`、`getYearStatistics`、`refreshMonthStatistics`、`recalculateStatistics`；通知设置的偏好/群组设置/推送订阅读写，通知列表的读取/单条已读/全部已读，铃铛的未读轮询与定时器；导出的配置、任务创建、轮询、下载和 CSV 保存调用次数逐项对比 `HEAD` 均相同。参数、`await`、catch/finally、空值归一、权限门禁和成功/错误路径未改；本批只替换显示容器并新增纯派生文案/滚动状态。
- 变更：统计页改为“值班台账”汇总，原 3 项主指标与 7 项辅助指标全部保留；成员表使用内部横向滚动、固定表头/成员首列及方向/进度提示。通知中心与导出迁入 `ResponsiveSheet`，通知设置改为响应式卡片；导出显示实时选择摘要、安全说明和显式取消/导出操作。手机控件不小于 44px，未增加滑动删除或隐式危险操作。
- 浏览器复核发现并修正两处真实问题：成员表滚动提示最初直接读取非响应式 DOM 值，滚动后文案不更新，改为保存响应式滚动状态；TDesign 通知输入外层最初仍为 32px，补齐真实 `.t-input` 根节点 44px。导出固定操作区会覆盖安全说明，已改为 Sheet 内正常滚动流并复核说明完整可见。
- 运行/浏览器验证：`pnpm smoke:browser` 已通过；1280×900、390×844、320×844 下统计页无页面横向溢出，3+7 指标完整，成员表可内部横滑且表头/成员首列固定，提示与进度随滚动更新；通知设置卡片单列全宽，通知中心和导出均贴底占满手机宽度，关键点触目标不小于 44px。管理员、成员、访客、vkey 与访问记录原流程和控制台无错误。最终截图目录为 `C:\Users\eylin\AppData\Local\Temp\schedule-smoke-yZkNpJ`。
- 运行验证：3 个定向测试文件 15/15、Web typecheck、Storybook build、`pnpm smoke:check-core`、`pnpm verify` 和 `git diff --check` 均通过；全仓库 66 个测试文件、476 项测试通过，29 个数据库集成文件、252 项因本机无测试 MySQL 跳过，仅保留既有大 chunk warning。首轮组合验证因外层 123 秒上限在 Vitest 阶段被终止，延长时限后完整 `pnpm verify` 真实退出码为 0。checkpoint `6ec287d`（`feat(web): polish statistics notifications and exports`）已推送。

## 2026-08-15 Web UI 2.0 群组、配置、访客与应用状态

- 回归来源：群组创建界面由 `1b5a17a` 引入，重新生成群组码由 `caf0a8e` 完善；排班配置及读取链路由 `04c7da3` 引入；访客月历由 `7c783c7` 引入，vkey 访问由 `4b33749` 增加；离线横幅由 `db35a77` 引入。`ResponsiveSheet` 的模板引用守卫由 `5b00fa7` 引入。以上调用点均已执行 `git log -S` 和 `git blame`。
- 测试先行：新增四位群组码保留前导零/角色文案、三步基础配置准备轨道、缺失/失效访客链接与离线只读文案断言；旧实现先因 `group-presentation.js`、`scheduling-config-presentation.js`、`app-state.js` 不存在而 3 个文件失败，实现后连同 PWA 响应式测试共 4 个文件、10/10 通过。
- 语义等价审计：群组创建、加入、名单、改名、重新生成群组码、退出、解散和恢复继续调用原处理函数一次，参数、await/catch/finally 和成功刷新未改；危险确认仅从 TDesign Dialog 换为原生焦点锁定 `ResponsiveSheet`。排班配置加载、新增/保存/删除班种、新增/删除岗位和保存岗位成员的调用次数与参数未改，“准备轨道”只读取已有配置。访客仍只按原 query vkey 调用公开日历 API，月份切换、错误映射和访问记录语义未改；离线展示继续复用 `offlineSubmitMessage`，没有队列或写入。首页群组错误只增加手动重试入口，仍调用原 `refreshGroups()`。
- 浏览器回归：新增 `ResponsiveSheet` 使用后，首次 smoke 先出现 `Cannot read properties of null (reading 'open')`；原因是异步 `nextTick` 返回时组件可能已卸载，模板引用为 `null` 而旧守卫只判断 `undefined`。修复仅将 ref 明确初始化为 `null` 并把空引用作为 no-op，打开/关闭分支、调用次数和事件语义不变。修复后复跑通过。
- 运行/浏览器验证：`pnpm smoke:browser` 通过；新增 1280×900、390×844、320×844 群组/配置/访客断言，以及 390×844、320×844 离线只读断言。无页面横向溢出，群组码四位完整，班种编辑分别为 6/2/1 列，访客月历保持完整七列，关键操作不小于 44px；解散确认 Sheet 实际打开。管理员、成员、访客 vkey、访问记录和控制台原流程无错误，最终截图目录为 `C:\Users\eylin\AppData\Local\Temp\schedule-smoke-yhFCbi`。
- 本地浏览器验证：实际以 390×844 打开缺失访客链接、群组管理和排班配置；状态卡宽 358px、页面无横向溢出，群组码四位完整且控件均达 44px，准备轨道为三步、班种编辑为两列。最终复位临时视口并关闭验收标签页。
- 运行验证：Web typecheck、Storybook build、`pnpm smoke:browser`、`pnpm verify` 和 `git diff --check` 通过；全仓库 69 个测试文件、482 项测试通过，29 个数据库集成文件、252 项因本机无测试 MySQL 跳过，仅保留既有大 chunk warning。smoke 曾因 5173 旧 Vite 进程提供旧访客组件而等待旧文案超时；确认进程属于本仓库后只重启前端预览，API 和数据未改，当前源码复跑通过。
- 状态：UI2-13/14 已完成，checkpoint 识别消息为 `feat(web): polish group config and guest states`；下一批次只做最终全局焦点、减少动态、安全区和跨视口收尾审计。

## 2026-08-15 Web UI 2.0 最终全局收尾审计

- 回归来源：全局 `body`、`#app` 和 `.app-layout` 的 `100vh` 由 `e38cdba` 引入，访客页全屏高度由 `7c783c7` 引入；`ResponsiveSheet` 的原生 dialog 打开/关闭与隐式焦点行为由 `5b00fa7` 引入。以上调用点已执行 `git log -S` 与 `git blame`。
- 测试先行：`global-ui-shell.spec.ts` 的动态视口用例在旧实现上先失败，证明全屏容器缺少 `100dvh`；扩展后的 `pnpm smoke:browser` 首次在 390px “更多”Sheet 首尾 Tab 循环处失败，随后新增组件级焦点锁定/回焦断言并在旧实现上再次失败。修复后定向 4/4 与完整浏览器冒烟均通过。
- 行为与语义审计：`100dvh` 仅在 `100vh` 后覆盖，不支持动态视口的浏览器继续使用回退；没有改变布局分支、数据加载或副作用。`ResponsiveSheet` 保持原 `visible` watch、`showModal`/`close`、`update:visible`、cancel/backdrop 和 slot 语义，新行为仅为记录触发器、聚焦首项、首尾 Tab 循环及关闭后回焦；打开/关闭事件与业务处理函数调用次数不变。未修改 API、契约、权限或数据库。
- 运行/浏览器验证：`pnpm smoke:browser` 已通过；覆盖登录、管理员、成员、访客、vkey 和访问记录，并在 1280×900、390×844、320×844 验证无页面横向溢出、桌面/手机导航切换、底栏避让、44px 点触、2px 可见键盘焦点、Sheet 双向焦点锁定与回焦、`prefers-reduced-motion` 动画时长和关闭入场动画。最终截图目录为 `C:\Users\eylin\AppData\Local\Temp\schedule-smoke-aVpdbz`。
- 本地可视化复核：Storybook 390/320px 节假日月历为完整七列，姓名无背景/无裁切，周末、节假日、加换、调休和多日节假日状态色均与确认规则一致；生产工作台在 1280/390/320px 无横向溢出，320px 内容底部预留 94px。实际键盘操作确认 Sheet 正向循环到“完成”、反向循环到“退出登录”，关闭后回到“更多”。Storybook 验收页继续由 `http://127.0.0.1:6006` 提供。
- 运行验证：`pnpm exec vitest run apps/web/src/pwa/global-ui-shell.spec.ts` 4/4、Web typecheck、Storybook build、`pnpm smoke:browser`、`pnpm verify` 和 `git diff --check` 通过；全仓库 70 个测试文件、486 项测试通过，29 个数据库集成文件、252 项因本机无测试 MySQL 跳过，仅保留既有大 chunk warning。checkpoint 识别消息为 `feat(web): complete UI 2.0 global audit`。
- 完成审计：UI2-01–14 与本轮已覆盖 Storybook 预览、设计令牌/应用框架、月历与手势、值班详情、工作流卡片/Sheet、矩阵/统计、群组/配置/访客/应用状态和全局无障碍/视口规则；所有原计划代码接口已落地，未发现剩余 Web UI 2.0 实现缺口。状态转为待用户整体验收。

## 2026-08-15 Web UI 2.0 正式发布与 D0796 验收

- 同步审计：服务器旧 release `056fc59` 的文件哈希与部署清单完全一致，没有服务器端手工漂移；本地 `main` 比生产新 18 个 UI 2.0 提交。生产和本地数据库结构均为 36 个迁移、45 张表、467 个字段；生产业务数据继续以服务器为准，没有复制密码哈希、令牌、联系方式或用本地演示数据覆盖生产。
- 发布保护：先创建加密数据库备份 `cd707b42-2687-408b-b0ed-1f13a2c1d27e`（44 张业务表、3257 行），再生成并部署不可变 release `5ae4941792db56119f08d07f1ba5543cc3f3b209`。迁移器确认无新增迁移，API/Web 容器健康重建，`ecs-verify.sh` 通过域名、未知 Host、端口、产物哈希、认证模式和 36 个迁移检查。
- 运行/浏览器验证：`pnpm verify`、串行 `pnpm smoke:browser`、`pnpm smoke:check-core`、`git diff --check`、公开首页/API 200 检查均通过；486 项测试通过，252 项数据库集成测试按本机配置跳过。首次 smoke 与全仓库构建并行时遇到 390px 访客卡片 HMR 瞬时状态，构建结束后在独立 5174 服务串行复跑通过，产品代码未修改。
- 正式账号复核：`D0796` 登录成功，账号 active，姓名“林恩宇”，在“头颈外科医生”群组中为 active owner；服务器运行配置确认平台管理员与节假日管理员均生效。桌面群组管理、成员、排班配置、事件和访客访问记录入口正常，未执行任何写操作。
- 正式移动端复核：390px/320px 页面无横向溢出，五个底栏按钮均为 59px 高并固定底部；320px“更多”底部页从视口底部展开，完整包含群组、排班、信息管理和账号区。状态转为待用户直接在正式站点做最终视觉验收。

## 2026-08-15 手机 Sheet 下拉框不可见回归

- 回归来源：手机月历筛选由 `7c80488` 引入，换班/加扣班表单迁入 Sheet 由 `2bb9fce` 引入；共用 `ResponsiveSheet` 的原生 `showModal()` 由 `5b00fa7` 引入。已对相关模板和调用点执行 `git log -S` 与 `git blame`。
- 根因：TDesign Select 默认把选项浮层挂到 `body`；原生模态 `dialog` 位于浏览器 top layer，浮层因此落在模态层之外而不可见、不可交互。
- 测试先行：新增回归测试后先因共享挂载策略模块不存在而失败；实现后 4/4 通过，并约束首页手机筛选 3 个、换班 7 个、加扣班 4 个 Select 全部复用同一挂载策略。
- 行为与语义审计：只把上述 Select 的浮层容器改为其最近的已打开 Sheet；选择值、`v-model`/`change`、选项生成、清空、预览/提交、异步错误路径、API 调用和调用次数均未改变。非 Sheet 场景继续使用 TDesign 默认 `body` 挂载语义。
- 运行/浏览器验证：`pnpm smoke:browser` 使用当前源码的隔离 5174 服务通过；390×844/320×844 实际点击首页筛选、换班和加扣班下拉框，选项层均位于已打开 Sheet 内且有可见尺寸，管理员、成员、访客和访问记录全流程无浏览器错误。首次运行命中 5173 上不含开发登录入口的外部进程而在登录门禁停止，未进入产品断言；未修改该进程。
- 运行验证：定向测试 4/4、Web typecheck、`pnpm verify`（71 个测试文件、490 项通过，29 个数据库集成文件、252 项因本机无测试 MySQL 跳过）和 `git diff --check` 通过，仅保留既有大 chunk warning。状态为“已完成”，checkpoint 识别消息为 `fix(web): keep sheet dropdowns visible`。
- 正式发布：发布前 `ecs-verify.sh` 通过并创建加密数据库备份 `48b7e00f-19b3-4577-aefa-dad10a0ad0bd`（44 张表、3701 行）；release `af37f5e4ecf5abcc86ac7460361bbfb47ba4c8c4` 部署成功，产物哈希、API/Web 容器、域名隔离、无开发认证依赖和 36 个迁移检查通过。部署未复制或覆盖本地数据库。
- 持续规则：用户要求今后每个完成并推送的仓库修改检查点都直接部署并线上核验；生产业务数据始终以服务器数据库为准，禁止用本地库、演示数据、凭据或会话覆盖生产。该规则写入根 `AGENTS.md`，最终状态 checkpoint 识别消息为 `docs(status): require production deployment after changes`，并作为最终 release 部署以保持服务器 release 与 Git `HEAD` 一致。
- 最终一致性：自动部署规则的收口 checkpoint 识别消息为 `docs(status): confirm automatic deployment policy rollout`；该 checkpoint 作为正式 release 部署后，以 Git `HEAD` 和服务器 `current-release` 相等为完成门禁，不再用发布后的追加文档提交制造新偏差。

## 2026-08-15 微信网站认证与 ICP 备案展示

- 来源定位：工作台应用壳与登录入口由 `e38cdba` 引入，访客入口由 `7c783c7` 引入；已对三个当前模板执行 `git log -S` 与 `git blame`。本轮不是回退既有功能，而是在ICP备案通过后补充统一合规页脚。
- 测试先行：认证文件上线前，公网验证 URL 返回 1136 字节应用首页 HTML；加入公共根目录文件后生产产物为指定 41 字节正文。ICP 页脚测试先因 `SiteComplianceFooter.vue` 不存在失败；实现后 2/2 通过，并约束登录、访客和已认证应用壳均接入同一组件。
- 行为与语义审计：认证文件只增加静态站点资源；ICP 页脚只渲染外部工信部链接。登录/注册、开发登录、访客解析、会话恢复、路由、API、错误路径、空值、权限和业务副作用均未修改，原调用次数不变。
- 运行/浏览器验证：`pnpm smoke:browser` 在正确启用 `AUTH_DEV_MODE=true` / `VITE_AUTH_DEV_MODE=true` 的当前源码服务下通过，覆盖登录、管理员、成员、访客 vkey 和访问记录，全流程无浏览器错误。首轮因 5173 未启动而连接失败，第二轮因开发认证开关未启用而在登录门禁停止，均未进入产品断言；按既有验收配置启动后原样复跑通过。
- 本地浏览器验证：1280×900 登录页及 390×844 登录、无 vkey 访客、已认证工作台均找到唯一的 `https://beian.miit.gov.cn/` 链接，文字为 `粤ICP备2026116116号-1`，链接实际点触高度均为 44px；390px 下底部导航避让后仍完整位于视口内。
- 生产认证文件：checkpoint `859f28d` 发布前后 `ecs-verify.sh` 通过；加密数据库备份 archive `0c70b166-8d94-4a51-920c-5922ca046753`（44 张表、4856 行），release `859f28d376e13f90dc4dced83c974aed12d84f5f` 已上线。公网验证 URL 返回 200、`text/plain`、41 字节且正文精确匹配。
- 运行验证：定向测试 2/2、Web typecheck、`pnpm smoke:browser`、`pnpm smoke:check-core`、`pnpm verify` 和 `git diff --check` 通过；全仓库 72 个测试文件、492 项测试通过，29 个数据库集成文件、252 项因本机无测试 MySQL 跳过，仅保留既有大 chunk warning。
- 正式发布：发布前 `ecs-verify.sh` 通过并创建加密数据库备份 `d6e8a335-c0cf-4a5f-8257-666d992a136b`（44 张表、4887 行）；release `fb192d3cbf83191b0e50fec4ffc6b68399d3245d` 部署成功，产物哈希、API/Web 容器、域名隔离、无开发认证依赖和 36 个迁移检查通过。
- 生产浏览器复核：1280×900 正式登录页、390×844 正式登录页和无 vkey 访客页均存在唯一备案链接，文案、目标 URL、`rel` 和 44px 点触高度正确；微信认证文件继续返回 200、`text/plain` 和精确 41 字节正文。
- 状态：微信认证文件和 ICP 页脚均为“已完成”，当前转为“待用户复核”；只等待用户在微信侧完成管理员认证/临时恢复并反馈结果。

## 2026-08-16 工作台紧凑抬头、月历与 ICP 范围精修

- 回归来源：常驻工作台介绍与顶部壳由 `5b00fa7` 引入，常驻四位群组码由 `056fc59` 引入，三类入口共用 ICP 页脚由 `fb192d3` 引入，触控月历与月份切换由 `7c80488` 引入；已对当前调用点执行 `git log -S` 与 `git blame`。
- 测试先行：新增正式工作台标题映射、紧凑群组选择器、登录页专属 ICP、圆角完整月历和周末红字断言；旧实现定向运行 8 项失败、8 项通过，实现后连同 Storybook 预览共 4 个文件、22/22 通过。
- 变更：移除占空间的产品 Logo/“医护排班”招牌、工作台介绍、重复群组标题与常驻群组码；顶部改为“群组名称 · 身份 + 下拉”及当前功能标题，通知/导出保持同排。日历复用 Mobile Screens 2 的 44px 紧凑分段、18px 圆角六周月历、月份切换、选中日期胶囊和周末红字；换班与加扣班复用同一标题位置。ICP 仅登录页显示，透明融入画布并保留 44px 点触与浅蓝焦点反馈。
- 语义审计：`GroupSwitcher` 保留 `modelValue`/`update:modelValue` 契约、一次 emit 与同一群组持久化/返回日历链路；通知铃从应用壳移入工作台但轮询和打开行为不变，退出仍转调同一 `signOut`，导出仍只打开原对话框。月份切换、年月输入、触控手势、筛选、日期选择、值班详情、加载与错误路径继续调用原处理函数一次；本轮未修改 API、权限、认证、路由、数据库或共享契约。ICP 的链接、文案、`target` 与 `rel` 不变，仅按用户要求缩小渲染范围。
- 运行/浏览器验证：`pnpm smoke:browser` 通过；1280×900、390×844、320×844 下紧凑抬头高度 68px、群组入口不少于 44px、页面无横向溢出，完整六周月历为 18px 圆角，月/周/列表/筛选字体不大于 13px，星期六/日及所属日期为红字。工作台/换班/加扣班标题随底栏切换且无旧招牌、介绍、全局群组码或 ICP；登录页备案链接透明融入画布并保持 44px。管理员、成员、访客、vkey 与访问记录原流程及控制台无错误，最终截图目录为 `C:\Users\eylin\AppData\Local\Temp\schedule-smoke-SNFidG`。
- 预览与构建：Storybook 提供 390/320/1280 工作台、换班、加扣班与登录页页脚预览；正式 390px 工作台截图逐屏复核通过。Web typecheck、Storybook build、`pnpm smoke:check-core`、`pnpm verify` 与 `git diff --check` 通过；全仓库 74 个测试文件、505 项测试通过，29 个数据库集成文件、252 项因本机无测试 MySQL 跳过，仅保留既有大 chunk warning。
- 正式发布：代码 checkpoint `daff238` 已推送；发布前 `ecs-verify.sh` 通过并创建加密数据库备份 `43f639de-86a9-4090-9209-e46b443310b7`（44 张表、5245 行）。release `daff238e241c0b6d9c04f0c8b21b5cca3b356ca4` 部署成功，迁移器确认仍为 36 个迁移，API/Web 容器、产物哈希、正式域名、未知 Host 拒绝和无开发认证依赖检查通过。
- 生产浏览器复核：使用正式 `D0796` 会话在 390×844 核对工作台抬头 68px、群组选择目标 44px、月历圆角 18px、无横向溢出、无产品招牌/全局群组码/ICP；星期六、日及对应日期计算色均为 `rgb(224, 49, 49)`。实际切换换班和加扣班后顶部标题分别正确，内容区不再重复标题；未触发任何业务写入。最终状态 checkpoint 识别消息为 `docs(status): record compact workbench production deployment`。

## 2026-08-16 月历跨午夜业务日修复

- 回归来源：`getChinaStandardTimeBusinessDate` 由 `7a16c85` 统一，`getCurrentBusinessMonth` 的当前月边界由 `927241c` 引入；`CalendarView` 的当前月、业务日和默认选中日期调用点已执行 `git log -S` 与 `git blame`。
- 测试先行：先增加“00:00 后仍为上一业务日、08:00 才交接”和月初当前月边界断言；旧实现定向运行失败 3 项，实现后三个定向文件 24/24 通过。完整 `pnpm verify` 通过：74 passed、29 skipped，506 passed、252 skipped（本机无测试 MySQL）。
- 语义审计：仅将业务日边界从 00:00 调整为中国标准时间 08:00；`formatChinaDateTime` 的自然时间展示、`toChinaStandardTimeShiftRange` 的跨午夜范围、日期选择/月份 API 参数、错误路径、权限、契约和数据库均保持原语义。00:00–07:59 的当前月、过去日期锁定及默认日期统一落在上一业务日，08:00 起切换。
- 运行/浏览器验证：`pnpm smoke:check-core` 通过；专项月历浏览器断言通过，当前 00:xx 环境默认选中 `2026-08-15`。完整 `pnpm smoke:browser` 已通过月历交互与新日期断言，随后在未纳入本轮的并发 `MonthGrid`/手动排班横滑改动处失败（固定列或进度提示断言），因此不报告完整 smoke 通过。当前工作区复跑 `pnpm verify` 唯一失败为 `workbench-shell-refinement.spec.ts` 仍断言旧 `.t-radio-button`，与并发未提交的原生 `.view-mode-button` 改动冲突；不修改该用户变更。提交前还需复核 `git diff --check`。
- 本轮变更文件仅为 `packages/scheduling-domain/src/time.ts`、对应测试、两个月历 helper 测试和 `scripts/smoke-browser.mjs`；工作区中其他 UI 文件保持用户改动，不纳入提交。
- 状态：已完成（含月历专项浏览器验证）→ 待用户复核；checkpoint 识别消息为 `fix(web): keep calendar on previous duty date until handover`。

## 2026-08-16 Mobile Screens 2 月历视觉一致性

- 引入点：月历工具栏和移动样式来自 `7c80488`，通知入口来自 `52e9e1f`/`5b00fa7`，月格结构来自 `ab25064`；相关调用点已完成 `git log -S` 和 `git blame`。
- 测试先行：新回归测试在旧实现上因缺少 42 格展示模型而失败；实现后新增测试 4/4、工作台壳测试 5/5 通过。`pnpm smoke:browser` 首轮因 5173 未启动停止，服务启动后先定位到相邻月禁用格，修正 smoke 只选择可用当月日期后全流程通过。
- 行为变化：月/周/列表与筛选控件、通知铃、星期栏和月格比例按 Storybook Mobile Screens 2 的量测值实现；月历固定六周 42 格并显示相邻月日期，相邻日期不可选。API、权限、业务日期、筛选值、月份切换、通知轮询和抽屉行为未改。
- 运行/浏览器验证：390×844 实测分段容器 50px、按钮 44px/13px、筛选 44px/13px、通知 44px/15px 圆角、星期栏 28px，月格 49×49；320×844 月格约 41×41，两个视口均无内容横向溢出。1280×900、月/周/列表切换、筛选及通知 Sheet 均复核通过。
- 运行验证：Storybook build、Web typecheck、`pnpm smoke:browser`、`pnpm smoke:check-core`、`pnpm verify` 和 `git diff --check` 通过；75 个测试文件、510 项测试通过，29 个数据库集成文件、252 项因本机无测试 MySQL 跳过。checkpoint 识别消息为 `fix(web): match mobile calendar Storybook styling`。
- 正式发布：发布前 `ecs-verify.sh` 通过并创建备份 `fa99e3d2-0dbf-472a-8837-3fbde4dfbe2e`（44 张表、5367 行）；release `abd20d2aa94ce3425bff446047db094542aa2466` 部署及复核通过。
- 生产浏览器复核：390px 月格 49×49、320px 月格 41.14×41.14，均为完整 42 格且无内容横向溢出；星期栏填充、周末红字、相邻月日期、工具栏、通知铃、月/周/列表、筛选与通知 Sheet 均通过。未触发业务写入。最终状态 checkpoint 识别消息为 `docs(status): record mobile calendar parity deployment`。
