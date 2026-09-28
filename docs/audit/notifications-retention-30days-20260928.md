# 通知保留最近30天（2026-09-28）

## 范围和行为变化

- 用户在工作流30天策略后要求通知同样保留最近30天。基线 `f93868d0`，实时生产前驱 `b0bac240`，已有体验版 `.211@b0bac24`。独占warm `general-6`、REUSE_ONLY，依赖与bootstrap复用，无install。
- `git log -S 'const conditions = [eq(notifications.recipientUserId, userId)]'` 和blame定位初始无时间限制的查询至 `52e9e1f4`。这是新保留策略，不是语义等价重构。
- 按通知生成时间、北京时间当天向前30个日历日计算。严格早于截止日00:00的通知隐藏，已读和未读同样处理；截止时刻保留到下一天。通知是提醒快照，业务待办本身仍按上一批待处理/生效中保留规则展示。
- schema66增加 `notifications.list_hidden_at`，以及列表、未读和维护范围三个索引。迁移只初始化显示标记，保留全部通知正文、原已读状态/readAt、updatedAt和投递记录；不删除、重发通知，不更改订阅设置。
- 复用原history-maintenance：北京时间03:00后每日一次，成功日跳过、失败补跑；只按索引标记新过期通知。API请求不计算日期、不做关联审计扫描。
- 列表、分页、全局/群组未读数量、单条已读和全部已读统一读取可见标记，不依赖小程序标识。过期通知不占角标，旧ID标已读返回404，全部已读不修改隐藏记录。通知后台诊断及投递去重保留原历史。
- markAllRead复用既有未读条件函数：调用接收者/事务/Promise及错误处理不变，groupId的undefined条件不变；新增隐藏过滤是本次批准的行为变化，测试覆盖原已读副作用不被误写。
- Mini通知弹层、独立页说明及空态改为“最近30天”，仅WXML文字，不增加UI状态、样式或路由。工作流30天、既往排班月度锁定、事件/补录一次性隐藏不变。

## 验证

- 基线通知查询单元1/1通过，Mini production verify通过。新API回归旧实现返回5条而预期3条；迁移回归旧schema缺少显示状态，另2项发布schema门禁先失败。首次本地测试容器未就绪、迁移fixture遗漏用户外键均在行为验证前纠正，不计作业务红灯。
- 真实MySQL通知模块10/10、全部迁移30/30通过：跨月、第30天/相邻毫秒、已读/未读、群组与全局、三种客户端标识、分页、权限、read-all和旧ID、原内容/投递保留、65→66和重复迁移。
- 共享维护回归4/4（110未选择）通过：原三种工作流30天窗口、凌晨归档/补跑。API/database类型、改动TS/MJS的ESLint与Prettier、API/database构建、40项单元/发布控制、图标、bash语法、diff/core smoke通过；无Web核心链路修改，不声明浏览器或手机验收通过。
- 实际命令：`node --env-file=E:/AItools/Schedule/.env --input-type=module` 调用 `scripts/run-api-integration.mjs` 的 `runApiIntegrationTests`。notifications.integration.test.ts完整运行后，串行运行packages/database/tests/migrations.test.ts；共享作业文件past-schedules/swaps/leaves/duty-adjustments以 `-t 'archives past published months|older than 30 days'` 运行。
- Mini同口径production verify：主包1,624,941→1,624,940 B，总包4,337,180→4,337,202 B。主包1.5M和矩阵1510节点为既有提示，字节差异包含构建身份变化，不宣称性能收益。
- Mini全量1291通过/21跳过，CI dry-run和血缘通过。首轮因替换既有“点按一条通知即可标记为已读”提示导致1项原生文字守卫失败；恢复原提示、将30天说明放在未读摘要后，定向4/4及全量复测通过，未削弱测试。迁移边界另用独立Intl北京时间计算复测通过。
- Agent开发者工具本候选项目打开、通知WXML局部编译成功、窗口关闭；本会话既有就绪门禁复用。小米14端到端加载/原生文字布局未验证。
- ignored证据目录 `runtime/audit/notifications-retention-30days/`，仅聚合数量、哈希和耗时；不提交生产业务正文、身份或凭据。

## 发布和停止条件

- 应用 `8bb3c6e408a6bdd1efdb70b9443ab58536e13b60`（`feat(notifications): retain the latest 30 days in notification lists`）已推送main并部署。生产备份 `be0ed062-e891-4505-943c-9589384b6817`：54表/326183行/136614804 B，实际文件大小及SHA-256已核对。
- 只读生产预览862条通知，其中307条早于截止日，投递30条；部署迁移将一次性标记历史通知，不等待明天。新schema66不在旧版manifest的65兼容范围，旧版自动回滚会被守卫拒绝，保留备份和旧产物，必要时前向修复，不绕过校验。
- schema66生产迁移及完整ECS verifier通过。迁移后307条隐藏、日期标记不一致0；862通知、30投递数量及排除新增显示字段后的完整业务哈希前后一致，包含原已读/readAt/updatedAt。23名有通知的活跃用户、全局与群组范围、无标识/Mini/Web三类客户端共282次只读请求全部200，列表全分页和未读数与数据库一致，4–63ms。这是服务器内HTTP测量，不代表手机端到端耗时。部署期间维护作业已完成当日任务并正常跳过，历史通知由迁移立即标记。
- clean production体验版 `0.1.0-p10.20260928.212@8bb3c6e`，说明 `notifications retain 30 days 8bb3c6e`，构建时间 `2026-09-28T06:04:25.487Z`。锁内helper动态分配，Manifest `4dc8cfef79ef9cce0fbf19f3d219705e602b6289b26e71ae94a81d3fb7ba81d3`；远端tag/allocation/Manifest/receipt与输出身份一致，上传前后候选安全检查通过。版本绑定主包1,625,666 B、总包4,338,727 B，与前述无版本verify测量口径不同。
- 受信ensure仅追加.212，保留.211；独立allowlist与最终完整ECS verifier通过。严格TLS公网.212/.211均200，动态未知准确版本426。正式应用release仍8bb3c6e4，交付文档检查点 `docs(audit): record notification retention delivery` 不重复部署或备份。
- 已完成生产与体验版交付验证，待用户复核。唯一下一任务：小米14退出重进同构建.212，检查工作台角标、通知弹层已读/未读/分页/全部已读及最近30天说明；通知中心空态由出现空列表时复核。缺少同构建手机证据，未宣称真机验收通过；到此停止，不提审或正式发布。
