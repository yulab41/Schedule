# 视觉与交互执行章节

## 何时读取

布局、样式、视觉层级、触控区域、动效、页面结构或交互行为发生变化时读取本章，并加载
frontend-design。需求、架构或行为契约仍有实质歧义时才加载 brainstorming；方案已经由用户
明确批准时不重复设计门禁。

## 权威来源

- Web 以现有 Storybook story、fixture、viewport 和项目 design tokens 为黄金来源。
- 小程序以 apps/miniprogram/docs/design/visual-parity-standard.md、
  page-golden-manifest.md、p1-visual-confirmation.md 和小程序根规则为准。
- 视觉修改不得顺手改变 API、数据结构、权限、路由、缓存、业务写次数或已确认的空态/错误态；
  若这些行为必须变化，拆成独立任务并先写清契约。

## 验证

1. 先定义目标页面、状态、viewport、动态区域和验收标准。
2. Web 至少检查 390×844 和 320px 边界；稳定区域使用项目 comparator，动态区域只使用已记录
   的 mask。
3. 记录相似度、差异像素和关键几何偏差的真实结果；没有真实结果就写未验证。
4. Storybook、截图比较和 simulate 只能证明各自层级。它们不能证明微信原生 Skyline、
   Android 手感、safe-area、内部滚动或系统返回。

视觉任务若触及 Web 核心链路，按 web-api.md 触发 browser smoke；若只改文档或样张，不运行
无关全仓门禁。最终状态遵循“已实现待浏览器复核 → 已完成（含运行验证）→ 待用户复核”。
