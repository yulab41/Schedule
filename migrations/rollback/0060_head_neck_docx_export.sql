UPDATE export_jobs SET file_format = 'xlsx' WHERE file_format = 'docx';

ALTER TABLE export_jobs
  MODIFY COLUMN file_format ENUM('csv', 'xlsx') NOT NULL DEFAULT 'csv';
