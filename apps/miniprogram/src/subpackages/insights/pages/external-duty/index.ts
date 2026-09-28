import {
  externalDutyRequest,
  type ExternalDutyCheck,
  type ExternalDutyAction,
} from '../../../../platform/external-duty-client.js';

interface PageData {
  readonly rows: readonly ExternalDutyCheck[];
  readonly historyRows: readonly ExternalDutyAction[];
  readonly showHistory: boolean;
  readonly busy: boolean;
  readonly error: string;
  readonly scanStatus: string;
}
interface DutyPageInstance {
  readonly data: PageData;
  setData(patch: Partial<PageData>): void;
  load(): Promise<void>;
  apply(row: ExternalDutyCheck, kind: 'duty' | 'swap', targetAssignmentId?: string): Promise<void>;
}
type TapEvent = {
  readonly currentTarget: { readonly dataset: { readonly date?: string; readonly id?: string } };
};

Page({
  data: {
    rows: [],
    historyRows: [],
    showHistory: false,
    busy: false,
    error: '',
    scanStatus: '',
  } as PageData,

  onShow(this: DutyPageInstance): void {
    void this.load();
  },
  back(): void {
    wx.navigateBack();
  },

  async load(this: DutyPageInstance): Promise<void> {
    this.setData({ busy: true, error: '' });
    try {
      const [rows, status, historyRows] = await Promise.all([
        externalDutyRequest<ExternalDutyCheck[]>(''),
        externalDutyRequest<{ status: string; checkedAt: string | null; coverageEnded: boolean }>(
          '/status',
        ),
        externalDutyRequest<ExternalDutyAction[]>('/history'),
      ]);
      this.setData({
        rows,
        historyRows,
        scanStatus: status.coverageEnded
          ? '对方网页排班覆盖期已于 2027-06-30 结束，校对已停止。'
          : status.status === 'failed'
            ? '最近一次自动检测失败，请点“立即检测”查看原因。'
            : status.status === 'never'
              ? '尚未完成首次自动检测。'
              : '',
      });
    } catch (error) {
      this.setData({ error: message(error) });
    } finally {
      this.setData({ busy: false });
    }
  },

  toggleHistory(this: DutyPageInstance): void {
    this.setData({ showHistory: !this.data.showHistory });
  },

  async undo(this: DutyPageInstance, event: TapEvent): Promise<void> {
    const actionId = String(event.currentTarget.dataset.id ?? '');
    if (!actionId) return;
    this.setData({ busy: true, error: '' });
    try {
      const preview = await externalDutyRequest<{
        side: 'external' | 'local';
        date: string;
        currentName: string | null;
        baselineName: string;
        expectedFingerprint: string;
      }>('/undo-preview', { actionId });
      const side = preview.side === 'external' ? '网页' : '本系统';
      const agreed = await confirm(
        `${preview.date}：将${side}当前的${preview.currentName ?? '空缺'}恢复为发布基线${preview.baselineName}？本系统仍需通过原业务校验。`,
      );
      if (!agreed) return;
      await externalDutyRequest('/undo', {
        actionId,
        expectedFingerprint: preview.expectedFingerprint,
      });
      await this.load();
    } catch (error) {
      this.setData({ error: message(error) });
    } finally {
      this.setData({ busy: false });
    }
  },

  async scan(this: DutyPageInstance): Promise<void> {
    this.setData({ busy: true, error: '' });
    try {
      await externalDutyRequest('/scan', {});
      await this.load();
    } catch (error) {
      this.setData({ error: message(error), busy: false });
    }
  },

  async push(this: DutyPageInstance, event: TapEvent): Promise<void> {
    const row = selected(this.data.rows, event);
    if (!row) return;
    const confirmed = await confirm(
      `${row.businessDate}：把本系统的${row.localName ?? '空缺'}写入对方网页？`,
    );
    if (!confirmed) return;
    this.setData({ busy: true, error: '' });
    try {
      await externalDutyRequest('/push', {
        date: row.businessDate,
        expectedFingerprint: row.fingerprint,
      });
      await this.load();
    } catch (error) {
      this.setData({ error: message(error), busy: false });
    }
  },

  async applySuggestion(this: DutyPageInstance, event: TapEvent): Promise<void> {
    const row = selected(this.data.rows, event);
    if (!row?.suggestion || row.suggestion.kind === 'blocked') return;
    if (row.suggestion.kind === 'duty') return this.apply(row, 'duty');
    const first = row.suggestion.steps[0];
    if (first?.date !== row.businessDate) {
      this.setData({ error: `请先处理 ${first?.date ?? '前一个日期'} 的换班步骤。` });
      return;
    }
    return this.apply(row, 'swap', first.targetAssignmentId);
  },

  async apply(
    this: DutyPageInstance,
    row: ExternalDutyCheck,
    kind: 'duty' | 'swap',
    targetAssignmentId?: string,
  ): Promise<void> {
    this.setData({ busy: true, error: '' });
    try {
      const input = {
        date: row.businessDate,
        expectedFingerprint: row.fingerprint,
        kind,
        ...(targetAssignmentId ? { targetAssignmentId } : {}),
      };
      const preview = await externalDutyRequest<{
        conflicts: readonly { message: string }[];
        nextStatus: string;
      }>('/preview', input);
      const detail = preview.conflicts.length
        ? `发现${preview.conflicts.length}项冲突：${preview.conflicts[0]!.message}`
        : `${row.businessDate}：${row.localName ?? '空缺'} → ${row.remoteName}。${kind === 'swap' ? `${row.suggestion?.detail ?? ''}；后台将逐步校验并执行。` : ''}预计状态：${preview.nextStatus}。`;
      if (!(await confirm(`${detail}确认生成${kind === 'duty' ? '加扣班' : '换班'}记录？`))) return;
      await externalDutyRequest('/apply', input);
      await this.load();
    } catch (error) {
      this.setData({ error: message(error) });
    } finally {
      this.setData({ busy: false });
    }
  },
} as never);

function selected(rows: readonly ExternalDutyCheck[], event: TapEvent) {
  const date = String(event.currentTarget.dataset.date ?? '');
  return rows.find((row) => row.businessDate === date);
}

function confirm(content: string): Promise<boolean> {
  return new Promise((resolve) =>
    wx.showModal({
      title: '排班网页校对',
      content,
      success: (result) => resolve(result.confirm),
      fail: () => resolve(false),
    }),
  );
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : '校对暂时失败，请重试。';
}
