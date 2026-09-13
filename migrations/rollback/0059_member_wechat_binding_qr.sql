ALTER TABLE wechat_admin_binding_tickets
  DROP INDEX wechat_admin_binding_tickets_group_membership_idx,
  DROP COLUMN initiated_by,
  DROP COLUMN created_by_user_id,
  DROP COLUMN target_auth_version,
  DROP COLUMN target_membership_id,
  DROP COLUMN group_id,
  MODIFY COLUMN status ENUM('pending', 'consumed') NOT NULL DEFAULT 'pending';
