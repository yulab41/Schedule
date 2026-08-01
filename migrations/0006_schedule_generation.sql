ALTER TABLE `groups`
  ADD COLUMN `schedule_publish_mode` ENUM('draft', 'published') NOT NULL DEFAULT 'draft' AFTER `rules_version`;
--> statement-breakpoint
ALTER TABLE `idempotency_keys`
  ADD COLUMN `result` JSON NULL AFTER `status`;
