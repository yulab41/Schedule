# 法定节假日数据

年度 JSON 文件供离线导入和 API 管理使用。当前数据：`holidays-2026.json`，39 条日期，包含放假日和调休上班日。

## 常用操作

```powershell
pnpm holidays:build
pnpm holidays:import
```

正式导入前先校验年份、来源、版本和日期数量；确认后通过 Web/API 读取。历史版本不得被新年度覆盖。
