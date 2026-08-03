ALTER TABLE `groups`
  ADD COLUMN `swap_approval_required_manually_set` TINYINT UNSIGNED NOT NULL DEFAULT 0
    AFTER `swap_approval_required`,
  MODIFY COLUMN `swap_approval_required` TINYINT UNSIGNED NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `group_memberships`
  ADD COLUMN `auto_accept_swaps_manually_set` TINYINT UNSIGNED NOT NULL DEFAULT 0
    AFTER `auto_accept_swaps`,
  MODIFY COLUMN `auto_accept_swaps` TINYINT UNSIGNED NOT NULL DEFAULT 1;
--> statement-breakpoint
UPDATE `groups`
  SET `swap_approval_required` = 0,
      `swap_approval_required_manually_set` = 0;
--> statement-breakpoint
UPDATE `group_memberships`
  SET `auto_accept_swaps` = 1,
      `auto_accept_swaps_manually_set` = 0;
