CREATE TABLE `group_visitor_qr_assets` (
  `group_id` char(36) NOT NULL,
  `environment` enum('release', 'trial') NOT NULL,
  `visitor_key` varchar(64) NOT NULL,
  `content` mediumblob NOT NULL,
  `content_type` varchar(32) NOT NULL,
  `byte_length` int unsigned NOT NULL,
  `sha256` char(64) NOT NULL,
  `generated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`group_id`, `environment`),
  KEY `group_visitor_qr_assets_visitor_key_idx` (`visitor_key`),
  CONSTRAINT `group_visitor_qr_assets_group_id_fk`
    FOREIGN KEY (`group_id`) REFERENCES `groups` (`id`) ON DELETE CASCADE,
  CONSTRAINT `group_visitor_qr_assets_byte_length_check`
    CHECK (`byte_length` BETWEEN 1 AND 1048576),
  CONSTRAINT `group_visitor_qr_assets_content_type_check`
    CHECK (`content_type` IN ('image/jpeg', 'image/png'))
);
