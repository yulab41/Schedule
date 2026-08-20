ALTER TABLE `groups`
  ADD COLUMN `default_calendar_view` ENUM('month', 'week', 'list') NOT NULL DEFAULT 'month'
    AFTER `duty_adjustment_approval_required`,
  ADD COLUMN `default_month_shift_type_id` CHAR(36) NULL
    AFTER `default_calendar_view`;
--> statement-breakpoint
ALTER TABLE `group_memberships`
  ADD COLUMN `calendar_view_override` ENUM('month', 'week', 'list') NULL
    AFTER `auto_accept_swaps_manually_set`,
  ADD COLUMN `month_shift_type_override_id` CHAR(36) NULL
    AFTER `calendar_view_override`;
