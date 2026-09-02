# 微信小程序审计状态

## 当前阶段

- 当前批次：`MINI-G1-004` 运行证据核查；最终结论为“证据仍不足，保留 P3”，不进入业务修复阶段。
- 起始基线：执行时最新 `origin/main@359966f7240d2f557b24dd0c1ac61979d6bb8298`；调查分支/worktree 为
  `codex/mini-g1-004-evidence-audit-20260902` /
  `runtime/external-project-worktrees/mini-g1-004-evidence-audit-20260902`。
- 当前主线已包含 `MINI-G1-001`～`MINI-G1-003` 的闭环；本轮未回退其代码或文档，不重跑阶段 0。
- 范围仅为 platform accounts 与 group settings 成员/联系人列表的 API 上限、全量处理关系和运行证据；不
  修改业务实现，不上传体验版，不部署 production。

## 已验证事实

- `GET /platform-admin/users`、`GET /groups/:groupId/members` 和 `GET /groups/:groupId/contacts` 均返回完整
  数组；权限检查限制可见身份，但未发现服务端 `limit`、cursor、offset、pageSize 或总量上限。页面的
  `scroll-view` 是整页滚动，不是渲染窗口；没有搜索、筛选、懒加载或分页。
- 当前页面在一次加载中完整创建 view model、ready `setData` payload 并由 WXML `wx:for` 全量渲染。无隐私
  `N=1/25/100` fixture 的静态/Node 诊断结果为：platform 行 host 节点估算 `8N`，group member 行估算
  `12N`；1→100 时 ready bytes 分别 `341→19,000`、`1,068→34,728`；`setData` 次数保持 4、6，
  payload 随 N 增长。Node 时间只作桌面可重复性记录，不外推真机卡顿。
- 现有 P8 生产聚合快照（2026-08-25）只有活动群组 2、活动成员 owner 2/admin 3/member 21、pending
  roster 0、活动用户 35 等总数，没有当前 release 的逐页最大 N 或分布；既有 P8 测试只有 1 个账号/成员。
  现有资料不能证明列表规模已形成用户影响。

## 验证与边界

- 新增 `apps/miniprogram/scripts/mini-g1-004-scale-probe.test.mjs` 作为仅测试诊断；不进入生产运行时，
  不修改 API、页面代码或数据。
- 已通过该 probe 两次运行，以及既有 P8 C1/E、direct pages、thin-page boundary 定向组合：7 files / 31
  tests passed。依赖完成链接并补齐 contracts/scheduling-domain 的只读 dist 后，正式
  `pnpm miniprogram:test` 通过 115 files / 622 tests（117.62s）；`pnpm exec vitest run
  scripts/test-discovery-policy.test.mjs` 通过 1 file / 3 tests。
- 当前工具按仓库政策未调用微信开发者工具 GUI/CLI、模拟器、Console/Network；没有与本次 SHA 匹配的 Xiaomi
  14 原生节点、首绘、滚动或 bridge 证据。上述未验证项不能由 Node/静态结果替代。

## 唯一下一任务与停止条件

- 唯一下一任务：补当前 release 的脱敏逐页规模/分布，以及匹配 SHA、trial、renderer、基础库、微信版本的
  Xiaomi 14 原生首屏/节点/滚动证据；没有这些证据前保持 P3。
- 本批停止条件：完成文档、相称门禁、diff 审阅后提交并推送调查分支；不因证据增长关系已确认而直接进入
  分页/分批修复。
