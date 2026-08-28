# 小程序登录会话连续性实施计划

- 日期：2026-08-27
- 基线：`main@299aaefd`
- 状态：Task 1–5 已完成，Task 6 待 checkpoint/体验上传/生产同步
- 设计：[`../specs/2026-08-27-miniprogram-login-session-continuity-design.md`](../specs/2026-08-27-miniprogram-login-session-continuity-design.md)
- 范围：跨 bundle 会话状态、登录后导航、P3 登录视觉黄金与原生页面

## 并行工作树边界

以下内容在本计划开始前已由用户或并行任务维护，不得修改、暂存或提交：

- 通知 API/client-core/Mini controller、页面、工作台接入、UiSheet 与通知视觉稿；
- `apps/miniprogram/project.config.json`；
- `apps/miniprogram/scripts/group-settings-page.test.mjs` 与群组成员 WXML；
- Web UI2 草稿、`.agents/`、根 `src/`、`runtime/` 与工作簿。

登录实现不得修改当前脏的 `workbench*` 测试或页面；profile 验证使用独立测试或既有未修改文件。

## Task 1：冻结跨 bundle 与成功导航红灯

修改：

- 新增 `apps/miniprogram/scripts/session-runtime-cross-bundle.test.mjs`。
- 扩展 `apps/miniprogram/scripts/p3-identity-controller.test.mjs`。
- 扩展 `apps/miniprogram/scripts/identity-pages.test.mjs`。
- 更新 `apps/web/src/stories/miniprogram/p3-identity-security-preview.spec.ts` 的登录黄金约束。

红灯要求：

1. 第一份 identity 模块执行清会话；重置模块缓存后第二份模块写入 D0468 形态会话；第一份模块必须
   能读取新 profile。旧实现因 bundle-local invalidation 返回 `undefined`。
2. 密码、微信 authenticated、密码绑定、首次建档成功各调用一次
   `wx.reLaunch('/pages/workbench/index')`，旧实现只进入 `mode='authenticated'`。
3. 有效既有会话的 `onLoad` 直接跳转；`link_required` 不跳转。
4. WXML 不含“身份已确认”成功块，登录页包含 Web 标题、账号/密码、主按钮、“或”及微信快捷登录，
   且不含“访客查看排班”和红线删文案。

验证：

```powershell
pnpm --filter @schedule/miniprogram exec vitest run `
  scripts/session-runtime-cross-bundle.test.mjs `
  scripts/p3-identity-controller.test.mjs `
  scripts/identity-pages.test.mjs `
  --fileParallelism=false
pnpm exec vitest run apps/web/src/stories/miniprogram/p3-identity-security-preview.spec.ts
```

## Task 2：建立 App 级会话运行时

修改：

- 新增 `apps/miniprogram/src/platform/wechat-session-runtime.ts`。
- 修改 `apps/miniprogram/src/app.ts`。
- 修改 `apps/miniprogram/src/platform/wechat-identity.ts`。

实现：

- App `globalData` 初始化共享 `{ invalidated, generation, recoveryPromise }`。
- 所有会话读取、清理、持久化、401 恢复与 generation 检查只通过 accessor 访问该对象。
- `getApp` 不可用时保留测试/启动前模块 fallback。
- 不把 token、profile、用户名或请求正文放入共享控制对象或遥测。

等价审计：

- 保持密码 401 不触发 `wx.login`；微信 401 继续单飞。
- 保持物理删除失败仍 fail closed、旧 token 不能复活、跨 owner 先清私有缓存。
- 保持 Promise reject/catch 范围、token 比较、generation 增量和业务请求次数。

## Task 3：登录成功直达工作台

修改：

- 修改 `apps/miniprogram/src/pages/identity/index.ts`。
- 修改 `apps/miniprogram/src/pages/identity/index.wxml`。

实现：

- 从 `IdentityMode` 删除普通 `authenticated` 页面态。
- 四条认证成功路径先持久化，再 `wx.reLaunch({ url: '/pages/workbench/index' })`。
- 有效旧会话的 `onLoad` 同样直达工作台。
- `reLaunch` 失败时保留会话、恢复按钮并显示明确错误，不自动重复登录。
- `link_required`、choice/password/register 与管理员 URL Link 页面不变。

## Task 4：对齐 Web 登录视觉黄金与原生页面

修改：

- 更新 `apps/web/src/stories/miniprogram/P3IdentitySecurityPreview.vue` 与相关 Storybook 断言。
- 修改 `apps/miniprogram/src/styles/identity.wxss` 与登录 WXML。
- 新增与现有线性图标一致的 Mini 锁图标 SVG；账号图标复用既有 profile SVG。

视觉：

- 蓝色 52px 加号、标题“清楚掌握每一次值班”、白色账号/密码卡片、主按钮“进入工作台”、
  “或”分隔线、微信快捷登录、卡外隐私说明和弱化 build label。
- 不显示 eyebrow、登录说明、管理员说明、访客按钮、ICP 页脚、旧“排”标和普通登录确认页。
- 390×844、320px、大字号、键盘滚动、无横溢、48px 输入与至少 44px 触控区。

## Task 5：完整验证与记录

运行：

```powershell
pnpm --filter @schedule/miniprogram exec vitest run `
  scripts/session-runtime-cross-bundle.test.mjs `
  scripts/p3-identity-controller.test.mjs `
  scripts/identity-pages.test.mjs `
  scripts/p6-runtime.test.mjs `
  scripts/p10-profile-native.test.mjs `
  --fileParallelism=false
pnpm miniprogram:test
pnpm --filter @schedule/miniprogram typecheck
pnpm --filter @schedule/miniprogram verify:production
pnpm --filter @schedule/web test -- p3-identity-security-preview.spec.ts
pnpm --filter @schedule/web build-storybook
pnpm smoke:check-core
```

另行执行任务文件 Prettier/ESLint、Mini 确定性/包审计/CI dry-run、`git diff --check`。用 Storybook
实际截图复核 390/320 与大字号，不控制或自动化微信开发者工具。将引入点、红绿结果、视觉截图、
行为变化清单和“运行/浏览器验证”写入精确调试轮次。

## Task 6：checkpoint、生产与体验轨道

1. 更新 `docs/project-status.md`，显式暂存登录任务文件，审阅 staged diff 后提交
   `fix(miniprogram): preserve session across login bundles`。
2. 推送 `main`，从精确干净 release worktree 打包，创建生产加密备份并按 manifest hash 完整部署或
   reuse，运行带公网 IP full verifier。
3. 从同一代码 checkpoint 以 production profile 上传当时的下一单调体验版本；用正式
   `schedule-client-version-allowlist ensure/verify` 追加并复核七维 capability 与 unknown=426。
4. 提交最终状态 checkpoint 并再次同步 production release。
5. 停止于“待用户实体 Android 复核”：切换/退出后登录 D0468、admin、直接进入主页、我的资料、
   390/320 登录布局。不得提交审核或正式发布。
