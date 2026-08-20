# 小程序测试计划

## 普通 checkpoint

1. 根 format、lint、build、typecheck、test。
2. WXML/WXSS/TS/JSON 语法与格式检查。
3. workspace 边界、Zod、Node、DOM、数据库和密钥泄漏扫描。
4. Worklet 第一语句和编译产物扫描。
5. 连续两次构建的确定性检查。
6. 主包、分包和总包体积审计。
7. `miniprogram-simulate` 的 props/events/state/component-tree 测试。
8. 涉及 Web 核心链路时运行 `pnpm smoke:browser`；所有 checkpoint 运行 `pnpm smoke:check-core`。

构建门禁还必须证明 `__MINIPROGRAM_BUILD_VERSION__` 与 `__MINIPROGRAM_BUILD_COMMIT__` 已被字面量替换，四个 P1 真机页面显示统一 `buildLabel`，体验版不允许只显示不可追溯的产品版本。

P1 风险 PoC、P6 核心 v1 RC、P7–P9 阶段 RC，以及重大 Skyline/构建升级均执行用户人工原生测试。Storybook、simulate 和 `miniprogram-ci` 编译均不能替代用户在微信运行时的人工确认。

## 关键套件

### 身份

- 未知微信返回 `link_required` 且不建号。
- 密码绑定、管理员 URL Link 绑定、新微信用户建档。
- ticket/linkToken 过期、重复、篡改和并发绑定。
- 有/无 UnionID，mini/web 同自然人，邀请合并后再登录。
- 解绑只删除当前 mini identity；无 Web 用户名+密码禁止解绑；旧 token 失效；立即重绑成功。
- 公开 Web 注册拒绝；代码、API、UI 均不存在账号注销。

### 排班与补录

- 20/30/600 成功，21/31/601 拒绝。
- 30 天预览/应用成功，31 天拒绝；跨月、闰年、中国标准时间。
- 单格局部更新、增量撤销、冲突和版本失败。
- 发布、撤回、重发、重复点击和旧版本写入。
- 补录批次全成功；任一项失败全回滚；重放；同 key 异 payload 409；退后台/超时/重复提交；31 日月历边界。

### 访客、隐私、消息、导出

- Guest token 到期、篡改、群组错配、visitor key 轮换、IP/设备限流。
- 有同意显示完整电话；无同意、撤回、号码变化和群组变化隐藏；管理员不能代授权。
- 访客日志权限和原始 IP 90 天清理。
- 订阅 accept/reject/ban/filter、一次性 grant 消费、长期资格、43101 不重试。
- CSV 回归；XLSX 下载/打开/分享；401、过期、无权限、公式注入。

## 性能与结构

- 基准 Android 核心页面 TTI ≤2.5s。
- 20×30 数据到达后渲染 ≤1s；点击反馈 ≤100ms。
- 月历连续翻页、矩阵双轴滚动和冻结层没有持续可感知卡顿。
- 节点尽量 <1000、深度 <30、单节点直接子项 <60。
- 滚动采样证明无高频 `setData`；点击只改变目标 cell/row 路径。

## P1 月历 PoC 当前覆盖

- 固定 3 个面板，但每面板按 Web 公式独立生成实际 5 周或 6 周，并验证跨月首尾日期。
- 今天、选择、节假日、周末、跨月、人员和加/换标记的组合状态。
- 相邻月份格不可选择；当前月日期只发出一次语义事件。
- Android/PC 原生 `swiper` 手势、程序翻页、切换后回中和单次月份事件。
- 18px 外框裁切、方形内部格与独立详情 12px 间距的源码结构门禁。
- 本地静态/simulate 只能证明结构和事件；视觉与手感仍等待用户人工打开微信开发者工具并在实体 Android 复核。

## P1 手排矩阵 PoC 当前覆盖

- `daily` fixture 精确生成 7 人、7 天和 49 格；`maximum` 精确生成 20 人、30 天和 600 格，并包含失效成员、失效格和节假日状态。
- 页面矩阵内部不得出现 `scroll-view`、`native-view`、独立表头滚动容器或 Canvas。普通 WXML 裁切面只允许一个 `pan-gesture-handler`；handler 与 `.matrix-pan-surface` 必须分别以内联 `matrixViewportHeight` 像素高度建立真机命中区，禁止仅靠 `height:100%`。日期、人员、主体和左上角四层长期存在，页面 JSON 继续关闭页面滚动。
- `ongesture` 测试必须覆盖零位移、等幅、近斜向、明确横向、明确纵向、选轴后反向抖动、横纵边界、END/CANCELLED 重置和两个轴的 `decay`。日期层绑定 X、人员层绑定 Y、主体绑定 X/Y，三个 `applyAnimatedStyle` 都必须 `flush:'sync'`；ACTIVE 不得 `setData`，逻辑线程只在结束/尺寸变化更新进度提示。点击只更新目标格或目标行；撤销保存 `{key,before,after}`。回退基线由 ADR-0005 固定。
- 选择格只更新目标格及必要的前一选中格路径；撤销只保存并恢复 `{key,before,after}` 增量，不保存整月快照。
- `miniprogram-simulate` 已覆盖选择、失效状态和禁用格不发事件；原生双轴滚动、冻结手感、视觉与 20×30 渲染时间由用户实体 Android 判定。

## P1 Android 手势能力探针

- `pages/gesture-probe/index` 是 diagnostic-only 路由，不属于产品页面，也不建立 Storybook 黄金稿。
- A 区严格使用普通视图上的最小 `pan-gesture-handler + SharedValue + applyAnimatedStyle` 蓝点；B 区只使用普通 `touchstart/touchmove/touchend` 并显示计数；C 区显示实际 SDK/平台/设备。
- 探针不含矩阵、`scroll-view`、`native-view`、自定义单元格或业务 API。它只用于判断 Android 是不执行 gesture-handler Worklet，还是矩阵页面存在局部输入竞争。

## P1 用户人工原生验收

- `testing/p1-manual-test-plan.json` 固定基础控件、动态月历、7×7、20×30 与 diagnostic-only 手势探针五条原生路由；静态测试防止人工清单与已实现页面漂移。
- 用户按 `docs/runbooks/manual-native-testing.md` 人工配置对应编译模式，在 GUI 模拟器和实体 Android 操作。7×7 高度刚好容纳 7 行，因此只验证横向滚动；纵向滚动由 20×30 用例验证；探针只在矩阵真机完全无输入时执行。
- 通过时用户只需明确回复“P1 人工测试通过”或“通过”，不强制上传截图；失败时提供页面、状态和现象，截图只作为可选诊断证据。
- 自有比较器对稳定区相似度、显著差异像素和关键几何分别判定；图片/遮罩尺寸不一致、缺失几何、越界或非批准遮罩均失败关闭。
- 比较器测试覆盖相同图通过、遮罩忽略、超过 2% 像素失败和超过 2px 几何失败；仅在用户提供截图或失败需要量化时使用，不是人工通过的前置条件。

## 失败处理

相关门禁失败不得提交。用户尚未反馈人工原生测试通过时，只能把状态记为“已实现待人工原生复核”，不能声称阶段完成或发布。
