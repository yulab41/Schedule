CREATE TABLE `user_profile_avatars` (
  `user_id` CHAR(36) NOT NULL,
  `content` MEDIUMBLOB NOT NULL,
  `content_type` VARCHAR(32) NOT NULL,
  `byte_length` INT UNSIGNED NOT NULL,
  `sha256` CHAR(64) NOT NULL,
  `version` INT UNSIGNED NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`user_id`),
  CONSTRAINT `user_profile_avatars_user_fk`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_profile_avatars_byte_length_check`
    CHECK (`byte_length` BETWEEN 1 AND 1048576),
  CONSTRAINT `user_profile_avatars_content_type_check`
    CHECK (`content_type` IN ('image/jpeg', 'image/png', 'image/webp'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
