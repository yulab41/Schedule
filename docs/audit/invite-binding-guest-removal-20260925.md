# 邀请绑定页访客清理与布局修复（2026-09-25）

## 结果

扫码进入的成员/管理员绑定预览页不再包含访客入口、访客二维码或访客提示。独立 `pages/guest-entry` 的 TypeScript、WXML、WXSS、JSON 均未修改。绑定页只保留一次“确认绑定”和一个独立“返回登录页面”操作；返回登录带 `forceLogin=1`，已有微信会话也不会自动跳回工作台。

绑定预览成功读取、链接失效、账号已绑定等通知使用限时 `ui-toast`；持久页面只保留如何重新获取链接的说明。确认与返回操作垂直分开，通知不会压住内容。

## 来源与根因

`git log -S '暂不绑定，进入访客页面' -- apps/miniprogram/src/pages/admin-bind/preview.wxml` 和 `git log -S 'handleGuest' -- apps/miniprogram/src/pages/admin-bind/preview.ts` 将当前入口定位到 `162ef4c1`。`git blame` 显示访客说明与按钮由该提交加入。成员邀请页和平台管理员绑定链接共用 `pages/admin-bind/preview`，所以访客按钮同时出现在预览及错误状态。

用户最终明确邀请绑定页不应承载访客功能，并要求现有访客页保持原样。修正将访客跳转与提示从绑定预览删除，没有删除访客页面或其路由。

## 行为变化

- 绑定预览只显示确认绑定动作；错误状态不显示访客入口。
- 所有绑定状态均提供返回登录；`forceLogin=1` 绕过自动会话恢复，登录页保持可见。
- 绑定结果细节由有时限的 toast 呈现，离页时清除提示计时器。
- 身份页样式复用现有登录页字体、卡片和间距；390px 与 320px 检查覆盖预览和错误状态。

## 验证

- 定向 Node/Vitest：4 个文件、15 项通过；包括无访客引用、返回登录、已有会话不自动跳转、失败 toast 自动清理。
- Chrome CSS 几何代理：390×844 和 320×844 的绑定预览与错误状态截图均通过；确认操作、返回操作、toast 之间无交叠且无水平溢出。图像位于 ignored `runtime/codex/invite-bind-layout/`，属于浏览器代理证据，不代表微信原生或小米 14 验收。
- `pnpm miniprogram:verify`（最终源码）：通过；生产总包 4,802,913 B、主包 1,825,803 B。相对已上传 `.192` 报告中的 4,801,680 B，净增 1,233 B；该差值包含本轮返回登录及瞬时提示实现。与开始时未最终清理的工作副本 4,803,198 B 相比减少 285 B。既有主包阈值与矩阵节点警告未变化。
- `pnpm verify`（修复状态文件长度门禁后复跑）：通过；Mini 1262 项通过、17 项跳过，根 1306 项通过、451 项跳过。`pnpm smoke:check-core`：通过。

## 发布与下一步

本轮没有体验版上传、提审、正式发布、生产部署或生产数据操作。当前已上传 `.192@162ef4c1` 不含本轮修复，因此小米 14 仍待同 SHA 体验版复核。仓库 Mini 发布规则要求当前轮次对具体 checkpoint 授权后再分配版本；状态为 `UPLOAD_REQUIRED`，在该授权到达前停止于版本分配之前。

checkpoint commit message：`fix(miniprogram): remove guest actions from binding screens`。
