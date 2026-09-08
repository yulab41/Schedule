# Feedback6 浏览器触摸门禁稳定性

- 引入点：`git log -S 'await page.waitForTimeout(80)'` 与 blame 指向 `0aaa5620`。原检查仅在触摸后80ms读取一次样式。
- 原脚本两次在周切换按钮反馈处失败；保留 `runtime/audit/feedback6/accounts-browser-smoke.log`、`accounts-browser-smoke-retry.log`。此时API/Web正常、构建及数据库测试已结束。
- ignored副本只增加DOM取证，未改断言：坐标仍命中按钮SVG，未禁用、scrollY=0，布局显示42px缩放；仅增加取证读取后完整流程通过。日志为`accounts-smoke-debug.log`，与正式门禁分别记录。
- 改动仅将固定单次采样换成500ms内轮询同一计算样式条件，仍要求背景与缩放同时存在；不改页面class/style、点击坐标、禁用判定或释放后断言。超时输出实际样式并失败。
- 运行/浏览器验证：`pnpm smoke:browser` 对应原 `scripts/smoke-browser.mjs` 通过既有本地内存配置适配器运行，全流程通过（登录/管理员/成员/访客/访问记录，无浏览器错误）。日志`accounts-browser-smoke-final.log`；仅本地合成管理员标记临时调整并恢复。
- 检查点：`test(smoke): wait for observable calendar press feedback`。账号业务代码仍在独立检查点验证；未部署、上传或宣称原生验收。
