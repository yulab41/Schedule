# 微信小程序审计状态

## 当前阶段

- 当前批次：`ICON-PARITY-CLOSE-001`（Web/Mini 生产图标五层 parity、生成资产 liveness、动效和体验版血缘收口）。
  机器静态/Node 门禁已通过；Xiaomi 14 原生视觉仍未取得与当前候选匹配的用户证据，不写成真机通过。
- 前序 `MINI-G1-004` 第二阶段补证、体验版 `.85` 及其“等待 Xiaomi 14 反馈”的历史结论保留在下方，不再作为本轮
  唯一下一任务。
- 前序 production 聚合冻结基线：`MAIN_HEAD=78d0424e19cfc81be142da7e0f5367110f1fc8f2`；体验版
  `0.1.0-p10.20260903.84@8e6a4a320a69fee9f1ca0471d8f9b140e3d4dd39`；live server release
  `48488019171924701054354e8f707b08eb4d12fe`；冻结时间 `2026-09-03T22:05:18.4095188+08:00`。
- `.84` 的完整上传 Manifest 为
  `a4991a6ce17defc4982959da540141d46f7417be1ecc691905f4cccd508c9fa0`；上传记录为 clean
  `production` profile，包体 `5,152,789 bytes`。相关运行时路径与当前主线等价，可以作为本轮真机候选。
- 本轮随后从当前主线 `a1bba5710cfd5c94b5fd5148898e4f17e45faab9` 准备唯一未占用版本
  `0.1.0-p10.20260903.85`；上传成功，Manifest 为
  `7ae30753e7fc6437826a802df30d1062016a7192f5d494baba50ab9c8be5f63b`，包体 `5,153,449 bytes`。
  服务器 allowlist 保留 `.81`–`.84` 并新增 `.85`，没有覆盖或遗漏之前版本。
- 前序冻结后发现主线新增 `76a572a3378bb452b23db30eb5d850c3d705cd93`（`fix(agent): make Schedule guardrails
discoverable on main`）；其文件范围为 Skill、根 `AGENTS.md`、`.gitignore` 和状态文档，MINI-G1-004 相关
  运行时路径无差异。前序 production 聚合证据仍归属于 `EVIDENCE_MAIN_SHA=78d0424e…`，本轮不重跑
  production 聚合；上传候选另按当前主线建立独立的 `.85` evidence baseline。
- 本轮只上传上述 clean 候选并通过既有 allowlist 控制放行；未提审、未正式发布、未部署 ECS/数据库，未修改
  业务实现。主线其他已完成批次和发布事实继续保留。

## ICON-PARITY-CLOSE-001 机器证据

- 候选工作树：`runtime/wt/icon-parity-1`，基于工具链 checkpoint 工作；起始 `origin/main@bb81e723`，待整合
  的最新主线为 `b076d542`。历史 `1ffab10c`、`5285dd17`、`71110712` 已做祖先/等价实现核对。
- `pnpm icon:parity` 已通过：55 canonical definitions、58 generated Mini SVG、138 生产引用、legacy 0、未消费资产 0、
  Mini keyframes 32/32、Web/Mini motion bindings 31/25、generator 连跑 deterministic；隔离 gallery 无登录/API。
- 未调用微信开发者工具 GUI/CLI、模拟器、Console/Network 或截图。Node/静态/browser gallery 证据只能说明机器门禁和
  Web 页面结构，不能替代 Xiaomi 14 原生渲染验收。

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
- 冻结后 production 只读聚合（查询窗口 `2026-09-03T14:12:44Z`，前后 release 均为
  `48488019171924701054354e8f707b08eb4d12fe`）得到平台账号 endpoint 有效返回 35 条；活动群组 2 个，
  members endpoint 最终有效行数为 17、6，pending 非重复均为 0，contacts endpoint 行数为 17、6。
- 既有 P8 的 2026-08-25 角色合计参考与本次逐群组结果方向一致，但本次结果才是冻结 live release 下的逐页匿名规模；
  它仍不能证明 Xiaomi 14 的首屏或滚动用户影响。
- `.85` 上传前普通 TUN/代理出口被微信 `-10008 invalid ip` 拒绝，未获得成功回执；随后使用仅作用于本次
  Node 进程的 `servicewechat.com` IPv4 DNS override 并清除该进程代理变量后上传成功。系统 TUN、hosts、系统
  DNS 和业务代码均未修改。
- scale probe `apps/miniprogram/scripts/mini-g1-004-scale-probe.test.mjs` 只使用 synthetic 占位数据，不进入
  生产运行时，不包含姓名、手机号、账号或真实群组 ID；桌面 Node wall-clock 仅作记录，不能外推真机卡顿。

## 验证与边界

- 已执行本轮 fetch；候选 `a1bba571…` 的 Mini 源码相对 `.84` 仅有非运行时调查/构建记录差异，相关运行时保持等价，
  且上传前 safety 为 `ready-clean-detached`。此前冻结基线 `78d0424e…` 的相关路径无差异，
  trial/main 相关 blob 清单哈希均为
  `37943122c24e7ddd1772b686b1324f777b0efe4473c1e0c5914c89591bead0e6`。live release 与主线相关 API/contract
  路径也无差异，双方清单哈希均为 `ab3be6b4f52e7a801e72d93da2c201d05ce335c904e3243701d684f87ce07654`。
- 既有 probe 已在 clean G1 worktree 执行通过；本轮候选 clean release worktree 的 Mini 全量测试为 119 files /
  643 tests 通过，`verify`、source/package、determinism、CI dry-run 和 safety 均通过。production 包体为
  `5,153,449 bytes`，仅保留主包和 600 格矩阵的既有 best-effort warning。
- production 聚合只读查询按 endpoint 语义折叠：平台账号使用 `users.deleted_at IS NULL`；成员使用 active
  membership/active user/非 developer admin/非 guest/未删除 profile，并以二进制姓名相等规则排除重复 pending
  roster；contacts 使用相同有效成员过滤和未删除 contact 的 left join 行数。首次查询文本在数据库解析阶段因
  `groups` 保留字停止、未读取数据；加反引号后的唯一有效查询窗口前后 release 一致。
- 未调用微信开发者工具 GUI/CLI、模拟器、Console/Network 或截图。没有匹配 `.85` 的 Xiaomi 14 原生首绘、
  节点、滚动或 bridge 指标；测试工具没有 MINI-G1-004 专用 setData/节点 bridge 字段，当前工具无法测量，
  暂未验证。
- 根工作区已跟踪文件无新增修改；既有 `.agents/`、`runtime/`、`src/` 和本地表格等未跟踪内容保持原样。本轮
  不修改业务运行时代码、API、数据库、权限、路由、锁文件、dist 或其他生成物。

## 唯一下一任务与停止条件

- 唯一下一任务：在 `origin/main@b076d542` 之上整合当前图标实现 checkpoint，重新执行快速 parity/受影响测试，
  冻结 exact clean candidate，并仅在所有版本血缘、包体、source/package/determinism 与完整 verifier 通过后上传体验版。
- 本批停止条件：体验版上传后验证版本与 source SHA/manifest/allowlist；不提审、不正式发布、不部署 ECS/数据库，
  并明确保留“Xiaomi 14 原生视觉待用户提供匹配证据”的边界。
