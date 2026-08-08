import type { ScheduleEvent } from '@schedule/contracts';

import { formatChinaDateTimeShort } from './time.js';

const eventTypeLabels: Readonly<Record<string, string>> = {
  assignment_manually_updated: '人工调整班次',
  duty_adjustment_completed: '加扣班生效',
  duty_adjustment_request_accepted: '加扣班申请已接受',
  duty_adjustment_request_approved: '加扣班申请已批准',
  duty_adjustment_request_cancelled: '加扣班申请已取消',
  duty_adjustment_request_created: '加扣班申请已提交',
  duty_adjustment_request_rejected: '加扣班申请已驳回',
  duty_adjustment_revoked: '加扣班已撤销',
  leave_cover_completed: '请假替班完成',
  leave_request_cancelled: '请假申请已取消',
  leave_request_approved: '请假已批准',
  leave_request_rejected: '请假已驳回',
  leave_request_revoked: '请假已撤销',
  leave_request_submitted: '请假已提交',
  manual_schedule_template_applied: '手动模板已应用',
  manual_schedule_template_created: '手动模板已创建',
  manual_schedule_template_deleted: '手动模板已删除',
  manual_schedule_template_updated: '手动模板已更新',
  rotation_order_changed: '轮值顺序已调整',
  schedule_generation_completed: '自动排班已生成',
  schedule_period_created: '排班版本已创建',
  schedule_period_deleted: '排班草稿已删除',
  schedule_period_published: '排班已发布',
  schedule_period_replaced: '排班版本已替换',
  schedule_period_withdrawn: '排班版本已撤回',
  schedule_backfill_completed: '排班补录',
  schedule_role_changed: '排班岗位已调整',
  schedule_role_corrected: '排班岗位已更正',
  shift_type_changed: '班种已调整',
  swap_completed: '换班已生效',
  swap_request_accepted: '换班申请已接受',
  swap_request_approved: '换班申请已批准',
  swap_request_cancelled: '换班申请已取消',
  swap_request_created: '换班申请已提交',
  swap_request_rejected: '换班申请已驳回',
  swap_revoked: '换班已撤销',
};

export function getEventTypeLabel(eventType: string): string {
  return eventTypeLabels[eventType] ?? '排班变更';
}

export function formatEventTime(occurredAt: string): string {
  return formatChinaDateTimeShort(occurredAt);
}

export function buildEventNarrative(event: ScheduleEvent): string {
  const before = event.beforeData ?? {};
  const after = event.afterData ?? {};
  switch (event.eventType) {
    case 'swap_completed': {
      const beforeName = readMemberName(before) ?? readString(before.initiatorMemberName);
      const afterName = readMemberName(after) ?? readString(after.targetMemberName);
      const initiator =
        readString(before.initiatorMemberName) ?? readString(after.initiatorMemberName);
      if (beforeName !== undefined && afterName !== undefined) {
        return `${beforeName} → ${afterName}${initiator === undefined ? '' : `（由 ${initiator} 发起）`}`;
      }
      break;
    }
    case 'duty_adjustment_completed': {
      const deducted =
        readString(before.deductedMemberName) ?? readString(after.deductedMemberName);
      const overtime =
        readString(after.overtimeMemberName) ?? readString(before.overtimeMemberName);
      const initiator = readString(after.initiatorMemberName);
      if (overtime !== undefined) {
        return `${deducted ?? '原值班人员'} 的班次由 ${overtime} 代值${
          initiator === undefined ? '' : `（由 ${initiator} 发起）`
        }`;
      }
      break;
    }
    case 'assignment_manually_updated':
    case 'schedule_backfill_completed': {
      const beforeName = readMemberName(before);
      const afterName = readMemberName(after);
      if (beforeName !== undefined || afterName !== undefined) {
        const verb =
          event.eventType === 'schedule_backfill_completed' ? '排班补录' : '人工调整班次';
        return `${verb}：值班人员由 ${beforeName ?? '未设置'} 改为 ${afterName ?? '未设置'}`;
      }
      break;
    }
    case 'swap_request_created':
      return '换班申请已提交。';
    case 'swap_request_accepted':
      return '对方已接受换班申请。';
    case 'swap_request_approved':
      return '管理员已批准换班申请。';
    case 'swap_request_rejected':
      return '换班申请已被拒绝。';
    case 'swap_request_cancelled':
      return '换班申请已取消。';
    case 'swap_revoked':
      return '换班已撤销，值班人员已恢复为当前排班版本。';
    case 'leave_request_submitted':
      return '请假申请已提交。';
    case 'leave_request_approved':
      return '请假已批准。';
    case 'leave_request_rejected':
      return '请假申请已被拒绝。';
    case 'leave_request_cancelled':
      return '请假申请已取消。';
    case 'leave_request_revoked':
      return '请假已撤销；如需恢复原排班，请重新生成或发布排班。';
    case 'leave_cover_completed': {
      const strategy =
        after.strategy === 'shift-forward'
          ? '整体顺延'
          : after.strategy === 'keep-original-order'
            ? '保持原顺序'
            : '';
      return `请假替班完成${strategy === '' ? '' : `（${strategy}）`}。`;
    }
    case 'duty_adjustment_request_created':
      return '加扣班申请已提交。';
    case 'duty_adjustment_request_accepted':
      return '加班成员已接受加扣班申请。';
    case 'duty_adjustment_request_approved':
      return '管理员已批准加扣班申请。';
    case 'duty_adjustment_request_rejected':
      return '加扣班申请已被拒绝。';
    case 'duty_adjustment_request_cancelled':
      return '加扣班申请已取消。';
    case 'duty_adjustment_revoked': {
      const restoredName = readMemberName(after);
      return restoredName === undefined
        ? '加扣班已撤销，值班人员已恢复为当前排班版本。'
        : `加扣班已撤销：值班恢复为 ${restoredName}。`;
    }
    case 'schedule_period_published':
      return '排班已发布。';
    case 'schedule_period_created':
      return '排班版本已创建。';
    case 'schedule_period_deleted':
      return '排班草稿已删除。';
    case 'schedule_period_replaced':
      return '排班版本已被新版本替代。';
    case 'schedule_period_withdrawn':
      return '该排班版本已撤回。';
    case 'schedule_generation_completed':
      return '自动排班已生成。';
    case 'manual_schedule_template_applied':
      return '手动模板已应用。';
    case 'manual_schedule_template_created':
      return '手动排班模板已创建。';
    case 'manual_schedule_template_updated':
      return '手动排班模板已更新。';
    case 'manual_schedule_template_deleted':
      return '手动排班模板已删除。';
    case 'schedule_role_changed':
      return '排班岗位已调整。';
    case 'schedule_role_corrected':
      return '排班岗位已更正。';
    case 'shift_type_changed':
      return '班种已调整。';
    case 'rotation_order_changed':
      return '轮值顺序已调整。';
    default:
      break;
  }
  return `${getEventTypeLabel(event.eventType)}。`;
}

function readMemberName(value: object): string | undefined {
  const record = value as {
    actualMemberName?: unknown;
    plannedMemberName?: unknown;
  };
  if (typeof record.actualMemberName === 'string' && record.actualMemberName.length > 0) {
    return record.actualMemberName;
  }
  if (typeof record.plannedMemberName === 'string' && record.plannedMemberName.length > 0) {
    return record.plannedMemberName;
  }
  return undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
