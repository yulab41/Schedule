# Feedback12：二维码诊断与导出初始化

- 基线 `5f79236f`，独占 `runtime/wt/general-4`，任务 `feedback12-export-qr`；L1 inspector PASS，Acquire/ReuseOnly READY_REUSE，mini bootstrap 全部复用、无安装。
- 用户批准完整反馈计划后实施第1/2项。仅本地 Mini 源码与 Node 检查；无生产连接、上传、微信开发者工具或真实消息。

## 证据与行为变化

- 截图“二维码未保存，请稍后重试。”对应原生 album 调用的 `save-failed`，不是 PNG/JPEG 无效分支。108 的格式修复不能证明当前故障已解决。
- `git log -S 'saveImageToPhotosAlbum'`、适配器 blame 确认相册调用及清理覆盖结果来自 `9bae5beb`。新增固定阶段与固定错误分类的内存诊断，隐私检查错误区别于相册权限；不保存原生错误文本、路径、二维码字节或身份数据。
- 清理失败不再覆盖原先取消/失败原因；已确认相册成功时显示“已保存”并附清理告警，不误报保存失败。诊断同时保留主要失败与清理失败；没有自动重试或自动打开设置。
- 导出 `loadOptions` 无截止来自 `82840db9`（`git log -S 'async function loadOptions'`）；三个异步前置任一悬挂会持续 loading。现加入整个初始化30秒截止；超时显示可重新加载错误，迟到能力/结果不能启动失效请求或覆盖新轮次；卸载取消计时。
- `9bae5beb` 引入导出 show/hide 与创建/查询截止；当前直接 Page 与 `height:100%` 早已存在。保留这些行为，不重复无证据布局修补。新增 Page ready 与选项开始/完成/失败/超时边界标记。
- 本轮是行为修复而非等价重构：返回状态及文案增加，初始化等待变为有界；方法接收者、原二维码字节、QR代次、任务ID复用、点击次数与晚到结果隔离保持。现有30秒创建/90秒查询截止不变。

## 验证

- 定向基线：`pnpm --filter @schedule/miniprogram exec vitest run scripts/feedback10-qr.test.mjs scripts/exports-controller.test.mjs scripts/insights-exports-direct-page.test.mjs --fileParallelism=false`，67通过，4.86秒。
- RED：QR与exports-controller相同过滤器，6失败/64通过；分别为3种初始化悬挂、清理掩盖原失败、清理掩盖成功、隐私错误分类。
- 初次GREEN：上述基线三文件72通过。补充主要失败+清理双诊断、成功告警UI与卸载迟到能力后，联合8文件113通过；包括p6-telemetry、organization-direct-pages、thin-page-boundary、p8-organization-d-controller和p9-export-download。
- 该联合命令误写一个不存在的 `feedback11-export-template.test.mjs` 过滤器，未计入执行。随后用真实 `feedback11-exports-template.test.mjs` 与QR复测51通过，其中模板7项、QR44项；累计不同用例120项。
- 修改路径 ESLint `--max-warnings=0`、Mini `typecheck`、`pnpm icon:parity` 通过。完整项目检查与最终构建包体由集成协调者执行，不把旧包体当作本次基线。
- 运行/浏览器验证：未修改布局或Web核心链路；未运行浏览器或原生微信，不宣称小米14通过。

## 未解决与验收边界

- QR原生失败根因仍需新版安全报告确定；隐私分类只是诊断，不代表后台隐私声明或手机授权已经修复。
- 导出整页白屏仍未复现，初始化悬挂应保留标题与loading卡，不能把有界初始化当作白屏根因修复。需相同版本的Page onLoad/attached/ready/选项阶段和标题/返回箭头可见性证据继续定位。
- 安全验收：小米14核对构建版本后主动保存二维码、复现导出并复制简化报告。测试的原生API均为fixture，未保存真实二维码。
