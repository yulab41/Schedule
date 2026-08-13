# 本地开发

## 前置条件

- Windows 11、Docker Desktop、Node.js 24、pnpm 11。
- 复制 `.env.example` 为 `.env`，只填写本地值；不要提交 `.env`。

## 启动

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

默认 Web 使用 Vite，API 使用本地 Fastify；本地开发认证只在开发环境启用。

## 数据库与验证

```powershell
docker compose up -d mysql
pnpm --filter @schedule/api migrate
pnpm verify
pnpm smoke:browser
```

测试数据库使用独立 Compose 服务和 `TEST_MYSQL_*`，禁止连接开发库或生产库。停止服务：`docker compose down`。
