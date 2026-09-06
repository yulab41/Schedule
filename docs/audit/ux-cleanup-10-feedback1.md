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
- 当前没有新生产写入、迁移或体验版上传，也没有分配新版本。本轮新增认领退役，与前序B保留非码认领的范围不同；发布需配套API/Web及新Mini，不能把旧.90视为已更新。
- 检查点message：`fix: refine member and profile layouts and retire claims`。主控统一提交C补丁及本线源码；C因本线未单独运行browser而不绕过commit门禁。原dirty副本受保护。
