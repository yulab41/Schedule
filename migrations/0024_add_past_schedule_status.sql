ALTER TABLE `schedule_periods`
  MODIFY COLUMN `status` ENUM(
    'draft',
    'pending_publication',
    'published',
    'withdrawn',
    'replaced',
    'past'
  ) NOT NULL DEFAULT 'draft';
