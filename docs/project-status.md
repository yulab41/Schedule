# Project Status

本文档只记录当前可安全接续的状态；详细历史以 Git 提交为准。

## 当前状态（2026-08-14）

- 分支：`main`，上游：`origin/main`。
- 正式入口：`https://hosp.schedule.eylinhome.top`。仓库当前生效配置不使用服务器公网 IP URL。
- Checkpoint 1（网站微信扫码认证）和 Checkpoint 2（域名专属入口、测试通道收口）已完成并已推送：`12e7f40`、`dec9943`。
- 用户确认无法取得微信开放平台网站应用，改用正式账号密码注册/登录。本轮已实现后端密码认证、前端注册/登录、scrypt 哈希、生产配置和迁移 0036；网站扫码代码暂保留为未来可选能力，但生产配置不依赖它，正式页面不显示扫码入口。
- 小程序凭据仍只用于小程序登录和通知。用户在聊天中发送过的小程序 AppSecret 按“已暴露”处理：本轮没有把它写入仓库、新 release 或服务器；通知功能正式验收前必须重置。小程序代码上传 `.key` 文件不是网页登录凭据，不需要上传或提交。
- 正式 release `056fc59fa31cc7be93afc746bb592dcde6621a12` 已部署；数据库备份 archive 为 `cee6bda8-ec2b-4dec-979b-52ab8aeacf97`。迁移 0035/0036 已成功执行，现网首页/API 健康。
- 本轮变更已上线：密码不再有最小/最大位数限制，仅拒绝空密码；登录页已移除“首次使用请先注册账号”和微信 AppID/AppSecret 提示。
- 旧 `local-admin` / `local-member` 账号已保留关联业务数据并退役为 suspended，不再是可用认证身份；用户正式账号 `D0796` 已映射为稳定的密码认证 UID，并写入生产 `PLATFORM_ADMIN_UIDS` / `HOLIDAY_ADMIN_UIDS`。
- 原有的 1 个正式群组已在生产数据库中转移到 `D0796` 名下；`D0796` 的群组成员角色为 `owner`，显示姓名为“林恩宇”。原群组及排班数据保留，旧退役账号的成员记录保留为历史管理员记录。
- 群组页面展示修复已完成并上线：工作台和群组管理页会明确显示当前群组、角色和四位群组码，重新生成群组码后会刷新并显示新码。
- 小程序 AppSecret 仍按“已暴露”处理，尚未通过聊天内容写入服务器；需要用户在微信平台重置后再更新服务器通知配置。现有服务器会话密钥已存在，网站 AppID/AppSecret 不再是阻塞项。
- 用户已明确放弃 Figma 预览，改用 Storybook + 本地浏览器验收；用户已确认整体视觉、月格密度、底栏与详情结构，生产 UI 已进入分批实现。
- Web UI 2.0 Task UI2-03/04/05/06/07/08 已分别以 `11bb812`、`5b00fa7`、`7c80488`、`1c84fd6`、`2d6f0a2`、`2bb9fce` 推送；UI2-09 成员、成员认领与事件记录手机卡片已完成实现和验证，等待独立 checkpoint。业务逻辑、权限、API 和数据结构未修改。

## 本轮已完成

- 新增 `POST /auth/password/register` 和 `POST /auth/password/login`，账号格式为 3-64 位字母、数字或 `._-`，密码可自由设置长度但不能为空。
- 新增 `user_password_credentials` 表和迁移 `0036_password_credentials`；不覆盖 `users.wechat_openid` 或现有小程序身份映射。
- 密码使用随机盐 scrypt 哈希；会话使用 `provider=password` 的签名 token，认证端会检查用户 active 状态。
- 生产配置要求 `AUTH_PASSWORD_ENABLED=true`、长度至少 32 的 `WECHAT_SESSION_SECRET`，并继续拒绝 `AUTH_DEV_MODE=true` 与 `WECHAT_MOCK_MODE=true`。
- Web 生产登录页改为账号登录/注册；本地开发构建仍保留仅开发模式可见的 smoke 登录按钮。
- Compose、ECS 核验脚本、迁移计数、部署文档和当前环境模板已同步。
- 用户账号 `D0796` 已确认处于 active 且资料已建立；服务端已授予平台管理员和节假日管理权限，并仅重建 API 容器使配置生效。
- 本轮任务 checkpoint commit：`docs(status): record formal administrator configuration`。
- 已通过单事务完成原群组群主转让：群组 `owner_user_id`、`D0796` 的 `owner` 成员关系和旧账号的历史 `administrator` 关系保持一致；未删除群组、排班或用户数据。
- 群组页面回归修复已完成并部署：增加当前群组/群组码展示、重新生成群组码后的新码提示和浏览器回归断言；代码 checkpoint commit 为 `056fc59`。
- 本轮任务 checkpoint commit：`docs(status): record original group ownership transfer`。
- 发布诊断发现生产既有 `users.id` 使用 `utf8mb4_0900_ai_ci`，新增迁移 0035/0036 原使用 `utf8mb4_unicode_ci`，MySQL 拒绝外键；已将两份新增迁移改为 `utf8mb4_0900_ai_ci`，不涉及删除表或改动既有业务数据。
- checkpoint commit：`de3ad5f feat(auth): add production password authentication`。
- Web UI 2.0 Task UI2-01：安装并隔离 Storybook 10.5.8（Vue 3 + Vite），加入 Docs/A11y、390/320/1280 视口、构建脚本和本地产物忽略规则；预览构建不会再改写生产 `components.d.ts`。
- Web UI 2.0 Task UI2-02：完成四个 Apple Health 式手机预览、密集七列月历、完整姓名与换/加标识、56px 横滑判定、44px 点触目标、底部导航、响应式底部页及蓝色“值班轨道”。测试先行的红灯为缺少 `preview-interactions.js`，实现后 4 项横滑判定通过。
- 本轮 checkpoint 识别消息：`feat(web): add Storybook mobile UI previews`。
- Web UI 2.0 Task UI2-02 反馈精修：姓名取消背景填充；节假日、调休“班”、加/换标识分别复用现有 Web 红/蓝/黄徽标配色；星期六/日表头改为周末红；连续多日节假日单元格使用浅粉背景。新增真实 2026 年 10 月 1–7 日国庆及 10 月 10 日调休 Story，不伪造 8 月节日数据。
- 视觉行为来源已定位到 `b903c6d`，并通过 `git log -S`/`git blame` 确认原姓名背景、节假日文字和蓝色事件标识均由该 Storybook checkpoint 引入。本轮 checkpoint 识别消息：`fix(web): refine Storybook calendar states`。
- Web UI 2.0 Task UI2-03：`@schedule/ui-tokens` 已对齐确认稿的 `#0A66D5` 主色、画布/表面/文字/分隔语义色、4–32px 间距、15px 正文、20/28px 标题、10/14/18px 圆角、阴影、44/50/56px 点触目标、安全区底栏和减少动态令牌；CSS 继续由单一 TypeScript 源生成。Web 已统一映射 TDesign 主题变量，并将现有 `tdesign-icons-vue-next@0.4.7` 声明为直接依赖。本 checkpoint 识别消息：`feat(ui): establish Web UI 2.0 foundations`。
- Web UI 2.0 Task UI2-04：生产登录页、顶部栏、群组上下文、桌面图标侧栏和手机五入口底栏已使用同一令牌体系；“更多”使用桌面对话框/手机底部页共用接口，包含功能分组和账号退出，并支持安全区、44px 点触目标、键盘焦点锁定和减少动态。角色过滤、导航顺序、登录/退出调用链保持不变。本 checkpoint 识别消息：`feat(web): ship responsive application shell`。
- Web UI 2.0 Task UI2-05：生产 `MonthGrid` 新增受控选中日期和 `select-date`，当前月默认今天、其他月份默认首个有班日期或当月 1 日；手机保留七列全月、完整姓名、周末红、红/蓝/黄徽标和连续多日节假日浅粉背景。56px 水平主导手势复用 Storybook 已确认判定，手机筛选收进响应式底部页，桌面直接筛选、月份按钮、年月选择及月/周/列表入口保留。本 checkpoint 识别消息：`feat(web): add touch-first month calendar`。
- Web UI 2.0 Task UI2-06：月历下方新增医疗蓝“值班轨道”，按原时间/岗位顺序显示选中日期、班种、完整人员姓名、岗位、完整时间范围及从现有数据推导的已排班/有变更/待安排状态；确认电话直接拨打、未确认电话复制，事件入口沿用原 shiftId 查询。班次事件从 TDesign Dialog 迁移到桌面对话框/手机底部页共用的 `ResponsiveSheet`，并新增可独立验收的生产组件 Story。本 checkpoint 识别消息：`feat(web): add selected date duty track`。
- Web UI 2.0 Task UI2-07：请假页增加“我的请假/待我审批”手机分段入口，桌面继续并列呈现信息；请假、待审批和已处理列表在 760px 以下变为完整信息卡片，姓名、类型、日期、原因、策略、状态与处理人均保留。新建请假和审批预览统一使用桌面对话框/手机底部页共用的 `ResponsiveSheet`；取消、撤销和驳回继续使用显式操作与确认，不增加滑动删除。本 checkpoint 识别消息：`feat(web): add mobile leave workflow cards`。
- Web UI 2.0 Task UI2-08：换班和加扣班的新建/管理员直办表单统一迁入 `ResponsiveSheet`，桌面为对话框、手机为底部页；五类记录列表在 760px 以下切换为信息完整卡片，状态使用语义徽标，待处理卡片保留明确主操作。拒绝、取消和撤销继续使用原显式按钮及确认流程，不增加滑动删除；成功提交后仅关闭对应 Sheet。本 checkpoint 识别消息：`feat(web): add mobile shift workflow cards`。
- Web UI 2.0 Task UI2-09：成员名单、身份认领申请、事件记录和访客访问记录在 760px 以下改为完整字段卡片；手机成员卡直接保留转正、认领和联系方式等主操作，角色、转让、撤销认领和删除集中到明确的“管理成员”Sheet，所有危险写入继续使用原确认框且无滑动删除。联系方式、同名认领、事件筛选和事件详情统一使用 `ResponsiveSheet`；桌面成员/事件表格和直接筛选保持高密度。本 checkpoint 识别消息：`feat(web): add mobile member and event cards`。

## 已运行验证

- `pnpm install --frozen-lockfile`：通过；此前本机生产依赖安装清理了开发依赖，已按锁文件恢复。
- API、Contracts、Database、Web 类型检查：通过（API/Contracts/Database 使用 `tsc`，Web 使用 `vue-tsc`）。
- `pnpm --filter @schedule/api test`：通过，88 个单元测试通过，26 个数据库集成文件因本机没有测试 MySQL 跳过；新增密码哈希/会话测试通过。
- `pnpm verify`：通过；60 个测试文件、447 个测试通过，29 个数据库集成文件因本机没有测试 MySQL 跳过。
- `pnpm smoke:browser`：通过；现有开发管理员、开发成员、访客排班和访客访问记录流程无浏览器错误，本轮登录页变更构建通过。
- `pnpm smoke:check-core`：通过；已在 `docs/debug/debug-feedback-log.md` 记录“运行/浏览器验证：pnpm smoke:browser …”。
- `pnpm --config.production=false --filter @schedule/database test`：通过（本机无测试 MySQL，14 个数据库测试跳过）。
- `bash /tmp/ecs-verify.sh`：通过；release `056fc59` 的正式域名/API、未知 Host 拒绝、共享入口端口、产物哈希、无开发认证依赖、无 `local-admin`/`local-member` 记录、迁移计数 36 均通过。
- 生产管理员配置复核：`D0796` 对应账号为 active、资料已建立；API 容器中的平台管理员/节假日管理员配置均已生效，健康接口返回 200。
- 群组数据复核：原群组的群主为 `D0796`，存在 1 条 active owner 成员关系和 1 条旧账号 administrator 历史关系，原有 2 个排班周期仍在，健康接口返回 200。
- 群组页面验证：旧实现的新增回归断言先失败；修复后 `pnpm smoke:browser`、`pnpm smoke:check-core`、Web 类型检查和 `pnpm verify` 均通过，60 个测试文件、447 个测试通过。
- 正式发布验证：`ecs-update.sh` 成功部署 release `056fc59`；正式 API 健康接口返回 200，使用 `D0796` 服务端身份读取 `/api/groups` 返回原群组、角色 `owner` 和四位群组码。
- 生产负向验收：弱注册请求返回 400、未知账号登录返回 401、`local-admin` Bearer token 返回 401；未创建测试账号。
- 发布过程：首次发布因数据库外键排序规则不兼容自动回滚；修正迁移后 release `c358109` 发布成功，本轮 release `72f1076` 又完成密码策略和登录页文案更新，现网使用 `NODE_ENV=production`、`AUTH_DEV_MODE=false`、`AUTH_PASSWORD_ENABLED=true`。
- 已确认部署产物不再包含旧登录提示或“至少 8 位”文案；一位密码的未知账号请求返回 401 而非长度校验 400。
- `pnpm --filter @schedule/web storybook:build`：通过；Storybook 10.5.8 预览静态构建成功，仅有工具自身的既有大 chunk 提示。
- Storybook 本地浏览器：390×844 四屏、320×844 月历均无页面横向溢出；可见操作无小于 44px 的点触目标；完整姓名无裁切；底栏不遮挡最后一个电话操作；筛选/更多底部页、登录/注册、请假/审批和左滑 8 月→9 月均已实际操作；控制台无 warning/error。
- `pnpm test apps/web/src/stories/ui2/preview-interactions.spec.ts`：通过，4/4；`pnpm --filter @schedule/web typecheck`：通过。
- `pnpm smoke:browser`：通过，覆盖登录、管理员、成员、访客及访客访问记录；`pnpm smoke:check-core`：通过，本轮未涉及核心链路文件。
- `pnpm verify`：通过；格式、lint、全仓库构建、类型检查及测试通过，61 个测试文件、451 个测试通过，29 个数据库集成文件因本机没有测试 MySQL 跳过。
- 月历视觉反馈测试先因缺少 `preview-calendar.js` 失败；实现后周末列、多日节假日、单日标识和调休工作日 4 项判定通过，连同横滑测试共 8/8 通过。
- Storybook 反馈复核：390×844/320×844 下姓名和标识均无裁切、无横向溢出、可见操作不小于 44px；计算样式确认姓名透明背景，红/蓝/黄徽标与现有 Web 一致，国庆连续 7 个单元格均为 `rgb(255, 245, 245)`，星期六/日为周末红；稳定页面控制台无 warning/error。
- 反馈轮次 `pnpm --filter @schedule/web storybook:build`、Web typecheck、`pnpm smoke:browser`、`pnpm smoke:check-core` 和 `pnpm verify` 均通过；全仓库为 62 个测试文件、455 个测试通过，29 个数据库集成文件因本机没有测试 MySQL 跳过。
- UI2-03 测试先行：新令牌、字号/间距/点触尺度及强类型导航图标断言在旧实现上 6 项失败；实现并重建令牌包后，4 个定向测试文件、18 项测试通过。
- UI2-03 验证：令牌生成一致性测试、UI Tokens/Web typecheck、Web 生产构建及扩展后的 `pnpm smoke:browser` 均通过；生产构建仅有既有的大 chunk warning。
- UI2-04 测试先行与定向验证：导航图标断言在旧实现上失败、实现后通过；最终 5 个定向测试文件、23 项测试通过。首次完整验证发现次文字色 `#788492` 的对比度仅 3.81:1，已调整为 `#6B7785`（4.56:1）并重新生成 CSS，无障碍对比度测试通过。
- UI2-04 浏览器验证：`pnpm smoke:browser`、`pnpm smoke:check-core`、Web typecheck、Web 生产构建和 Storybook build 均通过；1280×900、390×844、320×844 下无页面横向溢出或底栏遮挡，桌面侧栏、手机底栏和 Sheet 操作达到 44px，原生 dialog 焦点锁定与账号区退出通过，控制台无 warning/error。
- UI2-04 全仓库验证：`pnpm verify` 通过，格式、lint、构建、类型检查全部通过；62 个测试文件、457 项测试通过，29 个数据库集成文件、252 项测试因本机没有测试 MySQL 跳过；仅保留既有的生产大 chunk warning。
- UI2-05 测试先行：默认日期、跨月首个班次、56px 横滑/垂直取消和多日节假日 4 项测试在旧实现上全部因缺少实现失败；实现后连同既有日历与 Storybook 测试共 5 个文件、31 项通过，格式、lint、Web typecheck、生产 build 和 Storybook build 通过。
- UI2-05 浏览器验证：扩展后的 `pnpm smoke:browser` 通过，实际覆盖 390px 默认今天、点触换选中日期、筛选底部页、左滑换月、垂直移动取消，原管理员/成员/访客流程无错误；手机月历无横向溢出，姓名无截断，筛选操作和固定底栏达到 44px。`pnpm smoke:check-core` 通过；仅有既有的大 chunk warning。
- UI2-06 测试先行：多人班次排序、实际人员优先、电话确认状态、三种可解释状态和中文日期 2 项测试先因缺少详情模型模块失败，实现后 4 个定向测试文件、25 项通过；Web typecheck 和扩展后的浏览器 smoke 通过。
- UI2-06 浏览器验证：390×844 与 320×844 下值班轨道无横向溢出，完整姓名/时间范围无裁切，电话和事件操作均不小于 44px；事件响应式 Sheet 实际打开并加载，固定底栏不遮挡详情，管理员/成员/访客原流程和控制台保持无错误。
- UI2-06 全仓库验证：Storybook build 通过并包含生产值班轨道 Story；`pnpm verify` 通过，格式、lint、全部构建与类型检查通过，64 个测试文件、463 项测试通过，29 个数据库集成文件、252 项测试因本机没有测试 MySQL 跳过。首次组合命令仅因 120 秒外层超时关闭输出管道产生 `EPIPE`，分开以 5 分钟预算重跑后真实退出码为 0；仅有既有的大 chunk warning。
- UI2-07 测试先行：新增请假状态可访问色调与明确驳回确认文案断言，旧实现因缺少两个函数而 1 项失败，实现后请假逻辑 8/8 通过。表单/列表和审批 Dialog 的引入点均定位到 `0d5ec55`，并已用 `git log -S`、`git blame` 核对。
- UI2-07 浏览器验证：扩展后的 `pnpm smoke:browser` 通过；390×844/320×844 实际切换“我的请假/待我审批”，打开新建请假底部页，检查起止日期、无页面横向溢出及关键点触面不小于 44px，管理员/成员/访客原流程与控制台保持无错误。首次尺寸断言识别到 TDesign 内部 22px 文本输入，但其真实可点击外层为 44px，校验已改为测量外层；第二次因跨视口未重置测试分段状态失败，显式恢复“我的请假”后通过，均未用产品代码绕过。
- UI2-07 全仓库验证：Web typecheck、生产 build、Storybook build 和 `pnpm verify` 通过；全仓库 64 个测试文件、464 项测试通过，29 个数据库集成文件、252 项测试因本机无测试 MySQL 跳过。一次并行启动 build/typecheck 在 Vite 完成产物后触发 Windows Node `UV_HANDLE_CLOSING` 退出断言，串行复跑两项真实退出码均为 0；仅保留既有的大 chunk warning。
- UI2-08 测试先行：新增六种换班/加扣班状态的语义色调断言，旧实现因缺少 `getWorkflowStatusTone` 失败；实现后工作流、换班和加扣班 3 个定向测试文件、18 项测试通过。换班表单/列表来源定位到 `b20ff9b`、管理员直办定位到 `6452fa9`；加扣班表单/列表定位到 `5d8b205`，后续可选原因、已受理状态和可撤销归档分别定位到 `cbe2e89`、`de3acab`、`f65a57d`，均已用 `git log -S` 和 `git blame` 核对。
- UI2-08 浏览器验证：扩展后的 `pnpm smoke:browser` 通过；390×844/320×844 实际打开换班、管理员直接换班、发起加扣班和管理员直接代值四个 Sheet，检查移动卡片、无页面横向溢出、关键控件不小于 44px，且动画完成后 Sheet 完整位于可视区；管理员/成员/访客原流程与控制台保持无错误。视觉截图已复核，表单支持内部纵向滚动且底栏不遮挡操作。
- UI2-08 全仓库验证：Web typecheck、生产 build、Storybook build、`pnpm smoke:check-core` 和 `pnpm verify` 通过；全仓库 64 个测试文件、465 项测试通过，29 个数据库集成文件、252 项测试因本机无测试 MySQL 跳过；仅保留既有的大 chunk warning。
- UI2-09 测试先行：新增成员身份状态和认领审批状态语义色调断言，旧实现因缺少 `member-presentation` 模块失败；实现后成员呈现、名单解析和事件时间线 3 个定向测试文件、19 项测试通过。成员/认领表格、同名认领与联系方式入口定位到 `d117bb0`，事件表格/详情定位到 `7ac2a07`，访客记录定位到 `4b33749`，均已用 `git log -S` 和 `git blame` 核对。
- UI2-09 浏览器验证：扩展后的 `pnpm smoke:browser` 通过；390×844/320×844 实际检查成员/认领、事件和访客卡片，打开成员管理、联系方式、事件筛选和事件详情 Sheet；页面无横向溢出，桌面密集操作区在手机隐藏，表单、卡片操作和详情折叠项均不小于 44px，管理员/成员/访客原流程和控制台保持无错误。四组截图已逐屏复核。
- UI2-09 全仓库验证：Web typecheck、生产 build、Storybook build、`pnpm smoke:check-core` 和 `pnpm verify` 通过；全仓库 65 个测试文件、467 项测试通过，29 个数据库集成文件、252 项测试因本机无测试 MySQL 跳过；仅保留既有的大 chunk warning。

## 下一批次与停止条件

下一批次为：

1. UI2-10：只改手动排班矩阵和排班补录的数据密集交互；保留横向滚动并固定表头/关键首列，提供滚动提示和 44px 单元格触控反馈；
2. UI2-10 完成后停止，不提前改统计表、通知/导出或全局收尾；
3. 原生产待办继续保留：人工复核 `D0796` 的群主/管理员页面，并在微信平台重置已暴露的小程序 AppSecret 后再验收通知功能。

停止条件：先为已完成并验证的 UI2-09 创建、推送独立 checkpoint；下一实现对话只完成 UI2-10，浏览器与全仓库验证通过后停止。
