ALTER TABLE `directory_entries`
  ADD COLUMN `employee_code` VARCHAR(64) NULL AFTER `contact_name`;
--> statement-breakpoint
CREATE INDEX `directory_entries_batch_employee_code_idx`
  ON `directory_entries` (`batch_id`, `employee_code`);
