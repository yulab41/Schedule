# Project Status

本文档只记录当前可安全接续的状态；详细历史以 Git 提交为准。

## 2026-08-22 通讯录打开性能优化（当前批次）

- 范围：只优化 Web/API 通讯录 facet 初载与筛选渲染；不改变权限、搜索语义、筛选结果、收藏查询、联系方式数据或分页大小。
- 回归来源：`8309dce`/`926136a` 引入重复层级扫描，`5437995` 将 facet 与收藏恢复合并等待，`ee1296e` 保留隐藏筛选选项 DOM，`e74e5f3` 每次请求扫描发布批次层级行；本轮已执行 `git log -S` 与 `git blame`。
- 实现：筛选选项改为面板打开且层级展开时才创建；facet 与收藏恢复独立完成；七层兼容性共享一次路径计算；服务端按群组/目录类型/发布批次/可见性复用只读快照，失败请求不入缓存。
- 验证：目录定向测试 43 项通过，Web/API typecheck、build、ESLint、任务文件 Prettier 通过；API MySQL 集成因本机无测试数据库跳过；`pnpm smoke:browser` 因本机端口监听被系统拒绝/5173 无服务未进入产品断言，`smoke:check-core` 通过；正式域名只读复核首次打开约 295ms、筛选面板约 299ms、人员切换约 292ms，空闲态无联系人卡片且无浏览器断言错误。
- 发布与核验：代码 checkpoint `99f222d` 已推送；生产备份 archive `7fcbc271-02ce-4e3b-b7e5-2352be497ba2`（53 表、161466 行、76309276 bytes，SHA-256 `c65b201fdb7f5a7838eff59cef6af13f7b1181de93a6984cc98464b7e27318c6`）后部署 release `99f222d1ac4a0d83d4ab970fae3a0db845cbd4a1`，迁移、容器健康、artifact hash、域名隔离、无旧依赖和 53 表迁移检查均通过；文档 checkpoint 待单独发布。
- 当前状态：已完成（含运行验证）→ 待用户复核。checkpoint 识别消息为 `perf(directory): defer facet rendering and cache snapshots`。完成后停止，不开始其他批次。

## 2026-08-22 P3-G 管理员 URL Link ticket 与 Mini admin-bind（当前批次）

- 范围：只新增平台管理员生成单次 binding ticket/URL Link、Mini `admin-bind/preview` 脱敏预览和 `confirm` 新 code 主动确认；不实现管理员/小程序页面、不关闭公开注册、不提交审核或正式发布。外部 URL Link 有效期不作为授权边界，服务端 ticket 严格 10 分钟。
- 安全语义：0047 `wechat_admin_binding_tickets` 只存 SHA-256 ticket hash、target user、当前 AppID、pending/consumed 和 expiry；preview 不消费、不写 identity，只返回 masked realName/username。confirm 在 ticket 行锁事务内验证 target active/password/profile、exchange current Mini code、复用 resolver 的显式 detached 规则、绑定 identity/Union、审计、签发 scoped session，再消费 ticket；URL 本身不完成绑定。
- 冲突/回滚：篡改/不存在 401、重放 409、过期 410、非管理员/无 password target 403、code 属于其他 user 409；所有失败保持 ticket pending、无 identity 合并。P3-E detachment 可由 target 的显式 confirm 清除，其他渠道和业务引用保持。
- 验证：contracts 11 项，0047/schema/package 静态 19 项，真实 MySQL admin-bind 4、P3-E/F 15、migration/client 21 项通过；受控非 integration 全仓 155 文件/855 项通过，2 文件/19 项按环境跳过。精确 clean worktree 的 frozen install、root build/typecheck/lint、Mini 15 文件/63 项及 verify/source/2 Worklets/package/determinism/CI dry-run 通过（147968 bytes，manifest `0045ce853e9dd6d7bac9da95ee50a6715fa9bb70c8aec3fd3bd583c024b8d33f`）；Windows clean worktree 的 `format:check` 受全仓 CRLF 基线影响，未修改基线文件。
- 运行/浏览器验证：`pnpm smoke:browser` 在共享工作区本机 5173 无服务，于第 1/6 步 `ERR_CONNECTION_REFUSED`，未进入产品断言；`pnpm smoke:check-core` 已通过。本批无模板、样式或页面变化，不需要人工视觉确认。
- checkpoint 与发布：代码 checkpoint `668103c`（`feat(auth): add admin mini binding ticket`）已推送；发布前加密备份 `5d02a3cb-5eb3-41f7-8572-3a1bdfcfd7f3`（53 表、161465 行、76308616 bytes，SHA-256 `0f83718e5bd0987502a0877ae91e656e8b07c510f814140d674c44d9d7cec43c`）后部署 release `668103c2b6aabd72493f20c9a61f9c327e9c0d3a`。随后并行 Web 目录 checkpoint `99f222d` 作为其直接子提交进入生产，未改动 P3-G；最终 `HEAD`、`origin/main`、服务器 `current-release` 均为 `99f222d1ac4a0d83d4ab970fae3a0db845cbd4a1`，对该最终 release 重跑 `ecs-verify.sh` 通过 47 migrations、54 业务表，identity/detachment/link/Union/admin-ticket 均 0，未调用真实微信 code 或写业务数据。无 Mini runtime 变化，本轮不上传体验版。
- 当前状态：P3-G 非 UI 实现、生产发布和只读核验已完成；不实现管理员/小程序页面，暂停等待 Web 登录/平台账号后台和 Mini 登录/绑定/建档黄金稿人工视觉确认。

## 2026-08-22 P3-F 管理员账号状态与 password/code proof（当前批次）

- 范围：只新增平台管理员脱敏账号列表、`PUT /platform-admin/users/:userId/password-identity` 用户名分配，以及 `PUT /me/password` 当前密码或新微信 code proof；不关闭公开注册、不做管理员 URL Link、Mini 页面或 Web/Mini UI。
- 账号分配：列表只返回 id/status/authVersion/username/hasPassword，不返回姓名、联系方式或密码 hash。管理员可给无 credential 用户创建 nullable password credential，并在 locator 为空时补 `password_<userId>`；已有用户名同值幂等，重复用户名 409，后台 developer admin 不可被此接口改名。用户名或 locator 变化递增 authVersion/version并写审计。
- password proof：currentPassword 与 code 为严格互斥联合；current proof 保持既有校验语义，code proof 在同一事务内 exchange、锁定当前 Mini AppID identity、更新 scrypt hash、递增 authVersion/version、写审计。首次设密必须先有管理员分配的 username，错误 proof/错误身份/双 proof 均失败关闭，旧 session 立即失效。
- 测试先行与验证：contracts 7 项、真实 MySQL P3-F 5 项通过，覆盖脱敏列表、预分配 locator、管理员权限/重复用户名、current/code proof、旧 session、错误 proof 回滚。既有 `platform-admin.integration` 10 项中 9 项通过，唯一失败仍为原有 backup fixture 重复固定 contact UUID；与本批新增方法无调用关系。
- 根/Mini 门禁：root build/typecheck/lint、client generated freshness、受控非 integration 154 文件/851 项通过，2 DB 文件/19 项按环境跳过；Mini 15 文件/63 项、typecheck、verify/source/2 Worklets/package/determinism/CI dry-run 通过（147968 bytes，manifest `ea3d3ffb4770138206ae9faee3efd44b1653c2f0e98ca699744c4665726b954b`）。根 format 仍精确只有既有/用户所有 11 项阻塞；Mini 运行源码未变，不新增体验上传。
- 运行/浏览器验证：`pnpm smoke:browser` 已运行，本机 5173 无服务，在第 1/6 步 `ERR_CONNECTION_REFUSED`，未进入产品断言。本批无模板、样式或页面变化，不需要人工视觉确认；`smoke:check-core` 待本记录落盘后复核。
- checkpoint 与发布：代码 checkpoint `0225e0e`（`feat(auth): require admin password proof`）已推送；精确 clean worktree production build/package 通过。加密备份 archive `2e4b0172-0fcd-4df6-8510-6e001f705a60`（53 表、161459 行、76304648 bytes，SHA-256 `9b0ffc05d9643ecd7c83c55d1bdcab54d0d1e02a318e042f977b066be0cf65c0`）后部署 release `0225e0e79ae9838fe8c27dcb01a7808bea9ec98e`；预热首个 502 后恢复，`ecs-verify.sh` 完整通过。
- 生产只读复核：46 migrations/53 业务表，detachment/linkToken/identity/Union 均 0 行，40 用户 authVersion 全 1，24 密码 hash 非空且聚合不变；未调用真实微信 code、未写生产业务数据，精确远端目录已删除、本地 worktree 已注销。
- 当前状态：P3-F 已完成回归、推送、生产备份/部署和 password/code proof 不变量核验；最终状态 checkpoint 识别消息：`docs(status): record admin password proof deployment`。本状态文档 checkpoint 将作为最终 docs-only release 对齐，下一批只做管理员 URL Link/Mini admin-bind 的非 UI 后端，之后暂停等待视觉黄金稿人工确认。
- 下一活动批次与停止条件：只有管理员 URL Link ticket、Mini admin-bind preview/confirm 的非 UI contracts/service/审计，且不实现页面；完成后暂停，等待 Web 登录页/平台账号后台与 Mini 登录/绑定/建档黄金稿人工视觉确认。

## 2026-08-22 P3-E 当前 Mini AppID 解绑（当前批次）

- 范围：只实现用户/平台管理员解除当前正式 Mini AppID identity 的后端 contracts、fresh code/管理员原因、可用 Web 密码前置、Idempotency-Key、审计、authVersion 递增和旧 session 失效；不关闭公开注册、不做管理员绑定 ticket/password proof 或任何 UI。ADR-0004 的“无注销”边界保持不变。
- 安全设计：新增 0046 `wechat_identity_detachments`，只存 provider/AppID/subject SHA-256/userId，唯一约束当前 AppID 与用户；删除 identity 时清空 legacy `wechat_openid` 镜像但保留用户、profile、password、Union、Web/其他 Mini identity 和业务引用。普通登录遇 detachment 返回 `link_required`，不会经 Union 自动回挂；正确密码显式 link-password 才能同事务清除标记并重绑。
- 用户/管理员语义：用户 `POST /me/wechat/miniprogram/unbind {code}` 要求新的微信 code、当前 active user 和可用 password；管理员 `POST /platform-admin/users/:userId/wechat/miniprogram/unbind {reason}` 要求平台权限、目标未删除且有 password。两者只匹配当前 AppID；缺少身份、跨 AppID、Union/subject 错配、无密码均失败关闭。
- 幂等/并发：Idempotency-Key 必须 UUID；code exchange、identity/标记锁、密码前置、删除、authVersion、审计和 completed result 在同一事务。相同 key 同 fingerprint 返回同一 `{unbound:true}`，不同 body 409；用户在第一次成功后用密码会话可安全重试，重复不会再次递增版本或审计。
- resolver 等价：`resolveInTransaction` 默认拒绝被解绑标记的 Mini identity；显式 link-password/register 以 `allowDetachedIdentity` 复用同一调用方事务，并只允许原 user 清除标记。原 `resolve()` 的空 AppID 前置拒绝、receiver、事务、调用顺序、返回和错误保持。
- 测试先行与验证：旧代码上 contracts/schema 3 项失败，5 个实际新路由场景返回 404；实现后静态 contracts/schema/package 15 项，真实 MySQL 解绑 6、既有微信 22、linkToken 4、邀请 7、migration/client 19 项通过。受控非 integration 全仓 153 文件/848 项通过，2 文件/19 项按环境跳过；既有 `platform-admin.integration` 10 项中 9 项通过，唯一失败为原有 backup fixture 重复固定 contact UUID，与本批无调用关系。
- 根/Mini 门禁：根 build/typecheck/lint、client generated freshness、Mini 15 文件/63 项、typecheck、verify/source/2 Worklets/package/determinism/CI dry-run 通过（147968 bytes，manifest `82c894febd7d7991d8ae381d5e8b6c4b5a048acc706e8e0878e4f1ae295486be`）；任务 Prettier/`git diff --check` 通过，根 format 仍精确只有既有/用户所有 11 项阻塞。Mini 运行源码未变，不新增体验上传。
- 运行/浏览器验证：`pnpm smoke:browser` 已运行，本机 5173 无服务，在第 1/6 步 `ERR_CONNECTION_REFUSED`，未进入产品断言。本批无 Web/Mini 模板、样式或页面变化，不需要人工视觉确认；`smoke:check-core` 待本记录落盘后复核。
- checkpoint 与发布：代码 checkpoint `15ee912`（`feat(auth): enforce current mini identity unbind`）已推送；精确 clean worktree production build/package 通过。加密备份 archive `03d4a0f7-cefa-48c6-a835-f34d0e69e8db`（52 表、161456 行、76302488 bytes，SHA-256 `df942df399b6af301d941e99e2883cef1f50c1f762dc75582c3f4c48b602b58d`）后部署 release `15ee912f5ed3b57855fa3919c58fada218f78d00`；预热首个 502 后恢复，`ecs-verify.sh` 完整通过 46 migrations。
- 生产只读复核：用户/管理员新路由未认证探测均为 401；46 migrations/53 业务表，detachment/linkToken/identity/Union 均 0 行，40 用户 authVersion 全 1，24 密码 hash 非空且聚合不变；未调用真实微信 code、未写生产身份，精确远端目录已删除、本地 worktree 已注销。
- checkpoint 与发布：代码 checkpoint `15ee912` 已推送；精确 clean worktree production build/package 通过。加密备份 archive `03d4a0f7-cefa-48c6-a835-f34d0e69e8db`（52 表、161456 行、76302488 bytes，SHA-256 `df942df399b6af301d941e99e2883cef1f50c1f762dc75582c3f4c48b602b58d`）后部署 release `15ee912f5ed3b57855fa3919c58fada218f78d00`；预热首个 502 后恢复，`ecs-verify.sh` 完整通过 46 migrations。
- 生产只读复核：用户/管理员新路由未认证探测均为 401；46 migrations/53 业务表，detachment/linkToken/identity/Union 均 0 行，40 用户 authVersion 全 1，24 密码 hash 非空且聚合不变；未调用真实微信 code、未写生产身份，精确远端目录已删除、本地 worktree 已注销。
- 当前状态：P3-E 已完成回归、0046 迁移、推送、生产备份/部署和解绑不变量核验；最终状态 checkpoint 识别消息：`docs(status): record current mini identity unbind deployment`。文档 release 待对齐后进入管理员账号/密码 proof 后端批次。
- 下一活动批次与停止条件：只实现平台管理员脱敏账号状态/用户名分配和 `/me/password` 当前密码或新微信 code proof；不做管理员 URL Link、Mini 页面或公开注册关闭。authVersion、密码 hash、管理员权限、审计、并发和旧 session 测试通过后，进入首个 Web/Mini 视觉黄金稿暂停点。

## 2026-08-22 P3-D linkToken 消费与显式建档（当前批次）

- 范围：只新增 `POST /auth/wechat/link-password` 和 `POST /auth/wechat/register` 的严格 contracts、原子 linkToken 消费、密码 proof、真实姓名建档和 authenticated response；不做管理员 ticket/URL Link、密码修改 proof、解绑、公开 Web 注册关闭或任何页面。该子步对应身份预检 P3-C 第 2 项，当前状态沿用 P3-D checkpoint 标签。
- 引入点与测试先行：微信登录/identity resolver/密码登录分别来自 `39f9c66`、`4416f79`、`de3ad5f`，一次性 linkToken 来自 `3919050`。新 contracts 在旧代码先 1 项失败；真实 MySQL 新增 7 个端点场景在旧路由全部返回 404。实现后的契约要求 linkToken 非空且有界、用户名沿用既有 trim/格式、真实姓名 trim 后 1–100 字，两个端点只返回完整 `authenticated` 结果。
- 密码绑定：在 linkToken 行锁事务内规范化用户名并验证 active、未删除、有资料且有非空 hash 的密码账号；错误用户名/密码统一 401 且 token 保持 pending，可用正确 proof 重试。成功时只把当前 `(Mini provider, AppID, openid)` 和可选 UnionID 绑定到该业务用户，保留其 profile/authVersion，签发同版本 scoped session 并写脱敏审计；token 已绑定其他 user、legacy openid 不同或 Union 归属冲突均 409 且不合并。
- 微信建档：未知 identity 原子创建 synthetic locator 的 active user、真实姓名 profile、当前 AppID identity、可选 Union account 和审计，不创建 password credential；已知 identity/Union 且无 profile 时只补原 user 的 profile，不创建第二个用户。重复 profile、已绑定冲突和 suspended/deleted user 失败关闭；入群仍由后续完全同名预设成员规则决定。
- 事务/并发：resolver 新增复用调用方事务的入口，原 `resolve()` 仍保持空 AppID 在开事务前拒绝、单事务、查询/回调顺序、返回对象和 duplicate→409 语义。linkToken 锁、密码/建档、identity/Union/legacy openid、审计、session 签发和 consumed 更新属于同一事务；签名 secret 缺失会全部回滚。同 token 并发只有 201/409 各一，篡改 401、过期 410、重放 409，失败均不泄露存储身份。
- 验证：contracts/API typecheck、生成 freshness、根 build/typecheck/lint 通过；contracts/密码/路由/gateway/Web 微信 5 文件/36 项，真实 MySQL identity 22、linkToken 4、邀请 7、database migration/client 19 项通过。受控非 integration 全仓 152 文件/845 项通过，2 个 DB 文件/19 项按该命令环境跳过；默认显式文件运行仍会扫描用户所有 `runtime/**` 历史副本，受控命令排除且未修改副本。
- Mini/门禁：Mini 运行源码与生成 client 未变；15 文件/63 项、typecheck、verify/source/2 Worklets/package/determinism/官方 CI dry-run 通过（147968 bytes，manifest `254d964d5f368f185fb5556642c6b2b3d20fd96b0f58b7c47b67fe03ddacac3b`）。本 checkpoint 不需要新增体验上传；上一体验版仍为 `0.1.0-p3.20260822.49`。
- 运行/浏览器验证：`pnpm smoke:browser` 已运行，本机 5173 无服务，在第 1/6 步 `ERR_CONNECTION_REFUSED`，未进入产品断言。本批无 Web/Mini 模板、样式或页面变化，不需要人工视觉确认；任务 Prettier/ESLint/`git diff --check`/`smoke:check-core` 通过。根 format 仍精确只有既有/用户所有 11 项阻塞。
- checkpoint 与发布：代码 checkpoint `2fc9c16`（`feat(auth): complete explicit wechat linking`）已推送；精确 clean worktree production build/package 和依赖构建顺序复核通过。加密备份 archive `94ed7fdd-645e-4c0c-913d-4a911f04c018`（52 表、161454 行、76301168 bytes，SHA-256 `94afd1c97a7794dd2e8105557c659c5f443b199fe009ae927b879d6c6e40458e`）后部署 release `2fc9c164e716bea4b00c4eaf5bb32d67109cd93e`；预热首个 502 后恢复，`ecs-verify.sh` 完整通过 45 migrations。
- 生产只读复核：两个新路由以空 JSON 均返回 400 `VALIDATION_FAILED`，未进入 token/identity 事务；linkToken/identity/Union 仍为 0，40 个 authVersion 全 1、legacy Mini 仍 1、24 个密码 hash 非空且聚合发布前后不变，52 个业务表不变。未调用真实微信登录、未写业务身份数据，精确远端目录已删除、本地 worktree 已注销。
- 当前状态：P3-D 已完成回归、推送、生产备份/部署和无隐式身份写入核验；最终状态 checkpoint 识别消息：`docs(status): record explicit linking endpoints deployment`。该文档 checkpoint 推送并按根规则作为 production release 对齐后进入当前 AppID 解绑批次。
- 下一活动批次与停止条件：只实现用户/平台管理员“解除当前 Mini AppID identity”服务端 contracts、code proof/原因、可用 Web 密码前置、幂等、审计和 authVersion 递增；必须保留用户、资料、用户名、群组、排班、审计与其他渠道。不得关闭公开注册、实现管理员绑定 ticket/password proof 或 UI；并发、错误 code、跨 AppID、旧 session 失效和业务引用不变量通过后停止。

## 2026-08-22 P3-C 显式微信关联与无注销边界（当前批次）

- 范围：只把 Mini 登录改为 `authenticated | link_required` 判别联合，建立 10 分钟单次哈希 linkToken 基础并移除真实账号注销 contract/service/route；不实现 link-password/register 消费端点、解绑、管理员账号 API、Web 登录页或 Mini 页面。公开密码注册暂保留到同步视觉批次。
- 测试先行：新 Mini contract、错误码、脱敏、schema 与 link service 在旧实现共 8 个断言/模块失败；未知登录旧实现仍自动建号；注销保留测试旧实现返回 200 并删除数据。实现后静态/contract/client 8 文件/29 项，真实 MySQL linkToken 4 项、身份 14 项、邀请 7 项、无注销 1 项、全迁移 17 项通过。
- 登录语义：未知 `(appId,openid)` 且无 Union 归属时只写 `wechat_link_tokens`，返回 `{status:'link_required',linkToken,expiresAt}`，不写 users/profile/identity/Union/audit，也不签 session。已知 identity/Union 且有 profile 返回 `{status:'authenticated',token,expiresAt,profile}`；已知但无 profile 也返回 link_required，并在 token 记录中绑定 existing user，等待下一批显式建档。password 与 Web 微信旧 response schema 已独立，行为不变。
- linkToken 安全：数据库只存 SHA-256、AppID/subject/可选 Union/existing user、pending/consumed 与到期时间，不存 raw token。消费事务行锁保证并发只有一次成功；后续关联操作失败会连同 consumed 状态回滚；无效/已用/过期分别为 typed 401/409/410。`linkToken`/`unionId` 加入深层/Pino 脱敏；新错误码同源生成到 client-core。
- 无注销：`DeregisterAccountResult`、`deregisterOwnAccount` 和 `/users/me/deregister` 已从生产 contract/service/routes 删除。404 集成证明用户 locator/status/profile/contact/audit 均不变；仓库生产 TS/Vue 无注销入口。解绑仍待后续专用接口，不以注销替代。
- schema/migration：新增 0045 `wechat_link_tokens`；迁移数 45、业务表 52，全部 test DB reset 同步。根 build/typecheck/lint 通过；受控非 DB 全仓 156 文件/854 项通过，33 文件/279 项按环境跳过。
- Mini/门禁：代码 checkpoint `3919050`（`feat(auth): require explicit wechat linking`）和 Windows 修复 checkpoint `c4da389`（`fix(miniprogram): keep visual comparer importable on Windows`）均已推送。从精确 `c4da389` clean worktree 通过 contracts build、client generated freshness、Mini typecheck、15 文件/63 项、verify/source/2 Worklets/package/determinism/官方 CI dry-run；包体 151108 bytes，manifest `365e3f6e476ad7525b91322f3a48d9bd4ec8d84ea69367425e89969024a70168`。
- Windows 干净检出回归：`3919050` clean worktree 在 Vitest 导入 `visual-compare.mjs` 时因首行 shebang 被 Git 检出为 CRLF 而报语法错误；`git log -S`/`git blame` 定位为 `c8d50f5` 引入。新增源文件首字符回归在旧代码先失败，删除仅由 `node scripts/visual-compare.mjs` 调用的冗余 shebang 后通过；直接 CLI 入口、参数、异步错误、输出与退出码不变。修复后的 CRLF clean checkout 无需改工作树即可导入并通过。
- 运行/浏览器验证：`pnpm smoke:browser` 已在修复后重跑，本机 5173 无服务，在第 1/6 步 `ERR_CONNECTION_REFUSED`，未进入产品断言。本批无模板/样式/页面变化，不需要人工视觉确认；任务 Prettier/ESLint/`git diff --check`/`smoke:check-core` 通过，根 format 仍只有既有/用户所有 11 项阻塞。
- 微信体验版：上传前 ipify/AWS 公网 IPv4 均为 `103.54.154.21`；从精确 `c4da389` worktree 使用仓库外私钥和本地 Node `miniprogram-ci` 上传 `0.1.0-p3.20260822.49` 成功（50 个代码文件、zip 38678 bytes，manifest `7e528f42e16972f25625028e2c6d952e5a4f989ae6ea2c5aaea6ca4b35e9c508`）。未使用 ECS/微信开发者工具，未提交审核或正式发布。
- 生产发布：加密备份 archive `f61cbf8b-ff3c-415a-8091-3829ecd24747`（51 表、161452 行、76299680 bytes，SHA-256 `79009b0cbb89c7d5215ef4077d7e30842a4b3f13e094493dce2ecf5be6c08ccd`）后部署 release `c4da3896f40a8273b1b9d4ccbcff1f96cdf63b09`；预热首个 502 后恢复，`ecs-verify.sh` 完整通过。生产为 45 migrations/52 业务表，linkToken 表 0 行、identity/Union 0 行、40 个 authVersion 全 1、legacy Mini 仍 1、24 个密码 hash 均非空且发布前后聚合不变；未登录或触发微信身份写入，精确远端目录已删除、本地 worktree 已注销。
- 当前状态：P3-C 已完成回归、体验上传、生产迁移/部署和只读不变量核验；最终状态 checkpoint 识别消息：`docs(status): record explicit wechat linking deployment`。该文档 checkpoint 推送并按根规则作为 production release 对齐后进入 P3-D。
- 下一活动批次与停止条件：只做 P3-D `/auth/wechat/link-password` 与 `/auth/wechat/register` 的 linkToken 消费、密码 proof 和真实姓名建档；不得做管理员 URL Link、解绑、公开 Web 注册关闭或任何 UI。过期/篡改/重放/并发、用户名密码错误、Union 冲突、已有/新用户事务与 authVersion 测试通过后停止。

## 2026-08-22 P3-B 版本化会话与 AppID identity（当前批次）

- 范围：只增加 JWT `authVersion/appId`、逐请求版本/identity 校验、Mini/Web AppID resolver、Union account 关联和 legacy 精确惰性认领；未知微信仍保持现有 `isNewUser` 自动建号结果，不改 contracts、路由、公开注册、注销/解绑或 UI。
- 测试先行：新 claim/gateway 门禁在旧实现 19 项中 3 项失败；真实 MySQL 身份场景在旧实现 11 项中 5 项失败，分别暴露无版本校验、AppID 不生效、legacy identity 不 scoped 和 Mini/Web 同 Union 触发旧唯一键 500。实现后 auth/password/gateway/Web state 与身份/邀请 6 文件/49 项、真实 MySQL 身份 14 项和邀请 7 项全通过。
- 会话语义：新 password token 写 `authVersion`，新 Mini/Web token 同时写 provider AppID；旧 token 缺版本按 1、旧 Mini token 缺 AppID 按 legacy openid 兼容。认证每次核对用户 active/deleted/authVersion；新微信 token 还必须精确匹配 `(provider, appId, subject, userId)` identity。版本增加后新旧 token 都立即 401；dev token 兼容不变。
- identity/Union：Mini gateway 只公开 AppID，AppSecret 改为 ECMAScript private field；共享 resolver 在事务内优先精确 identity，再认领 null-AppID/legacy openid，再按 `wechat_union_accounts` 关联，最后才沿用旧建号。新 identity 的 legacy `union_id` 保持 null，Mini/Web 同自然人以一条 Union account + 两条 scoped identity 落库；跨用户 Union 冲突 409 且不合并。生产现有 legacy Mini 用户只在本人下次精确登录时惰性补 identity。
- 邀请兼容：账号合并在同事务移动 source identity/Union 到 target，并按 target authVersion 签发 scoped token；目标不存在或唯一约束冲突失败关闭。群组/资料/旧 response、异步错误和 API 调用次数保持。
- 验证：根 build/typecheck/lint 通过；受控非 DB 全仓 155 文件/852 项通过，32 文件/275 项按环境跳过。Mini 15 文件/62 项及 verify/source/2 Worklets/package/determinism/官方 CI dry-run 通过（147887 bytes，manifest `ce7530de82ec5f4cb5d755bb82776231ce22a1034a8bc1d063a060d0348b400f`）。任务 Prettier/`git diff --check`/`smoke:check-core` 通过；根 format 仍只有既有/用户所有 11 项阻塞。
- 运行/浏览器验证：`pnpm smoke:browser` 已运行，本机 5173 无服务，在第 1/6 步 `ERR_CONNECTION_REFUSED`，未进入产品断言。本批无模板/样式/页面变化，不需要人工视觉确认。
- checkpoint 与发布：代码 checkpoint `4416f79`（`feat(auth): version scoped identities`）已推送；精确干净 worktree production build/package 通过。数据库备份 archive `e4a7cee1-95ed-48b5-a7c9-50592be31aea`（51 表、161450 行、76298360 bytes，SHA-256 `d8813940663d3f939172a8bdacab6591776acbef47771623a6f79adf6a44b743`）后部署 release `4416f79be3764f510a0ef04fad56ed997e43841a`；预热首个 502 后恢复，`ecs-verify.sh` 完整通过 44 migrations。
- 生产只读复核：部署前后 identity/Union 行均为 0、40 个 authVersion 均为 1、legacy Mini 无 identity 仍为 1 个、24 个 password hash 聚合摘要仍为 `afcb01bb10ea0bd96b3b1bd08772c14575c6f7c3ab5f5149f765bf870260dcbb`。未登录、未调用真实微信、未触发惰性认领或写业务数据，精确临时目录已删除。
- 当前状态：P3-B 已完成回归、推送、生产备份/部署和无隐式身份写入复核；本轮不修改 Mini 产物代码，不新增体验上传，也无人工视觉确认点。最终状态 checkpoint 识别消息：`docs(status): record scoped identity deployment`。
- 下一活动批次与停止条件：只做 P3-C 哈希 linkToken、未知 Mini `link_required` 和账号注销代码/API 移除；保留密码登录及当前 Web 注册页到同步视觉批次，不实现绑定/解绑确认、管理员账号页或 Mini 页面。未知登录不建号、token 过期/篡改/重放/并发与无注销测试通过后停止。

## 2026-08-22 P3-A 加法式身份基础（当前批次）

- 范围与引入点：只实现预检批准的 additive schema、受限 legacy locator backfill 和 nullable password 防御；不改登录 response、路由、JWT、公开注册、注销/解绑行为或 UI。identity/password/JWT 旧形态分别来自 `12e7f40`、`de3ad5f`、`39f9c66`。
- 测试先行：identity foundation 静态门禁旧实现 4/4 失败；预分配 username 的 null hash 在旧 password service 会触发 `null.split()`，新增 7 项中 2 项失败；迁移计数 verifier 旧实现 1/3 失败。实现后专项 3 文件/14 项、真实 MySQL 全迁移/回填/冲突 17/17 通过。
- schema/migration：新增 `users.auth_version=1`、可空 identity `app_id` 过渡列与索引、`wechat_union_accounts`（UnionID/userId 分别唯一）、nullable `password_hash`，保留 legacy identity UnionID 列/唯一索引。SQL 先用临时 CHECK 门禁 locator 碰撞与单用户多 UnionID，再只为 active、未删除且已有 password credential 的 null locator 写 `password_<userId>`；无凭证用户不动，旧 hash 字节不变。迁移数为 44，表数为 51。
- 运行语义：既有非空密码登录/状态/改密路径不变；预分配但无 hash 的账号现在稳定返回“无密码”/无效登录，当前密码 proof 返回 403，不再抛 TypeError。27 个集成 reset 补齐 union/identity/password 清理，只改变测试隔离，不改变产品。
- 验证：根 build/typecheck/lint 通过；受控非 DB 全仓 154 文件/848 项通过，32 文件/268 项按环境跳过。Mini 15 文件/62 项及 verify/source/2 Worklets/package/determinism/官方 CI dry-run 通过（147887 bytes，manifest `d235758236e918b96a52b4056be9817747412a15480f5935b91b4cdc59fc212b`）。任务 Prettier、`git diff --check` 与 `smoke:check-core` 通过；根 format 仍只有既有/用户所有 11 项阻塞。
- DB 集成说明：P3 migration 17/17；其余主工作区 integration 240 项通过。另有 6 个文件/10 项既有断言或 fixture 独立复现失败：旧 contact `confirm` 字段、姓名并发仍期待可自改、developer admin 使 owner/用户计数假设失效、平台注销/备份 fixture、calendar preferences 未检查配置响应；均早于本批且调用点未改，不在身份 schema checkpoint 顺手修订。用户所有 `runtime/` 副本会产生同名旧 reset 失败，受控命令显式排除且未修改副本。
- 运行/浏览器验证：`pnpm smoke:browser` 已运行，本机 5173 无服务，在第 1/6 步 `ERR_CONNECTION_REFUSED`，未进入产品断言。本批无模板/样式/页面变化，不需要人工视觉确认。
- checkpoint 与发布：代码 checkpoint `297ec33`（`feat(auth): add identity security foundation`）已推送；精确干净 worktree production build/package 通过。迁移前聚合精确为 43 migrations、0 identity、5 个目标 null locator、0 locator/Union 冲突。数据库备份 archive `e39ec634-be53-4536-891b-c729dee78aa6`（50 表、161448 行、76295676 bytes，SHA-256 `81f186d12654c15f5a93436ec7e51fe6260316c9453a9e6a60496a642e58899e`）后部署 release `297ec3356c9b7717cdb2c5f9c2326cfcfabca74c`；预热首个 502 后恢复，`ecs-verify.sh` 完整通过。
- 生产迁移复核：44 migrations/51 表；0 identity/0 Union 行；目标 null locator 从 5 降为 0，active password locator 从 19 增为 24；9 个无凭证 active null locator 保持；24 个 password hash 均非空且聚合摘要迁移前后同为 `afcb01bb10ea0bd96b3b1bd08772c14575c6f7c3ab5f5149f765bf870260dcbb`。40 个用户 `auth_version` 均为 1，appId/hash nullability 与 schema 一致，精确临时目录已删除。
- 当前状态：P3-A 已完成回归、推送、生产备份/迁移/部署和数据不变量复核；无 Mini 产物代码变化，不新增体验上传，也无人工视觉确认点。最终状态 checkpoint 识别消息：`docs(status): record p3 identity foundation deployment`。
- 下一活动批次与停止条件：只做 P3-B 版本化 session 与 AppID identity resolver；新 token 写 `authVersion/appId`，旧 token 缺版本按 1 兼容，认证逐次核对 active/deleted/version，legacy Mini 仅精确惰性认领。不得实现 link-required、绑定/解绑、路由或 UI；旧 Web/上一 Mini 会话兼容和安全测试通过后停止。

## 2026-08-22 P3 身份安全预检（当前批次）

- 同步与范围：预检开始时本地 `HEAD`、`origin/main` 与生产 `current-release` 均为 `98ce251`；只读审计 contracts、schema/migrations、JWT/auth port、密码/Mini/Web 微信服务、用户/平台路由、Web 登录和生产聚合数据。未写生产数据、调用真实微信登录、修改接口或 UI。
- 引入点：`12e7f40` 引入无 appId 且 UnionID 直接唯一的 identity；`39f9c66`/`12e7f40` 让未知 Mini 自动建号；`de3ad5f` 引入匿名密码注册；`a837586` 引入真实注销；`39f9c66` 的 30 天 JWT 无 `authVersion`。这些均早于已批准 Mini 迁移计划/ADR，P3 必须收口。
- 生产聚合：40 用户（34 active/2 suspended/4 deleted），35 有资料；24 个 active 密码身份均为规范用户名、独立 scrypt hash。19 个已有 password locator，5 个 locator 为 null 且资料/active membership 完整，当前会被密码登录错误拒绝。identity 表为 0；1 个 legacy Mini stub 无资料和业务引用，仅有创建审计；另 9 个无登录资料用户无 active membership，全部保留不自动处理。生产 Mini/会话/平台配置存在，Web 微信配置不存在；未输出任何实际标识或 secret。
- 结论与顺序：先做向后兼容 P3-A（`auth_version`、identity `app_id` 过渡列、`wechat_union_accounts`、nullable password hash、只补 5 个 password locator），再做版本化 session/identity resolver、link-required/绑定/解绑和管理员/password proof。tightening migration 单独后置。完整证据见 [`p3-identity-security-preflight.md`](../apps/miniprogram/docs/architecture/p3-identity-security-preflight.md)。
- 视觉停止点：Web 仅登录页和平台账号后台黄金稿是首个需用户确认的前端批次；Mini 登录/绑定/建档/解绑页面随后逐页确认。P3-A 不改视觉。
- 验证：Git history/blame、schema/route/session 调用点和生产只读聚合审计完成；任务 Prettier、`git diff --check` 与 `smoke:check-core` 通过，根 `format:check` 仍只有既有/用户所有 11 项阻塞。本批未改核心链路或页面，不运行新的产品浏览器断言。
- 当前状态：只读预检完成，待 checkpoint `docs(miniprogram): record p3 identity preflight` 推送和 ECS 文档 release 对齐；无 Mini 产物修改，不新增体验上传。
- 下一活动批次与停止条件：只实施 P3-A 加法式 schema/Drizzle/migration 测试与 5 个 locator 的确定性受限 backfill；不得改变登录 response、路由或 UI。旧代码兼容、迁移前置聚合、回滚和全仓/生产迁移验证通过后停止该安全 checkpoint。

## 2026-08-22 P2 共享核心完成审计（当前批次）

- 同步基线：审计开始时本地 `HEAD`、`origin/main` 与生产 `current-release` 均为 `7acbb95`；远端没有新增 Web 提交。用户所有未提交 Mini 配置、workspace、目录/个人页/护士 Storybook、`runtime/`、`src/` 和工作簿未修改或纳入。
- presentation-core：日历字符串/CST 语义、5/6 周月格、周/列表 ViewModel、筛选/分组；手排 Map transition、选择和两类撤销；发布草稿/历史分组、过去日期/确认门禁和请求 intent 均已由 Web 先行采用。黄金 fixtures 与旧实现/共享实现锁定对象身份、输入顺序、`??`、排序、时钟调用次数、同步/错误/副作用等价；Mini 复用 replace 模式单格 transition。
- client-core/tokens：三个现有月历/节假日 GET 端点、service、transport 接口、共享错误、contracts 生成紧凑 decoder 与黄金 API 响应已由 Web 先行采用；Mini `wx.request` 明确校验 Bearer/public、2xx、错误体、无效响应和网络/bridge 错误。CSS/WXSS tokens 单源生成。presentation/client/domain browser bundle 与 Mini 包均无 contracts barrel、Zod、Vue/Pinia/Router、DOM、fetch、Node 或数据库运行依赖。
- 最小边界结论：P2 停止条件已满足，不扩张为大而全 client-core。token/401 单飞重登归 P3/P4，幂等写与退避随 P5–P7 实际调用点迁移，downloadFile/FileSystem 随 P9 导出迁移；P10 承接迁移计划后新增 Web 功能。
- 验证：presentation/client/tokens build/typecheck 与 generated freshness 通过；P2 专项 14 文件/55 项、受控全仓 153 文件/842 项通过，32 文件/265 项数据库集成按环境跳过。Mini 15 文件/62 项及 typecheck/verify/source/2 Worklets/package/determinism/官方 CI dry-run 通过（147887 bytes，manifest `44e00e35fbbe675c4125484afb2f6ecb8ee7400c268afd731fb61b209dc251a8`）；任务 Prettier、`git diff --check` 和 `smoke:check-core` 通过。根 `format:check` 仍只有既有/用户所有 11 项阻塞。默认 Vitest 仍会扫描用户所有 `runtime/`/`.artifacts/` 历史副本，受控命令显式排除；未修改副本。
- 运行/浏览器验证：`pnpm smoke:browser` 已运行，本机 5173 无服务，在第 1/6 步 `ERR_CONNECTION_REFUSED`，未进入产品断言。审计只改阶段文档，没有模板、样式、页面或运行逻辑变化，不需要人工视觉确认。
- 当前状态：P2 可由文档 checkpoint `docs(miniprogram): close p2 shared core` 正式关闭；本轮未修改 Mini 产物，不新增体验版上传。该 checkpoint 推送并按根规则完成生产备份、部署和 `ecs-verify.sh` 后进入 P3。
- 下一活动批次与停止条件：只做 P3 身份安全预检，核对现有身份表/迁移、provider/appId/subject 与 UnionID 冲突、公开注册、会话 `authVersion`、管理员分配用户名和生产数据风险；先形成不写生产数据的实施顺序与回滚门禁，遇到高影响公共接口或数据修复选择先询问用户。

## 2026-08-22 P2 scheduling-domain barrel 解耦（当前批次）

- 完成审计与范围：P2 完成审计发现 `scheduling-domain/src/index.ts` 自 `ae649b3` 起为 health summary 运行时导入 `@schedule/contracts` 总 barrel，未来 Mini 使用 domain 会连带 23 个 contracts 源文件和 Zod。只解耦该 metadata 运行路径，不改领域算法、统计类型、API、数据库或 Mini 页面。
- 测试先行：新增 browser bundle 与 health summary 守卫；旧实现 2 项中 bundle 1 项失败，实际列出 contracts 的 23 个源文件。新增 `@schedule/contracts/workspace-name` Zod-free 子路径并切换 domain 后，bundle 只含该一个 contracts leaf，Zod 与 contracts index 均不存在，summary 仍精确为 `medical-staff-scheduling-system domain is ready.`。
- 语义等价：workspace 名称仍单源于 contracts，API `createDomainSummary` 导出、调用方式、字符串、同步路径和调用次数不变；statistics 的 contracts import 仍为 type-only，esbuild 证明不进入运行包。没有异步、错误、空值或副作用变化。
- 验证：contracts/domain build/typecheck、定向 2 文件/3 项、根 build/typecheck/lint 及受控全仓 153 文件/842 项通过，32 文件/265 项数据库集成按环境跳过；任务格式、`git diff --check` 和 `smoke:check-core` 通过。根 `format:check` 仍只有既有/用户所有 11 项阻塞。
- 运行/浏览器验证：`pnpm smoke:browser` 已运行，本机 5173 无服务，在第 1/6 步 `ERR_CONNECTION_REFUSED`，未进入产品断言。无模板/样式/页面变化，不需要人工视觉确认。
- checkpoint 与发布：代码 checkpoint `502bb85`（`refactor(domain): isolate runtime metadata`）已推送；精确干净 worktree 的 production build/package 通过。数据库备份 archive `d0eb57b2-e691-40c6-94f9-ddb317723dea`（50 表、161444 行、76293032 bytes，SHA-256 `8cdfebf62ed788ad401e24470ffc18cbc3f2d86a61d579eb5c5c8a27a9151aab`）后部署 release `502bb85d70b21c3a541cfdfbbdaea6ed9bb097e8`；预热首个 502 后恢复，`ecs-verify.sh` 通过健康、产物哈希、域名/IP 隔离、公开端口、容器、依赖和 43 条迁移，精确临时目录已删除。
- 当前状态：P2 domain barrel 明确缺口已完成回归、推送与正式发布；本轮未修改 Mini 包，不需要新的微信体验上传，也无人工视觉确认点。最终状态 checkpoint 识别消息：`docs(status): record domain runtime deployment`。
- 下一活动批次与停止条件：重新执行 P2 完成审计；若 presentation-core、client-core、transport、tokens、fixtures、decoder、Web-first 和 Mini bundle 全部有直接证据，则只更新阶段状态并把下一批切到 P3 身份安全预检，否则继续补唯一缺口。

## 2026-08-22 P2 Mini wx.request JSON transport（当前批次）

- 批次范围：只为已共享的月历/节假日 GET endpoint 增加 Mini `wx.request` transport 与共享错误映射；不建页面、不缓存、不持久化 token、不清理 401、不静默重登、不重试、不进入 P3。同步基线 `23284e8` 与 `origin/main` 一致，无新增已提交 Web 相关变化。
- 引入点与红灯：Web HTTP/API fallback 与错误类来自 `e38cdba`/`5ba3993`，统一 online/auth/fetch 管线来自 `dd9981f`/`1c5d2c5`；Mini 此前无 request transport。共享错误测试旧实现 3/3 失败，Mini transport 套件先因模块缺失失败；实现后共享/生成/边界与 Web 错误等价 4 文件/15 项、Mini transport/边界 2 文件/8 项通过。
- 共享错误：contracts 的 15 个 API code 随 schema 同源生成；`ClientCoreError` 保留 code/message/requestId/latestData/status。known body、401/403/409/通用 fallback、无效 2xx、缺 Bearer 和 network error 与 Web 逐字段等价；Web `ApiClientError` 与原请求实现未改。
- Mini transport：注入式 transport 对 bearer endpoint 同步读取一次 token，public endpoint 完全不读取；以原 method/path/base URL 调一次 request，显式接受 200–299、解码原响应对象，非 2xx 走共享 HTTP error，callback fail 与同步 bridge throw 映射 NETWORK_ERROR。runtime 工厂用 `wx.request(requestOptions)` 成员调用；模块导入不发请求。
- 体积收口：最初拆成三个 TS 入口会因当前构建器逐文件打包而增至 183133 bytes；同轮合并为单一 `client-core-calendar.ts` platform 入口后降至 147887 bytes，只比上一 checkpoint 增加 5070 bytes。无 setTimeout、重试、写队列、页面、WXML/WXSS 或路由。
- 验证：client-core generated check/build/typecheck、Web build/typecheck、根 build/typecheck/lint，共享/Web 定向 4 文件/15 项、Mini transport 2 文件/8 项及受控全仓 152 文件/840 项通过，32 文件/265 项数据库集成按环境跳过。Mini 15 文件/62 项、verify/source/2 Worklets/package/determinism/官方 CI dry-run 通过（147887 bytes，manifest `219a4fbe51fa35bf2e64c7a06b02e542da216859568dbfcb71f4f15ccbb76144`）；任务格式、`git diff --check` 和 `smoke:check-core` 通过。根 `format:check` 仍只有既有/用户所有 11 项阻塞。
- 运行/浏览器验证：`pnpm smoke:browser` 已运行，本机 5173 无服务，在第 1/6 步 `ERR_CONNECTION_REFUSED`，未进入产品断言。本轮无模板/样式/页面变化，不需要人工视觉确认。
- checkpoint 与体验上传：代码 checkpoint `884512c`（`feat(client): add miniprogram json transport`）已推送；精确干净 worktree 生成检查/build 通过，本地 Node `miniprogram-ci` 上传体验版 `0.1.0-p2.20260822.48`（50 个平台代码文件、38661 bytes，manifest `8bd158a8a7167737f696d587ed28b4749f16549c5d47ddae7a3c2e3114b8558c`）。未提交审核、未正式发布，也未使用 ECS 或开发者工具 CLI。
- 正式发布：数据库备份 archive `9abd6e66-d9f8-4ea9-ba4d-9d045007d367`（50 表、161442 行、76291708 bytes，SHA-256 `d466606aa4232fe28ee23e66d1a79751db39b659b3ee4b1544c9f34440753fae`）后部署 release `884512c0a979a99b7971006f8a50e40b2ad12f03`；预热首个 502 后恢复，`ecs-verify.sh` 通过健康、产物哈希、域名/IP 隔离、公开端口、容器、依赖和 43 条迁移，精确临时目录已删除。
- 当前状态：Mini JSON transport 与共享错误映射已完成回归、Git 推送、微信体验上传和 ECS 发布；无视觉确认点。最终状态 checkpoint 识别消息：`docs(status): record miniprogram json transport deployment`。
- 下一活动批次与停止条件：只做 P2 完成审计，逐项核对 presentation-core、client-core、transport、tokens、fixtures、生成 decoder、Web 先行与 Mini bundle 门禁；证据不足则只补缺口，证据完整后才把下一批切到 P3 身份安全预检。

## 2026-08-22 P2 client-core 月历垂直切片（当前批次）

- 用户选择与范围：用户确认方案 2；首个 `@schedule/client-core` 只覆盖 `getCalendar`、`getHolidays`、`getGuestHolidays`，Web 先切换，Mini 只编译共享 decoder/path 边界，不建业务页、不发网络请求、不进入 P3。同步基线 `607a40f` 与 `origin/main` 一致，无新增已提交 Web 月历变化；用户所有目录/个人页/护士 Storybook 继续登记 P10，不纳入。
- 引入点与红灯：`git log -S`/`git blame` 定位鉴权月历为 `ab25064`，鉴权/公开节假日为 `48c6fdd`/`fbf59fa`，统一请求/离线管线为 `dd9981f`，原生 fetch 接收者为 `1c5d2c5`。Web/Mini 测试先因缺少 client-core 包失败，Mini 实际边界模块追加测试再因文件缺失失败；实现后定向 5 文件/167 项和 Mini 边界 2 项通过。
- 共享实现：新增私有 workspace 包，提供 `ClientEndpoint`、`ClientTransport`、三端点 descriptor、月历 service 和无依赖紧凑 JSON Schema decoder。endpoint 保留原 `encodeURIComponent`/`String(year)`、bearer/public、GET 和 ID；service 以成员调用转交 transport，拒绝不捕获、不包装、不重试。
- 生成与黄金：contracts Zod 4 公开 `toJSONSchema` 生成经白名单压缩的确定性描述，未知 keyword/type 和非 false additionalProperties 失败关闭；生成 freshness 与 Zod 结构等价受测。黄金响应覆盖计划/实际人员、三类 marker、可选电话、全日跨日班、大小写十六进制色、节假日/调休；有效结果与 Zod 深等且 decoder 返回原对象，未知字段、错误月、marker、颜色、整数和缺失数组同拒绝。
- Web 等价：三个 `ApiClient` 方法只委托共享 service；原 `requestJson/requestPublicJson → requestWithOnline → fetch.call(globalThis) → parseJsonResponse/ApiClientError` 完全保留。Bearer/public headers、session 次数、离线 GET、HTTP/网络/无效 2xx 错误、响应对象、缓存、请求 tracker、holiday fallback 和调用次数不变；未启用 GET 重试。
- Mini 边界：package/tsconfig/Vitest/esbuild 显式接入 client-core；`src/platform/client-core-calendar.ts` 作为无网络边界入口被真实构建为 8949-byte JS。源码/产物与 browser bundle 均无 Zod、contracts runtime、Node、DOM、fetch、Vue、数据库或绝对路径；未增加 WXML/WXSS/路由。
- 验证：client-core 生成检查/build/typecheck、Web build/typecheck、根 build/typecheck/lint，定向 5 文件/167 项及受控全仓 150 文件/829 项通过，32 文件/265 项数据库集成按环境跳过。Mini 14 文件/56 项、verify/source/2 Worklets/package/determinism/官方 CI dry-run 通过（142817 bytes，manifest `fa75f52b0c78f7c14d42d1aaf5e037051326e8348adfc8e2f6f208c4268576c8`）；冻结 lockfile、任务格式、`git diff --check` 和 `smoke:check-core` 通过。根 `format:check` 仍只被用户所有 workspace/Mini 配置、已提交目录文件和 Storybook 生成物 11 项拦截。
- 运行/浏览器验证：`pnpm smoke:browser` 已运行，本机 5173 无服务，在第 1/6 步 `ERR_CONNECTION_REFUSED`，未进入产品断言。本轮没有模板、样式或页面变化，不需要人工视觉确认。
- 隔离门禁修正：代码 checkpoint `60cec6e`（`refactor(client): share calendar read boundary`）推送后，精确干净 Windows worktree 首次 `check:generated` 因 checkout CRLF 与生成 LF 做原始字节比较而假失败；该提交未上传微信、未部署 ECS，首次 release 包已作废。新增换行等价测试旧实现 1/2 失败，比较统一归一到 LF 后 2/2、生成检查/build/typecheck/lint 通过；修正 checkpoint 识别消息：`fix(client): normalize generated schema line endings`。
- checkpoint 与体验上传：修正 checkpoint `7b52ef8`（`fix(client): normalize generated schema line endings`）已推送，精确干净 worktree 的生成检查和回归通过；本地 Node `miniprogram-ci` 上传体验版 `0.1.0-p2.20260822.47`（50 个平台代码文件、38673 bytes，manifest `28ceb48c307f4d4ae704de6db71371e96cc7b0959e2fff061b9cb7e86750e60f`）。上传完成后平台遥测上报有一次 TLS 断开，但命令已明确 completed 且 exit 0；未提交审核、未正式发布。
- 正式发布：数据库备份 archive `8a28f6c0-20ec-4c5a-99ac-1f2c1e4ded55`（50 表、161440 行、76290384 bytes，SHA-256 `28dde6c0bdd058388da04c38e6e55452f700cfc8211123f23cb97b73e854a151`）后部署 release `7b52ef8093cfcd95c7a90cfee16e1a946fd34c35`；预热首个 502 后恢复，`ecs-verify.sh` 通过健康、产物哈希、域名/IP 隔离、公开端口、容器、依赖和 43 条迁移，精确临时发布目录已删除。
- 当前状态：方案 2 月历读取边界已完成 Web 先行、Mini bundle 边界、回归、Git 推送、微信体验上传和 ECS 发布；无视觉确认点。最终状态 checkpoint 识别消息：`docs(status): record client-core calendar boundary deployment`。
- 下一活动批次与停止条件：只实现 P2 Mini `wx.request` JSON transport 与共享错误映射，覆盖 statusCode、Bearer/public、无效业务响应和网络错误；不建页面、不持久化会话、不实现静默重登、GET 重试或 P3 身份流程。

## 2026-08-22 当前月撤回确认门禁修复（当前批次）

- 范围与引入点：只修复当前月已发布版本含已过日期时“撤销发布”确认不可达，不改重新发布、过去日期锁定、API、版本、幂等、工作流撤销、文案、元素或样式。`git log -S`/`git blame` 与 `git show` 确认 `927241c` 新增 `acknowledgePastDates` 检查时将其用于 publish/withdraw 两种 action，但对应控件只在 publish 渲染。
- 测试先行：新增共享确认结果与 Vue 禁用表达式回归，旧实现 3 项中 2 项失败：撤回在勾选可见通用确认后仍为 false，模板缺少 publish action 限定；重新发布额外日期确认保持通过。修复后回归 3/3、发布等价/运行边界合计 3 文件/11 项通过。
- 实现与语义：共享 `canConfirmSchedulePeriodMutation` 显式接收 action，仅 publish + past dates 要求 `acknowledgePastDates`；Web script 与模板传入/检查同一 action。当前月撤回仍需“我已了解上述影响”的通用确认，并继续把 workflow acknowledgement、expectedVersion 和 controller 生成的 UUID 发送原 API；重新发布含过去日期仍需通用确认加日期确认。API 成员调用、请求次数、Promise/catch/finally、冲突刷新和加载状态不变。
- 验证：presentation-core/Web/根 build、typecheck、lint 通过；受控全仓 146 文件/817 项通过，32 文件/265 项数据库集成按环境跳过。Mini 13 文件/54 项及 typecheck/verify/source/2 Worklets/package/determinism/官方 CI dry-run 通过（133701 bytes，manifest `2fa6b96c62c44c32fcd1ec26626970ba801e894bd02656422ca2e61113d239ad`）；任务 Prettier、`git diff --check`、`smoke:check-core` 通过。根 `format:check` 仍只被用户所有 workspace/Mini 配置、已提交目录文件和 Storybook 生成物拦截；默认 Mini 命令的 ignored ECS runner 副本阻塞沿用上一 checkpoint，不修改相关文件。
- 运行/浏览器验证：`pnpm smoke:browser` 已运行，本机 5173 无服务，在第 1/6 步 `ERR_CONNECTION_REFUSED`，未进入产品断言。Vue 只改变 confirm button 的布尔禁用条件，元素、文案和 style 与 `HEAD` 不变，不需要人工视觉确认。
- checkpoint 与体验上传：代码 checkpoint `b24db46`（`fix(web): allow current-month schedule withdrawal`）已推送；从精确隔离干净 worktree 使用本地 Node `miniprogram-ci` 上传体验版 `0.1.0-p2.20260822.46`（50 个代码文件、38661 bytes，manifest `012f71bed84a4bfd04c44a6426ac7b2453f767be7c01fec625fc483da19ec2dc`）。公网 IPv4 仍为 `103.54.154.22`；未提交审核、未正式发布，也未使用 ECS 或微信开发者工具 CLI。
- 正式发布：数据库备份 archive `b021d3b4-4582-4607-86b2-63c49bb7c79e`（50 表、161438 行、76289064 bytes，SHA-256 `4b8a59e5b85235d74829a91a65f3ade8b7295f5ac2f0c85ea6ee4c7547974efd`）后部署 release `b24db461d77a839a23410f1d696662347338733a`；预热首个 502 后恢复，`ecs-verify.sh` 通过健康、产物哈希、域名/IP 隔离、公开端口、容器、依赖和 43 条迁移，精确临时发布目录已删除。
- 当前状态：当前月撤回确认路径已完成回归修复、Git 推送、微信体验上传和 ECS 发布；无视觉确认点。最终状态 checkpoint 识别消息：`docs(status): record current-month withdrawal deployment`。
- 下一活动批次与停止条件：只读审计 `@schedule/client-core` 的最小只读端点、transport、错误语义、紧凑解码器与黄金响应边界；如日历/配置/历史端点顺序存在多种高影响方案，先向用户确认，不进入 P3 或 Mini 业务页面。

## 2026-08-22 P2 发布生命周期共享（当前批次）

- 批次范围：只抽取发布草稿批次、按月版本历史、过去业务日期、发布/撤回/重发确认门禁和不含 `operationId` 的请求 intent，Web 先行；不改 Vue 模板/样式、公共 API、权限、transport、冲突刷新、错误文案或 Mini 业务页。同步至 `3ffc85f` 时 `origin/main` 无新增已提交 Web 排班变化；用户所有目录/个人页/护士 Storybook 属并行 Web/P10，不纳入。
- 引入点与测试先行：`git log -S`/`git blame` 定位草稿批次/版本分组/批量发布为 `2834f07`，发布生命周期、确认和请求体为 `7c783c7`，覆盖保护为 `968c6c5`，过去日期与门禁为 `927241c`。共享导出、黄金 fixtures 与 Web 接线旧代码 6/6 失败；实现后发布等价/既有手排/编辑器/运行边界 4 文件 24 项通过。
- 实现与黄金语料：`presentation-core` 新增独立 `schedule-publication` 模块，保留 draft 以 `operationId ?? id` 分批、月份/修订排序、published/current、past、replaced/withdrawn archived 与 pending 未分类项；黄金历史覆盖跨月批次、无 operation、显式空字符串、当前/过去/未来月、同月多岗位和全部状态。请求 intent 只输出可移植 DTO 字段，API 成员调用和 `crypto.randomUUID()` 仍在 Web controller。
- 语义等价：输入数组不变、输出数组为副本、DTO 对象身份不变；`??` 不把空字符串当缺失，`localeCompare`、稳定排序和未分类状态均保持。业务时钟以裸回调注入，过去月/未来月/当前月仍分别调用当前业务月 1/2/2 次、业务日期 0/0/1 次；确认短路、可选 true 字段、请求次数、API 接收者、Promise/catch/finally 和冲突刷新路径不变。
- 边界：共享生产源不依赖 contracts/Zod、Vue/Pinia/Router、DOM、fetch、Node、数据库或 scheduling-domain；ES2020 browser bundle 输入清单只增加包内 `schedule-publication.ts`。Mini 当前业务页不复用发布逻辑，staging 包体仍为 133701 bytes，说明未使用导出被 tree-shake。
- 验证：presentation-core/Web/根 build、typecheck、lint 通过；受控全仓 145 文件/814 项通过，32 文件/265 项数据库集成按环境跳过。Mini typecheck、13 文件/54 项、verify/source/2 个 Worklet/package/determinism/官方 CI dry-run 通过（133701 bytes，manifest `910f561f32385a6ee1f3b64d92133cae5cd0650d6e2d816e441700c65c5b8cfe`）；任务 Prettier、`git diff --check`、`smoke:check-core` 通过。默认 Mini 测试仍会扫描用户所有 ignored `.artifacts/ecs-runner-*` 并产生 17 个基线路径失败，排除后全绿；根 `format:check` 仍只被用户所有 workspace/Mini 配置、已提交目录文件和 Storybook 生成物拦截。
- 运行/浏览器验证：`pnpm smoke:browser` 已运行，本机 5173 无服务，在第 1/6 步 `ERR_CONNECTION_REFUSED`，未进入产品断言。`ManualScheduleView.vue` 的 template/style 与 `HEAD` 逐字相同，本轮无视觉变化，不需要人工视觉确认。
- 审计发现：`927241c` 起，当前月版本含已过日期时，撤回对话框不渲染 `acknowledgePastDates` 控件却仍检查该值，确认路径不可达。本等价重构按规则未夹带行为修复；须在独立 checkpoint 先写旧代码失败的回归测试，再把过去日期第二确认限定为重新发布。
- checkpoint 与体验上传：代码 checkpoint `3be831b`（`refactor(presentation): share publication lifecycle`）已推送；从该精确提交的隔离干净 worktree 使用本地 Node `miniprogram-ci` 上传体验版 `0.1.0-p2.20260822.45`（50 个代码文件、38664 bytes，manifest `b3df47f67ce38390cfda991a0e20630b0fcec068518b3777a51d789a2ecc7c47`）。上传前公网 IPv4 为 `103.54.154.22`，使用仓库外本地私钥和本地 `127.0.0.1:7892` 代理；未提交审核、未正式发布，也未使用 ECS 或微信开发者工具 CLI。
- 正式发布：数据库备份 archive `4b60a85e-df68-4c3e-b734-1dd7c573e24e`（50 表、161436 行、76287740 bytes，SHA-256 `ff99363572bfe77b909d94e0be6d0dc8ade962eed40ff418431be3eaad8ba1f1`）后部署 release `3be831be71a9662d9cb48eea8d693d24ba5077cd`；预热首个 502 后恢复，`ecs-verify.sh` 通过健康、产物哈希、域名/IP 隔离、公开端口、容器、依赖和 43 条迁移，精确临时发布目录已删除。
- 当前状态：P2 发布生命周期共享已完成 Web 先行迁移、回归、Git 推送、微信体验上传和 ECS 发布。本轮无视觉变化，不需要人工视觉确认；最终状态 checkpoint 识别消息：`docs(status): record p2 publication lifecycle deployment`。
- 下一活动批次与停止条件：先独立修复上述当前月撤回确认门禁并完成回归/发布；随后只审计 `@schedule/client-core` 的最小只读端点、transport、错误和黄金解码边界，若存在多种高影响端点顺序再向用户确认，不进入 P3 或 Mini 业务页。

## 2026-08-22 P2 手排 transition、选择与撤销共享（当前批次）

- 批次范围：继日历后只抽取手排单元格 Map transition、选择模式与撤销原语，先切 Web，再让 diagnostic-only Mini P1 矩阵复用；不迁移 Mini 业务页、不改模板/样式/API/权限/发布流程或 P3。同步基线 `7d52f2b` 以来无 Web 手排代码更新；并行医生历史/节假日补录只改变共用生产数据与状态文档，无新增端侧功能。
- 引入点与测试先行：`git log -S`/`git blame` 定位 Web 快照撤销/同格选择为 `6512274`、同班种再次点击清除为 `b1ce5c7`/`25bb8fa`，Mini 增量 `{key,before,after}` 与 replace 选择为 `6cc7463`。共享契约旧代码 5/5 失败，Web 接线守卫旧代码 1/6 失败，Mini 依赖/接线守卫旧代码 1/1 失败；实现后全部转绿。
- 实现：`presentation-core` 新增无依赖泛型 cell mutation、apply/revert、行列清除、snapshot undo stack 与 `toggle|replace` 两套选择/赋值模式，黄金动作轨同时锁定 Web 和 Mini。Web 继续使用完整 Map 快照，`ManualScheduleView` 只把既有选择/涂抹计算交给共享原语；Mini 保持单格增量 undo 和局部 `setData`，不复制 600 格快照。
- 语义等价：Web 同格再次点击仍取消选择、同班种仍清除，active 班种存在时仍先 push 一份 Map 快照；成员移除/行列清除/undo 仍只恢复 cells，不恢复成员或选择。Mini 同班种仍 replace、同格仍保持选中，undo entry 仍只有 `key/before/after`。共享函数无 `this`/异步/错误路径；replace 模式不调用 equality callback，toggle 比较、`undefined` 删除语义、对象身份、Map 不变性和调用次数均由动作轨覆盖。
- Mini 源码边界：Mini package 显式依赖共享包，noEmit `rootDir` 覆盖仓库；esbuild 与 Vitest 将包名精确 alias 到共享源码。临时移走 `packages/presentation-core/dist` 后 Mini typecheck 与 staging build 仍通过，证明不依赖预生成 dist；构建产物审计继续阻断 DOM、Node、数据库、Zod、绝对路径和 source map。
- 验证：共享包/Web/根 build、typecheck、lint，手排/边界 4 文件 22 项，Mini 13 文件/54 项及受控全仓 141 文件/798 项通过，32 文件/265 项数据库集成按环境跳过。Mini staging verify/source/2 个 Worklet/package/determinism/官方 CI dry-run 通过（133701 bytes，manifest `97f0ab994df01736b613c5d3e9b8379db82d40053a004a4bdcf0c542392c24e4`）；任务 Prettier、`git diff --check`、`smoke:check-core` 通过。
- 运行/浏览器验证：`pnpm --config.verifyDepsBeforeRun=false smoke:browser` 已运行，本机 5173 无服务，在第 1/6 步 `ERR_CONNECTION_REFUSED`，未进入产品断言。`ManualScheduleView.vue` 的 template/style 与 `HEAD` 逐字相同，本轮无视觉变化。根 `format:check` 仍只被用户所有 workspace/Mini 配置、目录文件和 Storybook 生成物拦截。
- checkpoint 与体验上传：代码 checkpoint `42bcf49`（`refactor(presentation): share manual transitions`）已推送；从该精确提交的隔离干净 worktree 使用本地 Node `miniprogram-ci` 上传体验版 `0.1.0-p2.20260822.44`（50 个代码文件、38662 bytes，manifest `bf9a3f2d86142beced1e6c39761cc83880457f3b48ed0b685e6871831e08bbc7`）。上传前公网 IPv4 为 `103.54.154.22`，仅使用仓库外本地私钥和本地 `127.0.0.1:7892` 代理；未提交审核、未正式发布，也未使用 ECS 或微信开发者工具 CLI。
- 正式发布：数据库备份 archive `1c623d16-9a19-48f3-872a-2d67841be221`（50 表、161434 行、76286416 bytes，SHA-256 `7f94a49b6235874605ffc189b0e054895ef64c10bd8d10ca3a421ce2ece834b1`）后部署 release `42bcf4992a834c042d9c355091919418f1574395`；预热首个 502 后恢复，`ecs-verify.sh` 通过健康、产物哈希、域名/IP 隔离、公开端口、容器、依赖和 43 条迁移，精确临时发布目录已删除。
- 当前状态：P2 手排 transition、选择与撤销共享已完成 Web 先行迁移、Mini PoC 增量适配、回归、Git 推送、微信体验上传和 ECS 发布。本轮没有模板/样式变化，不需要人工视觉确认；最终状态 checkpoint 识别消息：`docs(status): record p2 manual transition deployment`。
- 下一活动批次与停止条件：只抽取 P2 发布/撤回/重发的历史分组、过去日期、确认条件与请求 intent，Web 先行；API 调用、`crypto.randomUUID`、冲突刷新和错误状态继续留在 controller，等价回归前不进入 client-core、P3 或 Mini 业务页面。

## 2026-08-22 历史排班节假日覆盖补齐（当前批次）

- 用户授权与范围：将节假日覆盖补齐到头颈外科医生正式排班数据涉及的既往年份。生产排班日期为 2017-12-31 至 2026-10-31；原生产库仅有 2026 年 confirmed 节假日版本，因此本轮新增并确认 2017–2025，2026 保持既有版本不重复建版。
- 来源与校验：结构化来源固定为 `NateScarlet/holiday-cn@d4e53bf2143de9a85bbd0a916c6c4adac32b075f`，每年源文件均携带 `gov.cn` 国务院通知链接；导入 payload SHA-256 为 `09617bd75741653bdb1372ed6f2f1653ce464d150a7865b9003749a821951f7d`。2019 年包含劳动节调整通知，2020 年包含春节延长至 2 月 2 日、2 月 3 日恢复上班的补充通知；2026 与既有 39 条放假/调休状态逐日差异为 0。
- 生产保护与预演：写入前加密数据库备份 archive `5509edf6-d7a1-4e71-b530-a04f127ab95f`（50 表、161103 行、76176772 bytes，SHA-256 `4cc1db5649c70ceff8123ca34bc005f80e8443b7d8ebacb97b816cd220bbd74b`）。管理员 API 服务 dry-run：2017–2025 分别新增 29/29/28/37/38/38/33/36/33 条，changed/removed 均为 0；2026 为 39 条 unchanged。
- 导入与审计：由已配置节假日管理员“林恩宇”创建并确认 9 个 version 1，共 301 条日期；2017–2026 confirmed 覆盖连续 10 年。年度 import/confirm 均沿用生产 HolidayService 权限、校验、事务和审计链路；汇总审计 operation `48cd3830-5e23-4183-b60f-d1637c397cc4` 记录源仓库、固定 commit、payload 哈希、年份和条数。
- 统计与线上验证：头颈外科医生 105 个月统计快照全部刷新；2017–2026 各年直接按班次/节假日重算与快照 holidayCount 全部一致（0、19、21、29、31、31、26、27、28、33）。正式公共节假日 API 对 2017–2026 均返回 confirmed=true，条数与导入一致；2020-01-31 至 02-02 为春节放假，02-03 为春节调休工作日。正式 API health 200，API/Web/MySQL 容器健康。
- 当前状态：历史节假日数据、统计刷新、审计和线上读取均已完成；未修改生产代码、API、权限、排班或原有 2026 版本。本 checkpoint 识别消息：`docs(status): record historical holiday coverage`；不纳入用户所有的 Mini 配置、workspace、Storybook、`runtime/`、`src/` 或源工作簿。
- 下一活动批次与停止条件：本状态 checkpoint 单独提交、推送并按 documentation-only release 规则完成第二次生产备份、部署与 `ecs-verify.sh`，使 Git `HEAD`、`origin/main` 和服务器 `current-release` 一致后停止；之后仍按 P2 计划只做手排单元格 transition/选择/撤销的共享边界。

## 2026-08-22 头颈外科医生历史值班补录与 8 月换班事件补记（当前批次）

- 用户授权与来源：按 `值班医师值班清单.xlsx` 补录头颈外科医生既往值班，并将 2026 年 8 月中可验证的实际互换补记为管理员换班事件。源文件 SHA-256 为 `57d7e0d04bb1e590e270215cef8f0e29829129b30908a7450a96c2fbc5f324f9`；仅导入“已确认”记录，31 条“人工审核/待处理”不自动转正。
- 生产保护：写入前加密数据库备份 archive `ced328a6-1b87-48ba-be9a-38eff4e256bf`（50 表、157845 行、71033400 bytes，SHA-256 `ed6ba756c7bb977248bbe2f24aeaf9f3945ee3c4eeba76b6b206f288f1e849c8`）。同一原子事务先 dry-run 后提交，生产业务库始终为唯一写入目标，未复制本地数据库或凭据。
- 补录结果：2017-12-31 至 2026-08-20 共 3068 条已确认记录覆盖 105 个月；新建 102 个 `past` 排班期间、3018 个班次，更新 25 个既有班次。为历史统计补建 8 个无密码、无认证身份且群组状态为 `inactive` 的历史成员；既有 active 成员身份未改。
- 8 月判断：8 月 1–2 日的服务器原排“冯钦 / 林恩宇”与清单实际“林恩宇 / 冯钦”形成唯一明确的两班互换，已由“后台管理员”补建 completed swap request、`swap_request_created` 与 `swap_completed`，完成事件 `df7e3fbf-9dd4-11f1-815e-76595a17a428`，并注明原始发起时间未知、事件时间为补记时间。8 月 8–9 日、17–19 日已有换班事件且实际人员吻合，未重复；8 月 10、11、15 日不构成可验证的两两互换，按实际值班补录；清单缺失的 8 月 12 日保留服务器现状。
- 审计与统计：审计 operation `ddfa2ff0-9dd4-11f1-815e-76595a17a428` 记录来源哈希、行数、日期范围、排除项、写入计数和推断换班日期。105 个月统计快照全部刷新成功；常规 published 统计重建另有 5/5 成功。
- 验证：来源与生产逐日逐人对账为 3068/3068，missing 0、name mismatch 0；仅保留清单未确认/缺失但服务器原有的 2026-07-16 与 2026-08-12。事件查询返回新 `swap_completed` 且关联 `swap_request_created`，换班列表共 5 条并仅有 1 条命中 8 月 1–2 日；排班补录最近 30 条均显示“后台管理员”。正式 API health 200，API/Web/MySQL 容器健康。
- 当前状态：生产数据补录、换班事件补记、统计刷新和只读复核已完成；本 checkpoint 识别消息：`docs(status): record doctor duty history import`。除本状态文档外，不纳入用户所有的 Mini 配置、workspace、Storybook、`runtime/`、`src/` 或源工作簿。
- 下一活动批次与停止条件：本状态 checkpoint 单独提交、推送并按文档-only release 规则完成第二次生产备份、部署与 `ecs-verify.sh`，使 Git `HEAD`、`origin/main` 和服务器 `current-release` 一致后停止；之后仍按 P2 计划只做手排单元格 transition/选择/撤销的共享边界。

## 2026-08-22 P2 日历共享核心 Web 先行迁移（当前批次）

- 批次范围：按用户确认的顺序先做日历，只建立 Mini-safe 的最小 `@schedule/presentation-core`、黄金 fixtures 与 Web 兼容接线；本轮不让 Mini 业务页复用、不迁移页面、不改公共 API/视觉/权限/transport。P2 Web 同步基线为 `b1a52b6`，远端没有新增已提交日历变化；未提交的目录/个人页/护士 Storybook 属其他任务或 P10，不纳入。
- 引入点与测试先行：`git log -S`/`git blame` 定位生产月网格为 `abd20d2`、默认选择为 `7c80488`、切月完整日期为 `daf7ede`、分组排序为 `db35a77`/`b1ce5c7`、筛选与实际人员优先为 `ab25064`。旧代码新增等价测试先因缺少 `@schedule/presentation-core` 失败；实现后共享/旧实现 6 组黄金等价和运行边界 2 项通过。
- 实现与边界：新包只包含 `YYYY-MM(-DD)` 月/周运算、5/6 周展示网格、选择重定向、节假日连续区间、排班筛选/分组/CST 班次排序及列表 ViewModel；黄金语料覆盖 2026-08/09/10、2028 闰二月、跨月周、实际/计划人员、A/P/N 排序、三类变更和节假日/调休。生产源无 runtime dependency，ES2020 browser bundle 只含包内两个输入，明确不含 contracts/Zod、scheduling-domain barrel、Vue/Pinia/Router、DOM、fetch、Node 或数据库。
- Web 先行与语义等价：现有 `calendar-logic.ts`、`calendar-views.ts`、`month-grid-presentation.ts` 保持原导出，内部改为共享包适配；全部 Vue 模板/样式和 API/cache/异步错误路径不变。抽取函数均为裸纯函数，无 `this`/接收者变化；错误消息、`??` 空值语义（含显式空字符串）、类型收窄、对象身份、输入数组顺序、排序副作用和调用次数由黄金测试锁定。MonthGrid/WeekGrid 字节哈希仍通过。
- 验证：presentation-core build/typecheck、Web typecheck/production build、根 build/typecheck/lint、日历/边界 14 文件 67 项及排除用户所有 `runtime/**`/`src/**`/未完成 Storybook 后受控全仓 139 文件/791 项通过，32 文件/265 项数据库集成按环境跳过。Mini 53 项随全仓通过，staging verify/source/2 个 Worklet/package/determinism/官方 CI dry-run 通过（132585 bytes，manifest `36ab7283f748582b4486e2b4931a5aea4c29aad8e74c73d4b9152c18cc0b715f`）；任务文件 Prettier、`git diff --check` 与 `smoke:check-core` 通过。
- 运行/浏览器验证：`pnpm --config.verifyDepsBeforeRun=false smoke:browser` 已运行；本机 5173/3000/3306 无监听且 Docker 不可用，在第 1/6 步 `ERR_CONNECTION_REFUSED`，未进入产品断言。根 `format:check` 仅被用户所有 `pnpm-workspace.yaml`、`apps/miniprogram/project.config.json`、目录文件和 Storybook 生成物拦截；任务文件独立检查通过。
- checkpoint 与发布：代码 checkpoint `ca16d7e`（`refactor(presentation): share calendar core with web`）已推送；本地 Node `miniprogram-ci` 从精确干净 worktree 上传体验版 `0.1.0-p2.20260822.43`（50 个代码文件、37872 bytes，manifest `7d6cf8febb025c7cd608638401c9dbc3693188c70b63cf3c962cec8578e73a4b`），未审核、未正式发布。上传前公网 IPv4 为 `103.54.154.22`，进程报告使用本地 `127.0.0.1:7892` 代理且平台接受。
- 正式发布：数据库备份 archive `12899cc6-e6ad-4913-9ae1-0da3af2da1bd`（50 表、160997 行、75531784 bytes，SHA-256 `34a0e656ff0720ccd38f274265d7acbb38f10f63c3043fbc8618abc2feba8476`）后部署 release `ca16d7e3a77dd0e1a04ce23f363de93c7f6cb4fb`；预热首个 502 后恢复，`ecs-verify.sh` 通过健康、产物哈希、域名/IP 隔离、公开端口、容器、依赖和 43 条迁移，临时发布目录已删除。
- 当前状态：P2 日历共享核心已完成 Web 先行迁移、回归、Git 推送、微信体验上传和 ECS 发布；Git `HEAD`、`origin/main` 与服务器 `current-release` 一致。本轮无视觉源变化，不需要人工视觉确认。最终状态 checkpoint 识别消息：`docs(status): record p2 calendar core deployment`。
- 下一活动批次与停止条件：只做 P2 手排单元格 transition/选择/撤销的最小共享边界，先用 Web 完整快照与 Mini `{key,before,after}` 增量语义的黄金动作轨证明兼容；Web 回归通过前不让 Mini 业务页复用，不进入发布状态机或 P3。

## 2026-08-22 密码提醒永久不再提示与弹窗收口（当前批次）

- 用户确认与范围：确认 Storybook 终稿；移除右上角关闭按钮，提醒操作只显示“不再提示”；取消只关闭当前会话，“不再提示”按用户资料永久保存，不修改密码校验、提交 API、权限或其他弹窗。
- 引入点与测试先行：`git log -S 'dismissPasswordReminder'` / `git blame` 定位 `664bc1f` 的会话内 ref 与关闭按钮后的焦点索引；旧实现新增断言先失败，实现后生产弹窗 2/2、会话管理 13/13 通过。
- 实现与验证：按 `user_profiles.id` 写入 `schedule.password-reminder.dismissed.<profileId>`，登录/恢复/刷新密码状态读取；去掉右上角按钮后编辑态聚焦第一个密码框。Web typecheck/build、Storybook build、任务文件 Prettier/ESLint、`smoke:check-core` 通过；`pnpm smoke:browser` 因本机 5173 未启动在第 1/6 步 `ERR_CONNECTION_REFUSED`，已写入调试记录。
- 正式发布：代码 checkpoint `fc05236`（`fix(web): persist password reminder opt-out`）已推送；发布前数据库备份 archive `cd80262e-341e-4b41-8aef-10f3b4cd7c5d`（50 表、157702 行、70981852 bytes，SHA-256 `7ff5252339a3072defdf91bfaccb1eed01f501d1d6aa8afd934c4470a5572e95`）。release `fc052367239cf4c67430c9d61ddc993bb33974d6` 已部署，预热首次 502 后恢复；`ecs-verify.sh`、正式首页/API 200 与线上 bundle 只读命中“不再提示”且无旧文案/关闭类名。
- 当前状态：代码与 Storybook 确认稿已完成并发布 → 待状态 checkpoint 收口；最终状态 checkpoint 识别消息：`docs(status): record password reminder deployment`。本批次只包含密码弹窗、会话偏好、AppLayout、定向测试和验证记录；其他小程序/Storybook/runtime/src 改动不纳入。
- 下一批次与停止条件：只提交、推送并部署本状态 checkpoint，使 Git `HEAD`、`origin/main` 和服务器 `current-release` 一致后停止，不开始其他修改。

## 2026-08-22 移动导出按钮空白修复（当前批次）

- 用户反馈与范围：生产落地动作图标后，移动端顶部导出按钮为空白。本批次只修复导出文字隐藏规则误伤图标，不修改 SVG、动效、导出权限、弹窗、API 或其他入口。
- 引入点与根因：`git log -S` / `git blame` 确认 `daff238` 为移动端加入 `.shell-export-action span`，原意是隐藏“导出”文字；`b70bb99` 将动作图标根节点定义为 `<span>`，`fea129b` 接入生产后，Vue scoped CSS 同时把图标根节点裁成 1×1，形成空白按钮。
- 测试先行与实现：新增文字专用类、直接子元素选择器及禁止宽泛后代选择器守卫；旧实现 1 项失败、4 项通过，修复后 5/5 转绿。模板给文字增加 `shell-export-label`，移动规则收窄为 `.shell-export-action > .shell-export-label`；图标仍为 20px，点击 key、导出 Sheet 打开和可访问名称不变。
- 验证：工作台/生产图标定向 2 文件/10 项通过；排除用户自有 `runtime/**` / `src/**` 后 141 文件/794 项通过，32 文件/265 项数据库集成按环境跳过；根 lint/typecheck、Web typecheck/production build、任务文件 Prettier/ESLint 与 `smoke:check-core` 通过。生产 CSS 已精确编译为直接子元素选择器，不再命中 `top-action-motion-icon`。
- 运行/浏览器验证：`pnpm --config.verifyDepsBeforeRun=false smoke:browser` 已运行；本机 5173 无服务，在第 1/6 步以 `ERR_CONNECTION_REFUSED` 停止，未进入产品断言。390×844 Storybook 实测导出按钮 44×44、SVG 根与图形 24×24，`clip-path: none` 且点击后仍可见；正式域名在同断点命中移动媒体规则，已部署 CSS 只裁剪 `.shell-export-label`、不含宽泛 `.shell-export-action span`，顶部图标尺寸仍为 20px。当前正式会话只有“成员”群组，按权限不渲染导出入口，因此未虚构管理员按钮量测，也未触发业务写入。
- checkpoint 与发布：代码 checkpoint `993bdf4`（`fix(web): keep mobile export icon visible`）已推送；发布前加密数据库备份 archive `e186ef3e-f2aa-4658-b8dc-765a07873dc2`（50 表、157700 行、70980528 bytes，SHA-256 `95c0d57b6727080b5d65267fa0d9e63a9e753dcd4b04a3c152d3e8124f04f6da`）。release `993bdf42b8052fcf0bab75e5e42bf48cd3f9d558` 已部署，预热首次 502 后恢复；`ecs-verify.sh` 通过健康、产物哈希、域名/IP 隔离、端口、容器、依赖与 43 条迁移，服务器 `current-release` / manifest 一致。
- 当前状态：导出按钮空白回归已修复并发布 → 待用户复核。最终状态 checkpoint 识别消息：`docs(status): record mobile export icon fix deployment`。用户自有小程序/CI、并行密码弹窗、`pnpm-workspace.yaml`、其他 Storybook、`runtime/` 和 `src/` 不纳入本批次。
- 下一批次与停止条件：只提交、推送并部署本最终状态 checkpoint，使 Git `HEAD`、`origin/main` 与服务器 `current-release` 一致；随后停止。

## 2026-08-22 P1 矩阵经验固化（当前批次）

- 用户要求：把矩阵多轮真机踩坑、后续优化和防复发经验精简归档，方便后续阶段直接调阅。
- P1 人工验收：2026-08-22 用户明确确认 P1 通过。基础控件、动态月历、7×7 与 20×30 均通过实体 Android 复核；矩阵正常进入后的横纵滚动、冻结层、进度条、点格和撤销流畅，首入约 500ms 内立即操作的短卡接受为 PoC 边界。
- 归档：权威精简记录为 `apps/miniprogram/docs/architecture/matrix-gesture-lessons.md`；ADR-0005 和专项 README 只保留入口，不复制历史。内容覆盖平台探针、单坐标源、渲染后恢复、无时间戳 RAF、浅层 600 格及后续必测清单。
- ECS 微信上传中继已取消：用户确认当前正式 ECS 为 `120.77.220.79` 且只有 2GB 内存，不承担 `miniprogram-ci` 的千级依赖树；代码与规则维持本地 Node 直传。旧地址 `8.148.183.46` 已由用户删除清空；用户另确认上传私钥未暴露，因此不再执行旧机清理或密钥轮换。
- 验证：Mini `verify`、typecheck、staging build/source/Worklet/package/determinism、官方 CI dry-run、12 个受控测试文件 53/53、根 typecheck、`smoke:check-core` 与 `git diff --check` 通过；产物 132585 bytes，manifest `569434dcf8d57b302c22f5007c300e817df0c37da52212509902c459d66e40e6`。默认 Mini 测试还会扫描既有 ignored `.artifacts/ecs-runner-*` 副本并产生 17 个路径/旧 tsconfig 失败，已用 `--exclude ".artifacts/**"` 复跑并通过；未修改该副本。
- 其他门禁：`pnpm verify` 仅被用户所有的 `apps/miniprogram/project.config.json`、目录文件和 Storybook 生成目录格式问题拦截；`pnpm smoke:browser` 因本机 5173 未启动在第 1/6 步 `ERR_CONNECTION_REFUSED`，未进入产品断言。公网 IPv4 `103.54.154.21` 已由用户加入微信代码上传 IP 白名单；首次上传选择了 IPv6 并被 `-10008` 拒绝，随后以 `NODE_OPTIONS=--dns-result-order=ipv4first` 重试成功。
- checkpoint 与发布：代码 checkpoint `408d627`（`docs(miniprogram): close p1 native validation`）已推送；本地 Node `miniprogram-ci` 从该精确隔离 worktree 上传体验版 `0.1.0-p1.20260822.42`（50 个代码文件、37884 bytes，官方 manifest `fea3d5d577093074971f4f6506a7b76d32297e63d5e5880c80f658846d90539`）。ECS 发布前加密数据库备份 archive `21b9c2ab-2b24-488b-af79-c7c7aaf58648`（50 表、157816 行、71023400 bytes，SHA-256 `dcee1e32f2495a73a40682b8f58d12ee3a1610377458240f4ddcbe77daee83a6`）；release `408d6279b0a21d634746021c8971e458c5a3f36d` 已部署，`ecs-verify.sh` 通过，临时上传目录已删除。未提交审核、未正式发布、未使用 ECS 上传、未启动或控制微信开发者工具。
- 当前状态：P1 已完成（实体 Android 人工验收、本地门禁、Git 推送、微信体验上传、正式 ECS 备份/部署/验证）→ 待用户复核；Git `HEAD`、`origin/main` 与服务器 `current-release` 一致。最终状态 checkpoint 识别消息：`docs(status): record p1 validation deployment`。
- 下一活动批次：P2 共享核心，首轮只做 1 项复杂任务——审计并确定 `presentation-core` 的最小抽取边界、黄金 fixtures 与 Web 先行切换顺序；未通过 Web 等价回归前不实现 Mini 业务页面，不进入 P3 身份安全。

## 2026-08-21 Lucide Minimal 动作图标生产落地（当前批次）

- 用户确认与范围：用户确认 Storybook 的静态保真点击动效并授权应用。本批次只替换顶部通知/个人中心/导出、日历筛选/定位、通讯录科室/人员及所有现有电话图标；已确认导航动效、业务布局、权限、API 和数据库不修改。
- 回归来源与测试先行：`git log -S` / `git blame` 定位顶部入口来自 `abd20d2` / `0b7b1b8` / `daff238`，日历来自 `abd20d2` / `a1a732a`，通讯录模式来自 `046dc65`，电话图标来自 `8a49434`、`1c84fd6`、`8309dce`、`5437995`、`b09da6e`、`41d284b`、`f723b0d`。生产共用源与全部入口接线守卫在旧实现上 7/7 失败，实现后转绿；重新挂载不得自动播放的追加守卫也先失败后通过。
- 实现与设计：`frontend-design` 继续采用医疗工作台的克制蓝白系统语言，不改变布局、色彩或按钮外观。确认稿组件迁入生产 `components`，Storybook 与正式页面共享同一 24×24 SVG/动画源；各调用点用 CSS 变量保持原 16/17/18/20/21.6px 尺寸和原线宽。铃铛摇晃、个人回弹、导出箭头/外框反向弹出、筛选三线错动、定位/科室转 90°、双人并排响应和电话轻摆均为 480–620ms 单次点击动画。
- 交互与语义审计：图标只监听组件挂载后的 motion key 变化，已点击过的定位图标在月/周/列表切换后重新挂载仍静止；科室/人员已选中时在递增 key 前返回。顶部页面切换/导出打开、通知轮询/Sheet、日历定位/筛选、电话菜单、`tel:` 地址、通讯录使用次数和本地偏好各保持原调用一次；没有新增网络、写入、异步或错误路径。生产继续遵循 `prefers-reduced-motion`。
- 运行/浏览器验证：真实生产 `UnifiedDirectoryView` Story 在 390×844 验证人员首次切换 key 0→1、重复点击仍为 1；真实 `SelectedDateDutyDetails` Story 只让被点电话 key 0→1，其他保持 0，拨号仍为 `tel:61234` / `tel:13800138000`。确认稿导出峰值箭头向右上、外框向左下；两个 Story 的 Axe 违规均为 0，控制台无产品 error/warning，仅有 Storybook 11 `PopoverProvider ariaLabel` 前向兼容提示。预览：`http://127.0.0.1:6007/?path=/story/web-ui-2-0-icon-motion-%C2%B7-lucide-minimal-actions--mobile-workbench-390`。
- 验证：任务定向 9 文件/55 项及生产守卫通过；排除用户自有 `runtime/**` / `src/**` 后 140 文件/790 项通过，32 文件/265 项数据库集成按环境跳过；根 lint/build/typecheck、Web typecheck、完整 Storybook build、任务文件 Prettier/ESLint 与 `smoke:check-core` 通过。`pnpm --config.verifyDepsBeforeRun=false smoke:browser` 因本机 5173/3000/3306 均无服务且 Docker 不可用，在打开登录页时 `ERR_CONNECTION_REFUSED`，未进入产品断言；同构生产 Story 已完成本批次真实交互验证。
- checkpoint 与发布：代码 checkpoint `fea129b`（`feat(web): apply approved action icon motion`）已推送；发布前加密数据库备份 archive `7b782097-5e41-434b-895a-cc340187e16b`（50 表、157697 行、70978500 bytes，SHA-256 `f12b363391327c007581bc039e601d4dba3020e9aa94dfe68d6ff354baa895b7`）。release `fea129bb15270c5c5a2d4405b2f9e0e9599e150b` 已部署，预热首次 TLS EOF 后恢复。
- 正式核验：`ecs-verify.sh` 通过健康、产物哈希、域名/IP 隔离、公开端口、容器、依赖和 43 条迁移；正式首页/API 均为 200。正式 Web bundle 精确命中 9 组点击 keyframe、铃铛/双人静态源和导出双部件回弹；API、契约、数据库与领域产物哈希保持不变。
- 当前状态：已确认动作图标全部生产落地并发布 → 待用户复核。最终状态 checkpoint 识别消息：`docs(status): record action icon motion deployment`。用户自有小程序配置、`pnpm-workspace.yaml`、其他 Storybook、`runtime/` 和 `src/` 不纳入本批次。
- 下一批次与停止条件：只提交、推送并部署本最终状态 checkpoint，使 Git `HEAD`、`origin/main` 与服务器 `current-release` 一致；随后停止，不开始其他图标修改。

## 2026-08-21 导出图标柔和回弹动效微调（当前批次）

- 用户要求与范围：只重做 Storybook 预览里的导出图标点击动效，保留现有 TDesign `ExportIcon` 静态路径和 Lucide Minimal 线条；外框允许参与运动。生产调用点、人员图标及其余动作图标不修改。
- 回归来源与测试先行：`git log -S` / `git blame` 确认 `34c6652` 首次把导出箭头改为 42px dash 的 620ms 线性顺向出现，用户反馈观感生硬。新增外框独立 keyframe、相反方向位移、禁止 dash/dashoffset 和新说明文案守卫，旧实现 2/2 失败，实现后 2/2 转绿。
- 设计与实现：移除描边擦除；箭头整体向右上弹出 2.2px，外框同时向左下轻让 0.7px，再经过两段小幅反向回弹，于 620ms 恢复原位。两条原始 `d` 路径、线宽、颜色和未点击静态外观不变；无透明度、循环或额外点线。
- 运行/浏览器验证：390×844 Storybook 实际点击时，峰值采样箭头 `translate(2.10px, -2.10px)`、外框 `translate(-0.65px, 0.65px)`；结束后两者 `transform: none`，前后路径完全一致，dash 为 `none` / `0px`，控制台无 error/warning。预览地址：`http://127.0.0.1:6007/?path=/story/web-ui-2-0-icon-motion-%C2%B7-lucide-minimal-actions--mobile-workbench-390`。
- 验证：任务定向 2/2、排除用户自有 `runtime/**` / `src/**` 后 139 文件/784 项通过，32 文件/265 项数据库集成按环境跳过；根 lint/build/typecheck、Web typecheck、完整 Storybook build、任务文件 Prettier/ESLint、`smoke:check-core` 与浏览器复核通过。直接未排除运行会误扫 `runtime/` 内旧发布副本并产生既有换行/旧版本失败，未改动这些目录。
- 语义边界：全部修改仍为 Storybook-only，不进入生产 Web bundle，不请求 API、不拨号、不写数据；正式导出图标尚未替换。
- checkpoint 与发布：代码 checkpoint `d19dade`（`fix(web): soften export icon motion preview`）已推送；发布前加密数据库备份 archive `226dcd19-189f-4d6a-a355-982e27345608`（50 表、157694 行、70976516 bytes，SHA-256 `5465adebc505a965bf028ead7108a6c168ef1a38ed6dc27a3164aaff2ba0ae79`）。release `d19dade7665059f766cad48d7237a0bc671402c2` 已部署，预热首次 TLS EOF 后恢复。
- 正式核验：`ecs-verify.sh` 通过健康、产物哈希、域名/IP 隔离、公开端口、容器、依赖和 43 条迁移；正式 Web/API 产物哈希与上一版一致，确认本微调未改变生产 UI 或业务行为。
- 当前状态：导出柔和回弹预览已完成并同步 → 待用户视觉确认。最终状态 checkpoint 识别消息：`docs(status): record soft export motion preview deployment`。用户自有小程序配置、`pnpm-workspace.yaml`、其他 Storybook、`runtime/` 和 `src/` 不纳入本批次。
- 下一批次与停止条件：只提交、推送并部署本最终状态 checkpoint，使 Git `HEAD`、`origin/main` 与服务器 `current-release` 一致；随后停止，未得到明确确认前不替换生产图标。

## 2026-08-21 静态保真动作图标微调（当前批次）

- 用户要求与范围：只微调 Storybook 的人员与导出图标。人员不再使用 `046dc65` 引入的“双头像共用一个身体”，改为已确认群组管理图标的主/次双人并排几何；导出保留 `5b00fa7` 起使用的 TDesign `ExportIcon` 静态外观，只让箭头路径沿自身方向出现。生产调用点、已确认导航和其他 6 个动作图标不修改。
- 测试先行与实现：群组双人路径、导出 `#stroke2` 单独动效、禁止共享肩线、动效 key、已选标签不得重播等守卫在旧预览上失败后转绿。人员主/次轮廓点击时分别轻移，520ms 后复位；`selectDepartment` / `selectPeople` 在已选中时直接返回，因此重复点击不增加 `motionKey`。导出外框 `#stroke1` 始终静止，`#stroke2` 以 42px dash 在 620ms 内线性顺向出现并恢复完整静态线条。
- 浏览器验证：390px 初始运行动画为 0，人员静态路径精确命中群组管理的三条路径；首次切换 `motionKey` 0→1，主/次人员均执行有限动画，结束后 `transform: none`，再次点击已选标签保持 key=1 且不重播。导出点击 110ms 时 dash offset 为 21.66px，约完成一半路径；结束后 offset=0、外框未动、箭头 `d` 前后相同。页面无横向溢出，更新后顶部导出 SVG 可见。
- 验证：任务定向 8/8、排除用户自有 `runtime/**` / `src/**` 后 139 文件/784 项通过，32 文件/265 项数据库集成按环境跳过；根 lint/build/typecheck、Web typecheck、完整 Storybook build、任务文件 Prettier/ESLint、`smoke:check-core` 与 `git diff --check` 通过。预览地址：`http://127.0.0.1:6007/?path=/story/web-ui-2-0-icon-motion-%C2%B7-lucide-minimal-actions--mobile-workbench-390`。
- 语义边界：全部修改仍为 Storybook-only，不进入生产 Web bundle，不请求 API、不拨号、不写数据；正式人员图标与导出行为尚未替换。
- checkpoint 与发布：代码 checkpoint `34c6652`（`fix(web): refine people and export motion preview`）已推送；发布前加密数据库备份 archive `f0994b6b-1a6c-46aa-969c-f35c59107888`（50 表、157689 行、70973208 bytes，SHA-256 `a52f350873bf487e03fd3b09966f2ebe8b505997dac5f3ea98c4bc07eaa22621`）。release `34c665260f5d8a3340e606ab93e70f21ee50f353` 已部署，预热首次 TLS EOF 后恢复。
- 正式核验：`ecs-verify.sh` 通过健康、产物哈希、域名隔离、公开端口、容器、依赖和 43 条迁移；正式 Web/API 产物哈希与上一版一致，确认本微调仍未改变生产 UI 或业务行为。
- 当前状态：微调预览已完成并同步 → 待用户视觉确认。最终状态 checkpoint 识别消息：`docs(status): record people and export motion preview deployment`。用户自有小程序配置、`pnpm-workspace.yaml`、其他 Storybook、`runtime/` 和 `src/` 未纳入本批次。
- 下一批次与停止条件：只提交、推送并部署本最终状态 checkpoint；未得到明确确认前不替换生产图标。

## 2026-08-21 Lucide Minimal 静态保真点击动效预览修订（当前批次）

- 用户反馈与批次范围：上一版为动作重新绘制图标并自动循环，偏离用户认可的 Lucide Minimal 精髓，整版否决。本批次只重做 Storybook 动效预览：静止时必须保持当前生产图标的原始几何、线宽和颜色，只有点击后播放一次并恢复原样。已发布的导航连续循环与所有生产调用点均不修改。
- 静态来源：通知精确复用生产 `NotificationBell` 的两条铃铛路径；个人中心、导出和电话直接渲染现有 TDesign `UserIcon` / `ExportIcon` / `CallIcon` SVG；筛选精确复用日历三条横线；定位复用现有准星结构；科室复用通讯录四格轴对称标记；人员复用双头像与共同肩线。没有新增波纹、装饰点线、淡出、描边裁切或形状替换。
- 点击动效：铃铛原位摇晃；个人图标轻微上移回弹；导出图标上行返回；筛选三条原线左右错动后复位；定位准星旋转 90°；科室四格利用轴对称旋转 90°；双头像向中间聚合再复位；原电话听筒轻摆。所有动画为 480–620ms 单次播放，无 `infinite`，未点击时 0 个动画运行；Storybook 的 `previewMotion` 只绕过预览环境的减少动态偏好，未来生产默认关闭。
- 回归与测试先行：静态来源、点击 keyframe、禁止循环/透明度/描边裁切、点击接线和移动端导出图标可见性守卫均在旧预览上失败后转绿。浏览器逐项点击 8 个图标均命中对应有限动画；科室四格中途接近 90°，结束后 `transform: none` 且 SVG `outerHTML` 前后完全一致。390×844 无横向溢出、无小于 44px 的可见操作，顶部导出图标存在；Storybook Axe 0 项违规。
- 验证：任务定向 8/8、排除用户自有 `runtime/**` / `src/**` 后 139 文件/782 项通过，32 文件/265 项数据库集成按环境跳过；根 lint/build/typecheck、Web typecheck、完整 Storybook build、任务文件 Prettier/ESLint、`smoke:check-core` 与 `git diff --check` 通过。预览地址：`http://127.0.0.1:6007/?path=/story/web-ui-2-0-icon-motion-%C2%B7-lucide-minimal-actions--icon-motion-board`。
- 语义与发布边界：全部修改位于 Storybook 组件/故事/契约测试，不进入生产 Web bundle，不请求 API、不拨号、不写业务数据。生产导航动画、权限、路由、交互事件和数据路径不变。
- checkpoint 与发布：代码 checkpoint `b70bb99`（`fix(web): preserve static action icons in motion preview`）已推送；发布前加密数据库备份 archive `2e3d6c26-1416-4367-a83f-438e17bbcbf5`（50 表、157686 行、70971224 bytes，SHA-256 `e861ebc29bed951f854ee0cc08b00859ed556a84cab336ed741ea1ffd48f5a28`）。release `b70bb99be83747d5082137c042b09523a19d739c` 已部署，预热首次 502 后恢复。
- 正式核验：`ecs-verify.sh` 通过健康、产物哈希、域名隔离、公开端口、容器、依赖和 43 条迁移；正式 Web/API 产物哈希与上一版一致，确认 Storybook 修订没有改变生产 UI 或业务行为。
- 当前状态：静态保真点击动效预览已完成并同步 → 待用户视觉确认。最终状态 checkpoint 识别消息：`docs(status): record static-preserving icon preview deployment`。用户自有小程序配置、`pnpm-workspace.yaml`、其他 Storybook、`runtime/` 和 `src/` 未纳入本批次。
- 下一批次与停止条件：只提交、推送并部署本最终状态 checkpoint，保持 6007 预览供用户验收；未得到明确确认前不替换任何生产动作图标。

## 2026-08-21 Lucide Minimal 连续动作图标预览（当前批次）

- 批次范围：按用户要求移除现有导航 SVG 循环的大段暂停，使当前入口首尾无空拍连续播放；另只在 Storybook 预览顶部通知/个人中心/导出、日历筛选/定位、通讯录科室/人员及全部电话入口的同系 SVG 动效。新增 8 个动作图标尚未接入生产调用点，等待用户确认后再统一替换。
- 回归来源与测试先行：`git log -S` / `git blame` 确认 4 秒循环及约 60% 静止区由 `5b9542a` 引入；顶部动作来自 `5b00fa7`，日历定位/筛选来自 `daff238`、`8a49434`、`abd20d2`，通讯录模式来自 `046dc65`，电话入口分批来自 `8309dce`、`1c84fd6`、`41d284b`、`5437995`、`b09da6e`、`f723b0d`。连续循环和新预览在旧实现上 3 项失败；截图发现路径端点可读性不足、Axe 发现 17 个低对比节点，追加守卫均先失败后转绿。
- 设计与实现：沿用 `frontend-design` 的医疗工作台语境及 Lucide Minimal 24×24、2px 圆端单色线条。导航默认循环由 4000ms 改为 1800ms，所有关键帧覆盖完整 0–100% 周期且不再成组停留；回拨/齿轮使用连续线性旋转。新增铃体回摆、个人轮廓描绘、导出箭头上行、漏斗重绘、目标环扫描、科室医疗十字写入、第二成员进入、听筒接通描边；端点保留至少约 75% 轮廓，避免闪烁或失去识别性。
- 预览边界与可访问性：Storybook 强制播放只用于视觉验收；生产默认仍遵循 `prefers-reduced-motion`，新增 `forceIconMotion` 不由 `HomeView` 传入。1280×900 与 390×844 均无横向溢出，18 个动作主体在 450ms 间隔采样中全部变化，可见操作均不小于 44px；筛选状态及科室/人员切换实际通过。导航当前项连续 6 次采样为 6 个不同状态。Storybook Axe 为 0 项违规。
- 验证：排除用户自有 `runtime/**` / `src/**` 后 139 文件/782 项通过，32 文件/265 项数据库集成按环境跳过；根 lint/build/typecheck、Web typecheck/production build、完整 Storybook build、任务文件 Prettier/ESLint、`smoke:check-core` 与 `git diff --check` 通过。预览地址：`http://127.0.0.1:6007/?path=/story/web-ui-2-0-icon-motion-%C2%B7-lucide-minimal-actions--desktop-workbench`。
- 语义审计：生产变化只涉及当前导航图标的时间曲线；导航顺序、角色过滤、`select` / `sign-out` 事件次数、抽屉关闭、API、权限、数据和异步错误路径均不变。Storybook 场景使用静态脱敏示例，不请求 API、不拨号、不写业务数据。
- checkpoint 与发布：代码 checkpoint `e393118`（`feat(web): preview continuous minimal action icons`）已推送；发布前加密数据库备份 archive `d64be110-cc82-43a0-9e9e-39eb49c8487a`（50 表、157680 行、70967256 bytes，SHA-256 `c64643a48803111633e31cb87f63b52098ae2008a2e4188c7d804698abd99b1c`）。release `e3931187023997913a7161158195ff4ceb96cd5a` 已部署，预热首次 502 后自动恢复。
- 正式核验：`ecs-verify.sh` 通过健康、产物哈希、域名隔离、公开端口、容器、依赖和 43 条迁移；正式主页/API 均为 200。生产 CSS 只含 1.5s / 1.8s / 2s 连续导航循环，不含旧 4s 周期；`lucide-minimal-action-icon` 未进入生产 bundle，确认新增 8 图标仍为 Storybook-only。
- 当前状态：已完成导航无停顿循环发布与新增动作图标预览 → 待用户确认。最终状态 checkpoint 识别消息：`docs(status): record continuous icon preview deployment`。用户自有小程序/WXS、`pnpm-workspace.yaml`、其他 Storybook、`runtime/` 和 `src/` 未纳入本批次。
- 下一批次与停止条件：只提交、推送并部署本最终状态 checkpoint；保持 6007 Storybook 供用户验收，用户明确确认后才在独立批次替换顶部、日历、通讯录和电话的生产图标。

## 2026-08-21 P1 矩阵首屏渲染阻塞优化（当前批次）

- 用户反馈：`.40` 进入 7×7 或 20×30 后会冻结 3–5 秒，期间滑动和点格均无响应；冻结结束后快慢速横纵滑、惯性、冻结层、进度条、点格和撤销全部正常且丝滑。故障已从手势/状态收窄为首屏组件树构建与首次边界初始化。
- 引入点与根因：`git log -S`/`git blame` 确认 `6cc7463` 起为每个逻辑格实例化 `ManualScheduleCell`，最大矩阵创建 600 个自定义组件；横向边界仍等待 `onReady → SelectorQuery → setData` 才建立。即使 7×7，也要经过相同的组件初始化和二次渲染门槛。
- 测试先行与实现：新增页面零自定义组件实例、浅层内置格、七组视觉 selector 与保留组件逐项一致、同步 `getWindowInfo` 边界、无 `onReady`/`SelectorQuery`、原生 dataset 点格契约，旧实现 4 项失败；实现后矩阵 12/12、Mini 12 文件/53 项通过。矩阵 WXML 直接渲染 72×44 内置 `view`，保留的 `ManualScheduleCell` 源码与 simulate 不删除；390px 窗宽在模块初始化即得到 maxX=248px，旋转时同步校准。
- 视觉与语义审计：按 `frontend-design` 采用“视觉零改动、结构降层”，页面内普通/按压/选中/失效/班次徽标/空态/失效徽标七组声明与组件源码归一化后完全相同；数据路径、ARIA、44px 几何、班种颜色、点格一次事件、增量撤销、WXS 四层坐标、轴锁、惯性、进度条、API 和 fixture 不变。
- 验证：官方 `miniprogram-ci.getCompiledResult` 编译文件由 53 降为 50、返回 80 个结果文件；Mini typecheck/source/output/2 个探针 Worklet/包体/确定性/simulate 通过（132585 bytes，manifest `20dc42fe7735eb7124d3e8d7be64a40442fbbc647fc38f90290b8ff5695a158d`）。根 lint/build/typecheck、`smoke:check-core`、任务格式和 `git diff --check` 通过；排除用户自有 `runtime/**`/`src/**` 后主源码 140 文件/790 项通过、32 文件/265 项按环境跳过。
- 发布：代码 checkpoint `e5f7be2`（`perf(miniprogram): flatten matrix cell rendering`）已推送；微信体验版 `0.1.0-p1.20260821.41` 从隔离工作树上传成功（50 个代码文件、37878 bytes，manifest `9da55ac6aeb8cb3945d3dc211e1f3209c23a17e1255c1507db06842dd91e07e1`）。ECS 发布前加密数据库备份 archive `8d159f9b-b8ec-4ad1-9583-981de8e2eded`（50 表、157696 行、70977836 bytes，SHA-256 `5d9dc40ae51e54eb37e7a1a011cff7e553cdf301bd31af6bbeb7b59b6798731d`）；release `e5f7be20b4c71c5e2e51afc356f41b620a6d24f8` 已部署，预热首次 502 后恢复，`ecs-verify.sh` 与正式主页/API 200 通过。
- 当前状态：已实现并发布，正在收口最终状态 checkpoint；`.41@e5f7be2` 可供首屏响应人工复核。用户自有小程序配置、workspace、Web 动效批次、其他 Storybook、`runtime/` 和 `src/` 未纳入本批次。
- 下一批次与停止条件：上传后只验证进入 C/D 后的首次点格/滑动响应时间及现有完整交互；首屏响应明确通过前不进入 P2。

## 2026-08-21 P1 WXS 快速惯性 NaN 修复（当前批次）

- 用户反馈：`.38` 慢速拖动已可连续、松手位置保持、换轴和点格/撤销正常；快速滑动进入惯性后仍回到初始位置并锁死。快速横滑后再纵滑只剩人员层，快速纵滑后再横滑只剩日期层，进度条始终跟手。
- 引入点与根因：`git log -S`/`git blame` 定位 `c35b35b` 的惯性 `step(frameTime)` 把 WXS `requestAnimationFrame` 回调参数当作浏览器时间戳。目标 Skyline 第二帧不提供该参数，`frameTime - previousFrameTime` 生成 NaN；主体使用 `translate(X,Y)`，任一轴 NaN 会使整个主体 transform 失效，而日期/人员单轴 transform 仍可移动，精确对应真机现象。
- 测试先行与实现：将惯性测试改为调用 RAF callback 时不传参数，并断言 120 帧内停止、所有 transform 不含 `NaN`、快速惯性后立即换轴主体仍同步；旧实现以 `translateX(NaNpx)` 和 `Math.pow` 依赖 2 项失败，修复后矩阵 11/11、Mini 12 文件/52 项通过。惯性现使用固定 16ms 步长和 `velocity *= 0.92`，不读取 RAF 参数、不调用 `Math.pow`；通用 clamp 对 NaN 防御性归零。
- 语义审计：只替换惯性帧时间来源和衰减等价实现；触摸跟手、2px/1.2 倍轴锁、四层 transform、边界、静止坐标回写、连续手势、进度条、点格、撤销、390px 视口、fixture 与 API 不变。高频路径仍不 `setData`。
- 验证：Mini typecheck/source/output/2 个探针 Worklet/包体/确定性/simulate 通过（130232 bytes，manifest `2479c0c86d61813d2ecba0e711651ebbd1506447c54a6f49a4033f0a61e596e0`）；根 lint/typecheck、`smoke:check-core`、任务测试文件格式和 `git diff --check` 通过。主工作区根 build 因并行任务重建 pnpm 依赖树而在产品编译前缺少 `.bin/tsc`/esbuild；精确 checkpoint 的隔离冻结安装后根 build 通过。隔离 Mini 中矩阵及其余 48 项通过，只有既有 `visual-compare.test.mjs` 的 Windows CRLF 副本解析失败；主工作区同源码完整 Mini 52 项已通过。
- 发布：代码 checkpoint `3e18c22`（`fix(miniprogram): stabilize fast matrix inertia`）已推送；微信体验版 `0.1.0-p1.20260821.39` 从隔离工作树上传成功（53 个代码文件、38032 bytes，manifest `c4167dccaddda26728209215d9e3de669aeede6c44662ccd7ad91721d8cd7d42`）。ECS 发布前加密数据库备份 archive `6d0c023b-6b28-4978-adbc-dd1ad83d1279`（50 表、157692 行、70975192 bytes，SHA-256 `d8b628e33c2081c366095184db714a8238ec68f2df5e0b158f9a6bb3d23d36fe`）；release `3e18c221b778ce55cbff36686475953e87397d47` 已部署，预热首次 TLS reset 后恢复，`ecs-verify.sh` 与正式主页/API 200 通过。
- 当前状态：已实现并发布，正在收口最终状态 checkpoint；`.39@3e18c22` 可供快速惯性人工复核。用户自有小程序配置、workspace、Web 动效批次、其他 Storybook、`runtime/` 和 `src/` 未纳入本批次。
- 下一批次与停止条件：隔离构建、上传和 ECS 同步后只复测快速横/纵滑、惯性结束位置、再次同轴/换轴、主体同步和进度条；明确通过前不进入 P2。

## 2026-08-21 P1 WXS 矩阵连续手势与回弹修复（当前批次）

- 用户反馈：`.35` 代码版本正确；7×7 和 20×30 首次横向/纵向可用，但松手后回到初始位置，第二次同轴手势无响应；此后换轴时只剩日期或人员单层移动。首次横向时日期+班次、首次纵向时人员+班次同步，证明坐标计算与首帧四层更新本身正确。
- 引入点与根因：`git log -S`/`git blame` 定位 `c35b35b` 首次加入静止 `callMethod → setData` 回写、页面 `getState()` 状态和跨渲染缓存 `ComponentDescriptor`。真机结果表明第一次静止回写后直接 transform/节点句柄失效，下一次触摸继续使用过期状态或过期节点，因此回弹、一次后失效并按层分裂。
- 测试先行与实现：新增“渲染提交后四个节点句柄全部替换仍恢复 X/Y 并支持第二次手势”“上一轮延迟同步不得取消新触摸”“静止摘要与坐标配置同批回写”契约，旧实现 4 项失败；实现后矩阵 11/11、Mini 12 文件/52 项通过。WXS 改用模块级视图坐标，每次 transform 按稳定 ID 获取当前节点；逻辑层把 X/Y、进度和递增 `syncRevision` 同批保存，属性观察器在渲染后重放坐标。同模式同步若遇正在 tracking 的新手势只更新边界，不重置轴、坐标或触摸状态。
- 语义审计：高频 `touchmove`/惯性仍完全没有 `setData`；只在最终静止一次回写可访问摘要和坐标。2px/1.2 倍轴锁、四层对应关系、边界、惯性、进度条、390px 视口、点格、撤销、fixture 和 API 均不改变。节点重新查询只发生在 WXS 视图层 ID 查找，不跨逻辑层。
- 验证：官方 `miniprogram-ci.getCompiledResult` 编译 53 个代码文件并返回 84 个结果文件；Mini typecheck/source/output/2 个探针 Worklet/包体/确定性/simulate 通过（130290 bytes，manifest `3fb10162dfc8d05974697708f781ea42e14efecab26a5c1a6468b8f48f535969`）。根 lint/build/typecheck、`smoke:check-core`、任务文件格式和 `git diff --check` 通过；排除用户自有 `runtime/**`/`src/**` 后主源码 139 文件/784 项通过、32 文件/265 项按环境跳过。
- 发布：代码 checkpoint `181cab0`（`fix(miniprogram): preserve matrix state across gestures`）已推送；微信体验版 `0.1.0-p1.20260821.36` 从隔离工作树直连 IPv4 上传成功（53 个代码文件、38069 bytes，manifest `f8b935b27ceccfc4b550cc18d4dbcfe42f5d7dbf668d1a15a58b5a4861699def`）。ECS 发布前加密数据库备份 archive `39645aab-1d89-44c5-af88-c01995cd271b`（50 表、157688 行、70972548 bytes，SHA-256 `522324e4bbe4ccff0b1a996eea35b6b932e353baf54f7eafb91c99814a694eeb`）；release `181cab00fee905222769b589a96d512be41c1ae3` 已部署，预热首次 502 后恢复，`ecs-verify.sh` 与正式主页/API 200 通过。
- 当前状态：已实现并发布，正在收口最终状态 checkpoint；`.36@181cab0` 可供 C/D 连续手势人工复核。用户自有小程序配置、workspace、Web 动效批次、其他 Storybook、`runtime/` 和 `src/` 未纳入本批次。
- 下一批次与停止条件：上传新体验版后只复测 C/D 连续多次同轴、换轴、松手位置保持、四层同步、进度条、点格和撤销；明确通过前不进入 P2。

## 2026-08-21 P1 WXS 四层矩阵接入（当前批次）

- 用户前置验收：体验版 `.33` 的黄色点可以移动，横向和纵向跟手感均为“同步”。这证明目标 Android 16 + Skyline 能执行内置 `view` 上的 WXS 触摸与同帧 `ComponentDescriptor.setStyle`，允许进入矩阵接入。
- 范围与回归来源：`git log -S`/`git blame` 确认四层矩阵由 `6cdb9aa` 引入，命中高度由 `36e844e` 修正，目标 Android 最终证明 gesture-handler 输入不可用；WXS 探针由 `2b5f536` 引入并已真机通过。本轮只替换 7×7/20×30 矩阵的输入、坐标驱动和惯性，不修改四层 WXML 数据、390px 视口、班种、点格、撤销、fixture 或 `.23` 回退基线。
- 测试先行与实现：新的 WXS 模块/单入口/四层同步/轴锁/有界惯性/保留 tap/静止后回报契约在旧实现上 3 项失败；实现后矩阵+探针定向 14/14、小程序 12 文件/50 项通过。矩阵已移除 `pan-gesture-handler` 和 5 个 Worklet updater，单一内置 `view` 的 WXS 在同一个 `touchmove` 或 `requestAnimationFrame` 回调更新日期 X、人员 Y、主体 X/Y 和进度条 X；2px/1.2 倍方向锁保持，拖动/惯性不 `setData`，最终静止后只 `callMethod` 一次。无位移触摸不返回 `false`，原班次格 select 与增量撤销路径保持。
- 语义审计：尺寸仍由 `SelectorQuery` 在 ready/resize 低频测量并作为 config 传入 WXS；配置变化会取消在途惯性并按新边界裁剪。矩阵内部仍无滚动容器、Canvas、双引擎或高频逻辑层通信；页面、API、异步/错误路径、空值、业务数据和请求次数均未改变。
- 验证：官方 `miniprogram-ci.getCompiledResult` 实际编译 53 个代码文件并返回 84 个结果文件；Mini typecheck/source/output/2 个剩余探针 Worklet/包体/确定性/simulate/CI dry-run 通过（129008 bytes，verify manifest `d1c0b70755b610c548be78e62cad34a37620ce057524358e6defac3fad80d8be`）。根 lint/build/typecheck、`smoke:check-core`、任务文件格式和 `git diff --check` 通过；排除用户自有 `runtime/**`/`src/**` 后主源码 139 文件/782 项通过、32 文件/265 项按环境跳过。
- 上传编译兼容：代码 checkpoint `c35b35b` 已推送，但首次体验版 `.34` 在平台上传编译阶段以 `-80054` 拒绝，精确定位 WXS 不支持 `Number(value)`。该失败版本未上传成功、不可测试。新增禁止 `Number/String` 构造调用的回归守卫先失败后通过，改为纯 `typeof` 数值检查；官方编译结果、Mini 12 文件/50 项、根 lint/typecheck/核心门禁随后通过。
- 发布：修正 checkpoint `59a70ff`（`fix(miniprogram): keep matrix WXS in supported syntax`）已推送。重传 `.34` 先通过 WXS 编译、再因当前公网 IPv4 `123.90.114.166` 未在上传白名单而以 `-10008` 停止；用户添加该 IPv4 后，同一精确 checkpoint 以 `0.1.0-p1.20260821.34` 上传成功（53 个代码文件、37047 bytes，manifest `7054088da467194b5af285b4e0127e16be86e6c1a8830e867b58297e67523431`）。ECS 发布前加密数据库备份 archive `9f77e83f-ccb1-40aa-803b-c159db735607`（50 表、157684 行、70969900 bytes，SHA-256 `1770874d4be6705bccebfc4e24ef1ef59f0fbfa4595eeffd1b17aae28037ce6d`）；release `59a70ffa683846eed9fdc0e36eba6b05401d9474` 已部署，预热首次 502 后恢复，`ecs-verify.sh` 与正式主页/API 200 通过。
- 当前状态：已实现并发布，正在收口最终状态 checkpoint；`.34@59a70ff` 可供 C/D 人工复核。用户自有小程序配置、workspace、其他 Storybook、`runtime/` 和 `src/` 未纳入本批次。
- 下一批次与停止条件：上传新体验版后只请用户重测 C/D 的横向、纵向、冻结层、惯性、进度条、点格和撤销；明确通过前不进入 P2。

## 2026-08-21 P1 WXS 视图层拖动能力探针（当前批次）

- 用户复核：最终体验版探针页面可以滚动，运行信息完整，系统为 Android 16；最小 `pan-gesture-handler` 蓝点仍完全无法拖动或跟手。结合此前普通 `touchmove` 453 次，结论是页面/普通触摸正常，但目标 Android 不执行该 gesture-handler Worklet 输入路径。
- 范围与回归来源：`git log -S`/`git blame` 确认独立 Pan/普通触摸探针由 `2d51e22` 引入、版本与首屏修复由 `e5ec6b9` 引入。本轮只在 diagnostic-only 探针页增加 WXS 黄色点，不修改 7×7/20×30 矩阵、业务 API、数据或旧回退基线。
- 官方依据与选择：官方 WXS 响应事件文档允许内置组件把触摸响应留在视图层并以 `ComponentDescriptor.setStyle` 直接更新样式，避免普通 `touchmove → 逻辑层 → setData` 往返；但正文以 WebView 为背景，没有承诺 Skyline Android 等价性。因此先做独立真机探针，通过前不接入矩阵。[WXS 响应事件](https://developers.weixin.qq.com/miniprogram/dev/framework/view/interactive-animation.html)
- 测试先行与实现：新增 WXS 模块/事件/矩阵隔离契约在旧实现上因 `drag-probe.wxs` 缺失而失败；实现后 5/5 通过。黄色点使用内置 `view` 的 WXS `touchstart/touchmove/touchend/touchcancel`，直接 `setStyle(transform)`，X/Y 分别限制在 ±96/±70px，不调用 `setData`；蓝色 Worklet 与灰色普通触摸探针保持不变。视觉按 `frontend-design` 只用现有 warning tokens 区分第三条链路，不建立产品 Storybook 黄金稿。
- 验证：小程序 12 文件/50 项、typecheck/source/output/7 个 Worklet/包体/确定性/simulate 与 CI dry-run 通过（124514 bytes，manifest `dbc3fc5bb108e4160708689ad9644aef4cfa8ae3505caf9bf86d09cd16f7d3d1`）；官方 `miniprogram-ci.getCompiledResult` 实际编译 52 个代码文件并返回 83 个结果文件，WXS/WXML 语法通过。根 lint/build/typecheck、`smoke:check-core`、任务文件格式和 `git diff --check` 通过；排除用户自有 `runtime/**`/`src/**` 后主源码 139 文件/782 项通过、32 文件/265 项按环境跳过。未排除的根测试/格式只被用户旧 release 副本与未完成文件阻断，本轮不修改。
- 发布：代码 checkpoint `2b5f536`（`test(miniprogram): add WXS drag capability probe`）已推送；微信体验版 `0.1.0-p1.20260821.32` 从该提交的隔离工作树直连 IPv4 上传成功（52 个代码文件、38910 bytes，manifest `847b414aeef8e180e3e7c9d51a52bf3b16e1494e6deed3b15bdf40a8de33d6dd`），页面显示 `.32@2b5f536`。ECS 发布前加密数据库备份 archive `a8d1c866-15dc-401c-a434-92201bab19f3`（50 表、157681 行、70967916 bytes，SHA-256 `f1db6bfe9d575ff458ab5725b5960df95dfe3d570c11f802e556a567124ba6f4`）；release `2b5f536c10c8ba9f4c43e8e3d91a19f5703f1977` 已部署，预热首次 TLS EOF 后恢复。
- 线上验证：`ecs-verify.sh` 通过健康、产物哈希、43 条迁移、域名隔离、公开端口、容器和依赖检查；正式主页/API 均为 200。当前状态：已实现并发布，正在收口最终状态 checkpoint；用户自有小程序配置、workspace、其他 Storybook、`runtime/` 和 `src/` 未纳入本批次。
- 用户后续验收：最终 `.33` 黄色点可以移动，横向/纵向跟手感均同步；该探针停止条件已满足，矩阵接入转入上方独立批次。

## 2026-08-21 小程序可见构建版本与探针首屏修复（当前批次）

- 用户探针结果：`.29` Android 蓝点不动，但普通 `touchmove` 递增至 453 次；基础库 `3.17.0`、微信 `8.0.76`、Android 设备 `23116N5BC`。结论是普通触摸链路正常、目标运行时不执行 `pan-gesture-handler` Worklet；矩阵下一步必须转向非 gesture-handler 输入。探针页面因禁止页面滚动看不到系统字段，用户同时要求小程序内可见显示上传版本，防止体验版延迟/缓存误判。
- 测试先行：构建常量、四页版本显示、探针运行信息顺序与页面滚动契约在旧实现上 4 项失败；实现后定向 3 文件/11 项、小程序 12 文件/48 项通过。
- 实现：构建脚本注入 `buildVersion` 与七位 Git commit，并写入 `dist/build-profile.json`；体验上传显示 `WECHAT_CI_VERSION@commit`，本地编译显示 `local@commit`。基础控件、月历、7×7/20×30矩阵和探针均显示统一低对比度版本徽标。探针恢复页面滚动，将代码版本/SDK/平台/设备/系统卡移到蓝点之前。
- 官方能力核对：官方资料未提供普通 `touchmove` 的 Worklet UI线程绑定；当前可确认的候选是逻辑线程普通触摸或 WXS 视图层事件。尚未实测 WXS 在本 Skyline/Android 组合的行为，因此本轮不修改矩阵输入方案。
- 验证：小程序 typecheck/build/source/Worklet/包体/确定性/模拟门禁与 `miniprogram-ci` dry-run 通过（7 个源码/产物 Worklet、121764 bytes，manifest `bf132261c041cee3ca51d5b8c9a8ce966152dc17bee742c849c2c24f04652f62`）；任务文件 Prettier/ESLint、根 lint/build/typecheck、`smoke:check-core` 与 `git diff --check` 通过。排除用户自有 `runtime/**`/`src/**`、既有迁移计数测试和未完成护士 Storybook 草稿后，当前受控源码 136 文件/769 项通过、32 文件/265 项按环境跳过。
- 发布：代码 checkpoint `e5ec6b9`（`feat(miniprogram): show visible build identity`）已推送；微信体验版 `0.1.0-p1.20260821.30` 从该提交的干净工作树直连 IPv4 上传成功（51 个代码文件、38233 bytes，manifest `5f2815d413af7a4b09ca3b6057c2ecfaec95cc4d176556a4a5ed8050e4ec3e10`），页面显示 `0.1.0-p1.20260821.30@e5ec6b9`。ECS 发布前加密数据库备份 archive `519200ae-10d4-41b4-83bf-2f134d14fe97`（50 表、157678 行、70965932 bytes，SHA-256 `3a080d262ba65901117d1d80bfeca891be30564b12d7532d4fab776b6c6817d7`）；release `e5ec6b9dbf9da8017fb394db431a3aea2d887ee2` 已部署，预热首次 502 后恢复。
- 线上验证：`ecs-verify.sh` 通过生产健康、产物哈希、43 条迁移、域名隔离、监听端口、容器和依赖检查；`current-release`、部署清单与代码 checkpoint 一致，正式首页与 `/api/health` 均为 200。当前状态：已实现并发布，正在收口最终状态 checkpoint；用户自有小程序配置、workspace、Storybook 草稿、`runtime/` 和 `src/` 未纳入本批次。
- 下一批次与停止条件：只请用户核对新体验版探针首屏代码版本与系统字段是否可见/页面能否滚动；确认版本链路后再单独决定 WXS 探针或普通触摸矩阵，不进入 P2。

## 2026-08-21 P1 Android 最小手势能力探针（当前批次）

- 用户结果：显式真机命中高度版 `.27` 仍表现为 PC 横纵流畅、Android 横纵完全无输入；按既定停止条件不再修改矩阵，改做独立最小能力探针。
- 测试先行：新增路由/最小 Pan/普通触摸/设备信息与人工计划契约在旧实现上 4 项失败；实现后定向 2 文件/5 项通过，基础画廊入口测试同步从 3 条更新为 4 条。
- 实现：新增 diagnostic-only `pages/gesture-probe/index`。A 区严格使用明确 280×220 尺寸的 `pan-gesture-handler + 普通 view + SharedValue 蓝点`；B 区只使用普通 `touchstart/touchmove/touchend` 并显示计数；C 区只在本页展示 SDK、微信版本、平台、设备和系统。页面不含矩阵、滚动容器、自定义单元格、业务 API 或业务数据。
- 验证：小程序 11 文件/45 项、typecheck/build/source/Worklet/包体/确定性/模拟门禁与 `miniprogram-ci` dry-run 通过（7 个源码/产物 Worklet、118486 bytes，manifest `de9c5c4954f50437345c760f7afe0cf982303295250fb5f2a54533f0f8149a63`）。根 lint/build/typecheck、`smoke:check-core` 与任务文件格式通过；排除用户自有 `runtime/**`/`src/**`、既有迁移计数测试和正在编辑的未跟踪护士 Storybook 实验后，当前受控源码 135 文件/766 项通过、32 文件/265 项按环境跳过。
- 发布：代码 checkpoint `2d51e22`（`test(miniprogram): add android gesture capability probe`）已推送；微信体验版 `0.1.0-p1.20260821.28` 通过直连 IPv4 上传成功（51 个代码文件、37530 bytes，manifest `144357f354982407c11770a9c498c239d8d483d9371d7533f9b4cb8792fbcbbd`）。ECS 发布前加密备份 archive `148061e7-9478-4f82-9ea4-2e70460da25e`（50 表、157659 行、70955780 bytes，SHA-256 `bcb51ac9561e53beb66d4cc57fc5262a84a05293fc6d7c6336ad1fb4fe39a640`）；release `2d51e222645dac9ac9473830ac570666e82225d1` 已部署，预热首次 TLS 重置后恢复。
- 线上验证：`ecs-verify.sh` 通过生产健康、产物哈希、43 条迁移、域名隔离、监听端口、容器和依赖检查；`current-release`、部署清单与 Git checkpoint 精确一致，正式域名 `/api/health` 返回 200，未写业务数据。
- 当前状态：已实现并发布 → 待用户仅测试探针并回报蓝点、普通触摸计数和运行信息；本状态收口 checkpoint 推送、微信体验上传和 ECS 同步后停止。
- 下一批次与停止条件：探针结果出来前不修改矩阵、不进入 P2；蓝点不动但普通触摸递增则转向非 gesture-handler 输入方案，两者都不动则检查页面/真机调试输入层，蓝点移动则回到矩阵局部竞争排查。

## 2026-08-21 Lucide Minimal 导航图标落地（当前批次）

- 批次范围：用户已确认 Storybook 的“开源 Lucide Minimal 推荐版”；本批次只把生产工作台桌面侧栏、移动底栏、更多页及退出入口的图标替换为同一套本地 SVG 动效。导航顺序、角色过滤、路由、抽屉关闭、退出事件、API、权限和数据库均不修改。
- 回归来源与测试先行：`git log -S` / `git blame` 确认 TDesign 图标映射由 `5b00fa7` 引入，通讯录与“我的”入口分别由 `8309dce`、`0b7b1b8` 补充。生产接线、全图标覆盖、循环范围和许可记录断言在旧实现上 4 项失败；实现后导航定向 14/14 通过。
- 设计与实现：新增无运行时依赖的 `WorkbenchNavIcon`，用 24×24、2px 圆端单色线条覆盖 14 个业务入口及“更多 / 退出”。日历勾选、通讯录人物进入、历史回拨、换班双箭头、通知摆铃、统计趋势绘制等均按图标定义使用独立 CSS 循环；只有当前目的地持续播放，非当前项与退出保持静态，移动次级页面由“更多”承接当前态。系统减少动态偏好会停用动画。
- 来源与许可：几何以 Lucide ISC（含 Feather MIT 派生声明）为基线，动效参考 `pqoqubbw/icons` MIT；未新增动画包或第三方运行时。来源选择、未选方案和完整许可文本已保存于 `apps/web/docs/`。
- 语义等价审计：`select` / `sign-out` 仍各发出一次，抽屉仍在选择或退出时关闭；桌面/移动数组、接收者绑定、异步与错误路径、空值、权限和业务副作用不变。行为变化仅为当前导航图标的视觉循环及 SVG 几何。
- 验证：当前主工作区排除用户自有 `runtime/**` / `src/**` 后 137 文件/774 项通过，32 文件/265 项数据库集成按环境跳过；根 lint/build/typecheck、Web typecheck/production build、完整 Storybook build、任务文件 Prettier/ESLint、导航定向测试、`smoke:check-core` 与 `git diff --check` 均通过。`运行/浏览器验证：pnpm --config.verifyDepsBeforeRun=false smoke:browser` 已在当前源码服务运行，但本机 MySQL `127.0.0.1:3306` 拒绝连接，管理员登录回退 `/login?redirect=/`，失败发生在导航产品断言前；已确认的 Storybook 视觉稿与生产故事均由同一生产组件渲染。
- 发布门禁修正：发布前 `ecs-verify.sh` 对现行 `a43618a` release 首次出现 API 目录哈希假失败；从 release 压缩包解出后逐文件 `diff` 为 0。`git log -S` / `git blame` 定位 `5f2bb8b`/`33eb489f` 引入的全路径排序与打包器逐目录深度优先排序不等价。同序断言在旧脚本上先失败；验证器改为逐层 sibling 排序递归后测试 3/3、服务器 `bash -n` 与现行 release 完整 `ecs-verify.sh` 通过，健康、产物哈希、域名隔离、容器和 43 条迁移均正常。修正 checkpoint 识别消息：`fix(infra): align release tree verification order`。
- checkpoint 与发布：导航 checkpoint `5b9542a` 与验证器修正 `f66d1ec` 均已推送，并随共享不可变 release `2d51e222645dac9ac9473830ac570666e82225d1` 部署；发布前加密备份 archive `148061e7-9478-4f82-9ea4-2e70460da25e`（50 表、157659 行、70955780 bytes，SHA-256 `bcb51ac9561e53beb66d4cc57fc5262a84a05293fc6d7c6336ad1fb4fe39a640`）。状态同步 release `63a59f6099cd39c8c8448bc14d116c3fc2cbb108` 发布前备份 archive `458715c4-8565-4cf3-a4d2-6abf2cbf4d2e`（50 表、157660 行、70956440 bytes，SHA-256 `7deb1bf1410abaf987477ff82aa66948635fe9aada782def49ce50c5611dd14c`）。
- 正式核验：修正后的 `ecs-verify.sh` 对两个 release 均通过健康、产物哈希、域名隔离、公开端口、容器、依赖和 43 条迁移；最终正式主页/API 为 200，未认证群组端点为 401。生产 `HomeView` JS/CSS bundle 命中 `lucide-minimal-icon`、回拨/换班关键帧、减少动态规则及来源标识；未登录或写入业务数据。
- 当前状态：已完成（含推送、生产备份、部署与正式只读核验）→ 待用户复核。最终状态 checkpoint 识别消息：`docs(status): record navigation icon deployment`。用户自有小程序配置、`pnpm-workspace.yaml`、其他 Storybook、`runtime/` 和 `src/` 未纳入本批次。
- 下一批次与停止条件：只提交、推送并部署本最终状态 checkpoint，使 Git `HEAD`、`origin/main` 与服务器 `current-release` 一致；随后停止并等待用户验收，不开始其他修改。

## 2026-08-20 护士多班种日历偏好与分组详情（当前批次）

- 批次范围：落地用户确认的护士一天多班种方案；月视图按群组/个人默认只筛选一个班种且同班人员姓名逐一显示，周视图继续显示全部班次；仅重做选中日期详情卡。不得修改 `MonthGrid.vue`、`WeekGrid.vue` 的模板或样式。
- 回归来源与测试先行：`git log -S`/`git blame` 确认默认月视图/通用过滤来自 `db35a77`/`ab25064`，逐班次详情轨道来自 `1c84fd6`，群组设置来自 `720404a`。新契约、分组 helper、生产接线和迁移计数在旧实现上分别因模块/接线缺失而失败；实现后定向 14 项通过。月/周组件 SHA-256 守卫分别锁定 `40bab5615ad05189a842fdbf3ccf63687d73967ba7dfb1ee909589bd202cb188`、`32d50cdc5dca2c6b3e21147768047972246c813b83054b1906d81286ac866a60`，工作树对两文件无 diff。
- 持久化与权限：迁移 `0043_calendar_preferences` 为群组增加默认视图/默认月班种，为成员关系增加可空的个人覆盖；默认视图为月，空个人值表示跟随群组。新增受认证的读取、群组默认更新和本人偏好更新 API；群主、群管理员、后台管理员可改群组默认，active owner/administrator/member 可读写本人偏好，guest/跨群拒绝。班种 ID 必须属于当前群组、未删除且已启用；失效旧值读取时安全回退。
- Web 行为：群组管理页新增“群组日历默认设置 / 我的日历偏好”。`CalendarView` 读取有效偏好；只在月视图且用户未手动筛选班种时使用默认班种，周/列表和手动筛选保持原 `visibleAssignments`。详情按班种开始时间与配置顺序分卡，同班多人留在同一卡内且姓名全部可见；点击姓名展开短号优先的“短号 / 手机”分体拨号，固定 D/NP 说明每班种只显示一次，事件入口逐人保留。
- 验证：主工作区排除用户自有 `runtime/**`/`src/**` 后 136 文件/773 项通过，32 文件/265 项数据库集成按环境跳过；Contracts/Database/API/Web typecheck、Contracts/Database/API 构建、Web production build、Storybook build、任务文件 Prettier/ESLint、`smoke:check-core` 通过。生产详情 Storybook 在 390px 验证同班三人一张 D 卡、姓名完整、短号/手机分体拨号、44px 操作、无横向溢出和零产品控制台错误。
- 环境限制：`运行/浏览器验证：pnpm smoke:browser` 的等价直接入口已运行，但本机 MySQL 127.0.0.1:3306 拒绝连接，管理员登录回退 `/login?redirect=/`；Docker Desktop 未运行，迁移/API 集成按环境跳过。失败发生在产品断言前，未归因为功能回归；生产部署仍须先备份并以迁移器、`ecs-verify.sh` 和正式域名只读复核收口。
- checkpoint 与发布：代码 checkpoint `f723b0d`（`feat(calendar): add multi-shift preferences and grouped details`）已推送。发布前加密数据库备份 archive `9b092f7f-4fc9-4002-964a-09c2cac62e9a`（50 表、157657 行、70951728 字节，SHA-256 `8bd68d81e2390a5b13986d57702641edfb026d4823d6f2490bf32d22f030a13a`）；release `f723b0dbbe5b5f313158f2f76f8466159443074d` 从隔离干净工作树构建并部署，容器预热首次 502 后自动恢复。
- 正式核验：`ecs-verify.sh` 通过健康、产物哈希、域名隔离、公开端口、容器和依赖检查；正式数据库为 43 条迁移，4 个日历偏好列齐全。首页健康返回 200，未认证偏好端点返回 401；正式 Web/API bundle 分别命中“群组日历默认设置”和 `/calendar-preferences/mine`。服务器 release、部署清单与代码 checkpoint 一致，部署未复制本地数据库或写入排班业务数据。
- 当前状态：已完成（含代码推送、生产备份、迁移、部署和正式只读核验）→ 待用户复核。现有小程序、其他 Storybook、`pnpm-workspace.yaml`、`runtime/`、`src/` 均为用户所有，未纳入 checkpoint。
- 下一批次与停止条件：只提交、推送并部署本最终状态 checkpoint，使 Git `HEAD`、`origin/main`、服务器 `current-release` 一致；随后停止，不进入其他 Web 或小程序任务。

## 2026-08-20 P1 Android Pan 命中高度修复（当前批次）

- 用户结果：四层纯 Worklet 体验版 `.25` 在 PC 模拟器可横纵滚动且无黏滞，但 Android 真机横纵都完全不动；坐标、冻结层和惯性已由 PC 证明可运行，故障收窄为真机 Pan 未命中。
- 排查：正式配置为基础库 `3.17.1`、`compileWorklet=true`、全局 Skyline，上传产物保留 5 个 Worklet，排除版本/编译缺失。`pan-gesture-handler` 与 `.matrix-pan-surface` 原先只写 `height:100%`，而内部四层全部绝对定位、不参与父级高度计算；Android 可显示溢出层但手势节点可能保持零高，PC 仍对溢出内容分发鼠标事件。
- 测试先行与实现：新增真机命中区契约在旧实现上 1 项失败；handler 与普通命中面现都以内联 `matrixViewportHeight` 像素值定高，handler 显式 `display:block`。X/Y、四层 transform、轴锁、边界、惯性、点格和撤销均未改变。
- 验证：定向 9/9、小程序 10 文件/42 项、typecheck/build/source/Worklet/包体/确定性与 `miniprogram-ci` dry-run 通过（5 个源码/产物 Worklet、110319 bytes，manifest `a478d162c3be8d47d6bfa6ad33d312f8fc6cc998b5acc6146c3a5945280c999c`）。任务文件 Prettier、根 lint/build/typecheck、`smoke:check-core` 与 `git diff --check` 通过；排除用户自有 `runtime/**`/`src/**`、既有过期迁移计数测试及正在编辑的两个未跟踪 Storybook 实验测试后，当前受控源码 127 文件/747 项通过、31 文件/262 项按环境跳过。
- 发布：代码 checkpoint `36e844e`（`fix(miniprogram): size matrix gesture hit area`）已推送。微信体验版首次经本地代理上传被平台以不可配置的 IPv6 白名单拒绝，清除代理并强制 Node IPv4 后，同一 checkpoint 以 `0.1.0-p1.20260820.26` 上传成功（48 个代码文件、34656 bytes，manifest `2c5336adf30f1e5ed11294be1b55beb3eb5bbb63c1271427d7cc8380d57f4337`）。ECS 发布前加密备份 archive `871c1a1e-0ce4-439e-9835-f49960b2d4b8`（50 表、157655 行、70950404 bytes，SHA-256 `bc7fdfd127b8674756472ae926781b8506822fd199ef38435ae0ccad935fceeb`）；release `36e844e5cfba16f505f0fe8beb83574b920bdb2a` 已部署，预热首次 502 后恢复。
- 线上验证：`ecs-verify.sh` 通过生产健康、产物哈希、42 条迁移、域名隔离、监听端口、容器和依赖检查；`current-release`、部署清单与 Git checkpoint 精确一致，正式域名 `/api/health` 返回 200，未写业务数据。
- 当前状态：已实现并发布 → 待用户 Android 人工复核；本状态收口 checkpoint 推送、微信体验上传和 ECS 同步后停止。
- 下一批次与停止条件：若真机仍完全无输入，下一步不再调整布局，改为独立最小手势探针验证设备 gesture-handler 能力；未通过前不进入 P2。

## 2026-08-20 P1 四层纯 Worklet 矩阵（当前批次）

- 用户结果与决策：体验版 `.23` 从人员列/班次格起手仍均无纵向位移，单一 `native-view=scroll-view` 代理方案失败。用户确认改为电子表格式四层纯 Worklet 二维平移，同时保留旧方案回退能力。
- 回退基线：Git release `78e341b5ca96ab1c95e4757e75524a88fcfa8219`、代码 `e43cf4fb907a3393107cc894d2832b31918bb06f`、微信体验版 `0.1.0-p1.20260820.23`；新方案人工失败时创建 `git revert` checkpoint 并重新上传，禁止 reset 或在运行包长期保留双引擎。权威决策见 `apps/miniprogram/docs/decisions/ADR-0005-worklet-matrix-engine.md`。
- 测试先行：新契约在旧实现上 5 项失败，要求矩阵内部没有 `scroll-view/native-view`，普通视图上的一个 Pan Worklet 直接维护 X/Y，日期绑定 X、人员绑定 Y、主体绑定 X/Y，横向/纵向 ACTIVE 均不 `setData`，结束后才提交提示状态。
- 实现：7×7/20×30 共用同一四层长期节点；2px/1.2 倍方向门槛与单手势轴锁保持，横纵边界分别由 maxX/maxY SharedValue 约束，两个方向松手均使用 `decay`。现有 390px 高度、单元格、班种、点格、撤销和视觉令牌不变。
- 验证：失败测试已转绿；定向 9/9、小程序 10 文件/42 项、typecheck/build/source/Worklet/包体/确定性/模拟门禁与 `miniprogram-ci` dry-run 通过（5 个源码/产物 Worklet、110179 bytes，manifest `4866b63ce963dca6b583537e6b8a634bbea6c02a8cfe8de5db2e361136c92a18`）。任务文件 Prettier/ESLint、根 lint/build/typecheck、`smoke:check-core` 与 `git diff --check` 通过；排除用户自有 `runtime/**`/`src/**` 和既有过期迁移计数测试后的当前源码 129 文件/757 项通过、31 文件/262 项按环境跳过。
- 发布：代码 checkpoint `6cdb9aa`（`fix(miniprogram): use four-layer worklet matrix engine`）已推送；微信体验版 `0.1.0-p1.20260820.24` 上传成功（48 个代码文件、34652 bytes，manifest `b0603cd75a93d9ee9f8db3d758e12b5b1e39d9139882b0ff2fc57c644426c216`）。ECS 发布前加密备份 archive `74d98de0-50a5-4b34-a4d8-60cb9c22d9c4`（50 表、157653 行、70949080 bytes，SHA-256 `f7536d84b782d58fb610a834c6200e7cf4181f328ecdd7f3ff8d678b143a6968`）；release `6cdb9aa45e864497a4ce178f731287ebfb4296aa` 已部署，预热首次 502 后恢复。
- 线上验证：`ecs-verify.sh` 通过生产健康、产物哈希、42 条迁移、域名隔离、监听端口、容器和依赖检查；`current-release`、部署清单与 Git checkpoint 精确一致，正式域名 `/api/health` 返回 200，未写业务数据。
- 当前状态：已实现并发布 → 待用户比较新 `.24`/最终收口体验版与旧 `.23`，重新复测 C/D；本状态收口 checkpoint 推送、微信体验上传和 ECS 同步后停止。
- 下一批次与停止条件：只完成四层引擎发布并请用户复测；未明确通过前不进入 P2，也不删除 `.23` 回退记录。

## 2026-08-20 P1 Android 单一原生滚动代理（当前批次）

- 用户澄清：体验版 `.21` 在 Android 上从左侧人员姓名或右侧班次格起手都完全没有纵向位移，只有横向丝滑；上一轮“班次已动、仅人员不动”的推断作废，未提交的人员动画层实验已完整撤销。
- 回归定位与测试先行：`git log -S`/`git blame` 确认 `6799f1f` 起一直采用外层纵向/全向 handler 与内层横向 `native-view=scroll-view` 嵌套，`48fbe08`/`50f8319` 只调整 simultaneous、让出与轴锁，真机仍证明外层从未 ACTIVE。新契约在旧实现上 3 项失败，要求只有一个原生滚动代理，禁止嵌套 handler、simultaneous 和 should-response 父级转交。
- 实现：一个 `pan-gesture-handler native-view="scroll-view"` 直接承载既有横向 `scroll-view`、人员覆盖层和固定角，并在自身 `ongesture` 中锁轴。横向锁定时不写 Y，原生 `scroll-x` 保持现有丝滑路径；纵向锁定时同一回调直接更新人员/班次 SharedValue，完全绕过父级接管。2px 门槛、1.2 倍方向优势、END/CANCELLED 重置和纵向 `decay` 保持。
- 语义等价审计：仅替换手势组件拓扑和回调入口；20×30 fixture、宽高、原生横向内容/进度、纵向偏移/边界、人员/班次动画绑定、点格、撤销、`setData` 次数、空值和错误路径不变。所有手势方法仍是页面成员 Worklet，没有新增异步或业务副作用。
- 验证：失败测试已转绿；定向 9/9、小程序 10 文件/42 项、typecheck/build/source/Worklet/包体/确定性/模拟门禁与 `miniprogram-ci` dry-run 通过（6 个源码/产物 Worklet、109919 bytes，manifest `125d7a956fd8f2ebdd42a63c78d61a17b92f18b39916e14a631ca2f6649308c9`）。任务文件 Prettier/ESLint、根 lint/build/typecheck、`smoke:check-core` 与 `git diff --check` 通过；排除用户自有 `runtime/**`/`src/**` 和既有过期迁移计数测试后的当前源码 128 文件/752 项通过、31 文件/262 项按环境跳过。
- 发布：代码 checkpoint `e43cf4f`（`fix(miniprogram): use one native matrix gesture proxy`）已推送；微信体验版 `0.1.0-p1.20260820.22` 上传成功（48 个代码文件、34622 bytes，manifest `b3ab9c02ccf95b30fbe13df82333b974fb96a97f6f0478893d09a8ce6064c591`）。ECS 发布前加密备份 archive `8c26dfb6-4572-4db8-9bac-949b8352dfd8`（50 表、157061 行、70235196 bytes，SHA-256 `e3f9d8af3fd7835738ec8e376daf7135aed60c8ab835f44c2e713fcb18fa6f89`）；release `e43cf4fb907a3393107cc894d2832b31918bb06f` 已部署，预热首次 502 后恢复。
- 线上验证：`ecs-verify.sh` 通过生产健康、产物哈希、42 条迁移、域名隔离、监听端口、容器和依赖检查；`current-release`、部署清单与 Git checkpoint 精确一致，正式域名 `/api/health` 返回 200，未写业务数据。
- 当前状态：已实现并发布 → 待用户 Android 人工复核；本状态收口 checkpoint 推送、微信体验上传和 ECS 同步后停止。
- 下一批次与停止条件：只复测 D 的人员列和班次格纵向起手；用户未明确通过前不进入 P2。

## 2026-08-20 移动常驻导航与科室电话行精简（当前批次）

- 批次范围：移动底栏只常驻排班日历、通讯录、换班、我的，保持“更多”为第五项，其他已授权功能全部进入更多页；科室通讯录结果移除电话左侧类型标签，增加长号/短号组间距并保持号码单行。不修改桌面导航、权限、数据源、号码或拨号行为。
- 回归定位与测试先行：`git log -S` / `git blame` 确认移动主入口由 `db35a77` 建立并在 `0b7b1b8` 固定为日历/通讯录/请假/换班/我的，电话标签与两列布局由 `427ff6b` 引入。更新导航与通讯录契约后旧实现 2 项失败，实现后相关 3 文件/25 项通过。
- 实现与语义：`primaryMobileTabIds` 精确为 calendar/directory/swap/profile，主入口按该数组顺序生成，避免被桌面配置顺序重排；请假及其余入口均由 secondary 列表进入更多页，角色过滤和桌面全量侧栏不变。科室模式的 `shouldShowContactLabel` 始终为 false，人员模式既有移动电话标签规则保持；长短号外层 gap 为 8px，≤380px 为 6px，内部号码继续 `nowrap`。仅把两个职称循环局部变量从 `title` 改为 `jobTitle` 以清除既有 lint 警告，渲染值/顺序不变。
- 视觉验证：新增生产移动导航 Storybook。390px 实测底栏标签精确为“排班日历 / 通讯录 / 换班 / 我的 / 更多”，5 项高度约 59px；更多页含请假、群组、手排、补录、加扣班、事件、通知、统计、成员、配置和退出。科室搜索“病案”在 390/320px 均为 0 个 `.contact-label`，长短号 gap 8px/6px，号码均 `white-space: nowrap`，页面 `scrollWidth = clientWidth`。
- 验证：根 lint/build/typecheck、Web typecheck/build、Storybook build、任务文件 Prettier/ESLint、`git diff --check` 与 `smoke:check-core` 通过；主工作区排除 `runtime/**`、`src/**` 和既有过期迁移计数测试后 128 文件/752 项通过、31 文件/262 项按环境跳过。完整格式检查仍被用户 `project.config.json`、旧 `storybook-static-my-profile/` 和已提交目录批次的 `directory-entry-groups.ts` 阻断，本轮文件格式通过。
- 运行/浏览器验证：`pnpm --config.verifyDepsBeforeRun=false smoke:browser` 在当前源码服务运行，因本机 MySQL 127.0.0.1:3306 拒绝连接而在管理员登录回退 `/login?redirect=/`；真实 Storybook 已覆盖底栏、更多页及科室号码 390/320px 几何和交互，控制台无产品错误。
- checkpoint 与发布：代码 checkpoint `279c2fd`（`fix(web): keep mobile nav and compact directory phones`）首次推送遇到 GitHub 连接重置，网络恢复后快进推送成功。发布前加密数据库备份 archive `52df93d2-293b-4c05-84d6-b386ae367e35`（50 表、131796 行、58820132 字节，SHA-256 `107b4d31ecc0dd9c4eeab1ff50cdd1ca195f854c28d5814bf1576c6fe80e2b37`）；release `279c2fd2321f201973cf50fccc3361f8dff092e0` 从隔离干净工作树构建并部署，预热首次 TLS 连接重置后自动恢复。
- 正式核验：`ecs-verify.sh` 通过健康、产物哈希、42 条迁移、域名隔离、公开端口、容器和依赖检查；首页与 `/api/health` 均为 200。正式 JS bundle 精确包含 `calendar,directory,swap,profile` 顺序，CSS bundle 命中 8px/6px gap 与 nowrap；Git `HEAD`、`origin/main`、服务器 release 和部署清单一致，未写业务数据。
- 当前状态与下一批次：已完成实现、推送、生产备份、部署和只读核验 → 待用户复核；只同步最终状态文档 checkpoint 并部署后停止，不开始其他修改。

## 2026-08-20 个人数据口径与登录密码安全（当前批次）

- 批次范围：按用户反馈把“我的”统计单位从错误的“天”改为实际班次“次”，手机号完整显示，移除快速进入卡片；新增受认证保护的修改登录密码能力，并在登录/会话恢复时检测是否仍为初始密码，显示已确认的 Storybook 风格安全提醒。无数据库迁移，不修改排班、通讯录或权限数据。
- 回归定位与测试先行：`git log -S` / `git blame` 确认密码登录由 `de3ad5f` 引入但没有状态/改密端点，快速入口由 `0b7b1b8` 引入，统计与脱敏由 `ebd1b19` 引入。新增合约、服务、路由、客户端、会话、生产模板和弹窗断言在旧实现上共 12 项失败；日志追加 `currentPassword` / `newPassword` 脱敏断言也先失败，实现后转绿。
- 统计与资料：`actualCount` 按领域定义显示为班次“次”，周末/节假日同为班次数；手机号不再脱敏。成员身份请求仍是必要前置，其余联系方式、本月/年度统计和两个月日历使用 `Promise.allSettled` 独立收口，辅助请求失败不再把所有个人数据清成假 0；不可用指标显示 `—`，不伪造数值。同名隔离、实际人员优先和下一班逻辑保持。
- 密码安全：密码响应新增 `mustChangePassword`；初始密码仍为 `123` 时登录和恢复会提示。新增受 Bearer 认证保护的状态 GET 与改密 PATCH，服务端事务锁定凭据、校验当前密码、以新随机盐 scrypt 哈希替换并写 `password_changed` 审计；密码值不进入审计，日志统一脱敏当前/新密码。新密码继续遵循现有“非空、无长度限制”策略，且不得与当前密码相同；非密码登录返回不支持改密。
- 界面：移除“快速进入 / 工作入口”整卡，账户设置新增 44px“修改登录密码”。生产 `PasswordChangeDialog` 复用 Storybook 的琥珀安全图标、居中白色圆角面板和双按钮结构，不展示初始密码明文；提醒态可进入编辑或本次登录不再提示，编辑态含当前/新/确认密码、焦点锁定、Esc/背景关闭、回焦和减少动态支持。
- 验证：定向 8 文件/34 项与日志脱敏 10 项通过；主工作区 128 文件/753 项通过、31 文件/262 项按环境跳过。根 typecheck/build、Web/API/contracts typecheck/build、Storybook build、任务文件 Prettier/ESLint 和 `git diff --check` 通过。既有目录批次仍有 1 项 `package-ecs-release.test.mjs` 期待 40 而实际为 42，根 lint 仍被 `InternalDirectoryView.vue` 两个既有变量遮蔽警告阻断，本轮不混入修复。
- 运行/浏览器验证：`运行/浏览器验证：pnpm --config.verifyDepsBeforeRun=false smoke:browser` 在 `AUTH_DEV_MODE=true` / `VITE_AUTH_DEV_MODE=true` 当前源码服务运行，因本机 MySQL 127.0.0.1:3306 拒绝连接而在管理员登录回退 `/login?redirect=/`。Storybook 真实生产组件已验证提醒/编辑两态、390/320px 无横向溢出、输入/按钮/关闭目标均为 44px；个人页显示完整手机号、统计“次”、快速入口 0 个，未输入或提交密码。
- checkpoint 与发布：代码 checkpoint `664bc1f`（`feat(auth): add password change and profile security`）已推送。发布前加密数据库备份 archive `e1c4985d-9519-42f1-8847-f1dbe9066c97`（50 表、131794 行、58818808 字节，SHA-256 `b4f59adc7f17864af2c693939890a1d37567a5fe3b866b89347f03389dfbf2c9`）；release `664bc1f8a86ff2c342f7afe09213030ab2ede1cd` 从隔离干净工作树构建并部署，预热首次 502 后自动恢复。
- 正式核验：`ecs-verify.sh` 通过正式健康、产物哈希、42 条迁移、域名隔离、公开端口、容器和依赖检查；首页与 `/api/health` 为 200，未认证密码状态端点返回 401。正式 Web bundle 精确包含完整手机号个人页、班次“次”、修改登录密码和初始密码提醒，API bundle 包含受保护状态/改密路由。Git `HEAD`、`origin/main`、服务器 release 与清单一致；未登录、未输入或提交密码、未写业务数据。
- 当前状态与下一批次：已完成实现、推送、生产备份、部署和只读核验 → 待用户复核；只同步最终状态文档 checkpoint 并部署后停止，不替用户执行最终改密提交，也不开始其他修改。

## 2026-08-20 员工通讯录第二轮增量同步与职务标签（当前批次）

- 批次范围：以第一轮已发布的 1070 条员工记录和优化后的层级名称为主，合并第二轮 iOffice 全量数据；保留第一轮工号与层级，补入第二轮缺失的有效人员/层级关系和 `jobTitle` 职务标签，不覆盖第一轮优化文本，不新增无有效号码记录。
- 本地数据：第二轮 1444 条 API 原始记录合并为 1200 条可导入记录（第一轮 1070 条保留、第二轮补入 130 条关系）；合并 manifest `runtime/directory-data/employee/2026-08-20-full/employee-directory-merged.manifest.json` 的导入摘要为 1200 条、1203 个联系方式、140 条职务标签、1068 条工号字段；第二轮原始 CSV 保留在 `employee-api-raw.csv`。第一轮层级键 1070/1070 全部保留。
- 实现：新增目录条目 `job_title` 字段和迁移 `0042_directory_job_titles.sql`；导入器、API 合约/查询和 Web 员工卡片均传递职务标签；员工卡片使用低对比度胶囊标签，保留现有紧凑布局、筛选、搜索、工号和拨号交互。
- 测试先行与验证：新增清洗器、manifest、合约、分组和生产模板回归；定向 14 文件/106 项通过，infra 脚本构建通过，contracts/database 生产构建通过。完整 Web/API typecheck/build 当前被用户已有密码认证未完成改动阻断，与本批次目录文件无关，已单独记录；尚未执行生产导入。
- 发布：代码 checkpoint `a526c60`（`feat(directory): add employee job titles and additive snapshot`）已推送并部署；发布前数据库备份 archive `403292da-990d-44dc-9eb9-e787f57d5d4b`（50 表、106655 行、47348432 字节，SHA-256 `843646445888dd1061999e095a01c2eb72888bacc14c34ab4e2c618581738ccd`）。迁移计数更新为 42，正式 release `a526c60c56e3d2610030c409bbc53c479e0c4fe4`，`ecs-verify.sh` 通过；预热首次 502 后自动恢复。
- 正式数据发布：merged manifest SHA-256 `73ea132c9f7f5b725fa209e165f6517a591344bfd2a16bed1cf8851f62fae40b`；SSH stdin dry-run 为 added 130、changed 1070、removed 0、warnings 0，原子发布批次 `5db71a2d-4471-4bcc-aafa-984cf2a1a3be`，替换上一员工批次。生产聚合核验为 employee 1200 条目、1203 个联系方式、140 个职务标签、1068 个工号字段；正式 `/api/health` 返回 200，未改动院内通讯录。
- 验证：定向目录/合约/UI 14 文件 106 项通过；生产构建的 contracts/database/API/Web 产物包含 `jobTitle` 接线。完整 Web/API typecheck/build 仍被工作树中用户已有的密码认证未完成改动阻断；该改动未暂存、未提交、未部署。本批次已执行 `smoke:check-core`，其仅因上述用户改动缺少对应浏览器记录而阻断，未将其误判为目录回归。
- 当前状态：已完成（含代码发布、迁移、生产备份、目录 dry-run、原子数据发布和正式聚合核验）→待用户复核员工职务标签和新增层级。
- 下一批次与停止条件：无自动活动批次；等待用户复核，不再自动改写员工或院内通讯录。

## 2026-08-20 “我的”个人值班概览补齐（当前批次）

- 批次范围：修复生产“我的”页面与已确认 Storybook 预览的信息差，只补齐真实个人值班统计、近四月节奏、下一班和本人联系方式；不硬编码预览数字，不新增 API/权限/数据库写入，不实现当前系统尚不支持的改密入口。
- 回归定位与测试先行：`git log -S 'profile-grid'` / `git blame` 确认精简生产页由 `0b7b1b8` 引入，当时未迁移 Storybook 的统计、趋势与下一班区块。新增生产契约与个人概览关联测试在旧实现上分别因缺少 API 接线和 helper 模块失败，实现后 7/7 通过。
- 实现：生产页并行读取当前成员、联系方式、本月/年度统计及本月/下月日历；只以 `isCurrentUser` 的 membership ID 关联私密数据，同名非当前成员不会误绑定。显示本月值班、年度累计、周末/节假日、本月相对上月变化、连续四个月趋势和下一待值班次；手机号脱敏，短号保留。访客不请求个人业务数据，失败态可重试，群组切换以请求序号阻止旧响应覆盖。
- 视觉与 Storybook：沿用 `frontend-design` 的医护工作台系统语言，以浅灰画布、白色统计表面和单一深蓝“下一班”焦点卡补齐信息层级；生产 Story 使用合成 overview 后不再强制读取 Pinia。1280、390、320px 实测无横向溢出，390/320px 操作目标至少 44px，窄屏说明完整换行；Storybook Axe 从 4 个颜色对比问题修到 0。
- 语义审计：现有 session、导航、退出、权限和业务写入均未改变；新增请求均为既有只读成员/联系/统计/日历 API，各调用一次。实际排班优先，未发生改派时才回退计划人员；日期/时间继续复用中国标准时间与业务日 helper。异步拒绝只进入本页错误态，不清会话、不改变群组或调用写接口。
- 验证：任务定向 7/7、主工作区 126 文件/739 项通过，31 文件/262 项按环境跳过；唯一既有失败为 `package-ecs-release.test.mjs` 仍期待 40 条迁移而当前验证脚本为 41。Web/根 typecheck、Web/根 build、根 lint、Storybook build、任务文件 Prettier/ESLint、`git diff --check` 与 `pnpm smoke:check-core` 通过；完整 `pnpm verify` 只被用户自有 `project.config.json` 和 `storybook-static-my-profile/` 格式阻断。
- 运行/浏览器验证：`pnpm --config.verifyDepsBeforeRun=false smoke:browser` 首次因 5173 未启动失败；启动 `AUTH_DEV_MODE=true` / `VITE_AUTH_DEV_MODE=true` 当前源码后复跑，因本机 MySQL 127.0.0.1:3306 拒绝连接而在管理员登录回退 `/login?redirect=/`，与上一轮同一环境阻塞一致。独立 Storybook 真实组件已完成桌面/手机/窄屏、无溢出、触达区、完整文字和 Axe 验证。
- checkpoint 与发布：代码 checkpoint `ebd1b19`（`feat(web): restore personal duty overview`）已推送。发布前加密数据库备份 archive `e4996edc-1c75-4168-a813-27425cfaf4dc`（50 表、106653 行、47347108 字节，SHA-256 `64d426333877a70f24303b615e5d64a42e4fb327515d36f5af1d70ec3d2eb4e7`）；release `ebd1b19f0f48a6a211cd16e9b29f0a2cbf676b18` 从隔离干净工作树构建并部署，预热首次 502 后自动恢复。
- 正式核验：`ecs-verify.sh` 通过正式健康、产物哈希、41 条迁移、域名隔离、公开端口、容器和依赖检查；首页与 `/api/health` 均为 200，正式 `HomeView` bundle 精确包含“值班概览 / 值班节奏 / 下一班”。Git `HEAD`、`origin/main`、服务器 `current-release` 与部署清单一致；未登录、未提交表单、未写业务数据。
- 当前状态与下一批次：已完成代码、推送、生产备份、部署和只读核验 → 待用户复核；只同步最终状态文档 checkpoint 并部署，使最终 Git/服务器 release 一致后停止，不开始其他修改。

## 2026-08-20 P1 Android 人员纵向命中与单手势轴锁（当前批次）

- 用户反馈：微信体验版 `0.1.0-p1.20260819.19` 在 Android 上人员仍不发生纵向移动，D 未通过，不进入 P2；PC 已确认双轴流畅，横向原生路径继续保留。
- 回归定位与测试先行：`git log -S`/`git blame` 确认方向识别器与人员覆盖层结构由 `6799f1f` 引入，双向协商由 `48fbe08` 引入，`a9cfe26` 又把等幅/零位移判为横向。新增契约在旧实现上 2 项失败：人员覆盖层位于纵向 handler 结束标签之外，零位移立即返回横向；追加单手势轴锁契约后旧实现继续 2 项失败。
- 实现：纵向 handler 现在包住横向滚动面、人员覆盖层和固定角；横纵两个 `worklet:should-response-on-move` 共享 UI 线程轴状态，小于 2px、等幅或未达到 1.2 倍方向优势时保持未决，首次明确选轴后到 END/CANCELLED 不换轴。人员与班次仍只由同一纵向 SharedValue 驱动，横向仍由日期/班次同一个原生 compositor 驱动，页面尺寸和视觉不变。
- 语义等价审计：本轮只改变手势命中范围、首帧方向门槛和一次按下内的轴状态；20×30 fixture、矩阵宽高、横向滚动坐标、纵向偏移/边界/`decay`、进度条、点格、撤销、`setData` 次数、空值和错误路径均未改变。新增 Worklet 仍以页面成员方法调用，`this`/SharedValue 接收者不拆成裸调用；没有新增异步或业务副作用。
- 验证：失败测试已转绿；定向 9/9、小程序 10 文件/42 项、typecheck/build/source/Worklet/包体/确定性/模拟门禁与 `miniprogram-ci` dry-run 通过（9 个源码/产物 Worklet、112286 bytes，manifest `f00368326d987c6ff544548add07749c180f83dee3ed8138ad2291ff243edecd`）。任务文件 Prettier/ESLint、根 lint/build/typecheck 与 `smoke:check-core` 通过；排除用户自有 `runtime/**`/`src/**` 旧副本和既有迁移计数断言后的当前源码 125 文件/734 项通过、31 文件/262 项按环境跳过。原始 `pnpm test` 的失败均来自上述旧副本缺依赖/CRLF/过期断言，不涉及本轮文件。
- 发布：代码 checkpoint `50f8319`（`fix(miniprogram): lock android matrix gesture axis`）已推送；微信体验版 `0.1.0-p1.20260820.20` 上传成功（48 个代码文件、35934 bytes，manifest `a4ab284e5ec303586add12e875b3dc9d759e4b1348da6b11781312925e176871`）。ECS 发布前加密备份 archive `8292d919-3f39-4527-9b52-143367cbd4ed`（50 表、106644 行、47343548 bytes，SHA-256 `257b95f52cbf392217bfa6e4c59dadeee706cde38dfcd0931714e5ff90629435`）；release `50f83192a585df224e7e1b1fcd2c01c8547d2a75` 已部署，预热首次 502 后恢复。
- 线上验证：`ecs-verify.sh` 通过生产健康、产物哈希、41 条迁移、域名隔离、监听端口、容器和依赖检查；`current-release`、部署清单与 Git checkpoint 精确一致，正式域名 `/api/health` 返回 200，未写业务数据。
- 当前状态：已实现并发布 → 待用户 Android 人工复核；本状态收口 checkpoint 推送、微信体验上传和 ECS 同步后停止。
- 下一批次与停止条件：只复测 D 的人员列/班次格纵向起手、横向丝滑和单手势不换轴；用户未明确通过前不进入 P2。

## 2026-08-19 “我的”生产页面落地与通讯录滑动撤销（当前批次）

- 批次范围：落地生产“我的”账户中心页面，并撤销通讯录页面的左右滑动切换；保留通讯录“科室 / 人员”按钮点击、左右键、Home/End 和选中胶囊动效。不修改通讯录数据、API、权限或数据库。
- 回归定位与测试先行：`git log -S` / `git blame` 确认左右滑动监听由 `34fbaea` 引入，新增回归先要求旧实现删除 pointer 监听；新增“我的”生产契约先因缺少 profile 导航、视图和真实资料绑定而失败，实施后定向 67 项通过。
- 实现：新增 `MyProfileView`，从 session 真实资料和当前群组动态渲染姓名、身份、群组、状态和安全退出；工作入口导航到排班日历、请假、换班、通知设置。桌面侧栏、移动底部导航和顶部个人按钮均可进入；访客隐藏受限工作入口。通讯录移除 pointer capture、滑动判定模块、手势监听及横向手势样式，按钮/键盘切换与 240ms 指示器动效保持。
- 视觉与 Storybook：生产页面采用紧凑 Apple 系统式账户卡、渐变头像、浅蓝状态胶囊、分组工作入口和响应式双列/单列布局；新增 `Web UI 2.0/Production · 我的` 的桌面/手机 Storybook 故事，使用合成资料，不写入真实数据。
- 验证：Web vue-tsc、Vite production build、Storybook build、任务文件 Prettier/ESLint、通讯录/导航/我的定向 Vitest 10 文件/67 项与 `git diff --check` 通过。完整本地浏览器 smoke 因本机 API 无法连接 MySQL 3306 未完成（登录请求回退到 `/login?redirect=/`），未将该环境阻塞误判为 UI 回归；`smoke:check-core` 待提交前执行。
- 发布：代码 checkpoint `0b7b1b8` 已在本地提交；GitHub 推送因当前网络连接失败暂未完成。发布前加密数据库备份 archive `2cb57ced-6b4d-4170-90bd-7999f99a6b5d`（50 表、106527 行、47305316 bytes，SHA-256 `40c4dbcfd772f7c61d3260a95be42156ef18e247480e50b132e742b128498c13`）；服务器已从本地 checkpoint 构建并部署 release `0b7b1b8ff761987d0e454331a7f72ebded9846e8`。
- 线上验证：`ecs-verify.sh` 通过健康、产物哈希、41 条迁移、域名隔离、监听端口、容器和依赖检查；正式域名 `/api/health` 返回 200，服务器 `current-release` 与部署清单一致，数据库未写入业务数据。
- 当前状态：已完成代码实现、生产备份、ECS 发布与线上只读核验；GitHub 推送待网络恢复后重试，等待用户在桌面与 390px 手机上确认“我的”入口、资料卡、快捷入口以及通讯录不再响应左右滑动。
- 下一批次与停止条件：网络恢复后只需推送 `0b7b1b8` 及最终状态文档 checkpoint；不再修改通讯录数据或其他未授权工作树文件。

## 2026-08-19 P1 固定七行矩阵与 Android 纵向手势让出（当前批次）

- 批次范围：按用户人工结果保留 PC 端双轴流畅行为；把 7×7/20×30 矩阵从手机剩余空间动态高度改为固定 7 行，并修复 Android 横向原生 `scroll-view` 抢占纵向触摸。不改变 20×30 fixture、日期/班次同源横向滚动、人员/班次 SharedValue、单格更新或撤销语义。
- 回归定位与测试先行：`git log -S`/`git blame` 确认动态高度及嵌套方向手势由 `6799f1f` 引入。新契约在旧实现上 3 项失败：缺少固定行数常量、仍有窗口/安全区高度覆盖、横向原生代理没有纵向让出回调；实现后定向 11/11、小程序 10 文件/42 项通过。
- 实现：矩阵统一固定为 `82px` 表头 + `7 × 44px` 人员行 = `390px`，删除 `wx.getWindowInfo` 和矩阵顶部/安全区测量，仅保留横向视口宽度测量。内层 `horizontal-drag-gesture-handler native-view=scroll-view` 新增 `worklet:should-response-on-move`；横向占优返回 `true` 保留原生 compositor，纵向占优返回 `false` 让外层纵向 Worklet 接管。
- 语义与视觉审计：7×7 仍完整显示；20×30 固定显示 7 行，其余 13 行只在矩阵内部纵向浏览。页面滚动继续关闭，日期纵向冻结、人员横向冻结、PC 横向/纵向路径、横向进度、纵向 `decay`、点击/撤销、副作用次数和空值路径不变。视觉调整遵循 `frontend-design`，未改变已确认的颜色、字号、间距和控件外观。
- 验证：小程序 typecheck/build/source/Worklet/包体/确定性/模拟门禁通过（69 个构建文件、7 个源码/产物 Worklet、109192 bytes）；`miniprogram-ci` dry-run 通过；任务文件 Prettier、根 lint/build/typecheck、`smoke:check-core` 通过。完整小程序 42 项通过；排除用户自有 `runtime/**` 旧 ECS 副本和既有无关迁移计数测试后的现行主工作区 124 文件/729 项通过、31 文件/262 项按环境跳过。
- 发布：代码 checkpoint `a9cfe26`（`fix(miniprogram): fix android matrix vertical gesture`）已推送；微信体验版 `0.1.0-p1.20260819.18` 上传成功（48 个代码文件、33906 bytes，manifest `52f705c2582ca5e3bb5ee8dd923145594085d616aa3b4ddd83c7d84cd6959555`）。ECS 发布前加密备份 archive `68caa925-2d68-41e3-bd60-b73975ba6753`（50 表、106499 行、47294960 bytes，SHA-256 `cd7d001f43277b499a84e09910d9223b7bc4d88bafab75f22005e4aa07eec568`）；release `a9cfe2693a89a9779bd0d58d45c7eb66eaa4dcc0` 已部署，预热首次 502 后恢复。
- 线上验证：`ecs-verify.sh` 通过生产健康、产物哈希、41 条迁移、域名隔离、监听端口、容器和依赖检查；正式域名 `/api/health` 返回 200，服务器 `deploy-manifest.json` 精确指向 `a9cfe2693a89a9779bd0d58d45c7eb66eaa4dcc0`，未写业务数据。
- 当前状态：已实现并发布 → 待用户 Android 人工复核；本状态收口 checkpoint 推送、微信体验上传和 ECS 同步后停止。
- 下一批次与停止条件：只请用户复测 D：固定 7 行不超出常规手机页面、Android 纵向人员/班次同步移动、横向仍丝滑、斜向单轴；未明确通过前不进入 P2。

## 2026-08-19 通讯录科室/人员手势切换（当前批次）

- 批次范围：在已合并的“通讯录”页面落地移动端左右滑动切换“科室 / 人员”，标签使用移动的白色选中胶囊和同向内容入场动效；同时移除已确认的顶部说明文案、导览蓝色横条及冗余导览说明，保持现有筛选、搜索、收藏、拨号和键盘操作。
- 回归定位与测试先行：`git log -S` / `git blame` 确认双模式入口与原说明布局由 `046dc654e8e5ee72881e7dc65be255934705c52f` 引入；新增 `directory-mode-gesture.test.ts` 与生产契约断言，旧实现先以缺少手势模块/指示器且仍含说明文案而失败，实施后手势/生产/Storybook 定向 29 项通过。
- 实现：`getDirectorySwipeTarget` 以横向位移至少 48px 且横向幅度超过纵向 1.2 倍为触发条件；左滑 `internal → employee`、右滑反向，短划、垂直拖动、边界反向划动和输入/按钮拖动均忽略。面板声明 `touch-action: pan-y` 与横向 overscroll 隔离，点击、左右/Home/End 键盘和 `prefers-reduced-motion` 保持可用；模式变更以 240ms 系统曲线同步指示器和内容位移。
- 视觉与预览：按 `frontend-design` 的系统级移动端语言收紧页面密度，以中性灰底、白色分段胶囊、单一蓝色强调和轻量阴影替代装饰条；Storybook `CompactMobile` 390px 预览实测左滑进入人员、右滑返回科室、纵向拖动不切换，标签 aria-selected、指示器矩阵位移和人员/科室内容均正确。
- 验证：Web typecheck、Web production build、Storybook build、任务文件 ESLint/Prettier、`git diff --check` 通过；主工作区 Vitest 排除用户自有 `runtime/**` / `src/**` 后 123 文件/727 项通过、31 文件/262 项按环境跳过。全量还剩 3 项既有阻塞（ECS 验证脚本迁移断言仍期待 40、手动矩阵 fixture 两项与当前 P1 变更不一致），与本通讯录改动无关。`运行/浏览器验证：pnpm --config.verifyDepsBeforeRun=false smoke:browser` 通过登录、管理员、成员、访客与访问记录全流程；`smoke:check-core` 通过并确认本批次未触及核心链路。
- 发布：代码 checkpoint `34fbaea` 已推送；随后以并行提交后的当前 `HEAD=a9cfe26` 重新打包并部署，确保 Git、部署清单和服务器 `current-release` 一致。发布前加密数据库备份 archive `492a74d2-5d9c-4c59-bcdd-45a7a0ea0d0c`（50 表、106501 行、47295844 bytes，SHA-256 `e9fa6cd225d14f71defef0f2d10f0a2f1489e8674e813cd78b3533853ad8835e`）；release `a9cfe2693a89a9779bd0d58d45c7eb66eaa4dcc0` 已部署，预热首次 502 后恢复。
- 线上验证：`ecs-verify.sh` 通过健康、产物哈希、41 条迁移、域名隔离、监听端口、容器和依赖检查；正式域名 `/api/health` 返回 200，数据库未写入业务数据。首次 SSH 中断留下的半发布状态已使用发布前自动文件备份恢复后再重试，当前服务完整运行。
- 当前状态：已完成（含 Storybook/浏览器验证、代码发布、备份、ECS 验证与线上只读核验）→待用户在移动端实际滑动复核。
- 下一批次与停止条件：不再自动修改通讯录数据或其他未授权工作树文件，等待用户确认左滑/右滑、纵向滚动不误切换及减少动态效果。

## 2026-08-19 P1 最大矩阵跨运行时滚动隔离（当前批次）

- 批次范围：只修复 20×30 PoC 在 PC 模拟器班次主体空白/整页随人员滚动，以及 Android 班次存在但矩阵纵向手势无位移；不改变 7×7/20×30 fixture、横向原生滚动、Worklet 位移、单格更新或视觉令牌。
- 回归定位与测试先行：`git log -S`/`git blame` 确认 `type=list` 由 `6799f1f` 引入，后续将日期与班次主体变成两个复合直接子节点后触发跨运行时横向列表布局/可见性差异；页面自建立以来未声明 `disableScroll`。新增页面滚动隔离与单一直接内容项断言，旧实现 2 项失败，修复后定向 8/8、小程序 10 文件/41 项通过。
- 实现：矩阵页声明 `disableScroll: true`，页面不再竞争纵向输入；日期和班次主体组合为一个贯穿 `contentWidth` 的直接内容项，继续使用同一个 `scroll-view type=list scroll-x`，不改变已通过的原生横向 compositor 路径。人员与班次仍由同一个纵向 SharedValue 同步位移，手势期间无 `setData`。
- 验证：小程序 typecheck/build/source/Worklet/包体/确定性/模拟门禁通过（69 个构建文件、6 个源码/产物 Worklet，干净 checkpoint 包体 113757 bytes）；`miniprogram-ci` dry-run 通过；任务文件 Prettier、根 lint/build/typecheck、`smoke:check-core` 通过。根 `verify` 仅被用户已有 `project.config.json`、Storybook 生成物和 `runtime/` 旧 ECS 副本，以及现行但与本轮无关的迁移计数测试拦截；排除这些用户/既有阻塞后的现行主工作区 123 文件/723 项通过、31 文件/262 项按环境跳过。
- 行为变化清单：PC/Android 都必须渲染班次文字与格线；矩阵纵向输入不再移动整个页面。日期/班次横向同源、人员横向冻结、日期纵向冻结、纵向惯性、斜向轴锁、点击/撤销调用次数与空值/错误路径保持。
- 发布：代码 checkpoint `fc22b2c`（`fix(miniprogram): isolate matrix scrolling`）已推送；微信体验版 `0.1.0-p1.20260819.16` 上传成功（48 个代码文件、34704 bytes，manifest `58f6d2a2063d7530b3b8af77bab62cfda8e8e6c86e438b6d8b4030d97dcc1b4b`）。ECS 发布前加密备份 archive `8cc672cf-8445-4bae-bfcc-850d87488c42`（50 表、106490 行、47291044 bytes，SHA-256 `548ca7f317dc4f816e3f8796c5463206a1233bc8a99aeff916d30d2ceb2facb4`）；release `fc22b2cf6aa4812e03ddb3982245d4e3e8b2aea4` 已部署，预热首次 SSL 探测失败后恢复，`ecs-verify.sh` 通过健康、41 条迁移、产物哈希、域名隔离、端口和容器检查。
- 当前状态：已实现并发布 → 待用户人工原生复核。
- 下一批次与停止条件：只请用户按 D 清单复测 PC 班次渲染/矩阵拖动及 Android 纵向滑动；未明确通过前不进入 P2。本状态收口 checkpoint 推送、微信体验上传和 ECS 同步后停止。

## 2026-08-19 科室/人员通讯录合并（当前批次）

- 批次范围：按用户确认的 Storybook 方案，将独立“院内通讯录”和“员工通讯录”合并为单一“通讯录”入口；页面顶部以“科室 / 人员”双标签切换，各模式继续显示原有导览、筛选、搜索、收藏、常用和拨号内容。不修改通讯录 API、快照、号码、权限、偏好结构或数据库。
- 回归定位与测试先行：`git log -S` / `git blame` 确认独立员工入口与页面分支由 `9bc4922` 引入、院内入口由 `8309dce` 引入；合并契约测试在旧实现上 9 项失败，实现后任务定向 23 项通过。移除独立入口但不改变两套数据源方法、参数、调用次数、拒绝/取消/空值路径。
- 实现与交互：新增生产 `UnifiedDirectoryView`，复用原 `InternalDirectoryView` 和两套既有 API 数据源；`KeepAlive` 为科室/人员分别保存搜索、筛选和本地视图状态，切回时不重置。标签支持点击、左右键、Home/End 与正确焦点；44px 触控目标、`focus-visible`、减少动态效果和 320/390/1280px 自适应均已覆盖。Storybook 直接引用生产组件，仅注入脱敏演示数据。
- 语义等价审计：API 成员调用仍由闭包保持接收者绑定，每次原操作仍只调用一次；异步错误、请求取消、群组切换、偏好读写和空查询语义继续由原组件处理。模式切换只挂载/激活对应缓存实例，不创建重复 DOM/ID；无契约、迁移或业务数据变更。
- 验证：任务文件 Prettier/ESLint、Web typecheck/生产 build、Storybook build 通过；Web 全量 Vitest 71 文件/479 项通过。`运行/浏览器验证：pnpm --config.verifyDepsBeforeRun=false smoke:browser` 通过登录、管理员、成员、访客/vkey、访问记录全流程及单一“通讯录”入口、科室/人员切换、对应搜索和筛选；浏览器 error 为 0，移动端截图目录 `C:\Users\eylin\AppData\Local\Temp\schedule-smoke-ayuw5Q`。
- 工作树隔离：根 `format:check` 仅被用户已有的 `apps/miniprogram/project.config.json` 与 `storybook-static-my-profile/` 产物格式拦截；用户已有的 `pnpm-workspace.yaml`、个人资料 Storybook、`runtime/`、`src/` 及上述两项均未修改、暂存或纳入本批次，任务文件格式检查独立通过。
- 正式发布：代码 checkpoint `046dc65`（`feat(web): unify department and employee directories`）已推送；发布前加密数据库备份 archive `b274d0d9-0a22-419e-b55f-27c6526adc8b`（50 表、106,469 行、47,280,000 字节，SHA-256 `1c98034e9a39fa97a28a6c05029da35fa0fff3b4f9ad25e61313cba6c0897a27`）。release `046dc654e8e5ee72881e7dc65be255934705c52f` 从隔离干净 worktree 构建并部署；容器预热首次健康检查一次 502 后自动恢复，`ecs-verify.sh` 通过健康、41 条迁移、产物哈希、域名隔离、公开端口和容器检查。
- 正式域名只读核验：首页和 `/api/health` 均返回 200；390px 无横向溢出、浏览器 error 为 0，正式登录页仅显示密码认证且不含本地管理员/微信入口。服务器实际 Home bundle 同时命中“通讯录范围”“科室通讯录”“人员通讯录”，`current-release` 与代码 checkpoint 一致；未登录、未写业务数据。
- 当前状态：已完成（含代码发布、数据库备份、ECS 验证与正式域名只读核验）→待用户复核；最终状态 checkpoint 识别消息为 `docs(status): record unified directory deployment`。
- 下一批次与停止条件：无自动活动批次；最终状态 checkpoint 推送并部署后停止，等待用户复核，不开始其他实现任务。

## 2026-08-19 员工通讯录搜索与电话行精简（当前批次）

- 批次范围：移除员工通讯录的 T9 搜索提示、别名生成和 API 数字 T9 匹配；新增 `employee_code` 精确/前缀搜索；同时完成员工卡片电话行去掉“移动电话”标签并保持长号/短号单行。不改变人员集合、号码、层级筛选、权限或收藏偏好。
- 回归定位：`git log -S`/`git blame` 确认 T9 API 分支与别名由 `9bc4922` 引入，员工搜索提示同样来自 `9bc4922`；电话行标签/两列布局由 `926136a` 延续至 `b09da6e`。
- 实现：导入器不再生成 T9 别名；API 先匹配 `employee_code` 精确/前缀，再执行原文、拼音和全文检索；迁移 `0041_remove_t9_directory_search.sql` 清理历史 T9 别名并收窄枚举。员工移动电话行隐藏通用标签，号码值 `nowrap`，院内固定电话标签保持。部署前发现 `ecs-verify.sh` 的迁移计数仍为 40，已同步更新为本批次迁移后的 41，避免发布后误报失败。
- 验证：员工视图/导入器定向 24 项通过；真实 MySQL API、导入和迁移测试 21 项通过；contracts/database/API/Web typecheck、任务文件 ESLint/Prettier、`git diff --check` 通过；`SMOKE_BASE_URL=http://127.0.0.1:5173 node scripts/smoke-browser.mjs` 通过全链路、员工工号搜索与电话行布局断言；`node scripts/smoke-browser.mjs --check-core` 通过（未触及核心链路）。
- 正式发布：代码 checkpoint `427ff6b` 与部署验证修正 checkpoint `5704242` 已推送；发布前数据库备份 archive `6d798463-f2c1-4b22-a3c2-2e1c297ebead`（50 表、144597 行、62174612 字节，SHA-256 `157c51c67f0d5724687ef6b27beac82e33d2432a2dc187ec862723cfbd86796e`）；release `5704242e1b5aefb704f940c31668ee0f6f7343d0` 已部署，预热期间两次 502 后自动恢复，`ecs-verify.sh` 完整通过并确认 41 条迁移。
- 正式域名只读核验：`/api/health` 返回 200；生产 published 快照为 internal 341/359、employee 1070/1073，employee 工号 1064 条；T9 别名 0，别名枚举不含 `t9`；正式 Web bundle 含 `employeeCode` 接线且不含 T9 字符串。未写入业务数据。
- 最终状态发布：状态文档 checkpoint `a840572` 已推送并部署；文档发布前数据库备份 archive `7f0bb519-b706-4b6d-a733-5d4a0b4f10ba`（50 表、106421 行、47263568 字节，SHA-256 `d7d802c24146957b10b4c08413095c8c07277fd6504bcce0e7429e3dc1d9c642`）；release `a8405721ddb35693c6fa480d536d02f1d079af28` 已部署，健康检查、产物哈希、域名隔离、容器和 41 条迁移验证通过。随后状态文档收口 checkpoint 也已提交、推送并部署，服务器 `current-release` 与 Git `HEAD` 一致。
- 当前状态：已完成（含代码发布、迁移、备份、状态文档发布和线上只读核验）→待用户复核。
- 下一批次与停止条件：无自动活动批次；等待用户复核，不开始其他实现任务。

## 2026-08-19 员工通讯录工号前缀优先配对（当前批次）

- 批次范围：继续以现有员工通讯录清洗结果为唯一数据集合；姓名/工号/所属部门清单仍只用于提取和配对工号，不从清单新增人员。候选冲突时优先唯一的 `d`/`g` 开头工号；没有唯一 `d`/`g` 候选则不猜测、不写工号。
- 数据结果：原员工目录保持 1070 条；1015 条按姓名+路径部门匹配，49 条按唯一姓名补配，共 1064 条写入工号；冲突数降为 0，6 条无候选继续保留空缺，人工核对清单更新至本机 ignored 的 `runtime/directory-data/employee/2026-08-19/employee-identity-match-report.json`。本地 manifest `employee-20260819-b443f8cc-ee8eefa6`，SHA-256 `1b840957e3b4eb6a90a393297890335f961b5d9b854f2f34f10c1e8ff37354f6`，条目数保持 1070。
- 验证：匹配器/清洗器定向 2 文件/8 项通过；排除用户自有 `runtime/**`、`src/**` 与小程序依赖缺失测试的主工作区 Vitest 111 文件/674 项通过（31 文件/262 项按环境跳过）；infra TypeScript、Prettier、任务文件 ESLint、`git diff --check` 通过。未恢复本机既有依赖符号，也未改动用户所有的 `apps/miniprogram/project.config.json`、`pnpm-workspace.yaml`、`runtime/`、`src/`。
- 正式发布：代码 checkpoint `e5a6077` 已推送并部署。代码发布前备份 archive `95d2c1ba-a0bf-4395-a517-cc7d80c801e0`（50 表、112,468 行、48,259,892 字节，SHA-256 `86f0a2edca225e1a6acdc1ab2b70e309baf02d5c3d27dbc95a5a390be7882e05`）；release `e5a60777c9857cb87af91d9cb34e5cc239f7990c` 已部署，预热期间一次 502 后自动恢复，`ecs-verify.sh` 通过。
- 正式数据发布：数据发布前第二次备份 archive `0f1bb789-4c25-4604-9110-fa3b87afdbc4`（50 表、112,477 行、48,263,136 字节，SHA-256 `e97575e3175acc7370848f5c7dd2edebcba961d80d5ec6e92fb89c31a3d9e287`）；员工 manifest 通过 SSH stdin dry-run 为 added 0、changed 4、unchanged 1066、removed 0、warnings 0，原子发布批次 `b631ec70-cbec-4c8b-9abe-462b7ac20995`，替换 `1b6152d0-a3cf-487b-9d6e-6386e6a82422`，发布流 manifest SHA-256 `c8b9503f3f4d25e465181d7f33ac6a092fa6f8961da8ace911805f92573960eb`。生产 employee 1070 条目、1073 个联系方式、29724 个别名、1064 个工号字段、6 条空缺；internal 快照未变，原目录未新增清单人员。
- 当前状态：已完成（含代码发布、数据原子发布、备份、`ecs-verify.sh` 与线上只读聚合核验）→待人工核对 6 条无候选内容；不自动填写人工结论。
- 下一批次与停止条件：只提交、推送并部署本状态文档 checkpoint，使 Git `HEAD`、`origin/main` 和服务器 `current-release` 一致；随后等待人工核对，不开始其他实现任务。

## 2026-08-19 员工通讯录显示数据去噪（已完成，待用户复核）

- 批次范围：清理员工通讯录层级字段边界遗留的句点、逗号、冒号、尖括号等无意义符号；保留括号等名称内部的有效符号。移除员工快照中的清洗说明备注，并在 Web 搜索结果路径中隐藏“汕大肿瘤医院”根节点；不改变号码、权限或院内通讯录展示。
- 数据结果：1070 条员工记录保持不变；42 条路径因句点清理发生替换，清洗规则仍为 11 位长号/6 位短号。新版 manifest 不再包含 `notes`，`importVersion` 纳入清洗结果摘要，避免同源文件清洗规则变化时被旧版本号拒绝。
- 本地发布：dry-run added 42、changed 1028、removed 42、warnings 0；已发布本地批次 `231ada79-3cde-4370-a07d-26ee6d1e2683`，manifest SHA-256 `425c7738039ff72138de48e3498a629ffe8b3c4475cfc2bc473355ca834b34d8`。
- 验证：清洗器/展示分组定向 Vitest 16/16、任务文件 ESLint/Prettier、`git diff --check` 通过；`node scripts/smoke-browser.mjs` 通过管理员、成员、访客、员工中文搜索，并断言结果不含清洗说明和医院根节点。
- 正式发布：checkpoint `497cb91` 已推送并部署，发布前加密数据库备份 archive `c669a49f-28b7-4432-86ba-f5df166dc24a`；预热期间一次 502 后自动恢复，`ecs-verify.sh` 完整通过，Git 与服务器 release 一致。
- 正式数据发布：manifest SHA-256 `425c7738039ff72138de48e3498a629ffe8b3c4475cfc2bc473355ca834b34d8`；SSH stdin dry-run added 42、changed 1028、removed 42、warnings 0，原子发布批次 `df42ee6c-fbd3-4ba8-96f3-e22ff3486261`。生产 employee published 1070 条目、1073 个联系方式、28660 个别名、0 条清洗备注；internal 快照保持 341/359/4488。
- 当前状态：已完成（含代码、数据发布与线上只读核验）→待用户复核。
- 下一批次与停止条件：无自动活动批次；等待用户在正式网页复核员工搜索结果和层级路径，不开始其他实现任务。

## 2026-08-19 员工通讯录数据清洗与双快照模块（已完成，待用户复核）

- 批次范围：从 iOffice M2 已授权导出中排除外部人员、离岗、退休、测试分类，新增员工通讯录独立快照、清洗器、层级筛选、T9/拼音/首字母/中文/号码搜索与现有通讯录同款 UI；不提交原始号码或本地数据库。
- 数据清洗：输入 1317 条，输出 1070 条；剔除无有效号码 241 条、无效号码字段 23 个、记录内完全重复号码 3 个、完全重复记录 6 条。仅保留严格 11 位手机长号或 6 位手机短号；有效号码字段 1077 个长号、512 个短号。清洗结果和 manifest 只存于本机被 `.git/info/exclude` 排除的 `runtime/directory-data/employee/2026-08-19/`。
- 实现：迁移 `0039_employee_directory_and_t9.sql` 增加 `directory_kind` 与 T9 别名；员工快照与院内快照独立发布、回滚和权限查询。员工入口为“员工通讯录”，移动端保留四个主入口，员工模块放入“更多”以维持既有底栏密度；筛选标签按组织根/一级至五级组织/类型映射，员工联系方式只渲染有效长短号。
- 本地发布核验：employee 批次 `published` 1 个，1070 条目、1073 个联系方式、28671 个搜索别名；internal 快照保持 341 条目、359 个联系方式。未输出姓名或号码明细。
- 运行/浏览器验证：定向 Vitest（清洗器、导入、契约、数据库迁移、Web API、员工视图与导航）通过；contracts/database/API/Web typecheck、生产构建、Storybook build、ESLint、Prettier、`git diff --check` 通过；`VITE_AUTH_DEV_MODE=true pnpm smoke:browser` 通过管理员、成员、访客/vkey、访问记录、员工中文搜索、级别筛选和 390px 无横向溢出；初次未设置认证开关的 smoke 失败为环境前置条件，不计为功能回归。
- 安全与权限：员工查询复用现有群组成员/owner/administrator/developer 可见性边界；manifest 通过 stdin 导入，原始数据不进 Git、不写入日志、不上传第三方。
- 正式发布：代码 checkpoint `9bc4922`（员工模块）先行部署，发布前加密数据库备份 archive `4d7355a5-7ef4-4623-aff7-e56c62faef76`；随后修正验证脚本迁移计数并提交 `dfc8471`，再次备份 archive `3d64d038-b03d-465b-be9b-07bf04b25fa5` 后部署 release `dfc8471cc3b3658364f87e7948d9506b64d294b5`。预热期间出现一次 502/SSL 短暂失败后自动恢复，`ecs-verify.sh` 完整通过，迁移数 39、Git `HEAD`、`origin/main` 与服务器 `current-release` 一致。
- 正式数据发布：employee manifest SHA-256 `a1a7c7b6358baeab2c3afc8b8ab67a780e8163094ed63ca59086d29bdba14b26`；SSH stdin dry-run 为 added 1070、warnings 0，随后原子发布批次 `7718cad0-afdc-4770-abf5-e250325d562f`。生产只读聚合核验：internal published 341/359/4488，employee published 1070/1073/28671；未输出姓名或号码明细，未复制本地数据库或凭据。
- 当前状态：已完成（含生产发布、数据发布与线上只读核验）→待用户复核。
- 下一批次与停止条件：无自动活动批次；等待用户在正式网页复核“员工通讯录”的入口、筛选和搜索体验，不开始其他实现任务。

## 2026-08-18 D/NP 固定班种分段提醒（已完成，待用户复核）

- 批次范围：只在 Web 选中日期详情为固定 D/NP 班追加分段说明和当前阶段标签；不修改数据库、班种配置、排班记录、统计、生成、API、权限或其他工作流。
- 回归定位与测试先行：`git log -S` / `git blame` 确认连续时间详情由 `1c84fd6` 引入且没有分段语义；新增 helper 用例在旧实现因模块不存在失败，实现后 D/NP 的工作、午休、听班、次日恢复与不匹配保护 3/3 通过。
- 实现：仅当简称、实际中国标准时间起止和持续分钟同时精确匹配 D（08:00–17:30）或 NP（17:30–次日11:00）时显示固定说明；进行中的班次每分钟更新“在岗中 / 午间间休 / 值班房听班中”。人员姓名、岗位、电话、事件按钮和原排班状态始终保留。
- 验证：主工作区 Vitest 排除用户自有 `runtime/**` / `src/**` 后 119 文件/698 项通过（31 文件/261 项按环境跳过）；Web typecheck/build、Storybook build、任务文件 Prettier/ESLint 通过。Storybook 390×844 无横向溢出，说明完整换行，5 个电话/事件操作均为 44px，当前 NP 正确显示“值班房听班中”。`运行/浏览器验证：pnpm --config.verifyDepsBeforeRun=false smoke:browser` 通过管理员、成员、访客/vkey 与访问记录全流程，截图目录 `C:\Users\eylin\AppData\Local\Temp\schedule-smoke-2eLV2J`。
- 行为审计：新增一分钟只读时钟仅替换本地 `Date` ref，卸载时清理；不发请求、不写业务数据。未知简称、无效时间或被编辑为其他持续时间的班种返回无说明；既有计算、异步、错误和空值路径不变。
- 正式发布：代码 checkpoint `81e44f7`（`feat(web): show split shift duty status`）已推送；发布前加密数据库备份 archive 为 `8865ad86-a90c-4cc0-898c-a7b007be9b2a`（50 表、18,505 行、7,376,160 字节，SHA-256 `d6e48163573fd7f01dcf65b0c0382c235ded67bbab386c66440c93d113306929`）。从独立干净 worktree 构建并部署 release `81e44f74d0c052a4f667d534390768e7097d0168`；容器预热首个健康检查短暂 502 后自动恢复，`ecs-verify.sh` 通过。
- 正式域名只读复核：D0796 群主会话正常加载现有 2026 年 8 月空排班月历，未写业务数据；正式 Web bundle 中“值班房听班中”实现唯一命中，公开 API 返回 200。Git 本地、`origin/main` 与服务器 `current-release` 精确一致。
- 当前状态：已完成（含生产发布与线上只读核验）→ 待用户复核；最终状态 checkpoint 识别消息为 `docs(status): record split shift status deployment`。
- 下一批次与停止条件：只提交、推送并部署本最终状态 checkpoint，使 Git `HEAD`、`origin/main` 和服务器 `current-release` 一致；随后停止，等待用户复核，不开始其他任务。

## 2026-08-18 通讯录空闲态、收藏卡片与触控反馈（已完成，待用户复核）

- 批次范围：DIR-13，仅调整通讯录页面的信息顺序、空闲/检索状态、收藏与常用卡片一致性，以及拨号触控反馈；不修改 CSV、正式通讯录快照、号码、筛选层级、API、权限或本地偏好数据结构。
- 回归定位：`git log -S` / `git blame` 确认顶部“院内协作”胶囊、搜索在导览前及拨号 `:hover/:active` 蓝底来自 `8309dce`，收藏/常用紧凑快捷卡与结果前置来自 `5437995`，号码卡高密度布局后续由 `926136a` 调整。
- 测试先行：新增“空白搜索且无筛选不是有效查询”、初始不得请求全量、结果应先于收藏/常用、优先区必须复用完整卡片、导览/搜索顺序及触控高亮断言；旧实现 4 项失败，修复后通讯录/Storybook 定向 9 文件、41 项通过。
- 实现与语义：进入页面只并行读取 facet 与偏好 UUID lookup，不再发起空查询；搜索非空或至少一个筛选生效时才请求/显示结果，清空后立即取消在途结果并回到只显示收藏/常用的空闲态。搜索/筛选态保持结果在前、收藏/常用在后；收藏和常用使用与普通结果完全相同的标题、路径、同号、长短号、分隔线、备注、收藏和拨号结构。偏好持久化、使用次数、拨号 href、合并与权限调用不变。
- UI 与触控：移除顶部胶囊但保留隐藏页标题，院区导览成为首个可见区块，搜索框紧随其后。拨号链接关闭 WebKit tap highlight，触摸按下/释放后保持透明；仅支持 hover 的精细指针显示浅蓝悬停，键盘继续提供 2px `focus-visible` 描边。
- 运行/浏览器验证：`运行/浏览器验证：pnpm smoke:browser` 第二轮通过管理员、成员、访客/vkey、访问记录和通讯录专项；首轮准确暴露旧等待条件被收藏卡提前满足，验证器改为等待搜索结果区与“找到”状态后原样重跑。1280px 初始为 0 条结果；搜索“病案”返回 5 条，收藏卡长短号文本与结果一致且位于结果下方；清空后仅保留 1 条收藏。390×844 无横向溢出，导览无横滚，拨号目标 44px、背景透明；截图目视确认导览→搜索→收藏顺序。
- 其他验证：Web typecheck/build、Storybook build、任务文件 Prettier/ESLint、定向 Vitest 与 `git diff --check` 通过。完整 `pnpm verify` 只在第一步被本轮开始前已有、用户所有的 `apps/miniprogram/project.config.json` 格式问题拦截；并行小程序与 `runtime/`、`src/` 均未修改、暂存或纳入本批次。
- 正式发布：代码 checkpoint `b09da6e`（`feat(directory): refine idle and saved contact layout`）已推送。通过服务器上一 release `3d617b4` 精确确认正式 ECS 后，创建加密数据库备份 `6245db84-5500-4ee7-8acf-340587de7b03`（50 表、18,491 行、7,366,940 字节，SHA-256 `e4a7a0bf5f22fdadba11e98957cd2eaec6e7ff834f909140b908f9a8188e70ca`）；从独立干净 worktree 构建并部署 release `b09da6e24d2f5bbe5818b61cc5e8ad2a0d794608`。容器预热首个健康检查短暂 502 后自动恢复，`ecs-verify.sh` 完整通过。
- 正式域名只读复核：D0796 群主会话初始为 0 个结果区/0 个全量卡片，顶部胶囊为 0，导览 y=88、搜索 y=258；搜索“病案”返回 5 条，首卡显示 `长号 8859 9514 / 短号 8514`。390×844 无页面或导览横向溢出，拨号目标 44px、背景透明、首卡 117px；清空后结果区和卡片均回到 0，浏览器 error/warning 为 0，未改收藏、筛选或业务数据。
- 当前状态：DIR-13 已完成（含生产发布与正式域名只读复核）→ 待用户复核。最终状态 checkpoint 识别消息：`docs(status): record directory idle deployment`。
- 下一批次与停止条件：只提交、推送并部署本最终状态 checkpoint，使 Git `HEAD`、`origin/main` 和服务器 `current-release` 一致；随后停止，不开始小程序或其他 Web 修改。

## 2026-08-18 通讯录动态导览、收藏与高密度筛选 Sheet（已完成，待用户复核）

- 批次范围：DIR-09 至 DIR-12，仅处理无效层级剔除、无横滚导览与筛选定位、收藏/常用优先展示及筛选 Sheet 高密度交互；不修改原始 CSV、正式通讯录快照、号码、来源追踪或既有角色权限。
- 回归定位：`git log -S` / `git blame` 确认七级导览、横向滚动和无定位打开来自 `8309dce`，通用 Sheet 的 78dvh 上限来自 `5b00fa7`，通讯录说明块与并排清除按钮来自 `926136a`。
- 测试先行：空/单选层级、冗余下级、批量恢复、收藏/常用、安全持久化、无横滚定位和优先区均先红；追加的高 Sheet、全宽固定清除与折叠级别断言在旧实现上 1 项失败。实现后全仓非集成 112 文件/669 项通过（31 文件/261 项按环境跳过），隔离 MySQL 通讯录路由 5/5 通过。
- 实现：导览/筛选 Sheet 动态省略无数据或当前只有 1 个兼容选项的层级；上级变化时清除不兼容或已冗余的下级。导览改为桌面自适应、手机两列的完整页面网格，点击站点后打开 Sheet、平滑定位并聚焦相应区段，减少动态偏好下即时定位。
- 收藏与常用：卡片右上角 44px 五角星支持收藏/取消；拨号记录形成常用排序，收藏与常用快捷卡位于导览正下方。浏览器本地仅保存条目 UUID、次数和时间，不保存名称/号码；只读 lookup 继续执行 `viewDirectory` 与 member/administrator 可见性边界，成员无法借偏好恢复管理员条目。
- 筛选 Sheet：通讯录专用 Sheet 提高到移动端 92dvh/桌面最高 840px，移除“层级联动”等说明块；清除全部改为顶部 sticky、内容区全宽的扁平按钮。各有效级别使用 48px 整行 disclosure 控件，方向符号、`aria-expanded/controls` 与减少动态齐全；折叠选择在会话内保留，从导览进入时目标级别自动展开并定位。
- 运行/浏览器验证：`运行/浏览器验证：pnpm --config.verifyDepsBeforeRun=false smoke:browser` 在当前源码 5173 服务通过管理员、成员、访客/vkey、访问记录及通讯录专项。Storybook 独立 390×844 画布实测 Sheet 高 776.47px、清除按钮与工具栏同宽、折叠后选项不可见、无横向溢出且 console error 为 0；Web typecheck/build、Storybook build、任务文件 Prettier/ESLint、`pnpm smoke:check-core` 与 `git diff --check` 通过。
- checkpoint：`5437995`（`feat(directory): add adaptive guide and favorites`）与 `ee1296e`（`feat(directory): make filter sheet collapsible`）均已推送。发布前加密数据库备份 archive 为 `2ab960ac-9286-4aba-9a2b-db5393697d00`（50 张表、18,486 行、7,364,076 字节，SHA-256 `dabd9e4219cd66cba9ad3e75149d1c5d71c386b266c8541fc19982d9bf11b5e5`）。release `ee1296ebff0dd4d6bdd49d511be97180f7ef8a05` 从干净 worktree 构建并部署；容器预热首次 HTTPS 健康检查短暂失败后自动重试恢复，`ecs-verify.sh` 通过健康、38 个迁移、产物哈希、域名隔离和容器检查。
- 正式域名只读复核：D0796 群主会话在 390×844 下打开通讯录筛选，Sheet 为 375×776.47px（92dvh），清除按钮/顶部工具栏同宽 328px且 sticky；无“层级联动”等旧说明。6 个有效级别均有 `aria-expanded/controls`，折叠院区后选项 `display:none`、高度为 0，再次展开正常；点击导览“片区”后 Sheet 自动打开并滚动 210px，目标标题位于可视区顶部且保持展开。页面无横向溢出，浏览器 error/warning 为 0，未修改收藏、筛选或业务数据。
- 当前状态：DIR-09 至 DIR-12 已完成（含生产发布与线上只读复核）→ 待用户复核。最终状态 checkpoint 识别消息为 `docs(status): record directory filter deployment`。
- 下一批次与停止条件：只提交、推送并部署本状态 checkpoint，使 Git `HEAD`、`origin/main` 和服务器 `current-release` 一致；随后停止，不开始其他修改。

## 2026-08-18 月份切换选中日期与值班详情一致性修复（已完成，待用户复核）

- 批次范围：只修复月视图切换月份后蓝框日期、详情标题与班次/时间错配；不修改周视图、排班数据、API、权限或其他页面。
- 回归来源：`git log -S` / `git blame` 确认 `628c79f` 为保持翻页选择稳定而取消了切月时的日期同步，只保留旧完整日期。
- 测试先行：完整日期重定向与生产接线断言在旧实现上 2 项失败；实现后日历定向 52/52、Web typecheck/build、任务文件 Prettier/ESLint、`git diff --check` 与完整浏览器 smoke 通过。主工作区全仓测试为 110 文件/663 项通过、31 文件/261 项按环境跳过，另有并行中的小程序基础组件 5 项因文件尚未落地失败，与本轮 Web 文件无关。
- 实现与语义：切月先把选中日期按原日号重定向到目标月份，再更新 `businessMonth`；短月份夹到月底。蓝框、详情标题和 `buildSelectedDateDutyRows` 继续共享同一个 `YYYY-MM-DD` 键，年月选择器也统一经过该入口。API 请求、缓存、错误路径、筛选与事件调用次数不变。
- 390×844 实测：`2026-08-14` 蓝框、标题和全天班详情一致；切到 9 月后同时变为 `2026-09-14` 且正确显示 0 班；返回 8 月后原班次完整恢复。完整 smoke 覆盖管理员、成员、访客/vkey 与访问记录且无浏览器错误。
- 正式发布：代码 checkpoint `daf7ede` 已推送；发布前加密数据库备份 archive 为 `22fa6662-a451-43de-ba7d-ca0b16177e04`（50 张表、18,482 行、7,361,444 字节，SHA-256 `33eb553c4321aa7364f4d0d3cc2ff3a1c7a4ab358f30697b436a766de9615ce9`）。release `daf7ede9cd7a47e92f4c1bb8a989fb54d9aab0b0` 已部署，迁移、容器重建、健康检查、产物哈希、域名隔离与 `ecs-verify.sh` 全部通过。
- 正式域名只读复核：D0796 群主会话在 390×844 选中 `2026-08-14` 后切到 9 月，蓝框、标题与空详情同时变为 `2026-09-14`；返回 8 月后蓝框、标题与 0 班详情同时恢复为 8 月 14 日。现网该群组对应日期无排班，含全天班和 08:00–08:00 的有数据分支已由本地真实页面验证覆盖；未触发业务写入。
- checkpoint：代码 `daf7ede`（`fix(web): bind calendar selection to month details`）；最终状态识别消息为 `docs(status): record calendar detail binding deployment`。
- 下一批次与停止条件：部署最终状态 checkpoint，使 Git `HEAD`、`origin/main` 和服务器 `current-release` 一致后停止；并行中的小程序、通讯录与 Storybook 文件继续保留为用户所有，不纳入本 checkpoint。

## 2026-08-18 统计年度选择器修复（已完成，待用户复核）

- 批次范围：仅把统计页“按年”的原生年份下拉替换为已确认的统一时间选择器；不修改统计口径、API、权限、数据结构或其他页面。
- 回归定位：`git log -S`/`git blame` 确认原生年度 `<select>` 由 `36127b0` 引入；统一选择器在 `92038cd` 落地时只覆盖月/日/时间，遗漏了统计年度入口。
- 测试先行：新增“统计年度使用单列年份滚轮且不再存在原生 select”断言，旧实现 1 项失败、5 项通过；连同空值防护实现后定向 7/7、排除用户自有 `runtime/` 与 `src/` 的全仓 Vitest 109 个文件/651 项通过（31 个数据库集成文件/260 项按默认环境跳过）。
- 实现与语义：`TemporalPicker` 新增 `year` 类型，复用既有触控滚轮、滚动结算、焦点和取消/确认逻辑；统计页以 computed 在字符串界面值和数字 API 年份间桥接。取消不触发加载，确认后仍只执行原有一次年度统计 GET。
- 浏览器复核同时发现 `6ec287d` 的统计表 ResizeObserver 仅排除 `undefined`、未排除重渲染时的 `null`；新增断言在旧实现失败后改为 Element 类型保护。390×844 下年度触发区 44px、单列滚轮 168px、无原生 select/横向溢出，取消后保持原年份，最终 error/warning 为 0。
- 已通过：`运行/浏览器验证：pnpm smoke:browser`（管理员、成员、访客/vkey、访问记录全流程）、`pnpm smoke:check-core`、任务文件 Prettier/ESLint、Web typecheck/build、Storybook build 与 `git diff --check`。
- checkpoint 识别消息：`fix(web): use temporal picker for annual statistics`。
- 正式发布：代码 checkpoint `ea5ad1c` 已推送；发布前加密数据库备份 archive 为 `5b8c8c5a-087c-4f4a-b796-206cd7e72f6b`（50 张表、18,479 行，7,359,464 字节，SHA-256 `34d51127d70134b82a5db00ae53d3c4078738a9961df3fdfec5c818cdb07ac8a`）。release `ea5ad1c6b80f30d2bddde64cff6be0db95973f34` 已部署，容器预热首次健康检查一次 502 后自动恢复，`ecs-verify.sh` 完整通过。
- 正式域名只读复核：D0796 群主会话的 390×844 统计页“按年”显示 `统计年份：2026年`；弹窗 341×416px、单列滚轮 168×188px、触发区 325×44px，无原生 select/横向溢出。取消后弹窗为 0、`aria-expanded=false`，error/warning 为 0，未触发刷新快照、重算或任何业务写入。
- 下一批次与停止条件：提交并部署最终状态 checkpoint，使 Git `HEAD`、`origin/main` 与服务器 `current-release` 一致后停止并等待用户复核。

## 当前状态（2026-08-18）

- 分支：`main`，上游：`origin/main`。
- 正式入口：`https://hosp.schedule.eylinhome.top`。仓库当前生效配置不使用服务器公网 IP URL。
- 工作台紧凑抬头、完整圆角月历与登录页专属 ICP 精修已完成并上线：代码 checkpoint `daff238` 已推送，生产 release 为 `daff238e241c0b6d9c04f0c8b21b5cca3b356ca4`。发布前加密数据库备份 archive 为 `43f639de-86a9-4090-9209-e46b443310b7`（44 张表、5245 行）。最终状态 checkpoint 识别消息为 `docs(status): record compact workbench production deployment`。
- 微信网站管理员认证文件已加入 Web 公共根目录并上线；checkpoint `859f28d` 已推送，生产 release 为 `859f28d376e13f90dc4dced83c974aed12d84f5f`。发布前加密数据库备份 archive 为 `0c70b166-8d94-4a51-920c-5922ca046753`（44 张表、4856 行）。
- ICP 合规页脚最初由 checkpoint `fb192d3` 接入登录、访客和已认证应用壳；本轮已按用户确认调整为仅登录页显示，并保留备案文案、链接、安全属性和 44px 点触目标。
- Checkpoint 1（网站微信扫码认证）和 Checkpoint 2（域名专属入口、测试通道收口）已完成并已推送：`12e7f40`、`dec9943`。
- 用户确认无法取得微信开放平台网站应用，改用正式账号密码注册/登录。本轮已实现后端密码认证、前端注册/登录、scrypt 哈希、生产配置和迁移 0036；网站扫码代码暂保留为未来可选能力，但生产配置不依赖它，正式页面不显示扫码入口。
- 小程序凭据仍只用于小程序登录和通知。用户在聊天中发送过的小程序 AppSecret 按“已暴露”处理：本轮没有把它写入仓库、新 release 或服务器；通知功能正式验收前必须重置。小程序代码上传 `.key` 文件不是网页登录凭据，不需要上传或提交。
- 手机 Sheet 下拉框修复与自动部署规则已上线；当前正式 release 对应 `docs(status): confirm automatic deployment policy rollout` checkpoint，精确哈希与 Git `HEAD`、`origin/main` 和服务器 `current-release` 一致。发布前加密数据库备份 archive 为 `48b7e00f-19b3-4577-aefa-dad10a0ad0bd`；生产仍为 36 个迁移，现网首页/API、产物哈希和域名隔离核验通过。
- 本轮变更已上线：密码不再有最小/最大位数限制，仅拒绝空密码；登录页已移除“首次使用请先注册账号”和微信 AppID/AppSecret 提示。
- 旧 `local-admin` / `local-member` 账号已保留关联业务数据并退役为 suspended，不再是可用认证身份；用户正式账号 `D0796` 已映射为稳定的密码认证 UID，并写入生产 `PLATFORM_ADMIN_UIDS` / `HOLIDAY_ADMIN_UIDS`。
- 原有的 1 个正式群组已在生产数据库中转移到 `D0796` 名下；`D0796` 的群组成员角色为 `owner`，显示姓名为“林恩宇”。原群组及排班数据保留，旧退役账号的成员记录保留为历史管理员记录。
- 群组页面展示修复已完成并上线：群组管理页会明确显示当前群组、角色和四位群组码，重新生成群组码后会刷新并显示新码；工作台只保留紧凑群组名称/身份下拉。
- 小程序 AppSecret 仍按“已暴露”处理，尚未通过聊天内容写入服务器；需要用户在微信平台重置后再更新服务器通知配置。现有服务器会话密钥已存在，网站 AppID/AppSecret 不再是阻塞项。
- 用户已明确放弃 Figma 预览，改用 Storybook + 本地浏览器验收；用户已确认整体视觉、月格密度、底栏与详情结构，生产 UI 已进入分批实现。
- Web UI 2.0 Task UI2-03/04/05/06/07/08/09/10/11-12 已分别以 `11bb812`、`5b00fa7`、`7c80488`、`1c84fd6`、`2d6f0a2`、`2bb9fce`、`23c1d9f`、`1203dc7`、`6ec287d` 推送；UI2-13/14 已完成实现与验证，checkpoint 识别消息为 `feat(web): polish group config and guest states`。业务逻辑、权限、API 和数据结构未修改。
- Web UI 2.0 最终全局审计与生产部署均已完成：动态视口、键盘焦点、Sheet 焦点锁定/回焦、减少动态、安全区/底栏避让及 1280×900、390×844、320×844 一致性均通过；checkpoint 为 `5ae4941`。`D0796` 的群主、平台管理员、节假日管理员及正式管理页面已人工复核，当前只待用户在正式网页做最终视觉验收。
- 用户反馈的手机 Sheet 下拉框不可见回归已完成修复、运行验证和生产部署：首页月历筛选、换班和加扣班的 TDesign 选项层现在挂载到原生模态 Sheet 内，不再落在 top layer 之外；checkpoint 为 `af37f5e`。
- 用户要求今后每个完成并推送的仓库修改检查点都直接部署到正式服务器并做线上核验；规则已写入根 `AGENTS.md`。部署只同步代码和提交内迁移，生产业务数据始终以服务器数据库为准，禁止用本地数据库、演示数据、凭据或会话覆盖生产。

## 2026-08-18 微信小程序迁移 P0/P1（当前批次，用户人工原生验收）

- 批次范围：在基础控件、动态 5/6 周月历与 7×7/20×30 Skyline 手排矩阵 PoC 完成后，只完成 P1 用户人工原生验收交付；不接入业务 API，不实现 P2，不由 LLM 启动本地微信开发者工具，也不执行微信正式发布动作。用户于 2026-08-18 明确取消 MiniTest/Minium 云测，反馈人工测试通过后再进入 P2。
- 安全迁入：外部 `E:\AItools\Schedule_miniprogram` 的 15 个文件、11295 字节经逐文件 SHA-256 校验迁入 `apps/miniprogram`，外部目录已移除。正式 AppID 保留；`project.private.config.json` 原样保留且由 Git 忽略，不输出或提交其内容。
- 运行配置：`project.config.json.miniprogramRoot` 固定为 `dist/`；`src/app.json` 使用 Skyline、glass-easel、最低基础库 `3.3.0`、`disableABTest: true` 和 `sdkVersionEnd: 15.255.255`。最低版本于 2026-08-19 经用户批准提高，以使用 UI 线程 `worklet.scrollViewContext`；P0 空 bootstrap 已替换为原生基础控件 PoC 画廊。
- 工具链：确定性 staging/production `src→dist`、TypeScript、WXML/WXSS/JSON、运行边界、密钥、Worklet 指令、包体和双构建一致性门禁继续生效；`miniprogram-ci@2.1.31`、`miniprogram-simulate@1.6.2`、`jsdom@26.1.0` 和仅供可选截图比较器使用的 `pngjs@7.0.0` 精确锁定。CI dry-run 不读取凭据，真实上传私钥仍必须在仓库外。
- 文档：专项计划、运行/构建、API 边界、分包、Web 同步、视觉标准、组件/页面清单、测试、用户人工原生验收、CI、staging、发布回滚和 4 个 ADR 已放入 `apps/miniprogram/docs`；`apps/miniprogram/AGENTS.md` 明确禁止 LLM 操作本地微信开发者工具。
- Web 同步：计划内已有能力在对应 Mini 阶段实时跟随 Web；当前动态月历、连续周、统一时间选择器和自绘控件进入 P1/P4/P5 基线。院内通讯录属于迁移计划后新增功能，登记在 P10 最后补齐。
- Web 黄金稿：基础控件、月历、7×7 与 20×30 矩阵首轮均由用户确认；实体 Android 复测后确认 P1 Storybook 月历仍错误写死 42 格，而当前生产 Web `buildMonthDisplayGrid` 已按月份跨度动态生成 5/6 周，并为最后一行选中框适配左右底角。黄金稿与 Mini fixture 已同步纠正，12px 详情间距继续保持。
- 原生实现：`@schedule/ui-tokens/tokens.ts` 同时生成 CSS/WXSS，构建把 WXSS 确定性复制到 `dist/styles` 并审计导入。新增自绘 `UiButton`、`UiSwitch`、`UiCheckbox`、`UiRadio`、`UiInputShell`、`UiPicker`、`UiAlert`、`UiChip`、`UiLoading`；开关保持 52×30px 本体、60×44px 触控层，禁用/加载态阻断事件。未引入 TDesign 或第三方 UI。
- 月历实现：`pages/calendar-poc/index`、自绘 `CalendarMonth`/`CalendarCell` 和确定性 2026-10 fixture 现按 Web 同一周数公式生成 35/42 格面板；跨月/今天/选择/周末/节假日/人员/加换状态独立，最后一行显式标记左右底角。Android 触控、PC 鼠标和程序按钮统一改走 Skyline 原生三面板 `swiper`；箭头/定位图标使用真实 WXML 子节点，详情保持独立表面和 12px 间距。
- 矩阵实现：`pages/manual-matrix-poc/index?mode=daily|maximum`、自绘 `ManualScheduleCell` 和确定性 7×7/20×30 fixture 使用四层坐标模型。日期与班次共用一个原生横向 `scroll-view`；人员与班次通过同一个 UI 线程纵向 SharedValue 同步；左上角固定。矩阵高度按手机剩余可视空间动态计算，7×7 完整显示，20×30 最少显示 3 行。Android 人工验收已确认 C 的横向丝滑、日期/主体同步；D 横向同样通过，但旧 simultaneous pan 结构未产生纵向移动。
- 人工验收工具：`testing/p1-manual-test-plan.json` 锁定基础控件、月历、7×7、20×30 四条原生路由、实际交互状态和既定视觉/性能目标；`docs/runbooks/manual-native-testing.md` 给出用户手工编译模式、实体 Android 操作和反馈格式。云测 runner、Minium Python/ZIP、云测凭据和专用 selector 已移除；`scripts/visual-compare.mjs` 仅在用户提供截图或失败需要量化时使用。
- 回归来源与语义：`git log -S`/`git blame` 确认旧 Storybook 详情同卡来自 `8a49434`、Web 三面板来自 `41d284b`、生产外框裁切来自 `0aaa562`；本实现复用视觉和交互语义但未复制 Vue/DOM。相邻月份格只读，当前月日期只发出一次选择事件；月份切换只重建 PoC ViewModel，不接入 API 或业务 store。
- 矩阵回归来源与语义：P1 黄金 story 由 `3884713` 引入；生产手排基础来自 `6512274`，冻结日期/人员列及密集移动交互来自 `1203dc7`。本实现保留同一人员×日期、班种、失效、选择和滚动语义，但用 WXML/WXSS/Skyline 重写；3.3.0 用于 UI 线程手势、SharedValue 和动画，20×30 上限内不依赖只纵向回收的 `list-builder`。
- 人工清单回归定位：`git log -S`/`git blame` 确认旧清单的 `dialog-open` 与 7×7 `vertical-scroll` 均由 `c8d50f5` 首次写入。已确认用户通过的基础控件 Storybook/原生页不存在对话框，7×7 的 82px 表头 + 7×44px 行恰好等于 390px 视口，不存在纵向滚动；人工清单使用实际可见的通知开启、联系方式取消核对、周视图选择，并仅在 20×30 验证纵向滚动。
- 测试先行：令牌 WXSS、组件注册、开关几何/ARIA、禁用/加载事件和 simulate 组件树先红；实现后 token 2/2、Mini scripts 14/14、Mini typecheck/源码/产物/包体/双构建确定性和无凭证 CI dry-run通过。staging verify 产物 38,190 bytes、manifest `a65a195e8042b1ec25d944c3ba551ded0d3dbdd2d0d7c1d17e8878f499a0ac2a`；production verify 38,183 bytes、manifest `bd73d94f934bdab802a9a2476f57ebf10faa4ae1823c264944d9077357198c1d`。根 format/lint/build/typecheck、排除既有 `runtime/**` 副本后的全仓 112 文件/669 项（31 文件/261 项按环境跳过）、定向 Prettier/ESLint、ui-tokens build、`pnpm smoke:check-core` 与任务文件 `git diff --check` 通过。
- 月历验证：测试先行时 5 项因页面/fixture/组件未实现而失败；实现后 P1 月历定向 7/7、Mini 全套 21/21、typecheck、源码审计、staging/production 构建与产物审计、双构建确定性和无凭证 CI dry-run 通过。staging verify 为 66,647 bytes、manifest `67b53ee7452ea91d55eb6e09ecc34711e8dad707eb574d4e07ce6f3bae08389c`；production 为 66,640 bytes、manifest `c56080588028ecfa088f2474de20e0152664196a3aab818db3fd06e394a62cd3`；源码/产物均保留 6 个 Worklet 指令。根 lint/build/typecheck、任务文件 Prettier/ESLint、排除用户自有 `runtime/**`/`src/**` 发布副本后的主仓 114 文件/676 项（31 文件/261 项按环境跳过）、`pnpm smoke:check-core` 和 `git diff --check` 通过；未触及核心 Web 链路，无需浏览器 smoke。
- 矩阵验证：6 项结构/状态与 2 项 simulate 测试先因 fixture、页面和组件不存在而失败；实现后定向 8/8、Mini 全套 29/29、typecheck、staging/production 构建与审计、双构建确定性及无凭证 CI dry-run 通过。staging verify 为 101,250 bytes、manifest `31185775e55f0d6db94182627b8fb85a84b7690a9ee4496014803ecc3384239b`；production 为 101,243 bytes、manifest `48946ae37d7a3cece71b44a78fe66f22ec9fa1b5dda306564f625eb373fe8230`；源码/产物均保留 11 个 Worklet 指令。根 lint/build/typecheck、任务文件 Prettier/ESLint、排除用户自有 `runtime/**`/`src/**` 发布副本后的主仓 116 文件/687 项（31 文件/261 项按环境跳过）、`pnpm smoke:check-core` 通过；未触及核心 Web 链路，无需浏览器 smoke。
- 验收轨道变更：`a9c71d6` 曾加入 Minium 套件并已推送，但在生产部署前被用户的新决定取代；本批次移除全部云测专用脚本、Python/ZIP、命令、凭据说明和产品 selector，不回滚 P1 页面功能，也不改变视觉、事件或业务语义。新增人工计划契约测试，确保四条路由、实际状态和性能目标不会漂移。
- 人工轨道验证：Mini 10 文件/35 项通过；staging/production verify 均保留 11 个 Worklet，产物 101,250/101,243 bytes，manifest 分别为 `31185775e55f0d6db94182627b8fb85a84b7690a9ee4496014803ecc3384239b` / `48946ae37d7a3cece71b44a78fe66f22ec9fa1b5dda306564f625eb373fe8230`；确定性、源码/包体、无凭据 CI dry-run、根 lint/build/typecheck、排除用户自有 `runtime/**`/`src/**` 后主工作区 118 文件/693 项（31 文件/261 项按环境跳过）、任务文件 Prettier、`git diff --check` 与 `pnpm smoke:check-core` 通过。未触及 Web 核心链路，无需 `pnpm smoke:browser`；根 `format:check` 仍只被用户自有 `apps/miniprogram/project.config.json` 拦截。
- 既有工作树阻断：原始 `pnpm format:check` 仅因本轮开始前已变更的 `apps/miniprogram/project.config.json` 格式失败；原始 `pnpm test` 仅因未跟踪 `runtime/**` 发布副本被 Vitest 重复扫描而失败。两者均为用户自有、未修改且不会暂存；任务文件格式检查和排除副本后的主仓测试均通过。
- 外部状态：不再需要或接受 MiniTest token、计划 ID、云测账号或 Minium ZIP。未生成预览、上传开发/体验版或改变微信平台状态；全程未启动、唤醒或控制微信开发者工具。用户下一步只需人工打开 GUI、编译四条路由并在实体 Android 测试。
- 人工轨道发布：checkpoint `e53f361`（`test(miniprogram): switch p1 to manual acceptance`）已推送；发布前加密数据库备份 archive 为 `6d16b012-6d69-4728-a335-59ad00396999`（50 张表、18,497 行、7,370,892 字节，SHA-256 `e6de3f9c748aa3db8b2789f1214bb48fdf61aa42f5293af3ba9f9e629e063eff`）。release `e53f3611350fa60c846f2f649f68b4fea9616f41` 从干净隔离 worktree 构建并部署；容器预热首个健康检查一次 502 后自动恢复，`ecs-verify.sh` 通过健康、38 个迁移、产物哈希、域名隔离、公开端口与容器检查，正式首页/API 均为 200。云测检查点 `a9c71d6` 从未单独部署。
- checkpoint：`3884713`（`chore(miniprogram): establish native migration workspace`）已推送；发布前加密数据库备份 archive 为 `365295b2-9a16-4d0f-91d2-bcf4ce24470b`（50 张表、18,423 行、7,296,708 字节，SHA-256 `aa0b605778b44edb7651bdf00f2c06e020f109e6937d2e872bf096598ef115cd`）。release `3884713b35f417c88210046efb522bacdb5e08d4` 已部署，容器预热首次健康检查一次 502 后自动恢复，`ecs-verify.sh` 通过健康、38 个迁移、产物哈希、域名隔离和容器检查。
- 本轮发布：代码 checkpoint `24bc2c4`（`feat(miniprogram): add native foundation controls`）已推送；发布前加密数据库备份 archive 为 `55c53e31-0021-4d38-b5f9-6d9bc96e74e2`（50 张表、18,484 行、7,362,760 字节，SHA-256 `8c555ba7660bb186c529877d6f7db9bc7f0fc5bd552739a2ade1f4549a6e2fe7`）。release `24bc2c4bb12280c95722715ab0d09b1f563eb44a` 从该提交的干净临时 worktree 构建并部署；容器预热首个健康检查一次 502 后自动恢复，`ecs-verify.sh` 通过健康、38 个迁移、产物哈希、域名隔离和容器检查。
- 月历发布：代码 checkpoint `1f715c9`（`feat(miniprogram): add native calendar poc`）已推送；发布前加密数据库备份 archive 为 `212fcfcd-1596-4336-9226-b0a3baa7298c`（50 张表、18,489 行、7,365,620 字节，SHA-256 `e0554e1597bd0b77a79c8594ce9ef6ffc965ff56a9ebb423607053c9617e8a0c`）。release `1f715c960180b1372947fe9249671fc6b5a5e2d9` 从该提交的隔离 worktree 离线构建并部署；首次执行在业务变更前因临时脚本 CRLF 停止，规范化 `/tmp` 脚本后重试成功，容器预热首个健康检查一次 502 后自动恢复。`ecs-verify.sh` 通过健康、38 个迁移、产物哈希、域名与公网 IP 隔离、容器检查；外部正式首页和 API 均返回 200。
- 矩阵发布：代码 checkpoint `6cc7463`（`feat(miniprogram): add native manual matrix poc`）已推送；发布前加密数据库备份 archive 为 `55ee8512-79fd-4c62-a532-10732dcdb4c7`（50 张表、18,492 行、7,367,596 字节，SHA-256 `b6caa2526c77dca8af77a2c2b5dafcb6175e84c755b518c8f13801269716e1e1`）。release `6cc7463df8b2442f07262be39c2b968498e97b85` 从该提交的干净临时 worktree 离线构建并部署；容器预热首次 TLS 健康检查短暂失败后自动恢复，`ecs-verify.sh` 通过健康、迁移、产物哈希、域名与公网 IP 隔离和容器检查，外部正式首页/API 均为 200。
- 证据工具发布：checkpoint `c8d50f5`（`test(miniprogram): add native visual evidence tooling`）只包含 P1 runner、比较器、清单、文档、workspace 委托命令与 `pngjs` 锁文件，已推送。发布前加密数据库备份 archive 为 `05e2ec9b-972b-40f1-b542-b417fa82f7dd`（50 张表、18,495 行、7,369,572 字节，SHA-256 `834efa039a9948f9be6a007a140c034e10cecc2e848aa4854475232245f984a2`）。release `c8d50f537761a000fca1071f5f57348e524e6b52` 从干净隔离 worktree 构建并部署；隔离安装先因本机 pnpm store 缺少 `pngjs` 离线 tarball 停止，冻结锁文件下载 1 个公开包后通过。首次调用旧手册中的 `/opt/schedule/infra/scripts/ecs-update.sh` 因服务器不保留该入口而在业务变更前停止，随后上传同 commit 的脚本到独立 `/tmp` 目录并规范化 CRLF 后部署成功；根部署手册已同步修正为这一实际安全流程。容器预热首个 TLS 健康检查短暂失败后自动恢复。`ecs-verify.sh` 通过 release、产物哈希、38 个迁移、域名隔离、公开端口与容器检查，公网首页/API 均为 200；Git 本地、`origin/main` 和服务器 `current-release` 精确一致。用户自有 `project.config.json`、`runtime/` 与 `src/` 未暂存、修改或部署。
- 首次人工反馈与修复：用户确认月历 B 通过；基础控件 A 在实体 Android 出现四个 50% 按钮格因 `width + padding` 超出轨道而逐行换行，且 Android/开发者工具均无法继续向下滚动。`git log -S`/`git blame` 定位两项均由 `24bc2c4` 首次引入。Web 黄金仍保持 390px 两列、320px 单列；Mini 仅给 `.button-cell` 明确 `border-box`，并以全高原生纵向 `scroll-view` 承载基础页。新增结构回归在旧代码上失败、修复后通过；事件、状态、调用次数和已通过月历均未改变。
- 本次修复验证：Mini 10 文件/36 项、排除用户自有 `runtime/**`/`src/**` 的主工作区 118 文件/694 项通过（31 文件/261 项按环境跳过）；staging/production verify、11 个 Worklet、确定性、源码/包体、无凭据 CI dry-run、根 lint/build/typecheck、任务文件 Prettier、`git diff --check` 与 `pnpm smoke:check-core` 通过。staging/production 包体分别为 101,403/101,396 bytes，manifest 分别为 `b9589e46d2b871df8272fc7662ede7cee6f986f5b59b48344e964944deb6aff6` / `abd93dab69da4b65e6df0cb35f9e95facc0cc6f86a1dd22964b0e331196ec084`。根 `format:check` 仍只被用户自有 `apps/miniprogram/project.config.json` 拦截；未触及 Web 核心链路，无需 `pnpm smoke:browser`。
- 本次修复发布：代码 checkpoint `9c5c8b1`（`fix(miniprogram): restore foundation layout and scrolling`）已推送；发布前加密数据库备份 archive 为 `1ef4216c-1a80-42aa-86b8-129d5de5ad65`（50 表、18,499 行、7,372,208 字节，SHA-256 `72c3d890b717d8ffc4403e3b8fa213b2c7fc0ca495d0542f03c4913ad3cbd21f`）。release `9c5c8b1ada36dcb88a05e89753fec3b3cac710af` 从干净 worktree 构建并部署；容器预热首个 TLS 健康检查一次断开后自动恢复，`ecs-verify.sh`、外部正式首页与 API 均通过。最终状态 checkpoint 识别消息：`docs(status): record foundation native fix deployment`。
- 原生测试入口：用户复测确认基础页已可上下滚动，但当前页不会自动包含另外三个独立路由，因此看不到月历与矩阵。`git log -S`/`git blame` 确认月历/矩阵分别由 `1f715c9`/`6cc7463` 作为独立页面引入，入口缺失不是页面渲染失败。基础页“状态反馈”后新增三行原生 `navigator`，分别进入月历、7×7 和 20×30；不嵌套页面、不修改三个 PoC 的布局、数据、Worklet 或性能环境。
- 入口验证：新增导航契约在旧代码上先失败；实现后 Mini 10 文件/37 项、排除用户自有 `runtime/**`/`src/**` 的主工作区 118 文件/695 项通过（31 文件/261 项按环境跳过），staging/production verify、11 个 Worklet、确定性、源码/包体、无凭据 CI dry-run、根 lint/build/typecheck、任务文件 Prettier、`git diff --check` 与 `pnpm smoke:check-core` 通过。根 `format:check` 仍只被用户自有 `apps/miniprogram/project.config.json` 拦截；未触及 Web 核心链路，无需 `pnpm smoke:browser`。
- 入口发布：代码 checkpoint `e2852ef`（`fix(miniprogram): add native p1 test navigation`）已推送；发布前加密数据库备份 archive 为 `07fb20ed-651b-43e1-b09d-82d9ef2415ca`（50 表、18,501 行、7,373,524 字节，SHA-256 `87751e7f8800d6691082b3e922317d6e39c3d4906b2e438a9beb76f11e1872b4`）。release `e2852ef603a0f8dee5dc5e991243b63d0a0182be` 从干净 worktree 构建并部署；容器预热首个健康检查一次 502 后自动恢复，`ecs-verify.sh`、外部正式首页与 API 均通过。最终状态 checkpoint 识别消息：`docs(status): record native p1 navigation deployment`。
- 本轮真机回归与引入点：用户在 PC/Android 发现月历控件显示与触控行为相反、Android Pan 无法切月、月历周数/底角不符生产 Web，以及 7×7/20×30 表头不随对应轴同步。`git log -S`/`git blame` 定位固定 42 格与 Pan 来自 `1f715c9`，矩阵仅 Worklet 冻结同步来自 `6cc7463`；生产 Web 的动态周数与底角规则以 `apps/web/src/features/calendar/{month-grid-presentation.ts,MonthGrid.vue}` 为语义基准。回归测试先出现 5 项 Mini 失败和 1 项 Storybook 失败；修复后定向 Mini 12/12、Storybook 12/12，Mini 全套 10 文件/37 项、排除用户自有 `runtime/**`/`src/**` 的主工作区 119 文件/698 项通过（31 文件/261 项按环境跳过）。Mini typecheck、staging/production verify、确定性、源码/包体、无凭据 CI dry-run、根 lint/build/typecheck、Storybook build、任务文件 Prettier、`git diff --check` 与 `pnpm smoke:check-core` 通过；staging/production 包体分别为 104,352/104,345 bytes，manifest 分别为 `71fcf061c68189375ccfb5598937948f9bcc582883520d110455b1072374a1b3` / `dcc21c572b4b55cb654336e4b120954a38276dbe92bd3c2ede92f3fa2c6d54ab`，源码与产物均只保留 3 个矩阵滚动进度 Worklet。根 `format:check` 仍只被用户自有 `apps/miniprogram/project.config.json` 拦截；原始根测试会误扫未跟踪 `runtime/**` 发布副本，主工作区排除副本后完整通过。未触及 Web 核心链路，无需 `pnpm smoke:browser`。
- 本轮修复发布：代码 checkpoint `4b33274`（`fix(miniprogram): align calendar and matrix gestures`）已推送；发布前加密数据库备份 archive 为 `97f38cf1-119e-4cc7-a28e-7c626692b131`（50 表、18,503 行、7,374,844 字节，SHA-256 `dca9672981d721d283bf307c8633ba7b7294de2288679cea0a4a17fa888b791c`）。release `4b33274e5b458ef8f236119892ef08ea6f5a9b9b` 从隔离干净 worktree 离线构建并部署；容器预热首个 TLS 探测短暂断开后自动恢复，`ecs-verify.sh` 通过正式域名健康、38 个迁移、产物哈希、域名隔离、公开端口和容器检查。该 ECS 发布不上传、审核或发布微信小程序。
- 矩阵滚动延迟回归：用户于 2026-08-19 在 7×7 和 20×30 实体运行中确认表头虽能跟随，但存在延迟和黏滞感。`git log -S`/`git blame` 定位到 `4b33274` 引入的 WXS 普通 `bindscroll` 路径；官方 Skyline Worklet 说明明确指出跨线程响应会产生延迟，`worklet:onscrollupdate` 与 SharedValue/`applyAnimatedStyle` 用于 UI 线程直接反馈。回归测试先以 2 项失败证明旧实现仍使用 WXS 且滚动回调没有更新冻结轨道 SharedValue；修复后冻结轨道与进度条在 `onLoad` 绑定，横纵偏移由同一个 UI 线程滚动回调直接写入，不增加 timing/spring 补间，也不改变点击、撤销、数据或滚动结束提示的调用次数。当前实现待用户重新人工复核 C/D。
- 矩阵延迟修复验证：定向回归 6/6、Mini 全套 10 文件/37 项通过；staging/production 源码与产物均保留 5 个 Worklet，包体分别为 104,143/104,136 bytes，manifest 分别为 `79aeb4f5b60416906686e5df5b0d46df8820177cb78f86dbb48b34ab2be74a9a` / `062ce07925cc4ab801180fc1eb167beb7ede8b1e1747884a534ec87945f942e1`。Mini typecheck、确定性、包体审计、无凭据 CI dry-run、根 lint/build/typecheck、排除用户自有 `runtime/**`/`src/**` 后主工作区 119 文件/698 项（31 文件/261 项按环境跳过）、`pnpm smoke:check-core`、任务文件 Prettier/ESLint 与 `git diff --check` 通过；根 `format:check` 仍只被用户自有 `project.config.json` 格式问题拦截，该文件及 `runtime/`、`src/` 均未修改且不会暂存。
- 矩阵延迟修复发布：代码 checkpoint `3b9a677`（`fix(miniprogram): remove matrix scroll lag`）已推送；发布前加密数据库备份 archive 为 `dce9ac35-6c36-4d02-a488-8f40fb94b2ec`（50 表、18,510 行、7,379,296 字节，SHA-256 `dcfe627e52750d9333da206e470f649c170bebe4621c92b90d250de169e0fa51`）。release `3b9a6777c1e75c8cfe91e49429955b0d37357e7f` 从隔离干净 worktree 构建并部署；首次健康探测一次 502 后自动恢复，`ecs-verify.sh` 通过正式域名健康、38 个迁移、产物哈希、域名隔离、公开端口和容器检查。
- 微信上传规则：用户于 2026-08-19 要求每次完成的小程序修改 checkpoint 均提交微信开发平台。今后在 Git 推送后使用 Node 版 `miniprogram-ci` 上传开发/体验轨道；dry-run 不算上传，提交审核与正式发布仍须用户明确批准。用户已提供仓库外上传私钥文件，路径仅在运行时注入且不写入仓库或日志；不得唤醒或改用本地开发者工具 CLI。
- 第二次人工回归：用户确认 `3b9a677` 在真实运行中日期/人员表头变为固定，未随对应轴滚动，因此上一轮“同帧修复”判定撤销，不能以静态 37/37 代替真机结果。官方复核确认 `worklet:onscrollupdate` 的 `scrollLeft/scrollTop` 字段和 SharedValue 路径正确，但 `applyAnimatedStyle` 默认 `flush: 'async'`，样式到下一渲染时间片才应用；官方为强同步场景提供 `flush: 'sync'`。新回归先在旧实现上失败，随后要求 updater 按官方典型示例直接捕获局部 `scrollX/scrollY`，且日期/人员冻结轨道显式同步刷新；页面实例保存同一 SharedValue 供滚动 Worklet 写入，不改变事件字段、偏移方向、数据、点击、撤销或调用次数。
- 微信上传实跑兼容：用户提供仓库外上传私钥后，真实体验上传已进入官方 Summer 编译器，但在平台状态改变前依次暴露两个 pnpm 兼容缺口：worker thread 覆盖 `NODE_PATH` 后无法解析已由 `miniprogram-ci` 声明的 Worklet Babel 插件；改为官方 task 同进程执行后，又发现其 Worklet 插件使用但未声明 `@babel/preset-typescript`。上传封装现校验依赖根、只在编译进程启用内联官方 task，并显式固定同代 preset；回归先失败后通过，不复制依赖、不修改 `node_modules`、不读取私钥内容、不启动开发者工具。平台尚未产生新体验版本，须从最终干净 checkpoint 重试。
- 本轮验证：冻结轨道与上传设置的回归断言均先失败后通过，定向 12/12、Mini 全套 10 文件/39 项、主仓排除用户自有 `runtime/**`/`src/**` 后 119 文件/700 项通过（31 文件/261 项按环境跳过）。新增 preset 的最小 lockfile 可由 `pnpm install --frozen-lockfile --offline --filter @schedule/miniprogram` 重现；Mini typecheck、staging/production verify、确定性、源码/包体、CI dry-run、根 lint/build/typecheck、任务文件 Prettier、`git diff --check` 与 `pnpm smoke:check-core` 通过；staging/production 包体为 104,325/104,318 bytes，manifest 为 `b1adaf818211cebeb95adb3d56b6fb61ace12aeb940705f3d95e3434ee9a0891` / `35f45e933c40b1215cc0c67fab1d78c16d5fc23af4fcb8c85452c2606da4830f`，源码与产物均保留 5 个 Worklet。根格式全检仍只会被用户自有 `project.config.json` 拦截，该文件及 `runtime/`、`src/` 不暂存。
- 本轮代码发布：checkpoint `f8c743a`（`fix(miniprogram): synchronize matrix worklet headers`）已推送；发布前加密数据库备份 archive 为 `4e884107-d809-4bdd-b571-3e0052dccb90`（50 表、18,513 行、7,381,344 字节，SHA-256 `ba86782259103afdf09fd6c537e258a1ccd2228dae0b759db45737b403497ed7`）。release `f8c743adc24091bec3978e2d410d180584a5522c` 从隔离干净 worktree 构建并部署，预热首次 TLS 探测短暂失败后自动恢复，`ecs-verify.sh` 通过健康、38 个迁移、产物哈希、域名隔离、公开端口和容器检查。
- CI 兼容发布：checkpoint `76ce450`（`fix(miniprogram): stabilize official worklet upload`）已推送；发布前加密数据库备份 archive 为 `9adaa134-4a02-4d20-afaa-682908c9df81`（50 表、18,514 行、7,382,000 字节，SHA-256 `406263a21862c17fcffa97e7ee95221c89f136088eee5812647837b51ecbe219`）。release `76ce450d3a53a724cd2132887168be19ae277d50` 从干净 worktree 构建并部署，预热首次 502 后自动恢复，`ecs-verify.sh` 完整通过。
- 微信体验上传：用户将当前出口 IP 加入代码上传密钥白名单后，从干净 `1fffa1d` 隔离工作区原样重试成功。官方 Summer 编译处理 48 个代码文件，生成 31,962 字节上传包；体验版本 `0.1.0-p1.20260819.4`、robot 1、staging profile、manifest `3b10bf169b84ee283adfb16d93974c39ba554230d5fac79ebcf81425e052efc9` 已上传微信开发平台。未提交审核、未正式发布，全程未启动或控制本地微信开发者工具。
- 第三次人工回归：用户在体验版 `0.1.0-p1.20260819.4` 实体 Android 确认 C/D 仍失败，7×7 日期表头与 20×30 日期/人员表头均固定。该真机结果再次优先于静态测试，不将 `.4` 视为有效修复。
- `.5` 前的当时推断：`git log -S`/`git blame` 确认 `3b9a677` 把滚动偏移改为页面实例 SharedValue，`f8c743a` 又让样式 updater 捕获 `onLoad` 局部 SharedValue；据此曾把对象别名推断为根因并在 `3933aee` 改成词法单一来源。体验版 `.5` 的 Android 结果已否定该推断，不能再把普通 JS mock 当原生同步证据。
- `.5` 人工回归：用户确认 7×7 日期表头与 20×30 日期/人员表头仍固定，顶部蓝色进度也不变化；而最早只做进度时曾可变化。该结果说明继续修改 SharedValue/`applyAnimatedStyle` 捕获方式没有验证价值。
- 本轮验证：直接共享词法标识符的结构回归先在旧实现失败；修复后定向 6/6、Mini 10 文件/39 项、排除用户自有 `runtime/**`/`src/**` 后主仓 119 文件/700 项通过（31 文件/261 项按环境跳过）。Mini typecheck、staging/production verify、确定性、源码/包体、CI dry-run、根 lint/build/typecheck、任务文件 Prettier/ESLint、`git diff --check` 与 `pnpm smoke:check-core` 通过；staging/production 包体为 104,371/104,364 bytes，manifest 为 `4776e10ed9750d060dd8b94db66b24dee023ab484810c0f04501f4a12c225936` / `1a1e921a9b1dc0d978f874de306abc473be6528b7c6f430950d2d7787cd0e42f`，源码与产物均保留 5 个 Worklet。未触及 Web 核心链路，无需 `pnpm smoke:browser`；根格式全检仍只会被用户自有 `project.config.json` 拦截，该文件及 `runtime/`、`src/` 不修改、不暂存。
- 本轮代码发布：checkpoint `3933aee`（`fix(miniprogram): share matrix offsets across worklets`）已推送；发布前加密数据库备份 archive 为 `1cd93149-b52b-4f29-a6ae-a1f81f828760`（50 表、18,517 行、7,383,976 字节，SHA-256 `0e3252417529440a2a218ce182d76943583ebec7cc0f5159cf60fd58de1ea01a`）。release `3933aeefb13b7ba9ea9c3d525c07d9405064116b` 从干净隔离工作区构建并部署，预热首次健康检查一次 502 后自动恢复，`ecs-verify.sh` 通过健康、38 个迁移、产物哈希、域名隔离、公开端口和容器检查。
- 本轮微信体验上传：同一干净 `3933aee` 通过官方 Summer 编译，处理 48 个代码文件并生成 31,981 字节上传包；体验版本 `0.1.0-p1.20260819.5`、robot 1、staging profile、manifest `561a52ab8ff2accb359c3c3b6b1a5bcded5a5a042afc97a30faa01cdeaf2342f` 已上传微信开发平台。未提交审核、未正式发布，未启动或控制本地微信开发者工具。
- ScrollViewContext 决策：用户接受最低基础库从 3.0.2 提高至 3.3.0。新实现把日期表头、人员表头改为两个独立原生 `scroll-view`，用 `NodesRef.ref()` 保存引用；主体滚动 Worklet 直接调用 `worklet.scrollViewContext.scrollTo()` 同步 `left`/`top`，不再用 WXS 或 `applyAnimatedStyle` 移动冻结轨道。
- 回归定位与测试先行：`git log -S`/`git blame` 确认初版事件/进度来自 `6cc7463`，WXS 延迟来自 `4b33274`，三轮无效 SharedValue 变体来自 `3b9a677`、`f8c743a`、`3933aee`。新结构回归先在旧实现明确失败，要求三个滚动容器、两个 ref、UI 线程直接 `scrollTo` 和 3.3.0；实现后定向 6/6、Mini 全套 10 文件/39 项与 typecheck 通过。
- 本轮验证：Mini staging/production verify、源码/产物边界、3 个 Worklet、确定性、包体、无凭据 CI dry-run通过；包体为 104,865/104,858 bytes，manifest 为 `5de5e8a7a4cdf63048274ffd3e17723ff708f6370edc53a9494195d4aa494c6f` / `9e51bbaf54a9c7b77d1d592cfabfa4e11ac0d3a8ceb8048431a8141ad8f0682c`。根 lint/build/typecheck、任务文件 Prettier/ESLint、`git diff --check` 与 `pnpm smoke:check-core` 通过；未触及 Web 核心链路，无需浏览器 smoke。排除用户自有 `runtime/**`/`src/**` 后全仓 119 文件/704 项和 31 文件/262 项环境跳过通过，唯一失败是本轮前已有的 `scripts/package-ecs-release.test.mjs` 仍断言 38 个迁移，而当前 `ecs-verify.sh` 与已部署基线为 39；本轮不修改该无关测试。根格式检查仍只被用户自有 `apps/miniprogram/project.config.json` 格式阻断，该文件不修改、不暂存。
- 行为审计：矩阵数据、格子选择、撤销、横纵坐标、方向、惯性主体和滚动结束提示语义不变；冻结实现从样式 transform 改为 UI 线程直接滚动两个只读表头容器。同步仍由同一个主体事件驱动，不增加网络、业务写入或滚动期 `setData`，表头滚动禁用动画避免人为延迟。
- 本轮代码发布：checkpoint `7e73686`（`fix(miniprogram): synchronize matrix scroll contexts`）已推送。发布前加密数据库备份 archive 为 `1659677c-b22b-4ec1-9a1c-4acc9ef7ac77`（50 表、49,429 行、20,887,140 字节，SHA-256 `2dd68963a722afc7bd89065fc188f373d96d792a2bb020f93eba6f7b244dc82c`）；release `7e7368629b3c177fd3c38920c4d787680400a6a3` 从不可变产物部署，容器预热首次 502 后自动恢复，`ecs-verify.sh` 通过正式域名健康、39 个迁移、产物哈希、域名隔离、公开端口与容器检查。
- 本轮微信体验上传：同一干净 `7e73686` 通过官方 Summer 编译，处理 48 个代码文件并生成 32,091 字节上传包；体验版本 `0.1.0-p1.20260819.6`、robot 1、staging profile、manifest `c8f6a37051d9e34e5154718037d5e4f87d9c0a725dced48ab0d697a4f8dab415` 已上传微信开发平台。未提交审核、未正式发布，全程未启动或控制本地微信开发者工具。
- `.6` 真机回归结果：用户确认 7×7 和 20×30 的人员/日期表头仍固定，顶部蓝色进度条也固定；因此不能再把 UI 线程静态实现视为真机通过。该结果说明目标设备未可靠触发或执行当前 `worklet:onscrollupdate` 视觉路径，普通 mock/静态测试不足以证明原生同步。
- 本轮修复：保留 UI 线程 `worklet.scrollViewContext.scrollTo()` 作为首选，并新增主体 `bindscroll` 兜底；`onReady` 通过 `NodesRef.node()` 获取两个普通 `ScrollViewContext`，事件直接调用 `scrollTo({left/top,duration:0,animated:false})`。顶部蓝条改为同一事件源的显式 `scrollProgressOffset` 数据绑定，按整数百分比节流，避免继续依赖失效的 `applyAnimatedStyle` updater。Web/WXML 结构、矩阵数据、点击、撤销、业务 API 和左上角冻结语义不变。
- 本轮测试：回归先要求 `bindscroll`、两个 `node()` 引用和进度偏移绑定；实现后 Mini 全套 10 文件/40 项通过，定向矩阵 7/7，typecheck、staging verify、源码/包体审计、双构建确定性、无凭据 CI dry-run、任务文件 Prettier/ESLint、`git diff --check` 通过。staging verify 包体 106,233 bytes，manifest `a6263d24efa98e4d16c29081b1dba64e12f818267562829eded9477397506a6d`；源码/产物保留主体滚动与结束处理两个 Worklet。未触及 Web 核心链路，无需浏览器 smoke；根完整格式检查仍被用户自有 `apps/miniprogram/project.config.json` 阻断，`runtime/` 与 `src/` 未修改、未暂存。
- 行为边界：本轮只消除 Worklet 与普通滚动回调的竞争并把蓝条实时动画移回 UI 线程；若真机仍有延迟，下一轮需依据录像评估单一滚动容器/原生自绘网格，不再继续调整 SharedValue 捕获方式。
- 本轮追加修复：`_workletScrollActive` 在 Worklet 首次滚动后关闭普通兜底的 `scrollTo/setData`，顶部蓝条通过 `#matrix-scroll-thumb` 的 `applyAnimatedStyle({flush:'sync'})` 绑定滚动 SharedValue，避免双线程竞争和数据绑定动画滞后。定向矩阵 8/8、Mini 全套 16 文件/64 项、typecheck、staging verify、源码/包体、确定性、CI dry-run、Prettier 与 `git diff --check` 通过；staging 包体 106,663 bytes，manifest `6290b21d17343a62bc095b3b2e5871b43944c3b245ddcc33568b0fb65b94ca94`。
- 本轮架构调整：用户确认保留 Web 的同源横向滚动手感，同时要求大矩阵纵向可浏览、按手机剩余空间动态取高并锁定单次手势方向。矩阵使用长期存在的四层坐标：固定左上角、只随 X 移动的日期层、只随 Y 移动的人员层、随 X/Y 移动的班次主体。日期与班次仍位于一个原生 `scroll-view type=list scroll-x`，纵向则由同一 SharedValue 在 UI 线程同步变换人员和班次轨道；不恢复独立表头滚动容器，也不逐帧调用 `ScrollViewContext.scrollTo()`。7×7 完整显示；20×30 按矩阵顶部到手机安全区上方的实际剩余高度取值，至少显示三行。C 通过而 D 纵向失败后，`git log -S`/`git blame` 定位为 `6799f1f` 首次引入的外层全方向 pan、内层原生横向代理和 simultaneous 组合。官方说明手势事件不冒泡、嵌套默认内层优先，simultaneous 才允许同时生效；修复改为外层纵向专用识别器和内层横向原生代理的互斥嵌套，横向保留原生惯性，纵向使用有界 Worklet `decay`。普通 `bindscroll` 仅作为横向进度提示兜底，不参与冻结同步。
- 回归定位：`git log -S 'matrix-date-scroll'`/`git blame` 确认三个滚动容器由 `6cc7463` 引入，`ScrollViewContext.scrollTo` 由 `7e73686` 引入；本轮先修改矩阵结构测试，旧实现因 3 个 `<scroll-view>`、独立表头和 `scrollTo` 明确失败，再移除竞争路径。
- 本轮验证：回归测试先要求单一横向滚动容器和页面纵向增长，旧三容器实现明确失败；切换后 Mini 全套 10 文件/40 项、typecheck、staging build、源码/包体审计、确定性、CI dry-run、Prettier、`git diff --check` 通过。staging 包体 104,759 bytes，manifest `dde91887efd8abe89a4f0869e827084a74f641d33349c961c90174afb4deb06c`。尚未进行本轮微信上传和用户人工真机复核。
- 本轮代码 checkpoint：`e1a597d`（`fix(miniprogram): use single matrix scroll context`）已提交并推送；从该 commit 的隔离 worktree 构建并部署 ECS release `e1a597dbadcdd4542513e594422179dd22cc5b64`，发布脚本、数据库迁移、正式域名健康、产物哈希、容器和未知 Host 隔离全部通过（预热期间一次 502 后恢复）。
- 本轮微信体验上传：官方 Summer 编译处理 48 个代码文件，上传包 31,948 bytes；体验版本 `0.1.0-p1.20260819.10`、robot 1、staging profile、manifest `dde91887efd8abe89a4f0869e827084a74f641d33349c961c90174afb4deb06c` 已上传微信开发平台。未提交审核、未正式发布、未启动或控制本地开发者工具。
- 本轮四层坐标验证：先改回归后旧代码出现 3 项失败（缺少内容/视口高度分离、手势层和纵向边界），实现后矩阵定向 8/8、Mini 全套 10 文件/41 项、typecheck、staging/production verify、源码/产物边界、7 个 Worklet 指令、确定性、包体、无凭据 CI dry-run、任务文件 Prettier/WXML/WXSS 与 `git diff --check` 通过。staging 包体 112,924 bytes、manifest `18aba1507f87882a2753c9b97a620e2bfa1fd9b30f2fb6bd5032051dc6dcc7bb`；production 包体 112,917 bytes、manifest `62993ade93c5628d5cc87d6a429549c4f6de6766ddca0cd80c9ef99e07a5a35a`。根 lint/build/typecheck、`pnpm smoke:check-core` 以及排除用户自有 `runtime/**`/`src/**` 发布副本后的活动源码 121 文件/715 项通过，31 文件/262 项按无数据库环境跳过；未触及 Web 核心链路，无需浏览器 smoke。根格式检查只被本轮前已有且未修改的用户自有 `apps/miniprogram/project.config.json` 格式阻断，该文件不修改、不暂存。
- 本轮代码发布：checkpoint `6799f1f`（`fix(miniprogram): add adaptive axis-locked matrix viewport`）已推送。发布前加密数据库备份 archive 为 `b118d2e3-693c-4f90-b927-5d8778ff4777`（50 表、144,472 行、62,118,000 bytes，SHA-256 `2552011699e8b0e9b99b83c53f446378d084a96f819d6eb7fa8a345e6a963221`）。release `6799f1f9f85bc48311f4c1be9c67a881ba3f6d5b` 从隔离 worktree 构建并部署；容器预热首个健康请求短暂 502 后自动恢复，正式域名、40 个迁移、产物哈希、容器、公开端口和未知 Host 隔离验证全部通过。
- 本轮微信体验上传：官方 Summer 编译处理 48 个代码文件，上传包 36,572 bytes；体验版本 `0.1.0-p1.20260819.11`、robot 1、staging profile、manifest `18aba1507f87882a2753c9b97a620e2bfa1fd9b30f2fb6bd5032051dc6dcc7bb` 已上传微信开发平台。未提交审核、未正式发布、未启动或控制本地微信开发者工具。
- 方向识别修复验证：回归测试先要求外层纵向专用识别器、内层原生横向代理且禁止 simultaneous，旧实现明确 2 项失败；实现后矩阵定向 8/8、Mini 全套 10 文件/41 项、typecheck、staging/production verify、源码/产物边界、6 个 Worklet 指令、确定性、包体和无凭据 CI dry-run 通过。staging 包体 110,678 bytes、manifest `e4a9dec09f162b1bd925a768e59786ef996ea4161a6f0b081f40a65f85d70def`；production 包体 110,671 bytes、manifest `0d332343d0060d3ec01a9a7efec3cd0b6a04bc2c46ba19dde8f76ebbbee47bd2`。根 lint/build/typecheck、任务文件 Prettier、`pnpm smoke:check-core`、`git diff --check` 以及排除用户自有 `runtime/**`/`src/**` 发布副本后的活动源码 121 文件/715 项通过，31 文件/262 项按无数据库环境跳过；未触及 Web 核心链路，无需浏览器 smoke。根格式检查仍只被本轮前已有且未修改的用户自有 `apps/miniprogram/project.config.json` 格式阻断。
- 方向识别修复发布：checkpoint `713dcc9`（`fix(miniprogram): use exclusive directional matrix gestures`）已推送。发布前加密数据库备份 archive 为 `839889e8-b513-4700-9dc6-93213d4c0339`（50 表、144,477 行、62,120,288 bytes，SHA-256 `bfaf1a87ad556b47dee209593cb1a986dc54a50fe267ee2e8cac5d5cb6e5e70b`）。release `713dcc9138f14340fcb767df8b1e619b954d128d` 从隔离 worktree 构建并部署；容器预热首个健康请求短暂 502 后自动恢复，正式域名、40 个迁移、产物哈希、容器、公开端口和未知 Host 隔离验证全部通过。
- 方向识别修复微信体验上传：官方 Summer 编译处理 48 个代码文件，上传包 34,661 bytes；体验版本 `0.1.0-p1.20260819.13`、robot 1、staging profile、manifest `e4a9dec09f162b1bd925a768e59786ef996ea4161a6f0b081f40a65f85d70def` 已上传微信开发平台。未提交审核、未正式发布、未启动或控制本地微信开发者工具。
- 第三次 Android 反馈与根因：用户在最终状态体验版 `.14` 确认 D 仍完全没有纵向位移。`git log -S`/`git blame` 定位 `713dcc9` 移除 nested gesture negotiation 后，内层 `horizontal-drag-gesture-handler native-view="scroll-view"` 按 Skyline 默认优先级独占触摸；手势事件不冒泡，外层纵向 Worklet 因而不可达。官方协商规则要求嵌套双方用唯一 `tag` 和双向 `simultaneous-handlers` 共同参与；本轮保留 vertical/horizontal 专用方向判定，不恢复旧手写 Pan 选轴或 `should-response-on-move`。
- 嵌套协商修复验证：结构回归先在旧实现上 1 项失败，加入双向协商后矩阵定向 8/8、Mini 全套 10 文件/41 项、typecheck、staging/production verify、源码/产物边界、6 个 Worklet 指令、确定性、包体和无凭据 CI dry-run 通过。staging 包体 110,876 bytes、manifest `59ee9e0ebac3603e6828246db7fbd31f0585b46902b4158ae34518ffa831072b`；production 包体 110,869 bytes、manifest `efd4c2bf411beceb5d079ab26c756716f70826204cab6c4116191a2bdd4fc640`。根 lint/build/typecheck、`pnpm smoke:check-core`、任务文件 Prettier、`git diff --check` 以及排除用户自有 `runtime/**`/`src/**` 后主工作区 122 文件/720 项通过，31 文件/262 项按无数据库环境跳过；未触及 Web 核心链路，无需浏览器 smoke。根格式检查仍只被本轮前已有且未修改的用户自有 `apps/miniprogram/project.config.json` 拦截。
- 当前状态：用户确认 C 与 D 横向均通过；D 纵向在 `.14` 失败。双向嵌套协商修复及完整静态验证已完成，checkpoint 识别消息为 `fix(miniprogram): negotiate matrix axis gestures`；等待提交、ECS 部署和微信体验上传后只复测 D。P1 仍不能进入 P2，且不使用 MiniTest 云测。
- 下一批次：用户只需在新体验版人工复测 D：20×30 纵向人员/班次能否同步滚到最后一行，以及斜向手势是否只选择一个轴。C 和 D 横向已通过，不重复验收；D 通过后再继续 P1，失败需说明是否产生纵向位移、是否与人员列同步及是否出现横纵同时移动。
- 停止条件：最终状态 checkpoint 推送并同步为 ECS release，使 Git `HEAD`、`origin/main` 和服务器 `current-release` 一致后停止，等待用户人工复测；用户未明确通过前不进入 P2。

## 2026-08-18 院内通讯录联动筛选与同号合并（DIR-06 至 DIR-08）

- 批次范围：完成层级筛选互斥、顶部清除入口、约半高的紧凑号码卡和“完整联系方式集合相同”展示合并；不改原始 CSV、生产通讯录记录、来源追踪、权限或发布快照。
- 回归定位：`git log -S` 与 `git blame` 确认平铺七级筛选、底部清除操作及分行号码卡均由 `8309dce` 引入。新实现仍允许从任意层级跳选；改变上级时只清除已不兼容的下级，不增加请求次数或写入副作用。
- DIR-06/07：facets 新增角色可见范围内的无号码层级路径；前端按已选祖先实时收窄后续选项，选中路径保持一致。清除全部进入导览区和筛选 Sheet 顶部，卡片合并路径/位置文案并把长短号收在同一 44px 拨号行。
- DIR-08：浏览器仅按标准化后的“号码类型 + 完整号码 + 3–6 位短号”的完整集合分组，忽略标签、格式符和展示顺序；任一号码或类型不同、部分相同、无号码都不合并。合并卡保留全部条目名称、去重场景与备注，原始数据保持逐条可追溯。
- 测试先行：层级路径契约、筛选联动、同号分组、生产接入和 Storybook 断言均先在旧实现失败；实现后定向 321/321、真实 MySQL 通讯录路由 4/4、排除用户自有 runtime/小程序副本后的全仓 Vitest 105 个文件/635 项通过（31 个数据库集成文件/260 项按默认环境跳过）。
- UI/Storybook：依 `frontend-design` 保留医疗蓝白令牌和院区导览识别结构，使用逐列层级收窄而非深层菜单。Storybook 合成数据实测 6 条原始记录显示为 5 张卡、1 组同号；390px 单号码卡约 103–104px，无横向溢出，Storybook 静态构建与 Web 生产构建通过。
- 运行/浏览器验证：`运行/浏览器验证：pnpm smoke:browser` 最终通过管理员、成员、访客/vkey、访问记录及院内通讯录全流程；真实本地数据的手术室护士站/护士值班房合并、七级联动、跳级选择、改上级自动清下级、顶部清除、固定电话短号只读、390px 44px 拨号目标与无溢出均通过。前两轮分别停在既有手动排班固定列抖动和通知页面瞬时空元素错误，原样第三轮完整通过。
- 其他门禁：contracts/API/Web typecheck、任务文件 Prettier/ESLint、`git diff --check`、API/Web 构建和 Storybook build 通过；仅保留既有大 chunk warning。
- 正式发布：代码 checkpoint `926136a`（`fix(directory): link filters and merge duplicate contacts`）已推送；发布前加密数据库备份 archive 为 `d35a8061-95ca-4e6b-b013-ea3bb58cec5f`（50 张表、18422 行、7296048 字节，SHA-256 `4a3cb90cca407914612bb9e1ea023be9c07a5443812b6018a9fb832e1c9d66f4`）。release `926136a8a4c380d812304708b1917d4b939b1eef` 从干净 worktree 离线构建并部署，容器预热首次健康检查一次 TLS 断开后自动恢复，`ecs-verify.sh` 通过；随后并行小程序 checkpoint `3884713` 继续包含本轮代码并已部署。
- 正式域名只读复核：D0796 会话显示 341 条原始记录；搜索“手术室”显示 4 张卡、其中 2 组同号合并，护士站/护士值班房名称均保留。正式页无横向溢出，卡片高 119–120px，全部拨号目标不低于 44px；先跳级选择“放疗中心”再切换到不兼容的“饶平路院区”会自动回到片区“全部”并显示清除说明，筛选 Sheet 保持打开且清除全部位于网格上方。复核结束后清空搜索/筛选并恢复排班日历，未修改业务数据。
- 当前状态：DIR-06 至 DIR-08 已完成（含生产发布与线上只读复核）→ 待用户复核；最终状态 checkpoint 识别消息为 `docs(status): record linked directory deployment`。
- 停止条件：代码 checkpoint 与最终状态 checkpoint 均完成推送和生产部署，Git `HEAD`、`origin/main`、服务器 `current-release` 一致后等待用户复核。

## 2026-08-17 至 2026-08-18 院内通讯录（DIR-01 至 DIR-05）

- DIR-01 底座：6 张通讯录表、迁移 `0038_directory_snapshots`、MySQL 8.4 `ngram` 中文全文索引、号码前缀索引、拼音别名和版本化发布/回滚 CLI 已由 checkpoint `6f22319` 推送并部署；其后 release `b696d52` 继续包含该底座，生产 38 个迁移和 6 张空表已核验。
- 本地快照：两份 PDF 共 5 页已逐页检查，生成 2 个院区、2 份来源文档、341 个条目、359 个联系方式和 4488 个搜索别名；本地 CSV 使用 UTF-8 BOM + CRLF，清单与来源 PDF SHA-256 一致，目录 `runtime/directory-data/2026-05-12/` 仅由 `.git/info/exclude` 本机排除，不提交真实号码。
- 用户确认规则：短号只允许 3–6 位。原短号栏 4 个 8 位值已从短号字段删除；其中 1 个长短号疑似不一致条目改为 `manually_verified`，`needs_review` 降为 0，完整号码、来源定位和本地 `source_text` 保留。
- 回归定位与测试先行：`git log -S 'normalizePhoneValue'` 和 `git blame` 确认 `6f22319` 让完整号码与短号共用 3–20 位规则；7 位短号拒绝测试先在旧实现失败，再把完整号码保持 3–20 位、短号收紧为 3–6 位。导入核心 13/13、隔离 MySQL 发布/回滚 2/2 通过。
- 数据质量：独立复核确认 341/359/4488 计数不变，短号越界 0、孤儿外键 0、重复 ID 0、缺失号码 0、11/11 校验和通过，9 个 CSV 均为 UTF-8 BOM + CRLF；更新后 manifest SHA-256 为 `8df470f6e8e379f61d5d97e04d865885b011153b07678af24c9641ad71495e75`。
- 正式发布：短号校验 checkpoint `2744d76` 已推送并部署；发布前加密备份 archive 为 `a8e21d39-4e2d-4c4f-9eaa-38fde8382d2e`（50 张表、11713 行、4458216 字节，SHA-256 `84c7dbcff2a4b2b5735be3a797d51793310a05dc2a509b090509097776e5ff97`）。release `2744d76c91d9588623e093b047cfeee87b14b896` 的产物哈希、38 个迁移、容器与域名隔离核验通过；容器预热首次健康检查出现一次 502，自动重试恢复。
- 快照发布：数据发布点加密备份 archive 为 `0c74fdc0-92e0-46ca-9a9e-bfb91b374645`（50 张表、11720 行、4460800 字节，SHA-256 `33faa065f0053534db27257c28a0bbf8a4ea3268fd79fad98ffca4328d99dd07`）。更新后 manifest 经 SSH stdin dry-run 后原子发布为批次 `87ee90fa-464d-45bf-86a4-cd17c2cbf23f`，差异为 added 341、changed/removed/unchanged 0，warnings 0。
- 生产核验：唯一 `published` 批次的清单哈希、2 个来源 SHA-256、341 个条目、359 个联系方式、4488 个别名和 314 个唯一完整号码均与本地一致；短号越界、缺失号码和 `needs_review` 均为 0，`manually_verified` 为 1，发布审计为 1。4 个必需索引齐全；utf8mb4 客户端下中文 ngram“病案”命中 5、全拼与首字母前缀各命中 5，号码/短号前缀探针均命中。
- DIR-03 回归定位：`git log -S`/`git blame` 确认 API 注册序列来自 `8e42afb` 至 `a837586`、群组读取权限矩阵来自 `8e42afb`/`04c7da3`，共享契约出口来自 `5fa3fd` 至 `de3ad5f`；本轮只新增 `viewDirectory`，不改变既有联系方式、成员、日历或访客权限。
- DIR-03 测试先行：共享契约旧实现因缺失模块失败；隔离 MySQL 路由测试在旧 API 上 4/4 返回 404。实现后契约 3/3、真实 MySQL 路由 4/4 通过，覆盖中文、拼音首字母、长短号精确/前缀、独立楼层/科室/类型跳级筛选、稳定游标、成员/管理员可见性以及 guest/跨群/匿名/vkey 拒绝。
- DIR-03 实现：新增 `/groups/:groupId/directory` 与 `/groups/:groupId/directory/facets` 只读接口；只查询唯一 published 快照，号码精确 > 号码前缀 > 原文/别名精确 > 原文/拼音前缀 > 包含/ngram 相关度，按相关度、院区顺序、来源顺序和 UUID 稳定游标翻页。facets 返回院区、片区、楼宇、楼层、科室、下级单元与条目类型的全量计数，前端可从任意层级独立筛选。
- DIR-03 权限与语义审计：当前群组 active owner/administrator/member 和 developer admin 可读；member 只能看到 `visibility=member`，owner/administrator/developer 可见 administrator 条目；guest、非本群成员、匿名和访客链接拒绝。接口无写入、无数据修正、无新迁移，不记录或回显查询号码到日志；短号契约继续硬限制 3–6 位。
- DIR-03 checkpoint：`e74e5f3`（`feat(directory): add secure search API`）已推送并部署；发布前加密备份 archive 为 `7f75f4de-e0cf-45a9-92f2-e001c095863f`（50 张表、17072 行、6864320 字节，SHA-256 `d32b9fdf206e00d1ed7c89a1c59b3c2bc10828ee3fe316d4f4e6bd48f999dd50`）。release `e74e5f35fb60903ae7add919f6f4638d56a9038c` 的产物哈希、38 个迁移、容器与域名隔离核验通过；容器预热首次健康检查一次 502 后自动恢复。
- DIR-03 生产只读核验：正式 API facets 返回 2 个院区/341 条；“病案”模糊搜索 5/5 命中，未选父级的楼层筛选返回 3 条；匿名为 401、访客路径为 404。核验只输出聚合计数，不输出 token、号码或响应正文，临时脚本已删除。
- DIR-04/05 测试先行：旧 Web 新增用例先出现 8 项失败并缺失组件/客户端方法；实现后 API 客户端、导航、展示规则、Storybook 与生产接入定向 5 个文件 18/18 通过。新增共享展示边界再次拒绝超过 6 位短号；固定电话长号可拨、固定电话短号只读，手机号长短号均可拨。
- DIR-04/05 实现：工作台新增“院内通讯录”Tab；手机底栏将其作为四个主入口之一，guest 不可见。生产组件支持 240ms 即时搜索、稳定游标加载、院区/片区/楼宇/楼层/科室/单元/类型七级独立筛选，任何一级均可跳选且面板保持打开；桌面为两列 mega-menu，手机为底部 Sheet。视觉采用现有蓝白令牌与“院区导览带”识别结构，Storybook 直接复用生产组件且只含合成 0 号码。
- 数据与 CSV 复核：本地 9 个 CSV 仍全部为 UTF-8 BOM + CRLF 并以 CRLF 结尾；359 个联系方式的原始/规范短号最大均为 6 位、越界 0。唯一 `manually_verified` 疑似不一致条目有 2 个完整号码、0 个短号，清理说明保留；`needs_review` 为 0。为完整 smoke，本地开发库补执行已提交迁移并发布同一清单 341/359，未把本地数据库或演示状态带入生产。
- 运行/浏览器验证：`pnpm smoke:browser` 包装器仍会要求交互式清理依赖，拒绝该破坏性动作；等价直接入口 `SMOKE_BASE_URL=http://127.0.0.1:5174 node scripts/smoke-browser.mjs` 在当前源码隔离服务通过管理员、成员、访客/vkey 与访问记录全流程，新增通讯录搜索、固定电话短号不可拨、楼层跳级、七级筛选、390px 无横向溢出和 44px 拨号点触均通过，截图目录 `C:\Users\eylin\AppData\Local\Temp\schedule-smoke-aUblEm`。Storybook 390/1280 实测无页面横向溢出，楼层在院区“全部”时可独立选中，固定电话短号链接 0、手机短号链接 1；Web typecheck/build、Storybook build、任务文件 Prettier/ESLint、`git diff --check` 通过。全仓 Vitest 排除用户自有 runtime/小程序副本后为 101 个文件/626 项通过，31 个数据库集成文件/260 项按默认环境跳过，DIR-03 相关集成已单独实跑。
- DIR-04/05 正式发布：checkpoint `8309dce`（`feat(web): launch internal directory workbench`）已推送；发布前加密备份 archive 为 `414f2422-f01f-429d-8f18-d585d21fc038`（50 张表、17277 行、6930440 字节，SHA-256 `efcb6b76a8c30a4435194b233fe00850a616352caf6c595962d304a840b1f3a9`）。release `8309dce1bc59de06089e3f8bafcbcb9b223336aa` 部署成功，产物哈希、38 个迁移、容器、公开端口和未知 Host 拒绝均由 `ecs-verify.sh` 核验通过；容器预热第一次健康检查出现一次 502 后自动恢复。
- 正式域名只读复核：正式 D0796 会话的 390px 工作台已出现“院内通讯录”主入口，页面显示 341 条、首屏 30 条和 7 级筛选，无横向溢出。首屏 `tel:` 链接 30，固定电话短号链接 0，短号越界 0；“病案”搜索返回 5/5，楼层可在院区仍为“全部”时独立选中且筛选 Sheet 保持打开。浏览器 error/warning 为 0；复核只读取聚合状态，未输出真实号码、未保存筛选、未修改业务数据，结束后已恢复排班日历。
- 状态：DIR-01 至 DIR-05 全部完成（含 Web 正式上线与生产核验）→ 待用户复核。代码 checkpoint 为 `8309dce`；最终状态 checkpoint 识别消息为 `docs(status): record directory workbench deployment`。
- 下一批次：无自动活动批次；等待用户在正式网页复核通讯录视觉与交互，或提出后续功能需求。
- 停止条件：最终状态 checkpoint 推送并作为文档 release 部署，Git `HEAD`、`origin/main`、服务器 `current-release` 一致后结束本目标。

## 2026-08-17 手机日历导航触态与滑动圆角分层修复

- 回归来源：月/周导航的 TDesign `week-step`/`month-step` 来自 `8a49434`；移动端月/周底角直接加在日期格背景上的实现来自 `c64f0d7`；拖动时临时移除周格圆角的 `.is-swiping` 规则来自 `acd2507`。均已对关键表达式执行 `git log -S` 与 `git blame`。
- 成熟方案与语义审计：依照 CSS Backgrounds/Overflow 的圆角裁切模型，让固定外层卡片唯一拥有 `overflow: hidden` 圆角，三个滑动面板及格子背景保持方形；蓝色选中框改由独立 `::after` 描边绘制，只有位于卡片底角的描边带圆角。移除拖动中异步切换格子圆角的规则，不修改原生 `overflow-x`/`scroll-snap`、高度插值、月份/周次加载、选择日期、API 或错误路径。
- 按钮触态：月/周四个切换按钮改为自绘 44px 原生按钮；月/周/列表定位按钮共用显式触摸按下态，`touchend`/`touchcancel` 立即清除。取消可能在混合输入/WebView 上形成粘滞状态的 hover 背景，仅保留按住反馈和 `:focus-visible` 键盘焦点，减少动态时不缩放。
- 测试先行：旧代码先出现圆角分层 1 项、导航按钮 1 项失败；CDP 真实触摸又先暴露 `:active` 不稳定和触摸结束后 hover 恢复两项问题，分别补失败断言后修复。最终日历定向 18/18、全仓 Vitest 90 文件/584 项通过，29 个数据库集成文件/253 项按本机默认环境跳过。
- 运行/浏览器验证：Web typecheck/build、Storybook build、全仓 Prettier/ESLint、全仓 Vitest、`node scripts/smoke-browser.mjs`、`node scripts/smoke-browser.mjs --check-core` 与 `git diff --check` 通过；390px 真实 CDP touch 覆盖月/周按钮按下/松开、定位按钮、2026-08 六行至 2026-09 五行半拖动、月/周边角选中描边。无灰色反圆角、无松手残留背景/阴影/缩放/焦点框，管理员、成员、访客 vkey 与访问记录全流程无浏览器错误；最终截图目录 `C:\Users\eylin\AppData\Local\Temp\schedule-smoke-ORNaq6`。`pnpm --config.production=false verify` 在进入脚本前要求删除并重装全部 `node_modules`，已拒绝该破坏性环境动作并以现有本地二进制逐项执行同范围门禁。
- 正式发布：代码 checkpoint `0aaa562`（`fix(web): stabilize mobile calendar controls and corners`）已推送；发布前加密数据库备份 archive 为 `1e04e2cc-4d73-4f85-9033-9227aa676767`（44 张表、11142 行、4,271,268 字节，SHA-256 `1bd1d9e97244c3646f7ff1066ed2bb70aa098f1a66e596dcda10807562278c38`）。release `0aaa5620616cda90dbd863656adb4ac0ae5c8c82` 部署成功，发布前后 `ecs-verify.sh` 均通过；首次域名健康检查在容器预热时出现一次 502，自动重试后全部核验通过。
- 正式域名只读复核：390×844 的月视图和周视图均由 18px 固定外卡统一 `overflow: hidden` 裁切；月历 2026-08-31 左下选中描边和周历 2026-08-17 左下选中描边均一次完整呈现，日期格本体保持直角。月/周左右按钮与定位按钮静止态背景透明、无阴影；未保存配置、修改排班或触发其他业务写入。
- 状态：已完成（含生产发布与线上核验）→ 待用户复核。最终状态 checkpoint 识别消息为 `docs(status): record calendar touch and corner deployment`。
- 下一批次：只提交、推送并部署最终状态 checkpoint，使 Git `HEAD`、`origin/main` 与服务器 `current-release` 一致。
- 停止条件：最终状态 checkpoint 的生产备份、release 部署和 `ecs-verify.sh` 通过后等待用户复核。

## 2026-08-17 手机日历拖动、工作流开关与自定义配色修复

- 回归来源：指针捕获/三面板滑动和原生颜色输入来自 `41d284b`，周历底角来自 `c64f0d7`，换班/加扣班 checkbox 来自 `b20ff9b`、`5d8b205`；均已执行 `git log -S` 与 `git blame`。
- 测试先行：旧实现 4 个定向文件 6 项失败、10 项通过；修复后 16/16 通过。完整 `pnpm verify` 为 89 个文件、582 项通过，29 个数据库集成文件、253 项因本机无隔离测试库跳过。
- 变更与语义审计：延迟的 `lostpointercapture` 只能清理同一 pointer，旧手势释放前先清空状态；周历三面板等高填满，拖动中移除面板自身底角，静止选择框保持原圆角。换班/加扣班四个布尔设置复用 CompactSwitch，原 API、payload、异常路径不变。自定义颜色统一为内嵌 HSV 色域、色相滑杆与 HEX，Storybook 直接复用生产组件；移除原生颜色弹窗，“+”使用 CSS 线段居中。
- 运行/浏览器验证：Web typecheck/build、Storybook build、`pnpm smoke:browser`、`pnpm smoke:check-core`、`pnpm verify` 与 `git diff --check` 通过。Storybook 390px 无横向溢出或原生颜色输入，色域 298×92px，点击可更新 HEX；完整 smoke 覆盖管理员、成员、访客/vkey 与访问记录且无浏览器错误。
- 正式发布：代码 checkpoint `acd2507` 已推送；发布前加密数据库备份 archive 为 `b38a4aea-a518-43c9-ba90-b18cc9d31f58`（44 张表、9970 行，SHA-256 `1bbe706b8667768d279c82753d2ab6576f17f264e4b1521602aa25fa01aef133`）。release `acd25070b084768beede2fe40bf8c5e51d4fa7de` 部署成功，发布前后 `ecs-verify.sh` 均通过。
- 正式域名只读复核：周历三面板均高 48px，当前网格底边与滑动视口底边精确一致，滑动后周次连续且无横向溢出；换班/加扣班各 2 个设置均为 60×44px 点触区、52×30px 开关且无原生 checkbox；配色面板无 `input[type=color]`，内嵌色域 308×92px、页面无横向溢出。浏览器 error/warning 为 0，未切换设置、保存配置或触发业务写入。
- 状态：已完成（含生产发布与线上核验）→ 待用户复核。代码 checkpoint 为 `acd2507`；最终状态 checkpoint 识别消息为 `docs(status): record mobile interaction deployment`。
- 下一批次：只提交、推送并部署最终状态 checkpoint，使 Git `HEAD`、`origin/main` 与服务器 `current-release` 一致。
- 停止条件：最终状态 checkpoint 的生产备份、release 部署和 `ecs-verify.sh` 通过后等待用户复核。

## 2026-08-17 原生触控日历、自适应高度与班种开关局部保存

- 回归来源：JS Pointer Events 滑动、三面板等高轨道来自 `41d284b`；周格内容公式来自 `8a49434`，三面板强制填满来自 `acd2507`；班种保存后整页 `loadConfig()` 来自 `04c7da3`。均已执行 `git log -S` 与 `git blame`。
- 测试先行：新交互断言在旧代码上 5 项失败、5 项通过；实现后日历/班种定向 19/19、Web 全量 53 文件/410 项通过。选择方案遵循 W3C Pointer Events 与 CSS Scroll Snap：手指位移、惯性、方向锁定交给浏览器原生滚动，页面只处理落页与高度插值。
- 变更与语义审计：月/周三页改为 `overflow-x: auto` + `scroll-snap`，移除 pointer capture、`preventDefault` 和 JS transform；月格允许原生横向手势，视口按相邻面板高度实时插值，5/6 行月份在静止时精确贴合当前面板；周格稳定 86px 基线并按内容自然增高。班种启停仍只调用一次原 `PUT shift-type`，成功后用返回值局部更新配置，失败恢复原开关；不再调用 `loadConfig()`，其他新增/编辑/删除保存链不变。
- 运行/浏览器验证：Web typecheck/build、Storybook build、Prettier、ESLint、`node scripts/smoke-browser.mjs --check-core`、`git diff --check` 通过；`node scripts/smoke-browser.mjs` 以真实 CDP touch 事件完成月/周滑动、2026-09 五行高度、周格/底边等高、班种开关不跳位，并通过管理员、成员、访客/vkey/访问记录全流程。最终截图目录：`C:\Users\eylin\AppData\Local\Temp\schedule-smoke-Ob63zl`。
- 全仓验证说明：桌面环境的 `pnpm` 11.9.0 在执行脚本前错误尝试无 TTY 的 `install --production`，故使用等价的本地二进制逐项执行。全仓 Vitest 在全新隔离 MySQL 上暴露既有测试清理顺序问题：`swaps.integration` 通过后，后续测试未清理 `user_auth_identities` 而重复建表；另有既有群组并发断言抖动。本轮未修改 API、迁移或这些测试，未扩大范围修复；本轮相关 Web 410 项全部通过。
- 正式发布：代码 checkpoint `ee63532` 已推送；发布前加密数据库备份 archive 为 `f3b9a899-3c1a-41c1-bd26-075198dce913`（44 张表、10765 行，SHA-256 `baf70c29994b28a7325630f345f5575423936b497a63391c98a56fd5f09179ac`）。release `ee6353263d87fba18fe1d018e5347e44d1d6e2e2` 部署成功，发布前后 `ecs-verify.sh` 均通过。
- 正式域名只读复核：390px 的 2026-09 为 35 格，视口/当前面板高分别为 260/259.7px；原生 `overflow-x: auto`、`scroll-snap: x mandatory` 和 `touch-action: pan-x pan-y` 生效。周历 7 格均为 86px，当前面板/视口均为 86px；排班配置页无横向溢出，6 个班种开关点触区均为 60×44px，浏览器 error/warning 为 0。未切换开关或触发业务写入。
- 状态：已完成（含生产发布与线上核验）→ 待用户复核。最终状态 checkpoint 识别消息为 `docs(status): record native touch calendar deployment`，其发布前加密备份 archive 为 `d94afa5f-0192-4cb1-966a-10660d546143`（44 张表、10775 行，SHA-256 `7660de945feb2c4f3a58d5377b2b06f859a900a8dc85bf0a6b7a13d30bccd55e`）。
- 下一批次：只提交、推送并部署最终状态 checkpoint，使 Git `HEAD`、`origin/main` 与服务器 `current-release` 一致。
- 停止条件：最终状态 checkpoint 的 release 部署和 `ecs-verify.sh` 通过后等待用户复核。

## 2026-08-17 换班班次下拉恢复周几显示

- 回归来源：跨月换班 checkpoint `5a8380f` 新增 `formatSwapAssignmentOption`，把班次下拉从原有“日期 + 班种 + 周X + 成员”改成包含起止时间与岗位的专用文案；已对该函数和原公共 `createAssignmentOption` 执行 `git log -S` 与 `git blame`。
- 测试先行：新增换班表单必须复用公共班次选项且不得保留专用时间文案的回归断言；旧代码 1 项失败、2 项通过，修复后换班/公共选项定向 3 个文件 11/11 通过。
- 变更与语义审计：普通与管理员跨月换班的四组班次选项统一恢复使用 `createAssignmentOption`，显示完整日期、班种、`周X` 与成员；周六、周日继续仅对周几文字应用既有红色样式。移除专用时间文案函数，不修改月份独立状态、候选筛选、预览/提交、API、权限、错误路径或现有换班记录的时间展示。
- 运行/浏览器验证：Web typecheck/build、`pnpm smoke:browser`、`pnpm smoke:check-core`、`pnpm verify` 与 `git diff --check` 通过；完整验证为 88 个测试文件、580 项通过，29 个数据库集成文件、253 项按默认环境跳过，仅保留既有大 chunk warning。浏览器冒烟覆盖管理员、成员、访客 vkey 与访问记录，全流程无浏览器错误。
- 正式发布：代码 checkpoint `afe6a2d` 已推送；发布前加密数据库备份 archive 为 `5a1e925d-a75d-4b68-ad0b-3c246b787d90`（44 张表、9884 行，SHA-256 `56b9232458d5078da0cca8c552a287a301b94a7b41ab145997fbf3f30c1a0bd8`）。release `afe6a2d7531d26553e7cf7ebf1d48cd3af37a447` 部署成功，发布前后 `ecs-verify.sh` 均通过。
- 正式域名只读复核：正式 D0796 会话正常打开换班页、“发起换班”Sheet 及“我的班次”选项层；当前 2026-08 没有可选已发布班次，选项层正确显示“暂无数据”，未制造排班或触发任何业务写入。浏览器 error/warning 为 0，选项有数据分支由定向测试和本地浏览器验证覆盖。
- 状态：已完成（含生产发布与线上核验）→ 待用户复核。代码 checkpoint 为 `afe6a2d`；最终状态 checkpoint 识别消息为 `docs(status): record swap option deployment`。
- 下一批次：只提交、推送并部署最终状态 checkpoint，使 Git `HEAD`、`origin/main` 与服务器 `current-release` 一致。
- 停止条件：最终状态 checkpoint 的生产备份、release 部署和 `ecs-verify.sh` 通过后等待用户复核。

## 本轮已完成

- 工作台移除产品 Logo/“医护排班”招牌、重复介绍、常驻群组码与重复群组标题；顶部改为紧凑群组名称/身份下拉、动态功能标题、通知与同排导出。四位群组码继续只在群组管理显示。
- 月历正式组件对齐 Storybook Mobile Screens 2：保留月/周/列表/筛选、月份切换和手势，使用完整六周、18px 圆角、周末表头及日期红字；选中日期下方继续使用确认的胶囊详情。换班与加扣班复用同一工作台标题位置。
- ICP 页脚改为仅登录页渲染，取消独立横带并透明融入画布；备案链接文案、工信部地址、安全属性、44px 点触和键盘焦点反馈不变。未修改 API、权限、认证、路由、数据库或共享契约。

- 新增统一 `SiteComplianceFooter`，覆盖登录、访客和已认证工作台，移动工作台为固定底部导航预留空间；备案链接具备 44px 点触高度、键盘焦点和安全的新窗口属性。未修改会话、路由、API、权限或业务数据。
- 新增微信要求的根目录认证文件 `1ea9a862b2bec835f8671a1cf10fd8df.txt`；Vite 生产构建会将其复制到站点根目录，正文严格为微信提供的 41 字节认证值。未修改应用逻辑、API、认证、路由、数据库或 Nginx 回退规则。
- 已定位手机下拉框回归：月历筛选由 `7c80488` 引入，换班/加扣班 Sheet 由 `2bb9fce` 引入，原生模态打开行为由 `5b00fa7` 引入；TDesign 默认挂到 `body` 的浮层无法越过模态 top layer。
- 新增共用 popup 挂载策略，并应用到首页手机月历筛选 3 个、换班 7 个、加扣班 4 个 Select；只改变选项层 DOM 容器，不改变选择状态、清空、表单、API 或错误处理语义。
- 新增组件级和源码覆盖回归测试，并扩展浏览器 smoke，实际点击三类问题场景确认下拉内容位于已打开 Sheet 内且可见。
- 已在正式发布前通过完整 `ecs-verify.sh` 并创建加密数据库备份 `48b7e00f-19b3-4577-aefa-dad10a0ad0bd`（44 张表、3701 行）；`af37f5e` 部署成功，服务器业务数据保持原位。

- 发布前确认服务器 `056fc59` 产物与清单完全一致、无手工漂移；本地 `main` 比生产新 18 个 UI 2.0 提交。生产和本地数据库结构均为 36 个迁移、45 张表、467 个字段，因此没有复制密码、联系方式或生产业务数据，也没有用本地演示数据覆盖生产。
- 已生成并部署不可变 release `5ae4941`；部署只执行既有迁移器并重建本项目 API/Web 容器，生产业务数据保持原位。`D0796` 仍为 active，姓名“林恩宇”，在“头颈外科医生”群组中为 active owner，平台/节假日管理员配置继续生效。
- 本轮发布状态 checkpoint 识别消息：`docs(status): record UI 2.0 production deployment`。
- 新增 `POST /auth/password/register` 和 `POST /auth/password/login`，账号格式为 3-64 位字母、数字或 `._-`，密码可自由设置长度但不能为空。
- 新增 `user_password_credentials` 表和迁移 `0036_password_credentials`；不覆盖 `users.wechat_openid` 或现有小程序身份映射。
- 密码使用随机盐 scrypt 哈希；会话使用 `provider=password` 的签名 token，认证端会检查用户 active 状态。
- 生产配置要求 `AUTH_PASSWORD_ENABLED=true`、长度至少 32 的 `WECHAT_SESSION_SECRET`，并继续拒绝 `AUTH_DEV_MODE=true` 与 `WECHAT_MOCK_MODE=true`。
- Web 生产登录页改为账号登录/注册；本地开发构建仍保留仅开发模式可见的 smoke 登录按钮。
- Compose、ECS 核验脚本、迁移计数、部署文档和当前环境模板已同步。
- 用户账号 `D0796` 已确认处于 active 且资料已建立；服务端已授予平台管理员和节假日管理权限，并仅重建 API 容器使配置生效。
- 本轮任务 checkpoint commit：`docs(status): record formal administrator configuration`。
- 已通过单事务完成原群组群主转让：群组 `owner_user_id`、`D0796` 的 `owner` 成员关系和旧账号的历史 `administrator` 关系保持一致；未删除群组、排班或用户数据。
- 群组页面回归修复已完成并部署：增加当前群组/群组码展示、重新生成群组码后的新码提示和浏览器回归断言；代码 checkpoint commit 为 `056fc59`。
- 本轮任务 checkpoint commit：`docs(status): record original group ownership transfer`。
- 发布诊断发现生产既有 `users.id` 使用 `utf8mb4_0900_ai_ci`，新增迁移 0035/0036 原使用 `utf8mb4_unicode_ci`，MySQL 拒绝外键；已将两份新增迁移改为 `utf8mb4_0900_ai_ci`，不涉及删除表或改动既有业务数据。
- checkpoint commit：`de3ad5f feat(auth): add production password authentication`。
- Web UI 2.0 Task UI2-01：安装并隔离 Storybook 10.5.8（Vue 3 + Vite），加入 Docs/A11y、390/320/1280 视口、构建脚本和本地产物忽略规则；预览构建不会再改写生产 `components.d.ts`。
- Web UI 2.0 Task UI2-02：完成四个 Apple Health 式手机预览、密集七列月历、完整姓名与换/加标识、56px 横滑判定、44px 点触目标、底部导航、响应式底部页及蓝色“值班轨道”。测试先行的红灯为缺少 `preview-interactions.js`，实现后 4 项横滑判定通过。
- 本轮 checkpoint 识别消息：`feat(web): add Storybook mobile UI previews`。
- Web UI 2.0 Task UI2-02 反馈精修：姓名取消背景填充；节假日、调休“班”、加/换标识分别复用现有 Web 红/蓝/黄徽标配色；星期六/日表头改为周末红；连续多日节假日单元格使用浅粉背景。新增真实 2026 年 10 月 1–7 日国庆及 10 月 10 日调休 Story，不伪造 8 月节日数据。
- 视觉行为来源已定位到 `b903c6d`，并通过 `git log -S`/`git blame` 确认原姓名背景、节假日文字和蓝色事件标识均由该 Storybook checkpoint 引入。本轮 checkpoint 识别消息：`fix(web): refine Storybook calendar states`。
- Web UI 2.0 Task UI2-03：`@schedule/ui-tokens` 已对齐确认稿的 `#0A66D5` 主色、画布/表面/文字/分隔语义色、4–32px 间距、15px 正文、20/28px 标题、10/14/18px 圆角、阴影、44/50/56px 点触目标、安全区底栏和减少动态令牌；CSS 继续由单一 TypeScript 源生成。Web 已统一映射 TDesign 主题变量，并将现有 `tdesign-icons-vue-next@0.4.7` 声明为直接依赖。本 checkpoint 识别消息：`feat(ui): establish Web UI 2.0 foundations`。
- Web UI 2.0 Task UI2-04：生产登录页、顶部栏、群组上下文、桌面图标侧栏和手机五入口底栏已使用同一令牌体系；“更多”使用桌面对话框/手机底部页共用接口，包含功能分组和账号退出，并支持安全区、44px 点触目标、键盘焦点锁定和减少动态。角色过滤、导航顺序、登录/退出调用链保持不变。本 checkpoint 识别消息：`feat(web): ship responsive application shell`。
- Web UI 2.0 Task UI2-05：生产 `MonthGrid` 新增受控选中日期和 `select-date`，当前月默认今天、其他月份默认首个有班日期或当月 1 日；手机保留七列全月、完整姓名、周末红、红/蓝/黄徽标和连续多日节假日浅粉背景。56px 水平主导手势复用 Storybook 已确认判定，手机筛选收进响应式底部页，桌面直接筛选、月份按钮、年月选择及月/周/列表入口保留。本 checkpoint 识别消息：`feat(web): add touch-first month calendar`。
- Web UI 2.0 Task UI2-06：月历下方新增医疗蓝“值班轨道”，按原时间/岗位顺序显示选中日期、班种、完整人员姓名、岗位、完整时间范围及从现有数据推导的已排班/有变更/待安排状态；确认电话直接拨打、未确认电话复制，事件入口沿用原 shiftId 查询。班次事件从 TDesign Dialog 迁移到桌面对话框/手机底部页共用的 `ResponsiveSheet`，并新增可独立验收的生产组件 Story。本 checkpoint 识别消息：`feat(web): add selected date duty track`。
- Web UI 2.0 Task UI2-07：请假页增加“我的请假/待我审批”手机分段入口，桌面继续并列呈现信息；请假、待审批和已处理列表在 760px 以下变为完整信息卡片，姓名、类型、日期、原因、策略、状态与处理人均保留。新建请假和审批预览统一使用桌面对话框/手机底部页共用的 `ResponsiveSheet`；取消、撤销和驳回继续使用显式操作与确认，不增加滑动删除。本 checkpoint 识别消息：`feat(web): add mobile leave workflow cards`。
- Web UI 2.0 Task UI2-08：换班和加扣班的新建/管理员直办表单统一迁入 `ResponsiveSheet`，桌面为对话框、手机为底部页；五类记录列表在 760px 以下切换为信息完整卡片，状态使用语义徽标，待处理卡片保留明确主操作。拒绝、取消和撤销继续使用原显式按钮及确认流程，不增加滑动删除；成功提交后仅关闭对应 Sheet。本 checkpoint 识别消息：`feat(web): add mobile shift workflow cards`。
- Web UI 2.0 Task UI2-09：成员名单、身份认领申请、事件记录和访客访问记录在 760px 以下改为完整字段卡片；手机成员卡直接保留转正、认领和联系方式等主操作，角色、转让、撤销认领和删除集中到明确的“管理成员”Sheet，所有危险写入继续使用原确认框且无滑动删除。联系方式、同名认领、事件筛选和事件详情统一使用 `ResponsiveSheet`；桌面成员/事件表格和直接筛选保持高密度。本 checkpoint 识别消息：`feat(web): add mobile member and event cards`。
- Web UI 2.0 Task UI2-10：手动排班矩阵增加固定日期表头/人员首列、内部横向滚动、方向与进度提示和不小于 44px 的真实单元格按钮；手机保留姓名和班次完整信息，清空/保存/应用等操作在 320px 下不溢出。排班补录增加当前配班状态、44px 月份/班次/成员/暂存操作和响应式全宽七列月历；暂存移除保持显式按钮，不增加滑动删除。浏览器复核时发现 UI2-05 的空月格会因 `undefined === undefined` 被误判选中，已增加独立回归函数与测试修复。本 checkpoint 为 `1203dc7`（`feat(web): improve dense schedule interactions`）。
- Web UI 2.0 Task UI2-11：统计页改为“值班台账”式汇总，完整保留原 10 项指标与统计口径；成员统计使用内部横向滚动、固定表头/成员首列、方向和进度提示，岗位/班种分解在手机改为单列可读卡片容器，1280/390/320px 均无页面横向溢出。
- Web UI 2.0 Task UI2-12：通知中心和导出迁入共用 `ResponsiveSheet`，手机为全宽贴底页；通知卡按业务类型使用可访问语义徽标，通知设置改为响应式卡片，导出增加实时内容/周期摘要、安全说明及显式取消/导出操作。全部可见操作不小于 44px，原权限、轮询、筛选、API、下载与审计语义不变。本 checkpoint 为 `6ec287d`（`feat(web): polish statistics notifications and exports`）。
- Web UI 2.0 Task UI2-13：群组管理新增四位“群组腕带”、响应式创建/加入/当前操作卡片和焦点锁定危险确认 Sheet；排班配置新增只描述基础配置的三步“排班准备轨道”，班种与岗位编辑在桌面保持高密度、390px 两列、320px 单列，所有真实点触面不小于 44px。原群组与配置 API、权限、参数和写入调用未改。
- Web UI 2.0 Task UI2-14：访客 vkey 月历改为移动端页面内完整七列并提供明确只读/月度状态；缺少或失效链接、群组加载错误和全局空状态统一为可操作状态卡片；离线提示明确为缓存只读且提交暂停，不增加离线写入队列。复用原 vkey、缓存、错误映射与 API 链路。
- 浏览器复核暴露 `ResponsiveSheet` 在异步 `nextTick` 后模板引用可能为 `null` 的既有问题（来源 `5b00fa7`）；冒烟先出现两次 `Cannot read properties of null (reading 'open')`，随后只扩展空引用 no-op 守卫并复跑通过，不改变 Sheet 打开/关闭语义。
- Web UI 2.0 最终全局收尾：`body`、`#app`、应用布局、登录/状态容器与访客页保留 `100vh` 回退并追加 `100dvh`，避免移动浏览器地址栏伸缩导致全屏界面抖动或遮挡；`ResponsiveSheet` 新增显式首尾焦点循环、打开时首项聚焦和关闭后触发器回焦，跨浏览器不再只依赖原生 dialog 的隐式行为。打开/关闭 emit、业务 slot、API、权限和数据链路均未改变。
- Web UI 2.0 完成审计确认原计划全部落地：Storybook + 本地浏览器替代 Figma；令牌/图标/响应式应用框架、密集七列月历与 56px 手势、值班轨道、工作流移动卡片与响应式 Sheet、矩阵/统计内部横滑、群组/配置/访客/离线及错误状态均已由 UI2-01–14 和最终审计覆盖；`WorkbenchNavItem` 强类型图标、`MonthGrid` 选中日期接口、可测试手势函数及共用 `ResponsiveSheet` 已实现；未修改服务端 API、共享契约、权限或数据库。

## 已运行验证

- 工作台紧凑精修：测试先行旧实现 8 项失败/8 项通过，实现后 4 个定向文件 22/22 通过；Web typecheck、Storybook build、`pnpm smoke:browser`、`pnpm smoke:check-core`、`pnpm verify` 与 `git diff --check` 通过。全仓库 74 个测试文件、505 项测试通过，29 个数据库集成文件、252 项因本机无测试 MySQL 跳过。1280×900、390×844、320×844 已核对 68px 紧凑抬头、44px 群组/备案点触、18px 完整六周月历、周末红字、动态功能标题、无横向溢出及 ICP 仅登录页显示。
- ICP 页脚：定向测试先因组件不存在失败，实现后 2/2 通过；Web typecheck、`pnpm smoke:browser`、`pnpm smoke:check-core`、`pnpm verify` 与 `git diff --check` 通过。72 个测试文件、492 项测试通过，29 个数据库集成文件、252 项因本机没有测试 MySQL 跳过。1280×900 登录页与 390×844 登录/访客/已认证工作台均核对唯一备案链接、正确文案和 44px 点触高度；核心链路门禁记录已写入调试日志。生产发布前后 `ecs-verify.sh` 通过，正式桌面/手机登录页及手机访客页的 DOM 均确认备案链接唯一、文案和目标正确、点触高度 44px；认证文件继续精确匹配。
- 微信认证文件：修改前公网 URL 返回 1136 字节应用首页 HTML；新增文件后 Web 生产构建产物为 41 字节且正文精确匹配。`pnpm verify`、`pnpm smoke:check-core` 与 `git diff --check` 通过；71 个测试文件、490 项测试通过，29 个数据库集成文件、252 项因本机没有测试 MySQL 跳过。核心链路校验确认仅新增公共静态文件，无需运行浏览器 smoke。生产发布前后 `ecs-verify.sh` 均通过；公网认证 URL 返回 200、`text/plain`、41 字节且正文精确匹配，生产仍为 36 个迁移。
- 手机 Sheet 下拉框修复：定向测试先因共享挂载策略模块缺失失败，实现后 4/4 通过；Web typecheck 通过。
- 手机 Sheet 下拉框运行/浏览器验证：当前源码隔离 5174 服务下 `pnpm smoke:browser` 通过；390×844/320×844 实际点击首页筛选、换班、加扣班下拉框，管理员、成员、访客与访问记录全流程无错误。首次运行命中 5173 的非开发登录服务，在登录门禁停止，未进入产品断言。
- 手机 Sheet 下拉框全仓库验证：`pnpm verify` 和 `git diff --check` 通过；71 个测试文件、490 项测试通过，29 个数据库集成文件、252 项因本机没有测试 MySQL 跳过，仅保留既有大 chunk warning。
- 手机 Sheet 下拉框生产验证：`ecs-update.sh` 与部署后的 `ecs-verify.sh` 通过；正式 release `af37f5e4ecf5abcc86ac7460361bbfb47ba4c8c4` 的域名/API、产物哈希、容器、未知 Host 拒绝、无开发认证依赖和 36 个迁移均通过。

- `pnpm install --frozen-lockfile`：通过；此前本机生产依赖安装清理了开发依赖，已按锁文件恢复。
- API、Contracts、Database、Web 类型检查：通过（API/Contracts/Database 使用 `tsc`，Web 使用 `vue-tsc`）。
- `pnpm --filter @schedule/api test`：通过，88 个单元测试通过，26 个数据库集成文件因本机没有测试 MySQL 跳过；新增密码哈希/会话测试通过。
- `pnpm verify`：通过；60 个测试文件、447 个测试通过，29 个数据库集成文件因本机没有测试 MySQL 跳过。
- `pnpm smoke:browser`：通过；现有开发管理员、开发成员、访客排班和访客访问记录流程无浏览器错误，本轮登录页变更构建通过。
- `pnpm smoke:check-core`：通过；已在 `docs/debug/debug-feedback-log.md` 记录“运行/浏览器验证：pnpm smoke:browser …”。
- `pnpm --config.production=false --filter @schedule/database test`：通过（本机无测试 MySQL，14 个数据库测试跳过）。
- `bash /tmp/ecs-verify.sh`：通过；release `056fc59` 的正式域名/API、未知 Host 拒绝、共享入口端口、产物哈希、无开发认证依赖、无 `local-admin`/`local-member` 记录、迁移计数 36 均通过。
- 生产管理员配置复核：`D0796` 对应账号为 active、资料已建立；API 容器中的平台管理员/节假日管理员配置均已生效，健康接口返回 200。
- 群组数据复核：原群组的群主为 `D0796`，存在 1 条 active owner 成员关系和 1 条旧账号 administrator 历史关系，原有 2 个排班周期仍在，健康接口返回 200。
- 群组页面验证：旧实现的新增回归断言先失败；修复后 `pnpm smoke:browser`、`pnpm smoke:check-core`、Web 类型检查和 `pnpm verify` 均通过，60 个测试文件、447 个测试通过。
- 正式发布验证：`ecs-update.sh` 成功部署 release `056fc59`；正式 API 健康接口返回 200，使用 `D0796` 服务端身份读取 `/api/groups` 返回原群组、角色 `owner` 和四位群组码。
- 生产负向验收：弱注册请求返回 400、未知账号登录返回 401、`local-admin` Bearer token 返回 401；未创建测试账号。
- 发布过程：首次发布因数据库外键排序规则不兼容自动回滚；修正迁移后 release `c358109` 发布成功，本轮 release `72f1076` 又完成密码策略和登录页文案更新，现网使用 `NODE_ENV=production`、`AUTH_DEV_MODE=false`、`AUTH_PASSWORD_ENABLED=true`。
- 已确认部署产物不再包含旧登录提示或“至少 8 位”文案；一位密码的未知账号请求返回 401 而非长度校验 400。
- `pnpm --filter @schedule/web storybook:build`：通过；Storybook 10.5.8 预览静态构建成功，仅有工具自身的既有大 chunk 提示。
- Storybook 本地浏览器：390×844 四屏、320×844 月历均无页面横向溢出；可见操作无小于 44px 的点触目标；完整姓名无裁切；底栏不遮挡最后一个电话操作；筛选/更多底部页、登录/注册、请假/审批和左滑 8 月→9 月均已实际操作；控制台无 warning/error。
- `pnpm test apps/web/src/stories/ui2/preview-interactions.spec.ts`：通过，4/4；`pnpm --filter @schedule/web typecheck`：通过。
- `pnpm smoke:browser`：通过，覆盖登录、管理员、成员、访客及访客访问记录；`pnpm smoke:check-core`：通过，本轮未涉及核心链路文件。
- `pnpm verify`：通过；格式、lint、全仓库构建、类型检查及测试通过，61 个测试文件、451 个测试通过，29 个数据库集成文件因本机没有测试 MySQL 跳过。
- 月历视觉反馈测试先因缺少 `preview-calendar.js` 失败；实现后周末列、多日节假日、单日标识和调休工作日 4 项判定通过，连同横滑测试共 8/8 通过。
- Storybook 反馈复核：390×844/320×844 下姓名和标识均无裁切、无横向溢出、可见操作不小于 44px；计算样式确认姓名透明背景，红/蓝/黄徽标与现有 Web 一致，国庆连续 7 个单元格均为 `rgb(255, 245, 245)`，星期六/日为周末红；稳定页面控制台无 warning/error。
- 反馈轮次 `pnpm --filter @schedule/web storybook:build`、Web typecheck、`pnpm smoke:browser`、`pnpm smoke:check-core` 和 `pnpm verify` 均通过；全仓库为 62 个测试文件、455 个测试通过，29 个数据库集成文件因本机没有测试 MySQL 跳过。
- UI2-03 测试先行：新令牌、字号/间距/点触尺度及强类型导航图标断言在旧实现上 6 项失败；实现并重建令牌包后，4 个定向测试文件、18 项测试通过。
- UI2-03 验证：令牌生成一致性测试、UI Tokens/Web typecheck、Web 生产构建及扩展后的 `pnpm smoke:browser` 均通过；生产构建仅有既有的大 chunk warning。
- UI2-04 测试先行与定向验证：导航图标断言在旧实现上失败、实现后通过；最终 5 个定向测试文件、23 项测试通过。首次完整验证发现次文字色 `#788492` 的对比度仅 3.81:1，已调整为 `#6B7785`（4.56:1）并重新生成 CSS，无障碍对比度测试通过。
- UI2-04 浏览器验证：`pnpm smoke:browser`、`pnpm smoke:check-core`、Web typecheck、Web 生产构建和 Storybook build 均通过；1280×900、390×844、320×844 下无页面横向溢出或底栏遮挡，桌面侧栏、手机底栏和 Sheet 操作达到 44px，原生 dialog 焦点锁定与账号区退出通过，控制台无 warning/error。
- UI2-04 全仓库验证：`pnpm verify` 通过，格式、lint、构建、类型检查全部通过；62 个测试文件、457 项测试通过，29 个数据库集成文件、252 项测试因本机没有测试 MySQL 跳过；仅保留既有的生产大 chunk warning。
- UI2-05 测试先行：默认日期、跨月首个班次、56px 横滑/垂直取消和多日节假日 4 项测试在旧实现上全部因缺少实现失败；实现后连同既有日历与 Storybook 测试共 5 个文件、31 项通过，格式、lint、Web typecheck、生产 build 和 Storybook build 通过。
- UI2-05 浏览器验证：扩展后的 `pnpm smoke:browser` 通过，实际覆盖 390px 默认今天、点触换选中日期、筛选底部页、左滑换月、垂直移动取消，原管理员/成员/访客流程无错误；手机月历无横向溢出，姓名无截断，筛选操作和固定底栏达到 44px。`pnpm smoke:check-core` 通过；仅有既有的大 chunk warning。
- UI2-06 测试先行：多人班次排序、实际人员优先、电话确认状态、三种可解释状态和中文日期 2 项测试先因缺少详情模型模块失败，实现后 4 个定向测试文件、25 项通过；Web typecheck 和扩展后的浏览器 smoke 通过。
- UI2-06 浏览器验证：390×844 与 320×844 下值班轨道无横向溢出，完整姓名/时间范围无裁切，电话和事件操作均不小于 44px；事件响应式 Sheet 实际打开并加载，固定底栏不遮挡详情，管理员/成员/访客原流程和控制台保持无错误。
- UI2-06 全仓库验证：Storybook build 通过并包含生产值班轨道 Story；`pnpm verify` 通过，格式、lint、全部构建与类型检查通过，64 个测试文件、463 项测试通过，29 个数据库集成文件、252 项测试因本机没有测试 MySQL 跳过。首次组合命令仅因 120 秒外层超时关闭输出管道产生 `EPIPE`，分开以 5 分钟预算重跑后真实退出码为 0；仅有既有的大 chunk warning。
- UI2-07 测试先行：新增请假状态可访问色调与明确驳回确认文案断言，旧实现因缺少两个函数而 1 项失败，实现后请假逻辑 8/8 通过。表单/列表和审批 Dialog 的引入点均定位到 `0d5ec55`，并已用 `git log -S`、`git blame` 核对。
- UI2-07 浏览器验证：扩展后的 `pnpm smoke:browser` 通过；390×844/320×844 实际切换“我的请假/待我审批”，打开新建请假底部页，检查起止日期、无页面横向溢出及关键点触面不小于 44px，管理员/成员/访客原流程与控制台保持无错误。首次尺寸断言识别到 TDesign 内部 22px 文本输入，但其真实可点击外层为 44px，校验已改为测量外层；第二次因跨视口未重置测试分段状态失败，显式恢复“我的请假”后通过，均未用产品代码绕过。
- UI2-07 全仓库验证：Web typecheck、生产 build、Storybook build 和 `pnpm verify` 通过；全仓库 64 个测试文件、464 项测试通过，29 个数据库集成文件、252 项测试因本机无测试 MySQL 跳过。一次并行启动 build/typecheck 在 Vite 完成产物后触发 Windows Node `UV_HANDLE_CLOSING` 退出断言，串行复跑两项真实退出码均为 0；仅保留既有的大 chunk warning。
- UI2-08 测试先行：新增六种换班/加扣班状态的语义色调断言，旧实现因缺少 `getWorkflowStatusTone` 失败；实现后工作流、换班和加扣班 3 个定向测试文件、18 项测试通过。换班表单/列表来源定位到 `b20ff9b`、管理员直办定位到 `6452fa9`；加扣班表单/列表定位到 `5d8b205`，后续可选原因、已受理状态和可撤销归档分别定位到 `cbe2e89`、`de3acab`、`f65a57d`，均已用 `git log -S` 和 `git blame` 核对。
- UI2-08 浏览器验证：扩展后的 `pnpm smoke:browser` 通过；390×844/320×844 实际打开换班、管理员直接换班、发起加扣班和管理员直接代值四个 Sheet，检查移动卡片、无页面横向溢出、关键控件不小于 44px，且动画完成后 Sheet 完整位于可视区；管理员/成员/访客原流程与控制台保持无错误。视觉截图已复核，表单支持内部纵向滚动且底栏不遮挡操作。
- UI2-08 全仓库验证：Web typecheck、生产 build、Storybook build、`pnpm smoke:check-core` 和 `pnpm verify` 通过；全仓库 64 个测试文件、465 项测试通过，29 个数据库集成文件、252 项测试因本机无测试 MySQL 跳过；仅保留既有的大 chunk warning。
- UI2-09 测试先行：新增成员身份状态和认领审批状态语义色调断言，旧实现因缺少 `member-presentation` 模块失败；实现后成员呈现、名单解析和事件时间线 3 个定向测试文件、19 项测试通过。成员/认领表格、同名认领与联系方式入口定位到 `d117bb0`，事件表格/详情定位到 `7ac2a07`，访客记录定位到 `4b33749`，均已用 `git log -S` 和 `git blame` 核对。
- UI2-09 浏览器验证：扩展后的 `pnpm smoke:browser` 通过；390×844/320×844 实际检查成员/认领、事件和访客卡片，打开成员管理、联系方式、事件筛选和事件详情 Sheet；页面无横向溢出，桌面密集操作区在手机隐藏，表单、卡片操作和详情折叠项均不小于 44px，管理员/成员/访客原流程和控制台保持无错误。四组截图已逐屏复核。
- UI2-09 全仓库验证：Web typecheck、生产 build、Storybook build、`pnpm smoke:check-core` 和 `pnpm verify` 通过；全仓库 65 个测试文件、467 项测试通过，29 个数据库集成文件、252 项测试因本机无测试 MySQL 跳过；仅保留既有的大 chunk warning。
- UI2-10 测试先行：手动矩阵滚动状态测试先因缺少 `manual-grid-interactions` 模块失败；空月格选中回归测试先因缺少判定函数失败。实现后月历交互、手动矩阵交互和编辑器逻辑 3 个定向测试文件、19 项测试通过。手动矩阵来源定位到 `6512274`，补录页面及绘制/暂存链路定位到 `927241c`、`000ed93`、`561310c`；空月格误选表达式定位到 UI2-05 的 `7c80488`，均已用 `git log -S` 和 `git blame` 核对。
- UI2-10 浏览器验证：扩展后的 `pnpm smoke:browser` 通过；1280×900、390×844、320×844 实际检查手动矩阵和排班补录，页面无横向溢出、底栏不遮挡操作、矩阵内部可横滑且人员首列位置固定、表头固定、滚动提示随位置更新、单元格点触状态可切换，补录月历保持完整七列和中性空月格；关键控件均不小于 44px。最终使用独立的当前源码 5174 服务完成验证并停止该临时服务；原 5173 外部开发进程未被修改。
- UI2-10 全仓库验证：Web typecheck、生产 build、Storybook build、`pnpm smoke:check-core` 和 `pnpm verify` 通过；全仓库 66 个测试文件、472 项测试通过，29 个数据库集成文件、252 项测试因本机无测试 MySQL 跳过；仅保留既有的大 chunk warning。逐 API/事件调用计数与错误、空值、异步路径审计确认原排班保存、应用、发布、撤回和补录流程未变。
- UI2-11/12 测试先行：统计汇总/滚动提示、通知语义色调和导出选择摘要先在旧实现上因函数缺失而 3 个文件、4 项失败（其余 11 项通过）；实现后 3 个文件、15/15 通过。回归来源已通过 `git log -S`/`git blame` 定位：统计表由 `36127b0` 引入，通知中心/设置由 `52e9e1f` 引入，导出对话框由 `15729f8` 引入。
- UI2-11/12 浏览器验证：`pnpm smoke:browser` 通过；1280×900、390×844、320×844 实际验证统计汇总完整保留 3 项主指标/7 项辅助指标，成员表内部横滑且固定表头/成员首列，滚动提示实时更新；通知设置单列全宽、通知中心和导出均为贴底全宽 Sheet，关键控件不小于 44px，安全说明无覆盖，页面无横向溢出，管理员/成员/访客原流程及控制台无错误。
- UI2-11/12 全仓库验证：Web typecheck、Storybook build、`pnpm smoke:check-core` 和 `pnpm verify` 通过；全仓库 66 个测试文件、476 项测试通过，29 个数据库集成文件、252 项因本机无测试 MySQL 跳过，仅保留既有大 chunk warning。统计、通知设置/列表/轮询与导出的关键 API、定时器和下载调用次数逐项对比 `HEAD` 均相同。
- UI2-13/14 测试先行：群组四位码/角色、配置准备轨道和访客/离线状态 3 个模块先因文件不存在失败；实现后连同 PWA 响应式回归共 4 个文件、10/10 通过。群组、配置、访客与离线来源已用 `git log -S`/`git blame` 定位到 `1b5a17a`、`caf0a8e`、`04c7da3`、`7c783c7`、`4b33749`、`db35a77`。
- UI2-13/14 浏览器验证：`pnpm smoke:browser` 通过；1280×900、390×844、320×844 下群组腕带/卡片、排班准备轨道、班种/岗位编辑、访客状态/vkey 七列月历和离线只读提示均无页面横向溢出，关键点触目标不小于 44px；解散确认 Sheet 实际打开并保持焦点锁定，管理员、成员、访客与访问记录原流程及控制台无错误。最终截图目录为 `C:\Users\eylin\AppData\Local\Temp\schedule-smoke-yhFCbi`。
- UI2-13/14 运行验证：Web typecheck、Storybook build、`pnpm smoke:browser`、`pnpm verify` 和 `git diff --check` 通过；全仓库 69 个测试文件、482 项测试通过，29 个数据库集成文件、252 项因本机无测试 MySQL 跳过，仅保留既有大 chunk warning。首次访客 smoke 超时确认是 5173 旧 Vite 进程提供旧组件，重启明确属于本仓库的前端进程后使用当前源码通过；API 服务和数据未重启或改动。
- 最终全局审计测试先行：新增动态视口断言先因全屏容器只有 `100vh` 失败；浏览器冒烟新增首尾 Tab 断言后先发现 390px “更多”Sheet 焦点逃出，补充组件级断言后旧实现再次失败。实现后 `apps/web/src/pwa/global-ui-shell.spec.ts` 4/4 通过。
- 最终运行/浏览器验证：`pnpm --filter @schedule/web storybook:build`、`pnpm smoke:browser`、`pnpm verify` 与 `git diff --check` 通过；浏览器冒烟覆盖管理员、成员、访客、vkey 和访问记录，并新增 1280/390/320 横向溢出、44px 底栏、2px 键盘焦点、Sheet 双向焦点锁定/回焦和减少动态断言，最终截图目录为 `C:\Users\eylin\AppData\Local\Temp\schedule-smoke-aVpdbz`。全仓库 70 个测试文件、486 项测试通过，29 个数据库集成文件、252 项因本机无测试 MySQL 跳过，仅保留既有大 chunk warning。
- 最终本地浏览器复核：Storybook 390/320px 节假日月历均为七列、无横向溢出或姓名裁切；姓名背景透明，周末红、节假日红底、加/换黄底、调休蓝底及多日节假日浅粉背景计算样式与确认稿一致。生产页 1280/390/320px 无横向溢出，桌面侧栏/手机五入口正确切换，320px 底栏贴底且内容预留 94px；实际 Tab 循环保持在“更多”Sheet 内，关闭后焦点回到“更多”。Storybook 验收服务保留在 `http://127.0.0.1:6006`。
- UI 2.0 发布门禁：`pnpm verify`、串行 `pnpm smoke:browser`、`pnpm smoke:check-core`、`git diff --check`、生产 `ecs-verify.sh` 和公开域名/API 健康检查通过；486 项测试通过，252 项数据库集成测试按本机配置跳过。首次浏览器 smoke 与全仓库构建并行时遇到访客卡片 HMR 瞬时状态，构建结束后在独立 5174 服务串行复跑通过，未改产品代码。
- 正式 D0796 浏览器验收：桌面群组管理、成员、排班配置、事件/访客记录入口和写操作权限均正确呈现；390px/320px 无横向溢出，五个手机底栏按钮高 59px，“更多”底部页贴底且完整位于视口内。未触发任何保存、审批、群组码重置、解散或成员权限写入。

## 下一批次与停止条件

Mobile Screens 2 月历视觉一致性代码、推送、生产备份、部署和正式域名复核均已完成；没有待实施的仓库任务。最终状态 checkpoint 部署后停止，保持 Git `HEAD`、`origin/main` 与服务器 `current-release` 一致。

## 2026-08-16 月历跨午夜业务日修复

- 回归来源：业务日期 helper 由 `7a16c85` 统一，当前月计算由 `927241c` 引入；`CalendarView` 的当前月、今日业务日和默认选中日期调用点已执行 `git log -S` 与 `git blame`。
- 测试先行：先把 00:00 后仍属上一业务日、月初跨月和当前月默认值断言改为期望行为；旧实现定向测试 3 项失败，证明回归测试有效。实现后定向月历/领域三文件 24/24 通过，完整 `pnpm verify` 为 74 passed、29 skipped，506 passed、252 skipped（本机无测试 MySQL）。
- 变更：业务日改以中国标准时间 08:00 全天班交接为边界；00:00–07:59 仍使用上一日/上一月，08:00 切换。自然时间格式化、跨午夜班次范围、API、契约、权限和数据库未改；手动排班及月历 smoke 的默认日期断言同步复用同一边界。
- 浏览器验证：专项月历断言通过（当前环境在 00:xx 时默认选中 `2026-08-15`）；完整 `pnpm smoke:browser` 已通过月历断言，但随后被工作区并发的手动排班横滑固定列/进度提示改动卡住，未将该失败归因于本轮。`pnpm smoke:check-core` 通过，`git diff --check` 待提交前复核。
- 当前工作区复跑 `pnpm verify` 的唯一失败为 `workbench-shell-refinement.spec.ts` 仍匹配旧 `.t-radio-button` 源码，而并发未提交的 `CalendarView.vue` 已改为原生 `.view-mode-button`；本轮日期代码的定向/完整验证已先通过，不修改该用户变更。
- 状态：已完成（含月历专项浏览器验证）→ 待用户复核。checkpoint 识别消息：`fix(web): keep calendar on previous duty date until handover`。

原生产待办仅保留：在微信平台重置已暴露的小程序 AppSecret 后再验收通知功能；这不属于 Web UI 2.0 代码实现缺口。

停止条件：完成本轮 checkpoint 的 production backup、release 部署、`ecs-verify.sh` 和月历专项线上核验，确认 Git `HEAD`、`origin/main` 与服务器 `current-release` 一致；随后等待用户在正式站点跨 00:00 与 08:00 做最终复核。

## 2026-08-16 Mobile Screens 2 月历视觉一致性

- 回归来源：正式月历工具栏与移动月历样式由 `7c80488` 引入，通知入口由 `52e9e1f` 引入并在 `5b00fa7` 形成应用壳触发样式，月格基础结构由 `ab25064` 引入；已对当前模板和样式执行 `git log -S` 与 `git blame`。
- 测试先行：新增独立回归测试后先因 `month-grid-presentation` 不存在而失败；实现后新增测试 4/4、工作台紧凑壳测试 5/5 通过。浏览器 smoke 首先暴露相邻月禁用格被旧选择器误选，收窄到可用当月日期后完整通过。
- 变更：正式页原样采用 Storybook Mobile Screens 2 的 3px 浅灰分段容器、44px/13px 月周列表按钮、44px/13px 筛选按钮和三横线图标；通知入口改为相同 44px、15px 圆角的自绘铃铛及未读红点。手机月历固定 1:1 单元格比例和完整 42 格，补全相邻月份日期并置灰禁用，星期一至日行改为 28px 浅灰填充，周六、日继续红字。
- 语义审计：月/周/列表仍只写入同一 `viewMode` 一次，原 watch、月份/周导航、筛选 Sheet、API、错误处理与日期选择调用不变；相邻月份格仅补充只读展示且不触发选择。通知轮询、未读计数、抽屉和定时器不变，仅把数字徽标视觉替换为与 Storybook 一致的红点，未读数量保留在可访问名称中。
- 运行/浏览器验证：320×844、390×844 和 1280×900 实测无内容横向溢出；390px 月格为 49×49，320px 约 41×41，均为 42 格，前后相邻日期为 07-27 至 09-06。月/周/列表、筛选 Sheet、通知 Sheet 和禁用相邻日期均实际操作通过。Storybook build、Web typecheck、`pnpm smoke:browser`、`pnpm smoke:check-core`、`pnpm verify` 与 `git diff --check` 通过；全仓库 75 个测试文件、510 项测试通过，29 个数据库集成文件、252 项因本机无测试 MySQL 跳过，仅保留既有大 chunk warning。
- 正式发布：代码 checkpoint `abd20d2` 已推送；发布前 `ecs-verify.sh` 通过并创建加密数据库备份 `fa99e3d2-0dbf-472a-8837-3fbde4dfbe2e`（44 张表、5367 行）。release `abd20d2aa94ce3425bff446047db094542aa2466` 部署成功，API/Web 容器、产物哈希、未知 Host 拒绝、无开发认证依赖和迁移检查通过。
- 生产浏览器复核：正式 D0796 会话在 390×844 测得分段容器 50px、按钮 44px/13px、筛选 44px/13px、通知按钮 44px、星期栏 28px、月格 49×49；320×844 月格为 41.14×41.14。两个视口均为完整 42 格、相邻日期 07-27 至 09-06、无内容横向溢出；周末标题及日期计算色为 `rgb(224, 49, 49)`。1280×900 无横向溢出，月/周/列表、筛选和通知 Sheet 均实际操作通过，未触发业务写入。
- 状态：已完成（含生产发布与正式域名复核）→ 待用户复核。代码 checkpoint 为 `abd20d2`；最终状态 checkpoint 识别消息：`docs(status): record mobile calendar parity deployment`。

## 2026-08-16 Mobile Screens 2 星期栏单线回归

- 回归来源：移动 `MonthGrid` 的 1px 网格间隙和边框底色由 `7c80488` 引入，星期栏底边由 `abd20d2` 引入；已执行 `git log -S` 与 `git blame`，确认两者在星期栏与首行之间重复绘制。
- 测试先行：新增“星期栏与月格共用单一分隔面”回归断言；旧实现 5 项中 1 项失败，移除重复底边后日历定向测试 5/5、日历相关测试 31/31 通过。
- 变更：仅移除移动 `.weekday-row` 的 `border-bottom`，保留 `.month-grid` 的 1px `gap` + 分隔色背景；Storybook Mobile Screens 2 参考组件、日期选择、42 格、业务数据、API、权限和事件链路均未改。
- 语义审计：没有模板、事件、响应式状态或调用点变化；分隔线由既有网格背景绘制一次，星期栏与首行间距仍为 1px，选中态 2px 内描边保持不变。
- 运行/浏览器验证：Storybook build、Web typecheck、日历定向测试、`pnpm smoke:check-core`、`pnpm verify` 和 `git diff --check` 通过；本地当前源码 390×844/320×844 实测 42 格、1:1 月格、星期栏底边 `0px`、首行间距 `1px`、无内容横向溢出。完整 `pnpm smoke:browser` 在既有未提交 `GroupSwitcher.vue`/`HomeView.vue` 的 68px 抬头断言处停止，未将该失败归因于本轮。
- 预览：Storybook Mobile Screens 2 保持 390×844 UI2.0 参考效果；本地正式工作台预览截图为 `C:\Users\eylin\AppData\Local\Temp\schedule-calendar-line-preview.png`，Storybook 参考截图为 `C:\Users\eylin\AppData\Local\Temp\schedule-storybook-mobile-screens-2-preview.png`。
- 状态：已完成（含运行验证）→ 待用户复核。checkpoint 识别消息：`fix(web): avoid stacked mobile calendar separators`。
- 正式发布：代码 checkpoint `de69384` 已推送；发布前加密数据库备份 archive 为 `c9785dbd-b267-4cfa-afc4-cb1f9556b57f`（44 张表、5406 行）。release `de69384164c6806e939ec6f9d67355e0d8710170` 部署成功，`ecs-verify.sh` 通过。
- 正式浏览器复核：390×844 月格 49×49、320×844 月格 41.14×41.14；两个视口均为 42 格、星期栏底边 `0px`、首行间距 `1px`、无内容横向溢出。未触发业务写入。

## 下一批次与停止条件

- 下一批次：无待实施仓库任务；等待用户复核 Storybook Mobile Screens 2 与正式工作台的星期栏/首行分隔线视觉。
- 停止条件：代码 checkpoint `de69384` 已推送、备份 `c9785dbd-b267-4cfa-afc4-cb1f9556b57f` 已创建、release `de69384164c6806e939ec6f9d67355e0d8710170` 已部署，`ecs-verify.sh` 与正式域名月历复核通过；等待用户视觉复核后停止。

## 2026-08-16 工作台抬头回退与自绘群组箭头

- 回归来源：旧抬头/原生选择器由 `daff238` 引入；已执行 `git log -S` 与 `git blame`。退出登录仍由 `WorkbenchNav.vue` 的“更多”抽屉承载，未改回顶部。
- 完成内容：恢复群组名在上、工作台在下且左对齐的原布局；保留 owner/administrator 导出门禁；群组控件改为透明背景分体式线条箭头按钮，下方自绘 listbox，不使用原生 `select`。
- 测试与验证：测试先行旧三列实现 6 项失败，修复后正式壳/Storybook 11/11 通过；Web typecheck、`pnpm smoke:browser`（管理员/成员/访客/vkey/访问记录，1280/390/320 无横向溢出）、`git diff --check` 通过。冒烟脚本已同步检查新箭头控件与抽屉退出入口。
- 状态：已完成（含生产发布与线上核验）→ 待用户复核。代码 checkpoint 识别消息：`fix(web): restore stacked workbench header and custom group arrow`。
- 运行验证：Storybook build、Web typecheck、定向测试 11/11、`pnpm smoke:check-core`、`pnpm verify` 和 `git diff --check` 均通过；全仓库 75 个测试文件、511 项测试通过，29 个数据库集成文件、252 项因本机无测试 MySQL 跳过；Storybook 仅保留临时配置下的 addon 解析提示、CSF 解析提示和既有大 chunk warning。
- 正式发布：网络恢复后生成不可变 release `42c342529c8cf1e9b3f125b3ae6b3c2928b33043`；发布前加密数据库备份 archive 为 `5dba4d9d-6a0a-4a2f-98ea-c16d8419859a`（44 张表、5410 行）。`ecs-update.sh` 部署成功，迁移、API/Web 容器重建和 release 写入均通过。
- 正式核验：服务器 `ecs-verify.sh` 退出码 0；正式域名健康、产物哈希、未知 Host/IP 拒绝、公开端口、容器、无退役账号、无 `@cloudbase` 和 36 个迁移均通过。正式 D0796 会话在浏览器实际展开/关闭群组 listbox（2 个选项），抬头、通知、导出均存在，控制台无 error/warning。
- 下一批次：等待用户复核 Storybook 与正式站视觉；最终状态 checkpoint 识别消息：`docs(status): record workbench production deployment`。

## 2026-08-16 月历按需显示周数

- 回归来源：`month-grid-presentation.ts` 在 `abd20d2` 固定生成 42 格/6 行；已用 `git log -S 'Array.from({ length: 42'` 与 `git blame` 定位。详情栈由 `CalendarView.vue` 的 grid gap 和 `SelectedDateDutyDetails.vue` 的 margin-top 共同控制。
- 测试先行：新增 2026 年 9 月 5 行及详情间距回归后，旧实现 2 项失败；实现后日历相关 5 个测试文件 33/33 通过。
- 变更：`buildMonthDisplayGrid` 按首日偏移与当月天数计算 4–6 行完整周；2026 年 9 月渲染 35 格（8 月 31 日至 10 月 4 日），需要 6 行的月份保持原行为。`CalendarView` 增加 `align-content: start`，防止父容器有额外高度时月历轨道被拉伸；桌面 12px grid gap、移动 14px grid gap、详情自身桌面/移动 margin 均未改。API、权限、业务数据、选择/月份切换和详情调用链未改。
- 运行/浏览器验证：`pnpm --filter @schedule/web typecheck`、`pnpm --filter @schedule/web build`、`pnpm --filter @schedule/web storybook:build`、定向 `pnpm exec vitest run ...`（5 文件/33 项）、ESLint、Prettier 和 `git diff --check` 通过。月历专项浏览器验证在 1280×900、390×844、320×844 均通过：9 月 5 行/35 格，无横向溢出；详情间距桌面 32px、移动 26px，8 月与 9 月一致；移动单元格保持 1:1。`pnpm smoke:check-core` 通过并确认未触及核心链路。
- 预览截图：`C:\Users\eylin\AppData\Local\Temp\schedule-month-grid-browser-check\mobile390-september-5-rows.png`、`C:\Users\eylin\AppData\Local\Temp\schedule-month-grid-browser-check\desktop1280-september-5-rows.png`。完整 `pnpm smoke:browser` 另受并发无关的请假 Sheet “完成”按钮小于 44px 断言影响；完整 `pnpm verify` 另受并发新增 `apps/web/src/stories/ui2/calendar-views-refinement-preview.spec.ts` 未格式化影响，未修改这些用户文件。
- 状态：已完成（含月历专项浏览器验证）→ 待用户复核。checkpoint 识别消息：`fix(web): render only required calendar weeks`。
- 决策/阻塞：本轮只允许暂存 `apps/web/src/features/calendar/month-grid-presentation.ts`、`apps/web/src/views/calendar/CalendarView.vue` 和本回归测试；生产部署仍需按仓库规则执行，若 `ecs:package` 或线上发布再次遇到网络/依赖阻塞，保留本地提交并记录阻塞。
- 下一批次：本 checkpoint 的提交、推送、production backup、release 部署、`ecs-verify.sh` 及正式域名 1280/390/320 月历与详情间距复核。
- 停止条件：Git `HEAD`、`origin/main` 与服务器 `current-release` 一致，且正式域名确认 2026 年 9 月为 5 行、详情间距不拉大；随后等待用户最终视觉复核。

## 2026-08-16 群组下拉选项间距回归

- 回归来源：群组自绘下拉菜单由 `3febef0` 引入；本轮对 `GroupSwitcher.vue` 执行 `git log -S 'group-switcher-menu'` 与 `git blame`，确认选项状态背景共用菜单内连续布局，缺少行间距。
- 测试先行：正式工作台与 Storybook 各新增 1 个间距断言；旧样式定向测试为 2 项失败、9 项通过，补充 `display: grid` 与 `gap` 后 2 个文件 11/11 通过。
- 变更与语义审计：正式菜单使用 `var(--ui-spacing-xxs)`、Storybook 使用 4px，为相邻选项状态背景建立可见间隔；选项高度、蓝色状态、`modelValue`/`update:modelValue`、键盘/Esc/Tab/外部关闭、角色权限和抽屉退出入口均未改变。
- 运行/浏览器验证：Web typecheck、定向测试 11/11、任务文件 Prettier 检查、`pnpm smoke:browser`、`pnpm smoke:check-core` 和 `git diff --check` 通过；完整 `pnpm format:check` 仅因既有未跟踪日历测试文件 `apps/web/src/stories/ui2/calendar-views-refinement-preview.spec.ts` 格式不符而失败，未修改该用户文件。冒烟覆盖管理员、成员、访客及访问记录，全流程无浏览器错误。
- Storybook 预览：`GroupMenuOpen390` 刷新后实际计算 `gap/row-gap = 4px`，2 个选项之间已可见分隔，390×844 预览无横向溢出。
- 正式发布：代码 checkpoint `4857e76` 已推送；发布前加密数据库备份 archive `ccdd8bf2-9a7f-4e8d-b1c1-198a95cd6d05`（44 张表、5442 行）；release `4857e76e976e0010d2f52520e23fc73babb88c1e` 已部署。
- 正式核验：服务器 `ecs-verify.sh` 退出码 0；正式 D0796 会话实际测得群组菜单 `gap/row-gap = 4px`，2 个选项高度 62px、顶部相差 66px，Escape 可关闭且无原生 `select`；工作台、通知、导出均存在，浏览器 error/warning 均为空。
- 状态：已完成（含生产发布与线上核验）→ 待用户复核；代码 checkpoint 识别消息：`fix(web): separate group dropdown option states`。

## 2026-08-16 工作台群组名垂直间距精修

- 回归来源：工作台抬头与自绘群组箭头的当前结构由 `3febef0` 引入，旧的 44px 群组内容行由同一轮恢复；已对 `GroupSwitcher.vue`、Storybook 预览和相关断言执行 `git log -S` 与 `git blame`。
- 测试先行：新增正式壳与 Storybook 的紧凑行高、箭头定位和菜单锚点断言；旧实现定向运行 2 项失败、9 项通过。实现后两个回归文件共 11/11 通过。
- 变更：群组名称行不再被 44px 最小高度撑开，右侧自绘箭头改为绝对定位并继续保留 44px 触达区；菜单锚点随视觉行收紧，同时保留箭头触达区下方 8px 视觉间隔。Storybook 预览与正式组件保持同一布局语义。
- 语义审计：仅调整 CSS 布局；`modelValue`/`update:modelValue`、群组持久化、键盘/Esc/Tab/外部关闭、选项间距、角色权限、导出按钮和 `WorkbenchNav` 抽屉退出入口均未改变。
- 运行/浏览器验证：定向测试 11/11、Web typecheck、生产 `pnpm build`、任务文件 Prettier、Storybook build、`pnpm smoke:check-core`、`运行/浏览器验证：pnpm smoke:browser` 和 `git diff --check` 通过。Storybook 390px 实测抬头由 94px 收紧为 70.25px，群组文字行 20.25px，箭头触达区 44px，菜单与箭头底部间距 8.13px；展开/关闭与 listbox 行为正常。
- 发布决策：首次 `ecs:package` 仅打包了已有静态产物，首次线上核验发现仍为旧 44px 群组行；未将其视为最终发布。随后按当前源码运行生产 `pnpm build`，重新生成同一代码 checkpoint 的 release 产物并再次部署。
- 正式发布：代码 checkpoint `e841c53` 已推送；首次部署前备份 archive `7d093557-0f9d-4da5-b60c-4ea2a6bf3c90`，重建后最终部署前备份 archive `056ea6a5-2bf1-4df0-ac6e-a989206f224e`（44 张表、5531 行）；最终 release `e841c53f0462ddf5987cb02266abaaf50e12a501` 部署成功。
- 正式核验：`ecs-verify.sh` 退出码 0。正式 D0796 桌面 1280×720 与移动 390×844 均测得抬头 68px、群组文字行 20.25px、箭头触达区 44px；移动 `scrollWidth = clientWidth = 375px`。下拉为 2 个选项，`gap/row-gap = 4px`，Esc 后关闭，原生 `select` 数量为 0；顶部没有退出登录按钮，通知/导出存在，浏览器日志为空。
- 状态：已完成（含生产发布与线上核验）→ 待用户复核。代码 checkpoint 识别消息：`fix(web): compact group header spacing`；最终状态 checkpoint 识别消息：`docs(status): record compact group header deployment`。

## 2026-08-16 月视图相邻月份日期颜色精修

- 回归来源：相邻月份日期的浅色由 `abd20d2` 引入，周末日期红色由 `4540e13`/`c9a12b8` 引入；已对 `MonthGrid.vue` 与 `Ui2MonthCalendar.vue` 执行 `git log -S` 和 `git blame`，确认周末选择器覆盖了相邻月份的浅色。
- 测试先行：新增实际月历与 Storybook 参考组件的相邻月份颜色断言；旧实现 1 项失败，修复后日历 parity 8/8、定向日历相关 27/27 通过。
- 变更：相邻月份普通日期改为更浅的 `#c2c9d1`，相邻月份周末日期改为同步变浅的 `#ef9f9f`；桌面、移动端和 `invert-past-colors` 分支保持一致。当月普通/周末日期、背景、详情、选择和业务数据均未改。
- 运行/浏览器验证：Web typecheck、build、Storybook build、ESLint、Prettier、`pnpm smoke:check-core`、`pnpm verify`（76 个测试文件/521 项通过，29 个数据库集成文件/252 项按环境跳过）和 `git diff --check` 通过。390×844 与 1280×900 实测普通相邻日期 `rgb(194, 201, 209)`、相邻周末 `rgb(239, 159, 159)`，当月颜色保持原值且无横向溢出。
- 正式发布：代码 checkpoint `7b230e4` 已推送；发布前加密数据库备份 archive 为 `70a03bdc-ca33-4f0e-a292-91de3b29d8e5`（44 张表、5605 行）；release `7b230e4c2eea20c6ccafb47cbc89f08f1e567c83` 部署成功。
- 正式核验：`ecs-verify.sh` 退出码 0；正式 D0796 会话在 1280×900 与 390×844 测得普通相邻日期 `rgb(194, 201, 209)`、相邻周末 `rgb(239, 159, 159)`，当月颜色保持原值、无横向溢出，浏览器 error/warning 为空。
- 状态：已完成（含生产发布与线上核验）→ 待用户复核。代码 checkpoint 识别消息：`fix(web): lighten adjacent-month calendar dates`。
- 下一批次：提交并推送最终状态 checkpoint `docs(status): record adjacent-month color deployment`，将同一 `HEAD` 作为最终 release 部署。
- 停止条件：最终状态 checkpoint 已推送，生产备份、release、`ecs-verify.sh` 与正式域名颜色复核全部通过；随后等待用户视觉复核。

## 2026-08-16 连续周视图、列表一致性与微信移动满宽修复（当前批次）

- 已实现：周视图以周一至周日连续推进，不再绑定单月；跨月标题显示如“7月第5周-8月第1周”，下一周连续为“8月第2周”。跨月周同时读取所涉及月份的排班数据，合并后仍使用原只读日历模型、筛选和事件入口。
- 周视图与月视图共用圆角日历表面：导航、星期栏和七列日期格使用单线分隔；七格按最长当天的排班/节假日内容统一动态高度。姓名置于上层，班种与换/加标识置于下层；班种标签单行、固定紧凑内边距并截断为两个 Unicode 字符；电话继续放在点击日期后的详情轨道，避免七列内重叠。
- 列表视图已对齐 Storybook 手机模板：固定月份工具栏、前后月份和定位今天、排序提示、圆角日卡、今天浅蓝选中态、班次数量、完整班种/时间/岗位、换加标识与薄荷色电话入口均进入正式组件。
- 微信移动布局修复：请假、换班、加扣班与成员标题区域在 760px 以下使用明确的 `minmax(0, 1fr)` 单列轨道，说明与操作占满可用宽度；群组码在 360px 以下按固定数字块和 4px 间距向左聚合。未改表单提交、审批、权限、API、路由、数据库或共享契约。
- 回归与浏览器验证：测试先行旧实现共出现 10 项日历/连续周失败，移动轨道追加断言后旧 CSS 再出现 2 项失败；实现后定向 4 文件 27/27、工作台壳 5/5、Web typecheck、生产 Web build、Storybook build、Prettier、ESLint、全仓 Vitest 78 文件/533 项通过（29 个数据库集成文件/252 项按本机无测试 MySQL 跳过）、`git diff --check` 通过。`pnpm smoke:browser` 的 pnpm 包装器因本机非 TTY 依赖目录状态检查停止，使用同一脚本入口 `node scripts/smoke-browser.mjs` 在独立 5174 当前源码服务复跑通过，覆盖管理员、成员、访客、vkey 与访问记录且无浏览器错误。
- 390/320 实测：周视图七格等高、无横向滚动，`全天` 为 20px 宽单行标签；跨月标题及下一周编号连续。Storybook 周切换也已改用真实日期并取消前后各一周限制，实测从“7月第5周-8月第1周”进入“8月第2周”，周六/日不再伪造“休息”标识。请假/换班/加扣班说明与操作宽度均等于 351px 内容区，成员标题三处均为满宽单列；320px 群组码为 40px 数字块、4px 间距、左聚合。生产列表源码预览和 Storybook 模板均为 349–351px 全宽卡片及固定工具栏。
- 行为审计：跨月周由一次单月 GET 扩展为对触及月份各一次 GET 并只合并 assignments；最新请求追踪、错误处理、节假日降级、筛选、选中日期、电话和事件调用次数保持原语义。周切换不再写入月视图的 `businessMonth`，月/列表月份状态因此独立保留；所有移动满宽修改均为 CSS。
- 代码 checkpoint `a1a732a`（`fix(web): unify continuous calendar and mobile layouts`）已推送至 `origin/main`；发布前加密数据库备份 archive 为 `a238d4aa-4332-4f1a-83bf-74c18b8dc60c`（44 张表、6147 行，SHA-256 `5b5f61deef804ec99a64d4d53f0bef18ecda7deae10e75f7fe3cf49c5778ef2e`）。release `a1a732a8d675ba759b27b96a7986294b7498327f` 部署成功，`ecs-verify.sh` 退出码 0。
- 正式域名专项复核：390px 跨月标题为“7月第5周-8月第1周”，右切为“8月第2周”；周网格 `scrollWidth = clientWidth = 364px`、七格同为 86px 高，`全天` 标签保持 20px 单行。列表固定工具栏、31 张日期卡及今天选中态正确；请假说明/按钮、换班与加扣班操作、成员标题均占满 351px 内容区。320px 群组码按 40px 数字块、4px 间距向左聚合，无元素越出视口；未触发业务写入。
- 状态：已完成（含生产发布与线上核验）→ 待用户复核。下一批次只提交并推送最终状态 checkpoint `docs(status): record continuous calendar deployment`，再将该 `HEAD` 作为最终 release 部署。
- 停止条件：最终状态 checkpoint 已推送，第二次生产备份、release、`ecs-verify.sh` 通过，Git `HEAD`、`origin/main` 与服务器 `current-release` 一致；随后等待用户视觉复核。

## 2026-08-16 日历圆角选中框与周视图今天状态修复（当前批次）

- 回归来源：移动月历方形日期格与外层圆角裁切由 `7c80488` 引入；周视图整格“今天”描边由 `a1a732a` 引入，Storybook 对应整格今天背景来自 `8a49434`、描边来自 `a1a732a`。已对相关选择器执行 `git log -S` 与 `git blame`。
- 测试先行：新增月视图末行左右角继承圆角、周视图左右角继承圆角及“今天仅使用日期圆点、不保留整格蓝框”断言；旧实现 3 个文件中 3 项失败、21 项通过，修复后 24/24 通过。
- 变更：月视图仅让末行首/尾日期格继承外层底部圆角；周视图仅让周一/周日格继承外层底部圆角，使 2px 内描边沿容器曲线完整收口。周视图移除未选中今天的整格蓝色描边，保留黄色日期圆点和 `aria-current="date"`；被选中日期仍是唯一蓝色整格框。Storybook 参考页同步相同视觉规则。
- 语义审计：只修改 CSS 与源码回归断言；日期点击、`selectedDate`、`aria-pressed`、`aria-current`、周切换、详情、API、异步/错误路径、空值、权限和调用次数均未改变。
- 运行/浏览器验证：`pnpm smoke:browser` 通过管理员、成员、访客、vkey 与访问记录全流程且无浏览器错误；Storybook build、Web typecheck/build、任务文件 Prettier/ESLint、全仓 Vitest（79 passed/29 skipped；537 passed/253 skipped）及任务文件 `git diff --check` 通过。完整 `pnpm verify` 仅被并发中的无关 `group-service.ts`/`membership-service.ts` 格式问题拦截；`pnpm smoke:check-core` 仅因无关未提交 `packages/contracts/src/groups.ts` 触发核心门禁，本轮未修改核心链路文件。
- 390px/320px 实测：月视图选择 8 月 31 日时左下角蓝框完整贴合圆角；周视图选择 14 日后，16 日只保留黄色今天圆点且 `aria-current=date`，不再有第二个蓝框；选择周日 16 日时右下角蓝框完整贴合圆角。两个视口均无横向溢出。
- 正式发布：代码 checkpoint `c64f0d7` 已推送；发布前加密数据库备份 archive 为 `c2412550-9ae2-463f-8d1f-a488a7d9abb0`（44 张表、6218 行，SHA-256 `64b87157384612ac5029c86aba06bf59ac53bd92a4ff4293482e95bdd03c1472`）。为隔离并发中的无关工作区改动，release 从 `c64f0d7` 的干净临时 worktree 构建；`c64f0d7f166adc61f0a6f9470f09519175c718e6` 部署成功，`ecs-verify.sh` 退出码 0。
- 正式域名复核：390px 月视图选择 8 月 31 日时左下描边完整；周视图选择 14 日后，今天 16 日为 `aria-current=date`、`aria-pressed=false`，只保留黄色日期圆点；选择 16 日后右下描边完整。320px 同样确认 14 日为唯一 `aria-pressed=true`、16 日为今天但未选中。未触发任何业务写入。
- 状态：已完成（含生产发布与线上核验）→ 待用户复核。下一批次仅提交并推送最终状态 checkpoint `docs(status): record rounded calendar selection deployment`，再将该 `HEAD` 作为最终 release 部署。
- 停止条件：最终状态 checkpoint 已推送，第二次生产备份、release 与 `ecs-verify.sh` 通过，Git `HEAD`、`origin/main` 和服务器 `current-release` 一致；保留所有并发中的无关群组/平台管理员/迁移改动且不纳入本 checkpoint。

## 2026-08-16 群组后台管理与导出修复（当前批次）

- Git 入口确认：`ed96bde` 已推送，工作区开始时干净；前序日历批次与 `main`/`origin/main` 一致。本批次只处理用户确认的导出、后台 admin、群组码和成员资料流程。
- Task 1 已完成：`git log -S 'export-jobs' -- infra/scripts/schedule-notifications.sh` 与 `git blame` 确认每分钟生产任务脚本自 `eab3ff2` 引入时只运行提醒/通知，遗漏了既有 `ExportJobProcessor`。脚本现先运行 `export-jobs`，仍复用 `flock` 与任一任务失败即非零退出的语义。
- 测试先行：新增 `infra/scripts/schedule-notifications.spec.ts`，旧脚本断言失败；实现后使用本地 Vitest 入口运行 1/1 通过，`git diff --check` 通过。`pnpm exec` 因非 TTY 的依赖目录保护停止，未修改依赖；后续完整验证使用可用的直接 Vitest 入口或记录环境阻塞。
- 本 checkpoint 提交信息：`fix(exports): schedule pending export processing`。提交前已逐行审阅脚本：唯一行为变化为每分钟额外领取并完成最多 10 个 pending 导出任务，导出、提醒和通知任一失败仍使脚本返回非零。
- 下一批次：Task 2（developer admin 数据迁移、隐藏成员关系与全局权限）和 Task 3（手动群组码、成员资料/认领界面与权限收紧）。
- 停止条件：两个后续 task 分别完成定向与完整验证、显式提交推送、生产数据库备份、部署、`ecs-verify.sh` 和正式域名复核；不得暂存无关日历文件。

## 2026-08-16 群组后台管理与导出修复（Task 2–3）

- 引入点：已对群组随机码、成员认领界面和电话确认权限执行 `git log -S`/`git blame`；分别确认来源为 `1b5a17a`、`d117bb0`、`8e42afb`。Task 1 导出调度遗漏来源为 `eab3ff2`，已由 checkpoint `a45aa84` 修复并部署。
- 已实现：新增第 37 个迁移，以预计算 scrypt 哈希创建隐藏 developer admin，补齐所有现有及新群组的 `administrator` 成员关系；统一权限层、群组恢复/删除/所有者操作和平台后台均识别该账号。成员、联系人与排班候选结果隐藏该账号；其会话可切换所有群组并拥有最高业务权限。
- 已实现：群组创建/修改均要求唯一四位手填码，删除随机生成与重生入口。普通界面只显示本人不可编辑姓名、可编辑长短号，以及姓名目录；姓名、他人电话、电话确认和历史认领均只允许 developer admin。普通端认领/同名检测/撤销/确认入口已移除；同名预设成员只会在输入群组码加入时自动关联，未知用户被拒绝。
- 回归验证：定向 Vitest 156 项通过；临时隔离 MySQL 中空库第 37 版迁移及重复迁移通过，手动码/预设绑定、developer admin 隐藏且全群访问、admin 专属历史认领、普通用户改名拒绝均通过。`pnpm verify` 通过（79 个文件/537 项通过，29 个数据库集成文件/251 项按环境跳过）；`pnpm smoke:check-core` 与 `git diff --check` 通过。
- 运行/浏览器验证：`pnpm smoke:browser` 通过；覆盖本地管理员、普通成员、访客/vkey 及访问记录，群组码编辑、普通成员目录与联系方式触控区均复核，无浏览器错误。
- 行为审计：权限绕过只在数据库 `is_developer_admin` 为 1 的已激活账号上生效，未伪造群主角色；普通电话改动会清除确认状态，admin 可显式设置确认状态；admin 姓名修改写入全局 profile，因此同账号跨群同步。无关日历文件未暂存或修改。
- 正式发布：代码 checkpoint `394b1c8` 已推送并部署；发布前加密数据库备份 archive 为 `51bdbfac-39b5-49e4-b203-0ee00d14496b`（44 张表、6226 行，SHA-256 `78554db354b61431b180b1d024f81b40fb4e6928693fd535f89b7c3e64279754`）。生产 release `394b1c87deb42f344b2638d2c7e9b9cd144b8a74` 迁移至第 37 版，`ecs-verify.sh` 通过。
- 正式域名核验：以后台账号登录后平台权限为真、可见全部 2 个群组且均带 developer 标识；抽样群组成员/联系人接口各返回 7 项，均不包含隐藏后台账号。执行一次非破坏性 `2026-08` CSV 导出，任务由 `pending` 成功变为 `completed`，下载返回 1551 字节 CSV。为避免在生产创建测试身份，普通账号边界以隔离 MySQL API 集成测试和本地浏览器 smoke 覆盖。
- 状态：已完成（含生产发布与线上核验）→ 待用户复核。下一批次：无，等待新的用户需求；停止条件为本状态 checkpoint 推送、部署并使 Git `HEAD`、`origin/main` 与服务器 `current-release` 一致。

## 2026-08-16 成员通讯录与通知开关落地（当前批次）

- 批次范围：用户已确认 Storybook 的 Apple 通讯录式成员页与通知设置行；本批次只落地成员目录/联系方式权限和通知开关视觉，不处理导出、日历交互、列表定位或跨月换班。
- 回归来源：`394b1c8` 将联系人读取收窄为本人并把管理/确认限制为 developer admin，同时引入普通成员姓名目录；常驻本人联系方式表单来自 `23c1d9f`，通知开关 44px 本体高度来自 `6ec287d`。均已执行 `git log -S` 与 `git blame`。测试夹具遗漏认证表清理由迁移 `12e7f40` 后显现，旧清理函数来自 `da042b54`。
- 后端匹配：`GET /groups/:groupId/contacts` 向同群 active owner/administrator/member 返回完整有效成员通讯录，继续排除 guest、停用/删除和隐藏后台账号，跨群访问保持 403。普通成员仅能修改本人且不能确认；群主、群管理员、后台管理员均可修改并确认任意有效成员。无新表、字段、迁移或契约。
- 前端落地：成员页统一为“我的资料”浅蓝卡和科室通讯录列表，姓名/角色/长号/短号完整展示，空值为“未填写”，待认领名单不可编辑；本人和有权限管理员通过“修改”打开 `ResponsiveSheet`，成功后关闭、刷新并反馈，失败仍由表单保留内容。姓名、角色、认领、删除、转让继续使用原权限/确认流程。通知设置改为完整设置行，60×44px 外层承载点触面积，TDesign 开关本体保持 52px 紧凑比例；通知 API、订阅与权限申请时机未改。
- 测试先行与验证：旧后端 2 项失败/5 项通过、旧 UI 4 项失败/1 项通过；实现后成员/通知定向 14/14、Storybook 预览 6/6、隔离 MySQL 群组相关集成 13/13 通过。Web typecheck/build、Storybook build、`pnpm smoke:browser`、`pnpm smoke:check-core`、`pnpm verify` 和 `git diff --check` 通过；全仓 83 个文件/548 项通过，29 个数据库集成文件/252 项在全仓命令中按环境跳过，任务相关集成已另用隔离 MySQL 实跑。
- 运行/浏览器验证：1280×900、390×844、320×844 下成员/通知页面无横向溢出，后台管理员有他人修改入口、普通成员仅有本人修改入口，编辑 Sheet 真实打开；通知外层点触区不小于 60×44px且开关本体低于 44px。完整 smoke 覆盖管理员、成员、访客/vkey、访问记录且无浏览器错误，截图目录 `C:\Users\eylin\AppData\Local\Temp\schedule-smoke-H6ZvoG`。Storybook QA 截图另存于 `C:\Users\eylin\.codex\visualizations\2026\08\16\01a00a56-69ce-7211-8331-c55672d96097`。
- 行为审计：权限判断在前端与后端均为 owner/administrator/developer，普通成员本人写入保持原调用；保存成功只新增关闭 Sheet 和重新读取目录，失败分支与请求次数不变。通知偏好关闭、权限拒绝、订阅与重新注册仍复用原函数，未在加载时申请权限。checkpoint 识别消息：`feat(groups): publish member contact directory`。
- 正式发布与只读复核：主 checkpoint `6183e9d` 部署前备份 `0ebc4723-ac13-429b-ab62-56c003b99196`（44 张表、6916 行）；复核发现确认 checkbox 仍写旧文案“后台确认联系方式”，已测试先行改为中性“确认联系方式”，后续 checkpoint `f9d0889` 推送并以备份 `55cb9743-5f8f-4f1e-a70d-9028f0519d6f`（44 张表、6951 行）保护后部署。release `f9d0889d194a39265f3efb9f8591d44601e00c08` 的 `ecs-verify.sh` 通过；正式 D0796 群主页在 1280/390/320 下无横向溢出，本人卡无常驻输入框且只有“修改”入口，Sheet 显示“确认联系方式”且无旧文案。通知点触区三档均为 60×44px、开关本体 52×20px，浏览器 error/warning 为 0，未保存联系方式或切换通知权限。最终状态 checkpoint 识别消息：`docs(status): record member directory deployment`。
- 下一批次：第三批共 3 项——导出 Sheet/任务下载修复、月周日期格姓名与加换标识改为只读、列表“定位今天”平滑定位与筛选缺失提示。
- 停止条件：当前 checkpoint 显式提交并推送，生产加密数据库备份完成，release 部署、`ecs-verify.sh` 与正式域名成员/通知只读专项复核通过；随后停止，不提前进入跨月换班批次。

### 用户截图后的视觉一致性修正

- 人工复核确认生产通知开关实际为 52×20px，而确认稿为 52×30px；成员页还保留确认稿外的重复“成员”标题/人数、常驻添加预设成员表单和重复说明。`git log -S`/`git blame` 已定位：通知宽度来源 `6ec287d`、44px 外层来源 `6183e9d`；常驻名单表单与重复标题来源 `23c1d9f`/`394b1c8`，手机本人修改按钮被放回首行来源 `6183e9d`。
- 按用户补充许可弃用局部 TDesign：浏览器通知使用原生 `role=switch` 按钮，自绘 52×30px 轨道和 24px 圆点，60×44px 点触面独立保留；权限申请、订阅、偏好保存和重新注册函数未改。成员目录的修改/管理/添加按钮及联系方式编辑表单改为确认稿同款原生控件；重复标题/人数/说明已移除，添加预设成员收进次级 `ResponsiveSheet`，保存成功才关闭；权限、API、危险确认和成员管理流程不变。
- 测试先行：旧实现新增 2 项失败，实现后成员/通知定向 6/6 通过。`pnpm verify` 通过（83 个文件/549 项，29 个数据库集成文件/252 项按全仓环境跳过），Web typecheck/build、Storybook build、`pnpm smoke:browser`、`pnpm smoke:check-core`、Prettier、ESLint 与 `git diff --check` 通过；任务相关 `group-permissions.integration.test.ts` 7/7 实跑通过。`group-routes.integration.test.ts` 的既有独立并发建群用例两次为 9/10（竞争胜者为 administrator 而断言固定 owner），其余 9 项通过，与本轮纯前端改动无调用关系，未顺手修改。
- 本地浏览器 390×844 / 320×844 实测无横向溢出；成员页只有一个“成员”标题、无常驻名单表单，本人修改按钮分别为 321×44px / 267×44px，320px 管理次操作隐藏且联系方式左缩进归零。通知轨道为 52×30px、圆点 24×24px、点触面 60×44px，并具备键盘焦点和 `aria-checked`。本 checkpoint 识别消息：`fix(web): match approved member and notification previews`。
- 正式发布：代码 checkpoint `5102950` 已推送；发布前加密数据库备份 archive 为 `d76f2d8e-463e-4fdc-b15f-4f47b4050d7f`（44 张表、7034 行，SHA-256 `7d05c9fa64a64a9fac73dc9487a2f95844e6a1fd62339284606539c51aeff04b`）。release `5102950af3a1b39aabf9c5152fcf946660fabf10` 部署成功，`ecs-verify.sh` 退出码 0。
- 正式域名只读复核：D0796 会话在 1280×900、390×844、320×844 下确认成员页仅一个标题、无常驻名单表单、添加成员为次级入口；本人修改按钮在 390/320 下为 337×44px / 267×44px，三档均未越出视口。通知轨道三档均为 52×30px、圆点 24×24px、点触面 60×44px，`role=switch`/`aria-checked` 正确；未点击开关、未保存联系方式或触发其他业务写入。
- 下一批次仍为第三批：导出 Sheet/任务下载修复、月周日期格交互只读、列表“定位今天”平滑定位。停止条件：本视觉修正 checkpoint 推送，生产备份、release、`ecs-verify.sh` 与正式域名 1280/390/320 专项复核全部通过后停止，不提前进入第三批。

## 2026-08-16 导出、日期格与列表定位修复（当前批次）

- 批次范围：仅处理第三批 3 项——导出 Sheet/异步任务/下载兜底、月周日期格姓名与加换标识只读、列表“定位今天”平滑定位及筛选缺失提示；不提前进入跨月换班。
- 回归来源：`git log -S`/`git blame` 确认导出成员从岗位反推、60 秒轮询和下载 URL 立即释放均来自 `15729f8`；事件标识按钮来自 `7ac2a07`，姓名电话入口来自 `a3b14fb`，列表电话/事件模式来自 `8a49434`；列表定位原先只更新月份来自 `ab25064`/`8a49434`。导出集成测试的旧清理函数来自 `15729f8`，认证表由 `394b1c8` 后续加入。
- 导出修复：两个 `t-select` 均接入 `responsiveSheetPopupProps`；成员选项独立读取有效群组成员，不再依赖已排班岗位。任务状态明确区分创建、等待、可下载、90 秒超时和失败；超时保留任务 ID并提供“继续检查”，不会重复创建。完成后自动下载并保留“下载 CSV”兜底链接，Blob URL 仅在重新导出或卸载时释放；卸载与在途完成竞态会返回 cancelled，不再写入已卸载组件。
- 日历修复：月/周日期格姓名和加换标识均为只读展示，点击日期格仍选择日期；列表与下方详情继续保留明确电话和“事件记录”按钮。列表日期卡加入稳定业务日期锚点；同月或跨月加载后将今天平滑定位到固定工具栏下、视口约上方三分之一，减少动态时即时跳转；筛选隐藏今天时显示“当前筛选下今天没有排班”。
- 后端匹配：导出 API 的同群权限、岗位/成员过滤、pending/running/completed/failed 状态、审计、15 分钟有效期和生产每分钟 worker 均已支持，本批次未修改生产 API、契约、数据库或 worker。仅补齐导出集成测试对既有认证表的清理；导出集成 5/5、群组成员目录目标用例 1/1 实跑通过。
- 测试先行：旧实现定向测试 9 项失败/16 项通过，修复后相关前端 25/25；浏览器检查发现月格仍残留电话提示后，新增断言先失败再修复；卸载竞态新增测试先暴露 finished/cancelled 差异，修复后导出逻辑与源码回归 10/10。
- 运行/浏览器验证：Web typecheck/build、Storybook build、`pnpm smoke:browser`、`pnpm smoke:check-core`、`pnpm verify`、Prettier 与 `git diff --check` 通过；全仓 84 个文件/559 项通过，29 个数据库集成文件/252 项按默认环境跳过，任务相关数据库集成已另行实跑。完整注入测试库的全仓 verify 仍暴露既有重复认证表清理和群组并发建群胜者断言，不属于本批次；本批次相关用例均通过。
- 浏览器专项：导出两个下拉均在 Sheet 内可点击；本地真实任务先达到 90 秒超时、再由现有 worker 完成，同一任务“继续检查”后出现下载兜底。月/周姓名与标识无按钮语义，列表电话和事件入口保留。列表定位前今天卡顶部约 2160px，定位后约 305px、固定工具栏底部约 86px；筛选隐藏今天时显示准确提示且不误定位。
- 行为审计：导出只新增成员目录读取和显式状态机；同一任务继续轮询不会重复创建，Blob URL 生命周期与组件一致。月/周移除的仅是姓名/标识弹层入口；列表和下方详情的显式入口及调用次数保持。定位跨月只等待目标月现有请求完成后滚动，不更改筛选、日期选择、API 或业务数据。
- 正式发布：代码 checkpoint `3861190` 已推送；发布前加密数据库备份 archive 为 `df900c60-09e7-4bda-a742-c83415996997`（44 张表、7159 行，SHA-256 `b97267164d726cd0a2c89e13292725d714486fb3c690dc26edbb3227ffab4826`）。release `3861190220c7ba9e4f0bf2a38e7926812e58d96c` 部署成功，`ecs-verify.sh` 退出码 0。
- 正式域名专项：群组没有岗位配置时岗位下拉正确显示“暂无数据”，成员下拉仍独立列出有效成员；实际创建一次 2026-08 CSV，明确等待状态后约 30 秒完成，页面保留 Blob“下载 CSV”链接。列表视图在本月无已发布排班时点击定位显示“当前筛选下今天没有排班”，未误定位；控制台无 error/warning。该正式群组本月无排班，月/周姓名与标识的数据态由本地真实数据浏览器检查、生产同一构建和回归测试覆盖。
- 状态：已完成（含生产发布与线上核验）→ 待最终状态 checkpoint。代码 checkpoint 识别消息：`fix(web): repair exports and calendar interactions`；最终状态 checkpoint 识别消息：`docs(status): record export and calendar deployment`。
- 下一批次：第四批仅处理普通换班与管理员直接换班的双方独立月份、跨月班次加载和冲突/版本回归。
- 停止条件：最终状态 checkpoint 显式提交并推送，第二次生产加密数据库备份、release 部署与 `ecs-verify.sh` 通过，使 Git `HEAD`、`origin/main` 和服务器 `current-release` 一致；随后停止，不提前实施跨月换班。

## 2026-08-16 跨月换班（当前批次）

- 批次范围：仅处理第四批 1 项——普通换班与管理员直接换班的双方独立月份、跨月班次加载，以及后端冲突/权限/版本语义核对；未修改换班生产 API、契约、数据库或事务服务。
- 回归来源：`git log -S`/`git blame` 确认单一 `businessMonth` 与单月日历读取由 `b20ff9b` 引入，管理员表单后续由 `6452fa9`/`2bb9fce` 调整但仍复用同一月份。后端自 `b20ff9b` 起已分别按两个 assignment ID 读取不同 schedule period，并按两个 period 写事件、按两个 business month 刷新统计，原本支持跨月。
- 前端实现：普通换班增加“我的班次月份/对方班次月份”，管理员直办增加“成员一月份/成员二月份”；相同月份只读取一次，不同月份并行读取。改变一方月份仅清空该方班次及预览，另一方有效选择保留。班次选项显示完整业务日期、班种、起止时间（含“次日”）、岗位和成员；月份缓存按群组隔离，并用最新请求 ID 防止切换群组后的异步旧结果覆盖。
- 后端匹配：真实集成测试覆盖普通成员 2026-09 ↔ 2026-10 换班和管理员跨月直办；两个日历的实际成员与换班标识正确，`swap_completed` 事件分别落入两个 schedule period。原有同群权限、已发布状态、岗位资格、请假/时间/活动工作流冲突、assignment version、幂等、审批与事务回滚逻辑均由完整换班套件继续覆盖。
- 测试先行：旧前端对新增独立月份/并行加载/完整标签回归为 4 项失败，实现后 8/8 通过；后端跨月测试在不改生产服务的前提下先通过，证明缺口仅在前端。完整换班 API 集成 34/34 通过。测试数据库清理遗漏认证表由 `12e7f40` 后显现，本轮补齐换班文件自身的 `user_auth_identities`/`user_password_credentials` 清理；注入数据库的全仓 verify 继续在未改动日历文件的同类历史清理缺口处失败，未扩展到无关模块。
- 运行/浏览器验证：Web typecheck/build、Storybook build、`pnpm smoke:browser`、`pnpm smoke:check-core`、常规 `pnpm verify`（85 个文件/562 项通过，29 个数据库集成文件按默认环境跳过）、Prettier、ESLint 和 `git diff --check` 通过；任务相关数据库集成已单独全部实跑。390/320 冒烟确认普通与管理员 Sheet 均有两个独立月份选择器、44px 关键触达区且无横向溢出；本地真实数据实测改变“我的班次月份”后，对方月份、成员与已选班次保持，控制台无 error/warning，未提交换班。
- 行为审计：普通成员目标候选仍排除本人，管理员两侧仍可选择任何有可操作班次的成员；同月请求去重、跨月并行，不增加预览/提交 API 调用次数。月份变化只新增对应日历读取；提交、审批、撤销、错误转换和版本冲突处理调用保持原路径。checkpoint 识别消息：`feat(web): enable cross-month shift swaps`。
- 正式发布：代码 checkpoint `5a8380f` 已推送；发布前加密数据库备份 archive 为 `fd3480f8-ff34-4c82-92f8-f9187ba23336`（44 张表、7266 行，SHA-256 `abd75c70107729db32027a7788d48e6e55c2ce139621b98bf314892b43e03573`）。release `5a8380f614f4efdff702174b145da8beb1766f8c` 部署成功，`ecs-verify.sh` 退出码 0。
- 正式域名只读复核：D0796 群主会话的普通换班 Sheet 显示“我的班次月份/对方班次月份”且有 2 个 month 输入；管理员 Sheet 显示“成员一月份/成员二月份”且同样有 2 个 month 输入。当前生产群组本月无已发布排班，因此未选择班次；两个 Sheet 均无页面横向溢出，未触发预览、提交或任何业务写入，正式域名没有 error/warning 日志。
- 状态：已完成（含生产发布与线上核验）→ 待用户最终验收。最终状态 checkpoint 识别消息：`docs(status): record cross-month swap deployment`。
- 下一批次：无待实施仓库任务；最终状态 checkpoint 推送并作为文档同步 release 部署后等待用户验收。
- 停止条件：Git `HEAD`、`origin/main` 和服务器 `current-release` 一致；不再开始新实现任务。

## 2026-08-17 已确认界面精修落地（当前批次）

- 批次范围：仅落地用户确认的 3 组任务——月/周真实相邻内容滑动及苹果式柔和吸附；成员/日历详情直接拨号、统一紧凑开关、紧凑班种与自定义颜色；事件页日期时间轴及折叠。不修改 API、权限、数据库、通知订阅链路、换班或其他页面。
- 日历：月/周采用前中后三个真实面板，工具栏和星期栏固定在圆角滚动区外；拖动跟手，按距离/速度判定翻页，松手使用 `cubic-bezier(0.22, 1, 0.36, 1)` 动态时长吸附，减少动态时即时完成。只在确认横向拖动后捕获指针，普通月格点触仍一次生效；独立月/周组件默认保留星期栏。
- 设计落地：成员、列表与选中日期电话均为透明原样式 `tel:` 入口；相关 checkbox 改为 60×44px 点触、52×30px 轨道的紧凑开关。班种列表按需展开，输入框 42px，保留五个预设色并新增同尺寸自定义色圆点、调色板与 HEX。事件页按日期分组为时间轴，支持全部日期、单日期和单事件详情展开/折叠，访客访问记录保持原表格。
- 回归来源与测试：假滑动来自 `7c80488`；电话路径来自 `1c84fd6`/`7a47d69`/`ab25064`，成员目录来自 `6183e9d`；班种 UI 来自 `04c7da3`；事件表来自 `7ac2a07`，均已执行 `git log -S` 与 `git blame`。新增断言均先在旧实现失败，修复后定向 10 文件 72/72 通过。
- 验证：`pnpm verify` 通过（88 个文件/579 项，29 个数据库集成文件/253 项按环境跳过）；Web/全仓 build 与 typecheck、Prettier、ESLint、Storybook build、`pnpm smoke:browser`、`pnpm smoke:check-core` 和 `git diff --check` 均通过。完整 smoke 覆盖管理员、成员、访客 vkey 与访问记录且无浏览器错误，截图目录 `C:\Users\eylin\AppData\Local\Temp\schedule-smoke-7emAAK`。
- Storybook 专项：390px 月视图真实左滑成功切换相邻月；成员拨号链接透明且 44px；紧凑开关 60×44px；自定义色调色板/HEX 和事件全部日期折叠均实际操作通过。checkpoint 识别消息：`feat(web): land approved interface refinements`。
- 正式发布：代码 checkpoint `41d284b` 已推送；发布前加密数据库备份 archive 为 `915fa54b-1054-4a81-b9a2-aefa9844d25d`（44 张表、9120 行，SHA-256 `4f1bec8ce81a40ef57758c151230e7a4cf471c73061b43eb6862d9733073ed41`）。release `41d284b312452df2762981e252251d5e871d9149` 部署成功，发布前后 `ecs-verify.sh` 均通过。
- 正式域名只读复核：月视图真实拖动 8 月→9 月，周视图真实拖动第 4 周→第 5 周，均保持 3 个相邻面板；固定星期栏、无横向溢出、60×44px/52×30px 开关、6 行紧凑班种、42px 输入框、自定义调色板/HEX 和零浏览器日志错误均通过。当前生产群组没有已填写号码和事件，未为核验写入数据；对应有数据分支已由本地 smoke/Storybook 实际覆盖。浏览器减少动态偏好下正确即时切换，生产 CSS 同时包含正常偏好的苹果式缓动曲线。
- 状态：已完成（含生产发布与线上核验）→ 待用户复核。下一批次：无，最终状态 checkpoint `docs(status): record interface refinement deployment` 推送并同步为 production release 后停止。
- 停止条件：最终状态 checkpoint 生产备份、部署与 `ecs-verify.sh` 通过，使 Git `HEAD`、`origin/main` 和服务器 `current-release` 一致；随后等待用户验收，不开始其他修改。

## 2026-08-17 日历翻页性能、定位动画、标识密度与时间选择器预览（当前批次）

- 批次范围：只处理 3 项——月/周翻页卡顿与首次点击偶发失效、定位今天复用现有横滑动画、日历标识紧凑统一；另按 `frontend-design` 仅制作月份/日期/时间统一选择器 Storybook 预览，未替换生产原生选择器。
- 回归来源：`git log -S`/`git blame` 确认固定 180ms 程序滚动结算来自 `ee63532`，翻页重置选择来自 `41d284b`/`8a49434`，日历标识基础尺寸来自 `48c6fdd`、周视图差异来自 `a1a732a`。固定计时可能在低帧率下早于平滑滚动越过半页，从而被判回中页；每次翻页又重复读取相邻三个月和节假日。
- 测试先行：缓存、滚动结算、选择稳定、定位动画和标识密度断言在旧实现中出现缺失模块及 7 项失败；连续点击排队与程序滚动不得被 180ms idle timer 缩短的追加断言也先失败。实现后日历与 Storybook 定向 16 文件/86 项、全仓 Vitest 94 文件/593 项通过，29 个数据库集成文件/253 项按默认环境跳过。
- 生产实现：程序翻页优先由浏览器 `scrollend` 结算，旧 WebView 使用 700ms 安全回退；程序动画期间不以 180ms idle timer 提前结算，连续点击排队而不丢失。月历/节假日按群组缓存不可变只读结果，相邻翻页通常只需新增月份请求；窗口重新聚焦和冲突刷新仍强制取新。首次加载自动选中业务日，后续翻月/翻周不重置用户选择或触发额外自动滚动。定位今天在月/周中通过相同三面板横滑动画完成，列表行为不变。
- 标识：月/周的换班、加班、节假日及节后补班统一为桌面 16px 高、9px 字、水平 3px 内边距；移动端统一为 14px 高、8px 字、水平 2px 内边距和 3px 圆角。仅改视觉几何，标识文本、颜色、事件和排班数据未变。
- Storybook 预览：采用“医护排班时间轨”方向，手机为底部 Sheet、桌面为邻近浮层，月份 4×3 网格、日期 7 列月历、时间 24 小时双滚轮，共享浅蓝当前选择摘要。390×844、320×844、1280×900 无横向溢出，主要操作均不小于 44px，键盘焦点/减少动态通过，Axe WCAG A/AA 为 0 项违规。预览地址为 `http://127.0.0.1:6007/?path=/story/web-ui-2-0-next-refinements-unified-temporal-pickers--mobile-month-390`；生产替换等待用户视觉确认。
- 运行/浏览器验证：Web typecheck/build、Storybook build、Prettier、ESLint、`node scripts/smoke-browser.mjs`、直接全仓 Vitest 和 `git diff --check` 通过；完整 smoke 覆盖管理员、成员、访客/vkey 与访问记录且无浏览器错误。真实 390px 浏览器确认单击 7月→8月有滚动动画、定位 7月→8月有同款动画、40ms 连续两击到 9月不丢失；周视图单击第4周→第5周及定位返回均有动画。`pnpm verify` 包装器因本机非 TTY 依赖目录检查停止，等价的直接格式、ESLint、Web build/typecheck 与全仓 Vitest 已分别通过。
- 行为审计：缓存仅复用同群只读 GET，拒绝请求会从缓存移除；强制刷新、最新请求追踪、错误/冲突路径和筛选不变。`shallowRef` 只取消未使用的深层代理，日历模型仍整体替换；API、权限、数据库、日期点击、详情和业务写入均未改。checkpoint 识别消息：`fix(web): smooth calendar navigation and compact badges`。
- 正式发布：代码 checkpoint `628c79f` 已推送；发布前加密数据库备份 archive 为 `494a53f0-db00-4c97-8469-71308de60e88`（44 张表、11348 行，SHA-256 `8c6db38ee0705a29d08aa83854eee7f7bc9c2eaf81cbd5debb54911d328504c1`）。release `628c79f27816302c781f429d4628be949b5b3f22` 部署成功，发布前后 `ecs-verify.sh` 通过；容器预热时一次 502 由发布脚本自动重试后恢复。
- 正式域名只读复核：390×844 下单击 8月→7月、7月→8月均一次成功；离开 8月时蓝色选择为 0，返回后原 8月17日选择恢复为 1；定位从 7月返回 8月，周视图第4周→第5周及定位返回第4周均一次成功。浏览器启用减少动态，因此正式复核按设计即时切换；正常动态的滚动过程已由同构建本地浏览器验证。9 月“班”标识为 14px 高、8px 字、2px 水平内边距和 3px 圆角，无横向溢出、3 个真实周面板，控制台无 error/warning，未触发业务写入。
- 下一批次：无已授权生产修改；等待用户确认 Storybook 的月份/日期/时间选择器。确认后才替换生产原生控件。
- 停止条件：最终状态 checkpoint 推送并作为文档同步 release 部署，使 Git `HEAD`、`origin/main` 与服务器 `current-release` 一致；随后等待用户视觉确认。

## 2026-08-17 统一年月、日期与时间选择器落地（当前批次）

- 批次范围：用户确认 Storybook 后，仅把生产中的原生 `month`、`date`、`time` 控件替换为统一 `TemporalPicker`；事件筛选的 `datetime-local` 保持不变。不修改 API、权限、数据库、业务请求或数据结构。
- 回归来源：`git log -S`/`git blame` 确认月份控件分批来自 `5a8380f`、`561310c`、`b9ab3d3`、`7c783c7`、`15729f8`、`36127b0`、`5d8b205`、`b20ff9b`、`ab25064`，日期控件来自 `b1ce5c7`、`0d5ec55`、`0fe9d1a`、`6512274`、`04c7da3`，班种时间控件来自 `41d284b`、`0609cb5`、`0d5ec55`、`04c7da3`。旧冒烟的原生年月定位同步升级为真实组件操作。
- 设计与实现：沿用 `frontend-design` 确认的医护排班时间轨方向；手机为底部 Sheet、桌面为输入旁浮层。年月和时间均使用双栏垂直滚轮，日期使用统一 7 列月历；取消不写值，完成才更新，原本可空的班种时间保留清除。程序化居中与用户滚动结算隔离，避免 `08:00` 打开后误跳 `00:00`；快速确认会同步当前滚轮位置，44px 外层点触区与减少动态保持。
- 语义审计：换班四个月份的独立状态、跨月并行加载和原 `change` 回调各一次不变；统计仍只在完成月份选择后加载一次；历史排班继续直接接收年月字符串；日期最小值、全天禁用、班种非 15 分钟既有值、错误路径及请求次数保持。原生必填日期均有非空初始化且新组件不提供清除。
- 测试先行：生产替换断言在旧代码上 2/2 失败，实现后组件/预览 4/4、受影响定向 49/49、Web 58 文件/421 项通过。全主工作区 Vitest（排除另一批次的 `runtime/ecs-directory-release-src` 打包副本）97 文件/609 项通过，30 文件/256 项按环境跳过。
- 运行/浏览器验证：全仓 Prettier、ESLint、build/typecheck、Web build、Storybook build、`node scripts/smoke-browser.mjs`、`node scripts/smoke-browser.mjs --check-core` 与 `git diff --check` 通过；完整 smoke 覆盖管理员、成员、访客 vkey 与访问记录且无浏览器错误。`pnpm verify` 的格式/lint/build/typecheck 全部通过，最后测试步骤仅因另一批次留下的 `runtime/ecs-directory-release-src` 旧打包副本被重复扫描而失败，主工作区同范围测试已独立全量通过。
- Storybook 专项：真实生产组件在 390px 完成 2026-08→2026-09 和 08:00→08:15 滚轮提交；320px 日期面板无横向溢出；1280px 浮层与触发器间距 12px；打开态 Axe WCAG A/AA 为 0 项违规。预览地址：`http://127.0.0.1:6007/?path=/story/web-ui-2-0-components-temporal-picker--mobile-month-390`。
- 正式发布：代码 checkpoint `92038cd` 已推送；发布前加密数据库备份 archive 为 `e72d6743-0c90-472d-ac50-53d6598dc157`（50 张表、11579 行、4,414,204 字节，SHA-256 `db04563e72190483248a6b644aae07e7e5aaa4a5927492ce0a1f984de34b480f`）。release `92038cdd6037da4ebe712bcf7b58e3b4a285dbb9` 部署成功；容器预热首次健康检查出现一次 502，自动重试恢复，更新后的 `ecs-verify.sh` 通过 38 个迁移、产物哈希、域名隔离和容器检查。
- 正式域名只读复核：页面原生 `month`/`date`/`time` 输入均为 0；日历年月弹层打开后正确选中 2026 年 8 月，取消后仍为 2026 年 8 月。请假 Sheet 显示 2 个日期选择器并正确选中 17 日；换班 Sheet 显示 2 个独立月份选择器；班种时间触达区 44px、无原生 time input。所有弹层均取消或关闭，未提交、保存或写入业务数据，浏览器 error/warning 为 0。
- 当前状态：已完成（含生产发布与线上只读复核）→ 待用户复核。代码 checkpoint 为 `92038cd`；最终状态 checkpoint 识别消息：`docs(status): record temporal picker deployment`。
- 下一批次：统一选择器生产发布完成后，恢复项目既定 DIR-02 数据提取批次；本轮不提前处理小程序迁移或通讯录数据导入。
- 停止条件：最终状态 checkpoint 推送、生产备份、release 与 `ecs-verify.sh` 通过，使 Git `HEAD`、`origin/main` 和服务器 `current-release` 一致；随后停止并等待用户复核。

## 2026-08-18 手动排班刷新与时间选择器响应修复（当前批次）

- 批次范围：只修复手动排班进入后循环加载、日期/时间触发框信息截断、年月/时间滚轮粘滞与停止后延迟选中；不修改 API、权限、数据库、排班数据或其他页面交互。
- 回归来源：定时刷新由 `eaadbdd` 引入，`b0f5dc6` 改为 08:00 业务交接后使旧午夜算法在凌晨退化为每秒刷新；选择器左图标、90ms 防抖与逐项强制吸附由 `92038cd` 引入。均已执行 `git log -S` 与 `git blame`。
- 实现：刷新定时器改为严格位于未来的中国标准时间 08:00 交接点。触发框移除左图标，日期视觉值使用紧凑且完整的 `YYYY-MM-DD 周X`，完整中文值保留给无障碍名称。滚轮取消 `scroll-snap-stop: always`，以浏览器原生惯性滚动、逐帧高亮和 `scrollend` 最终校准取代停止后防抖。
- 测试先行与验证：旧实现新增用例失败，实现后定向 8/8；主工作区 Vitest（排除用户自有 `runtime/**`、`src/**` 副本）109 files / 649 tests、Web typecheck/build、Storybook build、任务文件 Prettier/ESLint、完整 `node scripts/smoke-browser.mjs`、核心门禁与 `git diff --check` 通过。320px 日期无截断且按钮 44px；390px 滚轮 40ms 内更新、550ms 后无二次跳变；Axe 0 项违规。
- 语义审计：初载/聚焦刷新、请求接收者、Promise 错误路径、完成/取消/清除事件、空值和减少动态保持；仅刷新时刻、触发框视觉密度与滚轮内部草稿更新时机改变，无 API 或业务写入副作用。
- 正式发布：代码 checkpoint `140b3fc` 已推送；发布前加密数据库备份 archive 为 `e409adc5-d2ae-4ab0-8b5a-c039a729ca7d`（50 张表、18447 行、7305428 字节，SHA-256 `77d143990c6ecc14ce7e86052db8ca797964f6c3876bf32673a82b781f7979f5`）。干净 worktree 生成并部署 release `140b3fc44f432e18f0f390e9d37003128cb09ae8`，`ecs-verify.sh` 通过；容器预热首个健康检查 502 后自动恢复。
- 正式域名只读复核：刷新到新 Service Worker bundle 后，手动排班页连续 5 秒无加载态；日期框为 `2026-08-18 周二`、无左图标、44px 高且 `scrollWidth = clientWidth = 181px`。未保存时间草稿 08:00→10:00 在 40ms 内同步，550ms 后无二次跳变；取消后仍为空值，未保存班种，浏览器日志为空。
- 当前状态：已完成（含生产发布与线上核验）→ 待用户复核。
- 下一批次：只提交、推送并部署最终状态 checkpoint，使 Git `HEAD`、`origin/main` 与服务器 `current-release` 一致；随后停止，不开始其他修改。
- 停止条件：最终状态 checkpoint 已推送并部署，Git `HEAD`、`origin/main` 与服务器 `current-release` 一致后停止，等待用户复核。

## 2026-08-18 班种时间选择与跨日校验修复（当前批次）

- 批次范围：只修复班种时间弹窗点击外部不关闭，以及选择跨日/24 小时时间后无法启用两项回归；不修改其他页面、API 权限、数据库结构或排班业务流程。
- 回归来源：外部点击只依赖原生 dialog 事件目标由 `92038cd` 引入，在正式浏览器可稳定复现；时间与跨日校验、班种草稿直接绑定由 `04c7da3` 引入，统一时间选择器替换后未同步跨日状态。
- 实现：时间弹窗改为捕获 `pointerdown` 并按可见面板矩形判断外部点触，所有关闭与卸载路径均清理监听器；开始/结束时间完成选择后自动按先后顺序同步跨日。`08:00–次日08:00` 作为 24 小时班种可启用，非跨日相同时间和其他矛盾组合仍拒绝。
- 测试先行与验证：旧代码上新增坐标/监听器/跨日同步断言失败，实现后 Web 定向 7/7、排班配置 API 集成 5/5 通过；Web/API typecheck、Web build通过。本地 Storybook 实际验证弹窗外点触关闭且取消不改值；`pnpm --config.verifyDepsBeforeRun=false smoke:browser` 全流程通过。
- Storybook build、任务文件 Prettier/ESLint、`pnpm --config.verifyDepsBeforeRun=false smoke:check-core` 和任务文件 `git diff --check` 通过。完整 verify 的格式/ESLint 已通过，构建仅被并行中的无关未提交通讯录测试缺少其待创建模块阻断，本轮未修改该批次。
- 语义审计：取消、完成、清除事件次数不变；监听器只在弹窗打开期存在。时间 helper 仅修改当前字段并在两个值齐全时更新跨日；启停仍只调用一次原更新 API，失败恢复、权限、事务、版本和空值处理保持。
- 正式发布：代码 checkpoint `b24a5b6` 已推送；发布前加密数据库备份 archive 为 `5b4bbb06-a9b6-4db7-afeb-1b134069a350`（50 张表、18408 行、SHA-256 `a956b55aee98776927b942a6861273b3caacc088ab5ea7df05a0d21f4a071a5a`）。release `b24a5b6e3e1bbf9be2dc10661dd8d14ef7a9ea23` 从干净 worktree 构建并部署，`ecs-verify.sh` 通过。
- 正式域名只读复核：A 班时间弹窗外点触后 dialog 立即关闭；未保存草稿选择 20:00→08:00 后跨日自动为 true，刷新页面已丢弃草稿，未触发保存、启用或其他业务写入，浏览器日志为空。
- 当前状态：已完成（含生产发布与线上核验）→ 待用户复核。代码 checkpoint 为 `b24a5b6`；最终状态 checkpoint 识别消息：`docs(status): record shift time fix deployment`。
- 下一批次：只提交、推送并部署最终状态 checkpoint，使 Git `HEAD`、`origin/main` 与服务器 `current-release` 一致；随后停止，不开始其他修改。

## 2026-08-17 日期正圆标识与触控数字滚轮精修（当前 UI 批次）

- 批次范围：用户确认 Storybook 后，只把已确认的 36×36 正圆日期标识、无选择框数字滚轮和触控惯性样式同步到生产 `TemporalPicker`；不修改使用页面、API、权限、数据库、目录数据或业务请求。
- 回归来源：`git log -S`/`git blame` 确认日期整格圆角背景与滚轮浅蓝选择框均由 `92038cd` 首次引入；本轮旧实现回归为 1 项失败/2 项通过，准确暴露缺少独立圆形标识、滚轮轨道和触控滚动样式，修复后组件/预览 5/5 通过。
- 生产实现：日期按钮仍占满网格点触列，但可见选中层独立为 36×36 圆；年月、小时和分钟使用 44px 数字行、上下淡出、中心双分隔线、透明选中态与 `touch-action: pan-y`/移动惯性。分钟围绕打开值循环展示完整步进集合，既有非步进分钟值仍保留并可确认。
- 语义审计：取消不写值，完成才发出 `update:modelValue`/`change`；快速确认仍从可见滚轮同步一次。月份/日期最小最大值、清除/必填、非 15 分钟旧值、焦点回归、减少动态、调用次数和错误路径均未改变。
- 验证：Web typecheck/build、Storybook build、任务文件 Prettier/ESLint、`git diff --check`、主工作区全仓 Vitest 97 文件/611 项通过（30 文件/256 项数据库集成按默认环境跳过），Web 58 文件/422 项通过。`pnpm verify`/`pnpm smoke:browser` 包装器仍被本机非 TTY 依赖预检阻断；等价直接入口在独立 5174 当前源码服务完成完整 smoke，管理员、成员、访客/vkey 和访问记录全流程无浏览器错误，`node scripts/smoke-browser.mjs --check-core` 通过。
- Storybook 专项：320px 日期标识实测 36×36、`border-radius: 50%`、按钮背景透明且无横向溢出；390px 月份 8→9、分钟 00→15 均按 44px 单步结算，取消保持 `08:00`、完成更新为 `08:15`；1280px 浮层 380px、滚轮 292px，无溢出，Axe WCAG A/AA 为 0 项违规。
- 正式发布：代码 checkpoint `d29bb49` 已推送；部署前加密数据库备份 archive 为 `31f078ab-ee9b-4b6b-b6ca-66885f3b33af`（50 张表、16933 行、6819040 字节，SHA-256 `048cefa2729fae44673ac40f0c8fa3e595511e3523bc9579c845e46ac33099a8`）。release `d29bb4981bd94a4f3ede4299c7d1be7ef718b33a` 部署成功；容器预热首次健康检查出现一次 502，自动重试恢复，`ecs-verify.sh` 通过健康、38 个迁移、产物哈希、域名隔离和容器检查。
- 正式域名只读复核：1280px 月份滚轮选中态透明、中心轨道 44px，按一行切换 2026 年 8 月至 9 月后取消，触发值仍为 2026 年 8 月。请假日期标识为 36×36、`border-radius: 50%`，按钮背景透明且页面无横向溢出；取消后起始日期仍为 2026 年 8 月 17 日。未提交的新班种时间滚轮为 188px、44px 行、`touch-action: pan-y`，00 分单步结算为 15 分后取消，草稿仍为空；所有外层 Sheet 均关闭，未触发业务写入。
- 当前状态：已完成（含生产发布与线上只读复核）→ 待用户复核。代码 checkpoint 为 `d29bb49`；最终状态 checkpoint 识别消息：`docs(status): record temporal wheel deployment`。
- 下一活动批次：DIR-03 只实现只读通讯录 API、正式成员/后台管理员权限、中文/拼音/号码模糊检索、结构化筛选和游标分页；guest/vkey/匿名继续拒绝，不提前实现 Web 页面。
- 停止条件：最终状态 checkpoint 推送、生产备份、release 与 `ecs-verify.sh` 通过，使 Git `HEAD`、`origin/main` 和服务器 `current-release` 一致；随后停止并等待用户复核。
