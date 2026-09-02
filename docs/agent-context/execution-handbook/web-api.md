# Web/API 执行章节

## 何时读取

修改 apps/web、apps/api、packages/contracts 或共享客户端/路由/会话/PWA 代码时读取本章，
并读取 [Web 计划](../../superpowers/plans/2026-08-01-medical-staff-scheduling-system-implementation-plan.md)、
[设计规格](../../superpowers/specs/2026-08-01-medical-staff-scheduling-system-design.md)、
docs/development/local-setup.md 和 docs/testing/verification.md。

## 构建与测试边界

- 当前 workspace 的共享包有 dist/和声明文件依赖。首次运行 Vitest、typecheck 或应用构建前，
  先执行仓库已定义的 bootstrap：pnpm build。该命令会构建 packages/**、apps/** 和 holidays；
  不凭空替换为新脚本。
- 可以在 bootstrap 前运行不依赖 workspace dist 的纯源代码/文档检查；如果测试在收集阶段因
  @schedule/scheduling-domain、@schedule/presentation-core 等无法解析而失败，先核对 bootstrap
  状态，不把它当成业务回归。
- L1 只跑受影响 package 的定向测试、lint、typecheck 或必要构建；L2 才跑受影响应用完整门禁。
  安装依赖须由任务授权并遵守 pnpm-preflight-build-policy，本文档-only 任务不安装依赖。

## 核心链路

触及以下路径时必须运行 pnpm smoke:browser，并在 fix-progress.md 轮次或精确 debug 日志记录
命令和结果：

    apps/web/src/api
    apps/web/src/auth
    apps/web/src/router
    apps/web/src/pwa
    apps/web/src/stores/session.ts
    apps/web/src/App.vue
    apps/web/src/main.ts
    apps/web/src/layouts
    packages/contracts/src
    apps/web/vite.config.ts
    .env.example

提交前触及核心链路还必须运行 pnpm smoke:check-core。Browser smoke 要区分真实数据状态和空态，
不能默认当前月份存在成员、班次或筛选项。

## 行为审计

任何共享客户端、认证、路由或契约重构都要审计 receiver/this、Promise 拒绝与 catch 范围、
空值语义、类型收窄、调用次数、副作用、Bearer、权限、幂等和版本。行为变化先写回归测试，
不能把改测试当作修复。API、认证、schema、迁移和部署拓扑变化超出普通 L1 时，先停在计划/设计，
等待明确授权。
