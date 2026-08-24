# P6 核心 RC 实体 Android 验收

## 状态与边界

本清单只由用户在实体 Android 的微信原生运行时执行。Storybook、Vitest、`miniprogram-simulate`、桌面 JS 墙钟和 `miniprogram-ci` 均不能代替这些数据。Codex 不启动、控制或自动化微信开发者工具 GUI/CLI。

性能测量在核心页面默认启用；只有显式 query `performance=1` 才在当前页面内存保留并显示完整 `samplesMs/maxMs` 诊断证据。服务端只 best-effort 接收固定 page/device tier/network type/metric/单次 duration，不接收身份、联系方式、凭证、客户端时间或排班正文；不写 Mini storage、不建立离线队列，失败不重试。默认产品路径没有额外诊断 `setData`，也不显示诊断文字。

## 交付前自动证据

- 20×30 view-model 为 171,340 bytes，作为不得增长的自动门禁。
- PoC 展开后的宿主元素下界为 1,445，正式手排 editor 为 1,506；两者都明确未达到“节点尽量少于 1,000”。当前处置是公开警告并冻结各自基线，不把它写成通过项。
- PoC/正式手排的深度和最大直接子项分别为 `8/31`、`11/31`，满足 `<30/<60`。
- WXS 滚动热路径 `setData` 为 0；点击只允许最多两个动态 cell path。
- 桌面模型与 handler 计时只作为算法烟测，不作为下列 Android 阈值证据。

只要真机出现持续卡顿，或任何时间样本超限，P6 性能项就失败。届时先单独评估行虚拟化；不得在没有失败证据时预先改成 Canvas 或改变 Web 同构交互。

## 测试准备

1. 使用本轮报告的体验版或同一 Git checkpoint 的本地 production 构建，先核对页面 `buildLabel` 完全一致。
2. 记录设备型号、Android、微信、基础库和系统字体缩放。
3. 已登录后再从编译模式打开工作台性能路由；计时不包含身份页上的人工停留。
4. 每次只抄录页面显示的整数毫秒值。汇总时记录完整 `samplesMs`、`maxMs` 和阈值，不能只写“流畅”。

| 项目         | 路由与 query                                                  | 精确起点                                       | 精确终点                                       | 样本 |           门槛 |
| ------------ | ------------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------- | ---: | -------------: |
| 工作台冷启动 | `pages/workbench/index`，`performance=1`                      | `onLoad` 中 shell/capability 读取前            | 首个 `ready/offline` 数据的 `setData` callback |    5 | 最大值 ≤2500ms |
| 前台恢复     | 同上                                                          | 非首次 `onShow` 中 capability 读取前           | 刷新后 `ready/offline` 的 `setData` callback   |    5 | 最大值 ≤2500ms |
| 20×30 渲染   | `pages/manual-matrix-poc/index`，`mode=maximum&performance=1` | maximum view-model 构造完成、调用 `setData` 前 | 承载 600 格的 `setData` callback               |    5 | 最大值 ≤1000ms |
| 点格反馈     | 同上                                                          | 合法 tap 已解析、单格 mutation 前              | 目标 cell patch 的 `setData` callback          |   10 |  最大值 ≤100ms |

## 操作步骤

### 1. 正常网络与性能

1. 用工作台性能路由冷启动 5 次；每次记录页面顶部 `P6 性能` 数值。五次都必须成功显示月历，记录 `core-ready` 数组。
2. 保持同一工作台页面，前后台切换 5 次；页面显示的“前台恢复”计数应从 1/5 到 5/5，记录数组。每次恢复后当前月先可用，相邻月继续 best-effort，旧请求不得覆盖新状态。
3. 用最大矩阵性能路由重新进入 5 次，记录每次“20×30 渲染”。横向、纵向各持续操作至中部和边界，日期/人员/主体冻结层必须同帧且无持续可感知卡顿。
4. 在同一最大矩阵连续点 10 个合法格，页面“点击反馈”计数应到 10/10；记录完整数组。每次只改变目标格及必要的前一选择格，滚动停止后可立即点格。

### 2. 弱网、离线与生命周期

1. 弱网进入工作台：当前月先出现，相邻月失败不得清空当前月；无幂等键的写请求不得自动重试。
2. 已有同一账号成功缓存后断网重进：必须显示“离线只读”，月历来自同一 owner 的 24 小时缓存；所有写操作拒绝，不建立离线队列。
3. 正常网下退后台再回来：能力开关重新读取，过期请求不能提交；若能力被关闭，页面失败关闭而不是继续写。

## 证据模板

```text
buildLabel:
deviceModel / Android / WeChat / baseLibrary / fontScale:
core-ready samplesMs: [,,,,] maxMs: /2500 result:
foreground-ready samplesMs: [,,,,] maxMs: /2500 result:
maximum-matrix-render samplesMs: [,,,,] maxMs: /1000 result:
tap-feedback samplesMs: [,,,,,,,,,] maxMs: /100 result:
weak-network / offline / foreground / scroll-jank result:
symptomOnFailure:
```

全部通过后回复“P6 核心 RC 通过”即可，不强制截图。任一项失败时提供 `buildLabel + 项目 + 样本/现象`。在用户明确通过前，仓库状态只能写“已实现待实体性能复核”；审核和正式发布仍需用户另行明确批准。
