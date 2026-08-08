ALTER TABLE `group_memberships`
  MODIFY COLUMN `role`
    ENUM('owner', 'administrator', 'member', 'guest')
    NOT NULL DEFAULT 'member';
