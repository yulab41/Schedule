# 微信小程序专项文档

本目录是微信小程序迁移的唯一详细文档源。根 `docs/project-status.md` 只记录当前批次、验证、checkpoint、阻塞项和本目录链接。

## 文档入口

- 总计划：[`plans/2026-08-17-wechat-miniprogram-migration-plan.md`](plans/2026-08-17-wechat-miniprogram-migration-plan.md)
- 运行与构建：[`architecture/runtime-and-build.md`](architecture/runtime-and-build.md)
- API 边界：[`architecture/client-api-boundary.md`](architecture/client-api-boundary.md)
- 分包布局：[`architecture/package-layout.md`](architecture/package-layout.md)
- Web 同步策略：[`architecture/web-sync-policy.md`](architecture/web-sync-policy.md)
- 视觉标准：[`design/visual-parity-standard.md`](design/visual-parity-standard.md)
- P1 视觉确认：[`design/p1-visual-confirmation.md`](design/p1-visual-confirmation.md)
- 组件清单：[`design/component-inventory.md`](design/component-inventory.md)
- 页面黄金清单：[`design/page-golden-manifest.md`](design/page-golden-manifest.md)
- 测试总则：[`testing/test-plan.md`](testing/test-plan.md)
- 设备矩阵：[`testing/device-matrix.md`](testing/device-matrix.md)
- CI、用户人工原生验收、环境与发布：[`runbooks/`](runbooks/)
- 已冻结决策：[`decisions/`](decisions/)

## 文档维护规则

- 公共契约、产品、安全或隐私选择只在总计划和 ADR 中各保留一个权威结论；专题文档链接到该结论，不复制出第二套状态。
- 页面实现开始前补齐黄金清单；RC 前补齐真实截图、比较报告和用户确认结果。
- 文件中出现“待实施”表示已批准但尚未完成，不表示允许改变范围。
