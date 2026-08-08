import type { HolidayImportPreview } from '@schedule/contracts';

import {
  confirmHolidayVersion,
  getHolidayCoverage,
  importHolidays,
  listHolidayVersions,
  previewHolidayImport,
} from '../../api/endpoints.js';
import { getStoredToken } from '../../api/client.js';
import { formatChinaDateTime } from '../../utils/china-time.js';
import { toUserMessage } from '../../utils/user-message.js';

interface HolidayPageData {
  readonly coverageText: string;
  readonly errorMessage: string;
  readonly infoMessage: string;
  readonly inputJson: string;
  readonly preview: HolidayImportPreview | undefined;
  readonly submitting: boolean;
  readonly versionRows: readonly {
    readonly confirmedAt: string;
    readonly dateCount: number;
    readonly id: string;
    readonly status: string;
    readonly version: number;
    readonly year: number;
  }[];
  readonly year: number;
}

Page({
  data: {
    coverageText: '',
    errorMessage: '',
    infoMessage: '',
    inputJson: '',
    preview: undefined,
    submitting: false,
    versionRows: [],
    year: 0,
  } as HolidayPageData,

  onShow() {
    if (getStoredToken() === undefined) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    const year = new Date().getFullYear();
    this.setData({ year });
    void this.loadVersions(year);
    void this.loadCoverage();
  },

  onYearInput(event: WechatMiniprogram.Input) {
    const year = Number(event.detail.value);
    if (Number.isInteger(year) && year >= 2020 && year <= 2100) {
      this.setData({ year });
    }
  },

  onInputJson(event: WechatMiniprogram.TextareaInput) {
    this.setData({ inputJson: event.detail.value });
  },

  parseDates(): readonly {
    date: string;
    holidayName: string;
    isOffDay: boolean;
    isWorkday: boolean;
  }[] {
    const parsed = JSON.parse(this.data.inputJson) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error('请输入 JSON 数组。');
    }
    return parsed.map((entry) => {
      if (entry === null || typeof entry !== 'object') {
        throw new Error('数组元素必须是对象。');
      }
      const record = entry as {
        date?: unknown;
        holidayName?: unknown;
        isOffDay?: unknown;
        isWorkday?: unknown;
      };
      if (
        typeof record.date !== 'string' ||
        typeof record.holidayName !== 'string' ||
        typeof record.isOffDay !== 'boolean' ||
        typeof record.isWorkday !== 'boolean'
      ) {
        throw new Error('每条记录需要 date/holidayName/isOffDay/isWorkday 字段。');
      }
      return {
        date: record.date,
        holidayName: record.holidayName,
        isOffDay: record.isOffDay,
        isWorkday: record.isWorkday,
      };
    });
  },

  async handlePreview(): Promise<void> {
    this.setData({ errorMessage: '', submitting: true });
    try {
      const preview = await previewHolidayImport({
        dates: this.parseDates(),
        year: this.data.year,
      });
      this.setData({ preview });
    } catch (error) {
      this.setData({ errorMessage: toUserMessage(error, '导入预览失败。') });
    } finally {
      this.setData({ submitting: false });
    }
  },

  async handleImport(): Promise<void> {
    this.setData({ errorMessage: '', infoMessage: '', submitting: true });
    try {
      const result = await importHolidays({
        dates: this.parseDates(),
        year: this.data.year,
      });
      this.setData({
        infoMessage: `已导入草稿版本 ${result.version}（${result.dateCount} 条），请确认后生效。`,
      });
      await this.loadVersions(this.data.year);
    } catch (error) {
      this.setData({ errorMessage: toUserMessage(error, '导入失败。') });
    } finally {
      this.setData({ submitting: false });
    }
  },

  async loadVersions(year: number): Promise<void> {
    try {
      const versions = await listHolidayVersions(year);
      this.setData({
        versionRows: versions.map((version) => ({
          confirmedAt:
            version.confirmedAt === undefined ? '' : formatChinaDateTime(version.confirmedAt),
          dateCount: version.dateCount,
          id: version.id,
          status: version.status === 'confirmed' ? '已确认' : '草稿',
          version: version.version,
          year: version.year,
        })),
      });
    } catch {
      // 版本加载失败不阻塞
    }
  },

  async loadCoverage(): Promise<void> {
    try {
      const coverage = await getHolidayCoverage();
      this.setData({
        coverageText: `已确认年份：${coverage.confirmedYears.join('、') || '无'}；下一年${
          coverage.missingNextYear ? '缺失' : '已导入'
        }（${coverage.nextYear}）。`,
      });
    } catch {
      // 覆盖信息加载失败不阻塞
    }
  },

  async handleConfirm(event: WechatMiniprogram.TouchEvent): Promise<void> {
    const id = event.currentTarget.dataset.id;
    if (typeof id !== 'string' || id.length === 0) {
      return;
    }
    const confirmed = await confirmAction(
      '确认节假日版本',
      '确认后该版本立即生效，历史版本被替换。',
    );
    if (!confirmed) {
      return;
    }
    this.setData({ errorMessage: '', infoMessage: '', submitting: true });
    try {
      await confirmHolidayVersion(id);
      this.setData({ infoMessage: '节假日版本已确认。' });
      await this.loadVersions(this.data.year);
      await this.loadCoverage();
    } catch (error) {
      this.setData({ errorMessage: toUserMessage(error, '确认失败。') });
    } finally {
      this.setData({ submitting: false });
    }
  },
});

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
