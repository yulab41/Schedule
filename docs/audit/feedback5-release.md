# feedback5 发布记录

## 授权与身份

用户对部署657f6ef5、启用candidate及上传体验版的具体提案回复“授权”。本轮完成于2026-09-08香港时间。此前只读/待授权描述保留在feedback5历史验证记录中，本记录为后续发布事实。

- 部署与上传源码：657f6ef528d1df62fcdc652deb175beb0c16ee9a，干净候选。
- 体验版本：0.1.0-p10.20260907.95；描述：feedback5-657f6ef。
- buildTime：2026-09-07T15:58:20.354Z；uploadedAt：2026-09-07T16:05:26.399Z。
- manifest SHA256：a669797676c210a2dbed146c791d7a4fa930cfc8e2f23698dfe6b3c565e47713；333个构建输入文件。
- 版本在跨日前分配并冻结，远端miniprogram-trial版本标签、receipt、allocation、manifest、冻结归档和当前产物的身份核验一致。

## 生产

实际变更前读取live及回滚候选，均为bfd1fbbdcf2594d66fde39bba6ae4f18b22798e1。安装的部署、校验、备份、查询切换与允许列表工具hash符合可信来源。生产备份成功后才部署代码归档，未复制本地数据库、凭据或业务状态。

- 备份ID：e8c3c8f5-788b-4553-adbe-88600215e8cc。
- 备份大小：98900120字节，55表、229165行；实际加密文件SHA256核验通过：587c171825963c9099d3f251b04ba6f4aba5d903acfd4309d582e5bc715af16b。
- 官方ecs:package、ecs-update完成；离线运行产物物化reused85/downloaded0，不是依赖环境安装。
- schema54，无新迁移。部署启动阶段两次健康探测502后恢复；最终校验通过。
- 官方schedule-directory-query-plan candidate完成，API重建后再次ecs-verify通过，实际环境读取candidate。
- 上传成功后官方schedule-client-version-allowlist ensure/verify完成，最后ecs-verify通过，实际live仍为657f6ef5。

## 上传与验证层级

复用独占健康warm槽并正式冻结上传候选；L4上下文检查、版本绑定worktree安全检查通过。发布候选Node门禁30项通过。应用完整验证与包体基线沿用feedback5记录；本轮没有业务代码变更。一次miniprogram-ci上传成功，无失败重试，SDK压缩包2491778字节。静态主包1702602、总包5096194字节是不同口径。

未控制微信开发者工具，未提交审核或正式发布，未发送真实测试/业务通知。服务器配置生效不能替代真机性能或实际收信证据。没有依赖安装或冷槽创建；上传租约已释放，文档收口继续采用独占复用槽。

原始证据位于ignored general-3/runtime/audit/feedback5-release/，包括production-before、backup、deploy、candidate-switch、upload、upload-verified与allowlist-final记录。正式receipt位于canonical runtime/audit/miniprogram-trials/，不提交原始运行数据。

## 唯一下一任务

用户重开小米14体验版，确认.95/657f6ef5后测试冷启动首搜及无关词搜索；从“更多→测试工具→微信提醒诊断”主动订阅，按需点击本人测试消息（消耗一次订阅），收到后人工确认并复制脱敏报告。新版本原生视觉、首搜改善和实际送达均待用户复核。

本记录为文档收口，不再部署、上传或同步服务器release元数据；已交付应用身份固定为657f6ef5。
