# Feedback6 最终升级与迁移集成

基线057af270已review并推送main；根任务Acquire general-1独占租约，Owner/TaskId=feedback6-upgrade，Session=feedback6-20260908。Inspector L2、ReuseOnly、root bootstrap及定向6项基线通过；DEPENDENCY_MODE=REUSE_ONLY，无依赖安装。此文记录本地实现，不代表生产操作或原生验收。

## 行为与验证边界

- 当前构建仅声明schema56兼容：既需要0055账号手机号列，也需要0056移除轮转表/策略列。verifier支持迁移前55表及迁移后53表备份，并检查新增列和退役对象。
- 不兼容DDL开始后，ERR/TERM/EXIT均停止迁移容器和API，不自动恢复旧应用。不能依靠journal计数判断MySQL部分DDL是否发生。更新前验证根manifest与current-release一致，禁止失败后普通重试覆盖原恢复材料；完整恢复必须使用对应数据库备份或受控前滚。
- trusted allowlist新增非空精确replace，ensure仍只追加；legacy标识保持原值，可被排除，绝不把无版本旧Mini别名到新版。四处配置校验同步，探测全部支持版本、所有被移除版本、停用legacy及未知版本。失败/信号恢复旧列表及运行策略，原子写失败明确退出。
- 新Mini首次使用旧/缺版本标记的微信凭证时，业务token暂不可用；共享一次wx.login重新签发，同账号保留偏好，换账号清除原私有状态，网络失败保留原资料可重试，link_required退出加载并等显式登录。密码凭证不做版本迁移。
- 会话迁移先于首页/身份页及诊断请求的owner/generation捕获。旧401在恢复前检查代次，已退出/切账号的迟到响应不能清除或覆盖新会话；同owner的64并发401仍共享恢复。手动登录/绑定也有页面销毁和登录代次保护。
- 仅微信解绑、手机号GET状态、PUT明确撤回使用旧有效签名token；不启动升级登录、不使用会清空私有状态的普通401恢复。手机号授予继续受普通版本/能力门禁。此处保持的是已有API/客户端函数级例外，停用后的页面入口并未另做重构。
- 只有真实426+CLIENT_VERSION_UNSUPPORTED展示升级提示；503、网络错误、其他426不冒充停版。UpdateManager在App runtime跨分包共享，只在下载完成且用户确认后applyUpdate。重启会丢失未保存的内存编辑，因此提示先保存；不能宣称原生更新回调已测量。

## 引入点与回归证据

git log -S/blame：legacy必须在列表、能力错误统一吞掉及发布恢复来自e25878f0；旧401恢复链来自9e3a966c，接收者提取18498a8b；跨分包会话状态62e45eb7，password owner保留75ec2c1d。

- schema/legacy新回归旧实现3失败，修复后通过。
- 实际Bash ERR/TERM/EXIT合成测试旧脚本3次复现UNSAFE-RESTORE/启动旧API，修复后通过；再补失败后的身份不一致重试与备份计数。使用仓库runtime/codex合成目录和现有Git Bash，系统/网络由桩代替，不是生产恢复演练。
- allowlist完整Bash流程13项通过：追加、精确替换、幂等、非法输入、锁失败、重建/健康/JSON/旧版仍成功、TERM/HUP/EXIT恢复。首轮runner的长命令截断改为合成脚本文件；同步spawn阻塞超过Vitest5秒后改异步spawn及单例30秒上限，保留产品断言。新增switch/verifier逐版本探针后15项通过；迁移恢复和备份表数Bash20项通过。
- 新会话迁移旧实现2项失败，修复后9项通过；含跨分包、link_required、断网重试、旧/缺标记及账号切换。后续隐私例外和迟到401扩展后16项通过。
- 迟到401/手动登录旧实现5项实际失败；修复后身份18+会话16通过。前置401代次检查初版破坏原64并发恢复，已通过保持恢复期间owner代次、显式退出/登录推进代次解决；原p6-runtime12与诊断12一并通过，没有删掉并发断言。
- 诊断旧mock补充awaitRecovery，异步顺序测试先等真实请求发出后再切账号/发第二请求；保持原拒绝迟到授权断言。升级提示426回归旧1失败，修复后通过；UpdateManager仅Node回调验证。

## 发布顺序与未验证项

版本拒绝覆盖能力发现及微信签名版本；现有密码凭证没有Mini版本声明，保留Web/密码认证边界，不用请求头覆盖已签名身份。旧已安装包的界面不能被源码更新原地修改，需重新进入获取新版，不能声称旧包会立即显示新增的原生更新弹窗。

新版可用后才替换旧Mini版本名单；不保留永久轮转兼容层。当前尚未分配体验版、上传、生产部署、备份或写入生产数据。生产只读审计由前轮取得，见feedback6-data-audit.md；实际发布前须重新读取live并冻结回滚/数据库备份基线，不能把旧记录当当前值。

唯一下一步：完成最终本地门禁、review和Git检查点，再提交具体SHA的上传/部署/版本切换供当次授权。小米14交互、原生UpdateManager、08:00真实前后台换日和本版本通讯录首搜仍待用户复核。

## 最终收尾证据

- 首轮verify通过format后，新增测试mock裸wx变量触发14条lint，改为globalThis.wx后format/lint/build/typecheck/icon通过。业务控制器旧会话夹具缺clientVersion导致被正确识别为升级对象，18处普通业务夹具明确标记当前test版本，保留全部旧/缺版本迁移专用回归；定向48与剩余反馈11项通过。后续全量Mini971通过/15条件skip。
- root全量1207通过/400数据库条件skip，唯一失败为旧schema52备份检查的源码字面量断言；更新为同语义备份校验函数且保留54/55旧范围，打包脚本10项复测通过。没有减少迁移、备份或账号切换断言。
- 运行/浏览器验证：pnpm smoke:browser对应的原scripts/smoke-browser.mjs，经node runtime/audit/feedback6-upgrade/smoke.mjs本地内存配置适配器执行，登录/管理员/成员/访客/访问记录全流程无浏览器错误；合成管理员标记恢复，截图runtime/smoke/feedback6-upgrade。
- 升级UI初版总包5148855字节；将分包只读调用入口与App内原生控制器分离后5118171字节（减少30684），主包1749532；Mini build/verify及升级/会话23项通过。Worklet2/2，既有1.5M内部提示及600格DOM提示仍在，不代表真机性能。
- 并行只读review确认迁移失败重试保护、版本替换恢复、迟到401/登录回调和跨分包UpdateManager；未发现待修确定问题。最终完整pnpm verify退出0：Mini971通过/15条件skip，root1208通过/400数据库条件skip；format/lint/build/typecheck/icon全部通过，证据runtime/audit/feedback6-upgrade/verify-release-ready.log。

最终检查点标识：fix(upgrade): protect sessions and rotation schema transitions。API/Web本地冒烟服务已停止，3000/5173无监听。无生产操作或体验上传；交付摘要见feedback6-result.md。
