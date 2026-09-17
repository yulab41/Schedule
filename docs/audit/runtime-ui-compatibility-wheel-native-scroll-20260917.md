# Skyline 3.17.2 滚轮：改用原生滚动实现（体验版 154）

日期：2026-09-17　作者：Codex　授权：用户当次「继续至全部完成并验证通过并上传放行」+ 授权 LLM 直接在模拟器用测试账号登录

## 三个症状与一次性定因

用同一份构建、只切基础库（开发者工具 fullMode）实测：

1. **内联 `margin-top` 在该版本不当位移用**。同一轨道：
   `margin-top:0;translateY(0)` → top 11642；`margin-top:-220px;translateY(0)` → top **仍 11642**；`margin-top:-220px;translateY(-220px)` → 11422。→ 基准位置丢失，轮子停在区间最前端。
2. **WXS 的 `setStyle` 写入不到渲染器**（真机 `.152` 探针 + 行为症状互证）。→ 逐像素位移、行强调都画不出来。
3. **单位字形全透明**：`.ui-wheel-unit` 的样式规则送不到该节点，且继承色在该路径下解析不出来。一次定因实验（可见对照轮，按行给不同变量）：
   - 12px + 显式颜色 → 出墨；18px + 无显式颜色 → **不出墨**；10px + 无颜色 → 不出墨。
   → 出墨与否只取决于**有没有显式颜色**，与字号无关。

## 实现（3.17.3 一行未改）

`ui-wheel-column` 内新增仅 3.17.2 使用的分支：原生 `scroll-view` 滚轮。

- `bindscroll` 给逐像素 `scrollTop` → 逻辑层用**与 WXS 完全相同的插值公式**算出行/数字/单位样式，经数据下发（`compatStyles`/`compatNumberStyles`/`compatUnitStyles`）。
- 松手去抖后用 `scroll-top` 吸附到整行；静止帧也由数据绘制（首屏即有样式）。
- 单位带**显式颜色**（未选中 `#9aa4ae`、选中 `#16202a`，与 3.17.3 的行色一致）+ `font-size:10px;font-weight:500;opacity:0.72`。
- 3.17.3 仍走原 WXS 分支：同一 WXML 的 `wx:else`，模板、类名、WXS 函数体、样式串全部与 `79df8253` 逐字相同。

## 验证

| 项 | 3.17.2 | 3.17.3 |
| --- | --- | --- |
| `skyline3172UiCompatibility` | true | false |
| 渲染分支 | `ui-wheel-compat-scroll` | `#ui-wheel-track`（原分支） |
| 基准 | `scrollTop=220`（index 5×44） | 样式串 `margin-top:0px` |
| 位移 | `scrollTop 220→308` → 行位移**正好 88px**（2 行） | 数据通道不加 transform，top 恒定 |
| 索引/强调 | `midIndex 5→7`；选中行 `opacity:1;scale(1)`，邻行 `0.58/0.94` | 同公式，由 WXS 绘制 |
| 单位 | 12 行全部出墨（截图 `runtime/audit/devtools-153/zoom-97.png`） | 由 WXS/WXSS 原样 |
| 吸附 | 停在整行（308=7×44）不漂移 | 原样 |

门禁：typecheck、Mini 全套 174 文件 / 1220 项、package（总 4637088B）、determinism、format、lint、smoke:check-core 全通过。

## 交付

- 上传：`0.1.0-p10.20260917.154`，说明「Skyline 3.17.2 native-scroll wheel a7937a7」，Manifest `076a83ba5ec9dfc18de1e18cce4893c58dfdd3d959ea03a3a8319bc7c145304a`，production/clean；上传前后检查 PASS。
- 放行：可信 `ensure` 追加 `.154`（保留旧版）并通过健康与策略验证；`ecs-verify.sh` 输出 `[verify] complete`；公网 `.154=200`、`.153=200`、动态未知 `=426`。
- 未部署应用制品、未备份或迁移数据库、未提审、未正式发布。

## 唯一下一任务

小米 14 打开 `.154` 复核：滚轮跟手与吸附、单位、中间项放大、能滚到 2031年/12月、重开正常；并确认 3.17.3 实例无变化。

## 工具教训（本轮踩过三次）

开发者工具的编译缓存会喂旧包（JS/WXML/WXSS 分别缓存，表现为"JS 更新的字段读得到、WXML 改动没生效"）。可靠做法：构建后统一刷新 `dist` 文件时间戳 → 整窗 `close_project_window` + `open_project_window` → 用页面里的构建号核对 SHA。
