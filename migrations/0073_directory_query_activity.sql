ALTER TABLE `account_activity_summaries`
  ADD COLUMN `today_internal_directory_queries` int unsigned NOT NULL DEFAULT 0,
  ADD COLUMN `total_internal_directory_queries` bigint unsigned NOT NULL DEFAULT 0,
  ADD COLUMN `last_internal_directory_query_at` timestamp(3) NULL,
  ADD COLUMN `today_employee_directory_queries` int unsigned NOT NULL DEFAULT 0,
  ADD COLUMN `total_employee_directory_queries` bigint unsigned NOT NULL DEFAULT 0,
  ADD COLUMN `last_employee_directory_query_at` timestamp(3) NULL;
