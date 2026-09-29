CREATE TABLE `external_duty_checks` (
  `business_date` date NOT NULL,
  `group_id` char(36) NOT NULL,
  `remote_name` varchar(100) NOT NULL,
  `local_name` varchar(100) NULL,
  `assignment_id` char(36) NULL,
  `change_source` enum('initial','remote','local','both') NOT NULL,
  `status` enum('aligned','pending','processing','blocked') NOT NULL,
  `block_reason` varchar(255) NULL,
  `fingerprint` char(64) NOT NULL,
  `observed_at` timestamp(3) NOT NULL,
  `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`business_date`),
  KEY `external_duty_checks_status_date_idx` (`status`, `business_date`)
);
