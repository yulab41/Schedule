CREATE TABLE `wechat_admin_binding_tickets` (
  `id` CHAR(36) NOT NULL,
  `ticket_hash` CHAR(64) NOT NULL,
  `target_user_id` CHAR(36) NOT NULL,
  `app_id` VARCHAR(64) NOT NULL,
  `status` ENUM('pending', 'consumed') NOT NULL DEFAULT 'pending',
  `expires_at` TIMESTAMP(3) NOT NULL,
  `consumed_at` TIMESTAMP(3) NULL,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `wechat_admin_binding_tickets_ticket_hash_unique` (`ticket_hash`),
  KEY `wechat_admin_binding_tickets_target_status_idx` (`target_user_id`, `status`),
  KEY `wechat_admin_binding_tickets_expires_at_idx` (`expires_at`),
  CONSTRAINT `wechat_admin_binding_tickets_target_user_id_fk`
    FOREIGN KEY (`target_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
