CREATE TABLE account_activity_summaries (
  user_id CHAR(36) NOT NULL PRIMARY KEY,
  started_at TIMESTAMP(3) NOT NULL,
  day CHAR(10) NOT NULL,
  today_login_count INT UNSIGNED NOT NULL DEFAULT 0,
  today_open_count INT UNSIGNED NOT NULL DEFAULT 0,
  total_open_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
  last_login_at TIMESTAMP(3) NULL,
  last_login_method ENUM('password','wechat_manual','wechat_auto','wechat_binding','wechat_unspecified') NULL,
  last_opened_at TIMESTAMP(3) NULL,
  CONSTRAINT account_activity_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE account_open_receipts (
  user_id CHAR(36) NOT NULL,
  event_id CHAR(36) NOT NULL,
  opened_at TIMESTAMP(3) NOT NULL,
  PRIMARY KEY (user_id, event_id),
  KEY account_open_receipts_opened_idx (opened_at),
  CONSTRAINT account_open_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
