-- Forward-incompatible: stop old API writers before applying; application-only rollback is unsafe.
-- Existing member_schedule_roles, manual templates, published assignments and events are retained.
DROP TABLE `rotation_members`;
--> statement-breakpoint
DROP TABLE `rotation_rules`;
--> statement-breakpoint
ALTER TABLE `groups` DROP COLUMN `leave_reflow_strategy`;
--> statement-breakpoint
ALTER TABLE `leave_requests` DROP COLUMN `reflow_strategy`;
