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
- 本地静态/simulate 只能证明结构和事件；视觉与手感仍等待矩阵完成后的 MiniTest Android/iOS 及用户实体机复核。

## 失败处理

相关门禁失败不得提交。外部平台/MiniTest 暂不可用时，只能把状态记为“已实现待原生复核”，不能声称完成或发布。
