# 群组双向访客权限实施记录

- 基线：`9d05d932`；独占 `runtime/wt/general-1`，分支由官方 warm pool 分配。
- 路由：L2，Acquire → ReuseOnly → API/Web bootstrap → targeted tests；未安装依赖。
- 目标：头颈外科医生群与护士群持续互为访客；仅正式成员传播资格，离群自动失效，原有身份优先。
- 原实现位置：群列表由 `8e42afb8` 引入，登录访客日历由 `1b1eebdb` 引入；已用 `git log -S` 与 `git blame` 核对。
- 群回收覆盖门禁由 `9e4a6765` 引入；新增表后门禁先失败，补充删除步骤后通过。

## 行为变化与验证

- 关联查询实时依赖数据库正式成员资格；列表/目录合并去重，保留直接群顺序与身份。
- 登录访客读取授权与数据共用事务；只新增专用只读授权，不伪造成员或扩大通用权限。
- 关联访客过滤包括已确认短号在内的联系方式；公开访客码和独立访客保留原行为。
- 加入/退出关联访客返回明确冲突；运维启停版本化、幂等、审计化。
- 新增迁移57、有序唯一ID对与外键；所有手写数据库重置夹具补入新表，避免测试间残留。
- 群组正常回收覆盖关联两端。正式 release 兼容门禁从 schema56更新为57。
- 回归红绿：旧群列表测试返回空数组，新实现返回访客摘要；旧兼容门禁拒绝57，新门禁通过。
- 真实MySQL：日历31项、迁移28项、群路由13项、群权限10项通过；最终联系方式/独立身份/级联变更定向13项及新增真实群回收1项通过，共83项不同用例。
- 静态/Node：API build、typecheck、定向ESLint、官方format:check通过；命令/摘要/版本门禁10项通过。
- API/数据库范围Node测试最终257通过、411跳过；真实数据库用例另按上述隔离MySQL命令执行，不把跳过计为通过。
- 运行/浏览器验证：`pnpm smoke:browser` 全流程通过（本地Web与API、真实开发MySQL）；`pnpm smoke:check-core`通过。
- 关联专项浏览器：`node --env-file=<本地测试环境> runtime/audit/group-visitor-links/browser-linked.mjs`通过；浏览器请求经真实Fastify/API和隔离MySQL处理，双向群切换显示访客、月历可见、无排班写入口，停用后403。截图已检查；空日历为合成夹具。
- 本地合成 `local-admin` 的平台标记原为0，与冒烟夹具约定不一致，临时设1验证后已恢复0；不修改生产账号。
- Docker启动被两个残留AF_UNIX socket阻断；保留原socket目录后恢复引擎，只使用现有测试镜像。
- 证据位于工作树ignored `runtime/audit/group-visitor-links/` 与 `runtime/smoke/group-visitor-links/`。

## 交付状态

- 实现及本地验证已完成。检查点：`feat(groups): add reciprocal guest access between groups`；生产阶段按用户提供的项目级自动部署指令与当轮实施请求执行。
- 只读预检live=8e68a480、schema56、全库37账号/35成员关系/4011排班；医生群7、护士群18名有效正式成员，均有登录身份。群名唯一匹配，ID已核对；关联尚未启用。
- 后续按runbook备份、部署、配置与验证；不把构建或Git推送当作生产验证。
- Web浏览器与Node测试不替代小米14验收；未操作微信开发者工具或上传小程序。
