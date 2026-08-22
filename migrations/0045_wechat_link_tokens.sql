CREATE TABLE `wechat_link_tokens` (
  `id` CHAR(36) NOT NULL,
  `token_hash` CHAR(64) NOT NULL,
  `app_id` VARCHAR(64) NOT NULL,
  `subject` VARCHAR(128) NOT NULL,
  `union_id` VARCHAR(128) NULL,
  `existing_user_id` CHAR(36) NULL,
  `status` ENUM('pending', 'consumed') NOT NULL DEFAULT 'pending',
  `expires_at` TIMESTAMP(3) NOT NULL,
  `consumed_at` TIMESTAMP(3) NULL,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `wechat_link_tokens_token_hash_unique` (`token_hash`),
  KEY `wechat_link_tokens_identity_status_idx` (`app_id`, `subject`, `status`),
  KEY `wechat_link_tokens_existing_user_idx` (`existing_user_id`),
  KEY `wechat_link_tokens_expires_at_idx` (`expires_at`),
  CONSTRAINT `wechat_link_tokens_existing_user_id_fk`
    FOREIGN KEY (`existing_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
