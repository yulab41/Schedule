# 工作流历史改为过去30天（2026-09-28）

## 范围与行为变化

- 用户将工作流历史的过去月份边界改为过去30天，避免9月30日到10月1日整月记录突然消失。基线 `ecd8c2be`，生产前驱实时核对为 `4674c8bc`，已有体验版 `.210@09b834e7`；独占 warm `general-6`，REUSE_ONLY，无安装。
- `git log -S 'const monthStart'` 与 blame 定位月份条件引入点 `4d9cde15`；`4674c8bc` 将其移入凌晨维护任务。本次是用户批准的保留策略调整，不是语义等价重构。
- 截止日按北京时间当天向前30个日历日计算。已结束加扣班的业务日期、换班双方的业务日期都早于截止日时隐藏；请假结束时间采用右开区间，结束时间不晚于截止日00:00时隐藏。待处理、缺少日期、仍在生效的记录保留。
- 例如10月1日截止日为9月1日，9月1日的加扣班仍保留；10月2日才过期。换班双方日期只要有一方仍在窗口内就保留。请假截止时刻与其后1毫秒分别验证。
- 继续由现有北京时间03:00后的每日任务写入数据库 `list_hidden_at`，列表仍只读取带索引的存储状态。不新增常驻任务，不在每次API请求计算日期，不改schema。
- 六处小程序申请/已受理、我的请假/已处理列表补充“过去30天”及待处理/生效中保留说明；只改WXML文字与现有标题容器，不新增样式或状态。
- 排班发布归档仍按月份，过月锁定保护不变；已有事件及补录的一次性隐藏不变。部署后主动执行一次同一个维护任务并记录job run，以校准已经被旧规则隐藏的近30天记录，不等待翌日。

## 验证与证据层级

- 真正行为红灯：三个工作流集成测试在旧实现的10月1日保留断言失败（3失败/94未选）。首次本地MySQL未启动的连接失败不是行为红灯；随后仅启动既有test-mysql容器，未安装或新建环境。
- 修改后真实MySQL定向5/5通过（120未选）：换班、加扣班、请假跨月及30天边界，凌晨任务归档/补跑和既往发布锁定。未重复执行之前已确认有无关归档重发布失败的API全量套件，不宣称全仓测试通过。
- 定向命令：通过 `node --env-file=E:/AItools/Schedule/.env --input-type=module` 调用仓库 `runApiIntegrationTests`，选择 swaps、duty-adjustments、leaves、past-schedules、schedule-repository 五个 integration.test.ts，`-t 'older than 30 days|archives past published months|presents a published past month'`。
- API typecheck/build、四个改动TS的ESLint与Prettier、`pnpm icon:parity`、`pnpm smoke:check-core`通过；未触及Web核心链路，无需浏览器业务冒烟。
- `pnpm miniprogram:verify` 前后均通过：主包1,624,941→1,624,940 B，总包4,336,980→4,337,179 B（约+200 B文字）；主包1.5M提示和矩阵1510节点提示为既有状态。字节对比受构建身份影响，不宣称性能改善。
- `pnpm miniprogram:test`：188文件通过/3跳过，1291测试通过/21跳过。CI dry-run、trial-lineage通过。
- Agent操作开发者工具：会话就绪门禁通过；初次局部编译因本候选项目窗口未打开返回10040，打开该项目后3个WXML均编译成功。局部编译只证明模板可编译，不代替小米14视觉/交互验收。
- 日志及聚合证据在 ignored `runtime/audit/workflow-retention-30days/`，不提交凭据、业务正文或原生截图。

## 发布与停止条件

- 应用检查点消息：`fix(workflows): retain closed records for rolling 30 days`；完成后提交、推送、备份、部署及完整生产验证。
- 体验版沿用正式Node CI路线，production/clean，说明 `rolling 30-day workflow history <当前七位SHA>`；版本由正式锁内helper动态分配，冻结SHA、Manifest、tag、receipt一致后只追加放行并保留旧版。
- 测试页面：换班申请/已受理、加扣班记录/已受理、我的请假/审批已处理。既往排班仍应锁定，原事件和补录隐藏不应恢复。
- 当前状态：已实现及自动化/开发者工具编译验证，待生产交付；停止条件为生产回读、体验版上传及放行验证完成，然后等待同构建小米14复核。不提审或正式发布。
