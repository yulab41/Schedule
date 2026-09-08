# 微信小程序审计状态

## 当前批次：feedback6 本地实现与验收完成，待发布授权

- 十一项整改结果见docs/audit/feedback6-result.md；详细设计/失败证据分别见feedback6、feedback6-accounts、feedback6-rotation、feedback6-data-audit、feedback6-upgrade报告。自动化已完成，原生/小米14及新版首搜仍待用户复核。
- main已包含528722f4（日历/补录）、5e420f2c（触摸验证）、98aa0910（账号）、057af270（轮转退役）。最终检查点标识：fix(upgrade): protect sessions and rotation schema transitions。最终pnpm verify完整通过：Mini971、root1208；数据库条件skip不冒充执行，真实MySQL已按变更分批验证。
- 运行/浏览器验证：pnpm smoke:browser对应原脚本经本地内存适配完整通过，无浏览器错误，临时管理员标记恢复。Mini包审总包5118171字节、主包1749532，Worklet2/2；原生更新、08:00前后台切换和首搜性能仍无同版本真机证明。
- 9月8日生产只读审计：3721班次/138事件，无悬空引用；22条无单格事件差异均有旧补录时间。35账号中11无用户名，无确证测试账号，未删除。本轮无生产备份、部署、数据写入或体验上传。
- schema56前向不兼容，必须有备份后迁移；失败后禁止启动旧API，身份不一致禁止普通重试覆盖恢复材料。新版可用后使用精确版本名单停用旧Mini；新微信凭证先迁移，同账号保留偏好，密码仍哈希。
- 全程独占general-1、DEPENDENCY_MODE=REUSE_ONLY，无安装；其他agent只读review，未共用可写依赖。当前池租约/进程事实以ignored runtime状态为准。
- 唯一下一任务：取得具体已验证SHA的当次体验上传、生产部署与旧版本停用授权后，重新读取live、冻结候选并按runbook备份/发布/验证，再请用户做小米14验收；以本地检查点review/push和提交发布确认作为当前停止条件。

## 上一交付：微信换绑修复体验版96

- 应用a6586326、体验版0.1.0-p10.20260908.96已上传并完成服务端部署/版本放行；生产最终verifier通过。身份修复及网页微信登录退役已进入此版本。
- 上传Manifest=d7db136a1b3edb5e2219d9499607cb78b2255320aa9ad9a754413c6f6bacc1dd，receipt、冻结文件归档及远端版本标签一致。详情见wechat-rebind-release.md。
- 验证沿用wechat-rebind.md的全量检查、65项MySQL和浏览器证据；本轮额外发布门禁24项及候选安全检查通过。没有原生验收或实际收信结论。
- 生产备份与hash校验成功，无迁移、本地业务数据复制或依赖环境安装。未主动发送测试通知，未提审或正式发布。
- 上一交付原生待复核项继续保留：微信往返换绑和提醒诊断，不自动发送通知。
