# 打包、release worktree 与上传执行章节

## 何时读取

要求 production profile、确定性构建、包体对比、ECS release、体验版上传或回滚准备时读取本章，
并读取 [ECS 手册](../../deployment/aliyun-ecs.md)、[小程序 CI 手册](../../../apps/miniprogram/docs/runbooks/miniprogram-ci.md)
和 [Mini 发布回滚手册](../../../apps/miniprogram/docs/runbooks/release-and-rollback.md)。

## clean 输入

1. 先查找能复用的仓库根级 runtime/release-worktree：路径短、已登记、detached、状态 clean、
   精确位于目标 SHA，且 lockfile、Node、pnpm 和依赖指纹一致；满足时复用，不每轮删除或安装。
2. 没有可复用 worktree 时再创建，禁止在 worktree 内创建另一个 worktree、在候选 worktree 中
   调 helper 生成嵌套路径，或使用脏主工作树的 dist、混合依赖和生成物。
3. release 输入必须是同一个目标 SHA 的 clean tree；记录源码文件清单/tree hash、lockfile hash、
   Node/pnpm、profile、命令、环境标识、产物和报告路径。Windows 先检查路径长度。
4. 依赖只在 worktree 缺失，或 lockfile、workspace、patch、package.json、Node/pnpm 指纹变化时
   按仓库规定的 frozen/offline 流程安装。不要把安装和无关源码变更混入 release。

## 产物与上传

- release cache 是内容寻址缓存；命中仍需校验 exact clean commit、shell LF/syntax、payload SHA
  和 build tree hash。缓存不得包含 env、凭据、数据库、session 或上传 key。
- 小程序体验上传前确认 buildVersion 不是 local，并复核完整 SHA、trial/renderer、版本描述、
  AppID、profile、测试页、脏树和仓库外私钥来源。该 exact checkpoint 的用户当次批准是必需的；
  dry-run、production build 或早先批准都不替代它。
- 体验上传、API/Web production 和版本白名单是独立轨道；没有当前授权就停在 clean checkpoint。
- 报告、截图、manifest snapshot、smoke 输出和临时目录只写入已确认被 Git 忽略的根级 runtime/；
  清理使用精确 allowlist，删除前核对路径、worktree 登记、HEAD 和 clean 状态。
