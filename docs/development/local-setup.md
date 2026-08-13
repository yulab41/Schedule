# 本地开发与 CI

## 前置条件

- Windows 11、Docker Desktop、Node.js 24、pnpm 11。
- 复制 `.env.example` 为 `.env`，只填写本地值；不要提交 `.env`。

## 启动

```powershell
pnpm install --frozen-lockfile
docker compose up -d mysql
pnpm --filter @schedule/api migrate
pnpm dev
```

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
