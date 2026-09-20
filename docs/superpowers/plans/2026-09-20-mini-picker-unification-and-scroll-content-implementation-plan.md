# 小程序选择器统一与长列表末项安全区实施计划

## 目标

在 WebView-only 前提下完成以下累积候选：

- 修复共享 selector 长列表滚动到底时末项侵入圆角边框；
- 27 个列表型菜单统一使用共享 `ui-selector`；
- 4 个排班配置时间字段复用现有 `ui-wheel-column` 与 picker Sheet；
- `apps/miniprogram/src/**/*.wxml` 中原生 `<picker>` 归零；
- 保持 selector/month/date、业务写入、跨午夜和事件次数不变；
- 完成开发者工具复核、WebView 门禁、体验版上传与 add-only allowlist 放行。

## 步骤 1：建立红灯回归

修改 Mini 测试而不改业务源码，先证明旧实现失败：

1. `p7-native-feedback.test.mjs`
   - 要求 selector `scroll-view` 内存在唯一内容容器；
   - padding 必须属于内容容器而不是滚动外壳；
   - 保留外壳边框、圆角、阴影、动态 max-height 和 up/down 动画。
2. 新增/扩展统一契约测试：
   - 源码原生 `<picker>` 数量必须为零；
   - 原来的 5 个列表调用点必须改为 `ui-selector`；
   - 4 个时间调用点必须改为 `ui-date-picker mode="time"`；
   - 需要局部滚动边界的页面必须传递 `placement-boundary`。
3. `workflow-picker-controller.test.mjs`
   - time 模式合法、空、非法值；
   - 00:00、23:59 边界；
   - 小时/分钟 preview、settle、confirm、cancel、reopen；
   - selector/month/date 既有行为保持。
4. 页面控制器测试
   - 邀请、补录、诊断列表迁移后 index/option/value 和副作用次数等价；
   - 排班配置收到 `HH:mm` 后仍写入同一 draft 字段。

记录旧实现失败数和失败断言，再进入实现。

## 步骤 2：修复共享列表滚动内容结构

涉及：

- `components/ui/ui-selector/options.wxml`
- `components/ui/ui-selector/index.wxss`
- 必要的共享 controller 测试

实现：

- `scroll-view.workflow-picker-selector-popover` 继续拥有定位、最大高度、边框、圆角、背景、阴影和裁切；
- 新增 `.workflow-picker-selector-content`，由它拥有 `6px` padding；
- 选项和空态全部进入内容容器；
- 不改变选项行高、间距、选中态、tap handler、key 和空态语义；
- 保留 `30n + 12` 高度估算，并用测试绑定模板几何。

## 步骤 3：统一页面级放置边界

优先抽取最小共享边界测量助手，避免五个页面复制 selector query 和合法性判断。接入：

- 手动排班 `.manual-page-scroll`；
- 导出排班 `.exports-scroll`；
- 群组设置 `.group-settings-scroll`；
- 邀请与访客 `.invite-visitor-scroll`；
- 排班补录 `.backfill-scroll`。

页面显示完成后预测量，在 `pickerrequestopen` 时刷新；失效或测量失败回退窗口边界。测试工具继续使用
窗口级边界。不得引入新的打开状态机。

## 步骤 4：迁移五个原生列表

### 邀请与访客

- 把 targets、permission 和 role 映射为共享 `{ value, label }` 选项；
- 三个字段改用 `ui-selector`；
- 保持现有 handler 以 index 读取业务对象并只更新本地草稿；
- 在页面 JSON 注册共享组件。

### 排班补录

- 岗位字段改用 `ui-selector`；
- 保持角色未变化零读取、变化后一次 `loadCalendarContext`；
- 复用 `.backfill-scroll` 放置边界。

### 测试工具

- 体验版/正式版目标改用 `ui-selector`；
- 保持禁用态、标签和 `wechatTargetVersion` 语义；
- 继续使用窗口边界，不增加页面滚动容器。

## 步骤 5：给共享 picker 增加 time 模式

涉及：

- `components/ui/ui-date-picker/index.ts`
- `components/ui/ui-date-picker/index.wxml`
- 仅在需要时补充现有样式

实现：

- mode 类型增加 `time`；
- 小时/分钟分别生成 24/60 个 `ui-wheel-column` 项；
- 复用 picker Sheet、实例互斥、wheel generation/command revision、预览与 settled 顺序保护；
- 合法 `HH:mm` 定位对应索引；空值/非法值草稿定位当前本地时间；
- 取消不 emit，完成 emit 一次 `{ value: 'HH:mm' }`；
- 重开以 properties.value 为准，不复用未提交草稿；
- 现有 selector/month/date 分支和日期 pager 不重构。

## 步骤 6：迁移四个时间字段

排班配置的新增/编辑开始和结束时间改为 `ui-date-picker mode="time"`：

- 保持当前 label 和“选择时间”空态；
- 继续通过 `data-field` / `data-shift-id` 或等价薄适配进入原 handler；
- `HH:mm`、空值转 null、全天班和跨午夜 payload 不变；
- 页面 JSON 注册组件；原生 `<picker>` 全部删除。

## 步骤 7：自动化验证

按相同环境串行运行，输出落到 ignored `runtime/audit/`：

1. 红灯目标测试转绿；
2. selector/workflow/p7/页面控制器定向套件；
3. Mini typecheck、format、lint；
4. `webview-only-policy.test.mjs`，确认无 Skyline、rendererOptions、Worklet 或版本分支；
5. thin-page、upload-script compatibility、icon parity；
6. Mini production verify、package、determinism 和 trial-lineage audit；
7. `git diff --check`、源码 `<picker>` 全局零计数、逐行行为变化审计。

## 步骤 8：开发者工具复核

使用独占槽位的 production debug build、390×844、基础库 3.17.2：

- 手排值班人员：向上/向下长列表滚到底；
- 导出成员：长列表滚到底；
- 邀请三个列表、补录岗位、测试目标；
- 新增和编辑班种的四个时间入口；
- selector/month/date 既有入口冒烟；
- Console error/warn、Network fail/error；
- 截图只保存到 `runtime/audit/`。

模拟器通过仅记为开发者工具证据，不宣称小米 14 验收。

## 步骤 9：checkpoint、上传与放行

1. 更新 `docs/project-status.md` 和必要审计记录；
2. 逐行审查 diff，显式暂存任务文件并提交；
3. 正常推送当前分支，不 force；
4. 重新 fetch，确认 `origin/main`、最新 eligible trial 和候选血缘；
5. 在已拥有的 warm 槽位中用 release helper 冻结 clean SHA；
6. 动态分配大于当前最新 trial 的新版本；
7. 运行候选安全检查、版本绑定 production build、Manifest/包体/上传脚本兼容检查；
8. 用 `miniprogram-ci` 上传体验版并记录 receipt/tag/Manifest；
9. 使用可信 `schedule-client-version-allowlist ensure` 只追加新版本，保留旧版；
10. 运行 allowlist verify、完整 ECS verifier 和公网新旧/未知版本探针。

本轮不提审、不正式发布、不部署 API/Web，不修改数据库。最终报告区分自动化、开发者工具和小米 14
三个证据层级。
