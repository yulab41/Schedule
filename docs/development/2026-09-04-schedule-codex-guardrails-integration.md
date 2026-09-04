# Schedule Codex 依赖复用工具链收口

本轮把 Schedule 的依赖复用、增量 bootstrap、项目内 warm pool、lease、项目规则和 pnpm 早期阻断
统一到 canonical project home。canonical home 由 Git common directory 推导；正式槽位在
`runtime/wt`，lease、指纹、恢复证据和状态在 `runtime/codex`，项目专用 store 在
`runtime/pnpm-store`。

## 正式路由

- 默认 `DEPENDENCY_MODE=REUSE_ONLY`；对话边界、分支/SHA 切换、`origin/main` 前进、普通源码变化、
  缺少 producer 输出和重复测试都不会授权安装。
- 新任务先执行 `Acquire → ReuseOnly → Bootstrap → Targeted test`，每个任务绑定一个独占槽位和
  独立可写 `node_modules`。
- 池满时返回 `TASK_STATUS=POOL_BUSY`、`INSTALL_INVOKED=false`、`WORKTREE_CREATED=false`，不创建
  冷 worktree。
- `.codex/setup.ps1` 只做轻量定位和复用检查，不安装、不 bootstrap、不迁移聊天到其他 worktree。
- `.codex/rules/schedule-dependency-mutation.rules` 是 Codex shell 防护；`.pnpmfile.cjs` 在 pnpm
  解析/import/link 前再次阻断未经授权的依赖变更。

## 维护通道

唯一安装入口是：

```powershell
& scripts/codex/dependency-maintenance.ps1 `
  -Reason 'Provision project-local warm pool' `
  -WorktreeRoot 'E:\AItools\Schedule\runtime\wt\general-1'
```

wrapper 每次创建一次性项目内授权，绑定 canonical Git common directory、目标 worktree、精确
命令、lockfile SHA-256、Node/pnpm 版本、nonce、原因和不超过 15 分钟的过期时间；无论成功失败
均删除授权，成功且健康检查通过后才写 dependency fingerprint。安装固定为 frozen/offline/
project-local store，不使用 `--force`、不联网、不删除 store。

## Bootstrap

依赖指纹和 workspace bootstrap 指纹分离。`mini`、`api`、`web`、`root`、`release` profile 只重建
受影响或缺失输出的 producer，保留健康的 `dist` 与 `.tsbuildinfo`；缺少 dist 不触发安装。

## 证据边界

工具链验证区分静态检查、Node 自动化、用户操作的微信开发者工具和 Xiaomi 14 体验版。该工具链
收口不连接 production、不迁移数据库、不上传小程序、不创建生产备份，也不修改业务源码或
`pnpm-lock.yaml`。
