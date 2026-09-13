ALTER TABLE wechat_admin_binding_tickets
  MODIFY COLUMN status ENUM('pending', 'consumed', 'revoked') NOT NULL DEFAULT 'pending',
  ADD COLUMN group_id CHAR(36) NULL AFTER target_user_id,
  ADD COLUMN target_membership_id CHAR(36) NULL AFTER group_id,
  ADD COLUMN target_auth_version INT UNSIGNED NULL AFTER target_membership_id,
  ADD COLUMN created_by_user_id CHAR(36) NULL AFTER target_auth_version,
  ADD COLUMN initiated_by ENUM('platform_admin', 'group_admin') NOT NULL DEFAULT 'platform_admin' AFTER created_by_user_id,
  ADD INDEX wechat_admin_binding_tickets_group_membership_idx (group_id, target_membership_id);
