# 换班、请假限制与统计口径统一整改（2026-09-29）

## 范围、基线与引入点

- 用户已批准完整设计，任务为实现全部十项规则，涉及既有计划的请假、换班、加扣班、手排及统计模块。基线 `45bf7bec`；独占 warm `general-6`，Acquire → ReuseOnly → Bootstrap → Targeted test，依赖复用，install 未调用。canonical 用户未跟踪文件保持原样。
- 实际使用 schedule-project-guardrails、systematic-debugging、frontend-design、miniprogram-development 和 wechatide/initializer/compiler/automator 指令。Skill hash `70fe2e867bf8d625329f794bc14af1fde48ec65c9fe97f9196b1b17d6af1eef0`。未调用或失败的工具不算使用成功。
- 基线 API 类型通过，Mini production 构建331文件；原 workflow MySQL96通过/1失败，失败是旧归档重发布断言仍假设月级 periodId，历史记录也已复现。新按日期发布测试改为核对实际当前发布ID，未改变产品逻辑。
- `git log -S`/`git blame`：统计历史事件累计、零贡献成员及归属来自 `36127b02`；处理人仅查管理员来自 `de3acab7`；请假告警行布局来自 `0975b2d1`；清空/恢复职责在 `057af270` 抽取；全天假仅按业务日期判断来自 `6452fa92`；工作流冲销恢复链来自 `7c783c71`（日期粒度 `162ef4c1`）。本轮是批准的业务变化，不作为语义等价重构。

## 行为变化与兼容

1. 换班申请区 → 已生效待撤销 → 已受理；原权限不变，删除归档提示和对应空容器。服务端处理人优先管理员，否则提交成员；历史资料、事件/班次快照补全，缺失资料有非空离群占位。
2. 请假弹窗警告块参与正常布局，与列表/原因各至少12px，长文换行、主体滚动、提交栏独立。读取失败/读取中/有冲突均禁止提交，移除批准清空确认及撤销恢复提示。
3. 服务端提交、审批在群组事务锁内检查实际承担的 published 班次且 endsAt > now。换出后仅原计划归属不阻断；全天假同时检查业务日期和北京时间自然日物理交集，覆盖前夜班和月/年边界。统一提示包含换班、加扣班和联系管理员撤回发布。
4. 删除 leave-assignment clear/restore 及 restoration 模块、对应执行测试和废弃 coverage 查询。批准/撤销只修改请假状态，兼容旧请求字段但不能绕过；原班次和审计记录保留，旧事件类型仅保留读取兼容。
5. 新只读 availability 按群组/岗位/区间只返回成员ID和 blocked，不暴露原因。pending/approved 禁排；驳回、撤销、离开日期范围恢复。异步序号防止旧响应覆盖新日期，已选冲突可取消不静默删除模板；红字使用 `#D92D20`。
6. 模板和编辑器生成/应用、旧草稿发布、换班/加扣班及撤销恢复均作服务端检查。重复发布/按日期覆盖若恢复另一仍发布班次，也先检查；失败事务不留下申请、事件或部分班次。跨夜延续至选定结束日期次日的请假也在生成/应用层检查。
7. 统计 algorithmVersion2：班次快照的计值属性控制七项总数；实际归属控制周末/节假日；换班按有效申请、成员和接入班种去重，年度申请去重。取消/驳回/撤销/发布替换/补录校正贡献排除，不受列表隐藏和30天限制影响。
8. 初次/重新发布为计划基线；补录新增/修改/移除校正基线，今后保存计划＝实际，旧补录依据事件/标记只在计算时归一。跨月补录刷新两侧月份，原始事件不改写。无单独人工调整/请假补位指标。
9. 成员从有效计划、实际、变更贡献生成；六人样例没有第七个无名空行。真实离群成员保留并补姓名。岗位/班种计划与实际分别归属，不再把已换出的班算给本人实际。
10. Mini/Web 使用 schemaVersion=2 七项指标；多班种默认收起明细显示每班种七项及实际减计划，休息注明不计总数，单班种不重复。展开使用已返回数据，无逐人请求；无底部提示胶囊。旧客户端保持原响应形状，废弃字段适配0，使用同一计算结果。

- 月度查询只取本月 published/past 班次及关联有效请求、关联班次的补录事件；不再遍历历史完成事件累加。内部年度去重身份不下发；双成员30班次 v2 响应测试限制8KB以内。现有重算作业涵盖 published/past，旧算法快照不得直接返回。
- API路由选择保持接收者绑定（bind）；异步错误仍由原事务/幂等边界处理。删除已无副作用的 leave 映射异步包装，调用仍在同一事务内；没有新增外部通知通道或测试通知。

## 回归与运行验证

- 先红后绿：零贡献空行和班种归属2项、正在进行班次提交冲突、跨月补录后另一月份统计、休息班明细2项、全天假前夜交集、同月/跨月冲销恢复2项、选定结束日跨夜班1项。测试夹具唯一键/枚举错误及环境变量遗漏不计业务红灯。
- 真实 MySQL（127.0.0.1:3307/schedule_test）：`NODE_ENV=test node --env-file=E:/AItools/Schedule/.env node_modules/vitest/vitest.mjs run` 对 leaves/swaps/duty-adjustments/manual-apply/past-schedules/schedule-repository/statistics 七文件148项通过；追加同月/跨月恢复2项、直接换班/扣班撤销2项及跨夜应用1项通过。覆盖待审批/批准、取消/驳回、旧草稿、旧客户端、并发提交与发布、撤销/补录/年度统计。
- Node：Mini全量初轮1294通过/21跳过。全仓初轮1307通过、5失败、460跳过：其中状态文档超40KB为基线，其余为新API树摇包体和旧指标/监听断言；已修正并定向复测，不保留旧口径断言。最终复测：根Node guard81项通过，Vitest1313通过/465跳过，Mini1295通过/22跳过（其中几何用例显式开启另1项通过）。
- 运行/浏览器验证：`pnpm smoke:browser` 对应 `scripts/smoke-browser.mjs` 已在本地 API3105/Web4175通过，覆盖登录/管理员/成员/访客vkey/访问记录和新版统计，浏览器错误0。仅本地合成 local-admin 临时设置平台角色，finally恢复；开发数据库现有容器启动并迁移，未接触生产。warm 工作树使用显式加载环境变量，未复制凭据。
- 真实 WXSS + DOM 几何代理：320/390px × 普通/大字号共8截图，警告和原因间距、滚动到输入框、固定底栏、无横向溢出、红字颜色通过。`SCHEDULE_WORKFLOW_LAYOUT=1 pnpm --filter @schedule/miniprogram exec vitest run scripts/leave-statistics-layout.test.mjs`；不是微信原生或手机验收。
- Agent微信开发者工具：首次状态检查已登录、工具版本兼容；已打开 warm 项目并编译请假/统计局部WXML，工作台页面栈读取成功。补充换班、手排WXML均成功；统计WXSS成功。请假WXSS的CLI无响应，终止该单一CLI后未宣称成功；该样式由Node构建及Edge几何验证覆盖。无真机冷启动/性能或真实生产业务操作证据。
- 证据分层：静态/Node/本地真实MySQL/Edge浏览器/Agent开发者工具；小米14同构建、iOS、其他安卓和生产数据未验证。没有编造启动耗时或优化百分比。

## 问题清单和发布边界

| 编号  | 级别 | 问题与影响                                   | 处理/验证状态                                  |
| ----- | ---- | -------------------------------------------- | ---------------------------------------------- |
| LS-01 | P1   | 已排班仍能请假并修改班次，产生补位/恢复冲突  | 删除执行链，事务硬条件；MySQL通过              |
| LS-02 | P1   | 日期/草稿/撤销/跨月恢复可绕过请假            | 统一pending/approved检查，边界回归通过         |
| LS-03 | P1   | 无效事件累计、无名空成员、班种归属错误       | v2有效统计及内部版本重算；单元/MySQL通过       |
| LS-04 | P2   | 换班顺序、处理人空白、请假提示碰撞、统计冗余 | 三端界面与姓名补全；浏览器代理通过，手机待复核 |

- 检查点拟用 `fix(scheduling): enforce leave restrictions and effective statistics`；本地运行验证完成，提交身份由该消息定位；随后正常快进推送main。没有新依赖/迁移，原始审计和既有历史结果保留。
- `PRODUCTION_AUTHORIZATION=not-granted`；没有连接、备份、部署、重算生产或追加allowlist。当前线上 release/试用版只能由后续获授权的动态核对确定，不能沿用上一轮记录作为回滚基线。
- 唯一下一任务：完成本地检查点后取得精确 L4 授权，按服务器备份部署 → 统计重算核对 → 新体验版动态分配上传 → 追加放行交付；最后小米14同构建复核。授权未到停止生产动作，不提审/正式发布。

## 最终本地门禁

- `pnpm typecheck`、`pnpm lint`、`pnpm build`、`pnpm icon:parity`、`pnpm smoke:check-core`通过。最后类型检查曾发现新守卫入参要求actual字段过严、两条测试引用不存在的rulesVersion，已修正后复测通过；生成快照缺actual时按planned检查，与运行时空值语义一致。
- 真实MySQL七文件148项，加同月/跨月恢复、换班/扣班撤销恢复、跨夜应用5项，累计153个独立用例通过。最终leaves/manual/statistics三文件59项再次全通过。
- `pnpm miniprogram:verify`、`check:package`、`check:determinism`、`ci:dry-run`、`check:trial-lineage`通过。本地production/local脏树构建331文件，主包1,655,326 B，总包4,380,990 B；分包 scheduling431,685 / organization849,131 / workflows533,314 / insights911,534 B。不是版本绑定上传包；无当前基线同身份包体对比，不报告减量。
- 保留既有提示：主包超过内部1.5M警戒，手排矩阵1510节点超过best-effort1000目标，Web HomeView压缩后577.09kB超过500kB警戒。未扩大优化范围。
- `pnpm format:check`仍在五个未修改文件失败：Mini schedule-calendar-preview/model.ts、scheduling/pages/backfill/index.ts、contracts/past-schedules.ts、presentation-core/past-schedule-backfill.ts及其tests/past-schedule-backfill.spec.ts；已与基线/上一轮记录对照。本轮所有改动TS/Vue/MJS/JSON的Prettier通过，未混入无关格式改动；不宣称完整pnpm verify成功或清洁上传候选冻结通过。
- 浏览器对重建后的API/Web再次完整通过，合成角色已恢复。几何代理再次通过；文件/断言/旧响应结构审查、冲突标记和diff检查通过。审查确认仅任务文件；状态文档按当前批次压缩，历史详情在Git及原轮次报告保留。
- 未执行生产备份、部署、统计重算、体验版上传或追加放行；没有本轮backup/release/trial身份。进入L4需当前明确授权，线上回滚候选须在部署前重新核对。
