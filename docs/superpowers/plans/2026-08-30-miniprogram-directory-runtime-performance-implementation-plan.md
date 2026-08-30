# 小程序通讯录修复与性能优化实施计划

- 依据：[`../specs/2026-08-30-miniprogram-directory-runtime-performance-design.md`](../specs/2026-08-30-miniprogram-directory-runtime-performance-design.md)
- 范围：小程序通讯录组件、结果卡、工作台上下文传递及相邻纯逻辑测试模块。
- 非范围：服务端 API、数据库、公共 contracts、Web 生产组件、小程序体验上传/审核/正式发布。

## Task 1：基线、引入点与设计检查点

1. 在 ignored `runtime/audit/directory-fix-20260830/` 固定 Git、脏树、构建/测试/包体和 setData/request fixture 基线。
2. 对 `syncFilterSections`、`handleOpenFilters` 执行 `git log -S` 和 `git blame`，记录引入提交。
3. 落盘本设计与计划，更新项目和审计状态。
4. 复核文档格式、未决标记、状态一致性和 Git diff；只暂存本任务文档。
5. 提交、推送，备份生产数据库并发布文档 checkpoint，执行完整生产验证。

停止条件：生产 release 与文档 checkpoint SHA 一致，业务代码尚未修改。

## Task 2：先红的查询与请求回归

1. 新增相邻纯逻辑查询模块测试：稳定序列化、特殊字符、不透明游标、七级空位、`unset/all/value`、第一页/后续页。
2. 扩展 controller 测试：重复确认、同页进行中共享、多页后重复确认、翻页双击、刷新、失败释放、晚响应、跨模式/群组/权限、卸载。
3. 扩展 UI/native 测试：加载中筛选禁用、facets 分模式失败、零层级、非空弹层、关闭释放、滚动时序/目标、过渡卡禁用和分页错误。
4. 在旧实现运行并保存预期失败证据，不通过修改断言掩盖问题。

停止条件：失败与设计缺口一一对应，现有无关测试保持通过。

## Task 3：查询键与运行态实现

1. 实现规范化七级筛选和稳定 JSON 元组 `contextKey/baseQueryKey/pageRequestKey`。
2. 将完整 facets、原始结果、分页和请求表迁入每模式逻辑运行态；页面 data 收敛为当前视图最小状态。
3. 实现单完成主查询、同页 Promise 共享、强制刷新代次、`finally` 精确释放及实例/上下文/查询三重竞态校验。
4. 实现账号/群组/权限/版本变化和 401/403 的双模式清除；未知权限或版本时禁用完成复用。
5. 工作台传递真实角色、管理员标志、群组版本和上下文刷新序号；独立页保持服务端鉴权请求。

停止条件：Task 2 请求/查询测试全绿，未改变 API/contracts/database。

## Task 4：视图、弹层和滚动实现

1. 用轻量导览替换完整 `filterSections` 常驻；只为唯一活动弹层构建选项。
2. 加入 facets 骨架、禁用/重试、零层级提示，确保任何可打开弹层非空。
3. 对齐 Web 的模式切换、导览、搜索框、结果/空/错/分页状态；保持小程序 chrome。
4. 关闭释放选项；按模式和 facets 批次保存滚动，节点挂载后恢复/定位并夹紧。
5. 新查询过渡卡禁用副作用；分页失败保留旧页并支持重试/从头刷新。

停止条件：Task 2 UI/native 测试全绿，WXML 不长期持有隐藏模式树或两套卡片。

## Task 5：性能与完整验证

1. 在同一 fixture 复测 setData、开弹层、重复请求和关闭释放；检查 70%/零请求硬门槛和耗时波动。
2. 运行定向 P10、Mini 全量、typecheck、production build、verify/source/performance/package/determinism、CI dry-run、任务格式/lint 和 `pnpm smoke:check-core`。
3. 运行现有 Web Storybook/黄金测试；不改 Web 生产组件。原生 Console/Network/小米 14 无证据项标为未验证。
4. 更新 audit 报告、audit STATUS、project-status 和调试日志，记录行为变化、剩余跨发布风险和唯一下一任务。

停止条件：自动门禁通过，或把任何相关失败记录为 blocker，禁止以测试失败状态提交。

## Task 6：代码检查点、生产与体验候选门禁

1. 逐行复核 diff，只暂存本任务路径；提交单一代码 checkpoint 并推送 `origin/main`。
2. 从 exact clean commit 打包；备份生产数据库，只同步代码/迁移（本轮无迁移），部署并执行完整生产 verifier。
3. 报告备份标识、release SHA、验证结果、脏树和未验证项。
4. 在体验版上传前报告短 SHA、版本描述、脏树和测试页面，取得用户当次明确批准；未批准则停止在生产部署完成状态。

停止条件：生产 checkpoint 可验证；小米 14 仍为待匹配体验版实测，不宣称真机通过。
