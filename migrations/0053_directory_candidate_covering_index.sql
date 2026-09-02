SET @schedule_0053_previous_lock_wait_timeout := @@SESSION.lock_wait_timeout;
--> statement-breakpoint
SET SESSION lock_wait_timeout = 5;
--> statement-breakpoint
SET @schedule_0053_columns := (
  SELECT GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ',')
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'directory_search_aliases'
    AND INDEX_NAME = 'directory_search_aliases_entry_type_normalized_idx'
);
--> statement-breakpoint
SET @schedule_0053_non_unique := (
  SELECT GROUP_CONCAT(DISTINCT NON_UNIQUE ORDER BY NON_UNIQUE SEPARATOR ',')
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'directory_search_aliases'
    AND INDEX_NAME = 'directory_search_aliases_entry_type_normalized_idx'
);
--> statement-breakpoint
SET @schedule_0053_index_type := (
  SELECT GROUP_CONCAT(DISTINCT INDEX_TYPE ORDER BY INDEX_TYPE SEPARATOR ',')
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'directory_search_aliases'
    AND INDEX_NAME = 'directory_search_aliases_entry_type_normalized_idx'
);
--> statement-breakpoint
SET @schedule_0053_is_visible := (
  SELECT GROUP_CONCAT(DISTINCT IS_VISIBLE ORDER BY IS_VISIBLE SEPARATOR ',')
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'directory_search_aliases'
    AND INDEX_NAME = 'directory_search_aliases_entry_type_normalized_idx'
);
--> statement-breakpoint
SET @schedule_0053_action := CASE
  WHEN @schedule_0053_columns IS NULL THEN
    'ALTER TABLE directory_search_aliases ADD INDEX directory_search_aliases_entry_type_normalized_idx (entry_id, type, normalized_value), ALGORITHM=INPLACE, LOCK=NONE'
  WHEN @schedule_0053_columns = 'entry_id,type,normalized_value'
    AND @schedule_0053_non_unique = '1'
    AND @schedule_0053_index_type = 'BTREE'
    AND @schedule_0053_is_visible = 'YES' THEN
    'SELECT 1'
  ELSE
    'SIGNAL SQLSTATE ''45000'' SET MESSAGE_TEXT = ''directory candidate index definition mismatch'''
END;
--> statement-breakpoint
PREPARE schedule_0053_statement FROM @schedule_0053_action;
--> statement-breakpoint
EXECUTE schedule_0053_statement;
--> statement-breakpoint
DEALLOCATE PREPARE schedule_0053_statement;
--> statement-breakpoint
SET SESSION lock_wait_timeout = @schedule_0053_previous_lock_wait_timeout;
--> statement-breakpoint
SET @schedule_0053_previous_lock_wait_timeout := NULL,
    @schedule_0053_columns := NULL,
    @schedule_0053_non_unique := NULL,
    @schedule_0053_index_type := NULL,
    @schedule_0053_is_visible := NULL,
    @schedule_0053_action := NULL;
