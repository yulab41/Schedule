ALTER TABLE `shift_assignments`
  DROP INDEX `shift_assignments_slot_unique`,
  ADD COLUMN `active_slot_position` int unsigned GENERATED ALWAYS AS (if(`deleted_at` is null, `slot_position`, null)) STORED,
  ADD UNIQUE KEY `shift_assignments_slot_unique` (`schedule_period_id`, `starts_at`, `active_slot_position`);
