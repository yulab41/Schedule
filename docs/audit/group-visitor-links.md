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

## 生产交付（2026-09-10）

- 按用户提供的项目级自动部署指令与当轮实施请求执行。应用4e0a0d1af9d1d3580ab6add1e83f857262852a9d已合入main、推送GitHub并部署；收口文档不重复部署。
- 部署前实时读取live=8e68a480ba7608025a9af262e7d6fe5369071161，作为manifest的rollbackCandidate；schema56。不是根据历史聊天猜测。
- 备份a4c0aff8-c461-45e3-98a0-a69ef6c0d3c4，102918988字节、53表、241617行，SHA-256 `24fb9ee40928444b47d19389839d5517f5702180a234f1b68c3cf64118151428`。登记、时效、实际文件长度及hash一致；已有保留策略淘汰1份旧备份。
- 官方packager在独占warm槽生成production发布包，manifest绑定应用4e0a0d1a/schema57及实际live前驱。开发依赖ReuseOnly；官方离线产物deploy复用85个生产依赖，下载0，未运行install。
- 服务器独立目录上传产物与同SHA updater/verifier，固定wrapper复核脚本和manifest hash、实时live与备份后执行ecs-update；健康检查短暂502后恢复，7/7部署完成。
- 完整生产verifier与版本白名单/能力策略校验通过；独立HTTPS `/api/health` 200/ready=true，未调整小程序允许版本或能力开关。隐私保留任务本轮删除0行。
- 正式CLI预检唯一匹配“头颈外科医生”与“头颈外科护士”，分别7和18名有效正式成员；其中已有目标群直接身份各1个，保留原身份。
- 预检version0后执行enable，创建唯一双向关联b98e9d9f-fdd3-43d6-893b-429d6bbafdf2，enabled=true/version1；审计记录随事务写入。
- 生产服务层只读逐账号验证：医生群6账号→护士群，护士群17账号→医生群；所有派生摘要均为guest且无平台管理标记，排班读取成功，长号/短号均隐藏，管理权限403。
- 全库账号37、成员关系35、排班4011前后完全一致；只增加群关联与审计记录，无个人访客成员行，不复制本地数据、不主动真实发送通知。
- 首选回退是按运维文档停用此关联，保留业务数据。旧release声明schema上限56，不绕过现有应用回滚兼容门禁。
- 用户重开现有小程序/刷新Web即可获取最新群列表。Web浏览器、Node与生产服务层测试不替代小米14验收；未操作微信开发者工具或上传小程序。
- 收口检查点：`docs(ops): record reciprocal guest access activation`；本轮已完成，停止重复备份、部署、关联启停。
