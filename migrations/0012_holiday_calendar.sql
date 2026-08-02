CREATE TABLE `holiday_calendar_versions` (
  `id` CHAR(36) NOT NULL,
  `year` SMALLINT UNSIGNED NOT NULL,
  `version` INT UNSIGNED NOT NULL,
  `status` ENUM('draft', 'confirmed') NOT NULL DEFAULT 'draft',
  `created_by_user_id` CHAR(36) NULL,
  `confirmed_at` TIMESTAMP(3) NULL,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at` TIMESTAMP(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `holiday_calendar_versions_year_version_unique` (`year`, `version`),
  KEY `holiday_calendar_versions_year_status_idx` (`year`, `status`, `deleted_at`),
  CONSTRAINT `holiday_calendar_versions_created_by_fk`
    FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
--> statement-breakpoint
CREATE TABLE `holiday_dates` (
  `id` CHAR(36) NOT NULL,
  `calendar_version_id` CHAR(36) NOT NULL,
  `calendar_date` DATE NOT NULL,
  `holiday_name` VARCHAR(100) NOT NULL,
  `is_off_day` TINYINT UNSIGNED NOT NULL DEFAULT 0,
  `is_workday` TINYINT UNSIGNED NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `holiday_dates_version_date_unique` (`calendar_version_id`, `calendar_date`),
  KEY `holiday_dates_date_idx` (`calendar_date`),
  CONSTRAINT `holiday_dates_calendar_version_id_fk`
    FOREIGN KEY (`calendar_version_id`) REFERENCES `holiday_calendar_versions` (`id`),
  CONSTRAINT `holiday_dates_arrangement_check`
    CHECK (`is_off_day` + `is_workday` = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
