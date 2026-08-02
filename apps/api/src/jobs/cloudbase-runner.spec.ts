import { describe, expect, it } from 'vitest';

import { resolveScheduledJobName } from './cloudbase-runner.js';

describe('resolveScheduledJobName', () => {
  it('maps every configured timer trigger to its job', () => {
    expect(resolveScheduledJobName({ TriggerName: 'schedule_database_backup' })).toBe(
      'database-backup',
    );
    expect(resolveScheduledJobName({ TriggerName: 'schedule_duty_reminders' })).toBe(
      'duty-reminders',
    );
    expect(resolveScheduledJobName({ TriggerName: 'schedule_export_jobs' })).toBe('export-jobs');
    expect(resolveScheduledJobName({ TriggerName: 'schedule_group_recycle' })).toBe(
      'group-recycle',
    );
    expect(resolveScheduledJobName({ TriggerName: 'schedule_holiday_alerts' })).toBe(
      'holiday-alerts',
    );
    expect(resolveScheduledJobName({ TriggerName: 'schedule_notification_retry' })).toBe(
      'notification-retry',
    );
    expect(resolveScheduledJobName({ TriggerName: 'schedule_statistics_rebuild' })).toBe(
      'statistics-rebuild',
    );
  });

  it('returns undefined for unknown or missing triggers', () => {
    expect(resolveScheduledJobName({ TriggerName: 'unknown_trigger' })).toBeUndefined();
    expect(resolveScheduledJobName({})).toBeUndefined();
    expect(resolveScheduledJobName({ TriggerName: 42 })).toBeUndefined();
  });
});
