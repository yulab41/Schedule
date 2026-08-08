ALTER TABLE `notification_deliveries`
  MODIFY COLUMN `channel` ENUM('browser', 'wechat') NOT NULL DEFAULT 'browser',
  ADD COLUMN `external_message_id` VARCHAR(64) NULL AFTER `sent_at`;
--> statement-breakpoint
ALTER TABLE `notification_preferences`
  ADD COLUMN `wechat_notifications_enabled` TINYINT UNSIGNED NOT NULL DEFAULT 1
  AFTER `browser_notifications_enabled`;
--> statement-breakpoint
CREATE TABLE `visitor_access_logs` (
  `id` CHAR(36) NOT NULL,
  `group_id` CHAR(36) NOT NULL,
  `business_month` CHAR(7) NOT NULL,
  `client_ip` VARCHAR(45) NULL,
  `request_id` CHAR(36) NULL,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `visitor_access_logs_group_created_idx` (`group_id`, `created_at`, `id`),
  KEY `visitor_access_logs_business_month_idx` (`business_month`),
  CONSTRAINT `visitor_access_logs_group_id_fk`
    FOREIGN KEY (`group_id`) REFERENCES `groups` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
