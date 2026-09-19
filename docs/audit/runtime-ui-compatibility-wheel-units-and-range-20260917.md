# Skyline 3.17.2 滚轮缺单位、无放大、到不了底（2026-09-17）

## 真机证据（用户提供的 3.17.2 / 3.17.3 对照截图）

- 3.17.2（"发起换班"、标题显示 2031年12月）：年月数字**没有"年/月"单位**；中间的选中项**没有变大/变粗**；
  向下只能滚到 2027 与 5月，抬手再拖也不能继续向下，但可以向上回滚；标题草稿值（2031年12月）与滚轮可见位置
  （2024..2028）**不一致**。
- 3.17.3（"管理员直接换班"、标题显示 2025年9月）：单位、选中放大、完整范围、草稿与可见位置一致，全部正常。
- **读图边界（重要）**：3.17.2 那张截图的分辨率下无法确证"行间渐变是否由 WXS 写入"。本轮初稿曾把它读成
  "3.17.2 的行样式通道可用"，这与用户文字描述"没有选中字体放大效果"冲突，属**未证实假设**，不作为修复依据。
  因此本轮修复**不依赖样式通道是否可用**：单位与条目总数改走数据通道；选中强调在 3.17.2 上另有 CSS 兜底。

## 修复（继续沿"数据通道"收敛，最小改动）

1. 单位改为随**条目数据**走：`createWheelOptions` 给每个 item 带上 `unit`，模板渲染
   `wx:if="{{item.unit || unit}}"`（条目优先，组件属性兜底）。3.17.2 上组件的 `unit` 属性没有渲染出单位，
   条目数据这条路径此前已被证明可用。
2. 条目总数改由**组件自身 data** 承载：`data-item-count="{{items.length}}"` → `{{wheelConfig.itemCount}}`，
   与已经验证可用的 `data-base-index="{{wheelLayoutIndex}}"` 走同一条 data 路径，避免属性成员表达式在
   3.17.2 上取不到值导致范围被截断。
3. 同一次打开内条目数只增不减：新增 `refreshItemCount`，dataset 报出更小的瞬时值时忽略并保持既有范围，
   避免一次瞬时渲染把滚轮的可滚动范围剪短（对应"再抬手也不能继续向下"）。
4. 选中强调不再只依赖 WXS 行样式：只在 3.17.2 上给滚轮根节点加 `is-skyline-3172-ui`
   （由组件自己按 `SDKVersion` 判定），并用 CSS 给 `.is-selected` 行与数字兜底放大
   （`opacity: 1; transform: scale(1.06)`，数字 `font-size: 30px`）。WXS 能写行内样式时它仍优先，
   写不进时 CSS 兜底；3.17.3 不匹配该选择器，外观与动画不变。

## 验证

- 新增回归：`does not let a transient count shrink the wheel range`（拖动过程中 host 报出更短的列表，
  滚轮仍必须能落到最后一格 index 10 / offset -440）与既有 `keeps the whole range reachable from a
  dataset-seeded baseline`；两者通过。
- 定向 51 项 + 新增用例、Mini 完整 174 文件 1219 项通过/16 跳过；typecheck、production build（366 文件）、
  package（主包 1746516B / 总包 4620921B）、determinism（`3bacb648…98c9d`）、`pnpm format:check`、
  `pnpm lint`、`pnpm smoke:check-core`、`agent-context-policy` 通过。`pnpm miniprogram:verify` 仍只被
  既有未改的手排矩阵节点预算 `1507>1506` 阻断。

## 边界

本轮未上传体验版、未放行、未部署（当前消息未包含上传授权）。3.17.2 仍未在本轮验证的项：
触摸前是否有渐变（观察器不交付导致），以及点击单项直接选中。
