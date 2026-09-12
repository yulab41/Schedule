# Feedback12 API/Web部署与通知启用

## 已完成

- 用户本轮明确授权部署API/Web与服务器通知配置。基线origin/main=37d752b56fe7f0495572b61ef0fb31760640b3d7；生产即时前驱a90e3b0a2b1db4eb252eb73e3940964bbf83813d，schema57。general-4独占Acquire/ReuseOnly/release Bootstrap，未安装工作区依赖。
- 部署前加密备份fdb247e7-bed8-46ec-8f7a-44c9cb2a505c，54表、105913636字节，SHA256 67e7fd8b22a14d1d3387445fbfac8e5eb4edb496bbec704f0653fa0368879752；服务器实际文件hash一致。生产数据库是唯一权威来源，无本地数据上传。
- 正式ECS打包、release候选检查通过；发布缓存4项、打包/schema/回滚37项通过。构建重新生成API/Web，flat导出85包复用/downloaded0。复用前轮完整本地测试与浏览器证据，不以打包替代这些证据。
- 37d752b5完整部署成功，无新增迁移，schema57保持。独立完整生产verifier和allowlist verify通过；公网109/108=200，未知版本426。浏览器工具打开生产页超时，未获得本轮生产浏览器视觉证据。
- 生产只读精确匹配头颈外科医生/头颈外科护士两个有效群。备份原env并在release/capability锁内原子更新WECHAT_TRIAL_GROUP_IDS，root:root/0600且其余行保持。重建后通过部署模块验证两群trial、其他群formal。
- 外部通知开关原已true；cron服务与每分钟通知调度原已运行，部署继续安装验证原调度。最近两轮自然cron：duty-reminders created0/duplicate11/skipped0，notification-retry attempted0/failed0/sent0/skipped0；无手动触发或真实测试发送，无历史通知重放。
- 队列只读发现4条历史微信failed、attempts1、错误码47003；未改写/补发历史记录。此证据不证明当前模板发送仍失败，也不证明新链路已实收。

## 独立业务模板仍阻塞

- 经现有正式WechatApiGateway的只读模板查询确认，微信账号仅有1个模板“排班提醒”，即现用值班模板；未有独立业务模板。没有打印AppSecret/access_token/openid或请求响应全文。
- WECHAT_BUSINESS_TEMPLATE_ID和WECHAT_BUSINESS_TEMPLATE_FIELDS未配置。新18类业务通知代码及访客默认班种接口已随API部署，但业务微信投递按设计保持关闭，站内通知与值班模板保留；不能宣称所有自动通知已启用。
- 已弹窗请用户提供实际业务模板ID及完整字段名称/编号。后续按公众平台实际模板核对逻辑映射、原子配置并验证；不挪用值班模板、不编造模板、不更改订阅拒绝状态。
- 唯一下一任务：取得新增业务模板的ID和字段后完成该通道配置及安全验证。小米14/真实自动收信仍需另行证据；当前不主动发测试消息。

## 收口

- 文档检查点标识docs(ops): record feedback12 server deployment and template blocker；服务器已验证的应用release为37d752b5。若依据部署政策同步文档提交，仅在现有备份及可信hash-identical门禁通过后复用相同应用归档，无重复应用重建、迁移或通知触发。
- 详细备份、manifest、配置白名单、自然cron、部署/验证日志位于本槽ignored runtime/audit/feedback12-server。最新实际release以生产current-release和对应manifest为准，体验版仍109/a9d5a1e，不重复上传或改allowlist。
