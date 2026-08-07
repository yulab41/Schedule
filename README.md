# 医生排班系统（Doctor Scheduling Web 1.0）

面向科室/群组的医生值班排班 Web 系统：自动固定顺序排班、手动模板排班、请假重排、换班、加扣班、事件追溯、统计、通知与导出，支持电脑与手机。

## 功能概览

- 账号与群组：管理员预置账号登录，群组码认领成员，人员/角色/班种配置。
- 排班：固定顺序自动生成（草稿→发布→版本替换）、手动模板按周期应用到指定日期。
- 日历：登录即见当月值班姓名，月/周/列表视图，节假日与变更标记，长/短号拨号与复制。
- 流程：请假（保持原序/整体顺延）、换班（自动接受/审批）、加扣班，全部支持并发冲突保护与幂等重试。
- 事件与统计：不可变事件中心、安全审计、月度/年度/周末/节假日/加扣班统计、CSV 导出。
- 平台：法定节假日导入、加密备份与恢复、平台管理、浏览器/站内通知。
- 体验：PWA 可安装、离线日历缓存、响应式与无障碍设计。

## 技术栈

- pnpm + TypeScript 严格模式 + ESLint + Prettier + Vitest
- Vue 3 + Vite（Web）、Fastify（API）、Drizzle ORM（MySQL 8.4）
- 阿里云 ECS（Docker Compose：Nginx + Fastify + MySQL 8.4）
- GitHub Actions（验证）

## 快速开始

```powershell
pnpm install
Copy-Item .env.example .env   # 按需填写本地开发/测试 MySQL 变量
docker compose --env-file .env -f infra/docker/compose.yml up --detach --wait
pnpm verify                   # 格式、Lint、构建、类型检查、测试
```

本地开发与测试数据库说明见 `docs/development/local-setup.md`；CI 说明见 `docs/development/ci.md`。

## 部署

- 阿里云 ECS Docker 部署手册：`docs/deployment/aliyun-ecs.md`
- 生产就绪与正式化升级（域名、备案、VPC、专用账号）：`docs/deployment/production-readiness.md`
- 发布验收记录：`docs/releases/web-1.0-acceptance.md`

## 运维文档

- 备份与恢复：`docs/operations/backup-and-restore.md`
- 监控与告警：`docs/operations/monitoring.md`
- 应急响应：`docs/operations/incident-response.md`
- 性能与容量报告：`docs/testing/performance-report.md`
- 安全检查清单：`docs/testing/security-checklist.md`

## 项目状态

当前进度与活动批次见 `docs/project-status.md`。实现计划与设计规格位于 `docs/superpowers/`。
