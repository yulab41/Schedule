CREATE TABLE `schedule_roles` (
  `id` CHAR(36) NOT NULL,
  `group_id` CHAR(36) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at` TIMESTAMP(3) NULL,
  `version` INT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `schedule_roles_group_active_idx` (`group_id`, `deleted_at`),
  CONSTRAINT `schedule_roles_group_id_fk` FOREIGN KEY (`group_id`) REFERENCES `groups` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
--> statement-breakpoint
CREATE TABLE `member_schedule_roles` (
  `id` CHAR(36) NOT NULL,
  `schedule_role_id` CHAR(36) NOT NULL,
  `membership_id` CHAR(36) NOT NULL,
  `effective_from` DATE NULL,
  `effective_to` DATE NULL,
  `active_membership_id` CHAR(36) GENERATED ALWAYS AS (
    IF(`deleted_at` IS NULL, `membership_id`, NULL)
  ) STORED,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at` TIMESTAMP(3) NULL,
  `version` INT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `member_schedule_roles_active_member_unique` (`schedule_role_id`, `active_membership_id`),
  KEY `member_schedule_roles_membership_active_idx` (`membership_id`, `deleted_at`),
  CONSTRAINT `member_schedule_roles_schedule_role_id_fk` FOREIGN KEY (`schedule_role_id`) REFERENCES `schedule_roles` (`id`),
  CONSTRAINT `member_schedule_roles_membership_id_fk` FOREIGN KEY (`membership_id`) REFERENCES `group_memberships` (`id`),
  CONSTRAINT `member_schedule_roles_effective_dates_check` CHECK (
    `effective_to` IS NULL OR `effective_from` IS NULL OR `effective_to` >= `effective_from`
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
--> statement-breakpoint
CREATE TABLE `shift_types` (
  `id` CHAR(36) NOT NULL,
  `group_id` CHAR(36) NOT NULL,
  `template_key` VARCHAR(32) NULL,
  `name` VARCHAR(100) NOT NULL,
  `abbreviation` VARCHAR(16) NOT NULL,
  `display_order` INT UNSIGNED NOT NULL,
  `start_time` TIME NULL,
  `end_time` TIME NULL,
  `crosses_midnight` TINYINT UNSIGNED NOT NULL DEFAULT 0,
  `color` CHAR(7) NOT NULL,
  `text_color` CHAR(7) NOT NULL,
  `is_all_day` TINYINT UNSIGNED NOT NULL DEFAULT 0,
  `is_enabled` TINYINT UNSIGNED NOT NULL DEFAULT 0,
  `counts_toward_statistics` TINYINT UNSIGNED NOT NULL DEFAULT 1,
  `configuration_version` INT UNSIGNED NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at` TIMESTAMP(3) NULL,
  `version` INT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `shift_types_group_template_unique` (`group_id`, `template_key`),
  KEY `shift_types_group_active_order_idx` (`group_id`, `deleted_at`, `display_order`),
  CONSTRAINT `shift_types_group_id_fk` FOREIGN KEY (`group_id`) REFERENCES `groups` (`id`),
  CONSTRAINT `shift_types_time_pair_check` CHECK (
    (`start_time` IS NULL AND `end_time` IS NULL) OR (`start_time` IS NOT NULL AND `end_time` IS NOT NULL)
  ),
  CONSTRAINT `shift_types_enabled_time_check` CHECK (
    `is_enabled` = 0 OR (`start_time` IS NOT NULL AND `end_time` IS NOT NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
--> statement-breakpoint
CREATE TABLE `rotation_rules` (
  `id` CHAR(36) NOT NULL,
  `schedule_role_id` CHAR(36) NOT NULL,
  `default_shift_type_id` CHAR(36) NOT NULL,
  `required_members_per_day` INT UNSIGNED NOT NULL DEFAULT 1,
  `start_date` DATE NULL,
  `starting_member_schedule_role_id` CHAR(36) NULL,
  `current_position` INT UNSIGNED NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at` TIMESTAMP(3) NULL,
  `version` INT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `rotation_rules_schedule_role_unique` (`schedule_role_id`),
  KEY `rotation_rules_default_shift_type_idx` (`default_shift_type_id`),
  CONSTRAINT `rotation_rules_schedule_role_id_fk` FOREIGN KEY (`schedule_role_id`) REFERENCES `schedule_roles` (`id`),
  CONSTRAINT `rotation_rules_default_shift_type_id_fk` FOREIGN KEY (`default_shift_type_id`) REFERENCES `shift_types` (`id`),
  CONSTRAINT `rotation_rules_start_member_id_fk` FOREIGN KEY (`starting_member_schedule_role_id`) REFERENCES `member_schedule_roles` (`id`),
  CONSTRAINT `rotation_rules_required_members_check` CHECK (`required_members_per_day` > 0),
  CONSTRAINT `rotation_rules_current_position_check` CHECK (`current_position` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
--> statement-breakpoint
CREATE TABLE `rotation_members` (
  `id` CHAR(36) NOT NULL,
  `rotation_rule_id` CHAR(36) NOT NULL,
  `member_schedule_role_id` CHAR(36) NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `active_member_schedule_role_id` CHAR(36) GENERATED ALWAYS AS (
    IF(`deleted_at` IS NULL, `member_schedule_role_id`, NULL)
  ) STORED,
  `active_position` INT UNSIGNED GENERATED ALWAYS AS (
    IF(`deleted_at` IS NULL, `position`, NULL)
  ) STORED,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at` TIMESTAMP(3) NULL,
  `version` INT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `rotation_members_active_member_unique` (`rotation_rule_id`, `active_member_schedule_role_id`),
  UNIQUE KEY `rotation_members_active_position_unique` (`rotation_rule_id`, `active_position`),
  KEY `rotation_members_member_schedule_role_idx` (`member_schedule_role_id`),
  CONSTRAINT `rotation_members_rotation_rule_id_fk` FOREIGN KEY (`rotation_rule_id`) REFERENCES `rotation_rules` (`id`),
  CONSTRAINT `rotation_members_member_schedule_role_id_fk` FOREIGN KEY (`member_schedule_role_id`) REFERENCES `member_schedule_roles` (`id`),
  CONSTRAINT `rotation_members_position_check` CHECK (`position` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
--> statement-breakpoint
INSERT INTO `shift_types` (
  `id`, `group_id`, `template_key`, `name`, `abbreviation`, `display_order`, `start_time`,
  `end_time`, `crosses_midnight`, `color`, `text_color`, `is_all_day`, `is_enabled`,
  `counts_toward_statistics`
)
SELECT UUID(), `groups`.`id`, `templates`.`template_key`, `templates`.`name`,
       `templates`.`abbreviation`, `templates`.`display_order`, `templates`.`start_time`,
       `templates`.`end_time`, `templates`.`crosses_midnight`, `templates`.`color`,
       `templates`.`text_color`, `templates`.`is_all_day`, `templates`.`is_enabled`,
       `templates`.`counts_toward_statistics`
FROM `groups`
JOIN (
  SELECT 'all_day' AS `template_key`, '全天班' AS `name`, '全天' AS `abbreviation`, 1 AS `display_order`,
         '08:00:00' AS `start_time`, '08:00:00' AS `end_time`, 1 AS `crosses_midnight`,
         '#1F5AA6' AS `color`, '#FFFFFF' AS `text_color`, 1 AS `is_all_day`, 1 AS `is_enabled`,
         1 AS `counts_toward_statistics`
  UNION ALL SELECT 'a', 'A 班', 'A', 2, NULL, NULL, 0, '#0F766E', '#FFFFFF', 0, 0, 1
  UNION ALL SELECT 'n', 'N 班', 'N', 3, NULL, NULL, 0, '#4C1D95', '#FFFFFF', 0, 0, 1
  UNION ALL SELECT 'p', 'P 班', 'P', 4, NULL, NULL, 0, '#C2410C', '#FFFFFF', 0, 0, 1
  UNION ALL SELECT 'np', 'NP 班', 'NP', 5, NULL, NULL, 0, '#9F1239', '#FFFFFF', 0, 0, 1
  UNION ALL SELECT 'office', '办公班', '办公', 6, NULL, NULL, 0, '#475569', '#FFFFFF', 0, 0, 0
) AS `templates`
WHERE `groups`.`deleted_at` IS NULL;
