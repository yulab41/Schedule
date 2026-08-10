# Project Status

本文件只记录当前阶段、检查点和下一批任务。Web 1.0 的长期调试记录仍在 `docs/debug/debug-feedback-log.md`；旧小程序 V1/V2 文档已从工作树移除，Git 历史仅用于追溯。

## Current Position

- 日期：2026-08-10
- 分支：`main` / 上游：`origin/main`
- Web 1.0：API、认证、契约、数据库、排班规则和部署基础设施保留并作为小程序共享内核。
- 小程序：V3-0.5 Task 1–2 与 V3-1 Task 3–5 已完成；V3-1 具备真实 manifest/原生 tabBar、会话与角色入口、纯日历逻辑、renderer-neutral VM 及 VM-only 日历页面，等待用户复核。
- V3：V3-1 代码检查点为 `ce21a51`；独立 Task 3/4/5 提交为 `ebfbb31`、`bc534c0` 和 `ce21a51`，均已正常推送。用户已批准 V3-2；Task 6 已通过用户视觉验收，完成本地检查点后仅执行 Task 7。
- 当前批次：真实 Web 部署数据已通过阿里云 API 容器的只读既有端点完整取样为 2026 fixture（全年 12 个月，其中 8/9 月共 61 条班次、6 名成员、1 个岗位、1 个班种、39 条节假日、14 条换班/加扣班事件）。该样本是唯一黄金样本，`develop` 环境日历页不依赖登录或内存注入；`trial`/`release` 仍走真实接口。Task 7 已通过人工 DevTools 复核；Task 8 已定位并修复详情宿主不可见问题，等待重新人工复核第 1–7 项。

## Completed Batch

### V3-0：作废 V2、清理表现层并建立设计规范

- 已将当前未提交的四个 V2 UI 文件放入 Git stash：`archive: obsolete miniprogram V2 UI changes`。
- 已删除旧小程序页面、组件、自定义 tabBar、样式、展示/流程 utils、旧页面 manifest，以及 2026-08-08 的小程序设计/计划/移植文档。
- 已保留 `apps/miniprogram/api/**`、`config/index.ts`、`store/session.ts`、包配置、开发者工具配置、TypeScript 配置、`apps/api/**`、`packages/**` 和部署基础设施。
- 已写入 V3 设计：原生微信能力 + 现有 TDesign 基础控件 + 自绘日历/流程组件；明确 Web 1:1 语义/视觉与移动触控适配的边界。
- 检查点提交信息：`docs(miniprogram): reset obsolete V2 surface and define V3 design`。

### V3-0.1：确认干净构建与渐进 Skyline 策略

- 已审计现存小程序配置与忽略文件：跟踪的 `project.config.json` 仍含 `libVersion: latest`、`compileWorklet: false` 和旧编译开关；本机私有配置仍关闭 Skyline；磁盘残留旧 `miniprogram_npm`、空 `pages/test`；API 401 仍跳 V2 登录页；冒烟脚本尚未遍历分包。
- 用户批准方案 2：所有页面采用自定义导航和局部滚动，日历页先做 Skyline/Worklet，其他页面保留 WebView；只有真机收益、TDesign 白名单、包体积和 fallback 同时通过才逐页扩展。
- V3 设计已加入 V3-0.5 独立清理检查点、Worklet 线程边界、WebView/Skyline 对比验收，以及“单元格优先 + 班种锁定”双模式手动排班。
- 本轮只更新设计和交接，不删除本机文件、不修改构建配置；检查点提交信息：`docs(miniprogram): adopt clean Skyline V3 baseline`。

### V3-0.2：复核两份 UI/UX 建议并建立 V3 初版计划

- 已采纳：微标签视觉、Bottom Sheet、大触控热区、原生能力 + 自绘日历、TDesign 基础控件白名单、CSS 轻量动效、单元格优先/班种锁定。
- 已限定：姓名不得固定截断；整格热区保留日期/排班/标识/电话事件路由；长按仅用于手动网格清空；涂抹排班延后为独立 Spike。
- 已拒绝：通用日历库、首批 Lottie、统一动作热区、把“LLM 手搓”当作工程标准、同时引入多套组件库。
- 已修订 `docs/superpowers/specs/2026-08-09-wechat-miniprogram-v3-design.md`，并建立覆盖 V3-0.5 至最终验收的初版计划；该文件已在 V3-0.3 改名为交付路线图，不能直接执行。
- 检查点提交：`66a1900 docs(miniprogram): finalize V3 design and implementation plan`。
- GitHub 推送：已尝试 `git push origin main`，因连接被重置失败；本地提交完整保留，下一轮重试，不 force-push。

### V3-0.3：按 writing-plans 拆分路线图与首阶段执行计划

- 已完整读取 `writing-plans` skill，并按其范围检查、文件职责图、2–5 分钟步骤、测试先行、完整代码、精确命令和频繁提交要求复核 V3 文档。
- 原 18 项计划覆盖多个独立子系统，概括粒度不足以直接交给执行模型；现改为 `docs/superpowers/plans/2026-08-09-wechat-miniprogram-v3-delivery-roadmap.md`，明确路线图不授权编码。
- 已创建 `docs/superpowers/plans/2026-08-09-wechat-miniprogram-v3-0-5-foundation-implementation-plan.md`：只含当前 V3-0.5 两项任务，给出精确文件职责、失败/通过输出、完整测试与最小实现、验证、状态更新和两次提交步骤。
- 后续 V3-1 至 V3-6 只保留范围与停止条件；每阶段必须在前一检查点后依据真实代码重新生成执行计划，避免为尚不存在的文件、行号和类型制造伪精确。
- 本轮检查点提交信息：`docs(miniprogram): harden V3 planning handoff`。

### V3-0.5：Task 1 可审计跟踪配置基线

- 已完成：将跟踪 `project.config.json` 固定为基础库 `3.16.2`，默认开启域名校验和 Worklet 编译；移除继承的 SWC、Babel 与机器本地开关；新增仅审计跟踪配置的 Node 工具与 3 个测试；清理忽略的 `miniprogram_npm` 与旧空目录 `pages/test`。未修改私有配置或密钥。
- 验证：`pnpm vitest run scripts/miniprogram-config-audit.test.mjs`（1 文件 / 3 测试）通过；`pnpm miniprogram:config:audit` 通过；`pnpm miniprogram:typecheck` 通过；`pnpm exec prettier --check package.json apps/miniprogram/project.config.json scripts/miniprogram-config-audit.mjs scripts/miniprogram-config-audit.test.mjs` 通过；`git diff --check` 通过；`git check-ignore -q apps/miniprogram/project.private.config.json` 通过，且 `git ls-files --error-unmatch apps/miniprogram/project.private.config.json` 预期未命中。
- 运行边界：V3-0.5 尚未创建 `app.json` 或页面，运行时编译与 `pnpm miniprogram:smoke` 延后至 V3-1 创建 manifest 后；本任务不宣称 Skyline、Worklet 运行时或模拟器验证完成。
- 检查点：Task 1 已提交为 `6d2c5fe chore(miniprogram): establish V3 clean build baseline`；该提交最初普通推送连接重置，随后随 Task 2 的正常快进推送同步至 `origin/main`，未 force-push。

### V3-0.5：Task 2 认证过期注入与分包路由覆盖

- 已完成：受保护请求的 401 改为清除令牌并调用可注入回调；公开请求 401 保留会话；回调异常不替换原始 API 错误。API 层不再包含页面路由。
- 已完成：冒烟路由发现覆盖主包与 `subPackages[].pages`，规范化后重复路由立即失败；原有 tab 判断、`switchTab`/`reLaunch`、截图、等待和控制台错误收集保持不变。
- 验证：`pnpm vitest run apps/miniprogram/api/client.test.ts scripts/miniprogram-manifest.test.mjs scripts/miniprogram-config-audit.test.mjs`（3 文件 / 9 测试）通过；`pnpm miniprogram:config:audit`、`pnpm miniprogram:typecheck`、相应 Prettier 检查、旧登录路由扫描和 `git diff --check` 通过；`pnpm smoke:browser` 通过。
- 运行边界：V3-0.5 仍无 `app.json`，未运行 `pnpm miniprogram:smoke`；manifest helper 的单元测试通过，真实模拟器遍历延后至 V3-1。
- 检查点：Task 2 已提交为 `2c93859 fix(miniprogram): inject auth expiry and cover subpackages`；Task 1–2 均已通过正常快进推送同步至 `origin/main`。

### V3-1：Task 3–5 执行计划

- 已创建 `docs/superpowers/plans/2026-08-09-wechat-miniprogram-v3-1-shell-and-calendar-foundation-implementation-plan.md`，范围严格限定为 Task 3 app-shell、Task 4 会话/登录/资料/角色入口、Task 5 日期/筛选/排序/`CalendarMonthViewModel`。
- 计划按 `writing-plans` 标准 header、精确 File Responsibility Map、checkbox 小步骤、完整代码/精确修改、测试红绿输出、官方能力门禁、开发者工具/模拟器/浏览器/核心校验适用条件和三个独立提交展开。
- 真实边界：不恢复/参考 V1/V2；不修改 API、共享契约、权限或后端规则；现有邀请分享路径要求新建 V3 `pages/invite/invite` bridge；现有日历契约没有 marker event ID、`deduction` 或 marker 权限，V3-1 不补字段。计划以 session generation 防止 401/clear 后旧 Promise 恢复认证态，并以测试控制器锁定成员/guest 现有日历端点互斥、过期响应、局部筛选和电话副作用。
- 检查点提交信息：`docs(miniprogram): plan V3-1 shell and calendar foundation`；状态为**待用户复核**，批准前不得执行 Task 3。

### V3-1：Task 3 app-shell、局部滚动与原生导航

- 已完成：新建 V3 `app.json`、`app.ts`、sitemap、token、八枚确定性 81px tab 图标、可复用 `page-shell`/`shell-state`，以及登录、工作台、日历、通知、我的五个 shell 页面。四个 tab 使用原生 tabBar；仅日历页声明 `skyline` 与 `glass-easel`，其余页面保持 WebView。
- 测试先行：`scripts/miniprogram-app-shell.test.mjs` 首次因缺少图标生成器失败；生成器完成后图标测试通过且 manifest 缺失成为第二个预期失败；实现后与 `scripts/miniprogram-manifest.test.mjs` 共 2 文件 / 8 项测试通过。
- 自动验证：`pnpm miniprogram:config:audit`、`pnpm miniprogram:typecheck`、`pnpm miniprogram:lint`、指定 Prettier 检查及 `git diff --check` 均通过；`pnpm smoke:browser` 和 `pnpm smoke:check-core` 均通过。
- DevTools/模拟器：Stable `v2.01.2510290`（满足计划最低版本）下，`pnpm miniprogram:devtools:build-npm` 成功且无警告；`pnpm miniprogram:smoke` 曾打开全部 5 个页面、生成截图且无脚本错误。DevTools preview 最初三次稳定失败 `800059 iconPath=assets/tab-bar/workbench.png, file not found`；只清 compile 缓存无效。最小隔离实验确认生成器的 zlib level 9 PNG 流为根因：Pillow 重编码成功上传；将生成器改为 Node 默认 zlib 流、重新生成图标后 preview 成功并输出 10.5 KB 包体。随后单独与组合 smoke 都在自动化启动阶段无输出超时；官方 CLI close/open 后仍不恢复，已终止挂起命令，需由 DevTools UI 恢复自动化会话后再跑最终 smoke。
- 运行状态：用户在 DevTools 日历 tab 观察到“当前渲染模式：skyline”；调试基础库为 `3.16.2`，本地设置中“将 JS 编译成 ES5”“编译 worklet 代码”“开启 Skyline 渲染调试”均开启。关闭 Skyline 渲染调试后，日历页明确显示“当前渲染模式：WebView”，证明页面级 fallback；工作台和其余 tab 不提供对应 UI 指示，故不虚构其运行标签。Android 微信 `8.0.76` 的 preview 已分别强制 `Skyline`、`WebView`、`Auto`，三种模式均可显示日历页且四项 tab 可切换。DevTools 提示未设置线上最低基础库、低版本使用 WebView 是预期 fallback 说明；自动 fallback 尚未在真实低版本客户端观察。`glass-easel` 由日历页配置和成功编译证明，当前 DevTools 未提供独立运行标签；壳页仅有短状态文案，无溢出内容，不能声称已人工证明局部滚动。
- DevTools 配置恢复：用户在 UI 打开工程后，DevTools 将受跟踪 `project.config.json` 改写为默认值并导致“解析 project.config.json 失败”/缺失 `.js` 页面错误；已从 `2c93859` 恢复严格 V3-0.5 配置，`pnpm miniprogram:config:audit` 与 `pnpm miniprogram:typecheck` 通过。UI 必须以 `E:\AItools\Schedule\apps\miniprogram` 为项目根重新打开；未跟踪 `apps/miniprogram/minitest/test.config.json` 是已记录的 DevTools 产物，不属于未完成任务，保留但不得提交。
- 自动化复核：手动 `cli auto --auto-port 9420` 后以 `MINIPROGRAM_SMOKE_AUTO_WS=ws://127.0.0.1:9420` 运行 smoke；首次连接失败后成功连接，五个 V3 路由全部打开、截图生成且无脚本错误。配置审计在本次自动化后保持通过。
- WXSS 回归修复：DevTools Console 报 `page-shell` 与 `shell-state` 组件 WXSS 导入全局 token 后含 `page` 选择器，不受组件 WXSS 支持。新增回归断言先失败，再移除两处组件导入；全局 `page` token 仍由 app 样式提供并由组件继承。自动验证为 2 文件 / 9 项、typecheck、lint、Prettier 与 diff 检查通过；用户已完整编译确认该两类警告消失。

### V3-1：Task 4 会话、认证、邀请与角色入口

- 已完成：可注入的单飞会话状态机、微信登录包装、一次性受保护 401 跳转、启动恢复、资料补全、邀请 bridge、角色入口与按 `membershipId` 匹配的本人联系方式；未修改 API、合同、权限、后端规则或 `updateProfile`。
- 验证：8 个文件 / 46 项定向测试、配置审计、typecheck、lint、Prettier、`git diff --check`、`pnpm smoke:browser` 与 `pnpm smoke:check-core` 通过；DevTools build-npm 成功且无 warning；复用 `9420` 自动化会话打开全部 7 条路由，无脚本级错误。
- 运行偏差：DevTools CLI preview 仍报已记录的 Stable `800059 iconPath` 错误；这与图标路径无关，且不影响 build 或模拟器路由 smoke。旧 API Node 进程导致 `/platform/me` 404；终止后当前源码 API 返回预期 401，确认端点注册正常。
- 检查点：`bc534c0 feat(miniprogram): add V3 auth and role routing`，已随 V3-1 最终正常快进推送同步至 `origin/main`。

### V3-1：Task 5 日历逻辑、ViewModel 与页面消费边界

- 已完成：新增与 Web 等价的纯日历逻辑（CST 日期/月、周一网格、稳定排序、筛选、节假日简称、变更标记和电话动作）；新增不依赖 `wx`、API 客户端或页面对象的 `CalendarMonthViewModel`，使用稳定的 week/cell/assignment/marker/phone action ID。
- 已完成：控制器通过注入的现有端点按角色互斥加载（guest 只用 guest calendar + guest holidays，其他角色只用受保护 calendar + holidays），同 key 单飞、当前上下文失效、强制刷新、失败分类、纯本地筛选及受验证电话副作用均有测试。未新增 API、共享契约、持久化缓存、事件 ID、扣班字段、Worklet 或 TDesign 日历。
- 已完成：`pages/calendar` 只消费 ViewModel 分支和 action ID；月切换、picker、仅变更开关与重试仅委托控制器。Skyline 原生 button 默认宽度曾令月份标签换行；先新增静态回归断言，再以显式触控宽度、margin 与不换行标签修复，模拟器截图确认 `2026年8月` 恢复单行。
- 验证：定向 6 文件 / 37 项通过；完整 `pnpm vitest run apps/miniprogram` 为 9 文件 / 63 项通过；`pnpm miniprogram:config:audit`、`pnpm miniprogram:typecheck`、`pnpm miniprogram:lint`、Task 5 文件 Prettier、边界扫描、`git diff --check` 与 `pnpm smoke:check-core` 均通过。`pnpm smoke:browser` 不适用（仅小程序日历纯逻辑/VM/页面消费边界，未改 Web/API/共享契约/认证核心链路）。
- DevTools：Stable `2.01.2510290`、服务端口 `25228` 下 build-npm 成功且 warnings `[]`。preview 仍复现已知 Stable `800059 iconPath=assets/tab-bar/workbench.png, file not found` 上传缺陷；本轮未改 PNG，因本地编译、图标审计和模拟器运行均正常。旧 `9420`/`9421` 自动化会话在 `automator.connect()` 超时后失活；CLI 新开 `9422` 后，连接式 smoke 7/7 路由通过、无脚本级错误，日历截图已复核。DevTools 自动 fallback 仍未在真实低版本客户端观察；沿用 Task 3 的 Skyline/WebView/Auto 真机证据，不夸大自动降级结论。
- 提交前审查：同步端点抛错会遗留同 key 单飞槽位，失效筛选会造成 UI 显示“全部”但结果为空；均先以失败测试锁定后修复。旧月完成不会覆盖新月、加载新上下文时不错误复用旧月缓存的回归测试也已覆盖。
- 行为审计：逻辑/VM 不依赖接收者；页面保留 `this.setData`、端点和 `wx` 成员调用；同一 in-flight context 返回同一 Promise，切换 context 的 generation/finally 不可覆盖新状态；`actual* ?? planned*`、空字符串姓名和显式 phone 空值语义保持；日期、selector、switch、action ID 与错误均收窄；筛选/排序不修改源数据，顺序为 businessDate → CST start（00:00 最后）→ 中文角色名 → slot → period → source index。
- 检查点：`ce21a51 feat(miniprogram): add typed calendar view model` 已正常推送至 `origin/main`；Task 5/V3-1 已停止，不执行 Task 6，下一步仅可规划 V3-2。

### V3-2：Task 6–8 执行计划复审（2026-08-10）

- 门禁对账：已重新核对 `ebfbb31`/`bc534c0`/`ce21a51` 独立提交、真实 manifest/VM/页面壳/运行记录、`origin/main` 可达性和唯一未跟踪 DevTools 产物。调试日志顶端过期的“V3-1 未开始”摘要已修正；状态、Git 与日志现在都将 V3-1 标为已完成/待用户复核。
- 计划修订：`docs/superpowers/plans/2026-08-09-wechat-miniprogram-v3-2-calendar-golden-baseline-and-details-implementation-plan.md` 为 1188 行，补齐 Task 6 的无副作用路由 sink、Task 7 的跨月数据月槽/固定三页轮换/role+groupVersion 缓存隔离，以及 Task 8 的显示 VM、受限事件分页、键控两阶段 Bottom Sheet 和电话副作用语义。
- Git 策略：既有 `e85481e` 是本地 V3-2 初稿检查点；本次修订仅创建 `docs(miniprogram): revise V3-2 calendar execution plan` 本地文档提交，不推送。Task 6/7/8 各一独立本地提交，三个停止条件均满足后只做一次正常快进 push。
- 验证：聚焦套件 12 文件 / 74 项、`pnpm miniprogram:typecheck`、`pnpm smoke:check-core` 已通过；本轮运行计划占位符/标识符/契约源/行数检查、四份文档 Prettier 与 `git diff --check`。`pnpm smoke:browser` 不适用（仅文档变更）。
- 状态：**待用户复核**；下一批仅在用户批准后执行 Task 6，禁止在本轮实施生产代码。

### V3-2：Task 6 自绘网格、微标签与无副作用路由（已完成，2026-08-10）

- 已完成自动化步骤：重新核对门禁（`main` 比 `origin/main` 超前 2、仅 `apps/miniprogram/minitest/` 未跟踪），观察 `routeActionId`、黄金 fixture、路由模块和页面边界 guard 的预期红色失败后转绿；新增独立 action-ID 路由、四个自绘日历组件及页面无副作用 route sink。用户反馈月格严重换行后，先令节假日三字回退、缺失 `compactShiftLabel` 与月格旧完整字段断言红，再实现班种单字、节假日最多两字、状态单字和紧凑月格；视觉验收又发现 marker 拉伸、色彩不一致、补班标签错误和姓名缺失，三项失败测试锁定后修复。
- 行为边界：真实 day/assignment 才带 `date:*`/`assignment:*` action ID；marker/phone 仅精确匹配既有 VM ID，guest marker 回退 duty、其他角色进入 events target；Task 6 不加 sheet、toast、事件请求、控制器 route 方法、API 或契约字段。组件不访问 `wx`/端点/会话单例。
- 工具链决定：计划的 WXML Prettier 检查最初因无 parser 失败；`git blame` 确认该检查命令来自 `e85481e`，而项目格式脚本长期排除 WXML。已在 `.prettierrc.json` 为 `*.wxml` 显式配置内置 `html` parser，并以计划原命令复验通过。
- 自动化验证：前置 12 文件 / 74 项通过；紧凑显示、完整 fixture 和开发数据适配聚焦为 7 文件 / 14 项通过；完整小程序为 12 文件 / 68 项通过；配置审计、typecheck、lint、`pnpm smoke:check-core` 与 `git diff --check` 均通过。`pnpm smoke:browser` 不适用（未改 Web/API/契约/认证/构建核心链路）。
- 真实样本、持久开发数据与显示边界：从线上 Web 的既有日历、节假日和事件端点只读取得完整 2026 样本；仓库内 fixture 覆盖全年月份、8/9 月 61 条班次、6 名成员、岗位、班种、39 条节假日及全部 14 条换班/加扣班事件。`calendarFixtureInDevtools` 与 `envVersion === 'develop'` 双重门禁使 DevTools 日历每次启动都使用该只读样本，并以固定 2026-08 月/日期显示；`trial`/`release` 不会进入该分支。线上当前没有可映射 `leave-cover` 的完成事件，故不伪造“替”标识。月格渲染姓名、单字班种及单字 marker；补班固定为“班”。成员全名与电话 action ID 均继续保留在 VM。
- 回归引入点与行为审计：`git log -S`/`git blame` 确认 mini `getHolidayShortLabel`、marker tokens 与原始 `shiftTypeAbbreviation` 由 `ce21a51` 引入；Web 对应节假日、姓名、班种与 marker 样式来自 `a3b14fb`/`DutyCell.vue`/`ChangeBadge.vue`/`MonthGrid.vue`。此次是有意显示变更而非语义等价重构：marker 统一为 Web 的浅黄棕字无描边，workday 统一为蓝色“班”，姓名恢复渲染；真实 marker 类型、action ID、路由、筛选、电话 action、源数据和权限均不变，组件仍不引入 API/`wx`/会话副作用。
- DevTools：Stable CLI、项目 `apps/miniprogram`、端口 `25228` 下 `pnpm miniprogram:devtools:build-npm` 成功（`cost: 3560`，`warnings: []`）。`cli auto --auto-port 9430` 仍未监听自动化 WebSocket，桌面自动化也无法操作其窗口；但不再需要内存注入，重载项目即可由持久 `develop` fixture 显示 2026-08 网格。
- DevTools 验收：用户已确认姓名、班种、节假日、换/加标识的最终视觉效果。Task 6 的点击按计划仅进行无副作用 route sink 解析；详情/电话/事件可见交互属于 Task 8。
- 检查点：`1eef26a feat(miniprogram): add calendar grid routing` 已创建且保持本地、不推送。下一批仅为 Task 7，完成其独立验证和本地提交后停止，仍不得开始 Task 8。

### V3-2：Task 7 三月导航、月/周/列表模式与只读缓存（已完成，2026-08-10）

- 实现：新增 `calendar-views`、`calendar-view-mode`、`calendar-surface` 与 `calendar-cache` 纯模块；控制器按 `userId/groupId/groupRole/groupVersion/businessMonth` 隔离槽位，三月加载按年度节假日单飞，缓存先显示再刷新，过期/失败保留 stale 快照，筛选和电话 action 跨槽位复用。
- 页面：新增固定三页 `swiper` 轮换、月/周/列表模式、跨月周源数据、`cacheNotice`，以及 `calendar-week`/`calendar-list` 组件；页面仍只消费 ViewModel，未加入详情 sheet、事件加载或 API/契约变更。
- 回归修复：DevTools 点击日历曾报 `can not find module`，实际失败于 `calendar-cache` 运行时加载仓库外的 `../../../packages/contracts/src/*.js` schema；`calendar-page-controller.ts:14` 只是导入触发点。该缓存文件是本 Task 未提交新增文件，`git log -S '../../../packages/contracts/src/calendar.js' -- apps/miniprogram/store/calendar-cache.ts` 无记录且 `git blame` 无法归属。先新增 bundle 边界断言并观察其失败，再以小程序内的等价严格结构校验替代 Zod 运行时导入；共享契约只保留编译期类型。严格字段、嵌套 marker、日期/颜色/时间格式与节假日缓存仍会在读取时拒绝。
- 语义审计：本地校验函数不依赖接收者、无异步或副作用；缓存的 key、同步存储异常吞没、过期判断、缓存先发布后刷新、网络失败 stale 回退和身份隔离均未改变。页面仍保留 `this.setData`、端点与 `wx` 的成员调用，Promise/generation 仅发布当前 context，筛选复制数组后重建 VM；未修改 API、共享契约、认证、持久化格式或授权范围。
- 验证：定向套件 10 文件 / 43 项、完整 `pnpm vitest run apps/miniprogram` 16 文件 / 79 项、缓存/运行边界回归 2 文件 / 7 项、配置审计、typecheck、lint、Prettier、`pnpm smoke:check-core`、契约/API 空 diff 与 `git diff --check` 均通过；`pnpm miniprogram:devtools:build-npm` 无 warnings，`pnpm miniprogram:devtools:preview` 成功（154.8 KB），复用 `ws://127.0.0.1:9422` 的 `pnpm miniprogram:smoke` 通过 7/7 当前 manifest 页面、无脚本级错误。
- DevTools 续验：固定 `cli auto --auto-port 9422` 成功并监听；连接/路由可用，但页面级 Skyline 只返回 `__webviewId__`，`Page.getData`/页面 handler/selector 报 `page node not found` 或不存在。`App.captureScreenshot` 生成的 `august-initial.png` 为全白帧，不能作为视觉证据；这是 Stable DevTools + `miniprogram-automator 0.12.1` 的 Skyline 页面观测边界，不归因于 Task 7 生产代码。已停止本轮一次性 probe，未改端点、会话或持久化数据。
- 视觉门禁：自动化路由通过不等于月切换、跨月周、列表、网络失败 cache notice 的视觉/触控通过；调用次数仍由已通过的 controller 单测覆盖。用户明确将视觉审查交由人工，故在 DevTools 强制重新编译后仅需确认点击日历 tab 不再出现模块缺失，并复核上述视图切换/缓存提示。Task 7 主检查点为 `42d6243 feat(miniprogram): add calendar navigation and read cache`；不开始 Task 8。
- 导航回归修复：人工 UI 审核发现上/下月和上/下周会把页面卡在 loading。根因是 `updateNavigation` 将三个槽位全部替换为 loading，但控制器会对已加载月份直接返回且不重复发布，页面遂失去其 ready VM。先新增纯 surface 红色测试，再让导航重心函数复用同月份既有槽位，仅为新进窗口月份建立 loading VM；这样中心月份始终保留已有内容。回归后定向 3 文件 / 25 项、完整小程序 16 文件 / 80 项、配置审计、typecheck、lint、Prettier、`git diff --check` 与 `pnpm smoke:check-core` 通过；DevTools build-npm 成功（warnings `[]`）。等待人工再次点击四个前后按钮确认。
- 快速反向导航回归：连续向一侧移动后反向操作仍可卡住，因为离开页面窗口的已完成 slot 在回到窗口时走 controller data fast-path 而不重新发布，页面保留 loading。新增失败测试覆盖“8 月离开再回到可见窗口”；fast-path 现会重新发布已有 ready/cached VM，但不新增端点请求或改变 Promise、缓存、筛选、错误及电话 action 语义。完整小程序 16 文件 / 81 项、配置审计、typecheck、lint、Prettier、`git diff --check`、`pnpm smoke:check-core` 与 DevTools build-npm（warnings `[]`）均通过。
- 人工复核：用户于 2026-08-10 确认 DevTools 强制重新编译后，上/下月和上/下周连续、快速反向点击均不再卡在“正在加载排班”；Task 7 视觉门禁通过。

### V3-2：Task 8 日期、值班、事件与电话详情 Sheet（已修复待人工复核，2026-08-10）

- 实现：新增纯 Bottom Sheet 相位/拖拽状态机和带 `sheetKey` 的页面宿主；一个持久 `bottom-sheet` 承载日期、值班、事件、电话四个展示组件。关闭保留内容直至匹配 key 的 `closed`；旧 key、重开和错误 key 均无页面副作用。
- 事件与电话：新增 WXML-safe 事件显示 VM 和单页事件控制器，只调用一次 `listEvents(groupId, undefined, 100)` 并按 `affectedShiftIds` 客户端过滤。guest 路由仍只开值班 Sheet；日期详情显式显示电话 action，紧凑月格保持不显示号码。电话 action 只转发给既有 `performPhoneAction`，confirmed dial/未确认 copy 各最多一次；组件不调用端点、`wx` 或管理生命周期。
- 样本决策：用户明确弃用 V3-2 计划内的 `golden-*` 示例。之前从 Web 抓取并持久化的真实 2026 fixture 是唯一运行/验收样本；仅用测试局部的类型化事件向量覆盖该快照缺少的 leave-cover 情形，未修改运行数据、API 或共享契约。
- 测试先行与验证：四个纯模块先因缺失红色失败；边界守卫先因详情组件不存在红色失败。实现后完整小程序与边界守卫为 21 文件 / 96 项通过，配置审计、typecheck、lint、Prettier、`pnpm smoke:check-core`、契约/API 空 diff 与 `git diff --check` 通过；DevTools `build-npm` 成功（cost 3868，warnings `[]`）、preview 成功（188.2 KB）。运行/浏览器验证：`pnpm smoke:browser` 不适用（未改 Web/API/契约/认证/构建核心链路）。
- 人工复核结果：重新编译后，第 1–5 项（空白日期、排班行、member/guest marker、电话与事件详情）均无法复现，故人工门禁不通过；第 6–7 项通过。需要先定位详情入口未出现的运行态原因，再进行复核；在此之前不启动 Task 9/V3-3。
- 根因与修复：`bottom-sheet` 原先位于 `page-shell` 默认 `scroll-view` 插槽内；在 DevTools/Skyline 运行时，`position: fixed` 的详情宿主无法作为页面级遮罩/面板显示，导致日期、值班、事件、电话四类入口统一无可见结果。已将唯一 keyed host 移到 page-level、`page-shell` 外部；页面状态机和四个详情 body 未改变。
- 回归证据：新增 boundary 断言先在旧 WXML 上红灯（`bottom-sheet` 起始位置早于 `</page-shell>`），移动宿主后转绿。完整小程序 + boundary 为 21 文件 / 96 项通过；配置审计、typecheck、lint、Prettier、`pnpm smoke:check-core`、契约/API 空 diff、`git diff --check` 通过；DevTools `build-npm` cost 3753、warnings `[]`，preview 188.2 KB 成功。
- Git 检查点：`7d95a0a feat(miniprogram): add calendar detail sheets` 已于本轮通过 VPN 全局 + TUN 链路正常快进推送至 `origin/main`；未 force-push。

## Validation

- 清理前基线：`pnpm miniprogram:typecheck` 通过；`pnpm vitest run apps/miniprogram` 通过（18 个文件 / 101 项，包含随后归档的 V2 回归 spec）。
- 验证已完成：`git diff --check`、`pnpm miniprogram:typecheck` 通过；`pnpm verify` 通过（82 个测试文件，660 项通过，249 项按环境跳过）。
- V3-0.1 文档验证：`git diff --check` 通过；`pnpm exec prettier --check docs/superpowers/specs/2026-08-09-wechat-miniprogram-v3-design.md` 通过。
- V3-0.2 文档验证：设计、计划、状态和调试记录的 Prettier 检查通过；关键术语/拒绝项检索通过；`git diff --check` 通过。
- V3-0.3 文档验证：路线图/执行计划引用、25 个 checkbox 步骤、代码围栏、禁执行边界、占位符和过期引用扫描通过；5 份文档 Prettier 检查与 `git diff --check` 通过。
- V3-0.5 检查点复核：`HEAD == origin/main == 2c93859`、工作树起始状态干净；`pnpm vitest run apps/miniprogram/api/client.test.ts scripts/miniprogram-manifest.test.mjs scripts/miniprogram-config-audit.test.mjs` 为 3 文件 / 9 测试通过；配置审计、mini-program typecheck 和 core-smoke guard 通过。
- V3-1 计划验证：执行计划、路线图、状态和调试日志经 Prettier、51 个 checkbox / 194 个配对代码围栏、路径/术语/占位符/类型一致性扫描与 `git diff --check` 复核；`pnpm smoke:check-core` 通过并确认仅文档变更无需浏览器冒烟；本轮不运行开发者工具或小程序模拟器。
- V3-1 Task 3：`pnpm vitest run scripts/miniprogram-app-shell.test.mjs scripts/miniprogram-manifest.test.mjs`（2 文件 / 9 项）通过；配置审计、typecheck、lint、Prettier、`git diff --check`、`pnpm smoke:browser`、`pnpm smoke:check-core` 通过；DevTools npm 构建无警告、preview 成功（10.5 KB）、模拟器冒烟 5/5 页面通过，真机 Skyline/WebView/Auto 及 tab 切换通过。检查点：`ebfbb31 feat(miniprogram): add V3 app shell and native navigation`，已随 V3-1 最终正常快进推送同步至 `origin/main`。

## Decisions and Deviations

- 不使用宽范围 `git reset`，避免删除 API、认证、契约和后端基础设施；通过显式删除和单一检查点提交完成清理。
- 不新增 WeUI、Vant、ColorUI 或通用日历库；若原生能力和已有 TDesign 被证明不足，必须先完成有包体积和截图证据的 spike。
- 不原样继承 V2 `project.config.json`、本机私有设置或旧 `miniprogram_npm`；实施第一批先完成 V3-0.5 干净构建基线。
- 默认保持 WebView 可用，V3-1 仅日历页声明 Skyline/`glass-easel`；`compileWorklet` 是跟踪编译基线，V3-1 不实现 Worklet，Skyline 不凭静态配置或平均帧率直接全局扩展。
- 手动排班同时支持先选单元格和先锁定班种；快速填班不用全局 200ms 防抖，不逐格确认覆盖，依靠单元格级去重、撤销栈和发布前确认。
- 涂抹排班只作为单元格优先/班种锁定通过后的独立 Spike；失败时保留点击模式，不得把实验交互当作 V3 基线。
- 本地缓存只用于只读快照，不能成为排班写入源或离线提交队列。
- V3 日历必须完整保留成员、班次、节假日和当前契约的换/替/加标识；`deduction` 只有未来服务端/契约实际提供且上下文允许时才能出现；同日多排班不得只取第一条。

## Previous Batch

1. V3-0.5 Task 1–2 已分别在 `6d2c5fe`、`2c93859` 完成并推送；代码、测试、状态文档和 Git 历史已在本轮重新核对。
2. 使用 `writing-plans` 从真实 V3-0.5 检查点生成 V3-1 Task 3–5 执行计划；停止条件：只提交计划文档和索引/状态/日志更新，不执行 Task 3。
3. 以 writing-plans 的 header/checkbox 标准（用户覆盖“完整生产代码”要求，改为 contract-first/test-first/code-light）从真实 V3-1 检查点复审 V3-2 Task 6–8 执行计划；停止条件：只提交计划文档和路线图/状态/日志更新，不执行 Task 6。

## Active Batch

1. V3-2 Task 6 为 `1eef26a`；Task 7 主检查点为 `42d6243`，两轮 loading 回归为 `3171b2b` 与 `59707f7`，且已通过用户人工复核。
2. Task 8 初次人工复核因详情宿主位于 `page-shell` 滚动插槽而不通过；该问题已修复并完成自动/DevTools 构建验证，当前状态为**已实现待浏览器复核**。用户重新编译后需复核第 1–7 项，确认通过前不得开始 Task 9/V3-3。
3. 用户于 2026-08-10 明确覆盖 V3-2 原“Task 8 后单次 push”策略；`7d95a0a` 已通过 VPN 全局 + TUN 链路正常快进推送至 `origin/main`，本次修复检查点完成后继续正常推送，不 force-push。

## Handoff Requirements

- 每个检查点前更新本文件和 `docs/debug/debug-feedback-log.md`。
- V3-1 唯一实施依据是已索引的阶段计划；交付路线图摘要不授权编码。
- 只显式暂存当前检查点相关路径；提交前检查 `git diff`、`git diff --cached` 和行为变化清单。
- 涉及 Web/API/认证/契约/构建核心链路时，按 `AGENTS.md` 运行并记录 `pnpm smoke:browser` 和 `pnpm smoke:check-core`。
- 完成状态沿用“已实现待浏览器复核 → 已完成 → 待用户复核”。
