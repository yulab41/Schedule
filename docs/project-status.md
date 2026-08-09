# Project Status

本文件只记录当前阶段、检查点和下一批任务。Web 1.0 的长期调试记录仍在 `docs/debug/debug-feedback-log.md`；旧小程序 V1/V2 文档已从工作树移除，Git 历史仅用于追溯。

## Current Position

- 日期：2026-08-09
- 分支：`main` / 上游：`origin/main`
- Web 1.0：API、认证、契约、数据库、排班规则和部署基础设施保留并作为小程序共享内核。
- 小程序：V1/V2 表现层正式作废；页面、组件、旧展示工具和旧 manifest 已清理；API、微信认证配置和会话基础保留，工程身份与工具脚本待 V3-0.5 审计重建。
- V3：用户已确认“WebView 可用基线 + 页面级渐进 Skyline”及两份 UI/UX 建议的采纳取舍；V3 设计已补入事件路由、微标签密集数据集、标识 ID、涂抹排班 Spike 和执行模型交接规则；总控路线图与 V3-0.5 可执行计划已分离，尚未开始 UI 实现。

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
- 检查点：待提交 `chore(miniprogram): establish V3 clean build baseline`；完成后仅继续 V3-0.5 Task 2。

## Validation

- 清理前基线：`pnpm miniprogram:typecheck` 通过；`pnpm vitest run apps/miniprogram` 通过（18 个文件 / 101 项，包含随后归档的 V2 回归 spec）。
- 验证已完成：`git diff --check`、`pnpm miniprogram:typecheck` 通过；`pnpm verify` 通过（82 个测试文件，660 项通过，249 项按环境跳过）。
- V3-0.1 文档验证：`git diff --check` 通过；`pnpm exec prettier --check docs/superpowers/specs/2026-08-09-wechat-miniprogram-v3-design.md` 通过。
- V3-0.2 文档验证：设计、计划、状态和调试记录的 Prettier 检查通过；关键术语/拒绝项检索通过；`git diff --check` 通过。
- V3-0.3 文档验证：路线图/执行计划引用、25 个 checkbox 步骤、代码围栏、禁执行边界、占位符和过期引用扫描通过；5 份文档 Prettier 检查与 `git diff --check` 通过。
- 小程序模拟器/真机冒烟暂不执行：V3-0 有意删除旧 app manifest 和页面，等待 V3 实施阶段重新建立入口后再测。

## Decisions and Deviations

- 不使用宽范围 `git reset`，避免删除 API、认证、契约和后端基础设施；通过显式删除和单一检查点提交完成清理。
- 不新增 WeUI、Vant、ColorUI 或通用日历库；若原生能力和已有 TDesign 被证明不足，必须先完成有包体积和截图证据的 spike。
- 不原样继承 V2 `project.config.json`、本机私有设置或旧 `miniprogram_npm`；实施第一批先完成 V3-0.5 干净构建基线。
- 默认保持 WebView 可用，日历页先开启 Skyline/`glass-easel`/Worklet；`compileWorklet` 明确开启，但 Skyline 不凭开发者工具平均帧率直接全局扩展。
- 手动排班同时支持先选单元格和先锁定班种；快速填班不用全局 200ms 防抖，不逐格确认覆盖，依靠单元格级去重、撤销栈和发布前确认。
- 涂抹排班只作为单元格优先/班种锁定通过后的独立 Spike；失败时保留点击模式，不得把实验交互当作 V3 基线。
- 本地缓存只用于只读快照，不能成为排班写入源或离线提交队列。
- V3 日历必须完整保留成员、班次、节假日和换/替/加/扣标识；同日多排班不得只取第一条。

## Previous Batch

1. 用户书面复核 V3 设计、交付路线图和 V3-0.5 执行计划；停止条件：用户明确批准或提出修改。
2. 用户明确批准开始实现后，严格按 V3-0.5 执行计划完成任务 1–2；停止条件：两项任务各自测试、验证、检查点和正常推送策略执行完毕。
3. V3-0.5 完成后停止编码，使用 `writing-plans` 生成 V3-1 执行计划并等待用户批准；不得直接依据路线图开始任务 3–5。

## Active Batch

1. 严格按 `docs/superpowers/plans/2026-08-09-wechat-miniprogram-v3-0-5-foundation-implementation-plan.md` 完成 V3-0.5 Task 2；停止条件：Task 2 的失败测试、定向验证、`pnpm smoke:browser`、`pnpm smoke:check-core`、检查点提交和正常推送策略全部完成。
2. Task 2 完成后停止编码，使用 `writing-plans` 基于 V3-0.5 检查点生成 V3-1 执行计划并等待用户批准；不得直接依据路线图开始任务 3–18。

## Handoff Requirements

- 每个检查点前更新本文件和 `docs/debug/debug-feedback-log.md`。
- 只显式暂存当前检查点相关路径；提交前检查 `git diff`、`git diff --cached` 和行为变化清单。
- 涉及 Web/API/认证/契约/构建核心链路时，按 `AGENTS.md` 运行并记录 `pnpm smoke:browser` 和 `pnpm smoke:check-core`。
- 完成状态沿用“已实现待浏览器复核 → 已完成 → 待用户复核”。
