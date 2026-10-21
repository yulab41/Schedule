# 网页校对一次性基线重设

## 当前结论

用户选择当前日历实际人员重设一次，此后继续识别新的本系统/网页变化。本批只改API和数据库及必要发布校验，现有小程序页面和接口格式可直接消费新基线，**不需要重新上传体验版**。用户重启Docker后真实MySQL验证完成，分三组160项通过/跳过0，并通过只读评审。本地实现已完成，交付代码检查点；尚未上线，不能声称生产数据已重设。

## 基线与引入点

- HEAD与成功`git fetch origin`后的origin/main均`55c3a9fd`，路由入口为C盘detached worktree、无用户未提交文件。正式Acquire起初被跨卷规则拒绝，改从Git common-dir所对应E盘canonical调用后正常获得`runtime/wt/general-3`，未改规则。
- L2；Acquire→ReuseOnly→api Bootstrap，全复用；依赖指纹`893aa247dc640ca2192b3bd070acc1dca2723008a23b8b1a30de67e13170c380`，install=false、worktreeCreated=false。
- `git log -S 'const baselineName = assignment?.plannedName' -- apps/api/src/modules/external-duty/external-duty-service.ts`与`git blame -L 458,470`定位`06d420a1`将基线固定为原计划人员。这是当时设计，本轮属于用户明确改变基线口径。
- 改前定向四文件18项通过；新扫描回归在旧实现上失败：期望基线乙/网页变化，实际基线甲/本系统变化。新发布缺快照回归也先失败后通过。评审发现的同编号撤回再发布用例先红后绿修复。

## 行为变化清单

1. 迁移0072新增`external_duty_baselines`；一次捕获迁移时北京时间今天起、外部覆盖末日内、现有正式发布的头颈外科医生/一线/全天班实际人员，空覆盖回退原计划；保存人员、成员、班次、期间、日期、版本、捕获时间。原排班和历史操作不改。
2. 扫描与执行前读取按班次/期间/群组/日期匹配快照；新发布未匹配者回退该版本原计划。当前人员仍以原`actual ?? planned`读取，不拿新基线填补实际值。
3. 撤回后再发布可能复用编号；查询捕获后的`schedule_period_withdrawn`事件，使旧快照失效。时间均来自数据库，使用既有期间/发生时间索引；普通合并未替换日期保留快照，历史快照不删除。
4. 向网页同步、向本系统预览和撤回使用同一有效基线。旧预览重读基线不符即拒绝；历史操作保存当时基线，撤回目标取当前有效基线。没有自动同步外部网页或真实通知。
5. schema72发布门禁、生产校验器8字段检查和备份57/58表迁移前后口径同步。既有显式清库测试各补一行删除新表，避免后续迁移夹具遇到已存在表；不改测试业务断言。

本轮不是语义等价重构：基线读取及撤回目标有明确行为变化。接收者绑定、调用次数/异步拒绝路径、空值回退和原权限/版本/幂等守卫保留；读取多一个左连接和索引事件存在性子查询。

## 初次验证记录（Docker恢复前）

- `pnpm exec vitest run apps/api/src/modules/external-duty packages/database/tests/migrations.test.ts apps/api/src/modules/schedules/schedule-repository.integration.test.ts scripts/ecs-schema-compatibility.test.mjs scripts/ecs-retirement-rollback.test.mjs scripts/package-ecs-release.test.mjs scripts/agent-context-policy.test.mjs`：114通过，46因缺MySQL环境跳过（迁移31、排班期间14、校对锁1）。不把跳过写成实库通过。
- 已验证的Node行为覆盖冻结后重复扫描、后续变更、原计划回退、新发布、空快照、同步前校验、旧预览拒绝、撤回以及真实Shell备份表数策略。`pnpm --filter @schedule/database build`、数据库/API typecheck、API build和改动TS的ESLint通过。官方`pnpm format:check`、改动文件Prettier、Git diff空白检查、Git Bash `-n infra/scripts/ecs-verify.sh`通过。运行/浏览器验证：`pnpm smoke:check-core`通过；无Web/契约核心变更，不需`pnpm smoke:browser`。
- 新迁移集成用例用单连接数据库会话冻结时间，验证UTC+8今天边界、草稿/替换/删除排除、实际值与计划回退、原排班不变、迁移重跑不覆盖；新增真实排班仓储路径验证普通合并→撤回→同期间再发布。两者已加入但当前**未执行**。
- Docker Desktop启动失败；实际日志为`initializing Inference manager ... dockerInference ... The file cannot be accessed by the system`。未删除Socket、重置Docker、重装或改系统设置。不能用生产数据库替代本地合成验证。
- 未改Mini源码，无新Mini包体/构建或性能声明；没有调用微信开发者工具，不以Node结果宣称小米14验收。生产运行、真实网页、实体设备当前未验证。
- 成功读取Skills：using-superpowers、schedule-project-guardrails、brainstorming、miniprogram-development、requesting-code-review；systematic-debugging仅读取资料，本轮根因已知，不宣称使用其完整流程。工具为本地Git/PowerShell/Node与只读review子agent；未调用DevTools/MCP业务工具。

### Docker恢复后的实库验证（2026-10-21）

用户重启Docker后复核引擎可用；既有`medical-schedule-test-mysql-1`仅使用`/var/lib/mysql`的tmpfs、库名`schedule_test`，恢复该测试容器，不读取或写入开发/生产库。测试凭据仅从该本地容器进入子进程环境，不输出或写入Git。原租约Heartbeat、ReuseOnly通过；Bootstrap按真实源码增量重建database/test-fixtures，依赖不变、安装0。此节替代上节“当前未执行/阻塞”的早期状态，原始记录保留。

- 首轮同一命令157通过/3失败；0072捕获和真实合并→撤回→再发布用例已经通过。失败分别是通知保留旧断言只期望schema65的12字段，0071合法新增两个NULL领取字段；迁移测试故意留下旧结构，紧接的锁测试无清库导致重复列；一个既有历史接口用例默认5秒超时。
- `git log -S 'claim_token' -- migrations/0071_bounded_background_jobs.sql`定位03ff9635；保留断言由8bb3c6e4引入。将测试和journal临时恢复为原HEAD55c3a9fd/schema71，在同一独占槽按原通知测试复现失败（1失败/29筛选跳过），finally逐字节恢复任务源码。证据`baseline71-notification-red.log`。只补充原完整记录加`claim_token:null/claimed_until:null`的精确期望，不过滤任何旧字段；目标先红后绿且只读复评确认没有掩盖业务变化。这是本次验证旧库升级所需的夹具兼容修订，未改通知业务。
- 后续分进程顺序运行，保留默认超时与原断言：`pnpm exec vitest run packages/database/tests/migrations.test.ts`：31/31；再`pnpm exec vitest run apps/api/src/modules/schedules/schedule-repository.integration.test.ts`：14/14，夹具清理并恢复最新schema；再运行external-duty与原四项script检查：115/115，含真实锁用例。合计160通过、跳过0，不宣称单次组合全绿。
- 实库证明：空库72条迁移与重复执行；0072只捕获有效发布/当前范围、原排班不变、后续改为丙不改快照乙；真实查询、普通合并保留快照、同编号撤回再发布回退原发布基线及保存历史快照均通过。继承超时隔离后原配置通过，无业务补丁或放宽超时。
- 原始日志位于ignored槽内`runtime/audit/external-duty-rebaseline-20261021/`，三份最终日志为`mysql-migrations-green.log`、`mysql-publication-green.log`、`mysql-duty-gates-green.log`。新增测试断言的类型/格式/ESLint与文档/core检查在提交前完成；此前应用build/typecheck证据输入未变，按守卫复用。
- 恢复阶段已使用systematic-debugging定位首次失败，前述“仅读取”仅描述实现阶段。没有连接生产、同步网页、触发真实业务通知、上传体验版或做实体设备声明。

## 交接与停止条件

本地实现和运行验证已完成，检查点消息`fix(external-duty): freeze current roster reconciliation baseline`，提交后正常推送当前任务分支。唯一下一任务是用户当次明确授权生产备份、后端部署及0072迁移后进入L4；本轮停止在已验证检查点交付。上线前从实时服务器确定回滚候选并备份；生产迁移时点才是线上一次性基线重设时点。小程序保持现有体验版，不分配版本、不放行、不提审或正式发布；不自动同步网页。
