# Project Status

本文件只记录当前阶段、检查点和下一批任务。Web 1.0 的长期调试记录仍在 `docs/debug/debug-feedback-log.md`；旧小程序 V1/V2 文档已从工作树移除，Git 历史仅用于追溯。

## Current Position

- 日期：2026-08-09
- 分支：`main` / 上游：`origin/main`
- Web 1.0：API、认证、契约、数据库、排班规则和部署基础设施保留并作为小程序共享内核。
- 小程序：V1/V2 表现层正式作废；页面、组件、旧展示工具和旧 manifest 已清理；API、微信认证配置、会话基础和构建配置保留。
- V3：设计规范已写入 `docs/superpowers/specs/2026-08-09-wechat-miniprogram-v3-design.md`，等待用户审阅；用户批准后再创建实施计划，尚未开始 UI 实现。

## Completed Batch

### V3-0：作废 V2、清理表现层并建立设计规范

- 已将当前未提交的四个 V2 UI 文件放入 Git stash：`archive: obsolete miniprogram V2 UI changes`。
- 已删除旧小程序页面、组件、自定义 tabBar、样式、展示/流程 utils、旧页面 manifest，以及 2026-08-08 的小程序设计/计划/移植文档。
- 已保留 `apps/miniprogram/api/**`、`config/index.ts`、`store/session.ts`、包配置、开发者工具配置、TypeScript 配置、`apps/api/**`、`packages/**` 和部署基础设施。
- 已写入 V3 设计：原生微信能力 + 现有 TDesign 基础控件 + 自绘日历/流程组件；明确 Web 1:1 语义/视觉与移动触控适配的边界。
- 检查点提交信息：`docs(miniprogram): reset obsolete V2 surface and define V3 design`。

## Validation

- 清理前基线：`pnpm miniprogram:typecheck` 通过；`pnpm vitest run apps/miniprogram` 通过（18 个文件 / 101 项，包含随后归档的 V2 回归 spec）。
- 验证已完成：`git diff --check`、`pnpm miniprogram:typecheck` 通过；`pnpm verify` 通过（82 个测试文件，660 项通过，249 项按环境跳过）。
- 小程序模拟器/真机冒烟暂不执行：V3-0 有意删除旧 app manifest 和页面，等待 V3 实施阶段重新建立入口后再测。

## Decisions and Deviations

- 不使用宽范围 `git reset`，避免删除 API、认证、契约和后端基础设施；通过显式删除和单一检查点提交完成清理。
- 不新增 WeUI、Vant、ColorUI 或通用日历库；若原生能力和已有 TDesign 被证明不足，必须先完成有包体积和截图证据的 spike。
- 本地缓存只用于只读快照，不能成为排班写入源或离线提交队列。
- V3 日历必须完整保留成员、班次、节假日和换/替/加/扣标识；同日多排班不得只取第一条。

## Active Batch

1. 用户审阅 `docs/superpowers/specs/2026-08-09-wechat-miniprogram-v3-design.md`；停止条件：用户明确批准或提出需要修改的章节。
2. 设计批准后调用 writing-plans skill 编写 V3 实施计划；停止条件：计划包含 1–3 任务批次、验证命令和每批停止条件。
3. 实施计划批准后，从 V3 app-shell、认证入口和日历黄金基线开始实现；停止条件：首批页面可启动且日历视觉对照通过。

## Handoff Requirements

- 每个检查点前更新本文件和 `docs/debug/debug-feedback-log.md`。
- 只显式暂存当前检查点相关路径；提交前检查 `git diff`、`git diff --cached` 和行为变化清单。
- 涉及 Web/API/认证/契约/构建核心链路时，按 `AGENTS.md` 运行并记录 `pnpm smoke:browser` 和 `pnpm smoke:check-core`。
- 完成状态沿用“已实现待浏览器复核 → 已完成 → 待用户复核”。
