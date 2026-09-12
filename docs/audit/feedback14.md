# Feedback14：更多页位移与导出白屏

基线 e163fde8（累计体验版110应用8f441d2d）。用户本轮要求排查并修复两项；不包含新的部署、上传或放行。general-4/5独占复用依赖，无安装；不操作开发者工具。

## MORE-14：更多页进退位移

根因：7923262d 在工作台 onHide 把 testCenterEnabled 设为false，导致更多页底部测试区域被 wx:if 删除；返回 onShow 又插入。滚到下方入口时内容总高度缩短，滚动位置被约束，产生可见位移。不是每个子页面各自的导航动效故障。

修复：普通遮盖保留已授权区域；权限订阅只保留原有授权，不在隐藏页新开入口，真正权限撤销仍立即删除。点击入口原有可见性、账号、会话及服务器权限检查不变。没有改WXML/WXSS、图标、标题或按钮样式。

- 新回归旧代码失败，修复后workbench-runtime31项通过；覆盖隐藏、返回、隐藏时权限刷新、撤销、迟到授权和禁止后台跳转。
- 390×844/320px浏览器生产更多页标记与样式，删除底部区域使scrollHeight1195→1088、scrollTop509→402；保留节点前后均1195/509。脚本feedback14-more-layout.mjs，输出ignored runtime/audit/feedback14/layout。数值是桌面滚动夹紧复现，不是小米14位移实测。
- AST对照前证明blob039d6ec8，只有onLoad/onHide和navigateGroupTool改变，最后一个只增加固定导出入口诊断；所有原有跳转、swiper、定位和手势函数逻辑保留。精确blob证明同步更新，未删除必需历史检查点。

## EXPORT-14：整页白屏仍待定位

用户描述为106后导出入口进入空白、无标题、可返回。9bae5beb是CSV取消、截止与前后台恢复的引入点，但当前证据不足以认定其中某项造成原生白屏。

- 对照102/e40c4f92→106/63877b5e：app.json、app.wxss、build.mjs及导出Page的JSON/WXML/WXSS无变化；panel新增的是等待/超时/取消分支，首屏标题与loading树未变。
- 110冻结包实际JS在Node vm执行Page注册、load/show/ready/hide/unload正常；shell76px、初始loading。只读本地缓存基础库3.16.2/3.17.1/3.17.2未支持导出私有字段覆盖原生Page字段的猜测；未为此改写控制器。
- 9bae5beb新增的flex-wrap与flex:0 0 100%符合微信官方Skyline [flex语法](https://github.com/wechat-miniprogram/skyline-skills/blob/master/skills/skyline-wxss/references/flex.md)与[百分比长度定义](https://github.com/wechat-miniprogram/skyline-skills/blob/master/skills/skyline-wxss/references/basics.md)，不支持“该样式不被接受导致整页拒绝”的猜测。
- 现有exports-controller测试已含真实Page冷入口测试，不能把独立direct-page文件mock控制器的局限误说成全部测试均mock。新增5项真实Page测试补充onReady、3类依赖30秒截止、迟到隔离和卸载；联合原导出套件43项通过。
- 已有recordMiniTelemetryBoundary把阶段哈希后发送为UNKNOWN，不进入手机安全报告。新增独立本地诊断记录open-requested/module-registered/page-load/page-show/page-ready及选项阶段；onReady一次测量root/header/scroll，只保存positive/zero/missing分类。阶段行0ms只是标记，不是性能测量。
- 查询不可用/异常不影响页面；隐藏/卸载丢弃迟到测量。记录仅进入已有授权的有界内存报告，不含群组、用户、日期、查询参数、原始错误或原生返回值，不改服务器接口。

未将30秒请求截止、Node测试或测量能力补齐作为白屏修复成功。CSV创建/查询/取消/前后台恢复及下载后发送行为未改变。

## 当前停止条件

更多位移完成代码修复与浏览器复核，待用户同版本原生验收；导出保持待定位。完成本轮检查点后申请精确SHA体验版上传及追加放行，拿到同版本安全报告再做有证据的导出修复；不分配未授权版本号、不部署API/Web。用户若仍使用旧版，先核对110/8f441d2与环境信息。

## 最终检查与交付

完整pnpm verify通过：format/lint/build/typecheck/icon parity、Mini1179通过/15跳过、根1251通过/436跳过、依赖保护81通过。最后Mini verify及Worklet2/2通过，主包1705422/总包4536468字节；保留已有主包1.5M及矩阵节点提示。基线Mini verify主包1703001/总包4532816，基线工作台30项通过；实际命令及日志位于ignored runtime/audit/feedback14。

联合测试的一项既有偏好并发用例曾瞬时失败，定向和相同完整联合复跑通过，未改断言；最终不间断pnpm verify全部通过。smoke:check-core通过，未触及Web核心链路，浏览器几何证据为更多页生产模板/CSS；不把上述自动化当原生验收。

本次提交消息：fix(miniprogram): stabilize More navigation and expose export render stages。这是更多位移修复与导出可观测性检查点，不是两项全部修复。UPLOAD_REQUIRED，等待用户对精确新SHA批准上传/追加放行；不复用上一110上传授权，不访问生产。
