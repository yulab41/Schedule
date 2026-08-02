# 法定节假日数据集

本目录存放按年度整理的官方节假日数据，供离线导入器与线上导入接口使用。

## 2026 年（已确认上线）

- 数据来源：《国务院办公厅关于2026年部分节假日安排的通知》（国办发明电〔2025〕7 号，2025-11-04），中国政府网：
  <https://www.gov.cn/zhengce/content/202511/content_7047090.htm>
- 文件：`holidays-2026.json`，共 39 条（33 个放假日 + 6 个调休上班日）。
- 线上状态：2026-08-03（北京时间）已通过 CloudBase 环境 `schedule-dev-d1geh4w1l4af7359d` 的节假日管理 API 导入并确认。
  - 版本：`2476826f-389e-4304-bf53-85ceb5d730e8`（version 1，confirmed）
  - 验证：`GET /api/holidays?year=2026` 返回 `confirmed: true` 与 39 条日期；`GET /api/holidays/coverage` 显示 `confirmedYears: [2026]`。

## 导入方式

### 线上（推荐）

调用管理员 API（账号需在 `HOLIDAY_ADMIN_UIDS` 白名单）：

1. `POST /api/holidays/import-preview`（body 为该 JSON，只预览差异）
2. `POST /api/holidays/import`（创建草稿版本，返回 `calendarVersionId`）
3. `POST /api/holidays/versions/:calendarVersionId/confirm`（确认后日历/统计生效）

### 离线导入器（需要能直连 MySQL）

```powershell
pnpm holidays:build
node --env-file=.env infra/scripts/dist/import-holidays.js --file=infra/holidays/holidays-2026.json --year=2026
```

离线导入只写草稿，确认仍需走线上确认接口。

## 注意事项

- `packages/test-fixtures` 中的节假日数据是合成测试数据，不得作为正式数据导入。
- 新年度数据发布后，先核对官方通知（国务院办公厅），再按本目录格式新增文件并走线上导入确认。
