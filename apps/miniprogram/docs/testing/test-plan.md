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

MiniTest 只在 P1 风险 PoC、P6 核心 v1 RC、P7–P9 阶段 RC，以及重大 Skyline/构建升级执行。Storybook、simulate 和 `miniprogram-ci` 编译均不能替代原生运行测试。

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

- 固定 3 个面板、每面板 42 格及跨月首尾日期。
- 今天、选择、节假日、周末、跨月、人员和加/换标记的组合状态。
- 相邻月份格不可选择；当前月日期只发出一次语义事件。
- 横向方向锁、56px 距离结算、600px/s 速度结算、取消回弹和构建后 Worklet 指令保留。
- 18px 外框裁切、方形内部格与独立详情 12px 间距的源码结构门禁。
- 本地静态/simulate 只能证明结构和事件；视觉与手感仍等待 MiniTest Android/iOS 及用户实体机复核。

## P1 手排矩阵 PoC 当前覆盖

- `daily` fixture 精确生成 7 人、7 天和 49 格；`maximum` 精确生成 20 人、30 天和 600 格，并包含失效成员、失效格和节假日状态。
- 页面只有一个同时启用横纵滚动的 Skyline `scroll-view type=list`；成员行是直接子节点，日期表头、人员列和左上角为独立冻结覆盖层，禁止 `bindscroll` 与 Canvas。
- 5 个矩阵 Worklet 的首条语句及构建产物均受扫描；滚动更新只写 shared value，滚动结束才向 JS 提交一次进度提示。
- 选择格只更新目标格及必要的前一选中格路径；撤销只保存并恢复 `{key,before,after}` 增量，不保存整月快照。
- `miniprogram-simulate` 已覆盖选择、失效状态和禁用格不发事件；原生双轴滚动、冻结手感、视觉与 20×30 渲染时间仍由 MiniTest/实体机判定。

## P1 原生证据工具当前覆盖

- `testing/p1-minitest-plan.json` 固定基础控件、42 格月历、7×7 和 20×30 四条原生路由，Android/iOS、截图名、交互状态及性能门槛不能在运行时漂移。
- `testing/minium/p1/test_p1_native.py` 是可上传 MiniTest 的官方 Minium Python 用例源；4 个 `test_*` 方法覆盖 18 个唯一截图状态，使用稳定原生选择器验证开关/选择、月历点选/翻月/回弹、矩阵双轴滚动/失效格/单格更新/撤销。
- `pnpm miniprogram:minitest:case:build` 生成只有根目录 Python 用例的确定性 ZIP；静态门禁拒绝测试方法、路由、截图名、选择器、凭据边界或 ZIP 结构漂移。7×7 高度刚好容纳 7 行，因此只验证横向滚动；纵向滚动由 20×30 用例验证。
- MiniTest runner 的 dry-run 不读取凭据、不改变外部状态；真实提交只调用官方 `POST /plan`，状态只调用 `GET /plan`，robot/dev account 限制 1–10 且必须一致。
- 自有比较器对稳定区相似度、显著差异像素和关键几何分别判定；图片/遮罩尺寸不一致、缺失几何、越界或非批准遮罩均失败关闭。
- 测试覆盖相同图通过、遮罩忽略、超过 2% 像素失败、超过 2px 几何失败、平台/网络错误脱敏及 Minium ZIP 确定性；实际截图和性能证据仍等待外部凭据、平台用例上传和 MiniTest 权限。

## 失败处理

相关门禁失败不得提交。外部平台/MiniTest 暂不可用时，只能把状态记为“已实现待原生复核”，不能声称完成或发布。
