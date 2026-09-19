ALTER TABLE `groups`
  ADD COLUMN `calendar_revision` bigint unsigned NOT NULL DEFAULT 0;
--> statement-breakpoint
CREATE TABLE `group_calendar_changes` (
  `id` char(36) NOT NULL,
  `group_id` char(36) NOT NULL,
  `seq` bigint unsigned NOT NULL,
  `business_month` char(7) NULL,
  `kind` enum('schedule', 'event', 'config', 'member') NOT NULL,
  `changed_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `group_calendar_changes_group_seq_unique` (`group_id`, `seq`),
  KEY `group_calendar_changes_group_changed_at_idx` (`group_id`, `changed_at`),
  CONSTRAINT `group_calendar_changes_group_id_fk`
    FOREIGN KEY (`group_id`) REFERENCES `groups` (`id`) ON DELETE CASCADE
);
