# Project Status

本文档只记录当前可安全接续的状态；详细历史以 Git 提交为准。

## 2026-08-25 P9-A3 原生访客访问审计页（已实现，待实体机复核）

- 范围：新增 `subpackage-insights/pages/visitor-access` 与 `visitor-access-panel`，从 More 入口进入；并行读取月份聚合/最近访客日志，支持 ready/loading/empty/error/insights-disabled、游标加载更多、390/320 紧凑布局和 44px 操作。
- 共享/权限：接入 `createRuntimeVisitorAccessReadClient`，两个 GET 只读端点统一 `insights` capability 和 Bearer transport；生产 `insights=false` 仍只显示关闭态，不读取业务数据；普通成员入口继续由服务端权限失败关闭。
- 隐私：只在页面内存保存脱敏展示模型，IPv4 末段与 request id 均最小化遮罩；不写缓存、日志、token、visitor key 或原始访问正文；明确 90 天明细保留/匿名聚合说明。
- 回归/验证：先红后绿 P9 原生边界 3/3；Mini 正式源码范围 56 files/285 tests（排除用户自有 `.artifacts/` 副本）通过；`typecheck`、production verify（193 files、packageBytes `4,563,146`、manifest `4bd52c96f1f5d387d646d7954409e5320dab75be9a937cc158f662f56a06eff1`）、source/package/determinism/CI dry-run 全部通过；`subpackages/insights` 约 340,309 bytes。
- 发布/运行：代码 checkpoint `ca7d92ee`（`feat(miniprogram): add p9 visitor access insights page`）已推送；生产备份 archive `b47cff9f-9f80-48a3-93c6-33148f170df9`（54 表/170,676 行/79,622,292 bytes/SHA `ceb9204a68eee47e64aa14cb222de45a91b8a124daad935a9a2c84dae4889655`）后部署 release `ca7d92ee761432ae2aaf4560a272e99fd1673598`。`ECS_PUBLIC_IP` full `ecs-verify.sh`、health 200、artifact/control-plane/migration/unknown-host 检查通过；生产 `insights=false` 未变，远端临时目录已清理。
- 体验/状态：已实现待浏览器/原生复核。尝试用仓库外 key 上传 `0.1.0-p9.20260825.1` 时，微信 CI 返回 `invalid ip: 2409:8a55:4012:49f0:6902:ba73:37c8:810f`，外部状态未改变；需先将当前出口 IP 加入微信公众平台 CI 白名单，再补传同一 commit，不能用 dry-run 代替。正式审核/发布不在本批范围。用户需在 Android 实机验证管理员/成员权限失败关闭、访客访问记录、加载更多、弱网、前后台和大字号。

## 2026-08-25 P9-A2 访客访问 Web 黄金（已完成，待用户复核）

- 设计意图：采用“医疗审计台”方向——临床蓝、白色病历卡、访问脉搏柱状聚合与纵向审计针线；单一任务是回答“谁在查看排班”，只呈现访问时间、查看月份、最小化来源线索和 90 天保留说明。
- 黄金状态：新增 `P9VisitorAccessGolden` 与 7 个精确 story：390 ready、320 边界、大字号、loading、empty、error retry、insights disabled；主要操作保持 44px，移动端日志转卡片，无横向溢出设计。
- 验证/预览：P9 黄金定向 2 tests、Web typecheck、Storybook production build 通过；预览地址 `http://127.0.0.1:6008/?path=/story/miniprogram-parity-p9-visitor-access--ready-390`。本批不创建原生页面、不打开生产 `insights` capability、不读写业务数据。
- 发布/运行：checkpoint `fbe912ff`（`feat(web): add p9 visitor access golden`）已推送；生产备份 archive `f1b57d5b-e742-4873-827e-5db761221044`（54 表/170,515 行/79,569,064 bytes/SHA `2759fc531fda6208e6a353212ea1b4ee205c1bbad13f9ece4319e36c217a7cc5`）后部署 release `fbe912ff02efe362dbfdbb1c784b284fbc0e6114`。`ECS_PUBLIC_IP` full `ecs-verify.sh`、health 200、artifact/control-plane/migration/unknown-host 检查通过；`0.1.0-p8.20260825.5` capability HTTP 200 且 `organization=false`、`insights=false`，远端临时目录已清理。为后续复用，隔离发布 worktree 保留在 `E:\AItools\Schedule-release-fbe912ff`，首次依赖装配完成后可直接复用。
- 当前状态：已完成（含运行验证）→ 待用户视觉复核。用户确认黄金后，下一批实现 `subpackage-insights` 的原生访客日志/月份聚合只读页；如有差异请提供 viewport + state + 现象。

## 2026-08-25 P9-A1 访客访问只读边界（已完成）

- 范围：新增 `@schedule/client-core` 的 `visitorAccessReadEndpoints`、紧凑 decoder 与 `VisitorAccessReadClient`，覆盖 `/groups/:groupId/visitor-access-logs` 和 `/visitor-access-aggregates` 的 Bearer 权限、游标、pageSize 与 URI 编码；不把 client IP、token、visitor key 或原始访问内容写入 Mini 状态。
- 对等/隐私：decoder 与 `@schedule/contracts` 的 Web Zod schema 严格等价，保留 API 脱敏字段边界；P9-A1 不创建原生页面、不打开 `insights` capability、不改业务数据。
- 验证：正式 client-core 15 files/48 tests 通过（排除用户自有 `.artifacts/` 副本），runtime boundary、generated schema、typecheck 与 `check:generated` 通过。新增 golden fixture `packages/client-core/src/testing/visitor-access-api-golden.ts` 与测试 `packages/client-core/src/visitor-access-read-client.spec.ts`。
- 发布：checkpoint `6130b6fb`（`feat(client-core): add p9 visitor access read boundary`）已推送；生产备份 archive `37aff46e-bfaf-4545-a26c-12006a7150be`（54 表/170,421 行/79,537,192 bytes/SHA `121beeafac01df5672bc6623d1f66afda3865e7360464cdeb5db8ef2b6632be1`）后部署 release `6130b6fb408c32aed3476bf4315ca43cbb6cf9ff`。`ECS_PUBLIC_IP` full `ecs-verify.sh`、health 200、artifact/control-plane/migration/unknown-host 检查通过，`organization=false` 未变，远端临时目录已清理。
- 当前状态：已完成（含运行验证）→ 下一批 P9-A2 为 Web Storybook 访客日志/聚合黄金与原生 `subpackage-insights` 只读页面；停止条件是先完成 390/320/大字号黄金、权限失败关闭与用户页面复核，不提前开放生产 `insights`。

## 2026-08-25 Mini 登录双入口（已实现，待用户复核）

- 用户需求：微信已绑定账号 `D0796` 为普通成员，需要保留微信快速登录；后台管理员需要使用当前 Web 同源的账号/密码表单登录。Mini 初始登录卡现同时提供“账号密码登录”和“微信快捷登录”，账号统一 trim/lowercase 并校验 3–64 位规则。
- 实现/安全：新增 Mini `POST /auth/password/login` strict decoder 与密码会话持久化；会话槽位增加 `authMethod`，密码会话收到 401 只清理当前会话，不静默调用 `wx.login` 切换身份；微信会话继续保留单飞静默恢复。密码、token、微信 code 不写入日志或业务缓存，账号密码登录不显示微信解绑入口。
- 黄金/文档：同步 `P3IdentitySecurityPreview` 的 `mini-login-390/320` 为账号密码表单 + 微信快捷入口；更新 P3 identity preflight 与 page golden manifest。设计意图沿用 Web 的临床蓝、白色病历卡、44px 触达区，强调“后台账号 / 成员快捷进入”的双通道。
- 验证：Mini 正式源码范围（排除用户自有 `.artifacts/` 副本）55 files/282 tests；Web P3 黄金 5 tests；Mini typecheck、production verify（193 files、packageBytes `4,175,041`、manifest `57c7966725b58db3356df0f70ddea8061d166d2c0856c8f9a6318c4cc3d03841`）、source/package/determinism/CI dry-run、Storybook build 均通过。登录代码 checkpoint `75ec2c1d`、版本/RC 文档 checkpoint `4b30c0eb` 已推送。
- 体验/生产：体验版 `0.1.0-p8.20260825.4` 上传成功，111 个代码文件、zip `887,778` bytes、manifest `442e99a6889c9f4ba91d813e1456ecb2f04340e37bd96a1f1ccd08773d43a0d2`，未提审/未正式发布。生产追加 `.4` 前备份 archive `645db788-77d7-46f1-a149-74aeedce2538`（54 表/169,854 行/79,297,240 bytes/SHA `3aa3dfa05726d132c6e5fea3ab4b9b36c4c6930c2a7ddbd5a2494d049f34fb70`），`.4` capability 已 HTTP 200、`organization=false`。随后代码/状态 release `220492666de5b4930895aba20ee0042ccde551cf` 在生产备份 archive `3ea5a1c9-b36c-4532-b4fd-b733b5cabaec`（54 表/169,870 行/79,302,724 bytes/SHA `9d8bca01da3935f430e9309214635955a78a14629e9701d48a5f0e428f04a654`）后部署，`ECS_PUBLIC_IP` full `ecs-verify.sh`、health 200、`.1/.2/.3/.4` capability、artifact/control-plane/migration/unknown-host 检查通过，远端临时目录已清理。
- 当前状态：账号密码/微信双入口与会话切换已完成、体验版 `.5` 已上传；用户需在体验版分别验证 D0796 的微信快捷登录、管理员账号密码登录及两者切换。P8 RC 通过后再进入 P9。
- 登录切换增量：身份确认页新增“切换登录方式”，清理当前会话与私有排班缓存后回到双入口，不解绑微信身份；定向身份 8 tests、Mini typecheck 通过。体验版 `0.1.0-p8.20260825.5` 上传成功，111 个代码文件、zip `887,937` bytes、manifest `39efe85e642e313f5d4a1c341a508d7d2c735fa803a730aba87bbd28cc62341b`。生产追加 `.5` 前备份 archive `41947737-c8e1-43a8-a884-85e19ece90ca`（54 表/170,025 行/79,406,360 bytes/SHA `6621654232e48ce947af10f18df6d74f710388f09dd3e96bc0c9c63ce96813b5`）后，代码 release `16f63099f2e08e127a1de828258a5626d26d002b` 在备份 archive `a35f1080-cdea-485c-ab7a-999cc4d171be`（54 表/170,038 行/79,411,416 bytes/SHA `96ed24494731f3656ac2de79f59e912d07a2ba0e5c6f26573be3d2ee6a48918c`）后部署；`ecs-verify.sh`、`.5` capability HTTP 200、`organization=false` 均通过，远端临时目录已清理。

## 2026-08-25 P8 RC 自动契约与实体机清单（已完成，待用户复核）

- 范围/边界：为 P8-C–F 四个原生页面固定候选 `0.1.0-p8.20260825.5`，新增 `apps/miniprogram/testing/p8-organization-rc-plan.json`、`apps/miniprogram/scripts/p8-organization-rc-plan.test.mjs` 与 `apps/miniprogram/docs/runbooks/p8-organization-rc.md`；覆盖群主、管理员、普通成员、平台管理员、D0796 微信快捷登录、管理员账号密码登录、切换登录方式、guest/organization 双能力门禁、幂等/版本/409、弱网、前后台、隐私和 capability 回滚。生产 `organization=false`，不提交审核、不正式发布。
- 白名单防回归：同步 `.env.production.example` 与 `docs/deployment/aliyun-ecs.md`，保留 P6/P7 并加入 P8 `.1/.2/.3/.4/.5`，避免后续按文档重建环境再次把已上传体验版拒绝为 426；服务器真实 `.env.production` 仍由 ECS 受控配置，未写入 Git secrets。
- 验证：P8 RC 契约 3/3；登录与切换增量后正式 Mini 源码范围（排除用户自有 `.artifacts/` 副本）55 files/282 tests；`pnpm --filter @schedule/miniprogram verify` 通过（production、193 files、packageBytes `4,175,530`、manifest `416271cec2d72f2243a119fcebbd18a4634a47f17f13d450ad55f0947571ecb3`）；determinism 与 CI dry-run 通过。未纳入的完整默认扫描会额外发现用户 `.artifacts/` 副本 17 项路径/生成物失败，未修改或提交这些副本。
- 发布/回滚证据：checkpoint `a1cf99ba`（`test(miniprogram): add p8 organization rc contract`）已推送；生产备份 archive `0def6bd2-3a85-47b0-a18f-7bee85ef1348`（54 表/169,746 行/79,257,740 bytes/SHA `dad35d3ad5a8843022d7f845fce75683557185358bbd726fa34886417d953960`）后部署 release `a1cf99ba312ea674320be8f2cb7ece485c370e4d`。`ECS_PUBLIC_IP` full `ecs-verify.sh`、health 200、P8 `.1/.2/.3` capability HTTP 200、`organization=false`、artifact/control-plane/migration/unknown-host 检查通过，远端临时目录已清理。
- 回滚契约增量：checkpoint `e061e210`（`test(miniprogram): lock p8 capability rollback`）已推送；生产备份 archive `8c5d78b1-3853-4956-bfc4-6dce676ed6fb`（54 表/169,780 行/79,269,568 bytes/SHA `5743ff9f9cca0aa9ce737e3eb288908ef18bacd0878ff36455bd1368334f06b9`）后部署 release `e061e2108e3bd4fb23495b8ede725060f5461bb7`，回滚脚本的校验、原子恢复、trap 与健康探测不变量已纳入自动契约；`ecs-verify.sh` 完整通过，远端临时目录已清理。
- 当前状态：已完成（含运行验证）→ 待用户实体 Android 视觉/交互复核。用户需按 P8 清单记录设备与四角色案例并明确回复“P8 组织管理 RC 通过”；在此之前不进入 P9、不打开 `organization`、不提审或正式发布。下一活动批次为 P8 RC 人工验收，停止条件是收到明确通过或带 `buildLabel + caseId + symptomOnFailure` 的失败反馈。

## 2026-08-25 小程序启动卡在“正在读取排班”修复（已完成）

- 现象/定位：用户实体截图显示工作台长期停在 `正在读取群组/正在读取排班`。对当前体验版本 `0.1.0-p8.20260825.2` 请求生产 `/api/client-capabilities` 得到 426 `CLIENT_VERSION_UNSUPPORTED`；`git log -S`/`git blame` 定位版本白名单从 capability gate checkpoint `e25878f0` 建立，服务器只保留 P7 版本，导致 capability 初始化无法进入正常工作台读链路。
- 修复/验证：生产备份 archive `571adfb3-fa4b-4c70-a26a-2ef4bb632cb4`（54 表/169,576 行/79,198,784 bytes/SHA `9918b8d805223d5c8d80c790f353bbcc86403c0a5574745f9f92fe6278f45add`）后原子追加 `0.1.0-p8.20260825.1/.2` 到 `MINIPROGRAM_SUPPORTED_CLIENT_VERSIONS`，随后体验版 `.3` 发布前又以备份 `5ffd2615-21a5-4e66-88d6-86b96f41ea68`（54 表/169,636 行/79,219,568 bytes/SHA `28e52c59cb444c9ca68b70ec5b1df7056ebad20ec646b141e91a5020b943ceff`）追加 `.3` 并重建 API；三个版本 capability endpoint 均返回 HTTP 200、`global/core/workflows/guest=true`、`organization=false`。`ECS_PUBLIC_IP` full `ecs-verify.sh`、health 200、artifact/control-plane/migration/unknown-host 检查通过，未打开组织能力或改动业务数据。
- 当前状态：启动白名单修复已在生产生效，用户可重新打开/切换到体验版本复核工作台；该配置不写入 Git secrets，后续 ECS release 不覆盖 `.env.production`。P8-E 已完成，下一步为 P8 RC 自动与实体机验收。

## 2026-08-25 P8-E 原生平台账号后台（已完成，待用户复核）

- 基线/范围：P8-D 已完成；本批新增原生平台账号页，只显示服务端批准的用户标识、用户名、密码证明状态和 `authVersion`，支持平台管理员分配用户名与生成一次性小程序绑定链接；不显示姓名、密码、完整联系方式、微信 subject 或 ticket，不从群组角色推导平台权限。
- 原生/权限：新增 `platform-accounts-panel` 与 More 入口，账号列表由 platform-admin API 服务端权限决定；非平台管理员请求失败关闭。写入经 `createRuntimePlatformIdentityWriteClient`，提交 `expectedAuthVersion` 与共用 `operationId`，绑定 URL 只留在当前页面内存。
- 验证/体验：Mini 全量源码范围 53 files/276 tests、typecheck、production build（193 files）、source/package/performance/determinism/CI dry-run 通过；packageBytes `4,162,200`，verify manifest `87003651267a972f8af4f10101cbee3f481b6f7e858d57b1da8194224dcacf14`。代码 checkpoint `c0ea31e9`（`feat(miniprogram): add p8 platform account administration`）已推送；体验版 `0.1.0-p8.20260825.3` 上传成功，111 个代码文件、zip 884,266 bytes、manifest `cad7161da1d668f8fbec473f0debeb7784e4633edb3d82a2b5899bfeef6a3a77`，未提审/未正式发布。
- 发布/下一步：生产备份 archive `59253ae6-ad98-40d1-866e-11d56f050882`（54 表/169,605 行/79,208,604 bytes）后部署 release `c0ea31e977abadd4347aa55d8fd964a359271795`；预热一次 502 后恢复。随后 docs-only checkpoint `01bf73ef` 在生产备份 archive `ece6efb0-0c50-4b18-813e-6085a7066154`（54 表/169,622 行/79,214,568 bytes/SHA `3905ab679feb1d39cfc0a0eb03118a1c253cd4f8ade4b1917509f34fa3ad6aaa`）后部署 release `01bf73ef8805fd5ed7da6a8b5567433d5df6ac26`；最终 docs 状态 checkpoint `08138277` 已在备份 archive `ef63b323-5b0c-4226-be80-2237f9eaa04a` 后部署 release `0813827707f64ddd5235369ca13aa28fa0c02f80`。本轮状态同步 checkpoint `3e4eac4f`（`docs(status): close p8 platform status`）在生产备份 archive `a2d846d2-65c1-4346-bcaf-2b9ae2dd55ef`（54 表/169,693 行/79,239,544 bytes/SHA `c5e350c47332a2d0405888f7069f15f46b36887be86909c991fc4d6aea14e4b9`）后部署 release `3e4eac4f0963f9a823d5ea9aa700053602c33682`。`ECS_PUBLIC_IP` full `ecs-verify.sh`、health 200、P8 capability allowlist/organization=false、artifact/control-plane/migration/unknown-host 检查通过，远端临时目录已清理。`.3` 白名单追加后的备份为 `5ffd2615-21a5-4e66-88d6-86b96f41ea68`，三个 P8 版本 capability 均已复核 HTTP 200。下一批 P8 RC 综合验收，停止条件是先取得本批页面用户复核。

## 2026-08-25 P8-D 原生邀请、访客码与群组二维码（进行中）

- 基线/范围：P8-C-2 已完成并部署，production `organization` capability 继续为 `false`。本批新增邀请生成/撤销、访客码轮换和群组二维码原生入口；邀请 token、visitor key、二维码 base64 只在当前页面内存中存在，不写缓存、相册、日志或幂等结果，不进入 P9 访客访问日志。
- 共享边界：`@schedule/client-core` 增加 strict `group-qr` read endpoint/decoder；Mini runtime 增加 invite/visitor write client。邀请写请求统一 `operationId`、target/version 与岗位版本；二维码 read 同时要求 `guest` capability，管理写入同时要求 `organization` 与角色权限，不能因组织 capability 开启而绕过 guest kill switch。
- 原生实现：新增 `invite-visitor-panel` 与 More 入口，支持正式成员/预设成员目标、成员/管理员角色、可选排班岗位、邀请有效期/撤销、访客码轮换和二维码内存预览；生产 capability 关闭时只读并明确提示。继续沿用临床蓝、白色病历卡和 44px 触达区。
- 当前验证：client-core read/write 定向 7/7、Mini D 静态 3/3、控制器 3/3；Mini 源码全量 51 files/271 tests 通过，Mini verify/package/source/determinism/CI dry-run 通过，packageBytes `3,978,008`、manifest `7e8dd78fffa30d9b5d1ab97bcd3892a541a16fd89384de3624602bf6b1787a5d`。P8-B Storybook 黄金继续在 `http://127.0.0.1:6008/?path=/story/miniprogram-parity-p8-organization-parity--organization-large-text-390` 提供；代码 checkpoint `ddd5c107`（`feat(miniprogram): add p8 invite visitor access`）已推送，production 体验版 `0.1.0-p8.20260825.2` 上传成功，106 个代码文件、zip 881,645 bytes、manifest `5672328c8796369939498d5668e0194b287edf685039a1be01a457ddecf25d81`，未提审/未正式发布。
- 发布/下一步：生产备份 archive `2a1bad2d-2c6a-4488-9d2c-5a73adb7e174`（54 表/169,494 行/79,170,768 bytes/SHA `d7e5fd27936a33d0ae3fd681439b1a35c6e82cc53e27afef7160ff27036c3bb9`）后部署 release `ddd5c1077b015a346d060b6c879235a18d5fefdc`；预热一次 502 后恢复。随后 docs-only checkpoint `0b1d8b59`（`docs(status): record p8 invite visitor deployment`）在生产备份 archive `0150720a-cd1e-4c9e-bcd3-8efd302f4fd2`（54 表/169,511 行/79,176,732 bytes/SHA `1dc3bf220b18870a5e8248916fe3dd4924793ffbf15a5ffdefc5267d59d9dcf9`）后部署 release `0b1d8b59389051cab36b8f4e7159e99651632f06`；最终 `ECS_PUBLIC_IP` full `ecs-verify.sh`、health 200、`.94 organization=false`、artifact/control-plane/migration/unknown-host 检查通过，远端临时目录已清理。最终状态 checkpoint 识别消息为 `docs(status): record p8 invite visitor final deployment`。下一批为 P8-E 平台账号后台，停止条件是先取得本批邀请/访客页面用户复核；未提审、未正式发布、未开放 capability。

## 2026-08-25 P8-C-2 原生班种、岗位与轮转配置（已完成，待用户复核）

- 基线/范围：P8-C-1 已完成并部署，production `organization` capability 继续为 `false`。本批只新增原生排班配置页：班种名称/简称/时段/颜色/跨日/启用/统计、岗位创建/删除、岗位成员选择与顺序、轮转默认班种/人数/当前位置/起始日期/起始成员；不进入邀请/visitor key、平台账号或 P9。
- 原生实现：新增 `subpackage-organization/pages/scheduling-config` 与 `scheduling-config-panel`，沿用临床蓝与病历卡片的“临床交接轨”视觉，More 工具入口只对 owner/administrator 可见；组织 capability 关闭时仍可读取配置但所有写操作失败关闭。所有写入经 `createRuntimeSchedulingConfigWriteClient`，header/body 共用 `operationId`，同时提交 `expectedRulesVersion` 与对应 role/rotation/shift version。
- 隐私/并发：草稿、token、visitor key 和 raw ticket 只存在内存；读取使用 shared organization read decoder，写入由 transport 统一 capability/认证/幂等处理，409/网络失败保留当前输入以便重试。
- 验证：Mini typecheck、production build（177 files）、source/package/性能/确定性校验通过；新增 C2 静态 3/3、控制器 2/2，既有 P8-C1/P5 回归保持通过。源码范围 Vitest（排除用户自有 `.artifacts/` 临时副本）49 files/265 tests 通过；`pnpm smoke:check-core` 通过且本批未触及 Web 核心链路。Mini packageBytes `3,775,964`，verify manifest `e39fc89df9bb09c3595eb020754e6cc098c53b923676f7f8176d989e8ea31d20`。
- 预览/状态：P8-B Storybook 组织管理黄金继续在 `http://127.0.0.1:6008/?path=/story/miniprogram-parity-p8-organization-parity--organization-large-text-390` 提供；配置页通过原生 production build/source audit，仍需用户在现有 Storybook 标签与小程序环境复核视觉和交互。代码 checkpoint `38233039`（`feat(miniprogram): add p8 scheduling configuration`）已推送；production 体验版 `0.1.0-p8.20260825.1` 上传成功，101 个代码文件、zip 876,008 bytes、manifest `f570dedd01419d09be03c507e8949a1d3384e73a2ef560ad2fa95b683d3b09de`，未提审/未正式发布。生产备份 archive `c7b36a38-c699-4313-96cb-648cb8405efc`（54 表/169,391 行/79,135,460 bytes/SHA `517d61fdc38e22ec658d7c989d8042f40d53a834846d6b8471909f58bc5f3035`）后部署 release `382330394b8b84c8aec4f511d4816ce2889643c9`；预热一次 502 后恢复。随后 docs-only checkpoint `ab2ecd9a`（`docs(status): record p8 scheduling configuration deployment`）在生产备份 archive `1940b1f9-86e0-4b79-bc72-1ab28c88216c`（54 表/169,408 行/79,141,424 bytes/SHA `2d8423abdf0b3f3db0c2e66a77c1373adb036a714b047db1e93f697c5dedde24`）后部署 release `ab2ecd9aed91fb356bceac5908fe30df965ff2b0`；最终 `ECS_PUBLIC_IP` full `ecs-verify.sh`、health 200、`.94 organization=false`、artifact/control-plane/migration/unknown-host 检查通过，远端临时目录已清理。最终状态 checkpoint 识别消息为 `docs(status): record p8 scheduling configuration final deployment`。下一批为 P8-D 邀请、visitor key 与小程序码，停止条件是先取得本批原生配置页面用户复核。

## 2026-08-25 P8-C-1 原生群组与成员管理（已完成，待用户复核）

- 基线/范围：用户已确认 P8-B Web 黄金并继续开发。本批只把 `subpackage-organization` 的群组设置扩展为原生群组生命周期与成员管理：创建、加入、退出、改名、群组码、解散/恢复，以及成员/预设/认领/角色/联系方式；不进入班种/岗位配置、邀请/visitor key 或平台账号原生页面，production `organization` capability 继续保持 `false`。
- 原生实现：`group-settings-panel` 继续使用 WXML/WXSS/TS/JSON 与现有临床蓝 token，新增成员、联系人、认领请求、预设编辑器、群组目录/已解散列表和危险操作确认；所有写入经 `createRuntimeOrganizationWriteClient`，header/body 共用 `operationId`，版本化对象提交 `expectedVersion`，错误时保留可重试输入，不写本地业务缓存。
- 只读/权限/隐私：成员、联系方式、认领、群组目录和解散列表统一走 `@schedule/client-core` 与现有 `wx` transport；生产 capability 关闭时只展示已脱敏的只读成员资料并明确提示，访客不能进入，源码不持久化 token、raw ticket、visitor key 或完整电话以外的非必要状态。手机号公开同意 P5 语义保持不变。
- 测试先行：新增 P8-C-1 静态边界 3/3、控制器读写/幂等 3/3；修复 P5 fixture 后既有群组设置 9/9、页面 6/6；Mini 源码范围 Vitest（排除用户自有 `.artifacts/` 副本）47 files/260 tests 通过，typecheck、production build（169 files）、source audit、package/性能/确定性校验通过。完整 `pnpm --filter @schedule/miniprogram test` 被未纳入本任务的 `.artifacts/` 临时副本额外扫描，17 项失败均为副本缺少 `tsconfig.base.json`/生成 tokens，未修改或纳入提交；正式源码范围无失败。
- 浏览器/预览：`pnpm smoke:check-core` 通过并确认本批未触及 Web 核心链路；P8-B Storybook 静态预览继续在 `http://127.0.0.1:6008/?path=/story/miniprogram-parity-p8-organization-parity--organization-large-text-390` 提供，原生页面通过小程序 production build 与 source audit 验证，待用户在现有 Storybook 标签复核视觉黄金。
- checkpoint/发布/下一批：代码 checkpoint `70f9a98f`（`feat(miniprogram): add p8 organization management`）已推送；本批不上传体验版、不开放 capability。生产备份 archive `5546c6ef-ef47-41ba-bf2c-009efc61a9a6`（54 表/168,938 行/78,984,468 bytes/SHA `684852580bcfd589e915a69413437017314b2480d14de5d1f9b8baa7e00f79a4`）后部署 release `70f9a98ff35aa63453dd0aba5b1dee5ae61d3a83`；部署预热一次 502 后恢复。随后 docs-only checkpoint `d1decd87`（`docs(status): record p8 native organization deployment`）在生产备份 archive `d255e778-4129-46a9-b508-d3d06e02c844`（54 表/169,276 行/79,097,020 bytes/SHA `6aaa121f35c09ceffaa6af12fcdf2e7cde1d6919f9b3bf1d7e870de7bcd2e794`）后重放并部署 release `d1decd871d419cfe191cf7032d2cfc79845c8be8`；最终 `ECS_PUBLIC_IP` full `ecs-verify.sh`、health 200、`.94 organization=false`、artifact/control-plane/migration/unknown-host 检查均通过，远端临时目录已清理。最终状态 checkpoint 识别消息：`docs(status): record p8 native organization final deployment`。下一活动批次为 P8-C-2 班种、岗位成员与轮转规则，停止条件是先取得本批原生页面用户复核后再进入配置页面。

## 2026-08-25 P8-B 组织管理 Web 黄金（已完成，待用户确认）

- 基线/范围：从已推送并部署的 `fbe26885` 开始；本批只固化 P8 组织管理 Web 黄金，不实现 Mini WXML/WXSS、不上传体验版、不进入 allowlist/审核/发布，production `organization` capability 继续为 `false`。`frontend-design` 保持临床蓝、病历纸灰白、系统中文字体和 production 信息层级，只在 Storybook 外层增加身份/状态“权限腕带”。
- 黄金/权限：新增 34 个精确 story，直接复用 production `GroupSetupPanel`、`MemberManager`、`SchedulingConfigPanel`、`PlatformAdminUsersView`，覆盖群主/管理员/成员/后台管理员/平台管理员与 ready/loading/empty/error/409/confirm/success/disabled、390×844、320px、大字号。邀请/visitor key 因 Web 尚无完整管理页而新增同源 `P8InviteVisitorGolden`；仅使用脱敏假链接/二维码占位，不持久化 token、visitor key、URL、联系方式或身份 subject。`page-golden-manifest.md` 已登记全部 34 个 ID。
- 回归/无障碍：Storybook 补 Pinia 与 memory router；320px 成员确认态通过已有隐藏管理按钮只作状态装配，不改 `5102950a` 批准的生产 320 层级。`git log -S`/`git blame` 定位平台 visually-hidden 溢出=`02a508dd`、群组/配置 muted token=`bfa07554`、个人 scope=`f723b0db/59300957`、禁用班种 opacity=`41d284b3`；先红后绿测试锁定 Pinia/Router、状态装配、无根横溢与 AA token。平台屏幕阅读器标签固定左上锚点；production 群组/配置/平台小字号与危险操作改用现有更深 token，禁用班种保留灰度但移除会降低对比度的整元素透明度。业务接收者、Promise/catch、空值、请求次数、写入/409/确认和权限均未变化。
- 验证：定向 4 files/14 tests、Web 全量 106 files/612 tests、Web typecheck/production build、Storybook 静态构建通过。浏览器最终 34/34 装配完成、390/320 根横溢 0、console error/warn 0；群组、成员确认、配置冲突、邀请成功、平台链接、大字号六类 Storybook Axe 均为 `Violations 0`。运行/浏览器验证：`pnpm smoke:browser` 首次因 5173 未启动停止；本机 5173–5240 为 Windows 保留端口且首次自定义端口未开 dev auth，随后当前源码 API `127.0.0.1:3000` + Web `127.0.0.1:6009` 完整通过登录、管理员、成员、访客/vkey 与访问记录且无浏览器错误，临时服务已关闭；`pnpm smoke:check-core` 通过（本批不含列明核心链路）。
- checkpoint/发布/下一批：代码 checkpoint `d8e323d5`（`feat(web): add p8 organization golden states`）已推送；本批无 Mini/shared runtime 变化，不上传新体验版。部署前加密备份 `2a9f21ea-18fa-4361-98ee-089e85911290`（54 表/168,905 行/78,973,204 bytes/SHA `610a470b9885178cf5d025d0b80c22c7c86437fdf5b72b9405e31d8b3e783f83`）后部署 release `d8e323d5ab0de0d61ad28042207bcf3e32dbef71`；预热一次 502 后恢复，带 `ECS_PUBLIC_IP` full verifier、health 200、`.94 organization=false`、`.96/.97/.98/.99` 426 与远端 temp 清理均通过。最终状态 checkpoint 识别消息 `docs(status): record p8 web golden deployment`。P8-B 停止条件已满足，状态为“已完成（含运行验证）→ 待用户确认 Web 黄金”；只有用户明确确认后，下一活动批次才是 P8-C-1 群组与成员/预设/认领/联系方式原生页面，本对话不得提前进入配置、邀请/visitor key、平台账号原生切片或开启 capability。

## 2026-08-25 P8-A2-4 平台身份写入安全硬化（已完成）

- 基线/范围：A2-3 代码 `cf453205` 与最终状态 `b0929d51` 已推送；`.98-invite@cf45320` 官方上传后保持 426，代码/文档发布分别由备份 `abe33fb4-07d3-410a-905f-001d0dc8308b`、`3958d9a0-b280-483a-9651-d142ed3ba8ce` 保护，Git/origin/production 均为 `b0929d51c5b5dafc00537414b0cf6b7dbaf20484`，production `organization=false`。本批只硬化平台用户名分配和管理员绑定链接生成，不改 password proof、绑定 confirm 之外的身份流程、Web 黄金、Mini UI 或 capability。
- 引入点/红绿：用户名 API=`0225e0e7`、绑定 ticket=`668103c2`、Web 调用=`02a508dd`，均已重新执行 `git log -S`/`git blame`。Contracts/route/client-core/Web/真实 MySQL 6 组新测试在旧实现因缺 operation/version、共享客户端和冻结快照、同请求生成两个 ticket 而先红；实现后定向静态 7 files/27 tests、真实 MySQL 2 files/14 tests 通过。
- API/身份/隐私：两个写入口统一 header/body operation id 和 `expectedAuthVersion`，同键同载荷重放、异载荷及 stale version 409；用户名同 authVersion 并发仅一胜，成功推进并返回新 authVersion，audit 使用同 operation id。管理员绑定 raw ticket 由服务器 secret、actor、target、operation 和 authVersion 确定性 HMAC 派生，数据库仍只存 hash；幂等结果只存 authVersion/expiry，不保存 URL/ticket，重放以同 raw ticket 重新取得 URL Link 且始终只有一条 ticket。ticket 创建后 target authVersion 变化会让 create replay、preview 和 confirm 全部失败关闭；URL Link contract 收紧为 HTTPS。
- 客户端/语义：client-core 新增两个 strict endpoint/decoder；Web 两方法全部委托原 shared transport。production `PlatformAdminUsersView` 以 presentation-core 深冻结 payload/operation id，模糊失败保留同一快照，payload/version 变化换新 ID，成功清理；409 刷新脱敏账号列表。receiver、Bearer、Promise/catch、用户名 trim、每操作一次请求、链接只在内存展示和离线无写队列语义保持；Mini 没有页面、缓存或写入口。
- 验证/发布：API 72/478（真实 MySQL）、Contracts 18/62、client-core 14/45、Web 105/606、Mini 45/254；全端 typecheck、API/Web build、generated freshness、Mini production verify、任务 ESLint/Prettier/diff 与 `smoke:check-core` 通过。Mini 2/2 Worklet、3,460,689 bytes、manifest `4cceb746…20b93`，仅既有 600 格 best-effort warning。运行/浏览器验证：`pnpm smoke:browser` 等价入口 `node scripts/smoke-browser.mjs` 在当前源码 127.0.0.1:4173 完整通过管理员、成员、访客/vkey 与访问记录且无浏览器错误，临时服务已按 PID 关闭。checkpoint `a3bf2363` 已推送；`.99-identity@a3bf236` 官方上传 96 files/zip 847,455/manifest `7bb83881…92dd`，未进 allowlist。备份 `83d9dfcd-cd9e-40ca-b0ce-de78c5cd9eb6`（54 表/168,663 行/78,893,252 bytes/SHA `27f212ad…caa2`）后部署 release `a3bf2363dcd7e0498b9a434c5b8f322bb850b4bd`；带 `ECS_PUBLIC_IP` full verifier/health 200、`.94` organization=false、`.96/.97/.98/.99-identity` 426 和远端 temp 清理均通过。最终状态 checkpoint 识别消息 `docs(status): record p8 platform identity deployment`；该 docs-only HEAD 备份部署后，下一活动批次为 P8-B Web 黄金：固化组织管理全状态 390/320 和大字号证据，不提前写 Mini 原生页面或开启 capability。

## 2026-08-25 P8-A2-3 邀请与访客密钥写入安全硬化（已完成）

- 基线/范围：A2-2 checkpoint `0bb58654` 已推送；`.97-config@0bb5865` 官方上传 96 files/zip 834,852/manifest `0cd25453…f685`，未进 allowlist；备份 `44dba6b3-fc8d-40dd-8714-7876ebefd363` 后部署同 release，full verifier 通过且 production `organization=false`。本批只硬化邀请创建/接受/撤销和 visitor key 轮换四个写入口；邀请 resolve、群二维码保持只读，不处理平台身份、Mini UI 或 capability 开启。
- 引入点/红绿：邀请 route/service=`a50c4fce`、visitor key=`4b337490`、基础邀请 schema=`4fc6bd21`，均已重新执行 `git log -S`/`git blame`。Contracts/route/idempotency/client-core/Web 5 组测试在旧实现因缺少 operation/version、敏感结果 codec、共享客户端和 Web 委托先红；实现后定向 7 files/26 tests 通过。四个写入口统一 header/body operation id；创建同时校验 target 与可选岗位版本，接受/撤销校验 invite version，visitor key 校验 group version。
- API/隐私/并发：邀请创建 token 由服务器 secret、actor 与 operation id 确定性 HMAC 派生，同键重放返回同一链接但幂等表只保存非敏感展示字段；接受合并只保存目标 user id 对应的安全结果与“需重签”标记，重放时重新签发会话，raw invite token/sharePath/session token 均不落幂等结果。邀请保持单次使用，非实际接受者不能借已用 token 重放；visitor key 同操作只旋转一次。真实 MySQL 全量 71 files/471 tests 通过，定向 3 files/28 tests 覆盖 replay、异载荷/陈旧版本 409、管理员提权禁止、合并重签和敏感结果不落库。
- 客户端/语义：client-core 新增四个 strict endpoint/decoder；Web 四方法全部委托原 shared transport，保持 `transport.request` receiver、Promise/错误、空值与每操作一次请求语义。Mini 本批没有页面、存储、后台重试或离线写队列；共享边界随 production build 验证，但 `organization` 继续关闭。
- 验证/发布：API 71/471（真实 MySQL）、Contracts 17/60、client-core 13/43、Web 104/605、Mini 45/254；全端 typecheck、API/Web build、generated freshness、Mini production verify、任务格式和 `smoke:check-core` 通过。Mini 2/2 Worklet、3,422,199 bytes、manifest `339b37db…d0c4c`，仅既有 600 格 best-effort warning。运行/浏览器验证：`pnpm smoke:browser` 等价入口 `node scripts/smoke-browser.mjs` 在本机 5173 被 Windows 保留、未开启 dev auth 两次按门禁停止后，改用当前源码 127.0.0.1:4173 完整通过管理员、成员、访客/vkey 与访问记录且无浏览器错误，临时服务已按 PID 关闭。checkpoint `cf453205` 已推送；`.98-invite@cf45320` 官方上传 96 files/zip 840,636/manifest `90dc30ee…5656`，未进 allowlist。备份 `abe33fb4-07d3-410a-905f-001d0dc8308b`（54 表/168,476 行/78,831,520 bytes/SHA `67c31964…86d3`）后部署 release `cf453205cef53ebb1006838c11b3af1522f07dc7`；带 `ECS_PUBLIC_IP` full verifier/health 200、`.94` organization=false、`.96/.97/.98-invite` 426 和远端 temp 清理均通过。最终状态 checkpoint `b0929d51` 已在备份 `3958d9a0-b280-483a-9651-d142ed3ba8ce`（54 表/168,497 行/78,838,932 bytes/SHA `29ca1e49…fb1b`）后同步为 production release，full verifier 再通过。

## 2026-08-25 P8-A2-2 排班配置写入安全硬化（已完成）

- 基线/范围：A2-1 checkpoint `adf1f851` 已推送并部署；`.96-groups@adf1f85` 官方上传 96 files/zip 827,270/manifest `07ee6de7…4089`，备份 `86ecae97-7989-43e3-95ec-bcd9f669ab09` 后部署同 release，full verifier 通过；`.96-groups` 未进 allowlist且 `organization=false`。本批只硬化岗位创建/成员替换/轮转排序/轮转规则/岗位删除和班种创建/更新/删除，不处理邀请、visitor key、平台身份或 Mini UI。
- 引入点/红绿：配置 Web/API=`04c7da36`、班种删除=`d24b6920`，均重新执行 `git log -S`/`git blame`。Contracts/route/client-core/Web 4 组新契约在旧实现为 4 files/6 failures；实现后 4 files/8 tests 通过。8 个 shared write endpoint 统一 header/body operation id；每次写提交 aggregate `expectedRulesVersion`，岗位子树同时校验 role/rotation-rule version，班种更新/删除校验 shift-type version。
- API/并发：复用 actor-first organization transaction helper，使幂等行早于权限/目标校验；岗位成员/排序/规则成功后同步推进 role、rotation-rule 与 group rules 三层版本，删除结果可在目标消失后重放。真实 MySQL 全量 70 files/467 tests 通过；配置核心 1 file/7 tests 覆盖同键重放、异载荷 409、角色/规则/班种 stale、删除后重放、同 rules version 并发仅一胜及事务回滚。
- 客户端/语义：client-core 新增 8 个 strict endpoint/decoder，Web 8 方法全部委托原 shared transport；production `SchedulingConfigPanel` 复用 presentation-core 冻结同 payload operation id，成功清理、失败保留。receiver、Promise/catch、空值、确认、成功刷新与请求次数不变；班种即时启停只在成功响应后本地推进一次 rulesVersion，不新增整页刷新、离线写队列或后台重试。
- 验证/checkpoint：Contracts 16/58、client-core 12/41、Web 103/604、Mini 45/254；全端 typecheck、API/Web/Storybook build、generated freshness、Mini production verify/source/package/performance/determinism/CI dry-run、任务 lint/format/diff 通过。Mini 2/2 Worklet、3,367,089 bytes、manifest `a7ee17d9fdbb6fe3ad42a24760982ddb0c1278863c4ff08e9e19f58e11cbbf5f`，仅既有 600 格 best-effort warning。browser smoke 改从 `apps/web` 启动后完整通过且无浏览器错误，`smoke:check-core` 通过。checkpoint `0bb58654` 已推送；`.97-config@0bb5865` 上传成功且未进 allowlist。备份 `44dba6b3-fc8d-40dd-8714-7876ebefd363`（54 表/168,296 行/78,772,532 bytes/SHA `c76e4410…78a1`）后部署 release `0bb586548e07002aced1fcf82ea1df3012d87e67`，full verifier/health 200、`.94` organization=false、`.96/.97-config` 426 和远端 temp 清理均通过。

## 2026-08-25 P8-A2-1 群组/成员写入安全硬化（已完成）

- 基线/范围：A1 checkpoint `5aee10d4` 已推送；`.95-read@5aee10d` 官方上传 96 files/zip 804,539/manifest `7fafa443…30a67`，备份 `8b575691-f3a3-48ab-bf00-f79483dce34e` 后部署同 release，full verifier 通过；`.95-read` 未进 allowlist且 `organization=false`。本批只硬化群组/成员/预设/认领写入，不处理配置、邀请、visitor key、平台身份或 Mini UI。
- 引入点/红绿：群组/成员 Web/API=`1b5a17ae/8e42afb8/322550d9/394b1c87`，均已执行 `git log -S`/`git blame`。Contracts/route/client-core/Web 新契约在旧实现先 4 组失败；实现后 4 files/8 tests 通过。20 个 shared write endpoint 统一 header/body operation id，版本化 group/member/roster/dissolved/contact/claim；Web 三表面复用 presentation-core 冻结快照，成功清理、失败同 payload 复用。
- API/并发：新增 actor-first organization transaction helper；idempotency 先于会删除目标或改变 actor 权限的领域校验，使创建/退出/删除/恢复/所有权转让可重放。expected version 失败为 409 + 最小 latest data；姓名更新同步推进 membership version；联系人 audit 使用同一 operation id 且不记录电话。真实 MySQL 全量 69 files/463 tests 通过，P8 核心 3 files/23 tests 覆盖重放、fingerprint mismatch、stale version、唯一 owner 和事务回滚。
- 语义/验证：Web receiver、Promise/catch、loading/空值、成功刷新与请求次数不变；Mini 无写入口/缓存/重试/离线队列，organization 仍关闭。Contracts 15/56、client-core 2/7、Web 102/602、Mini 45/254，全端 typecheck/build、Web/Storybook build、Mini production verify/source/package/performance/determinism/CI dry-run、任务 ESLint/Prettier/`git diff --check` 通过。Mini 2/2 Worklet、3,289,359 bytes、manifest `9a83af3b34901403ee16064f077bf85ee2f0dcd69b45c11944a4e4dfc7cc6ca6`，仅既有 600 格 best-effort warning。
- 运行/checkpoint：browser smoke 首轮由旧 smoke contact payload 400 阻断；脚本版本化后完整重跑通过且无浏览器错误，`smoke:check-core` 通过，临时服务已关闭。checkpoint `adf1f851` 已推送；`.96-groups@adf1f85` 上传成功且未进 allowlist。备份 `86ecae97-7989-43e3-95ec-bcd9f669ab09`（54 表/168,067 行/78,697,640 bytes/SHA `fed389ed…ee74`）后部署 release `adf1f851aaebbfd27e4c17ed3975661c9136442d`，ECS_PUBLIC_IP full verifier/health 200、`.94` organization=false、`.96-groups` 426 和远端 temp 清理均通过。

## 2026-08-25 P8-A1 组织管理共享只读边界（已完成）

- 基线/范围：P8 预检 checkpoint `62d59c68` 已推送并部署，备份 `a7b48fdf-4510-466b-b86d-150cf27baf8e`，production `organization=false`。本批只共享群组摘要/目录、成员/预设、联系方式、认领请求/查找、排班配置、平台账号和邀请预览；Web 先委托，Mini 工作台移除 groups/members 手写 decoder。不接写 UI、不改 API/DB/权限、不打开 capability。
- 引入点/红绿：群组/成员=`8e42afb8`，配置=`04c7da36`，邀请=`a50c4fce`，平台账号=`02a508dd`，Mini workbench=`733e3af6`，均已执行 `git log -S`/`git blame`。client-core/Web/Mini 新契约在旧实现因模块缺失、未委托和手写解码先红；实现后新增定向 3 files/9 tests 通过，Web 全量 101 files/600 tests、Mini 45 files/254 tests 通过。既有星期测试在当前日期跨至 8/25 后被过去日守卫拦截，现仅冻结测试 Date 并重载模块，生产逻辑不变。
- 实现/语义：新增 10 个 bearer endpoint、确定性紧凑 schema 和 golden；Web 保持原 shared transport、`fetch.call(globalThis)` receiver、Bearer/Content-Type、离线只读、错误/Promise 和每方法一次调用，旧响应缺省 `rulesVersion` 继续接受。Mini 复用原 wx transport/401 单飞：groups/members/core 路径、缓存 groupCode/手机号清理、错误拒绝和次数不变；platform/dissolved/claim lookup 要求 organization，invite resolve 保持 core。无新增存储、重试、写队列或业务副作用。
- 验证：client-core/Mini/Web typecheck，client-core build/generated freshness，Web build，任务 ESLint/Prettier，Mini production verify/source/package/performance/determinism/CI dry-run 与 `git diff --check` 通过。Mini 2/2 Worklet、3,139,214 bytes、manifest `d2a9bd245b215a066d0bfc0e5a8a7519bd91b45f3130dd976b594ef9980ad237`，仅既有 600 格矩阵 best-effort warning。`pnpm smoke:browser` 的依赖重装询问被拒绝，使用 `verifyDepsBeforeRun=false` 在 127.0.0.1:4173 完整通过；`smoke:check-core` 通过，临时服务已关闭。
- checkpoint/结果：`5aee10d4` 已推送；`.95-read@5aee10d` 上传成功且未进 allowlist。备份 `8b575691-f3a3-48ab-bf00-f79483dce34e` 后部署 release `5aee10d4913d0ab10c7da1f8858952d5500723f8`，ECS_PUBLIC_IP full verifier/health 200、`.94` core/workflows=true/organization=false、`.95-read` 426 和远端 temp 清理均通过。

## 2026-08-25 P8 组织管理对等与安全预检（已完成）

- P7 门槛：用户已明确回复通过 `.94@0975b2d` 实体 Android RC；Git、`origin/main` 与 production release 均为 `e6f2e10c`，发布前备份 `ae9641a0-e596-44a1-bb33-0ee71e06c59b`，ECS_PUBLIC_IP full verifier 通过。P7 完成，不提审/正式发布。
- 范围：本批只完成 P8 权限/接口/数据预检与冻结实施顺序，不写原生页面、不打开 production `organization` capability，不提前进入 P9/P10。Mini 当前只有 P5 手机号公开同意 panel；完整群组/成员/预设、班种/岗位/规则、邀请/访客码和平台账号后台均待实现。
- 引入点：群组/成员 Web=`8e42afb8/322550d9/394b1c87`，配置=`04c7da36/d24b6920`，邀请 API=`a50c4fce`，平台账号=`02a508dd`，Mini settings=`0d971de1`，capability=`e25878f0`；均已执行 `git log -S` 与 `git blame`。
- 生产只读预检：2 个 active group；owner/admin/member 为 2/3/21，owner mismatch 0；pending roster 0；岗位 2、班种 13（disabled 5）、无 rotation rule 岗位 0；invite/admin-binding ticket 均为空且无过期 pending；active user 35、password identity 24、Mini identity 1。未读取/输出姓名、电话、群组码、visitor key、token 或 subject。
- 结论：现有权限真值可复用，但 P8 旧写调用普遍缺少统一 operation id/idempotency 和 expected version，不能直接接入 Mini。冻结顺序为共享只读边界 → 写契约/并发硬化并由 Web 先使用 → 390/320 黄金 → 原生页面 → P8 RC；详见 `apps/miniprogram/docs/architecture/p8-organization-parity-audit.md`。
- 验证/checkpoint：P8 范围/权限/能力映射复核、任务文档直接 Prettier 和 `git diff --check` 通过；`pnpm exec prettier` 被本机非 TTY 依赖预检安全中止，未改依赖或用户文件，改用既有 `node_modules/prettier/bin/prettier.cjs` 完成同范围校验。checkpoint 识别消息 `docs(miniprogram): open p8 organization preflight`。下一活动批次只做 P8-A1 共享只读 endpoint/decoder、Web 委托和 Mini 现有手写 decoder 收口，完成验证/上传/部署后停止，不开始写 UI。

## 2026-08-24 P7 实体反馈修复候选 `.94`（已通过实体复核）

- 范围：收口本轮 5 项反馈——请假 Sheet/冲突列表 Web 对齐、一行日期与 44px 原因框、日期横滑/当天定位；selector 向上定位无闪现；年月滚轮平滑吸附；周视图姓名加粗；Web/Mini/API 禁止中国标准时间自然日今天以前的请假，并隐藏已取消请假的 `leave-cover` 标识。不进入 P8，不提审/正式发布。
- 引入点/实现：message/list=`bc32a4f1`，Sheet 日期=`c1b9536a`，reason=`80ddadf0`，placement=`c1b9536a`，snap=`80ddadf0/c1b9536a`，周姓名=`50c6d1ed`，日期横滑=`b5603189`，历史保护=`18d2a2ea`。selector 测量期不可见；wheel 字体随真实 scrollTop 连续更新并以 scrollend 收口；日期 picker 复用月视图定位动效；自然日与 08:00 排班业务日分离。
- 验证：Mini 44 files/252 tests、Web 100 files/598 tests、API 35 files/148 tests 通过（33 files/311 数据库集成按本机无数据库配置跳过）；Mini/Web/API typecheck、Web/API/Storybook build、Mini production verify/source/package/performance/determinism/CI dry-run、任务 ESLint/Prettier、`git diff --check`、`smoke:check-core` 通过。Mini 2/2 Worklet、3,034,245 bytes、manifest `e2a350b2e6e467aa79ad03c02cfa1ed45cf4d477869d8fec5097655d97dc5bc6`，仅既有 600 格矩阵 best-effort warning。完整 browser smoke 两次均被既有周视图左切换按下态断言阻断；应用内浏览器 390×844 请假专项确认过去日禁用、灰色提示、无横溢、console 0，未业务写入。
- 体验/生产：代码 checkpoint `0975b2d1` 已推送；官方 Summer 上传 `.94@0975b2d` 成功（96 code files、zip 792,699 bytes、manifest `cb9e7a63e7e8cef5bb36290bddb122b156d6089f9affb54fbc07df8402aa3f64`），未提审/正式发布。部署前加密备份 `d289468d-c317-4dbd-982b-fb1697ad2955`（54 表、166,064 行、78,003,772 bytes、SHA-256 `7726622fc573a1f57aa3d5dd7ca064e68e5e82a94f778f7ab861280940f336fa`）后部署 release `0975b2d1f5157eacb7e8661864f1e25bd7b5b5f6`；预热一次 502 后恢复、privacy 0/0。双锁原子追加 `.94` 并同时 recreate api/web；`.93/.94` 200、`.84-duty`/unknown 426，`.94` core/workflows=true，env root/0600，ECS_PUBLIC_IP full verifier/health 200 通过。
- 数据修复：只读核对确认徐漫彬历史请假 `8125ca23…` 仍为 active/approved 且无撤销事件。修复前再次备份 `f8878d42-1c05-4d9a-88dc-4a4e90ed1c5e`（54 表、166,111 行、78,019,548 bytes、SHA-256 `f2e06a6947689b5850b11efbfc0aa4315b105b1b783c9a1358f6160cbaa4b452`）；单事务软删除 1 行、version 2→3，并追加 1 条 `leave_request_revoked` 系统修复事件，既有 cover 审计和排班格不改。8/10、8/16、8/22 三班的 `visible_leave_cover_marker=0`；修复后 full verifier 再通过，远端 temp 已删。
- checkpoint/结果：最终状态 checkpoint `e6f2e10c` 已推送并在备份 `ae9641a0-e596-44a1-bb33-0ee71e06c59b` 后同步为 production release；2026-08-25 用户明确通过 `.94@0975b2d` 实体 Android RC，P7 完成并进入 P8。

## 2026-08-24 P7 请假日期与历史标识修复候选 `.92`（已实现待体验上传/生产部署）

- 范围：禁止请假开始日期早于中国标准时间当天；Mini 与 API 双重校验；日期选择器传入最小日期；取消/失效请假不再保留已删除请假产生的 `leave-cover` 日历标识。不改其他工作流写入。
- 验证：Mini 全量 44 files/247 tests、Mini/API typecheck、API calendar/leaves 精确模块测试（数据库未配置时按既有规则跳过）、production verify、格式和 diff 检查通过；Mini verify 2/2 Worklet、3,026,337 bytes、manifest `3b21085c5d3f351212f732b08b5a1c6f31b97e5a8ffa234d5854f0c6ff26aeec`。
- checkpoint/下一批：代码与 API checkpoint 识别消息 `fix(workflows): block historical leave mutations`；更新 `.92` 契约后从持久 worktree 上传、备份、部署、allowlist 验证，随后等待实体复核。

## 2026-08-24 P7 日历/滚轮/Sheet 对齐候选 `.91`（已开放体验并部署，待实体复核）

- 基线/范围：Git/origin/production 为 `cafa12f5`；`.90@80ddadf` 已开放体验并部署。本批只处理实体反馈：月/周成员字号统一放大、selector 点击空白收起与上下溢出定位、右上完成/选择箭头几何、年月滚轮连续缩放与丝滑吸附、请假 Sheet Web 布局对齐。不改 API/DB/危险写，不进入 P8，不提审/正式发布。
- 引入点/根因：月字号 10px 来自 `1f715c96`，周字号 11px 来自 `50c6d1ed/16c02f56`；selector 绝对定位与 root `catchtap` 来自 `bc32a4f1/7f4f70a0`，此前没有 backdrop/viewport placement；离散 19/24px wheel 与 240ms 前的生硬 snap 来自 `16c02f56/80ddadf0`；request Sheet 标题副文案、双列日期、旧 impact-card 和完成按钮 flex 覆盖来自 `80ddadf0`。均已执行 `git log -S` 与 `git blame`。
- 实现：月名固定 11px、周名固定 12px，仍 nowrap/ellipsis，换/加标识不改变姓名字号。selector 新增 fixed 空白收起层；打开后用组件 `createSelectorQuery` 测触发器与窗口空间，选项列表溢出时自动加 `is-up` 向上弹出。完成按钮强制 44px 宽度与 `flex:0 0 44px`；右箭头改为统一 CSS chevron，不再使用字体字符。
- 年月/请假：wheel item 根据实际 `scrollTop / 44` 连续插值 19–24px、0.58–1 opacity、0.94–1 scale；吸附改为 240ms cubic-bezier 并同步字号/透明度/缩放 transition，按住期间不触发 idle snap。请假 Sheet 增加 Web 的“请假信息”和说明、日期+周几、蓝色日期范围提示、单列日期、无卡片空态提示、`原因说明（选填）`、1000 字原因框和“提交请假”。换班/加扣班 request/admin Sheet 同步 Web 的正文标题与 hint。
- 测试先行：连续字号、底部向上弹出、日期周几、箭头/完成按钮几何和请假结构均先红后绿；当前 Mini 精确 `--dir scripts` 44 files/246 tests 通过。production verify 为 2/2 Worklet、3,025,268 bytes、manifest `f56ce673e4689adb0ef546e3528ee10ae5d7096fc42c89d08e2e8c44673ace36`，仅既有 600 格矩阵 best-effort warning。
- 验证：Mini 精确 `--dir scripts` 44 files/246 tests、typecheck、determinism/source/package/build/performance、无凭据 CI dry-run、任务 ESLint/Prettier、`git diff --check`、`smoke:check-core` 通过；persistent clean verify 为 2/2 Worklet、3,038,926 bytes、manifest `a69c74fefd32932143b9c11f9d994d0daf5712506f3f5da5bca7afcb099b09bb`，仅既有 600 格矩阵 best-effort warning。未启动/控制微信开发者工具。
- 行为审计：selector 空白层只关闭视觉 open；placement 只写视觉 placement；wheel 仅新增 UI progress/timer，month/date 完成/取消语义、receiver、payload、幂等、Promise/409/弱网与写次数不变。请假日期 display 增加周几，不改变提交的 `YYYY-MM-DD`；原因 maxlength 从 Mini 旧 200 调整到 Web 的 1000，仍同一 input detail/value。
- 体验/生产：`c1b9536a`（`fix(miniprogram): align p7 calendar and sheets`）已推送；官方 Summer 上传 `.91@c1b9536` 成功（96 code files、zip 790,149 bytes、manifest `39370032c7981c0accf31d9bbd6a73e88bf9385d74a3e38855a572474f7076bb`），未提审/正式发布。ECS 部署前加密备份 `ae5c5d1e-f1f1-457e-8479-38856f6fa946`（54 表、165,673 行、77,862,612 bytes、SHA-256 `5ee7eb42e1a7b2929293e211acd478ba5c609d77e9ea98c8ab571594b4468d6d`）后部署 release `c1b9536a1e374e4e82620361e3c68ee73cdf7a02`；预热一次 502 后恢复、privacy 0/0。双锁原子追加 `.91` 并同时 recreate api/web；`.90/.91` core/workflows=true、partial/unknown=426、env root/0600；ECS_PUBLIC_IP full verifier、current release、health 200 和远端 temp 清理均通过。
- checkpoint/下一批：最终状态 checkpoint 识别消息 `docs(status): record p7 calendar sheets deployment`；该 docs-only commit 需完成最后一次备份保护部署后停止，只等待用户在 `.91@c1b9536` 实体复核本节交互，不进入 P8。

## 2026-08-24 P7 Web 控件对齐候选 `.90`（已开放体验并部署，待实体复核）

- 基线/范围：Git/origin/production 为 `aaf0a9bd`，`.89@16c02f5` 已开放体验；本批只处理用户对 `.89` 的二次实体反馈：成功提示改 2 秒、工作流成员/班次 picker 强互斥、年月滚轮保留惯性并自动吸附、下拉 1:1 对齐 Web，以及请假/换班/加扣班 request Sheet 的白底/圆角/按钮/右上“完成”和紧凑原因框。不改 API/DB/危险写，不进入 P8，不提审/正式发布。
- 引入点/根因：1 秒 timer 与受 60ms hover 控制的 selector 来自 `16c02f56/0d971de1`；`bc32a4f1/7f4f70a0` 让每个 picker 独立维护 `open`，父级 tag query 在嵌套 Panel 实体环境未可靠覆盖；`16c02f56` 的双 `scroll-view` 只有 `scrollend` 静态回写、无动画兜底；固定 82% 灰底 Sheet/96px textarea 来自 `bc32a4f1`。均已执行 `git log -S` 与 `git blame`。
- 实现：成功视觉状态严格在 2,000ms 清除。Picker 实例通过 attached/detached 注册表互斥，打开任意成员、班次或年月控件前同步关闭其他已开实例；selector 移除 60ms hover，打开触发器与已选 option 使用 Web 常亮品牌态，popover 按 Web TDesign 的 300px 上限、6px 内边距、28px 行、3px 行圆角和 shadow-2。年月滚动事件只更新草稿/选中放大和私有实际位置，不回写受控 scrollTop，因此不打断原生惯性；scrollend 或 100ms 无事件后从实际位置以 180ms 动画吸附最近 44px 行。
- Sheet：request Sheet 改 Web 的 32% 遮罩、白底、22px 顶圆角、78vh 上限和自动内容高度；标题栏 56px/16px，右上统一“完成”；底部操作按钮用 10px 圆角且主按钮无额外阴影。请假原因保持 Web 三行 88px；普通/管理员加扣班原因改为 44px 单行 input，绑定、maxlength 和 payload 不变；换班 request/admin Sheet 同步相同壳层。
- 测试先行：2 秒 timer、实例互斥、滚轮 idle snap/按住不抢吸附、Web select 几何/常亮态、request Sheet/原因框契约及 `.90` release contract 均在旧实现先红后绿。定向 3 files/20、release 3/3、当前 Mini 精确 `--dir scripts` 44 files/243 通过；首次从仓库根/按路径过滤的 Vitest 会误扫用户 `.artifacts` 旧副本，已保留副本并改用官方包目录 + `--dir scripts` 限定真实源。
- 验证：Mini typecheck、production verify/determinism/source/package/performance/build、无凭据 CI dry-run、任务 ESLint/Prettier、`git diff --check`、`smoke:check-core` 通过；persistent clean verify 为 2/2 Worklet、3,029,919 bytes、manifest `345202956cb49ed24b4d90ec18cd408321b9d0474d75bbff5ab2eddc15c696a0`，仅既有 600 格矩阵 best-effort warning。发布 worktree 返回 `created:false/dependencies:reused`，没有 pnpm 依赖装配；直接 pnpm 命令的依赖预检被安全中止后改用既有可执行入口。主工作区重复 build 首次清理刚生成 `dist` 遇瞬时 ENOTEMPTY，800ms 后原命令重试通过；未删除用户文件、未启动/控制微信开发者工具 GUI。
- 行为审计：selector 点选仍只 emit 一次并由父级更新值，month/date 仍只有“完成” emit、取消零次；互斥只清其他实例的视觉 `open`，不改 selectedIndex/draft/payload。滚轮新增 timer 只在 UI idle 后对齐显示，原生惯性期间不受控回写；attached/detached 对称清 registry/timer。input 与 textarea 的 `detail.value`、maxlength=200、receiver 和调用次数等价；业务 Promise/错误/409/弱网/幂等及写次数未触及。
- 体验/生产：`80ddadf0`（`fix(miniprogram): align p7 workflow controls`）已推送；官方 Summer 上传 `.90@80ddadf` 成功（96 code files、zip 787,035 bytes、manifest `279ff1f72ec1f5fe2f3b1c231336be29f5b8178a4c7bdb30f2eb994729129db0`），未提审/正式发布。上传第一次因未注入仓库外 key 在编译前失败且未成版，注入既有本机 key 后成功。ECS 上传首轮 30 秒只完整传 dist、API 归档为 partial；哈希门禁阻止部署，持续会话重传至 5,511,769 bytes/SHA `43bb6cf0…c7f4d` 后才继续。第一次备份命令受 CRLF 影响仅打印用法、未成 archive；改为单条远端命令后，部署前加密备份 `6c1259df-1652-4908-b4fe-e6abe0e1f6c6`（54 表、165,519 行、77,785,416 bytes、SHA-256 `cbe645a45928b8137a281f5df004fca05cdad79a0955757702907011bb53406e`）成功。随后部署 release `80ddadf072fc3429a6fb87a99983d7663aebe952`，预热一次 502 后恢复、privacy 0/0；release/capability 双锁原子追加 `.90` 并同时 recreate api/web，`.89/.90` core/workflows=true、partial/unknown=426、env root/0600。ECS_PUBLIC_IP full verifier、current release、health 200 均通过，远端 temp 已删。
- checkpoint/下一批：最终状态 checkpoint 识别消息 `docs(status): record p7 web control deployment`；该 docs-only commit 必须在新部署前备份保护下同步 production 后停止，只等待用户在 `.90@80ddadf` 实体复核本节交互，不进入 P8。

## 2026-08-24 P7 实体交互精修候选 `.89`（已开放体验并部署，待实体复核）

- 基线/范围：Git/origin/production 为 `be1d275e`，`.88@a6a029b` 已开放体验；本批只处理用户实体反馈的 1 秒成功提示、工作流下拉互斥/外部收起、筛选多选外部收起、年月拖动中连续高亮、群组管理首开预热、紧凑空态和月/周姓名字号，不改 API/DB/危险写，不进入 P8，不提审/正式发布。
- 引入点/根因：3 秒 timer 来自 `0d971de1`；工作流 picker 自 `bc32a4f1/7f4f70a0` 各自维护 `open`、无父级协调，空态固定 120px；筛选 Sheet 的全层 `catchtap=preventSheetTouchMove` 来自 `733e3af6`，option 多选正确但空白点无关闭路径；原生 `picker-view` 来自 `7f4f70a0`，其 change 在实体拖动中不持续更新 data；群组 Panel 的点击后才 mount 来自 `0d971de1`；月姓名 9px 来自 `1f715c96`，周姓名 10px 来自 `50c6d1ed`。
- 下拉/筛选/提示：workflow picker 打开前冒泡 `pickerrequestopen`，Panel host 同步关闭全部 sibling；picker 根阻止普通 tap 冒泡，Panel 空白 tap 收起全部 picker，选择行为仍一次 emit。筛选 trigger/option/action 改用 `catchtap`，所以多选 option 保持展开；Sheet 其余空白 tap 只清 `filterOpenField`，不关闭整个筛选。成功提示改为 1 秒，卸载 timer 清理不变；空 option 高度从 120px 收紧到 44px。
- 年月/预热/字体：月份模式用两列 188px enhanced `scroll-view` 替代只在松手后 change 的原生 `picker-view`，72px 首尾 spacer 与 44px 行让 `round(scrollTop/44)` 在拖动/惯性期间持续更新 19→24px 选中态，scrollend/tap 回到对应行；取消仍不写值、完成只 emit 一次。该 wheel 与 Apple HIG/UIPickerView 的“滚轮值对齐 selection indicator 即成为当前值”模型一致。工作台先完成核心日历 ready，再后台 mount 隐藏的群组 Panel，避免竞争首屏并预热首开数据。月姓名统一 10px、周姓名统一 11px，不按姓名长度分档；月内三字姓名+13px change mark 仍单行裁切在现有宽度内，周名保持 ellipsis/nowrap。
- 测试先行：提示 1 秒、sibling/outside close、picker parent close 共 5 项先红；filter outside、44px empty、group warmup 静态契约先红；scrollTop 持续 year/month draft 和移除 native picker 2 项先红；月/周固定字号 1 项先红；`.89` release contract 3 项先红，全部实现后转绿。真实 Mini 源 44 files/238，release-control 18/18，定向 feedback/host/picker 15 项通过。
- 验证：persistent clean Mini 44 files/238、typecheck、production source/build/package/performance/determinism、无凭据 CI dry-run、任务 ESLint/Prettier、`git diff --check`、`smoke:check-core` 通过；production verify 为 2/2 Worklet、3,024,024 bytes、manifest `2ba339de4248e1e6cf4eedba45ba207cd5ab168fb000b0b6cbb3cc6159598c44`，仅既有 600 格矩阵 best-effort warning。官方 Summer 编译/上传成功（96 code files、zip 784,225 bytes、manifest `d6122a4410a13e2a65daacd1c1d9e6180d2d15aaf834f787d22fea783a47ffea`）；未提审/正式发布，也未启动/控制微信开发者工具 GUI。
- 行为审计：工作流 selector 点选仍只触发一次 change 并收起；month/date 仍只在完成时写入、取消无 change。父级 close 只改各 picker 的视觉 `open`，不改 selectedIndex/draft/operation payload；筛选 option 多选、summary 和 refresh 次数不变，外部 tap 只清下拉字段。群组 warmup 只新增核心 ready 后已有 self-only GET，不缓存手机号/同意/payload，不增加写队列。日历字体只改固定视觉字号，无日期、成员、标记或点击语义变化。
- 体验/生产：代码 checkpoint `16c02f56`（`fix(miniprogram): refine p7 picker interactions`）已推送；`.89@16c02f5` 体验版已开放。部署前加密备份 `515fc053-7ca0-4fd7-9840-4fd4d03c0232`（54 表、165,292 行、77,686,716 bytes、SHA-256 `8da250f1cd6a64cdc6a86be2e4bce300349e6a620748c2c09921ba8a3e877be6`）后部署 release `16c02f56d87e1f9b5324f5678abd2e19982143dd`；预热两次 502 后恢复、privacy 0/0。首次 `.89` allowlist 变更在只 recreate API 后健康超时，失败 trap 正确恢复到 `.88`，但 Nginx 保留旧 API upstream 导致短暂 502；同锁 recreate `api web` 后恢复，改用二者一起 recreate 的双锁脚本幂等重试成功。最终 `.88/.89` core/workflows=true、`.84-duty`/未知为 426、env root/0600，ECS_PUBLIC_IP full verifier/health 200 通过，远端 temp 已删。
- checkpoint/下一批：最终状态 checkpoint 识别消息 `docs(status): record p7 interaction refinement deployment`；该提交在部署前再显式备份并复用相同制品同步 production 后暂停，只等待用户在 `.89@16c02f5` 实体复核本节 7 项，不进入 P8。

## 2026-08-24 P7 实体反馈修复候选 `.88`（已开放体验并部署，待实体复核）

- 基线/范围：Git/origin/production 为 `f070b696`；本批只收口 `.87` 实体反馈并把 Windows 发布流程改为可复用隔离 worktree，不改 API/DB/工作流危险写，不进入 P8，不提审/正式发布。用户口述“继续 P5 debug”按仓库当前活动阶段解释为继续 P7 实体 RC；P5 已完成且群组管理入口只是本轮被反馈的既有 P5 页面。
- 引入点/根因：发布文档自 `de3ad5f7/e25878f0` 只要求干净 worktree、没有复用入口，人工每轮新建临时目录导致重复装配；日历 `monthResources` 读缓存来自 `9e3a966c`，`bc32a4f1` 把工作流常驻后没有 mutation→calendar 失效事件；群组设置全页跳转来自 `59300957`；Panel `infoMessage`、form `wx:if`、周末整行红、默认 400ms hover 和静态 24px picker item 来自 `bc32a4f1/7f4f70a0`。
- 发布 worktree：新增直接入口 `node scripts/prepare-release-worktree.mjs --commit <ref>`（pnpm alias 等价），默认复用仓库兄弟目录 `Schedule-release-worktree`；只接管已登记、detached、干净的专用 worktree，依赖指纹保存在其 Git 元数据，lockfile/workspace/package/patch 未变时直接复用 `node_modules`，变化时仅增量 frozen install；普通同名目录、用户分支或脏目录失败关闭且不删除/清理。真实首跑创建正确 detached 目录后先暴露直接 Node 的 `pnpm.cmd EINVAL`，第 5 项回归改为 Node→`pnpm.mjs`；随后 1,459 包全部本地 reuse、download 0、落盘完成，pnpm strictDepBuilds 又因 4 个未审转依赖脚本非零退出。第 6 项回归只把 strict 模式降为 warning，未审脚本继续阻止、已批准 esbuild 仍执行，也不启用危险的 all-builds。pnpm 11 即使 warning 仍自动写入 review 占位行；第 7 项回归现在只在确认唯一差异为这些占位行时恢复安装前 workspace 原文，其他变化失败关闭，`node_modules` 全程保留。随后真实 `ecs:package` 又证明 `pnpm build` 默认重复运行依赖预检；packager 回归先红，现显式 `verifyDepsBeforeRun=false`，依赖完整性继续由前置 helper 指纹/frozen install 和正式构建保证。
- 数据同步/壳层：三工作流所有成功 mutation 发出 group-scoped `calendarchanged`，工作台清内存月窗并强制网络刷新，日历无需重进小程序；成功胶囊 3 秒自动清除且卸载清 timer。群组管理抽为 organization Panel，在“更多”的中央工作区常驻展示，顶部/底部壳层不变；旧 deep link 只保留为共享 Panel 薄壳兼容。
- 视觉/交互：请假主表单预挂载并在同一 patch 清空影响数据，移除短暂“读取中”文字、固定影响区高度；共享标题栏关闭按钮明确占右侧 44px。workflow picker 的 hover 从默认约 400ms 改为 60ms 且不再蓝色填充；月份滚轮按 Web 使用 19px/0.58 非选中和 24px/1 选中、1.12/0.88 年月比例，并用较轻原生遮罩/阴影补偿缺少 backdrop blur。周末 option 只拆红`（周六/周日）`片段，蓝色选中框与红字可同时保留。
- 测试先行：发布脚本缺失 1 suite 先红；壳层/日历事件/提示 timer/群组 Panel 7 项先红；周末分段、press/flicker/close/wheel/遮罩 4 组先红；`.88` release contract 3 项先红，全部实现后转绿。精确 persistent clean Mini 44 files/234、release/worktree helper 8、release packaging/controls 26，定向反馈/host/picker/group/capability 通过。首次 clean worktree 又让 `9a436e8b` 的 CSS 原始字节预算被 CRLF 误增至 45,005，并复现既有 Vitest/Vite 对 CRLF `performance-budget.test.mjs` 的语法误报；预算现先归一化 EOL，`.gitattributes` 固定 Mini scripts 为 LF，新增契约先红后绿。
- 验证：精确 persistent clean worktree Mini 44 files/234、typecheck、production source/build/package/performance/determinism、无凭据 CI dry-run、任务 ESLint/Prettier、Node syntax、`git diff --check` 通过；production verify 为 2/2 Worklet、3,018,325 bytes、manifest `500966810019827ab35929d464025c916918443c9a902d7b42ffeb13bdbae142`，只保留既有 600 格矩阵 best-effort 警告。`.88` 官方 Summer 上传成功（96 code files、zip 780,059 bytes、manifest `705af2e7ee9d7b45466688ab721296168aa47acae3b3dbade0c28d223a3c32fe`），未提审/正式发布。运行/浏览器验证：`pnpm smoke:check-core` 确认未触及 Web 核心链路，无需 `pnpm smoke:browser`；按计划未启动/控制微信开发者工具。
- 行为审计：新增副作用仅为工作流成功后同群日历只读 GET 和 3 秒视觉清理；mutation payload/operationId、receiver、Promise/409/弱网重试、成功写入次数和 standalone deep link 不变。群组设置共享同一 controller/client/权限/幂等；picker selector 仍点选只 emit 一次，month/date 仍仅完成 emit、取消不写值；表单预挂载不发请求，只有显式打开继续读取受影响班次。
- 体验/生产：`.88@a6a029b` 已由官方 Summer 上传（96 code files、zip 780,059 bytes、manifest `705af2e7ee9d7b45466688ab721296168aa47acae3b3dbade0c28d223a3c32fe`），未提审/正式发布。首次 ECS application release `1d19d493` 部署成功，预热一次 502 后恢复、privacy 0/0；复核 updater 后发现其只备份应用文件、未运行数据库 job，本次无 API/DB/迁移改动但违反“部署前备份”顺序，已立即补做加密备份 `b7ea25b8-0753-4799-929e-e58a4ac38fbd`（54 表、165,115 行、77,606,204 bytes、SHA-256 `140345f19255b5bbd8f07acbb1fe8b670a20992a112e7fb6b7641b58fb22e1ed`），明确记录为部署后补备份。release/version 双锁下原子追加 `.88`，`.87/.88` core/workflows=true，`.84-duty`/未知为 426，env root/0600。随后在部署前正确创建备份 `4c97b416-c7b4-4ab8-8b59-6cdb8ee79330`（54 表、165,133 行、77,612,324 bytes、SHA-256 `494be9a2c1e02c6bd6ac0daa52d9773702d52ab641d61ae95f799ec1d5044368`），复用相同已审计 archives 部署非应用 release `f7253bbd302d2199a4ef1d1247f156cb5f9e6f59`；预热一次 TLS EOF 后恢复、privacy 0/0、ECS_PUBLIC_IP full verifier、`.88` capability 与 health 200 通过，远端临时目录已删。
- checkpoint/下一批：功能 `0d971de1`、Windows pnpm `1c042e95/741daf8f/86591227`、clean 行尾 `a6a029ba`、ECS 预检 `1d19d493`、stat-only clean `f7253bbd` 均已推送并部署。持久 worktree 位于仓库外、保持 detached，连续复用均返回 `dependencies:reused`；打包生成物仅有 hash 相同的 stat-only 记录且 helper 已不再误拒绝。最终状态 checkpoint 识别消息 `docs(status): record p7 physical feedback deployment`；该提交在部署前再显式备份并复用相同制品同步 production 后暂停，只等待用户在 `.88@a6a029b` 实体复核本节 8 组反馈，不进入 P8。

## 2026-08-24 P7 实体交互稳定性候选 `.87`（已开放体验，待实体复核）

- 基线/范围：Git/origin/production 为 `ab16ff6f`；只修 `.86` 实体反馈中的工作台底栏高度变化、普通选择无法生效/收起、日期/月选择器 Web 差异、返回日历回弹和工作流切换重复 loading。不改 API/数据库/工作流危险写，不进入 P8，不提审/正式发布。用户已澄清截图中月份滚轮 `2026/9` 是人工调整，不按初始索引错误处理。
- 引入点/根因：`git log -S`/`git blame` 确认 `bc32a4f1` 把日历和三个 Panel 放进互斥 `wx:if/wx:elif`，每次切换都会销毁/重建；同提交把 Panel/Picker 设为 `styleIsolation:shared`，子组件 `.bottom-nav` 反向覆盖工作台底栏，并让嵌套 Picker 的固定操作区被父级裁切/底栏遮挡。返回日历还复用了“已在日历时滚到顶部”的 `scrollTarget` 动画，形成下拉回弹。
- 测试先行/实现：工作台常驻、Panel 预挂载、样式单向隔离、返回日历不滚顶、Web 选择器结构和 selector/month/date controller 6 项在旧实现 5 项失败后转绿。日历改为 `hidden` 常驻；三个 Panel 在当前群组/能力确认后后台挂载并仅切换 hidden，不再反复请求/闪 loading。组件隔离改为 `apply-shared`，底栏固定总高和 56px item；嵌入工作区允许弹层越过内容裁切但仍低于顶部壳层。普通类型/班次/人员按 Web 改为就地下拉、点选立即 emit 并收起；月份/日期采用 Web 同构浮动面板、当前选择摘要、188px 双滚轮或 7 列日期月历，以及固定“取消/完成”。
- 语义审计：工作流 controller、API 接收者、operation snapshot、Promise/409/弱网路径、写入次数和 standalone 深链不变；首次后台预挂载只增加已有只读 GET，后续 tab 切换不再重建。普通 selector 从“草稿后确认”改为 Web 的点选即提交一次；月份/日期继续只在完成时发一次 change，取消不写值。日历 tab 仅从其他模块返回时保留原滚动位置，再次点击已激活日历仍执行原滚顶动作。
- 验证：Mini 全量 43 files/227，反馈+工作台定向 4 files/31，release-control 15/15；Mini typecheck、任务 ESLint/Prettier、production verify、`git diff --check` 通过。production verify 为 2/2 Worklet、2,847,420 bytes、manifest `e5d2b0c7d4feb3e9acbe4ac3a6d1cd2b7e3f9851076b8f81aa18c5b4fd878f96`；只保留既有 600 格矩阵 best-effort 警告。
- checkpoint/体验：`7f4f70a0`（`fix(miniprogram): stabilize p7 workspace interactions`）已推送；微信官方 Summer 编译并上传 `0.1.0-p7.20260824.87`，93 个代码文件、zip 772,080 bytes、manifest `944fef13c04b0e07423a993eb538b74d88048a6fccf8b7525cb75e467414869f`。未提审、未正式发布。
- 生产/能力：部署前加密备份 `08d26fa0-e3df-40c3-9d49-cb879b31cfff`（54 表、164,777 行、77,474,196 bytes、SHA-256 `52a77469c5babca13158683aedf83ca0b958a5e77ad71a8931385b531cfd684e`）后部署 release `7f4f70a01200c876113a20e4c5fc22db19b2732b`；预热两次 502 后恢复，privacy 0/0、full verifier 通过。release 锁下原子追加 `.87` 并保持 env root/0600；`.85/.86/.87` 为 200 且 core/workflows=true，`.84-duty`/未知为 426；远端上传临时目录已清理。
- 下一批/停止条件：状态 checkpoint 识别消息 `docs(status): record p7 workspace interaction deployment`；推送并同步生产后暂停，只等待用户用 `.87@7f4f70a` 复核本节五项。失败只修对应差异；通过后再恢复 P7 后续门禁，不提前进入 P8。

## 2026-08-24 P7 实体反馈修复候选 `.86`（已开放体验，待实体复核）

- 基线/范围：基线 `a3e6950e`，只处理用户实体反馈：请假/换班/加扣班保留工作台顶部与底部导航并在中央切换；三个模块改用 Web 式自绘选择器并标红周末班次；过去换班不显示撤销；联系方式默认群内可见、成员明确关闭才隐藏；群组管理移入“更多”，与手动排班、排班补录并列。不进入 P8、不提审/正式发布。
- 引入点/测试先行：跳转和三个系统 picker 来自 `9fae3869`/`7d3b93c8`/`764276f1`，换班可撤销展示来自 `f65a57df`，手机号 opt-in 与左上群组设置来自 `59300957`；已逐调用点执行 `git log -S` / `git blame`。结构、选择器、过期撤销、默认可见和 `.86` 契约断言均先红后绿。
- 实现：三工作流抽为 workflows 分包可复用 Panel，工作台以 `calendar/leave/swap/duty/more` 中央工作区承载，独立深链页继续兼容；更多中的群组管理对非访客可用，手动排班/排班补录仅群主和管理员可用。自绘 Sheet 覆盖月份、日期和普通选项，班次 option 携带 weekend tone。API hydrate 与 Mini controller 双层过滤过去换班撤销。手机号策略只把 `fingerprint=null + revoked_at!=null` 认作明确关闭，guest/跨群/成员自控边界不变；生产只读聚合确认冯钦有手机号且未明确关闭，无需数据迁移或单条修数。
- 验证：Mini 全量 42 files/224，API 单测 5/5，真实 MySQL 日历+群组+换班 56/56，Mini/API typecheck、API build、任务 Prettier/ESLint、production verify、无凭据 CI dry-run、release-control 红绿、`smoke:check-core`、`git diff --check` 通过。production verify 为 2/2 Worklet、2,836,191 bytes、manifest `ab55e4a609f6369ae7940316c3db13e95c6d41467d97bb14938505cfbd4276c1`；只保留既有 600 格矩阵 best-effort 警告。
- checkpoint/体验：`bc32a4f1`（`fix(miniprogram): align p7 physical feedback`）已推送；微信官方 Summer 编译并成功上传 `0.1.0-p7.20260824.86`，93 个代码文件、zip 767,784 bytes、manifest `bcca6267d9592aabf0362711e7e4dc64bae05280810da0c7808f98c2a4a7c5de`，跨分包异步组件编译通过。未提审、未正式发布。
- 生产/能力：部署前加密备份 `c74e6442-534f-4ca0-8388-59f3f58fd7aa`（54 表、164,551 行、77,396,940 bytes、SHA-256 `4588b17d730b0b569e555f03351250def36467d18dc74ca75b76ac376120dfc2`）后部署 release `bc32a4f1be0defd41c85b8e5e6d078a993d0e25c`；预热两次 502 后恢复，privacy 0/0、full verifier 通过。release 锁下原子追加 `.86` 并保持 env root/0600；`.81/.85/.86` 为 200，`.84-duty`/未知为 426，`.86` 返回 core/workflows=true；远端上传临时目录已清理。
- 下一批/停止条件：状态 checkpoint 识别消息 `docs(status): record p7 physical feedback deployment`；推送并同步生产后暂停。仅等待用户用 `.86@bc32a4f` 复核本节五项反馈；未通过只修对应差异，通过后再恢复原 P7 后续门禁，不提前进入 P8。

## 2026-08-24 P7-F 完整工作流 RC（已开放体验，待实体 UI/交互复核）

- 基线/范围：Git/origin/production均为`03079a18`、DB51；P7-C/D/E三原生页面已部署但production workflows仍false。本批不改工作流领域/API/DB/UI，只冻结最终候选版本、生产allowlist/capability契约、实体Android RC计划和回滚门禁；不进入P8、不提审/正式发布。
- 版本决策：完整候选固定`0.1.0-p7.20260824.85`；逐切片`.82-leave/.83-swap/.84-duty`只作可追溯上传，永不加入production allowlist。生产样例/部署手册只在原`.78-.81`兼容列表后加入`.85`并将workflows设true；legacy仍`.78`。审计现已确认三页/controller/危险写/视觉黄金全部关闭，剩余只有`.85`上传、原子allowlist+capability、回滚探测和实体RC。
- 测试先行/RC：allowlist/workflows/计划文件断言在旧配置先3项失败，更新后release-control+P7 plan 18/18。新增机器可读RC JSON与runbook，精确锁定成员/管理员的请假、跨月换班、加扣班提交→接受/审批→拒绝/取消→direct→完成后撤销，以及弱网结果不确定同payload重试、前后台刷新、日历标记、成员/管理员通知和capability关闭→重开；通过反馈固定“P7 工作流 RC 通过”，不强制通过截图。
- 自动证据：Mini 41 files/221；P7 Web/shared client/presentation 12 files/45；API env/runtime/release 4 files/42；Mini typecheck/任务ESLint/Prettier/production verify/source/package/performance/determinism、`smoke:check-core`、`git diff --check`通过。当前主源码真实MySQL请假20+换班34+加扣班26+通知8+微信4=92/92；命令随后误扫用户`runtime/ecs-directory-favorites-*`旧副本并出现旧迁移建表冲突，主源码92项已先完整通过，后续命令显式排除`runtime/**`/`src/**`且不修改副本。
- 构建：2/2 Worklet、2282116 bytes、manifest`766bdfab7b2546e048f229f8ea8f9c63d8e5da9556f3ec7c40e224030c4f42c8`；只保留既有600格矩阵节点best-effort警告。无Mini UI源码变化，因此不新增视觉真值；原生视觉/交互仍只能由用户实体设备确认。
- checkpoint/体验：`350e5a1a`（`chore(miniprogram): prepare p7 workflow rc`）已推送；从该提交干净worktree成功上传production-profile最终体验版`0.1.0-p7.20260824.85`，81个代码文件、zip752204 bytes、manifest`36d84ea33111b2c2de3f8e0a4e3d538ebafb4a949d6c791a20fed9728e6ccea0`，未提审/正式发布。
- 生产/能力：部署前加密备份`cd676334-c033-4b6f-8b2a-b3cbf491c41b`（54表、164254行、77268968 bytes、SHA-256`f010287ea385c3c8aad14e59a84b56370db9d2d57e1338e63feb31d6bba00398`）后部署release`350e5a1a05d469da306651fa1c5323296aeca589`；DB51、privacy0/0、full verifier通过。随后在release/version锁下只把`.85`原子加入allowlist，保持env root/0600；`.84-duty`/未知均426、`.81`兼容。受信任控制器完成workflows true→false→true回滚预演，`.85`逐步返回true→false→true且健康始终ready；最终workflows=true，full verifier再次通过，远端/本地临时目录已删。
- 当前停止点：状态checkpoint识别消息`docs(status): open p7 workflow rc`；推送并同步生产后暂停。请用户只用`.85@350e5a1`在专用测试群组按`apps/miniprogram/docs/runbooks/p7-workflow-rc.md`完成成员/管理员三工作流、弱网、前后台、日历标记和通知实体Android复核。明确回复“P7 工作流 RC 通过”前不进入P8、不提审/正式发布；失败只修对应P7差异。

## 2026-08-24 P7-E 原生加扣班垂直切片（代码已部署，能力保持关闭）

- 基线/范围：Git/origin/production均为`f830405b`、DB51；本批只实现Mini原生加扣班月份候选、原因、preview/提交、目标接受/拒绝、申请人取消、管理员审批/拒绝/direct、完成后revoke及两级设置，不启用production workflows、不改API/DB。视觉1:1复用已确认的production `DutyAdjustmentPanel` 390/320黄金和既有医疗蓝灰令牌；纯WXML/WXSS/TS/JSON，无TDesign MiniProgram/第三方UI。
- 来源/测试先行：`git log -S`/blame定位Web加扣班到`5d8b205a`、移动卡片到`2bb9fce1`、Mini“调班”占位到`ad4cfb2c`（动效/图标`733e3af6`/`3fc41610`），危险写快照沿用`b667dcc5`。缺页面/分包/导航/controller/operation snapshot的2 files/8 tests先全红；实现后P7 leave/swap/duty 6 files/25、Mini全量40 files/218转绿，旧leave/swap subpackage与不可用入口断言仅按计划增加真实duty入口更新。
- 实现/安全：workflows分包加入duty页，工作台“调班”按Web真值统一为“加扣班”，三工作流底栏真实互转且均先受`workflows`能力门控；guest/disabled/deep link在业务请求前失败关闭。成员不读管理员approvals；月份切换立即清空旧候选并以group/month/request serial阻止迟到覆盖。create/direct/accept/approve/reject/cancel/revoke全部冻结payload/operationId并保持header/body同ID，显示过的preview与当前covered assignment/overtime member精确匹配才写；原因变化自动换ID，模糊失败保留快照，409丢弃并刷新，无离线写队列。设置PUT保持Web语义：群组审批走duty settings，个人自动接受复用swap settings且不重试。
- 对等状态：页面覆盖Web同序的主操作、管理员direct、审批/自动接受设置、待我接受、待管理员审批、已受理、已生效待撤销、我的记录，以及`pending_target/pending_approval/completed/rejected/cancelled/revoked`、empty/error/loading、逐条冲突preview、普通/管理员原因和撤销原因；撤销成功明确恢复原扣班成员。所有主动作≥44px，390/320仅flex布局，无横滚/CSS grid。
- 验证：Mini typecheck、任务Prettier/ESLint、`git diff --check`、source/built/package/performance/determinism通过；production verify为2/2 Worklet、2282116 bytes、manifest`578d62705107a4ade1aebaa0a597c7f65081460212a8cce2f7337ea44e374afc`，仅既有600格矩阵节点best-effort警告。`smoke:check-core`确认未触及Web核心链路；按禁令未启动/控制微信开发者工具，原生视觉仍不得由自动门禁冒充实体验收。
- checkpoint/体验：`764276f1`（`feat(miniprogram): add native duty workflow`）已推送；从该提交干净worktree成功上传production-profile体验版`0.1.0-p7.20260824.84-duty`，81个代码文件、zip752331 bytes、manifest`b927e08bd1c45ba8555b08a83572181c2587bb8d42042e2a0cd0dcae127bdf1b`。仍未allowlist、未提审/正式发布，production workflows保持false。
- 生产/下一批：部署前加密备份`16081efb-eea7-40c7-a6da-55d0215b6be7`（54表、164194行、77248428 bytes、SHA-256`a17f80f7aff110b2e6996b5d055cc8a7199cf62e3237b233ed8ca2a0c3a66728`）后部署release`764276f1b43021e5dc66f7e52b18367886430f57`；DB51、privacy visitor/telemetry 0/0，TLS EOF/502预热重试恢复，full verifier通过，远端临时上传已删。状态checkpoint识别消息`docs(status): record native duty deployment`；同步生产后下一批只做完整P7 capability/版本/RC整合，形成可用体验版后暂停等待用户实体Android视觉/交互确认。

## 2026-08-24 P7-D 原生换班垂直切片（代码已部署，能力保持关闭）

- 基线/范围：Git/origin/production均为`50054703`、DB51；本批只实现Mini原生换班跨月候选、preview/提交、目标接受/拒绝、申请人取消、管理员审批/拒绝/direct、完成后revoke及两级设置，不实现加扣班、不启用production workflows、不改API/DB。视觉继续1:1复用已确认的production `SwapPanel` 390/320黄金和现有医疗蓝灰令牌；纯WXML/WXSS/TS/JSON，无TDesign MiniProgram/第三方UI。
- 来源/测试先行：`git log -S`/blame定位Web换班到`b20ff9b8`、Mini禁用入口到`ad4cfb2c`（动效/图标`733e3af6`/`3fc41610`），共享危险写边界沿用`b667dcc5`。缺页面/分包/导航/跨月controller/操作快照的2 files/8 tests先全红；实现后换班8/8、P7 leave+swap 4 files/17、Mini全量38 files/210转绿，旧leave subpackage/不可用入口数量断言按新增真实swap入口作计划内更新。
- 实现/安全：workflows分包加入swap页，工作台、leave/swap底栏真实互转且均先受`workflows`能力门控；guest/disabled/deep link在业务请求前失败关闭。成员不读管理员approvals；跨月calendar按group+month最后请求序列合并，迟到响应不能覆盖新候选。create/direct/accept/approve/reject/cancel/revoke全部经`resolveWorkflowOperationAttempt`冻结payload和operationId，header/body同ID；显示过的preview与当前双方assignment精确匹配才写，模糊失败保留快照，409丢弃陈旧attempt并刷新，无离线写队列。设置PUT不伪造幂等/不重试。
- 对等状态：原生页覆盖Web同序的主操作、管理员direct、审批/自动接受设置、待我接受、待管理员审批、已受理、已生效待撤销、我的申请，以及`pending_target/pending_approval/completed/rejected/cancelled/revoked`、empty/error/loading、冲突preview和可选撤销原因；所有主动作≥44px，390/320仅flex布局，无横滚/CSS grid。
- 验证：Mini typecheck、任务Prettier/ESLint、`git diff --check`、source/built/package/performance/determinism通过；production verify为2/2 Worklet、2088002 bytes、manifest`8a1c57ee5d8bd77910c9148318c0c821079596c089e5e27f5b7b839f3b78e623`，仅既有600格矩阵节点best-effort警告。`smoke:check-core`确认未触及Web核心链路，无需完整Web浏览器冒烟；按禁令未启动/控制微信开发者工具。
- checkpoint/体验：`7d3b93c8`（`feat(miniprogram): add native swap workflow`）已推送；从该提交干净worktree成功上传production-profile体验版`0.1.0-p7.20260824.83-swap`，78个代码文件、zip672103 bytes、manifest`9b1a65e56b5bd079a90db9a54641d1f694836cba47837645e70759273810b604`。仍未allowlist、未提审/正式发布，production workflows保持false。
- 生产/下一批：部署前加密备份`7eabc2c5-b66d-40d3-b51d-ad8ea1565e0c`（54表、164114行、77221492 bytes、SHA-256`4c9394c558b3b553ffacb3018cbf98174e1544e1d089ce92c93ac2c96657bb1d`）后部署release`7d3b93c8f52308db16b7542f5bf31fa98920a172`；DB51、privacy visitor/telemetry 0/0，首个502预热重试恢复，full verifier通过，远端临时上传已删。状态checkpoint识别消息`docs(status): record native swap deployment`；同步生产后下一批只做P7-E原生加扣班，完整P7 capability候选形成后停在用户实体UI/交互视觉确认门槛。

## 2026-08-24 P7-C 原生请假垂直切片（代码已部署，能力保持关闭）

- 基线/范围：Git/origin/production均为`5054deef`、DB51；本批只实现Mini原生请假创建、影响班次、我的申请、取消/撤销、管理员列表、预览/批准/驳回和群组默认重排策略，不实现换班/加扣班、不启用production workflows capability、不改API/DB。Web黄金为`a2f98361`固化的真实`LeavePanel/LeaveApprovalDialog` 390/320状态；Mini严格使用WXML/WXSS/TS/JSON、Skyline和glass-easel，无TDesign MiniProgram或第三方UI。
- 来源/回归：`git log -S`/blame定位工作台禁用请假入口到`ad4cfb2c`（后续动效/图标`733e3af6`/`3fc41610`）、能力失败关闭范式到`e25878f0`、共享workflow client/危险写快照到`b667dcc5`、Web请假生产实现到`0d5ec55c`。缺分包/运行客户端/页面/能力关闭/操作快照的3 files/11 tests先全红，实现后转绿；源码审计另先发现textarea按void tag处理并在生产verify中失败，改为合法自闭合后通过。
- 实现/安全：新增workflows分包原生请假页和能力门控工作台入口；成员不读取审批列表，guest/深链在网络前失败关闭。所有危险写通过`resolveWorkflowOperationAttempt`冻结payload和operationId，header/body同ID；仅成功清理，模糊网络结果保留同一快照供直接重试，payload变化换ID，无storage/offline write queue。批准严格提交用户已看见的预览版本/rules/period快照；冲突或空缺必须确认，409丢弃陈旧attempt并重新读取。
- 语义/视觉：Web仍保留`tdesign-vue-next`；Mini仅自绘原生44px动作、状态卡、表单和底部Sheet，复用现有医疗蓝灰令牌及Web文案/状态层级。新增副作用仅为workflows能力有效时的请假读取/显式用户写入；core能力、工作台排班读取/缓存、swap/duty入口、认证接收者和重试边界不变。production workflows仍false，因此已部署旧体验版本继续显示禁用入口。
- 验证：Mini定向3 files/11、全量36 files/202、Mini typecheck、任务ESLint/Prettier、`git diff --check`通过；production verify通过source/build/package/performance/determinism（2/2 Worklet、1885090 bytes、manifest`07c75bf6a1c8fc977ef64cce155f03d588a66dbf2a994e059594aeb3a5d3594c`；仅既有600格矩阵>1000节点best-effort警告）。`node scripts/smoke-browser.mjs --check-core`确认未触及Web核心链路，无需完整Web浏览器冒烟；按禁令未启动或控制微信开发者工具，原生视觉/交互仍须用户在体验版实体设备复核。
- checkpoint/体验：`9fae3869`（`feat(miniprogram): add native leave workflow`）已推送。从该提交的独立干净worktree成功上传production-profile体验版`0.1.0-p7.20260824.82-leave`，75个代码文件、zip588971 bytes、manifest`98c92331718d0c223116a2c3d04d1ecbca936875920be7350f4f6374a0735f3c`；未提审/未正式发布。为防部分P7误开放，该版本未加入production allowlist，线上能力查询按预期426；`.81`仍core=true/workflows=false。用户授权后，仓库外私钥已复制到固定受控目录，ACL仅当前Windows用户、用户级`WECHAT_CI_PRIVATE_KEY_PATH`/robot1已持久化，Downloads原件保留；任何路径/密钥内容均不进Git。
- 生产：部署前加密备份`007c5cb2-4513-46be-87c3-1ace71ecc7c7`（54表、164021行、77190284 bytes、SHA-256`0dc812e49382313fae2e494c37cc9f4f6d9dcfa080074de81203edb52a2c7e71`）后部署release`9fae3869c9adbe5c83b1d45851c96ab9fbe71615`；DB51、privacy retention visitor/telemetry 0/0，预热首次TLS EOF后自动恢复，完整verifier通过产物/控制面/能力/容器/迁移/健康检查，远端临时上传已删除。状态checkpoint识别消息为`docs(status): record native leave deployment`。
- 下一批/停止条件：状态checkpoint推送并同步生产后，只做P7-D原生换班垂直切片，保持workflows capability关闭，不提前做加扣班或P8；完整P7候选上传并可安全启用后，在实体UI/交互人工视觉确认点暂停等待用户。

## 2026-08-24 P7-B 工作流 Storybook 全状态黄金（代码已部署）

- 基线/范围：Git/origin/production均为`7cbb171c`、DB51；本批只从真实`HomeView`和production `LeavePanel/LeaveApprovalDialog/SwapPanel/DutyAdjustmentPanel`固化P7视觉状态，不写Mini WXML/WXSS/TS、不启用workflows capability、不改API/DB。生产面板及seed来源分别为`0d5ec55c`/`b20ff9b8`/`5d8b205a`和`b903c6dc`；`git log -S`/blame已逐项定位。
- 设计/组件边界：`frontend-design`审查服从用户“1:1 Web手机版”固定方向，不创建新配色、字体或第二套简化卡片；继续使用Web生产TDesign Vue、系统字体和蓝灰令牌，工作流状态→信息→动作层级是唯一视觉强调。Storybook全局注册现有TDesign插件只是为了真实渲染生产组件；Mini仍严格禁止TDesign MiniProgram/第三方UI，后续只用原生WXML/WXSS和自绘组件复刻。
- 黄金实现：新增一个fixture fetch/harness和20个精确Storybook ID，覆盖leave/swap/duty的成员/群主、mine/review、list/create/approval/preview/conflict/direct/settings、`pending/approved/rejected`与`pending_target/pending_approval/completed/rejected/cancelled/revoked`、empty/error/loading及390/320。harness先加载真实Home shell，再按真实“更多”导航、TDesign select和ResponsiveSheet交互装配目标状态；缺route/装配超时显式失败，不以静态仿制替代。
- 测试先行/修正：缺生产复用、全状态和清单映射先3/3红；真实浏览器随后发现Storybook移除auto-import后把TDesign标签当未知元素，新增全局TDesign注册回归先红后绿。20态几何审计唯一发现请假审批“生成重排预览”仍为32px；blame到`3f6a15ac`，新增44px断言先红后只补`min-height`，无文案/事件/API/调用次数变化。
- 验证：P7定向10 files/47 tests、主工作区非integration 189 files/984（25 skip）、Web typecheck/production build、任务Prettier/ESLint和最终静态Storybook build通过。最终静态产物逐20态浏览器验证为unknown TDesign=0、stage error=0、console warn/error=0、页面/panel/Sheet横溢=0、工作流与Sheet按钮<44px=0，preview/conflict/direct均真实装配；390/320视觉证据在系统临时artifact`schedule-p7-workflow-golden-7cbb`。本批未触及核心Web链路，无需完整`pnpm smoke:browser`，提交前仍运行`pnpm smoke:check-core`。
- 语义：唯一生产变化是重排预览按钮高度32→44px；fixture仅Storybook iframe内替换fetch/localAuth并在卸载恢复，不进入production bundle或写外部状态。
- checkpoint/生产：`a2f98361`（`feat(storybook): freeze p7 workflow parity states`）已推送。发布前加密备份`afefaed8-5a98-4067-a91b-4a87ecd6a016`（54表、163889行、77146000 bytes、SHA-256`7ef85dbd56d6c90db835fc49d09882843ac710c922217526635aeb81ac50acbb`）后部署release`a2f983612df204c9d43a2796fef62b0d9006efb9`；DB51、retention0/0，预热首个502后恢复，完整verifier通过且远端临时上传已删除。最终状态checkpoint识别消息为`docs(status): record p7 workflow golden deployment`。
- 下一批/停止条件：状态checkpoint推送并部署后，只做P7-C原生请假垂直切片（controller/ViewModel、页面、导航失败关闭和全状态），保持workflows capability关闭，不提前实现换班/加扣班或进入P8。

## 2026-08-24 P7-A 工作流危险写与共享客户端边界（代码已部署）

- 基线/来源：P7审计`3dd3c0fe`已与Git/origin/production对齐、DB51；leave/swap/duty来源`0d5ec55c`/`b20ff9b8`/`5d8b205a`，事务幂等骨架`beae8e84`/`7fcd6ae4`/`e5608cf3`。本批只完成安全与Web-first共享边界，不写Mini WXML/WXSS、不启用workflows capability或改DB。
- 安全实现：leave create contract强制`operationId`并进入`runAuthorizedMutation(leave_request_create)`，canonical payload fingerprint保证同ID同载荷精确重放、同ID异载荷409且只写一次request/event。leave/swap/duty共19个危险写路由统一用`resolveDangerousOperationId`校验`Idempotency-Key`与body；只传其中一侧保持兼容，两侧不一致在service调用前400。
- 共享边界：client-core新增38个三工作流read/preview/settings/write endpoint与严格compact decoder；生成schema扩展typed `additionalProperties`/`propertyNames`，生成器读取仓库Prettier配置后输出，generated/freshness/structural equality一致。Web API 38个方法全部委托共享client；presentation-core新增canonical、深冻结的operation attempt，四个production panel对同一payload的模糊失败重试复用ID、payload变化换ID、仅成功后清理。
- 测试先行/联动：contract/routes/client/Web delegation/operation attempt/panel wiring均先红后绿；定向8 files/172，运行时边界4/4，主工作区非集成188 files/980（25 skip），正确Mini cwd 33 files/191通过。真实MySQL最终leave20+swap34+duty26+notifications8+WeChat4=92/92；第一次联动运行的7个400均定位为旧测试helper漏传新leave operation ID，补齐同header/body后全绿，无业务实现回退。
- 构建/运行：contracts/client-core/presentation-core/API typecheck/build及Web typecheck/production build、Mini production verify通过（2/2 Worklet，1681889 bytes，manifest`205b035ea39b825d0460c1d62442744cdb2a82ad5088457d5e4b32d56dd81e1f`）。运行/浏览器验证：`pnpm smoke:browser`的等价直接入口在最终源码4173/API3000通过管理员、成员、访客vkey和访问记录且无浏览器错误，最终截图`C:\Users\eylin\AppData\Local\Temp\schedule-smoke-oKEqzb`，临时服务已停止。前两次稳定停在视口外周导航触摸采样；`git log -S`/blame定位验证器到`0aaa5620`，只在取坐标前`scrollIntoViewIfNeeded`，产品UI未改。
- 语义审计：receiver仍经同一shared transport调用，preview/settings无幂等头且读取/错误解析次数不变；危险写body/header一致、失败保留attempt、成功一次清理，没有离线写队列或额外业务调用。
- checkpoint/生产：`b667dcc5`（`feat(workflows): harden shared operation clients`）已推送。发布前加密备份`e81f6b7d-62e1-4c0c-9a82-33af178a6b3b`（54表、163744行、77097920 bytes、SHA-256`4d1343221c40a5c944c911b32ec1756eebbe11f998db91fc34dbc52beacb24c0`）后部署release`b667dcc5cb46dc266a08c0ca064c10641de04b69`；DB保持schema51，privacy retention首跑0/0，预热首个502后恢复，完整`ecs-verify.sh`通过产物/控制面/能力/容器/迁移/健康检查，远端临时上传已删除。最终状态checkpoint识别消息为`docs(status): record p7 workflow safety deployment`。
- 下一批/停止条件：状态checkpoint推送并部署后，只做P7-B——从四个production Web panels固化请假/审批、换班、加扣班的390/320完整状态Storybook与1:1验收证据；验证通过即停，不提前写Mini工作流或进入P8。

## 2026-08-24 P6-C9 核心 RC 实体 Android 验收（用户已通过）

- 验收证据：用户在`.81`体验版完成P6核心RC后明确回复“通过，继续”；按`apps/miniprogram/docs/runbooks/p6-core-rc.md`约定，该明确反馈足以证明5/5/5/10性能阈值、弱网/离线/后台恢复和矩阵滚动手感全部通过，不强制提交截图或逐项数字。此证据只能来自用户实体Android操作，未由Storybook/simulate/miniprogram-ci或桌面墙钟替代。
- 文档一致性：RC手册原“性能探针只在query启用且不上传”源自`e2270bde`，在`.81`的`c5322516`匿名遥测后已过时；修正为测量始终存在、只有`performance=1`显示并保留页面内samples/max、服务端只接收固定metric+单次duration且无身份/正文，失败丢弃。测试步骤、阈值、样本数和证据口径不变。
- 当前状态：P6核心v1已完成自动门禁、体验上传、实体RC、隐私保留、capability与应用回滚演练、生产部署；Git/origin/production均为`7d9a81b6`，DB51、`.81` global/core/guest有效。用户未明确授权微信提审/正式发布，故仍只保持体验版，不代替用户执行正式发布。
- 下一活动批次：进入P7工作流，先审计现有Web/API的请假、换班、加扣班、审批/撤销/冲突/通知与Mini缺口，并冻结Web手机版1:1状态映射；用户已明确无需逐页询问UI设计，视觉实现直接以现有Web手机版为黄金源。首批只做P7审计、共享边界与首个依赖闭环，不提前进入P8。

## 2026-08-24 P6-C8 Mini `.81` 纯内存脱敏遥测（已部署待实体 RC）

- 范围/基线：Git/origin/production均为`a1d25fde`、DB51/telemetry表空。本checkpoint只实现Mini匿名emitter、App runtime error和既有性能probe接线，并把production allowlist样例扩展至`.81`；无WXML/WXSS/Web UI/API/DB变更。App/capability来源`e25878f0`，POST无幂等不重试语义来源`9e3a966c`，callback-delimited性能probe来源`e2270bde`。
- 测试先行/隐私边界：缺模块/App hooks/性能接线先8/8失败；随后in-flight总量、私有路径归一化、hostile rejection getter又分别先红后绿。emitter只在global+core同步有效时工作，queued+in-flight总计最多10条并按匿名事件去重；单POST/3s、无Bearer/idempotency/retry/storage/offline queue，失败即丢弃且不能递归报错。队列永远只持固定page/tier/error/performance和SHA-256 fingerprint，不持raw stack/message、身份、群组、手机号、token、客户端时间或业务正文。
- 粗粒度与脱敏：只读取`benchmarkLevel`，非正/缺失=`unknown`、1–2=`low`、3–5=`medium`、6+=`high`；从不读取/上传其他设备身份字段。网络只保留none/wifi/2g/3g/4g/5g/unknown。纯TS SHA-256通过ASCII/UTF-8向量；URL/query、UUID、长hex、数字和本地绝对路径先归一化，Proxy getter异常回落unknown fingerprint。固定page alias覆盖identity/workbench/manual matrix/manual/backfill/group settings，未知路由失败关闭为unknown。
- 接线/语义审计：App新增`onError/onUnhandledRejection`，只发`MINI_RUNTIME_ERROR`的app fingerprint。工作台core/foreground与矩阵maximum-render/tap继续以原`setData` callback为终点；probe现在默认创建并发送匿名duration，但`performanceEvidence`额外patch仍只在`?performance=1`，默认视觉/setData数量不增加。既有capability refresh、请求接收者、认证/重试、业务读取/写入、catch范围、空值、矩阵mutation/undo和WXS热路径不变；唯一新增副作用是允许时的best-effort匿名POST。
- 验证：Mini 33 files/191 tests；全仓lint/typecheck/build、受控non-integration 168 files/913（25 skip）通过。精确clean `c5322516`的`.81` production verify/source/2 Worklets/determinism/package/dry-run通过：132 files、1329516 bytes（main878383/scheduling335395/organization115738）、matrix1445/1506、view-model171340、manifest`8e11d0fc6a074a4ac78bdd76b5cd5a389aa4b433b1d1f76577929005eb522d5b`。clean worktree唯一首次performance test因Windows CRLF被Vite误解析；Prettier仅规范行尾、cached diff=0，单测4/4与全Mini191复跑通过。运行/浏览器验证：`pnpm smoke:check-core`确认无Web核心变化，无需`pnpm smoke:browser`；格式/diff check通过。
- 体验/生产：`c5322516`已推送。首次上传经本机代理走未登记IPv6而被微信拒绝且未形成版本；移除代理后同commit/版本幂等重传成功，production-profile体验版`0.1.0-p6.20260824.81`上传72个代码文件、zip476544 bytes、上述manifest，未提审/正式发布。production release锁下原子扩展allowlist为`.78,.79,.80,.81`，失败自动恢复旧值；env仍UID0/0600，`.81` global/core/guest=true、其余四维false。备份`5d10a80c-feb2-4d4d-991d-5848b3107141`（54表、163405行、76985852 bytes、SHA-256`e0837fcf297994ed1cf52cfbb9c771b6beef133c357af9d17fff94989e9b8dcc`）后部署`c53225164b0b30aab749160ec3a506472d869573`；job`55eccf06-…`与full verifier通过，DB51/telemetry0/latest backup54/health200。
- 当前状态/下一步：P6仓库实现、体验版、隐私/回滚与生产部署已齐，但核心RC仍必须由用户按`apps/miniprogram/docs/runbooks/p6-core-rc.md`在实体Android完成`.81`的5/5/5/10样本、弱网/离线/后台/滚动清单；未明确通过前状态为“已实现待实体性能复核”，不得进入P7或正式提审。最终状态checkpoint识别消息为`docs(status): record mini telemetry deployment`；同步production后停在P6 RC门槛。

## 2026-08-24 P6-C7 遥测 schema 51 与保留激活（已部署并完成回滚演练）

- 范围/基线：Git/origin/production均为`be740fc`、DB50、telemetry表不存在；本checkpoint只应用additive migration0051、把release schema收紧为51..51并强化生产verifier，不改Mini/Web UI或已部署的API/retention/backup运行时。`databaseSchemaMin`失败关闭来源为`e25878f0`，上一个迁移/feature范式来自`1514de25`，telemetry metadata/runtime来自`03c5d465`。
- 测试先行与实现：旧代码先出现缺0051、manifest min仍50、verifier无schema51检查共3项失败。0051创建无FK/身份/群组/JSON的10列匿名表、3个固定索引和3个数据库CHECK；journal升51，release只接受51。verifier在DB51强制表/索引/CHECK、严格`<now-30天`零过期、retention已成功以及最新备份54表（56业务表减raw visitor和telemetry）。29个旧式真实MySQL reset夹具显式删除新表，避免后续迁移重复建表。
- 运行与保留验证：真实MySQL migrations23、platform backup/restore10、privacy retention6、telemetry ingestion3，共42/42；覆盖无效CHECK写失败、header-derived单SQL写、30天等边界保留/-1ms删除、bounded backlog续跑、双worker无重复，以及备份/恢复均无telemetry。静态8 files/40、受控非integration 168 files/913（25 skip）、Mini正确cwd且排除历史副本32 files/181通过；全仓lint/typecheck/build和Mini production verify通过（131 files、2 Worklets、1283685 bytes、manifest`cb44f95f321e3f638e7087a33eae4e5847dee336b8fd8b95ffb8bf4617fc998b`）。
- 验证噪声/审计：一次未排除用户`.artifacts`的真实MySQL命令匹配历史副本后立即停止；一次并行/随后宽串行全API命令暴露共享单库争用、既有calendar-preferences不完整旧表reset与既有concurrency fixture 403，均不涉及0051调用点。改用排除副本、文件串行的相关真实源42/42作为门禁；遥测结果测试另修正“同毫秒随机UUID可代表输入顺序”的错误假设。行为变化仅为新增空匿名表、DB51 retention/backup/API激活与feature release拒绝DB50；现有业务表、身份、请求接收者、异步/错误/空值和调用次数均不变。
- 发布/演练：feature `fb510c23`已推送；迁移前备份`c43c46dd-b540-4d1c-b03e-6bb862092ee8`（54表、163287行、76945608 bytes、SHA-256`9281ea58b42dd6d53aff70b1890853c23619ddf53e6165b506fc473e73866b4f`）后升DB51，首跑retention `04e27e7e-…`为visitor/telemetry 0/0并full verify。迁移后备份`643675bb-8161-4ac4-b8df-c018887531e7`仍54表，证明56张业务表永久排除raw visitor与telemetry。rollback先备份`c78c48e0-6c2e-44d5-8577-e84930372505`，成功回到`be740fc`且数据库保持51/表存在/0行；bridge job `71bff47f-…`和前向安装的新verifier均通过。随后用同一artifact前滚`fb510c23`，job `32688425-…`和最终full verifier再次通过。
- 最终状态/下一批：production current=`fb510c23410b8c0bce4e28a7a54d33dd9135d30b`、DB51、telemetry表1/行0、latest backup tableCount54、health200；Git/origin同checkpoint。Mini源码未变，本checkpoint不上传体验版。最终状态checkpoint识别消息为`docs(status): record telemetry retention deployment`；同步production后，下一批只做`.81`纯内存emitter/App error+既有性能探针接线、allowlist和体验上传，不进入P7。

## 2026-08-24 P6-C6 脱敏遥测运行时兼容桥（已部署）

- 范围/基线：schema bridge `b8c60827` 已与Git/origin/production对齐，DB50/health200。本checkpoint发布可运行于DB50/51的Mini-only telemetry contract/API/schema metadata、30天retention、backup exclusion、Nginx/API限流和日志redaction，不应用0051、不修改Mini源码/UI。
- 严格数据边界：batch1..10、body16KiB；固定page/deviceTier/networkType/errorCode/performance metric，duration为0..600000整数，fingerprint只允许64位小写hex且必须伴随error。禁止身份、群组、手机号、token、IP、raw stack/message、客户端时间、metadata/JSON和排班正文；version只从成对exact Mini headers写入。无Bearer、无read route，global+core任一关闭即503，headerless/partial为400、未知版本426。
- DB50/51兼容：Drizzle提前声明无FK/身份/JSON的telemetry表；DB50 endpoint明确503，privacy job检测缺表并返回telemetry 0/0，backup/legacy restore预先排除表。DB51时同一runtime进行单SQL批插入和严格`<now-30天`分批SKIP LOCKED删除。Nginx exact route 30r/min+burst10/body16k，API全局budget不保存IP。
- 测试先行/验证：缺contract/schema/service、backup/retention/rate/redaction先出现8个失败测试+2个缺模块suite；实现后unit/static 8 files/32 tests、真实MySQL runtime bridge ingestion3/3、全仓lint/typecheck/build通过。运行/浏览器验证：pnpm smoke:browser在127.0.0.1:4173当前源码/API完整通过管理员、成员、访客vkey和访问记录，无浏览器错误，截图`C:\Users\eylin\AppData\Local\Temp\schedule-smoke-EGPa7t`，临时服务已停止。
- checkpoint/发布：runtime bridge `03c5d465`（`feat(telemetry): add anonymous client runtime`）已推送；发布前加密备份`09e4200d-6ecc-4acb-956e-0aed6e1e4b67`（54表、163179行、76909408 bytes、SHA-256 `d69afa9e5005ebe40f8a350d33ed45fe13f1c86741b626537a3e5adc60c58157`）后部署。生产`current-release=03c5d4655bca17915cde64f4c5577baddc477863`、manifest50..51、仍50 migrations且telemetry表不存在；完整verifier通过，手工retention `8a2b4d2e-f1e2-49f3-879e-329e1718c939`返回visitor/telemetry均0/0。下一批才提交0051、Mini纯内存emitter/App error+性能接线、`.81` allowlist/体验上传及DB51 rollback/forward，不进入P7。

## 2026-08-24 P6-C5 数据库 50→51 遥测兼容桥（已部署）

- 范围与基线：Git/origin/production均为`47e753e3`，DB50、health200、privacy retention正常。本checkpoint只把release manifest兼容上界从50提升到51，不新增0051、表、API、Mini代码或运行行为；用户自有配置/Storybook/副本不纳入。
- 来源与测试：schema范围声明沿用`e25878f0`建立的失败关闭机制；package test先把max期望改为51并在旧packager上1项失败，修复后保持min=50/max=51。DB50部署可回到`47e753e3`，未来0051只能回到接受DB51的后续telemetry runtime bridge，数据库不降级。
- 发布/下一步：`b8c60827`已推送；备份`80341696-f4d6-4374-914e-7f72ee6ee85f`（54表、163120行、76889840 bytes、SHA-256`eb1b305658a0702d846dbb24d1d6c3c5017d1f734afa4cc69efac780b6e8b719`）后部署，privacy job `e7655f6c-…` no-op、full verify通过。manifest50..51/candidate=`47e753e3`、生产仍50 migrations；随后进入DB50/51 telemetry runtime bridge。

## 2026-08-24 P6-C4 访客 IP 90 天聚合与清理（已部署并完成回滚演练）

- 范围与基线：最终 privacy runtime bridge `bbcd00d4` 已与 Git/origin/production 对齐，生产 DB49、raw rows=0、健康200。本 checkpoint 只应用 migration0050、把release min/max收紧为50..50，并激活已部署的匿名聚合/事务清理/API/15分钟cron；不改UI、不进入遥测或P7。
- 迁移与不变量：0050只给raw表增加全局`(created_at,id)`索引，并创建PK=`group_id/access_month/business_month`、BIGINT count、month/count CHECK和group FK的`visitor_access_monthly_aggregates`；不复制或回填raw IP。空生产raw表意味着首次运行应为no-op，历史31份归档已只读核对raw rows为0，不需不可逆改写。
- 事务与边界证据：cutoff一次捕获为`now-90*24h`，只处理严格`<cutoff`，等于边界保留；按createdAt/id加锁、SKIP LOCKED、1000行批次，在同一事务按北京时间accessMonth+businessMonth聚合、删除精确ID并写无IP/request/raw ID的audit。真实MySQL覆盖中国月边界、跨businessMonth/群组、重复运行、audit失败全回滚、bounded backlog续跑和并发worker无重复。
- 测试：migrations22/22、privacy transaction4/4、visitor API9/9、platform backup/restore10/10，共真实MySQL45/45；unit/static9 files/50 tests、API/DB/Web typecheck、root build、完整browser smoke已在runtime bridge通过。中间失败准确暴露复合索引在information_schema返回2行、测试迁移相对路径、随机group排序和恢复前seed数据未清空，均只修正验证夹具/期望后全绿。
- 发布与首次验证：feature `1514de25` 已推送；迁移前备份 `73e56ae0-2ec6-43da-9d74-f009d21c2c71`（53表、163064行、76869876 bytes、SHA-256`653be5db2b3a7e5139a68f3f89a88c0ef05bea7f79e2324e43cfd7fcc180dc44`）后部署并迁移到DB50，首跑`b945b606-…`为deleted/remaining=0；full verifier通过。迁移后备份`2921998f-0af7-4026-be05-30600af8e884`为54表，证明55张业务表中raw被排除且aggregate纳入。
- 回滚/前滚演练：rollback自动备份`8d3b59eb-6bfe-4e99-9b78-7af777c3894d`后成功回到`bbcd00d4`，数据库保持50，前向control/cron保留，full verifier通过；bridge手工运行retention `909316b9-…`成功。随后用同一不可变artifact前滚`1514de25`，retention `cd2423b1-…`与最终full verifier再次通过。未降级/恢复数据库，也未回到更早raw日志release。
- 最终生产状态：current release=`1514de25937077aa1bae166ec8819f19b1339f32`，manifest50..50/candidate=`bbcd00d4`，50 migrations、55业务表；raw/过期raw/aggregate=0/0/0，completed retention runs=4，cron present，MySQL=2592000/0，首页/健康200且Nginx日志无raw IP/query。无Mini源码变化，不新增体验上传。
- 下一活动批次：最终状态 checkpoint 识别消息为`docs(status): record visitor retention deployment`；该docs-only release同步production后，下一批独立建立DB50→51兼容桥并实现P6脱敏遥测/30天保留。P6实体Android RC仍未通过前不进入P7。

## 2026-08-24 P6-C3 访客 IP 隐私运行时兼容桥（已部署）

- 范围与基线：schema bridge `da144470` 已与 Git/origin/production 对齐，生产 DB49、健康 200。本 checkpoint 先发布可同时运行于 DB49/50 的隐私运行时，不应用 0050：原始 90 天 API 截止、平台管理员读取、IP 规范化/可信代理、备份/旧恢复排除、Nginx 无 IP/query 日志、MySQL 30 天 binlog/general-log 边界，以及 dormant retention job/control plane；不改 Web/Mini UI。
- 引入点与测试先行：`git log -S`/`git blame` 将 visitor 表/服务/`request.ip`/全表备份/group recycle 分别定位到 `4fc6bd21`、`4b337490`、`7c783c71`、`a837586e`、`9e4a6765`。缺 aggregate contract/schema/job/scheduler、trustProxy/Nginx/MySQL 门禁先出现 6 项失败；backup format 2/旧格式 raw skip 先 2 项失败；group recycle 明示 raw/aggregate 覆盖先 1 项失败，修复后相关 unit/static 9 files/50 tests、真实 MySQL visitor/platform+backup 19/19 与 API/DB/Web typecheck 通过。
- DB49/50 兼容语义：Drizzle 提前声明 aggregate 及 job，但 DB49 时 aggregate API 明确 503、group recycle 跳过尚不存在的 aggregate、updater只安装并哈希 retention control而不创建cron/运行job；DB50时同一代码启用15分钟cron并在发布窗口先执行一次。feature回滚到本 runtime bridge 后保留前向control plane，job/API/backup/Nginx在DB50继续满足隐私，不会退回raw日志或失效清理。
- 数据与权限：raw list 强制 `created_at >= now-90天`，等于边界保留；环境平台管理员与 developer admin 无需群成员关系，群主/群管理员保持原权限，member继续403。Fastify只信任1 hop；Nginx覆盖XFF，服务只接受规范IPv4/IPv6并把非法/多跳文本存NULL。匿名响应只含accessMonth/businessMonth/decimal accessCount。
- 备份与基础设施：新 backup payload 升级format2并永久排除`visitor_access_logs`，format1旧归档仍可解密但恢复时跳过raw，aggregate允许备份。Nginx privacy log不含remote/query/request，error仅emerg；MySQL显式30天binlog且general log关闭。retention脚本带host flock，控制脚本/cron/hash/失败恢复均进入forward-only release control。
- 运行/浏览器验证：pnpm smoke:browser 已强制运行。首次 5173 未启动按门禁停止，随后默认 Vite 绑定 `::1:5173` 被系统 EACCES 拒绝，再以显式 `127.0.0.1:4173` 启动；首次未显式启用 Web dev auth 再次按门禁停止，最终以当前源码/API、仅当前进程 dev auth 完整通过管理员、成员、访客 vkey 与访问记录全链路，无浏览器错误，截图 `C:\Users\eylin\AppData\Local\Temp\schedule-smoke-9arQfM`。临时服务已停止。
- 部署反馈与修正：运行时桥 `4f1047c8` 已推送，备份 `f71c6fca-b2a0-4fa7-99fe-60e389413941` 后在 DB49 部署；迁移/健康/控制面通过，但独立 verifier 发现 conf.d 的 http 级 privacy access log 与 Nginx 镜像既有 `main` log 并存，容器仍双写 raw IP/query，因而明确失败。新增“4个 server 均必须覆盖 inherited access_log”回归先1项失败，follow-up `bbcd00d4` 修复。
- 最终发布：用新runtime先生成备份`d8ec7b2b-ebef-4cae-901f-84638dddec21`（53表、163037行、76860864 bytes、SHA-256`39c5ca6c5e8d49bf9d37ab938c5bc8559c71e863e3d23e9d4a21e8351ee6da20`），表数从54降到53证明raw visitor整表已排除；随后部署`bbcd00d4a8942227201e5241737e92f16476b4fd`。首次502自动恢复，full verify通过privacy日志、MySQL2592000/0、control hash、49 migrations；raw rows=0、control installed、cron absent、manifest49..50。该release是0050唯一rollback candidate。

## 2026-08-24 P6-C2 数据库 49→50 可回滚兼容桥（已部署）

- 范围与基线：Git `HEAD`/`origin/main` 与 production `current-release` 均为 `5e010927`，生产健康 200、数据库 schema 49。本桥接 checkpoint 只把不可变 release manifest 的应用兼容上界从 49 提升到 50，不新增迁移、表、API、定时任务或运行行为，不修改 Web/Mini UI；用户自有配置、Storybook、`.artifacts/runtime/src` 和工作簿不纳入。
- 引入点与测试先行：`git log -S`/`git blame` 确认 DB 49..49 rollback declaration 由 `e25878f0` 引入。回归测试先要求 `databaseSchemaMin=49`、`databaseSchemaMax=50` 并在旧 packager 上 1 项失败，实现后 package/release controls 2 files/21 tests 通过。一次未排除用户历史 release 副本的宽泛命令额外扫到重复测试与 1 个不完整副本，随后显式排除后真实源全绿，未修改副本。
- 安全语义：当前代码和 0049 schema 对新增独立表/索引为加法兼容；bridge 在 DB49 部署，直接回滚候选 `5e010927` 仍接受 DB49。下一 release 应用 0050 后只能回滚到本 bridge（其 manifest 接受 DB50），不得直接回滚到 max49 release，也不降级/恢复数据库。min=49 保持失败关闭，未放宽到未知旧 schema。
- 验证与 checkpoint：任务 Prettier、`node --check`、package/release controls tests、`git diff --check` 与 `pnpm smoke:check-core` 通过；未触及 Web 核心链路，无需 `pnpm smoke:browser`。直接对 root MJS 调用 ESLint 因该文件未在仓库 ESLint Node globals 匹配范围而报告既有 `process/console` no-undef，根 `pnpm lint` 才是权威门禁。checkpoint 识别消息为 `chore(release): bridge visitor retention schema`。
- 发布与下一活动批次：checkpoint `da144470` 已推送；备份 `88931ea1-f908-4f59-bc45-b005d09bd702`（54表、162859行、76800076 bytes、SHA-256 `c250b20fc4a2138ba389f26e24ab689e705d9f9b6a97b47cc9ca64f2c9c4609c`）后部署。首次502自动恢复，full verifier通过；manifest min49/max50、rollback=`5e010927`、生产仍49 migrations。下一批先做DB49/50隐私运行时桥，再应用0050；不进入遥测或P7。

## 2026-08-24 P6-C1 性能量化、自动门禁与实体 RC 探针（已部署待实体复核）

- 范围与基线：从 Git/origin/production 同一 `6dfb8ec2` 开始；用户已确认 P4 全部完成并授权后续版本直接提交。本批只完成 P6 性能预算、默认零影响的实体回调探针及核心 RC 证据计划，不实现遥测、访客 IP 保留或 P7，不改 Web UI。用户自有 Mini config、workspace、Storybook、`.artifacts/runtime/src` 和工作簿均未修改、未暂存。
- 引入点与测试先行：`git log -S`/`git blame` 将 Android 门槛与人工清单定位到 `c8d50f53`/`e53f3611`，20×30 fixture 与正式 20/30/600 限制定位到 `6cc7463d`/`591ccff6`，WXS 热路径定位到 `c35b35b8`。性能脚本/RC 文件缺失先红；条件展开器又以 1 项回归证明旧算法会把确定 false 分支误计为最大分支；原生 probe、页面接线和 foreground 样本也分别先红后绿。
- 自动量化：production build 后展开真实数据，PoC/正式手排宿主元素下界固定为 `1445(depth 8/direct 31)` / `1506(depth 11/direct 31)`，20×30 view-model 固定 `171340 bytes`；WXS 热路径 `setData=0`，tap 动态 cell path≤2。`<1000` 明确未达，只发 warning；两页使用独立 exact no-growth ceiling，深度/直接子项超限、payload/patch/热路径增长均失败关闭。Node 墙钟明确命名 desktop logic smoke，不冒充 Android 结论。
- 实体探针与 RC：只有 `?performance=1` 才在页面内存创建 `wx.getPerformance().now()` probe；工作台测 onLoad→首个 ready/offline callback 及非首次 onShow→刷新 callback，最大矩阵测 view-model ready→600 格 callback 与合法 tap→目标 cell callback。默认路径不新增 `setData`、storage、网络或视觉；诊断路径只在被测 callback 后追加现有样式证据文字。RC 固定 cold/resume/render 各 5 次、tap 10 次和 2500/2500/1000/100ms max 门槛，弱网/离线/滚动仍必须用户实体 Android 复核。
- 语义审计：工作台既有 ready callback 仍先完成同一数据 commit，再执行 pending scroll；probe 未启用或没有 start 时不读时钟、不写数据。矩阵默认 maximum 仍一次相同 view-model patch，tap 的 receiver、validation、mutation、undo、cell path 与调用次数不变；只在显式诊断 query 下为同一 patch增加 callback 并在其后写诊断字符串。WXS 坐标、异步/catch、capability、缓存、离线、P5 写请求和 Web 1:1 UI 均未改变。
- 验证：Mini 32 files/181 tests；性能/RC/真实 workbench/矩阵定向 5 files/25 tests；受控 non-Mini 176 files/948 tests 通过，36 files/324 tests 按无测试 MySQL 跳过。全仓 lint/typecheck/build、任务 Prettier、`git diff --check`、Mini production verify/source/package/Worklet/determinism 与 CI dry-run 通过。宽泛根 Vitest 曾以错误 cwd 启动 Mini 静态测试并产生 35 项预期路径失败，Mini 正确 cwd 全绿；根 format check 只报告本批前已有的用户/既有 15 个文件，任务文件单独全绿。
- Mini 门禁与体验版：final clean commit `ceeea26c` 的 production `0.1.0-p6.20260824.80` 为 131 files、2/2 Worklet、1,294,199 bytes，manifest `f3728c55dda9a76b7c3514597c94364a80e120792450e380cd0e61c442dd2690`；Node `miniprogram-ci` 上传 72 个代码文件、zip 459105 bytes 并明确 completed。未提审、未正式发布。`pnpm smoke:check-core` 确认未改 Web 核心链路，无需 `pnpm smoke:browser`；实体时间尚无用户样本，状态只能是“已实现待实体性能复核”。
- 生产发布：实现 `e2270bde` 与 allowlist `ceeea26c` 均已推送。发布前加密备份 archive `d96c7d70-aa2d-4b51-a597-bf7c3f6c6989`（54 表、162813 行、76784620 bytes、SHA-256 `025aa5252d8f41ac473395972aefa2cb929111c3b36e3c0749af733b8ec394f4`）；allowlist 在 release lock 下从 `.78,.79` 原子扩展到 `.78,.79,.80`，环境仍 root:root/0600。`ceeea26c1b4fa9e19a4a949707f69604974c44d3` 部署时首个健康请求 502 后恢复，完整 verifier 通过 artifact/control hashes、capability/426、容器、认证和 49 migrations；首页/健康 200，`.80` 为 global/core/guest=true，其余四维 false。
- checkpoint 与下一批：最终状态 checkpoint 识别消息为 `docs(status): record p6 performance deployment`；该 docs-only release 同步 production 后，下一活动批次只做 P6 现有访客原始 IP 的 90 天保留安全发布（先建立 additive schema compatibility bridge，再做匿名月聚合/清理/备份与 Nginx 隐私边界）。遥测在其后独立完成；P6 核心 RC 仍等待用户按 `apps/miniprogram/docs/runbooks/p6-core-rc.md` 提供实体 Android 样本，不提前进入 P7。

## 2026-08-24 P6-B 签名版本、七维能力与可回滚发布（已部署并完成演练）

- 范围与基线：P6-A 代码/状态、`origin/main` 与 production 均为 `0cfdeba6`；用户已确认 P4 全部完成并允许后续 checkpoint 直接提交。本批只完成 P6-B signed `clientVersion`、`/client-capabilities`、Mini/API 双端守卫、生产 kill switch 和应用回滚控制，不进入 P6 性能/遥测/IP 保留或 P7，不改 Web UI。用户自有 Mini config、workspace、Storybook、`.artifacts/runtime/src` 和工作簿保持未纳入。
- 引入点：`git log -S`/`git blame` 定位 shared endpoint/decoder 到 `60cec6ed`，错误生成到 `884512c0`/`5ba3993d`，JWT/session 到 `39f9c66e`/`4416f79b`，集中认证到 `0a794d9a`，env 到 `c4504055`，Mini App/request/工作台/手机号 client 到 `3884713b`、`9e3a966c`、`ad4cfb2c`、`59300957`；ECS immutable updater/packager/verify 的恢复与归档基础来自 `5f2bb8b3`。
- 契约与 API：新增严格 semver-like≤64 的 Mini platform/version、七维 `global/core/workflows/organization/insights/externalMessages/guest` 响应和两条 `X-Schedule-Client-*` header；未知版本 426、disabled 503。Mini login/link/register/admin-bind/invite 重签只给 Mini JWT 增加可选 claim；旧无 claim Mini 映射体验版 `.78`，Web/password/dev 不标记。公开 guest 三路只在出现成对 Mini headers 时守 guest，headerless Web 不变；未分类 authenticated Mini 路由失败关闭。解绑和手机号 GET/revoke 在 global off/版本退役时仍可用，grant 仍受 core。
- Mini：App.globalData 持有纯内存 capability store，launch/show 单飞强刷；业务请求等待前台 refresh in-flight 后才决策，每次网络尝试附精确平台/版本 header。网络、404、未知版本、非法/额外字段全部失败关闭；core=false 在 token recovery/`wx.login`/业务 request 前停止。现有 identity/workbench/manual/backfill/group-settings 页面复用既有 error layout；没有 WXML/WXSS 或第二套视觉，unbind 与手机号读取/撤回为唯一 bypass。
- 生产控制：runtime/env 安全默认版本空、七开关全 false；production 显式允许 `.78,.79`，开启 global/core/guest，后续阶段五项保持关闭。`.env.production` 必须 UID0/0600。原子 switch 只保存目标旧 boolean、不复制秘密，持 release/capability 双锁，健康/严格响应失败及 ERR/HUP/INT/TERM/EXIT 自动反改。release manifest 新增 feature level、控制脚本哈希、DB schema 49..49 与单一审计 rollback candidate；packager 强制 clean tracked/untracked、expected commit/candidate ancestor、fresh build、LF、逐文件 `bash -n`、canonical runtime 和无 shell 注入。
- 回滚语义：rollback 只接受当前 manifest 明示的直接安全前驱，严格 realpath/hash/root 权限/DB range，先独立加密备份；应用文件和 current-release 原子回退，数据库绝不降级/恢复。可信 updater/verifier/rollback/switch/backup 控制面以独立 manifest 前向保留；target full verify 失败自动前滚原 release。updater 自身对 artifact、schema、迁移后 count、system controls 和信号/退出做事务式补偿；pre-P6 只在 DB=49 且无 P6 feature 文件时兼容本次直接前驱。
- 语义审计：成员调用、body/path/operationId/idempotency snapshot、重试次数、事务与 catch 范围不变；新增行为只在 Mini 版本/能力前置边界。global=false 的有效响应七维全 false；版本比较为精确 allowlist，无 latest/range fallback。Web/API 普通身份、headerless public guest、P5 危险写、缓存/离线规则与视觉不变。
- 验证：测试先行 capability/headers/policy/guest/escape/App race/错误透传、manual in-flight invalidation 与 release controls 全部先红后绿。API 非 DB 28 files/133 tests；真实 MySQL auth/admin-bind/unbind/password/invite 共 48/48；Mini 29 files/171 tests；contracts/client/release 定向 8 files/36 tests。受控非 Mini 176 files/948 tests 通过，36 files/324 tests 按环境跳过；根宽泛 Vitest 唯一 35 项失败是 Mini 被错误 cwd 启动，正确 Mini cwd 全绿。全仓 typecheck、Lint、generated freshness、任务 Prettier、`git diff --check` 通过；production build 首次 Web 在 Vite 已完成后触发 Windows libuv assertion，原样串行重跑 Web+holiday build 通过。
- Mini 门禁：精确 `72d5dd34` clean worktree production verify 2/2 Worklet、1,286,719 bytes、manifest `6e08894f73dbfe6dc1c24be1b8cef227ef10b51630d97fff11427ad07710a57d`；package main/scheduling/organization 为 835586/335395/115738 bytes，source/determinism/CI dry-run 同 manifest 通过。
- 运行/浏览器验证：`pnpm smoke:browser` 在当前源码 4173 与本地 API 3000 运行；首次未设置 Web dev auth 按门禁停止，随后两次手机 filter 44px 瞬时量测失败，未改产品代码的原样复跑最终通过管理员、成员、访客 vkey 和访问记录全链路，无浏览器错误，截图 `C:\Users\eylin\AppData\Local\Temp\schedule-smoke-mbiazF`。诊断插桩已撤回，smoke 源码无 diff。
- 生产部署与演练：主体 `e25878f0`、Windows content-clean fix `b96b0a63` 和 canonical lock fix `72d5dd34` 均已推送。首次回滚在应用变更前安全暴露 `/var/lock`→`/run/lock` 比较问题并保持 `b96b0a63` 健康；修复后以备份 `15d8de8f-dca7-42ce-a870-0576ab9a4135` 部署 `72d5dd340f65d4b7a08ce869f562fcad28f3dcd3`。两版本 global off/on 往返通过；回滚备份 `0030fc85-3bce-4d81-aa4a-cf344c7351ba` 后成功回到 `0cfdeba6`、能力端点 404、49 migrations/控制面/数据完整，再以前滚备份 `f08f77ea-85a3-4eb1-a514-2e50a3722a45` 恢复 `72d5dd34`。最终 `ecs-verify.sh` 含域名/IP/端口、artifact/control hashes、capability/426、容器/认证/49 migrations 全通过，`.env.production` 仍 UID0/0600。
- 体验版与下一批：从同一 clean worktree 上传 production-profile `0.1.0-p6.20260824.79`，72 个代码文件、zip 455469 bytes、manifest `6e08894f73dbfe6dc1c24be1b8cef227ef10b51630d97fff11427ad07710a57d`；未提审、未正式发布。最终状态 checkpoint 识别消息为 `docs(status): record p6 capability rollback deployment`；该 docs-only release 同步生产后，下一活动批次只做 P6-C 性能预算/遥测/90天访客IP清理与核心 RC，不提前进入 P7。

## 2026-08-24 P6-A 会话、弱网与离线缓存安全壳（当前 checkpoint）

- 范围与基线：P5 已完成并以 `02286282` 对齐 Git、`origin/main` 与 production release。本批只完成 P6 核心 v1 的会话—transport—缓存生命周期，不改 Web/API/contracts/数据库或视觉，不进入 capability/回滚、性能预算、遥测、访客 IP 清理或 P7。用户自有 Mini 配置、workspace、Storybook、`.artifacts/runtime/src` 和工作簿保持未修改。
- 引入点与风险：`git log -S`/`git blame` 确认 session 持久化来自 `e69cfb76`，一次请求 transport 来自 `884512c0`，24h group/month 缓存与任意错误 fallback 来自 `ad4cfb2c`，解绑成功只切页面状态来自 `9b7ffbef`，多月完整表现提交来自 `3fc41610`。旧实现会在 401/403 后读取旧缓存、解绑后保留 token/cache、跨用户复用同 group/month key，且相邻月弱网可拖垮当前月。
- 请求与会话：新增单一 `wx-request-executor`，统一 12s timeout；GET 和带非空 `Idempotency-Key` 的写只对 network/502/503/504 做 200/400ms 两次退避，body/key 只求值一次并保持同一对象；无 key/空 key 写、普通 4xx 和无效 2xx 严格一次。Bearer 401 只在错误码为 `AUTHENTICATION_REQUIRED`/legacy 空体时触发；fresh-code proof 的 `WECHAT_LOGIN_FAILED` 不重登、不重放、不清有效 session。
- 401 与身份一致性：64 个并发及稍后到达的旧 token 401 共用一次 `wx.login` 和一次 login POST，每个原请求最多一次 auth replay。session 使用严格 UTC ISO `expiresAt`、≤31 天、profile/token 结构和内存 generation/tombstone；过期、损坏、link-required、恢复失败或最终 401 会清 session、当前群组和私有缓存。换账号后旧 generation 的 200 也拒绝提交；物理 storage 删除失败时 tombstone 仍阻止旧 token 复活。解绑成功在 identity client 内同步清理全部私有状态。
- 缓存与后台：缓存升级为 owner+group+month 的 v2 key，旧 v1 自动清除；group snapshot 同 owner、24h 且不保存四位 groupCode。完整 mobile 继续在写缓存前剥离；=24h、未来时钟、损坏、group/month 不符均删除；quota 写失败不影响在线结果。只有 network/502/503/504 可离线回退，401/403/invalid 失败关闭；在线离群/403 清 group cache、snapshot 和选中群组。工作台支持同 owner 真离线冷启动，当前月先 ready，邻月随后 best-effort；邻月非暂态错误清当前视图。`onHide/onUnload` 使旧 serial 失效，后续 `onShow` 强制重验权限与数据。
- 语义审计：`wx.request` 继续以宿主成员调用；公开请求不读 token。401 重放只发生在认证 prehandler 已拒绝的请求；P5 发布/补录/手机号等危险写仍使用原冻结 payload 与同 operationId，自动重试不会建立离线队列。Promise catch、409 reload、成功后清 key、非幂等调用次数和 Web 行为不变。主审追加真实回归，修复邻月后台结果错误覆盖 active month 的合并缺陷。
- 测试与验证：测试先行旧实现为 15 failed/5 passed，并产生 64 个预期未处理 401 rejection；实现后 P6 executor/session/cache + 真实工作台 3 文件/26 项、全 Mini 28 文件/155 项通过。受控非 Mini 工作区 169 文件/901 项通过（36 文件/323 项按环境跳过）；全仓 typecheck、Lint、production build、Mini source audit 和任务 `git diff --check` 通过。根 `format:check` 的既有用户文件阻塞沿用 P5，不修改这些文件。
- Mini 门禁：精确 `9e3a966c` clean worktree production verify 通过 2/2 Worklet，1087846 bytes，manifest `c5f68ce84139fe4b4ff4e06048870477f2c92e47fc2361fb3a7a521797238167`；package（main 656634、scheduling 322467、organization 108745）、source/determinism 与官方 CI dry-run 通过。无 Web 核心链路变化，不需要 `pnpm smoke:browser`；`pnpm smoke:check-core` 已确认未涉及核心链路文件。
- checkpoint 与体验版：代码 checkpoint `9e3a966c`（`fix(miniprogram): harden session and offline runtime`）已推送。从同一 clean worktree 使用本地 Node `miniprogram-ci` 上传 production-profile 体验版 `0.1.0-p6.20260824.78`，72 个代码文件、zip 396436 bytes，上传 manifest `947ad9001a9e12d3935abe49ede87102cc9c4e22f8e856e70732ea169863edce`；未提审、未正式发布。
- 生产发布：加密数据库备份 archive `3144fa12-8b3f-4e88-880f-9fe839e4cea4`（54 表、162572 行、76698680 bytes，SHA-256 `d62508415d7856753afbc041a9417a693f630449fc08ce89f7a0660e52c6678c`）后部署 release `9e3a966cb7bc81fe0399494fb719c142471f9c0a`。预热首次 TLS EOF 后恢复；`ecs-verify.sh` 通过健康、产物、域名/IP 隔离、端口、容器、认证依赖和 49 条迁移，公网健康 200，远端临时目录已删除。
- 当前状态与下一批次：P6-A 已完成（含自动运行验证、体验上传与生产发布）→待 P6 核心 RC 实体复核。最终状态 checkpoint 识别消息为 `docs(status): record p6 runtime hardening deployment`；该文档 release 对齐后，下一活动批次只做 P6-B signed clientVersion、`/client-capabilities`、7 维 kill switch、Mini/API 双端守卫与应用回滚脚本/演练。P6 性能量化、遥测/IP 保留和人工 RC 仍未关闭，不提前进入 P7。

## 2026-08-24 P5 群组内手机号单独同意（当前 checkpoint）

- 前置与范围：用户已确认 P4 全部完成并允许后续版本直接提交。本批只关闭 P5 最后一项：手机号同意归入群组设置，不放在排班补录；Web 与 Mini 严格沿用已确认 `--phone-consent-390`/320 医疗蓝灰结构。现有完整号码全部默认隐藏，成员必须在每个群组分别自行同意。
- 引入点：`git log -S`/`git blame` 确认完整成员通讯录测试来自 `6183e9d1`、原始联系人读取来自 `8e42afb8`、管理员确认语义来自 `394b1c87`；calendar raw/confirmed 读取来自 `20407fcf`/`ab250646`；P5 手机号黄金来自 `591ccff6`，Mini 缓存删除完整号码来自 `ad4cfb2c`。旧实现把 `isConfirmed` 当展示门槛，但仍向同群成员和访客日历泄露 raw mobile，且管理员可编辑他人号码。
- 数据与 API：加法迁移 `0049_mobile_phone_consent_evidence` 在现有 contact 行记录 group-scoped fingerprint、说明版本、同意/撤回时间，不自动授权存量。新增 self-only GET/PUT `/groups/:groupId/mobile-phone-consent`；PUT 使用 header/body 一致的 24h 幂等、contact version 冲突保护和精确旧结果重放。grant/revoke/号码变化 invalidation 均写 append-only audit，metadata 只有 fingerprint/版本/时间证据，无原始手机号。
- 隐私与权限：fingerprint 绑定 group+membership+规范化号码；有效状态同时要求当前号码、当前说明 v1、同意时间和未撤回。本人 contacts 仍可读取自己的完整号码；其他成员只有有效同意才可读取；认证 calendar 同样只返回有效同意号码；guest/vkey 永不返回 mobile，已确认 short phone 维持旧行为。非本人提交 mobilePhone 一律 403，管理员仍可维护 shortPhone/isConfirmed，但响应和编辑表单不会读取或提交未授权号码。
- Web/Mini：Web 在所有 active non-guest 的群组管理页首卡加入四态同意卡，跨群 request serial、409 reload 和模糊失败稳定 operationId 均失败关闭；管理员编辑他人资料先用白名单副本剥离 mobile。Mini 新增 `subpackages/organization/pages/group-settings`，入口只在当前非访客群组菜单；复刻 22×22 左侧 checkbox、58px 行、44px 操作和 390/320 compact 边界，无 grid/clamp/media query。页面只接收 masked phone，不缓存号码、同意、请求正文或离线写队列。
- 测试与门禁：测试先行覆盖缺端点/泄露、权限、grant/revoke/replay/different payload/version、号码/说明变化、跨群、guest/inactive、audit 与客户端四态。相关真实 MySQL 43/43；受控非 DB 169 文件/901 项通过（36 文件/323 项按环境跳过）；Mini 26 文件/136 项；共享/Web 定向 10 文件/187 项及 Mini consent 14 项通过。全仓 typecheck、Lint、production build、client generated check、任务文件 Prettier 和 `git diff --check` 通过；根 `format:check` 仅被用户自有 `project.config.json`、既有 `directory-entry-groups.ts` 与 3 个未跟踪 Storybook 静态目录共 14 文件阻断，均未修改。
- Mini production：精确 `59300957` clean worktree verify 通过 2/2 Worklet，944442 bytes，manifest `702b2b274aea9cba46cd94e3fc645001377dab47c6d246a87b8cddae859c5dcb`；source/package/determinism 与官方 CI dry-run 均通过。上传构建 944607 bytes（main 564257、scheduling 288172、organization 92178）；原生微信运行真值仍须体验版实体复核。
- 运行/浏览器验证：`pnpm smoke:browser` 在 4173 当前源码和本地 API 通过管理员、成员、访客 vkey 与访问记录全链路；群组设置 1280/390/320 无横溢且操作区 ≥44px。缺号码 fixture 会临时写入测试号码，实际完成成员授权→管理员 contacts 可见→撤回→立即隐藏，并恢复缺号码/确认原状态；截图目录 `C:\Users\eylin\AppData\Local\Temp\schedule-smoke-gWdKMl`。浏览器无 error，Storybook 检查后已恢复开关和视口。
- checkpoint 与体验版：代码 checkpoint `59300957`（`feat(groups): add scoped mobile phone consent`）已推送。从同一 clean worktree 使用仓库外私钥和本地 Node `miniprogram-ci` 上传 production-profile 体验版 `0.1.0-p5.20260824.77`，72 个代码文件、zip 315651 bytes，上传 manifest `bb8cacff632d15bd0c47e07e01aab9354504d84e419f1f4ff4a70ad13e1ff6fb`；未提审、未正式发布，也未使用微信开发者工具自动化。
- 生产发布：加密数据库备份 archive `933fd73e-96c4-4128-a290-5fba1377a846`（54 表、162570 行、76692396 bytes，SHA-256 `5ff922c9286cc9e19afecf323cd3a6c38f47063f3f51e514e22fc26be6341385`）后部署 release `5930095705437d856d32aa61aaef4319c3dac23d`。API 预热首次 502 后自动恢复；`ecs-verify.sh` 通过产物、域名/IP 隔离、公开端口、容器、无退役认证、无 `@cloudbase` 和 49 条迁移。正式首页/健康 200，新路由未登录 401，4 个证据列存在且证据行 0；远端临时目录已清理。
- 当前状态与下一批次：P5 已完成（含运行验证、体验上传与生产发布）→待实体微信复核。最终状态 checkpoint 识别消息为 `docs(status): record scoped phone consent deployment`；该文档提交按 documentation-only 规则同步为生产 `current-release` 后，下一活动批次只进入 P6 核心 v1 的弱网、后台、权限、缓存、性能、隐私和回滚硬化，不提前进入 P7。

## 2026-08-24 P5 Web 同构原子排班补录（当前 checkpoint）

- 前置与范围：用户已确认 P4 全部完成并解除后续 checkpoint 的提交等待；`c0d57729` 状态提交已以备份 `f4aaf98e-e50e-49f5-8eca-f20d8179be00` 同步为生产 `current-release`。本批只完成已确认 `--backfill-390` 黄金对应的原子补录，不实现手机号同意。`frontend-design` 沿用冻结的 Web 医疗蓝灰结构，没有新增视觉方向。
- 完成范围：新增最多 31 项、严格真实日期、同批 `scheduleRoleId|businessDate` 唯一的 batch contracts；API `POST /groups/:groupId/past-schedules/backfill-batches` 以单事务完成管理员权限、group-scoped 24h 幂等、规范排序指纹、全部 mutation、逐项 `schedule_backfill_completed`、按月统计和一次 workflow self-heal，任一失败整体回滚。同 key/同 payload 重放、异 payload 409，header/body operationId 兼容且必须一致；过期 key 可安全复用，软删 slot 1 会锁定恢复而不触发唯一键 500。
- Web/Mini：client-core compact decoder/endpoint 与 presentation-core staged ViewModel 跨端共用。Web 从逐条 loop 改为一次 batch，使用 MonthGrid `select-date`，保存中锁定 payload 控件；模糊失败保留草稿与 operationId。Mini 新增并注册 `subpackages/scheduling/pages/backfill`，复刻岗位/月、palette、reason、当前配班、待确认列表、全宽七列和最近记录；同日期二次点击取消，今天/未来/相邻月关闭，390/320 使用 Skyline flex/compact class，无 grid/clamp/media-query 依赖，无业务正文缓存或离线写队列。
- 引入点与行为：Web staged/逐条确认和服务端单条创建来自 `561310ce`，trace 回退来自 `0bcc39fa`；幂等基础/重放/竞态分别来自 `7aac9c28`、`3a082d8d`、`31999918`，operation-id 兼容来自 `591ccff6`。旧单条端点和第一 slot 选择语义保留；新 batch 每项写 immutable event 并计入 manualAdjustment，`affectedShiftIds` 使用 assignment ID。同值的新 operation 仍保持旧 version+1；同 key replay 不增写。
- 验证：MySQL 11/11；受控非 DB 工作区 163 文件/881 项，Mini 24 文件/122 项，相关 Web 日历不可变/移动端/原子补录 23/23；全仓 typecheck、Lint、production build 通过。精确代码 checkpoint clean worktree 的 Mini production verify 为 2/2 Worklet、831731 bytes、manifest `fe9dbd2a142d3e24bb0a623013df17fdc7016e7d846d09696568487fcd4d3bd0`，source/package/determinism/CI dry-run 通过。用户自有 `.artifacts/runtime/src` 历史副本需从根测试排除；正确工作目录真实源全绿且未修改这些目录。全量 format check 只被用户自有 `project.config.json`、未提交 Storybook 静态目录和既有 `directory-entry-groups.ts` 阻断；任务文件定向 Prettier 与 `git diff --check` 通过。
- 运行/浏览器验证：`pnpm smoke:browser` 使用 4173 当前源码与本地 API 通过管理员、成员、访客 vkey、访问记录和既有补录 1280/390/320 颜色、44px、无横溢、成员二次点击检查，浏览器无错误，截图目录 `C:\Users\eylin\AppData\Local\Temp\schedule-smoke-so5b9r`。原生微信真值仍须体验版人工复核。
- checkpoint 与体验版：代码 checkpoint `27992c75`（`feat(scheduling): add atomic backfill flow`）已推送。从精确 clean worktree 使用仓库外私钥和本地 Node `miniprogram-ci` 上传 production-profile 体验版 `0.1.0-p5.20260824.76`，69 个平台代码文件，上传 manifest `a3ad2af1ea740ba55c0790e442b7d38db16588a219dd8af2533b9b5f5d352441`；未提审、未正式发布，也未使用微信开发者工具自动化。
- 生产发布：发布前加密数据库备份 archive `34025a7f-fb8e-4853-be54-3f5c55526957`（54 表、162568 行、76691076 bytes，SHA-256 `19b8297cd30d1df8d3c337efeb794c30c6d633490b698cb1d25b8b3c29a4007e`）后部署 release `27992c758d06b1279a350b3721cdcaa2978fefac`。API 预热首个健康请求短暂 502 后自动恢复；`ecs-verify.sh` 通过公网健康、未知 Host/IP 隔离、公开端口、产物哈希、容器、无退役本地认证、无 `@cloudbase` 和 48 条迁移检查，公网 `/api/health` 为 200，远端临时目录已清理。
- 当前状态与下一批次：已完成（含运行验证、体验上传和生产发布）→待实体微信复核。最终状态 checkpoint 识别消息为 `docs(status): record atomic backfill deployment`；该文档提交推送并按 documentation-only 规则同步为生产 `current-release` 后，只实现 P5 群组设置中的手机号单独同意；隐私、权限、撤回/号码变化/跨群重新授权与原生复核门槛通过后才进入 P6。

## 2026-08-24 P5 手排上限、原生编辑与发布版本闭环（已部署）

- 前置确认：用户已明确确认 P4 全部完成，并解除 P5 后续 checkpoint 的提交、推送、体验上传和生产部署等待条件。P5 Web 黄金 `editor/maximum/preview/risk/release/release-blocked/release-withdraw/release-republish/release-delete/backfill/phone-consent` 的 390px 与相关 320px 边界均已确认；本批使用 `frontend-design` 严格跟随冻结的 Web 医疗蓝灰样式，没有建立第二套视觉语言。
- 完成范围：手排模板、预览、应用、生成和草稿覆盖在 contracts/API/service/domain/database/Web/Mini 同源限制为 20 人、30 天、600 逻辑格和最多 30 个首尾日期；迁移 `0048_manual_schedule_limits` 对生产存量先失败关闭，再收紧两个数据库 CHECK。原生 `subpackages/scheduling/pages/manual` 完成模板保存、四层 WXS 7 行矩阵、同格同班种第二次点击取消（无撤销按钮）、显式保存后预览、风险确认和保存草稿。草稿成功后进入与 Web 同构的发布历史页，支持整批发布/覆盖冲突、当前版本撤回、归档重发、草稿/归档删除、版本预览和归档折叠。
- 危险写与兼容：发布、批量发布、撤回和删除统一发送 `Idempotency-Key`；旧 `body.operationId` 暂时兼容，两者并存必须相同。撤回和删除补齐 24 小时服务端幂等结果重放；Web/Mini 在网络结果不明确时保留同一操作号，成功后才清除。Web API 接收者、调用次数、Promise catch 范围和既有冲突流程不变；新增 header 合并不改变 GET/公开请求，删除仍返回空响应。部署脚本在迁移 0048 前先停止旧 API 写入口。
- 引入点与回归：`git log -S`/`git blame` 确认发布历史基线来自 `2834f07e`，发布生命周期来自 `7c783c71`，共享 publication-core 来自 `3be831be`，既往日期撤回修复来自 `b24db461`。完整浏览器 smoke 的旧“个班次”/`.track-event` 断言来自 `1c84fd65`，生产按班种分组与 `.shift-detail-card` 已由 `f723b0db` 替代；P5 还把旧 31 天压力输入收紧为冻结的 30 天上限。本批测试均先在缺少端点/控制器或旧上限下失败，再实现转绿。
- 验证：MySQL 迁移 20/20、手排模板/应用 26/26、关联撤回/重发工作流 60/60 通过；受控真实工作区（排除用户自有 `.artifacts/runtime/src` 副本）157 文件/862 项、Mini 22 文件/113 项通过。Mini production verify 通过（2/2 Worklet，693683 bytes，manifest `bd2fe99ba2dfccbc5aed8104d65f5d69f49b057936418bd96609a174c3cc69e5`），source/package/determinism/CI dry-run 通过；Storybook production build 2720 modules、全仓 build/typecheck/Lint 通过。默认 format check 只被用户自有 `project.config.json`、未提交目录文件和既有 `directory-entry-groups.ts` 格式阻断，任务文件显式 Prettier 与 `git diff --check` 通过，未修改这些无关文件。
- 运行/浏览器验证：`pnpm smoke:browser` 首次因本地 5173 未启动停止；改用 Windows 未保留的 4173 端口并启用仅当前进程的开发认证后，先暴露并修正上述两个过时 P4 smoke 选择器/文案和旧 31 天压力输入。最终管理员、成员、访客 vkey 与访问记录全流程通过，无浏览器错误，截图目录 `C:\Users\eylin\AppData\Local\Temp\schedule-smoke-RkP89G`。原生微信/Android 运行真值仍须体验版人工复核，构建和 Storybook 不替代该结论。
- checkpoint 与发布：代码 checkpoint `591ccff6`（`feat(scheduling): add p5 manual release flow`）已推送。从精确 clean worktree 使用直接 Node 入口上传 production-profile 体验版 `0.1.0-p5.20260824.75`，66 个代码文件，上传 manifest `d0b57bef9b7247c61f177f808256a0d48d6dd75c08b2500afd2b57825fc0f1f8`；未提审、未正式发布。clean worktree 首次经 pnpm 委托时只因依赖安装脚本策略在上传前停止，微信端未产生版本；依赖缓存就绪后同一仓库封装的直接 Node 入口成功。
- 生产发布：迁移前只读预检确认 active 模板周期、成员数、格数和 cell day 四类违规均为 0。加密数据库备份 archive `e00e5848-d6d0-45b8-9318-1a9dcf96e6fa`（54 表、162566 行、76689752 bytes，SHA-256 `cf8a51a4aeeb32172e5886bfd7fc2d07f5db3a0f8a4175eccc605f6b0e43af4e`）后，从精确 clean worktree 构建并部署 release `591ccff6ac29f504cd57578a684552d9856b547e`。API 在迁移 0048 前停止写入，预热首个 TLS 健康请求短暂 EOF 后自动恢复；`ecs-verify.sh` 通过公网健康、未知 Host/IP 隔离、产物哈希、容器、无 `@cloudbase`、无退役本地认证和 48 条迁移检查。公网 `/api/health` 为 200，远端临时目录已清理，当前代码 release 与 `origin/main` 一致。
- 最终状态 checkpoint：`docs(status): record p5 manual release deployment`；该文档提交也须按 documentation-only 规则再次备份、部署并验证，使 Git `HEAD`、`origin/main` 和服务器 `current-release` 精确一致。
- 下一活动批次与停止条件：只实现 P5 剩余两项——Web 同构原子排班补录，以及把手机号同意放入群组设置；完成权限/隐私/幂等/运行验证并形成独立 checkpoint 后，才进入 P6，不提前开展 P7–P10。

## 2026-08-23 P4 实体复核：角落描边与列表定位/控件几何（当前批次）

- 实体反馈与范围：production-profile `.73` 截图确认普通月格选中框厚度正常，但底左/底右角仍被裁细；列表定位到今天后目标卡贴住上裁切线；列表月份控件仍比月/周矮、圆角更小且下阴影不一致。本批只修这 3 组 P4 原生视觉问题，不进入并行 P5。
- 引入点与根因：`git log -S`/`git blame` 定位角落 slot 的双重 `overflow:hidden` 到 `4b33274e`，slot 右/底分隔线和 month-grid `border-top:1px` 到 `733e3af6`，外层选中框与负 offset 到 `6ba2c72c`/`9045dc02`。Skyline `defaultContentBox:true` 下，5/6×54px 行再加 grid 顶边实际为 271/325px，却被 270/324px swiper 裁掉底部 1px；角落 slot 自身裁切又截掉 `right:-1px`。列表 scroll id 仍在卡片本体，`scroll-into-view` 必然把卡片 border-box 对齐顶部，绕过只存在于内容容器开头的 8px；54px/14px list override 来自 `50c6d1ed`。heading 与后绘制的 opaque 分割带同为 z-index 2，后者覆盖 heading 下阴影，分别来自 `4300fbe`/`6ba2c72c`。
- 实现与视觉：星期栏在固定 28px 内用 `border-box` 承载 1px 下分隔线，month-grid 删除额外顶边并改为 `overflow:visible`，角落 slot 删除第二重 overflow；选中框仍统一 2px，不做 DPR 相关的 3px 补粗，月卡保持唯一 18px 外框裁切和精确 270/324px 内容高。列表每个日期改为带 `padding-top:8px` 的 `list-day-slot`，滚动 id 移到 slot，卡片 margin 清零，因此默认、卡间和定位后均为同一 8px，末卡无尾距。列表 heading 改为月/周一致的 62px、`4px 6px`、18px 大圆角和 card shadow；heading z-index 3、分割带 2、swiper 1，完整保留下阴影且不增加装饰。`frontend-design` 审查继续使用医疗蓝灰令牌、系统字体和原密度。
- 语义审计：列表 target 字符串、定位日期、滚动调用次数和 `scroll-into-view` 语义不变，只把 target 从 card 移到其 8px 前置槽；卡片点击/电话事件仍绑定原节点。月格 5/6 周、单元数据、圆角状态、选中日期、circular 槽、横纵 240ms、缓存/预取、request serial、Promise catch、只读 GET 与业务写入次数不变。样式改动不触及 P5 子包或 client-core。
- 测试与验证：新增月格几何不得多 1px/角落不得二次裁切、slot 定位 8px、卡片零 margin，以及 list heading 62px/large radius/z3/单层 shadow 契约；`.73` 旧实现定向 30 项中 3 项失败，修复后 30/30。精确 `11a1f462` + 本轮 5 文件隔离 worktree 中 Mini 18 文件/95 项、typecheck、production verify（2/2 Worklet，414316 bytes，manifest `9059abbe992308cadcb5645c19e4c63ace4b615975694ed17eb1199f85e98547`）、CI dry-run、`pnpm smoke:check-core`、任务文件 ESLint/Prettier 与 `git diff --check` 通过；未触及 Web 核心链路，无需完整浏览器 smoke。主工作区并行 P5/Storybook/迁移/构建配置未修改、未暂存。
- 发布与停止条件：代码 checkpoint `0d8e385d`（`fix(miniprogram): align calendar edge and list controls`）已推送；精确 clean worktree 18 文件/95 项、typecheck、production verify（2/2 Worklet，417647 bytes，manifest `40eda6083bc9e919aadb22c41867e51c808d74528ee2cb6bac934fdb82a69fb3`）和 CI dry-run 通过。production-profile `.74` 上传成功（63 文件，manifest `bf3241f75a2430e4b0526029d213cefa10272865bbbd246ffe7050ef71e0f156`），未提审/正式发布。生产备份 archive `4de6838a-93c4-4e19-be56-25be1f1eda85`（54 表、162564 行、76688428 bytes，SHA-256 `f0a58e099029185537ee68b49bbe3ab4b530e484eb8c057e7198ceb75002ffbb`）后部署 release `0d8e385def2e8d1f8ec787cd690aa9df188b569c`；仅 Mini/文档变化，ECS 复用哈希一致的 Web/API/迁移制品。预热首次 502 后恢复，`ecs-verify.sh` 全项通过，公网健康 200，远端临时目录已清理。当前为已完成（含运行验证、体验上传和生产发布）→待实体微信只复核本轮 4 点；最终状态 checkpoint `docs(status): record calendar edge deployment` 后暂停，不进入 P5。

## 2026-08-23 P4 实体复核：取消月历回中与列表真实滚动边界（当前批次）

- 实体证据与范围：用户在 production-profile `.71` 的 22:23–22:24 截图中确认 5 项仍未解决：底左角月格蓝框右/底边仍被裁细；列表首卡日期标题被上边界裁掉、底部仍有空带、控件阴影仍突兀；换月仍反跳/回弹。本批只按截图修复月历原生槽位、列表真实滚动内容和角落描边 3 个任务，不进入 P5。
- 引入点与否定结论：`git log -S`/`git blame` 确认 `.71` 的三阶段桥接、`relative` key、scroll-view padding 和外层 slot shadow 均来自 `6ba2c72c`；实体结果证明微信原生 swiper 即使 `duration=0`，任何 0/2→1 的属性回写仍可表现为回弹，且 scroll-view 宿主 padding 不等于可滚走内容。`9fdf659` 的分割带自定义 shadow 与 heading card shadow 仍叠加，最后一张卡的通用 8px margin 和宿主 16px bottom padding 共同形成底部空带。月格伪元素以含右/底 grid border 的 padding box 定位，`right/bottom:0` 仍比真实单元边缘缩进 1px。用户补充的 22:45 初始截图确认首卡标题/初始位置本来正确，之前裁掉标题的截图是已滚动状态，不能归因于遗留锚点。
- 实现：月 swiper 改为 `circular=true` 的稳定物理槽环，逻辑前/月/后按当前槽映射到 0/1/2；完成一次切换只替换当前槽内容与屏幕外相邻槽，绝不再写 `swiperCurrent=1` 或 `swiperDuration=0`。快速按钮按物理槽循环排队，手势、定位和五/六行高度继续在同一 240ms 动画确定目标。列表新增真实 `.list-panel-content`，8px 置于其可滚动顶部，保留既有滚动位置语义；最后一张卡 margin-bottom 和 scroll 宿主 bottom padding 均清零；分割带显式 `box-shadow:none`，heading 只保留现有 card shadow。选中框改为 2px 实体 border，并以 `right/bottom:-1px` 覆盖内部 grid border；最右列/底行回到 0，边角圆角仍继承且全部在裁切框内绘制。
- 语义审计：明确变化仅为取消物理回中、把既有 8px 变成可随内容滚走的间距、列表末卡贴底和蓝框覆盖 grid border；不主动清空 `listScrollTarget`。目标月份、选中日期、定位到今天、月高、队列净方向、`this` 接收者、request serial、缓存/预取、离线/错误 catch、空值与只读 GET/业务写入次数不变；同一已激活视图再次点击直接返回，避免把存活月组件的物理槽错误重置。
- 测试与验证：新的 circular 槽、禁止 finish 写 current/duration、2→0 环形连点、逻辑月→物理槽映射、真实列表内容 padding、末卡零尾距、单层阴影和边界 border 契约在 `.71` 旧实现先 10 项失败。修复后定向 30/30；精确 `e1d4c54` + 当前 10 个 Mini 文件隔离 worktree 中 18 文件/95 项、typecheck、production verify（2/2 Worklet，413828 bytes，manifest `bb67cc585828b1db8b4d5b5c4a2b8d698fe7172057df0666eb09aba8e9c5dc0b`）、CI dry-run、`pnpm smoke:check-core`、任务文件 ESLint/Prettier 与 `git diff --check` 通过；主工作区 typecheck 仅被并行 P5 扩展 `WxJsonRequestOptions` 的 DELETE/PUT 类型差异阻断，受控隔离基线全绿。并行 P5、Storybook、迁移和构建配置未修改、未暂存。
- 发布与停止条件：代码 checkpoint `9045dc02`（`fix(miniprogram): remove native calendar recentering`）与截图纠正 checkpoint `4761c31f`（`fix(miniprogram): preserve list scroll state`）均已推送。`.72` 虽上传成功但未作为本轮最终体验版；精确 `4761c31f` worktree 18 文件/95 项、typecheck、production verify（2/2 Worklet，417342 bytes，manifest `b74c809eeda554367987abfbe052526dc89ac988ec672f0b9b0418db2015295c`）和 CI dry-run 通过，production-profile `.73` 上传成功（63 文件，manifest `e71bf2064a15fbb87b27e69994fee6bc8e54763ed93357f77d9e981a73c2f302`），未提审/正式发布；首次上传被微信按临时 IPv6 未入白名单拒绝且未形成版本，保持同 commit/版本重传后成功。生产备份 archive `72616c10-7478-48ab-8a07-af09fdf8e21f`（54 表、162562 行、76687108 bytes，SHA-256 `a3e8b5fa19e020b56a5fc43e638663d1944f670b97dcb40831bcb60beb6a7d8f`）后部署 release `4761c31f20232b68857ffdb9b458600071c65943`；首次 SSH 只在连接阶段超时，未执行备份/部署，重连后才继续。预热首次 502 后恢复，`ecs-verify.sh` 全项通过，公网健康 200，远端临时目录已清理。当前为已完成（含运行验证、体验上传和生产发布）→待实体微信只复核上述 5 项；最终状态 checkpoint `docs(status): record circular calendar deployment` 后暂停，不进入 P5。

## 2026-08-23 P4 月历无反跳回中与三视图细节修复（当前批次）

- 用户反馈与范围：实体微信中换月再次出现“滑到目标月后反跳/闪回”，周视图全日班混显“全天/全”，列表月份控件阴影与月/周突兀，首张日期卡贴住裁切线且底部仍未贴底栏；月历角落格选中框仍被裁细，切换周/列表还会重播定位动画。本批只完成这 3 组 P4 调度/展示任务，不进入并行 P5。
- 引入点与根因：`git log -S`/`git blame` 定位到 `9fdf659` 在 swiper 仍停于 0/2 时直接替换完整前中后三月，活动边缘槽会短暂变成目标月的再下一/上一月；同提交把列表首卡 padding 改成 0 并叠加独立上阴影。全日班缩写由 `50c6d1ed` 原样透传，而默认生产班种来自 `04c7da36` 的“全天”，历史/自定义数据又存在“全”。共享定位动画布尔值来自 `9cdd0a8`，视图切换未清零。月格内层描边虽在 `9fdf659` 改为零 inset，仍可能被外层 grid border 与圆角裁切覆盖。
- 实现与语义：换月改为“活动边缘槽与中央槽先镜像同一目标月 → `duration=0` 回中 → 中央画面不变时补齐真实两侧面板 → 再消费快速点击队列”，三个 swiper 槽以稳定 `relative` 标识复用；是否续播延后到回中回调读取，覆盖回中间隙内的极快点击。全日班仅在周/列表紧凑徽标统一为“全”，非全日班继续复用 Web 的 2 字截断，不修改班种配置、详情或 API。视图切换显式清零定位动效。列表首卡在内层 scroll-view 中恢复可随内容滚走的 8px 顶间距，切换控件统一使用 `--ui-shadow-card`，列表视口按底栏实际 `61px + safe-area` 下探。选中框移到外层 `.calendar-cell-slot` 的最高绘制层并全部向内画 2px，角落半径继承且不会被单元格边界盖细。
- 语义等价审计：月份/选中日/五六行目标高度在横滑开始时仍一次确定并以相同 240ms 曲线运动；页面只在目标 period 已提交后回中，request serial、预取/缓存、离线 catch、空值 fallback、只读 GET 与业务写入次数不变。明确变化只有无反跳的三阶段呈现、极快点击不丢、全日紧凑文案归一、列表几何/阴影、角落描边层级和视图切换不重播定位动画。
- 测试与验证：新增回中桥接/稳定槽/回中间隙快速点击、混合全日缩写、定位动画重置、列表阴影/滚动间距/底界和外层选中框回归；旧实现先出现 9 项失败，新增极短竞态用例亦先失败。修复后定向 30/30；精确 `e1d4c54` + 本轮 10 文件隔离 worktree 中 Mini 18 文件/95 项、typecheck、production verify（2/2 Worklet，411296 bytes，manifest `e865cbaa55a3c0a77569faf70aec55d34133ebe6c202a3af0cd0a48aad4ba5e4`）、CI dry-run、任务文件 ESLint/Prettier、`git diff --check` 与 `pnpm smoke:check-core` 通过；未触及 Web 核心链路，无需完整浏览器 smoke。一次定向测试误扫既有 `.artifacts/ecs-runner-deploy-*` 不完整副本产生 3 项路径噪声，显式排除后真实源全绿；一次隔离 `pnpm` 因依赖状态检查拟重建 junction 而在执行测试前主动终止，随后直接使用已链接依赖完成全部门禁，未改依赖目录。并行 P5/Storybook/迁移/构建配置文件未修改、未暂存。
- 发布与停止条件：代码 checkpoint `6ba2c72c`（`fix(miniprogram): eliminate calendar recenter regressions`）已推送；精确干净 worktree 18 文件/95 项与 typecheck 通过，production verify 为 414813 bytes，上传 production-profile 体验版 `0.1.0-p4.20260823.71`，63 个平台代码文件，manifest `2f4b9ccf301890e812c4c6fefc8e8a92e54dfa951895d02b146303c08e9f41a8`，未提审/正式发布。生产备份 archive `b94c8363-132e-4d2f-b415-d94863832e5d`（54 表、162561 行、76686444 bytes，SHA-256 `9f2b1384b10abcb702a80cb4b7109dc4f9a00b9fb31a0dea08a4430ffc28eb95`）后部署 release `6ba2c72cccb96c55a2831bd9d8a40ab854e05ecb`；仅 Mini/文档变化，ECS 复用哈希一致的 Web/API/迁移不可变产物。预热首次 502 后恢复，`ecs-verify.sh` 全项通过，公网健康 200，远端临时目录已清理。当前为已完成（含运行验证、体验上传和生产发布）→待实体微信复核；最终状态 checkpoint 识别消息 `docs(status): record calendar recenter deployment`，下一批仅处理这 7 项的实体复核反馈并暂停，不进入 P5。

## 2026-08-23 P4 列表视口层级、月格描边与快速切换修复（当前批次）

- 用户反馈与范围：列表日期卡的底部裁切边界没有贴住底栏，顶部裁切线错误地贴在左右切换控件下沿且未通栏，切换控件缺少尤其是上沿的阴影；月格蓝色选中框与单元格有 1px 空隙，边角格还需避免描边被裁细；快速连续切月/周会丢点击或闪回原月份。本批只修这 3 组 P4 视觉/调度回归，不进入并行 P5。
- 引入点与根因：`git log -S`/`git blame` 定位列表固定高度/底部 8px 留白到 `50c6d1ed`，控件 `box-shadow:none` 到 `d9296df`，紧贴控件下沿的 1px 边界到 `4300fbe`；月格 `inset:1px + border` 和 `panels` 任意变化即回中的 observer 到 `3fc41610`，过渡期直接丢弃月按钮来自 `53b5c74`，周/列表无排队且每次完成都重新进入 `loadWorkbench→listGroups` 来自 `733e3af6`/`3fc41610`。因此后台相邻月数据到达时可在下一次动画中途强制 swiper 回中，形成“闪一下又是原月份”。
- 视觉实现与审查：列表模式底部 padding 归零，使 swiper 下裁切面与固定底栏上边界相接；控件下保留 8px 呼吸带，但把 1px 裁切线放到呼吸带下沿，并以 `margin:0 -12px` 延伸到屏幕左右边界。列表切换卡恢复卡片阴影并额外提供轻量上沿阴影，swiper 自身继续负责裁切。月格选中态改为与 Web `MonthGrid` 相同的 `inset 0 0 0 2px` 内阴影，零间隙且边界格全部向内绘制，继承底角半径，不会被月卡裁细。`frontend-design` 审查沿用现有蓝灰令牌；生产 Web 390px 浏览器页因 webview attach 超时未建立，已恢复临时视口，最终以冻结 Web 源码和用户实体截图完成静态截图批评。
- 调度实现与语义：月组件删除“任何 panels 更新都回中”的隐式 observer，改由父页提交目标 period 后显式 `finishPeriodShift`；过渡期同向/反向点击按净方向排队并在无动画回中后继续。周/列表增加 active/commit/queue 三态，重复 finish 不会二次提交，连续点击不丢失。队列清空后才调用 `refreshWorkbenchWindow`，已在线预取的五个月窗口直接返回，不再请求群组或重复 `setData`；只读取缺失边缘月。`readMonths` 只构造局部快照，request serial 与群组仍有效后才原子替换资源，过期请求不能删除/覆盖当前窗口。业务月份、选中日、五/六行高度、定位目标、缓存 fallback、错误文案、Promise catch、GET 内容、无写入语义均保持；明确变化仅为快速输入被保留、无效重复读取被移除、后台结果不再有权打断动画。
- 测试与验证：列表全宽裁切/阴影/底栏贴合、月格无缝内描边、显式回中、月/周快速队列、重复 finish 和只提交有效读取等回归在 `940358e` 上失败，修复后定向 27/27。精确 `940358e` + 本轮 6 文件的隔离 worktree 中 Mini 18 文件/92 项、typecheck、production verify（2/2 Worklet，408847 bytes，manifest `85256aed45eea7d152158c5ad36b4b795799b5ba64185df03a27bec358280097`）、CI dry-run、任务文件 ESLint/Prettier、`git diff --check` 与 `pnpm smoke:check-core` 通过；未触及 Web 核心链路，无需完整浏览器 smoke。主工作区并行 P5、Storybook、构建配置和迁移文件未修改、未暂存。
- 发布与停止条件：代码 checkpoint `9fdf659`（`fix(miniprogram): stabilize calendar viewport and rapid shifts`）已推送；精确干净 worktree production verify 为 411118 bytes，上传 production-profile 体验版 `0.1.0-p4.20260823.70`，63 个平台代码文件，manifest `7d3c6e3bb89f079fc1a8ba5e9e0481fefbe9c4e043ca5608f1307114f24aad05`，未审核/正式发布。首次经本机代理上传被微信以当前 IPv6 未入白名单拒绝且未形成版本；移除代理后使用已登记 IPv4 `103.54.154.21` 幂等重传成功。生产备份 archive `57285f39-d961-4169-a440-2532545a7ac6`（54 表、162559 行、76685124 bytes，SHA-256 `fd243107a5f5f43d8d4e08056dfdf6b03d9b4c0a11253e9e9665fce510b881eb`）后部署 release `9fdf659ac4413423da4b4b4f4e4fadd8f3509da5`；仅 Mini/文档变化，ECS 复用哈希一致的 Web/API/迁移制品。预热首次 502 后恢复，`ecs-verify.sh` 全项通过，远端临时目录已清理。当前为已完成（含运行验证、体验上传和生产发布）→待实体微信复核；最终状态 checkpoint 识别消息 `docs(status): record calendar viewport deployment`，同步生产后暂停，不进入 P5。

## 2026-08-23 P4 Mini 表现层债务与包体审计（当前批次）

- 用户要求：再次检查类似“页面层与 ViewModel 各保留一套文案/格式/状态”的遗留实现，删除可证明无用的屎山代码，减少加载渲染与包体。本批只审计已经进入 production Mini 主包的表现层和构建 manifest，不碰并行 P5 手排/contracts/迁移，不进入新功能。
- 审计与引入点：对非测试 `src` 的日期/月/周/时间格式器、页面 `setData→ViewModel`、WXML 类名可达性和 production manifest 逐项核对。日期格式已在 `4300fbe` 收口，剩余同类问题只有 `ad4cfb2c` 同时在页面/ViewModel 建立的 `formatMonthLabel`。工作台 WXSS 多轮追加后仍含 30 余个模板不可达的旧页头、旧筛选、旧列表、旧手绘图标选择器，来源跨 `ad4cfb2c`/`9cdd0a8`/`50c6d1ed`/`d9296df`；数据加载完成及视图切换仍由旧调用点分两次提交表现层。P1 诊断/矩阵资源在 manifest 中约 85940 bytes，但仍被人工测试手册和并行 P5 矩阵测试引用，明确保留而非误删。
- 实现与语义：`formatMonthLabel` 与日期格式一样只由 ViewModel 导出，页面删除副本。清除所有已证明无 WXML/动态状态引用的旧 CSS，并从组合选择器中移除不可达分支；现用筛选 sheet、群组菜单、SVG 分层动效、状态变体和媒体规则保留。`loadWorkbench` 将最终 ViewPatch、筛选摘要、离线/ready 状态合并为一次 `setData`；月/周/列表视图切换也在同一 patch 中提交目标周和完整 ViewModel。API、缓存、request serial、Promise catch、筛选值、动画接收者和业务写入次数不变。
- 测试与验证：唯一月份格式/不可达 CSS/43KB 源码预算和单次表现层提交 2 项契约在 `aa17776` 上失败，修复后定向 18/18。隔离 `aa17776` + 本轮 4 文件的 Mini 18 文件/91 项、typecheck、production verify（2/2 Worklet，405716 bytes，manifest `7f3e872ac6136de930bdf44dff5a35f60103c05cc752c3af94d5e037fe484c59`）、CI dry-run、任务文件 ESLint/Prettier、`git diff --check` 与 `pnpm smoke:check-core` 通过；未改 Web 核心链路，无需完整浏览器 smoke。编译后工作台 WXSS 从 50258 降至 39891 bytes（-10367，-20.6%），production package 从 412558 降至 405716 bytes（-6842，-1.66%）。主工作区并行文件未修改、未暂存。
- 发布与停止条件：代码 checkpoint `9a436e8`（`refactor(miniprogram): remove legacy presentation debt`）已推送；从精确干净 worktree 上传 production-profile 体验版 `0.1.0-p4.20260823.69`，63 个平台代码文件，manifest `b035de67989a542f4ff03d99617bf44c76ffc6e2799fad1bbf74d085361a8dc9`，未审核/正式发布。生产备份 archive `c311d738-cd8f-4fc2-bec6-301317d54397`（54 表、162557 行、76683800 bytes，SHA-256 `69d60f211e1506e0d629eeaad31f4cb5976507088193be13ea9e1cb48291d07b`）后部署 release `9a436e8b8524c5bfef3f0c2d8ba2040d170f8313`；本 checkpoint 仅改 Mini/文档，ECS 复用与上一 release 哈希一致的 Web/API/迁移不可变产物。预热首次 502 后恢复，`ecs-verify.sh` 全项通过，远端临时目录已清理。当前为已完成（含运行验证、体验上传和生产发布）→待实体微信复核；最终状态 checkpoint 识别消息 `docs(status): record mini presentation debt deployment`，同步生产后暂停，不补独立 staging、不进入 P5。

## 2026-08-23 P4 日期详情、列表裁切边界与定位预调度修复（当前批次）

- 用户反馈：点击月/周/列表日期后，下方详情日期会从带空格和“· 星期”的旧格式快速闪成 Web 的紧凑格式；列表月份控件与日期卡之间缺少可见上滑边界；定位到今天时目标卡片先到位，日期格内容和五/六行高度随后才补上。本批只修这 3 项 P4 视觉/调度回归，不进入 P5。
- 引入点：`git log -S`/`git blame` 确认页面层旧 `formatDateLabel` 来自 `ad4cfb2c`，ViewModel 在 `d9296df` 改为 Web 口径后两者并存；列表 8px heading 外间距来自 `d9296df`，把真实 swiper 裁切点留成无形门槛；定位动画/finish 后再重建目标 ViewModel 来自 `733e3af6`，`3fc41610` 的五个月资源淘汰又会删除今天月份，导致定位时才重新读取。
- 实现与语义：ViewModel 导出唯一 `formatDateLabel`，页面删除遗留格式器，三种日期选择共用 `selectBusinessDate` 并在一次 `setData` 中同步标签、详情和选择态。列表 heading 外间距归零，新增 1px `list-scroll-boundary` 与原底边重叠，日期卡保留内部 8px 起始空间并在滚动时沿可见线裁切。请求月集合始终保留 `initialMonth`，定位前把今天的中央月/周/列表面板复制到即将滑入的 0/2 面板；月视图同时把目标行高传给横纵同步动画。finish 时目标 period 与完整 ViewPatch 原子提交并立即执行待定滚动，网络刷新留在后台。
- 边界审计：普通换月、周/list swipe、筛选、request serial、Promise catch、离线缓存和业务写入不变；浏览远离今天时内存/只读 GET 窗口最多多保留一个今天月份，首次读取后复用现有 24h 缓存且定位本身不再触发目标月份读取。日期点击从两次 UI patch 明确收敛为一次，目标日期和详情调用次数不变。
- 测试与验证：目标高度覆盖、单一日期格式、列表可见边界和定位预调度 4 项断言在 `ce4057b` 上失败，修复后定向 24/24。隔离 `ce4057b` + 本轮 7 文件的 Mini 18 文件/89 项、typecheck、production verify（2/2 Worklet，412558 bytes，manifest `a116e225eb4ed78ff80245228d454ab5f966e23d1f80f95d2d8579d9c894a822`）、CI dry-run、任务文件 ESLint/Prettier、`git diff --check` 与 `pnpm smoke:check-core` 通过；未改 Web 核心链路，无需完整浏览器 smoke。一次从仓库根误跑的定向命令因 `process.cwd()` 和既有 `.artifacts` 副本产生 13 项路径噪声，正确 Mini 目录与隔离基线随后全绿且未改这些目录。主工作区并行手排/contracts 改动保持未修改、未暂存。
- 发布与停止条件：代码 checkpoint `4300fbe`（`fix(miniprogram): stabilize date selection and locate data`）已推送；精确干净 worktree 上传 production-profile 体验版 `0.1.0-p4.20260823.68`，63 个平台代码文件，manifest `a125b79350f561546e13a96098b429f839d09b399795402b9ddb764f58e77f0a`，未审核/正式发布。首次同版本上传在 30 秒边界未返回回执且进程已退出，随后以同 commit/版本幂等覆盖并取得成功回执。生产备份 archive `b1c2dd02-0ec3-4bf9-9b5a-05bc35ad37ad`（54 表、162555 行、76682476 bytes，SHA-256 `a3d541646f9ef2a4776e281f94e3aa355c2ea743eb1e3f4e77e4d9b7966ab071`）后部署 release `4300fbe711de9229951265ef714d86308cf81621`；仅 Mini/文档变化，ECS 复用当前哈希一致的 Web/API/迁移不可变产物。预热首次 502 后恢复，`ecs-verify.sh` 全项通过，远端临时目录已清理。当前为已完成（含运行验证、体验上传和生产发布）→待实体微信复核三项反馈；最终状态 checkpoint 识别消息 `docs(status): record p4 date and locate deployment`，同步生产后暂停，不补独立 staging、不进入 P5。

## 2026-08-23 P4 月历横向与高度同步过渡修复（当前批次）

- 用户反馈：体验版 `.66` 已消除底边抖动，但五/六行高度要等横向换月结束后才变化，两个动作视觉割裂。本批只把目标月份行数判断提前并与换月动画同步，不改变 8px 节奏或其他 P4 行为，不进入 P5。
- 引入点与方案：`git log -S`/`git blame` 确认 `3ed0e31` 为消除连续 `dx` 反向改判而删除滑动期高度通道；更早的 `3fc41610` 则因每个 `bindtransition.dx` 都能重算左右目标而产生错误增减。本轮不恢复连续位移判断，改用早于 `animationfinish`、且已明确目标 index 的原生 `swiper change` 作为手势单一判定点；按钮在同一个 `setData` 中写入目标 index 和目标高度。
- 实现与语义：重新提供三个已预取面板的 270/324px 高度，`_monthHeightTargetIndex` 在一次换月中只允许从 `undefined` 锁到 0 或 2，重复 change、快速重复按钮和无动画回中均不能改判。高度和横向 swiper 统一为 240ms ease-out cubic；完成后只以 `duration=0` 回中并确认最终中央高度。取消的手势仍回到中央高度；月份目标、`monthchange` 次数、三面板数据、GET/缓存、Promise/错误路径和业务写入不变。
- 测试与验证：目标提交事件、方向单次锁定、回中时序、按钮同批次更新和模板契约在 `27d767d` 上 5 项失败，修复后定向 21/21。隔离 worktree 中 Mini 18 文件/86 项、typecheck、production verify（2/2 Worklet，412303 bytes，manifest `f77c03e602f16c2811c9fbb95c7964c8a0238d5e16baf4f25eb304bc148c3420`）、CI dry-run、任务文件 ESLint/Prettier、`git diff --check` 与 `pnpm smoke:check-core` 通过；未改 Web 核心链路，无需完整浏览器 smoke。主工作区 typecheck/核心门禁受并行用户自有手排 contracts 改动阻断，故验证在精确 `27d767d` + 本轮 7 文件的隔离 worktree 完成，未修改或暂存并行文件。
- 发布与停止条件：代码 checkpoint `53b5c74`（`fix(miniprogram): synchronize month height transition`）已推送；精确干净 worktree 上传 production-profile 体验版 `0.1.0-p4.20260823.67`，63 个平台代码文件，manifest `6506f55ef6ffe00d58219a899316e9baad5a18a8ddf76d4fbee4ea5f4cac33b3`，未审核/正式发布。生产备份 archive `06330b7b-6d49-4ce8-8587-0731ec9840f5`（54 表、162553 行、76681156 bytes，SHA-256 `749e2927195c5aa9c79a6ac8e7ba12f401984ccaabd9b715aa9d9bc6703877dc`）后部署 release `53b5c742f211b067c14ffc205c019b43271cb185`；仅 Mini/文档变化，ECS 复用当前哈希一致的 Web/API/迁移不可变产物。预热首次 502 后恢复，`ecs-verify.sh` 全项通过，远端临时目录已清理。当前为已完成（含运行验证、体验上传和生产发布）→待实体微信复核横纵动画同步；最终状态 checkpoint 识别消息 `docs(status): record synchronized month transition deployment`，同步生产后暂停，不补独立 staging、不进入 P5。

## 2026-08-23 P4 8px 节奏与月历单次定高修复（当前批次）

- 用户反馈与中间结论：月/周/列表首卡已按要求从 14px 统一为 8px；第一轮仅屏蔽程序化换月和无动画回中的 transition 噪声，checkpoint `206a16e`、production-profile 体验版 `.65`（manifest `a1dde130aa45d0330746035b06182404a80f13b6ed6ecc7941de59fa20aff412`）及生产 release `206a16eaebea0adea0556a6ca3cc6de5e31ebe52` 均已发布。实体微信复核证明五/六行切换的底边仍会短暂闪动，该 checkpoint 只是未完成的中间修复。
- 引入点与根因：`git log -S`/`git blame` 再次确认 `3fc41610` 同时引入 `bindtransition.dx`、`panelHeights` 和独立 `viewportHeight`，使横向 swiper 动画期间提前裁切/扩展底行；即使过滤部分事件，真实拖动仍会与 height animation 并发。`3fc41610^` 的原行为只绑定最终中央月份 `gridHeight`，不存在滑动期间的第二条改高通道。
- 最终实现与语义：保留共享 8px anchor。完整删除 `bindtransition`、`panelHeights`、`viewportHeight` 及程序化/回中时的高度写入；按钮和手势只改变横向 `swiperCurrent`，月份提交后由父页按最终中央面板的 `cells.length / 7 * 54` 更新一次 `gridHeight`，高度过渡恢复改版前的 180ms ease-out。`_monthShiftPending` 仍保持到回中和 duration 恢复均完成，目标月份、`monthchange` 次数、三面板回中、GET/缓存、Promise/错误路径不变。
- 测试与验证：新的“禁止滑动期间改高”结构、回中 patch 和程序化 patch 断言在 `206a16e` 上 4 项失败，修复后定向 20/20、受控 Mini 18 文件/85 项通过；typecheck、production verify（2/2 Worklet，404393 bytes，manifest `0a9ee5e807606fb6341e781f1e2af72c48d57d5d705d854d7a3cfe8f7ed84773`）、CI dry-run、任务文件 ESLint/Prettier、`git diff --check` 和 `pnpm smoke:check-core` 通过。首次红灯命令仍误扫用户既有 `.artifacts/ecs-runner-deploy-*` 副本并额外出现 3 项路径失败，后续显式排除且未修改该目录。
- 发布与当前状态：中间版生产备份 archive `3d24a9ae-82b5-4c7c-9352-8fdf6b1d4f07` 后部署 `206a16e`。最终代码 checkpoint `3ed0e31`（`fix(miniprogram): remove eager month resizing`）已推送；从精确干净 worktree 上传 production-profile 体验版 `0.1.0-p4.20260823.66`，63 个平台代码文件，manifest `e511d2d3f5cc73ced327c0d81bc97f990a7ecb81e138ae7fd5e9904f4ec08ebb`，未审核/正式发布。生产备份 archive `8b778460-7ecc-4999-b2a6-fa71a4ff5150`（54 表、162551 行、76679832 bytes，SHA-256 `90fc0f293818ebeba166d9fbf20060ca875345e9471025cb79400fb456d6bccc`）后部署 release `3ed0e31beaaf5afbf864cd63b668067aaf7fcfac`；本 checkpoint 仅改 Mini/文档，ECS 复用与 `206a16e` 哈希一致的 Web/API/迁移不可变产物并写入新 release manifest。预热首次 502 后自动恢复，`ecs-verify.sh` 全项通过，两个远端临时目录已清理。当前为已完成（含运行验证、体验上传和生产发布）→待用户实体微信只复核五/六行换月底边；最终状态 checkpoint 识别消息 `docs(status): record single-height month deployment`，部署后暂停，不进入 P5。

## 2026-08-23 P4 三视图卡片节奏与事件图标修复（当前批次）

- 用户反馈：实体微信中，月/周/列表首卡与“月/周/列表 + 筛选”控制区的垂直距离不一致；选中日期详情的“事件记录”图标显示异常。本批只修这 2 项 P4 视觉回归，不改变三视图按内容自然生成的内部高度，不进入 P5。
- 引入点与视觉审查：`git log -S`/`git blame` 确认周/列表 12px 卡片 margin 来自 `ad4cfb2c`，月视图独立 6px anchor padding 来自 `50c6d1ed`，13px 圆形加伪元素的事件图标来自 `d9296df`。生产 Web 390×844 实测控制区底边为 144px，月卡、周卡、列表首层均从 158px 开始，三者间距统一为 14px；Web `HistoryIcon` 为标准 16×16、`viewBox="0 0 24 24"` 的 SVG 路径。
- 实现与语义：以共享 `.workbench-view-anchor` 统一 14px `padding-top` 并使用 `border-box`，移除月视图特例和周/列表各自 margin；列表的 flex/内层 `scroll-view` 仍在扣除间距后的内容盒内工作。事件入口改为与生产 Web 同路径的 `web-history.svg`，颜色固定为同源次要文字色 `#5e6a78`，删除容易在原生渲染中错位的伪元素拼图。日历 GET、缓存、筛选、swiper、定位、详情事件入口和调用次数均未变。
- 测试与验证：统一节奏和 History SVG 断言在旧实现 2/2 失败，修复后定向 13/13、受控 Mini 18 文件/84 项通过；Mini typecheck、production verify（2/2 Worklet，405458 bytes，manifest `108f9d0126dd21419839843469ef9e437fb197f727f6f1ea8d9ae30c7162b2b6`）及 CI dry-run 通过。运行/浏览器验证：生产 Web 390px 逐项切换月/周/列表并测得统一 14px，事件 SVG 实测 16×16；未触发业务写入且浏览器视口已恢复。未改 Web 核心链路，无需完整 `pnpm smoke:browser`。
- 当前状态：已完成（含运行验证、体验上传和生产发布）→待用户实体微信复核。代码 checkpoint `48f2dc4`（`fix(miniprogram): unify p4 card rhythm and event icon`）已推送；production-profile 体验版 `0.1.0-p4.20260823.64` 上传成功，63 个平台代码文件，上传 manifest `d0e29cdd27c41350caef2d17aaa863e4eab284cc20f2e8ffa3fbc34c4afe1fe2`，未审核/正式发布。生产备份 archive `b5b27a9a-a5e8-48a7-93f3-75656c4e460a`（54 表、162548 行、76677848 bytes，SHA-256 `5cf166bd6bf1d0203d94f196474f2cc0d69027cdc3bcb1d8ddbc54bae63a4ad9`）后部署 release `48f2dc47101eb17ae36343c1374379339d17225a`；预热首次 502 后自动恢复，`ecs-verify.sh` 的健康、域名/IP 隔离、产物哈希、容器、迁移和旧记录检查全项通过，公网健康 200，远端临时目录已清理。
- 下一活动批次与停止条件：最终状态 checkpoint 识别消息为 `docs(status): record p4 card rhythm deployment`；推送并同步为 production `current-release` 后暂停，只等待用户在实体微信复核三视图统一 14px 节奏和事件记录 SVG 图标；未确认前不进入 P5、不补独立 staging。

## 2026-08-23 P4 月历摘要、标识位置与按压反馈修复（当前批次）

- 用户反馈：实体微信截图中，Mini 在视图控制器上方多出 Web 没有的“月份 / 只读查看 · 24 小时缓存”摘要；月格“换/加”等标识独占右下角而非跟在人名后；左右换期与定位按钮松手后蓝色按压框消失过慢。本批只修这 3 项 P4 显示/反馈，不进入 P5。
- 引入点与 Web 对照：`git log -S`/`git blame` 确认摘要来自 `ad4cfb2c`，月格人名与绝对定位标识来自 `1f715c96`，月/周/列表导航缺少 `hover-stay-time` 的入口分别来自 `1f715c96` 与后续 P4 工作台提交。生产 Web 390px 与 `MonthGrid.vue`/`DutyCell.vue` 实测标识和人名同一 flex 行、纵坐标一致、间距 2px，且视图控制器上方无摘要行；`WeekGrid.vue` 明确保留人名第一行、班种/变更第二行，列表原本已在人名后，因此不改这两处。
- 实现与语义：删除 Mini 专属摘要及无用样式，把既有 `workbench-content-top` 滚动锚点移到视图控制器；月格新增紧凑人员行，让 13px 变更标识紧随姓名且不再绝对定位。月/周/列表的左右换期与定位共 9 个按钮统一 `hover-start-time=0`、`hover-stay-time=60`，只缩短蓝色背景停留，保留原图标/滑动动画。日历 GET、24 小时缓存及脱敏、筛选、换期、定位事件与调用次数均未变。
- 测试与验证：3 项回归断言在旧实现 3/3 失败，修复后定向 11/11、受控 Mini 18 文件/82 项通过；Mini typecheck、production verify（2/2 Worklet，405117 bytes，manifest `d9df7f147907e9c1a980c4537375a93d7c79c1bb460367890c786f390eabb4c3`）、CI dry-run、任务文件 ESLint/Prettier、`git diff --check` 与 `pnpm smoke:check-core` 通过。运行/浏览器验证：生产 Web 390×844 只读核对摘要缺失及标识几何，取消既有密码提醒后未触发业务写入，浏览器视口已恢复；未改 Web 核心链路，无需完整 `pnpm smoke:browser`。从仓库根误跑一次 Mini 测试导致 11 项按错误 `process.cwd()` 读取根 `src/` 并误扫 `runtime` 副本，随后在正确 Mini 工作目录受控全绿，未修改这些用户文件。
- 当前状态：已完成（含运行验证、体验上传和生产发布）→待用户实体微信复核。代码 checkpoint `6525b1f`（`fix(miniprogram): align p4 calendar markers and feedback`）已推送；production-profile 体验版 `0.1.0-p4.20260823.63` 上传成功，63 个平台代码文件，上传 manifest `5e3ed404933e88ca0573b1361c3e406cb435d74279989a2aa84c4be4912db2ae`，未审核/正式发布。生产备份 archive `25dca2ba-3df0-408d-b856-b1f722bcdd38`（54 表、162546 行、76676524 bytes，SHA-256 `e301dd0aae0459f2f4d2129ab648e9b1eab68f459e3dee948b46bc5bba8a0adf`）后部署 release `6525b1f318685baa8256f727f5a9ccc006dd832d`；预热首次 502 后自动恢复，`ecs-verify.sh` 的健康、域名/IP 隔离、产物哈希、容器、迁移和旧记录检查全项通过，公网健康 200，远端临时目录已清理。
- 下一活动批次与停止条件：最终状态 checkpoint 识别消息为 `docs(status): record p4 marker feedback deployment`；推送并同步为 production `current-release` 后暂停，只等待用户在实体微信复核摘要删除、姓名后标识和 60ms 蓝底释放 3 项反馈；未确认前不进入 P5、不补独立 staging。

## 2026-08-23 P4 原生控件滚动、列表裁切与详情同构修复（当前批次）

- 用户反馈：月/周视图滚动后“月/周/列表 + 筛选”控件错误固定并覆盖月历，列表顶部月份工具栏下沿阴影区域不好看、应直接删除，月/周下方选中日期详情与生产 Web 手机版结构完全不同。本批只修上述 P4 只读视觉/交互，不进入 P5。
- 引入点：`git log -S`/`git blame` 确认全局 `.view-controls` sticky 来自 `3fc41610`，动态 inline top 叠加来自 `50c6d1ed`；扁平详情模型来自 `ad4cfb2c`、旧摘要模板来自 `733e3af6`；列表内滚动与缺少独立裁切层来自 `50c6d1ed`。生产 Web 对照为 `SelectedDateDutyDetails.vue`、`ListGrid.vue` 和 `CalendarView.vue`。
- 实现：视图/筛选控件恢复普通文档流，月/周随页面滚动，列表仍通过外层禁滚和内层 `scroll-view` 自然固定；列表月份工具栏删除下沿阴影，保留 1px 边框、圆角、固定底部间距和独立背景裁切。选中详情改为 Web 同构的“日期 + 班种数 → 班种卡 → 成员/岗位/状态 → 电话展开/变更说明/事件入口”，按班种与时间排序，并采用 Web 的“替 / 请假替班”详情口径；事件记录仍属于后续阶段，当前入口只给阶段提示，未新增业务读取或写入。
- 语义审计：日历 GET、缓存、request serial、Promise catch、筛选和换期调用次数不变；手机号仍只来自已返回的日历成员字段，24 小时缓存继续删除完整手机号；新增状态仅控制电话展开，拨号仍以 `wx.makePhoneCall` 成员调用执行。日期视觉格式和计数由旧“8月23日 · 周日 / 1 个班次”明确改为 Web 的“8月23日 周日 / 1 个班种”。
- 测试先行与验证：新结构/滚动/裁切断言在旧实现 2 项失败，用户澄清后的去阴影断言再失败 1 项，详情标识 Web 口径断言再失败 1 项；修复后定向 8/8、受控 Mini 18 文件/79 项通过；typecheck、source/package audit、determinism、production verify（2/2 Worklet，405150 bytes，manifest `460c9c17dd514e03b08c0e2d0c74558bb915acc93ebb031554d487d42504cfff`）、CI dry-run、ESLint、Prettier、`git diff --check` 与 `pnpm smoke:check-core` 通过。运行/浏览器验证：生产 Web 390×844 只读对照确认详情层级与几何，未触发写入且浏览器视口已恢复；未改 Web 核心链路，无需完整 `pnpm smoke:browser`。仓库既有忽略目录 `.artifacts/ecs-runner-deploy-*` 含一份不完整旧源码副本，故完整测试以 `--exclude "**/.artifacts/**"` 限定真实 `scripts/` 源码，未删除或改动该既有产物。
- 当前状态：已完成（含运行验证、体验上传和生产发布）→待用户实体原生复核。代码 checkpoint `d9296df`（`fix(miniprogram): match p4 selected duty details`）已推送；production-profile 体验版 `0.1.0-p4.20260823.62` 上传成功，63 个平台代码文件，上传 manifest `4922f360416b9f0feed545c1f80ef5bb200557378cd0fc8e7c5642d3ecb0f4b9`，未审核/正式发布。部署前数据库备份 archive `61a0df40-43fb-4f9d-af77-20032bbc2385`（54 表、162544 行、76675204 bytes，SHA-256 `38064443aaf02cf46db2e1f9873eceb076f9bc0c92b333278dbfccadcde5b16f`）后部署 release `d9296df06b3579210cf9b50557cc1be81073ca41`；容器预热首个健康请求 502、第二次恢复，`ecs-verify.sh` 的健康、域名隔离、产物哈希、容器、迁移和旧记录检查全项通过。
- 下一活动批次与停止条件：最终状态 checkpoint 识别消息为 `docs(status): record p4 selected duty deployment`；推送并同步为生产 current-release 后暂停，只等待用户在实体微信复核三项反馈，未确认前不进入 P5、不补独立 staging。

## 2026-08-23 P4 原生安全区与视图内容一致性修复（当前批次）

- 用户反馈：月视图顶部被固定工具栏遮挡；筛选下拉会撑高底部弹层；月/周/列表按压反馈不一致；周与列表班次内容未对齐生产 Web；列表定位时应只滚动内容区；沉浸式/全面屏状态栏会与小程序顶栏重叠。
- 回归引入点：`git log -S`/`git blame` 确认状态栏仅依赖 `env(safe-area-inset-top)` 来自 `733e3af6`，普通文档流筛选下拉来自 `3fc41610`，周/列表扁平展示模型由 `ad4cfb2` 引入并在 `733e3af6` 调整，月视图按压背景来自 `1f715c96`。修复仅涉及 P4 只读工作台。
- 实现：用 `getWindowInfo().statusBarHeight`/`safeArea.top` 和微信胶囊几何动态计算顶栏高度、操作区位置及内容偏移；月历锚点留出固定工具栏间隙；筛选 sheet 固定 468px，三个选项面板改为绝对定位覆盖层并按实际上下空间自动选择展开方向；月/周/列表换期与定位统一为 Web 的圆角缩放按压反馈。
- 内容与滚动边界：周视图改为日期/节假日/成员/班种缩写/变更标记的 Web 同构单元格，列表改为按日期卡片分组的成员、班种时间、岗位、变更标记与已授权电话入口；列表模式禁止外层滚动，仅内层 `scroll-view` 平滑定位，月份/视图/筛选/列表工具栏全部固定，并删除说明文字。仍为只读 P4，未增加排班或身份写入。
- 测试先行与验证：新增结构/安全区/筛选/周列表模型回归断言，旧实现 3 项失败，修复后定向 8/8、受控 Mini 18 文件/79 项通过；Mini typecheck、ESLint、任务文件 Prettier、production verify（2/2 Worklet，386770 bytes，manifest `b45d0c7d6123a2c9e3d62410db973da924c542dd2db7db3931f113d92246c093`）、CI dry-run、`git diff --check` 与 `pnpm smoke:check-core` 通过。未触及 Web 核心链路，无需 `pnpm smoke:browser`；生产 Web 390px 对照后已恢复浏览器视口。
- 当前状态：已完成（含运行验证、体验上传和生产发布）→待用户实体原生复核。代码 checkpoint `50c6d1e`（`fix(miniprogram): align p4 native calendar details`）已推送；production-profile 体验版 `0.1.0-p4.20260823.61` 上传成功，63 个平台代码文件，upload manifest `7ececb7ce5c30bc05246f4b90b65980e627ed35c3a2f17847438264a69e7fd45`，未审核/正式发布。代码发布前加密备份 archive `dca6bce8-9453-4a8e-98c3-931570e4f173`（54 表、162542 行、76673880 bytes，SHA-256 `dd327717cfeba57e9fe59a7e60a6c9248a777a3e33c8b8893e8c0aa7976e3521`）后部署 release `50c6d1edc966b3c029d6b4e825f7fcb86d5d8f21`，预热首次 502 自动恢复，`ecs-verify.sh` 全项通过，本地/远程发布临时目录已删除。最终状态 checkpoint 识别消息为 `docs(status): record p4 native detail deployment`。
- 下一活动批次与停止条件：发布完成后暂停，等待用户在新体验版只复核上述六项视觉/交互；未确认前不进入 P5，不补独立 staging。

## 2026-08-23 P4 月历导航与 Web 移动一致性修复（当前批次）

- 用户反馈：无排班月份会替换整个月历且无法回退；筛选项全部展开；Mini 顶部/底部/定位/换期图标与 Web 不一致；月历底行选中框被裁细；五/六行月份切换时容器高度滞后；周标题缺周序；周/列表切换反跳；列表定位后视图切换与筛选未固定；相邻月姓名出现约 0.5 秒延迟。
- 引入点：`git log -S`/`git blame` 确认 Mini 全局空态、展开筛选、周标题和三面板复位来自 `733e3af6`，月历高度动画来自 `4b33274e`；Web 列表定位层级来自 `38611902`，相邻月只显示日期来自 `abd20d2`/`ab25064`。本轮只处理这些 P4 只读显示与导航调用点。
- 实现：Mini 在无排班月份仍保留完整月历和换期入口；筛选改为 Web 同层级的三个折叠下拉；采用 Web 24×24、2px 圆头路径并以 WXSS 分层节点实现局部动效；蓝框改为内嵌伪元素；月历按 `bindtransition.dx` 在拖动起始阶段提前过渡到目标五/六行高度；周标题统一为“8月第4周 / 2026年8月17日 – 8月23日”；周/列表结算时原子重建三面板，取消复位反跳。Mini 月/列表预取前后二月并在内存聚合，消除相邻月姓名延迟。Web 同步显示相邻月姓名，并让月/周/列表、筛选工具栏在列表定位滚动时保持固定；列表数据仍严格限制为当前月。
- 语义边界：仍为 P4 只读工作台，不增加排班、筛选、身份或其他业务写入；只读月历预取由三个月扩大为五个月并由现有缓存去重，群组切换清空跨群资源；失败/离线仍沿原错误路径，空月份不再被误判为全页空态。Web 列表新增当前月过滤，避免预取数据跨月泄漏。
- 测试与验证：回归断言在旧实现先失败、修复后 Mini 18 文件/79 项和 Web 日历 14 文件/76 项通过；Mini/Web typecheck、Mini production verify（2/2 Worklet，370126 bytes，manifest `8d3fb688176fb370f6660a51236f8cdc90d1f42c9726a0d3f86d443bfc8e72e0`）、Mini production build（112 文件）、Web production build和任务文件 Prettier 通过。390×844 当前源码浏览器复核相邻月姓名、底行蓝框、31 条当前月列表、定位平滑滚动、两层固定工具栏和零横向溢出通过；完整 Web smoke 被本地既有 `/calendar-preferences` 500 门禁阻断，未进入本轮视觉断言，API/偏好代码不在本轮改动中。
- 当前状态：已完成（含运行验证、体验上传、生产发布和正式域名只读复核）→待人工原生复核。代码 checkpoint `3fc4161`（`fix(calendar): stabilize p4 mobile navigation`）已推送；production-profile 体验版 `0.1.0-p4.20260823.60` 上传成功，63 个代码文件，上传 manifest `c937f97a8127147a9b0b9977ba683e1b1d19332ed7afac544f049c436b9d51dd`，未审核/正式发布。代码发布前加密备份 archive `3421dc2d-4581-4132-a259-8db5bdc3f88f`（54 表、162537 行、76671592 bytes，SHA-256 `5ed33819c65d26c93ac97e4037287a0fb7fd6d91951a648a4f133c3e3f7846e6`）后部署 release `3fc41610c2e52eb09a98a674dcd77b398d0ca82f`，`ecs-verify.sh` 全项通过。正式域名 390px 月历相邻月姓名可见；列表仅 8 月 1–31 日共 31 条，定位后两层工具栏固定于 68–130px/130–216px、今天行位于可见区且无横向溢出。最终状态 checkpoint 识别消息为 `docs(status): record p4 calendar stabilization release`；该 checkpoint 部署后暂停，等待实体 Android/微信确认，不进入 P5。
- 下一活动批次与停止条件：只接收本体验版九项视觉/交互复核；全部通过则收口 P4，发现差异则只修对应 P4 项，不补独立 staging、不自动开始 P5。

## 2026-08-23 P4 生产 Web 交互对齐修复（当前批次）

- 用户复核结论：上一体验版仅达到“可用”，仍存在约 200ms 顶部“正在读取排班”插入造成整页纵向抖动、周/列表及定位硬跳、筛选不是生产 Web 底部弹层、顶部群组切换与顶部/底部/筛选/定位/换期图标和动效不一致。
- 引入点：`git log -S 'refresh-indicator'`/`git blame`、`git log -S 'handleWeekSwipeEnd'`/`git blame` 确认差异由 `ad4cfb2` 的 P4 初版和 `9cdd0a8` 的手势补丁引入；生产 Web 对照源为 `HomeView.vue`、`GroupSwitcher.vue`、`CalendarView.vue`、`ResponsiveSheet.vue`、`LucideMinimalActionIcon.vue` 与 `WorkbenchNavIcon.vue`。本轮以生产 Web 手机版真实结构和行为为准，不再把旧 P4 Storybook 中缺少生产弹层/顶栏的片段当作完整实现。
- 实现：已有数据切换时完全移除会占位的顶部刷新行；月/周/列表都预取相邻三面板，月份在滑动完成时先用已聚合数据即时重建，周/列表改用原生三页 `swiper` 并经同一动画通道处理按钮、手势和定位；月历网格改为单一 1px 边界，消除底部/顶部叠线；周选择框在卡片左右底角内裁剪。筛选改为生产 Web 同维度底部弹层，支持“只看有变更”、岗位、班种、成员多选、清除和查看结果。顶部改为紧凑“群组 · 角色 / 日历 / 通知 / 我的”壳层，群组箭头、定位、筛选、左右换期、顶部动作及底部导航用原生 WXML/WXSS 分段图形和 keyframes 复刻，不依赖不可直接继承的 Vue/SVG DOM 动画。
- 行为边界：仍是 P4 只读工作台；未接入请假、换班、调班、通知或其他写入。相邻月/周/列表网络刷新在后台完成，现有面板保持稳定；筛选字段与 Web 的 `filterCalendarAssignments` 共用岗位、班种、成员、变更语义；群组切换时清空跨群组筛选 ID，避免隐藏新群组全部班次。
- 测试先行与验证：结构/筛选/三面板回归测试先失败后通过；定向 `workbench` 7/7，通过受控 Mini 测试 18 文件/78 项；Mini typecheck、production verify（2/2 Worklet，352661 bytes，manifest `212f38bf15e908a5780c011f072753e673f4df9b81a786f7debfac905a6ceb53`）、source audit、package audit、determinism和 `pnpm smoke:check-core` 通过；未改 Web 核心链路，无需 `pnpm smoke:browser`。默认 Vitest 会误扫仓库既有 `.artifacts/ecs-runner-deploy-*` 副本，受控命令用 `--exclude '.artifacts/**'`，未修改该用户目录。
- 当前状态：已完成（含运行验证、体验上传和生产发布）→待用户实体原生复核。代码 checkpoint `733e3af6`（`fix(miniprogram): align p4 workbench with web motion`）已推送；production-profile 体验版 `0.1.0-p4.20260823.59` 上传成功，63 个平台代码文件，上传 manifest `90c9d5940495558be06dadec6d29d8baaa3599e48e066180e3b2ae343bed014d`，未审核/正式发布。代码发布前数据库备份 archive `cf55e8db-431b-4400-9f0e-addf34e72a7a`（54 表、162176 行、76554532 bytes，SHA-256 `f508cb8ef649c1f53cd6176f65554626bd6534d48ff64e05dbbf7c8d4c9f6866`）后部署 release `733e3af67969e29aec6dcc943b571288c33e8549`；`ecs-verify.sh` 的健康、域名隔离、产物哈希、容器、迁移和旧记录检查全项通过。
- 原生验收停止点：新体验版依次确认顶部/群组菜单、月份连续切换无纵向抖动、月/周/列表手势与按钮滑动、跨期定位动画、周选择框圆角、月历单线边界、完整筛选弹层与计数、全部动作图标；同时复核 390/320 宽度。用户确认前不进入 P5。
- 下一活动批次：只处理本次实体 Android/微信视觉反馈；若全部通过则收口 P4，仍不补独立 staging，不自动开始 P5。

## 2026-08-23 P4 原生工作台反馈修复（当前批次）

- 用户反馈：月份切换显示整页“正在读取排班”并等待约 1–2 秒；周/列表不能左右滑动；周视图选择框两端圆角处理不完整；月视图底部边界线重叠；筛选未完整继承 Web 面板；定位无滚动效果；定位、筛选和底部导航图标未继承 Web 的点击动效。
- 引入点核对：`git log -S "state: 'loading'"`/`git blame` 定位整页加载来自 P4 初始 `loadWorkbench`；`git log -S 'handleWeekChange'` 定位周视图仅按钮导航；`git log -S 'calendar-cell-slot'`/`git blame` 定位月历每格底部间距造成边界叠线；Web 黄金稿 `P4WorkbenchPreview.vue` 与 `Ui2Icon`/action-motion 源作为交互和动效依据。
- 实现：已有数据切换月份/周/列表时保留旧内容并显示行内读取指示，不再替换整页；新增主导水平手势判定和周/列表左右滑动；筛选面板补“完成”、选中态与计数保持 Web 语义；定位通过 `scroll-into-view` 和动画图标回到工作台锚点；修正月历底行间距、周视图外框裁剪与选择框；补齐筛选/定位/日历导航/底部导航的原生分段动效和 reduced-motion 处理。仅修改 Mini WXML/WXSS/TS/测试，不改 Web 核心链路、API 或生产数据。
- 测试先行与验证：新增滑动方向/阈值、底行标记和模板契约断言；`pnpm exec vitest run scripts --exclude '.artifacts/**' --fileParallelism=false` 18 文件/77 项通过；Mini typecheck、production build、source audit、package audit、determinism、verify 通过。全量默认测试仍会扫描仓库既有 `.artifacts/ecs-runner-deploy-*` 临时副本并报告其相对 tsconfig/生成 tokens 路径错误，未修改该副本；本批未触及 Web 核心链路，未运行 `pnpm smoke:browser`。
- 当前状态：已实现待人工原生复核。尚未宣称 Android/微信运行时视觉通过；Storybook/模拟器/构建不能替代实体设备确认。
- 原生验收停止点：体验版安装后，确认月切换不再整页闪屏、周/列表左右滑动、周选择框左右边界、月历底线、筛选面板/计数、定位滚动、定位/筛选/底部导航图标动效，并复核 390/320 边界；用户确认前不进入 P5 或扩展 P4 业务写入。
- 下一活动批次：等待用户实体设备复核；若发现差异，仅修复本批 P4 反馈，若全部通过则收口 P4，不自动进入 P5。
- checkpoint 与发布：代码 checkpoint `9cdd0a8`（`fix(miniprogram): refine p4 workbench interactions`）已推送；production profile 体验版 `0.1.0-p4.20260823.58` 上传成功，63 个平台代码文件，上传 manifest `41d60b9a4772f680a7ae24f023f90b0db1425a4387426c0666755a964c2d9980`，未审核/正式发布。代码发布前数据库备份 archive `bb52323f-c52a-4ded-80cd-1c8c952aadff`（54 表、161979 行、76489864 bytes，SHA-256 `b92275867d1f7047d1d9064b0539385bb7aac8662e3d38e212ccd7ded9cc4d14`）后部署 release `9cdd0a8d37650fcd4a239630a252f00e1683f51a`；`ecs-verify.sh` 的健康、域名隔离、产物哈希、容器、迁移和旧记录检查全项通过，部署临时目录已删除。随后状态 checkpoint `e60013f`（`docs(status): record p4 workbench feedback deployment`）已推送；docs-only 发布前数据库备份 archive `0e750ac7-e8ee-4e63-bcd8-5d87b327c1c8`（54 表、161985 行、76492140 bytes，SHA-256 `b01eccdd886ad041e7758c75505b724db4b3ee862667e964ebf0a0efac46c4f5`）后部署 release `e60013f61fb9f46de5239079feff67774056524c`，`ecs-verify.sh` 再次全项通过，部署临时目录已删除；Git `HEAD`、`origin/main` 和服务器 `current-release` 已对齐。本次最终状态记录 checkpoint 使用 `docs(status): set p4 native review stop point`，提交后继续按同一生产验证流程部署。

## 2026-08-23 P4 小程序原生工作台接续（当前批次）

- 前置确认：用户已确认 Web 黄金稿 `miniprogram-parity-p4-workbench--ready-390`、`--ready-320` 及月/周/列表、定位、筛选和异常状态；现进入原生 `pages/workbench/index`，不再等待 Web 视觉确认。
- 范围：接入身份确认后的“进入排班台”导航；新增只读群组选择、月/周/列表视图、上一期/下一期、定位到今天、筛选、选中日期详情、联系方式同意边界、加载/空/错误/离线 24 小时缓存状态和 P4 底部禁用入口。未实现请假、换班、调班、发布或任何业务写入。
- 设计意图：沿用 Web 医护工作台的蓝白令牌、紧凑群组切换器、固定比例月历和 44px 触控区；原生层只使用 WXML/WXSS/TS 与既有 `CalendarMonth`，不引入 TDesign 或第三方 UI。
- 数据边界：日历/节假日复用 `client-core` 只读解码与 transport；群组/成员在 Mini read client 做同样的结构校验；缓存写入前剥离完整 `mobilePhone`，读取时校验 decoder，过期后只允许重新读取，不建立离线写入队列。
- 回归引入点：执行 `git log -S 'pages/workbench' --oneline -- apps/miniprogram/src apps/miniprogram/docs` 确认无既有原生工作台；执行 `git log -S 'createRuntimeCalendarReadClient' --oneline -- apps/miniprogram/src/platform/client-core-calendar.ts` 与 `git blame` 核对既有 P2 日历 transport；月历三面板/定位行为沿用 P1 `CalendarMonth` 的 `git blame` 来源。
- 测试先行与验证：P4 回归测试先在缺少页面/模型时失败，接入后 `workbench` 5/5、identity 6/6、calendar POC 6/6、calendar simulate 1/1 通过；Mini typecheck、source audit、package audit、determinism、production build、`verify`、CI dry-run 均通过（2/2 Worklet，production manifest `afb8d398e1d496d27173eb0ec98050b13e8c946e697625b49cda0ea934db348c`）。受控测试命令排除仓库既有 `.artifacts/ecs-runner-deploy-*` 临时副本；该副本的相对 tsconfig 失败未修改。
- 当前状态：已实现待人工原生复核。尚未宣称 Android/微信运行时视觉通过；Storybook/模拟器/构建不能替代实体设备确认。
- 原生验收停止点：体验版安装后，从身份页点击“进入排班台”，依次确认 390/320 边界、群组切换、月历左右滑动/上一期/下一期/定位/选中详情、周视图、列表视图、筛选、离线/错误/空态和底部禁用入口；用户反馈前不继续扩展 P4 业务功能。
- 下一活动批次：仅处理用户原生设备反馈及由反馈直接证明的 P4 视觉/交互修正；不补独立 staging，不进入 P5 手排/发布。
- checkpoint 与发布：代码 checkpoint `ad4cfb2`（`feat(miniprogram): add p4 readonly workbench`）已推送；production profile 体验版 `0.1.0-p4.20260823.57` 上传成功，63 个平台代码文件，上传 manifest `fc04085494fd9bb32551dd425781f349df246c87fbe8fb1ec7b3d6dc2bc80994`，未审核/正式发布。ECS 发布前数据库备份 archive `a58446e5-0ba9-4d4e-b0a7-a56ff4b205f3`（54 表、161788 行、76427808 bytes，SHA-256 `6d2e8f28901c9443db3fff233c3551241c8a129ffe698bd2ecf14287b998a39b`）后部署 release `ad4cfb2ca94ae646b85e8b753f8b1dfebfc8e1f1`；`ecs-verify.sh` 全项通过，部署临时目录已删除。首次微信 CI 尝试因出口临时 IPv6 不在白名单失败，随后强制 IPv4 `103.54.154.21` 上传成功。

## 2026-08-23 P4 工作台 Web 黄金审查与月历规范修正（前一阶段）

- 范围：在首个 P4 工作台黄金稿上补齐 Web 规范中属于 P4 只读链路的定位到今天、筛选入口/面板、月/周/列表及其上一期/下一期、选中日期详情和联系方式同意边界；复用 `Ui2MonthCalendar` 的移动月历单元格固定为 `aspect-ratio: 1 / 1`，不提前实现手排、发布或业务写入。
- 设计审查结论：当前群组、24 小时只读缓存、加载/空/错误可重试/离线态、月历节假日/变更标记、定位按钮和 44px 触控区属于 P4；请假/换班/调班、群组/成员管理、通知/导出/统计和完整联系方式公开分别留在 P7–P9 或需单独同意的后续边界。P4 底部导航保留结构但对未迁功能明确标记禁用并提供阶段提示，避免无响应入口。
- 回归来源：`git log -S 'aspect-ratio: 1 / 1'`/`git blame` 对照 Web `MonthGrid.vue` 的移动单元格规范；`Ui2MonthCalendar` 新增定位事件后同步修复其两个既有 Storybook 父级的定位回调，避免共享组件出现无响应按钮。
- 验证：P4 定向视觉源测试 7/7、Web 日历/工作台相关测试 32/32、Web `vue-tsc --noEmit -p tsconfig.json`、Prettier check 和 Storybook build（2852 modules）通过；`pnpm --config.verifyDepsBeforeRun=false --config.confirmModulesPurge=false smoke:check-core` 通过并确认未涉及核心链路。
- 运行/浏览器验证：最新 Storybook dev 预览覆盖 `--ready-390`、`--ready-320`、`--filter-open-390`、`--week-390`、`--list-390` 及异常态；点击验证月/周/列表上一期/下一期会更新标题、详情或行数据，定位会同步回到当前月/本周/今天；390px 月格首列实测 `49×49`、定位 `44×44`、筛选 `76×44`、筛选项 `44px`，周格 `51×102`；320px 月格 `46×46`、定位 `44×44`，`documentElement.scrollWidth === 320`，浏览器 error/warn 为 0。
- 当前状态：已完成（含测试、Storybook/浏览器验证、生产备份、ECS 部署与 `ecs-verify.sh`）→待用户人工视觉确认；Storybook 清单已登记 9 个 P4 状态：`miniprogram-parity-p4-workbench--ready-390`、`--ready-320`、`--filter-open-390`、`--week-390`、`--list-390`、`--empty`、`--loading`、`--error`、`--offline`。此阶段尚未修改小程序原生 WXML/WXSS、API 或生产数据。
- checkpoint 与发布：代码 checkpoint `2ae913b`（`feat(miniprogram): align p4 workbench with web calendar`）已推送；生产发布前数据库备份 archive `2d304969-a4ae-4fcc-b656-32a139a30338`（54 表、161657 行、76385032 bytes，SHA-256 `2b259a9b38cdb3d2012ae3d7b3332e2a0502c270f3c32afbfa3188ade865ed7b`）后部署 release `2ae913bbd7be8f06472e55fc37cd8ea142cf542c`；`ecs-verify.sh` 全项通过，部署临时目录已删除，Git `HEAD`、`origin/main` 与服务器 `current-release` 一致。小程序不上传新体验版，因为本轮未修改 Mini 原生代码。
- 停止条件：用户人工确认 390×844/320px 的工作台层级、群组卡、方形月历密度、定位/筛选、周/列表/详情、底部禁用入口和异常文案后，才进入原生 `pages/workbench`/日历接线；确认前不开始 P4 原生页面。
- 最终状态 checkpoint 识别消息：`docs(status): record p4 calendar navigation deployment`。

## 2026-08-23 P3 已有账号绑定遗留微信身份修复（当前批次）

- 根因与引入点：生产只读核对确认 D0796 密码账号正常，但当前微信身份已被历史迁移产生的无业务“空壳用户”占用；`git log -S 'identity.existingUserId !== undefined && identity.existingUserId !== account.userId'`/`git blame` 定位原始拒绝逻辑来自 `2fc9c164`，因此输入正确密码仍返回 `CONFLICT`。
- 测试先行：在 `wechat-auth.integration.test.ts` 先加入遗留身份绑定回归场景；实现后覆盖空壳无资料、首次使用后已有同名资料、姓名不匹配拒绝三条路径。
- 实现：密码证明通过后，仅在来源用户仍为 active、仅有一个 Mini identity、无密码、无群组/群主/解绑记录/UnionID、最多一份且与目标账号同名资料时，将 identity 和 legacy openid 原子迁移到目标密码账号；来源资料软删除、用户标记 deleted 并清除登录 UID；任一条件不满足则保留 token pending 并返回冲突。
- 验证：API 微信认证集成测试 25/25 通过；API typecheck、任务文件 `git diff --check` 通过。未改 Web 核心链路，无需 `pnpm smoke:browser`；小程序代码未变，体验版 `0.1.0-p3.20260823.56` 继续可用。
- checkpoint：代码提交 `7d454a5`（`fix(auth): rehome empty legacy WeChat identity`）已推送并部署；代码发布前备份 archive `1a955aa1-0a8e-46a7-bc3f-c2db353b6213`，release `7d454a5571cb996abf0ee2af57230d16d696267c`，`ecs-verify.sh` 通过。身份迁移前再次备份 archive `2110eaaa-ecee-498a-b1e2-d4d3ba09db72`，生产 D0796 已绑定当前微信 identity，来源空壳用户已软删除并保留迁移审计。
- 当前状态：已完成（含代码发布、备份、线上身份迁移和核验）→待人工原生复核；体验版 56 重新登录应直接进入 D0796 对应排班台，无需再次创建微信档案。
- 下一活动批次与停止条件：只做本修复的生产发布和体验版人工复核；不补 staging，不进入新的 Web/Mini 功能任务。

## 2026-08-23 P3 Mini production 默认 profile 固化（当前批次）

- 实现：`apps/miniprogram/package.json` 的默认 `build`、`check:determinism`、`ci:dry-run`、`preview`、`upload:experience` 和 `verify` 全部改为 `--profile=production`；保留显式 `build:staging` 作为未部署环境的本地入口，不提供运行时环境切换。
- 引入点与测试：`git log -S 'upload-experience --profile=staging'`/`git blame` 定位 staging 默认来自 `3884713b`；新增默认 profile 回归测试，旧配置先失败 2/2，production 配置后通过。
- 验证：受控 Mini `vitest run scripts --exclude .artifacts/** --fileParallelism=false` 17 文件/71 项、typecheck、`node scripts/verify.mjs --profile=production` 和 `git diff --check` 通过（2/2 Worklet，203145 bytes，manifest `a5250654fad9005e89e012478b6c7e5daf729d92fa5b6246e630f22a8201c1d1`）；未运行 `pnpm smoke:browser`，本轮仅 Mini 构建 profile/上传链路。
- checkpoint 与体验上传：代码 checkpoint `8927eae`（`fix(miniprogram): default experience builds to production`）已推送；默认 `upload:experience` 从该 checkpoint 成功上传 production-profile 体验版 `0.1.0-p3.20260823.56`，60 个平台代码文件，上传 manifest `8e0455060cac0c61159c3955e5f7bb76db5a7af47bc8c8a7369d87675fd9480c`；未审核/正式发布。
- 当前状态：已完成（含运行验证）→待人工原生复核；请用户在微信体验版 `0.1.0-p3.20260823.56` 复核微信登录、绑定、建档、管理员绑定和解绑。
- 下一活动批次与停止条件：只做本 checkpoint 的实体 Android/微信复核；用户明确通过前不补 staging、不进入 P4 或新的 Web/Mini 页面。
- checkpoint 识别消息：`fix(miniprogram): default experience builds to production`。

## 2026-08-23 P3 Mini 生产 API 体验版联通修复（前一 checkpoint）

- 根因与决策：体验版 `0.1.0-p3.20260823.53` 按既有 staging profile 指向 `staging-hosp.schedule.eylinhome.top`；该域名未部署到当前 2G ECS，HTTPS 握手失败。用户确认不补建独立 staging，体验版测试身份允许写入 production；今后体验版与正式版均使用 production profile，不增加运行时环境切换。
- 验证：生产 `https://hosp.schedule.eylinhome.top/api/health` 返回 200；Mini production profile typecheck 通过，`node scripts/verify.mjs --profile=production` 通过（2/2 Worklet，203145 bytes，manifest `232bddf2d61a01f1a176d29aa14b09e1cf81ffca0d27a75f24d57274e40e4320`）。
- 体验上传：从当前 `HEAD` `041a7424` 使用仓库外私钥、本地 Node `miniprogram-ci` 成功上传 `0.1.0-p3.20260823.55`，production profile，60 个平台代码文件，上传 manifest `65bbb71f9b285d20de57f91e24e96ebd931d61118d7065dc64fa86c73b5a2ddd`；未审核/正式发布。
- 当前状态：已实现待人工原生复核；请用户在微信体验版 `0.1.0-p3.20260823.55` 重新复核微信登录、link_required→密码绑定、首次建档、管理员绑定和解绑。体验数据按用户决定写入生产，测试需使用专用身份，避免误改正式业务数据。
- 下一活动批次与停止条件：只做该 production-profile 体验版的实体 Android/微信复核；用户明确通过前不补 staging、不进入 P4 或新的 Web/Mini 页面。
- 文档 checkpoint 识别消息：`docs(status): record production-profile mini experience`。

## 2026-08-23 P3 Mini 默认身份入口修正（前一 checkpoint）

- 引入点与修正：`git log -S 'pages/index/index'`/`git blame` 确认 P1 基础页自 `3884713b` 初始化并在 `2d51e222` 成为首路由；P3 身份页追加后仍位于列表末尾，导致冷启动进入 P1 展示页而看不到登录入口。仅将既有 `pages/identity/index` 调整为 `app.json` 首项，P1 月历/矩阵/手势路由与 P3 解绑、管理员预览路由仍保留；无 ECS 中继、凭证、公共 API 或页面逻辑变化。
- 验证：Mini 定向 6 项、受控全套 16 文件/69 项、TypeScript typecheck、staging build、verify、Worklet/source/package audit、determinism、官方 CI dry-run 和 `git diff --check` 通过；浏览器 smoke 因本机监听 `localhost:5173` 被系统 `EACCES` 阻断，未进入产品断言（本批仅 Mini 入口变更）。
- checkpoint 与发布：代码 checkpoint `984695ac`（`fix(miniprogram): open identity page by default`）已推送；当前公网 IPv4 `103.54.154.21` 与微信上传白名单一致。从精确干净 worktree 使用仓库外私钥、本地 Node `miniprogram-ci` 上传体验版 `0.1.0-p3.20260823.53`，60 个平台代码文件，上传 manifest `7befc46d5b5bae0bbd5b189047d01ae5963e3c3d6aa1ccbe86e68d6937c433d4`，未审核/正式发布。正确生产 ECS `120.77.220.79` 发布前数据库备份 archive `6d1c0b1f-1bc8-46df-bd46-e5821a8e9723`（54 表、161508 行、76329196 bytes，SHA-256 `d717001dcebf8e0783d3339e43cbe4e73159d58c65a84d6eed3e5da3f12ed361`）后部署 release `984695ac13eff7e58258c4a549b0a506eb650d41`；`ecs-verify.sh` 通过，部署临时目录已删除，Git `HEAD`、`origin/main` 和服务器 `current-release` 一致。未使用 ECS 上传小程序，未包含审核或正式发布。
- 当前状态：已实现待人工原生复核；等待用户重新打开体验版确认冷启动显示“微信登录”入口，并复核登录、绑定、建档、管理员绑定和解绑完整 P3 清单。
- 下一活动批次与停止条件：只做本入口 checkpoint 的上传、生产对齐和用户实体 Android/微信复核；用户明确通过前不进入 P4 或新的 Web/Mini 页面。

## 2026-08-23 P3 原生解绑页面切片（当前批次）

- 范围：新增 Mini `pages/identity/unbind`，使用 fresh `wx.login` 调用 `/me/wechat/miniprogram/unbind`，以页面级稳定 Idempotency-Key 保护重复提交；成功只显示当前身份解除，Web 账号/资料/排班保留。
- 验证：Mini 定向 6 项、受控全套 16 文件/69 项、typecheck、source/build/Worklet/包体/确定性 verify（2/2 Worklet，207146 bytes，manifest `a83fbdd9cb177fc8e14f14984d55726f16a1a18c2a402b5c85818ece7fceccdb`）和 CI dry-run 通过。
- checkpoint 与发布：代码 checkpoint `9b7ffbe` 已推送；本地 Node `miniprogram-ci` 上传体验版 `0.1.0-p3.20260823.52`，60 个平台代码文件，上传 manifest `931fc9eb526bb111265b61fc4dcbee93038dc26a10123dd217f882e0d9693c3d`，未审核/正式发布。生产备份 `495bb52d-2890-4c0d-af62-1b06738712ed`（54 表、161506 行、76327876 bytes，SHA-256 `a67d2e648d531086dcbb483dc7e16b066733803f4f03380b4d79451857bb6a19`）后部署 release `9b7ffbef8b152a31ba675a2a36f5c3e788a058b3`；`ecs-verify.sh` 通过，47 migrations/54 表，identity/admin-ticket 均 0。
- 当前状态：已实现待人工原生复核；等待登录、绑定、建档、管理员绑定和解绑完整清单反馈。
- 停止条件：用户在微信开发者工具/实体 Android 复核全部 P3 身份状态并明确反馈通过或差异；未通过前不进入 P4。

## 2026-08-23 P3 解绑确认视觉黄金状态（当前批次）

- 范围：只新增已确认 P3 Storybook 的 Mini 当前 AppID 解绑确认/320px 边界状态；明确保留 Web 账号、个人资料和排班，未实现原生解绑 WXML/WXSS，不调用 API。
- 黄金映射：新增 `miniprogram-parity-p3-identity-security--mini-unbind-confirm` / `--mini-unbind-confirm-320`，与现有登录、绑定、建档、管理员绑定状态保持同一身份进度线和令牌；原生页面为 `pages/identity/unbind`。
- 当前验证：clean worktree build、Storybook build、P3 source Vitest 4/4 与 390/320 浏览器几何自检通过；两种视口 `body.scrollWidth === viewport`，仅静态服务器 favicon 404。用户已确认前 9 个 P3 身份状态，本新增危险操作状态需单独确认。
- checkpoint 与发布：代码 checkpoint `89b7bdc` 已推送；生产备份 `0a29cff1-5b32-48e2-96b9-822084e82d8e`（54 表、161504 行、76326552 bytes，SHA-256 `1010dc734ca26a6beec48d4c2b13b501032c9d5c0cd9a17098907e2555bfad1f`）后部署 release `89b7bdc5b7c36b1b5dbacf182aff89cbf261e809`，`ecs-verify.sh` 通过，47 migrations/54 表，identity/admin-ticket 均 0。
- 当前状态：解绑黄金已接入原生切片，待用户实体运行时复核；不进入 P4。
- 停止条件：等待用户确认解绑状态的文案、危险色、按钮层级和 320px 布局后，再实现 Mini 解绑页面并接入 `/me/wechat/miniprogram/unbind`。

## 2026-08-22 P3 Web 身份生产接线（当前批次）

- 范围：接通已确认黄金稿对应的 Web 登录和平台账号后台；Web 登录移除公开注册控件，API `/auth/password/register` 对匿名请求返回 403 且不创建用户；平台管理员页面接入脱敏账号列表、用户名分配和管理员 Mini 绑定链接生成。不修改用户未提交的目录/Storybook 文件，不进入 P4 页面。
- 安全边界：平台账号页面只展示 userId 截断值、username、hasPassword、status、authVersion；不展示姓名、联系方式或密码 hash。绑定链接由服务端生成并显示为受控操作结果。
- 当前验证：API auth route 3 项、Web P3/Api client 157 项、Web typecheck/build、root lint 通过；`pnpm smoke:check-core` 通过。`pnpm smoke:browser` 在本机 5173/5174 绑定被系统 `EACCES` 阻断；clean static build 复核已通过登录页布局、隐藏公开注册和键盘焦点，随后因无开发身份按钮无法继续工作台流程。
- checkpoint 与发布：代码 checkpoint `02a508d` 与修正 `b9a5382` 已推送；生产备份 `0e062719-9a52-4367-8624-2b0f8fc315a2`（54 表、161502 行、76325228 bytes，SHA-256 `ec1a8efb85677df6b1ce93cecba3984c3a2d53721ca000d59340849d8c7b9266`）后部署 release `b9a538240e7148913cb4dd933b93395b05c5a05d`，`ecs-verify.sh` 通过。Web 公开注册已关闭，平台账号页面已接入。
- 当前状态：Web P3 身份生产接线已完成；Mini P3 身份页面已上传体验版，仍待用户在微信开发者工具/实体 Android 完成原生复核，不进入 P4。
- 停止条件：生产 Web 登录和平台账号页面验证通过后，继续 P3 原生身份验收；不开始 P4 工作台。

## 2026-08-22 P3 原生身份页面首个切片（当前批次）

- 范围：在已确认的 P3 黄金稿基础上，新增 Mini `pages/identity/index` 登录/`link_required`/既有账号密码绑定/首次真实姓名建档，以及后端固定 URL Link 路径 `pages/admin-bind/preview` 的脱敏 preview/当前微信 fresh-code confirm；保留 P1 入口和 POC 路由，不实现 P4 工作台。
- 接线：`src/platform/wechat-identity.ts` 只使用 `wx.login`、`wx.request` POST 和会话存储；未知微信不自动建号，linkToken 只在内存页面状态中流转；管理员 ticket 先 preview，confirm 再重新 `wx.login`，authenticated 结果写入独立 session storage。
- 黄金映射：`docs/design/page-golden-manifest.md` 已登记 `miniprogram-parity-p3-identity-security--mini-login-390/320`、`mini-link-password`、`mini-register-profile`、`mini-admin-link-preview/confirm`；用户已确认 Web 黄金稿，当前需要实体 Android/微信运行时复核。
- 验证：Mini typecheck、构建、source audit、受控测试 16 文件/68 项、clean worktree verify（sourceWorklets/outputWorklets 2/2，package 196458 bytes，manifest `abaf0bb1aede3a6fea714c7419c28815b2d45cc83d477e9f1e3c85901147f18b`）和 CI dry-run 通过。默认全量测试误扫用户自有 `.artifacts/ecs-runner-deploy-*` 副本的 17 项已排除并单独记录，未修改该目录。
- checkpoint 与发布：代码 checkpoint `e69cfb7` 已推送；本地 Node `miniprogram-ci` 使用仓库外私钥上传体验版 `0.1.0-p3.20260822.50`，57 个平台代码文件，上传 manifest `edbb1ffa99ab1ce6b0f2d8d40eac92e0291effdabb9ea1c146d5a09189088854`，未审核/正式发布。生产备份 `99b3dc26-a266-45f6-aac7-ce7b06574d3b`（54 表、161500 行、76323908 bytes，SHA-256 `88909db9853ad137075d5beae0248885db2a5dfeaa93b2f68f27071b421b294c`）后部署 release `e69cfb76ea0d5587a993b5c817f010606cdbb0d3`；`ecs-verify.sh` 通过，47 migrations/54 业务表，identity/detachment/link/Union/admin-ticket 均 0，40/40 用户 authVersion=1，24/3024 密码 hash 汇总不变。
- 当前状态：已实现待人工原生复核；P3 页面 checkpoint 已推送、体验版已上传、ECS 已部署；不进入 P4 或 P3 其他页面，等待用户在微信开发者工具/实体 Android 复核。
- 停止条件：用户在微信开发者工具/实体 Android 复核登录、link_required→密码绑定、首次建档、管理员 preview→confirm、错误/加载/成功状态后，明确反馈通过或给出差异。

## 2026-08-22 P3 身份安全视觉黄金稿（当前批次）

- 范围：只新增 Web Storybook 身份安全黄金稿，不修改生产 Web 登录/平台账号页面，不创建小程序 WXML/WXSS 页面，不调用 API。覆盖 Web 无公开注册登录、平台账号用户名分配、Mini 微信登录、密码绑定、首次真实姓名建档、管理员 URL Link 脱敏预览与确认。
- 设计：沿用 `@schedule/ui-tokens` 的医护工作台蓝白令牌和系统字体；Web 使用“身份确认台”双栏结构，Mini 使用 390px 单列身份步骤流；身份进度线是唯一强调元素，区分微信身份、账号证明和进入排班。所有按钮仅改变 Storybook 预览状态。
- 安全文案：Web 明确没有“注册”入口；平台账号表只展示必要状态，不显示密码/联系方式；管理员绑定只展示 `林*`、`d0***` 和约 10 分钟期限；Mini 首次建档只收真实姓名，不隐含注销或自动建号。
- 当前验证：clean worktree 的完整 build、Web `vue-tsc`、定向 ESLint、源级 Vitest 4/4 与 Storybook build 通过。真实静态 Storybook 浏览器检查覆盖 390×844、320×844、1280×900 的 Web/Mini 登录、平台账号、首次建档、密码绑定和管理员绑定状态；所有页面 `body.scrollWidth === viewport`，无 page error。Web 登录仅有静态 Python 服务器缺少 `/favicon.ico` 的 404，不属于页面资源或产品错误。
- 预览地址：`http://127.0.0.1:6007/?path=/story/miniprogram-parity-p3-identity-security--mini-login-390`；同一 Story 下可切换 `web-login`、`platform-admin-accounts`、`platform-admin-assignment`、`mini-login-320`、`mini-link-password`、`mini-register-profile`、`mini-admin-link-preview`、`mini-admin-link-confirm`。
- 当前状态：已完成（含 Storybook 浏览器自检）→ 待用户复核。用户确认前不实现小程序身份页面或替换生产 Web 页面。
- 停止条件：等待用户人工视觉确认这 9 个身份状态；确认前不进入原生 WXML/WXSS 或 P3 身份页面生产接线。

## 2026-08-22 通讯录打开性能优化（当前批次）

- 范围：只优化 Web/API 通讯录 facet 初载与筛选渲染；不改变权限、搜索语义、筛选结果、收藏查询、联系方式数据或分页大小。
- 回归来源：`8309dce`/`926136a` 引入重复层级扫描，`5437995` 将 facet 与收藏恢复合并等待，`ee1296e` 保留隐藏筛选选项 DOM，`e74e5f3` 每次请求扫描发布批次层级行；本轮已执行 `git log -S` 与 `git blame`。
- 实现：筛选选项改为面板打开且层级展开时才创建；facet 与收藏恢复独立完成；七层兼容性共享一次路径计算；服务端按群组/目录类型/发布批次/可见性复用只读快照，失败请求不入缓存。
- 验证：目录定向测试 43 项通过，Web/API typecheck、build、ESLint、任务文件 Prettier 通过；API MySQL 集成因本机无测试数据库跳过；`pnpm smoke:browser` 因本机端口监听被系统拒绝/5173 无服务未进入产品断言，`smoke:check-core` 通过；正式域名只读复核首次打开约 295ms、筛选面板约 299ms、人员切换约 292ms，空闲态无联系人卡片且无浏览器断言错误。
- 发布与核验：代码 checkpoint `99f222d` 已推送；生产备份 archive `7fcbc271-02ce-4e3b-b7e5-2352be497ba2`（53 表、161466 行、76309276 bytes，SHA-256 `c65b201fdb7f5a7838eff59cef6af13f7b1181de93a6984cc98464b7e27318c6`）后部署 release `99f222d1ac4a0d83d4ab970fae3a0db845cbd4a1`，迁移、容器健康、artifact hash、域名隔离、无旧依赖和 53 表迁移检查均通过；状态 checkpoint `887bcd1` 已推送，备份 archive `b11a59ff-0c2a-4963-9a82-d8405ca810e5`（54 表、161479 行、76315120 bytes，SHA-256 `d7e9dc5a6b0e2f4908bb81ca5ce6eb5208c8a2d906476dd09e91ce79ae5dbf11`）后部署 release `887bcd19ff61d91208190d7b7421aa1c433ba8d6`，最终 release 浏览器复核打开约 290ms、筛选约 288ms；本状态 checkpoint 随下一次文档 release 部署收口。
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
