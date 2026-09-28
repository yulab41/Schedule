import {
  externalDutyRequest,
  type ExternalDutyCandidate,
  type ExternalDutyCheck,
} from '../../../../platform/external-duty-client.js';

interface PageData {
  readonly rows: readonly ExternalDutyCheck[];
  readonly candidates: readonly ExternalDutyCandidate[];
  readonly selectedDate: string;
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
    candidates: [],
    selectedDate: '',
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
      const [rows, status] = await Promise.all([
        externalDutyRequest<ExternalDutyCheck[]>(''),
        externalDutyRequest<{ status: string; checkedAt: string | null; coverageEnded: boolean }>(
          '/status',
        ),
      ]);
      this.setData({
        rows,
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

  async duty(this: DutyPageInstance, event: TapEvent): Promise<void> {
    const row = selected(this.data.rows, event);
    if (row) await this.apply(row, 'duty');
  },

  async chooseSwap(this: DutyPageInstance, event: TapEvent): Promise<void> {
    const row = selected(this.data.rows, event);
    if (!row) return;
    this.setData({ busy: true, error: '' });
    try {
      const candidates = await externalDutyRequest<ExternalDutyCandidate[]>('/candidates', {
        date: row.businessDate,
        expectedFingerprint: row.fingerprint,
      });
      this.setData({ selectedDate: row.businessDate, candidates });
    } catch (error) {
      this.setData({ error: message(error) });
    } finally {
      this.setData({ busy: false });
    }
  },

  cancelSwap(this: DutyPageInstance): void {
    this.setData({ selectedDate: '', candidates: [] });
  },

  async swap(this: DutyPageInstance, event: TapEvent): Promise<void> {
    const row = this.data.rows.find((item) => item.businessDate === this.data.selectedDate);
    const targetAssignmentId = String(event.currentTarget.dataset.id ?? '');
    if (row && targetAssignmentId) {
      this.setData({ selectedDate: '', candidates: [] });
      await this.apply(row, 'swap', targetAssignmentId);
    }
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
        : `${row.businessDate}：${row.localName ?? '空缺'} → ${row.remoteName}。预计状态：${preview.nextStatus}。`;
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
