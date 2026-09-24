-- This rollback requires no duplicate (period, starts_at, slot_position) rows,
-- including soft-deleted rows. Stop and inspect before running if duplicates exist.
ALTER TABLE `shift_assignments`
  DROP INDEX `shift_assignments_slot_unique`,
  DROP COLUMN `active_slot_position`,
  ADD UNIQUE KEY `shift_assignments_slot_unique` (`schedule_period_id`, `starts_at`, `slot_position`);
