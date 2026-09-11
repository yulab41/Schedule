# Feedback10：CSV等待、二维码相册与消息跳转

## 决定与基线

- 用户确认CSV前台等待超过两分钟，使用.102；保存现有二维码PNG；操作反馈复用toast；通知统一日历首页，测试选择trial/formal，日常formal。
- 源基线d5d2ebb1（上传源码e40c4f92）。general-4独占租约，root bootstrap全部复用，无安装。采用schedule-project-guardrails、systematic-debugging、miniprogram-development及frontend-design相关规则；不重复已批准设计。
- 2026-09-11规划阶段用户单独授权只读生产：live仍4e0a0d1a。11:38:28创建任务11:39:04完成（30行），HTTP查询11:38:28–11:38:54共26次200；15:36另一次49次查询得到完成状态。17个历史任务均completed，近期export-jobs每分钟成功。未读取CSV内容、身份凭证或修改生产。
- 初次查询使用错误的scheduler路径、任务运行完成列名，分别非零退出；依据cron实际路径及schema修正后获得上述证据，没有将失败调用标记为验证通过。

## 回归来源和行为

- CSV轮询await后才检查deadline来自82840db9；worker接入来自a45aa84b。新增前台26次成功后悬挂的回归，以及创建能力检查悬挂回归：原实现2失败；presentation-core单独悬挂回归1失败。
- 修复的是已证明的无限等待边界：创建全部前置/请求30秒，查询全部前置/请求90秒；独立截止与取消信号使未返回请求也能退出。保留原任务ID，晚到创建只在同一代次回收ID，不重新POST；晚到查询不覆盖新轮次。
- 页面和嵌入组件均接入hide/show；后台停止查询，前台恢复同一任务；用户主动停止不自动恢复。离页/切群/重置清理计时器与临时文件。诊断复用App内存记录，仅白名单阶段、计数、状态和时间，不含任务ID、群ID、URI或文件路径。
- 原生前台停止查询的最底层原因未测得；Node悬挂模型能证明并修复永不退出的缺陷，不能据此声称原生桥接卡住已消除。实际文件下载/发送仍需新体验版。
- 微信发送缺page来自47733e68；本人诊断指纹/观察器来自040f03b7。保留this调用及观察器位置，新增第五个可选版本参数；日常默认formal，页面固定pages/workbench/index。
- 测试POST新增可选targetVersion，仅trial/formal；formal保持旧规范指纹，trial加入区别字段。省略与显式formal等价，试图以相同操作ID切换版本必须409；不增加库表或发送次数。
- 这是用户授权行为修改，不作为等价重构。二维码保存与toast分支已整合，详见[feedback10-qr.md](feedback10-qr.md)：仅主动点击将原PNG写入相册，读取/轮换/离页/切群按代次隔离，旧图清除；所有操作反馈复用现有两秒toast。
- 交叉审查补充：创建前取消恢复可重试状态；创建调用后的网络/408/无效响应按结果未知处理，不提供重复POST；下载30秒计时前移至能力/会话检查之前，新增上下文校验，迟到认证不能启动失效下载。新增4项先失败后通过，审查复核无新增高风险问题。

## 验证记录

- 修改前命令：`pnpm --filter @schedule/miniprogram exec vitest run scripts/exports-controller.test.mjs scripts/p9-export-download.test.mjs scripts/insights-exports-direct-page.test.mjs`，22通过，4.19秒。
- CSV新回归先2失败，再21项控制器通过；共享轮询先1失败，再5通过。相关直接Page/Web规则/布局合计27项通过。
- 网关新增跳转断言先1失败/14通过；测试版本选择先1失败/10通过。修复后微信客户端/控制器18通过，网关/dispatcher/四字段23通过，路由目标校验6通过。
- 新增QR32项及相邻组合81项通过；整合后QR/CSV/通知/toast联合77项通过。追加CSV边界后controller/secure-download/直接下载边界47项通过。
- 本地真实MySQL：通过既有run-api-integration.mjs的本地schedule_test门禁，选择exports.integration.test.ts及wechat-diagnostics.integration.test.ts，共12项通过；包括实际CSV生成下载、鉴权、过期、版本幂等冲突及formal兼容。发送网关为fixture，真实通知0。
- 完整验证按pnpm verify执行：format/lint/build/typecheck/icon、Mini全套通过（1099通过/15跳过，123.65秒）。Node依赖保护的一条reconciliation测试首次80通过/1失败，在未改该测试和实现的情况下pnpm test复测81通过；其后root Vitest1234通过/420跳过（209.02秒）。这不是首次pnpm verify零退出，最终全部门禁由该流程和单独root复测共同完成；未复现的保护测试失败保留在日志中，不推定原因。
- 较早执行曾发现新增代码的两类ESLint问题及旧P9文案断言，已修正后复测；未删除或放宽断言。日志分别为verify.log、verify-final.log、verify-complete.log、verify-accepted.log、root-test-retry.log，均在general-4/runtime/audit/feedback10/（早期format/icons另在槽位runtime根）。
- 最终pnpm miniprogram:verify和package-audit通过：主包1,647,332字节，总包4,450,595字节，Worklet2/2，矩阵节点1445/1505；保留原内部1.5MiB及节点目标预警。确定性Manifest a38746e0cba206a436fc76f05554dbe5a7f106f21a39e9c3d8a5313a272f5ffa；这是开发验证产物，不是上传候选。
- 最大三个产物：pages/workbench/index.js 187,781字节，subpackages/scheduling/pages/manual/index.js 164,119字节，platform/client-core-calendar.js 153,122字节。本轮没有同口径修改前的完整计时/包体测量，不声明性能提升比例。
- 运行/浏览器验证：源CSS、合成内容、headless Chromium，320/390×普通/大字体×7种CSV状态共28种布局，以及二维码/通知8种布局通过。截图与geometry JSON位于同一忽略目录；二维码采用空白合成占位，未生成或扫描真实访客码。pnpm smoke:check-core确认没有Web核心链路改动。Web build与共享导出逻辑测试通过；未操作微信开发者工具。

## 交付边界

四项代码与自动化运行验证完成，待用户复核。检查点消息：`fix: bound CSV exports and add QR saving and notification links`。具体检查点再确认服务器部署和体验版上传/放行；未新增生产操作、真实通知或相册写入。小米14CSV前台完成并发送、保存PNG扫码、瞬时通知及新消息点入日历均为待用户复核项。
