import type { PlatformJobRun } from '@schedule/contracts';

import { getPlatformJobs } from '../../api/endpoints.js';
import { getStoredToken } from '../../api/client.js';
import { formatChinaDateTime } from '../../utils/china-time.js';
import { toUserMessage } from '../../utils/user-message.js';

interface JobRow {
  readonly id: string;
  readonly jobName: string;
  readonly startedAt: string;
  readonly status: PlatformJobRun['status'];
  readonly statusLabel: string;
  readonly summary: string;
}

interface JobsPageData {
  readonly errorMessage: string;
  readonly loading: boolean;
  readonly rows: readonly JobRow[];
}

Page({
  data: {
    errorMessage: '',
    loading: false,
    rows: [],
  } as JobsPageData,

  onShow() {
    if (getStoredToken() === undefined) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    void this.loadJobs();
  },

  async loadJobs(): Promise<void> {
    this.setData({ errorMessage: '', loading: true });
    try {
      const result = await getPlatformJobs();
      this.setData({
        rows: result.runs.map((run) => ({
          id: run.id,
          jobName: run.jobName,
          startedAt: formatChinaDateTime(run.startedAt),
          status: run.status,
          statusLabel:
            run.status === 'completed' ? '已完成' : run.status === 'failed' ? '失败' : '运行中',
          summary: run.summary ?? '',
        })),
      });
    } catch (error) {
      this.setData({ errorMessage: toUserMessage(error, '任务列表加载失败。') });
    } finally {
      this.setData({ loading: false });
    }
  },
});
