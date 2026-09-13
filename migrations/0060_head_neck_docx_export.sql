ALTER TABLE export_jobs
  MODIFY COLUMN file_format ENUM('csv', 'xlsx', 'docx') NOT NULL DEFAULT 'csv';
