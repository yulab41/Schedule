CREATE TABLE `platform_job_runs` (
  `id` CHAR(36) NOT NULL,
  `job_name` VARCHAR(64) NOT NULL,
  `status` ENUM('running', 'completed', 'failed') NOT NULL DEFAULT 'running',
  `summary` VARCHAR(500) NULL,
  `started_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `finished_at` TIMESTAMP(3) NULL,
  PRIMARY KEY (`id`),
  KEY `platform_job_runs_name_started_idx` (`job_name`, `started_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
