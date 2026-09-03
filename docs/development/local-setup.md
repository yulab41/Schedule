# 本地开发与 CI

## 前置条件

- Windows 11、Docker Desktop、Node.js 24、pnpm 11。
- 复制 `.env.example` 为 `.env`，只填写本地值；不要提交 `.env`。

## 启动

```powershell
& scripts/codex/ensure-worktree-deps.ps1
& scripts/codex/ensure-workspace-bootstrap.ps1 -Profile api
docker compose up -d mysql
pnpm --filter @schedule/api migrate
pnpm dev
```

依赖以 lockfile、workspace manifests、pnpm 布局和 Node/pnpm/平台/store 指纹管理；新对话、切换分支、
源码 SHA 或 `origin/main` 前进本身不会重装。指纹一致且健康检查通过时脚本输出
`DEPENDENCIES_REUSED=true`。依赖安装与 workspace 自有 `dist` 分开；Mini 日常任务使用
`-Profile mini`，API 使用 `-Profile api`，Web 使用 `-Profile web`，不要为定向任务先跑全 workspace build。

Codex 长期 worktree 槽位由以下入口管理；默认池位于仓库所在盘根目录的 `ScheduleWT`，不提交绝对路径：

```powershell
& scripts/codex/manage-worktree-pool.ps1 -Action Status -Json
& scripts/codex/manage-worktree-pool.ps1 -Action Acquire -Role general -Owner '<task-id>' -Json
& scripts/codex/manage-worktree-pool.ps1 -Action Release -Path '<acquired-path>' -LeaseToken '<token>' -Json
```

只释放 clean 槽位；对话结束保留 worktree 和各自的 `node_modules`。不得把多个槽位 junction 到同一
可写 `node_modules`，不得用 `git clean -xfd`。当前 release helper 继续使用仓库内固定
`runtime/release-worktree`，但共享同一环境感知依赖门禁。

本地开发认证只在开发环境启用；测试数据库必须使用独立 Compose 服务和 `TEST_MYSQL_*`，禁止连接开发库或生产库。

## 验证

```powershell
pnpm verify
pnpm smoke:browser
pnpm smoke:check-core
```

停止本地服务：`docker compose down`。

## CI

GitHub Actions 在 push 和 pull request 上执行冻结安装、格式检查、lint、类型检查、测试和构建。集成测试使用隔离 MySQL 8.4 和 `TEST_MYSQL_*`，不读取开发或生产凭据；共享 schema 的测试文件保持串行。
