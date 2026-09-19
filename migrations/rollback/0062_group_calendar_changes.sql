DROP TABLE IF EXISTS `group_calendar_changes`;

ALTER TABLE `groups`
  DROP COLUMN `calendar_revision`;
