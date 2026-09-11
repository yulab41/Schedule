import { canUseDiagnostics } from '../../../../platform/diagnostics-access.js';
import { readMiniProgramRuntimeIdentity } from '../../../../platform/runtime-environment.js';
import {
  getStoredWechatProfile,
  getWechatSessionGeneration,
} from '../../../../platform/wechat-identity.js';
import { readStoredWorkbenchGroupId } from '../../../../platform/workbench-selection.js';
import { getClientCapabilitySnapshot } from '../../../../app/client-capability-store.js';
import {
  loadWechatSubscriptionTemplates,
  inspectWechatNotifications,
  sendWechatNotificationTest,
  saveWechatReceivingPreference,
  WechatDiagnosticHttpError,
} from '../../../../platform/wechat-notification-client.js';
import {
  requestWechatSubscriptions,
  WechatSubscriptionError,
} from '../../../../platform/wechat-subscription.js';
import {
  readSubscriptionDiagnostics,
  captureSubscriptionDiagnosticRecorder,
} from '../../../../platform/subscription-diagnostics.js';

interface Row {
  readonly label: string;
  readonly value: string;
}
export const wechatDiagnosticData = {
  wechatRows: [] as readonly Row[],
  wechatBusy: false,
  wechatReady: false,
  wechatGranted: false,
  wechatSendReady: false,
  wechatReceived: '尚未人工确认',
  wechatTestResult: '',
  wechatTargetVersion: 'trial' as 'trial' | 'formal',
  wechatTargetLabels: ['体验版', '正式版'],
};
interface Host {
  readonly data: typeof wechatDiagnosticData;
  _wechatEpoch?: object;
  _wechatTemplates?: readonly string[];
  _wechatGroup?: string | undefined;
  _wechatOperation?: { id: string; issuedAt: number; targetVersion: 'trial' | 'formal' };
  _wechatTargetVersion?: 'trial' | 'formal';
  setData(patch: Partial<typeof wechatDiagnosticData>): void;
}
function guard(page: Host): () => boolean {
  const epoch = page._wechatEpoch;
  const owner = getStoredWechatProfile()?.id;
  const generation = getWechatSessionGeneration();
  return () =>
    epoch === page._wechatEpoch &&
    !!epoch &&
    canUseDiagnostics() &&
    owner === getStoredWechatProfile()?.id &&
    generation === getWechatSessionGeneration();
}
export function clearWechatDiagnosticPage(page: Host): void {
  delete page._wechatEpoch;
  delete page._wechatTemplates;
  delete page._wechatGroup;
  delete page._wechatOperation;
  delete page._wechatTargetVersion;
  page.setData({ ...wechatDiagnosticData });
}
export async function prepareWechatDiagnosticPage(page: Host): Promise<void> {
  if (!canUseDiagnostics()) return;
  page._wechatEpoch = {};
  page._wechatTargetVersion ??=
    readMiniProgramRuntimeIdentity().envVersion === 'release' ? 'formal' : 'trial';
  const current = guard(page);
  const owner = getStoredWechatProfile()?.id;
  const group = owner ? readStoredWorkbenchGroupId(owner) : undefined;
  page._wechatGroup = group;
  page.setData({
    wechatTargetVersion: page._wechatTargetVersion,
    wechatReady: false,
    wechatGranted: false,
    wechatSendReady: false,
    wechatTestResult: '',
    wechatRows: [{ label: '准备', value: '正在读取配置与本人状态…' }],
  });
  if (!group) {
    page.setData({ wechatRows: [{ label: '当前群组', value: '请先在工作台选择群组。' }] });
    return;
  }
  const templateRequest = loadWechatSubscriptionTemplates();
  const [templates, server, settings] = await Promise.allSettled([
    templateRequest,
    inspectWechatNotifications(group),
    templateRequest.then((ids) => readSettings(ids)),
  ]);
  if (!current()) return;
  page._wechatTemplates = templates.status === 'fulfilled' ? templates.value : [];
  const capability = getClientCapabilitySnapshot();
  const nativeAvailable =
    typeof (wx as unknown as { requestSubscribeMessage?: unknown }).requestSubscribeMessage ===
    'function';
  const rows: Row[] = [
    {
      label: '功能开关',
      value: capability.global && capability.externalMessages ? '已开启' : '微信消息能力已暂停',
    },
    { label: '原生订阅接口', value: nativeAvailable ? '可调用' : '当前环境不可用' },
    {
      label: '订阅模板',
      value:
        templates.status === 'rejected'
          ? '读取失败'
          : templates.value.length
            ? '已从服务器读取，与发送配置同源'
            : '未配置',
    },
    {
      label: '微信通知设置',
      value: settings.status === 'fulfilled' ? settings.value : '当前环境无法读取',
    },
    ...serverRows(server.status === 'fulfilled' ? server.value : undefined),
    ...readSubscriptionDiagnostics().map((row) => ({
      label: `本次 ${stageLabels[row.stage]}`,
      value: `${outcomeLabels[row.outcome]}${row.errCode === undefined ? '' : ` / 错误码 ${row.errCode}`}${row.durationMs === undefined ? '' : ` / ${row.durationMs}ms`}`,
    })),
  ];
  const issue = sendReadinessIssue(server.status === 'fulfilled' ? server.value : undefined);
  if (issue) rows.push({ label: '发送前检查', value: issue });
  page.setData({
    wechatSendReady: !issue,
    wechatRows: rows,
    wechatReady:
      nativeAvailable &&
      capability.global &&
      capability.externalMessages &&
      !!page._wechatTemplates.length,
  });
}
function readSettings(templates: readonly string[]): Promise<string> {
  return new Promise((resolve) => {
    const runtime = wx as unknown as {
      getSetting?: (options: {
        withSubscriptions: boolean;
        success: (value: {
          subscriptionsSetting?: {
            mainSwitch?: boolean;
            itemSettings?: Readonly<Record<string, unknown>>;
          };
        }) => void;
        fail: () => void;
      }) => void;
    };
    if (!runtime.getSetting) {
      resolve('当前环境无法读取');
      return;
    }
    runtime.getSetting({
      withSubscriptions: true,
      success: (value) => {
        const settings = value.subscriptionsSetting;
        const main =
          settings?.mainSwitch === false
            ? '总开关关闭'
            : settings?.mainSwitch === true
              ? '总开关开启'
              : '总开关未提供';
        const choice =
          templates
            .map((id) => {
              const status = settings?.itemSettings?.[id];
              return status === 'accept'
                ? '记住接受'
                : status === 'reject'
                  ? '记住拒绝'
                  : status === 'ban'
                    ? '被封禁'
                    : status === 'filter'
                      ? '被过滤'
                      : '未提供';
            })
            .join(' / ') || '未提供';
        resolve(`${main}；当前模板：${choice}。该设置不代表本次已获额度。`);
      },
      fail: () => resolve('当前环境无法读取'),
    });
  });
}
function append(page: Host, label: string, value: string): void {
  page.setData({ wechatRows: [...page.data.wechatRows.slice(-35), { label, value }] });
}
export const wechatDiagnosticMethods = {
  handleWechatTargetVersion(this: Host, event: { detail: { value?: unknown } }): void {
    if (!canUseDiagnostics() || this.data.wechatBusy) return;
    const index = String(event.detail.value);
    if (index !== '0' && index !== '1') return;
    const targetVersion = index === '1' ? 'formal' : 'trial';
    if (targetVersion === this.data.wechatTargetVersion) return;
    this._wechatTargetVersion = targetVersion;
    delete this._wechatOperation;
    this.setData({
      wechatTargetVersion: targetVersion,
      wechatTestResult: '',
      wechatReceived: '尚未人工确认',
    });
  },
  handleRefreshWechat(this: Host): void {
    if (!this.data.wechatBusy) void prepareWechatDiagnosticPage(this);
  },
  handleWechatSettings(this: Host): void {
    if (canUseDiagnostics())
      (
        wx as unknown as { openSetting?: (options: { withSubscriptions: boolean }) => void }
      ).openSetting?.({ withSubscriptions: true });
  },
  handleWechatSubscribe(this: Host): void {
    if (
      !canUseDiagnostics() ||
      this.data.wechatBusy ||
      !this.data.wechatReady ||
      !this._wechatGroup ||
      !this._wechatTemplates?.length
    )
      return;
    const current = guard(this);
    const group = this._wechatGroup;
    this.setData({ wechatBusy: true, wechatGranted: false });
    append(this, '本次授权', '已调用微信订阅接口，等待微信返回');
    // Keep this call in the original tap stack; no request/await occurs before it.
    void requestWechatSubscriptions(this._wechatTemplates)
      .then(async (grants) => {
        if (!current()) return;
        const accepted = grants.length > 0 && grants.every((item) => item.granted);
        append(
          this,
          '本次授权',
          accepted
            ? '微信返回接受（可能不弹窗）'
            : `微信返回 ${grants.map((item) => outcomeLabels[item.status]).join(' / ')}`,
        );
        if (!accepted) return;
        append(this, '接收偏好', '正在保存');
        const record = captureSubscriptionDiagnosticRecorder();
        record({ stage: 'preference', outcome: 'started' });
        try {
          await saveWechatReceivingPreference(group);
          if (!current()) return;
          record({ stage: 'preference', outcome: 'saved' });
          delete this._wechatOperation;
          append(this, '接收偏好', '保存成功；正在重新检查绑定身份');
          let state: unknown;
          try {
            state = await inspectWechatNotifications(group);
          } catch {
            state = undefined;
          }
          if (!current()) return;
          const issue = sendReadinessIssue(state);
          this.setData({ wechatGranted: !issue, wechatSendReady: !issue });
          append(this, '发送前检查', issue || '身份一致；可主动发送一条本人测试消息');
        } catch {
          if (!current()) return;
          record({ stage: 'preference', outcome: 'failed' });
          append(this, '接收偏好', '保存失败，本次未发送测试消息');
        }
      })
      .catch((error) => {
        if (!current()) return;
        append(
          this,
          '本次授权',
          error instanceof WechatSubscriptionError
            ? `失败 / 错误码 ${error.code ?? '未提供'}`
            : '接口调用失败',
        );
      })
      .finally(() => {
        if (current()) this.setData({ wechatBusy: false });
      });
  },
  handleWechatTestSend(this: Host): void {
    if (
      !canUseDiagnostics() ||
      this.data.wechatBusy ||
      !this.data.wechatGranted ||
      !this.data.wechatSendReady ||
      !this._wechatGroup
    )
      return;
    const current = guard(this);
    const group = this._wechatGroup;
    this._wechatOperation ??= {
      id: operationId(),
      issuedAt: Date.now(),
      targetVersion: this.data.wechatTargetVersion,
    };
    const operation = this._wechatOperation;
    this.setData({
      wechatBusy: true,
      wechatGranted: false,
      wechatTestResult: '正在发送一次本人测试；不会自动重试',
      wechatReceived: '尚未人工确认',
    });
    append(
      this,
      '本次跳转目标',
      `${operation.targetVersion === 'trial' ? '体验版' : '正式版'} · 日历首页（pages/workbench/index）`,
    );
    void sendWechatNotificationTest(
      group,
      operation.id,
      operation.issuedAt,
      operation.targetVersion,
    )
      .then((value) => {
        if (!current()) return;
        this.setData({ wechatTestResult: formatTestResult(value) });
      })
      .catch((error: unknown) => {
        if (current())
          this.setData({
            wechatTestResult:
              error instanceof WechatDiagnosticHttpError
                ? `服务器明确拒绝：${error.message}`
                : '结果未知：请刷新查看服务端记录，不会重复发送。',
          });
      })
      .finally(() => {
        if (current()) this.setData({ wechatBusy: false });
      });
  },
  handleWechatReceived(this: Host): void {
    if (canUseDiagnostics() && !this.data.wechatBusy && this.data.wechatTestResult)
      this.setData({ wechatReceived: '用户确认已在微信收到测试消息' });
  },
  handleWechatNotReceived(this: Host): void {
    if (canUseDiagnostics() && !this.data.wechatBusy && this.data.wechatTestResult)
      this.setData({ wechatReceived: '用户确认暂未收到，需继续查投递和客户端显示' });
  },
};
function operationId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/gu, (marker) => {
    const random = Math.floor(Math.random() * 16);
    return (marker === 'x' ? random : (random & 3) | 8).toString(16);
  });
}
function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function sendReadinessIssue(value: unknown): string {
  if (value === undefined) return '无法确认发送条件，请刷新只读检查。';
  const state = record(value);
  if (state['currentAppIdentityExists'] !== true || state['legacyOpenidExists'] !== true)
    return '当前账号未完成微信绑定，请退出登录后通过微信快捷登录绑定，再返回检查。';
  if (state['identityMatches'] !== true)
    return '微信登录与发送身份不一致，请重新微信登录并刷新检查。';
  if (state['mockMode'] !== false) return '当前为模拟模式或状态未知，不能发送真实测试。';
  if (state['gatewayConfigured'] !== true || state['templateConfigured'] !== true)
    return '发送配置未就绪，请联系管理员检查。';
  if (state['activeMember'] !== true) return '当前账号不是有效群成员。';
  if (state['receivingEnabled'] !== true) return '请先开启微信提醒接收偏好。';
  return '';
}
function serverRows(value: unknown): Row[] {
  if (value === undefined)
    return [{ label: '服务端检查', value: '读取失败或权限不可用，请刷新重试' }];
  const item = record(value);
  const labels: Record<string, string> = {
    mockMode: '模拟模式（开启时禁止真实测试）',
    gatewayConfigured: '发送凭据配置',
    templateConfigured: '发送模板配置',
    currentAppIdentityExists: '当前小程序身份',
    legacyOpenidExists: '发送身份',
    identityMatches: '两处身份一致',
    activeMember: '有效群成员',
    receivingEnabled: '接收偏好',
  };
  const rows = Object.entries(labels).map(([key, label]) => ({
    label,
    value: item[key] === true ? '是' : item[key] === false ? '否' : '未提供',
  }));
  const fieldKeys = Array.isArray(item['expectedFieldKeys'])
    ? item['expectedFieldKeys'].filter(
        (key): key is string => typeof key === 'string' && /^[a-z_]+\d+$/u.test(key),
      )
    : [];
  rows.push({
    label: '模板字段',
    value: fieldKeys.length
      ? `当前发送 ${fieldKeys.join(' / ')}；${item['platformFieldsVerified'] === true ? '平台字段已核对' : '本次未进行平台字段核对'}`
      : '服务端未提供发送字段',
  });
  if (Array.isArray(item['deliveries']))
    for (const raw of item['deliveries'].slice(0, 10)) {
      const delivery = record(raw);
      const status = delivery['status'];
      const attempts =
        typeof delivery['attempts'] === 'number' && Number.isInteger(delivery['attempts'])
          ? Math.max(0, Math.min(100, delivery['attempts']))
          : '未提供';
      rows.push({
        label: '最近真实投递',
        value: `${safeTime(delivery['createdAt'])} / ${deliveryStatuses[String(status)] ?? '状态未提供'} / 尝试${attempts}次${delivery['errorCategory'] ? ` / ${categories[String(delivery['errorCategory'])] ?? '旧记录错误未分类'}` : ''}${delivery['sentAt'] ? ` / 微信接受时间${safeTime(delivery['sentAt'])}` : ''}`,
      });
    }
  if (Array.isArray(item['deliveries']) && item['deliveries'].length === 0)
    rows.push({ label: '真实投递记录', value: '暂无投递记录，尚不能判断发送链路是否正常' });
  if (Array.isArray(item['tests']))
    for (const test of item['tests'].slice(0, 5))
      rows.push({ label: '最近本人测试', value: formatTestResult(test) });
  return rows;
}
const categories: Record<string, string> = {
  'wechat-accepted': '微信接口已接受；仍需人工确认手机收到',
  'template-fields': '模板字段不匹配',
  'template-data-invalid': '发送前校验失败：模板内容缺失、格式错误或超长',
  'template-unavailable': '模板不可用',
  'subscription-unavailable': '订阅额度不足或被拒绝',
  'recipient-invalid': '发送身份不可用',
  'app-configuration': '小程序配置异常',
  'credential-configuration': '发送凭据配置异常',
  'access-token': '微信访问凭据异常',
  'rate-limited': '微信接口限频',
  'wechat-rejected': '微信拒绝发送',
  'transport-unknown': '网络或响应未知，不会自动重试',
  'reserved-no-retry': '已预留发送，最终结果未知，不会自动重试',
};
function formatTestResult(value: unknown): string {
  const row = record(value);
  const category = categories[String(row['category'])] ?? '结果未知';
  const code = row['code'];
  const phaseLabels: Record<string, string> = {
    reserved: '已预留，是否调用微信尚未知',
    preflight: '发送前检查',
    'access-token': '获取微信访问凭据，尚未调用发送',
    send: '已开始调用微信发送接口',
  };
  return (
    `${row['recordedAt'] ? `${safeTime(row['recordedAt'])} / ` : ''}${phaseLabels[String(row['phase'])] ?? '阶段未提供'} / ${category}` +
    (typeof code === 'number' && Number.isInteger(code) && Math.abs(code) < 1_000_000
      ? ` / 错误码 ${code}`
      : '') +
    (row['targetVersion'] === 'trial' || row['targetVersion'] === 'formal'
      ? ` / ${row['targetVersion'] === 'trial' ? '体验版' : '正式版'}`
      : '') +
    (row['page'] === 'pages/workbench/index' ? ' / 日历首页（pages/workbench/index）' : '')
  );
}
export function wechatDiagnosticReport(page: Host): string {
  if (!canUseDiagnostics()) return '';
  return [
    '微信提醒诊断',
    ...page.data.wechatRows.map((row) => `${row.label}: ${row.value}`),
    page.data.wechatTestResult,
    page.data.wechatReceived,
  ].join('\n');
}

const stageLabels = {
  configuration: '配置',
  'native-api': '原生接口',
  authorization: '授权',
  preference: '接收偏好',
  'test-send': '测试发送',
};
const outcomeLabels = {
  started: '已开始',
  accepted: '接受',
  rejected: '拒绝',
  blocked: '封禁',
  filtered: '过滤',
  unknown: '未知',
  failed: '失败',
  saved: '已保存',
  ready: '已就绪',
};
const deliveryStatuses: Record<string, string> = {
  pending: '等待发送',
  sent: '微信接口已接受',
  failed: '发送失败',
  skipped: '已跳过',
};
function safeTime(value: unknown): string {
  return typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T[0-9:.]+Z$/u.test(value) &&
    Number.isFinite(Date.parse(value))
    ? new Date(value).toLocaleString()
    : '时间未提供';
}
