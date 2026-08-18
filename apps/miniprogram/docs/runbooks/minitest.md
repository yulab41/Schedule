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

## P1 自动化入口

仓库只封装微信官方非破坏性 HTTPS 接口：提交测试计划 `POST /thirdapi/plan` 和读取状态 `GET /thirdapi/plan`。不提供删除候选基线、批量设基线或覆盖历史证据的命令。

外部环境变量：

```text
WECHAT_CI_PRIVATE_KEY_PATH=<仓库外代码上传私钥>
WECHAT_CI_ROBOT=<1..10>
MINITEST_USER_TOKEN=<“我的信息”中的用户 token>
MINITEST_GROUP_EN_ID=<产品英文 ID>
MINITEST_TEST_PLAN_ID=<已在 MiniTest 配置的 P1 自定义测试计划正整数 ID>
MINITEST_DEV_ACCOUNT_NO=<与 WECHAT_CI_ROBOT 相同的 1..10>
```

`MINITEST_USER_TOKEN`、上传私钥和 AppID 不写入仓库、artifact 或日志。P1 清单固定为 `testing/p1-minitest-plan.json`，包含 Android+iOS、四个原生页面、唯一截图名及 98%/2%/2px 门槛。

执行顺序：

```powershell
# 无凭据、无平台写入；每个 checkpoint 都可运行
pnpm miniprogram:minitest:dry-run

# 先由同一 robot 生成“开发中预览版”
pnpm miniprogram:preview

# 不得在测试任务运行期间再次 preview；MiniTest 会打开该 robot 的最新预览版
pnpm miniprogram:minitest:submit

# 使用提交返回的 plan id 查询，不修改平台状态
pnpm miniprogram:minitest:status -- --plan-id=<plan-id>
```

MiniTest 自定义用例仍在官方平台以 Minium Python zip 维护；仓库 runner 不猜测平台用例 ID，也不启动本地 DevTools、ADB 或本地 Minium。首次可用运行需在平台把四个清单 case 映射到对应截图和交互，并锁定 Android/iOS 机型。

官方依据：[MiniTest](https://developers.weixin.qq.com/miniprogram/dev/devtools/minitest/)、[开发中预览版测试](https://developers.weixin.qq.com/miniprogram/dev/devtools/minitest/preview_test.html)、[Minium](https://developers.weixin.qq.com/miniprogram/dev/devtools/minitest/minium.html)、[HTTPS API](https://developers.weixin.qq.com/miniprogram/dev/devtools/minitest/api_exe.html)、[图片对比](https://developers.weixin.qq.com/miniprogram/dev/devtools/minitest/image_diff.html)。

## 判定

MiniTest 队列、额度或平台异常属于“待原生复核”，不是通过。不得用 simulate、Storybook 或 DevTools 编译成功替代。动态区域只使用预先登记的固定 ignore/focus 设置。

官方图片对比默认 SSIM 低于 1 即失败，并支持 focus/ignore 等配置；项目 98%/2%/2px 三指标由自有比较器独立判定。截图、几何和性能证据缺一项即不通过。
