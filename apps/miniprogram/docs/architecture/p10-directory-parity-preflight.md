# P10 院内通讯录对等预研台账

状态：只读预研，未进入 Mini 页面实现、共享契约接线或生产能力变更。

隔离基线：`codex/p10-parity-preflight`，worktree `E:\AItools\Schedule-p10-preflight`，基线 `22049266`。

## 目标与硬边界

本台账只把现有 Web/API 的院内通讯录能力整理成可供 P10 继续实现的输入：接口矩阵、权限和错误矩阵、状态/视觉 fixture 入口、号码隐私规则和待决依赖。

本轮明确不修改：

- `packages/contracts`、`@schedule/client-core`、API 路由、数据库迁移或生产数据；
- `client-capability-guard`、小程序 `app.json`、工作台导航、底栏和任何 P9 `insights` 能力；
- Web 生产页面、Web 路由和现有 Storybook 黄金；
- 真实姓名、真实手机号、visitor key、token、二维码或可回溯业务数据。

## 权威基线与引入点

| 领域               | 权威文件                                                                             | 引入点                             |
| ------------------ | ------------------------------------------------------------------------------------ | ---------------------------------- |
| API 只读路由与搜索 | `apps/api/src/modules/directory/directory-routes.ts`、`directory-query.ts`           | `e74e5f35`                         |
| API 权限           | `apps/api/src/modules/groups/permission-service.ts`                                  | `e74e5f35`                         |
| Web API 接线       | `apps/web/src/api/client.ts`                                                         | `8309dce1`、`9bc49224`、`54379957` |
| Web 生产界面       | `apps/web/src/views/directory/InternalDirectoryView.vue`、`UnifiedDirectoryView.vue` | `8309dce1`、`34fbaeaa`             |
| 展示/号码规则      | `apps/web/src/features/directory/*`                                                  | `8309dce1`、`54379957`             |
| Web 入口           | `apps/web/src/views/HomeView.vue`、`features/layout/workbench-nav.ts`                | `8309dce1`                         |
| Mini 同步边界      | `apps/miniprogram/docs/architecture/web-sync-policy.md`                              | P10 backlog                        |

上述调用点已通过 `git log -S`/`git blame` 复核。后续若改动同一调用点，必须重新执行逐调用点语义审计。

## API 与权限矩阵

| 能力               | HTTP                                              | 认证            | 返回/副作用                              | P10 Mini 目标                     |
| ------------------ | ------------------------------------------------- | --------------- | ---------------------------------------- | --------------------------------- |
| 内部通讯录 facets  | `GET /groups/:groupId/directory/facets`           | Bearer 正式成员 | `DirectoryFacetSnapshot`；只读           | 共享 decoder 与内存态 facets      |
| 内部通讯录分页搜索 | `GET /groups/:groupId/directory`                  | Bearer 正式成员 | `DirectoryPage`；只读；默认 30、最多 100 | 输入防抖、首屏查询、稳定游标加载  |
| 内部通讯录收藏恢复 | `POST /groups/:groupId/directory/lookup`          | Bearer 正式成员 | 最多 100 个 entry，仍按可见性过滤        | 收藏/常用只按 ID 恢复，不绕过权限 |
| 员工通讯录 facets  | `GET /groups/:groupId/employee-directory/facets`  | Bearer 正式成员 | 同 `DirectoryFacetSnapshot`              | 与科室模式共用页面状态机          |
| 员工通讯录分页搜索 | `GET /groups/:groupId/employee-directory`         | Bearer 正式成员 | 同 `DirectoryPage`                       | 支持姓名、工号、拼音/首字母、号码 |
| 员工通讯录收藏恢复 | `POST /groups/:groupId/employee-directory/lookup` | Bearer 正式成员 | 同 lookup 语义                           | 不新增员工数据写入                |

角色门禁：active `owner`、`administrator`、`member` 和 developer admin 可读；`member` 只能看到 `visibility=member`；owner/administrator/developer 可见 administrator 条目。guest、非本群成员、匿名和 visitor key 不得通过通讯录接口。

已由 API 集成测试锁定的拒绝结果：guest/非本群成员 `403`，匿名 `401`，伪造 visitor 路径 `404`，非法 cursor/lookup body `400`，无 published snapshot `404`。这些是 Mini 失败关闭和页面状态 fixture 的输入，不是前端自行推导的权限。

## 查询、排序与分页不变量

- 数字查询：完整号码或短号精确命中优先，其次号码前缀；短号只接受 3–6 位。
- 文本查询：employee code 精确/前缀、原文/别名精确、原文/拼音前缀、包含和 MySQL ngram/full-text 相关度。
- 查询可以独立选择院区、片区、楼宇、楼层、科室、单元、条目类型；不要求先选父级。
- 排序必须保留服务端结果；带查询时按 rank，再按院区顺序、条目顺序、UUID 稳定排序。
- `nextCursor` 只用于继续同一查询；更换搜索词、模式或任一筛选必须丢弃旧 cursor 并从第一页重新读。
- Mini 不能把 idle 状态当作“加载全部通讯录”；无搜索/筛选时只展示空闲态、收藏/常用恢复结果，遵循 Web 已有行为。

## 页面状态与交互 fixture

| 状态 ID                     | 触发                       | 必须保持的语义                                 | 视觉验收重点                     |
| --------------------------- | -------------------------- | ---------------------------------------------- | -------------------------------- |
| `directory-idle`            | 无搜索、无筛选             | 不发全量搜索；只读必要 facets/收藏恢复         | 入口明确、无误导性“全部结果”     |
| `directory-loading`         | 首次 facets/查询或切换模式 | 保留上下文；请求序列过期结果不得覆盖新查询     | skeleton 不跳高、不横溢出        |
| `directory-ready`           | 有结果                     | 搜索、七级筛选、收藏/常用、继续加载可用        | 390/320、44px 触达区、号码不截断 |
| `directory-empty`           | 合法查询无结果             | 保留查询草稿，可清除并重新查询                 | 空态可理解、清除操作可达         |
| `directory-error`           | 网络/服务错误              | 保留搜索和筛选，重试只重发当前请求             | 重试按钮 44px；不伪造数据        |
| `directory-unauthorized`    | 401                        | 清会话并按现有身份状态机处理                   | 不显示部分旧数据或号码           |
| `directory-forbidden`       | 403/404                    | 失败关闭，不展示 guest/vkey 的通讯录           | 明确提示，不泄露条目存在性       |
| `directory-invalid-cursor`  | 400                        | 丢弃 cursor，回到当前查询第一页                | 不进入死循环、不重复追加         |
| `directory-filter-jump`     | 选择任意层级               | 保持合法选择；不匹配的后代按 Web 规则清理      | Sheet 定位、展开和焦点可见       |
| `directory-contact-merged`  | 完全相同号码集合           | 只在号码类型、完整号码、短号集合完全相同才合并 | 合并卡仍保留全部条目名称/路径    |
| `directory-contact-display` | 有长号/短号/不可拨号码     | 固话短号只读；手机长短号可拨；传真等按规则只读 | 长短号分栏，触达区不小于 44px    |

合成数据和这些状态的最小契约见同目录下的 `p10-directory-parity-fixtures.json`。fixture 中所有号码均为 `000000` 形式的合成值，不能作为生产测试账号或拨号目标。

## Mini 设计预研方向

1. 页面应复用现有临床蓝、白色病历卡、紧凑顶栏和 44px 触达区；科室/人员使用显式双模式控件，不复制 Web DOM、TDesign 或 pointer-event 逻辑。
2. 预期使用自绘 `UiInputShell`、`UiChip`、`UiSheet`、`UiLoading`、`UiAlert` 和普通 `scroll-view`；七级筛选在底部 Sheet 内按当前路径展示，不引入横向滚动条。
3. 搜索草稿、筛选、cursor、当前结果和错误重试上下文先保持内存态；本轮不批准业务缓存、离线写队列、文件系统或通讯录快照持久化。
4. 号码显示只能从服务器返回的 `DirectoryContactMethod` 进入最终展示边界；短号再次经过 3–6 位校验；拨号权限按 Web `canDialDirectoryNumber` 等价迁移。
5. Mini-safe 的 `client-core` directory endpoint/decoder 已在本 checkpoint 新增并通过 Web Zod/Compact 深等价测试；正式原生实现前仍需补 runtime adapter，并证明它不绕过 capability/身份边界。当前不要把 Web API client 直接搬入 Mini。

## 阻塞项与进入 P10 的条件

- 当前 capability guard 将 `/directory` 归入 `organization` 路由；P8 RC 前不得修改这一归类，也不得打开 `organization`。P10 进入时需单独决定通讯录归属能力并配套 API/UI 双端失败关闭测试。
- 当前 Mini `app.json` 尚无通讯录页面，runtime adapter、capability 归属和页面注册仍待后续任务；本台账不修改导航、分包或页面注册。
- P9 `subpackage-insights` 可能同时改主包/底栏/能力读取；P10 页面接线必须在这些共享改动稳定后串行合并。
- P8 RC 用户明确通过、P9 共享边界冻结、P10 Storybook 390/320/大字号黄金固化、权限/隐私/号码/错误矩阵定向测试通过后，才可进入 Mini 原生实现。

## 本轮停止条件

本 worktree 只交付本台账和合成 fixture；不上传体验版、不部署生产、不修改 `main` 工作树。后续若要进入 P10 实现，应从本台账新开独立任务，并重新读取当前 `docs/project-status.md`、P9 变更和 P10 相关 Web diff。
