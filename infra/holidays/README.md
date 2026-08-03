# 法定节假日数据集

本目录存放按年度整理的官方节假日数据，供离线导入器与线上导入接口使用。

## 2026 年（已确认上线）

- 规范数据文件：`holidays-2026.json`，共 39 条（33 个放假日 + 6 个调休上班日）。
- 线上状态：2026-08-03（北京时间）已通过 CloudBase 环境 `schedule-dev-d1geh4w1l4af7359d` 的节假日管理 API 导入并确认。
  - 版本：`2476826f-389e-4304-bf53-85ceb5d730e8`（version 1，confirmed）
  - 验证：`GET /api/holidays?year=2026` 返回 `confirmed: true` 与 39 条日期；`GET /api/holidays/coverage` 显示 `confirmedYears: [2026]`。

## 来源与校验（2026 年）

| 优先级 | 来源                                                                 | 说明                                                                                                                                                  |
| ------ | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 第一源 | china-holiday-calender（`sources/china-holiday-calender-2026.json`） | GitHub 仓库 `lanceliao/china-holiday-calender` 的 `holidayAPI.json`，commit `d498762870c0`（2025-11-04），结构化包含假期段与调休上班日（`CompDays`）  |
| 第二源 | 中国政府网官方通知抓取（`holidays-2026.json`）                       | 《国务院办公厅关于2026年部分节假日安排的通知》（国办发明电〔2025〕7 号，2025-11-04），<https://www.gov.cn/zhengce/content/202511/content_7047090.htm> |

交叉校验结果：**两源完全一致（0 差异）**，详见 `comparison-2026.md`。导入数据与两源一致，后续年度按同一模式先交叉校验再导入。

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

### 本地开发（与线上同数据）

本地库若为空（节假日标注不显示），按以下步骤导入并确认：

```powershell
pnpm holidays:build
node --env-file=.env infra/scripts/dist/import-holidays.js --file=infra/holidays/holidays-2026.json --year=2026
```

导入得到草稿 `calendarVersionId` 后，确认本地 `.env` 已配置 `HOLIDAY_ADMIN_UIDS=local-admin`，重启本地 API，再调用：

```powershell
curl.exe -X POST -H "Authorization: Bearer local-admin" "http://127.0.0.1:3000/holidays/versions/<calendarVersionId>/confirm"
```

验证：`curl.exe -H "Authorization: Bearer local-admin" "http://127.0.0.1:3000/holidays?year=2026"` 应返回 `confirmed: true` 与 39 条日期。注意：PowerShell `Invoke-RestMethod` 无 body POST 会带非 JSON 默认 Content-Type，触发 API 500，请用 `curl` 或带 `-ContentType 'application/json'`。

## 注意事项

- `packages/test-fixtures` 中的节假日数据是合成测试数据，不得作为正式数据导入。
- 新年度数据发布后，先核对官方通知（国务院办公厅），再按本目录格式新增文件并走线上导入确认。
- `holidayCal.ics` 只包含放假事件，调休上班日需要以 `holidayAPI.json` 的 `CompDays` 或官方通知原文为准。
