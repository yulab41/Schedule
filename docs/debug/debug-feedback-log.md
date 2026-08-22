# Web 1.0 调试与验证记录

本文件只记录当前轮次的变更、验证和状态；详细历史以 Git 提交为准。

## 2026-08-22 P3 原生身份页面首个切片

- 实现：新增 `pages/identity/index` 和 `pages/admin-bind/preview`，覆盖微信登录、未知微信 `link_required`、既有账号密码绑定、真实姓名建档、管理员 ticket 脱敏预览和 fresh-code confirm；API 客户端无 Zod/Node/DOM/fetch，不触碰 P4 工作台。
- 验证：Mini typecheck/build、source audit、受控 16 文件/68 项、verify（2/2 Worklet，192620 bytes，manifest `ac7028b027db185a85ac24751e5202312e3a8cf8822feeac77a2304e9a08418e`）和 CI dry-run 通过。默认 test 对用户自有 `.artifacts/ecs-runner-deploy-*` 产生 17 项旧副本失败，排除后全绿。
- 状态：已实现待人工原生复核；下一步为本 checkpoint 的本地 Node `miniprogram-ci` 体验上传，之后等待微信开发者工具/实体 Android 反馈。
- checkpoint 识别消息：`feat(miniprogram): add p3 native identity pages`。

## 2026-08-22 P3 身份安全视觉黄金稿

- 实现：新增 `P3IdentitySecurityPreview` Storybook 黄金稿及 9 个 Web/Mini 身份状态，保持 Web 无公开注册、平台账号不暴露密码、Mini 管理员 ticket 脱敏与 10 分钟边界；未改生产页面、Mini 页面或 API。
- 设计：使用现有 UI token 和医护工作台蓝白语义；Web 为身份确认台，Mini 为身份步骤流，进度线表达微信身份→账号证明→进入排班。
- 验证：clean worktree 完整 build、Web `vue-tsc`、定向 ESLint、源级 Vitest 4/4、Storybook build 通过；真实静态 Storybook 浏览器检查覆盖 Web 登录/平台账号与 Mini 390/320 身份状态，所有页面无横向溢出或 page error。Web 登录只有 Python 静态服务器 `/favicon.ico` 404。
- 预览：`http://127.0.0.1:6007/?path=/story/miniprogram-parity-p3-identity-security--mini-login-390`；截图保存在仓库外临时目录 `C:\Users\eylin\AppData\Local\Temp\p3-identity-screens`，未进入 Git。
- checkpoint 识别消息：`fix(miniprogram): stabilize p3 visual guard`；当前状态已完成 → 待用户人工视觉确认。

## 2026-08-22 P3-G 管理员 URL Link ticket 与 Mini admin-bind

- 实现：管理员 ticket 只存 hash、当前 AppID、target、pending/consumed/expiry；URL Link 只携带 ticket，服务端 10 分钟过期。preview 只返回 masked preview；confirm 以新 Mini code 在同一 ticket 事务内完成 current-AppID identity/Union 绑定、审计、session 签发和单次消费。
- 验证：contracts/0047/schema/package 19 项，真实 admin-bind 4、P3-E/F 15、migration/client 21 项，受控非 integration 155 文件/855 项和 Mini 15/63 全部门禁通过；精确 clean worktree 的 frozen install、root build/typecheck/lint 通过。Windows clean worktree 的 `format:check` 受全仓 CRLF 基线影响，未修改基线文件。无 UI 变化。`pnpm smoke:browser` 仍在 5173 第 1/6 步 `ERR_CONNECTION_REFUSED`；`pnpm smoke:check-core` 已通过。
- 发布：代码 checkpoint `668103c` 已推送；备份 `5d02a3cb-5eb3-41f7-8572-3a1bdfcfd7f3`（53 表、161465 行、76308616 bytes，SHA-256 `0f83718e5bd0987502a0877ae91e656e8b07c510f814140d674c44d9d7cec43c`）后部署 release `668103c2b6aabd72493f20c9a61f9c327e9c0d3a`。其后并行 Web 目录子提交 `99f222d` 进入生产但未改动 P3-G；最终 release `99f222d1ac4a0d83d4ab970fae3a0db845cbd4a1` 重跑 `ecs-verify.sh` 通过 47 migrations/54 业务表，identity/detachment/link/Union/admin-ticket 均 0。无 Mini runtime 变化，本轮未上传体验版。
- checkpoint 识别消息：`feat(auth): add admin mini binding ticket`；当前停止于页面人工视觉确认前。

## 2026-08-22 P3-F 管理员账号状态与 password/code proof

- 实现：平台管理员列表仅暴露脱敏账号状态；用户名分配可创建 nullable credential 并补 password locator；`PUT /me/password` 严格互斥支持 currentPassword/WeChat code proof，成功更新 hash、authVersion/version和审计，旧 token 失效。
- 验证：contracts 7 项、真实 MySQL 5 项、root build/typecheck/lint、受控非 integration 154 文件/851 项、Mini 15 文件/63 项与全部包门禁通过。既有 platform-admin integration 9/10，唯一失败是固定 contact UUID 的历史 backup fixture。
- 运行/浏览器验证：`pnpm smoke:browser` 在 5173 未启动时第 1/6 步 `ERR_CONNECTION_REFUSED`；无视觉变化。checkpoint 识别消息：`feat(auth): require admin password proof`。
- 发布与核验：checkpoint `0225e0e` 已推送；备份 `2e4b0172-0fcd-4df6-8510-6e001f705a60`（53 表、161459 行、76304648 bytes，SHA-256 `9b0ffc05d9643ecd7c83c55d1bdcab54d0d1e02a318e042f977b066be0cf65c0`）后部署 release `0225e0e79ae9838fe8c27dcb01a7808bea9ec98e`，`ecs-verify.sh` 通过，公网 health 200；生产身份/link/detachment/Union 仍 0，密码聚合不变。最终状态 checkpoint：`docs(status): record admin password proof deployment`。
- 文档 release：状态 checkpoint `8d78e4f` 已推送；第二次备份 archive `f83bd33a-4975-44f6-8847-771411879945`（53 表、161460 行、76305972 bytes，SHA-256 `c630e09d0d92caedbf6416e221ebca15f16bc80acf706f9f4ff91863081e9efb`）后部署 release `8d78e4fe8f9d4c1a4add658b436bca80c2ec6f94`，`ecs-verify.sh` 与公网 health 200 通过，Git/服务器 release 已对齐。

## 2026-08-22 P3-E 当前 Mini AppID 解绑

- 红灯与设计：新增 contracts/0046/schema 先在旧实现 3 项失败；5 个路由场景先返回 404。只删当前 Mini identity 会被 Union resolver 自动回挂，因此增加仅存 subject hash 的 detachment marker，并在 resolver 默认拒绝、显式密码重绑时原子清除。
- 实现：用户 fresh code + password prerequisite 与平台管理员 reason + password prerequisite 共用 current-AppID scoped service；Idempotency-Key 同 fingerprint replay，cross-body 409；删除 identity、清除 legacy mirror、authVersion/version、审计和 result 同事务。其他 Web/ Mini identity、Union、profile/password/群组引用不变。
- 等价与测试：`resolve()` 空 AppID 仍在开事务前拒绝；新增 `resolveInTransaction` 只改变调用方事务复用，不改变原查询顺序、receiver、错误或结果。真实 MySQL 解绑 6、既有微信 22、linkToken 4、邀请 7、迁移 19 项通过；受控非 integration 153 文件/848 项通过。平台 admin 10 项中 9 项通过，backup fixture 固定 contact UUID 的既有失败未改。
- 运行/浏览器验证：`pnpm smoke:browser` 在 5173 未启动时第 1/6 步 `ERR_CONNECTION_REFUSED`；本批无视觉变化。checkpoint 识别消息：`feat(auth): enforce current mini identity unbind`。
- 发布与核验：checkpoint `15ee912` 已推送；备份 `03d4a0f7-cefa-48c6-a835-f34d0e69e8db`（52 表、161456 行、76302488 bytes，SHA-256 `df942df399b6af301d941e99e2883cef1f50c1f762dc75582c3f4c48b602b58d`）后部署 release `15ee912f5ed3b57855fa3919c58fada218f78d00`，`ecs-verify.sh` 通过 46 migrations。未认证路由探测均 401；生产 detachment/linkToken/identity/Union 0、authVersion 全 1、密码聚合不变，未调用微信或写身份。最终状态 checkpoint：`docs(status): record current mini identity unbind deployment`。
- 文档 release：状态 checkpoint `69c34a7` 已推送；第二次备份 archive `f1ec980e-da4d-40e1-a7db-da83ea0993d4`（53 表、161457 行、76303324 bytes，SHA-256 `46de07494270bbdd324f04cea22bb195e2bc66c5cd5c662072dd58b89e679aef`）后部署 release `69c34a7f7a14617da1b93cd57ae1f55d1a728d61`；首次 TLS reset 后恢复，`ecs-verify.sh` 与公网 health 200 通过，Git/服务器 release 已对齐。

## 2026-08-22 P3-D linkToken 消费与显式建档

- 红灯与来源：contracts 新用例在旧代码 1 项失败，真实 MySQL 7 个新端点场景全部 404；登录、resolver、密码和 linkToken 来源为 `39f9c66`/`4416f79`/`de3ad5f`/`3919050`。默认 Vitest 另扫用户 `runtime/**` 副本导致迁移表竞争，显式排除后主文件红灯/绿灯可重复。
- 实现：新增严格 link-password/register contracts 与 200/201 routes。密码 proof 只接受 active、未删除、有资料和非空 hash 的账号；新微信建档创建 synthetic locator/user/profile/identity/可选 Union，不创建密码；已知无 profile identity 只补原 user。两条路径返回完整 authenticated profile/session并保留 authVersion。
- 事务与等价：resolver 原逻辑提取为可复用调用方事务的入口，原 `resolve()` 的 receiver、单事务、空 AppID 前置拒绝、查询/回调顺序、返回/错误保持。linkToken、identity/Union/legacy openid、profile、审计、session 签名和 consumed 同事务；错误 proof、篡改、过期、重放、并发、Union 冲突及缺 secret 均失败关闭并按预期回滚。
- 验证：契约/密码/Web 微信定向 5 文件/36 项；真实 MySQL identity 22、linkToken 4、邀请 7、database 19 项；受控非 integration 全仓 152 文件/845 项通过（2 文件/19 项环境跳过）。根 build/typecheck/lint、Mini 15 文件/63 项与全部静态/包门禁、任务格式/diff 通过；根 format 仍仅既有/用户所有 11 项。
- 运行/浏览器验证：`pnpm smoke:browser` 在 5173 未启动时第 1/6 步 `ERR_CONNECTION_REFUSED`；本批无视觉变化。checkpoint 识别消息：`feat(auth): complete explicit wechat linking`。
- 发布与核验：checkpoint `2fc9c16` 已推送；备份 `94ed7fdd-645e-4c0c-913d-4a911f04c018`（52 表、161454 行、76301168 bytes，SHA-256 `94afd1c97a7794dd2e8105557c659c5f443b199fe009ae927b879d6c6e40458e`）后部署 release `2fc9c164e716bea4b00c4eaf5bb32d67109cd93e`，`ecs-verify.sh` 通过。新路由空 JSON 均 400；生产 linkToken/identity/Union 0、authVersion 全 1、legacy Mini 1、密码聚合不变，未调用微信或写身份。最终状态 checkpoint：`docs(status): record explicit linking endpoints deployment`。

## 2026-08-22 P3-C 显式微信关联与无注销边界

- 红灯：Mini 判别联合、三类 link 错误、脱敏、0045 schema、link service 模块、未知不建号和注销 404 均在旧实现失败。
- 实现：未知 Mini 只返回 10 分钟 link_required 并写哈希 token，不建 user/identity/Union/audit；已知有 profile 才签 authenticated session，已知无 profile 的 token 绑定 existing user。link service 行锁单次消费并区分 invalid/used/expired；password/Web response 解耦，错误码生成到 client-core，linkToken/Union 日志脱敏。
- 无注销：删除 contract/service/route；404 回归确认 locator/status/profile/contact/audit 原样保留。公开 password register 本批不动。
- 验证：静态/contract/client 8 文件/29 项，真实 MySQL link 4、身份 14、邀请 7、无注销 1、迁移 17 项，非 DB 全仓 156 文件/854 项通过。根 build/typecheck/lint、任务格式/diff/`smoke:check-core` 通过，根 format 仅既有/用户所有 11 项。代码 checkpoint `3919050` 与修复 checkpoint `c4da389` 均已推送。
- Windows clean-worktree 回归：`3919050` 的 CRLF 检出让 Vitest 导入含 shebang 的 `visual-compare.mjs` 时语法失败；引入点为 `c8d50f5`。新增断言在旧代码先失败，删除冗余 shebang 后精确 `c4da389` clean checkout 无需修改即通过 Mini 15 文件/63 项、typecheck、verify/source/2 Worklets/package/determinism/CI dry-run（151108 bytes，manifest `365e3f6e476ad7525b91322f3a48d9bd4ec8d84ea69367425e89969024a70168`）。脚本仍由显式 `node` 调用，CLI 行为、错误路径和调用次数不变；`3919050` 产物作废。
- 运行/浏览器验证：修复后 `pnpm smoke:browser` 仍在 5173 未启动时第 1/6 步 `ERR_CONNECTION_REFUSED`；无视觉变化。修复 checkpoint 识别消息：`fix(miniprogram): keep visual comparer importable on Windows`。
- 发布与核验：公网 IPv4 两处均为 `103.54.154.21`；精确 `c4da389` 由本地 Node 上传体验版 `0.1.0-p3.20260822.49`（50 个代码文件、zip 38678 bytes，manifest `7e528f42e16972f25625028e2c6d952e5a4f989ae6ea2c5aaea6ca4b35e9c508`），未审核/正式发布。备份 `f61cbf8b-ff3c-415a-8091-3829ecd24747`（51 表、161452 行、76299680 bytes，SHA-256 `79009b0cbb89c7d5215ef4077d7e30842a4b3f13e094493dce2ecf5be6c08ccd`）后部署 release `c4da3896f40a8273b1b9d4ccbcff1f96cdf63b09`，`ecs-verify.sh` 通过 45 migrations。生产 linkToken 0、identity/Union 0、authVersion 全 1、legacy Mini 1、密码聚合不变；最终状态 checkpoint：`docs(status): record explicit wechat linking deployment`。

## 2026-08-22 P3-B 版本化会话与 AppID identity

- 红灯：claim/gateway 3 项和身份集成 5 项在旧实现失败，覆盖无版本/AppID 校验、legacy scoped 认领与跨渠道 Union 500。
- 实现：新 token 写 authVersion，Mini/Web 再写 AppID；旧 token 缺版本按 1 兼容。认证逐次校验 active/deleted/version 和 scoped identity。事务 resolver 统一 Mini/Web identity、Union account、legacy openid/null-AppID 惰性认领与冲突；AppSecret 使用 private field。邀请合并移动 identity/Union 并按目标版本重签。
- 等价：未知 Mini 仍返回原 `isNewUser` 并自动建号，contracts/路由/UI 不变；旧 password/Mini 会话、dev token、资料/群组和错误传播保持。P3-C 才切 `link_required`。
- 验证：专项 6 文件/49 项、真实 MySQL 身份 14 项+邀请 7 项、非 DB 全仓 155 文件/852 项、Mini 15 文件/62 项及全部静态/包门禁通过；根 build/typecheck/lint、任务格式/diff/`smoke:check-core` 通过，根 format 仅既有/用户所有 11 项。
- 运行/浏览器验证：`pnpm smoke:browser` 在 5173 未启动时第 1/6 步 `ERR_CONNECTION_REFUSED`；无视觉变化。checkpoint 识别消息：`feat(auth): version scoped identities`。
- 发布与核验：checkpoint `4416f79` 已推送；备份 `e4a7cee1-95ed-48b5-a7c9-50592be31aea`（51 表、161450 行、76298360 bytes，SHA-256 `d8813940663d3f939172a8bdacab6591776acbef47771623a6f79adf6a44b743`）后部署 release `4416f79be3764f510a0ef04fad56ed997e43841a`，`ecs-verify.sh` 通过。部署前后 0 identity/Union、authVersion 全 1、legacy Mini 1、password hash 摘要不变；未触发身份写。最终状态 checkpoint：`docs(status): record scoped identity deployment`。

## 2026-08-22 P3-A 加法式身份基础

- 红灯：foundation 4/4、nullable password 2/7、migration verifier 1/3 在旧实现失败；定位 identity/password/JWT 来源为 `12e7f40`/`de3ad5f`/`39f9c66`。
- 实现：migration 0044 增加 authVersion、可空 appId 过渡列、Union 一人一号表和 nullable hash；临时 CHECK 在 DDL 前阻断 locator/Union 冲突，只补 active password credential 的 null locator。null hash 登录/状态/proof 失败关闭；产品 API/UI 不变。集成 reset 补齐三张身份表清理。
- 验证：专项 14 项、真实 MySQL migration 17/17、非 DB 全仓 154 文件/848 项、Mini 15 文件/62 项及全部静态/包门禁通过；主工作区其余 integration 240 项通过。6 文件/10 项旧断言/fixture 与用户 runtime 副本失败已独立归因，不修改。根 build/typecheck/lint、任务格式/diff/`smoke:check-core` 通过，根 format 仅既有/用户所有 11 项。
- 运行/浏览器验证：`pnpm smoke:browser` 在 5173 未启动时第 1/6 步 `ERR_CONNECTION_REFUSED`；无视觉变化。checkpoint 识别消息：`feat(auth): add identity security foundation`。
- 发布与核验：checkpoint `297ec33` 已推送；迁移前备份 `e39ec634-be53-4536-891b-c729dee78aa6`（50 表、161448 行、76295676 bytes，SHA-256 `81f186d12654c15f5a93436ec7e51fe6260316c9453a9e6a60496a642e58899e`）后部署 release `297ec3356c9b7717cdb2c5f9c2326cfcfabca74c`。`ecs-verify.sh` 通过 44 migrations；生产精确补 5 个 locator、保留 9 个无凭证 null locator，24 个 hash 摘要不变，authVersion/appId/Union/nullability 全部符合门禁。最终状态 checkpoint：`docs(status): record p3 identity foundation deployment`。

## 2026-08-22 P3 身份安全预检

- 只读结论：identity 缺 appId、UnionID 直接唯一、未知 Mini 自动建号、匿名密码注册、真实注销和无版本 JWT 均与已批准 P3/ADR 冲突；引入点分别为 `12e7f40`、`39f9c66`、`de3ad5f`、`a837586`。
- 生产聚合：40 用户、24 密码身份、0 identity；5 个密码账号 locator 为 null 且有 active membership，当前登录错误拒绝；1 个无业务引用 legacy Mini stub；9 个无登录且无 active membership 的资料用户。只输出计数/配置存在性，无 PII/credential/secret。
- 顺序：P3-A 仅做 additive schema 和受限 locator backfill；之后才接 authVersion session、link-required、绑定/解绑和管理员/password proof。登录页/账号后台黄金稿为首个视觉暂停点。详细见 `apps/miniprogram/docs/architecture/p3-identity-security-preflight.md`。
- 验证：history/blame、schema/route/session 与生产聚合只读审计完成；任务格式/diff/`smoke:check-core` 通过，根 format 仅有既有/用户所有 11 项阻塞。本批无产品浏览器断言。
- 本批无代码/UI/Mini 产物变化；checkpoint 识别消息：`docs(miniprogram): record p3 identity preflight`。

## 2026-08-22 P2 共享核心完成审计

- 结论：P2 最小边界完成。Web 已先行采用 calendar/manual/publication presentation；calendar/holiday client、generated decoder 和错误语义；Mini 已复用 manual transition 与 `wx.request` JSON transport；tokens/fixtures/bundle 门禁齐全。domain runtime 只取 Zod-free metadata leaf。
- 明确延后：token/401 单飞重登到 P3/P4，幂等写/退避到 P5–P7，downloadFile/FileSystem 到 P9，迁移后新增 Web 功能到 P10；不提前扩张共享公共 API。
- 验证：P2 专项 14 文件/55 项、受控全仓 153 文件/842 项通过，32 文件/265 项跳过；Mini 15 文件/62 项与 verify/source/Worklet/package/determinism/CI dry-run 通过（147887 bytes，manifest `44e00e35fbbe675c4125484afb2f6ecb8ee7400c268afd731fb61b209dc251a8`）；任务格式/diff/`smoke:check-core` 通过，根 format 仅有既有/用户所有 11 项阻塞。默认测试误扫用户所有历史副本，显式排除后通过。
- 运行/浏览器验证：`pnpm smoke:browser` 在本机 5173 未启动时第 1/6 步 `ERR_CONNECTION_REFUSED`；本批仅阶段文档，无视觉变化。checkpoint 识别消息：`docs(miniprogram): close p2 shared core`。

## 2026-08-22 P2 scheduling-domain runtime barrel

- 引入点与红灯：`ae649b3` 为 health summary 从 contracts barrel 运行时取 `workspaceName`。bundle 守卫旧实现 1/2 失败，显示 23 个 contracts 源文件；summary 基线通过。
- 修复与等价：新增 Zod-free `@schedule/contracts/workspace-name` 子路径，domain 只改 import；health 字符串、同步调用、统计 type-only imports 和全部算法不变。修复后 runtime 仅含一个 metadata leaf，无 contracts index/Zod。
- 验证：定向 2 文件/3 项、受控全仓 153 文件/842 项通过，32 文件/265 项跳过；contracts/domain/根 build/typecheck/lint、任务格式、diff check 和 `smoke:check-core` 通过，根 format 仅有既有/用户所有 11 项阻塞。
- 运行/浏览器验证：`pnpm smoke:browser` 在本机 5173 未启动时第 1/6 步 `ERR_CONNECTION_REFUSED`；无视觉变化。checkpoint 识别消息：`refactor(domain): isolate runtime metadata`。
- 发布与核验：checkpoint `502bb85` 已推送并从精确干净 worktree 完成 production build/package；数据库备份 `d0eb57b2-e691-40c6-94f9-ddb317723dea`（50 表、161444 行、76293032 bytes，SHA-256 `8cdfebf62ed788ad401e24470ffc18cbc3f2d86a61d579eb5c5c8a27a9151aab`）后部署 release `502bb85d70b21c3a541cfdfbbdaea6ed9bb097e8`，预热首个 502 后恢复，`ecs-verify.sh` 完整通过并清理临时目录。最终状态 checkpoint 识别消息：`docs(status): record domain runtime deployment`。

## 2026-08-22 P2 Mini wx.request transport

- 红灯与范围：共享错误 API 旧实现 3/3 失败，Mini transport 因模块缺失失败；只实现月历/节假日 GET、status/auth/decode/error，不建页面、缓存、会话持久化、重登或重试。
- 实现与等价：contracts code 生成到 client-core；known/fallback/invalid/network 与 Web 逐字段等价。Mini bearer 读一次 token、public 不读，`wx.request` 成员调用一次，2xx 解码原对象，callback/sync throw 同映射；拒绝不包装重试。
- 体积与边界：三个逐文件入口的 183133-byte 中间实现未保留，合并单一 platform 入口后为 147887 bytes（+5070）。源码/产物继续无 Zod/contracts runtime、Node/DOM/fetch/Vue/数据库，无页面/WXML/WXSS/路由。
- 验证：共享/Web 4 文件/15 项、Mini 2 文件/8 项、受控全仓 152 文件/840 项通过，32 文件/265 项按环境跳过；client-core/Web/根 build/typecheck/lint 和 Mini 15 文件/62 项、verify/source/Worklet/package/determinism/CI dry-run 通过（manifest `219a4fbe51fa35bf2e64c7a06b02e542da216859568dbfcb71f4f15ccbb76144`）；任务格式、diff check、`smoke:check-core` 通过，根 format 仅有既有/用户所有 11 项阻塞。
- 运行/浏览器验证：`pnpm smoke:browser` 在本机 5173 未启动时第 1/6 步 `ERR_CONNECTION_REFUSED`；无视觉变化。checkpoint 识别消息：`feat(client): add miniprogram json transport`。
- 发布与核验：checkpoint `884512c` 已推送并通过精确干净 worktree 生成/build 门禁；体验版 `0.1.0-p2.20260822.48` 本地上传成功（50 个平台代码文件、38661 bytes，manifest `8bd158a8a7167737f696d587ed28b4749f16549c5d47ddae7a3c2e3114b8558c`），未审核、未正式发布。数据库备份 `9abd6e66-d9f8-4ea9-ba4d-9d045007d367`（50 表、161442 行、76291708 bytes，SHA-256 `d466606aa4232fe28ee23e66d1a79751db39b659b3ee4b1544c9f34440753fae`）后部署 release `884512c0a979a99b7971006f8a50e40b2ad12f03`；预热首个 502 后恢复，`ecs-verify.sh` 完整通过并清理临时目录。最终状态 checkpoint 识别消息：`docs(status): record miniprogram json transport deployment`。

## 2026-08-22 P2 client-core 月历读取边界

- 引入点与红灯：月历 `ab25064`、节假日 `48c6fdd`/`fbf59fa`、统一请求管线 `dd9981f`、fetch receiver `1c5d2c5`。Web/Mini 旧代码均因无 client-core 失败，Mini 真实边界入口追加红灯后实现。
- 实现与等价：新增 endpoint/transport/service/紧凑 decoder 和 Zod→JSON Schema 确定生成；Web 三方法委托共享 service，原 fetch/auth/offline/error 管线不动。路径编码、bearer/public、receiver、拒绝对象、调用次数、原响应身份及页面缓存/副作用保持；无重试。
- 生成与边界：生成器对未知 keyword/type 失败关闭，freshness 与 Zod 深等价通过；显式 ASCII hex 正则避免丢失 `i` flag。client-core browser bundle 与 Mini 8949-byte 输出无 Zod、contracts runtime、Node/DOM/fetch/Vue/数据库，Mini 无页面或网络。
- 验证：定向 5 文件/167 项、受控全仓 150 文件/829 项通过，32 文件/265 项按环境跳过；client-core/Web/根 build/typecheck/lint 通过。Mini 14 文件/56 项及 verify/source/Worklet/package/determinism/CI dry-run 通过（142817 bytes，manifest `fa75f52b0c78f7c14d42d1aaf5e037051326e8348adfc8e2f6f208c4268576c8`）；冻结 lockfile、任务格式、diff check 和 `smoke:check-core` 通过。根 format 仅有既有/用户所有 11 项阻塞。
- 运行/浏览器验证：`pnpm smoke:browser` 在本机 5173 未启动时第 1/6 步 `ERR_CONNECTION_REFUSED`；无模板/样式/页面变化。checkpoint 识别消息：`refactor(client): share calendar read boundary`。
- 隔离回归：`60cec6e` 推送后的精确 Windows worktree 因 CRLF/LF 原始比较误报 generated stale；未上传、未部署，生成的 release 包作废。换行测试旧实现 1/2 失败，统一 LF 后 2/2 与 check/build/typecheck/lint 通过；修正 checkpoint 识别消息：`fix(client): normalize generated schema line endings`。
- 发布与核验：修正 checkpoint `7b52ef8` 已推送并通过精确干净 worktree 门禁；体验版 `0.1.0-p2.20260822.47` 本地上传成功（50 个平台代码文件、38673 bytes，manifest `28ceb48c307f4d4ae704de6db71371e96cc7b0959e2fff061b9cb7e86750e60f`），完成后的遥测 TLS 断开不影响 exit 0 上传结果，未审核、未正式发布。数据库备份 `8a28f6c0-20ec-4c5a-99ac-1f2c1e4ded55`（50 表、161440 行、76290384 bytes，SHA-256 `28dde6c0bdd058388da04c38e6e55452f700cfc8211123f23cb97b73e854a151`）后部署 release `7b52ef8093cfcd95c7a90cfee16e1a946fd34c35`；预热首个 502 后恢复，`ecs-verify.sh` 完整通过并清理临时目录。最终状态 checkpoint 识别消息：`docs(status): record client-core calendar boundary deployment`。

## 2026-08-22 当前月撤回确认门禁

- 引入点与红灯：`927241c` 同时给 publish/withdraw 增加 `acknowledgePastDates` 禁用与提交守卫，但控件只在 publish 渲染。新回归旧实现 2/3 失败；重新发布双确认基线保持通过。
- 修复与语义：共享确认输入增加 action，只有 publish + past dates 检查第二日期确认；Vue script 和 confirm button 禁用条件同步限定 action。撤回仍要求可见的通用影响确认，重新发布仍要求通用+日期双确认；请求体、UUID、API 接收者、版本/幂等、异步错误和调用次数不变。
- 验证：回归 3/3、发布等价/边界 3 文件/11 项、受控全仓 146 文件/817 项通过，32 文件/265 项按环境跳过；presentation-core/Web/根 build/typecheck/lint 通过。Mini 13 文件/54 项及 verify/source/Worklet/package/determinism/CI dry-run 通过（133701 bytes，manifest `2fa6b96c62c44c32fcd1ec26626970ba801e894bd02656422ca2e61113d239ad`）；任务格式、diff check 和 `smoke:check-core` 通过。
- 运行/浏览器验证：`pnpm smoke:browser` 在本机 5173 未启动时第 1/6 步 `ERR_CONNECTION_REFUSED`；元素、文案和 style 不变，无视觉确认点。checkpoint 识别消息：`fix(web): allow current-month schedule withdrawal`。
- 发布与核验：checkpoint `b24db46` 已推送；本地 Node `miniprogram-ci` 从精确干净 worktree 上传体验版 `0.1.0-p2.20260822.46`（50 个代码文件、38661 bytes，manifest `012f71bed84a4bfd04c44a6426ac7b2453f767be7c01fec625fc483da19ec2dc`），未审核、未正式发布。数据库备份 `b021d3b4-4582-4607-86b2-63c49bb7c79e`（50 表、161438 行、76289064 bytes，SHA-256 `4b8a59e5b85235d74829a91a65f3ade8b7295f5ac2f0c85ea6ee4c7547974efd`）后部署 release `b24db461d77a839a23410f1d696662347338733a`；预热首个 502 后恢复，`ecs-verify.sh` 完整通过并清理精确临时目录。最终状态 checkpoint 识别消息：`docs(status): record current-month withdrawal deployment`。

## 2026-08-22 P2 发布生命周期共享

- 引入点与红灯：草稿批次/历史分组/批量发布来自 `2834f07`，发布/撤回/重发与确认来自 `7c783c7`/`968c6c5`，过去日期门禁来自 `927241c`。共享导出、黄金语料和 Web 接线旧代码 6/6 失败，实现后定向 4 文件/24 项通过。
- 实现与等价：共享核心只接收结构化历史、注入业务时钟和布尔确认状态，输出新分组数组或不含 `operationId` 的请求 intent。对象身份、输入顺序、`??` 空字符串、`localeCompare`、当前/过去/归档/未分类状态、时钟调用次数与确认短路保持；API 成员调用、UUID、冲突刷新、错误/catch/finally 和 UI 状态继续在 Web。
- 边界与验证：生产源无 contracts/Zod、Vue/Pinia/Router、DOM/fetch、Node、数据库或 scheduling-domain；presentation-core/Web/根 build/typecheck/lint、受控全仓 145 文件/814 项通过，32 文件/265 项按环境跳过。Mini 13 文件/54 项及 typecheck/verify/source/2 Worklets/package/determinism/CI dry-run 通过（133701 bytes，manifest `910f561f32385a6ee1f3b64d92133cae5cd0650d6e2d816e441700c65c5b8cfe`）；默认 Mini 命令只被用户所有 ignored ECS runner 副本的 17 项基线失败干扰。任务格式、diff check、`smoke:check-core` 通过，根 format 只被既有/用户所有文件拦截。
- 运行/浏览器验证：`pnpm smoke:browser` 在本机 5173 未启动时第 1/6 步 `ERR_CONNECTION_REFUSED`；SFC template/style 与 `HEAD` 逐字相同，无视觉变化。
- 后续回归：审计确认 `927241c` 起当前月撤回含过去日期时存在隐藏 `acknowledgePastDates` 门禁；本轮按等价要求未修。下一 checkpoint 先以独立红灯测试把第二日期确认限定为重新发布。当前 checkpoint 识别消息：`refactor(presentation): share publication lifecycle`。
- 发布与核验：checkpoint `3be831b` 已推送；本地 Node `miniprogram-ci` 从精确干净 worktree 上传体验版 `0.1.0-p2.20260822.45`（50 个代码文件、38664 bytes，manifest `b3df47f67ce38390cfda991a0e20630b0fcec068518b3777a51d789a2ecc7c47`），未审核、未正式发布。数据库备份 `4b60a85e-df68-4c3e-b734-1dd7c573e24e`（50 表、161436 行、76287740 bytes，SHA-256 `ff99363572bfe77b909d94e0be6d0dc8ade962eed40ff418431be3eaad8ba1f1`）后部署 release `3be831be71a9662d9cb48eea8d693d24ba5077cd`；预热首个 502 后恢复，`ecs-verify.sh` 完整通过并清理精确临时目录。最终状态 checkpoint 识别消息：`docs(status): record p2 publication lifecycle deployment`。

## 2026-08-22 P2 手排 transition、选择与撤销共享

- 引入点与红灯：`git log -S`/`git blame` 定位 Web 快照撤销/选择为 `6512274`，涂抹模式为 `b1ce5c7`/`25bb8fa`，Mini 增量 undo 为 `6cc7463`。共享导出旧代码 5/5 失败，Web 接线 1/6 失败，Mini 依赖接线 1/1 失败，随后分别转绿。
- 实现与等价：共享核心提供泛型 Map mutation、apply/revert、行列清除、snapshot stack 和 `toggle|replace` 模式。Web 保持同格取消选择、同班种清除和完整快照；Mini 保持 replace 选择、单格 `{key,before,after}` 与局部 `setData`。undo 仍只恢复 cells；无 `this`/异步/错误变化，replace 不调用 equality callback。
- Mini 边界：package、tsc、esbuild 与 Vitest 均使用共享源码；移走 shared dist 后 Mini typecheck/build 通过。产物继续通过 DOM/Node/Zod/数据库/绝对路径审计，包体 133701 bytes，determinism manifest `97f0ab994df01736b613c5d3e9b8379db82d40053a004a4bdcf0c542392c24e4`。
- 运行/浏览器验证：`pnpm --config.verifyDepsBeforeRun=false smoke:browser` 在本机 5173 未启动时第 1/6 步 `ERR_CONNECTION_REFUSED`；`smoke:check-core` 通过。Web SFC template/style 与 `HEAD` 逐字相同，无视觉变化。
- 验证：共享包/Web/根 build/typecheck/lint、手排/边界 4 文件 22 项、Mini 13 文件/54 项、受控全仓 141 文件/798 项通过，32 文件/265 项按环境跳过；Mini verify/source/Worklet/package/determinism/CI dry-run、任务 Prettier 与 `git diff --check` 通过。根 format 只被用户所有文件拦截。checkpoint 识别消息：`refactor(presentation): share manual transitions`。
- 发布与核验：checkpoint `42bcf49` 已推送；本地 Node `miniprogram-ci` 从精确干净 worktree 上传体验版 `0.1.0-p2.20260822.44`（50 个代码文件、38662 bytes，manifest `bf9a3f2d86142beced1e6c39761cc83880457f3b48ed0b685e6871831e08bbc7`），未审核、未正式发布。数据库备份 `1c623d16-9a19-48f3-872a-2d67841be221`（50 表、161434 行、76286416 bytes，SHA-256 `7f94a49b6235874605ffc189b0e054895ef64c10bd8d10ca3a421ce2ece834b1`）后部署 release `42bcf4992a834c042d9c355091919418f1574395`；预热首个 502 后恢复，`ecs-verify.sh` 完整通过并清理精确临时目录。最终状态 checkpoint 识别消息：`docs(status): record p2 manual transition deployment`。

## 2026-08-22 P2 日历共享核心 Web 先行迁移

- 引入点：`git log -S` / `git blame` 确认生产 5/6 周月网格来自 `abd20d2`，默认选择来自 `7c80488`，切月保持完整日期来自 `daf7ede`，日期分组和 CST 班次排序来自 `db35a77` / `b1ce5c7`，筛选及实际人员优先来自 `ab25064`。
- 测试先行与实现：新增旧 Web/共享实现黄金等价测试，旧代码因不存在 `@schedule/presentation-core` 先失败；新包只包含纯日期字符串、月周网格、选择、节假日、筛选/分组/排序和列表 ViewModel。Web 原 feature 模块变为兼容适配层；Vue 模板/样式、API/cache、异步、错误与调用次数不变。
- 语义审计：抽取函数无 `this`；错误消息、`??`（含显式空字符串）、泛型 DTO 身份、输入数组顺序、分组内排序和无额外副作用由 6 组等价测试锁定。运行边界测试证明 ES2020 browser bundle 只有包内输入且无 contracts/Zod、scheduling-domain barrel、Vue/Pinia/Router、DOM、fetch、Node 或数据库。MonthGrid/WeekGrid 字节哈希保持。
- 运行/浏览器验证：`pnpm --config.verifyDepsBeforeRun=false smoke:browser` 已运行；本机 5173/3000/3306 无监听、Docker 不可用，在第 1/6 步 `ERR_CONNECTION_REFUSED`，未进入产品断言。`smoke:check-core` 通过，确认未触及强制核心链路文件；本轮无视觉源变化。
- 验证：共享包/Web/根 build 与 typecheck、根 lint、日历/边界 14 文件 67 项、受控全仓 139 文件/791 项通过，32 文件/265 项按环境跳过；Mini verify/source/Worklet/package/determinism/CI dry-run、任务 Prettier 和 `git diff --check` 通过。根 verify/format 只被用户所有配置、目录文件和 Storybook 生成物阻断。checkpoint 识别消息：`refactor(presentation): share calendar core with web`。
- 发布与核验：checkpoint `ca16d7e` 已推送；本地 Node `miniprogram-ci` 从精确干净 worktree 上传体验版 `0.1.0-p2.20260822.43`（50 个代码文件、37872 bytes，manifest `7d6cf8febb025c7cd608638401c9dbc3693188c70b63cf3c962cec8578e73a4b`），未审核、未正式发布。数据库备份 `12899cc6-e6ad-4913-9ae1-0da3af2da1bd`（50 表、160997 行、75531784 bytes，SHA-256 `34a0e656ff0720ccd38f274265d7acbb38f10f63c3043fbc8618abc2feba8476`）后部署 release `ca16d7e3a77dd0e1a04ce23f363de93c7f6cb4fb`；预热首个 502 后恢复，`ecs-verify.sh` 通过并清理临时发布目录。最终状态 checkpoint 识别消息：`docs(status): record p2 calendar core deployment`。

## 2026-08-22 移动导出按钮空白

- 反馈与引入点：用户报告动作图标上线后移动端导出按钮为空白。`git log -S` / `git blame` 定位 `daff238` 的 `.shell-export-action span` 原本只隐藏文字；`b70bb99` 的动作图标以 `<span>` 为根，`fea129b` 接入后父级 scoped CSS 也把图标裁成 1×1。
- 测试先行与修复：新增 `shell-export-label`、直接子元素选择器和禁止宽泛 selector 的回归守卫；旧实现 1/5 失败，修复后 5/5。只把移动规则收窄为 `.shell-export-action > .shell-export-label`；20px SVG、导出 motion key、权限、点击一次打开 Sheet、API 与错误路径均不变。
- 运行/浏览器验证：`pnpm --config.verifyDepsBeforeRun=false smoke:browser` 已运行；本机 5173 无监听，在第 1/6 步以 `ERR_CONNECTION_REFUSED` 停止，未进入产品断言。390×844 Storybook 实测导出按钮 44×44、图标根/SVG 24×24、`clip-path: none`，点击后仍保持 24×24；正式域名同断点命中移动媒体规则，线上 CSS 精确包含 `.shell-export-action>.shell-export-label`、不含 `.shell-export-action span`，并保留 `.top-action-motion-icon` 的 20px 尺寸。正式账号只有成员群组，权限层不渲染导出按钮，本次未触发导出或其他业务写入。
- 验证：定向 2 文件/10 项、排除用户自有 `runtime/**` / `src/**` 后 141 文件/794 项通过，32 文件/265 项按环境跳过；根 lint/typecheck、Web typecheck/build、任务文件 Prettier/ESLint 与 `smoke:check-core` 通过。
- 正式发布与核验：checkpoint `993bdf4` 已推送；备份 archive `e186ef3e-f2aa-4658-b8dc-765a07873dc2`（50 表、157700 行、70980528 bytes，SHA-256 `95c0d57b6727080b5d65267fa0d9e63a9e753dcd4b04a3c152d3e8124f04f6da`）后部署 release `993bdf42b8052fcf0bab75e5e42bf48cd3f9d558`，预热首次 502 后恢复；`ecs-verify.sh` 通过健康、哈希、隔离、端口、容器、依赖和 43 条迁移，服务器 release/manifest 一致。当前状态：已完成并发布 → 待用户复核；最终状态 checkpoint 识别消息：`docs(status): record mobile export icon fix deployment`。

## 2026-08-21 Lucide Minimal 动作图标生产落地

- 用户确认与引入点：用户确认 Storybook 的静态保真点击动效并授权应用。`git log -S` / `git blame` 定位顶部通知/个人/导出分别来自 `abd20d2`、`0b7b1b8`、`daff238`，日历筛选/定位来自 `abd20d2`/`a1a732a`，通讯录模式来自 `046dc65`，现有电话图标来自 `8a49434`、`1c84fd6`、`8309dce`、`5437995`、`b09da6e`、`41d284b`、`f723b0d`。
- 测试先行与实现：生产共用源、顶部、日历、通讯录选中守卫和全部现有电话图标接线在旧代码上 7/7 失败，实现后转绿。Storybook 图标组件迁入生产 `components`，预览与应用引用同一 SVG/动画源；各入口只递增自己的 motion key，科室/人员已选中时先返回，电话拨号 `href`、使用次数记录和菜单展开保持原调用。
- 仅点击语义：审计发现简单使用 `motionKey > 0` 会让已点击过的定位图标在月/周/列表重新挂载时自动播放；追加守卫先失败后改为只监听组件挂载后的 key 变化。生产遵循 `prefers-reduced-motion`，Storybook 的 `previewMotion` 只用于确认稿强制演示。
- 运行/浏览器验证：`pnpm --config.verifyDepsBeforeRun=false smoke:browser` 已运行；本机 5173/3000/3306 均无服务且 Docker 不可用，因此在第 1/6 步访问登录页时以 `ERR_CONNECTION_REFUSED` 停止，未进入产品断言。真实生产 `UnifiedDirectoryView` Story 在 390×844 验证人员首次切换 key 0→1、重复点击仍为 1；真实 `SelectedDateDutyDetails` Story 只让被点电话 key 0→1，其他保持 0，两个链接仍为 `tel:61234` / `tel:13800138000`；确认稿导出峰值箭头向右上、外框向左下，Axe 违规 0。控制台无产品 error/warning，仅有 Storybook 11 的前向兼容提示。
- 验证：任务定向 9 文件/55 项及新增生产守卫通过；排除用户自有 `runtime/**` / `src/**` 后 140 文件/790 项通过，32 文件/265 项数据库集成按环境跳过；根 lint/build/typecheck、Web typecheck、完整 Storybook build、任务文件 Prettier/ESLint 与 `smoke:check-core` 通过。
- 正式发布与核验：代码 checkpoint `fea129b` 已推送；发布前加密备份 `7b782097-5e41-434b-895a-cc340187e16b`（50 表、157697 行、70978500 bytes，SHA-256 `f12b363391327c007581bc039e601d4dba3020e9aa94dfe68d6ff354baa895b7`）后部署 release `fea129bb15270c5c5a2d4405b2f9e0e9599e150b`，预热首次 TLS EOF 后恢复。`ecs-verify.sh` 通过 43 条迁移、产物哈希、域名/IP 隔离、端口和容器；正式首页/API 200，Web bundle 命中全部点击 keyframe 与静态源，API/契约/数据库/领域产物哈希不变。
- 当前状态：生产落地已完成并发布 → 待用户复核；最终状态 checkpoint 识别消息为 `docs(status): record action icon motion deployment`。

## 2026-08-20 移动常驻导航与科室电话行精简

- 反馈与引入点：用户指定移动常驻日历/通讯录/换班/我的，其余进入更多，并要求科室电话移除左侧标签、扩大号码空间。`git log -S` / `git blame` 定位移动入口由 `db35a77`/`0b7b1b8` 引入，电话标签和 62px 标签列由 `427ff6b` 引入。
- 测试先行与实现：旧实现导航/电话布局 2 项失败；主入口改按显式数组顺序输出 calendar/directory/swap/profile，secondary 自动接收请假等其余入口。科室模式不再渲染 contact-label，人员模式规则不变；长短号 gap 调整为 8px、窄屏 6px，号码仍 nowrap。职称循环仅改局部变量名以清除模板 shadow warning。
- 运行/浏览器验证：`pnpm --config.verifyDepsBeforeRun=false smoke:browser` 因本机 MySQL 127.0.0.1:3306 不可用，在管理员登录回退 `/login?redirect=/`。Storybook 390px 实测底栏 5 项顺序正确、更多页完整；科室“病案”结果在 390/320px 左侧标签为 0、gap 为 8px/6px、号码不换行、页面无横向溢出。
- 验证：定向 3 文件/25 项、主工作区 128 文件/752 项通过，31 文件/262 项按环境跳过；根 lint/build/typecheck、Web build/typecheck、Storybook build、任务文件 Prettier/ESLint、`git diff --check` 与 `smoke:check-core` 通过。格式全检只被用户配置/旧预览产物和已提交目录批次遗留文件阻断。
- 正式发布与核验：checkpoint `279c2fd` 网络恢复后推送；发布前加密备份 `52df93d2-293b-4c05-84d6-b386ae367e35`（50 表、131796 行、58820132 字节，SHA-256 `107b4d31ecc0dd9c4eeab1ff50cdd1ca195f854c28d5814bf1576c6fe80e2b37`）后部署 release `279c2fd2321f201973cf50fccc3361f8dff092e0`，预热首次 TLS 连接重置后恢复，`ecs-verify.sh` 通过 42 条迁移。正式首页/API 200，bundle 命中四项顺序和 8px/6px 号码间距；未写业务数据。
- 状态：已完成并发布 → 待用户复核；最终状态 checkpoint 识别消息为 `docs(status): record mobile nav and directory phone deployment`。

## 2026-08-20 个人数据与登录密码安全修复

- 反馈与引入点：用户要求手机号完整显示、修正个人统计、增加改密与初始密码登录提醒，并移除快速进入。`git log -S` / `git blame` 定位密码登录由 `de3ad5f` 引入、快速入口由 `0b7b1b8` 引入、统计单位/脱敏由 `ebd1b19` 引入；领域 `actualCount` 明确定义为班次数而不是天数。
- 测试先行：合约、默认密码判定、受保护状态/改密路由、哈希替换/审计、Web 客户端、会话恢复/提醒、个人页和生产弹窗在旧实现上共 12 项失败；`currentPassword` / `newPassword` 日志脱敏追加断言也先失败。实现后定向 8 文件/34 项、API 日志 10 项通过。
- 实现与语义：初始密码登录响应和恢复状态统一驱动一次登录内提醒；改密事务校验当前密码、生成新随机盐 scrypt 哈希并写无密码内容的审计。错误当前密码不更新；新旧相同拒绝；会话 token、资料、群组和业务权限不变。个人统计改用“次”，辅助请求部分失败不再整体归零；手机号完整展示，快速入口删除。
- 运行/浏览器验证：`运行/浏览器验证：pnpm --config.verifyDepsBeforeRun=false smoke:browser` 启动当前源码后因本机 MySQL 127.0.0.1:3306 不可用，在管理员登录回退 `/login?redirect=/`，未进入产品断言。Storybook 生产提醒/编辑两态在 390×844 实际操作通过，320px/390px 无横向溢出，字段 autocomplete 正确且输入/按钮/关闭触达均 44px；个人页完整手机号、统计“次”、快速入口 0 个。全程未输入或提交密码。
- 验证：主工作区 128 文件/753 项通过、31 文件/262 项按环境跳过；根 typecheck/build、Web/API/contracts typecheck/build、Storybook build、任务文件 Prettier/ESLint 与 `git diff --check` 通过。仅保留已提交目录批次的迁移计数测试 40→42 未同步和 2 个模板变量遮蔽 lint 警告，不纳入本认证 checkpoint。
- 正式发布与核验：checkpoint `664bc1f` 已推送；发布前加密备份 `e1c4985d-9519-42f1-8847-f1dbe9066c97`（50 表、131794 行、58818808 字节，SHA-256 `b4f59adc7f17864af2c693939890a1d37567a5fe3b866b89347f03389dfbf2c9`）后部署 release `664bc1f8a86ff2c342f7afe09213030ab2ede1cd`，预热首次 502 后恢复，`ecs-verify.sh` 通过 42 条迁移。正式首页/API 200，未认证密码状态端点 401，Web/API bundle 命中改密、初始密码提醒和正确统计口径；未登录、未输入或提交密码、未写业务数据。
- 状态：已完成并发布 → 待用户复核；最终状态 checkpoint 识别消息为 `docs(status): record profile password security deployment`。只读验证端点、bundle 和服务器 release，不替用户执行最终密码修改。

## 2026-08-19 员工通讯录移除 T9、增加工号搜索与电话行修复

- 反馈与引入点：用户要求去除低频 T9 搜索并增加工号搜索；同时完成上一轮“移动电话”标签占位导致号码换行的 UI 修复。`git log -S`/`git blame` 定位 T9 API/别名/提示均由 `9bc4922` 引入，电话卡片布局由 `926136a`/`b09da6e` 引入。
- 测试先行：新增员工搜索提示不得出现 T9 且必须包含工号、导入结果不得生成 T9 别名、API fixture 直接以 `employee_code=d0001` 搜索、迁移后枚举不得含 T9、电话行无移动电话标签且号码不换行断言；旧实现对应断言失败，实现后通过。
- 实现与语义：员工工号使用数据库字段精确/前缀排序（不依赖别名）；中文、拼音、首字母、号码和权限/分页保持。移除 T9 导入生成和数字匹配分支，迁移删除历史 T9 别名并收窄枚举；员工移动电话行改为号码全宽单列，固定电话标签仍保留。请求、Promise/catch、空值和副作用路径未改变。部署前发现 `ecs-verify.sh` 仍断言 40 条迁移，已更新为本批次迁移后的 41 条。
- 运行/浏览器验证：真实 MySQL API、导入、迁移 3 文件/21 项通过；Web/API/contracts/database typecheck、任务文件 ESLint/Prettier、`git diff --check` 通过。`SMOKE_BASE_URL=http://127.0.0.1:5173 node scripts/smoke-browser.mjs` 通过管理员、成员、访客/vkey、访问记录、员工中文/工号搜索及电话布局；`node scripts/smoke-browser.mjs --check-core` 通过，确认未涉及核心链路。
- 正式发布与核验：代码 checkpoint `427ff6b` 与部署验证修正 checkpoint `5704242` 已推送；发布前数据库备份 archive `6d798463-f2c1-4b22-a3c2-2e1c297ebead`（50 表、144597 行、62174612 字节，SHA-256 `157c51c67f0d5724687ef6b27beac82e33d2432a2dc187ec862723cfbd86796e`）；release `5704242e1b5aefb704f940c31668ee0f6f7343d0` 已部署，预热两次 502 后恢复，`ecs-verify.sh` 通过并确认 41 条迁移。正式域名 `/api/health` 200；生产 employee/internal 快照 1070/1073、341/359，1064 条 employee 记录含工号，T9 别名为 0、枚举不含 `t9`。仅执行只读核验，未写业务数据。
- 最终状态发布：状态文档 checkpoint `a840572` 已推送并部署；文档发布前数据库备份 archive `7f0bb519-b706-4b6d-a733-5d4a0b4f10ba`（50 表、106421 行、47263568 字节，SHA-256 `d7d802c24146957b10b4c08413095c8c07277fd6504bcce0e7429e3dc1d9c642`）；release `a8405721ddb35693c6fa480d536d02f1d079af28` 的健康、产物哈希、域名隔离、容器与 41 条迁移核验通过。随后状态文档收口 checkpoint 也已提交、推送并部署，服务器 `current-release` 与 Git `HEAD` 一致。
- 当前状态：已完成（含运行验证、代码发布、状态文档发布与线上只读核验）→待用户复核；不再开始其他实现任务。

## 2026-08-19 员工通讯录工号前缀优先配对（当前轮次）

- 反馈与引入点：在 `e92586b` 的姓名/部门配对基础上，用户要求同名候选优先 `d`/`g` 开头；本轮执行 `git log -S 'departmentCandidates.length === 1'` 与 `git blame infra/scripts/employee-directory-identity-matcher.ts`，确认原选择逻辑由 `e92586b` 引入。
- 测试先行：新增“同部门 `d`/`g` 与其他前缀并列时选唯一 `d`/`g`”及“无唯一 `d`/`g` 时保留空缺”回归用例；匹配器/清洗器定向 2 文件/8 项通过。
- 实现与语义：先使用部门候选池，再在候选池中筛选唯一 `d`/`g` 工号；无部门候选时维持唯一姓名回退；多个 `d`/`g` 或无候选均不写入。现有目录条目数、清单不新增人员、号码与搜索/权限行为不变。
- 数据结果：1070 条原目录保持不变，1015 条姓名+路径部门匹配，49 条唯一姓名补配，1064 条写入工号；0 条冲突，6 条无候选继续待人工核对。本机 manifest `employee-20260819-b443f8cc-ee8eefa6` SHA-256 `1b840957e3b4eb6a90a393297890335f961b5d9b854f2f34f10c1e8ff37354f6`，报告仍不含电话号码明细。
- 运行/浏览器验证：本轮任务未改动 Web 核心链路；排除用户自有 `runtime/**`、`src/**` 与小程序依赖缺失测试的主工作区 Vitest 111 文件/674 项通过（31 文件/262 项按环境跳过）；infra TypeScript、Prettier、任务文件 ESLint、`git diff --check` 通过。全仓原始扫描另有 7 个小程序测试因既有 `esbuild`/`miniprogram-simulate`/`pngjs` 依赖符号缺失失败，未修改依赖树。
- 正式发布与核验：代码 checkpoint `e5a6077` 已推送并部署；发布前备份 archive `95d2c1ba-a0bf-4395-a517-cc7d80c801e0`，release `e5a60777c9857cb87af91d9cb34e5cc239f7990c`，预热一次 502 后恢复，`ecs-verify.sh` 通过。数据发布前第二次备份 archive `0f1bb789-4c25-4604-9110-fa3b87afdbc4`；SSH stdin dry-run changed 4、warnings 0，原子批次 `b631ec70-cbec-4c8b-9abe-462b7ac20995` 替换旧员工批次，线上只读聚合确认 1070/1073/29724、1064 个工号和 6 条空缺，迁移数 40。
- 当前状态：已完成（含代码发布、数据发布、备份和线上只读核验）→待人工核对 6 条无候选内容；不自动填写人工结论。

## 2026-08-18 D/NP 固定班种分段状态提醒

- 需求与引入点：D 班午间间休、NP 班夜间值班房听班属于一个排班内的分段状态，现有 `shift_types` 和日历契约只保存单一起止时间；`git log -S 'formatShiftTimeRange'` / `git blame` 确认 `1c84fd6` 首次加入的选中日期详情只显示班种、人员和连续起止时间，未表达分段状态。
- 测试先行：新增 D 班 08:00–12:00/午休/14:30–17:30、NP 班 17:30–22:00/听班/次日07:00–11:00 边界用例；旧实现因 helper 不存在失败，实现后 3/3 通过。规则同时校验简称、中国标准时间起止值和精确持续分钟，编辑为其他时段的同名班种不会误套固定说明。
- 实现与语义：日历详情始终保留排班人员、岗位、电话、事件和“已排班/有变更”状态，仅追加分段说明；班次进行中每分钟更新“在岗中 / 午间间休 / 值班房听班中”标签。排班 API、数据库、班种配置、统计、生成、换班/请假/加扣班、事件、错误路径和调用次数均未修改。
- 运行/浏览器验证：`运行/浏览器验证：pnpm --config.verifyDepsBeforeRun=false smoke:browser` 在 `AUTH_DEV_MODE=true` / `VITE_AUTH_DEV_MODE=true` 当前源码服务通过管理员、成员、访客/vkey 与访问记录全流程，无浏览器错误；首次仅因 5173 服务未启动而连接失败，启动后原样复跑通过，截图目录 `C:\Users\eylin\AppData\Local\Temp\schedule-smoke-2eLV2J`。
- 专项视觉与验证：Storybook 390×844 实测 D/NP 两条说明完整换行、页面 `scrollWidth = clientWidth = 390`、电话/事件按钮均为 44px；当前 23 点 NP 显示“值班房听班中”，人员姓名与联系方式保留。主工作区排除用户自有 `runtime/**` / `src/**` 后 Vitest 119 文件/698 项通过（31 文件/261 项按环境跳过）；Web typecheck/build、Storybook build、任务文件 Prettier/ESLint 通过。原始 Vitest 会重复扫描 `runtime/` 历史 release 副本并暴露其 6 项旧断言失败，本轮未修改这些副本。
- 正式发布与只读复核：代码 checkpoint `81e44f7` 已推送；发布前加密数据库备份 archive 为 `8865ad86-a90c-4cc0-898c-a7b007be9b2a`（50 表、18,505 行、7,376,160 字节，SHA-256 `d6e48163573fd7f01dcf65b0c0382c235ded67bbab386c66440c93d113306929`）。从独立干净 worktree 构建并部署 release `81e44f74d0c052a4f667d534390768e7097d0168`；容器预热首个健康检查短暂 502 后自动恢复，`ecs-verify.sh` 通过。正式 D0796 群主会话正常加载现有空排班月历，未写业务数据；正式 Web bundle 精确包含分段状态实现，公开 API 200，Git 本地、`origin/main` 与服务器 `current-release` 一致。
- 当前状态：已完成（含生产发布与线上只读核验）→ 待用户复核；最终状态 checkpoint 识别消息为 `docs(status): record split shift status deployment`。

## 2026-08-18 通讯录空闲态、收藏卡片与拨号触控蓝框

- 反馈与引入点：用户要求未搜索/筛选时只显示收藏、常用，检索时结果在前；优先卡须与普通卡一致；导览置顶并移除“院内协作”胶囊；拨号触控后不得残留蓝框。`git log -S` / `git blame` 指向 `8309dce` 的标题/顺序及拨号 hover/active 规则、`5437995` 的紧凑优先卡与结果前置，号码高密度结构由 `926136a` 延续调整。
- 测试先行：有效查询 helper、无初始空查询、结果/优先区顺序、完整卡片复用、顶部顺序和触控 CSS 断言在旧实现 4 项失败；实现后通讯录/Storybook 定向 9 文件、41 项通过。
- 修复与语义审计：空闲初始化只加载 facet 与受权限约束的偏好 UUID lookup；搜索或筛选有效才调用 `searchDirectory`，清空会递增请求序列、清除游标/结果/加载状态，迟到 Promise 不再落盘。接收者绑定、查询参数、错误 catch、分页、同号合并、收藏 UUID/次数/时间及拨号使用记录次数不变。优先区直接复用完整结果卡 DOM/CSS；结果区先渲染，优先区随后渲染。
- UI/可访问性：移除可见标题胶囊，保留隐藏 `h2`；导览在搜索上方。拨号关闭 WebKit tap highlight，`:active` 透明，hover 限于 `(hover: hover) and (pointer: fine)`，键盘 `focus-visible` 保留 2px 描边。
- 运行/浏览器验证：`运行/浏览器验证：pnpm smoke:browser` 最终通过全部管理员、成员、访客/vkey 和访问记录，无浏览器错误。初次失败来自验证器把已存在的收藏卡误当作新搜索结果；改为等待 `.directory-search-results .directory-entry` 与“找到”状态后复跑通过。实际页面初始结果 0；“病案”5 条；收藏卡长短号与原结果一致且在其下方；清空后只保留收藏。390×844 无横向溢出，拨号目标 44px、透明背景。
- 验证：Web typecheck/build、Storybook build、任务文件 Prettier/ESLint、定向 Vitest 与任务差异检查通过。完整 `pnpm verify` 仅被既有用户所有的 `apps/miniprogram/project.config.json` 格式问题拦截，本轮未修改该文件或并行小程序、`runtime/`、`src/`。
- 正式发布：代码 checkpoint `b09da6e` 已推送；正式 ECS 发布前备份 `6245db84-5500-4ee7-8acf-340587de7b03`（50 表、18,491 行、7,366,940 字节，SHA-256 `e4a7a0bf5f22fdadba11e98957cd2eaec6e7ff834f909140b908f9a8188e70ca`）后，从干净 worktree 构建并部署 release `b09da6e24d2f5bbe5818b61cc5e8ad2a0d794608`。首个健康检查短暂 502 后自动恢复，`ecs-verify.sh` 通过。首次主机探测只在遗留 ECS 生成一份可恢复备份、未部署任何产物；随后以线上上一 release 精确确认正式 ECS，未对遗留环境做其他变更。
- 正式域名只读复核：D0796 群主会话初始结果区/全量卡片均为 0，导览在搜索上方且无旧胶囊；“病案”返回 5 条，首卡显示长号与短号。390×844 无横向溢出，拨号目标 44px、背景透明；清空后重新为 0 结果，浏览器 error/warning 为 0，未改收藏、筛选或业务数据。
- 状态：已完成（含生产发布与线上只读复核）→ 待用户复核；最终状态 checkpoint 识别消息为 `docs(status): record directory idle deployment`。

## 2026-08-18 月份切换后选中日期与值班详情错配

- 反馈与引入点：翻月后蓝框视觉位置保留，但详情日期与班次/时间不再对应。`git log -S` / `git blame` 指向 `628c79f`：该轮取消翻页重置选择，却没有把旧选中日号重定向为目标月份的完整日期。
- 测试先行：新增日期重定向和生产接线用例，旧实现 2 项失败；实现后定向 52/52。覆盖普通月份、31 日进入 2 月、闰年 2 月和桌面年月选择器入口。
- 修复与语义：`setBusinessMonth` 在写入月份前同步完整 `selectedDate`，详情仍以完整日期精确分组，不按日号模糊匹配。短月份只夹到月底；API、缓存、筛选、事件、Promise/catch 范围、空值和调用次数不变。
- 运行/浏览器验证：`运行/浏览器验证：pnpm --config.verifyDepsBeforeRun=false smoke:browser` 在当前源码 5174 服务通过管理员、成员、访客/vkey 与访问记录。390×844 选中 8 月 14 日后切到 9 月，蓝框和标题均为 9 月 14 日且 0 班；返回 8 月恢复对应全天班、姓名与 08:00–08:00 时间。Web typecheck/build、任务文件 Prettier/ESLint 与 diff check 通过；全仓仅并行小程序基础组件 5 项缺文件失败。
- 正式发布与只读复核：checkpoint `daf7ede` 已推送；发布前加密备份 `22fa6662-a451-43de-ba7d-ca0b16177e04`（50 表、18,482 行，SHA-256 `33eb553c4321aa7364f4d0d3cc2ff3a1c7a4ab358f30697b436a766de9615ce9`）后部署 release `daf7ede9cd7a47e92f4c1bb8a989fb54d9aab0b0`，`ecs-verify.sh` 通过。正式 390×844 下 8 月 14 日切到 9 月再返回，蓝框、标题和 0 班详情始终使用同一完整日期；现网无排班分支与本地有班次/时间分支共同覆盖，未触发业务写入。
- 状态：已完成（含生产发布与线上核验）→ 待用户复核；最终状态 checkpoint 识别消息为 `docs(status): record calendar detail binding deployment`。

## 2026-08-18 通讯录动态导览、收藏与常用优先区

- 反馈与引入点：无数据“楼宇”仍显示、七级导览依赖横滚且按钮只打开 Sheet 不定位，均由 `8309dce` 引入；层级联动和同号合并来自 `926136a`。已对 `wayfinding-ribbon`、`filterSections`、`updateDirectoryFilterSelection` 和卡片调用点执行 `git log -S` / `git blame`。
- 测试先行：空/单选层级、冗余下级清理、受权限 ID 批量恢复、收藏/常用最小化持久化、无横滚定位与优先区断言在旧实现上 6 项失败且 1 个模块缺失；实现后定向 6 文件/173 项、真实 MySQL 通讯录路由 5/5 通过。
- 实现与安全：导览和筛选 Sheet 只渲染当前兼容选项大于 1 的层级，改变上级时同时清除不兼容或已无筛选意义的下级。收藏按群组保存在浏览器本地，仅含条目 UUID、使用次数和最后使用时间，不保存名称或号码；刷新后通过 `/groups/:groupId/directory/lookup` 按当前成员权限读取，管理员可见条目不会被成员偏好恢复绕过。
- UI 与交互：`frontend-design` 延续医疗蓝白“院区站点”语言；390px 导览为两列紧凑网格、桌面自动适配，无水平滚动。点击任一层级会打开筛选 Sheet、滚动并把焦点放到相应区段；卡片右上角 44px 五角星可收藏/取消，导览下方按“收藏通讯录”“常用通讯录”显示快捷卡。
- 运行/浏览器验证：`pnpm smoke:browser` 在当前源码 5173 服务通过管理员、成员、访客/vkey 与访问记录全流程；首轮仅因服务未启动连接失败，启动当前源码后原样通过，截图目录 `C:\Users\eylin\AppData\Local\Temp\schedule-smoke-GHywhh`。Storybook 390×844 实测 6 个有效层级、楼宇层级为 0、两列无溢出；收藏优先区可逆，点击“科室”后活动焦点为 `directory-filter-department` 且楼宇区段为 0。全仓 Prettier/ESLint/build 通过，非集成 Vitest 110 文件/660 项通过（31 文件/261 项按环境跳过），Web/API/contracts typecheck、Storybook build、`pnpm smoke:check-core` 与 `git diff --check` 通过；全仓 typecheck 曾短暂命中并行日历文件已引用但尚未导出的 helper，该并行改动收口后 Web typecheck 原样复跑通过，本轮未修改其文件。
- 追加反馈与引入点：筛选 Sheet 偏矮、说明块占位、清除按钮不够易达且级别无法收起。通用移动 Sheet 的 78dvh 上限由 `5b00fa7` 引入，通讯录说明块/并排清除布局由 `926136a` 引入；追加源码回归断言在旧实现准确失败 1 项。
- 追加实现：仅对通讯录 Sheet 提高到移动端 92dvh/桌面最高 840px；删除“层级联动”等说明，自动清理状态保留为无障碍 live region。清除全部是顶部 sticky、内容区全宽的无阴影扁平按钮；每级标题整行 48px 可折叠，右侧方向符号旋转并提供 `aria-expanded/controls`，用户折叠选择在会话中保留，导览定点进入会先展开目标。
- 追加验证：`运行/浏览器验证：pnpm --config.verifyDepsBeforeRun=false smoke:browser` 通过完整管理员、成员、访客/vkey 和访问记录链路。Storybook 独立 390×844 画布测得 Sheet 776.47px、清除按钮/工具栏同宽 328px、折叠后选项 client rect 为 0、无横向溢出且 console error 为 0；全仓非集成 112 文件/669 项通过（31 文件/261 项跳过），Web typecheck/build、Storybook build、任务文件 Prettier/ESLint、`pnpm smoke:check-core` 与差异检查通过。
- 正式发布：动态导览/收藏 checkpoint `5437995` 与追加筛选 Sheet checkpoint `ee1296e` 均已推送。发布前加密备份 `2ab960ac-9286-4aba-9a2b-db5393697d00`（50 表、18,486 行、7,364,076 字节，SHA-256 `dabd9e4219cd66cba9ad3e75149d1c5d71c386b266c8541fc19982d9bf11b5e5`）后部署 release `ee1296ebff0dd4d6bdd49d511be97180f7ef8a05`；容器预热首个 HTTPS 探测短暂失败后自动恢复，`ecs-verify.sh` 通过。
- 正式域名只读复核：D0796 群主会话在 390×844 下实测 Sheet 375×776.47px，清除按钮与 sticky 工具栏同宽 328px；6 个级别均有 disclosure 语义，院区折叠后选项高度为 0，再展开正常。点击导览“片区”后 Sheet 打开、滚动 210px并把目标级别放入可视区，目标保持展开；无旧说明、无横向溢出，浏览器 error/warning 为 0，未触发业务写入。
- 状态：已完成（含生产发布与线上只读核验）→ 待用户复核；最终状态 checkpoint 识别消息为 `docs(status): record directory filter deployment`。

## 2026-08-18 统计页年度入口未使用统一时间选择器

- 反馈：统计页面切换“按年”后仍弹出浏览器原生年份列表，没有应用新版滚轮选择器。
- 引入点：`git log -S '<select v-else' -- apps/web/src/views/statistics/StatisticsView.vue` 与 `git blame` 指向 `36127b0`；`git log -S 'TemporalPickerKind'` 确认 `92038cd` 的统一选择器只声明 `month | date | time`，因此年度入口未在当轮迁移范围内。
- 测试先行：年度统一选择器源码回归用例在旧代码上准确失败（1 failed/5 passed）；ResizeObserver 空值断言也在旧实现准确失败。实现后定向 7/7、全仓 651/651 非集成测试通过。
- 修复与语义审计：新增单列 `year` 滚轮并复用既有触控滚动；统计页保留数字 `year` 作为 API 参数，只用 computed 做字符串 v-model 转换。`update:modelValue` 先更新数值，随后 `change` 执行原有 `load`；取消不 emit，错误路径、空值降级、统计接口及调用次数不变。
- 伴随修复：浏览器切换月/年后触发 `ResizeObserver.observe(null)`；`git blame` 指向 `6ec287d` 的 `undefined` 单值判断。新增回归断言先失败，再以 `instanceof HTMLElement` 同时保护滚动状态读取和 observe，不改变 observer 的创建/断开或滚动提示逻辑。
- 运行/浏览器验证：`pnpm smoke:browser` 通过管理员、成员、访客/vkey 与访问记录全流程。390×844 年度弹窗为 341×416px、单列滚轮 168×188px、触发区 44px，无原生 select/横向溢出；取消动画结束后弹窗为 0、`aria-expanded=false`、年份仍为 2026，浏览器 error/warning 为 0。Web typecheck/build、Storybook build、任务文件 Prettier/ESLint 和排除用户自有副本的全仓 Vitest 已通过。
- 正式发布与只读复核：checkpoint `ea5ad1c` 已推送；发布前备份 `5b8c8c5a-087c-4f4a-b796-206cd7e72f6b`（50 表、18,479 行），release `ea5ad1c6b80f30d2bddde64cff6be0db95973f34` 已部署且 `ecs-verify.sh` 通过。正式 390×844 量测与本地一致，取消关闭正常且日志为空，未触发业务写入。

## 2026-08-18 通讯录层级互斥、紧凑卡与同号合并

- 引入点：`git log -S 'filters.floor'`、`git log -S '清除全部'` 与 `git blame apps/web/src/views/directory/InternalDirectoryView.vue` 确认原平铺筛选、底部清除和号码分行布局由 `8309dce` 引入。
- 测试先行：层级路径契约/接口、祖先约束与自动清除、同号集合分组、Storybook/生产接入和 browser smoke 源码断言均先红后绿。最终定向 321/321、真实 MySQL 路由 4/4、全仓非数据库测试 105 文件/635 项通过。
- 行为：新增无号码的角色安全 facet paths；跳级筛选不强制补父级，改变上级仅清除不兼容后代。同号仅在类型、完整号码和短号的完整集合一致时合并，格式符/标签/顺序不影响；部分相同、类型不同、短号不同、无号码保持分开。CSV、数据库、来源和权限语义均不变。
- UI：清除全部上移并在 Sheet 顶部 sticky；长短号同排、路径/位置去重、单号码卡约 103–104px；合并卡保留全部名称、场景和备注。Storybook 合成 6 条显示为 5 卡/1 组合并，390px 无横向溢出。
- 运行/浏览器验证：`运行/浏览器验证：pnpm smoke:browser` 第三轮通过完整管理员、成员、访客/vkey 和访问记录链路，通讯录真实同号条目合并及七级联动专项均通过；前两轮分别停在既有手动排班固定列抖动和通知页瞬时空元素错误。Web/API/contracts typecheck、生产 build、Storybook build、任务文件 Prettier/ESLint 与 `git diff --check` 通过。
- 正式发布：checkpoint `926136a` 已推送；备份 `d35a8061-95ca-4e6b-b013-ea3bb58cec5f`（50 张表、18422 行、SHA-256 `4a3cb90cca407914612bb9e1ea023be9c07a5443812b6018a9fb832e1c9d66f4`）后部署 release `926136a8a4c380d812304708b1917d4b939b1eef`，`ecs-verify.sh` 通过；后续 release `3884713` 继续包含该代码。
- 正式只读复核：341 条原始记录可见；“手术室”结果为 4 卡/2 组合并，护士站和护士值班房名称均保留，卡高 119–120px、拨号目标 ≥44px、无横向溢出。“放疗中心”后改“饶平路院区”自动清除片区并提示，Sheet 不关闭，顶部清除位置正确；结束后已恢复排班日历，未写入业务数据。
- 状态：已完成（生产发布与只读核验）→ 待用户复核；最终状态 checkpoint 识别消息为 `docs(status): record linked directory deployment`。

## 2026-08-17 日期正圆标识与触控数字滚轮精修

- 回归定位：`git log -S '.date-grid button'`、`git log -S '.wheel-column button.is-selected'` 与 `git blame` 确认生产日期整格着色、34px 滚轮行和浅蓝选择框由 `92038cd` 引入。
- 测试先行：新增生产组件断言后旧实现 1 项失败/2 项通过；实现后生产组件与确认稿 5/5、Web 422/422、主工作区全仓 611/611 通过，数据库集成按默认环境跳过 256 项。
- 修复与语义：日期可见选中层独立为 36×36 圆；滚轮改为 44px 无框数字行、中心双分隔线、上下淡出、`touch-action: pan-y` 和移动惯性。分钟按合法集合循环且保留非步进旧值；取消、清除、完成、事件次数、日期边界、错误与焦点路径不变。
- 运行/浏览器验证：`pnpm smoke:browser` 包装器受 `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY` 阻断，等价入口 `SMOKE_BASE_URL=http://127.0.0.1:5174 node scripts/smoke-browser.mjs` 在当前源码服务通过管理员、成员、访客/vkey 和访问记录全流程，截图目录 `C:\Users\eylin\AppData\Local\Temp\schedule-smoke-ZIMJQO`；`node scripts/smoke-browser.mjs --check-core` 通过。320/390/1280 Storybook 几何、滚动结算、提交语义、无溢出和 Axe 0 违规均通过。
- 正式发布与核验：checkpoint `d29bb49` 已推送；部署前加密备份 `31f078ab-ee9b-4b6b-b6ca-66885f3b33af`（50 张表、16933 行，SHA-256 `048cefa2729fae44673ac40f0c8fa3e595511e3523bc9579c845e46ac33099a8`），release `d29bb4981bd94a4f3ede4299c7d1be7ef718b33a` 已部署，`ecs-verify.sh` 通过。正式域名只读复核确认日期标识 36×36 正圆、滚轮 188px/44px 行、透明选中态、月份和分钟单步结算、取消不写值、页面无横向溢出；所有草稿均取消，未触发业务写入。
- 当前状态：已完成（含生产发布与线上只读复核）→ 待用户复核；最终状态 checkpoint 识别消息为 `docs(status): record temporal wheel deployment`。

## 2026-08-17 通讯录短号六位上限与来源疑点处理

- 回归定位：`git log -S 'normalizePhoneValue' -- infra/scripts/directory-import-core.ts` 与 `git blame` 确认 `6f22319` 将完整号码和短号共同限制为 3–20 位，使来源短号栏的 8 位值能通过校验。
- 测试先行：新增 7 位短号必须拒绝且错误不得回显号码的断言；旧实现 1 项失败、12 项通过，修复后导入核心 13/13、隔离 MySQL 发布/回滚 2/2 通过。
- 修复与语义：完整号码仍允许 3–20 位，短号独立限制为 3–6 位；字符校验、NFKC 归一化、错误路径、事务和审计输出不变。修正后本地清单删除 4 个超过 6 位的短号值，疑似不一致的 1 个条目改为 `manually_verified`，完整号码、来源定位和本地 `source_text` 不变。
- 数据验证：修正后仍为 341 个条目、359 个联系方式、4488 个搜索别名；短号越界、孤儿外键、重复 ID、缺失号码和 `needs_review` 均为 0，11/11 校验和与两份来源 PDF 哈希一致；manifest SHA-256 为 `8df470f6e8e379f61d5d97e04d865885b011153b07678af24c9641ad71495e75`。
- 正式发布与核验：checkpoint `2744d76` 已推送并部署；发布前备份 `a8e21d39-4e2d-4c4f-9eaa-38fde8382d2e`，数据发布点备份 `0c74fdc0-92e0-46ca-9a9e-bfb91b374645`。批次 `87ee90fa-464d-45bf-86a4-cd17c2cbf23f` 原子发布后，生产 341/359/4488 与清单哈希一致，短号越界、缺失号码、告警均为 0；中文 ngram、拼音/首字母和号码/短号前缀探针通过，发布后 `ecs-verify.sh` 通过。
- 当前状态：DIR-02 已完成；并行 `d29bb49` 已由 UI 批次完成生产部署和只读核验，可与本轮最终状态记录一并形成 checkpoint，下一活动批次为 DIR-03。

## 2026-08-17 手机日历导航触态与滑动圆角分层修复

- 回归定位：`git log -S 'class="week-step"'` / `git blame` 确认月周导航来自 `8a49434`；移动格子底角来自 `c64f0d7`；拖动中 `.is-swiping` 圆角切换来自 `acd2507`。旧实现把移动背景和选中描边耦合，六行/月与五行/月交接时会让格子自身的透明圆角露出底层灰色，周格选中圆角则在拖动结束后重新出现。
- 测试先行：新增固定卡片裁切、移动格背景必须方形、选中伪元素独立圆角、原生导航按钮、触摸按压/取消清理及无 hover 残留断言；旧代码先失败。浏览器首次真实 touch 又证明单独 `:active` 不可靠，随后证明混合输入恢复 mouse 能力会让最后触点命中 hover；两项均先补失败断言再修复。
- 修复与语义：固定卡片继续承担圆角裁切，月/周格背景不再带底角；蓝框使用 `pointer-events: none` 的 `::after` 一次绘制，拖动时不再切换圆角类。月/周切换改为无组件内部状态的 44px 原生按钮，月/周/列表定位按钮共用短生命周期 `is-touch-pressed`，松手/取消清理；移除 hover 背景，键盘 `:focus-visible` 保留。原生 scroll snap、月份/周次、面板高度、详情、筛选和 API 均未改变。
- 运行/浏览器验证：`node scripts/smoke-browser.mjs` 在当前源码 5174 服务以真实 CDP touch 通过；检查按钮按住可见、松手后透明且无阴影/缩放/焦点残留，2026-08→09 半拖动无灰色反圆角，月历 8 月 31 日和周历左边界蓝框圆角同步完整。管理员、成员、访客 vkey 与访问记录全流程无浏览器错误，截图目录 `C:\Users\eylin\AppData\Local\Temp\schedule-smoke-ORNaq6`。
- 验证：日历定向 18/18、全仓 Vitest 90 文件/584 项通过（29 个数据库集成文件/253 项按默认环境跳过），Web typecheck/build、Storybook build、全仓 Prettier/ESLint、`node scripts/smoke-browser.mjs --check-core` 与 `git diff --check` 通过。`pnpm --config.production=false verify` 在进入实际脚本前要求删除并重装全部依赖目录，已拒绝该破坏性环境动作并用当前本地二进制逐项执行同范围门禁。checkpoint 识别消息为 `fix(web): stabilize mobile calendar controls and corners`。
- 正式发布：代码 checkpoint `0aaa562` 已推送；发布前加密备份 `1e04e2cc-4d73-4f85-9033-9227aa676767`（44 张表、11142 行，SHA-256 `1bd1d9e97244c3646f7ff1066ed2bb70aa098f1a66e596dcda10807562278c38`），release `0aaa5620616cda90dbd863656adb4ac0ae5c8c82` 已部署，发布前后 `ecs-verify.sh` 通过。
- 正式域名只读复核：390×844 月历外卡为 18px 圆角并统一裁切，2026-08-31 左下选中伪元素为 17px 圆角；周历 2026-08-17 左下选中伪元素同为 17px 圆角。左右按钮和定位按钮静止态均为透明背景、无阴影，截图无灰色反圆角或分步出现的蓝框；未触发业务写入。
- 状态：已完成（含生产发布与线上核验）→ 待用户复核。最终状态 checkpoint 识别消息为 `docs(status): record calendar touch and corner deployment`。

## 2026-08-17 换班下拉班次文案回归修复

- 回归定位：`git log -S 'formatSwapAssignmentOption' -- apps/web/src/features/swaps` 与对应 `git blame` 确认含时间/岗位的专用文案由跨月换班提交 `5a8380f` 引入；原公共 `createAssignmentOption` 来自 `11094e3`，仍完整提供“日期 + 班种 + 周X + 成员”以及周末周几红字 VNode。
- 测试先行：新增 `swap-cross-month-regression.spec.ts` 断言换班表单必须调用 `createAssignmentOption` 且源码不含 `formatSwapAssignmentOption`；旧实现 1 项失败、2 项通过，修复后换班逻辑、跨月回归与公共选项 11/11 通过。
- 修复：四组普通/管理员班次下拉统一复用公共选项；删除不再使用的专用格式函数及对应时间文案测试。现有换班记录表仍使用 `formatSwapShiftTime`，跨月月份加载、双方选择清空边界、候选人、预览、提交、审批与冲突处理均未改变。
- 运行/浏览器验证：`pnpm smoke:browser` 在 `AUTH_DEV_MODE=true` / `VITE_AUTH_DEV_MODE=true` 的当前源码服务下通过管理员、成员、访客 vkey 与访问记录全流程；首次未启动服务和首次未开启 Web 开发认证的运行分别被环境门禁正常拦截。`pnpm smoke:check-core` 通过并确认未涉及核心链路文件。
- 完整验证：Web typecheck/build、`pnpm verify`、定向 3 文件 11 项及 `git diff --check` 通过；全仓为 88 个测试文件、580 项通过，29 个数据库集成文件、253 项按默认环境跳过，仅有既有大 chunk warning。
- 正式发布：checkpoint `afe6a2d` 已推送；发布前加密数据库备份 archive 为 `5a1e925d-a75d-4b68-ad0b-3c246b787d90`（44 张表、9884 行，SHA-256 `56b9232458d5078da0cca8c552a287a301b94a7b41ab145997fbf3f30c1a0bd8`）。release `afe6a2d7531d26553e7cf7ebf1d48cd3af37a447` 部署成功，发布前后 `ecs-verify.sh` 均通过。
- 正式域名只读复核：正式 D0796 会话可正常打开换班页、发起换班 Sheet 和“我的班次”选项层；当前 2026-08 无可选已发布班次，显示“暂无数据”，未制造业务数据或触发写入，浏览器 error/warning 为 0。选项有数据分支由公共选项 VNode 测试、换班回归测试和本地浏览器验证覆盖。
- 状态：已完成（含生产发布与线上核验）→ 待用户复核；最终状态 checkpoint 识别消息为 `docs(status): record swap option deployment`。

## 2026-08-17 日历滑动、紧凑控件、拨号与事件时间轴落地

- 回归来源：月视图假滑动来自 `7c80488`；电话复制/菜单路径分别来自 `1c84fd6`、`7a47d69`、`ab25064`，成员目录来自 `6183e9d`；班种原始编辑器来自 `04c7da3`；事件表格来自 `7ac2a07`。本轮均已对关键表达式执行 `git log -S` 与 `git blame`。
- 测试先行：日历相邻轨道/速度吸附、直接拨号、紧凑班种/自定义颜色、事件日期分组/折叠在旧实现上分别失败；浏览器又准确暴露“按下即捕获指针会吞掉月格 click”以及布尔属性缺省导致访客星期栏隐藏，两项均先补失败断言再修复。最终定向 10 个文件 72/72 通过。
- 实现与语义：月/周只滚动圆角内的真实三面板内容，星期栏和工具栏固定；拖动按距离与速度决定翻页，松手使用柔和吸附曲线，减少动态时即时完成。普通点触仅在确认横向拖动后才捕获指针。电话入口统一为透明原样式 `tel:` 链接；相关打勾控件改为 60×44px 点触、52×30px 轨道的紧凑开关。班种列表按需展开，保留五色并新增同尺寸自定义色圆点、调色板和 HEX。事件页改为按日期分组的时间轴，支持全部/日期/单事件层级展开折叠。
- 运行/浏览器验证：`pnpm smoke:browser` 在 `AUTH_DEV_MODE=true` / `VITE_AUTH_DEV_MODE=true` 的当前源码服务下通过，覆盖管理员、普通成员、访客 vkey 与访问记录，全流程无浏览器错误；截图目录 `C:\Users\eylin\AppData\Local\Temp\schedule-smoke-7emAAK`。首次未启动服务、只启动 Web、旧验证器查找内部星期栏/旧班种文案的运行均在对应门禁停止；修正当前结构的验证目标并解决真实点触/访客回归后原样复跑通过。
- Storybook 浏览器专项：390px 月视图真实左滑由 10 月切至 11 月；成员页 6 个拨号链接均为透明背景、44px 点触；班种自定义颜色可展开调色板与 HEX；事件页可一键折叠全部日期；紧凑开关外层均为 60×44px。Storybook build 与 Web build 已通过，仅有既有大 chunk warning。
- 完整验证：`pnpm verify` 通过（88 个文件/579 项通过，29 个数据库集成文件/253 项按默认环境跳过）；Web/全仓 build 与 typecheck、Prettier、ESLint、Storybook build、`pnpm smoke:check-core` 和 `git diff --check` 均通过，仅保留既有大 chunk warning。
- 正式发布：checkpoint `41d284b` 已推送；发布前加密数据库备份 archive 为 `915fa54b-1054-4a81-b9a2-aefa9844d25d`（44 张表、9120 行，SHA-256 `4f1bec8ce81a40ef57758c151230e7a4cf471c73061b43eb6862d9733073ed41`）。release `41d284b312452df2762981e252251d5e871d9149` 部署成功，发布前后 `ecs-verify.sh` 均通过。
- 正式域名只读核验：月/周均保留 3 个真实相邻面板，实际拖动分别由 8 月切至 9 月、8 月第 4 周切至第 5 周；固定星期栏、无横向溢出、紧凑开关 60×44px/52×30px、6 行班种、42px 输入框、五个预设色加一个自定义色及调色板/HEX 均符合确认稿，浏览器 error/warning 为 0。当前生产会话群组未填写号码且没有事件，不为验收制造业务数据；空状态正常，拨号有数据分支与事件折叠由本地浏览器 smoke/Storybook 覆盖。浏览器开启“减少动态”时线上正确即时切换，同时已确认生产 CSS 载入 `cubic-bezier(0.22, 1, 0.36, 1)` 的正常动态曲线。
- 状态：已完成（含生产发布与线上核验）→ 待用户复核。最终状态 checkpoint 识别消息：`docs(status): record interface refinement deployment`。

## 2026-08-16 周视图与列表视图正式实现与生产发布

- 回归来源：周视图单列移动布局、列表值班姓名电话交互和月视图定位按钮分别通过 `git log -S`/`git blame` 定位到 `db35a77`、`a3b14fb` 和 `7c80488`；本轮只在这些调用点的展示层扩展，不改变日历 API、权限、排班数据或写入路径。
- 测试先行：新增正式日历视图回归断言；旧实现未通过周动态等高/七列选择、列表冻结月份工具栏和显式电话按钮等断言。实现后日历定向测试、Storybook 参考测试与现有月历 parity 共 47/47 通过。
- 变更：周视图改为固定七列，按当天值班人数/节假日/变动标识计算整周统一最小高度；姓名置于上方、班次和换/加标识置于下方，取消周末标签，仅保留周末颜色；点击日期沿用下方详情轨道。周切换按周推进，跨月不重置周起点，并显示“月第几周”。列表视图加入 sticky 月份切换/定位工具栏，电话按钮与姓名分栏，保留节假日、班次和变动信息；月/周/列表定位按钮默认透明无边框。
- 语义审计：月视图默认姓名电话交互保持不变；列表仅将原姓名电话入口改为显式按钮，仍复用原号码菜单；周视图隐藏卡内电话入口并把详情交互交给既有 `SelectedDateDutyDetails`，事件打开、筛选、月份请求和错误路径未增加调用次数。
- 运行/浏览器验证：`pnpm smoke:browser`（当前源码隔离 5174、`--config.production=false`）已通过，覆盖管理员/成员/访客/访问记录且无浏览器错误；本地桌面实际核对周视图 7 卡等高、无横向溢出、跨月按周切换、点击详情和列表 sticky 工具栏/月份切换/定位；定位按钮计算样式为透明、0 边框、无阴影。`pnpm smoke:check-core` 已通过并确认本轮未涉及核心链路文件。
- 运行验证：Web typecheck、生产 Web build、Storybook build、`pnpm --config.production=false verify` 和 Prettier 均通过；全仓库 77 个测试文件、527 项测试通过，29 个数据库集成文件、252 项测试按本机无测试 MySQL 跳过；生产构建仅有既有大 chunk warning。
- 正式发布：代码 checkpoint `8a49434` 已提交并推送；发布前加密数据库备份 archive 为 `99d2352c-5908-4d8f-865a-372a7bb8d9b8`（44 张表、5732 行）；release `8a49434b43741ca9a9a7562cfab7f8d628c93670` 已部署，业务数据保持服务器原位。
- 正式核验：发布前/后的 `/tmp/ecs-verify.sh` 均通过，正式域名/API 健康、未知 Host 拒绝、产物哈希、容器、无开发认证依赖和 36 个迁移检查通过。正式 D0796 会话在 1280px 核对 7 列周卡均高 143px、无横向溢出、卡内电话按钮为 0、点击日期详情正常；跨月连续切周保持周序；列表工具栏滚动后 `top=0` 固定，31 个班次含 5 个独立电话按钮且页面无横向溢出；月/周/列表定位按钮均为透明、0 边框、无阴影，浏览器日志为空。当前源码隔离 5174 的 390/320 响应式 smoke 和 Storybook 390 预览已通过。
- 最终状态 checkpoint `1570689` 已提交、推送并部署；其发布前加密数据库备份 archive 为 `637a925d-9693-45f1-97f7-93d2f7824ffa`（44 张表、5741 行），最终 release 为 `1570689259fad25d278db7dbd1db1973d64b2f94`。
- 状态记录收口前再次创建生产备份 archive `323d1957-66df-4cb4-956b-5c9256bfacda`（44 张表、5748 行）；本次只更新文档状态，提交信息为 `docs(status): finalize calendar views production status`，并将按规则作为最终 release 部署。
- 状态：已完成（含生产发布与线上核验）→ 待最终状态文档 checkpoint 部署；部署后保持 Git、远端和服务器 release 一致，再等待用户复核。

## 2026-08-14 账号密码认证切换

- 变更：正式网页从微信网站应用扫码登录切换为账号密码注册/登录；小程序身份和通知配置保持独立。
- 运行/浏览器验证：pnpm smoke:browser 已通过，覆盖开发管理员、开发成员、访客排班和访客访问记录流程；正式账号注册/登录需在新 release 部署后人工验收。
- 运行/浏览器验证：pnpm smoke:check-core 在补充本记录前因缺少本轮记录失败，补充后需重新运行并通过。
- 运行验证：pnpm verify 已通过；59 个测试文件通过，29 个数据库集成文件因本机没有测试 MySQL 跳过。
- 发布诊断：服务器数据库的既有 `users.id` 为 `utf8mb4_0900_ai_ci`，新增认证表迁移使用 `utf8mb4_unicode_ci`，MySQL 报告外键列不兼容；已将迁移 0035/0036 统一为既有排序规则。首次发布已自动回滚，现网旧 release 健康，待修正 release 重试。
- 发布验证：修正后的 release `c358109` 已部署；数据库迁移 0035/0036 成功，`ecs-verify.sh` 通过，正式域名/API、未知 Host 拒绝、共享入口端口、无开发认证依赖和迁移计数 36 均通过。
- 数据清理：旧 `local-admin` / `local-member` 记录的业务关联未删除，账号已改为 retired 标识并设为 suspended；生产管理员 UID 配置已清空，等待正式账号注册后配置。
- 负向验收：弱注册返回 400、未知账号登录返回 401、旧开发 Bearer token 返回 401；未创建测试账号。
- 状态：本轮发布已完成，当前为“待用户复核”；需要用户注册账号、确认管理员账号，并重置已暴露的小程序 AppSecret。

## 2026-08-14 密码策略与登录页提示调整

- 变更：密码移除最小/最大长度限制，仅拒绝空密码；登录页移除首次注册和微信 AppID/AppSecret 说明，并将登录密码输入标记为 current-password。
- 运行/浏览器验证：pnpm smoke:browser 已通过，覆盖开发管理员、开发成员、访客排班和访客访问记录流程。
- 运行验证：pnpm verify 已通过；60 个测试文件、447 个测试通过，29 个数据库集成文件因本机没有测试 MySQL 跳过。
- 发布验证：release `72f1076` 已部署；`ecs-verify.sh` 通过，正式构建产物不包含旧登录提示或“至少 8 位”文案，一位密码未知账号请求返回 401。
- 状态：本轮代码和正式部署已完成，当前为“待用户复核”；需要用户注册账号、确认管理员账号，并重置已暴露的小程序 AppSecret。

## 2026-08-14 配置正式管理员并重建 API

- 变更：确认正式密码账号 `D0796` 为 active 且资料已建立，将该账号对应的稳定认证 UID 写入生产 `PLATFORM_ADMIN_UIDS` 和 `HOLIDAY_ADMIN_UIDS`；未读取或修改账号密码。
- 发布验证：仅重建 API 容器，Web、MySQL 和共享 Nginx 网关未停止；API 健康接口返回 200，生产认证开关仍为 `NODE_ENV=production`、`AUTH_DEV_MODE=false`、`AUTH_PASSWORD_ENABLED=true`、`WECHAT_MOCK_MODE=false`。
- 运行验证：服务端管理员 UID 配置与账号身份映射一致；`ecs-verify.sh` 通过，正式 release、域名入口、未知 Host 拒绝、共享端口、产物哈希、无开发认证依赖和迁移计数 36 均通过。
- 状态：配置和服务端重建已完成，当前为“待用户复核”；请用户退出后重新登录 `D0796`，人工确认管理员页面和节假日管理功能。小程序 AppSecret 仍需在微信平台重置后再更新通知配置。

## 2026-08-14 关联原有群组到正式账号

- 变更：核对生产数据库后发现原有 1 个正式群组仍由已退役旧管理员身份持有，`D0796` 尚无该群组成员关系；已将个人资料显示姓名确认为“林恩宇”，并在单一数据库事务中完成群主转让。
- 数据结果：`D0796` 现在是该群组的 active `owner`；旧退役账号的原成员记录保留为 active `administrator` 历史关系，不删除原群组、群组编号或排班数据。
- 运行验证：群主 UID、owner 成员关系和旧管理员关系核验一致；原有 2 个排班周期仍在；正式域名 API 健康接口返回 200。
- 异常处理：第一次 SQL 因 `groups` 为数据库保留字而未提交，事务自动回滚；修正后重新执行成功，未产生部分写入。
- 状态：数据库关联已完成，当前为“待用户复核”；请用户退出后重新登录 `D0796`，确认群组显示姓名“林恩宇”和群主操作权限。

## 2026-08-14 群组页面与群组码展示修复

- 回归定位：群组 API 已返回 `D0796` 的 owner 群组，但前端只把群组放在下拉选择器中；群组码更新接口返回新码后，群组管理面板没有持久显示 `groupCode`。相关展示和刷新逻辑最初来自提交 `1b5a17a`，调用点已通过 `git blame` 确认。
- 变更：工作台顶部明确显示当前群组名称、角色和群组码；群组管理面板显示当前群组码；重新生成群组码后使用接口返回值提示，并由父级刷新最新码。
- 测试先行：增加浏览器回归断言后，旧实现因未看到“当前群组码”失败；修复后通过。
- 运行/浏览器验证：pnpm smoke:browser 已通过，覆盖群组列表展示、群组管理页面、重新生成群组码后四位码刷新，以及原有管理员、成员、访客流程。
- 运行验证：`pnpm --filter @schedule/web typecheck` 通过；`pnpm verify` 通过，60 个测试文件、447 个测试通过，29 个数据库集成文件因本机没有测试 MySQL 跳过；生产构建仅有既有的大 chunk warning。
- 发布验证：release `056fc59` 已部署；`ecs-verify.sh` 通过，正式 API 健康接口返回 200，`D0796` 的 `/api/groups` 返回原群组、`owner` 角色和四位群组码。
- 状态：代码修复和正式 Web release 已完成，当前为“待用户复核”；请用户退出后重新登录 `D0796`，确认群组名称、群主权限和群组码刷新。

## 2026-08-14 Web UI 2.0 Storybook 手机预览

- 范围：用户选择 Storybook + 本地浏览器替代 Figma；本轮只完成 Storybook 基础和四个关键手机预览，不改生产 UI、业务/API 或数据结构。
- 测试先行：横滑判定测试先因缺少 `preview-interactions.js` 失败；实现 56px 水平阈值和 1.2 倍水平意图判定后 4/4 通过，覆盖左右横滑、阈值不足和垂直滑动取消。
- 浏览器修正：320px 验收发现图标化筛选按钮缺少无障碍名称，以及部分带事件标识姓名被压窄；补充 `aria-label` 并调整月格行宽后复核通过。
- 运行/浏览器验证：Storybook 390×844 四屏及 320×844 月历无横向溢出、无姓名裁切、可见操作均至少 44px；底栏不遮挡最后一个电话按钮；筛选/更多底部页、登录/注册、请假/审批、月份左滑均实际操作通过，控制台无 warning/error。
- 运行/浏览器验证：`pnpm smoke:browser` 已通过，覆盖登录、管理员、成员、访客和访客访问记录；`pnpm smoke:check-core` 已通过并确认本轮未涉及核心链路文件。
- 运行验证：`pnpm --filter @schedule/web storybook:build`、Web typecheck、4 项横滑测试和 `pnpm verify` 均通过；全仓库为 61 个测试文件、451 个测试通过，29 个数据库集成文件因本机没有测试 MySQL 跳过。
- 状态：Storybook 预览为“待用户复核”；用户确认视觉、月格密度、底栏和详情轨道后，才进入生产令牌与应用框架批次。

## 2026-08-14 Storybook 月历视觉反馈精修

- 回归来源：原姓名彩色背景、纯文字节假日、蓝底白字加/换标识均由 `b903c6d` 引入；已通过 `git log -S` 和 `git blame` 定位到 `Ui2MonthCalendar.vue` 对应调用点。
- 用户确认：整体视觉风格可继续；本轮只精修 Storybook 月历状态，不改生产 UI。
- 测试先行：新增视觉状态测试后先因缺少 `preview-calendar.js` 失败；实现后周末列、多日节假日、单日标识与调休工作日 4/4 通过，连同横滑测试共 8/8 通过。
- 变更：姓名取消背景填充；节假日、调休“班”、加/换复用现有 Web 红/蓝/黄徽标配色；星期六/日表头改为周末红；多日节假日单元格为浅粉背景。使用仓库真实 2026 年国庆 7 天和 10 月 10 日调休数据新增独立状态 Story。
- 运行/浏览器验证：390×844 和 320×844 均无横向溢出、姓名/徽标裁切或小于 44px 的可见操作；7 个国庆单元格背景一致，稳定页面控制台无 warning/error。
- 运行验证：Storybook build、Web typecheck、`pnpm smoke:browser`、`pnpm smoke:check-core`、`pnpm verify` 均通过；62 个测试文件、455 个测试通过，29 个数据库集成文件因本机没有测试 MySQL 跳过。
- 状态：当前为“待用户复核”；确认本轮月历状态后，才进入生产令牌与应用框架批次。

## 2026-08-14 Web UI 2.0 令牌与应用框架

- 回归来源：响应式导航、四个手机主入口和固定底栏由 `db35a77` 引入；账号登录/注册结构由 `de3ad5f` 引入；顶部退出链路由 `e38cdba` 引入。已分别通过 `git log -S` 与 `git blame` 确认调用点。
- 测试先行：新语义令牌、15px 正文/20/28px 标题、4–32px 间距、44px 点触目标及强类型导航图标断言在旧实现上 6 项失败；实现后 4 个定向测试文件、18 项测试通过。
- 语义等价审计：登录/注册/开发登录继续调用原 session 方法，参数、异步等待、错误捕获与跳转范围未变；退出仍只调用 `AppLayout.signOut()` 一次，手机账号区经 Home/Nav 事件上送；导航条目顺序、角色过滤和四个手机主入口未变。未修改 API、契约或数据结构。
- 变更：生产登录页、顶部栏、群组上下文、桌面图标侧栏与手机图标底栏对齐已确认的 Apple Health 式视觉；“更多”改为原生焦点锁定的响应式 Sheet，手机底部页中包含功能分组和账号退出；加入安全区、按压态、键盘焦点、减少动态和底栏避让。
- 运行/浏览器验证：pnpm smoke:browser 已通过；新增 390×844/320×844 登录及工作台断言，无横向溢出，五个底栏入口均不小于 44px，固定底栏贴底且内容预留空间，“更多”底部页含功能/账号分组，原管理员、成员、访客和访问记录流程无错误。
- 本地浏览器验证：1280×900、390×844、320×844 实际登录管理员并操作“更多”与账号区退出；桌面侧栏项均为 44px，手机底栏为 70px、内容预留 94px，原生 dialog 连续 Tab 后焦点仍锁定在页内，控制台无 warning/error。
- 无障碍回归：首次 `pnpm verify` 发现次文字色 `#788492` 的对比度为 3.81:1，低于 4.5:1；已将令牌调整为 `#6B7785`（4.56:1）、重新生成 CSS，并通过 5 个定向测试文件、23 项测试。
- 运行验证：Storybook build、Web typecheck、Web 生产构建、`pnpm smoke:check-core` 和修正后的 `pnpm verify` 均通过；全仓库 62 个测试文件、457 项测试通过，29 个数据库集成文件、252 项测试因本机没有测试 MySQL 跳过，仅有既有的大 chunk warning。
- 状态：UI2-03 checkpoint `11bb812` 已提交并推送；UI2-04 已完成实现、浏览器与全仓库验证，checkpoint 识别消息为 `feat(web): ship responsive application shell`，当前为“待用户复核”。

## 2026-08-14 Web UI 2.0 触屏月历

- 回归来源：生产月格由 `ab250646` 引入，移动端月历行为由 `db35a77` 引入，班次事件入口由 `7ac2a07` 引入，节假日由 `48c6fdd` 引入；Storybook 56px 横滑判定由 `b903c6d` 引入，已通过 `git log -S` 和 `git blame` 核对调用点。
- 测试先行：新增当前月默认今天、其他月份首个有班日期/1 日、56px 水平主导手势、连续多日节假日浅粉范围 4 项断言；旧实现因 3 个函数均不存在而 4/4 失败，实现后连同现有日历及 Storybook 回归共 5 个文件、31 项通过。
- 语义审计：月份按钮、年月输入和横滑均只写入原 `businessMonth`，继续由既有 watch/API 最新请求追踪器加载；选中日期仅在当前响应生效时赋值。筛选仍写入原 `membershipIds`/`roleIds`/`shiftTypeIds`/`onlyChanges`，过滤函数、空值和调用次数不变；月/周/列表及事件按钮链路未改。
- 变更：`MonthGrid` 新增受控 `selectedDate`/`select-date`，手机七列使用 9–12px 自适应总览字号且完整姓名自然换行；连续同名多日休假整段浅粉，单日节日不填充；手机筛选移入响应式 Sheet，桌面保留直接筛选；生产横滑与已确认 Storybook 共用 56px/1.2 倍水平意图函数。
- 运行/浏览器验证：pnpm smoke:browser 已通过；390px 实际验证默认今天、点触换选中、筛选 Sheet、左滑换月、垂直移动取消，无横向溢出或控制台错误，管理员/成员/访客原流程通过。新增 smoke 首次因 Sheet 关闭后的月历位于视口外而手势超时，测试显式滚动到月历后通过，产品代码未为测试特判。
- 运行验证：格式、lint、5 个定向测试文件、31 项测试、Web typecheck、Web build、Storybook build 和 `pnpm smoke:check-core` 均通过；仅有既有的大 chunk warning。checkpoint 识别消息为 `feat(web): add touch-first month calendar`。

## 2026-08-14 Web UI 2.0 选中日期值班轨道

- 回归来源：班次成员/电话展示沿用 `ab250646` 的 `DutyCell`，事件查询与弹窗链路由 `7ac2a07` 引入，实际人员优先与节假日/成员契约由 `48c6fdd` 完善；已复用上一任务的 `git log -S`/`git blame` 结果并逐调用点核对。
- 测试先行：先新增多人班次原排序、实际人员全名优先、电话确认状态、已排班/有变更/待安排状态和中文日期 2 项断言；旧实现因 `selected-date-duty` 模块不存在而失败，实现后 2/2 通过，连同月历定向回归共 4 个文件、25 项通过。
- 语义等价审计：详情模型只读取 `visibleAssignments` 和现有成员契约，不修改筛选或排班；确认号码使用 `tel:`，未确认号码只复制且不写后端。事件按钮仍只调用原 `openAssignmentEvents()` 一次，原 `getGroupEvents(groupId, { pageSize: 100, shiftId })` 的参数、await/catch/finally 和空事件语义不变；仅把展示容器从 TDesign Dialog 换为响应式 Sheet。
- 变更：月历下方新增医疗蓝值班轨道，完整展示班种、岗位、姓名、开始刻度、完整时间范围、现有变更标识、推导状态、电话和事件入口；所有详情操作至少 44px。新增生产组件 Story，包含确认长/短号、未确认号码和换班状态，便于 Storybook 独立复核。
- 运行/浏览器验证：pnpm smoke:browser 已通过；390×844/320×844 下轨道无横向溢出、姓名/时间无裁切、电话/事件操作不小于 44px，事件 Sheet 实际打开加载，底栏不遮挡最后操作；管理员、成员、访客和控制台原回归通过。
- 运行验证：Storybook build、`pnpm smoke:check-core` 和 `pnpm verify` 通过；全仓库 64 个测试文件、463 项测试通过，29 个数据库集成文件、252 项因本机无测试 MySQL 跳过。首次组合验证因外层 120 秒超时关闭管道产生 `EPIPE`，分开重跑后退出码 0，非产品或测试失败。checkpoint 识别消息为 `feat(web): add selected date duty track`。

## 2026-08-14 Web UI 2.0 请假与审批移动工作流

- 回归来源：请假新建表单、三组表格和审批 Dialog 均由 `0d5ec55` 引入，后续日期、影响班次和处理人字段分别由既有工作流提交补充；已通过 `git log -S` 与 `git blame` 核对当前调用点。
- 测试先行：新增 pending/approved/rejected 三态卡片色调与驳回确认文案断言，旧实现因函数不存在而 1 项失败；实现后请假逻辑 8/8 通过。
- 语义审计：初始加载继续以同一 `Promise.all` 调用我的申请、审批列表和默认策略；提交仍只调用一次 `createLeaveRequest` 并在成功后刷新，新增成功关闭 Sheet 仅改变展示状态。审批预览/批准保持原参数、版本、冲突确认、await/catch/finally；取消和撤销调用不变；驳回新增显式确认后仍使用原 API 参数。未修改权限、API、契约或数据结构。
- 变更：手机提供“我的请假/待我审批”分段入口，列表在窄屏变为信息完整的状态卡片；新建表单与审批预览统一迁入 `ResponsiveSheet`，保留桌面对话框和手机底部页行为。所有关键操作至少 44px，状态色使用 UI 2.0 语义令牌，危险操作无滑动手势。
- 运行/浏览器验证：pnpm smoke:browser 已通过；390×844/320×844 实际切换分段并打开新建请假底部页，无横向溢出，起止日期和表单内容完整，关键点触面不小于 44px，原管理员/成员/访客流程与控制台无错误。首次检查到 TDesign 内部 22px 文本节点，其真实外层为 44px，校验改测外层；跨视口分段测试状态重置后复跑通过，未修改产品行为规避测试。
- 运行验证：Web typecheck、生产 build、Storybook build 和 `pnpm verify` 均通过；64 个测试文件、464 项测试通过，29 个数据库集成文件、252 项因本机无测试 MySQL 跳过。并行 build/typecheck 曾在产物完成后触发 Windows Node 退出断言，串行复跑退出码均为 0；仅保留既有大 chunk warning。checkpoint 识别消息为 `feat(web): add mobile leave workflow cards`。

## 2026-08-14 Web UI 2.0 换班与加扣班移动工作流

- 回归来源：换班表单/列表由 `b20ff9b` 引入，管理员直接换班由 `6452fa9` 引入；加扣班表单/列表由 `5d8b205` 引入，管理员可选原因、已受理状态和可撤销归档分别由 `cbe2e89`、`de3acab`、`f65a57d` 补充。已对当前模板执行 `git log -S` 与 `git blame`。
- 测试先行：新增 pending、completed、rejected、cancelled、revoked 六种共享工作流状态的语义色调断言，旧实现因缺少 `getWorkflowStatusTone` 失败；实现后共享工作流、换班与加扣班定向测试 18/18 通过。
- 语义等价审计：两页初始加载仍分别维持原六项 `Promise.all`、群组/月变更重置和窗口聚焦刷新；预览、普通提交、管理员直办、接受、批准、驳回、取消、撤销及设置更新继续调用原 API 一次，参数、版本、`operationId`、可选原因、冲突重载、await/catch/finally 和空值语义未变。新增成功关闭对应 Sheet 只改变显示状态；危险操作继续使用原 confirm/prompt，未增加滑动删除。未修改权限、API、契约或数据结构。
- 变更：换班和加扣班的普通/管理员表单迁入 `ResponsiveSheet`；五类表格在 760px 以下变为完整字段卡片，待操作记录使用医疗蓝侧边强调，状态使用可访问语义徽标；桌面继续保持高密度表格。共用样式以 UI 2.0 令牌实现 44px 点触、320px 堆叠与减少动态。
- 运行/浏览器验证：`pnpm smoke:browser` 已通过；390×844/320×844 实际打开四个 Sheet，确认无横向溢出、移动记录为卡片、关键控件不小于 44px，动画结束后 Sheet 完整位于可视区，管理员/成员/访客原流程及控制台无错误。一次中间断言在入口动画首帧检测到预期的 24px 位移，改为动画完成后验收并复跑通过，产品代码未作测试特判。
- 运行验证：Web typecheck、生产 build、Storybook build、`pnpm smoke:check-core` 和 `pnpm verify` 均通过；64 个测试文件、465 项测试通过，29 个数据库集成文件、252 项因本机无测试 MySQL 跳过；仅保留既有大 chunk warning。checkpoint 识别消息为 `feat(web): add mobile shift workflow cards`。

## 2026-08-14 Web UI 2.0 成员、认领与事件移动卡片

- 回归来源：成员/认领表格、同名认领 Dialog 与联系方式入口由 `d117bb0` 引入；事件筛选、事件表格与详情 Dialog 由 `7ac2a07` 引入；访客访问表由 `4b33749` 引入。已对当前模板执行 `git log -S` 和 `git blame`。
- 测试先行：新增成员待认领/未认领/待审批/已认领和认领申请四态的语义色调断言，旧实现因缺少 `member-presentation` 模块失败；实现后成员呈现、名单解析与事件时间线定向测试 19/19 通过。
- 语义等价审计：成员初始加载仍保持原三项 `Promise.all`、请求版本防旧响应和群组版本刷新；更新角色、添加/转正/删除成员、转让群主、同名检测、创建/撤销/审批认领与联系方式保存继续调用原 API 一次，参数、await/catch/finally、空值和确认文案未变。手机“管理成员”只在关闭 Sheet 后转调原函数，原 confirm 仍是写入门禁。事件群组/筛选 watch、查询构造、分页拼接、详情和访客加载调用保持不变；新筛选组件继续把清空值归一为原空字符串，未增加 API、权限、契约或数据结构变更。
- 变更：成员、认领、事件和访客表在 760px 以下转为完整字段卡片；手机成员主操作直接显示，危险/次级操作进入明确管理 Sheet。联系方式、同名认领、事件筛选和事件详情统一迁入 `ResponsiveSheet`；事件关联链使用 UI 2.0 令牌、15px 叙事正文与 44px 折叠项，桌面表格和直接筛选保持高密度。
- 运行/浏览器验证：`pnpm smoke:browser` 已通过；390×844/320×844 下成员、认领、事件和访客卡片无横向溢出，桌面操作区在手机隐藏，实际打开成员管理、联系方式、事件筛选和详情四类 Sheet，所有关键点触与原始数据折叠项不小于 44px；管理员/成员/访客流程与控制台无错误。四组截图逐屏复核通过。
- 运行验证：Web typecheck、生产 build、Storybook build、`pnpm smoke:check-core` 和 `pnpm verify` 均通过；65 个测试文件、467 项测试通过，29 个数据库集成文件、252 项因本机无测试 MySQL 跳过；仅保留既有大 chunk warning。checkpoint 识别消息为 `feat(web): add mobile member and event cards`。

## 2026-08-15 Web UI 2.0 手动排班矩阵与排班补录触控

- 回归来源：手动矩阵、单元格与视图入口由 `6512274` 引入；排班补录基础页和月历绘制由 `927241c`、`000ed93` 引入，暂存确认链路由 `561310c` 完善。浏览器复核发现空月格在未传 `selectedDate` 时也会被选中，表达式由 UI2-05 的 `7c80488` 引入；以上调用点均已执行 `git log -S` 与 `git blame`。
- 测试先行：新增手动矩阵横向溢出、滚动方向/进度和边界容差测试，旧实现先因缺少 `manual-grid-interactions` 模块失败；新增空月格不应选中测试，旧实现先因缺少独立判定函数失败。实现后月历交互、手动矩阵交互和编辑器逻辑 3 个定向测试文件、19 项全部通过。
- 语义等价审计：手动排班配置、模板列表/历史、节假日、模板增删改、应用批次、草稿删除/预览、周期月历、变更预览、撤回/发布及补录查询/创建的 API 调用次数前后相同；参数、`await`、错误捕获、版本冲突、空值语义和确认流程未变。矩阵按钮和补录暂存移除均只调用原处理函数一次；`select-date`/`open-events` 事件次数未变。唯一独立行为修正为空月格不再误选。
- 变更：手动排班矩阵使用内部横向滚动、固定双层表头与人员首列、方向/进度提示和真实 44px 单元格按钮；移动端保持完整姓名/班次，并优化班次面板、清空操作和保存/应用布局。补录页增加当前配班状态、图标化月份切换、44px 班次/成员/暂存操作和手机全宽七列月历；危险动作继续显式确认，无滑动删除。
- 运行/浏览器验证：`pnpm smoke:browser` 已通过；1280×900、390×844、320×844 实际验证两页无横向溢出或底栏遮挡，矩阵可内部横滑、人员首列位置固定、表头固定、提示/进度随滚动更新、单元格 `aria-pressed` 切换，补录七列完整、空月格中性且关键控件不小于 44px。六张截图已逐屏复核。原 5173 开发进程缓存旧样式，最终使用独立当前源码 5174 服务验收并在完成后停止，未修改原外部进程。
- 运行验证：Web typecheck、生产 build、Storybook build、`pnpm smoke:check-core`、`pnpm verify` 和 `git diff --check` 均通过；全仓库 66 个测试文件、472 项测试通过，29 个数据库集成文件、252 项因本机无测试 MySQL 跳过，仅有既有大 chunk warning。checkpoint `1203dc7`（`feat(web): improve dense schedule interactions`）已推送。

## 2026-08-15 Web UI 2.0 统计、通知与导出响应式界面

- 回归来源：统计成员表与汇总界面由 `36127b0` 引入，当前单元格渲染还包含 `540856e4`/`5cd8860` 的后续调整；通知铃铛、中心和设置由 `52e9e1f` 引入，触发器视觉由 `5b00fa7` 调整，注册警告由 `eab3ff2` 补充；导出对话框由 `15729f8` 引入，后续选择器与角色命名由 `540856e4`/`5cd8860` 调整，首页导出触发器由 `5b00fa7` 调整。以上调用点均已执行 `git log -S` 与 `git blame`。
- 测试先行：新增统计 10 项汇总与横向滚动方向、通知业务语义色调、导出内容/周期摘要断言；旧实现因缺少 `getStatisticsSummaryItems`、`getStatisticsTableScrollHint`、`getNotificationTone` 和 `getExportSelectionSummary` 而 3 个文件、4 项失败（其余 11 项通过），实现后 3 个文件、15/15 通过。
- 语义等价审计：统计的 `getMonthStatistics`、`getYearStatistics`、`refreshMonthStatistics`、`recalculateStatistics`；通知设置的偏好/群组设置/推送订阅读写，通知列表的读取/单条已读/全部已读，铃铛的未读轮询与定时器；导出的配置、任务创建、轮询、下载和 CSV 保存调用次数逐项对比 `HEAD` 均相同。参数、`await`、catch/finally、空值归一、权限门禁和成功/错误路径未改；本批只替换显示容器并新增纯派生文案/滚动状态。
- 变更：统计页改为“值班台账”汇总，原 3 项主指标与 7 项辅助指标全部保留；成员表使用内部横向滚动、固定表头/成员首列及方向/进度提示。通知中心与导出迁入 `ResponsiveSheet`，通知设置改为响应式卡片；导出显示实时选择摘要、安全说明和显式取消/导出操作。手机控件不小于 44px，未增加滑动删除或隐式危险操作。
- 浏览器复核发现并修正两处真实问题：成员表滚动提示最初直接读取非响应式 DOM 值，滚动后文案不更新，改为保存响应式滚动状态；TDesign 通知输入外层最初仍为 32px，补齐真实 `.t-input` 根节点 44px。导出固定操作区会覆盖安全说明，已改为 Sheet 内正常滚动流并复核说明完整可见。
- 运行/浏览器验证：`pnpm smoke:browser` 已通过；1280×900、390×844、320×844 下统计页无页面横向溢出，3+7 指标完整，成员表可内部横滑且表头/成员首列固定，提示与进度随滚动更新；通知设置卡片单列全宽，通知中心和导出均贴底占满手机宽度，关键点触目标不小于 44px。管理员、成员、访客、vkey 与访问记录原流程和控制台无错误。最终截图目录为 `C:\Users\eylin\AppData\Local\Temp\schedule-smoke-yZkNpJ`。
- 运行验证：3 个定向测试文件 15/15、Web typecheck、Storybook build、`pnpm smoke:check-core`、`pnpm verify` 和 `git diff --check` 均通过；全仓库 66 个测试文件、476 项测试通过，29 个数据库集成文件、252 项因本机无测试 MySQL 跳过，仅保留既有大 chunk warning。首轮组合验证因外层 123 秒上限在 Vitest 阶段被终止，延长时限后完整 `pnpm verify` 真实退出码为 0。checkpoint `6ec287d`（`feat(web): polish statistics notifications and exports`）已推送。

## 2026-08-15 Web UI 2.0 群组、配置、访客与应用状态

- 回归来源：群组创建界面由 `1b5a17a` 引入，重新生成群组码由 `caf0a8e` 完善；排班配置及读取链路由 `04c7da3` 引入；访客月历由 `7c783c7` 引入，vkey 访问由 `4b33749` 增加；离线横幅由 `db35a77` 引入。`ResponsiveSheet` 的模板引用守卫由 `5b00fa7` 引入。以上调用点均已执行 `git log -S` 和 `git blame`。
- 测试先行：新增四位群组码保留前导零/角色文案、三步基础配置准备轨道、缺失/失效访客链接与离线只读文案断言；旧实现先因 `group-presentation.js`、`scheduling-config-presentation.js`、`app-state.js` 不存在而 3 个文件失败，实现后连同 PWA 响应式测试共 4 个文件、10/10 通过。
- 语义等价审计：群组创建、加入、名单、改名、重新生成群组码、退出、解散和恢复继续调用原处理函数一次，参数、await/catch/finally 和成功刷新未改；危险确认仅从 TDesign Dialog 换为原生焦点锁定 `ResponsiveSheet`。排班配置加载、新增/保存/删除班种、新增/删除岗位和保存岗位成员的调用次数与参数未改，“准备轨道”只读取已有配置。访客仍只按原 query vkey 调用公开日历 API，月份切换、错误映射和访问记录语义未改；离线展示继续复用 `offlineSubmitMessage`，没有队列或写入。首页群组错误只增加手动重试入口，仍调用原 `refreshGroups()`。
- 浏览器回归：新增 `ResponsiveSheet` 使用后，首次 smoke 先出现 `Cannot read properties of null (reading 'open')`；原因是异步 `nextTick` 返回时组件可能已卸载，模板引用为 `null` 而旧守卫只判断 `undefined`。修复仅将 ref 明确初始化为 `null` 并把空引用作为 no-op，打开/关闭分支、调用次数和事件语义不变。修复后复跑通过。
- 运行/浏览器验证：`pnpm smoke:browser` 通过；新增 1280×900、390×844、320×844 群组/配置/访客断言，以及 390×844、320×844 离线只读断言。无页面横向溢出，群组码四位完整，班种编辑分别为 6/2/1 列，访客月历保持完整七列，关键操作不小于 44px；解散确认 Sheet 实际打开。管理员、成员、访客 vkey、访问记录和控制台原流程无错误，最终截图目录为 `C:\Users\eylin\AppData\Local\Temp\schedule-smoke-yhFCbi`。
- 本地浏览器验证：实际以 390×844 打开缺失访客链接、群组管理和排班配置；状态卡宽 358px、页面无横向溢出，群组码四位完整且控件均达 44px，准备轨道为三步、班种编辑为两列。最终复位临时视口并关闭验收标签页。
- 运行验证：Web typecheck、Storybook build、`pnpm smoke:browser`、`pnpm verify` 和 `git diff --check` 通过；全仓库 69 个测试文件、482 项测试通过，29 个数据库集成文件、252 项因本机无测试 MySQL 跳过，仅保留既有大 chunk warning。smoke 曾因 5173 旧 Vite 进程提供旧访客组件而等待旧文案超时；确认进程属于本仓库后只重启前端预览，API 和数据未改，当前源码复跑通过。
- 状态：UI2-13/14 已完成，checkpoint 识别消息为 `feat(web): polish group config and guest states`；下一批次只做最终全局焦点、减少动态、安全区和跨视口收尾审计。

## 2026-08-15 Web UI 2.0 最终全局收尾审计

- 回归来源：全局 `body`、`#app` 和 `.app-layout` 的 `100vh` 由 `e38cdba` 引入，访客页全屏高度由 `7c783c7` 引入；`ResponsiveSheet` 的原生 dialog 打开/关闭与隐式焦点行为由 `5b00fa7` 引入。以上调用点已执行 `git log -S` 与 `git blame`。
- 测试先行：`global-ui-shell.spec.ts` 的动态视口用例在旧实现上先失败，证明全屏容器缺少 `100dvh`；扩展后的 `pnpm smoke:browser` 首次在 390px “更多”Sheet 首尾 Tab 循环处失败，随后新增组件级焦点锁定/回焦断言并在旧实现上再次失败。修复后定向 4/4 与完整浏览器冒烟均通过。
- 行为与语义审计：`100dvh` 仅在 `100vh` 后覆盖，不支持动态视口的浏览器继续使用回退；没有改变布局分支、数据加载或副作用。`ResponsiveSheet` 保持原 `visible` watch、`showModal`/`close`、`update:visible`、cancel/backdrop 和 slot 语义，新行为仅为记录触发器、聚焦首项、首尾 Tab 循环及关闭后回焦；打开/关闭事件与业务处理函数调用次数不变。未修改 API、契约、权限或数据库。
- 运行/浏览器验证：`pnpm smoke:browser` 已通过；覆盖登录、管理员、成员、访客、vkey 和访问记录，并在 1280×900、390×844、320×844 验证无页面横向溢出、桌面/手机导航切换、底栏避让、44px 点触、2px 可见键盘焦点、Sheet 双向焦点锁定与回焦、`prefers-reduced-motion` 动画时长和关闭入场动画。最终截图目录为 `C:\Users\eylin\AppData\Local\Temp\schedule-smoke-aVpdbz`。
- 本地可视化复核：Storybook 390/320px 节假日月历为完整七列，姓名无背景/无裁切，周末、节假日、加换、调休和多日节假日状态色均与确认规则一致；生产工作台在 1280/390/320px 无横向溢出，320px 内容底部预留 94px。实际键盘操作确认 Sheet 正向循环到“完成”、反向循环到“退出登录”，关闭后回到“更多”。Storybook 验收页继续由 `http://127.0.0.1:6006` 提供。
- 运行验证：`pnpm exec vitest run apps/web/src/pwa/global-ui-shell.spec.ts` 4/4、Web typecheck、Storybook build、`pnpm smoke:browser`、`pnpm verify` 和 `git diff --check` 通过；全仓库 70 个测试文件、486 项测试通过，29 个数据库集成文件、252 项因本机无测试 MySQL 跳过，仅保留既有大 chunk warning。checkpoint 识别消息为 `feat(web): complete UI 2.0 global audit`。
- 完成审计：UI2-01–14 与本轮已覆盖 Storybook 预览、设计令牌/应用框架、月历与手势、值班详情、工作流卡片/Sheet、矩阵/统计、群组/配置/访客/应用状态和全局无障碍/视口规则；所有原计划代码接口已落地，未发现剩余 Web UI 2.0 实现缺口。状态转为待用户整体验收。

## 2026-08-15 Web UI 2.0 正式发布与 D0796 验收

- 同步审计：服务器旧 release `056fc59` 的文件哈希与部署清单完全一致，没有服务器端手工漂移；本地 `main` 比生产新 18 个 UI 2.0 提交。生产和本地数据库结构均为 36 个迁移、45 张表、467 个字段；生产业务数据继续以服务器为准，没有复制密码哈希、令牌、联系方式或用本地演示数据覆盖生产。
- 发布保护：先创建加密数据库备份 `cd707b42-2687-408b-b0ed-1f13a2c1d27e`（44 张业务表、3257 行），再生成并部署不可变 release `5ae4941792db56119f08d07f1ba5543cc3f3b209`。迁移器确认无新增迁移，API/Web 容器健康重建，`ecs-verify.sh` 通过域名、未知 Host、端口、产物哈希、认证模式和 36 个迁移检查。
- 运行/浏览器验证：`pnpm verify`、串行 `pnpm smoke:browser`、`pnpm smoke:check-core`、`git diff --check`、公开首页/API 200 检查均通过；486 项测试通过，252 项数据库集成测试按本机配置跳过。首次 smoke 与全仓库构建并行时遇到 390px 访客卡片 HMR 瞬时状态，构建结束后在独立 5174 服务串行复跑通过，产品代码未修改。
- 正式账号复核：`D0796` 登录成功，账号 active，姓名“林恩宇”，在“头颈外科医生”群组中为 active owner；服务器运行配置确认平台管理员与节假日管理员均生效。桌面群组管理、成员、排班配置、事件和访客访问记录入口正常，未执行任何写操作。
- 正式移动端复核：390px/320px 页面无横向溢出，五个底栏按钮均为 59px 高并固定底部；320px“更多”底部页从视口底部展开，完整包含群组、排班、信息管理和账号区。状态转为待用户直接在正式站点做最终视觉验收。

## 2026-08-15 手机 Sheet 下拉框不可见回归

- 回归来源：手机月历筛选由 `7c80488` 引入，换班/加扣班表单迁入 Sheet 由 `2bb9fce` 引入；共用 `ResponsiveSheet` 的原生 `showModal()` 由 `5b00fa7` 引入。已对相关模板和调用点执行 `git log -S` 与 `git blame`。
- 根因：TDesign Select 默认把选项浮层挂到 `body`；原生模态 `dialog` 位于浏览器 top layer，浮层因此落在模态层之外而不可见、不可交互。
- 测试先行：新增回归测试后先因共享挂载策略模块不存在而失败；实现后 4/4 通过，并约束首页手机筛选 3 个、换班 7 个、加扣班 4 个 Select 全部复用同一挂载策略。
- 行为与语义审计：只把上述 Select 的浮层容器改为其最近的已打开 Sheet；选择值、`v-model`/`change`、选项生成、清空、预览/提交、异步错误路径、API 调用和调用次数均未改变。非 Sheet 场景继续使用 TDesign 默认 `body` 挂载语义。
- 运行/浏览器验证：`pnpm smoke:browser` 使用当前源码的隔离 5174 服务通过；390×844/320×844 实际点击首页筛选、换班和加扣班下拉框，选项层均位于已打开 Sheet 内且有可见尺寸，管理员、成员、访客和访问记录全流程无浏览器错误。首次运行命中 5173 上不含开发登录入口的外部进程而在登录门禁停止，未进入产品断言；未修改该进程。
- 运行验证：定向测试 4/4、Web typecheck、`pnpm verify`（71 个测试文件、490 项通过，29 个数据库集成文件、252 项因本机无测试 MySQL 跳过）和 `git diff --check` 通过，仅保留既有大 chunk warning。状态为“已完成”，checkpoint 识别消息为 `fix(web): keep sheet dropdowns visible`。
- 正式发布：发布前 `ecs-verify.sh` 通过并创建加密数据库备份 `48b7e00f-19b3-4577-aefa-dad10a0ad0bd`（44 张表、3701 行）；release `af37f5e4ecf5abcc86ac7460361bbfb47ba4c8c4` 部署成功，产物哈希、API/Web 容器、域名隔离、无开发认证依赖和 36 个迁移检查通过。部署未复制或覆盖本地数据库。
- 持续规则：用户要求今后每个完成并推送的仓库修改检查点都直接部署并线上核验；生产业务数据始终以服务器数据库为准，禁止用本地库、演示数据、凭据或会话覆盖生产。该规则写入根 `AGENTS.md`，最终状态 checkpoint 识别消息为 `docs(status): require production deployment after changes`，并作为最终 release 部署以保持服务器 release 与 Git `HEAD` 一致。
- 最终一致性：自动部署规则的收口 checkpoint 识别消息为 `docs(status): confirm automatic deployment policy rollout`；该 checkpoint 作为正式 release 部署后，以 Git `HEAD` 和服务器 `current-release` 相等为完成门禁，不再用发布后的追加文档提交制造新偏差。

## 2026-08-15 微信网站认证与 ICP 备案展示

- 来源定位：工作台应用壳与登录入口由 `e38cdba` 引入，访客入口由 `7c783c7` 引入；已对三个当前模板执行 `git log -S` 与 `git blame`。本轮不是回退既有功能，而是在ICP备案通过后补充统一合规页脚。
- 测试先行：认证文件上线前，公网验证 URL 返回 1136 字节应用首页 HTML；加入公共根目录文件后生产产物为指定 41 字节正文。ICP 页脚测试先因 `SiteComplianceFooter.vue` 不存在失败；实现后 2/2 通过，并约束登录、访客和已认证应用壳均接入同一组件。
- 行为与语义审计：认证文件只增加静态站点资源；ICP 页脚只渲染外部工信部链接。登录/注册、开发登录、访客解析、会话恢复、路由、API、错误路径、空值、权限和业务副作用均未修改，原调用次数不变。
- 运行/浏览器验证：`pnpm smoke:browser` 在正确启用 `AUTH_DEV_MODE=true` / `VITE_AUTH_DEV_MODE=true` 的当前源码服务下通过，覆盖登录、管理员、成员、访客 vkey 和访问记录，全流程无浏览器错误。首轮因 5173 未启动而连接失败，第二轮因开发认证开关未启用而在登录门禁停止，均未进入产品断言；按既有验收配置启动后原样复跑通过。
- 本地浏览器验证：1280×900 登录页及 390×844 登录、无 vkey 访客、已认证工作台均找到唯一的 `https://beian.miit.gov.cn/` 链接，文字为 `粤ICP备2026116116号-1`，链接实际点触高度均为 44px；390px 下底部导航避让后仍完整位于视口内。
- 生产认证文件：checkpoint `859f28d` 发布前后 `ecs-verify.sh` 通过；加密数据库备份 archive `0c70b166-8d94-4a51-920c-5922ca046753`（44 张表、4856 行），release `859f28d376e13f90dc4dced83c974aed12d84f5f` 已上线。公网验证 URL 返回 200、`text/plain`、41 字节且正文精确匹配。
- 运行验证：定向测试 2/2、Web typecheck、`pnpm smoke:browser`、`pnpm smoke:check-core`、`pnpm verify` 和 `git diff --check` 通过；全仓库 72 个测试文件、492 项测试通过，29 个数据库集成文件、252 项因本机无测试 MySQL 跳过，仅保留既有大 chunk warning。
- 正式发布：发布前 `ecs-verify.sh` 通过并创建加密数据库备份 `d6e8a335-c0cf-4a5f-8257-666d992a136b`（44 张表、4887 行）；release `fb192d3cbf83191b0e50fec4ffc6b68399d3245d` 部署成功，产物哈希、API/Web 容器、域名隔离、无开发认证依赖和 36 个迁移检查通过。
- 生产浏览器复核：1280×900 正式登录页、390×844 正式登录页和无 vkey 访客页均存在唯一备案链接，文案、目标 URL、`rel` 和 44px 点触高度正确；微信认证文件继续返回 200、`text/plain` 和精确 41 字节正文。
- 状态：微信认证文件和 ICP 页脚均为“已完成”，当前转为“待用户复核”；只等待用户在微信侧完成管理员认证/临时恢复并反馈结果。

## 2026-08-16 工作台紧凑抬头、月历与 ICP 范围精修

- 回归来源：常驻工作台介绍与顶部壳由 `5b00fa7` 引入，常驻四位群组码由 `056fc59` 引入，三类入口共用 ICP 页脚由 `fb192d3` 引入，触控月历与月份切换由 `7c80488` 引入；已对当前调用点执行 `git log -S` 与 `git blame`。
- 测试先行：新增正式工作台标题映射、紧凑群组选择器、登录页专属 ICP、圆角完整月历和周末红字断言；旧实现定向运行 8 项失败、8 项通过，实现后连同 Storybook 预览共 4 个文件、22/22 通过。
- 变更：移除占空间的产品 Logo/“医护排班”招牌、工作台介绍、重复群组标题与常驻群组码；顶部改为“群组名称 · 身份 + 下拉”及当前功能标题，通知/导出保持同排。日历复用 Mobile Screens 2 的 44px 紧凑分段、18px 圆角六周月历、月份切换、选中日期胶囊和周末红字；换班与加扣班复用同一标题位置。ICP 仅登录页显示，透明融入画布并保留 44px 点触与浅蓝焦点反馈。
- 语义审计：`GroupSwitcher` 保留 `modelValue`/`update:modelValue` 契约、一次 emit 与同一群组持久化/返回日历链路；通知铃从应用壳移入工作台但轮询和打开行为不变，退出仍转调同一 `signOut`，导出仍只打开原对话框。月份切换、年月输入、触控手势、筛选、日期选择、值班详情、加载与错误路径继续调用原处理函数一次；本轮未修改 API、权限、认证、路由、数据库或共享契约。ICP 的链接、文案、`target` 与 `rel` 不变，仅按用户要求缩小渲染范围。
- 运行/浏览器验证：`pnpm smoke:browser` 通过；1280×900、390×844、320×844 下紧凑抬头高度 68px、群组入口不少于 44px、页面无横向溢出，完整六周月历为 18px 圆角，月/周/列表/筛选字体不大于 13px，星期六/日及所属日期为红字。工作台/换班/加扣班标题随底栏切换且无旧招牌、介绍、全局群组码或 ICP；登录页备案链接透明融入画布并保持 44px。管理员、成员、访客、vkey 与访问记录原流程及控制台无错误，最终截图目录为 `C:\Users\eylin\AppData\Local\Temp\schedule-smoke-SNFidG`。
- 预览与构建：Storybook 提供 390/320/1280 工作台、换班、加扣班与登录页页脚预览；正式 390px 工作台截图逐屏复核通过。Web typecheck、Storybook build、`pnpm smoke:check-core`、`pnpm verify` 与 `git diff --check` 通过；全仓库 74 个测试文件、505 项测试通过，29 个数据库集成文件、252 项因本机无测试 MySQL 跳过，仅保留既有大 chunk warning。
- 正式发布：代码 checkpoint `daff238` 已推送；发布前 `ecs-verify.sh` 通过并创建加密数据库备份 `43f639de-86a9-4090-9209-e46b443310b7`（44 张表、5245 行）。release `daff238e241c0b6d9c04f0c8b21b5cca3b356ca4` 部署成功，迁移器确认仍为 36 个迁移，API/Web 容器、产物哈希、正式域名、未知 Host 拒绝和无开发认证依赖检查通过。
- 生产浏览器复核：使用正式 `D0796` 会话在 390×844 核对工作台抬头 68px、群组选择目标 44px、月历圆角 18px、无横向溢出、无产品招牌/全局群组码/ICP；星期六、日及对应日期计算色均为 `rgb(224, 49, 49)`。实际切换换班和加扣班后顶部标题分别正确，内容区不再重复标题；未触发任何业务写入。最终状态 checkpoint 识别消息为 `docs(status): record compact workbench production deployment`。

## 2026-08-16 月历跨午夜业务日修复

- 回归来源：`getChinaStandardTimeBusinessDate` 由 `7a16c85` 统一，`getCurrentBusinessMonth` 的当前月边界由 `927241c` 引入；`CalendarView` 的当前月、业务日和默认选中日期调用点已执行 `git log -S` 与 `git blame`。
- 测试先行：先增加“00:00 后仍为上一业务日、08:00 才交接”和月初当前月边界断言；旧实现定向运行失败 3 项，实现后三个定向文件 24/24 通过。完整 `pnpm verify` 通过：74 passed、29 skipped，506 passed、252 skipped（本机无测试 MySQL）。
- 语义审计：仅将业务日边界从 00:00 调整为中国标准时间 08:00；`formatChinaDateTime` 的自然时间展示、`toChinaStandardTimeShiftRange` 的跨午夜范围、日期选择/月份 API 参数、错误路径、权限、契约和数据库均保持原语义。00:00–07:59 的当前月、过去日期锁定及默认日期统一落在上一业务日，08:00 起切换。
- 运行/浏览器验证：`pnpm smoke:check-core` 通过；专项月历浏览器断言通过，当前 00:xx 环境默认选中 `2026-08-15`。完整 `pnpm smoke:browser` 已通过月历交互与新日期断言，随后在未纳入本轮的并发 `MonthGrid`/手动排班横滑改动处失败（固定列或进度提示断言），因此不报告完整 smoke 通过。当前工作区复跑 `pnpm verify` 唯一失败为 `workbench-shell-refinement.spec.ts` 仍断言旧 `.t-radio-button`，与并发未提交的原生 `.view-mode-button` 改动冲突；不修改该用户变更。提交前还需复核 `git diff --check`。
- 本轮变更文件仅为 `packages/scheduling-domain/src/time.ts`、对应测试、两个月历 helper 测试和 `scripts/smoke-browser.mjs`；工作区中其他 UI 文件保持用户改动，不纳入提交。
- 状态：已完成（含月历专项浏览器验证）→ 待用户复核；checkpoint 识别消息为 `fix(web): keep calendar on previous duty date until handover`。

## 2026-08-16 Mobile Screens 2 月历视觉一致性

- 引入点：月历工具栏和移动样式来自 `7c80488`，通知入口来自 `52e9e1f`/`5b00fa7`，月格结构来自 `ab25064`；相关调用点已完成 `git log -S` 和 `git blame`。
- 测试先行：新回归测试在旧实现上因缺少 42 格展示模型而失败；实现后新增测试 4/4、工作台壳测试 5/5 通过。`pnpm smoke:browser` 首轮因 5173 未启动停止，服务启动后先定位到相邻月禁用格，修正 smoke 只选择可用当月日期后全流程通过。
- 行为变化：月/周/列表与筛选控件、通知铃、星期栏和月格比例按 Storybook Mobile Screens 2 的量测值实现；月历固定六周 42 格并显示相邻月日期，相邻日期不可选。API、权限、业务日期、筛选值、月份切换、通知轮询和抽屉行为未改。
- 运行/浏览器验证：390×844 实测分段容器 50px、按钮 44px/13px、筛选 44px/13px、通知 44px/15px 圆角、星期栏 28px，月格 49×49；320×844 月格约 41×41，两个视口均无内容横向溢出。1280×900、月/周/列表切换、筛选及通知 Sheet 均复核通过。
- 运行验证：Storybook build、Web typecheck、`pnpm smoke:browser`、`pnpm smoke:check-core`、`pnpm verify` 和 `git diff --check` 通过；75 个测试文件、510 项测试通过，29 个数据库集成文件、252 项因本机无测试 MySQL 跳过。checkpoint 识别消息为 `fix(web): match mobile calendar Storybook styling`。
- 正式发布：发布前 `ecs-verify.sh` 通过并创建备份 `fa99e3d2-0dbf-472a-8837-3fbde4dfbe2e`（44 张表、5367 行）；release `abd20d2aa94ce3425bff446047db094542aa2466` 部署及复核通过。
- 生产浏览器复核：390px 月格 49×49、320px 月格 41.14×41.14，均为完整 42 格且无内容横向溢出；星期栏填充、周末红字、相邻月日期、工具栏、通知铃、月/周/列表、筛选与通知 Sheet 均通过。未触发业务写入。最终状态 checkpoint 识别消息为 `docs(status): record mobile calendar parity deployment`。

## 2026-08-16 Mobile Screens 2 星期栏单线回归

- 引入点：移动 `MonthGrid` 的网格间隙/分隔色背景由 `7c80488` 引入，星期栏 `border-bottom` 由 `abd20d2` 引入；本轮对 `MonthGrid.vue` 执行了 `git log -S` 与 `git blame`，确认重复分隔线的来源。
- 根因：`.month-grid` 已用 `gap: 1px` 和边框色背景绘制星期栏与首行之间的分隔线，`.weekday-row` 又追加 `border-bottom: 1px`，该边界实际占两层。
- 测试先行：新增回归断言后旧实现 5 项中 1 项失败；移除重复底边后 `mobile-calendar-storybook-parity.spec.ts` 5/5、日历相关 31/31 通过。
- 变更与语义审计：仅删除移动 `.weekday-row` 的重复 `border-bottom`；没有改变模板、日期选择、相邻月份禁用、选中态、API、权限、错误路径、调用次数或副作用。Storybook 参考组件不变。
- 运行/浏览器验证：Storybook build、Web typecheck、`pnpm smoke:check-core`、`pnpm verify`、`git diff --check` 通过；本地源码 390×844 与 320×844 均测得 42 格、1:1 月格、`weekday-bottom-border=0px`、首行间距 1px、body 无横向溢出。完整 `pnpm smoke:browser` 因既有未提交的紧凑抬头/群组选择改动在早期断言停止，未归因于本轮。
- 状态：已完成（含运行验证）→ 待用户复核；checkpoint 识别消息：`fix(web): avoid stacked mobile calendar separators`。
- 正式发布：checkpoint `de69384` 已推送；备份 archive `c9785dbd-b267-4cfa-afc4-cb1f9556b57f`（44 张表、5406 行）；release `de69384164c6806e939ec6f9d67355e0d8710170` 已部署。
- 正式域名复核：390×844 月格 49×49、320×844 月格 41.14×41.14，均为 42 格、星期栏底边 `0px`、首行间距 `1px`，无横向溢出；`ecs-verify.sh` 通过，未触发业务写入。

## 2026-08-16 工作台抬头回退与自绘群组箭头

- 回归来源：工作台抬头和原生群组选择器由 `daff238` 引入，本轮已对 `HomeView.vue`、`GroupSwitcher.vue` 及冒烟断言执行 `git log -S` 与 `git blame`；退出入口确认仍由 `WorkbenchNav.vue` 的“更多”抽屉提供。
- 测试先行：按最新参考图把抬头断言改回“群组行在上、工作台在下、两者左对齐”；当前三列实现先有 6 项失败，回退后正式壳/Storybook 11/11 通过。
- 变更：恢复原有左侧上下排列和右侧铃铛/导出结构；群组控件继续不使用 `<select>`，改为透明背景的分体式箭头按钮，点击右侧线条箭头在控件下方展开自绘列表，支持键盘、Esc、Tab、点击外部关闭和 44px 触达区。导出仍仅 owner/administrator 显示；退出登录未移回顶部。
- 运行/浏览器验证：`pnpm smoke:browser` 已通过；管理员、成员、访客、vkey 与访问记录全流程无浏览器错误，1280×900、390×844、320×844 无横向溢出，群组箭头为自绘 `combobox` 且打开后为下方 `listbox`，退出登录从“更多”抽屉完成。首次冒烟仅发现旧脚本仍查找 `#group-switcher` 和顶部退出按钮，已同步验证器到最新布局后复跑通过。
- 预览与验证：Storybook `GroupMenuOpen390` 已在 390px 实际展开/关闭预览；Storybook build、Web typecheck、定向测试 11/11、`pnpm smoke:check-core`、`pnpm verify` 和 `git diff --check` 均通过。全仓库 75 个测试文件、511 项测试通过，29 个数据库集成文件、252 项因本机无测试 MySQL 跳过；Storybook 仅保留临时配置下的 addon 解析提示、CSF 解析提示和既有大 chunk warning。
- 正式发布：网络恢复后生成 release `42c342529c8cf1e9b3f125b3ae6b3c2928b33043`；发布前加密数据库备份 archive `5dba4d9d-6a0a-4a2f-98ea-c16d8419859a`（44 张表、5410 行）。`ecs-update.sh` 成功完成迁移、API/Web 重建并写入 current-release。
- 正式核验：服务器 `ecs-verify.sh` 退出码 0；正式 D0796 会话实际展开/关闭群组 `combobox`，listbox 显示 2 个选项，Escape 可关闭，抬头/通知/导出存在且浏览器控制台无 error/warning。状态：已完成（含生产发布与线上核验）→ 待用户复核。

## 2026-08-16 群组下拉选项蓝色状态重叠

- 反馈：群组下拉展开后上下选项的浅蓝选中/悬停背景相互贴合，视觉上像蓝色框重叠，选项之间没有间隔。
- 引入点：自绘 `.group-switcher-menu` 与 Storybook `.group-menu-list` 来自 `3febef0`；已执行 `git log -S 'group-switcher-menu'` 和 `git blame`。
- 测试先行：新增两个 CSS 结构回归断言；旧实现运行结果为 2 项失败、9 项通过。加入菜单容器 `display: grid` 和 `gap` 后，`apps/web/src/views/workbench-shell-refinement.spec.ts` 与 `apps/web/src/stories/ui2/workbench-shell-refinement-preview.spec.ts` 共 11/11 通过。
- 修复：正式菜单使用 `gap: var(--ui-spacing-xxs)`，Storybook 预览使用 `gap: 4px`；仅分隔选项背景，不改变选项触达高度、选中逻辑、键盘导航、关闭行为或任何 API/权限链路。
- 运行/浏览器验证：`运行/浏览器验证：pnpm smoke:browser` 已通过（管理员、成员、访客、访问记录全流程无浏览器错误）；Web typecheck、`pnpm smoke:check-core`、任务文件 Prettier、`git diff --check` 通过。全仓 `pnpm format:check` 被既有未跟踪日历测试文件的格式问题阻塞，未改动该文件。
- Storybook 实际复核：390×844 `GroupMenuOpen390` 的菜单计算 `gap = 4px`、`row-gap = 4px`，选项数量 2，截图确认上下状态背景之间有可见留白。
- 正式发布：代码 checkpoint `4857e76` 已推送；发布前加密数据库备份 archive `ccdd8bf2-9a7f-4e8d-b1c1-198a95cd6d05`（44 张表、5442 行）；release `4857e76e976e0010d2f52520e23fc73babb88c1e` 已部署。
- 正式核验：服务器 `ecs-verify.sh` 退出码 0；正式 D0796 会话测得 `gap/row-gap = 4px`，选项高 62px、上下顶部差 66px，Escape 后 `aria-expanded=false`、listbox 数量为 0、原生 `select` 数量为 0；工作台/通知/导出各 1 个，error/warning 日志为空。
- 状态：已完成（含生产发布与线上核验）→ 待用户复核；代码 checkpoint 识别消息：`fix(web): separate group dropdown option states`。

## 2026-08-16 工作台群组名垂直间距精修

- 用户反馈：群组名上下留白过大，抬头整体高度被 44px 群组内容行撑开，需要在保持触达能力的同时收紧视觉行高。
- 引入点：当前群组切换器结构来自 `3febef0`；本轮执行 `git log -S` 与 `git blame`，确认问题只涉及 `.group-switcher`/`.group-switcher-trigger` 的最小高度与箭头定位。
- 测试先行：正式壳和 Storybook 断言在旧实现上 2 项失败、9 项通过；改动后 11/11 通过。箭头仍为 44px 触达区，文字行恢复内容高度。
- 修复与审计：移除视觉行的 44px 最小高度，箭头绝对定位居中，菜单锚点下移以保持 8px 间距；未改群组值/事件、键盘与关闭行为、权限、导出或抽屉退出登录。
- 运行/浏览器验证：`运行/浏览器验证：pnpm smoke:browser`、Web typecheck、生产 `pnpm build`、Storybook build、`pnpm smoke:check-core`、定向测试 11/11、任务文件 Prettier 与 `git diff --check` 通过。Storybook 390px 抬头 94px → 70.25px，群组文字行 20.25px，箭头 44px，菜单间距 8.13px。
- 发布修正：首次 `ecs:package` 复用了旧 `apps/web/dist`，首次线上核验仍为 44px 群组行；按当前源码重新 `pnpm build`、打包并部署同一 commit，未将首次结果视为最终发布。
- 正式发布与核验：代码 checkpoint `e841c53` 已推送；最终部署前备份 `056ea6a5-2bf1-4df0-ac6e-a989206f224e`（44 张表、5531 行），release `e841c53f0462ddf5987cb02266abaaf50e12a501` 已部署，`ecs-verify.sh` 退出码 0。正式 1280×720/390×844 抬头均为 68px、群组文字行 20.25px、箭头 44px；移动无横向溢出，listbox 2 项且 `gap/row-gap = 4px`，Escape 可关闭、原生 `select` 为 0，日志无 error/warning。
- 状态：已完成（含生产发布与线上核验）→ 待用户复核。checkpoint 识别消息：`fix(web): compact group header spacing`；最终状态 checkpoint：`docs(status): record compact group header deployment`。

## 2026-08-16 连续周视图、列表一致性与微信移动满宽修复

- 回归来源：周卡动态高度、月内周标签和列表卡片精修由 `8a49434` 引入；请假标题 `max-width: 220px` 来自 `2d6f0a2`，换班/加扣班标题与操作宽度来自 `2bb9fce`，成员标题 `max-width: 230px` 来自 `23c1d9f`，窄屏群组码 `space-between` 来自 `bfa0755`。本轮已对各关键表达式执行 `git log -S` 与 `git blame`。
- 测试先行：连续周月份、双月周标题、班种两字符截断、月式周网格、Storybook 列表一致性和移动满宽源码断言先在旧实现失败；浏览器进一步发现未定义显式 Grid 单列轨道时按钮仍会收缩到 247px，新增 `minmax(0, 1fr)` 断言后旧 CSS 2 项失败，实现后定向 27/27 及工作台壳 5/5 通过。
- 语义审计：跨月周只增加第二个月的只读日历 GET，并把 assignments 合并到原模型；请求追踪、Promise 拒绝范围、空值降级、节假日失败降级、筛选、电话、事件和日期选择处理不变。周切换仅改变 `weekStart`/选中日期，不再同步修改月视图月份，这是明确的产品行为变更。移动工作流和群组码只改 CSS，无 API、权限、数据或副作用变化。
- 运行/浏览器验证：`pnpm smoke:browser` 包装器因本机 `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY` 未进入脚本；等价命令 `SMOKE_BASE_URL=http://127.0.0.1:5174 node scripts/smoke-browser.mjs` 首轮在 Sheet 动画瞬间误判 44px“完成”按钮，独立测量为 44×44px，原样第二轮通过管理员、成员、访客、vkey 与访问记录全流程且无浏览器错误。Web typecheck、生产 build、Storybook build、Prettier、ESLint、全仓 Vitest（78 passed/29 skipped；533 passed/252 skipped）和 `git diff --check` 通过。
- 浏览器量测：Storybook 390px/320px 周视图七列 `scrollWidth = clientWidth`，七格高度一致，班种标签 `white-space: nowrap` 且最多两字符；Storybook 与正式页均实测“7月第5周-8月第1周”后右切为“8月第2周”，预览周六/日无额外“休息”标识。列表固定工具栏、今天卡、数量、元数据和电话入口与 Storybook 一致。390px 请假/换班/加扣班/成员使用 351px 单列满宽；320px 群组码按 40px 数字块、4px 间距向左聚合。
- 正式发布与核验：代码 checkpoint `a1a732a` 已推送；发布前加密数据库备份 `a238d4aa-4332-4f1a-83bf-74c18b8dc60c`（44 张表、6147 行），release `a1a732a8d675ba759b27b96a7986294b7498327f` 已部署，`ecs-verify.sh` 退出码 0。正式 390px 跨月周标题及下一周连续，周网格无横向滚动且七格等高；列表固定工具栏和今天卡正确。请假/换班/加扣班/成员满宽，320px 群组码左聚合，未触发业务写入。
- 状态：已完成（含生产发布与线上核验）→ 待用户复核。代码 checkpoint：`fix(web): unify continuous calendar and mobile layouts`；最终状态 checkpoint：`docs(status): record continuous calendar deployment`。

## 2026-08-16 日历圆角选中框与周视图今天状态修复

- 回归来源：移动月历直角格/圆角裁切来自 `7c80488`；周视图今天整格描边来自 `a1a732a`，Storybook 今天整格背景来自 `8a49434`、描边来自 `a1a732a`。已执行 `git log -S` 与 `git blame`。
- 测试先行：新增圆角末格和唯一选中态断言，旧实现 3 项失败/21 项通过；实现后定向 24/24、全仓 Vitest 79 文件/537 项通过，29 个数据库集成文件/253 项按环境跳过。
- 变更与语义：只让月历末行首尾、周历周一周日继承对应底部圆角，并移除周视图未选中今天的整格蓝框；黄色日期圆点、`aria-current`、选中事件、详情及全部业务/API 语义不变。
- 运行/浏览器验证：`pnpm smoke:browser` 通过；Storybook build、Web typecheck/build、任务文件 Prettier/ESLint、任务文件 `git diff --check` 通过。390/320px 实测月视图 8 月 31 日左下圆角、周视图周日右下圆角描边完整；选中 14 日后今天 16 日只保留黄色圆点且无第二蓝框。完整 `pnpm verify` 仅被并发中的无关 API 格式问题拦截，`smoke:check-core` 仅被无关未提交 contracts 变更触发。
- 正式发布与核验：代码 checkpoint `c64f0d7` 已推送；发布前加密备份 `c2412550-9ae2-463f-8d1f-a488a7d9abb0`（44 张表、6218 行），release `c64f0d7f166adc61f0a6f9470f09519175c718e6` 从干净 worktree 构建并部署，`ecs-verify.sh` 退出码 0。正式 390/320px 月视图底角描边完整；周视图点击非今天后，今天仅保留黄色日期圆点、`aria-current=date` 且 `aria-pressed=false`，被选日期是唯一蓝框。
- 状态：已完成（含生产发布与线上核验）→ 待用户复核。代码 checkpoint：`fix(web): align rounded calendar selection states`；最终状态 checkpoint：`docs(status): record rounded calendar selection deployment`。

## 2026-08-16 群组后台管理与导出修复

- 回归来源：`export-jobs` 调度遗漏为 `eab3ff2`；随机群组码为 `1b5a17a`；成员认领界面为 `d117bb0`；电话确认权限为 `8e42afb`。均已通过 `git log -S` 与 `git blame` 核对。
- 测试先行/集成验证：新增导出调度、手填群组码/同名预设绑定、developer admin 跨群隐藏权限、普通用户禁改名和 admin 专属历史认领覆盖。隔离 MySQL 实测空库迁移至第 37 版并重复运行成功；相关 API 集成断言均通过。
- 运行/浏览器验证：`pnpm smoke:browser` 通过（管理员、普通成员、访客/vkey 与访问记录全流程无浏览器错误）；390px 普通成员页仅显示本人姓名/联系方式和姓名目录，输入与保存触控区不小于 44px。`pnpm smoke:check-core`、`pnpm verify`（79 个文件/537 项通过，29 个数据库集成文件/251 项按环境跳过）和 `git diff --check` 通过。
- 正式发布：`394b1c8` 已推送并部署；发布前备份 `51bdbfac-39b5-49e4-b203-0ee00d14496b`（44 张表、6226 行），生产迁移为 37，`ecs-verify.sh` 退出码 0。后台账号线上平台权限为真并可见 2 个群组，成员/联系人结果各 7 项且不含隐藏账号；一次 `2026-08` CSV 导出由 `pending` 完成至 `completed` 并成功下载 1551 字节。未为测试在生产创建普通账号，其资料边界已由隔离 MySQL 集成测试和本地浏览器 smoke 覆盖。

## 2026-08-16 成员通讯录与通知开关落地

- 回归来源：成员联系方式被收窄为本人可见、仅后台管理员可管理由 `394b1c8` 引入；成员姓名目录分支同样来自 `394b1c8`，常驻本人输入表单来自 `23c1d9f`；通知开关强制 44px 高度来自 `6ec287d`。均已执行 `git log -S` 与 `git blame`。
- 测试先行：旧后端在隔离 MySQL 中 2 项失败、5 项通过，准确暴露“普通成员只能读取本人、群主确认他人被 403”；旧生产 UI/通知源码断言 4 项失败、1 项通过。实现后成员/通知定向 14/14、Storybook 预览 6/6、群组相关 API 集成 13/13 通过。
- 前后端匹配：同群 active owner/administrator/member 可读取完整有效通讯录；继续排除 guest、停用/删除和隐藏后台账号，跨群 403。普通成员仅能修改本人且不能确认；群主、群管理员、后台管理员均可修改并确认任意有效成员。生产成员页改为统一通讯录、本人无常驻输入框、保存成功关闭 Sheet 并刷新；通知开关由 60×44px 外层点触区承载，TDesign 本体不再被拉高，权限仍只在用户主动开启/重新注册时申请。
- 运行/浏览器验证：`pnpm smoke:browser` 最终通过管理员、普通成员、访客/vkey 和访问记录全流程，无浏览器错误；1280×900、390×844、320×844 成员/通知页面无横向溢出，后台管理员有他人修改入口、普通成员仅有本人修改入口，编辑 Sheet 真实打开；通知外层点触区不小于 60×44px且开关本体低于 44px。前两轮分别准确发现旧 smoke 文案/权限假设和 TDesign 内部 checkbox 尺寸测量问题，只修正验证器目标后原样复跑通过。最终截图目录为 `C:\Users\eylin\AppData\Local\Temp\schedule-smoke-H6ZvoG`。
- 正式只读复核发现群主已具备确认权限但 Sheet 仍沿用“后台确认联系方式”旧文案；新增断言先失败后改为“确认联系方式”，不改变 checkbox 状态、请求 payload、权限或保存链路。修正后 `pnpm verify` 再次通过（83 个文件/548 项通过，29 个数据库集成文件/252 项按环境跳过）。后续 checkpoint 识别消息：`fix(groups): align contact confirmation label`。
- 正式发布：主 checkpoint `6183e9d` 与文案修正 `f9d0889` 均已推送；发布前加密备份分别为 `0ebc4723-ac13-429b-ab62-56c003b99196`（44 张表、6916 行）和 `55cb9743-5f8f-4f1e-a70d-9028f0519d6f`（44 张表、6951 行）。最终业务 release `f9d0889d194a39265f3efb9f8591d44601e00c08` 的 `ecs-verify.sh` 通过；正式 1280/390/320 成员页无横向溢出，Sheet 使用新文案，通知点触区 60×44px、开关本体 52×20px，浏览器日志为空，未触发业务写入或通知权限申请。

## 2026-08-17 手机日历拖动、工作流开关与自定义配色修复

- 回归来源：日历指针捕获/释放和三面板滑动由 `41d284b` 引入，周历底角由 `c64f0d7` 引入；换班与加扣班 checkbox 分别来自 `b20ff9b`、`5d8b205`；原生 `input[type=color]` 与自定义色徽标来自 `41d284b`。相关调用点均已执行 `git log -S` 与 `git blame`。
- 测试先行：新增触屏指针隔离、周历等高/拖动圆角、工作流 CompactSwitch、内嵌色域和徽标居中断言；旧实现 4 个文件 6 项失败、10 项通过，修复后 16/16 通过。
- 变更与语义审计：旧手势清理先清空当前 pointer，再释放捕获，并按 pointerId 忽略延迟的 lost capture；周历三面板等高，拖动中仅移除面板自身底角。换班/加扣班 4 个布尔设置复用 CompactSwitch，原 API 调用次数、boolean payload、异常范围不变。自定义颜色改为页面内 HSV 色域、色相滑杆与 HEX，移除浏览器原生调色器；预设颜色、v-model 更新和应用关闭行为保留。
- 运行/浏览器验证：`运行/浏览器验证：pnpm smoke:browser` 通过（管理员、成员、访客/vkey 与访问记录全流程无浏览器错误）；首次因 5173 未启动、第二次因临时进程未启用开发认证停止，按当前源码与临时开发认证覆盖启动后完成。Storybook 390px 实测无横向溢出、无 `input[type=color]`，色域 298×92px，点击可更新 HEX，“+”徽标视觉居中。
- 正式发布与核验：代码 checkpoint `acd2507` 已推送；发布前加密备份 `b38a4aea-a518-43c9-ba90-b18cc9d31f58`（44 张表、9970 行），release `acd25070b084768beede2fe40bf8c5e51d4fa7de` 已部署，`ecs-verify.sh` 退出码 0。正式周历三面板/当前网格底边精确对齐；换班/加扣班开关为 60×44px 点触区、52×30px 轨道；调色板无原生 color input、色域 308×92px且无横向溢出，浏览器日志为空。全程未保存配置或触发业务写入。

## 2026-08-17 原生触控日历与班种开关滚动位置修复

- 反馈：手机月/周历触屏拖动粘滞或无法通过；2026-09/10/12 月卡被相邻六行月份撑出空白；相同周内容高度随周次变化；班种启停保存会整页刷新并滚回顶部。
- 引入点：`41d284b` 引入 pointer capture + transform 三面板；`8a49434` 引入逐周内容高度；`acd2507` 强制三面板填满；`04c7da3` 在通用保存后调用整页 `loadConfig()`。已完成关键表达式的 `git log -S`/`git blame`。
- 测试先行：旧实现定向 5 失败/5 通过；实现后定向 19/19、Web 全量 410/410。回归断言要求无 pointer capture/`preventDefault`、原生 `scroll-snap`、子月格允许横向 pan、当前面板高度插值、周格 86px 基线，以及启停路径不得调用 `saveShift`/`loadConfig`。
- 修复与语义：采用 W3C 官方规范对应的原生横向滚动和惯性；保留真实前/中/后三页，触摸期间不启动 JS settle 定时器，松手后兼容 `scrollend` 与旧 WebView 回退。高度按滚动进度在三面板间插值，静止时等于当前面板。班种启停使用原 API 一次，成功局部合并返回值、失败恢复开关；通用保存逻辑未改。
- 运行/浏览器验证：`运行/浏览器验证：node scripts/smoke-browser.mjs` 通过。CDP 原生 touch 左滑月/周均切换，竖向主导手势不换月；2026-09 视口/五行面板差值 ≤1px；周七格均不低于 86px、互差 ≤1px、面板/视口底边差值 ≤1px；班种开关保存前后控件屏幕位置差值 ≤8px并恢复原状态。管理员、成员、访客/vkey、访问记录全流程无浏览器错误。
- 其他验证：Web typecheck/build、Storybook build、Prettier、ESLint、smoke core check、`git diff --check` 通过。全仓 `pnpm verify` 被本机 pnpm 无 TTY 生产依赖预检与既有数据库测试清理顺序阻塞；全新测试库仍可复现，与本轮 Web 改动无关。
- 正式发布与只读核验：代码 checkpoint `ee63532` 已推送；发布前加密备份 `f3b9a899-3c1a-41c1-bd26-075198dce913`（44 张表、10765 行），release `ee6353263d87fba18fe1d018e5347e44d1d6e2e2` 已部署且发布前后 `ecs-verify.sh` 通过。正式 390px 的 2026-09 为 35 格，视口/面板高度差小于 1px；周历七格与视口均为 86px；配置页开关点触区 60×44px、无横向溢出、浏览器日志为空，未触发业务写入。最终状态 checkpoint 识别消息为 `docs(status): record native touch calendar deployment`，发布前备份为 `d94afa5f-0192-4cb1-966a-10660d546143`。

## 2026-08-17 日历翻页性能、定位动画、标识密度与统一选择器预览

- 引入点：固定 180ms 程序滚动结算来自 `ee63532`；翻页选择重置来自 `41d284b`/`8a49434`；标识尺寸差异来自 `48c6fdd`/`a1a732a`。均已对修改调用点执行 `git log -S` 与 `git blame`。
- 失败复现与测试先行：旧实现缺少异步资源缓存，性能/选择/定位/标识预期共 7 项失败；追加的程序滚动排队和不得被短 idle timer 覆盖断言也先红后绿。实现后定向 86/86、全仓 Vitest 593/593 通过（253 项数据库集成按默认环境跳过）。
- 修复：程序翻页等待 `scrollend`，旧 WebView 700ms 回退；程序滚动期间不使用 180ms idle settle，连续点击排队。相邻月和节假日按群组缓存，聚焦/冲突强刷；`CalendarReadModel` 和节假日 Map 改为整体替换的 `shallowRef`。选择只在首载初始化，翻页不再重置。定位今天通过现有月/周三面板动画；列表定位不变。日历四类标识统一 16px/14px 高的紧凑几何。
- 语义等价审计：API 接收者与调用方式不变；缓存拒绝时删除条目并沿原 catch 处理，聚焦和冲突路径显式 `forceRefresh`；筛选、空值、最新请求判断、日期点击、详情和副作用次数不变。唯一行为变化是减少重复只读 GET、保持用户选择和为定位增加已认可动画。
- 运行/浏览器验证：`运行/浏览器验证：pnpm smoke:browser` 的包装器受本机非 TTY 依赖检查影响，等价入口 `node scripts/smoke-browser.mjs` 通过管理员、成员、访客/vkey 和访问记录全链路，无浏览器错误。390px 单击翻月、40ms 双击排队、月定位、单击翻周和周定位均观察到中间滚动位移并一次结算；Web typecheck/build、Storybook build、Prettier、ESLint、直接全仓 Vitest 与 `git diff --check` 通过。
- `frontend-design`/Storybook：新增统一月份、日期、时间选择器预览，手机底部 Sheet、桌面邻近浮层，保留医疗蓝、浅蓝摘要和系统字体；390/320/1280 无溢出、键盘焦点、减少动态、44px 主操作与 Axe WCAG A/AA 0 违规。四张确认图位于 `C:\Users\eylin\.codex\visualizations\2026\08\17\schedule-temporal-picker-preview`。生产选择器未改，等待用户确认。
- 正式发布与复核：checkpoint `628c79f` 已推送；备份 `494a53f0-db00-4c97-8469-71308de60e88`（44 张表、11348 行），release `628c79f27816302c781f429d4628be949b5b3f22` 已部署，发布前后 `ecs-verify.sh` 通过。正式 390px 减少动态会话中，月/周单击和定位均一次成功并按偏好即时完成；离开/返回 8 月时原 8月17日选择恢复。9 月“班”标识为 14px/8px/2px/3px，无溢出、日志为空，未写入业务数据。
- 状态：生产日历/标识已完成发布与线上只读复核；选择器仍为待用户确认设计稿。

## 2026-08-18 班种时间弹窗与跨日校验回归

- 引入点：`git log -S`/`git blame` 确认弹窗仅用 `event.target === dialog` 判断遮罩点击由 `92038cd` 引入；班种时间与跨日校验及直接绑定草稿时间由 `04c7da3` 引入，统一时间选择器替换仍保留了该直接绑定。
- 失败复现与测试先行：正式域名桌面端打开 A 班开始时间后点击弹窗外部，弹窗未关闭；新增坐标边界、监听器生命周期、时间顺序同步与 24 小时跨日集成断言后，旧代码因缺少 helper/监听器且后端拒绝 `08:00–次日08:00` 而失败。实现后 Web 定向 7/7、排班配置 API 集成 5/5 通过。
- 修复与语义：`TemporalPicker` 在打开期间使用捕获阶段 `pointerdown` 和可见矩形坐标判定外部点触，关闭/原生 close/卸载均移除监听器；取消仍不发出值变更并恢复原触发器焦点。开始或结束时间完成选择后，仅在双方均非空时把“结束时间早于或等于开始时间”同步为跨日；API 允许 `相同时间 + 跨日` 表示 24 小时，仍拒绝相同时间非跨日及其他不一致组合。权限、事务、保存请求次数和错误恢复路径未改。
- 运行/浏览器验证：`pnpm --config.verifyDepsBeforeRun=false smoke:browser` 通过管理员、成员、访客/vkey 与访问记录全流程且无浏览器错误；本地 Storybook 实际打开时间弹窗后点触面板外立即关闭。Web/API typecheck、Web build、定向 Vitest 与真实 MySQL 集成通过。首次 smoke 在服务未启动、开发登录未开启时按预期停止；一次 44px 瞬时量测失败原样复跑通过。
- 完整 `pnpm --config.verifyDepsBeforeRun=false verify` 的格式与 ESLint 已通过，构建被并行中的无关未提交通讯录测试 `directory-entry-groups.spec.ts` 引用尚未创建的 `directory-entry-groups.js` 阻断；本任务文件级 Prettier/ESLint、Storybook build 与 `git diff --check` 均通过，未修改该无关批次。
- 正式发布与只读复核：代码 checkpoint `b24a5b6` 已推送；发布前加密数据库备份 archive 为 `5b4bbb06-a9b6-4db7-afeb-1b134069a350`（50 张表、18408 行、7290860 字节，SHA-256 `a956b55aee98776927b942a6861273b3caacc088ab5ea7df05a0d21f4a071a5a`）。release `b24a5b6e3e1bbf9be2dc10661dd8d14ef7a9ea23` 从干净 worktree 构建并部署，`ecs-verify.sh` 通过；容器预热首次健康检查 502 后自动恢复。
- 正式域名无写入复核：A 班时间弹窗打开后点击外部，dialog 数量从 1 变为 0、触发器 `aria-expanded` 从 true 变为 false；未保存草稿选择 20:00→08:00 后“跨日”自动变为 true。随后刷新页面丢弃草稿，未点击班种保存/启用，浏览器日志为空。状态：已完成（含生产发布与线上核验）→ 待用户复核。

## 2026-08-18 手动排班刷新与时间选择器响应修复

- 回归来源：`git log -S`/`git blame` 确认手动排班定时刷新由 `eaadbdd` 引入；`b0f5dc6` 将业务日边界调整为中国标准时间 08:00 后，原“业务日 + 次日午夜”算法在 00:00–08:00 会得到过去时刻，并由 1 秒下限退化成循环刷新。选择器左侧图标、90ms 停止防抖和逐项 `scroll-snap-stop: always` 均由 `92038cd` 引入。
- 测试先行：业务交接延迟 helper 缺失、触发框仍有左图标且滚轮仍依赖定时器，旧代码新增用例失败；实现后定向 8/8 通过。用例覆盖 07:45 等待至 08:00+5 秒、09:30 等待次日交接、文字优先触发框、逐帧选中与无强制逐格停顿。
- 实现与语义审计：刷新时间严格按下一个未来的中国标准时间 08:00 交接点计算，初载、窗口聚焦、请求接收者、Promise 错误范围和卸载清理不变。触发框去掉装饰图标，视觉日期压缩为 `YYYY-MM-DD 周X`，完整中文日期保留在 `aria-label`；44px 点触面积、完成才 emit、取消不写值不变。滚轮保留浏览器原生惯性和中心吸附，移除逐项强制停止，滚动中每动画帧更新内部草稿，`scrollend` 只做最终校准；API 与业务副作用次数不变。
- 运行/浏览器验证：`运行/浏览器验证：node scripts/smoke-browser.mjs` 最终通过管理员、成员、访客/vkey 与访问记录全流程，无浏览器错误；前两次分别因本地 5173 未启动和未开启开发认证按门禁停止。主工作区 Vitest（显式排除用户自有 `runtime/**`、`src/**` 副本）109 files / 649 tests 通过；Web typecheck/build、Storybook build、任务文件 Prettier/ESLint、`node scripts/smoke-browser.mjs --check-core` 与 `git diff --check` 通过。完整 `pnpm verify` 的格式、Lint、构建和类型检查已通过，其测试发现并扫描用户自有 `runtime/` 副本后人工停止，未改动这些目录。320px 日期文本 `scrollWidth = clientWidth = 192px`、按钮 44px；390px 时间滚轮 40ms 内由 08:00 更新为 10:00，550ms 后无二次跳变；Storybook Axe 为 0 项违规。
- 正式发布与只读复核：代码 checkpoint `140b3fc` 已推送；发布前加密数据库备份 archive 为 `e409adc5-d2ae-4ab0-8b5a-c039a729ca7d`（50 张表、18447 行、7305428 字节，SHA-256 `77d143990c6ecc14ce7e86052db8ca797964f6c3876bf32673a82b781f7979f5`）。release `140b3fc44f432e18f0f390e9d37003128cb09ae8` 从干净 worktree 构建并部署，`ecs-verify.sh` 通过；容器预热首次健康检查 502 后自动恢复。
- 正式域名刷新到新 Service Worker bundle 后，手动排班页连续 5 秒无加载态或循环刷新；日期触发框显示 `2026-08-18 周二`，无左图标、44px 高且 `scrollWidth = clientWidth = 181px`，完整中文日期仍在无障碍名称。未保存时间草稿 08:00→10:00 在 40ms 内同步标题，550ms 后无二次跳变；点击取消后触发框仍为空值，未保存班种，浏览器日志为空。状态：已完成（含生产发布与线上核验）→ 待用户复核。

## 2026-08-18 P1 MiniTest 清单与 Minium 套件

- 回归来源：`git log -S`/`git blame` 确认基础控件 `dialog-open` 和 7×7 `vertical-scroll` 状态均由 `c8d50f5` 引入；已确认用户通过的 Storybook/原生基础页无对话框，7×7 的 82px 表头加 7×44px 数据行恰好占满 390px，不存在纵向滚动。
- 测试先行：新增 Minium 套件契约测试先因 helper 不存在失败；实现后 4/4 通过，锁定 4 个 `test_*` 方法、18 个截图名、稳定 WXML selector、无凭据边界和单文件根目录确定性 ZIP。Python 3.12 AST 校验通过。
- 修复与实现：清单改为实际交互状态；基础控件使用通知开启、联系方式取消核对和周视图选择，7×7 只测横向滚动，20×30 继续覆盖横纵滚动、失效格、单格更新和撤销。新增官方 `minium.MiniTest` Python 套件、确定性 ZIP 构建器和平台运行手册；生产 WXML 只增加无样式 selector，不改事件、状态、调用次数或业务数据。
- 运行/浏览器验证：Mini 45/45，staging/production verify、11 个 Worklet、确定性、源码/包体、CI/MiniTest dry-run、根 lint/build/typecheck、主工作区 119 文件/703 项、`pnpm smoke:check-core` 与任务文件 Prettier 通过；未触及核心 Web 链路，无需 `pnpm smoke:browser`。根格式检查仅被本轮前用户自有 `apps/miniprogram/project.config.json` 拦截。
- 外部状态：未启动本地微信开发者工具，未生成预览、上传开发/体验版或提交 MiniTest。平台仍需用户上传 ignored ZIP、建立计划并注入仓库外凭据后才能取得 Android/iOS 原生证据。

## 2026-08-18 P1 改为用户人工原生验收

- 决策覆盖：用户明确不使用 MiniTest/Minium 云测，改为用户人工打开微信开发者工具并在实体 Android 测试；用户反馈“通过”后继续 P2。上一节记录的是已推送但尚未部署的 `a9c71d6` 历史实现，现已被本节取代。
- 变更边界：移除云测 API runner、Minium Python/ZIP 构建器、云测命令/凭据说明及为自动化添加的产品 selector；保留 P1 基础控件、42 格月历、7×7/20×30 矩阵、确定性构建、simulate 与可选截图比较器。页面视觉、交互事件、Worklet、业务数据和 API 均未改变。
- 人工门禁：`testing/p1-manual-test-plan.json` 与 `docs/runbooks/manual-native-testing.md` 固定四条路由、实际交互状态、视觉/性能目标及反馈格式。通过不强制截图；失败需给出页面、状态和现象，之后只修失败项。
- 运行/浏览器验证：Mini 10 文件/35 项；staging/production verify、11 个 Worklet、确定性、源码/包体、无凭据 CI dry-run、根 lint/build/typecheck、排除用户自有 `runtime/**`/`src/**` 后主工作区 118 文件/693 项（31 文件/261 项按环境跳过）、任务文件 Prettier、`git diff --check` 和 `pnpm smoke:check-core` 通过。未触及 Web 核心链路，不需要 `pnpm smoke:browser`；根格式检查仅被用户自有 `apps/miniprogram/project.config.json` 拦截。LLM 未启动、唤醒或控制本地微信开发者工具。
- 正式发布：checkpoint `e53f361` 已推送；备份 `6d16b012-6d69-4728-a335-59ad00396999`（50 表、18,497 行、7,370,892 字节，SHA-256 `e6de3f9c748aa3db8b2789f1214bb48fdf61aa42f5293af3ba9f9e629e063eff`）成功。release `e53f3611350fa60c846f2f649f68b4fea9616f41` 从隔离干净 worktree 部署，容器预热首个健康检查一次 502 后恢复，`ecs-verify.sh`、正式首页和 API 通过；此前云测 checkpoint `a9c71d6` 未单独部署。

## 2026-08-18 P1 基础控件安卓按钮轨道与页面滚动修复

- 反馈与引入点：用户人工确认月历 B 通过；实体 Android 的基础控件页四个按钮各保持约半宽却逐行换行，Android 与 PC 开发者工具均无法向下滚动，阻断 A 后续及 C/D。`git log -S`/`git blame` 确认 `.button-cell { width: 50%; padding: 4.5px; }` 和仅依赖普通根节点的基础页均由 `24bc2c4` 引入。
- 测试先行：新增基础页必须使用全高纵向 `scroll-view`、按钮格必须显式 `border-box` 的结构回归；旧代码先因没有滚动容器失败，修复后定向 5/5、Mini 全套 36/36 通过。
- 修复与语义审计：保留 Web 黄金的 390px 两列和 320px 单列，不改按钮尺寸、文案、variant、禁用/加载态或事件；只让 50% 轨道把 padding 计入自身宽度。基础页增加全高原生纵向滚动容器，内容与状态组件结构不变；没有修改已通过月历、矩阵、API、store 或业务数据。
- 运行/浏览器验证：Mini 10 文件/36 项、排除用户自有 `runtime/**`/`src/**` 的主工作区 118 文件/694 项通过（31 文件/261 项按环境跳过）；staging/production verify、11 个 Worklet、确定性、源码/包体、无凭据 CI dry-run、根 lint/build/typecheck、任务文件 Prettier、`git diff --check` 与 `pnpm smoke:check-core` 通过。staging/production 包体为 101,403/101,396 bytes，manifest 为 `b9589e46d2b871df8272fc7662ede7cee6f986f5b59b48344e964944deb6aff6` / `abd93dab69da4b65e6df0cb35f9e95facc0cc6f86a1dd22964b0e331196ec084`。根 `format:check` 仍只被用户自有 `apps/miniprogram/project.config.json` 拦截；未触及 Web 核心链路，无需 `pnpm smoke:browser`。全程未启动或控制微信开发者工具。当前状态为已实现待用户复测基础控件 A，随后继续 C/D。
- 正式发布：代码 checkpoint `9c5c8b1` 已推送；发布前加密数据库备份 archive 为 `1ef4216c-1a80-42aa-86b8-129d5de5ad65`（50 表、18,499 行、7,372,208 字节，SHA-256 `72c3d890b717d8ffc4403e3b8fa213b2c7fc0ca495d0542f03c4913ad3cbd21f`）。release `9c5c8b1ada36dcb88a05e89753fec3b3cac710af` 从干净 worktree 构建并部署；容器预热首个 TLS 健康检查一次断开后恢复，`ecs-verify.sh`、外部正式首页与 API 均通过。最终状态 checkpoint 识别消息：`docs(status): record foundation native fix deployment`。

## 2026-08-18 P1 安卓预览内测试入口

- 反馈与定位：基础页滚动修复在用户 Android 上生效，但月历和矩阵不可见。`git log -S`/`git blame` 确认月历与矩阵自 `1f715c9`/`6cc7463` 起就是独立路由；之前只能在开发者工具切换编译模式，没有预览内入口。
- 设计与实现：依 `frontend-design` 保持临床蓝、病历纸白、系统字体和紧凑卡片；在基础页“状态反馈”后新增“人工测试入口”，三行 52px 原生 `navigator` 分别进入月历、7×7 和 20×30。入口只做测试路由，不把矩阵嵌进基础页，不改变已确认页面的布局、Fixture、事件或 Worklet。
- 测试先行与验证：新增三个精确 URL、入口数量和 52px 触控行断言，旧代码因没有 `navigator` 先失败；实现后定向 6/6、Mini 全套 37/37、排除用户自有 `runtime/**`/`src/**` 的主工作区 118 文件/695 项通过（31 文件/261 项按环境跳过）。staging/production verify 保留 11 个 Worklet，包体为 103,806/103,799 bytes，manifest 为 `3d2ec066cf7f054d7f08e1a182d8dfebcb476beaa844c0559a6d229b62b1e8b1` / `a9e3f8b6d4b0c83fc728e56e4bf00d47b4f291b23674d26aebc2929bf5743847`；确定性、无凭据 CI dry-run、根 lint/build/typecheck、任务文件 Prettier、`git diff --check` 与 `pnpm smoke:check-core` 通过。根 `format:check` 仍只被用户自有 `apps/miniprogram/project.config.json` 拦截；未启动或控制微信开发者工具，当前待用户重新编译并从入口完成 A/C/D。
- 正式发布：代码 checkpoint `e2852ef` 已推送；发布前加密数据库备份 archive 为 `07fb20ed-651b-43e1-b09d-82d9ef2415ca`（50 表、18,501 行、7,373,524 字节，SHA-256 `87751e7f8800d6691082b3e922317d6e39c3d4906b2e438a9beb76f11e1872b4`）。release `e2852ef603a0f8dee5dc5e991243b63d0a0182be` 从干净 worktree 构建并部署；容器预热首个健康检查一次 502 后恢复，`ecs-verify.sh`、外部正式首页与 API 均通过。最终状态 checkpoint 识别消息：`docs(status): record native p1 navigation deployment`。

## 2026-08-20 护士多班种日历偏好与分组详情落地

- 引入点：`git log -S`/`git blame` 确认默认月视图与通用筛选来自 `db35a77`/`ab25064`，选中日期逐班次轨道来自 `1c84fd6`，群组设置入口来自 `720404a`。本轮只在 `CalendarView` 数据调用点应用月视图默认班种，并重构 `SelectedDateDutyDetails`；`MonthGrid.vue`、`WeekGrid.vue` 源码哈希由回归测试锁定且不修改。
- 运行/浏览器验证：`pnpm smoke:browser` 的等价直接入口 `node scripts/smoke-browser.mjs` 已在当前源码 5173 与开发认证 API 3000 上运行；本机 MySQL `127.0.0.1:3306` 拒绝连接，管理员登录回退 `/login?redirect=/`，因此完整业务 smoke 在登录门禁停止。独立 Storybook 真实生产详情组件已在 390px 验证同班三人收进一张 D 班卡、姓名全部可见、短号/手机分体拨号、44px 操作和无横向溢出；控制台无产品错误。Docker Desktop 未运行，隔离 MySQL 集成测试按环境跳过。
- 正式发布与核验：代码 checkpoint `f723b0d` 已推送；发布前加密数据库备份 archive `9b092f7f-4fc9-4002-964a-09c2cac62e9a`（50 表、157657 行、70951728 字节，SHA-256 `8bd68d81e2390a5b13986d57702641edfb026d4823d6f2490bf32d22f030a13a`）。隔离干净工作树构建并部署 release `f723b0dbbe5b5f313158f2f76f8466159443074d`；预热首次 502 后恢复，`ecs-verify.sh` 通过。正式数据库为 43 条迁移且 4 个偏好列齐全，健康 200、未认证偏好端点 401，Web/API bundle 接线命中；未写入排班业务数据。

## 2026-08-22 密码提醒永久不再提示与弹窗收口

- 引入点：`git log -S 'dismissPasswordReminder'` / `git blame` 确认 `664bc1f` 首次把“不再提示”实现为会话内 `ref`；`getFocusableElements(dialog.value!)[1]` 同样来自 `664bc1f`，去掉右上角关闭按钮后会跳过第一个密码输入框。
- 测试先行：旧实现新增的弹窗文案/移除关闭按钮、焦点索引、永久偏好与“取消仅本次关闭”断言先失败；实现后生产弹窗 2/2、会话管理 13/13 通过（工作区扫描含用户自有 `runtime/**` 副本共 42 项）。
- 实现与语义：移除右上角关闭按钮，次级操作只显示“不再提示”；取消路径新增 `closePasswordReminder`，只关闭当前会话；“不再提示”新增按 `user_profiles.id` 隔离的 `localStorage` 偏好，登录、恢复会话与刷新密码状态均读取，存储异常不阻断登录。密码校验、修改提交、焦点陷阱和 API 调用次数不变。
- 运行/浏览器验证：`pnpm smoke:browser` 已运行，在第 1/6 步访问 `http://localhost:5173` 因本机无 Web 服务以 `ERR_CONNECTION_REFUSED` 停止；`pnpm smoke:check-core` 首次按门禁提示需先记录本条浏览器结果，记录后待复核。Web typecheck/build、Storybook build、任务文件 Prettier/ESLint、定向 Vitest 通过；Storybook 390×844 需复核“不再提示”文案、无右上角按钮及取消/永久偏好交互。
- 正式发布：代码 checkpoint `fc05236` 已推送；数据库备份 archive `cd80262e-341e-4b41-8aef-10f3b4cd7c5d`（50 表、157702 行、70981852 bytes，SHA-256 `7ff5252339a3072defdf91bfaccb1eed01f501d1d6aa8afd934c4470a5572e95`）后，release `fc052367239cf4c67430c9d61ddc993bb33974d6` 已部署；预热首次 502 后恢复，`ecs-verify.sh`、正式首页/API 200，线上 bundle 只读命中“不再提示”且不含旧文案/关闭类名。
- 当前状态：已完成（含 Storybook、代码发布、生产备份、ECS 验证与正式 bundle 只读复核）→ 待状态 checkpoint 收口；其他用户自有小程序/Storybook/runtime/src 改动未纳入。
