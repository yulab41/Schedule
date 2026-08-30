# 微信小程序审计报告

- 审计阶段：阶段 0（规则落盘与修改前基线）
- 采集时间：2026-08-30（Asia/Hong_Kong）
- 分支/提交：`main@59b1f3c5`，与 `origin/main` 一致
- 构建标签：`production / local@59b1f3c`
- 基线性质：当前工作树基线，不是 clean-commit release 基线

## 普通用户版结论

简单来说：小程序目前可以完成项目自己的构建、类型检查和 517 项自动测试，包体也没有超过阻断线；
但主包已经进入预警区，代码规范检查还有 1 个明确错误，而且本轮按仓库规则不能读取微信开发者工具
Console 或替代小米 14 真机检查。因此当前只能说“自动化基础可用”，不能说“手机体验已验收通过”。

本轮只建立规则和基线，没有修改业务代码、没有修复问题、没有新建测试工具页，也没有上传体验版。

## 1. 基线边界与工作树

采集开始时 `HEAD=59b1f3c5`，工作台无外层滑动宿主修复已在 `fe12db53` 提交并完成既有发布流程。
以下内容是开始前已存在的用户未提交内容，本轮未覆盖、未暂存、未修复：

- `apps/miniprogram/project.config.json`
- `apps/miniprogram/scripts/group-settings-page.test.mjs`
- `apps/miniprogram/src/subpackages/organization/components/group-settings-panel/index.wxml`
- `.agents/`、Web UI2 草稿、根 `src/`、`runtime/`、工作簿等既有未跟踪内容

因此本报告的包体和自动测试反映“当前工作树”。正式发布比较必须再从指定 clean commit 重测。
阶段 0 的构建只刷新 ignored 的 `apps/miniprogram/dist/`，没有改业务源码。

## 2. 实际读取的 Skill 与可用执行面

### 已成功读取

- `miniprogram-development` 2.32.4：小程序结构、构建、调试/预览和 CloudBase 路由规则。
- `wechatide-skill` 0.3.9：开发者工具能力路由与真实性要求。
- `initializer`、`compiler`、`debugger`：环境、编译和 Console/Network 取证边界。
- `brainstorming`：用于确认本轮只落阶段 0 文档；用户已给出完整、明确且批准的总规范，未扩展功能设计。

当前环境还列出了 `automator`、`previewer`、`project-config`、`cloudbase-operator`、
`cloudbase-platform` 等相关 Skills。本项目未使用 CloudBase，本阶段也不做自动化、预览、上传或配置修改，
所以没有加载或调用这些执行场景。

### 微信开发者工具和 MCP

- PATH 中可发现 `wechatide.cmd`，但没有执行它，也没有把“命令存在”写成“工具已就绪”。
- 当前会话没有暴露可直接调用的微信小程序/CloudBase MCP 工具。
- `apps/miniprogram/AGENTS.md` 明令 LLM 不得控制微信开发者工具 GUI/CLI，这比通用 Skill 更严格；
  所以本轮未运行 `check_wechatide_status`、模拟器、Console、Network、截图、预览或上传。
- 允许且已实际使用的是仓库 Node/TypeScript/Vitest/esbuild/包体脚本。

### 工具限制导致的未验证项

开发者工具编译、Console error/warning、Network、页面启动/切换、真实请求数、白屏、软键盘、原生
Skyline 布局和小米 14 体验版均为：“当前工具无法测量，暂未验证”。

## 3. 技术栈与工程结构

| 项目       | 当前事实                                                              | 证据                                      |
| ---------- | --------------------------------------------------------------------- | ----------------------------------------- |
| 技术栈     | 原生微信小程序；TypeScript、WXML、WXSS、JSON、WXS                     | `apps/miniprogram/package.json`、`src/`   |
| 小程序目录 | `apps/miniprogram`                                                    | `project.config.json`                     |
| 源码目录   | `apps/miniprogram/src/`                                               | `scripts/build-tools.mjs`                 |
| 构建目录   | ignored 的 `apps/miniprogram/dist/`                                   | `miniprogramRoot: "dist/"`                |
| 构建器     | esbuild，CJS/ES2020、压缩、tree-shake；另跑 `tsc --noEmit`            | `scripts/build-tools.mjs`                 |
| renderer   | 全局 Skyline，`disableABTest: true`，范围 3.3.0–15.255.255            | `src/app.json`                            |
| 组件框架   | `glass-easel`                                                         | `src/app.json`                            |
| WebView    | 无 fallback                                                           | `src/app.json`、小程序架构文档            |
| 懒加载     | `requiredComponents`                                                  | `src/app.json`                            |
| 导航栏     | 全局 `navigationStyle: "custom"`                                      | `src/app.json`                            |
| tabBar     | 无原生 `app.json.tabBar`；工作台自绘五入口                            | `pages/workbench/index.wxml`              |
| 后端       | 自建 Fastify + MySQL + Drizzle + Zod API                              | 根 README、`apps/api/package.json`        |
| 云开发     | 未发现 `wx.cloud`、`cloudfunctionsRoot` 或 CloudBase envId            | 小程序源码/配置搜索                       |
| 状态       | App `globalData` + Page/Component data + controller；无 Pinia/Redux   | `src/app.ts`、页面 controller             |
| 请求       | 统一 `wx.request`/`wx.downloadFile`；Bearer、401 恢复、幂等和有限重试 | `src/platform/`                           |
| 缓存       | 私有 storage；会话、群组/月度工作台缓存；24h 只读缓存，无离线写队列   | `private-storage.ts`、`workbench-read.ts` |

当前本地 `project.config.json`/私有配置显示基础库 3.17.1，但该 `project.config.json` 含用户未提交变化；
该值只代表本机当前设置，不能冒充 clean Git 基线或实体微信客户端实际基础库。

## 4. 主包、分包与页面

主包 9 页，`app.json.pages` 首项 `pages/identity/index` 是默认启动页：

- identity、profile、workbench、index
- calendar PoC、manual-matrix PoC、gesture probe
- identity/unbind、admin-bind/preview

四个普通分包共 15 页，均未设置 `independent`，因此没有独立分包：

| 分包                       | 页面                                                                            |
| -------------------------- | ------------------------------------------------------------------------------- |
| `subpackages/scheduling`   | manual、backfill                                                                |
| `subpackages/organization` | group-settings、scheduling-config、invite-visitor、platform-accounts、directory |
| `subpackages/workflows`    | leave、swap、duty                                                               |
| `subpackages/insights`     | visitor-access、insights、notifications、exports、notification-settings         |

## 5. 修改前编译、错误和警告基线

| 检查                     | 结果         | 耗时/数量                                     | 说明                                                                                                |
| ------------------------ | ------------ | --------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `pnpm miniprogram:build` | 通过         | 2.60s；268 files                              | production 静态构建；esbuild 配置为 silent，命令未输出 error/warning，但不能推断 DevTools Console=0 |
| Mini TypeScript          | 通过         | 3.57s；0 error                                | `pnpm --filter @schedule/miniprogram typecheck`                                                     |
| Mini 自动测试            | 通过         | Vitest 80.11s；107 files/517 tests；0 failure | `pnpm miniprogram:test`                                                                             |
| Mini 完整静态验证        | 通过并有预警 | 7.10s；3 个预警                               | `pnpm miniprogram:verify`                                                                           |
| 根 workspace TypeScript  | 通过         | 19.48s；10 projects                           | `pnpm typecheck`                                                                                    |
| ESLint                   | 未通过       | 约 30.0s；1 error/0 warning                   | `wx-request-executor.ts:141:9` 的 `prefer-const`；阶段 0 未修复                                     |
| Prettier format check    | 未通过       | 16.30s；387 files                             | 既有全仓格式差异；未运行写格式化                                                                    |
| DevTools Console         | 暂未验证     | error/warning 均无数据                        | 仓库禁止代理调用开发者工具 GUI/CLI                                                                  |

Mini 静态验证的 3 个预警：

1. 主包超过内部 1.5 MiB 预警线，但未到 1.8 MiB 阻断线或官方 2 MiB 硬限制。
2. manual-matrix PoC 展开宿主 1,445 nodes，目标 `<1000`。
3. `subpackages/scheduling/pages/manual` 展开宿主 1,506 nodes，目标 `<1000`；600 个逻辑格场景目前按 best-effort 记录。

验证还确认 Worklet source/output 为 2/2，构建确定性 manifest 为
`9fb6e50e376c19305618790f9ea9055cdf6bc541ed89c8e5cd66a5d9986003f4`。桌面逻辑测得
matrix ViewModel 171,340 bytes、构建 0.49ms、tap 0.23ms；这些只代表桌面逻辑计时，不能当作小米 14
渲染或点击性能。

## 6. 包体积基线

命令：`pnpm miniprogram:package-audit`，exit 0，1.42s。

| 范围         |     bytes | MiB（约） | 门禁状态         |
| ------------ | --------: | --------: | ---------------- |
| 主包         | 1,636,609 |     1.561 | 内部预警；未阻断 |
| scheduling   |   420,884 |     0.401 | 通过             |
| organization | 1,171,597 |     1.117 | 通过             |
| workflows    |   821,914 |     0.784 | 通过             |
| insights     | 1,056,800 |     1.008 | 通过             |
| 总包         | 5,107,804 |     4.871 | 通过             |

按扩展名聚合：JS 4,356,322 bytes（67 个）、WXML 343,219（55）、WXSS 314,588（58）、JSON
60,159（59）、WXS 26,298（4）、SVG 7,218（26）；产物中没有 PNG/JPG/font 文件。

### 最大的 20 个构建文件

|   # | `dist/` 相对路径                                                |   bytes |
| --: | --------------------------------------------------------------- | ------: |
|   1 | `pages/workbench/index.js`                                      | 201,817 |
|   2 | `subpackages/scheduling/pages/manual/index.js`                  | 185,201 |
|   3 | `subpackages/organization/pages/group-settings/index.js`        | 184,669 |
|   4 | `subpackages/workflows/pages/swap/index.js`                     | 179,511 |
|   5 | `subpackages/workflows/components/workflow-swap-panel/index.js` | 179,152 |
|   6 | `subpackages/workflows/pages/duty/index.js`                     | 176,165 |
|   7 | `subpackages/workflows/pages/leave/index.js`                    | 175,637 |
|   8 | `components/profile-workspace/index.js`                         | 173,568 |
|   9 | `pages/profile/index.js`                                        | 171,325 |
|  10 | `subpackages/organization/pages/directory/index.js`             | 169,054 |
|  11 | `subpackages/organization/components/directory-panel/index.js`  | 168,738 |
|  12 | `subpackages/organization/pages/scheduling-config/index.js`     | 168,138 |
|  13 | `subpackages/scheduling/pages/backfill/index.js`                | 166,207 |
|  14 | `subpackages/insights/pages/notification-settings/index.js`     | 165,159 |
|  15 | `subpackages/insights/pages/notifications/index.js`             | 165,156 |
|  16 | `subpackages/insights/components/notifications-panel/index.js`  | 164,840 |
|  17 | `subpackages/insights/pages/insights/index.js`                  | 161,285 |
|  18 | `subpackages/insights/pages/exports/index.js`                   | 159,470 |
|  19 | `subpackages/organization/pages/invite-visitor/index.js`        | 158,830 |
|  20 | `subpackages/organization/pages/platform-accounts/index.js`     | 155,505 |

精确内容重复扫描只发现很小的 JSON/WXML/WXSS 组，最大单组可节省 1,056 bytes；未发现完全相同的
大型 JS 或图片重复。esbuild metafile 中累计输入贡献最大的是生成的 `calendar-schemas.ts`，跨多个入口
合计 2,579,338 bytesInOutput；这是跨入口重复打包贡献指标，不是一个实际物理文件的大小。是否优化需在
后续专项审计中结合依赖图证明，本阶段不下结论、不修改。

## 7. 测试与验收方式

- Vitest：Mini 唯一全量入口 `vitest run --dir scripts --fileParallelism=false`。
- `miniprogram-simulate`：组件树、props、events、state；不能证明原生视觉或手感。
- `tsc --noEmit`、WXML/WXSS/JSON/source/output、Worklet、页面边界、handler、确定性、包体和静态性能门禁。
- PNG + mask 自有视觉比较器；只有真实截图时才有验收意义。
- 未采用 Minium 或 MiniTest。
- 微信开发者工具由用户人工操作；小米 14 体验版是主真机标准。

## 8. 当前尚未建立的问题清单

阶段 0 只记录基线，不执行完整静态审计，因此尚未把发现扩展为 P0～P3 问题清单。已知的 lint error、
格式检查失败、主包预警和两个节点数预警保留为下一阶段输入，不在本轮修复，也不据此推断用户实际卡顿。

启动、首页、关键页面、网络竞态、生命周期和交互体验都需要后续按范围取证；拿不到数据时继续标记
“当前工具无法测量，暂未验证”。

## 9. 本轮变更边界

- 已创建审计总规范、阶段状态、本报告和小米 14 协议。
- 已把长期规则加入根 `AGENTS.md`。
- 未修改 `apps/miniprogram/src/`、API、数据库、路由、视觉、测试或用户配置。
- 未创建“更多 → 测试工具”。
- 未修复 lint/format/包体或任何审计问题。
- 未调用微信开发者工具、未预览、未上传体验版、未提交审核、未正式发布。

后续唯一建议任务见 `docs/audit/STATUS.md`。
