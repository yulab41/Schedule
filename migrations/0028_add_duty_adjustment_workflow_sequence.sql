ALTER TABLE `duty_adjustments`
  ADD COLUMN `workflow_sequence` BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER `created_at`,
  ADD INDEX `duty_adjustments_covered_sequence_idx` (`covered_assignment_id`, `workflow_sequence`);
