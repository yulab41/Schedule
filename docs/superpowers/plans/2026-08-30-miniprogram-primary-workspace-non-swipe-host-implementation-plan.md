# 小程序工作台无外层滑动宿主实施计划

- 设计：`../specs/2026-08-30-miniprogram-primary-workspace-non-swipe-host-design.md`
- 基线：`main@ad0459e5`
- 目标 checkpoint：`fix(miniprogram): remove native workspace swipe host`
- 目标体验候选：`0.1.0-p9.20260830.68`

## Task 1：冻结真机空白屏结构红灯

修改 `scripts/primary-workspace-shell.test.mjs`，要求工作台顶部、无滑动宿主、底栏各一个，五个
常驻内容槽顺序固定；禁止外层 `workspace-swiper`、`workspace-swiper-item`、
`primary-workspace-swiper` handler 和 change 回调。另从通讯录组件模板断言
`directory-mode-swiper` 仍存在。

修改 `scripts/workbench-runtime.test.mjs`，冻结 Page 不再注册外层 swipe/change/worklet 回调；保留
五入口点击同步 workspace/index、只首次挂载和二级 Page 导航契约。先运行定向测试，旧代码必须失败。

## Task 2：替换外层展示宿主

在 `pages/workbench/index.wxml` 中把外层 handler/swiper/swiper-item 替换为一个确定高度的
`workspace-host` 与五个兄弟 `workspace-pane-slot`。`hidden` 只控制 slot 可见性，组件的
`workspaceMounted`/`workspaceReady` 条件、active/group 属性和事件保持原样。

在 `index.wxss` 中把外层绝对定位与满高规则迁移到 host/slot；不改变顶部、底栏、安全区、内部
scroll-view、通讯录、日历、换班、Profile 或更多内容样式。

在 `index.ts` 中删除只服务于外层原生 swiper 的 `handleWorkspaceSwiperChange`、
`shouldPrimaryWorkspaceRespond` 和 Page data 中的 swipe flag 副本；保留
`activeWorkspaceIndex`、`workspaceGestureLocked`、串行预载和 `buildInfo` 中永久关闭的产品契约。

## Task 3：红绿与语义审计

运行 primary shell/workbench runtime/directory 双页定向测试，再运行任务文件 Prettier、ESLint 与
TypeScript。逐调用点确认 receiver、Promise/catch、空值、权限、请求与业务副作用次数未变；记录
引入提交 `4fe1b5e7` 和真机/DevTools 差异到 debug/status/pitfall。

## Task 4：非开发者工具自动门禁与实体门禁

用户明确禁止使用微信开发者工具作本轮验证，不调用模拟器、编译器、自动化或电脑控制。用结构测试
证明工作台没有外层 native swiper/handler、五槽位固定且通讯录内部 swiper 保留；用 Page/组件运行
测试证明五入口点击、挂载一次、状态保留、无权限零请求和通讯录模式状态机不变。生产构建、确定性、
source/package/performance/CI 证明可发布性；普通区域拖动和通讯录内部左右滑动只在 `.68` Android/iOS
体验版执行实体确认。

## Task 5：全量、checkpoint 与 `.68`

运行 Mini 全量/typecheck/production verify/determinism/source/package/performance/CI dry-run、根
build/typecheck/test、`pnpm smoke:check-core` 与必要的发布门禁；WXS source/output SHA 必须与 `.66`
一致且 main 低于 1.8MB。

更新 project status/debug/pitfall，显式暂存本批文件并逐行审阅；提交、推送后从 exact clean commit
创建生产备份，按哈希执行完整部署或 trusted reuse，并用公网 full verifier 验证。随后从同一 commit
上传 `.68`，执行正式 allowlist ensure/verify、七维 capability 与 unknown=426；清理远端临时目录。
不创建 `.67`，不提交审核，不正式发布。

停止于 `.68` 待 Android/iOS 实体确认：普通区域完全无全局横移或白屏，五入口点击正常，通讯录
内部左右滑动正常。
