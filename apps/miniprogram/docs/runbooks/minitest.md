# MiniTest 运行手册

## 使用时机

- P1 月历/矩阵风险 PoC。
- P6 核心 v1 RC。
- P7、P8、P9 各正式阶段 RC。
- Skyline、基础库或构建路径重大升级。

## 流程

1. 从已验证 commit 构建 staging profile。
2. 用 `miniprogram-ci` robot 生成开发中预览版本。
3. 在锁定 Android/iOS 云真机执行固定脚本：冷启动、登录/访客、月历三面板、弹层、7×7、20×30、补录、前后台与弱网。
4. 下载截图和性能报告到 ignored `.artifacts/` 或 CI artifact。
5. 运行 MiniTest 官方图片差异。
6. 对导出截图运行项目 comparator，分别验证 98%/2%/2px 和版本化遮罩。
7. 把 artifact ID、commit、设备、基础库、结果写入黄金清单和根状态。

## 判定

MiniTest 队列、额度或平台异常属于“待原生复核”，不是通过。不得用 simulate、Storybook 或 DevTools 编译成功替代。动态区域只使用预先登记的固定 ignore/focus 设置。
