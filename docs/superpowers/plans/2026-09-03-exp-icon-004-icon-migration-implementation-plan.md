# EXP-ICON-004 图标同源迁移实施计划

## 基线和停止边界

- 基于最新 `origin/main@8e6a4a320a69fee9f1ca0471d8f9b140e3d4dd39` 的独立 worktree 执行。
- 本计划覆盖审计、B1 静态修复、候选构建和体验版上传门禁；不重跑阶段 0，不提交审核，不正式发布，不部署 production。
- 微信开发者工具 GUI/CLI 不在本仓库自动化边界内；Mini 只用 Node 静态构建、测试和 `miniprogram-ci`。

## 批次

### B1：来源收敛和核心图标修复

1. 读取并核对 Web `WorkbenchNavIcon`、`LucideMinimalActionIcon`、TDesign path、CSS/JS motion 和 Mini WXML/WXSS/asset 引用。
2. 添加共享 catalog/types/motion 和生成器；先提交可复现失败的 parity contract。
3. Web 导航/动作/日历/通讯录/身份/状态/导出/访客等优先控件迁移到 `SharedIcon`。
4. Mini 底部导航、顶部、更多、通讯录、日历、事件、筛选、下拉、关闭、工作流 picker、身份和页面返回控件迁移到生成资产。
5. 删除确认无引用的旧 `web-*.svg`，保留品牌/PWA/状态装饰等非图标边界。
6. 完成自动化验证并写入 `docs/audit/STATUS.md` 与审计报告。

停止条件：任一业务行为、权限、路由、API、分包边界改变；包体超过预算；构建/测试失败；或无法把来源追溯到真实 Web path。

### B2：体验版候选与 Xiaomi 14 复核

1. 从已推送的 B1 commit 准备 `runtime/release-worktree` 干净候选。
2. 记录候选短 SHA、trial 版本、版本描述、脏树、测试页面、renderer、基础库和构建时间。
3. 获取用户对这组精确参数的当次明确上传批准后，以 `miniprogram-ci` 上传体验版；不调用微信开发者工具。
4. 上传后停止，等待匹配构建的 Xiaomi 14 证据；逐项复核底部/顶部/更多/通讯录/日历/工作流/身份和安全区。

停止条件：候选不干净、SHA 不匹配、credential-free dry-run/verify 失败、未获精确批准、或用户证据与构建环境不匹配。

### B3：非核心剩余差异（不自动进入）

只在产品确认后处理品牌 mark、PWA 安装图、状态字符、时间线/加载装饰或没有真实 Web 来源的专用 visitor/test 图标；
必须另开来源和回归契约，不能与 B1/B2 混合。

## 交付物

- `docs/audit/exp-icon-004-icon-parity-audit.md`：全量对照、P0-P3、迁移分类、motion、包体和真机清单。
- `docs/audit/STATUS.md`：当前批次、证据等级、唯一下一任务和停止条件。
- `packages/ui-icons`：共享几何、motion、类型和 Mini 生成器。
- Web `SharedIcon` adapters、Mini generated `ui-*.svg`、无旧 `web-*.svg` 引用。
- `docs/debug/debug-feedback-log.md`：失败先行、构建和浏览器冒烟证据。
