ALTER TABLE export_jobs
  ADD COLUMN file_format ENUM('csv', 'xlsx') NOT NULL DEFAULT 'csv' AFTER export_type,
  ADD COLUMN schedule_role_ids JSON NULL AFTER schedule_role_id,
  ADD COLUMN membership_ids JSON NULL AFTER membership_id;
