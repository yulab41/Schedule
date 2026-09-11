# feedback10 / VIS-02 服务端与体验版交付

日期：2026-09-11。用户授权体验版上传、追加放行，以及必要服务端部署。

## 已交付服务端

- 累计应用0565f023包含9bae5beb的CSV截止/恢复、二维码保存/toast、通知首页跳转与测试版本选择，以及0a8bcba7的访客日历详情。实现证据：[feedback10.md](feedback10.md)、[visitor-calendar-parity.md](visitor-calendar-parity.md)。
- 首次部署前即时live为4e0a0d1a。备份9a9959b1-9034-4013-8706-55b9e9aed34c：104344460字节、54表、SHA-256 8d846c6c16075d900073b818d8a56c2c33d5db690fd0b99bb0ee08c90be98135，实际文件验证一致。0565f023部署健康通过，完整verifier拒绝备份表数。
- 回归来源：3aeaa4c8的校验器将所有schema>=56视为53或55表；4e0a0d1a新增0057的group_visitor_links，实际新备份54表。只读结构计数57条迁移、排除两类隐私日志后55表，其中迁移日志不进备份，和54表备份吻合。
- b618d93861d05ae0c597fa8dfe40ed478902be5c `fix(ops): validate schema57 backup table counts`新增schema57迁移前53/迁移后54表分支，拒绝52/55/56，保留schema56原规则。已推送main。
- 修复后的发布包以即时live 0565f023为回滚候选。最终部署备份e011c56b-699e-422d-9b30-24b2282279f4：104354272字节、54表、245797行，SHA-256 6fcb93a4d09413a789abbd198eaaea4c0240ed82047968d03dae7b95abbadeb2；实际文件长度/hash一致。两次备份各按现有保留策略淘汰1份旧备份。
- 最终live为b618d938，schema仍57，无新迁移。官方updater校验产物并重建API/Web，启动阶段短暂502由内置健康等待恢复；完整ecs-verify.sh与allowlist verify均零退出，包含入口隔离、产物/控制脚本hash、schema及备份规则。隐私保留任务删除0行；未人工触发通知。
- 最终dist归档SHA-256 b09a75efcf925b48f0d9649ec1b669b247f10a005919257678845f2e06ab6835；API runtime归档1a597dc0581158b0504a4770218f81fd832038bc24715aa838c9b6612acdaa53；新可信verifier a494d0d2a1d710a9b2a9b9844214d23382444ce881fa580df2bb2ead70df2c44。

## 体验版交付

- .103官方分配并冻结0565f023后，因生产校验阻塞在调用真实上传前主动取消。号码与Manifest记录保留，不复用。
- 最终候选0.1.0-p10.20260911.104，源码b618d938，production/clean，构建时间2026-09-11T09:15:50.097Z；说明为“CSV等待、二维码保存、通知入口及访客日历 b618d93”。候选前后检查通过。
- 冻结354文件，Manifest 544af28f787a5e06644a64d595105f6e0602f8e8c7314fced23428fe46c2370a；不可变远端miniprogram-trial tag已核对指向完整源码SHA。冻结清单本身不包含build-manifest.json，不能与包含该文件的包体审计直接比较。
- 首次官方编译完成后微信明确拒绝上传：-10008 invalid ip，当前出口不在平台CI白名单。没有成功receipt。不是成功上传后服务端拒绝，也不是可用体验版。
- 项目既有微信专用IPv4路线TLS握手授权通过；用相同版本、源码、Manifest和构建时间幂等重试，复用原始构建，不新分配/重建。真实getrandstr请求ECONNRESET，随后独立HTTPS请求也复现；停止继续尝试。没有更改平台白名单、系统hosts/VPN/DNS或证书验证。
- CI非正常退出后遗留的本任务锁已核对runId/nonce和PID退出，归档owner后只删除该owner文件与空锁目录；预约、tag、Manifest及所有冻结产物保留。浏览器工具库存读取失败，无法检查公众平台现有白名单。
- 用户补充授权后强制IPv4直连、禁用miniprogram-ci代理，独立出口查询与微信-10008回显均确认公网IPv4为120.230.6.0。用户加入CI白名单后，正式锁内重新分配.106；不可变tag、allocation、manifest和成功receipt全部绑定63877b5e。上传请求无拒绝，平台返回成功。
- .106回执：0.1.0-p10.20260911.106，buildTime 2026-09-11T13:57:35.872Z，Manifest c4bf033e252a94927000c6489fabb9f33f679c608c2abb6104606c5f3cc44ceb，上传时间2026-09-11T14:03:06.594Z，354文件。旧.105仍永久占用但未上传，不复用。
- trusted ensure只追加.106并保留旧版；完整verifier与allowlist verify通过。独立HTTPS：.106/.102=200，.105/.104/.100/未知=426。
- 106 已占用后，按用户授权在同一 clean production 累积候选上分配 107。候选 SHA 为 `4b4af0a233f1a3ab06e4178333181747a6250e25`，说明“访客日历电话事件 4b4af0a”，buildTime `2026-09-11T14:16:49.548Z`，354 文件 Manifest `ed36fd07a1266a33875f101b85d486c180a0bba60351b6cf0e1168c12794bfc4`。
- 首次 107 上传在微信 `getrandstr` 阶段遭遇 `ECONNRESET`，没有 receipt；版本按规则永久保留。沿用已验证 IPv4/TLS 路线、关闭 miniprogram-ci 代理，对同一 SHA/Manifest 幂等重试成功：receipt `2026-09-11T14:17:49.661Z`，远端不可变 tag `miniprogram-trial/0.1.0-p10.20260911.107` 指向该 SHA。
- 已执行 add-only `schedule-client-version-allowlist ensure 0.1.0-p10.20260911.107`，保留旧版本；allowlist verify 通过，生产 live 仍为 `b618d938`，schema57，未重复部署、备份、迁移或退役旧版。107 公网能力端点返回200，未知版本策略由既有 verifier/allowlist 门禁复核。

## 验证与边界

- 回归先失败：pnpm exec vitest run scripts/ecs-retirement-rollback.test.mjs，旧实现23通过/2失败。修复后该文件25及package-ecs-release.test.mjs的10项共35通过。项目pnpm lint、Prettier和smoke:check-core通过，后者确认未触及Web核心链路。直接ESLint既有.mjs的尝试因超出项目配置报旧URL/process全局问题，没有修改无关代码。
- 复用累计候选真实MySQL45、Mini联合146、共享/API33及访客浏览器专项；此前Mini verify、Worklet2/2及上传保护30项通过。控制面修复不改变Mini/Web/API业务行为，不重复全部应用测试。
- 两次官方ECS打包成功；首次flat导出复用85包、downloaded0，最终打包命中flat缓存。无workspace依赖安装。保留Web大chunk、Mini内部主包/矩阵节点及Node DEP0190既有预警。
- 证据：ignored runtime/audit/feedback10-delivery-initial-20260911和runtime/audit/feedback10-delivery-final-20260911；台账在runtime/audit/miniprogram-trials。未上传本地数据库/凭据、未进行账户删除/群关联操作、未主动发通知、未提审或正式发布。
- 下一步：小米14复核同一.107版本的CSV真实下载/发送、相册扫码、瞬时通知、新消息点入和访客显示。无需再次部署、备份或上传。
- 原生验收仍待用户：小米14真实CSV下载/发送、保存图片可扫码、瞬时通知、新通知点入日历和访客显示。旧通知不会增加跳转入口，测试需使用修复后新消息；代理不主动发送。

文档收口提交消息：docs(release): record successful trial 107 delivery。文档提交不代表新的生产发布。
