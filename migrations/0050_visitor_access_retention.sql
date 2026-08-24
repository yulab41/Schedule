ALTER TABLE `visitor_access_logs`
  ADD KEY `visitor_access_logs_created_idx` (`created_at`, `id`);
--> statement-breakpoint
CREATE TABLE `visitor_access_monthly_aggregates` (
  `group_id` CHAR(36) NOT NULL,
  `access_month` CHAR(7) NOT NULL,
  `business_month` CHAR(7) NOT NULL,
  `access_count` BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (`group_id`, `access_month`, `business_month`),
  CONSTRAINT `visitor_access_monthly_aggregates_group_id_fk`
    FOREIGN KEY (`group_id`) REFERENCES `groups` (`id`),
  CONSTRAINT `visitor_access_monthly_aggregates_access_month_check`
    CHECK (`access_month` REGEXP '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  CONSTRAINT `visitor_access_monthly_aggregates_business_month_check`
    CHECK (`business_month` REGEXP '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  CONSTRAINT `visitor_access_monthly_aggregates_count_check`
    CHECK (`access_count` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
