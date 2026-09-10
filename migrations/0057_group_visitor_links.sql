CREATE TABLE `group_visitor_links` (
  `id` char(36) NOT NULL,
  `first_group_id` char(36) NOT NULL,
  `second_group_id` char(36) NOT NULL,
  `is_enabled` tinyint unsigned NOT NULL DEFAULT 1,
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `version` int NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `group_visitor_links_pair_unique` (`first_group_id`, `second_group_id`),
  KEY `group_visitor_links_second_idx` (`second_group_id`, `is_enabled`),
  CONSTRAINT `group_visitor_links_order_check` CHECK (`first_group_id` < `second_group_id`),
  CONSTRAINT `group_visitor_links_enabled_check` CHECK (`is_enabled` IN (0, 1)),
  CONSTRAINT `group_visitor_links_first_fk` FOREIGN KEY (`first_group_id`) REFERENCES `groups` (`id`) ON DELETE CASCADE,
  CONSTRAINT `group_visitor_links_second_fk` FOREIGN KEY (`second_group_id`) REFERENCES `groups` (`id`) ON DELETE CASCADE
);
