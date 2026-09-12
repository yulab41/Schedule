# Feedback15 体验版112已部署并放行

2026-09-12用户先授权上传，随后授权部署并继续放行。本轮服务端部署、体验版上传和仅追加放行均已完成；未发送真实通知，未提审或正式发布。

- 应用提交`83d8a03bfa64817f1ada6afd7c801fc642000978`，已推送main；八项实现与验证见[feedback15.md](feedback15.md)。
- 体验版`0.1.0-p10.20260912.112`，说明“日历八项修复与两步授权 83d8a03”，production/clean，2026-09-12T07:18:11.261Z上传成功。
- 正式独占分配器分配112；上传前后候选检查通过。357文件冻结包、canonical receipt及远端不可变tag一致，Manifest `08c9c0d8a4d5fbafc14230f9471abe02ab5d3499c055ec0ae5501a91a2ba1455`。
- 版本绑定主包1709858/总包4552499字节，包体无错误，保留原主包1.5M内部预警。上传保护24项、CI封装6项通过；应用验证复用上轮完整verify及最终Mini验证，不重复无变化的大型检查。
- 当前正式域名DNS、SSH主机身份、TLS健康验证通过；微信CI使用当次系统解析的真实IPv4与进程级绑定，TLS及nonce检查通过，不更改系统网络或平台配置。
- 部署前实时确认服务器live为 `e163fde8fdb0481c84a6bc4ebebcaa28760bf86a`，回滚候选为 `8f441d2d28f8615cae39f49c06ef6119598c45e5`。生产备份 `d89f173b-8b76-463c-b560-3e0726ff3d5d` 成功，54张表、106182176字节、校验值由服务器返回。
- 服务端 `83d8a03b` 部署成功，schema仍为57；部署内置健康等待首段出现502后恢复，独立 `ecs-verify.sh` 通过。部署包与远端暂存产物的SHA-256、脚本LF及 `bash -n` 校验通过。
- 可信 `schedule-client-version-allowlist ensure 0.1.0-p10.20260912.112` 仅追加成功，独立allowlist verifier及再次 `ecs-verify.sh` 通过；旧版111保留。
- 部署后独立HTTPS策略：112=200、111=200、动态未知版本=426；112的global/core/workflows/guest能力响应为true。未执行replace或版本退役。
- general-5用于生产候选与发布、依赖复用、无依赖安装；租约已释放。冻结包、回执、网络及生产证据位于ignored runtime，不进入Git。

唯一下一任务：用户在小米14上核对体验版112/83d8a03同版本的周历、月历、岗位改名、补班标识、折叠、两步授权和日期圆圈。自动化、浏览器和生产验证不能替代该原生验收；不重新上传、不重复放行或部署。

文档检查点：`docs(release): record feedback15 trial 112 delivery`。文档提交不触发服务器release同步。
