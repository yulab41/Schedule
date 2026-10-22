# 网页校对连续换班与手动方向

## 范围与原因

用户确认两方向按钮布局，并选择网页到本系统时一起预览关联日期、生成完整方案。独占canonical `runtime/wt/general-3`，从已推送1a2f6d0f实施，Acquire → ReuseOnly → root Bootstrap八项全复用、安装0。入口和canonical用户文件保留。不重设0072发布基线，不改其它页面、renderer或依赖；新增按钮需要API和新小程序体验版配合。

`git log -S 'const unresolved = sorted.some'`及blame定位06d420a1的整期间阻断。匿名双日互换复现一日无建议、另一日blocked。现在只连接共享当前双方人员的差异日期，无关冲突不再连带阻断。同提交的stepOperationId只绑定日期/期间/步骤，新增版本断言先红后绿，证实再次交换复用旧身份；旧步骤加入当前版本/人员，新手动步骤绑定完整方案指纹。

## 行为变化与评审

- 自动来源仍参照发布基线。关联组有来源歧义时不默认网页正确，也不显示自动推荐方向。
- 本系统→网页只处理所选日期；网页→本系统由服务器确定全部关联日期，人数守恒换班，否则逐日加扣班。客户端不能指定任意成员或跳过校验。
- 预览返回完整最终变化和步骤；确认复核整组指纹、ID/期间/版本/人员/基线及网页，也识别新增关联日期。原工作流事务内锁班次、比较预期版本，继续权限/资格/冲突校验；其它调用者没有预期版本参数时行为不变。
- 全组原子领取，复用observedAt固定领取时间。扫描10分钟内保留处理中及原领取时间，包括指纹变化/已一致日期；执行5分钟后不再发起下一步，网页原有8秒超时。终止请求占用到期后可重新检测恢复，无新表或迁移。清理只释放本次领取时间。
- 多步逐步执行，不承诺跨系统原子回滚。每步沿用工作流和校对审计，最终回读才返回成功；中途或刷新失败保留已提交步数，小程序刷新记录再显示错误。

独立只读评审发现扫描提前释放占用、清理覆盖部分完成错误、歧义组误标自动推荐三项，均已修复并补对应测试；复评又发现旧入口成功后未释放占用，已先红后绿修复并完成实库网页写入后立即隐藏验证。最终只读复评无剩余P1/P2。改动为批准的功能变化，不声称语义等价重构。

## 验证层级

- 修改前Node基线：API规划/分类10项、Mini页面8项、Mini类型/lint、icon:parity通过；production构建274文件2704ms，总3888912B/主1128046B。Mini源码当时未改。
- 规划3项和旧重复步骤身份先红后绿。API校对58项通过/1项实库锁环境跳过，方向路由6项通过；Mini页面/客户端15项通过。实库另由工作流集成覆盖，不把跳过算通过。
- 真实本地MySQL：首次3307拒绝，确认专用容器停止，启动既有medical-schedule-test-mysql-1后，换班38/加扣班29，合计67项通过/跳过0，含三轮互换、双卡并发、执行前后穿插扫描、事务版本变化。首次67项环境失败日志保留。
- Agent开发者工具：wechatide兼容/登录有效，打开本slot、WXML及WXSS局部编译成功，再关闭窗口。不是模拟器业务运行或小米14验收。
- Web黄金：现有ExternalDutyPreview新增RepeatedSwap390/320；用户确认后才改原生。最终同文案390×844/320×844截图页面错误0，按钮158/131×44，无溢出，两日期及确认按钮可见。不是原生像素比较。
- 当前production构建274文件、包审计通过：总3889103B/主1128047B/insights959511B，其余分包不变。版本绑定上传构建另行记录，local产物不是体验版。

checkpoint检查已完成：根格式/lint/build/typecheck/图标通过；Mini全量1368通过/28跳过，唯一导出准备钩子10秒超时，隔离原5项通过，合计1373执行通过/23原有跳过，未改导出功能或放宽超时，不称单次verify全绿。根pnpm test：Codex83、Vitest1427通过/494实库环境等跳过；相关真实MySQL67项已另跑，不能把494跳过都算实库通过。最终API另补build/typecheck/lint通过；Mini production verify（预算/确定性/边界）及lineage、CI干跑、smoke:check-core通过。版本绑定新体验候选待干净提交后执行。ignored证据在runtime/audit/external-duty-directions-20261022/；无生产人员、凭证或二维码进入Git。

## 工具与下一任务

成功读取guardrails、systematic-debugging、brainstorming、miniprogram-development、frontend-design、ui-design、requesting-code-review及wechatide根/initializer/compiler；实际使用Git、Node/Vitest、Playwright/Edge本地黄金、Docker专用MySQL和wechatide局部编译。writing-plans引用文件缺失，未声称使用；无CloudBase或桌面原生控制证据。

本地已完成、待上线/用户复核；检查点消息`feat(external-duty): preview and confirm reconciliation directions`，当前任务分支正常提交推送后准备独占干净新体验候选。生产备份/API部署/版本放行须当次明确授权，之后用户小米14同构建复核；没有当前实体证据不写验收通过，不提审或正式发布。
