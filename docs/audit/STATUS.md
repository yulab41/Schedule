# 微信小程序审计状态

## 当前阶段

- 当前批次：`MINI-G1-004` 第二阶段补证；结论仍为“证据不足，保留 P3”，不进入分页、分批、懒加载或
  虚拟列表修复。
- 执行时最新基线为 `origin/main@78d0424e19cfc81be142da7e0f5367110f1fc8f2`；已确认包含 scale probe、
  G1-004 审计/状态文档及上一轮调查结论。
- 本轮只做 `.80` 运行时等价性判定、一次 production 只读聚合核查和人工验收说明；不改业务实现、不上传、
  不部署、不操作 allowlist，未重跑阶段 0。

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
- `.80` `0.1.0-p10.20260902.80@3897581e` 的 `.80` capability GET 返回 HTTP 200；与 `origin/main` 比较的
  platform/group-settings controller、WXML、Page、organization read client、相关 API route/service/contracts、
  App/build-info/runtime-environment、test-tools 和 build inputs 均无差异。`.80` 对 G1-004 属于运行时语义等价构建，
  可直接补证，不重新上传。
- 服务器 `current-release` 实测为 `48488019171924701054354e8f707b08eb4d12fe`；该 live release 与
  `origin/main` 在同一批相关路径也无差异。历史文档中的 `3897581e` 不再作为当前 live release 使用。
- production 一次聚合读取（UTC `2026-09-03 13:12:22.797`）得到 platform accounts `35`；活动群组 `2` 个，
  匿名排序后的 members endpoint 最终有效行数为 `17`、`6`，两组 pending 非重复均为 `0`，contacts endpoint
  行数分别为 `17`、`6`。此处 contacts 是 endpoint 行数，不是非空手机号数。

## 验证与边界

- 在 `runtime/external-project-worktrees/mini-g1-004-evidence-audit-20260902`（HEAD 与 `origin/main` 对齐）
  运行 `pnpm --filter @schedule/miniprogram exec vitest run scripts/mini-g1-004-scale-probe.test.mjs`：1 file /
  1 test 通过；N=1/25/100 结构性结果保持 `8N` platform host、`12N` group member host，ready payload 随 N 增长。
- 本轮没有调用微信开发者工具 GUI/CLI、模拟器、Console/Network；没有匹配 `.80` 的 Xiaomi 14 环境、首屏、原生
  节点或滚动反馈，统一记为“当前工具无法测量，暂未验证”。现有 test-tools 没有 G1-004 专用 setData/节点指标，
  本轮未增加埋点。
- production 查询为只读聚合；没有写入、备份、部署、重启、清缓存、权限/账号/群组操作；没有业务源码、API、数据库、
  配置、锁文件、dist 或生成物修改。

## 唯一下一任务与停止条件

- 唯一下一任务：用户在可复用的 `.80@3897581e` 小米 14 体验版中回传测试工具环境字段，以及 platform accounts /
  group settings 两页的首屏、完整性、滚动和可操作性结果；在此之前保持 `MINI-G1-004` P3。
- 本轮停止条件：production 聚合证据和人工测试说明完成后停止；不关闭 G1-004，不升级风险，不进入业务修复。
