# 微信小程序审计状态

## 当前阶段

- 当前批次：`MINI-G1-004` 第二阶段补证（冻结候选、production 脱敏聚合和 Xiaomi 14 人工验收准备）；结论仍为
  “证据仍不足，保留 P3”，不进入分页、分批、懒加载或虚拟列表修复。
- 本轮冻结基线：`MAIN_HEAD=78d0424e19cfc81be142da7e0f5367110f1fc8f2`；体验版
  `0.1.0-p10.20260903.84@8e6a4a320a69fee9f1ca0471d8f9b140e3d4dd39`；live server release
  `48488019171924701054354e8f707b08eb4d12fe`；冻结时间 `2026-09-03T22:05:18.4095188+08:00`。
- `.84` 的完整上传 Manifest 为
  `a4991a6ce17defc4982959da540141d46f7417be1ecc691905f4cccd508c9fa0`；上传记录为 clean
  `production` profile，包体 `5,152,789 bytes`。相关运行时路径与当前主线等价，可以作为本轮真机候选。
- 本轮只做 Git/上传记录/allowlist 状态的只读复核、一次 production 聚合读取、既有 synthetic probe 和文档记录；
  未上传新体验版、未部署 production、未修改 allowlist 或业务实现。主线其他已完成批次和发布事实继续保留。

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
- scale probe `apps/miniprogram/scripts/mini-g1-004-scale-probe.test.mjs` 只使用 synthetic 占位数据，不进入
  生产运行时，不包含姓名、手机号、账号或真实群组 ID；桌面 Node wall-clock 仅作记录，不能外推真机卡顿。

## 验证与边界

- 已执行两次 `git fetch origin`；冻结前二次复核确认 `.84` 与 `origin/main` 的 MINI-G1-004 相关路径无差异，
  trial/main 相关 blob 清单哈希均为
  `37943122c24e7ddd1772b686b1324f777b0efe4473c1e0c5914c89591bead0e6`。live release 与主线相关 API/contract
  路径也无差异，双方清单哈希均为 `ab3be6b4f52e7a801e72d93da2c201d05ce335c904e3243701d684f87ce07654`。
- 既有 probe 在 clean G1 worktree 执行：`pnpm --filter @schedule/miniprogram exec vitest run
scripts/mini-g1-004-scale-probe.test.mjs --fileParallelism=false`，1 file / 1 test 通过（855ms）。
- production 聚合只读查询按 endpoint 语义折叠：平台账号使用 `users.deleted_at IS NULL`；成员使用 active
  membership/active user/非 developer admin/非 guest/未删除 profile，并以二进制姓名相等规则排除重复 pending
  roster；contacts 使用相同有效成员过滤和未删除 contact 的 left join 行数。首次查询文本在数据库解析阶段因
  `groups` 保留字停止、未读取数据；加反引号后的唯一有效查询窗口前后 release 一致。
- 未调用微信开发者工具 GUI/CLI、模拟器、Console/Network、截图或上传；没有匹配候选的 Xiaomi 14 原生首绘、
  节点、滚动或 bridge 指标。测试工具没有 MINI-G1-004 专用 setData/节点 bridge 字段，当前工具无法测量，
  暂未验证。
- 根工作区已跟踪文件无新增修改；既有 `.agents/`、`runtime/`、`src/` 和本地表格等未跟踪内容保持原样。本轮
  不修改业务运行时代码、API、数据库、权限、路由、锁文件、dist 或其他生成物。

## 唯一下一任务与停止条件

- 唯一下一任务：用户在冻结的 `0.1.0-p10.20260903.84@8e6a4a32` 上完成 Xiaomi 14“更多 → 测试工具”环境
  抄录和两个页面的只读首屏/滚动录屏反馈；若版本或 SHA 不匹配，停止测试并只回传实际环境信息。
- 本批停止条件：当前补证结果已记录，等待匹配构建的 Xiaomi 14 反馈；不继续扩大调查，不进入业务修复，不上传、
  不部署。最终状态保持 `MINI-G1-004：证据仍不足，保留 P3，等待匹配构建的 Xiaomi 14 反馈。`
