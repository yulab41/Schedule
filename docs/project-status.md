# Project Status

## 当前批次：feedback6 轮转移除已实现，待最终集成

- 轮转单元已实现完整前后端/领域/表删除及请假清空与受控恢复；本地检查点标识 `feat(scheduling): retire automatic rotation and guard leave restoration`。0056前向不兼容，不能只回滚旧API。全日期只读聚合结论见docs/audit/feedback6-data-audit.md；边界、验证与失败证据见docs/audit/feedback6-rotation.md。未push/mainmerge/deploy/upload。
- 轮转最终pnpm verify完整通过：Mini946、root1178（400数据库条件skip），另schema56真实MySQL分批回归、原浏览器smoke、Mini verify和smoke:check-core通过。当前production包5064615字节；API/Web已停止，general-1保持租约交根review。自动化已完成，原生/真机待用户复核。
- 账号单元已完成自动化与浏览器验证，检查点`feat(accounts): manage profiles and synchronize account phone numbers`；详情docs/audit/feedback6-accounts.md。统一手机号/姓名/密码管理、0055迁移、合并/占位联动已实现，最新真实MySQL49、共享7、Mini25及verify/包审通过；未部署或上传。
- 浏览器触摸门禁独立提交5e420f2c，500ms内轮询原反馈条件，正式smoke全流程通过，见docs/audit/feedback6-smoke.md。

- 用户已批准日历08:00换日、统一账号手机号、手动排班与补录改版、删除自动轮转（请假批准清空冲突班次）及通讯录首搜排查，完整边界见 docs/audit/feedback6.md。
- 基线main=4027d0fd，保留a6586326微信换绑修复；独占general-1，DEPENDENCY_MODE=REUSE_ONLY，无安装。其他agent先只读并行审查，未共用可写依赖。
- 第一检查点完成日历日期/颜色/布局、手排日期/失效修复、补录改版、补录事件修复和readiness等待优化；标识fix(scheduling): align duty dates and compact backfill editing。真实MySQL36、Mini及root定向、构建/类型/lint/包体通过；全量旧断言失败与修正证据详见feedback6.md，未声称一次全量verify通过。
- 运行/浏览器验证：pnpm smoke:browser 原脚本在本槽位API/Web完整通过；390/320大字号桌面代理通过，不等于真机验收。没有本轮部署、上传或生产数据写入。
- 唯一下一任务：根review轮转本地检查点，接管独占槽完成schema56失败保护、版本allowlist替换、旧会话迁移与426升级提示，再做最终候选门禁；以根review与交接为本单元停止条件。生产无确证测试账号，未删除；真机首搜尚未测量。

## 上一交付：微信换绑修复

- 应用a6586326b8bccc91fe7cf4f46b89e6296108e869已部署，体验版0.1.0-p10.20260908.96已上传并放行。用户本轮分别明确授权上传及生产部署/版本放行，最终生产verifier通过。
- 换绑修复、旧凭证失效、并发/事务保护、网页微信登录退役及诊断提示已交付；原账号业务数据保留，无新迁移。旧网页微信授权入口实际HTTP404。
- 备份9168aa6d-2fd1-4f8c-9f14-458face592ee及加密文件hash核验通过；部署前回滚候选实际读取为657f6ef5，最终live=a6586326，查询方案candidate保持开启。
- 实现证据见docs/audit/wechat-rebind.md：全量verify、65项真实MySQL和浏览器检查通过；本轮上传门禁24项、候选版本绑定/归档/标签校验通过。交付详情见docs/audit/wechat-rebind-release.md。
- 无依赖环境安装/冷槽新建。general-1上传租约已释放并用于文档收口；general-3历史释放仍受PID重用阻挡，不终止无关进程。
- 收口提交标识：docs(release): record WeChat rebind trial 96 delivery。只记录已交付应用a6586326，不再部署文档提交。
- 上一交付保留待复核项（非当前下一任务）：小米14确认.96/a6586326后测试个人账号↔admin换绑、微信登录及诊断身份一致，再主动本人订阅/发送并返回脱敏报告。未主动发送真实测试通知，未提审或正式发布，原生与收信效果待用户复核。
