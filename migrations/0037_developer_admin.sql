ALTER TABLE `users`
  ADD COLUMN `is_developer_admin` TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER `cloudbase_uid`;
--> statement-breakpoint

INSERT INTO `users` (`id`, `cloudbase_uid`, `is_developer_admin`, `status`)
VALUES ('00000000-0000-4000-8000-000000000001', 'password_00000000-0000-4000-8000-000000000001', 1, 'active');
--> statement-breakpoint

INSERT INTO `user_profiles` (`user_id`, `real_name`)
VALUES ('00000000-0000-4000-8000-000000000001', '后台管理员');
--> statement-breakpoint

INSERT INTO `user_password_credentials` (`user_id`, `username`, `password_hash`)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'admin',
  'scrypt$16384$8$1$dCdtgkk55MS3hjvhtkK2eg$kka-ij6S3rm_OR5dLTjZ6m_A3f9SDpPgySVOIDHsF-p3-tMe45K2-9B3T2ajzd52fgRitB2SVuCjhG5X1UueNg'
);
--> statement-breakpoint

INSERT INTO `group_memberships` (`id`, `group_id`, `user_id`, `role`, `status`)
SELECT UUID(), `groups`.`id`, '00000000-0000-4000-8000-000000000001', 'administrator', 'active'
FROM `groups`
WHERE NOT EXISTS (
  SELECT 1
  FROM `group_memberships`
  WHERE `group_memberships`.`group_id` = `groups`.`id`
    AND `group_memberships`.`user_id` = '00000000-0000-4000-8000-000000000001'
    AND `group_memberships`.`deleted_at` IS NULL
);
