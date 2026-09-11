# feedback10：二维码保存与邀请访客瞬时提示

- 日期：2026-09-11；范围：用户当次批准的 QR 保存及邀请/访客操作提示。
- 状态：代码与定向回归已整合，主任务最终验证见[feedback10.md](feedback10.md)；小米14原生复核待完成，不是上传/发布候选。
- 基线：`main` / `d5d2ebb15dde7e1c07e7d87ec7803100b41cb865`，与仓库 feedback9 交付状态和 Git 历史一致。本轮由当次用户指令开启，不改共享状态文档。
- 独占槽位：`runtime/wt/general-5`；owner/task：`feedback10-qr`；分支：`codex/feedback10-qr-20260911`。租约令牌及依赖指纹保留在 ignored pool 状态中及任务交接回复。
- `TASK_LEVEL=L1`、`DEPENDENCY_MODE=REUSE_ONLY`、`DEPENDENCIES_REUSED=true`、`INSTALL_INVOKED=false`、`HIGHEST_GATE=targeted-node-tests`。
- 护栏 `RESULT=PASS`；`SKILL_HASH=ab6fbe5f43a4aa32ab320fe630a6c668e77b3e711a1f211c72d79ed75e3d980c`。
- Acquire 内部 ReuseOnly 与 mini Bootstrap 均通过，contracts/client-core/presentation-core 全部复用，built=[]。

## 根因与引入点

- F10-QR-01 / P1：读取二维码、轮换访客码缺少 group/generation/disposed 校验；旧异步请求能覆盖切群后的二维码，轮换后已显示的旧二维码未清除。高置信；静态代码和失败测试证明。
- F10-QR-02 / P2：没有用户主动保存入口；管理操作与访客操作用两个常驻成功 alert 展示反馈。高置信；WXML 和控制器检查证明。
- 两者源自 `ddd5c107`（`feat(miniprogram): add p8 invite visitor access`）；QR 保存属于已批准的新行为，不是既有下载能力回归。
- 查证命令：`git log -3 --oneline -S 'async function loadQr' -- apps/miniprogram/src/subpackages/organization/components/invite-visitor-panel/controller.ts`；对同文件执行 `git blame`；对面板 WXML 执行 `git log -3 --oneline -S 'visitorMessage' -- <路径>`。
- 后续邀请请求已有 generation 防护，但 QR 两个调用点仍遗漏；本轮只在批准范围补齐。

## 实现与行为变化

1. 原有 QR 读取仍只在内存中显示；仅点击“保存到相册”后，将当前显示的 PNG base64 原字节写入随机命名 `.png`，再调用 `wx.saveImageToPhotosAlbum`，无重绘/压缩/重新取码。
2. 临时文件位于 `wx.env.USER_DATA_PATH`，生命周期由本次保存拥有；成功、取消、拒绝、保存异常、写入失败和失效上下文都执行 unlink。写入失败也尝试清理可能的部分文件。清理失败不冒充成功，仅返回固定分类，不暴露路径/原生错误。
3. 权限拒绝后显示用户主动点击的 `open-type="openSetting"` 按钮；返回后提示再次点击保存，无自动设置跳转或保存重试。
4. group + 页面 generation + QR generation + disposed 校验覆盖 capability await、读取、轮换、写文件后的相册调用及结果回流。切群、空群、轮换、关闭、卸载立即失效旧图。
5. 保存任务锁在首次 await 前取得，直到原生回调和 unlink 都结束才释放；切群不会提前解锁。读取/轮换也有同上下文并发保护。
6. 生成、撤销、读取、轮换、保存及其错误统一使用一个 `ui-toast` 和既有 `info-message-lifetime` 两秒计时器；新提示替换旧计时器，切群/卸载清理。页面加载错误卡片和重新加载按钮保留。
7. 管理角色继续由原 `canManage` 决定；仅群主可轮换，管理员可读取，访客/普通成员不能因此获得管理或保存权限。群组切换清空旧权限/操作缓存，等待新群组数据。
8. 原有 management/visitor 状态字段兼容保留，UI 只展示统一 infoMessage；邀请幂等键、参数、转发和撤销确认语义保留。方法调用仍以原 page/client 接收者执行。

## 测试先行与验证

所有命令均从独占槽位根目录运行，Vitest 通过 Mini 包过滤器在正确 cwd 执行；未运行安装、全套 verify、完整 build 或原生 DevTools。

```powershell
scripts/codex/manage-worktree-pool.ps1 -Action Acquire -Profile mini -BaseRef main -Role general -Index 5 -Owner feedback10-qr -TaskId feedback10-qr -BranchName codex/feedback10-qr-20260911 -TtlMinutes 120 -Json
pnpm --filter @schedule/miniprogram exec vitest run scripts/p8-organization-d-controller.test.mjs scripts/p8-organization-d.test.mjs --fileParallelism=false
pnpm --filter @schedule/miniprogram exec vitest run scripts/feedback10-qr.test.mjs --fileParallelism=false
pnpm --filter @schedule/miniprogram exec vitest run scripts/feedback10-qr.test.mjs scripts/p8-organization-d-controller.test.mjs scripts/p8-organization-d.test.mjs scripts/organization-direct-pages.test.mjs scripts/thin-page-boundary.test.mjs scripts/p8-component-registration.test.mjs scripts/feedback8-invite.test.mjs scripts/ui-toast.test.mjs --fileParallelism=false
pnpm --filter @schedule/miniprogram typecheck
```

- 修改前：原有2文件/8项通过，1.41秒；新增初始25项 RED（16:04:29，缺失保存适配器/handler，旧 QR 回流、轮换未清图、toast/配置断言失败）。RED 为本任务工具输出，不伪造原始日志文件。
- 实现后：初始25项与原有8项全部 GREEN；再补充7项边界用例，最终新增32项通过。
- 最终组合：8文件/81项全部通过、0跳过，16:10:14，4.87秒。日志：槽位内 ignored `runtime/audit/feedback10-qr/green.log`。
- 共享 `ui-toast.test.mjs` 原总表明确断言邀请面板不得使用 toast，与已批准行为冲突；先记录其失败，再只调整邀请面板条目为新正向断言。其他面板/通知/测试工具断言不变。
- Mini `typecheck`、改动 TS/MJS 的 `pnpm exec eslint <显式文件> --max-warnings=0`、显式文件 Prettier 检查和 `git diff --check` 通过。
- TS/MJS格式路径：新适配器、面板 controller、新 QR 测试、共享 toast 测试；JSON 为面板及直接页面。WXML 以 `pnpm exec prettier --check --parser html <面板WXML>` 验证。
- 子任务未执行全套编译、包体积/最大文件测量或性能测试，遵照主任务的CPU协调安排；整合后由主任务完成这些检查，不把旧版本产物当成本轮构建证据。

## 交接与限制

- 改动文件：面板 `controller.ts/index.wxml/index.json`；直接页面 `index.json`；新 `platform/visitor-qr-image.ts`；新 `scripts/feedback10-qr.test.mjs`；共享 `scripts/ui-toast.test.mjs` 仅邀请断言；本证据文件。
- 未修改 exports、微信通知实现、test-tools、后端、依赖、`docs/project-status.md` 或 `docs/audit/STATUS.md`。
- 本轮不提交、不推送、不上传、不发布，不释放带未提交补丁的槽位；交接后由集成协调者处理。
- 若其他并行任务也改 `ui-toast.test.mjs`，仅合入本轮邀请条目，避免覆盖对方其他条目。
- 微信原生相册 API 发出后不可由本层撤回；迟到回调只触发文件清理，不更新失效页面。文件系统拒绝 unlink 时无法保证实际删除，已单独返回失败分类，无自动重复。
- 官方微信 API 网页读取被工具拒绝，未引用第三方页面替代官方依据；本轮验证为本地接口适配与合成回调测试。
- 小米14实际相册保存、拒绝后设置、取消、快速切页、toast 原生视觉以及 Console/Network/冷启动：当前工具无法测量，暂未验证。
- 唯一下一步：整合独占分支补丁并协调共享测试条目；最终构建/上传由主任务另行授权和执行，再按对应版本在小米14复核。
