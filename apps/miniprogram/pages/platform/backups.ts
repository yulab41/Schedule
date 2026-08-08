import type { DissolvedGroup } from '@schedule/contracts';

import {
  getPlatformBackups,
  listDissolvedGroups,
  restorePlatformGroup,
} from '../../api/endpoints.js';
import { getStoredToken } from '../../api/client.js';
import { formatChinaDateTime } from '../../utils/china-time.js';
import { toUserMessage } from '../../utils/user-message.js';

interface BackupRow {
  readonly createdAt: string;
  readonly fileSize: string;
  readonly id: string;
  readonly kind: string;
  readonly rowCount: number;
  readonly sha256: string;
  readonly tableCount: number;
}

interface BackupsPageData {
  readonly backups: readonly BackupRow[];
  readonly dissolved: readonly DissolvedGroup[];
  readonly errorMessage: string;
  readonly infoMessage: string;
  readonly loading: boolean;
  readonly restoringId: string;
}

Page({
  data: {
    backups: [],
    dissolved: [],
    errorMessage: '',
    infoMessage: '',
    loading: false,
    restoringId: '',
  } as BackupsPageData,

  onShow() {
    if (getStoredToken() === undefined) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    void this.loadAll();
  },

  async loadAll(): Promise<void> {
    this.setData({ errorMessage: '', loading: true });
    try {
      const [backupResult, dissolved] = await Promise.all([
        getPlatformBackups(),
        listDissolvedGroups(),
      ]);
      this.setData({
        backups: backupResult.archives.map((backup) => ({
          createdAt: formatChinaDateTime(backup.createdAt),
          fileSize: formatFileSize(backup.fileSize),
          id: backup.id,
          kind: backup.backupKind === 'daily' ? '每日备份' : '月度备份',
          rowCount: backup.rowCount,
          sha256: backup.sha256.slice(0, 12),
          tableCount: backup.tableCount,
        })),
        dissolved,
      });
    } catch (error) {
      this.setData({ errorMessage: toUserMessage(error, '备份列表加载失败。') });
    } finally {
      this.setData({ loading: false });
    }
  },

  async handleRestore(event: WechatMiniprogram.TouchEvent): Promise<void> {
    const groupId = event.currentTarget.dataset.id;
    if (typeof groupId !== 'string' || groupId.length === 0) {
      return;
    }
    const confirmed = await confirmAction('恢复群组', '恢复后群组与成员关系原样回来。');
    if (!confirmed) {
      return;
    }
    this.setData({ errorMessage: '', infoMessage: '', restoringId: groupId });
    try {
      await restorePlatformGroup(groupId);
      this.setData({ infoMessage: '群组已恢复。' });
      await this.loadAll();
    } catch (error) {
      this.setData({ errorMessage: toUserMessage(error, '恢复失败。') });
    } finally {
      this.setData({ restoringId: '' });
    }
  },
});

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function confirmAction(title: string, content: string): Promise<boolean> {
  return new Promise((resolve) => {
    wx.showModal({
      cancelText: '取消',
      confirmText: '确认',
      content,
      success: (result) => resolve(result.confirm),
      fail: () => resolve(false),
      title,
    });
  });
}
