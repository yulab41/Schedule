ALTER TABLE `schedule_events`
  ADD COLUMN `timeline_hidden_at` timestamp(3) NULL,
  ADD INDEX `schedule_events_timeline_idx` (`group_id`, `timeline_hidden_at`, `occurred_at`, `id`);
--> statement-breakpoint
ALTER TABLE `shift_assignments`
  ADD COLUMN `backfill_hidden_at` timestamp(3) NULL,
  ADD COLUMN `backfill_visible_at` timestamp(3) GENERATED ALWAYS AS (if(`backfill_hidden_at` is null or `backfill_at` <> `backfill_hidden_at`, `backfill_at`, null)) STORED,
  ADD INDEX `shift_assignments_backfill_visible_idx` (`schedule_period_id`, `backfill_visible_at`, `id`);
--> statement-breakpoint
UPDATE `schedule_events` AS event
INNER JOIN `audit_logs` AS marker
  ON marker.`target_id` = event.`id` AND marker.`group_id` = event.`group_id`
  AND marker.`action` = 'miniprogram_event_hidden' AND marker.`target_type` = 'schedule_event'
SET event.`timeline_hidden_at` = marker.`occurred_at`;
--> statement-breakpoint
UPDATE `shift_assignments` AS assignment
INNER JOIN `schedule_periods` AS period ON period.`id` = assignment.`schedule_period_id`
INNER JOIN `audit_logs` AS marker
  ON marker.`target_id` = assignment.`id` AND marker.`group_id` = period.`group_id`
  AND marker.`action` = 'miniprogram_backfill_record_hidden' AND marker.`target_type` = 'shift_assignment'
  AND JSON_EXTRACT(marker.`metadata`, '$.backfillAtMillis') = UNIX_TIMESTAMP(assignment.`backfill_at`) * 1000
SET assignment.`backfill_hidden_at` = assignment.`backfill_at`, assignment.`updated_at` = assignment.`updated_at`;
--> statement-breakpoint
ALTER TABLE `swap_requests`
  ADD COLUMN `list_hidden_at` timestamp(3) NULL,
  ADD INDEX `swap_requests_list_visible_idx` (`group_id`, `list_hidden_at`, `id`);
--> statement-breakpoint
ALTER TABLE `duty_adjustments`
  ADD COLUMN `list_hidden_at` timestamp(3) NULL,
  ADD INDEX `duty_adjustments_list_visible_idx` (`group_id`, `list_hidden_at`, `id`);
--> statement-breakpoint
ALTER TABLE `leave_requests`
  ADD COLUMN `list_hidden_at` timestamp(3) NULL,
  ADD INDEX `leave_requests_list_visible_idx` (`group_id`, `list_hidden_at`, `id`);
