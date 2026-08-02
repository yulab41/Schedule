CREATE TABLE `backup_archives` (
  `id` CHAR(36) NOT NULL,
  `backup_kind` ENUM('daily', 'monthly') NOT NULL,
  `storage_key` VARCHAR(500) NOT NULL,
  `file_size` INT UNSIGNED NOT NULL,
  `sha256` CHAR(64) NOT NULL,
  `table_count` INT UNSIGNED NOT NULL,
  `row_count` INT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `deleted_at` TIMESTAMP(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `backup_archives_storage_key_unique` (`storage_key`),
  KEY `backup_archives_kind_created_idx` (`backup_kind`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
