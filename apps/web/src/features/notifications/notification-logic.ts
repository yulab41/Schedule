import type { NotificationRecord } from '@schedule/contracts';

const labelByType: Readonly<Record<string, string>> = {
  approval_pending: '待审批',
  conflict_detected: '排班冲突',
  duty_adjustment_request_accepted: '加扣班已接受',
  duty_adjustment_request_cancelled: '加扣班已取消',
  duty_adjustment_request_created: '加扣班申请',
  duty_adjustment_request_rejected: '加扣班已驳回',
  duty_adjustment_revoked: '加扣班已撤销',
  duty_reminder: '值班提醒',
  leave_request_approved: '请假已批准',
  leave_request_rejected: '请假已驳回',
  schedule_changed: '排班已调整',
  schedule_generated: '排班已生成',
  schedule_published: '排班已发布',
  swap_request_accepted: '换班已接受',
  swap_request_cancelled: '换班已取消',
  swap_request_created: '换班申请',
  swap_request_rejected: '换班已驳回',
  vacancy_reminder: '值班空缺提醒',
};

export type NotificationTone = 'danger' | 'default' | 'primary' | 'success' | 'warning';

const dangerNotificationTypes = new Set([
  'conflict_detected',
  'duty_adjustment_request_rejected',
  'leave_request_rejected',
  'swap_request_rejected',
]);
const warningNotificationTypes = new Set([
  'approval_pending',
  'duty_adjustment_request_created',
  'swap_request_created',
  'vacancy_reminder',
]);
const successNotificationTypes = new Set([
  'duty_adjustment_request_accepted',
  'leave_request_approved',
  'schedule_generated',
  'schedule_published',
  'swap_request_accepted',
]);
const primaryNotificationTypes = new Set([
  'duty_reminder',
  'schedule_changed',
  'duty_adjustment_request_cancelled',
  'duty_adjustment_revoked',
  'swap_request_cancelled',
]);

export function getNotificationLabel(notificationType: string): string {
  return labelByType[notificationType] ?? '通知';
}

export function getNotificationTone(notificationType: string): NotificationTone {
  if (dangerNotificationTypes.has(notificationType)) return 'danger';
  if (warningNotificationTypes.has(notificationType)) return 'warning';
  if (successNotificationTypes.has(notificationType)) return 'success';
  if (primaryNotificationTypes.has(notificationType)) return 'primary';
  return 'default';
}

export function formatNotificationTime(createdAt: string, now: Date): string {
  const created = new Date(createdAt);
  if (Number.isNaN(created.valueOf())) {
    return '';
  }

  const elapsedMinutes = Math.floor((now.valueOf() - created.valueOf()) / 60_000);
  if (elapsedMinutes < 1) {
    return '刚刚';
  }
  if (elapsedMinutes < 60) {
    return `${elapsedMinutes} 分钟前`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) {
    return `${elapsedHours} 小时前`;
  }

  const elapsedDays = Math.floor(elapsedHours / 24);
  if (elapsedDays < 7) {
    return `${elapsedDays} 天前`;
  }

  return `${String(created.getFullYear()).padStart(4, '0')}-${String(created.getMonth() + 1).padStart(2, '0')}-${String(created.getDate()).padStart(2, '0')} ${String(created.getHours()).padStart(2, '0')}:${String(created.getMinutes()).padStart(2, '0')}`;
}

export function getGenericBrowserNotificationBody(): string {
  return '排班信息有更新';
}

export function findNewUnreadNotifications(
  notifications: readonly NotificationRecord[],
  knownNotificationIds: ReadonlySet<string>,
): readonly NotificationRecord[] {
  return notifications.filter(
    (notification) => !notification.isRead && !knownNotificationIds.has(notification.id),
  );
}

export function getNotificationTargetUrl(notification: NotificationRecord): string {
  return notification.shiftAssignmentId === undefined ? '/' : '/';
}

export function parseReminderHoursInput(value: string): number[] {
  const tokens = value
    .split(/[,，、\s]+/u)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  const hours = tokens.map((entry) => Number(entry));
  const uniqueHours = [...new Set(hours)].sort((first, second) => second - first);

  if (
    tokens.length === 0 ||
    hours.some((hour) => !Number.isInteger(hour) || hour < 1 || hour > 720) ||
    uniqueHours.length > 5
  ) {
    throw new Error('请输入 1 到 5 个互不相同、1 到 720 之间的整数小时数。');
  }

  return uniqueHours;
}

export function formatReminderHours(hours: readonly number[] | null): string {
  return hours === null || hours.length === 0 ? '' : hours.join(', ');
}
