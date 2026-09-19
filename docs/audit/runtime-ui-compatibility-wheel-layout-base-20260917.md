# Skyline 3.17.2 滚轮初始定位与重开失效（2026-09-17）

## 用户真机复核（体验版 `.150`）

1. 换班年月滚轮**首次打开可以正常滚动**（说明上一轮"模板覆盖 WXS 位移"的修复生效）。
2. 但首次打开时**没有定位到当前年月，而是停在最前端（2021 年 / 1 月）**。
3. 关闭弹窗后再次打开，**又变回无法滚动**。

## 根因

两个现象同一个原因：**3.17.2 不把 WXS 的 `change:wheel-config` 观察器交给滚轮**（`configure` 没有按代际到达）。

- 初始位置：位移原本只由 WXS 在 `configure` 里写；观察器不触发，因此从未应用初始位移，首屏停在轨道原点（第一项）。
  上一轮删掉内联 `transform` 绑定后，这个"只靠 WXS 定位"的缺口才暴露出来。
- 重开失效：上一轮新增的"缺 state 时按 dataset 自建基线"只在**没有** state 时生效。第二次打开时 state 已存在，
  但弹窗打开会推进 generation，于是 `eventState` 因代际不一致直接返回 `null`，后续 touch 全部被忽略。

## 修复（保持最小，且不再依赖观察器）

- 初始定位交给模板/布局：轨道改为 `style="margin-top:{{wheelLayoutOffset}}px"`（组件按当前选中项算出
  `-index * 44`），WXS 只画增量 `translateY(offset - baseOffset)`。二者作用在不同属性上，重渲染只重复应用同一个
  `margin-top`，再也不会覆盖 WXS 的 transform；观察器缺席时初始位置依然正确。
- 手势按代际自我刷新：`eventState` 在 dataset 的 generation 比 state 新时，从 dataset
  （`data-base-index` / `data-item-count` / `data-generation`）重新播种并按新基线落位、重置上一轮行样式；
  dataset 比 state 旧时仍然忽略（保留原有 stale 语义）。

## 验证

- RED：把 WXS 回退到 `.150` 后，新增用例
  `re-seeds from the dataset when the host re-opens the wheel without the observer` 失败
  （`expected 'translateY(-44px)' to be 'translateY(0px)'`，即重开后手势没有落到新代际基线，与真机"重开就不能滚"一致）；
  修复后通过。已有用例中"轨道位移"的期望同时从绝对值改为相对基线的增量（`0px` 表示停在代际基线）。
- GREEN：定向 55 项、Mini 完整 174 文件 1217 项通过/16 跳过；typecheck、production build（366 文件）、
  package（主包 1745352B / 总包 4619757B）、determinism（`95f7825e…390d1`）、`pnpm format:check`、`pnpm lint`、
  `pnpm smoke:check-core`、`agent-context-policy` 通过。`pnpm miniprogram:verify` 仍只被既有未改的手排矩阵
  节点预算 `1507>1506` 阻断。

## 3.17.2 上的已知局限（观察器不交付导致，本轮未改）

1. 打开后**未触摸之前**滚轮没有中间大、两端小和淡出的渐变（WXS 首次绘制发生在第一次触摸时）；触摸一次即恢复正常。
2. 点击某一项直接选中（tap-to-select）仍不生效：该路径依赖观察器把 `commandRevision` 交给 WXS。拖动选择正常。

若需要这两点也在 3.17.2 上生效，需要单独一轮用同样的 dataset 通道补齐，本轮不扩大改动面。

## 边界

本轮未上传体验版、未放行、未部署（当前消息未包含上传授权）。
