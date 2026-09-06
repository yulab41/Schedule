# UX-CLEANUP-10 A 线交付

RUN_ID：ux-cleanup-10-20260906083903；基线 7a2fd348；Q1/Q5。总控负责最终整合、生成解码器与生产发布。

## 已实现待整合运行验证

- Mini 删除照片按钮、登录联动、上传下载、同步重试、版本缓存和头像设置行；所有保留人物标识为文字。
- API 删除照片 GET/PUT/DELETE 路由、图片专用 parser/service/inspection；密码、Mini/Web 微信登录查询不再连接照片表。
- 共享 UserProfile 删除照片字段与头像 mutation/delete 契约。Web 原先已使用文字首字，本轮不改其布局。
- 历史数据库 schema、表、记录、文件和迁移不动；Mini 忽略旧照片字段，定向清理 schedule.profile.avatar.v1: 元数据，不删除文件/会话/偏好。
- 正文重复标题删除；统计按钮局部右对齐；下一班提前、复用白底淡蓝表面，退出登录保留。

## 身份缺口证据

GET /me/wechat/miniprogram/binding 缺少 core 路由分类。分类守卫来源 e25878f01（git log -S 与 blame），本轮回归先实际返回503，再修复为200。
只新增精确 GET 匹配；测试包含 core/global 关闭503、未知版本426、失效会话401、其他方法及相邻路径503。
保留绑定响应与安全校验，失败可手动重试；账号切换使旧绑定结果失效。没有真实用户会话请求，不宣称线上绑定成功。

## 验证

- pnpm exec vitest run apps/api/src/plugins/client-capability-guard.spec.ts apps/api/src/modules/users/user-routes.spec.ts apps/api/src/modules/users/user-profile.spec.ts packages/contracts/src/users.test.ts --fileParallelism=false：12通过。
- Mini 包 cwd 执行 pnpm exec vitest run scripts/profile-panel-controller.test.mjs scripts/profile-photo-retirement.test.mjs --fileParallelism=false：13通过。
- MINI_LAYOUT_BROWSER_PATH 使用已安装 Chrome，MINI_LAYOUT_EVIDENCE_DIR 指向 canonical runtime/codex/ux-cleanup-10-a-layout；Mini cwd 执行 pnpm exec vitest run scripts/profile-identity-layout.test.mjs --fileParallelism=false：13通过。包括390/320及大字号仪表盘、登录焦点/键盘高度和个人设置。浏览器代理非原生证据。
- pnpm --filter @schedule/api typecheck、pnpm --filter @schedule/miniprogram typecheck、定向 ESLint、pnpm icon:parity：通过。
- 全量 verify、生成解码器、pnpm smoke:browser 与生产/体验版证据由总控在最终候选补齐；本线不把定向测试当作全端已发布。
- 没有依赖安装、没有生产写入、没有拨号/退出真实群组等副作用。

## 集成依赖

B 的 workbench 照片调用删除8953e766在本线以e4165e3c复用。C需删除其通知测试中唯一旧头像提示断言。
总控 Q10 后续独占添加 diagnostics 权限路由与会话失效钩子，不与 A 并发改同文件。
