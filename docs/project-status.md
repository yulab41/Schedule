# Project Status

本文件只记录当前阶段、检查点和下一批任务。Web 1.0 的长期调试记录仍在 `docs/debug/debug-feedback-log.md`；旧小程序 V1/V2 文档已从工作树移除，Git 历史仅用于追溯。

## Current Position

- 日期：2026-08-12
- 分支：`main` / 上游：`origin/main`
- Web 1.0：API、认证、契约、数据库、排班规则和部署基础设施保留并作为小程序共享内核。
- 小程序：V3-0.5 Task 1–2、V3-1 Task 3–5、V3-2 Task 6–8 及后续日历 UI 回归修复均已完成；Task 8 详情内容已通过用户 DevTools 人工复核。
- V3：V3-2 最终代码检查点为 `9629454` 且已在 `origin/main`；最终门禁为 23 文件 / 105 测试、config audit、typecheck、lint、core smoke、契约/API 空 diff 与 diff check 全部通过。Web 对照、WebView fallback、低端 Android/iOS 和性能证据经用户确认延后到 V3-6。
- 当前批次：V3-4 Task 11 `4a0d44c`（单元格优先）与 Task 12 `43eae1c`（班种锁定）均已正常快进推送。Task 13 已完成实现和自动化验证，待本轮 checkpoint：模板预览/应用、按服务端 operationId 分组的草稿批量发布、撤回影响预览、409 恢复、精确日历失效，以及真实 `schedule_test` 手动排班 allowlist（2 文件 / 22 项、零 skip）。Web 浏览器烟测和核心校验通过；DevTools CLI 的 `build-npm → preview → smoke` 在启动时 64 秒无输出超时，因此 Task 13 状态为**已实现待 DevTools/Android/iOS 复核**，本 checkpoint 后停止，不进入新任务。

## Completed Batch

### V3-4 Task 13 模板应用、草稿发布、撤回与冲突保护（2026-08-12）

- 授权与溯源：用户在 `43eae1c` 推送后要求继续。先用 `git log -S`/`git blame` 复核 `a68dd03` 引入的 template apply、draft/history、batch publish、withdraw/change-impact wrapper，以及 `4a0d44c` 的 controller 状态源；本轮不改 API、共享契约、权限或离线协议。用户/DevTools 的未跟踪 `apps/miniprogram/minitest/` 未读取、修改、格式化或暂存。
- 实现与行为审计：controller 在同一 generation 状态源中加载 template/config/draft/history，预览带当前 `expectedRulesVersion`；每次明确 apply、发布或撤回才生成新的 UUID operationId，绝不持久化或自动重放。预览会在模板/草稿改变、成功写入或 409 时失效；409 保留服务端原 message/latestData、刷新权威 template/draft/history 并不清失败动作的日历 cache。apply、按 operationId（由 history 关联）分组的 batch publish、withdraw 三种成功写入才按实际 period 的 `YYYY-MM` 精确删除并广播 user/group/month cache；失败、取消、陈旧完成均不失效。撤回必须先消费服务端 `previewScheduleChange`，页面展示 workflow 影响；应用预览展示 assignment 数、硬冲突、空缺及连续值班提醒，硬冲突时确认按钮禁用，不提交任何未经服务端许可的 acknowledgement/replace 字段。
- 测试先行与 runner：endpoint 边界与 controller 的成功/409 cache 行为先扩展为失败测试；固定 allowlist 的 runner spec 初始因 export 缺失失败，随后实现 `pnpm test:api-integration:manual-schedule`，只执行 `templates.integration.test.ts` 与含 batch publish/覆盖/请假/幂等测试的 `manual-apply.integration.test.ts`。
- 验证：定向 3 文件 / 17 项、完整 `pnpm vitest run apps/miniprogram` 40 文件 / 181 项、`pnpm test:api-integration:manual-schedule` 2 文件 / 22 项（真实 `schedule_test`、零 skip）、config audit、typecheck、lint、任务文件 Prettier 与 `git diff --check` 均通过。运行/浏览器验证：`pnpm smoke:browser` 通过登录/管理员/成员/访客/审计全流程，随后 `pnpm smoke:check-core` 通过并确认未涉及列举的 Web 核心路径。最终 DevTools CLI 串行 build/preview/smoke 在启动阶段 64 秒无输出超时，记录为既有 transport 工具边界，不能替代页面验证。
- 状态：**已实现待 DevTools/Android/iOS 复核**。复核需覆盖无遗留草稿的空态、跨月重复应用、请假/失效模板/409、草稿 operationId 分组发布、撤回 workflow 影响、成功后重返日历与失败不失效 cache；本 checkpoint 提交信息为 `feat(miniprogram): add template publishing and conflict protection`，随后停止，不开始新任务。

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

### V3-2：Task 6–8 执行计划复审（历史门禁，已完成）

- 门禁对账：已重新核对 `ebfbb31`/`bc534c0`/`ce21a51` 独立提交、真实 manifest/VM/页面壳/运行记录、`origin/main` 可达性和唯一未跟踪 DevTools 产物。调试日志顶端过期的“V3-1 未开始”摘要已修正；状态、Git 与日志现在都将 V3-1 标为已完成/待用户复核。
- 计划修订：`docs/superpowers/plans/2026-08-09-wechat-miniprogram-v3-2-calendar-golden-baseline-and-details-implementation-plan.md` 为 1188 行，补齐 Task 6 的无副作用路由 sink、Task 7 的跨月数据月槽/固定三页轮换/role+groupVersion 缓存隔离，以及 Task 8 的显示 VM、受限事件分页、键控两阶段 Bottom Sheet 和电话副作用语义。
- Git 策略：原计划要求 Task 6/7/8 各一本地提交并在最后单次 push；用户随后明确覆盖为按变更正常快进推送，最终链已完整到达 `origin/main`，未 force-push。
- 验证：聚焦套件 12 文件 / 74 项、`pnpm miniprogram:typecheck`、`pnpm smoke:check-core` 已通过；本轮运行计划占位符/标识符/契约源/行数检查、四份文档 Prettier 与 `git diff --check`。`pnpm smoke:browser` 不适用（仅文档变更）。
- 状态：该门禁已由用户后续批准解除；Task 6–8 与 UI 回归现均完成。

### V3-2：Task 6 自绘网格、微标签与无副作用路由（已完成，2026-08-10）

- 已完成自动化步骤：重新核对门禁（`main` 比 `origin/main` 超前 2、仅 `apps/miniprogram/minitest/` 未跟踪），观察 `routeActionId`、黄金 fixture、路由模块和页面边界 guard 的预期红色失败后转绿；新增独立 action-ID 路由、四个自绘日历组件及页面无副作用 route sink。用户反馈月格严重换行后，先令节假日三字回退、缺失 `compactShiftLabel` 与月格旧完整字段断言红，再实现班种单字、节假日最多两字、状态单字和紧凑月格；视觉验收又发现 marker 拉伸、色彩不一致、补班标签错误和姓名缺失，三项失败测试锁定后修复。
- 行为边界：真实 day/assignment 才带 `date:*`/`assignment:*` action ID；marker/phone 仅精确匹配既有 VM ID，guest marker 回退 duty、其他角色进入 events target；Task 6 不加 sheet、toast、事件请求、控制器 route 方法、API 或契约字段。组件不访问 `wx`/端点/会话单例。
- 工具链决定：计划的 WXML Prettier 检查最初因无 parser 失败；`git blame` 确认该检查命令来自 `e85481e`，而项目格式脚本长期排除 WXML。已在 `.prettierrc.json` 为 `*.wxml` 显式配置内置 `html` parser，并以计划原命令复验通过。
- 自动化验证：前置 12 文件 / 74 项通过；紧凑显示、完整 fixture 和开发数据适配聚焦为 7 文件 / 14 项通过；完整小程序为 12 文件 / 68 项通过；配置审计、typecheck、lint、`pnpm smoke:check-core` 与 `git diff --check` 均通过。`pnpm smoke:browser` 不适用（未改 Web/API/契约/认证/构建核心链路）。
- 真实样本、持久开发数据与显示边界：从线上 Web 的既有日历、节假日和事件端点只读取得完整 2026 样本；仓库内 fixture 覆盖全年月份、8/9 月 61 条班次、6 名成员、岗位、班种、39 条节假日及全部 14 条换班/加扣班事件。`calendarFixtureInDevtools` 与 `envVersion === 'develop'` 双重门禁使 DevTools 日历每次启动都使用该只读样本，并以固定 2026-08 月/日期显示；`trial`/`release` 不会进入该分支。线上当前没有可映射 `leave-cover` 的完成事件，故不伪造“替”标识。月格渲染姓名、单字班种及单字 marker；补班固定为“班”。成员全名与电话 action ID 均继续保留在 VM。
- 回归引入点与行为审计：`git log -S`/`git blame` 确认 mini `getHolidayShortLabel`、marker tokens 与原始 `shiftTypeAbbreviation` 由 `ce21a51` 引入；Web 对应节假日、姓名、班种与 marker 样式来自 `a3b14fb`/`DutyCell.vue`/`ChangeBadge.vue`/`MonthGrid.vue`。此次是有意显示变更而非语义等价重构：marker 统一为 Web 的浅黄棕字无描边，workday 统一为蓝色“班”，姓名恢复渲染；真实 marker 类型、action ID、路由、筛选、电话 action、源数据和权限均不变，组件仍不引入 API/`wx`/会话副作用。
- DevTools：Stable CLI、项目 `apps/miniprogram`、端口 `25228` 下 `pnpm miniprogram:devtools:build-npm` 成功（`cost: 3560`，`warnings: []`）。`cli auto --auto-port 9430` 仍未监听自动化 WebSocket，桌面自动化也无法操作其窗口；但不再需要内存注入，重载项目即可由持久 `develop` fixture 显示 2026-08 网格。
- DevTools 验收：用户已确认姓名、班种、节假日、换/加标识的最终视觉效果。Task 6 的点击按计划仅进行无副作用 route sink 解析；详情/电话/事件可见交互属于 Task 8。
- 检查点：`1eef26a feat(miniprogram): add calendar grid routing` 已创建并随 V3-2 提交链正常推送。

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

### V3-2：Task 8 日期、值班、事件与电话详情 Sheet（已完成，2026-08-11）

- 实现：新增纯 Bottom Sheet 相位/拖拽状态机和带 `sheetKey` 的页面宿主；一个持久 `bottom-sheet` 承载日期、值班、事件、电话四个展示组件。关闭保留内容直至匹配 key 的 `closed`；旧 key、重开和错误 key 均无页面副作用。
- 事件与电话：新增 WXML-safe 事件显示 VM 和单页事件控制器，只调用一次 `listEvents(groupId, undefined, 100)` 并按 `affectedShiftIds` 客户端过滤。guest 路由仍只开值班 Sheet；日期详情显式显示电话 action，紧凑月格保持不显示号码。电话 action 只转发给既有 `performPhoneAction`，confirmed dial/未确认 copy 各最多一次；组件不调用端点、`wx` 或管理生命周期。
- 样本决策：用户明确弃用 V3-2 计划内的 `golden-*` 示例。之前从 Web 抓取并持久化的真实 2026 fixture 是唯一运行/验收样本；仅用测试局部的类型化事件向量覆盖该快照缺少的 leave-cover 情形，未修改运行数据、API 或共享契约。
- 测试先行与验证：四个纯模块先因缺失红色失败；边界守卫先因详情组件不存在红色失败。实现后完整小程序与边界守卫为 21 文件 / 96 项通过，配置审计、typecheck、lint、Prettier、`pnpm smoke:check-core`、契约/API 空 diff 与 `git diff --check` 通过；DevTools `build-npm` 成功（cost 3868，warnings `[]`）、preview 成功（188.2 KB）。运行/浏览器验证：`pnpm smoke:browser` 不适用（未改 Web/API/契约/认证/构建核心链路）。
- 人工复核结果：重新编译后，第 1–5 项（空白日期、排班行、member/guest marker、电话与事件详情）均无法复现，故人工门禁不通过；第 6–7 项通过。需要先定位详情入口未出现的运行态原因，再进行复核；在此之前不启动 Task 9/V3-3。
- 根因与修复：`bottom-sheet` 原先位于 `page-shell` 默认 `scroll-view` 插槽内；在 DevTools/Skyline 运行时，`position: fixed` 的详情宿主无法作为页面级遮罩/面板显示，导致日期、值班、事件、电话四类入口统一无可见结果。已将唯一 keyed host 移到 page-level、`page-shell` 外部；页面状态机和四个详情 body 未改变。
- 回归证据：新增 boundary 断言先在旧 WXML 上红灯（`bottom-sheet` 起始位置早于 `</page-shell>`），移动宿主后转绿。完整小程序 + boundary 为 21 文件 / 96 项通过；配置审计、typecheck、lint、Prettier、`pnpm smoke:check-core`、契约/API 空 diff、`git diff --check` 通过；DevTools `build-npm` cost 3753、warnings `[]`，preview 188.2 KB 成功。
- 点击链路修复：宿主移出后日期仍无响应，进一步定位为 `calendar-grid` 位于 `page-shell` slot、详情 body 位于 `bottom-sheet` slot，而页面级自定义事件默认不跨组件边界。所有页面级 route/dial/copy 转发器现在使用 `{ bubbles: true, composed: true }`；内部 `assignment-row`/`marker-badge` 仍不冒泡，避免重复路由。旧代码 boundary 先红后绿；最新全量 21 文件 / 96 项、build-npm cost 12111、warnings `[]`、preview 188.5 KB 均通过。
- 内容区修复：人工复核确认点击已能打开抽屉，但日期、值班、事件三类都只显示标题和关闭按钮。`bottom-sheet__content` 原先只有 `max-height`，没有 `scroll-view` 所需的明确高度；新增 `height: 62vh`，并在 boundary guard 中锁定该约束。旧样式测试先红，新增高度后转绿。
- 最新验证：完整小程序 + boundary 为 21 文件 / 96 项通过；配置审计、typecheck、lint、Prettier、`pnpm smoke:check-core`、契约/API 空 diff、`git diff --check` 通过；DevTools `build-npm` cost 3128、warnings `[]`，preview 188.5 KB 成功。`pnpm smoke:browser` 不适用（未改 Web/API/契约/认证/构建核心链路）。
- 人工复核：用户于 2026-08-11 强制重新编译后确认日期详情、值班详情、事件详情等内容均正常显示，Task 8 UI 门禁通过。
- 最终检查集：在断言加固后执行 `apps/miniprogram` + calendar boundary + app-shell + manifest，共 23 文件 / 105 项通过；配置审计、typecheck、lint、Prettier、`pnpm smoke:check-core`、契约/API 空 diff 与 `git diff --check` 均通过。
- Git 检查点：最终断言加固 `9629454 test(miniprogram): couple bottom-sheet height guard` 已正常快进推送至 `origin/main`，未 force-push。

### V3-3：Task 9 工作流计划与 Task 10 范围冻结（2026-08-11）

- 新计划：`docs/superpowers/plans/2026-08-11-wechat-miniprogram-v3-3-workflows-implementation-plan.md`。Task 9 按 9.1/9.2/9.3 三个独立 checkpoint 展开；批准后的唯一下一批是 9.1，完成即停，不同轮进入 9.2。
- Web 同步：管理员直换必须提供、先 preview、没有 reason 且绕过普通审批；管理员直代不新增 preview、reason 选填且绕过普通审批。请假创建仅有非阻塞受影响班次提示、没有 operationId；完整 preview 只在审批阶段。
- 冲突/并发：409 固定“捕获原错误 → 废弃 preview → 刷新权威状态 → 发布原错误/安全摘要”，不自动重放。支持 operationId 的动作按当前 Web 每次明确提交生成新 ID，同一在途提交由客户端单飞；请假创建只做客户端单飞。
- 动作/缓存：动作资格按群组角色 × 请求状态 × 当前 membership 业务关系 × `isRevocable` 三态；硬 `workflowBlockers` 不可 acknowledgement 绕过。实际排班变化同时删除精确持久缓存并标记跨页 invalidation epoch，日历下次 `onShow` 丢弃 ready slot 后强制重取。
- Task 10：通知、个人、群组、匿名访客、会话和角色导航的范围/安全边界已冻结；只有 Task 9.3 最终 checkpoint 与 Task 9 运行/人工复核完成后，才能重审实际 endpoints、分包、路由和缓存、另写并另行批准文件级计划。本计划第 10 节永不授权实施 Task 10。
- 安全纠偏：anonymous QR 使用无 tabBar 单群页；authenticated guest 必须有登出但不能通过静态 tabBar/直接路由加载通知等越权数据；guest/anonymous API 只返回 confirmed 号码；`left-member` 只能由管理员邀请回流，不恢复 claim。
- 计划文档检查点信息：`docs(miniprogram): plan V3-3 workflow delivery`。

### V3-3：Task 9.1 端点、工作流内核与运行时（已完成，2026-08-11）

- 端点：对齐 leave/swap/duty 的真实 input/output，补齐 direct、群组/成员 settings 与 leave reflow strategy wrappers；端点测试锁定 method、path、payload 和返回类型。
- 纯内核：新增同 context/generation 的 mutation 单飞、稳定 preview 指纹、409 原错误保留/preview 废弃/权威刷新/安全 latestData 摘要、CST 全天半开区间、候选班次和 role/status/relation/isRevocable 动作矩阵；没有自动重放。
- 路由与权限：注册 workflows 分包请求中心壳；仅真实非 guest 群组身份可从工作台进入，platform-admin-only 与 guest 不加载工作流端点。没有实现领域提交页面。
- 日历：共享 cache runtime 精确删除 user/group/month 持久缓存并推进 invalidation epoch；日历 `onShow` 先丢弃受影响 ready slot 后重取。`minitest/` 保留为用户/DevTools 未跟踪产物，未读取、修改或暂存。
- 测试先行与回归溯源：新增套件先因缺模块、错型 wrapper、失效方法、路由上下文和分包缺失而失败，实施后转绿；`git log -S`/`git blame` 记录端点 `d9c2d6e`、日历 `42d6243`、导航 `bc534c0`、app shell `ebfbb31` 的引入点。
- 验证：定向 9 文件 / 56 项通过；完整小程序、app-shell 与 workflows boundary 为 27 文件 / 126 项通过；config audit、typecheck、lint、明确文件 Prettier 与 diff check 通过。`pnpm smoke:browser`、随后 `pnpm smoke:check-core` 通过。DevTools build-npm warnings `[]`，preview 成功（main 193.6 KB，workflows 1.3 KB）；标准连接态 `pnpm miniprogram:smoke` 经 reconnect 修复后 8/8 注册页面通过、无脚本级错误。
- 状态：已完成（含运行/浏览器验证），待用户复核。检查点提交信息：`fix(miniprogram): align workflow endpoints and runtime`。

### V3-3：Task 9.2 全天请假与审批（已完成，2026-08-11）

- 创建：独立全天请假页使用 CST 半开区间、选填原因和本地单飞；影响班次查询失败与确认无已发布班次使用不同提示，但都不阻止提交。创建 payload 没有 `operationId`，409 保留原错误、清理辅助影响并刷新权威列表。
- 审批：pending 请求打开完整 preview；策略变更废弃旧 preview 并重取。页面完整呈现影响班次、未发布期间、前后人员、统计、冲突、硬 blocker、连续值班警告和空缺。硬 blocker、无/过期 preview 与未确认冲突/空缺均显式禁用批准；approve/reject 使用真实响应类型与 preview 版本快照。
- 列表与策略：支持 pending 取消、approved 撤销（明确不自动恢复排班），每次成功 mutation 刷新列表。管理员可读写群组默认重排策略且不携带 operationId；成员只读已保存策略。批准仅按实际改动的 `businessDate` 月份精确失效日历，撤销不清日历。
- 回归与审查：`git log -S`/`git blame` 定位端点引入点 `d9c2d6e` 与 Task 9.1 调用方 `5ccd04f`。红绿测试和独立审查修正了 UUID v4 operationId、审批按钮派生阻断和切群后清理 local single-flight 三项边界。
- 验证：定向 leave/boundary 2 文件 / 13 项、完整小程序/app-shell/workflows boundary 28 文件 / 137 项通过；config audit、typecheck、lint、明确文件 Prettier、diff check、`pnpm smoke:browser` 后的 `pnpm smoke:check-core` 均通过。DevTools build-npm warnings `[]`，preview 成功（总计 232.3 KB；main 215.4 KB；workflows 16.9 KB）。标准复用连接 smoke 在 `reLaunch` 后无输出挂起并安全终止；同连接直接 route/console probe 打开 9/9 注册页面（包括 leave）且 `scriptErrors=0`，invite 在当前会话按预期重定向至工作台。
- 状态：已完成（含运行/浏览器/DevTools 验证），待用户复核。检查点提交信息：`feat(miniprogram): add leave workflows`；下一项仅为 Task 9.3，Task 10 仍冻结。

### V3-3：Task 9.3 换班、加扣班、审批与缓存失效（已完成，2026-08-11）

- 流程：新增独立纯控制器和 operations 分包页。普通换班/加扣班没有有效 preview 时先生成预览并要求再次确认；普通流程原样显示服务端 `nextStatus`。普通换班无 reason；普通加扣班 reason 选填、空值省略。
- 管理员直办：直换仍先 preview，但页面仅消费双方班次/冲突并固定说明“立即完成、无需成员同意或群组审批”，不把普通 `nextStatus` 当 direct 结果，payload 无 reason。直办加扣班不调用 preview，reason 选填，直接写入并完成。两种直办入口仅在 administrator/owner 身份暴露，服务端仍作最终权限校验。
- 请求与设置：按真实 action matrix 展示 accept/approve/reject/cancel/revoke、处理人、服务端撤销阻塞原因以及仅 `completed && isRevocable === false` 的只读自动归档状态；没有 archive mutation。swap/duty 分别读取各自 member settings，管理员分别更新群组审批设置，成员共享自动接受仅用 `/swaps/my-settings` PUT，均只发送改动字段。
- 缓存与并发：从受保护月历构造 CST 今天及未来候选班次，优先实际 membership；切群/角色/月份清理 preview/单飞并拒绝陈旧发布。409 先废弃 preview、刷新权威列表再保留原错误/白名单摘要。仅 completed create/accept、direct/approve 和成功 revoke 精确失效结果涉及月份；pending、驳回和取消仅刷新列表。
- 回归溯源与验证：`git log -S`/`git blame` 确认普通端点来自 `d9c2d6e`，direct/settings wrappers 来自 `5ccd04f`，UUID 生成器来自 `ddf8295`。新增套件先因控制器/operations route 不存在而失败，后转绿；定向 3 文件 / 13 项、完整小程序/app-shell/workflows boundary 29 文件 / 142 项通过。Web 只读基准 5 文件 / 26 项通过。三个 API integration 文件已执行但因当前环境无真实测试数据库全部 skip（78 项），不记为通过。
- 运行：config audit、typecheck、lint、明确文件 Prettier、diff check、`pnpm smoke:browser` 后的 `pnpm smoke:check-core` 通过。DevTools build-npm `cost: 3274`、`warnings: []`；preview 成功（总计 265.3 KB，main 231.6 KB，workflows 33.8 KB）。标准复用连接 smoke 在连接关闭后失败；重启自动化会话后直接 route/console probe 打开 10/10 注册页面（operations 在内）且 `scriptErrors=0`。真机与真实数据库 integration 复核仍待用户/环境提供。
- 状态：已完成（含自动化运行/浏览器/DevTools 验证），待用户复核。检查点提交信息：`feat(miniprogram): add swap and duty workflows`。Task 9 到此停止；Task 10 仍不获实施授权。

### API integration test runtime follow-up（已完成，2026-08-12）

- 根因：三套流程 integration 文件已有 `beforeEach` 真实数据库 reset/migrate/seed，但普通 `pnpm vitest` 不加载 `.env`，当前进程没有 `NODE_ENV=test` 和 `TEST_MYSQL_*`，因此 78 项整体 skip。`git log -S 'describeWithDatabase'` 与 `git blame` 将该显式 skip/隔离契约追溯到 leave `0d5ec55c`、swap `b20ff9b`、duty `5d8b205a`；`vitest.config.ts` 自 `0a794d9a` 关闭文件并发以保护共享测试 schema。
- 实现：新增 `scripts/run-api-integration.mjs` 与 `pnpm test:api-integration`。命令只在显式调用时加载 `.env`，拒绝非 `schedule_test`、缺失 TEST 用户/密码、远程 host 和非法端口；只为子 Vitest 进程设 `NODE_ENV=test`，不输出凭据。Windows 不调用无法被 Node `spawnSync` 启动的 pnpm `.cmd` shim，而是用当前 Node 执行仓库安装的 Vitest 入口。
- 红绿与真实数据：初始 runner spec 因模块不存在失败；实现后纯 guard 转绿。首次真实执行暴露 Windows shim `EINVAL`，修复后再发现 Vitest 转换环境没有 `import.meta.resolve`，改为稳定的本地 node_modules URL。独立审查补充了 spawn-stub 回归：锁定当前 Node/本地 Vitest 入口、精确三文件、child-only `NODE_ENV=test`、退出码传递以及 guard 拒绝时不启动子进程。最终 `pnpm test:api-integration` 在 `medical-schedule-test` tmpfs 容器中运行 leave 19、swap 33、duty 26，共 3 文件 / 78 项通过、零 skip；每例沿用已有 reset/migrate/seed/close 工厂创建并销毁真实数据。
- 验证：`pnpm lint`、`pnpm typecheck`、明确文件 Prettier 与 `git diff --check` 通过；`pnpm format:check` 仅因用户保留且未跟踪的 `apps/miniprogram/minitest/test.config.json` 非零，未修改或暂存该目录。`pnpm smoke:browser` 与随后 `pnpm smoke:check-core` 通过（guard 确认没有受列举的核心链路文件）。
- 状态：已完成（含真实数据库/浏览器验证），待用户复核。检查点提交信息：`test(api): run workflow integrations locally`；完成推送后停止，Task 10 仍不获实施授权。

### V3-3：Task 10.1 会话与访客安全边界（已完成，2026-08-12）

- API：匿名访客和已认证 guest 日历仅在 `isConfirmed === true` 时返回 `mobilePhone`/`shortPhone`；不再将待确认成员的联系方式暴露给访客。普通成员日历保持原有完整联系方式。
- 会话与缓存：active group 按用户 ID 保存且恢复时由当前权威群组列表校验；日历缓存登记为用户作用域索引，logout/401 仅清除该用户的 last-group 和缓存记录，保留 pending invite。401 的 token 清理由 session 统一串行完成，避免 client 预先清理破坏顺序或使旧异步结果恢复已清除会话。
- 导航与接口：共享 guard 使 anonymous 只能进入登录、资料设置、邀请和 QR 访客页；guest 不能经 tab 或直接路由读取通知/工作流。profile PATCH 传递 `{ realName, version }`；Task 10 真实数据库入口使用固定 9 文件 allowlist。
- 验证：定向安全测试 7 文件 / 41 项、完整小程序测试 29 文件 / 145 项、shell/manifest/calendar/workflows/Task 10 boundary 5 文件 / 16 项，以及 `pnpm test:api-integration:task10` 9 文件 / 58 项（零 skip）均通过。config audit、两个 typecheck、lint、明确文件 Prettier、`pnpm smoke:browser`、随后 `pnpm smoke:check-core` 与 `git diff --check` 通过。
- 状态：已完成（含运行/浏览器验证），待用户复核。检查点提交信息：`fix(miniprogram): secure Task 10 session and visitor boundaries`；完成正常快进推送后停止，Task 10.2 不在本轮范围。

### V3-3：Task 10.3 群组与匿名访客旅程（已完成，2026-08-12）

- 群组：新增受共享 route guard 保护的 groups 子包；工作台“群组”入口可进入当前群组、catalog、访客加入、成员/访客离开和群主可恢复列表。catalog 只接受 `none`、`active-member`、`active-guest`、`left-member` 四种关系，未知值安全降级为 `none`；历史成员只显示管理员邀请回流，不发起 claim/join。加入与恢复使用 preferred group 刷新会话；离开清理该用户该群日历缓存后刷新，会话负责选择仍有效的 active group。
- 匿名访客：主包注册无 tabBar 的 `pages/guest/guest`；QR 启动绕过登录恢复，scene 只解码一次并仅接受 32 位十六进制 visitor key。控制器只调用 resolve 与对应群组公开 calendar，key 仅存于内存；翻月不重新 resolve、不登录、不缓存、不持久化。页面复用纯 calendar ViewModel/grid，但显式剥离变更标识且不绑定详情、电话、通知、事件、审批或写入动作。
- 回归溯源与语义审计：`listGroupCatalog` 来自 `a68dd03`、`setActiveGroupId`/`restoreAndNavigate` 来自 `bc534c0`、公开访客 calendar 由 `20407fc` 收紧；旧 Task 10 static guard 断言由 `20407fc` 引入、workflows 子包全等断言由 `5ccd04f` 引入。本轮不是语义等价重构：新增公开 QR 启动绕过、群组会话刷新/缓存清理和新 route。已有 notification 通过 `activateNotificationsPage` 间接 guard 的链路保持不变；workflows 测试改为保留其自身子包断言而不禁止后续子包。
- 测试先行与验证：实现前目标测试因 controller/page/manifest/route 缺失而失败；实现后定向 7 文件 / 43 项、完整小程序与静态边界 45 文件 / 194 项通过。`pnpm test:api-integration:task10` 在真实 `schedule_test` 通过 9 文件 / 58 项、零 skip；config audit、typecheck、排除用户 `apps/miniprogram/minitest/` 的小程序 lint、明确文件 Prettier、`pnpm smoke:browser` → `pnpm smoke:check-core` 均通过。DevTools build-npm 成功（无 warning），preview 成功（315.2 KB，含 groups 子包）；提升权限后的标准 automation smoke 打开全部 12 个注册页面（含匿名访客页与 groups 子包）且无脚本级错误。
- 状态：已完成（含运行/浏览器/DevTools 验证），待用户复核。检查点提交信息：`feat(miniprogram): add group and guest journeys`；完成正常快进推送后停止，不进入 V3-4。

## Validation

- 清理前基线：`pnpm miniprogram:typecheck` 通过；`pnpm vitest run apps/miniprogram` 通过（18 个文件 / 101 项，包含随后归档的 V2 回归 spec）。
- 验证已完成：`git diff --check`、`pnpm miniprogram:typecheck` 通过；`pnpm verify` 通过（82 个测试文件，660 项通过，249 项按环境跳过）。
- V3-0.1 文档验证：`git diff --check` 通过；`pnpm exec prettier --check docs/superpowers/specs/2026-08-09-wechat-miniprogram-v3-design.md` 通过。
- V3-0.2 文档验证：设计、计划、状态和调试记录的 Prettier 检查通过；关键术语/拒绝项检索通过；`git diff --check` 通过。
- V3-0.3 文档验证：路线图/执行计划引用、25 个 checkbox 步骤、代码围栏、禁执行边界、占位符和过期引用扫描通过；5 份文档 Prettier 检查与 `git diff --check` 通过。
- V3-0.5 检查点复核：`HEAD == origin/main == 2c93859`、工作树起始状态干净；`pnpm vitest run apps/miniprogram/api/client.test.ts scripts/miniprogram-manifest.test.mjs scripts/miniprogram-config-audit.test.mjs` 为 3 文件 / 9 测试通过；配置审计、mini-program typecheck 和 core-smoke guard 通过。
- V3-1 计划验证：执行计划、路线图、状态和调试日志经 Prettier、51 个 checkbox / 194 个配对代码围栏、路径/术语/占位符/类型一致性扫描与 `git diff --check` 复核；`pnpm smoke:check-core` 通过并确认仅文档变更无需浏览器冒烟；本轮不运行开发者工具或小程序模拟器。
- V3-1 Task 3：`pnpm vitest run scripts/miniprogram-app-shell.test.mjs scripts/miniprogram-manifest.test.mjs`（2 文件 / 9 项）通过；配置审计、typecheck、lint、Prettier、`git diff --check`、`pnpm smoke:browser`、`pnpm smoke:check-core` 通过；DevTools npm 构建无警告、preview 成功（10.5 KB）、模拟器冒烟 5/5 页面通过，真机 Skyline/WebView/Auto 及 tab 切换通过。检查点：`ebfbb31 feat(miniprogram): add V3 app shell and native navigation`，已随 V3-1 最终正常快进推送同步至 `origin/main`。
- V3-2 最终复核：23 文件 / 105 项通过；config audit、typecheck、lint、`pnpm smoke:check-core`、契约/API 空 diff 和 `git diff --check` 通过。运行/浏览器验证：`pnpm smoke:browser` 不适用（V3-2 最终加固未改 Web/API/契约/认证/构建核心链路）。
- V3-3 计划验证：新计划自审通过（470 行、11 个强制术语、23 个历史提交均可达）；7 份文档 Prettier 与 `git diff --check` 通过；`pnpm smoke:check-core` 通过。运行/浏览器验证：`pnpm smoke:browser` 不适用（仅计划/设计/状态文档，未改 Web/API/契约/认证/构建核心链路）。
- V3-3 Task 9.1：定向 9 文件 / 56 项、完整小程序/app-shell/workflows boundary 27 文件 / 126 项、config audit、typecheck、lint、明确文件 Prettier、`git diff --check`、`pnpm smoke:browser` → `pnpm smoke:check-core` 均通过；DevTools build-npm/preview 和重连后的标准 8/8 路由 smoke 无脚本级错误。
- V3-3 Task 9.2：定向 2 文件 / 13 项、完整小程序/app-shell/workflows boundary 28 文件 / 137 项、config audit、typecheck、lint、明确文件 Prettier、`git diff --check`、`pnpm smoke:browser` → `pnpm smoke:check-core` 均通过；DevTools build-npm/preview 通过，标准复用连接 smoke 在 `reLaunch` 后挂起但同连接直接 9/9 路由 probe 无脚本错误。
- V3-3 Task 9.3：定向 3 文件 / 13 项、完整小程序/app-shell/workflows boundary 29 文件 / 142 项、config audit、typecheck、lint、明确文件 Prettier、`git diff --check`、`pnpm smoke:browser` → `pnpm smoke:check-core` 均通过；Web 只读基准 5 文件 / 26 项通过；API integration 3 文件 / 78 项因无测试数据库 skip，不记为通过。DevTools build-npm/preview 通过；标准复用连接 smoke 连接关闭，重启自动化后直接 10/10 路由 probe 无脚本错误。
- API integration test runtime：runner guard 1 文件 / 5 项通过；`pnpm test:api-integration` 在本地隔离 MySQL 通过 3 文件 / 78 项、零 skip。`pnpm lint`、`pnpm typecheck`、明确文件 Prettier、`git diff --check`、`pnpm smoke:browser` → `pnpm smoke:check-core` 通过。全量 `pnpm format:check` 只因未跟踪且用户保留的 `apps/miniprogram/minitest/test.config.json` 非零，未作为本轮代码失败或修改/暂存目标。
- V3-3 Task 10 计划验证：新 Task 10 文件以及项目状态、调试日志、V3 设计、路线图和 Task 9 历史计划的 Prettier 检查通过；`git diff --check` 与 `pnpm smoke:check-core` 通过。运行/浏览器验证：`pnpm smoke:browser` 不适用（仅计划、设计、状态文档，未改 Web/API/契约/认证/构建核心链路）。
- V3-3 Task 10.1：定向安全测试 7 文件 / 41 项、完整小程序 29 文件 / 145 项、5 个静态边界文件 / 16 项、Task 10 API integration 9 文件 / 58 项（真实 `schedule_test`、零 skip）通过；config audit、mini-program/API typecheck、lint、明确文件 Prettier、`pnpm smoke:browser` → `pnpm smoke:check-core` 与 `git diff --check` 通过。
- V3-3 Task 10.2：完整小程序与静态页面边界 37 文件 / 166 项通过；config audit、mini-program typecheck、lint、明确任务文件 Prettier 和 `git diff --check` 通过。全局 `pnpm format:check` 仅因未跟踪、用户保留的 `apps/miniprogram/minitest/test.config.json` 非零，未修改或暂存该文件。`pnpm smoke:browser` → `pnpm smoke:check-core` 通过。最终 DevTools build-npm 成功（`cost: 4193`、`warnings: []`），preview 成功（299.6 KB）；连接式 smoke 自动重连后打开全部 10 个注册页面且无脚本级错误。
- V3-3 Task 10.3：定向 groups/visitor/session/navigation/static 边界 7 文件 / 43 项、完整小程序与静态边界 45 文件 / 194 项通过；`pnpm test:api-integration:task10` 在真实 `schedule_test` 通过 9 文件 / 58 项、零 skip。config audit、mini-program typecheck、排除用户未跟踪 `apps/miniprogram/minitest/` 的 lint、明确文件 Prettier、`pnpm smoke:browser` → `pnpm smoke:check-core` 与 `git diff --check` 通过；DevTools build-npm 无 warning、preview 315.2 KB，automation smoke 打开 12/12 注册页面且无脚本错误。
- V3-4 阶段计划：新计划、路线图、设计状态、项目状态和调试日志的 Prettier 检查通过；Task 11 的 9 个红测步骤、9 项处女原则验收场景、Task 12/13 冻结边界、既有 wrapper/route provenance 与禁止项均经自审。`pnpm smoke:check-core` 通过并确认仅文档变更无需浏览器冒烟；`git diff --check` 通过。运行/浏览器验证：`pnpm smoke:browser` 不适用（未改 Web/API/契约/认证/构建核心链路）。

## Decisions and Deviations

- 不使用宽范围 `git reset`，避免删除 API、认证、契约和后端基础设施；通过显式删除和单一检查点提交完成清理。
- 不新增 WeUI、Vant、ColorUI 或通用日历库；若原生能力和已有 TDesign 被证明不足，必须先完成有包体积和截图证据的 spike。
- 不原样继承 V2 `project.config.json`、本机私有设置或旧 `miniprogram_npm`；实施第一批先完成 V3-0.5 干净构建基线。
- 默认保持 WebView 可用，V3-1 仅日历页声明 Skyline/`glass-easel`；`compileWorklet` 是跟踪编译基线，V3-1 不实现 Worklet，Skyline 不凭静态配置或平均帧率直接全局扩展。
- 手动排班同时支持先选单元格和先锁定班种；快速填班不用全局 200ms 防抖，不逐格确认覆盖，依靠单元格级去重、撤销栈和发布前确认。
- 涂抹排班只作为单元格优先/班种锁定通过后的独立 Spike；失败时保留点击模式，不得把实验交互当作 V3 基线。
- 本地缓存只用于只读快照，不能成为排班写入源或离线提交队列。
- V3 日历必须完整保留成员、班次、节假日和当前契约的换/替/加标识；`deduction` 只有未来服务端/契约实际提供且上下文允许时才能出现；同日多排班不得只取第一条。
- V3-3 工作流不使用统一 preview 模板：每个动作只发送当前合同提供的字段；管理员两类 direct 是独立特权路径，普通申请才遵守自动接受/群组审批设置。
- Task 10.2 不扩展 API 或共享契约：通知读状态和未读数仍以服务端为准；提醒偏好仅提交微信开关与 duty 提醒小时，绝不写入浏览器提醒字段；通知首版不构造通用对象深链。profile 409 只刷新并呈现权威资料，绝不自动重放写入。
- Task 10.3 匿名 visitor key 只存在控制器内存，不写入 session/cache/storage；公开页始终无 tabBar 且不复用认证 guest 控制器。群组页仅提供服务器允许的 join/leave/restore 请求，群主不能离开和历史成员仅管理员邀请均由服务端作最终裁决。

## Previous Batch

1. V3-0.5 Task 1–2 和 V3-1 Task 3–5 已完成并推送。
2. V3-2 Task 6–8、导航/详情回归和人工 UI 复核已完成；最终检查点 `9629454` 已推送。
3. V3-2 完整 Web/renderer/device/performance 证据已显式转入 V3-6，不阻塞 V3-3 计划审阅。

## Active Batch

1. Task 9 与 API integration test runtime follow-up 已完成并推送；Task 9 真机角色矩阵仍如实保留为待用户/设备复核。
2. Task 10.1 `20407fc`、Task 10.2 `64e57f0`、Task 10.3 `638b95f` 已正常推送；Task 10 已结束，Task 9/10 真机矩阵均待用户/设备复核。
3. V3-4 Task 11 `4a0d44c` 已推送并待设备复核。Task 12 已实现待复核：班种锁定/退出、连续填入和同班种清除与单元格优先共享同一草稿与 undo；没有全局防抖、API 写入、第二 cells map 或第二 undo。完成本 checkpoint 后停止；Task 13 仍冻结。

## Handoff Requirements

- 每个检查点前更新本文件和 `docs/debug/debug-feedback-log.md`。
- Task 9/10 历史计划不再授权重复执行；10.1–10.3 已完成，各 checkpoint 后均已停止。V3-4 只能依据 `2026-08-12-wechat-miniprogram-v3-4-manual-scheduling-plan.md`；Task 11 完成后必须停止，未经新计划不得进入 Task 12/13。
- 只显式暂存当前检查点相关路径；提交前检查 `git diff`、`git diff --cached` 和行为变化清单。
- 涉及 Web/API/认证/契约/构建核心链路时，按 `AGENTS.md` 运行并记录 `pnpm smoke:browser` 和 `pnpm smoke:check-core`。
- 完成状态沿用“已实现待浏览器复核 → 已完成 → 待用户复核”。
