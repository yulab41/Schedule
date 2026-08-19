ALTER TABLE `directory_import_batches`
  ADD COLUMN `directory_kind` ENUM('internal', 'employee') NOT NULL DEFAULT 'internal' AFTER `schema_version`;
--> statement-breakpoint
DROP INDEX `directory_import_batches_published_slot_unique` ON `directory_import_batches`;
--> statement-breakpoint
CREATE UNIQUE INDEX `directory_import_batches_published_slot_unique`
  ON `directory_import_batches` (`directory_kind`, `published_slot`);
--> statement-breakpoint
ALTER TABLE `directory_search_aliases`
  MODIFY COLUMN `type` ENUM('source', 'manual', 'pinyin_full', 'pinyin_compact', 'pinyin_initials', 't9') NOT NULL;
