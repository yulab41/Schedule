CREATE INDEX platform_job_runs_status_finished_idx ON platform_job_runs (status, finished_at, id);
--> statement-breakpoint
ALTER TABLE notification_deliveries
  ADD COLUMN claim_token CHAR(36) NULL,
  ADD COLUMN claimed_until TIMESTAMP(3) NULL;
