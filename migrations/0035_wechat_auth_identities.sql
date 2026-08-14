CREATE TABLE `user_auth_identities` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `provider` ENUM('wechat_mini_program', 'wechat_web') NOT NULL,
  `subject` VARCHAR(128) NOT NULL,
  `union_id` VARCHAR(128) NULL,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_auth_identities_provider_subject_unique` (`provider`, `subject`),
  UNIQUE KEY `user_auth_identities_union_id_unique` (`union_id`),
  KEY `user_auth_identities_user_idx` (`user_id`),
  CONSTRAINT `user_auth_identities_user_id_fk`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
