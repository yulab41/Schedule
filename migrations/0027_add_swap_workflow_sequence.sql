ALTER TABLE `swap_requests`
  ADD COLUMN `workflow_sequence` BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER `created_at`,
  ADD INDEX `swap_requests_initiator_sequence_idx` (`initiator_assignment_id`, `workflow_sequence`),
  ADD INDEX `swap_requests_target_sequence_idx` (`target_assignment_id`, `workflow_sequence`);
