# 共享网关纳管与AI工具隔离

- 用户明确要求继续至全部完成，保留AI工具并隔离其对排班的影响。设计与步骤见同日shared-gateway-isolation-design/plan。
- 基线main/origin/main5ce06f0c，独占general-3，Acquire→ReuseOnly→release Bootstrap八包复用，安装0。原有canonical用户文件保留。
- 生产动态实读live09b79ff1/schema72。AI入口独立server_name，外部include已运行而源文件缺失。现有下次部署会丢入口的回归先失败，登记已存在引用后通过。
- AI服务独立aitool用户，现占约12MiB内存、37MiB交换，CPU上限1核、内存600MiB、交换无限、任务256。2核/约1.6GiB主机尚有约672MiB可用内存，短采样CPU空闲93–98%，存在轻微内存/IO压力，不能证明当前排班尾延迟来自AI服务。
- 保留AI浏览器本机媒体/扫描方案、6次每分钟解析限流、安全头和已关闭的服务器媒体中转。优先修复发布接入和资源边界。
- 桥接采用与服务器现状相同的入口引用，建立后续隔离发布可用的回退前驱。定向24项/格式/差异检查通过，已完成缺引用先红后绿。应用源码未改，复用之前应用测试，生产检查另行记录。
- 真实nginx -t与AI引用root所有/不可组写检查通过，桥接源文件SHA256等于服务器现有文件364e8021…。排班健康及AI首页/local/scan/扫描worker五项200。独立代码审查无阻塞，ESLint及core smoke通过。
- 部署前先按实时live冻结前驱并创建有效生产备份。当前检查点消息fix(infra): register the existing shared AI gateway。
- 完整生产部署、后续隔离和最终同步证据在实施中补录。原始脱敏证据留在ignored runtime/audit/shared-gateway-20261105/。

## 桥接发布已完成

- b44ac08a已正常推送main并发布，前驱从实时live09b79ff1冻结。备份e7549319-16c2-451a-a886-117f0332c5b7（58表/107270364B），密文文件大小与SHA256实读一致。
- 桥接Nginx源文件等于原服务器文件，AI外部引用root所有/不可组写，真实nginx -t及排班健康、AI首页/local/scan/worker均通过。完整生产verifier首轮根页面TLS EOF，随后真实页面/语法复查和完整重跑通过，保留首次日志，不宣称单次全绿。

## 隔离发布实施

- 新独占general-3/REUSE_ONLY/release八包复用，无安装，以已部署b44ac08a作为本批动态基线及下一次备份前驱候选。
- AI完整站点配置内联纳入Nginx清单。对照现状89条非空指令全部保留，仅加总32/来源16连接及超时边界。独立域名、CSP/Permissions Policy、浏览器本机处理和解析限流保留。
- 默认Docker host-gateway连通测试拒绝，因其地址与实际AI后端私网绑定不同。部署工具改为从监听位置识别、校验私有IPv4后原子登记专用环境键。候选真实Nginx语法及后端带正确Host连通验证通过，实际后端监听已确认为私网单地址。
- 新增持久systemd预算、占用/权限/锁前置保护、失败自动恢复旧有效值及显式审计恢复路径。预算按设计作为独立前向控制，应用回退保留。生产校验同时验证预算、私网监听、双域名页面和媒体禁用边界。
- 独立审查发现nginx -t处于条件函数上下文时可能被忽略，模拟旧worker可响应时复现假通过，显式失败返回后通过。补充部分预算写失败恢复、私网环境键保留/重复拒绝等测试。测试环境WSL入口及Windows权限模拟问题已使用仓库Git Bash模式与明确合成系统操作修正，不作为产品故障。
- 最终18项网关/真实Bash合成系统回归及关联门禁合计97项通过，类型/ESLint/格式/Shell语法/core smoke通过，独立复审无生产逻辑阻塞。测试针对性修订后重新证明忽略Nginx语法错误会假通过，修正后通过。临时夹具统一置于ignored runtime/audit，旧的本轮夹具残留已保留移入ignored目录。
- AI响应禁止占用共享网关临时磁盘，完整候选配置使用实际网络/证书及私网映射验证Nginx语法与后端连通。2026-11-06继续同一租约，心跳恢复健康，依赖环境复用；部署前再次动态核对AI入口和资源占用。检查点消息fix(infra): isolate AI tool resources behind the shared gateway，第二次备份、部署与资源竞争复测在本检查点后完成。
