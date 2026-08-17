# 视觉基线与比较器

## 基线元数据

每张基线记录：Git commit、Story ID、fixture 名称与 hash、视口、系统字号、主题、页面状态、Mini 基础库/客户端、设备/OS、遮罩版本和生成时间。截图二进制存入 `.artifacts/` 或 CI artifact，不进入 Git。

## 固定视口

- Web 黄金：390×844。
- Web 边界：320×844。
- MiniTest：固定 Android 与 iOS 机型，实际型号在 `device-matrix.md` 首次可用时锁定。
- 用户实体机：当前 Android，记录型号、OS、微信版本和显示/字体缩放。

## 自有比较器输出

```json
{
  "stableRegionSimilarity": 0.98,
  "significantPixelRatio": 0.02,
  "maxKeyGeometryDeltaPx": 2,
  "maskVersion": "v1"
}
```

三个门槛必须分别通过。比较器输出差异热图和关键几何明细；MiniTest 官方 SSIM 作为附加门禁，不替代项目三指标。

## 遮罩规则

仅允许状态栏、安全区、系统键盘、时间/电量、字体亚像素栅格和经批准的动态原生区域。遮罩以页面+状态版本化，变更必须经过审阅；业务卡片、文字、按钮、日历格、冻结层和错误反馈不得遮罩。
