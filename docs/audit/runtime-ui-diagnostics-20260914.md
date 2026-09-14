# 小程序跨微信实例 UI 差异诊断增强

## 结论与范围

- 故障证据绑定体验版`0.1.0-p10.20260914.132@44034fcc`。同一包在不同微信实例中出现加载圈尖角、Grid 横排退化纵排和测试工具无法滚动；异常实例尚无基础库报告，因此不把环境推断写成最终根因。
- 本轮只增强`subpackages/diagnostics/pages/test-tools`及其 Web 黄金，不修改登录、工作台、日历、通讯录、业务请求、权限、API、数据库或生产配置。
- Mini 没有第三方运行时组件库。TDesign Vue 只提供构建期静态 SVG 来源，不会让不同手机加载不同组件版本。

## 引入点与假设

- `git log -S '"disableScroll": false'`与`git blame`定位到`18498a8b`：测试工具从创建时即依赖 Skyline 页面全局滚动。官方 Skylint 将页面全局滚动列为不支持；这与异常实例无法下滑一致。
- 工作台`.phone-split-actions` Grid 来自`d9296df0`；基础加载圈`.ui-loading__spinner`来自`24bc2c4b`。截图分别符合 Grid 退化块流和边框圆角绘制差异，但未在业务页面直接修改。
- 单一假设：异常微信实例的 Skyline/CSS 能力或基础库运行环境与正常实例不同。诊断版通过隔离 Grid、跨组件 CSS 变量、显式scroll-view和CSS/SVG图形对照确定故障层。

## 实现

- 页面改为固定首屏加显式纵向`scroll-view type="list"`，不再依赖页面全局滚动。
- 首屏在构建版本下显示三项只读自动探针：Grid是否同行、隔离组件是否继承44px令牌、scroll-view是否取得有效viewport和内容高度。
- 左侧CSS缺口圆与右侧现有SVG圆形并排，用截图判断加载圈是否仅发生栅格绘制退化。自动报告明确不伪造像素判断。
- “复制首屏诊断”位于scroll-view之前；报告升级为v2并增加`[运行时兼容性]`段。只复制固定环境字段、状态和几何分类，不发送网络请求。
- 页面隐藏、卸载、刷新和重复测量使用独立serial；迟到结果不能恢复已清除状态。

## 验证

- RED：旧实现定向17项中1项失败，证明缺少显式scroll-view、首屏复制和受控探针。
- GREEN：test-tools 20/20；页面边界、遥测及定向联合33/33；完整Mini 173文件1180项通过、2文件16项跳过。
- Mini TypeScript和production build通过，正式产物363文件，新增分包叶组件及页面绑定均存在；包体审计通过（主包1728648B、总包4591358B），确定性Manifest为`846e53b0…1d6219d`。Web TypeScript、黄金定向2/2和Storybook production build通过。
- 390、320和大字号黄金已实际打开复核；320页面宽与文档宽均为320px、无横向溢出，首屏复制按钮44px；390大字号按钮44px、兼容卡225px。
- `pnpm --filter @schedule/miniprogram verify`在诊断源码、构建与包体阶段通过后，被未改动的手排基线门禁阻断：现有手排节点1507，预算仍为1506。本轮不修改手排或放宽测试，故不能把完整Mini verify记为通过。`pnpm lint`与`pnpm smoke:check-core`通过。

上述均为静态、Node、构建和浏览器辅助证据，不是微信原生或异常手机验收。

## 下一步和发布边界

先形成干净诊断 checkpoint。进入体验版上传前重新走L3候选门禁；必须报告精确SHA、动态版本、构建描述、Manifest和测试页面，并取得该候选确认。当前未授权也未执行生产部署、数据库、allowlist、提审或正式发布。
