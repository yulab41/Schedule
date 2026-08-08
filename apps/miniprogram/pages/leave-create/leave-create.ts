import { createLeaveRequest, getLeaveAffectedShifts } from '../../api/endpoints.js';
import { getSelectedGroupId } from '../../store/group.js';
import { allDayLeaveInterval, formatChinaDateShort } from '../../utils/time.js';
import { leaveTypeLabels } from '../../utils/workflow.js';

interface AffectedShiftRow {
  readonly coveredLabel: string;
  readonly label: string;
}

interface LeaveCreatePageData {
  readonly affectedShifts: readonly AffectedShiftRow[];
  readonly endDate: string;
  readonly errorMessage: string;
  readonly leaveType: string;
  readonly leaveTypeIndex: number;
  readonly leaveTypeNames: readonly string[];
  readonly loading: boolean;
  readonly reason: string;
  readonly resolutionMode: '' | 'manual' | 'shift-forward';
  readonly startDate: string;
  readonly submitting: boolean;
}

Page({
  data: {
    affectedShifts: [],
    endDate: '',
    errorMessage: '',
    leaveType: '其他',
    leaveTypeIndex: 1,
    leaveTypeNames: Object.values(leaveTypeLabels),
    loading: false,
    reason: '',
    resolutionMode: '',
    startDate: '',
    submitting: false,
  } as LeaveCreatePageData,

  onLoad() {
    const localDate = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
    this.setData({ endDate: localDate, startDate: localDate });
    void this.loadAffectedShifts();
  },

  handleStartDateChange(event: WechatMiniprogram.PickerChange) {
    const startDate = String(event.detail.value ?? '');
    this.setData({ startDate });
    void this.loadAffectedShifts();
  },

  handleEndDateChange(event: WechatMiniprogram.PickerChange) {
    const endDate = String(event.detail.value ?? '');
    this.setData({ endDate });
    void this.loadAffectedShifts();
  },

  handleTypeChange(event: WechatMiniprogram.PickerChange) {
    const leaveTypeIndex = Number(event.detail.value ?? 0);
    this.setData({
      leaveType: this.data.leaveTypeNames[leaveTypeIndex] ?? '其他',
      leaveTypeIndex,
    });
  },

  handleReasonInput(event: WechatMiniprogram.Input) {
    this.setData({ reason: event.detail.value });
  },

  selectResolutionMode(event: WechatMiniprogram.TouchEvent) {
    const mode = event.currentTarget.dataset.mode;
    if (mode === 'shift-forward' || mode === 'manual') {
      this.setData({ resolutionMode: mode });
    }
  },

  async loadAffectedShifts(): Promise<void> {
    if (this.data.startDate.length === 0 || this.data.endDate.length === 0) {
      return;
    }
    this.setData({ loading: true, errorMessage: '' });
    try {
      const interval = allDayLeaveInterval(this.data.startDate, this.data.endDate);
      const affected = await getLeaveAffectedShifts(getSelectedGroupId() ?? '', {
        endsAt: interval.endsAt,
        isAllDay: true,
        startsAt: interval.startsAt,
      });
      this.setData({
        affectedShifts: affected.map((shift) => ({
          coveredLabel: shift.isCovered ? '已安排' : '未安排',
          label: `${formatChinaDateShort(shift.businessDate)} ${shift.shiftTypeName}（${shift.shiftTypeAbbreviation}）`,
        })),
      });
    } catch (error) {
      this.setData({
        errorMessage:
          error instanceof Error && error.message.length > 0
            ? error.message
            : '影响班次加载失败，请稍后重试。',
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  async handleSubmit(): Promise<void> {
    if (this.data.submitting || this.data.loading) {
      return;
    }
    const startDate = this.data.startDate;
    const endDate = this.data.endDate;
    if (startDate.length === 0 || endDate.length === 0 || endDate < startDate) {
      this.setData({ errorMessage: '请选择正确的请假日期。' });
      return;
    }
    if (this.data.affectedShifts.length > 0 && this.data.resolutionMode.length === 0) {
      this.setData({ errorMessage: '请假影响已发布班次，请选择顺延或手动安排。' });
      return;
    }
    const hasAffectedShifts = this.data.affectedShifts.length > 0;
    this.setData({ errorMessage: '', submitting: true });
    try {
      const interval = allDayLeaveInterval(startDate, endDate);
      await createLeaveRequest(getSelectedGroupId() ?? '', {
        endsAt: interval.endsAt,
        isAllDay: true,
        leaveType: normalizeLeaveType(this.data.leaveType),
        ...(this.data.reason.trim().length > 0 ? { reason: this.data.reason.trim() } : {}),
        ...(hasAffectedShifts
          ? { resolutionMode: this.data.resolutionMode as 'shift-forward' | 'manual' }
          : {}),
        startsAt: interval.startsAt,
      });
      wx.showToast({ icon: 'success', title: '已提交申请' });
      setTimeout(() => {
        wx.navigateBack();
      }, 600);
    } catch (error) {
      this.setData({
        errorMessage:
          error instanceof Error && error.message.length > 0
            ? error.message
            : '提交失败，请稍后重试。',
      });
    } finally {
      this.setData({ submitting: false });
    }
  },
});

function normalizeLeaveType(
  label: string,
): 'training' | 'rotation' | 'sick' | 'maternity' | 'other' {
  const entry = Object.entries(leaveTypeLabels).find(([, value]) => value === label);
  return (entry?.[0] ?? 'other') as 'training' | 'rotation' | 'sick' | 'maternity' | 'other';
}
