# Feedback12 体验版交付

## 上传前证明修订

- 用户本轮明确授权“上传体验版并放行”，仅包含上传及追加允许版本；不部署API/Web、不配置模板或发送真实消息。
- 应用基线e94a54caf63816041699d9ddb8db154efe4d1ccf；上传前血缘门禁发现工作台whole-file证明仍绑定337b3f78。首次调用在分配/构建/tag/微信上传前停止。
- 对旧证明与当前工作台执行TypeScript AST逐函数比较：仅onResize/onShow/onHide/onUnload/handleViewChange/loadWorkbench/activatePrimaryWorkspace/createViewPatch/resetCalendarContext这9个已有函数变化，均为已批准的偏好、护士状态、折叠重置或周历高度行为；新增函数归属同一批准范围。其余已有函数一致，包含月份/周/列表swiper、翻页队列、定位与滚动方法。图标geometry与motion源文件未改变。
- 只更新该工作台的精确blob证明及解释，保留所有required checkpoints与严格校验，不删除门禁。应用测试证据复用feedback12.md；上传专项30通过，补充动效与日历回归另记。
- 证明修订检查点a9d5a1ee：chore(release): refresh approved calendar lineage proof；其后的候选冻结、上传及add-only放行已完成，见下节。二维码与整页白屏仍待同版本小米14诊断。

- 补充验证：icon:parity通过57资源；动效/翻页/护士日历/血缘4文件49项通过，未修改业务源码。生产即时只读live=a90e3b0a，可信allowlist脚本hash与审阅源码一致。

## 已完成上传与追加放行

- 2026-09-12 10:57北京时间上传成功：0.1.0-p10.20260912.109，commit a9d5a1ee5fa09a1722ee9128390e1286101af988，description“护士日历与二维码导出诊断修复 a9d5a1e”，production/clean。
- Manifest 5c3d2b6080e6ed17941112dbea12af67b5de493656392ddfe5e97ce9991b4338；356文件冻结归档逐文件hash与receipt、远端不可变tag相符。版本绑定主包1703630字节、总包4531781字节；保留主包超内部1.5M提示。正式候选前后校验通过。
- 独占general-4依赖复用，无安装。正式分配器动态选择109；先前e94a检查失败没有分配号码。证明修订后官方重新Acquire和冻结，最终候选与origin/main一致；微信TLS/nonce检查通过，未改系统DNS/VPN。
- 用户授权可信ensure只追加109，旧版保留。控制执行前后验证live与两个控制脚本hash一致；容器重建启动期间短暂502，控制自动等待后通过，最终完整生产verifier和allowlist verify均通过。独立公网HTTPS：109=200、108=200、未知版本=426。
- 服务端live保持a90e3b0a2b1db4eb252eb73e3940964bbf83813d。未部署API/Web、未新建业务数据库备份、未迁移/导入、未配置业务模板、未发真实通知、未提审或正式发布。
- 新访客默认班种接口及通知服务端能力仍需另行部署和配置；上传不证明自动通知链路通过。二维码保存及导出整页白屏仍待同版本小米14安全诊断，不标记已修复。
- 本轮交付文档检查点：docs(release): record feedback12 trial 109 delivery。只记录已上传a9d5a1ee，不重复上传/部署/放行。下一任务：用户在小米14重开109/a9d5a1e，复核护士月/周/列表和详情折叠、二维码保存、导出首屏及文件发送，返回失败时安全报告；服务端部署与真实通知验证另行授权。
- 原始日志、网络检查、冻结包和回执留ignored runtime/audit/feedback12-trial；本轮证据属于Node构建/上传及生产版本策略验证，无原生或收信验收结论。
