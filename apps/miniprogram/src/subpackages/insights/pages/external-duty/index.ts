import {
  externalDutyRequest,
  type ExternalDutyCheck,
  type ExternalDutyAction,
  type ExternalDutyDirectionPreview,
} from '../../../../platform/external-duty-client.js';

interface Confirmation {
  readonly title: string;
  readonly description: string;
  readonly confirmLabel: string;
  readonly endpoint: '/undo' | '/resolve-apply';
  readonly input: Readonly<Record<string, unknown>>;
  readonly changes: readonly { date: string; before: string; after: string }[];
  readonly steps: readonly string[];
  readonly conflicts: readonly string[];
}
interface PageData {
  readonly rows: readonly ExternalDutyCheck[];
  readonly historyRows: readonly (ExternalDutyAction & { statusLabel: string })[];
  readonly showHistory: boolean;
  readonly busy: boolean;
  readonly loaded: boolean;
  readonly error: string;
  readonly info: string;
  readonly scanStatus: string;
  readonly checkedLabel: string;
  readonly headerStyle: string;
  readonly largeText: boolean;
  readonly confirmation: Confirmation | null;
}
interface DutyPageInstance {
  _unloaded?: boolean;
  readonly data: PageData;
  setData(patch: Partial<PageData>): void;
  load(): Promise<void>;
}
type TapEvent = {
  readonly currentTarget: {
    readonly dataset: {
      readonly date?: string;
      readonly id?: string;
      readonly tab?: string;
      readonly direction?: string;
    };
  };
};

Page({
  data: {
    rows: [],
    historyRows: [],
    showHistory: false,
    busy: false,
    loaded: false,
    error: '',
    info: '',
    scanStatus: '',
    checkedLabel: '每分钟自动校对',
    headerStyle: 'height:76px;padding-top:24px;padding-right:102px;',
    largeText: false,
    confirmation: null,
  } as PageData,
  onLoad(this: DutyPageInstance): void {
    this._unloaded = false;
    const windowInfo = wx.getWindowInfo();
    const statusBar = Math.max(0, windowInfo.statusBarHeight ?? 0);
    const capsule = wx.getMenuButtonBoundingClientRect();
    this.setData({
      headerStyle: `height:${statusBar + 52}px;padding-top:${statusBar}px;padding-right:${Math.max(96, windowInfo.windowWidth - capsule.left + 8)}px;`,
      largeText: (wx.getAppBaseInfo().fontSizeSetting ?? 16) >= 20,
    });
  },
  onShow(this: DutyPageInstance): void {
    if (!this.data.busy && !this.data.confirmation) void this.load();
  },
  onUnload(this: DutyPageInstance): void {
    this._unloaded = true;
  },
  back(): void {
    wx.navigateBack();
  },
  async load(this: DutyPageInstance): Promise<void> {
    patch(this, { busy: true, error: '' });
    try {
      const [rows, status, historyRows] = await Promise.all([
        externalDutyRequest<ExternalDutyCheck[]>(''),
        externalDutyRequest<{ status: string; checkedAt: string | null; coverageEnded: boolean }>(
          '/status',
        ),
        externalDutyRequest<ExternalDutyAction[]>('/history'),
      ]);
      patch(this, {
        rows,
        historyRows: historyRows.map((row) => ({ ...row, statusLabel: historyStatus(row) })),
        loaded: true,
        checkedLabel: checkedLabel(status.checkedAt),
        scanStatus: status.coverageEnded
          ? '网页排班覆盖期已结束，自动校对已停止。'
          : status.status === 'failed'
            ? '最近自动检测未完成，请点击“立即检测”重试。'
            : status.status === 'never'
              ? '尚未完成首次检测，请点击“立即检测”。'
              : '',
      });
    } catch (error) {
      patch(this, { error: message(error) });
    } finally {
      patch(this, { busy: false });
    }
  },
  selectTab(this: DutyPageInstance, event: TapEvent): void {
    if (!this.data.busy)
      this.setData({ showHistory: event.currentTarget.dataset.tab === 'history', info: '' });
  },
  async scan(this: DutyPageInstance): Promise<void> {
    if (this.data.busy || this.data.confirmation) return;
    patch(this, { busy: true, error: '', info: '' });
    try {
      await externalDutyRequest('/scan', {});
      await this.load();
      if (!this.data.error) patch(this, { info: '检测已完成，列表已更新。' });
    } catch (error) {
      patch(this, { error: message(error) });
    } finally {
      patch(this, { busy: false });
    }
  },
  async undo(this: DutyPageInstance, event: TapEvent): Promise<void> {
    if (this.data.busy || this.data.confirmation) return;
    const actionId = String(event.currentTarget.dataset.id ?? '');
    if (!actionId) return;
    patch(this, { busy: true, error: '', info: '' });
    try {
      const preview = await externalDutyRequest<{
        side: 'external' | 'local';
        date: string;
        currentName: string | null;
        baselineName: string;
        expectedFingerprint: string;
      }>('/undo-preview', { actionId });
      patch(this, {
        confirmation: {
          title: '恢复发布基线',
          confirmLabel: '确认恢复',
          endpoint: '/undo',
          description: `将${preview.side === 'external' ? '网页' : '本系统'}恢复为最新正式发布版本的人员，覆盖当前值。确认后仍需通过原业务校验。`,
          input: { actionId, expectedFingerprint: preview.expectedFingerprint },
          changes: [
            {
              date: preview.date,
              before: preview.currentName ?? '空缺',
              after: preview.baselineName,
            },
          ],
          steps: [],
          conflicts: [],
        },
      });
    } catch (error) {
      patch(this, { error: message(error) });
    } finally {
      patch(this, { busy: false });
    }
  },
  async previewDirection(this: DutyPageInstance, event: TapEvent): Promise<void> {
    if (this.data.busy || this.data.confirmation) return;
    const row = selected(this.data.rows, event);
    const direction = event.currentTarget.dataset.direction;
    if (
      !row ||
      row.status !== 'pending' ||
      row.blockReason ||
      (direction !== 'to_external' && direction !== 'to_local')
    )
      return;
    const input = { date: row.businessDate, expectedFingerprint: row.fingerprint, direction };
    patch(this, { busy: true, error: '', info: '' });
    try {
      const preview = await externalDutyRequest<ExternalDutyDirectionPreview>(
        '/resolve-preview',
        input,
      );
      patch(this, {
        confirmation: {
          title:
            preview.kind === 'external'
              ? '同步到网页预览'
              : preview.kind === 'swap'
                ? '换班预览'
                : '加扣班预览',
          description:
            preview.kind === 'external'
              ? '以本系统当前值班人为准，仅同步所选日期。确认时会再次检查双方排班。'
              : '以网页为准，按以下顺序处理所有关联日期，每步重新校验。中途失败时请查看操作记录并重新检测；实际排班一致后才会移出列表。',
          confirmLabel: preview.kind === 'external' ? '确认写入' : '确认方案',
          endpoint: '/resolve-apply',
          input: { ...input, planFingerprint: preview.planFingerprint },
          changes: preview.changes,
          steps: preview.steps,
          conflicts: preview.conflicts.map((item) => item.message),
        },
      });
    } catch (error) {
      patch(this, { error: message(error) });
    } finally {
      patch(this, { busy: false });
    }
  },
  closeConfirmation(this: DutyPageInstance): void {
    if (!this.data.busy) this.setData({ confirmation: null });
  },
  async confirmAction(this: DutyPageInstance): Promise<void> {
    const confirmation = this.data.confirmation;
    if (this.data.busy || !confirmation || confirmation.conflicts.length) return;
    patch(this, { busy: true, error: '', info: '' });
    try {
      await externalDutyRequest(confirmation.endpoint, confirmation.input);
      patch(this, { confirmation: null });
      await this.load();
      patch(this, { info: '操作已提交，请以最新校对结果和操作记录为准。' });
    } catch (error) {
      const errorMessage = message(error);
      patch(this, { confirmation: null });
      await this.load();
      patch(this, { error: errorMessage });
    } finally {
      patch(this, { busy: false });
    }
  },
} as never);

function patch(page: DutyPageInstance, values: Partial<PageData>): void {
  if (!page._unloaded) page.setData(values);
}
function selected(rows: readonly ExternalDutyCheck[], event: TapEvent) {
  return rows.find((row) => row.businessDate === String(event.currentTarget.dataset.date ?? ''));
}
function message(error: unknown): string {
  return error instanceof Error ? error.message : '校对暂时失败，请重试。';
}
function checkedLabel(value: string | null): string {
  const time = value ? Date.parse(value) : NaN;
  if (!Number.isFinite(time)) return '每分钟自动校对';
  return `上次自动检测 ${new Date(time + 8 * 3_600_000).toISOString().slice(5, 16).replace('T', ' ')}`;
}
function historyStatus(row: ExternalDutyAction): string {
  if (row.status === 'reverted') return '已恢复基线';
  if (row.status === 'reverting') return '正在恢复';
  if (row.status === 'applying') return '待回读核验';
  if (row.workflowStatus === 'rejected' || row.workflowStatus === 'cancelled') return '申请未生效';
  if (row.workflowStatus === 'revoked') return '原申请已撤销';
  return row.workflowStatus && row.workflowStatus !== 'completed' ? '申请处理中' : '已执行';
}
