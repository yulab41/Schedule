# Project Status

本文件只记录当前阶段、检查点和下一批任务。Web 1.0 的长期调试记录仍在 `docs/debug/debug-feedback-log.md`；旧小程序 V1/V2 文档已从工作树移除，Git 历史仅用于追溯。

## Current Position

- 日期：2026-08-09
- 分支：`main` / 上游：`origin/main`
- Web 1.0：API、认证、契约、数据库、排班规则和部署基础设施保留并作为小程序共享内核。
- 小程序：V3-0.5 Task 1–2 已完成；V3-1 Task 3 已建立真实 manifest、五页 shell、本地滚动壳、原生 tabBar 和页面级日历 Skyline 声明，并通过自动化、模拟器、preview 与真机复核。
- V3：`main` 比 `origin/main` 超前计划检查点 `9dac419`；Task 3 状态为**已完成，待用户复核**。本轮只创建 Task 3 本地检查点，不执行 Task 4。

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
- DevTools 配置恢复：用户在 UI 打开工程后，DevTools 将受跟踪 `project.config.json` 改写为默认值并导致“解析 project.config.json 失败”/缺失 `.js` 页面错误；已从 `2c93859` 恢复严格 V3-0.5 配置，`pnpm miniprogram:config:audit` 与 `pnpm miniprogram:typecheck` 通过。UI 必须以 `E:\AItools\Schedule\apps\miniprogram` 为项目根重新打开；新产生的未跟踪 `apps/miniprogram/minitest/test.config.json` 保留但不得提交。
- 自动化复核：手动 `cli auto --auto-port 9420` 后以 `MINIPROGRAM_SMOKE_AUTO_WS=ws://127.0.0.1:9420` 运行 smoke；首次连接失败后成功连接，五个 V3 路由全部打开、截图生成且无脚本错误。配置审计在本次自动化后保持通过。
- WXSS 回归修复：DevTools Console 报 `page-shell` 与 `shell-state` 组件 WXSS 导入全局 token 后含 `page` 选择器，不受组件 WXSS 支持。新增回归断言先失败，再移除两处组件导入；全局 `page` token 仍由 app 样式提供并由组件继承。自动验证为 2 文件 / 9 项、typecheck、lint、Prettier 与 diff 检查通过；用户已完整编译确认该两类警告消失。

## Validation

- 清理前基线：`pnpm miniprogram:typecheck` 通过；`pnpm vitest run apps/miniprogram` 通过（18 个文件 / 101 项，包含随后归档的 V2 回归 spec）。
- 验证已完成：`git diff --check`、`pnpm miniprogram:typecheck` 通过；`pnpm verify` 通过（82 个测试文件，660 项通过，249 项按环境跳过）。
- V3-0.1 文档验证：`git diff --check` 通过；`pnpm exec prettier --check docs/superpowers/specs/2026-08-09-wechat-miniprogram-v3-design.md` 通过。
- V3-0.2 文档验证：设计、计划、状态和调试记录的 Prettier 检查通过；关键术语/拒绝项检索通过；`git diff --check` 通过。
- V3-0.3 文档验证：路线图/执行计划引用、25 个 checkbox 步骤、代码围栏、禁执行边界、占位符和过期引用扫描通过；5 份文档 Prettier 检查与 `git diff --check` 通过。
- V3-0.5 检查点复核：`HEAD == origin/main == 2c93859`、工作树起始状态干净；`pnpm vitest run apps/miniprogram/api/client.test.ts scripts/miniprogram-manifest.test.mjs scripts/miniprogram-config-audit.test.mjs` 为 3 文件 / 9 测试通过；配置审计、mini-program typecheck 和 core-smoke guard 通过。
- V3-1 计划验证：执行计划、路线图、状态和调试日志经 Prettier、51 个 checkbox / 194 个配对代码围栏、路径/术语/占位符/类型一致性扫描与 `git diff --check` 复核；`pnpm smoke:check-core` 通过并确认仅文档变更无需浏览器冒烟；本轮不运行开发者工具或小程序模拟器。
- V3-1 Task 3：`pnpm vitest run scripts/miniprogram-app-shell.test.mjs scripts/miniprogram-manifest.test.mjs`（2 文件 / 9 项）通过；配置审计、typecheck、lint、Prettier、`git diff --check`、`pnpm smoke:browser`、`pnpm smoke:check-core` 通过；DevTools npm 构建无警告、preview 成功（10.5 KB）、模拟器冒烟 5/5 页面通过，真机 Skyline/WebView/Auto 及 tab 切换通过。检查点提交信息：`feat(miniprogram): add V3 app shell and native navigation`（本轮按用户要求不推送）。

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

## Active Batch

1. V3-1 Task 3 已结束：本轮创建本地独立检查点后停止，按用户要求不推送 GitHub、不执行 Task 4。
2. 后续仅在用户明确发起新对话/任务时执行 Task 4；停止条件由该任务的执行计划决定。

## Handoff Requirements

- 每个检查点前更新本文件和 `docs/debug/debug-feedback-log.md`。
- V3-1 唯一实施依据是已索引的阶段计划；交付路线图摘要不授权编码。
- 只显式暂存当前检查点相关路径；提交前检查 `git diff`、`git diff --cached` 和行为变化清单。
- 涉及 Web/API/认证/契约/构建核心链路时，按 `AGENTS.md` 运行并记录 `pnpm smoke:browser` 和 `pnpm smoke:check-core`。
- 完成状态沿用“已实现待浏览器复核 → 已完成 → 待用户复核”。
