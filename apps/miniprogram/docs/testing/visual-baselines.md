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

当前实现为 `scripts/visual-compare.mjs`，算法固定如下：

- `stableRegionSimilarity`：稳定区逐像素 RGB 绝对差的归一化相似度；透明像素先合成到白底。
- `significantPixelRatio`：稳定区中任一 RGB 通道差值大于 24 的像素比例。
- `maxKeyGeometryDeltaPx`：同名关键元素 `x/y/width/height` 的最大绝对偏差。
- 图片尺寸、遮罩尺寸或关键元素不一致时直接失败，不做隐式拉伸、裁切或补齐。
- 输出 `report.json` 和 `diff.png`；CLI 强制输出到 Git 忽略的 `apps/miniprogram/.artifacts/`。

原生截图若不是黄金图的 390×844 尺寸，必须先按锁定设备的逻辑视口生成同尺寸 Web 黄金图；不得由比较器静默缩放。首次 MiniTest 运行拿到设备和截图元数据后，锁定该设备的 Web viewport 与截图导出步骤。

命令：

```powershell
pnpm miniprogram:visual-compare -- `
  --baseline=<golden.png> `
  --actual=<native.png> `
  --mask=<mask.json> `
  --expected-geometry=<golden-geometry.json> `
  --actual-geometry=<native-geometry.json> `
  --output=apps/miniprogram/.artifacts/visual/<case-id>
```

遮罩 JSON：

```json
{
  "version": "p1-v1",
  "width": 390,
  "height": 844,
  "regions": [{ "x": 0, "y": 0, "width": 390, "height": 24, "reason": "status-bar-clock" }]
}
```

几何 JSON：

```json
{
  "elements": {
    "calendar-surface": { "x": 10, "y": 144, "width": 370, "height": 414 }
  }
}
```

## 遮罩规则

仅允许状态栏、安全区、系统键盘、时间/电量、字体亚像素栅格和经批准的动态原生区域。遮罩以页面+状态版本化，变更必须经过审阅；业务卡片、文字、按钮、日历格、冻结层和错误反馈不得遮罩。

比较器只接受 `status-bar-*`、`safe-area-*`、`system-clock-*`、`system-keyboard-*`、`font-raster-*` 和经审阅的 `approved-native-*` 原因；越界、空版本、全屏遮罩和业务区域遮罩均失败关闭。没有动态区域时允许 `regions: []`。
