CREATE TABLE `statistics_snapshots` (
  `id` CHAR(36) NOT NULL,
  `group_id` CHAR(36) NOT NULL,
  `business_month` DATE NOT NULL,
  `payload` JSON NOT NULL,
  `triggered_by_event_id` CHAR(36) NULL,
  `computed_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `version` INT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `statistics_snapshots_group_month_unique` (`group_id`, `business_month`),
  KEY `statistics_snapshots_month_idx` (`business_month`),
  CONSTRAINT `statistics_snapshots_group_id_fk`
    FOREIGN KEY (`group_id`) REFERENCES `groups` (`id`),
  CONSTRAINT `statistics_snapshots_triggered_by_event_id_fk`
    FOREIGN KEY (`triggered_by_event_id`) REFERENCES `schedule_events` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
--> statement-breakpoint
CREATE TABLE `statistics_recalc_checks` (
  `id` CHAR(36) NOT NULL,
  `group_id` CHAR(36) NOT NULL,
  `business_month` DATE NOT NULL,
  `snapshot_version` INT UNSIGNED NOT NULL,
  `recomputed_payload` JSON NOT NULL,
  `matched` TINYINT UNSIGNED NOT NULL DEFAULT 0,
  `mismatch_summary` JSON NOT NULL,
  `checked_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `checked_by_user_id` CHAR(36) NULL,
  PRIMARY KEY (`id`),
  KEY `statistics_recalc_checks_group_month_idx` (`group_id`, `business_month`),
  CONSTRAINT `statistics_recalc_checks_group_id_fk`
    FOREIGN KEY (`group_id`) REFERENCES `groups` (`id`),
  CONSTRAINT `statistics_recalc_checks_checked_by_user_id_fk`
    FOREIGN KEY (`checked_by_user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
