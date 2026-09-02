# Project Agent Rules

本文件只负责根级执行路由；详细操作规则按任务类型放在
docs/agent-context/execution-handbook/，已有专题手册仍是对应领域的权威来源。

## 每轮开始

1. 完整读取 docs/project-status.md。
2. 读取 docs/agent-context/pitfall-index.json，只按请求、计划命令和预期路径匹配并读取对应详情；
   guard 失败或 staleWhen 命中时，把旧结论降级为假设并重新调查。不要全文读取
   docs/debug/debug-feedback-log.md，只用精确 rg 和有界行段。
3. 检查 git status --short --branch、当前分支、近期历史和 remotes。
4. 读取当前任务在计划与设计中的精确章节；Web 默认入口是
   docs/superpowers/plans/2026-08-01-medical-staff-scheduling-system-implementation-plan.md
   和 docs/superpowers/specs/2026-08-01-medical-staff-scheduling-system-design.md。
5. 核对状态文档中的活动批次与代码、Git 历史一致，再开始编辑。

每轮先用不超过五行报告任务级别、实际加载的章节/技能、不加载的发布章节、可复用证据和最高门禁。
保持独立、可验证的 checkpoint，不因上下文仍有余量进入下一个无关批次。

## 任务级别与路由

| 级别 | 适用范围                               | 允许的最高范围                                                             | 必读章节                                |
| ---- | -------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------- |
| L0   | 只读审计                               | 代码、Git、历史、日志和轻量静态检查                                        | execution-handbook/README.md + 匹配章节 |
| L1   | 普通修改或 bug 修复，默认级别          | 受影响测试、lint、typecheck 或必要构建；不自动进入发布                     | 受影响模块章节                          |
| L2   | 用户明确要求集成/完整验收或最终候选    | 受影响应用完整门禁、production build、必要 browser smoke；不自动上传或部署 | 受影响模块 + packaging-upload.md        |
| L3   | 用户明确要求体验版或 release candidate | 精确 clean SHA、确定性构建、包体/测试对比和获批上传                        | packaging-upload.md + 对应模块章节      |
| L4   | 用户在当前任务直接授权 production 操作 | preflight、备份、发布锁、部署、回滚检查和发布后验证                        | production.md                           |

L1 不运行无关全仓 release、production profile 包体、上传、数据库迁移、生产备份或 SSH。
L2/L3 不得自动升级为 L4；L3 的体验版上传仍须获得该 checkpoint 的当次明确批准。

## 按需加载

- 小程序：execution-handbook/mini-program.md；同时读取 apps/miniprogram/AGENTS.md、
  apps/miniprogram/docs/README.md 和活动批次链接的专题文档。
- 视觉/布局/触控/交互：execution-handbook/visual.md，并按需加载 frontend-design；
  需求或架构仍有实质歧义时才加载 brainstorming。
- 可复现失败且根因未知：execution-handbook/debugging.md，并按需加载 systematic-debugging。
- Web/API：execution-handbook/web-api.md。
- 数据库、schema、索引或数据迁移：execution-handbook/database.md。
- 打包、体验上传、release worktree：execution-handbook/packaging-upload.md。
- production：仅 L4 读取 execution-handbook/production.md。
- wechatide-skill 只在任务确需且仓库政策允许时读取；本仓库禁止 LLM 控制微信开发者工具，
  因而不得用它绕过该边界。

## 不变量

- 保留用户脏树和并行任务；不删除、覆盖、整文件暂存或提交无关改动。需要隔离时使用仓库根级
  runtime/external-project-worktrees/ 下的短路径，禁止在一个 worktree 内再建 worktree，
  也不要在操作系统临时目录留下项目副本。
- 文件编辑使用 apply_patch；Git 显式列出任务路径，禁止 git add .。PowerShell 串行调用多个
  原生命令时同时设置 $ErrorActionPreference = 'Stop' 和
  $PSNativeCommandUseErrorActionPreference = $true，或拆成独立调用。
- 生成物、截图、日志、release 和验证证据放在已确认被忽略的 runtime/目录；凭据、私钥、
  session、生产数据和本机敏感信息不得进入 Git。
- 小程序不得控制微信开发者工具 GUI/CLI；静态 Node、simulate、miniprogram-ci 和比较脚本
  的结果不能冒充原生运行时或 Xiaomi 14 验收。

## Checkpoint

提交前更新 docs/project-status.md，写明完成任务、验证命令/结果、commit message 或已知 SHA、
决定/偏差/阻塞、外部状态、下一活动批次和停止条件。逐行检查 unstaged/staged diff，列出行为
变化；只显式暂存任务文件。验证失败、冲突或无法安全分离时不提交。

有 origin 和正常 upstream 时，提交后只做普通 fast-forward push；远端前进导致不能安全推进时，
使用 codex/ 前缀的专用分支并报告阻塞，禁止强推、改写历史或覆盖其他任务。L0–L3 不触发
production；只有 L4 的当前任务授权才读取生产发布规则。production 只同步代码和已提交迁移，
不复制本地数据库、凭据、session 或生成状态。

本机 SSH/VPN 说明和可复用验证台账若存在，分别读取：
runtime/agent-context/local-machine.md
runtime/agent-context/validation-ledger.jsonl
二者必须被 Git 忽略，绝不提交。
