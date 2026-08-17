# Project Status

本文档只记录当前可安全接续的状态；详细历史以 Git 提交为准。

## 当前状态（2026-08-17）

- 分支：`main`，上游：`origin/main`。
- 正式入口：`https://hosp.schedule.eylinhome.top`。仓库当前生效配置不使用服务器公网 IP URL。
- 工作台紧凑抬头、完整圆角月历与登录页专属 ICP 精修已完成并上线：代码 checkpoint `daff238` 已推送，生产 release 为 `daff238e241c0b6d9c04f0c8b21b5cca3b356ca4`。发布前加密数据库备份 archive 为 `43f639de-86a9-4090-9209-e46b443310b7`（44 张表、5245 行）。最终状态 checkpoint 识别消息为 `docs(status): record compact workbench production deployment`。
- 微信网站管理员认证文件已加入 Web 公共根目录并上线；checkpoint `859f28d` 已推送，生产 release 为 `859f28d376e13f90dc4dced83c974aed12d84f5f`。发布前加密数据库备份 archive 为 `0c70b166-8d94-4a51-920c-5922ca046753`（44 张表、4856 行）。
- ICP 合规页脚最初由 checkpoint `fb192d3` 接入登录、访客和已认证应用壳；本轮已按用户确认调整为仅登录页显示，并保留备案文案、链接、安全属性和 44px 点触目标。
- Checkpoint 1（网站微信扫码认证）和 Checkpoint 2（域名专属入口、测试通道收口）已完成并已推送：`12e7f40`、`dec9943`。
- 用户确认无法取得微信开放平台网站应用，改用正式账号密码注册/登录。本轮已实现后端密码认证、前端注册/登录、scrypt 哈希、生产配置和迁移 0036；网站扫码代码暂保留为未来可选能力，但生产配置不依赖它，正式页面不显示扫码入口。
- 小程序凭据仍只用于小程序登录和通知。用户在聊天中发送过的小程序 AppSecret 按“已暴露”处理：本轮没有把它写入仓库、新 release 或服务器；通知功能正式验收前必须重置。小程序代码上传 `.key` 文件不是网页登录凭据，不需要上传或提交。
- 手机 Sheet 下拉框修复与自动部署规则已上线；当前正式 release 对应 `docs(status): confirm automatic deployment policy rollout` checkpoint，精确哈希与 Git `HEAD`、`origin/main` 和服务器 `current-release` 一致。发布前加密数据库备份 archive 为 `48b7e00f-19b3-4577-aefa-dad10a0ad0bd`；生产仍为 36 个迁移，现网首页/API、产物哈希和域名隔离核验通过。
- 本轮变更已上线：密码不再有最小/最大位数限制，仅拒绝空密码；登录页已移除“首次使用请先注册账号”和微信 AppID/AppSecret 提示。
- 旧 `local-admin` / `local-member` 账号已保留关联业务数据并退役为 suspended，不再是可用认证身份；用户正式账号 `D0796` 已映射为稳定的密码认证 UID，并写入生产 `PLATFORM_ADMIN_UIDS` / `HOLIDAY_ADMIN_UIDS`。
- 原有的 1 个正式群组已在生产数据库中转移到 `D0796` 名下；`D0796` 的群组成员角色为 `owner`，显示姓名为“林恩宇”。原群组及排班数据保留，旧退役账号的成员记录保留为历史管理员记录。
- 群组页面展示修复已完成并上线：群组管理页会明确显示当前群组、角色和四位群组码，重新生成群组码后会刷新并显示新码；工作台只保留紧凑群组名称/身份下拉。
- 小程序 AppSecret 仍按“已暴露”处理，尚未通过聊天内容写入服务器；需要用户在微信平台重置后再更新服务器通知配置。现有服务器会话密钥已存在，网站 AppID/AppSecret 不再是阻塞项。
- 用户已明确放弃 Figma 预览，改用 Storybook + 本地浏览器验收；用户已确认整体视觉、月格密度、底栏与详情结构，生产 UI 已进入分批实现。
- Web UI 2.0 Task UI2-03/04/05/06/07/08/09/10/11-12 已分别以 `11bb812`、`5b00fa7`、`7c80488`、`1c84fd6`、`2d6f0a2`、`2bb9fce`、`23c1d9f`、`1203dc7`、`6ec287d` 推送；UI2-13/14 已完成实现与验证，checkpoint 识别消息为 `feat(web): polish group config and guest states`。业务逻辑、权限、API 和数据结构未修改。
- Web UI 2.0 最终全局审计与生产部署均已完成：动态视口、键盘焦点、Sheet 焦点锁定/回焦、减少动态、安全区/底栏避让及 1280×900、390×844、320×844 一致性均通过；checkpoint 为 `5ae4941`。`D0796` 的群主、平台管理员、节假日管理员及正式管理页面已人工复核，当前只待用户在正式网页做最终视觉验收。
- 用户反馈的手机 Sheet 下拉框不可见回归已完成修复、运行验证和生产部署：首页月历筛选、换班和加扣班的 TDesign 选项层现在挂载到原生模态 Sheet 内，不再落在 top layer 之外；checkpoint 为 `af37f5e`。
- 用户要求今后每个完成并推送的仓库修改检查点都直接部署到正式服务器并做线上核验；规则已写入根 `AGENTS.md`。部署只同步代码和提交内迁移，生产业务数据始终以服务器数据库为准，禁止用本地数据库、演示数据、凭据或会话覆盖生产。

## 2026-08-17 院内通讯录数据底座（当前批次 DIR-01）

- 完成范围：新增 6 张独立通讯录表、迁移 `0038_directory_snapshots`、MySQL 8.4 `ngram` 中文全文索引、号码前缀索引、全拼/紧凑全拼/首字母别名、版本化 JSON 标准输入发布与回滚 CLI；发布包已包含 CLI 及 `pinyin-pro` 生产依赖，生产校验同步验证其产物哈希和 38 个迁移。本批不提交两份 PDF 的真实号码，不实现 API 或 Web 页面。
- 数据与权限边界：院内通讯录与现有群组成员联系方式分表保存；原文、号码、短号和来源定位均保留，疑似矛盾只标记 `needs_review`，不自动更正。后续读取权限为正式群组的 active owner/administrator/member 与后台管理员，guest/vkey 不开放；权限将在后续 API 批次实现。
- 版本策略：每次导入是不可变完整快照；稳定 `entry_key` 用于差异统计，发布事务原子切换唯一当前批次，保留旧批次供审计和回滚。CLI 只从 stdin 读取，审计和终端输出不写电话号码或原始清单内容。
- 测试先行：导入核心、发布包与生产校验断言均先在旧代码上失败，再实现通过。隔离 MySQL 8.4 下迁移、中文/拼音/号码查询、发布/替换/回滚及失败事务回滚共 27/27 通过；全仓 Vitest 97 文件/609 项通过，30 个数据库集成文件/256 项按默认环境跳过。
- 运行验证：任务文件 Prettier/ESLint、全工作区 build/typecheck、Git Bash 语法检查、发布包 2/2、`node scripts/smoke-browser.mjs --check-core` 与 `git diff --check` 通过；本批未触及 Web 核心链路，无需浏览器冒烟。完整 `pnpm verify` 的格式/lint 聚合器仅被并行用户改动 `apps/miniprogram/project.config.json` 与 `TemporalPicker.vue` 的既有告警阻断，未修改这些任务外文件；其余 build/typecheck/test 已单独全量通过。
- 兼容审计：现有 API、权限、群组联系方式和 Web 均未接入新表；27 个 API 集成测试只补齐清库顺序，不改变测试业务断言。全数据库集成串行运行仍有项目状态已记录的 `user_auth_identities` 既有清理遗漏，本批不越界修复。
- 当前状态：已完成（含本地与隔离 MySQL 验证）→ 待生产发布。代码 checkpoint 识别消息为 `feat(directory): add versioned contact database import`。
- 下一批次：DIR-02 只做两份 PDF 的全页结构化提取、数据质量复核、生产快照导入与计数/哈希/差异核验；仍不实现 API/Web。
- 停止条件：DIR-01 定向及全量验证通过，空结构 checkpoint 提交推送、生产加密备份、迁移部署与线上空表核验完成后停止，不提前导入真实号码。

## 2026-08-17 手机日历导航触态与滑动圆角分层修复

- 回归来源：月/周导航的 TDesign `week-step`/`month-step` 来自 `8a49434`；移动端月/周底角直接加在日期格背景上的实现来自 `c64f0d7`；拖动时临时移除周格圆角的 `.is-swiping` 规则来自 `acd2507`。均已对关键表达式执行 `git log -S` 与 `git blame`。
- 成熟方案与语义审计：依照 CSS Backgrounds/Overflow 的圆角裁切模型，让固定外层卡片唯一拥有 `overflow: hidden` 圆角，三个滑动面板及格子背景保持方形；蓝色选中框改由独立 `::after` 描边绘制，只有位于卡片底角的描边带圆角。移除拖动中异步切换格子圆角的规则，不修改原生 `overflow-x`/`scroll-snap`、高度插值、月份/周次加载、选择日期、API 或错误路径。
- 按钮触态：月/周四个切换按钮改为自绘 44px 原生按钮；月/周/列表定位按钮共用显式触摸按下态，`touchend`/`touchcancel` 立即清除。取消可能在混合输入/WebView 上形成粘滞状态的 hover 背景，仅保留按住反馈和 `:focus-visible` 键盘焦点，减少动态时不缩放。
- 测试先行：旧代码先出现圆角分层 1 项、导航按钮 1 项失败；CDP 真实触摸又先暴露 `:active` 不稳定和触摸结束后 hover 恢复两项问题，分别补失败断言后修复。最终日历定向 18/18、全仓 Vitest 90 文件/584 项通过，29 个数据库集成文件/253 项按本机默认环境跳过。
- 运行/浏览器验证：Web typecheck/build、Storybook build、全仓 Prettier/ESLint、全仓 Vitest、`node scripts/smoke-browser.mjs`、`node scripts/smoke-browser.mjs --check-core` 与 `git diff --check` 通过；390px 真实 CDP touch 覆盖月/周按钮按下/松开、定位按钮、2026-08 六行至 2026-09 五行半拖动、月/周边角选中描边。无灰色反圆角、无松手残留背景/阴影/缩放/焦点框，管理员、成员、访客 vkey 与访问记录全流程无浏览器错误；最终截图目录 `C:\Users\eylin\AppData\Local\Temp\schedule-smoke-ORNaq6`。`pnpm --config.production=false verify` 在进入脚本前要求删除并重装全部 `node_modules`，已拒绝该破坏性环境动作并以现有本地二进制逐项执行同范围门禁。
- 正式发布：代码 checkpoint `0aaa562`（`fix(web): stabilize mobile calendar controls and corners`）已推送；发布前加密数据库备份 archive 为 `1e04e2cc-4d73-4f85-9033-9227aa676767`（44 张表、11142 行、4,271,268 字节，SHA-256 `1bd1d9e97244c3646f7ff1066ed2bb70aa098f1a66e596dcda10807562278c38`）。release `0aaa5620616cda90dbd863656adb4ac0ae5c8c82` 部署成功，发布前后 `ecs-verify.sh` 均通过；首次域名健康检查在容器预热时出现一次 502，自动重试后全部核验通过。
- 正式域名只读复核：390×844 的月视图和周视图均由 18px 固定外卡统一 `overflow: hidden` 裁切；月历 2026-08-31 左下选中描边和周历 2026-08-17 左下选中描边均一次完整呈现，日期格本体保持直角。月/周左右按钮与定位按钮静止态背景透明、无阴影；未保存配置、修改排班或触发其他业务写入。
- 状态：已完成（含生产发布与线上核验）→ 待用户复核。最终状态 checkpoint 识别消息为 `docs(status): record calendar touch and corner deployment`。
- 下一批次：只提交、推送并部署最终状态 checkpoint，使 Git `HEAD`、`origin/main` 与服务器 `current-release` 一致。
- 停止条件：最终状态 checkpoint 的生产备份、release 部署和 `ecs-verify.sh` 通过后等待用户复核。

## 2026-08-17 手机日历拖动、工作流开关与自定义配色修复

- 回归来源：指针捕获/三面板滑动和原生颜色输入来自 `41d284b`，周历底角来自 `c64f0d7`，换班/加扣班 checkbox 来自 `b20ff9b`、`5d8b205`；均已执行 `git log -S` 与 `git blame`。
- 测试先行：旧实现 4 个定向文件 6 项失败、10 项通过；修复后 16/16 通过。完整 `pnpm verify` 为 89 个文件、582 项通过，29 个数据库集成文件、253 项因本机无隔离测试库跳过。
- 变更与语义审计：延迟的 `lostpointercapture` 只能清理同一 pointer，旧手势释放前先清空状态；周历三面板等高填满，拖动中移除面板自身底角，静止选择框保持原圆角。换班/加扣班四个布尔设置复用 CompactSwitch，原 API、payload、异常路径不变。自定义颜色统一为内嵌 HSV 色域、色相滑杆与 HEX，Storybook 直接复用生产组件；移除原生颜色弹窗，“+”使用 CSS 线段居中。
- 运行/浏览器验证：Web typecheck/build、Storybook build、`pnpm smoke:browser`、`pnpm smoke:check-core`、`pnpm verify` 与 `git diff --check` 通过。Storybook 390px 无横向溢出或原生颜色输入，色域 298×92px，点击可更新 HEX；完整 smoke 覆盖管理员、成员、访客/vkey 与访问记录且无浏览器错误。
- 正式发布：代码 checkpoint `acd2507` 已推送；发布前加密数据库备份 archive 为 `b38a4aea-a518-43c9-ba90-b18cc9d31f58`（44 张表、9970 行，SHA-256 `1bbe706b8667768d279c82753d2ab6576f17f264e4b1521602aa25fa01aef133`）。release `acd25070b084768beede2fe40bf8c5e51d4fa7de` 部署成功，发布前后 `ecs-verify.sh` 均通过。
- 正式域名只读复核：周历三面板均高 48px，当前网格底边与滑动视口底边精确一致，滑动后周次连续且无横向溢出；换班/加扣班各 2 个设置均为 60×44px 点触区、52×30px 开关且无原生 checkbox；配色面板无 `input[type=color]`，内嵌色域 308×92px、页面无横向溢出。浏览器 error/warning 为 0，未切换设置、保存配置或触发业务写入。
- 状态：已完成（含生产发布与线上核验）→ 待用户复核。代码 checkpoint 为 `acd2507`；最终状态 checkpoint 识别消息为 `docs(status): record mobile interaction deployment`。
- 下一批次：只提交、推送并部署最终状态 checkpoint，使 Git `HEAD`、`origin/main` 与服务器 `current-release` 一致。
- 停止条件：最终状态 checkpoint 的生产备份、release 部署和 `ecs-verify.sh` 通过后等待用户复核。

## 2026-08-17 原生触控日历、自适应高度与班种开关局部保存

- 回归来源：JS Pointer Events 滑动、三面板等高轨道来自 `41d284b`；周格内容公式来自 `8a49434`，三面板强制填满来自 `acd2507`；班种保存后整页 `loadConfig()` 来自 `04c7da3`。均已执行 `git log -S` 与 `git blame`。
- 测试先行：新交互断言在旧代码上 5 项失败、5 项通过；实现后日历/班种定向 19/19、Web 全量 53 文件/410 项通过。选择方案遵循 W3C Pointer Events 与 CSS Scroll Snap：手指位移、惯性、方向锁定交给浏览器原生滚动，页面只处理落页与高度插值。
- 变更与语义审计：月/周三页改为 `overflow-x: auto` + `scroll-snap`，移除 pointer capture、`preventDefault` 和 JS transform；月格允许原生横向手势，视口按相邻面板高度实时插值，5/6 行月份在静止时精确贴合当前面板；周格稳定 86px 基线并按内容自然增高。班种启停仍只调用一次原 `PUT shift-type`，成功后用返回值局部更新配置，失败恢复原开关；不再调用 `loadConfig()`，其他新增/编辑/删除保存链不变。
- 运行/浏览器验证：Web typecheck/build、Storybook build、Prettier、ESLint、`node scripts/smoke-browser.mjs --check-core`、`git diff --check` 通过；`node scripts/smoke-browser.mjs` 以真实 CDP touch 事件完成月/周滑动、2026-09 五行高度、周格/底边等高、班种开关不跳位，并通过管理员、成员、访客/vkey/访问记录全流程。最终截图目录：`C:\Users\eylin\AppData\Local\Temp\schedule-smoke-Ob63zl`。
- 全仓验证说明：桌面环境的 `pnpm` 11.9.0 在执行脚本前错误尝试无 TTY 的 `install --production`，故使用等价的本地二进制逐项执行。全仓 Vitest 在全新隔离 MySQL 上暴露既有测试清理顺序问题：`swaps.integration` 通过后，后续测试未清理 `user_auth_identities` 而重复建表；另有既有群组并发断言抖动。本轮未修改 API、迁移或这些测试，未扩大范围修复；本轮相关 Web 410 项全部通过。
- 正式发布：代码 checkpoint `ee63532` 已推送；发布前加密数据库备份 archive 为 `f3b9a899-3c1a-41c1-bd26-075198dce913`（44 张表、10765 行，SHA-256 `baf70c29994b28a7325630f345f5575423936b497a63391c98a56fd5f09179ac`）。release `ee6353263d87fba18fe1d018e5347e44d1d6e2e2` 部署成功，发布前后 `ecs-verify.sh` 均通过。
- 正式域名只读复核：390px 的 2026-09 为 35 格，视口/当前面板高分别为 260/259.7px；原生 `overflow-x: auto`、`scroll-snap: x mandatory` 和 `touch-action: pan-x pan-y` 生效。周历 7 格均为 86px，当前面板/视口均为 86px；排班配置页无横向溢出，6 个班种开关点触区均为 60×44px，浏览器 error/warning 为 0。未切换开关或触发业务写入。
- 状态：已完成（含生产发布与线上核验）→ 待用户复核。最终状态 checkpoint 识别消息为 `docs(status): record native touch calendar deployment`，其发布前加密备份 archive 为 `d94afa5f-0192-4cb1-966a-10660d546143`（44 张表、10775 行，SHA-256 `7660de945feb2c4f3a58d5377b2b06f859a900a8dc85bf0a6b7a13d30bccd55e`）。
- 下一批次：只提交、推送并部署最终状态 checkpoint，使 Git `HEAD`、`origin/main` 与服务器 `current-release` 一致。
- 停止条件：最终状态 checkpoint 的 release 部署和 `ecs-verify.sh` 通过后等待用户复核。

## 2026-08-17 换班班次下拉恢复周几显示

- 回归来源：跨月换班 checkpoint `5a8380f` 新增 `formatSwapAssignmentOption`，把班次下拉从原有“日期 + 班种 + 周X + 成员”改成包含起止时间与岗位的专用文案；已对该函数和原公共 `createAssignmentOption` 执行 `git log -S` 与 `git blame`。
- 测试先行：新增换班表单必须复用公共班次选项且不得保留专用时间文案的回归断言；旧代码 1 项失败、2 项通过，修复后换班/公共选项定向 3 个文件 11/11 通过。
- 变更与语义审计：普通与管理员跨月换班的四组班次选项统一恢复使用 `createAssignmentOption`，显示完整日期、班种、`周X` 与成员；周六、周日继续仅对周几文字应用既有红色样式。移除专用时间文案函数，不修改月份独立状态、候选筛选、预览/提交、API、权限、错误路径或现有换班记录的时间展示。
- 运行/浏览器验证：Web typecheck/build、`pnpm smoke:browser`、`pnpm smoke:check-core`、`pnpm verify` 与 `git diff --check` 通过；完整验证为 88 个测试文件、580 项通过，29 个数据库集成文件、253 项按默认环境跳过，仅保留既有大 chunk warning。浏览器冒烟覆盖管理员、成员、访客 vkey 与访问记录，全流程无浏览器错误。
- 正式发布：代码 checkpoint `afe6a2d` 已推送；发布前加密数据库备份 archive 为 `5a1e925d-a75d-4b68-ad0b-3c246b787d90`（44 张表、9884 行，SHA-256 `56b9232458d5078da0cca8c552a287a301b94a7b41ab145997fbf3f30c1a0bd8`）。release `afe6a2d7531d26553e7cf7ebf1d48cd3af37a447` 部署成功，发布前后 `ecs-verify.sh` 均通过。
- 正式域名只读复核：正式 D0796 会话正常打开换班页、“发起换班”Sheet 及“我的班次”选项层；当前 2026-08 没有可选已发布班次，选项层正确显示“暂无数据”，未制造排班或触发任何业务写入。浏览器 error/warning 为 0，选项有数据分支由定向测试和本地浏览器验证覆盖。
- 状态：已完成（含生产发布与线上核验）→ 待用户复核。代码 checkpoint 为 `afe6a2d`；最终状态 checkpoint 识别消息为 `docs(status): record swap option deployment`。
- 下一批次：只提交、推送并部署最终状态 checkpoint，使 Git `HEAD`、`origin/main` 与服务器 `current-release` 一致。
- 停止条件：最终状态 checkpoint 的生产备份、release 部署和 `ecs-verify.sh` 通过后等待用户复核。

## 本轮已完成

- 工作台移除产品 Logo/“医护排班”招牌、重复介绍、常驻群组码与重复群组标题；顶部改为紧凑群组名称/身份下拉、动态功能标题、通知与同排导出。四位群组码继续只在群组管理显示。
- 月历正式组件对齐 Storybook Mobile Screens 2：保留月/周/列表/筛选、月份切换和手势，使用完整六周、18px 圆角、周末表头及日期红字；选中日期下方继续使用确认的胶囊详情。换班与加扣班复用同一工作台标题位置。
- ICP 页脚改为仅登录页渲染，取消独立横带并透明融入画布；备案链接文案、工信部地址、安全属性、44px 点触和键盘焦点反馈不变。未修改 API、权限、认证、路由、数据库或共享契约。

- 新增统一 `SiteComplianceFooter`，覆盖登录、访客和已认证工作台，移动工作台为固定底部导航预留空间；备案链接具备 44px 点触高度、键盘焦点和安全的新窗口属性。未修改会话、路由、API、权限或业务数据。
- 新增微信要求的根目录认证文件 `1ea9a862b2bec835f8671a1cf10fd8df.txt`；Vite 生产构建会将其复制到站点根目录，正文严格为微信提供的 41 字节认证值。未修改应用逻辑、API、认证、路由、数据库或 Nginx 回退规则。
- 已定位手机下拉框回归：月历筛选由 `7c80488` 引入，换班/加扣班 Sheet 由 `2bb9fce` 引入，原生模态打开行为由 `5b00fa7` 引入；TDesign 默认挂到 `body` 的浮层无法越过模态 top layer。
- 新增共用 popup 挂载策略，并应用到首页手机月历筛选 3 个、换班 7 个、加扣班 4 个 Select；只改变选项层 DOM 容器，不改变选择状态、清空、表单、API 或错误处理语义。
- 新增组件级和源码覆盖回归测试，并扩展浏览器 smoke，实际点击三类问题场景确认下拉内容位于已打开 Sheet 内且可见。
- 已在正式发布前通过完整 `ecs-verify.sh` 并创建加密数据库备份 `48b7e00f-19b3-4577-aefa-dad10a0ad0bd`（44 张表、3701 行）；`af37f5e` 部署成功，服务器业务数据保持原位。

- 发布前确认服务器 `056fc59` 产物与清单完全一致、无手工漂移；本地 `main` 比生产新 18 个 UI 2.0 提交。生产和本地数据库结构均为 36 个迁移、45 张表、467 个字段，因此没有复制密码、联系方式或生产业务数据，也没有用本地演示数据覆盖生产。
- 已生成并部署不可变 release `5ae4941`；部署只执行既有迁移器并重建本项目 API/Web 容器，生产业务数据保持原位。`D0796` 仍为 active，姓名“林恩宇”，在“头颈外科医生”群组中为 active owner，平台/节假日管理员配置继续生效。
- 本轮发布状态 checkpoint 识别消息：`docs(status): record UI 2.0 production deployment`。
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
- Web UI 2.0 Task UI2-10：手动排班矩阵增加固定日期表头/人员首列、内部横向滚动、方向与进度提示和不小于 44px 的真实单元格按钮；手机保留姓名和班次完整信息，清空/保存/应用等操作在 320px 下不溢出。排班补录增加当前配班状态、44px 月份/班次/成员/暂存操作和响应式全宽七列月历；暂存移除保持显式按钮，不增加滑动删除。浏览器复核时发现 UI2-05 的空月格会因 `undefined === undefined` 被误判选中，已增加独立回归函数与测试修复。本 checkpoint 为 `1203dc7`（`feat(web): improve dense schedule interactions`）。
- Web UI 2.0 Task UI2-11：统计页改为“值班台账”式汇总，完整保留原 10 项指标与统计口径；成员统计使用内部横向滚动、固定表头/成员首列、方向和进度提示，岗位/班种分解在手机改为单列可读卡片容器，1280/390/320px 均无页面横向溢出。
- Web UI 2.0 Task UI2-12：通知中心和导出迁入共用 `ResponsiveSheet`，手机为全宽贴底页；通知卡按业务类型使用可访问语义徽标，通知设置改为响应式卡片，导出增加实时内容/周期摘要、安全说明及显式取消/导出操作。全部可见操作不小于 44px，原权限、轮询、筛选、API、下载与审计语义不变。本 checkpoint 为 `6ec287d`（`feat(web): polish statistics notifications and exports`）。
- Web UI 2.0 Task UI2-13：群组管理新增四位“群组腕带”、响应式创建/加入/当前操作卡片和焦点锁定危险确认 Sheet；排班配置新增只描述基础配置的三步“排班准备轨道”，班种与岗位编辑在桌面保持高密度、390px 两列、320px 单列，所有真实点触面不小于 44px。原群组与配置 API、权限、参数和写入调用未改。
- Web UI 2.0 Task UI2-14：访客 vkey 月历改为移动端页面内完整七列并提供明确只读/月度状态；缺少或失效链接、群组加载错误和全局空状态统一为可操作状态卡片；离线提示明确为缓存只读且提交暂停，不增加离线写入队列。复用原 vkey、缓存、错误映射与 API 链路。
- 浏览器复核暴露 `ResponsiveSheet` 在异步 `nextTick` 后模板引用可能为 `null` 的既有问题（来源 `5b00fa7`）；冒烟先出现两次 `Cannot read properties of null (reading 'open')`，随后只扩展空引用 no-op 守卫并复跑通过，不改变 Sheet 打开/关闭语义。
- Web UI 2.0 最终全局收尾：`body`、`#app`、应用布局、登录/状态容器与访客页保留 `100vh` 回退并追加 `100dvh`，避免移动浏览器地址栏伸缩导致全屏界面抖动或遮挡；`ResponsiveSheet` 新增显式首尾焦点循环、打开时首项聚焦和关闭后触发器回焦，跨浏览器不再只依赖原生 dialog 的隐式行为。打开/关闭 emit、业务 slot、API、权限和数据链路均未改变。
- Web UI 2.0 完成审计确认原计划全部落地：Storybook + 本地浏览器替代 Figma；令牌/图标/响应式应用框架、密集七列月历与 56px 手势、值班轨道、工作流移动卡片与响应式 Sheet、矩阵/统计内部横滑、群组/配置/访客/离线及错误状态均已由 UI2-01–14 和最终审计覆盖；`WorkbenchNavItem` 强类型图标、`MonthGrid` 选中日期接口、可测试手势函数及共用 `ResponsiveSheet` 已实现；未修改服务端 API、共享契约、权限或数据库。

## 已运行验证

- 工作台紧凑精修：测试先行旧实现 8 项失败/8 项通过，实现后 4 个定向文件 22/22 通过；Web typecheck、Storybook build、`pnpm smoke:browser`、`pnpm smoke:check-core`、`pnpm verify` 与 `git diff --check` 通过。全仓库 74 个测试文件、505 项测试通过，29 个数据库集成文件、252 项因本机无测试 MySQL 跳过。1280×900、390×844、320×844 已核对 68px 紧凑抬头、44px 群组/备案点触、18px 完整六周月历、周末红字、动态功能标题、无横向溢出及 ICP 仅登录页显示。
- ICP 页脚：定向测试先因组件不存在失败，实现后 2/2 通过；Web typecheck、`pnpm smoke:browser`、`pnpm smoke:check-core`、`pnpm verify` 与 `git diff --check` 通过。72 个测试文件、492 项测试通过，29 个数据库集成文件、252 项因本机没有测试 MySQL 跳过。1280×900 登录页与 390×844 登录/访客/已认证工作台均核对唯一备案链接、正确文案和 44px 点触高度；核心链路门禁记录已写入调试日志。生产发布前后 `ecs-verify.sh` 通过，正式桌面/手机登录页及手机访客页的 DOM 均确认备案链接唯一、文案和目标正确、点触高度 44px；认证文件继续精确匹配。
- 微信认证文件：修改前公网 URL 返回 1136 字节应用首页 HTML；新增文件后 Web 生产构建产物为 41 字节且正文精确匹配。`pnpm verify`、`pnpm smoke:check-core` 与 `git diff --check` 通过；71 个测试文件、490 项测试通过，29 个数据库集成文件、252 项因本机没有测试 MySQL 跳过。核心链路校验确认仅新增公共静态文件，无需运行浏览器 smoke。生产发布前后 `ecs-verify.sh` 均通过；公网认证 URL 返回 200、`text/plain`、41 字节且正文精确匹配，生产仍为 36 个迁移。
- 手机 Sheet 下拉框修复：定向测试先因共享挂载策略模块缺失失败，实现后 4/4 通过；Web typecheck 通过。
- 手机 Sheet 下拉框运行/浏览器验证：当前源码隔离 5174 服务下 `pnpm smoke:browser` 通过；390×844/320×844 实际点击首页筛选、换班、加扣班下拉框，管理员、成员、访客与访问记录全流程无错误。首次运行命中 5173 的非开发登录服务，在登录门禁停止，未进入产品断言。
- 手机 Sheet 下拉框全仓库验证：`pnpm verify` 和 `git diff --check` 通过；71 个测试文件、490 项测试通过，29 个数据库集成文件、252 项因本机没有测试 MySQL 跳过，仅保留既有大 chunk warning。
- 手机 Sheet 下拉框生产验证：`ecs-update.sh` 与部署后的 `ecs-verify.sh` 通过；正式 release `af37f5e4ecf5abcc86ac7460361bbfb47ba4c8c4` 的域名/API、产物哈希、容器、未知 Host 拒绝、无开发认证依赖和 36 个迁移均通过。

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
- UI2-10 测试先行：手动矩阵滚动状态测试先因缺少 `manual-grid-interactions` 模块失败；空月格选中回归测试先因缺少判定函数失败。实现后月历交互、手动矩阵交互和编辑器逻辑 3 个定向测试文件、19 项测试通过。手动矩阵来源定位到 `6512274`，补录页面及绘制/暂存链路定位到 `927241c`、`000ed93`、`561310c`；空月格误选表达式定位到 UI2-05 的 `7c80488`，均已用 `git log -S` 和 `git blame` 核对。
- UI2-10 浏览器验证：扩展后的 `pnpm smoke:browser` 通过；1280×900、390×844、320×844 实际检查手动矩阵和排班补录，页面无横向溢出、底栏不遮挡操作、矩阵内部可横滑且人员首列位置固定、表头固定、滚动提示随位置更新、单元格点触状态可切换，补录月历保持完整七列和中性空月格；关键控件均不小于 44px。最终使用独立的当前源码 5174 服务完成验证并停止该临时服务；原 5173 外部开发进程未被修改。
- UI2-10 全仓库验证：Web typecheck、生产 build、Storybook build、`pnpm smoke:check-core` 和 `pnpm verify` 通过；全仓库 66 个测试文件、472 项测试通过，29 个数据库集成文件、252 项测试因本机无测试 MySQL 跳过；仅保留既有的大 chunk warning。逐 API/事件调用计数与错误、空值、异步路径审计确认原排班保存、应用、发布、撤回和补录流程未变。
- UI2-11/12 测试先行：统计汇总/滚动提示、通知语义色调和导出选择摘要先在旧实现上因函数缺失而 3 个文件、4 项失败（其余 11 项通过）；实现后 3 个文件、15/15 通过。回归来源已通过 `git log -S`/`git blame` 定位：统计表由 `36127b0` 引入，通知中心/设置由 `52e9e1f` 引入，导出对话框由 `15729f8` 引入。
- UI2-11/12 浏览器验证：`pnpm smoke:browser` 通过；1280×900、390×844、320×844 实际验证统计汇总完整保留 3 项主指标/7 项辅助指标，成员表内部横滑且固定表头/成员首列，滚动提示实时更新；通知设置单列全宽、通知中心和导出均为贴底全宽 Sheet，关键控件不小于 44px，安全说明无覆盖，页面无横向溢出，管理员/成员/访客原流程及控制台无错误。
- UI2-11/12 全仓库验证：Web typecheck、Storybook build、`pnpm smoke:check-core` 和 `pnpm verify` 通过；全仓库 66 个测试文件、476 项测试通过，29 个数据库集成文件、252 项因本机无测试 MySQL 跳过，仅保留既有大 chunk warning。统计、通知设置/列表/轮询与导出的关键 API、定时器和下载调用次数逐项对比 `HEAD` 均相同。
- UI2-13/14 测试先行：群组四位码/角色、配置准备轨道和访客/离线状态 3 个模块先因文件不存在失败；实现后连同 PWA 响应式回归共 4 个文件、10/10 通过。群组、配置、访客与离线来源已用 `git log -S`/`git blame` 定位到 `1b5a17a`、`caf0a8e`、`04c7da3`、`7c783c7`、`4b33749`、`db35a77`。
- UI2-13/14 浏览器验证：`pnpm smoke:browser` 通过；1280×900、390×844、320×844 下群组腕带/卡片、排班准备轨道、班种/岗位编辑、访客状态/vkey 七列月历和离线只读提示均无页面横向溢出，关键点触目标不小于 44px；解散确认 Sheet 实际打开并保持焦点锁定，管理员、成员、访客与访问记录原流程及控制台无错误。最终截图目录为 `C:\Users\eylin\AppData\Local\Temp\schedule-smoke-yhFCbi`。
- UI2-13/14 运行验证：Web typecheck、Storybook build、`pnpm smoke:browser`、`pnpm verify` 和 `git diff --check` 通过；全仓库 69 个测试文件、482 项测试通过，29 个数据库集成文件、252 项因本机无测试 MySQL 跳过，仅保留既有大 chunk warning。首次访客 smoke 超时确认是 5173 旧 Vite 进程提供旧组件，重启明确属于本仓库的前端进程后使用当前源码通过；API 服务和数据未重启或改动。
- 最终全局审计测试先行：新增动态视口断言先因全屏容器只有 `100vh` 失败；浏览器冒烟新增首尾 Tab 断言后先发现 390px “更多”Sheet 焦点逃出，补充组件级断言后旧实现再次失败。实现后 `apps/web/src/pwa/global-ui-shell.spec.ts` 4/4 通过。
- 最终运行/浏览器验证：`pnpm --filter @schedule/web storybook:build`、`pnpm smoke:browser`、`pnpm verify` 与 `git diff --check` 通过；浏览器冒烟覆盖管理员、成员、访客、vkey 和访问记录，并新增 1280/390/320 横向溢出、44px 底栏、2px 键盘焦点、Sheet 双向焦点锁定/回焦和减少动态断言，最终截图目录为 `C:\Users\eylin\AppData\Local\Temp\schedule-smoke-aVpdbz`。全仓库 70 个测试文件、486 项测试通过，29 个数据库集成文件、252 项因本机无测试 MySQL 跳过，仅保留既有大 chunk warning。
- 最终本地浏览器复核：Storybook 390/320px 节假日月历均为七列、无横向溢出或姓名裁切；姓名背景透明，周末红、节假日红底、加/换黄底、调休蓝底及多日节假日浅粉背景计算样式与确认稿一致。生产页 1280/390/320px 无横向溢出，桌面侧栏/手机五入口正确切换，320px 底栏贴底且内容预留 94px；实际 Tab 循环保持在“更多”Sheet 内，关闭后焦点回到“更多”。Storybook 验收服务保留在 `http://127.0.0.1:6006`。
- UI 2.0 发布门禁：`pnpm verify`、串行 `pnpm smoke:browser`、`pnpm smoke:check-core`、`git diff --check`、生产 `ecs-verify.sh` 和公开域名/API 健康检查通过；486 项测试通过，252 项数据库集成测试按本机配置跳过。首次浏览器 smoke 与全仓库构建并行时遇到访客卡片 HMR 瞬时状态，构建结束后在独立 5174 服务串行复跑通过，未改产品代码。
- 正式 D0796 浏览器验收：桌面群组管理、成员、排班配置、事件/访客记录入口和写操作权限均正确呈现；390px/320px 无横向溢出，五个手机底栏按钮高 59px，“更多”底部页贴底且完整位于视口内。未触发任何保存、审批、群组码重置、解散或成员权限写入。

## 下一批次与停止条件

Mobile Screens 2 月历视觉一致性代码、推送、生产备份、部署和正式域名复核均已完成；没有待实施的仓库任务。最终状态 checkpoint 部署后停止，保持 Git `HEAD`、`origin/main` 与服务器 `current-release` 一致。

## 2026-08-16 月历跨午夜业务日修复

- 回归来源：业务日期 helper 由 `7a16c85` 统一，当前月计算由 `927241c` 引入；`CalendarView` 的当前月、今日业务日和默认选中日期调用点已执行 `git log -S` 与 `git blame`。
- 测试先行：先把 00:00 后仍属上一业务日、月初跨月和当前月默认值断言改为期望行为；旧实现定向测试 3 项失败，证明回归测试有效。实现后定向月历/领域三文件 24/24 通过，完整 `pnpm verify` 为 74 passed、29 skipped，506 passed、252 skipped（本机无测试 MySQL）。
- 变更：业务日改以中国标准时间 08:00 全天班交接为边界；00:00–07:59 仍使用上一日/上一月，08:00 切换。自然时间格式化、跨午夜班次范围、API、契约、权限和数据库未改；手动排班及月历 smoke 的默认日期断言同步复用同一边界。
- 浏览器验证：专项月历断言通过（当前环境在 00:xx 时默认选中 `2026-08-15`）；完整 `pnpm smoke:browser` 已通过月历断言，但随后被工作区并发的手动排班横滑固定列/进度提示改动卡住，未将该失败归因于本轮。`pnpm smoke:check-core` 通过，`git diff --check` 待提交前复核。
- 当前工作区复跑 `pnpm verify` 的唯一失败为 `workbench-shell-refinement.spec.ts` 仍匹配旧 `.t-radio-button` 源码，而并发未提交的 `CalendarView.vue` 已改为原生 `.view-mode-button`；本轮日期代码的定向/完整验证已先通过，不修改该用户变更。
- 状态：已完成（含月历专项浏览器验证）→ 待用户复核。checkpoint 识别消息：`fix(web): keep calendar on previous duty date until handover`。

原生产待办仅保留：在微信平台重置已暴露的小程序 AppSecret 后再验收通知功能；这不属于 Web UI 2.0 代码实现缺口。

停止条件：完成本轮 checkpoint 的 production backup、release 部署、`ecs-verify.sh` 和月历专项线上核验，确认 Git `HEAD`、`origin/main` 与服务器 `current-release` 一致；随后等待用户在正式站点跨 00:00 与 08:00 做最终复核。

## 2026-08-16 Mobile Screens 2 月历视觉一致性

- 回归来源：正式月历工具栏与移动月历样式由 `7c80488` 引入，通知入口由 `52e9e1f` 引入并在 `5b00fa7` 形成应用壳触发样式，月格基础结构由 `ab25064` 引入；已对当前模板和样式执行 `git log -S` 与 `git blame`。
- 测试先行：新增独立回归测试后先因 `month-grid-presentation` 不存在而失败；实现后新增测试 4/4、工作台紧凑壳测试 5/5 通过。浏览器 smoke 首先暴露相邻月禁用格被旧选择器误选，收窄到可用当月日期后完整通过。
- 变更：正式页原样采用 Storybook Mobile Screens 2 的 3px 浅灰分段容器、44px/13px 月周列表按钮、44px/13px 筛选按钮和三横线图标；通知入口改为相同 44px、15px 圆角的自绘铃铛及未读红点。手机月历固定 1:1 单元格比例和完整 42 格，补全相邻月份日期并置灰禁用，星期一至日行改为 28px 浅灰填充，周六、日继续红字。
- 语义审计：月/周/列表仍只写入同一 `viewMode` 一次，原 watch、月份/周导航、筛选 Sheet、API、错误处理与日期选择调用不变；相邻月份格仅补充只读展示且不触发选择。通知轮询、未读计数、抽屉和定时器不变，仅把数字徽标视觉替换为与 Storybook 一致的红点，未读数量保留在可访问名称中。
- 运行/浏览器验证：320×844、390×844 和 1280×900 实测无内容横向溢出；390px 月格为 49×49，320px 约 41×41，均为 42 格，前后相邻日期为 07-27 至 09-06。月/周/列表、筛选 Sheet、通知 Sheet 和禁用相邻日期均实际操作通过。Storybook build、Web typecheck、`pnpm smoke:browser`、`pnpm smoke:check-core`、`pnpm verify` 与 `git diff --check` 通过；全仓库 75 个测试文件、510 项测试通过，29 个数据库集成文件、252 项因本机无测试 MySQL 跳过，仅保留既有大 chunk warning。
- 正式发布：代码 checkpoint `abd20d2` 已推送；发布前 `ecs-verify.sh` 通过并创建加密数据库备份 `fa99e3d2-0dbf-472a-8837-3fbde4dfbe2e`（44 张表、5367 行）。release `abd20d2aa94ce3425bff446047db094542aa2466` 部署成功，API/Web 容器、产物哈希、未知 Host 拒绝、无开发认证依赖和迁移检查通过。
- 生产浏览器复核：正式 D0796 会话在 390×844 测得分段容器 50px、按钮 44px/13px、筛选 44px/13px、通知按钮 44px、星期栏 28px、月格 49×49；320×844 月格为 41.14×41.14。两个视口均为完整 42 格、相邻日期 07-27 至 09-06、无内容横向溢出；周末标题及日期计算色为 `rgb(224, 49, 49)`。1280×900 无横向溢出，月/周/列表、筛选和通知 Sheet 均实际操作通过，未触发业务写入。
- 状态：已完成（含生产发布与正式域名复核）→ 待用户复核。代码 checkpoint 为 `abd20d2`；最终状态 checkpoint 识别消息：`docs(status): record mobile calendar parity deployment`。

## 2026-08-16 Mobile Screens 2 星期栏单线回归

- 回归来源：移动 `MonthGrid` 的 1px 网格间隙和边框底色由 `7c80488` 引入，星期栏底边由 `abd20d2` 引入；已执行 `git log -S` 与 `git blame`，确认两者在星期栏与首行之间重复绘制。
- 测试先行：新增“星期栏与月格共用单一分隔面”回归断言；旧实现 5 项中 1 项失败，移除重复底边后日历定向测试 5/5、日历相关测试 31/31 通过。
- 变更：仅移除移动 `.weekday-row` 的 `border-bottom`，保留 `.month-grid` 的 1px `gap` + 分隔色背景；Storybook Mobile Screens 2 参考组件、日期选择、42 格、业务数据、API、权限和事件链路均未改。
- 语义审计：没有模板、事件、响应式状态或调用点变化；分隔线由既有网格背景绘制一次，星期栏与首行间距仍为 1px，选中态 2px 内描边保持不变。
- 运行/浏览器验证：Storybook build、Web typecheck、日历定向测试、`pnpm smoke:check-core`、`pnpm verify` 和 `git diff --check` 通过；本地当前源码 390×844/320×844 实测 42 格、1:1 月格、星期栏底边 `0px`、首行间距 `1px`、无内容横向溢出。完整 `pnpm smoke:browser` 在既有未提交 `GroupSwitcher.vue`/`HomeView.vue` 的 68px 抬头断言处停止，未将该失败归因于本轮。
- 预览：Storybook Mobile Screens 2 保持 390×844 UI2.0 参考效果；本地正式工作台预览截图为 `C:\Users\eylin\AppData\Local\Temp\schedule-calendar-line-preview.png`，Storybook 参考截图为 `C:\Users\eylin\AppData\Local\Temp\schedule-storybook-mobile-screens-2-preview.png`。
- 状态：已完成（含运行验证）→ 待用户复核。checkpoint 识别消息：`fix(web): avoid stacked mobile calendar separators`。
- 正式发布：代码 checkpoint `de69384` 已推送；发布前加密数据库备份 archive 为 `c9785dbd-b267-4cfa-afc4-cb1f9556b57f`（44 张表、5406 行）。release `de69384164c6806e939ec6f9d67355e0d8710170` 部署成功，`ecs-verify.sh` 通过。
- 正式浏览器复核：390×844 月格 49×49、320×844 月格 41.14×41.14；两个视口均为 42 格、星期栏底边 `0px`、首行间距 `1px`、无内容横向溢出。未触发业务写入。

## 下一批次与停止条件

- 下一批次：无待实施仓库任务；等待用户复核 Storybook Mobile Screens 2 与正式工作台的星期栏/首行分隔线视觉。
- 停止条件：代码 checkpoint `de69384` 已推送、备份 `c9785dbd-b267-4cfa-afc4-cb1f9556b57f` 已创建、release `de69384164c6806e939ec6f9d67355e0d8710170` 已部署，`ecs-verify.sh` 与正式域名月历复核通过；等待用户视觉复核后停止。

## 2026-08-16 工作台抬头回退与自绘群组箭头

- 回归来源：旧抬头/原生选择器由 `daff238` 引入；已执行 `git log -S` 与 `git blame`。退出登录仍由 `WorkbenchNav.vue` 的“更多”抽屉承载，未改回顶部。
- 完成内容：恢复群组名在上、工作台在下且左对齐的原布局；保留 owner/administrator 导出门禁；群组控件改为透明背景分体式线条箭头按钮，下方自绘 listbox，不使用原生 `select`。
- 测试与验证：测试先行旧三列实现 6 项失败，修复后正式壳/Storybook 11/11 通过；Web typecheck、`pnpm smoke:browser`（管理员/成员/访客/vkey/访问记录，1280/390/320 无横向溢出）、`git diff --check` 通过。冒烟脚本已同步检查新箭头控件与抽屉退出入口。
- 状态：已完成（含生产发布与线上核验）→ 待用户复核。代码 checkpoint 识别消息：`fix(web): restore stacked workbench header and custom group arrow`。
- 运行验证：Storybook build、Web typecheck、定向测试 11/11、`pnpm smoke:check-core`、`pnpm verify` 和 `git diff --check` 均通过；全仓库 75 个测试文件、511 项测试通过，29 个数据库集成文件、252 项因本机无测试 MySQL 跳过；Storybook 仅保留临时配置下的 addon 解析提示、CSF 解析提示和既有大 chunk warning。
- 正式发布：网络恢复后生成不可变 release `42c342529c8cf1e9b3f125b3ae6b3c2928b33043`；发布前加密数据库备份 archive 为 `5dba4d9d-6a0a-4a2f-98ea-c16d8419859a`（44 张表、5410 行）。`ecs-update.sh` 部署成功，迁移、API/Web 容器重建和 release 写入均通过。
- 正式核验：服务器 `ecs-verify.sh` 退出码 0；正式域名健康、产物哈希、未知 Host/IP 拒绝、公开端口、容器、无退役账号、无 `@cloudbase` 和 36 个迁移均通过。正式 D0796 会话在浏览器实际展开/关闭群组 listbox（2 个选项），抬头、通知、导出均存在，控制台无 error/warning。
- 下一批次：等待用户复核 Storybook 与正式站视觉；最终状态 checkpoint 识别消息：`docs(status): record workbench production deployment`。

## 2026-08-16 月历按需显示周数

- 回归来源：`month-grid-presentation.ts` 在 `abd20d2` 固定生成 42 格/6 行；已用 `git log -S 'Array.from({ length: 42'` 与 `git blame` 定位。详情栈由 `CalendarView.vue` 的 grid gap 和 `SelectedDateDutyDetails.vue` 的 margin-top 共同控制。
- 测试先行：新增 2026 年 9 月 5 行及详情间距回归后，旧实现 2 项失败；实现后日历相关 5 个测试文件 33/33 通过。
- 变更：`buildMonthDisplayGrid` 按首日偏移与当月天数计算 4–6 行完整周；2026 年 9 月渲染 35 格（8 月 31 日至 10 月 4 日），需要 6 行的月份保持原行为。`CalendarView` 增加 `align-content: start`，防止父容器有额外高度时月历轨道被拉伸；桌面 12px grid gap、移动 14px grid gap、详情自身桌面/移动 margin 均未改。API、权限、业务数据、选择/月份切换和详情调用链未改。
- 运行/浏览器验证：`pnpm --filter @schedule/web typecheck`、`pnpm --filter @schedule/web build`、`pnpm --filter @schedule/web storybook:build`、定向 `pnpm exec vitest run ...`（5 文件/33 项）、ESLint、Prettier 和 `git diff --check` 通过。月历专项浏览器验证在 1280×900、390×844、320×844 均通过：9 月 5 行/35 格，无横向溢出；详情间距桌面 32px、移动 26px，8 月与 9 月一致；移动单元格保持 1:1。`pnpm smoke:check-core` 通过并确认未触及核心链路。
- 预览截图：`C:\Users\eylin\AppData\Local\Temp\schedule-month-grid-browser-check\mobile390-september-5-rows.png`、`C:\Users\eylin\AppData\Local\Temp\schedule-month-grid-browser-check\desktop1280-september-5-rows.png`。完整 `pnpm smoke:browser` 另受并发无关的请假 Sheet “完成”按钮小于 44px 断言影响；完整 `pnpm verify` 另受并发新增 `apps/web/src/stories/ui2/calendar-views-refinement-preview.spec.ts` 未格式化影响，未修改这些用户文件。
- 状态：已完成（含月历专项浏览器验证）→ 待用户复核。checkpoint 识别消息：`fix(web): render only required calendar weeks`。
- 决策/阻塞：本轮只允许暂存 `apps/web/src/features/calendar/month-grid-presentation.ts`、`apps/web/src/views/calendar/CalendarView.vue` 和本回归测试；生产部署仍需按仓库规则执行，若 `ecs:package` 或线上发布再次遇到网络/依赖阻塞，保留本地提交并记录阻塞。
- 下一批次：本 checkpoint 的提交、推送、production backup、release 部署、`ecs-verify.sh` 及正式域名 1280/390/320 月历与详情间距复核。
- 停止条件：Git `HEAD`、`origin/main` 与服务器 `current-release` 一致，且正式域名确认 2026 年 9 月为 5 行、详情间距不拉大；随后等待用户最终视觉复核。

## 2026-08-16 群组下拉选项间距回归

- 回归来源：群组自绘下拉菜单由 `3febef0` 引入；本轮对 `GroupSwitcher.vue` 执行 `git log -S 'group-switcher-menu'` 与 `git blame`，确认选项状态背景共用菜单内连续布局，缺少行间距。
- 测试先行：正式工作台与 Storybook 各新增 1 个间距断言；旧样式定向测试为 2 项失败、9 项通过，补充 `display: grid` 与 `gap` 后 2 个文件 11/11 通过。
- 变更与语义审计：正式菜单使用 `var(--ui-spacing-xxs)`、Storybook 使用 4px，为相邻选项状态背景建立可见间隔；选项高度、蓝色状态、`modelValue`/`update:modelValue`、键盘/Esc/Tab/外部关闭、角色权限和抽屉退出入口均未改变。
- 运行/浏览器验证：Web typecheck、定向测试 11/11、任务文件 Prettier 检查、`pnpm smoke:browser`、`pnpm smoke:check-core` 和 `git diff --check` 通过；完整 `pnpm format:check` 仅因既有未跟踪日历测试文件 `apps/web/src/stories/ui2/calendar-views-refinement-preview.spec.ts` 格式不符而失败，未修改该用户文件。冒烟覆盖管理员、成员、访客及访问记录，全流程无浏览器错误。
- Storybook 预览：`GroupMenuOpen390` 刷新后实际计算 `gap/row-gap = 4px`，2 个选项之间已可见分隔，390×844 预览无横向溢出。
- 正式发布：代码 checkpoint `4857e76` 已推送；发布前加密数据库备份 archive `ccdd8bf2-9a7f-4e8d-b1c1-198a95cd6d05`（44 张表、5442 行）；release `4857e76e976e0010d2f52520e23fc73babb88c1e` 已部署。
- 正式核验：服务器 `ecs-verify.sh` 退出码 0；正式 D0796 会话实际测得群组菜单 `gap/row-gap = 4px`，2 个选项高度 62px、顶部相差 66px，Escape 可关闭且无原生 `select`；工作台、通知、导出均存在，浏览器 error/warning 均为空。
- 状态：已完成（含生产发布与线上核验）→ 待用户复核；代码 checkpoint 识别消息：`fix(web): separate group dropdown option states`。

## 2026-08-16 工作台群组名垂直间距精修

- 回归来源：工作台抬头与自绘群组箭头的当前结构由 `3febef0` 引入，旧的 44px 群组内容行由同一轮恢复；已对 `GroupSwitcher.vue`、Storybook 预览和相关断言执行 `git log -S` 与 `git blame`。
- 测试先行：新增正式壳与 Storybook 的紧凑行高、箭头定位和菜单锚点断言；旧实现定向运行 2 项失败、9 项通过。实现后两个回归文件共 11/11 通过。
- 变更：群组名称行不再被 44px 最小高度撑开，右侧自绘箭头改为绝对定位并继续保留 44px 触达区；菜单锚点随视觉行收紧，同时保留箭头触达区下方 8px 视觉间隔。Storybook 预览与正式组件保持同一布局语义。
- 语义审计：仅调整 CSS 布局；`modelValue`/`update:modelValue`、群组持久化、键盘/Esc/Tab/外部关闭、选项间距、角色权限、导出按钮和 `WorkbenchNav` 抽屉退出入口均未改变。
- 运行/浏览器验证：定向测试 11/11、Web typecheck、生产 `pnpm build`、任务文件 Prettier、Storybook build、`pnpm smoke:check-core`、`运行/浏览器验证：pnpm smoke:browser` 和 `git diff --check` 通过。Storybook 390px 实测抬头由 94px 收紧为 70.25px，群组文字行 20.25px，箭头触达区 44px，菜单与箭头底部间距 8.13px；展开/关闭与 listbox 行为正常。
- 发布决策：首次 `ecs:package` 仅打包了已有静态产物，首次线上核验发现仍为旧 44px 群组行；未将其视为最终发布。随后按当前源码运行生产 `pnpm build`，重新生成同一代码 checkpoint 的 release 产物并再次部署。
- 正式发布：代码 checkpoint `e841c53` 已推送；首次部署前备份 archive `7d093557-0f9d-4da5-b60c-4ea2a6bf3c90`，重建后最终部署前备份 archive `056ea6a5-2bf1-4df0-ac6e-a989206f224e`（44 张表、5531 行）；最终 release `e841c53f0462ddf5987cb02266abaaf50e12a501` 部署成功。
- 正式核验：`ecs-verify.sh` 退出码 0。正式 D0796 桌面 1280×720 与移动 390×844 均测得抬头 68px、群组文字行 20.25px、箭头触达区 44px；移动 `scrollWidth = clientWidth = 375px`。下拉为 2 个选项，`gap/row-gap = 4px`，Esc 后关闭，原生 `select` 数量为 0；顶部没有退出登录按钮，通知/导出存在，浏览器日志为空。
- 状态：已完成（含生产发布与线上核验）→ 待用户复核。代码 checkpoint 识别消息：`fix(web): compact group header spacing`；最终状态 checkpoint 识别消息：`docs(status): record compact group header deployment`。

## 2026-08-16 月视图相邻月份日期颜色精修

- 回归来源：相邻月份日期的浅色由 `abd20d2` 引入，周末日期红色由 `4540e13`/`c9a12b8` 引入；已对 `MonthGrid.vue` 与 `Ui2MonthCalendar.vue` 执行 `git log -S` 和 `git blame`，确认周末选择器覆盖了相邻月份的浅色。
- 测试先行：新增实际月历与 Storybook 参考组件的相邻月份颜色断言；旧实现 1 项失败，修复后日历 parity 8/8、定向日历相关 27/27 通过。
- 变更：相邻月份普通日期改为更浅的 `#c2c9d1`，相邻月份周末日期改为同步变浅的 `#ef9f9f`；桌面、移动端和 `invert-past-colors` 分支保持一致。当月普通/周末日期、背景、详情、选择和业务数据均未改。
- 运行/浏览器验证：Web typecheck、build、Storybook build、ESLint、Prettier、`pnpm smoke:check-core`、`pnpm verify`（76 个测试文件/521 项通过，29 个数据库集成文件/252 项按环境跳过）和 `git diff --check` 通过。390×844 与 1280×900 实测普通相邻日期 `rgb(194, 201, 209)`、相邻周末 `rgb(239, 159, 159)`，当月颜色保持原值且无横向溢出。
- 正式发布：代码 checkpoint `7b230e4` 已推送；发布前加密数据库备份 archive 为 `70a03bdc-ca33-4f0e-a292-91de3b29d8e5`（44 张表、5605 行）；release `7b230e4c2eea20c6ccafb47cbc89f08f1e567c83` 部署成功。
- 正式核验：`ecs-verify.sh` 退出码 0；正式 D0796 会话在 1280×900 与 390×844 测得普通相邻日期 `rgb(194, 201, 209)`、相邻周末 `rgb(239, 159, 159)`，当月颜色保持原值、无横向溢出，浏览器 error/warning 为空。
- 状态：已完成（含生产发布与线上核验）→ 待用户复核。代码 checkpoint 识别消息：`fix(web): lighten adjacent-month calendar dates`。
- 下一批次：提交并推送最终状态 checkpoint `docs(status): record adjacent-month color deployment`，将同一 `HEAD` 作为最终 release 部署。
- 停止条件：最终状态 checkpoint 已推送，生产备份、release、`ecs-verify.sh` 与正式域名颜色复核全部通过；随后等待用户视觉复核。

## 2026-08-16 连续周视图、列表一致性与微信移动满宽修复（当前批次）

- 已实现：周视图以周一至周日连续推进，不再绑定单月；跨月标题显示如“7月第5周-8月第1周”，下一周连续为“8月第2周”。跨月周同时读取所涉及月份的排班数据，合并后仍使用原只读日历模型、筛选和事件入口。
- 周视图与月视图共用圆角日历表面：导航、星期栏和七列日期格使用单线分隔；七格按最长当天的排班/节假日内容统一动态高度。姓名置于上层，班种与换/加标识置于下层；班种标签单行、固定紧凑内边距并截断为两个 Unicode 字符；电话继续放在点击日期后的详情轨道，避免七列内重叠。
- 列表视图已对齐 Storybook 手机模板：固定月份工具栏、前后月份和定位今天、排序提示、圆角日卡、今天浅蓝选中态、班次数量、完整班种/时间/岗位、换加标识与薄荷色电话入口均进入正式组件。
- 微信移动布局修复：请假、换班、加扣班与成员标题区域在 760px 以下使用明确的 `minmax(0, 1fr)` 单列轨道，说明与操作占满可用宽度；群组码在 360px 以下按固定数字块和 4px 间距向左聚合。未改表单提交、审批、权限、API、路由、数据库或共享契约。
- 回归与浏览器验证：测试先行旧实现共出现 10 项日历/连续周失败，移动轨道追加断言后旧 CSS 再出现 2 项失败；实现后定向 4 文件 27/27、工作台壳 5/5、Web typecheck、生产 Web build、Storybook build、Prettier、ESLint、全仓 Vitest 78 文件/533 项通过（29 个数据库集成文件/252 项按本机无测试 MySQL 跳过）、`git diff --check` 通过。`pnpm smoke:browser` 的 pnpm 包装器因本机非 TTY 依赖目录状态检查停止，使用同一脚本入口 `node scripts/smoke-browser.mjs` 在独立 5174 当前源码服务复跑通过，覆盖管理员、成员、访客、vkey 与访问记录且无浏览器错误。
- 390/320 实测：周视图七格等高、无横向滚动，`全天` 为 20px 宽单行标签；跨月标题及下一周编号连续。Storybook 周切换也已改用真实日期并取消前后各一周限制，实测从“7月第5周-8月第1周”进入“8月第2周”，周六/日不再伪造“休息”标识。请假/换班/加扣班说明与操作宽度均等于 351px 内容区，成员标题三处均为满宽单列；320px 群组码为 40px 数字块、4px 间距、左聚合。生产列表源码预览和 Storybook 模板均为 349–351px 全宽卡片及固定工具栏。
- 行为审计：跨月周由一次单月 GET 扩展为对触及月份各一次 GET 并只合并 assignments；最新请求追踪、错误处理、节假日降级、筛选、选中日期、电话和事件调用次数保持原语义。周切换不再写入月视图的 `businessMonth`，月/列表月份状态因此独立保留；所有移动满宽修改均为 CSS。
- 代码 checkpoint `a1a732a`（`fix(web): unify continuous calendar and mobile layouts`）已推送至 `origin/main`；发布前加密数据库备份 archive 为 `a238d4aa-4332-4f1a-83bf-74c18b8dc60c`（44 张表、6147 行，SHA-256 `5b5f61deef804ec99a64d4d53f0bef18ecda7deae10e75f7fe3cf49c5778ef2e`）。release `a1a732a8d675ba759b27b96a7986294b7498327f` 部署成功，`ecs-verify.sh` 退出码 0。
- 正式域名专项复核：390px 跨月标题为“7月第5周-8月第1周”，右切为“8月第2周”；周网格 `scrollWidth = clientWidth = 364px`、七格同为 86px 高，`全天` 标签保持 20px 单行。列表固定工具栏、31 张日期卡及今天选中态正确；请假说明/按钮、换班与加扣班操作、成员标题均占满 351px 内容区。320px 群组码按 40px 数字块、4px 间距向左聚合，无元素越出视口；未触发业务写入。
- 状态：已完成（含生产发布与线上核验）→ 待用户复核。下一批次只提交并推送最终状态 checkpoint `docs(status): record continuous calendar deployment`，再将该 `HEAD` 作为最终 release 部署。
- 停止条件：最终状态 checkpoint 已推送，第二次生产备份、release、`ecs-verify.sh` 通过，Git `HEAD`、`origin/main` 与服务器 `current-release` 一致；随后等待用户视觉复核。

## 2026-08-16 日历圆角选中框与周视图今天状态修复（当前批次）

- 回归来源：移动月历方形日期格与外层圆角裁切由 `7c80488` 引入；周视图整格“今天”描边由 `a1a732a` 引入，Storybook 对应整格今天背景来自 `8a49434`、描边来自 `a1a732a`。已对相关选择器执行 `git log -S` 与 `git blame`。
- 测试先行：新增月视图末行左右角继承圆角、周视图左右角继承圆角及“今天仅使用日期圆点、不保留整格蓝框”断言；旧实现 3 个文件中 3 项失败、21 项通过，修复后 24/24 通过。
- 变更：月视图仅让末行首/尾日期格继承外层底部圆角；周视图仅让周一/周日格继承外层底部圆角，使 2px 内描边沿容器曲线完整收口。周视图移除未选中今天的整格蓝色描边，保留黄色日期圆点和 `aria-current="date"`；被选中日期仍是唯一蓝色整格框。Storybook 参考页同步相同视觉规则。
- 语义审计：只修改 CSS 与源码回归断言；日期点击、`selectedDate`、`aria-pressed`、`aria-current`、周切换、详情、API、异步/错误路径、空值、权限和调用次数均未改变。
- 运行/浏览器验证：`pnpm smoke:browser` 通过管理员、成员、访客、vkey 与访问记录全流程且无浏览器错误；Storybook build、Web typecheck/build、任务文件 Prettier/ESLint、全仓 Vitest（79 passed/29 skipped；537 passed/253 skipped）及任务文件 `git diff --check` 通过。完整 `pnpm verify` 仅被并发中的无关 `group-service.ts`/`membership-service.ts` 格式问题拦截；`pnpm smoke:check-core` 仅因无关未提交 `packages/contracts/src/groups.ts` 触发核心门禁，本轮未修改核心链路文件。
- 390px/320px 实测：月视图选择 8 月 31 日时左下角蓝框完整贴合圆角；周视图选择 14 日后，16 日只保留黄色今天圆点且 `aria-current=date`，不再有第二个蓝框；选择周日 16 日时右下角蓝框完整贴合圆角。两个视口均无横向溢出。
- 正式发布：代码 checkpoint `c64f0d7` 已推送；发布前加密数据库备份 archive 为 `c2412550-9ae2-463f-8d1f-a488a7d9abb0`（44 张表、6218 行，SHA-256 `64b87157384612ac5029c86aba06bf59ac53bd92a4ff4293482e95bdd03c1472`）。为隔离并发中的无关工作区改动，release 从 `c64f0d7` 的干净临时 worktree 构建；`c64f0d7f166adc61f0a6f9470f09519175c718e6` 部署成功，`ecs-verify.sh` 退出码 0。
- 正式域名复核：390px 月视图选择 8 月 31 日时左下描边完整；周视图选择 14 日后，今天 16 日为 `aria-current=date`、`aria-pressed=false`，只保留黄色日期圆点；选择 16 日后右下描边完整。320px 同样确认 14 日为唯一 `aria-pressed=true`、16 日为今天但未选中。未触发任何业务写入。
- 状态：已完成（含生产发布与线上核验）→ 待用户复核。下一批次仅提交并推送最终状态 checkpoint `docs(status): record rounded calendar selection deployment`，再将该 `HEAD` 作为最终 release 部署。
- 停止条件：最终状态 checkpoint 已推送，第二次生产备份、release 与 `ecs-verify.sh` 通过，Git `HEAD`、`origin/main` 和服务器 `current-release` 一致；保留所有并发中的无关群组/平台管理员/迁移改动且不纳入本 checkpoint。

## 2026-08-16 群组后台管理与导出修复（当前批次）

- Git 入口确认：`ed96bde` 已推送，工作区开始时干净；前序日历批次与 `main`/`origin/main` 一致。本批次只处理用户确认的导出、后台 admin、群组码和成员资料流程。
- Task 1 已完成：`git log -S 'export-jobs' -- infra/scripts/schedule-notifications.sh` 与 `git blame` 确认每分钟生产任务脚本自 `eab3ff2` 引入时只运行提醒/通知，遗漏了既有 `ExportJobProcessor`。脚本现先运行 `export-jobs`，仍复用 `flock` 与任一任务失败即非零退出的语义。
- 测试先行：新增 `infra/scripts/schedule-notifications.spec.ts`，旧脚本断言失败；实现后使用本地 Vitest 入口运行 1/1 通过，`git diff --check` 通过。`pnpm exec` 因非 TTY 的依赖目录保护停止，未修改依赖；后续完整验证使用可用的直接 Vitest 入口或记录环境阻塞。
- 本 checkpoint 提交信息：`fix(exports): schedule pending export processing`。提交前已逐行审阅脚本：唯一行为变化为每分钟额外领取并完成最多 10 个 pending 导出任务，导出、提醒和通知任一失败仍使脚本返回非零。
- 下一批次：Task 2（developer admin 数据迁移、隐藏成员关系与全局权限）和 Task 3（手动群组码、成员资料/认领界面与权限收紧）。
- 停止条件：两个后续 task 分别完成定向与完整验证、显式提交推送、生产数据库备份、部署、`ecs-verify.sh` 和正式域名复核；不得暂存无关日历文件。

## 2026-08-16 群组后台管理与导出修复（Task 2–3）

- 引入点：已对群组随机码、成员认领界面和电话确认权限执行 `git log -S`/`git blame`；分别确认来源为 `1b5a17a`、`d117bb0`、`8e42afb`。Task 1 导出调度遗漏来源为 `eab3ff2`，已由 checkpoint `a45aa84` 修复并部署。
- 已实现：新增第 37 个迁移，以预计算 scrypt 哈希创建隐藏 developer admin，补齐所有现有及新群组的 `administrator` 成员关系；统一权限层、群组恢复/删除/所有者操作和平台后台均识别该账号。成员、联系人与排班候选结果隐藏该账号；其会话可切换所有群组并拥有最高业务权限。
- 已实现：群组创建/修改均要求唯一四位手填码，删除随机生成与重生入口。普通界面只显示本人不可编辑姓名、可编辑长短号，以及姓名目录；姓名、他人电话、电话确认和历史认领均只允许 developer admin。普通端认领/同名检测/撤销/确认入口已移除；同名预设成员只会在输入群组码加入时自动关联，未知用户被拒绝。
- 回归验证：定向 Vitest 156 项通过；临时隔离 MySQL 中空库第 37 版迁移及重复迁移通过，手动码/预设绑定、developer admin 隐藏且全群访问、admin 专属历史认领、普通用户改名拒绝均通过。`pnpm verify` 通过（79 个文件/537 项通过，29 个数据库集成文件/251 项按环境跳过）；`pnpm smoke:check-core` 与 `git diff --check` 通过。
- 运行/浏览器验证：`pnpm smoke:browser` 通过；覆盖本地管理员、普通成员、访客/vkey 及访问记录，群组码编辑、普通成员目录与联系方式触控区均复核，无浏览器错误。
- 行为审计：权限绕过只在数据库 `is_developer_admin` 为 1 的已激活账号上生效，未伪造群主角色；普通电话改动会清除确认状态，admin 可显式设置确认状态；admin 姓名修改写入全局 profile，因此同账号跨群同步。无关日历文件未暂存或修改。
- 正式发布：代码 checkpoint `394b1c8` 已推送并部署；发布前加密数据库备份 archive 为 `51bdbfac-39b5-49e4-b203-0ee00d14496b`（44 张表、6226 行，SHA-256 `78554db354b61431b180b1d024f81b40fb4e6928693fd535f89b7c3e64279754`）。生产 release `394b1c87deb42f344b2638d2c7e9b9cd144b8a74` 迁移至第 37 版，`ecs-verify.sh` 通过。
- 正式域名核验：以后台账号登录后平台权限为真、可见全部 2 个群组且均带 developer 标识；抽样群组成员/联系人接口各返回 7 项，均不包含隐藏后台账号。执行一次非破坏性 `2026-08` CSV 导出，任务由 `pending` 成功变为 `completed`，下载返回 1551 字节 CSV。为避免在生产创建测试身份，普通账号边界以隔离 MySQL API 集成测试和本地浏览器 smoke 覆盖。
- 状态：已完成（含生产发布与线上核验）→ 待用户复核。下一批次：无，等待新的用户需求；停止条件为本状态 checkpoint 推送、部署并使 Git `HEAD`、`origin/main` 与服务器 `current-release` 一致。

## 2026-08-16 成员通讯录与通知开关落地（当前批次）

- 批次范围：用户已确认 Storybook 的 Apple 通讯录式成员页与通知设置行；本批次只落地成员目录/联系方式权限和通知开关视觉，不处理导出、日历交互、列表定位或跨月换班。
- 回归来源：`394b1c8` 将联系人读取收窄为本人并把管理/确认限制为 developer admin，同时引入普通成员姓名目录；常驻本人联系方式表单来自 `23c1d9f`，通知开关 44px 本体高度来自 `6ec287d`。均已执行 `git log -S` 与 `git blame`。测试夹具遗漏认证表清理由迁移 `12e7f40` 后显现，旧清理函数来自 `da042b54`。
- 后端匹配：`GET /groups/:groupId/contacts` 向同群 active owner/administrator/member 返回完整有效成员通讯录，继续排除 guest、停用/删除和隐藏后台账号，跨群访问保持 403。普通成员仅能修改本人且不能确认；群主、群管理员、后台管理员均可修改并确认任意有效成员。无新表、字段、迁移或契约。
- 前端落地：成员页统一为“我的资料”浅蓝卡和科室通讯录列表，姓名/角色/长号/短号完整展示，空值为“未填写”，待认领名单不可编辑；本人和有权限管理员通过“修改”打开 `ResponsiveSheet`，成功后关闭、刷新并反馈，失败仍由表单保留内容。姓名、角色、认领、删除、转让继续使用原权限/确认流程。通知设置改为完整设置行，60×44px 外层承载点触面积，TDesign 开关本体保持 52px 紧凑比例；通知 API、订阅与权限申请时机未改。
- 测试先行与验证：旧后端 2 项失败/5 项通过、旧 UI 4 项失败/1 项通过；实现后成员/通知定向 14/14、Storybook 预览 6/6、隔离 MySQL 群组相关集成 13/13 通过。Web typecheck/build、Storybook build、`pnpm smoke:browser`、`pnpm smoke:check-core`、`pnpm verify` 和 `git diff --check` 通过；全仓 83 个文件/548 项通过，29 个数据库集成文件/252 项在全仓命令中按环境跳过，任务相关集成已另用隔离 MySQL 实跑。
- 运行/浏览器验证：1280×900、390×844、320×844 下成员/通知页面无横向溢出，后台管理员有他人修改入口、普通成员仅有本人修改入口，编辑 Sheet 真实打开；通知外层点触区不小于 60×44px且开关本体低于 44px。完整 smoke 覆盖管理员、成员、访客/vkey、访问记录且无浏览器错误，截图目录 `C:\Users\eylin\AppData\Local\Temp\schedule-smoke-H6ZvoG`。Storybook QA 截图另存于 `C:\Users\eylin\.codex\visualizations\2026\08\16\01a00a56-69ce-7211-8331-c55672d96097`。
- 行为审计：权限判断在前端与后端均为 owner/administrator/developer，普通成员本人写入保持原调用；保存成功只新增关闭 Sheet 和重新读取目录，失败分支与请求次数不变。通知偏好关闭、权限拒绝、订阅与重新注册仍复用原函数，未在加载时申请权限。checkpoint 识别消息：`feat(groups): publish member contact directory`。
- 正式发布与只读复核：主 checkpoint `6183e9d` 部署前备份 `0ebc4723-ac13-429b-ab62-56c003b99196`（44 张表、6916 行）；复核发现确认 checkbox 仍写旧文案“后台确认联系方式”，已测试先行改为中性“确认联系方式”，后续 checkpoint `f9d0889` 推送并以备份 `55cb9743-5f8f-4f1e-a70d-9028f0519d6f`（44 张表、6951 行）保护后部署。release `f9d0889d194a39265f3efb9f8591d44601e00c08` 的 `ecs-verify.sh` 通过；正式 D0796 群主页在 1280/390/320 下无横向溢出，本人卡无常驻输入框且只有“修改”入口，Sheet 显示“确认联系方式”且无旧文案。通知点触区三档均为 60×44px、开关本体 52×20px，浏览器 error/warning 为 0，未保存联系方式或切换通知权限。最终状态 checkpoint 识别消息：`docs(status): record member directory deployment`。
- 下一批次：第三批共 3 项——导出 Sheet/任务下载修复、月周日期格姓名与加换标识改为只读、列表“定位今天”平滑定位与筛选缺失提示。
- 停止条件：当前 checkpoint 显式提交并推送，生产加密数据库备份完成，release 部署、`ecs-verify.sh` 与正式域名成员/通知只读专项复核通过；随后停止，不提前进入跨月换班批次。

### 用户截图后的视觉一致性修正

- 人工复核确认生产通知开关实际为 52×20px，而确认稿为 52×30px；成员页还保留确认稿外的重复“成员”标题/人数、常驻添加预设成员表单和重复说明。`git log -S`/`git blame` 已定位：通知宽度来源 `6ec287d`、44px 外层来源 `6183e9d`；常驻名单表单与重复标题来源 `23c1d9f`/`394b1c8`，手机本人修改按钮被放回首行来源 `6183e9d`。
- 按用户补充许可弃用局部 TDesign：浏览器通知使用原生 `role=switch` 按钮，自绘 52×30px 轨道和 24px 圆点，60×44px 点触面独立保留；权限申请、订阅、偏好保存和重新注册函数未改。成员目录的修改/管理/添加按钮及联系方式编辑表单改为确认稿同款原生控件；重复标题/人数/说明已移除，添加预设成员收进次级 `ResponsiveSheet`，保存成功才关闭；权限、API、危险确认和成员管理流程不变。
- 测试先行：旧实现新增 2 项失败，实现后成员/通知定向 6/6 通过。`pnpm verify` 通过（83 个文件/549 项，29 个数据库集成文件/252 项按全仓环境跳过），Web typecheck/build、Storybook build、`pnpm smoke:browser`、`pnpm smoke:check-core`、Prettier、ESLint 与 `git diff --check` 通过；任务相关 `group-permissions.integration.test.ts` 7/7 实跑通过。`group-routes.integration.test.ts` 的既有独立并发建群用例两次为 9/10（竞争胜者为 administrator 而断言固定 owner），其余 9 项通过，与本轮纯前端改动无调用关系，未顺手修改。
- 本地浏览器 390×844 / 320×844 实测无横向溢出；成员页只有一个“成员”标题、无常驻名单表单，本人修改按钮分别为 321×44px / 267×44px，320px 管理次操作隐藏且联系方式左缩进归零。通知轨道为 52×30px、圆点 24×24px、点触面 60×44px，并具备键盘焦点和 `aria-checked`。本 checkpoint 识别消息：`fix(web): match approved member and notification previews`。
- 正式发布：代码 checkpoint `5102950` 已推送；发布前加密数据库备份 archive 为 `d76f2d8e-463e-4fdc-b15f-4f47b4050d7f`（44 张表、7034 行，SHA-256 `7d05c9fa64a64a9fac73dc9487a2f95844e6a1fd62339284606539c51aeff04b`）。release `5102950af3a1b39aabf9c5152fcf946660fabf10` 部署成功，`ecs-verify.sh` 退出码 0。
- 正式域名只读复核：D0796 会话在 1280×900、390×844、320×844 下确认成员页仅一个标题、无常驻名单表单、添加成员为次级入口；本人修改按钮在 390/320 下为 337×44px / 267×44px，三档均未越出视口。通知轨道三档均为 52×30px、圆点 24×24px、点触面 60×44px，`role=switch`/`aria-checked` 正确；未点击开关、未保存联系方式或触发其他业务写入。
- 下一批次仍为第三批：导出 Sheet/任务下载修复、月周日期格交互只读、列表“定位今天”平滑定位。停止条件：本视觉修正 checkpoint 推送，生产备份、release、`ecs-verify.sh` 与正式域名 1280/390/320 专项复核全部通过后停止，不提前进入第三批。

## 2026-08-16 导出、日期格与列表定位修复（当前批次）

- 批次范围：仅处理第三批 3 项——导出 Sheet/异步任务/下载兜底、月周日期格姓名与加换标识只读、列表“定位今天”平滑定位及筛选缺失提示；不提前进入跨月换班。
- 回归来源：`git log -S`/`git blame` 确认导出成员从岗位反推、60 秒轮询和下载 URL 立即释放均来自 `15729f8`；事件标识按钮来自 `7ac2a07`，姓名电话入口来自 `a3b14fb`，列表电话/事件模式来自 `8a49434`；列表定位原先只更新月份来自 `ab25064`/`8a49434`。导出集成测试的旧清理函数来自 `15729f8`，认证表由 `394b1c8` 后续加入。
- 导出修复：两个 `t-select` 均接入 `responsiveSheetPopupProps`；成员选项独立读取有效群组成员，不再依赖已排班岗位。任务状态明确区分创建、等待、可下载、90 秒超时和失败；超时保留任务 ID并提供“继续检查”，不会重复创建。完成后自动下载并保留“下载 CSV”兜底链接，Blob URL 仅在重新导出或卸载时释放；卸载与在途完成竞态会返回 cancelled，不再写入已卸载组件。
- 日历修复：月/周日期格姓名和加换标识均为只读展示，点击日期格仍选择日期；列表与下方详情继续保留明确电话和“事件记录”按钮。列表日期卡加入稳定业务日期锚点；同月或跨月加载后将今天平滑定位到固定工具栏下、视口约上方三分之一，减少动态时即时跳转；筛选隐藏今天时显示“当前筛选下今天没有排班”。
- 后端匹配：导出 API 的同群权限、岗位/成员过滤、pending/running/completed/failed 状态、审计、15 分钟有效期和生产每分钟 worker 均已支持，本批次未修改生产 API、契约、数据库或 worker。仅补齐导出集成测试对既有认证表的清理；导出集成 5/5、群组成员目录目标用例 1/1 实跑通过。
- 测试先行：旧实现定向测试 9 项失败/16 项通过，修复后相关前端 25/25；浏览器检查发现月格仍残留电话提示后，新增断言先失败再修复；卸载竞态新增测试先暴露 finished/cancelled 差异，修复后导出逻辑与源码回归 10/10。
- 运行/浏览器验证：Web typecheck/build、Storybook build、`pnpm smoke:browser`、`pnpm smoke:check-core`、`pnpm verify`、Prettier 与 `git diff --check` 通过；全仓 84 个文件/559 项通过，29 个数据库集成文件/252 项按默认环境跳过，任务相关数据库集成已另行实跑。完整注入测试库的全仓 verify 仍暴露既有重复认证表清理和群组并发建群胜者断言，不属于本批次；本批次相关用例均通过。
- 浏览器专项：导出两个下拉均在 Sheet 内可点击；本地真实任务先达到 90 秒超时、再由现有 worker 完成，同一任务“继续检查”后出现下载兜底。月/周姓名与标识无按钮语义，列表电话和事件入口保留。列表定位前今天卡顶部约 2160px，定位后约 305px、固定工具栏底部约 86px；筛选隐藏今天时显示准确提示且不误定位。
- 行为审计：导出只新增成员目录读取和显式状态机；同一任务继续轮询不会重复创建，Blob URL 生命周期与组件一致。月/周移除的仅是姓名/标识弹层入口；列表和下方详情的显式入口及调用次数保持。定位跨月只等待目标月现有请求完成后滚动，不更改筛选、日期选择、API 或业务数据。
- 正式发布：代码 checkpoint `3861190` 已推送；发布前加密数据库备份 archive 为 `df900c60-09e7-4bda-a742-c83415996997`（44 张表、7159 行，SHA-256 `b97267164d726cd0a2c89e13292725d714486fb3c690dc26edbb3227ffab4826`）。release `3861190220c7ba9e4f0bf2a38e7926812e58d96c` 部署成功，`ecs-verify.sh` 退出码 0。
- 正式域名专项：群组没有岗位配置时岗位下拉正确显示“暂无数据”，成员下拉仍独立列出有效成员；实际创建一次 2026-08 CSV，明确等待状态后约 30 秒完成，页面保留 Blob“下载 CSV”链接。列表视图在本月无已发布排班时点击定位显示“当前筛选下今天没有排班”，未误定位；控制台无 error/warning。该正式群组本月无排班，月/周姓名与标识的数据态由本地真实数据浏览器检查、生产同一构建和回归测试覆盖。
- 状态：已完成（含生产发布与线上核验）→ 待最终状态 checkpoint。代码 checkpoint 识别消息：`fix(web): repair exports and calendar interactions`；最终状态 checkpoint 识别消息：`docs(status): record export and calendar deployment`。
- 下一批次：第四批仅处理普通换班与管理员直接换班的双方独立月份、跨月班次加载和冲突/版本回归。
- 停止条件：最终状态 checkpoint 显式提交并推送，第二次生产加密数据库备份、release 部署与 `ecs-verify.sh` 通过，使 Git `HEAD`、`origin/main` 和服务器 `current-release` 一致；随后停止，不提前实施跨月换班。

## 2026-08-16 跨月换班（当前批次）

- 批次范围：仅处理第四批 1 项——普通换班与管理员直接换班的双方独立月份、跨月班次加载，以及后端冲突/权限/版本语义核对；未修改换班生产 API、契约、数据库或事务服务。
- 回归来源：`git log -S`/`git blame` 确认单一 `businessMonth` 与单月日历读取由 `b20ff9b` 引入，管理员表单后续由 `6452fa9`/`2bb9fce` 调整但仍复用同一月份。后端自 `b20ff9b` 起已分别按两个 assignment ID 读取不同 schedule period，并按两个 period 写事件、按两个 business month 刷新统计，原本支持跨月。
- 前端实现：普通换班增加“我的班次月份/对方班次月份”，管理员直办增加“成员一月份/成员二月份”；相同月份只读取一次，不同月份并行读取。改变一方月份仅清空该方班次及预览，另一方有效选择保留。班次选项显示完整业务日期、班种、起止时间（含“次日”）、岗位和成员；月份缓存按群组隔离，并用最新请求 ID 防止切换群组后的异步旧结果覆盖。
- 后端匹配：真实集成测试覆盖普通成员 2026-09 ↔ 2026-10 换班和管理员跨月直办；两个日历的实际成员与换班标识正确，`swap_completed` 事件分别落入两个 schedule period。原有同群权限、已发布状态、岗位资格、请假/时间/活动工作流冲突、assignment version、幂等、审批与事务回滚逻辑均由完整换班套件继续覆盖。
- 测试先行：旧前端对新增独立月份/并行加载/完整标签回归为 4 项失败，实现后 8/8 通过；后端跨月测试在不改生产服务的前提下先通过，证明缺口仅在前端。完整换班 API 集成 34/34 通过。测试数据库清理遗漏认证表由 `12e7f40` 后显现，本轮补齐换班文件自身的 `user_auth_identities`/`user_password_credentials` 清理；注入数据库的全仓 verify 继续在未改动日历文件的同类历史清理缺口处失败，未扩展到无关模块。
- 运行/浏览器验证：Web typecheck/build、Storybook build、`pnpm smoke:browser`、`pnpm smoke:check-core`、常规 `pnpm verify`（85 个文件/562 项通过，29 个数据库集成文件按默认环境跳过）、Prettier、ESLint 和 `git diff --check` 通过；任务相关数据库集成已单独全部实跑。390/320 冒烟确认普通与管理员 Sheet 均有两个独立月份选择器、44px 关键触达区且无横向溢出；本地真实数据实测改变“我的班次月份”后，对方月份、成员与已选班次保持，控制台无 error/warning，未提交换班。
- 行为审计：普通成员目标候选仍排除本人，管理员两侧仍可选择任何有可操作班次的成员；同月请求去重、跨月并行，不增加预览/提交 API 调用次数。月份变化只新增对应日历读取；提交、审批、撤销、错误转换和版本冲突处理调用保持原路径。checkpoint 识别消息：`feat(web): enable cross-month shift swaps`。
- 正式发布：代码 checkpoint `5a8380f` 已推送；发布前加密数据库备份 archive 为 `fd3480f8-ff34-4c82-92f8-f9187ba23336`（44 张表、7266 行，SHA-256 `abd75c70107729db32027a7788d48e6e55c2ce139621b98bf314892b43e03573`）。release `5a8380f614f4efdff702174b145da8beb1766f8c` 部署成功，`ecs-verify.sh` 退出码 0。
- 正式域名只读复核：D0796 群主会话的普通换班 Sheet 显示“我的班次月份/对方班次月份”且有 2 个 month 输入；管理员 Sheet 显示“成员一月份/成员二月份”且同样有 2 个 month 输入。当前生产群组本月无已发布排班，因此未选择班次；两个 Sheet 均无页面横向溢出，未触发预览、提交或任何业务写入，正式域名没有 error/warning 日志。
- 状态：已完成（含生产发布与线上核验）→ 待用户最终验收。最终状态 checkpoint 识别消息：`docs(status): record cross-month swap deployment`。
- 下一批次：无待实施仓库任务；最终状态 checkpoint 推送并作为文档同步 release 部署后等待用户验收。
- 停止条件：Git `HEAD`、`origin/main` 和服务器 `current-release` 一致；不再开始新实现任务。

## 2026-08-17 已确认界面精修落地（当前批次）

- 批次范围：仅落地用户确认的 3 组任务——月/周真实相邻内容滑动及苹果式柔和吸附；成员/日历详情直接拨号、统一紧凑开关、紧凑班种与自定义颜色；事件页日期时间轴及折叠。不修改 API、权限、数据库、通知订阅链路、换班或其他页面。
- 日历：月/周采用前中后三个真实面板，工具栏和星期栏固定在圆角滚动区外；拖动跟手，按距离/速度判定翻页，松手使用 `cubic-bezier(0.22, 1, 0.36, 1)` 动态时长吸附，减少动态时即时完成。只在确认横向拖动后捕获指针，普通月格点触仍一次生效；独立月/周组件默认保留星期栏。
- 设计落地：成员、列表与选中日期电话均为透明原样式 `tel:` 入口；相关 checkbox 改为 60×44px 点触、52×30px 轨道的紧凑开关。班种列表按需展开，输入框 42px，保留五个预设色并新增同尺寸自定义色圆点、调色板与 HEX。事件页按日期分组为时间轴，支持全部日期、单日期和单事件详情展开/折叠，访客访问记录保持原表格。
- 回归来源与测试：假滑动来自 `7c80488`；电话路径来自 `1c84fd6`/`7a47d69`/`ab25064`，成员目录来自 `6183e9d`；班种 UI 来自 `04c7da3`；事件表来自 `7ac2a07`，均已执行 `git log -S` 与 `git blame`。新增断言均先在旧实现失败，修复后定向 10 文件 72/72 通过。
- 验证：`pnpm verify` 通过（88 个文件/579 项，29 个数据库集成文件/253 项按环境跳过）；Web/全仓 build 与 typecheck、Prettier、ESLint、Storybook build、`pnpm smoke:browser`、`pnpm smoke:check-core` 和 `git diff --check` 均通过。完整 smoke 覆盖管理员、成员、访客 vkey 与访问记录且无浏览器错误，截图目录 `C:\Users\eylin\AppData\Local\Temp\schedule-smoke-7emAAK`。
- Storybook 专项：390px 月视图真实左滑成功切换相邻月；成员拨号链接透明且 44px；紧凑开关 60×44px；自定义色调色板/HEX 和事件全部日期折叠均实际操作通过。checkpoint 识别消息：`feat(web): land approved interface refinements`。
- 正式发布：代码 checkpoint `41d284b` 已推送；发布前加密数据库备份 archive 为 `915fa54b-1054-4a81-b9a2-aefa9844d25d`（44 张表、9120 行，SHA-256 `4f1bec8ce81a40ef57758c151230e7a4cf471c73061b43eb6862d9733073ed41`）。release `41d284b312452df2762981e252251d5e871d9149` 部署成功，发布前后 `ecs-verify.sh` 均通过。
- 正式域名只读复核：月视图真实拖动 8 月→9 月，周视图真实拖动第 4 周→第 5 周，均保持 3 个相邻面板；固定星期栏、无横向溢出、60×44px/52×30px 开关、6 行紧凑班种、42px 输入框、自定义调色板/HEX 和零浏览器日志错误均通过。当前生产群组没有已填写号码和事件，未为核验写入数据；对应有数据分支已由本地 smoke/Storybook 实际覆盖。浏览器减少动态偏好下正确即时切换，生产 CSS 同时包含正常偏好的苹果式缓动曲线。
- 状态：已完成（含生产发布与线上核验）→ 待用户复核。下一批次：无，最终状态 checkpoint `docs(status): record interface refinement deployment` 推送并同步为 production release 后停止。
- 停止条件：最终状态 checkpoint 生产备份、部署与 `ecs-verify.sh` 通过，使 Git `HEAD`、`origin/main` 和服务器 `current-release` 一致；随后等待用户验收，不开始其他修改。

## 2026-08-17 日历翻页性能、定位动画、标识密度与时间选择器预览（当前批次）

- 批次范围：只处理 3 项——月/周翻页卡顿与首次点击偶发失效、定位今天复用现有横滑动画、日历标识紧凑统一；另按 `frontend-design` 仅制作月份/日期/时间统一选择器 Storybook 预览，未替换生产原生选择器。
- 回归来源：`git log -S`/`git blame` 确认固定 180ms 程序滚动结算来自 `ee63532`，翻页重置选择来自 `41d284b`/`8a49434`，日历标识基础尺寸来自 `48c6fdd`、周视图差异来自 `a1a732a`。固定计时可能在低帧率下早于平滑滚动越过半页，从而被判回中页；每次翻页又重复读取相邻三个月和节假日。
- 测试先行：缓存、滚动结算、选择稳定、定位动画和标识密度断言在旧实现中出现缺失模块及 7 项失败；连续点击排队与程序滚动不得被 180ms idle timer 缩短的追加断言也先失败。实现后日历与 Storybook 定向 16 文件/86 项、全仓 Vitest 94 文件/593 项通过，29 个数据库集成文件/253 项按默认环境跳过。
- 生产实现：程序翻页优先由浏览器 `scrollend` 结算，旧 WebView 使用 700ms 安全回退；程序动画期间不以 180ms idle timer 提前结算，连续点击排队而不丢失。月历/节假日按群组缓存不可变只读结果，相邻翻页通常只需新增月份请求；窗口重新聚焦和冲突刷新仍强制取新。首次加载自动选中业务日，后续翻月/翻周不重置用户选择或触发额外自动滚动。定位今天在月/周中通过相同三面板横滑动画完成，列表行为不变。
- 标识：月/周的换班、加班、节假日及节后补班统一为桌面 16px 高、9px 字、水平 3px 内边距；移动端统一为 14px 高、8px 字、水平 2px 内边距和 3px 圆角。仅改视觉几何，标识文本、颜色、事件和排班数据未变。
- Storybook 预览：采用“医护排班时间轨”方向，手机为底部 Sheet、桌面为邻近浮层，月份 4×3 网格、日期 7 列月历、时间 24 小时双滚轮，共享浅蓝当前选择摘要。390×844、320×844、1280×900 无横向溢出，主要操作均不小于 44px，键盘焦点/减少动态通过，Axe WCAG A/AA 为 0 项违规。预览地址为 `http://127.0.0.1:6007/?path=/story/web-ui-2-0-next-refinements-unified-temporal-pickers--mobile-month-390`；生产替换等待用户视觉确认。
- 运行/浏览器验证：Web typecheck/build、Storybook build、Prettier、ESLint、`node scripts/smoke-browser.mjs`、直接全仓 Vitest 和 `git diff --check` 通过；完整 smoke 覆盖管理员、成员、访客/vkey 与访问记录且无浏览器错误。真实 390px 浏览器确认单击 7月→8月有滚动动画、定位 7月→8月有同款动画、40ms 连续两击到 9月不丢失；周视图单击第4周→第5周及定位返回均有动画。`pnpm verify` 包装器因本机非 TTY 依赖目录检查停止，等价的直接格式、ESLint、Web build/typecheck 与全仓 Vitest 已分别通过。
- 行为审计：缓存仅复用同群只读 GET，拒绝请求会从缓存移除；强制刷新、最新请求追踪、错误/冲突路径和筛选不变。`shallowRef` 只取消未使用的深层代理，日历模型仍整体替换；API、权限、数据库、日期点击、详情和业务写入均未改。checkpoint 识别消息：`fix(web): smooth calendar navigation and compact badges`。
- 正式发布：代码 checkpoint `628c79f` 已推送；发布前加密数据库备份 archive 为 `494a53f0-db00-4c97-8469-71308de60e88`（44 张表、11348 行，SHA-256 `8c6db38ee0705a29d08aa83854eee7f7bc9c2eaf81cbd5debb54911d328504c1`）。release `628c79f27816302c781f429d4628be949b5b3f22` 部署成功，发布前后 `ecs-verify.sh` 通过；容器预热时一次 502 由发布脚本自动重试后恢复。
- 正式域名只读复核：390×844 下单击 8月→7月、7月→8月均一次成功；离开 8月时蓝色选择为 0，返回后原 8月17日选择恢复为 1；定位从 7月返回 8月，周视图第4周→第5周及定位返回第4周均一次成功。浏览器启用减少动态，因此正式复核按设计即时切换；正常动态的滚动过程已由同构建本地浏览器验证。9 月“班”标识为 14px 高、8px 字、2px 水平内边距和 3px 圆角，无横向溢出、3 个真实周面板，控制台无 error/warning，未触发业务写入。
- 下一批次：无已授权生产修改；等待用户确认 Storybook 的月份/日期/时间选择器。确认后才替换生产原生控件。
- 停止条件：最终状态 checkpoint 推送并作为文档同步 release 部署，使 Git `HEAD`、`origin/main` 与服务器 `current-release` 一致；随后等待用户视觉确认。

## 2026-08-17 统一年月、日期与时间选择器落地（当前批次）

- 批次范围：用户确认 Storybook 后，仅把生产中的原生 `month`、`date`、`time` 控件替换为统一 `TemporalPicker`；事件筛选的 `datetime-local` 保持不变。不修改 API、权限、数据库、业务请求或数据结构。
- 回归来源：`git log -S`/`git blame` 确认月份控件分批来自 `5a8380f`、`561310c`、`b9ab3d3`、`7c783c7`、`15729f8`、`36127b0`、`5d8b205`、`b20ff9b`、`ab25064`，日期控件来自 `b1ce5c7`、`0d5ec55`、`0fe9d1a`、`6512274`、`04c7da3`，班种时间控件来自 `41d284b`、`0609cb5`、`0d5ec55`、`04c7da3`。旧冒烟的原生年月定位同步升级为真实组件操作。
- 设计与实现：沿用 `frontend-design` 确认的医护排班时间轨方向；手机为底部 Sheet、桌面为输入旁浮层。年月和时间均使用双栏垂直滚轮，日期使用统一 7 列月历；取消不写值，完成才更新，原本可空的班种时间保留清除。程序化居中与用户滚动结算隔离，避免 `08:00` 打开后误跳 `00:00`；快速确认会同步当前滚轮位置，44px 外层点触区与减少动态保持。
- 语义审计：换班四个月份的独立状态、跨月并行加载和原 `change` 回调各一次不变；统计仍只在完成月份选择后加载一次；历史排班继续直接接收年月字符串；日期最小值、全天禁用、班种非 15 分钟既有值、错误路径及请求次数保持。原生必填日期均有非空初始化且新组件不提供清除。
- 测试先行：生产替换断言在旧代码上 2/2 失败，实现后组件/预览 4/4、受影响定向 49/49、Web 58 文件/421 项通过。全主工作区 Vitest（排除另一批次的 `runtime/ecs-directory-release-src` 打包副本）97 文件/609 项通过，30 文件/256 项按环境跳过。
- 运行/浏览器验证：全仓 Prettier、ESLint、build/typecheck、Web build、Storybook build、`node scripts/smoke-browser.mjs`、`node scripts/smoke-browser.mjs --check-core` 与 `git diff --check` 通过；完整 smoke 覆盖管理员、成员、访客 vkey 与访问记录且无浏览器错误。`pnpm verify` 的格式/lint/build/typecheck 全部通过，最后测试步骤仅因另一批次留下的 `runtime/ecs-directory-release-src` 旧打包副本被重复扫描而失败，主工作区同范围测试已独立全量通过。
- Storybook 专项：真实生产组件在 390px 完成 2026-08→2026-09 和 08:00→08:15 滚轮提交；320px 日期面板无横向溢出；1280px 浮层与触发器间距 12px；打开态 Axe WCAG A/AA 为 0 项违规。预览地址：`http://127.0.0.1:6007/?path=/story/web-ui-2-0-components-temporal-picker--mobile-month-390`。
- 当前状态：已完成（含本地运行验证）→ 待提交、生产备份、部署与线上只读复核。代码 checkpoint 识别消息：`feat(web): unify temporal picker controls`。
- 下一批次：统一选择器生产发布完成后，恢复项目既定 DIR-02 数据提取批次；本轮不提前处理小程序迁移或通讯录数据导入。
- 停止条件：本 checkpoint 推送，生产加密数据库备份、release、`ecs-verify.sh` 与正式域名年月/日期/时间专项复核通过后停止。
