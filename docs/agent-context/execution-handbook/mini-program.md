# 微信小程序执行章节

## 何时读取

修改 apps/miniprogram 源码、构建、包体、上传、平台兼容或实体设备验收时读取本章，
并继续读取 [小程序根规则](../../../apps/miniprogram/AGENTS.md)、[专项文档入口](../../../apps/miniprogram/docs/README.md)
和当前批次链接的计划、设计、测试或 runbook。纯 Web/API、纯文档和纯 Git 审计不加载
miniprogram-development；不因“可能有帮助”加载 wechatide-skill。

## 不可变边界

- LLM 不得启动、唤醒、重启、控制或自动化微信开发者工具 GUI/CLI。允许的 Node 静态构建、
  simulate、miniprogram-ci 和比较脚本不能冒充原生运行时或 Xiaomi 14 证据。
- 生产实现使用原生 WXML、WXSS、TypeScript、JSON、Skyline 和 glass-easel；不引入 WebView、
  uni-app、H5 回退或第三方小程序 UI 库。
- 源码在 src，生成物在被忽略的 dist；不手改 dist，不把 AppSecret、上传私钥、token、session、
  private config、截图、二维码或生产数据放进 Git。
- 共享运行时代码保持 DOM-free、Node-free、database-free、Zod-free；写请求只有有效幂等键时
  允许重试，离线只读且没有写队列。

## 执行顺序

1. 先用当前批次的精确 SHA 建立构建、测试、包体和可获得的运行时基线；只记录真实输出。
2. 涉及手势、页面边界、测试发现、pnpm、release 或版本白名单时，按
   [pitfall index](../pitfall-index.json) 选择对应详情；guard 失败或 staleWhen 命中则重新调查。
3. 先跑最小定向红灯，再做最小修改和同口径绿灯；按活动阶段补齐静态、simulate、Worklet、
   determinism、secret、package-size 和其他明确门禁。
4. 视觉验收按 [visual.md](visual.md)；只有用户操作约定实体设备并明确反馈后，才记录原生通过。

## 上传与生产边界

- 体验上传必须来自最终提交的独立 clean worktree，上传版本不得是 local；记录完整 SHA、
  Node/pnpm、lockfile、profile、版本、描述和脏树状态。
- 上传前必须为该 exact checkpoint 取得用户当次明确批准；提交审核和正式发布始终另需批准。
- Mini-only 或文档-only checkpoint 不自动触发 ECS 备份、production 部署或 release metadata
  同步；这些是独立轨道。详情见 [packaging-upload.md](packaging-upload.md) 和 [production.md](production.md)。
- 真机截图、二维码和日志写入被忽略的 runtime/audit/，跟踪文档只保留页面、时间、SHA、环境、
  renderer 和结论，不记录敏感业务数据。
