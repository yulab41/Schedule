# Feedback19 导出页发布后无法执行

## 根因与引入点

用户在交付 .120 后继续报告加载和挂载超时；截图没有版本条，不单独作为 .120 SHA 验收证明。
旧报告已确认 .118 Page 生命周期能进入。挂载完成标记在 controller attached 返回后写入，
因此“缺少挂载标记”不能区分模块加载失败与初始化失败；此前诊断结论过窄。

本轮在独占 general-5、基线 3d83d236、REUSE_ONLY 下复现发布转换失败：

- 原始 production bundle 能在 Node VM 中注册，完整组件/叶控件模板的 Node 模拟能挂载。
- 执行已安装 miniprogram-ci 2.1.31 的 bableCompile（与上传 es6=true 相同）后，
  产物出现 require("@babel/runtime/helpers/regeneratorValues")。
- SDK 自带 7.21.0 helper 清单与 vendor 文件均没有 regeneratorValues；在仅提供 SDK
  实际附带模块的 VM 中稳定失败，Page/Component 注册未发生。
- 对比 e40c4f92（.102）和 9bae5beb（.106 已包含）的 presentation-core/export.ts，
  前者仅生成可打包 asyncToGenerator，后者新增无法打包的 regeneratorValues。
- git log -S 'new Promise<void>' 与 git blame 定位到 9bae5beb 的 146–148 行：
  轮询循环内部的 Promise 回调捕获块级 remaining。Babel 把循环体提升为生成器，
  再委托执行该生成器，因而需要缺失 helper。不是路由或导出 API 请求失败。

本轮使用 miniprogram-development、systematic-debugging 与 schedule-project-guardrails。
未控制微信开发者工具。上述证据是本地真实 SDK 转换与 Node 执行，不是手机验收。

## 修复与清理

1. 将定时 Promise 工厂提到循环外，仅通过参数传入等待毫秒数。保留同一 timer、
   独立截止时间、取消机制、轮询频率、任务编号、请求次数、返回值及 finally 清理。
   没有安装或修改依赖，也没有关闭 ES6 转换或修改 SDK。
2. 导出页恢复单一直接 Page，静态 include 现有业务模板和样式，仅注册叶 UI 控件。
   群组参数写入 data，保留之前有效的只读 properties 修复；四个生命周期仍显式 call(this)。
3. 删除临时 exports-panel Component wrapper 和 JSON、两套加载壳/重复样式、
   panelReady/panelAttached/挂载计时器、无调用的测量函数和废弃类型字段。
   initial-data 保留为纯数据工厂，正确 import type 保留。
4. 删除五份只验证已移除调度/包装结构的回归文件，替换为真实上传转换后 Page 的执行测试。
   保留 CSV 下载、发送、取消、超时、权限、后台和迟到结果测试。
5. Mini verify 新增真实 SDK 转换及 helper 可打包性检查。新回归保留最小旧闭包反例；
   它必须被该检查拒绝，当前 production Page 必须注册并执行冷入口/初始化/卸载。
6. 测试工具复用统一诊断桥，只显示实际 Page/options 阶段，删除针对已移除子组件的误导判读。

行为变化：页面直接显示业务加载态；缺少群组时重试保持现有可见错误。移除人工 5 秒挂载等待。
共享轮询修改仅改变编译结构，闭包不读取 this，原异常路径、等待参数求值次数和 timer 所有权相同。
代码清理可通过 Git 恢复；不删除用户附件、日志、上传回执或业务数据。

## 验证

- 基线：exports-controller + 旧挂载测试 28 项通过，说明旧测试无法暴露发布转换错误。
- RED：真实 SDK 转换后的 .120 内容 JS 在 VM 载入时缺少 regeneratorValues；
  旧共享源码同样生成该依赖。最小旧闭包测试稳定证明门禁会拒绝。
- GREEN：定向 Page/Controller/模板/诊断/边界 42 项通过；共享 presentation-core 8 文件32项通过。
- 新增真实 timer 测试覆盖 999/1000ms 轮询与等待途中取消，完成或取消后 timer 数量为0。
- Mini verify、TypeScript、lint、format、icon parity、smoke:check-core 通过。
  Mini verify 含真实上传转换门禁、Worklet 2/2、包体4,551,833字节与确定性检查。
  主包1,707,981字节/矩阵节点1445与1505为既有内部预警。
- 第一轮 Mini 全套1190通过、1条旧 wrapper 断言失败、16跳过；已改成直接 Page 控件断言，
  对应17项复测通过；最终完整复测168文件1191项通过、2文件16项跳过（129.84秒）。

尚未获得修复后同 SHA 的小米14证据。已交付体验版121以验证实际导出入口；
不能把旧挂载超时提示消失单独当作 CSV 创建/下载/发送全流程验收。

## 体验版交付

- 延续本会话用户对该导出故障修复的上传并放行授权；应用提交960e11c1已推送。
- 版本0.1.0-p10.20260913.121，SHA960e11c1a6aa69dd369212801ad1346d3be936f6，
  production/clean，说明Fix export CI runtime dependency 960e11c。
- 构建2026-09-13T03:53:14.656Z，上传2026-09-13T03:58:06.070Z。
  Manifest 6a854d2f28a141912889166435b0d11fdf96b4bbf7a06ce9234df06549c1ba12，
  ignored receipt/allocation/manifest与远端不可变tag一致；此版234代码文件。
- 首两次旧固定IPv4入口在getrandstr出现ECONNRESET；检查退出进程后将本任务崩溃锁归档。
  当前系统IPv4/TLS校验通过后，使用原构建时间重建同一清单，通过全部原有候选/血缘/清单门禁，
  幂等重试成功。没有换号、覆盖Manifest、修改系统网络或放宽TLS。
- 版本绑定产物重新运行真实上传转换Page测试5项通过；候选前后检查PASS。
- 可信ensure仅追加121并保留120与旧版本。独立allowlist verify和完整ecs-verify退出码0；
  API ready、MySQL healthy、制品哈希一致。ECS_PUBLIC_IP未设置，公网IP主动探测明确跳过。
  生产应用release仍83d8a03b；未部署应用、备份/迁移/修改数据库或提交审核。
- 放行控制按既有行为重建API/Web配置，短暂SSL EOF/502后恢复。
  文档检查点：docs(release): record export runtime fix trial 121。
- 唯一下一任务：小米14体验版121真实进入导出，验证选项、生成、下载和用户主动发送文件。
