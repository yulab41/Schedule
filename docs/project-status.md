# Project Status

## 当前批次（2026-09-06）

- UX-CLEANUP-10，RUN_ID `ux-cleanup-10-20260906083903`；最终B授权覆盖十项改造、保留历史数据的群组码兼容迁移、API/Web发布及一个匹配体验版。
- 手机号遵循用户最新确认：默认群内可见，明确关闭才隐藏。未采用严格显式同意恢复实验，现行两个隐私业务文件无本轮diff。
- 用户额外批准PastScheduleView月份按钮44px局部修复。无其他无关产品修改。
- 基线origin/main `7a2fd348bb57a05f3fa85f64cb2624e9f83a8501`；独占warm general-3整合，原根目录及其他任务内容保留。

## 已完成的实现与自动化

- Q1—Q10全部整合；详细需求/文件/证据/兼容清单见 `docs/audit/ux-cleanup-10-20260906083903.md`。
- 照片与群组码活跃链退役，历史表/记录/文件保留；精确binding core分类、admin诊断鉴权、每卡电话状态、日期选择器、通知原位更新、个人页及群组UI完成。
- 完整 `pnpm verify` 启动4/进入DAG4/有效通过1；最后Mini838通过/12条件跳过、Node工具81通过、root1180通过/369条件跳过。条件跳过不计通过。
- 真实MySQL相关定向55项（目录/admin24、群组/邀请/认领/用户29、迁移2）及能力守卫10项通过；5项合成shell回退测试通过，不声称生产恢复演练。
- 运行/浏览器验证：`pnpm smoke:browser` 在隔离合成库及当前整合源码通过登录、管理员、成员、访客、访问记录全流程；320/390宽度通过，无浏览器错误。
- 个人页13项桌面WXML/WXSS代理布局、toast28组合通过；没有微信原生/小米14同新版本证据。
- canonical L4 inspector PASS；REUSE_ONLY。两个既有槽各一次官方离线reconciliation，installInvoked2/冷安装0/升级0。

## 当前发布阶段：S兼容服务候选

- S含全部应用退役与UI代码，schema模型可空，运行兼容53..54；物理NOT NULL时无码新建返回503且不插入。源码journal仍53。
- F新0054及对应测试已精确保存于ignored同RUN_ID的f-hold；未改任何已执行迁移。待S实际部署验证后才加入/执行F。
- 本检查点message：`feat: retire profile photos and group codes with compatible UX cleanup`。B独立原提交已推送，其余成果由本总控检查点统一提交。
- 最近生产只读观察：live `48488019171924701054354e8f707b08eb4d12fe`，schema53，group_code不可空；正式域名TLS健康成功。
- 本轮生产备份/迁移/API/Web部署/新上传尚未执行；此前`.89@c25fcf43`及manifest保持不变。

## 唯一下一任务与停止条件

- 清洁S提交/普通push → 重新核对真实生产、备份、打包部署S → 核验S并加入F迁移 → 部署F → 最终匹配体验版上传与精确allowlist。
- 每一步按真实回执推进；权限、备份、兼容、锁或网络实际阻塞则保存成果准确报告，不重复请求已批准B方案。
- 不提审/正式发布，不拨真人电话、不改真实隐私/退出群组。真机验收仍待小米14同最终构建证据。
