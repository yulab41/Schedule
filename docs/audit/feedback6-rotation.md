# Feedback6：移除自动轮转与请假受控恢复

## 范围与连续性

用户批准删除自动生成、轮转规则与轮转顺序，保留手动模板、岗位成员、发布、历史和内部并发计数。不是语义等价重构：请假批准由自动补位改为清空本人未来冲突班次，撤销按保存版本恢复未被人工修改的空缺。

基线 main/origin=98aa0910；分支 codex/feedback6-rotation，general-1 独占租约 35001ead-76fb-4b13-b47d-6cb118195161。Inspector L2、Acquire→ReuseOnly→Bootstrap→定向基线通过。DEPENDENCY_MODE=REUSE_ONLY，未安装依赖、未连接生产、未上传。其他 agent 只读评审。基线配置路由2项、领域生成8项通过；源码与构建证据放 ignored runtime/audit/feedback6/rotation-*。

git log -S / blame 定位：轮转配置来自04c7da36，配置并发版本0bb58654；请假自动重排0d5ec55c，冲突必须补位/顺延94dc6cac，群回收关联a837586e/9e4a6765。旧功能按本次批准退役，不把过去需求写成缺陷。

## 行为变化与保留边界

- 删除 Mini 规则、顺序、版本展示，保留岗位成员独立勾选。Web/Mini/shared client/contracts/API 不再提供 rotation-rule、rotation-members、generate、generate-preview、leave-reflow-strategy；publish-mode、手动模板和发布路由保持。
- 移除领域自动算法和请假重排算法。公共日期、冲突、班次快照移入中性模块；业务键字节格式仍保留历史 `rotation:...`，避免旧班次唯一键改变。临床请假类别 rotation、历史 leave_cover_completed 及其历史策略说明保留。
- 0056 删除 rotation_members、rotation_rules 和两个旧请假策略列；独立 member_schedule_roles、模板、班次、期间及事件不迁移或删改。内部 rulesVersion/entity version、模板与发布历史保持。
- 批准只清当前实际值班人（actual 优先 planned）未来尚未开始且真实重叠的 published 格，4个成员字段一并置空。跨月夜班按真实时段纳入；待处理换班/加扣班为 blocker，不自动取消请求。临写复核开始时间；跨过开始时刻返回409并事务回滚。
- 每次批准记录 schemaVersion=1 的不可变原值/clearedVersion 快照；零影响也记录可验证空快照。所有写入经过 updateShiftAssignments，固定 startsAt 并 version+1，避免 CynosDB 时间戳隐式更新。
- 撤销只恢复同期间、同格、published、未来、4字段仍空且版本精确匹配的格。所有非空快照成员需存在且同群，实际值班人还需当前岗位资格、无其他请假/值班/工作流冲突。填后再清空版本变化也跳过；缺/坏/未知版本快照不猜。临写再次核验时刻，返回恢复/跳过数量及原因。统计、事件、幂等、通知记录保持同事务；未发送真实通知。
- 旧业务集成夹具改走 ScheduleRepository.createDraft + 真实发布 API，测试辅助目录不进入 API build。删除自动专用测试和自动年度负载场景；保留并发换班负载场景，改为显式草稿发布。旧产物只精确删除已退役源文件的生成文件；整目录递归清理曾被自动审批拒绝，未执行。

## 验证记录

- schema56首轮配置/日历/请假/迁移74项通过；0055→0056实迁移保留岗位成员、模板与已发布班次，证明两表和两列退出。平台备份/恢复实测当前表数53，checksum/行数断言保留。
- 实际MySQL后续覆盖换班、加扣班、通知、统计、导出、事件、历史补录、手动模板、群管理、发布；详细按文件通过数见原始日志。日期过期夹具固定 Date，不放松生产日期检查；通知夹具改建真实群，未放松外键。
- 请假边界整文件33通过，另零影响批准/撤销单例通过（合计当前34项）；覆盖跨月夜班、时间推进、pending blocker、精确版本、填后清空、资格移除、期间替换、坏快照、部分恢复、planned/actual不同且planned人被删除。快照schemaVersion回归先红后绿，缺失/未知版本拒绝恢复。
- 全日期审计SQL的本地合成回归通过，历史混合collation导致初始1267，UUID列对列比较改用BINARY后通过。只读查询保留JSON_TABLE、窗口排序及LEFT JOIN三值逻辑，无生产写入；生产聚合事实见feedback6-data-audit.md。
- 运行/浏览器验证：pnpm smoke:browser，原脚本在当前 schema56 API/Web、Edge 全流程通过（管理员、成员、访客与访问记录）；无浏览器错误。仅内存适配本地合成配置，管理员标记finally恢复。截图 runtime/smoke/feedback6-rotation，非真机验收。
- format/lint/build/typecheck/icon在全量链通过；Mini首轮944通过、2个旧测试失败（退役一个策略异步函数的计数，账号详细列表新契约的旧诊断夹具）。更新相应旧夹具后定向14通过，保留全部生命周期和请求次数断言。后续全量结果见最终补记。
- Mini verify通过，production包5064615字节、主包1726270字节，Worklet2→2；保留既有主包1.5M提示、600格DOM下界提示，不宣称原生性能提升。load:build通过，未执行2000账户高负载场景。

最终补记：`pnpm verify` 完整退出0（rotation-verify-checkpoint.log）；Mini946通过/15条件跳过，root Node门禁通过、Vitest1178通过/400数据库条件跳过。真实MySQL另行分批验证：配置7、迁移27、日历17、请假34、换班34、加扣班26、通知9、手动应用18、模板9、发布2、历史补录11、群路由13、事件6、统计5、导出5、平台备份管理18，失败修正与复测日志均保留。此前root7个旧断言/分包入口问题定向36项复测通过，最终整链再次验证；事件展示继续走既有独立/event子路径，没有放宽分包边界。Mini verify最终复测及smoke:check-core通过。API/Web已停止，3000/5173无监听；无其他测试进程占用业务端口。

## 迁移及交接

0056 **前向不兼容**：旧服务仍访问删除表/列，不能仅回滚应用镜像。保留原迁移，不修改旧文件。发布前须备份/验证、停止旧API写入、应用0056并启动新API；迁移进入不兼容DDL后即使journal未写完，也不能在失败trap中直接启动旧API。失败应恢复对应数据库备份或前滚修复。备份表数55→53的校验及allowlist强制旧版升级由根任务统一实施。

本单元只形成安全本地检查点，不push/mainmerge/deploy/upload；持有租约交根review。唯一下一任务：根任务完成最终发布/schema兼容/旧客户端升级控制面集成与门禁，随后按用户当次授权执行发布候选流程。小米14、原生运行时、首搜耗时未验证。
