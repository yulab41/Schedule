# 头颈外科医生群 DOCX 排班导出

## 范围与引入点

- Excel/CSV 格式切换由 `f0c46078` 引入；本轮只把目标群排班的 Excel 入口替换为 Word，其他群组与统计导出保留既有格式。
- `buildXlsx` 和 `scheduleExportFormatSchema` 同样由 `f0c46078` 引入。本轮复用已有 `archiver@5.3.1` 生成标准 DOCX OOXML，不新增或安装依赖。
- 用户最终调整的 9 月 Word 只保存在 ignored runtime；真实姓名、成员 ID 和生产配置不进入 Git。

## 行为变化

- 新增 `docx` 导出格式和 schema59。服务端通过 `HEAD_NECK_DOCX_EXPORT_CONFIG` 的稳定群组 ID、角色 ID、成员 ID 映射和固定三值成员判定资格。
- 目标群排班格式为 Word/CSV；统计格式为 Excel/CSV。其他群组仍为 Excel/CSV。小程序切到统计时自动离开 Word；服务端拒绝 `statistics + docx`、非目标群 DOCX、DOCX 局部岗位/成员筛选和不完整配置。
- 月度 DOCX 一页；年度 DOCX 十二页。页面度量、表格列宽、居中、字体、字号、周末下划线和底部三值间距来自用户最终版。
- 一值按实际人员；二值按配置映射；三值固定配置。已批准请假/进修与计划/实际排班共同生成横线和姓名右下角小号类型；无真实样本时使用合成夹具。
- 登录态下载、无 URL token、临时文件清理、用户主动发送和取消语义保持不变。

## 验证

- DOCX/配置/API-client/schema 定向：9 项通过；数据库迁移28项和导出集成7项因未配置本地测试 MySQL 跳过。
- Mini 导出控制器与模板定向：45 项通过，包含目标群 Word、统计回落 Excel和非允许组合不提交。
- 完整 `pnpm verify`：Mini 1162 项通过/16 跳过；根 1261 项通过/441 跳过；依赖保护81项通过；格式、lint、build、typecheck、icon parity 均通过。
- Mini production verify：主包1715321字节、总包4559861字节、Worklet 2/2、确定性和包体门禁通过；保留既有1.5M内部预警和矩阵节点预警。
- Microsoft Word 视觉：同数据9月生成版与用户最终版均为1191×1684；标题、标签、人员行、底部表和三值关键纵坐标一致，个别表格行因 Word 舍入相差约1像素。显著差异像素从首次2.71%降至1.32%，差异主要为OOXML写法与抗锯齿，不是可见布局漂移。
- 合成缺勤页已逐页查看：横线、周末下划线和姓名右下角类型无截断或换行。年度样本经 Microsoft Word 实际导出为12页。
- `pnpm smoke:browser` 已运行，因 warm 槽未启动 `localhost:5173` 返回 `ERR_CONNECTION_REFUSED`，未取得浏览器运行证据；本功能没有 Web UI 改动。需在 `smoke:check-core` 中保留该事实。

## 尚未执行

- 未配置或读取生产成员 ID，未连接生产、备份、迁移或部署。
- 未上传或放行小程序体验版，未控制微信开发者工具。
- 当前真实月份无轮空、请假或进修样本，因此合成视觉通过不能写成真实业务数据验收；同版本小米14打开下载文件仍待后续验收。
