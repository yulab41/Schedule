# 医护排班 Web 1.0 实施计划（精简版）

- 范围：医生排班 Web 1.0；不包含其他客户端。
- 依据：[`../specs/2026-08-01-medical-staff-scheduling-system-design.md`](../specs/2026-08-01-medical-staff-scheduling-system-design.md)。
- 状态：主体功能已实现；后续只按 `docs/project-status.md` 当前批次推进。

## 实施顺序

1. 工程、Docker、CI 和本地环境。
2. API、认证、数据库、错误协议和安全边界。
3. 群组、成员、角色、班种、联系方式和权限。
4. 事件、审计、排班期间、版本和自动排班。
5. 日历、手动模板、请假、换班、加扣班和并发保护。
6. 通知、统计、导出、PWA、备份、监控和 ECS 部署。

## 每个任务的门禁

- 先用 `git log -S`/`git blame` 定位行为来源。
- 先写能在旧实现上失败的回归测试，再实现。
- 审计权限、版本、事务、异步错误、空值和副作用。
- 运行定向测试、`pnpm verify`、必要的 `pnpm smoke:browser` 与 `pnpm smoke:check-core`。
- 更新 `docs/project-status.md`，只提交任务相关文件。

## 完成标准

Web 用户能安全登录、查看和维护排班；群组数据隔离；所有写入具备权限、版本和事务保护；事件、统计、导出、备份、恢复、PWA 和生产部署可验证。

Git 历史保存已完成任务的细节，本文件不重复保留逐任务实现说明。
