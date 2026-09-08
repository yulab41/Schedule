# Project Status

## 当前批次：feedback6 已获发布授权，修正历史动效证明后继续发布

- 十一项整改结果见docs/audit/feedback6-result.md；详细设计/失败证据分别见feedback6、feedback6-accounts、feedback6-rotation、feedback6-data-audit、feedback6-upgrade报告。自动化已完成，原生/小米14及新版首搜仍待用户复核。
- main已包含528722f4（日历/补录）、5e420f2c（触摸验证）、98aa0910（账号）、057af270（轮转退役）。最终检查点标识：fix(upgrade): protect sessions and rotation schema transitions。最终pnpm verify完整通过：Mini971、root1208；数据库条件skip不冒充执行，真实MySQL已按变更分批验证。
- 运行/浏览器验证：pnpm smoke:browser对应原脚本经本地内存适配完整通过，无浏览器错误，临时管理员标记恢复。Mini包审总包5118171字节、主包1749532，Worklet2/2；原生更新、08:00前后台切换和首搜性能仍无同版本真机证明。
- 9月8日生产只读审计：3721班次/138事件，无悬空引用；22条无单格事件差异均有旧补录时间。35账号中11无用户名，无确证测试账号，未删除。原实现轮无生产写入；当前授权发布已完成备份及文件hash校验，尚未迁移/上传，见feedback6-release.md。
- schema56前向不兼容，必须有备份后迁移；失败后禁止启动旧API，身份不一致禁止普通重试覆盖恢复材料。新版可用后使用精确版本名单停用旧Mini；新微信凭证先迁移，同账号保留偏好，密码仍哈希。
- 全程独占general-1、DEPENDENCY_MODE=REUSE_ONLY，无安装；其他agent只读review，未共用可写依赖。当前池租约/进程事实以ignored runtime状态为准。
- 唯一下一任务：发布授权已取得；更新过期的workbench导航动效证明（fix(release): renew feedback6 navigation lineage proof），复用3aeaa4c8应用证据，重新冻结候选并完成上传、备份核验、schema56部署和旧版本停用。以发布验证完成、待用户小米14复核为停止条件。

## 上一交付：微信换绑修复

- 应用a6586326b8bccc91fe7cf4f46b89e6296108e869已部署，体验版0.1.0-p10.20260908.96已上传并放行。用户本轮分别明确授权上传及生产部署/版本放行，最终生产verifier通过。
- 换绑修复、旧凭证失效、并发/事务保护、网页微信登录退役及诊断提示已交付；原账号业务数据保留，无新迁移。旧网页微信授权入口实际HTTP404。
- 备份9168aa6d-2fd1-4f8c-9f14-458face592ee及加密文件hash核验通过；部署前回滚候选实际读取为657f6ef5，最终live=a6586326，查询方案candidate保持开启。
- 实现证据见docs/audit/wechat-rebind.md：全量verify、65项真实MySQL和浏览器检查通过；本轮上传门禁24项、候选版本绑定/归档/标签校验通过。交付详情见docs/audit/wechat-rebind-release.md。
- 无依赖环境安装/冷槽新建。general-1上传租约已释放并用于文档收口；general-3历史释放仍受PID重用阻挡，不终止无关进程。
- 收口提交标识：docs(release): record WeChat rebind trial 96 delivery。只记录已交付应用a6586326，不再部署文档提交。
- 上一交付保留待复核项（非当前下一任务）：小米14确认.96/a6586326后测试个人账号↔admin换绑、微信登录及诊断身份一致，再主动本人订阅/发送并返回脱敏报告。未主动发送真实测试通知，未提审或正式发布，原生与收信效果待用户复核。
