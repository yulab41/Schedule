# Feedback26：导出筛选变化后重置文件状态

## 范围与根因

- 基线 `4d75ab20`；独占 `general-1`，`REUSE_ONLY`，依赖与 Mini bootstrap 均复用，无安装。
- `82840db9` 引入的 `setSelection` 只更新周期标签；`f0c46078` 引入岗位/人员多选后继续直接 `setData`。二者都没有让已生成任务失效，因此切换条件后仍显示并可操作旧文件。
- 修改仅限导出控制器和对应回归，不改 WXML/WXSS、API、数据结构或生成文件内容。

## 修复与行为

- 所有实际导出参数变化统一复用 `invalidateExport`：取消等待、递增 epoch、清除任务 ID、释放临时文件，并恢复 `idle`/“选择内容后创建任务”。
- 月份、年份、周期模式、岗位、人员、格式和导出类型均覆盖；相同值点击不触发重置。
- 保留旧任务迟到结果保护、创建不确定性、下载、分享和页面生命周期语义。

## 验证

- 修改前定向基线：`exports-controller.test.mjs` 29 项通过。
- 新增回归 RED：七类切换均仍为 `downloaded`，7 失败/29 通过。
- 修复后 GREEN：控制器 36 项通过；与下载、直接 Page、thin-page 联合 43 项通过。
- Prettier 与 `git diff --check` 通过；`pnpm --filter @schedule/miniprogram verify` 通过，production 包体 4,579,789 字节、Worklet 2/2、Manifest `30a26638…9cb9b`。保留既有主包和矩阵节点内部预警。
- 证据层级为静态检查和 Node/Mini 构建自动化；未控制微信开发者工具，未上传体验版，未取得小米14原生验收。

## 交付边界

检查点消息：`fix(miniprogram): reset generated export after selection changes`。Mini-only 修改不触发生产部署、数据库备份或服务端 release 同步；体验版上传需另行授权。
