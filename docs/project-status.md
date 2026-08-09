# Project Status

本文件只记录当前阶段、检查点和下一批任务。Web 1.0 的长期调试记录仍在 `docs/debug/debug-feedback-log.md`；旧小程序 V1/V2 文档已从工作树移除，Git 历史仅用于追溯。

## Current Position

- 日期：2026-08-09
- 分支：`main` / 上游：`origin/main`
- Web 1.0：API、认证、契约、数据库、排班规则和部署基础设施保留并作为小程序共享内核。
- 小程序：V1/V2 表现层正式作废；页面、组件、旧展示工具和旧 manifest 已清理；API、微信认证配置和会话基础保留，工程身份与工具脚本待 V3-0.5 审计重建。
- V3：用户已确认“WebView 可用基线 + 页面级渐进 Skyline”及两份 UI/UX 建议的采纳取舍；V3 设计已补入事件路由、微标签密集数据集、标识 ID、涂抹排班 Spike 和低阶模型交接规则；独立 V3 实施计划已创建，尚未开始 UI 实现。

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

### V3-0.2：复核两份 UI/UX 建议并建立 V3 实施计划

- 已采纳：微标签视觉、Bottom Sheet、大触控热区、原生能力 + 自绘日历、TDesign 基础控件白名单、CSS 轻量动效、单元格优先/班种锁定。
- 已限定：姓名不得固定截断；整格热区保留日期/排班/标识/电话事件路由；长按仅用于手动网格清空；涂抹排班延后为独立 Spike。
- 已拒绝：通用日历库、首批 Lottie、统一动作热区、把“LLM 手搓”当作工程标准、同时引入多套组件库。
- 已修订 `docs/superpowers/specs/2026-08-09-wechat-miniprogram-v3-design.md`，并新建 `docs/superpowers/plans/2026-08-09-wechat-miniprogram-v3-implementation-plan.md`；计划明确任务文件、失败测试、验证命令、提交节点和每批停止条件。
- 检查点提交信息：`docs(miniprogram): finalize V3 design and implementation plan`。

## Validation

- 清理前基线：`pnpm miniprogram:typecheck` 通过；`pnpm vitest run apps/miniprogram` 通过（18 个文件 / 101 项，包含随后归档的 V2 回归 spec）。
- 验证已完成：`git diff --check`、`pnpm miniprogram:typecheck` 通过；`pnpm verify` 通过（82 个测试文件，660 项通过，249 项按环境跳过）。
- V3-0.1 文档验证：`git diff --check` 通过；`pnpm exec prettier --check docs/superpowers/specs/2026-08-09-wechat-miniprogram-v3-design.md` 通过。
- V3-0.2 文档验证：设计、计划、状态和调试记录的 Prettier 检查通过；关键术语/拒绝项检索通过；`git diff --check` 通过。
- 小程序模拟器/真机冒烟暂不执行：V3-0 有意删除旧 app manifest 和页面，等待 V3 实施阶段重新建立入口后再测。

## Decisions and Deviations

- 不使用宽范围 `git reset`，避免删除 API、认证、契约和后端基础设施；通过显式删除和单一检查点提交完成清理。
- 不新增 WeUI、Vant、ColorUI 或通用日历库；若原生能力和已有 TDesign 被证明不足，必须先完成有包体积和截图证据的 spike。
- 不原样继承 V2 `project.config.json`、本机私有设置或旧 `miniprogram_npm`；实施第一批先完成 V3-0.5 干净构建基线。
- 默认保持 WebView 可用，日历页先开启 Skyline/Glass Esel/Worklet；`compileWorklet` 明确开启，但 Skyline 不凭开发者工具平均帧率直接全局扩展。
- 手动排班同时支持先选单元格和先锁定班种；快速填班不用全局 200ms 防抖，不逐格确认覆盖，依靠单元格级去重、撤销栈和发布前确认。
- 涂抹排班只作为单元格优先/班种锁定通过后的独立 Spike；失败时保留点击模式，不得把实验交互当作 V3 基线。
- 本地缓存只用于只读快照，不能成为排班写入源或离线提交队列。
- V3 日历必须完整保留成员、班次、节假日和换/替/加/扣标识；同日多排班不得只取第一条。

## Active Batch

1. 用户书面复核 `docs/superpowers/specs/2026-08-09-wechat-miniprogram-v3-design.md` 和 `docs/superpowers/plans/2026-08-09-wechat-miniprogram-v3-implementation-plan.md`；停止条件：用户明确批准或提出修改。
2. 计划批准后执行 V3-0.5 任务 1–2；停止条件：跟踪配置可复现、生成物边界通过、401 无旧登录路径、冒烟脚本覆盖主包/分包。
3. V3-0.5 批准后执行 V3-1 任务 3–5；停止条件：app-shell 可启动、认证/角色入口正确、`CalendarMonthViewModel` 纯逻辑测试通过。

## Handoff Requirements

- 每个检查点前更新本文件和 `docs/debug/debug-feedback-log.md`。
- 只显式暂存当前检查点相关路径；提交前检查 `git diff`、`git diff --cached` 和行为变化清单。
- 涉及 Web/API/认证/契约/构建核心链路时，按 `AGENTS.md` 运行并记录 `pnpm smoke:browser` 和 `pnpm smoke:check-core`。
- 完成状态沿用“已实现待浏览器复核 → 已完成 → 待用户复核”。
