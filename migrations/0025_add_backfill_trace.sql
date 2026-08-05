ALTER TABLE `shift_assignments`
  ADD COLUMN `backfill_at` TIMESTAMP(3) NULL AFTER `version`,
  ADD COLUMN `backfill_operator_user_id` CHAR(36) NULL AFTER `backfill_at`,
  ADD COLUMN `backfill_reason` VARCHAR(1000) NULL AFTER `backfill_operator_user_id`,
  ADD CONSTRAINT `shift_assignments_backfill_operator_fk`
    FOREIGN KEY (`backfill_operator_user_id`) REFERENCES `users` (`id`);
