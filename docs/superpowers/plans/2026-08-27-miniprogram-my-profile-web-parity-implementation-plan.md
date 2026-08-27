# 小程序“我的”页 Web 对等与微信头像实施计划

- 日期：2026-08-27
- 基线：执行时以最新 `main` 与 `docs/project-status.md` 为准
- 状态：用户已批准设计，Task 1 待红灯
- 设计：[`../specs/2026-08-27-miniprogram-my-profile-web-parity-design.md`](../specs/2026-08-27-miniprogram-my-profile-web-parity-design.md)

## 并行工作树边界

登录会话连续性、通知 Sheet、通讯录、群组权限、Web UI2 草稿、Worklet 证据、`runtime/`、根 `src/`
和用户配置均为并行用户内容。本批不整文件暂存这些路径；必须等相应 checkpoint 落地后基于最终
HEAD 做最小集成；并行 checkpoint 未落地前不修改其占用文件。

## Task 1：共享个人值班模型红绿与兼容契约

1. 先扩展 `@schedule/presentation-core` 测试，证明 Web 当前成员、趋势、特殊日期、下一班和空态
   结果不变；旧共享包因没有 Profile 模型而红。
2. 迁入 `MyProfileOverview` 纯函数并从包入口导出；Web 改用共享导入，删除 Web 私有副本。
3. 为 `UserProfile.avatarVersion?: number` 添加 contracts、严格 schema、生成 schema 和兼容测试；
   当前 API 暂不返回新字段，先部署读取兼容层。
4. 审计 receiver、Promise/catch、`??`/可选字段、请求次数和副作用；本 checkpoint 不改 Web UI。

## Task 2：头像与当前小程序绑定后端

1. 先写 migration/schema 与 API 单元/集成红灯：认证、用户隔离、MIME/魔数、1 MiB、版本递增、
   幂等删除、ETag、绑定状态、密码资格和不泄露微信标识。
2. 新增 schema 52 的 `user_profile_avatars` 表；每用户一行，事务内最后成功写入并递增独立版本。
3. 实现 `PUT|GET|DELETE /users/me/avatar`；Fastify 只为允许的图片 MIME 解析 Buffer，并以 route
   bodyLimit 阻断超限请求。
4. 实现 `GET /me/wechat/miniprogram/binding`，按当前配置 AppID、`user_auth_identities` 和可用密码
   凭据计算 `{ bound, canUnbind }`。
5. 所有 profile 构建路径返回可选 avatarVersion；旧客户端忽略新字段，新 Web 已在 Task 1 接受。

## Task 3：Mini 媒体客户端与登录刷新

1. 先写 Mini 红灯覆盖 chooseAvatar tap/回调竞态、取消、未知微信后绑定/建档、密码登录清 pending、
   上传失败不阻断、版本缓存和退出清本地文件。
2. 新增独立 profile-media 模块：待上传路径、认证二进制上传/下载、userId/version 缓存、恢复首字和
   非敏感错误映射；不把图片或 token 写入日志/遥测。
3. 微信快捷登录改用封装 native `button open-type=chooseAvatar` 的叶组件；普通 press 继续登录，
   chooseavatar 只记录路径。建立会话后的工作台/Profile 生命周期统一 flush pending 上传。
4. 密码登录删除 pending；上传失败保留旧头像并一次提示。并行登录连续性实现已落地时复用其
   App singleton/reLaunch，不复制第二套会话状态。

## Task 4：Mini Profile Web 1:1 页面与交互

1. 先扩展 P10 controller/native/page-boundary 测试，覆盖群组变化、陈旧请求、部分失败、访客、
   无群组、导航、密码 proof、绑定/解绑和头像删除；旧页面稳定红。
2. Profile controller 使用运行时 organization/insights/calendar clients 和共享模型；嵌入组件显式
   接收当前群组，独立 Page 从 owner-scoped snapshot 解析。
3. WXML/WXSS 按 Web Production 顺序与 token 重绘；只增加两条 Mini 账户行，深蓝下一班卡保持唯一
   视觉签名。更新 390/320/大字号 Storybook 状态映射与 P10 RC 清单。
4. 统计进入现有 insights Page；日历通过组件事件切换工作台；密码表单复用并行通知 checkpoint
   落地后的 UiSheet，成功后清会话并 reLaunch 登录；解绑沿用现有确认页。

## Task 5：完整验证、checkpoint 与发布

1. 运行任务文件 Prettier/ESLint、定向 tests、`pnpm miniprogram:test`、`pnpm test`、build、typecheck、
   `pnpm smoke:browser`、`pnpm smoke:check-core`、Mini production verify、确定性、package、CI dry-run。
2. 逐行审阅 unstaged/staged diff并记录行为变化；任何并行文件只以本批 hunk 暂存，clean worktree
   必须复验提交自身可构建。
3. 按“共享兼容 → 数据库/API → Mini 完整功能”建立可独立回滚 checkpoint。每个 checkpoint 更新
   project status、推送、生产备份、部署和 full verifier。
4. Mini checkpoint 从同一精确 commit 上传下一单调 production-profile 体验版，执行正式
   allowlist ensure/verify、七维 capability 与 unknown=426；不提审、不正式发布。
5. 最终停止于“待用户实体 Android 复核”，提供版本、commit、固定状态矩阵和 Web 黄金对照。
