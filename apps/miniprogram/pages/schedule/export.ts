import type {
  GroupSummary,
  ScheduleExportJob,
  ScheduleExportType,
  SchedulingConfig,
} from '@schedule/contracts';

import {
  createExportJob,
  getExportJob,
  getSchedulingConfig,
  listGroups,
} from '../../api/endpoints.js';
import { getStoredToken } from '../../api/client.js';
import { appConfig } from '../../config/index.js';
import { getSelectedGroupId, resolveSelectedGroup, setSelectedGroupId } from '../../store/group.js';
import {
  buildExportFileName,
  getExportPeriodLabel,
  isExportJobFinished,
} from '../../utils/export-logic.js';
import { getCurrentBusinessMonth } from '../../utils/china-time.js';
import { toUserMessage } from '../../utils/user-message.js';

interface ExportPageData {
  readonly errorMessage: string;
  readonly exportType: ScheduleExportType;
  readonly groups: readonly GroupSummary[];
  readonly infoMessage: string;
  readonly job: ScheduleExportJob | undefined;
  readonly memberIndex: number;
  readonly memberOptions: readonly { readonly id: string; readonly name: string }[];
  readonly month: string;
  readonly periodLabel: string;
  readonly periodType: 'month' | 'year';
  readonly roleIndex: number;
  readonly roleOptions: readonly { readonly id: string; readonly name: string }[];
  readonly selectedGroupId: string;
  readonly submitting: boolean;
  readonly year: number;
  readonly yearOptions: readonly number[];
}

Page({
  data: {
    errorMessage: '',
    exportType: 'schedule',
    groups: [],
    infoMessage: '',
    job: undefined,
    memberIndex: 0,
    memberOptions: [],
    month: '',
    periodLabel: '',
    periodType: 'month',
    roleIndex: 0,
    roleOptions: [],
    selectedGroupId: '',
    submitting: false,
    year: 0,
    yearOptions: [],
  } as ExportPageData,

  onShow() {
    if (getStoredToken() === undefined) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    const now = getCurrentBusinessMonth();
    const year = Number(now.slice(0, 4));
    this.setData({
      month: now,
      periodLabel: getExportPeriodLabel(now),
      year,
      yearOptions: [year - 1, year, year + 1],
    });
    void this.loadContext();
  },

  async loadContext(): Promise<void> {
    this.setData({ errorMessage: '' });
    try {
      const groups = await listGroups();
      const selected = resolveSelectedGroup(groups, getSelectedGroupId());
      if (selected === undefined) {
        this.setData({ errorMessage: '请先加入一个群组。', groups });
        return;
      }
      setSelectedGroupId(selected.id);
      const config = await getSchedulingConfig(selected.id);
      this.config = config;
      this.setData({
        groups,
        memberOptions: config.groupMembers.map((member) => ({
          id: member.membershipId,
          name: member.realName,
        })),
        roleOptions: config.roles.map((role) => ({ id: role.id, name: role.name })),
        selectedGroupId: selected.id,
      });
    } catch (error) {
      this.setData({ errorMessage: toUserMessage(error, '导出配置加载失败。') });
    }
  },

  config: undefined as SchedulingConfig | undefined,

  onExportTypeChange(event: WechatMiniprogram.PickerChange) {
    const index = Number(event.detail.value ?? 0);
    this.setData({ exportType: index === 1 ? 'statistics' : 'schedule' });
  },

  onPeriodTypeChange(event: WechatMiniprogram.PickerChange) {
    const index = Number(event.detail.value ?? 0);
    this.setData({ periodType: index === 1 ? 'year' : 'month' });
  },

  onMonthChange(event: WechatMiniprogram.PickerChange) {
    const month = String(event.detail.value ?? '');
    this.setData({ month, periodLabel: getExportPeriodLabel(month) });
  },

  onYearChange(event: WechatMiniprogram.PickerChange) {
    const year = Number(event.detail.value ?? 0);
    this.setData({ year, periodLabel: getExportPeriodLabel(String(year)) });
  },

  onRoleChange(event: WechatMiniprogram.PickerChange) {
    this.setData({ roleIndex: Number(event.detail.value ?? 0) });
  },

  onMemberChange(event: WechatMiniprogram.PickerChange) {
    this.setData({ memberIndex: Number(event.detail.value ?? 0) });
  },

  async handleCreateJob(): Promise<void> {
    const role = this.data.roleOptions[this.data.roleIndex];
    const member = this.data.memberOptions[this.data.memberIndex];
    const period = this.data.periodType === 'month' ? this.data.month : String(this.data.year);
    this.setData({ errorMessage: '', infoMessage: '', submitting: true, job: undefined });
    try {
      const job = await createExportJob(this.data.selectedGroupId, {
        exportType: this.data.exportType,
        ...(role === undefined ? {} : { roleId: role.id }),
        ...(member === undefined ? {} : { membershipId: member.id }),
        period,
      });
      this.setData({ job });
      this.setData({ infoMessage: '导出任务已创建，正在轮询结果…' });
      await this.pollJob(job.id);
    } catch (error) {
      this.setData({ errorMessage: toUserMessage(error, '导出任务创建失败。') });
    } finally {
      this.setData({ submitting: false });
    }
  },

  async pollJob(jobId: string): Promise<void> {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const job = await getExportJob(this.data.selectedGroupId, jobId);
      this.setData({ job });
      if (isExportJobFinished(job)) {
        if (job.status === 'completed') {
          await this.downloadJob(job);
        } else {
          this.setData({ errorMessage: `导出失败：${job.error ?? '未知错误'}` });
        }
        return;
      }
    }
    this.setData({ errorMessage: '导出超时，请稍后重试。' });
  },

  async downloadJob(job: ScheduleExportJob): Promise<void> {
    const fileName = buildExportFileName(job.exportType, job.period);
    const filePath = `${wx.env.USER_DATA_PATH}/${fileName}`;
    const token = getStoredToken() ?? '';
    const download = (): Promise<string> =>
      new Promise((resolve, reject) => {
        wx.downloadFile({
          filePath,
          header: { Authorization: `Bearer ${token}` },
          success: (result) => {
            if (result.statusCode >= 200 && result.statusCode < 300) {
              resolve(result.filePath);
            } else {
              reject(new Error(`下载失败（${result.statusCode}）。`));
            }
          },
          fail: () => reject(new Error('下载失败，请检查网络。')),
          url: `${appConfig.apiBaseUrl}/groups/${encodeURIComponent(
            this.data.selectedGroupId,
          )}/exports/${encodeURIComponent(job.id)}/download`,
        });
      });
    try {
      const savedPath = await download();
      this.setData({
        infoMessage: `导出完成：${fileName}（${savedPath}）`,
      });
      wx.showModal({
        content: `文件已保存到 ${savedPath}`,
        confirmText: '打开',
        cancelText: '关闭',
        success: (result) => {
          if (result.confirm) {
            wx.openDocument({
              filePath: savedPath,
              fail: () => wx.showToast({ icon: 'none', title: '当前环境不支持预览 CSV' }),
            });
          }
        },
      });
    } catch (error) {
      this.setData({ errorMessage: toUserMessage(error, '下载失败。') });
    }
  },

  handleGroupChange(event: WechatMiniprogram.CustomEvent) {
    const groupId = event.detail.groupId;
    if (typeof groupId === 'string' && groupId.length > 0) {
      setSelectedGroupId(groupId);
      this.setData({ selectedGroupId: groupId });
      void this.loadContext();
    }
  },
});
