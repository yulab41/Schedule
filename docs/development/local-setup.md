# 本地开发与 CI

## 前置条件

- Windows 11、Docker Desktop、Node.js 24、pnpm 11。
- 复制 `.env.example` 为 `.env`，只填写本地值；不要提交 `.env`。

## 启动

先在当前或已绑定的 worktree 中执行只读依赖复用检查：

```powershell
& scripts/codex/ensure-worktree-deps.ps1 -Mode ReuseOnly
```

输出 `DEPENDENCIES_REUSED=true` 后才继续；输出 `BLOCKED_NO_REUSABLE_DEPENDENCY_ENV` 或
`BLOCKED_DEPENDENCY_INSTALL_REQUIRED` 时停止并改用已预热的独占槽位。普通开发启动不会自行物化依赖。

```powershell
docker compose up -d mysql
pnpm --filter @schedule/api migrate
pnpm dev
```

缺少共享包声明或 `dist` 时，只执行需要的平台增量 bootstrap，不执行全 workspace build：

```powershell
& scripts/codex/ensure-workspace-bootstrap.ps1 -Profile api
```

依赖维护是独立任务，必须有当前消息的用户授权和一次性本机授权记录；本轮未创建记录、未运行维护通道。
需要维护时，只能由用户准备记录后调用 `scripts/codex/dependency-maintenance.ps1 -AuthorizationFile <record>`；
目标 store 由 canonical project home 计算为项目内 `runtime/pnpm-store`，不会由 ReuseOnly 路径调用。

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
