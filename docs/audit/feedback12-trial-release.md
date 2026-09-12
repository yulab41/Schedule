# Feedback12 体验版交付

## 上传前证明修订

- 用户本轮明确授权“上传体验版并放行”，仅包含上传及追加允许版本；不部署API/Web、不配置模板或发送真实消息。
- 应用基线e94a54caf63816041699d9ddb8db154efe4d1ccf；上传前血缘门禁发现工作台whole-file证明仍绑定337b3f78。首次调用在分配/构建/tag/微信上传前停止。
- 对旧证明与当前工作台执行TypeScript AST逐函数比较：仅onResize/onShow/onHide/onUnload/handleViewChange/loadWorkbench/activatePrimaryWorkspace/createViewPatch/resetCalendarContext这9个已有函数变化，均为已批准的偏好、护士状态、折叠重置或周历高度行为；新增函数归属同一批准范围。其余已有函数一致，包含月份/周/列表swiper、翻页队列、定位与滚动方法。图标geometry与motion源文件未改变。
- 只更新该工作台的精确blob证明及解释，保留所有required checkpoints与严格校验，不删除门禁。应用测试证据复用feedback12.md；上传专项30通过，补充动效与日历回归另记。
- 当前检查点标识：chore(release): refresh approved calendar lineage proof。下一任务为冻结含证明的clean提交、动态分配版本、上传及add-only放行。二维码与整页白屏仍待同版本小米14诊断。

- 补充验证：icon:parity通过57资源；动效/翻页/护士日历/血缘4文件49项通过，未修改业务源码。生产即时只读live=a90e3b0a，可信allowlist脚本hash与审阅源码一致。
