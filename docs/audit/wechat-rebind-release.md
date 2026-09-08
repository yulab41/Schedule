# 微信换绑修复：体验版96交付记录

2026-09-08用户请求上传新体验版，随后明确授权部署a6586326并放行版本。上传、生产备份/部署和最终校验均完成；未提审、正式发布或主动发送真实测试通知。

## 已交付身份

- 应用源码：a6586326b8bccc91fe7cf4f46b89e6296108e869，干净production候选。
- 体验版本：0.1.0-p10.20260908.96；描述：修复微信换绑，移除网页微信登录 a658632。
- buildTime：2026-09-08T11:25:33.944Z；uploadedAt：2026-09-08T11:28:26.853Z（香港19:28:26）。
- 上传Manifest：d7db136a1b3edb5e2219d9499607cb78b2255320aa9ad9a754413c6f6bacc1dd；333文件；SDK压缩包2510185字节。
- 一次上传成功；receipt、冻结归档全部文件hash/大小、Manifest及远端miniprogram-trial版本标签指向同一源码，独立核验通过。后续ECS打包产生的默认Mini dist不作为.96证据，.96冻结归档保留。

## 生产操作

- 操作前实际live和回滚候选为657f6ef528d1df62fcdc652deb175beb0c16ee9a；控制面脚本hash与可信源码匹配，部署前ecs-verify通过。
- 备份ID：9168aa6d-2fd1-4f8c-9f14-458face592ee；100076368字节，55表、232769行；加密文件SHA256实际校验通过：79a70480369ead8b8be22773364e4496c12618888788e9aa0957714d2ba3a534。
- 官方ecs:package与可信ecs-update完成。dist归档hash=e3693ac2faf9eb3c02da5a360e8af799c47de395c3e15e8523230402e999af13；运行归档hash=f298685d24676da8a438e82f8fb43d28a8221b8d7bb461436974d91023f5d6d5。
- 无新迁移，schema54；仅同步代码/提交内产物，未复制本地数据库、凭据或业务数据。启动阶段短暂502探测后恢复，部署后完整verifier通过。
- 官方允许列表工具已加入.96，并完成allowlist verify及再次ecs-verify。最终live为a6586326，DIRECTORY_QUERY_PLAN仍为candidate；旧网页微信授权入口实际HTTP404。

## 证据与收口

应用验证复用wechat-rebind.md记录：全量verify、65项真实本地MySQL、浏览器与包体检查。本轮额外上传门禁24项通过，正式候选和版本绑定安全检查通过。独占general-1复用，未安装依赖或新建冷槽；ECS打包器离线物化运行产物reused85/downloaded0。上传租约已正式释放；文档收口继续用独占复用槽。

原始日志、冻结上传包、回执校验和部署记录在ignored general-1/runtime/audit/wechat-rebind-upload/；正式receipt位于canonical runtime/audit/miniprogram-trials/。无微信开发者工具操作，不把Node或生产健康检查当成原生验收。

唯一下一任务：用户在小米14重开.96/a6586326体验版，微信快捷登录绑定admin，验证往返换绑；在更多→测试工具→微信提醒诊断刷新，确认两项身份存在且一致后主动订阅/本人测试，返回同版本脱敏报告。

本文件及状态更新为文档收口，不再次部署、上传或同步服务器release元数据；已交付应用身份保持a6586326。
