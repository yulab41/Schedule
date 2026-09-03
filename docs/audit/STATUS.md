# 微信小程序审计状态

## 当前阶段

- 当前批次：`MINI-G1-004` 调查成果主线整合与 Git 收口；调查结论保持“证据仍不足，保留 P3”，不进入分页、
  分批、懒加载或虚拟列表修复。
- 调查原始 tip：`e7ec0617716d37326f84ced01337da5adf941b82`；本次整合基线为执行时最新
  `origin/main@8e6a4a320a69fee9f1ca0471d8f9b140e3d4dd39`。
- 本批仅合并调查成果，不采集 production 数据、不上传体验版、不操作 allowlist、不部署 production；主线其他
  已完成批次和发布事实继续保留。

## 已保留的主线事实

- `origin/main` 已包含 `EXP-UX-001`、`EXP-UX-002`、`EXP-FEAT-002` 和 `EXP-CALENDAR-003` 的代码/文档与
  已记录的自动验证结论；本次没有回退或覆盖这些内容。对应 EXP-UX-001 production release 及其 schema/目录
  查询保留事实仍见主线项目状态和本审计报告第 11 节。
- 本次合并解决了三份状态文档的语义冲突：当前活动批次、验证边界和唯一下一任务指向 G1-004；主线新增的
  EXP-UX-002 续修内容在审计报告第 13 节保留，其他主线新增代码/审计文档未改动。

## MINI-G1-004 已确认事实

- `GET /platform-admin/users`、`GET /groups/:groupId/members` 和 `GET /groups/:groupId/contacts` 均返回完整
  数组；未发现服务端 `limit`、cursor、offset、pageSize 或总量上限。页面没有搜索、筛选、懒加载或渲染窗口。
- 页面一次加载会完整创建 view model、ready `setData` payload，并用 WXML `wx:for` 全量渲染。无隐私
  `N=1/25/100` fixture 显示 platform 行 host 节点估算 `8N`、group member 行估算 `12N`；1→100 时 ready
  bytes 分别为 `341→19,000`、`1,068→34,728`，setData 次数固定为 4、6，payload 随 N 增长。
- 现有 P8 生产资料只有 2026-08-25 聚合参考（活动群组 2、活动成员 owner 2/admin 3/member 21、pending
  0、活动用户 35），没有当前 release 的逐页最大 N/分布；既有测试只有 1 个账号/成员，不能证明用户影响。
- scale probe `apps/miniprogram/scripts/mini-g1-004-scale-probe.test.mjs` 只使用 synthetic 占位数据，不进入
  生产运行时，不包含姓名、手机号、账号或真实群组 ID；桌面 Node wall-clock 仅作记录，不能外推真机卡顿。

## 验证与边界

- 复用已完成依赖安装的 G1-004 clean worktree；未重新链接 1,459 个依赖。主线变化触及 Mini 测试/相关路径，
  合并后正式 `pnpm miniprogram:test` 通过：119 files / 643 tests（91.46s）。
- 合并后 probe 所在的相关 7 files / 31 tests 通过，`pnpm exec vitest run scripts/test-discovery-policy.test.mjs`
  通过 1 file / 3 tests；Prettier、ESLint、`git diff --check` 与状态策略检查均通过。未调用微信开发者工具
  GUI/CLI、模拟器、Console/Network；`pnpm smoke:check-core` 确认未涉及 Web 核心链路。仍没有当前匹配 SHA
  的 Xiaomi 14 原生节点、首绘、滚动或 bridge 证据。
- 所有未取得的原生/production 数据统一记为“当前工具无法测量，暂未验证”；本轮没有业务运行时代码、API、
  数据库、权限、路由、锁文件、dist 或其他生成物改动。

## 唯一下一任务与停止条件

- 唯一下一任务：补“当前 release 脱敏规模 + 匹配构建的小米 14”证据，包括逐页规模/分布、SHA/trial、renderer、
  基础库、微信版本、首屏/节点/滚动结果；补证前保持 `MINI-G1-004` P3。
- 本批停止条件：合并后相称门禁、四文件清单和 Git 状态确认完成，普通 fast-forward 推送 `origin/main` 后
  停止；不继续扩大调查，不进入业务修复。
