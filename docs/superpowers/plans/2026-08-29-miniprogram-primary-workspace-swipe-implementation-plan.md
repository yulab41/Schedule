# 小程序五入口 `.67` 原生横滑实施计划

- 设计：`../specs/2026-08-29-miniprogram-primary-workspace-swipe-design.md`
- 基线：`main@b032edee`
- checkpoint：`feat(miniprogram): enable negotiated workspace swipe`
- 体验版本：`0.1.0-p9.20260829.67`

## Task 1：冻结手势所有权红灯

扩展 primary workspace、calendar、directory、workflow picker/host、Profile 与 F 区测试。旧 `.66` 必须
失败于开关关闭、无 shared negotiation、程序 change 未按 source 区分、无 scoped lock、inner swiper
未声明优先级和 F 区没有 `.67` 证据。

## Task 2：外层 native swiper 状态机

初始化 enabled/index/locked/inner-claimed/window-width shared 值；外层增加 accept/respond/end 回调与
24px edge guard。touch change 才提交 workspace；点击使用 transition serial 执行 duration 0 → 240，
native touch 保持 240ms 吸附。点击和 touch 都不销毁 workspace。

## Task 3：内层 horizontal handler

为 calendar-month、week、list 和 directory-mode swiper 增加 simultaneous handler。组件通过公开方法
接收父 shared claim；Page 在 ready/active 渲染后重新连接。END/CANCEL/scrollend 全部清 claim。

## Task 4：弹层、picker 与作用域锁

建立 source/workspace lock registry。接线群组菜单、日历筛选、通知 Sheet、directory filter、Profile
密码 Sheet 与 workflow picker open/close；Page hide 暂停、onShow 重算、unload 清 registry。补快速切
workspace 后非活动锁不污染当前页、返回原 workspace 和前后台后恢复锁的回归。

## Task 5：Workspace F 与 DevTools 门禁

F 区显示 swipe enabled、touch change count、active index、锁和 inner claim 状态，并列出慢拖/flick/
反向/首尾/inner/Sheet 清单。使用 Nightly wechatide 完成 390px 与 320px 自动化；console/network 零新增
错误，请求计数不因纯切换增加。

## Task 6：验证、checkpoint 与 `.67`

运行定向红绿、Mini 全量/typecheck/verify/determinism/source/package/performance/CI、根 build/typecheck/
test、任务 Prettier/ESLint、diff check 与 core smoke；WXS SHA 不变且 main <1.8MB。

显式暂存、提交并推送后，从 exact clean commit 上传 `.67`。按仓库规则创建生产备份、部署或 trusted
reuse、allowlist ensure/verify、七维 capability、unknown=426、公网 full verifier 与远端清理。未通过
inner conflict 门禁则恢复 false 并停止；不提交审核、不正式发布。
