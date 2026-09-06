# UX-CLEANUP-10 截图反馈1

基线3a7d2553，RUN_ID沿用ux-cleanup-10-20260906083903；同轮反馈独立阶段feedback1。

## 当前实现

- 群组成员标题、人数，无版本/认领展示；底层移除认领API/服务/客户端/契约读写链，保留历史数据库和内部乐观并发版本。邀请、预设转换、退出时排班占位继续保留。
- 复用directory-entry-card，姓名不加“我”，本人只用浅绿色左条，无蓝底；多成员横向分隔。工号通过当前公开完整号码+姓名匹配已发布员工目录，歧义或号码隐藏不返回，批量一条查询。
- 工号响应由includeEmployeeCodes=1精确协商，新客户端请求，旧客户端原shape不变。旧.90目标admin群组页会请求退休claim列表，需随新客户端升级；不能将它说成完全无影响。
- 个人页字号/间距、按钮mini尺寸及文字右对齐、绑定状态同排、胶囊内部均匀padding；下一班取消210px旧高度，底部岗位与日历同行。引入点a50b423b及前轮6d0575d0已log-S/blame核验。
- 公开手机号改底部UiSwitch，点击保存，loading期间保持原写入互斥，失败保留显式重试；默认群内可见、明确关闭才隐藏未改。
- filter的.89/.90/当前SVG逐字相同，无箭头；来源2eac4103后的三层canonical横线，不能称发现.90几何回归。本轮仅使用显式top/left/block固定层位置，保留canonical生成资产与点击动效；浏览器三层检查不能替代原生验收。

## 证据

- warm Acquire/ReuseOnly/Bootstrap通过，安装0。C新general-1；D无槽POOL_BUSY，只读而不扩容；原A/C/D脏副本未动。
- 基线Mini定向22通过/11浏览器条件skip。新增浏览器字体/高度回归先失败（17px低于20px），修正后profile13、公开设置等共34项通过；早期一次测试名未匹配全部skip，未当作通过。
- C认领退役及query协商171项通过，Web类型/构建通过；root目录工号8项及退休边界2项通过；API/Mini类型检查通过。
- 运行/浏览器验证：`pnpm smoke:browser` 于本整合树、3012/5182和既有隔离合成库全流程PASS，截图runtime/audit/ux-feedback1-smoke。未调用生产数据或真实用户副作用。
- 不同阶段测试失败日志保留；完整verify本阶段启动2/进入DAG2/通过1：Mini839通过/13条件skip、Node81通过、root1183通过/367条件skip。第一次仅旧掩码展示字段断言失败，改为校验公开状态/开关隔离后通过；没有关闭鉴权或删有效业务断言。

## 最终增量与交付边界

- 完整门禁后，日历遗留“待认领”空态改“待分配”；成员计数左对齐。文案相关44项定向及最终Mini typecheck/production source/package/performance校验通过，API/Web源与已验证整合树相同，不重复全库验证。
- 本地production构建334文件，总包5,055,028 bytes；仍有主包内部1.5M warning及600格矩阵best-effort宿主节点warning；不是微信体验上传包/真机性能数据。
- 实际WXML/WXSS浏览器代理：profile13布局、额外filter三图层1项；群组390/320各3个合成人员、2条分隔线、本人无蓝底、无横向溢出；图片已人工查看。首次群组样例补齐WXML textarea解析和generated icon CSS后核验，未把样例解析问题当生产故障。
- 筛选.89/.90/current源码没有几何差异或箭头。20px光栅图和放大图已检查三横线；top/left替代inset是定位兼容加固，不宣称证实真机箭头根因已消失。未更改其他图标或canonical几何。
- 公开号码工号查询是一次批量query，使用已发布employee/person目录及原visibility权限；唯一发布批次由既有directoryKind/publishedSlot唯一约束保证。号码未公开（含本人私有号码）不参与，缺码/不同码歧义不返回。
- 删除审计：Mini/Web/API/contracts/client-core不再存在认领活跃请求/服务/标签；isUnclaimed、invite.bindUnclaimedMembership、roster claimedBy/status仅用于已有预设/定向邀请内部关系兼容，历史schema/迁移/记录保留。
- 实施检查点时尚未部署/上传；随后用户明确授权配套发布，结果见下节。不能把旧.90视为已更新。
- 检查点message：`fix: refine member and profile layouts and retire claims`。主控统一提交C补丁及本线源码；C因本线未单独运行browser而不绕过commit门禁。原dirty副本受保护。

## 2026-09-06 实际发布

- 当前消息明确授权API/Web和新体验版；L4 inspector携带授权标志后RESULT=PASS。初次遗漏标志被拒绝，无生产操作；没有绕过门禁。发布source831160d57f9a92a9a59bb1ca9a040ec9b4f6fb84，fresh origin/main相同，生产前驱实时核验为40a189dda71b7038e545713a40d36728c0831a6e。
- 独占general-3 Acquire/ReuseOnly/Bootstrap复用8个producer，安装/冷安装/reconciliation0。正式ECS packager重新编译API/Web并用锁定依赖离线deploy打包85项运行依赖，非开发环境安装。候选42项、trial-lineage及实际PS checker通过，沿用已通过的完整源码验证，不再启动全量verify。
- 复用已验证deploy-stage.sh，发布锁内先完整verifier、真实备份及SHA核验，再updater和完整verifier。备份0b31e1b2-afec-4f8a-aab4-8388e8ca1652，SHA256 40d680c9fdec341261f2dda77282d6ac1122341f7ddf4e6104950489f4496193，55表/96,954,528bytes；既有备份保留策略正常执行。
- API/Web实际release831160d5，schema前后54；迁移runner执行1次但新增迁移0，0054既有摘要与历史非空group_code摘要不变。安全回退前驱为当前40a189dd（同schema54且头像/群组码已退役），实际回退0。
- 线上无会话探测：认领GET及头像旧入口404，binding/diagnostics-access/contacts401；未伪造真实会话或实施用户副作用。普通用户/目标admin正反例沿用自动化，真实绑定待用户验收。
- 微信版本由正式锁分配0.1.0-p10.20260906.91；description `feedback1-831160d`，production/clean，source同API/Web。2026-09-06T09:01:39.237Z官方上传成功，Manifest0776041dc89c3058e46cc4a88a2df622902f7a1f285ee8135d4f8190c1f92ab2，allocation/receipt/remote tag/实际dist摘要逐项一致。
- 最终包334文件：主包1,694,515；scheduling415,220；organization1,016,195；workflows821,180；insights1,040,407；diagnostics67,990；总包5,055,507bytes；官方上传zip2,441,154bytes。主包内部1.5M warning保留，不等于平台包体失败；不把压缩包和源码包混比，不承诺性能收益。
- SSH沿用历史成功主机及严格host-key；微信沿用当前真实系统IPv4/TLS1.3、进程ipv4first和servicewechat-only NO_PROXY，SDK未启用代理。没有改VPN/TUN、DNS、hosts或TLS。一次本地TLS探测遗漏port导致参数错误，补443后通过，不是网络故障。
- 本次API/Web部署1/成功1、备份1、上传1/成功1、精确allowlist ensure1及verify通过，随后完整installed verifier通过；发布日志在general-3/runtime/codex/ux-feedback1-*，官方回执在canonical runtime/audit/miniprogram-trials。旧.90回执不变。
- 收口仅文档，发布source和.91三元组保持不变，不机械重传/同步release元数据；仅释放本轮lease。小米14同版本验收待办，未提审/正式发布，未拨真人电话或修改真实隐私/换班设置。
