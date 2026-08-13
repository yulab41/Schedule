# 医生排班 Web 1.0

面向科室和排班群组的 Web 排班系统，支持自动/手动排班、请假重排、换班、加扣班、日历、事件、统计、通知、导出和运维。

## 技术栈

- Web：Vue 3、TypeScript、Vite、TDesign Vue Next、PWA。
- API：Fastify、TypeScript、Zod、MySQL、Drizzle ORM。
- 工程：pnpm workspace、Vitest、Playwright、Docker Compose。

## 快速开始

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

常用验证：

```powershell
pnpm verify
pnpm smoke:browser
pnpm smoke:check-core
```

本地配置见 [`docs/development/local-setup.md`](docs/development/local-setup.md)，部署见 [`docs/deployment/aliyun-ecs.md`](docs/deployment/aliyun-ecs.md)。项目当前状态见 [`docs/project-status.md`](docs/project-status.md)。

## 目录

- `apps/web`：Web 前端。
- `apps/api`：API 和业务服务。
- `packages`：契约、数据库、领域逻辑和设计令牌。
- `infra`：Docker、迁移、节假日和运维脚本。
- `docs`：当前 Web 开发、部署、运维和验收说明。
