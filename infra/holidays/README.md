# 法定节假日数据

年度 JSON 文件供 Web 离线导入和 API 管理使用。当前 `holidays-2026.json` 包含 39 条日期：33 个放假日和 6 个调休上班日。

## 校验结论

2026 年两份来源按 366 天逐日比对，放假/调休状态和名称一致，差异为 0；数据可作为 Web 导入源。

## 常用操作

```powershell
pnpm holidays:build
pnpm holidays:import
```

正式导入前校验年份、来源、版本和日期数量；确认后通过 Web/API 读取。历史版本不得被新年度覆盖。
