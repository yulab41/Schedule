# P7 工作流实体 Android 验收

## 状态与边界

本清单只由用户在实体 Android 微信运行时执行。Storybook、Vitest、`miniprogram-simulate`、`miniprogram-ci` 和桌面浏览器不能替代原生视觉与交互结论；Codex 不启动、控制或自动化微信开发者工具 GUI/CLI。

验收候选固定为 `0.1.0-p7.20260824.86`。先核对工作台可见 `buildLabel` 与本轮报告完全一致；`.82-leave/.83-swap/.84-duty` 是失败关闭的部分候选，`.85` 已被本轮 UI/交互反馈修复版取代，均不用于本轮验收。体验版使用 production profile，会写入正式服务器，因此只在专用测试群组和未来日期排班中操作，禁止修改真实在用排班。

## 交付前自动证据

- 请假、换班、加扣班均为原生 Skyline/glass-easel 页面，无 TDesign MiniProgram、WebView 或第三方 UI。
- 成员不读取管理员审批列表；guest、未知版本、关闭 workflows 和深链均在业务请求前失败关闭。
- 危险写使用 body/header 同一 operation ID；结果尚未确认时同 payload 直接重试，不建立离线写队列，不重复写业务记录。
- preview 与当前表单选择精确匹配后才提交；月份或班次变化会清除旧 preview，409 会刷新最新状态。
- capability 回滚预演由 Codex 在交付前依次关闭 workflows、验证入口/接口失败关闭，再重新开启 workflows 并验证健康；用户不操作服务器开关。

## 测试准备

1. 准备一个成员账号和一个群主或管理员账号，二者属于同一专用测试群组。
2. 在未来日期发布至少三条班次：成员 A 一条，成员 B 两条，其中一条位于下个月，用于跨月换班。
3. 记录设备型号、Android、微信、基础库、系统字体缩放和页面 `buildLabel`。
4. 每个案例都记录是否出现重复写、日历标记和通知；通过时不强制截图，失败时提供 `buildLabel + caseId + 现象`。

## 成员账号

### 1. 请假

1. 打开“请假”，确认标题、两段状态、44px 操作和 390/320 布局无横向溢出。
2. 新建未来全日请假，检查受影响班次后提交；列表显示待审批。再建一条并取消，刷新后不能重复出现。
3. 让管理员分别驳回和批准申请；成员回前台后状态应刷新为已驳回/已批准，批准项按权限显示撤销入口。

### 2. 换班

1. 打开“换班”，选择本月自己的班次、下月目标成员班次，生成预览后提交。
2. 目标成员分别完成接受和驳回；另发一条后由发起人取消。各状态只出现一次。
3. 开启/关闭“自动接受换班”，确认只影响后续请求且页面提示与实际下一状态一致。

### 3. 加扣班

1. 打开“加扣班”，选择自己的班次、加班成员，填写原因并生成预览后提交。
2. 加班成员分别完成接受和驳回；另发一条后由发起人取消。
3. “自动接受换班/加扣班”与换班页显示同一设置结果。

## 群主或管理员账号

### 4. 审批、直接执行和撤销

1. 请假审批必须先查看完整 preview；存在冲突或空缺时，不勾选确认不能批准。分别测试批准、驳回和批准后撤销。
2. 换班分别测试管理员批准/驳回；在“管理员直接换班”选择两位成员及班次，先生成 preview，再直接执行，随后从“已生效待撤销”撤销。
3. 加扣班分别测试管理员批准/驳回；在“管理员直接代值”选择被代班班次、加班成员和原因，先生成 preview，再直接执行，随后撤销并确认原扣班成员恢复。
4. 分别切换“需要管理员审批”，确认新请求进入正确下一状态，旧请求不被重写。

## 弱网、生命周期与结果副作用

1. 在一次提交时制造弱网或断网。如果页面显示“本次结果尚未确认，可直接重试”，保持表单不变后重试；最终只允许一条业务记录，`duplicateWriteObserved=false`。
2. 完全离线时工作流写入必须失败，不得排队；恢复网络后由用户显式重试。
3. 三个页面各做一次后台→前台，列表应刷新，旧请求不得覆盖新状态。
4. 完成三类工作流后回到日历，确认对应日历标记；成员和管理员检查待处理/结果通知。记录 `calendarMarkerObserved` 与 `notificationObserved`。
5. 交付前 capability 回滚已自动验证：关闭 workflows 时入口和深链失败关闭，重新开启 workflows 后三入口恢复且健康接口保持 ready。

## 反馈模板

```text
buildLabel:
deviceModel / Android / WeChat / baseLibrary / fontScale:
member-leave-lifecycle result:
admin-leave-approval-conflict result:
member-swap-lifecycle result:
admin-swap-approval-direct-revoke result:
member-duty-lifecycle result:
admin-duty-approval-direct-revoke result:
weak-network-idempotent-retry result / duplicateWriteObserved:
foreground-capability-refresh result:
calendar-and-notification-effects / calendarMarkerObserved / notificationObserved:
symptomOnFailure:
```

全部通过后回复“P7 工作流 RC 通过”即可。用户明确通过前状态只能是“已实现待实体 UI/交互复核”，不进入 P8，不提交审核或正式发布。
