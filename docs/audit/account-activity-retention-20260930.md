# 平台账号活跃详情、访客30天与小程序审查（2026-09-30）

## 范围与身份

用户批准的三项工作及交付：Mini 平台账号点击展开详情，访客原始记录滚动30天，全部 Mini 源码/共享模块/构建链路审查。基线 aaaf6b36；独占 general-6、REUSE_ONLY，未安装依赖。原用户文件和其他 warm 工作保留。Docker 重启恢复后真实数据库验证完成。

## 行为变化

- 账号列表默认不请求统计；单账号详情显示北京时间最近成功登录、登录方式、今日登录次数、最近访问、今日/累计打开次数及统计起始时间，含加载/空态/错误/重试。关闭、切换及卸载后的迟到结果不回写；Web 无新增详情 UI。
- 只在签发成功登录会话后记登录；自动认证、主动登录、绑定及历史未注明来源分别显示。已有会话恢复不记登录。统计失败不阻断认证/业务，服务端仅输出固定脱敏错误码并关联请求。
- App.onShow 创建唯一前台事件；onLaunch 不重复，匿名不计，当前前台登录后补记，切页/预加载/重试不新增。切换账号按各自身份去重，退出与后台不补报。服务端从认证身份取账号，锁账号、事件去重和摘要更新处于同一事务；累计从上线首个有效统计开始，不补造历史。
- 迁移0070新增账号摘要及打开回执两表；回执30天、累计摘要随账号保留。备份不含原始回执，保留累计摘要。访客查询/任务/部署校验/现行说明统一30天；恰好截止记录保留，更早不可查询并批量清除；匿名月汇总及访客会话去重不变。
- 两项审查修复：删除30个没有运行入口引用且已内联的独立构建输出（源文件及诊断保留）；账号列表最新请求守卫防止旧响应/卸载后更新。不是纯格式化或架构迁移。

## 可比较基线（未绑定体验版的 production 构建，字节）

| 包                       |  修改前 | 功能完成 | 最终优化 |
| ------------------------ | ------: | -------: | -------: |
| main                     | 1673804 |  1686944 |  1172930 |
| subpackages/scheduling   |  432367 |   432675 |   432675 |
| subpackages/organization |  849131 |   856201 |   856423 |
| subpackages/workflows    |  531989 |   533566 |   533566 |
| subpackages/insights     |  958228 |   959443 |   959443 |
| 总计                     | 4445519 |  4468829 |  3955037 |

相对修改前：总包减少490482 B（11.03%），主包减少500874 B（29.93%），主包1.5M内部警告消除。固定输入前后68个保留 JS 哈希相同，30个无入口输出合计509127 B；该对照只衡量构建过滤，后续列表守卫会改变业务入口 JS。三个阶段 verify 耗时中可复核清洁基线10.7614秒、最终8.5711秒；单次本机耗时不作为真机启动改善百分比。证据位于 ignored runtime/audit/activity-30d-20260930。

### 每阶段最大20个文件

#### 修改前

| 文件                                                                              |   字节 |
| --------------------------------------------------------------------------------- | -----: |
| pages/workbench/index.js                                                          | 234536 |
| subpackages/scheduling/pages/manual/index.js                                      | 187176 |
| platform/client-core-calendar.js                                                  | 179054 |
| components/profile-workspace/index.js                                             | 158814 |
| pages/guest/guest.js                                                              | 157760 |
| subpackages/organization/pages/group-settings/index.js                            | 154960 |
| subpackages/scheduling/pages/backfill/index.js                                    | 153994 |
| subpackages/workflows/components/workflow-swap-panel/index.js                     | 153519 |
| subpackages/insights/pages/notification-settings/index.js                         | 152321 |
| subpackages/insights/pages/notifications/index.js                                 | 152318 |
| subpackages/insights/components/notifications-panel/index.js                      | 151920 |
| subpackages/workflows/pages/duty/index.js                                         | 150463 |
| subpackages/organization/components/directory-panel/directory-panel-controller.js | 147103 |
| subpackages/workflows/pages/leave/index.js                                        | 145647 |
| subpackages/insights/pages/insights/index.js                                      | 130668 |
| subpackages/insights/pages/exports/index.js                                       | 129855 |
| platform/workbench-read.js                                                        | 125516 |
| subpackages/organization/pages/scheduling-config/index.js                         | 123987 |
| subpackages/organization/pages/qr-visitor/index.js                                | 122771 |
| subpackages/organization/pages/platform-accounts/index.js                         | 121419 |

#### 功能完成

| 文件                                                                              |   字节 |
| --------------------------------------------------------------------------------- | -----: |
| pages/workbench/index.js                                                          | 234690 |
| subpackages/scheduling/pages/manual/index.js                                      | 187330 |
| platform/client-core-calendar.js                                                  | 181323 |
| components/profile-workspace/index.js                                             | 158968 |
| pages/guest/guest.js                                                              | 157760 |
| subpackages/organization/pages/group-settings/index.js                            | 155114 |
| subpackages/scheduling/pages/backfill/index.js                                    | 154148 |
| subpackages/workflows/components/workflow-swap-panel/index.js                     | 153673 |
| subpackages/insights/pages/notification-settings/index.js                         | 152475 |
| subpackages/insights/pages/notifications/index.js                                 | 152472 |
| subpackages/insights/components/notifications-panel/index.js                      | 152074 |
| subpackages/workflows/pages/duty/index.js                                         | 150617 |
| subpackages/organization/components/directory-panel/directory-panel-controller.js | 147257 |
| subpackages/workflows/pages/leave/index.js                                        | 145801 |
| subpackages/insights/pages/insights/index.js                                      | 130822 |
| subpackages/insights/pages/exports/index.js                                       | 130009 |
| platform/workbench-read.js                                                        | 125670 |
| subpackages/organization/pages/platform-accounts/index.js                         | 125592 |
| subpackages/organization/pages/scheduling-config/index.js                         | 124141 |
| subpackages/organization/pages/qr-visitor/index.js                                | 122925 |

#### 最终优化

| 文件                                                                              |   字节 |
| --------------------------------------------------------------------------------- | -----: |
| pages/workbench/index.js                                                          | 234690 |
| subpackages/scheduling/pages/manual/index.js                                      | 187330 |
| components/profile-workspace/index.js                                             | 158968 |
| pages/guest/guest.js                                                              | 157760 |
| subpackages/organization/pages/group-settings/index.js                            | 155114 |
| subpackages/scheduling/pages/backfill/index.js                                    | 154148 |
| subpackages/workflows/components/workflow-swap-panel/index.js                     | 153673 |
| subpackages/insights/pages/notification-settings/index.js                         | 152475 |
| subpackages/insights/pages/notifications/index.js                                 | 152472 |
| subpackages/insights/components/notifications-panel/index.js                      | 152074 |
| subpackages/workflows/pages/duty/index.js                                         | 150617 |
| subpackages/organization/components/directory-panel/directory-panel-controller.js | 147257 |
| subpackages/workflows/pages/leave/index.js                                        | 145801 |
| subpackages/insights/pages/insights/index.js                                      | 130822 |
| subpackages/insights/pages/exports/index.js                                       | 130009 |
| subpackages/organization/pages/platform-accounts/index.js                         | 125814 |
| subpackages/organization/pages/scheduling-config/index.js                         | 124141 |
| subpackages/organization/pages/qr-visitor/index.js                                | 122925 |
| app.js                                                                            | 109958 |
| subpackages/insights/pages/visitor-access/index.js                                | 109174 |

## 全量覆盖与发现

自动逐文件读取、哈希、类型/模板/样式/资源/构建扫描748个文件：Mini源码395、Mini脚本214、contracts47、client-core源码47/脚本2、presentation27、icons源码8/脚本2、tokens6。路由19页、组件声明、WXML事件、TS/WXS动态调用和实际产物交叉核对；noUnusedLocals/noUnusedParameters 无发现，Mini资源无相同哈希重复项。静态正则计数包含类型/生命周期等，不冒充运行计数；自动覆盖不等于逐行人工证明。

| 模块                                            | 人工复核重点与结论                                                                         |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------ |
| app/platform/auth/共享请求                      | 登录存储与恢复、capability、SSE订阅销毁、前台事件/切换账号、错误脱敏；新统计无自动认证循环 |
| 首页/访客/共享日历                              | 共享组件、缓存边界、监听/定时器与销毁、访客身份边界；不改已验收视觉                        |
| scheduling/manual/backfill                      | 操作状态、矩阵局部更新、资源入口；大模块列后续，未无证据重构                               |
| organization/profile/directory                  | 列表竞态、详情折叠、目录请求串行与卸载、绑定/角色权限；修复账号列表旧响应                  |
| workflows                                       | swap/leave/duty请求与审批状态、生命周期；保持业务口径，未发现可证实的额外安全删除          |
| insights/notifications/exports                  | 定时器/事件销毁、缓存、分页与重复操作守卫；保留诊断及导出链路                              |
| contracts/client-core/presentation/icons/tokens | 运行时依赖边界、轻量解码、整库进入Mini检查；沿用已有契约和运输层                           |
| build/测试/资源                                 | source/路由/动态入口/产物交叉核对、确定性、包体预算、30个重复独立输出删除及反插入门禁      |

| 编号/优先级      | 证据、原因和影响                                                                                                     | 风险/置信度/处理与验证                                                                                               |
| ---------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| ACT-AUDIT-001 P1 | 平台账号列表旧请求可覆盖新列表，卸载失败路径仍setData；引入c0ea31e97，98aa0910b沿用部分销毁守卫                      | 低/高；最小请求序号守卫。旧代码authVersion5覆盖8用例先红，修改后7项绿                                                |
| ACT-AUDIT-002 P2 | 构建遍历TS输出已内联且无动态引用的30个app/platform模块，共509127 B；收集入口始于3884713b，过滤机制4d8a38e9/e6ef714bc | 低/高；保留源码，只过滤独立输出。旧产物回归先红，68保留JS哈希相同；重新插入输出门禁先红后绿，19路由及SSE/app事件保留 |
| ACT-AUDIT-003 P1 | 新/me/activity/opens未分类会被Mini capability拒绝503                                                                 | 低/高；只分类准确POST为core，旧代码红，新12项绿，相邻路径/GET仍拒绝                                                  |
| ACT-AUDIT-004 P2 | schema70后26个手写测试清理器遗留新表，真实MySQL出现already exists；迁移清单仍期待69                                  | 低/高；补两条DROP及新清单断言，重新执行真实DB全部受影响测试通过                                                      |
| ACT-AUDIT-005 P2 | workbench/manual/group-settings大型原生入口，矩阵静态模型1513宿主节点（既有），共享请求代码重复内联                  | 中/高；后续须真机热点测量后设计拆分/虚拟化，当前不改变架构或业务；desktop逻辑数据不能证明卡顿                        |
| ACT-AUDIT-006 P3 | 多处小型UUID生成逻辑；资源无相同哈希重复，无可确认无用业务源码                                                       | 低/中；没有明确包体收益，不做广泛提取/删除                                                                           |

## 验证层级

- 修改前Mini1308通过/23跳过；最终Mini1313通过/23跳过，190通过/4跳过文件。完整pnpm verify通过（format/typecheck/lint/build/icons/共享包测试）；Codex83项，root1368通过/476跳过。标准root无DB环境跳过由独立真实DB补测，不能称这些跳过已执行。
- 真实MySQL独立99项通过（activity7、visitor15、privacy6、WeChat26、admin-binding8、migration30、password-identity7）；并发用8连接，跨日、重复/并发、回滚、权限、切账号、过期重放、统计故障、边界游标、分批/匿名汇总覆盖。HTTP6项覆盖主/自动登录、会话恢复、失败及脱敏；Mini运行时/详情回归覆盖匿名转成员、退出/后台、关闭/重试/迟到响应。
- 运行/浏览器验证：pnpm smoke:browser 七阶段全部通过，浏览器无错误。只使用本地合成数据，临时平台角色finally恢复。Web原核心流程兼容；提交前smoke:check-core复核。
- production verify通过（包体预算/性能预算/确定性，Worklets0），CI上传干跑通过。桌面矩阵约0.60ms、点击0.14ms只代表Node逻辑基准；不代表微信启动、帧率或手机性能。
- Agent开发者工具：项目打开、平台账号WXML/WXSS局部编译ok。Console/Network/冷启动/真实页面性能当前未取得可用测量，暂未验证。小米14同构建验收需用户实际证据；无全平台兼容结论。

## 交付与唯一下一任务

本地实现及运行验证完成。检查点消息：feat(activity): add account details and 30-day visitor retention。下一任务：审查/提交/正常推送此候选，实时核对生产前驱并备份后部署schema70及既有留存任务、完整生产验证，然后官方分配新不可变体验版并只增放行保留旧版。完成交付后停止修改，等待小米14同构建账号详情/登录与前台计数/访客边界及核心路径证据；不提审、不正式发布。
