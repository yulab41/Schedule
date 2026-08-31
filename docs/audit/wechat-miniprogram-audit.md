# 微信小程序审计报告

- 审计阶段：通讯录半屏筛选与性能诊断阶段 A 已推送并同步 production，等待体验上传批准
- 更新时间：2026-08-31（Asia/Hong_Kong）
- 代码 checkpoint：`7952f1d106c65a5c3b8815ee0dc52756252f381a`，已推送并同步 production release
- 体验构建：`0.1.0-p10.20260831.71@7952f1d`，189 files / 2,449,336 bytes
- 本批性质：修改前后包体来自同一用户工作树；正式构建、部署与上传来自 exact clean commit

## 普通用户版结论

简单来说：“更多”里已经有一套给普通用户看的安全测试工具，可以核对版本、手机与安全区，勾选显示
问题，查看脱敏的少量网络/错误/性能摘要，并一次复制给 Codex。正式版入口、直接路径和旧手势探针都
会关闭，正式版也不会创建诊断仓库；诊断不保存、不上传、不读取请求正文或用户资料。

构建、类型、exact-clean 554 项 Mini 测试、1,139 项根测试和安全/包体门禁已经通过，包体没有触发
新阻断。体验版 `.71@7952f1d` 已上传并通过生产客户端白名单；仓库规则禁止代理操作微信开发者工具，
所以当前仍只能说“自动验证和体验上传完成”，不能说“小米 14 已验收”或“Console 没有错误”。

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

- `miniprogram-development`：小程序结构、构建、调试/预览和发布边界。
- `previewer`：体验上传前置、结果真实性与失败处理边界；执行面由仓库规则收敛为 Node
  `miniprogram-ci`，没有调用其微信开发者工具路径。
- `wechatide-skill`、`initializer`、`compiler`、`debugger`：此前用于确认环境、编译和
  Console/Network 取证边界；仓库政策继续禁止调用执行面。

当前环境还列出了 `automator`、`project-config`、`cloudbase-operator`、`cloudbase-platform` 等相关
Skills。本项目未使用 CloudBase，也没有自动化微信开发者工具或修改公众平台配置；本轮只加载
`previewer` 的发布规则，并通过仓库 Node `miniprogram-ci` 完成已批准的体验上传。

测试工具批次新增实际读取：`brainstorming`（确认安全方案与影响）、`miniprogram-development` 及变更
安全/调试参考、`frontend-design`（设备体检单视觉方向）、`systematic-debugging`（定位 Storybook
隐藏控件、favicon 404 与状态行数门禁）和 `previewer`（上传授权与失败边界）；体验上传执行面按仓库
规则收敛为 Node `miniprogram-ci`。

### 微信开发者工具和 MCP

- PATH 中可发现 `wechatide.cmd`，但没有执行它，也没有把“命令存在”写成“工具已就绪”。
- 当前会话没有暴露可直接调用的微信小程序/CloudBase MCP 工具。
- `apps/miniprogram/AGENTS.md` 明令 LLM 不得控制微信开发者工具 GUI/CLI，这比通用 Skill 更严格；
  所以本轮未运行 `check_wechatide_status`、模拟器、Console、Network、截图或微信工具上传。
- 允许且已实际使用的是仓库 Node/TypeScript/Vitest/esbuild/包体脚本和 Node `miniprogram-ci` 上传。

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

五个普通分包共 16 页，均未设置 `independent`，因此没有独立分包：

| 分包                       | 页面                                                                            |
| -------------------------- | ------------------------------------------------------------------------------- |
| `subpackages/scheduling`   | manual、backfill                                                                |
| `subpackages/organization` | group-settings、scheduling-config、invite-visitor、platform-accounts、directory |
| `subpackages/workflows`    | leave、swap、duty                                                               |
| `subpackages/insights`     | visitor-access、insights、notifications、exports、notification-settings         |
| `subpackages/diagnostics`  | test-tools（develop/trial；release 失败关闭）                                   |

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

## 8. 当前问题清单

### MINI-DIR-001（P1）：筛选可在 facets 未就绪时打开为空，完整选项树长期进入视图状态

- 普通解释：用户点筛选会看到没有任何内容的弹层；数据加载完成后，页面又会把科室和人员两套完整筛选树长期留在视图层，增加传输和渲染负担。
- 技术原因：`handleOpenFilters` 没有 facets 就绪门禁；`syncFilterSections` 在双模式加载后立即生成完整 options 并写入 page data，关闭弹层不释放。
- 位置：`apps/miniprogram/src/subpackages/organization/components/directory-panel/controller.ts`、`index.wxml`。
- 证据：`git log -S`/`git blame` 指向 `1de042b5`/`6b5b30fb`；固定 fixture 初始 `setData` 13,386 B、最大 5,495 B，开弹层 5,560 B，关闭后驻留 72 选项，重复确认新增 1 请求。
- 影响：筛选主流程不可用；双模式完整树和重复请求可能放大低端/繁忙设备卡顿，但真实帧率当前无法测量。
- 修复建议：按已批准的通讯录专项设计拆分逻辑/视图状态、查询键和活动弹层，先红测试后实现。
- 风险：中等；涉及异步竞态、分页复用、滚动恢复和权限上下文，禁止无测试的大范围重构。
- 置信度：高。
- 状态：已实现、自动验证并同步 production release；待小米 14 匹配体验版验证。
- 验证：定向/全量自动测试、固定性能 fixture、Web Storybook 黄金；小米 14 匹配体验版仍需人工验收。

修复后固定 fixture 初始 `setData` 为 6 次/4,053 B、最大 1,206 B，分别是旧版 30.3%/21.9%；
关闭驻留选项和重复确认请求均为 0。首次打开中位数 0.31 ms（旧版 0.30 ms），主体建立 1.49 ms
（旧版 2.61 ms）。Mini 全量 108 files/539 tests、Web 通讯录黄金 10 files/51 tests 通过；原生
Console/Network/帧率与小米 14 仍无当前构建证据，不能据此宣称真机通过。

### MINI-DIR-002（P1）：拨号返回清空结果、筛选头部不可固定且工号数字尾部不可检索

- 普通解释：筛选弹层只能点按钮关闭，清除入口会被滚走；拨号返回后搜索视图消失；完整工号可搜，省略字母前缀或前导零不可搜。
- 技术原因：顶部横条没有手势，清除节点位于 `scroll-view`；`c2a57441` 把每次前台刷新序号纳入通讯录上下文签名，无真实上下文变化也重置运行态；纯数字搜索分支只查电话。
- 位置：Mini `directory-panel` 的 `index.wxml/index.wxss/controller.ts/filter-sheet-drag.wxs`，API `directory-query.ts`，导入 `directory-import-core.ts`。
- 证据：旧实现新增 Mini 场景 5 红、导入 1 红、API 2 红；生产发布批次只读验证 `D0468/d0468/0468/468` 均命中目标各 1 条。
- 影响：拨号主流程丢失用户上下文；长筛选列表清除入口不可达；员工按常用数字尾号检索失败。
- 修复：专用横条 WXS 下拉/回弹且与完成共用关闭路径，固定标题和清除区；前台只后台复核 facets，版本未变零视图写入；用现有工号列/alias 索引支持 3 位以上数字尾部。
- 风险：中等；涉及原生手势、前台生命周期和数字查询排序，但没有新增 API/contracts/迁移，权限、批次、稳定排序和游标条件不变。
- 置信度：高。
- 状态：代码 `7952f1d1` 已推送并完成生产备份/部署；`.71@7952f1d` 已上传并通过 allowlist/full verifier，小米 14 待验证。
- 验证：exact-clean Mini 110 files/554 tests、root 244 files/1,139 tests；MySQL 集成因本机数据库不可用跳过。数据库查询路径中位数 50.12→48.36ms（-3.5%），P95 62.17→57.34ms；端到端 HTTP、原生动画和小米 14 当前工具无法测量。

### MINI-DIR-003（P1）：筛选接近全屏，首次搜索缺少可复制的端到端分段证据

- 普通解释：筛选弹层太高，不利于单手操作；人员第一次搜索慢，但原先只能看到“慢”，不能判断时间花在请求前、网络、服务端、转换还是显示。
- 技术原因：`6b5b30fb` 引入 `92vh/840px` 的近全屏 Sheet；搜索链路只有通用请求摘要，没有搜索确认、上下文等待、卡片、`setData` 回调和下一渲染周期的关联记录。代码审计另确认 controller 在调用已受保护的 transport 前重复等待一次 `organization` capability。
- 位置：Mini `directory-panel` 的 `controller.ts/index.wxml/index.wxss/search-diagnostics.ts`，平台 `client-core-calendar.ts/wx-request-executor.ts/runtime-diagnostics*.ts`，测试工具页与对应 Web 辅助黄金。
- 证据：修改前 production 包 5,213,637 B；筛选 CSS 固定为 `92vh`、最大 840px。代码确认无筛选纯关键词搜索不等待完整 facets，进行中请求和已完成同查询已有会话复用；服务端、真机网络和渲染占比当前无证据。
- 影响：筛选单手体验不佳；没有阶段证据时，任何搜索链路大改、服务端预热或索引修改都有误判风险。
- 修复：按真实 `windowHeight/screenHeight/safeArea` 计算约半屏高度并监听横竖屏变化；保留横条、固定头部/清除、单一滚动区和滚动恢复。测试工具新增默认停止、最多 20 条、可复制 1/10 次的隐私安全诊断；profile 仅在记录中开启。只删除 controller 的一层明确重复能力等待，transport/executor 门禁保留。
- 风险：低到中；诊断只写 App 内存，不改变 API/contracts/数据库/索引/搜索排序/筛选语义。请求 profile 和额外计时在停止记录时关闭。
- 置信度：半屏与诊断实现高；首次搜索瓶颈低，必须等小米 14 数据。
- 状态：代码 `73811f1f` 已推送；备份 `92af6f22-1d9e-47a2-b78d-e1de255c4fd2` 后可信无停机同步 production，公网 full verifier 通过；待用户批准体验上传，阶段 B 未开始。
- 验证：Mini 110 files/561 tests；production verify/source/package/performance/determinism/CI dry-run、全端 build/typecheck、Web 辅助黄金和 core smoke 通过。最终包 5,273,141 B，较同口径基线增加 59,504 B；原生手感、端到端阶段数字和性能变化均为“待小米 14 体验版实测”。

### 阶段 0 保留输入

阶段 0 只记录基线，不执行完整静态审计，因此尚未把发现扩展为 P0～P3 问题清单。已知的 lint error、
格式检查失败、主包预警和两个节点数预警保留为下一阶段输入，不在本轮修复，也不据此推断用户实际卡顿。

启动、首页、关键页面、网络竞态、生命周期和交互体验都需要后续按范围取证；拿不到数据时继续标记
“当前工具无法测量，暂未验证”。

## 9. 本轮变更边界

- 新增测试工具分包、构建元数据、环境门禁、只读内存摘要、报告生成、环境矩阵回归与 Web 辅助黄金。
- 旧手势探针未删除；从测试工具“交互检查”进入，同时给旧直达路径增加 release 失败关闭。
- 统一请求函数只增加异常吞掉的摘要调用；重试条件/次数、认证恢复、Header/body、返回、异常和时序不变。
- 既有 App 错误/Promise 错误入口只在 develop/trial 把固定码和 SHA-256 指纹写入有界内存；未新增监听。
- 未新增依赖，未修改 API、contracts、数据库、权限、认证、业务 `setData` 或无关业务页面。
- 未处理既有全仓 lint/format；未调用微信开发者工具；本批体验版已上传，但未提审、未正式发布。
- 实现 checkpoint `18498a8b` 以显式路径提交并推送；既有无关用户内容保持排除。
- 生产备份 `68902f0f-a5eb-4a56-963a-e78829862086` 后按哈希可信复用同步同一 release；完整 verifier 通过。
- `.70` 已原子追加客户端白名单；预热一次 TLS EOF/一次 502 自动恢复，随后 allowlist verify、未知版本 426、七维能力和公网完整 verifier 通过。

## 10. 测试工具批次证据

### 10.1 环境、安全与运行时边界

`git log -S` 和 `git blame` 确认 `712aa4ee` 在 2026-08-28 引入写死的
`testCenterEnabled: true` 和直达旧手势探针。新回归对旧 HEAD 明确红灯，当前环境矩阵如下：

| 环境    | “更多”入口 | 直接测试工具页 | 旧手势探针 | App 诊断仓库 |
| ------- | ---------- | -------------- | ---------- | ------------ |
| develop | 显示       | 允许           | 允许       | 创建         |
| trial   | 显示       | 允许           | 允许       | 创建         |
| release | 隐藏       | 返回工作台     | 返回工作台 | 不创建       |

请求摘要最多 20 条、错误 10 条、性能 12 条，只在 App 内存中存在。没有新增
`onNetworkStatusChange`、`onMemoryWarning` 或其他监听，没有 monkey patch `wx.request`/`setData`。
请求函数继续按原条件执行 capability、401 恢复、GET/幂等写重试、状态返回和异常传播；现有
`wx-json-transport`、遥测、工作台和全量回归保持通过。

诊断分包产物经过额外敏感模式扫描：未发现 Bearer、Authorization 赋值、Cookie/openid/session_key
赋值、11 位手机号、UUID 或凭证模式。页面不读取 storage value；报告仅使用固定构建字段、设备/屏幕、
脱敏路由、耗时/状态、错误指纹和用户结构化勾选。

### 10.2 修改前后包体

同一用户工作树、production profile、同一包体脚本结果：

| 范围         | 修改前 bytes | 修改后 bytes | 变化 bytes | 结果                          |
| ------------ | -----------: | -----------: | ---------: | ----------------------------- |
| 主包         |    1,637,688 |    1,658,098 |    +20,410 | 保留既有 1.5 MiB 预警，未阻断 |
| scheduling   |      420,884 |      422,480 |     +1,596 | 通过                          |
| organization |    1,197,103 |    1,201,891 |     +4,788 | 通过                          |
| workflows    |      821,914 |      825,106 |     +3,192 | 通过                          |
| insights     |    1,056,800 |    1,061,589 |     +4,789 | 通过                          |
| diagnostics  |            0 |       35,710 |    +35,710 | 新增非首屏普通分包            |
| 总包         |    5,134,389 |    5,204,874 |    +70,485 | 通过                          |

主包只保留环境门禁、App 有界仓库和极小调用桥；报告格式化、设备卡片和交互清单在 diagnostics
分包。没有把旧手势探针迁移或复制进新分包，因此避免重复其 Worklet/WXS 产物。
最终上传追踪标签写入后的 clean dist 为 main 1,658,565、scheduling 422,516、organization
1,201,939、workflows 825,178、insights 1,061,697、diagnostics 35,728、total 5,205,623 B；
相对同口径复测多出的 749 B 仅是版本、提交和上传说明元数据。

### 10.3 自动验证与视觉辅助

| 检查                                                          | 结果                                                                |
| ------------------------------------------------------------- | ------------------------------------------------------------------- |
| 定向安全/环境/请求/工作台/手势/构建                           | 8 files / 65 tests 通过                                             |
| Mini 全量                                                     | 109 files / 548 tests 通过                                          |
| 根测试                                                        | 243 files / 1,137 tests 通过；37 files / 355 tests 无数据库环境跳过 |
| 全端 typecheck/build                                          | 通过                                                                |
| Mini verify/source/performance/package/determinism/CI dry-run | 通过；clean 2/2 Worklet；总包 5,204,815 B                           |
| Storybook build 与黄金回归                                    | 通过；390/320/大字号无横向溢出，页面内按钮均 ≥44px                  |
| 任务 ESLint/Prettier                                          | 通过；既有 `prefer-const` 按用户要求不修改                          |
| `pnpm smoke:check-core`                                       | 通过；未涉及 Web 核心链路                                           |

390/320/大字号截图保存在 ignored `runtime/audit/test-tools-golden/`。首次视觉脚本误把 Storybook
注入的 0px 隐藏控件当成页面按钮，并记录 Storybook 外壳 `/favicon.ico` 404；限定到页面根节点并保留
favicon 证据后复测，实际页面 6 个按钮均 ≥44px、页面错误为 0。该黄金只能证明 Web 辅助布局与文案，
不能证明 WXML/WXSS、Skyline、微信客户端或小米 14 真机表现。

### 10.4 未验证与人工证据

仓库政策禁止代理调用微信开发者工具，因此 DevTools 编译、Console/Network 和原生页面截图仍是
“当前工具无法测量，暂未验证”。`.70@18498a8` 已上传，但只有用户在小米 14 提供匹配版本的
版本/设备/安全区/显示/交互证据后，才可把本批状态更新为实体 Android 验收通过。

后续唯一建议任务见 `docs/audit/STATUS.md`。
