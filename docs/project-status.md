# Project Status

本文档保存当前可接续状态；历史以Git、docs/audit/和精确debug记录为准。

- Skill-only 收口：APPLICATION_MAINLINE_CLOSED；依赖规范去重及预检/证据复用/cutoff 已完成，Skill validator、Node 守卫 8/8、format:check 通过；checkpoint `docs(agent): refine candidate evidence and dependency routing`；应用/发布无变化，无下一自动批次，停止条件为主线包含此提交且租约释放。

## B0 工具链收口（2026-09-05）

- 当前授权批次：B0-ACQUIRE-RECONCILIATION-HANDOFF；仅修复 Acquire/offline reconciliation lease 契约。
- 基线 origin/main 为 cdb759b9d8781dc01749f103d2d30d346689121d；整合前两点 diff 为空。
- checkpoint: fix(tooling): preserve owned lease through offline reconciliation。
- general-1 已完成唯一一次有效 frozen/offline reconciliation，下载0、tracked tree无变化；root健康通过。
- 全新 b0-fresh-smoke 普通 Acquire 已返回 READY_REUSE，安装0，bootstrap全复用；维修/smoke lease已释放。
- 工具链39项、连续性/发现守卫6项、format:check、目标lint和smoke:check-core通过。
- 详情：docs/debug/b0-acquire-reconciliation-handoff.md；最终SHA/推送后smoke/清理见
  ignored runtime/codex/logs/b0-acquire-reconciliation-20260905/handoff.json。
- 唯一下一批次为独立 B2；停止条件：checkpoint进入origin/main、最终fresh Acquire通过、B0 lease全部释放。
  不在本轮启动B2、不改业务/图标/Skill/体验版/allowlist、不连接生产。以下Mini事实仅保留连续性。

## 前序 Mini 批次（2026-09-05）

- 当前批次：MINI-FEEDBACK-REGRESSION-001，RUN_ID `mini-toast-switch-20260905133316`。
  用户反馈通知只显示文字、开关切换时闪烁；两项代码修复、定向/绘制/最终Mini全量均已通过。
- 基线main：`6d3c01b1ecd1f13e67ce919b234face9800f0c35`；当前代码checkpoint以Git及ignored任务状态查询，
  不把未生成的最终SHA写入同一commit。checkpoint message：
  `fix(miniprogram): restore toast surface and stable switch feedback`。
- 独占健康warm槽位`runtime/wt/icon-parity-1`，分支`codex/mini-toast-switch-20260905133316`。
  REUSE_ONLY，3个producer复用，安装0；未修改依赖声明/锁文件。
- 根工作区原有10组未跟踪内容保留。任务中另出现8个护栏/CI/tripwire未提交改动，属于其他工作；
  不暂存、不覆盖、不收编。重新读取变化的canonical护栏；CI安装例外不用于本地。
- 详细原因、文件、证据、命令和边界见`docs/audit/mini-toast-switch-20260905133316.md`；
  接续机器状态：`runtime/codex/tasks/mini-toast-switch-20260905133316.json`。

## 实现与实际验证

- 通知：原page变量不应依赖穿过root-portal继承；既有构建从同源WXSS派生局部token作用域。
  浮层采用实心白底、18px圆角、阴影、深色正文和语义色侧边；原单timer、fixed和触摸穿透保持。
- 开关：换班/加扣班四个原生switch复用UiSwitch；loading阻止重复输入但不淡化，真正disabled保持淡化。
  保留原settingsBusy串行锁；点击项立即更新，成功服从服务器结果，失败只回滚该项，旧响应继续失效。
- 通知设置页移除重复disabled=busy；薄页面仅增加leaf UiSwitch，业务panel边界保持。
- 引入点：通知`454ad56e`；工作流原生switch与共用disabled为`bc32a4f1`；UiSwitch初始为`24bc2c4b`。
- 基线53项定向PASS；有效回归先红后绿；修复后78项定向PASS。
- 最终Mini全量：132文件通过/1条件跳过，789项通过/11条件跳过，98.17s。
  首次全量3项旧注册清单失败已精确更新；组件清单/薄页面复测18项通过，事件发现同时覆盖bindchange/bind:change。
- TypeScript、目标lint/格式、正式Mini verify的build/source/package/performance/determinism、icon parity均PASS。
  本地production包主1,760,518/总5,211,737 bytes，Worklet2/2；既有主包1.5M和600格矩阵warning保留。
- 撤回3个WXML无关换行时逐文件证明非空白字符完全一致，随后56项受影响测试及build/source/package/
  performance/determinism再次PASS，不重复无影响业务套件。
- CI dry-run PASS，manifest `0e7b94ed932f2aec1fd1f1a01181b34e4627ed7c3de0b7d65e1382ef8a838e53`；无外部写入。
- 28个通知CSS场景PASS：背景opaque、radius18、shadow、z1100、正文对比度5.5136，body坐标不变。
  36个开关CSS状态PASS：保存/成功/通知清除/失败回滚时opacity1，永久disabled0.55，未操作开关保持。
- 证据为Node/simulate/本机Edge模型，不是微信原生验收；真实Console/Network/冷启动当前工具无法测量，暂未验证。
- 主线期间新增`ef6885d0`与`d10db9fe`，仅护栏/CI/状态改动，不改Mini运行输入；本轮与其安全整合，保留其独立收口事实。

## 发布边界与唯一下一步

- 状态：已实现并完成自动绘制复核，待用户原生复核；`UPLOAD_REQUIRED`。
  本轮没有新的体验上传或生产授权，未分配版本、未上传、未改白名单、未连接生产。
- 前序已上传观察仍为`.88@84dc966ea384e6f88c354bc5e5fb506ee5144d08`，详情见
  `docs/audit/mini-ui-20260905001548.md`；它不含本轮修复，不能作为本轮完成的真机证据。
- 本轮checkpoint完成并正常推送后安全释放租约；推送/释放的最终事实以Git与ignored任务状态为准。
- Mini 前序待授权动作：取得当次授权后再准备修复体验版；不属于B0的后续批次。
  未提审、未正式发布、未部署ECS/数据库、未做生产备份或数据库迁移。未宣称Xiaomi 14真机验收通过。
