DELETE FROM `directory_search_aliases`
WHERE `type` = 't9';
--> statement-breakpoint
ALTER TABLE `directory_search_aliases`
  MODIFY COLUMN `type` ENUM('source', 'manual', 'pinyin_full', 'pinyin_compact', 'pinyin_initials') NOT NULL;
