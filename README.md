# 医生排班 Web 1.0

面向科室和排班群组的 Web 排班系统，支持账号、群组、自动/手动排班、请假、换班、加扣班、日历、事件、统计、通知、导出和运维。

## 技术栈

- Web：Vue 3、TypeScript、Vite、TDesign Vue Next、PWA。
- API：Fastify、TypeScript、Zod、MySQL、Drizzle ORM。
- 工程：pnpm workspace、Vitest、Playwright、Docker Compose。

## 快速开始

```powershell
pnpm install --frozen-lockfile
pnpm dev
pnpm verify
pnpm smoke:browser
```

## 文档入口

- 当前状态：[`docs/project-status.md`](docs/project-status.md)
- 本地开发与 CI：[`docs/development/local-setup.md`](docs/development/local-setup.md)
- ECS 部署、HTTPS、备案和上线：[`docs/deployment/aliyun-ecs.md`](docs/deployment/aliyun-ecs.md)
- 运维响应：[`docs/operations/runbook.md`](docs/operations/runbook.md)
- 测试、安全和验收：[`docs/testing/verification.md`](docs/testing/verification.md)
- 设计规格：[`docs/superpowers/specs/2026-08-01-medical-staff-scheduling-system-design.md`](docs/superpowers/specs/2026-08-01-medical-staff-scheduling-system-design.md)
