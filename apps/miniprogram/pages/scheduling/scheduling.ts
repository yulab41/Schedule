import type {
  GroupSummary,
  ScheduleDraftSummary,
  ScheduleGenerationPreview,
  SchedulePeriodHistoryItem,
} from '@schedule/contracts';

import {
  deleteScheduleDraft,
  getSchedulePublishMode,
  getSchedulingConfig,
  listGroups,
  listScheduleDrafts,
  listSchedulePeriodHistory,
  previewScheduleChange,
  previewScheduleGeneration,
  publishScheduleDraftBatch,
  publishSchedulePeriod,
  saveGeneratedSchedule,
  updateSchedulePublishMode,
  withdrawSchedulePeriod,
} from '../../api/endpoints.js';
import { resolveSelectedGroup, setSelectedGroupId } from '../../store/group.js';
import { formatMonthLabel, shiftBusinessMonth } from '../../utils/calendar.js';
import { randomUuid } from '../../utils/uuid.js';

interface DraftRow {
  readonly id: string;
  readonly statusLabel: string;
  readonly title: string;
  readonly version: number;
}

interface HistoryRow {
  readonly canWithdraw: boolean;
  readonly id: string;
  readonly statusLabel: string;
  readonly title: string;
  readonly version: number;
}

interface PreviewSummary {
  readonly assignmentCount: number;
  readonly conflictCount: number;
  readonly countedAssignmentCount: number;
  readonly vacancyCount: number;
  readonly warningCount: number;
}

interface SchedulingPageData {
  readonly businessMonth: string;
  readonly draftRows: readonly DraftRow[];
  readonly errorMessage: string;
  readonly groupId: string;
  readonly groups: readonly GroupSummary[];
  readonly historyRows: readonly HistoryRow[];
  readonly infoMessage: string;
  readonly loading: boolean;
  readonly monthLabel: string;
  readonly preview: ScheduleGenerationPreview | undefined;
  readonly previewSummary: PreviewSummary | undefined;
  readonly publishModeIndex: number;
  readonly publishModeLabel: string;
  readonly roleChecked: readonly boolean[];
  readonly roleNames: readonly string[];
  readonly rulesVersion: number;
  readonly submitting: boolean;
}

Page({
  data: {
    businessMonth: '',
    draftRows: [],
    errorMessage: '',
    groupId: '',
    groups: [],
    historyRows: [],
    infoMessage: '',
    loading: false,
    monthLabel: '',
    preview: undefined,
    previewSummary: undefined,
    publishModeIndex: 0,
    publishModeLabel: '草稿',
    roleChecked: [],
    roleNames: [],
    rulesVersion: 0,
    submitting: false,
  } as SchedulingPageData,

  onLoad(options: Record<string, string | undefined>) {
    const groupId = options.groupId;
    if (typeof groupId === 'string' && groupId.length > 0) {
      this.setData({ groupId });
    }
  },

  onShow() {
    void this.loadAll();
  },

  async loadAll(): Promise<void> {
    this.setData({ errorMessage: '', infoMessage: '', loading: true });
    try {
      const groups = await listGroups();
      const selected = resolveSelectedGroup(groups, this.data.groupId);
      if (selected === undefined) {
        this.setData({ groups, draftRows: [], historyRows: [] });
        return;
      }
      setSelectedGroupId(selected.id);
      const [publishMode, drafts, history, config] = await Promise.all([
        getSchedulePublishMode(selected.id),
        listScheduleDrafts(selected.id),
        listSchedulePeriodHistory(selected.id),
        getSchedulingConfig(selected.id),
      ]);
      const businessMonth = this.data.businessMonth || currentBusinessMonth();
      this.setData({
        businessMonth,
        draftRows: drafts.map(buildDraftRow),
        groupId: selected.id,
        groups,
        historyRows: history.map(buildHistoryRow),
        monthLabel: formatMonthLabel(businessMonth),
        publishModeIndex: publishMode.publishMode === 'published' ? 1 : 0,
        publishModeLabel: publishMode.publishMode === 'published' ? '发布' : '草稿',
        roleChecked: config.roles.map(() => true),
        roleNames: config.roles.map((role) => role.name),
        rulesVersion: config.rulesVersion,
      });
    } catch (error) {
      this.setData({ errorMessage: toErrorMessage(error) });
    } finally {
      this.setData({ loading: false });
    }
  },

  handlePublishModeChange(event: WechatMiniprogram.PickerChange) {
    const publishModeIndex = Number(event.detail.value ?? 0);
    this.setData({
      publishModeIndex,
      publishModeLabel: publishModeIndex === 1 ? '发布' : '草稿',
    });
  },

  async handleSavePublishMode(): Promise<void> {
    if (this.data.groupId.length === 0) {
      return;
    }
    const publishMode = this.data.publishModeIndex === 1 ? 'published' : 'draft';
    this.setData({ errorMessage: '', infoMessage: '', submitting: true });
    try {
      await updateSchedulePublishMode(this.data.groupId, { publishMode });
      wx.showToast({ icon: 'success', title: '发布模式已保存' });
    } catch (error) {
      this.setData({ errorMessage: toErrorMessage(error) });
    } finally {
      this.setData({ submitting: false });
    }
  },

  handleRoleToggle(event: WechatMiniprogram.SwitchChange) {
    const index = Number(event.currentTarget.dataset.index ?? -1);
    if (index < 0 || index >= this.data.roleChecked.length) {
      return;
    }
    this.setData({ [`roleChecked[${index}]`]: event.detail.value });
  },

  changeMonth(event: WechatMiniprogram.TouchEvent) {
    const delta = Number(event.currentTarget.dataset.delta ?? 0);
    if (!Number.isInteger(delta)) {
      return;
    }
    const businessMonth = shiftBusinessMonth(this.data.businessMonth, delta);
    this.setData({ businessMonth, monthLabel: formatMonthLabel(businessMonth) });
  },

  async handleGeneratePreview(): Promise<void> {
    if (this.data.groupId.length === 0) {
      return;
    }
    const scheduleRoleIds = this.data.roleNames
      .map((_, index) => (this.data.roleChecked[index] ? index : -1))
      .filter((index) => index >= 0);
    if (scheduleRoleIds.length === 0) {
      this.setData({ errorMessage: '请至少选择一个排班岗位。' });
      return;
    }
    this.setData({ errorMessage: '', infoMessage: '', submitting: true });
    try {
      const config = await getSchedulingConfig(this.data.groupId);
      const preview = await previewScheduleGeneration(this.data.groupId, {
        businessMonth: this.data.businessMonth,
        publishMode: this.data.publishModeIndex === 1 ? 'published' : 'draft',
        rulesVersion: config.rulesVersion,
        scheduleRoleIds: scheduleRoleIds.map((index) => config.roles[index].id),
      });
      this.setData({
        preview,
        previewSummary: buildPreviewSummary(preview),
      });
    } catch (error) {
      this.setData({ errorMessage: toErrorMessage(error) });
    } finally {
      this.setData({ submitting: false });
    }
  },

  async handleSaveGenerated(): Promise<void> {
    const preview = this.data.preview;
    if (preview === undefined || this.data.groupId.length === 0) {
      return;
    }
    const confirmed = await confirmAction(
      '保存排班',
      `将按预览生成 ${this.data.monthLabel} 排班（${preview.assignments.length} 条记录），确定保存吗？`,
    );
    if (!confirmed) {
      return;
    }
    this.setData({ errorMessage: '', infoMessage: '', submitting: true });
    try {
      const result = await saveGeneratedSchedule(this.data.groupId, {
        acknowledgeBlockers: (preview.hardConflicts?.length ?? 0) > 0,
        businessMonth: preview.businessMonth.slice(0, 7),
        operationId: randomUuid(),
        publishMode: this.data.publishModeIndex === 1 ? 'published' : 'draft',
        rulesVersion: preview.rulesVersion,
        scheduleRoleIds: preview.scheduleRoleIds,
      });
      this.setData({
        infoMessage:
          result.status === 'published' ? '排班已生成并发布。' : '排班草稿已保存，可稍后发布。',
        preview: undefined,
        previewSummary: undefined,
      });
      await this.loadAll();
    } catch (error) {
      this.setData({ errorMessage: toErrorMessage(error) });
    } finally {
      this.setData({ submitting: false });
    }
  },

  async handlePublishDraft(event: WechatMiniprogram.TouchEvent): Promise<void> {
    const id = event.currentTarget.dataset.id;
    const version = Number(event.currentTarget.dataset.version);
    if (typeof id !== 'string' || !Number.isInteger(version) || this.data.groupId.length === 0) {
      return;
    }
    const confirmed = await confirmAction('发布排班', '发布后将替换当前生效的已发布排班吗？');
    if (!confirmed) {
      return;
    }
    this.setData({ errorMessage: '', infoMessage: '', submitting: true });
    try {
      const impact = await previewScheduleChange(this.data.groupId, id, 'publish');
      const acknowledgeWorkflowRevocations = impact.workflowImpacts.length > 0;
      if (acknowledgeWorkflowRevocations) {
        const confirmedImpact = await confirmAction(
          '发布将影响工作流',
          `有 ${impact.workflowImpacts.length} 组换班/加扣班会被自动撤销，确定继续吗？`,
        );
        if (!confirmedImpact) {
          return;
        }
      }
      await publishSchedulePeriod(this.data.groupId, id, {
        acknowledgeWorkflowRevocations,
        expectedVersion: version,
        operationId: randomUuid(),
        replacePublished: true,
      });
      wx.showToast({ icon: 'success', title: '排班已发布' });
      await this.loadAll();
    } catch (error) {
      this.setData({ errorMessage: toErrorMessage(error) });
    } finally {
      this.setData({ submitting: false });
    }
  },

  async handleWithdraw(event: WechatMiniprogram.TouchEvent): Promise<void> {
    const id = event.currentTarget.dataset.id;
    const version = Number(event.currentTarget.dataset.version);
    if (typeof id !== 'string' || !Number.isInteger(version) || this.data.groupId.length === 0) {
      return;
    }
    const confirmed = await confirmAction('撤回排班', '撤回后该排班不再生效，确定继续吗？');
    if (!confirmed) {
      return;
    }
    this.setData({ errorMessage: '', infoMessage: '', submitting: true });
    try {
      const impact = await previewScheduleChange(this.data.groupId, id, 'withdraw');
      await withdrawSchedulePeriod(this.data.groupId, id, {
        acknowledgeWorkflowRevocations: impact.workflowImpacts.length > 0,
        expectedVersion: version,
        operationId: randomUuid(),
      });
      wx.showToast({ icon: 'success', title: '排班已撤回' });
      await this.loadAll();
    } catch (error) {
      this.setData({ errorMessage: toErrorMessage(error) });
    } finally {
      this.setData({ submitting: false });
    }
  },

  async handleDeleteDraft(event: WechatMiniprogram.TouchEvent): Promise<void> {
    const id = event.currentTarget.dataset.id;
    if (typeof id !== 'string' || this.data.groupId.length === 0) {
      return;
    }
    const confirmed = await confirmAction('删除草稿', '确定删除该排班草稿吗？删除后不可恢复。');
    if (!confirmed) {
      return;
    }
    this.setData({ errorMessage: '', infoMessage: '', submitting: true });
    try {
      await deleteScheduleDraft(this.data.groupId, id);
      wx.showToast({ icon: 'success', title: '草稿已删除' });
      await this.loadAll();
    } catch (error) {
      this.setData({ errorMessage: toErrorMessage(error) });
    } finally {
      this.setData({ submitting: false });
    }
  },

  async handleBatchPublish(): Promise<void> {
    if (this.data.draftRows.length === 0 || this.data.groupId.length === 0) {
      return;
    }
    const confirmed = await confirmAction(
      '批量发布',
      `确定发布全部 ${this.data.draftRows.length} 个排班草稿吗？`,
    );
    if (!confirmed) {
      return;
    }
    this.setData({ errorMessage: '', infoMessage: '', submitting: true });
    try {
      const result = await publishScheduleDraftBatch(this.data.groupId, {
        operationId: randomUuid(),
        replacePublished: true,
        schedulePeriodIds: this.data.draftRows.map((row) => row.id),
      });
      this.setData({ infoMessage: `已发布 ${result.periods.length} 个排班。` });
      await this.loadAll();
    } catch (error) {
      this.setData({ errorMessage: toErrorMessage(error) });
    } finally {
      this.setData({ submitting: false });
    }
  },

  openManualTemplates(): void {
    if (this.data.groupId.length === 0) {
      return;
    }
    wx.navigateTo({
      url: `/pages/scheduling/manual-templates?groupId=${encodeURIComponent(this.data.groupId)}`,
    });
  },
});

function buildDraftRow(draft: ScheduleDraftSummary): DraftRow {
  return {
    id: draft.id,
    statusLabel: draftStatusLabel(draft.status),
    title: `${draft.scheduleRoleName} · ${draft.businessMonth}`,
    version: draft.version,
  };
}

function buildHistoryRow(item: SchedulePeriodHistoryItem): HistoryRow {
  return {
    canWithdraw: item.status === 'published',
    id: item.id,
    statusLabel: historyStatusLabel(item.status),
    title: `${item.scheduleRoleName} · ${item.businessMonth}`,
    version: item.version,
  };
}

function buildPreviewSummary(preview: ScheduleGenerationPreview): PreviewSummary {
  return {
    assignmentCount: preview.assignments.length,
    conflictCount: preview.hardConflicts?.length ?? 0,
    countedAssignmentCount: preview.statistics.countedAssignmentCount,
    vacancyCount: preview.vacancies?.length ?? 0,
    warningCount: preview.continuousDutyWarnings?.length ?? 0,
  };
}

function draftStatusLabel(status: string): string {
  if (status === 'published') {
    return '已发布';
  }
  if (status === 'pending_publication') {
    return '待发布';
  }
  return status === 'draft' ? '草稿' : status;
}

function historyStatusLabel(status: SchedulePeriodHistoryItem['status']): string {
  switch (status) {
    case 'draft':
      return '草稿';
    case 'pending_publication':
      return '待发布';
    case 'published':
      return '已发布';
    case 'replaced':
      return '已替换';
    case 'withdrawn':
      return '已撤回';
    case 'past':
      return '已归档';
  }
}

function currentBusinessMonth(): string {
  const date = new Date();
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(
    2,
    '0',
  )}`;
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

function toErrorMessage(error: unknown): string {
  return error instanceof Error && error.message.length > 0
    ? error.message
    : '操作失败，请稍后重试。';
}
