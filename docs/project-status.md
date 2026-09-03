# Project Status

本文档只记录当前可安全接续的事实；详细历史以 Git、`docs/audit/` 和精确 debug 日志为准。每轮先读
`docs/agent-context/pitfall-index.json`，只加载匹配坑位详情。

## 当前仓库批次（2026-09-03）

- 当前活动批次：`MINI-G1-004` 第二阶段补证。调查结论仍为“证据仍不足，保留 P3”，不进入分页、分批、懒加载
  或虚拟列表修复。
- 调查原始 tip：`e7ec0617716d37326f84ced01337da5adf941b82`；本轮执行时最新主线为
  `origin/main@78d0424e19cfc81be142da7e0f5367110f1fc8f2`。
- 执行 worktree：`runtime/external-project-worktrees/mini-g1-004-evidence-audit-20260902`；主工作区的
  用户自有脏改动、其他 worktree 和其内容未修改、清理、暂存或借用。依赖沿用该 clean worktree，未重新链接
  1,459 个依赖。
- 本轮只补证：确认 `.80` 运行时语义等价、完成一次 production 只读聚合读取并生成小米 14 人工清单；不上传、
  不部署、不操作 allowlist，未重跑阶段 0。

## MINI-G1-004 调查成果

- `GET /platform-admin/users`、`GET /groups/:groupId/members`、`GET /groups/:groupId/contacts` 返回完整数组；
  未发现服务端 `limit`、cursor、offset、pageSize 或自然总量上限。页面没有搜索、筛选、懒加载或渲染窗口。
- scale probe 只使用 synthetic 占位数据，标准 Mini 测试可发现，不进入生产运行时，不包含姓名、手机号、账号或
  真实群组 ID。`N=1/25/100` 显示 platform 行节点估算 `8N`、group member 行估算 `12N`；1→100 时 ready
  bytes 为 `341→19,000`、`1,068→34,728`，setData 次数固定为 4、6，payload 随 N 增长。
- 现有生产资料仅有 2026-08-25 聚合参考（活动群组 2、owner/admin/member 合计 2/3/21、pending 0、活动
  用户 35），没有当前 release 的逐页最大 N/分布；既有 P8 测试只有 1 个账号/成员，不能证明已形成用户影响。
- 桌面 Node wall-clock 只作可重复性记录，不能外推 Xiaomi 14 卡顿；没有匹配构建的原生首绘、节点、滚动或
  bridge 证据。
- 当前 live release 为 `48488019171924701054354e8f707b08eb4d12fe`；production 聚合为 platform accounts 35，
  活动群组 2，匿名 members endpoint 最终行数 17/6，pending 非重复 0/0，contacts endpoint 行数 17/6。
- `.80@3897581e` 的相关运行时/构建输入与 `origin/main`、live release 均无差异，capability GET 返回 200；可直接
  用现有 `.80` 做 G1-004 真机补证，不重新上传。

## 主线既有结论（合并时保留）

- `origin/main` 的 `EXP-UX-001`、`EXP-UX-002`、`EXP-FEAT-002`、`EXP-CALENDAR-003` 代码、设计、审计和
  自动化结论均保留；最新 `EXP-CALENDAR-003` 状态仍按主线记录为“已完成（含运行验证）→ 待用户复核”。
- `EXP-UX-001` 的 production release/schema/目录查询保留事实仍有效；历史 release tip 为
  `3897581e7a8d5734ef5910e2dd8854a92c246062`，`.80` 体验与 production 记录不因本次调查改变。
- 主线新增的代码、测试、`docs/audit/exp-feat-002-event-records.md` 及相关设计/计划文件未被本次整合回退。

## 验证证据与边界

- 在对齐 `origin/main` 的 G1-004 worktree 运行既有 probe：1 file / 1 test 通过，N=1/25/100 结构性增长证据保留。
- production 查询仅为匿名聚合读取；未调用微信开发者工具 GUI/CLI、模拟器、Console/Network，Node/probe 结果不代替
  微信原生或 Xiaomi 14 验收。
- 本轮未修改业务运行时代码、API、数据库、权限、路由、锁文件、dist 或其他生成物；只更新本状态/审计文档，且不创建
  发布 checkpoint。

## 唯一下一任务与停止条件

- 唯一下一任务：用户在 `.80@3897581e` 小米 14 体验版回传测试工具环境字段，以及两个 G1-004 页面只读操作结果；
  在此之前保持 P3。
- 本批停止条件：本轮补证记录完成后停止，不关闭 G1-004，不进入业务修复、不上传、不部署。
- 本轮不创建 Git checkpoint；当前状态文档记录的主线基线为 `origin/main@78d0424e`。
