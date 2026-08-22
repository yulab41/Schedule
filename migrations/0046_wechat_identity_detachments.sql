CREATE TABLE `wechat_identity_detachments` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `provider` ENUM('wechat_mini_program', 'wechat_web') NOT NULL,
  `app_id` VARCHAR(64) NOT NULL,
  `subject_hash` CHAR(64) NOT NULL,
  `detached_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `wechat_identity_detachments_scope_unique` (`provider`, `app_id`, `subject_hash`),
  UNIQUE KEY `wechat_identity_detachments_user_scope_unique` (`provider`, `app_id`, `user_id`),
  CONSTRAINT `wechat_identity_detachments_user_id_fk`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
