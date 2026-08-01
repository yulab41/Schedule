CREATE TABLE `manual_schedule_templates` (
  `id` CHAR(36) NOT NULL,
  `group_id` CHAR(36) NOT NULL,
  `schedule_role_id` CHAR(36) NOT NULL,
  `start_date` DATE NOT NULL,
  `cycle_days` INT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at` TIMESTAMP(3) NULL,
  `version` INT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `manual_schedule_templates_group_active_idx` (`group_id`, `deleted_at`),
  KEY `manual_schedule_templates_role_idx` (`schedule_role_id`),
  CONSTRAINT `manual_schedule_templates_group_id_fk` FOREIGN KEY (`group_id`) REFERENCES `groups` (`id`),
  CONSTRAINT `manual_schedule_templates_schedule_role_id_fk` FOREIGN KEY (`schedule_role_id`) REFERENCES `schedule_roles` (`id`),
  CONSTRAINT `manual_schedule_templates_cycle_days_check` CHECK (`cycle_days` BETWEEN 1 AND 31)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
--> statement-breakpoint
CREATE TABLE `manual_schedule_template_members` (
  `id` CHAR(36) NOT NULL,
  `template_id` CHAR(36) NOT NULL,
  `membership_id` CHAR(36) NOT NULL,
  `member_schedule_role_version` INT UNSIGNED NOT NULL,
  `active_membership_id` CHAR(36) GENERATED ALWAYS AS (
    IF(`deleted_at` IS NULL, `membership_id`, NULL)
  ) STORED,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at` TIMESTAMP(3) NULL,
  `version` INT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `manual_schedule_template_members_active_unique` (`template_id`, `active_membership_id`),
  KEY `manual_schedule_template_members_template_idx` (`template_id`),
  KEY `manual_schedule_template_members_membership_idx` (`membership_id`),
  CONSTRAINT `manual_schedule_template_members_template_id_fk` FOREIGN KEY (`template_id`) REFERENCES `manual_schedule_templates` (`id`),
  CONSTRAINT `manual_schedule_template_members_membership_id_fk` FOREIGN KEY (`membership_id`) REFERENCES `group_memberships` (`id`),
  CONSTRAINT `manual_schedule_template_members_version_check` CHECK (`member_schedule_role_version` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
--> statement-breakpoint
CREATE TABLE `manual_schedule_cells` (
  `id` CHAR(36) NOT NULL,
  `template_id` CHAR(36) NOT NULL,
  `cycle_day` INT UNSIGNED NOT NULL,
  `membership_id` CHAR(36) NOT NULL,
  `shift_type_id` CHAR(36) NOT NULL,
  `shift_type_configuration_version` INT UNSIGNED NOT NULL,
  `active_cell_key` VARCHAR(80) GENERATED ALWAYS AS (
    IF(`deleted_at` IS NULL, CONCAT(`template_id`, ':', `cycle_day`, ':', `membership_id`), NULL)
  ) STORED,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at` TIMESTAMP(3) NULL,
  `version` INT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `manual_schedule_cells_active_cell_unique` (`active_cell_key`),
  KEY `manual_schedule_cells_template_idx` (`template_id`),
  CONSTRAINT `manual_schedule_cells_template_id_fk` FOREIGN KEY (`template_id`) REFERENCES `manual_schedule_templates` (`id`),
  CONSTRAINT `manual_schedule_cells_membership_id_fk` FOREIGN KEY (`membership_id`) REFERENCES `group_memberships` (`id`),
  CONSTRAINT `manual_schedule_cells_shift_type_id_fk` FOREIGN KEY (`shift_type_id`) REFERENCES `shift_types` (`id`),
  CONSTRAINT `manual_schedule_cells_cycle_day_check` CHECK (`cycle_day` BETWEEN 1 AND 31),
  CONSTRAINT `manual_schedule_cells_configuration_version_check` CHECK (`shift_type_configuration_version` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
