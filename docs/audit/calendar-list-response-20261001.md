# 护士列表响应与翻月电话图标（2026-10-01）

用户确认小米14`.226@67d2fff`首次和重复切换列表均约500ms，医生群不明显；护士列表翻月电话图标晚出现。以最新0c5cf4fa主线为基线；.225与.226日历TS/WXML一致。本批保持界面、日期/人员顺序、翻月/滚动/定位/筛选和拨号方式。

## 基线与证据

- 独占warm general-2，Acquire → ReuseOnly → mini Bootstrap → Targeted test；依赖指纹893aa247…，未安装依赖，未创建冷工作树。canonical用户文件保留。
- 已读取guardrails、systematic-debugging、frontend-design与wechatide/initializer/debugger/automator/compiler；Node测试与桌面CSS比较分开记录，开发者工具连接门禁equal且登录有效，不记录身份值。未调用开发者工具MCP或控制电脑。
- 修改前42项通过、Mini类型3035ms、源lint8040ms、production构建1937ms。总包3963756B，主包1183507B、scheduling432675、organization855817、workflows532451、insights959306；最大三文件为workbench237636B、manual187330B、guest161059B。最大20文件与命令日志位于ignored `runtime/audit/calendar-list-response-20261001/`。
- 同样五个月、每月30日、护士20/医生3班次的源Page合成切换：纯缓存切换0请求，重复护士处理中位23ms左右、医生4ms左右。耗时包含测试桥接复制；不能替代手机500ms的完整分解，也不能据此改数据库。额外只读Node函数探针显示同一次建模日期排序3420次ISO格式化；本批不复制共享排序或扩大服务器改动。

## 发现与修改

|编号/优先级|证据与原因|修改、风险和验证|
|---|---|---|
|CAL-06/P1|0848a3da只延后人员内容，68362803仍每人传key/phone并创建行壳；相同护士三月首次3899节点，切回时wx:if重新建树。|屏幕外整卡保留日期锚点与准确高度，人员数组为空；完整业务来源留在既有页面WeakMap，观察器在视口前后提前补齐。风险中，快滚/定位需手机复核，缺API、异常及大字号继续完整回退。|
|CAL-07/P2|初始固定两天对护士20行/日超过一屏，仍为邻月创建大量人员节点；来自0848a3da，68362803只补当前月覆盖。|三月都按屏幕高度准备首屏；无需额外网络读取。新回归确认相邻月首屏电话与人员已完整，不为满屏护士额外创建第二天。|
|CAL-08/P2|68362803按assignment缓存状态，同日同班种20人仍计算20次；状态函数只使用业务日、班种名称/缩写及本次now。|键改为这三个完整输入，Map只存活一次建模；1800→90次，输出不共享可写UI对象。08:00边界、不同班种/日期及全模型等价回归，风险低。|
|CAL-09/P2|每行重新创建SVG image节点，按钮/文本更新与图片加载分开；原绿色生成图源来自2eac4103，image节点始于c7f93d48。手机报告图标晚出现，尚无同构建逐帧解码计时。|原SVG以构建期base64编码进入WXSS，通过按钮伪元素绘制，移除每行image异步节点；44/20px尺寸、颜色/图形和事件均保留。新产物测试防止WXSS本地URL不支持，桌面像素对比与图标门禁通过；手机是否完全消除延迟待复核，不把机制修复当真机验收。|

- CAL-06/07位置：`apps/miniprogram/src/features/workbench/deferred-list-rendering.ts`及两页WXML；结构/数据证据置信度高，手机500ms中占比仍未知。CAL-07风险低。
- CAL-08位置：`apps/miniprogram/src/features/workbench/workbench-model.ts`，与`nurse-duty-state.ts`实际入参比对；置信度高，风险低。
- CAL-09位置：两页WXML、workbench WXSS及`apps/miniprogram/scripts/build-tools.mjs`；独立image加载机制置信度高、手机延迟全部由其导致的置信度中，风险低，状态为已实现待同构建手机复核。

## 语义与行为检查

- 日历/访客数据请求、认证、联系方式授权与持久缓存均未改。源Page方法及导航/手势接收者绑定不变，不引入新的加载接口或依赖。
- 每日正常卡片：38px标题 + 22px内边距 + 2px边框；电话行61px、无电话行52px。今天卡片内边距与边框之和相同。可见内容保持原模板，日期锚点、业务数据与观察器稳定键不变；补齐仍以同一次setData提交真实电话和render标志。
- 观察器失败恢复全部内容，离页/隐藏工作区/换群取消排队回写，旧筛选通知按最新业务来源补齐；大字号不推算高度。重新进入列表仍按既有规则重置离屏富内容，保留已定位日期。
- 状态缓存仅使用函数真正读取的字段，时间捕获仍每次调用更新；跨边界重算，失败/空值/筛选/排序不变。既有“每人一次”成本断言改为“相同日/班种一次”，新增旧代码90期望实际1800失败的独立证据，没有修改业务输出断言。
- WXSS编码只匹配 `/assets/icons/ui-*.svg` 的生成资产引用，源仍引用同一catalog文件，编码解码字节必须相同，普通文件不变；不手绘/改写SVG或增加第三方包。

## 同口径结果

|Node合成场景|修改前|修改后|
|---|---:|---:|
|护士三月初始节点|3899|943|
|医生三月初始节点|1193|664|
|护士列表数组 B|115628|39298|
|访客护士首次桥传输 B|128331|51731|
|首页护士首次桥传输 B|126987|50387|
|访客护士重复桥传输 B|21|21|
|首页护士重复桥传输 B|258|258|

基线与当前用同一命令、依赖、输入和production配置。上述不是手机耗时；本轮重点降低首次及重复建树工作，Node处理中位仅小幅变化，不能把减少字节/节点换算成真机速度提升。

## 验证与当前交付

- 6项列表/状态/图标结构回归在旧代码全红后通过；WXSS产物编码1项先红后绿，定向49项通过，类型和图标门禁通过。移除多余占位子节点后满足原设1000节点门槛，未放宽断言。
- 320/390宽 × 普通/今天卡片 × 无行/有无电话/混合/20人共20组桌面CSS几何及截图比较：高度差0、显著像素差0，电话20px。初版比较夹具同时渲染了旧image和新伪元素，已纠正比较夹具；该失败不作为产品回归。
- Agent开发者工具两页WXML/WXSS编译成功。运行探针读到旧的每人占位数据而无placeholderHeight，刷新/重开后运行连接未与当前输出对齐，导航出现automator超时；不采用这些样本作本轮前后耗时证据。完整Console/Network、当前代码运行耗时、真实访客码、手机快滚及图标逐帧：当前工具无法测量，暂未验证。
- 完整`pnpm verify`通过：Mini195文件/1351通过、4文件/23跳过；根285文件/1368通过、38文件/476跳过；Codex83通过。`pnpm miniprogram:verify`（8191ms）覆盖production、源码/产物/包体/性能预算/确定性，全部通过，保留未改manual1513节点提示；`pnpm miniprogram:ci:dry-run`、`pnpm miniprogram:trial-lineage`、`pnpm smoke:check-core`通过。未改Web/契约核心，不要求`pnpm smoke:browser`；20组独立桌面CSS运行证据仅覆盖样式几何。
- 业务45863f70f930cc7246d1d59cc3128782bd7ccadf（`perf(miniprogram): streamline list cards and paint phone icons atomically`）正常推送任务分支/main；干净同口径`pnpm miniprogram:build`1827ms（基线1937ms，仅一轮桌面构建），总包3963756→3964483B、主包1183507→1184234B（均+727B），四分包不变；最大三文件workbench237694、manual187330、guest161117B，最大20与完整命令留在ignored证据。
- 正式上传锁动态分配`0.1.0-p10.20261001.227`，冻结clean production SHA45863f70、描述“护士列表轻量渲染与电话图标同步绘制 45863f7”；13:39:11 Node上传完成，Manifest `9c890ce37a10b2bf089cadde67839c5fa7fd1117fae14f6b1a247488cbb9b368`，receipt/远端不可变tag/版本绑定正式候选检查全部一致。上传可选white-ext查询一次ECONNRESET，官方SDK继续并成功返回上传，未重复上传或占用其他版本；不会把该警告写成业务Console异常。
- 用户随后当次明确“同意只增放行并验证”；13:54–13:56按已审物理路由（两独立DNS、strict TLS/host-key）核验实时live与已安装control/manifest/source哈希后，只调用可信ensure追加`.227`。原117全部保留、总118；独立policy verify、完整已安装ECS verifier以及strict TLS公网`.227/.226/.225`200、动态未知426全部通过。live前后均dbe352886ff425401586da187054bdd7a488dfcc，MySQL容器身份未变；控制命令按既有流程重建API/Web，无应用部署、迁移、数据库备份或服务端Git身份同步。
- 初次生产preflight错误从manifest顶层取hash字段，在任何写入前停止；与packager对照后改从`artifacts`取值，已安装脚本、独立manifest及当前源码的两hash实际相同；不是服务器控制漂移，不更新控制脚本。Node上传前HEAD根路径探针ECONNRESET，独立TLS握手证明已审IPv4路由可用，沿用原route未改变系统DNS/VPN/证书策略。
- 开发者工具general-2文件监听器仍存活，官方close_project_window返回aborted；正式池release拒绝，保留干净候选/有效租约，不强杀工具或放宽回收门禁。独占general-3完成文档收口，Acquire/ReuseOnly/Bootstrap及文档范围6项通过、无安装，应用输入未变复用已完成门禁；收口消息`docs(audit): close nurse list response trial delivery`。未提审/正式发布。

## 用户完成确认（2026-10-01）

交付`.227@45863f7`并请用户复核后，用户回复：“确认，切换已较前流畅，该任务完成。”沿用此前小米14体验版上下文，将本批次记为已完成；证据为用户定性反馈切换改善，不填写新实测毫秒数、不宣称完全无感。用户没有单独报告电话图标同步、快滚及各入口，也未补充截图、renderer、基础库或微信版本，这些仍是测量边界，不作为本批次继续待办或跨平台结论。

本次仅更新五份状态/审计文档，独占general-3，Acquire → ReuseOnly → Bootstrap → 定向文档检查，无依赖安装。应用输入与45863f70/交付检查点1d02d543一致，复用既有构建、测试及上传证据；验收检查点消息`docs(audit): record calendar list acceptance`。本次不连接生产、不部署/备份/同步服务端身份、不重新上传体验版。

验证：`pnpm exec vitest run scripts/agent-context-policy.test.mjs scripts/test-discovery-policy.test.mjs`两文件6项通过；`pnpm format:check`、`git diff --check`、`pnpm smoke:check-core`通过，未涉及Web/契约核心。逐行审查仅完成状态与证据边界变化，不改应用行为。

唯一下一任务/停止条件：本批次无剩余必需工作，等待用户新指示；通讯录首搜诊断仍暂缓等待用户数据，不自动启动数据库或缓存优化。
