# ADR-0003：同仓放置并共享跨端核心

- 状态：已接受
- 日期：2026-08-17

## 决策

小程序固定在 `apps/miniprogram`，API/数据库继续在现有服务端目录，跨端通用代码位于根 `packages`。不建立第二 Git 仓库，也不发布内部共享 npm 包。

共享包新增 `@schedule/client-core` 与 `@schedule/presentation-core`；现有 contracts、scheduling-domain 和 ui-tokens 经边界治理后共同使用。共享展示逻辑必须先让 Web 采用并通过回归，再由 Mini 复用。

## 理由与后果

同仓可以让公共接口、限制、状态机、令牌和 fixtures 保持单一来源，并在同一 CI 中检测漂移。代价是根 lockfile、构建和部署状态需要协调；新增 workspace 或共享包不得与其他活动批次混合提交。

P2 边界审计后，`scheduling-domain` 的运行时 metadata 只能从 `@schedule/contracts/workspace-name` 这一 Zod-free 子路径读取；contracts 总 barrel 仅可用于服务端或类型路径。browser bundle 门禁必须证明 domain runtime 不含 contracts barrel 或 Zod。
