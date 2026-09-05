# MINI-FEEDBACK-REGRESSION-001 通知背景与开关闪烁

RUN_ID：`mini-toast-switch-20260905133316`。基线 `6d3c01b1ecd1f13e67ce919b234face9800f0c35`。
状态：两项修复、定向/绘制、最终全量回归和CI dry-run均通过；最终Git/推送/租约事实见任务状态。微信原生层尚未验证。

## 普通结论与范围

- 通知叠字不是需要增加页面间距：浮层移动到顶层后，不能继续假设能继承页面上的颜色、字体、圆角和阴影变量。
  现改为同源变量在浮层内部明确生效，并采用不透明白底、18px圆角、阴影、深色文字和语义色侧边。
- 开关正常保存路径没有重新加载整页。换班/加扣班各两个原生switch都绑定共享`settingsBusy`到`disabled`，
  一个开关保存会使两者一起禁用再恢复；现复用已有UiSwitch，用不变暗的loading态保持原有串行写入锁。
  点击项立即显示目标值，失败只恢复该项，旁边开关及列表不变。
- 本轮不改API、请求载荷、权限、数据模型、排班规则、Web、依赖声明或锁文件；不调用DevTools GUI/CLI。
  本轮用户没有新的上传/生产授权，未申请版本、未上传、未连接生产、未改白名单。

## 问题、引入点和证据

| ID                  | 等级 | 根因及位置                                                                                 | 引入与证据                                                                                                      | 结论                                                               |
| ------------------- | ---- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| FEEDBACK-PORTAL-001 | P2   | ui-toast WXSS使用page级变量，无局部声明；辅助测试错误使用Web的`:root`变量                  | `454ad56e`，log-S/blame；实际page继承丢失模型测得透明背景、radius0、shadow none、z无效、contrast1               | 高置信代码缺陷，修复后28绘制场景通过；原生待复核                   |
| FEEDBACK-SWITCH-001 | P2   | swap/duty四个原生switch以同一settingsBusy同时切换disabled；UiSwitch自身也把loading当淡化态 | `bc32a4f1`，UiSwitch初始`24bc2c4b`；当前正常设置写入只发字段patch、不进入page loading；定向旧码15红/8生命周期绿 | 保留锁/权限/失败语义，修复后23设置回归与36绘制状态通过；原生待复核 |

截图只用作用户所见现象证据；两张图没有完整短SHA、trial、renderer、基础库、微信版本和构建时间，
因此没有把它们直接登记为当前SHA下的小米14定量验收。源码归因由独立重现和调用链支持。
腾讯官方也记录了page变量对非页面节点无效的兼容性风险，但其描述针对WebView，不能据此断言用户当前renderer：
[腾讯组件文档的特殊组件变量作用域说明](https://github.com/Tencent/tdesign-miniprogram/blob/develop/packages/tdesign-uniapp/site/docs/dark-mode.md)。
仅查阅资料，未引入TDesign/uni-app或改变现有Skyline架构。

## 实现与行为清单

1. `apps/miniprogram/scripts/build-tools.mjs`扩展现有token复制点，从同一生成WXSS派生
   `dist/styles/ui-toast-tokens.wxss`，只把`page`选择器改为`.ui-toast__layer`；值逐字相同，有构建测试锁定。
   未新增依赖、未手改dist、未复制一套手写色值；page原文件保持原样，根页面样式不扩大。
2. `src/components/ui/ui-toast/index.wxss`导入上述局部作用域。白色实心底、18px圆角、阴影、正文深色，
   左侧细色边保留success/info/warning/error区别；2秒计时、120ms进出、固定层级、触摸穿透及安全顶部偏移不变。
3. `src/components/ui/ui-switch/index.wxml`不再让loading附带disabled的0.55透明度，永久disabled仍淡化、拦截点击。
   新增可选`color`属性承接原工作流`#1F5AA6`；未传时仍使用原primary token，关闭轨道颜色与尺寸不变。
4. workflow-swap-panel和workflow-duty-panel各两个原生switch换为同一UiSwitch；各组件及独立Page登记leaf组件，
   不重新注入大业务panel。checked、label、color、loading和change事件显式绑定。
5. 四个设置函数在原锁之后保存先前值并立即更新目标字段；成功仍以服务端返回值为准，失败恢复先前值。
   原`captureWorkflowControllerTask`、接收者成员调用、try/catch/finally和请求次数保留；不是业务重构。
6. notifications-panel已有UiSwitch去除重复`disabled=busy`，仅保留loading对保存过程的语义拦截。
   排班配置等真正权限disabled保持不变；扫描后产品源码不再残留四个原生switch。
7. 精确组件清单测试只为swap/duty增加UiSwitch，leave清单不变；事件检查增强为同时识别`bindchange`和`bind:change`。
   没有删除薄页面、导航、生命周期或业务断言；没有放宽测试超时。

## 验证记录

证据根：`runtime/codex/logs/mini-toast-switch-20260905133316/`（canonical仓库下）。

- 基线clean6d3c01b1：`pnpm icon:parity:check`、Mini verify（类型/build/source/package/performance/determinism）、
  修改目标TS lint均PASS；9文件53项定向PASS，8.97s。构建未单独计时，不编造耗时。
- 基线包：总5,208,176、主1,757,755 bytes；manifest
  `09840b7d3d952fba2f59c47d03ffc8fdc13dd24ed11718527b702dc347c8b0c9`。
- 先红：loading淡化、color承接和局部token缺失3项；工作流23项中15红/8原生命周期绿。
  新测试夹具前两次缺编译常量/完整模块导出，已修正；这些准备错误不冒称产品红灯。
- 原ui-toast辅助测试改用WXSS的page作用域，旧码在第一个320场景失败：透明、无圆角/阴影，截图和JSON保留。
  这补上了前轮把Web `:root`作为环境造成的验证盲点；不是单测通过即可声称真机通过。
- 修复后10文件78项定向PASS，10.74s，含两种方向、慢请求、重复点击、失败回滚、旧请求resolve/reject失效、
  实例节点保持及永久disabled语义。
- Mini正式verify再次PASS：主1,760,518、总5,211,095 bytes，Worklet2/2，矩阵1445/1506、VM171340 bytes；
  manifest `8fccc3e88fa0c947a930e7e79c1fc5f4d57066d699b149cb1100b77eeaab0bf1`。
  前后clean/dirty元数据不同，只记录独立包体，不计算提升百分比。既有1.5M及600格节点warning仍保留。
- 28个通知CSS场景PASS：320/390/414/393/横屏/大字/减弱动效、四种tone；白底opaque、18px、阴影、z1100、
  正文对比度5.5136；单行标题/双行正文、触摸穿透，显示/替换/清除前后body坐标不变。
- 36个开关CSS状态PASS：320/390/414、开启/关闭、saving/confirmed/toast-cleared/rollback/disabled。
  保存期间透明度1、永久disabled0.55；未操作开关的颜色、滑块、透明度和几何保持；点击区域至少44px。
- 首次全量786PASS/3FAIL/11条件skip；3项均为旧leaf注册清单未纳入UiSwitch。按精确新清单修正后，
  workflow-direct-pages、exp-ux-001、thin-page-boundary复测18项PASS。
- 最终正式Mini全量132文件通过/1条件跳过，789项通过/11条件跳过，98.17s；这些既有条件布局skip
  不算执行通过，本轮直接相关的28通知和36开关绘制场景另行执行并留证。
- CI dry-run PASS，无外部写入，manifest
  `02e5fd82e367ff25388a2673672146beb702ed5a2b204ba33aa18c416e1b492e`。
- 提交审阅撤回3个WXML内的无关格式化换行，逐文件断言所有非空白字符与已测试实现一致；控件只保留14/14/1行必要差异。
  之后56项受影响模板/组件/注册测试通过；输出审计再次PASS，主包1,760,518/总5,211,737 bytes，
  最后determinism `3268a7b9f743c58098b0d63424d60ac1f880b08360ae8872426262bb3eaa7c22`，
  最后CI dry-run `0e7b94ed932f2aec1fd1f1a01181b34e4627ed7c3de0b7d65e1382ef8a838e53`。
  以上本地构建包含local/dirty元数据，不冒称可直接上传的最终体验候选。

绘制证据来自本机Edge及实际WXML/WXSS的浏览器模型，不是原生root-portal、switch或微信性能测量。
路径：拥有槽位的`runtime/audit/mini-toast-switch-20260905133316/{before,after,switches}/`，
分别保留paint JSON、layout.json及截图；忽略文件不提交Git。真实Console/Network/冷启动当前工具无法测量，暂未验证。

## Git、规则与交付边界

- 独占warm槽位`runtime/wt/icon-parity-1`，任务分支`codex/mini-toast-switch-20260905133316`；
  REUSE_ONLY、3个producer复用、安装0。实时租约与最终SHA见canonical
  `runtime/codex/tasks/mini-toast-switch-20260905133316.json`。
- 任务期间root另出现8个护栏/CI/tripwire未提交文件，属于其他工作；不暂存、不覆盖、不收编。
  新skill hash`1bf58f54...`已读取，CI fresh-checkout例外不作为本地安装许可。
- 随后fresh fetch发现`ef6885d0`和`d10db9fe`已进入main，差异仅护栏/CI/状态，不含Mini应用源或依赖声明。
  整合时保留并行护栏的完成记录与全部改动；应用证据按app-tree及实际输入核对，不因单纯Git SHA变化重建。
- 路由重匹配曾错误从linked worktree调用canonical inspector而早停；改从canonical根运行后PASS，
  新匹配mini-page-boundary、mini-test-discovery-clock、anonymous-boundary-telemetry、icon-parity均已读取。
- 技能用于本轮：schedule-project-guardrails（隔离/零安装/权限）、systematic-debugging（先复现后修复）、
  miniprogram-development、frontend-design（实心通知卡片）、ui-ux-pro-max（对比度/稳定反馈/触控区）。
  wechatide-skill知识规则已读，执行面因仓库政策禁用；brainstorming只核对既定需求，不重复已明确的设计决策。
- checkpoint message：`fix(miniprogram): restore toast surface and stable switch feedback`。
- 当前状态：已实现且自动绘制复核通过，最终机器收口后为待用户原生复核；`UPLOAD_REQUIRED`。
  本轮未授权上传，不分配新版本，不借用前序.88作为本轮修复完成的真机证据。
- 未上传、未提审、未正式发布、未连接/部署ECS、未做生产备份、白名单修改或数据库迁移。
  唯一下一步是完成当前提交/正常推送；之后等待当次体验上传授权，不自动开启其他批次。
