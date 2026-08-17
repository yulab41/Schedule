# 页面与分包布局

## 源码职责

```text
src/
├─ app/                 # 生命周期、bootstrap、capabilities
├─ platform/            # request/storage/navigation/download/subscription/telemetry
├─ store/               # 轻量纯 TS 状态容器
├─ components/
│  ├─ ui/               # 自绘基础组件
│  └─ calendar/         # 月历、日期格、徽标、冻结层
├─ features/            # 按业务能力组织的 controller/view-model adapters
├─ pages/               # 主包页面
├─ subpackages/         # 业务分包页面
└─ testing/fixtures/    # 非生产数据和视觉 fixture
```

## 分包边界

主包只保留首屏和 tab 必需能力：登录/绑定、邀请、匿名访客、工作台、月/周/列表日历、个人页和自绘导航。

| 分包                      | 页面能力                         |
| ------------------------- | -------------------------------- |
| `subpackage-scheduling`   | 手工排班、补录、发布、撤回、版本 |
| `subpackage-workflows`    | 请假、换班、加扣班、审批         |
| `subpackage-organization` | 群组、成员、配置、平台账号后台   |
| `subpackage-insights`     | 事件、访客日志、统计、通知、导出 |

未迁移或 capability 关闭的功能不得保留死入口。主包不能通过公共 barrel 意外引用分包业务或大型 schema。

## 包体门禁

| 范围        | 预警 | 内部阻断 |      官方硬阻断 |
| ----------- | ---: | -------: | --------------: |
| 主包/单分包 | 1.5M |     1.8M |              2M |
| 总包        |  15M |      25M | 30M（直接开发） |

若未来改为服务商代开发，必须新建 ADR 评估官方 20M 总包限制，不能沿用直接开发预算。
